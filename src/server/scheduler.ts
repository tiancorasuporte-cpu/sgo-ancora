import "@tanstack/react-start/server-only";

import { getSetting, setSetting } from "@/db/settings";
import { sendDueReminders } from "@/server/omie/notifications";
import { syncAllOmieApps } from "@/server/omie/sync";

let schedulerStarted = false;

const SCHEDULER_KEY = "__omie_scheduler_started__";

function isSchedulerStarted() {
  return schedulerStarted || Boolean((globalThis as Record<string, unknown>)[SCHEDULER_KEY]);
}

function markSchedulerStarted() {
  schedulerStarted = true;
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;
}

let notifyInProgress = false;

async function runNotificationsOnce() {
  if (notifyInProgress) return;
  notifyInProgress = true;
  try {
    await sendDueReminders();
  } finally {
    notifyInProgress = false;
  }
}
let lastSyncAt = 0;
let lastNotifySlot = "";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function currentHourMinute() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function currentHourSlot() {
  const now = new Date();
  return `${todayKey()}-${String(now.getHours()).padStart(2, "0")}`;
}

async function tick() {
  const { isDatabaseConfigured } = await import("@/db/client");
  if (!isDatabaseConfigured()) return;

  if (process.env["WAHA_BOT_IN_DEV"] !== "true") {
    try {
      const { stopWahaEventsSocket } = await import("@/server/waha-events");
      const { stopWahaWebhookHttpServer } = await import("@/server/waha-webhook-http");
      stopWahaEventsSocket();
      stopWahaWebhookHttpServer();
    } catch {
      // ignore
    }
  }

  try {
    const now = Date.now();
    if (now - lastSyncAt > 6 * 60 * 60 * 1000) {
      await runExclusiveSync();
    }

    const notifyTime = (await getSetting("notification_time")) ?? "09:00";
    const slot = currentHourSlot();
    // Depois do horário configurado, tenta a cada hora (respeita limite horário / remanescentes).
    if (currentHourMinute() >= notifyTime && lastNotifySlot !== slot) {
      lastNotifySlot = slot;
      await runNotificationsOnce();
    }
  } catch (error) {
    console.error("[scheduler]", error);
  }
}

export function startScheduler() {
  if (isSchedulerStarted()) {
    void ensureWahaWebhook();
    return;
  }
  markSchedulerStarted();

  void tick();
  void ensureWahaWebhook();
  setInterval(() => {
    void tick();
  }, 60_000);
}

async function ensureWahaWebhook() {
  // Bot inbound roda via `npm run bot:listen` — derruba conexões legadas do dev.
  if (process.env["WAHA_BOT_IN_DEV"] !== "true") {
    try {
      const { stopWahaEventsSocket } = await import("@/server/waha-events");
      const { stopWahaWebhookHttpServer } = await import("@/server/waha-webhook-http");
      stopWahaEventsSocket();
      stopWahaWebhookHttpServer();
    } catch {
      // ignore
    }
    return;
  }

  try {
    const { getSetting } = await import("@/db/settings");
    const { isWahaConfigured, registerWahaInboundWebhook } = await import("@/server/waha");
    const { startWahaWebhookHttpServer } = await import("@/server/waha-webhook-http");
    const { startWahaEventsSocket } = await import("@/server/waha-events");
    if (!isWahaConfigured()) return;

    const botEnabled = (await getSetting("whatsapp_bot_enabled")) !== "false";
    if (!botEnabled) return;

    void startWahaEventsSocket();
    startWahaWebhookHttpServer();

    if (process.env["WAHA_BOT_REGISTER_WEBHOOK"] !== "true") {
      console.info("[waha-bot] WebSocket ativo no dev (webhook WAHA desligado).");
      return;
    }

    const publicUrl =
      (await getSetting("public_app_url"))?.trim() ||
      process.env["PUBLIC_APP_URL"]?.trim() ||
      "";
    if (!publicUrl) return;

    const result = await registerWahaInboundWebhook(publicUrl);
    if (!result.ok) {
      console.warn("[waha-bot]", result.error);
      return;
    }
    console.info("[waha-bot] Webhook registrado:", result.webhookUrl);
  } catch (error) {
    console.warn("[waha-bot] Falha ao registrar webhook:", error);
  }
}

type ManualSyncResult = Awaited<ReturnType<typeof syncAllOmieApps>>;

type ManualSyncJob = {
  status: "idle" | "running" | "done";
  startedAt: number | null;
  finishedAt: number | null;
  result: ManualSyncResult | null;
  error: string | null;
  percent: number;
  label: string;
};

let manualSyncJob: ManualSyncJob = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
  percent: 0,
  label: "",
};

/** Uma sync por vez (manual + scheduler). */
let activeSyncPromise: Promise<ManualSyncResult> | null = null;

function snapshotManualSyncJob() {
  return {
    status: manualSyncJob.status,
    startedAt: manualSyncJob.startedAt,
    finishedAt: manualSyncJob.finishedAt,
    result: manualSyncJob.result,
    error: manualSyncJob.error,
    percent: manualSyncJob.percent,
    label: manualSyncJob.label,
  };
}

async function runExclusiveSync(
  daysBack = 90,
  daysAhead = 120,
  onProgress?: Parameters<typeof syncAllOmieApps>[2],
) {
  if (activeSyncPromise) return activeSyncPromise;

  lastSyncAt = Date.now();
  activeSyncPromise = (async () => {
    try {
      const { abandonStaleOpenSyncLogs } = await import("@/db/due-items");
      const abandoned = await abandonStaleOpenSyncLogs();
      if (abandoned > 0) console.warn("[sync] fechou sync_log órfãos:", abandoned);
      return await syncAllOmieApps(daysBack, daysAhead, onProgress);
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/** Sync síncrono (scheduler / admin). Preferir `startManualSyncBackground` na UI. */
export async function runManualSync() {
  return runExclusiveSync();
}

/**
 * Dispara o sync Omie sem segurar a conexão HTTP.
 * Cloudflare corta requests ~100s; o sync de 3 apps + sleep passa disso.
 */
export function startManualSyncBackground() {
  if (manualSyncJob.status === "running" || activeSyncPromise) {
    return {
      ok: true as const,
      started: false as const,
      alreadyRunning: true as const,
      ...snapshotManualSyncJob(),
    };
  }

  manualSyncJob = {
    status: "running",
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
    percent: 0,
    label: "Iniciando sincronização Omie...",
  };

  void (async () => {
    try {
      const result = await runExclusiveSync(90, 120, (progress) => {
        if (manualSyncJob.status !== "running") return;
        manualSyncJob.percent = progress.percent;
        manualSyncJob.label = progress.label;
      });
      const avisos = (result.results ?? []).flatMap((item) =>
        !item.ok
          ? [item.error || item.appId]
          : "errors" in item && item.errors.length
            ? item.errors
            : [],
      );
      manualSyncJob = {
        status: "done",
        startedAt: manualSyncJob.startedAt,
        finishedAt: Date.now(),
        result,
        error: null,
        percent: 100,
        label: avisos.length
          ? `Concluído com avisos (${avisos.length})`
          : "Sincronização concluída",
      };
      console.info("[sync] manual background done", { avisos: avisos.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na sincronização";
      manualSyncJob = {
        status: "done",
        startedAt: manualSyncJob.startedAt,
        finishedAt: Date.now(),
        result: null,
        error: message,
        percent: manualSyncJob.percent,
        label: message,
      };
      console.error("[sync] manual background failed", error);
    }
  })();

  return {
    ok: true as const,
    started: true as const,
    alreadyRunning: false as const,
    ...snapshotManualSyncJob(),
  };
}

export function getManualSyncStatus() {
  return snapshotManualSyncJob();
}

export async function runManualNotifications() {
  lastNotifySlot = currentHourSlot();
  return sendDueReminders();
}

export async function ensureDefaultSettings() {
  const { isDatabaseConfigured } = await import("@/db/client");
  if (!isDatabaseConfigured()) return;

  const defaults: Record<string, string> = {
    // Desligado por padrão: já existe outro sistema enviando no horário das 09:00.
    notifications_enabled: "false",
    notification_time: "09:00",
    default_notify_phone: "",
    test_mode_enabled: "true",
    test_notify_phone: "",
    notification_hourly_limit: "12",
    whatsapp_bot_enabled: "true",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const current = await getSetting(key);
    if (current == null) await setSetting(key, value);
  }

  const envTestPhone = process.env["TEST_NOTIFY_PHONE"]?.trim();
  if (envTestPhone) {
    const current = await getSetting("test_notify_phone");
    if (!current) await setSetting("test_notify_phone", envTestPhone);
  }
}
