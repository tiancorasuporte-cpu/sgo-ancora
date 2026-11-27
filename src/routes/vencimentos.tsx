import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { AppShell, useShellSearch } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { btnOnPrimaryOutline, btnPrimary, PageTitle } from "@/components/PageChrome";
import { paginateList, TablePager } from "@/components/TablePager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotificationSettingsFn,
  getOmieAppsFn,
  getDueItemBoletoViewFn,
  getSyncDueItemsStatusFn,
  listDueItemsFn,
  previewDueItemsSendFn,
  sendDueItemNotificationFn,
  sendSelectedDueItemsFn,
  syncDueItemsFn,
  updateDueItemClientPhoneFn,
} from "@/lib/omie";
import { requireModule } from "@/lib/require-auth";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { DueItem, DueItemType } from "@/db/schema";
import { notifyFeedback } from "@/lib/notify";

/** Feedback global via toast (sem banner persistente na página). */
function setFeedback(fb: { type: "ok" | "error" | "info"; text: string } | null) {
  notifyFeedback(fb);
}

const PAGE_SIZE = 15;

const TYPE_LABELS = {
  boleto: "Boleto",
  nfe: "NF-e",
  nfse: "NFS-e",
} as const;

type TypeFilter = "all" | DueItemType;
type ListScope = "open" | "received";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/vencimentos")({
  validateSearch: searchSchema,
  beforeLoad: () => requireModule("vencimentos"),
  loader: async () => {
    const [lists, apps, notifySettings] = await Promise.all([
      listDueItemsFn(),
      getOmieAppsFn(),
      getNotificationSettingsFn().catch(() => null),
    ]);
    return {
      openItems: lists.open,
      receivedItems: lists.received,
      apps,
      notifySettings,
    };
  },
  head: () => ({
    meta: [{ title: `Vencimentos — ${APP_NAME}` }],
  }),
  component: VencimentosPage,
});

function formatDate(value: string | Date) {
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (value: Date) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  return { from: toIso(start), to: toIso(end) };
}

function currentMonthLabel() {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function matchesText(value: string | null | undefined, filter: string) {
  if (!filter.trim()) return true;
  return String(value ?? "")
    .toLowerCase()
    .includes(filter.trim().toLowerCase());
}

function downloadPdfBase64(filename: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function dueTone(dueDate: string) {
  const today = todayIso();
  if (dueDate < today) return "overdue" as const;
  if (dueDate === today) return "today" as const;
  return "upcoming" as const;
}

function TypeBadge({ type }: { type: DueItemType }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-sm py-xs text-label-md font-medium",
        type === "boleto" && "bg-primary-container/40 text-primary",
        type === "nfe" && "bg-secondary-container/50 text-on-secondary-container",
        type === "nfse" && "bg-tertiary-container/50 text-on-tertiary-container",
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-md py-md",
        tone === "warn" && "border-error/30 bg-error-container/15",
        tone === "ok" && "border-secondary-container/50 bg-secondary-container/20",
        tone === "default" && "border-outline-variant bg-surface-container-lowest",
      )}
    >
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <p
        className={cn(
          "mt-xs text-headline-md font-semibold tracking-tight",
          tone === "warn" ? "text-error" : "text-primary",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-xs text-label-md text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

function VencimentosPage() {
  const { openItems, receivedItems, apps, notifySettings } = Route.useLoaderData();
  const testMode = Boolean(notifySettings?.testModeEnabled);
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { page: urlPage } = Route.useSearch();
  const { query } = useShellSearch();
  const [listScope, setListScope] = useState<ListScope>("open");
  const items = listScope === "open" ? openItems : receivedItems;
  const [appFilter, setAppFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [clientFilter, setClientFilter] = useState("");
  const [documentFilter, setDocumentFilter] = useState("");
  const monthRange = useMemo(() => currentMonthRange(), []);
  const [dueFrom, setDueFrom] = useState(monthRange.from);
  const [dueTo, setDueTo] = useState(monthRange.to);
  const [issueFrom, setIssueFrom] = useState("");
  const [issueTo, setIssueTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [includeXml, setIncludeXml] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhoneId, setSavingPhoneId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncPercent, setSyncPercent] = useState(0);
  const [syncLabel, setSyncLabel] = useState("");
  const [paidConfirmWarnings, setPaidConfirmWarnings] = useState<string[] | null>(
    null,
  );
  const [checkingPaid, setCheckingPaid] = useState(false);
  const paidConfirmResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const paidConfirmDecidedRef = useRef(false);
  const paidConfirmOpenedAtRef = useRef(0);
  const busy =
    sendingId !== null ||
    bulkSending ||
    viewingId !== null ||
    savingPhoneId !== null ||
    syncing ||
    checkingPaid ||
    paidConfirmWarnings != null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (appFilter !== "all" && item.omieAppId !== appFilter) return false;
      if (typeFilter !== "all" && item.itemType !== typeFilter) return false;
      if (!matchesText(item.clientName, clientFilter)) return false;
      if (!matchesText(item.documentNumber, documentFilter)) return false;
      if (dueFrom && item.dueDate < dueFrom) return false;
      if (dueTo && item.dueDate > dueTo) return false;
      if (issueFrom || issueTo) {
        if (!item.issueDate) return false;
        if (issueFrom && item.issueDate < issueFrom) return false;
        if (issueTo && item.issueDate > issueTo) return false;
      }
      if (!q) return true;
      return [item.clientName, item.documentNumber, item.omieAppName, item.clientPhone]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(q));
    });
  }, [
    items,
    query,
    appFilter,
    typeFilter,
    clientFilter,
    documentFilter,
    dueFrom,
    dueTo,
    issueFrom,
    issueTo,
  ]);

  const hasActiveFilters =
    appFilter !== "all" ||
    typeFilter !== "all" ||
    clientFilter.trim() !== "" ||
    documentFilter.trim() !== "" ||
    dueFrom !== monthRange.from ||
    dueTo !== monthRange.to ||
    issueFrom !== "" ||
    issueTo !== "";

  const summary = useMemo(() => {
    const today = todayIso();
    let overdue = 0;
    let todayCount = 0;
    let total = 0;
    for (const item of filtered) {
      total += item.amount ?? 0;
      if (item.dueDate < today) overdue += 1;
      else if (item.dueDate === today) todayCount += 1;
    }
    return { count: filtered.length, overdue, todayCount, total };
  }, [filtered]);

  const pagination = useMemo(
    () => paginateList(filtered, urlPage, PAGE_SIZE),
    [filtered, urlPage],
  );

  const pageIds = useMemo(
    () => pagination.items.map((item) => item.id),
    [pagination.items],
  );
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  useEffect(() => {
    if (urlPage > pagination.totalPages) {
      navigate({ search: { page: pagination.totalPages }, replace: true });
    }
  }, [urlPage, pagination.totalPages, navigate]);

  useEffect(() => {
    navigate({ search: { page: 1 }, replace: true });
  }, [query, navigate]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    query,
    listScope,
    appFilter,
    typeFilter,
    clientFilter,
    documentFilter,
    dueFrom,
    dueTo,
    issueFrom,
    issueTo,
  ]);

  const setPage = (nextPage: number) => {
    navigate({ search: { page: nextPage } });
  };

  const resetFilters = () => {
    setAppFilter("all");
    setTypeFilter("all");
    setClientFilter("");
    setDocumentFilter("");
    setDueFrom(monthRange.from);
    setDueTo(monthRange.to);
    setIssueFrom("");
    setIssueTo("");
    setPage(1);
  };

  async function viewDocument(item: DueItem) {
    setViewingId(item.id);
    setFeedback(null);
    try {
      const result = await getDueItemBoletoViewFn({
        data: { dueItemId: item.id },
      });
      if (!result.ok) {
        setFeedback({ type: "error", text: result.error });
        return;
      }
      if (result.mode === "link") {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      downloadPdfBase64(result.filename, result.base64);
    } finally {
      setViewingId(null);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function startEditPhone(item: DueItem) {
    if (!item.clientCode) {
      setFeedback({ type: "error", text: "Cliente Omie não vinculado — não é possível alterar o telefone." });
      return;
    }
    setEditingPhoneId(item.id);
    setPhoneDraft(item.clientPhone ?? "");
    setFeedback(null);
  }

  async function savePhone(item: DueItem) {
    if (!item.clientCode) return;
    setSavingPhoneId(item.id);
    setFeedback(null);
    try {
      const result = await updateDueItemClientPhoneFn({
        data: { dueItemId: item.id, phone: phoneDraft },
      });
      if (!result.ok) {
        setFeedback({ type: "error", text: result.error });
        return;
      }
      setEditingPhoneId(null);
      setFeedback({
        type: "ok",
        text: `Telefone atualizado na Omie e nos vencimentos deste cliente (${result.phone}).`,
      });
      await router.invalidate();
    } finally {
      setSavingPhoneId(null);
    }
  }

  async function confirmPaidWarnings(dueItemIds: number[]) {
    setCheckingPaid(true);
    try {
      let warnings: string[] = [];
      try {
        const preview = await previewDueItemsSendFn({ data: { dueItemIds } });
        warnings = preview.warnings;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Falha ao consultar Omie.";
        warnings = [
          `Não foi possível confirmar na Omie se o(s) documento(s) estão pagos (${msg}).`,
        ];
      }
      if (!warnings.length) return true;
      return new Promise<boolean>((resolve) => {
        paidConfirmDecidedRef.current = false;
        paidConfirmResolveRef.current = resolve;
        paidConfirmOpenedAtRef.current = Date.now();
        setPaidConfirmWarnings(warnings);
      });
    } finally {
      setCheckingPaid(false);
    }
  }

  function closePaidConfirm(ok: boolean) {
    if (paidConfirmDecidedRef.current) return;
    paidConfirmDecidedRef.current = true;
    const resolve = paidConfirmResolveRef.current;
    paidConfirmResolveRef.current = null;
    setPaidConfirmWarnings(null);
    resolve?.(ok);
  }

  async function sendAlert(item: DueItem) {
    setSendingId(item.id);
    setFeedback(null);
    try {
      const proceed = await confirmPaidWarnings([item.id]);
      if (!proceed) {
        setFeedback({ type: "info", text: "Envio cancelado." });
        return;
      }
      const result = await sendDueItemNotificationFn({
        data: { dueItemId: item.id, includeXml },
      });
      if (!result.ok) {
        setFeedback({ type: "error", text: result.error });
        return;
      }
      const warn =
        result.errors.length > 0 ? ` Avisos: ${result.errors.join("; ")}` : "";
      setFeedback({
        type: "ok",
        text: result.testMode
          ? `Enviado em modo teste para ${result.sentPhones} número(s).${warn}`
          : `Alerta enviado para ${result.sentPhones} número(s).${warn}`,
      });
      await router.invalidate();
    } finally {
      setSendingId(null);
    }
  }

  async function sendSelected() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkSending(true);
    setFeedback(null);
    try {
      const proceed = await confirmPaidWarnings(ids);
      if (!proceed) {
        setFeedback({ type: "info", text: "Envio em lote cancelado." });
        return;
      }
      const result = await sendSelectedDueItemsFn({
        data: { dueItemIds: ids, includeXml },
      });
      if (!result.ok) {
        setFeedback({ type: "error", text: result.error });
        return;
      }
      const warn =
        result.errors.length > 0 ? ` Avisos: ${result.errors.join("; ")}` : "";
      setFeedback({
        type: "ok",
        text: result.testMode
          ? `MODO TESTE: ${result.sent} doc(s) · ${result.contacts ?? "?"} msg(s) só no número de teste.${warn}`
          : `Lote enviado: ${result.sent} documento(s) · ${result.contacts ?? "?"} contato(s).${warn}`,
      });
      setSelectedIds(new Set());
      await router.invalidate();
    } finally {
      setBulkSending(false);
    }
  }

  const inputClass =
    "mt-xs w-full rounded-lg border border-outline-variant bg-surface px-md py-sm text-body-md text-primary outline-none transition-colors focus:border-outline";

  return (
    <AppShell mobileTitle="Vencimentos" searchPlaceholder="Busca rápida (cliente, documento, telefone)...">
      <main className="vencimentos-fit flex-1 p-margin-mobile md:p-margin-desktop">
        <div className="vencimentos-fit-inner mx-auto max-w-7xl space-y-lg">
          <PageTitle
            title="Vencimentos"
            subtitle={
              <>
                Documentos em aberto · padrão {currentMonthLabel()}
                {testMode
                  ? ` · Modo teste: ${notifySettings?.testNotifyPhone || "número de teste"}`
                  : null}
              </>
            }
          >
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setSyncing(true);
                setSyncPercent(0);
                setSyncLabel("Iniciando...");
                setFeedback(null);
                try {
                  const started = await syncDueItemsFn();
                  if (!started?.ok) {
                    setFeedback({
                      type: "error",
                      text: "Falha ao iniciar sincronização Omie.",
                    });
                    setSyncing(false);
                    return;
                  }
                  setSyncPercent(started.percent ?? 0);
                  setSyncLabel(started.label || "Sincronizando...");
                  setFeedback({
                    type: "info",
                    text: started.alreadyRunning
                      ? "Sincronização já em andamento — acompanhando progresso..."
                      : "Sincronização iniciada em segundo plano...",
                  });

                  // 3 empresas × etapas Omie pode passar de 15–20 min.
                  const deadline = Date.now() + 30 * 60_000;
                  while (Date.now() < deadline) {
                    await new Promise((r) => setTimeout(r, 1_500));
                    const status = await getSyncDueItemsStatusFn();
                    setSyncPercent(status.percent ?? 0);
                    if (status.label) setSyncLabel(status.label);
                    if (status.status !== "done") continue;

                    if (status.error) {
                      setFeedback({ type: "error", text: status.error });
                      return;
                    }
                    const result = status.result;
                    if (!result || typeof result !== "object" || !("ok" in result) || !result.ok) {
                      setFeedback({
                        type: "error",
                        text:
                          (result && "error" in result && result.error) ||
                          "Falha ao sincronizar Omie.",
                      });
                      return;
                    }
                    const total = (result.results ?? []).reduce(
                      (sum, item) => sum + (item.itemsFound ?? 0),
                      0,
                    );
                    const porEmpresa = (result.results ?? []).map((item) => {
                      const nome = ("appName" in item && item.appName) || item.appId;
                      if (!item.ok) return `${nome}: falhou`;
                      const qtd = item.itemsFound ?? 0;
                      const errs =
                        "errors" in item && Array.isArray(item.errors) ? item.errors.length : 0;
                      return errs ? `${nome}: ${qtd} (avisos)` : `${nome}: ${qtd}`;
                    });
                    const avisos = (result.results ?? [])
                      .flatMap((item) =>
                        "error" in item && item.error
                          ? [item.error]
                          : "errors" in item && Array.isArray(item.errors)
                            ? item.errors
                            : [],
                      )
                      .filter(Boolean);
                    setSyncPercent(100);
                    setSyncLabel("Concluído");
                    setFeedback({
                      type: avisos.length ? "info" : "ok",
                      text: avisos.length
                        ? `Sync parcial (${total} docs): ${porEmpresa.join(" · ")}`
                        : `Sincronização concluída: ${total} docs · ${porEmpresa.join(" · ")}`,
                    });
                    await router.invalidate();
                    return;
                  }
                  setFeedback({
                    type: "info",
                    text: "Sync ainda rodando no servidor — a barra pode ser reaberta; não inicie outro agora.",
                  });
                } catch (error) {
                  setFeedback({
                    type: "error",
                    text: error instanceof Error ? error.message : "Falha ao sincronizar Omie.",
                  });
                } finally {
                  setSyncing(false);
                }
              }}
              className={btnPrimary}
            >
              <Icon name="sync" className="text-[16px]" />
              {syncing ? `Sincronizando ${syncPercent}%` : "Sincronizar boletos e notas"}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              className={btnOnPrimaryOutline}
            >
              <Icon name="tune" className="text-[16px]" />
              {filtersOpen ? "Ocultar filtros" : "Filtros"}
              {hasActiveFilters ? (
                <span className="ml-xs rounded-full bg-secondary-container px-sm py-px text-[0.65rem] font-bold text-on-secondary-container">
                  on
                </span>
              ) : null}
            </button>
          </PageTitle>

          {syncing ? (
            <div
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md"
              role="status"
              aria-live="polite"
            >
              <div className="mb-xs flex items-center justify-between gap-sm text-sm">
                <span className="truncate text-on-surface-variant">{syncLabel || "Sincronizando..."}</span>
                <span className="shrink-0 font-semibold tabular-nums text-on-surface">{syncPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, syncPercent))}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-xs">
            {(
              [
                ["open", "Em aberto", openItems.length],
                ["received", "Recebidos", receivedItems.length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setListScope(value);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-xs rounded-full px-md py-sm text-label-md transition-colors",
                  listScope === value
                    ? "bg-primary font-semibold text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-sm py-px text-[11px] tabular-nums",
                    listScope === value
                      ? "bg-on-primary/15 text-on-primary"
                      : "bg-surface-container-highest text-on-surface-variant",
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {listScope === "received" ? (
            <p className="text-body-md text-on-surface-variant">
              Documentos que a Omie já marcou como pagos/fechados. Dá para reenviar o WhatsApp se
              precisar — o sistema avisa antes.
            </p>
          ) : null}

          <div className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Documentos"
              value={String(summary.count)}
              hint={listScope === "received" ? "Na aba Recebidos" : "Com os filtros atuais"}
            />
            <StatCard label="Valor total" value={formatMoney(summary.total)} />
            {listScope === "open" ? (
              <>
                <StatCard
                  label="Vencem hoje"
                  value={String(summary.todayCount)}
                  tone={summary.todayCount > 0 ? "ok" : "default"}
                />
                <StatCard
                  label="Em atraso"
                  value={String(summary.overdue)}
                  tone={summary.overdue > 0 ? "warn" : "default"}
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Recebidos (lista)"
                  value={String(receivedItems.length)}
                  tone="ok"
                />
                <StatCard
                  label="Em aberto (lista)"
                  value={String(openItems.length)}
                />
              </>
            )}
          </div>

          {filtersOpen ? (
            <section className="space-y-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
              <div className="flex flex-wrap gap-xs">
                {(
                  [
                    ["all", "Todos"],
                    ["boleto", "Boleto"],
                    ["nfe", "NF-e"],
                    ["nfse", "NFS-e"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTypeFilter(value);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full px-md py-xs text-label-md transition-colors",
                      typeFilter === value
                        ? "bg-secondary-container font-semibold text-on-secondary-container"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-sm md:grid-cols-2 lg:grid-cols-4">
                <label className="block text-label-md text-on-surface-variant">
                  Cliente
                  <input
                    value={clientFilter}
                    onChange={(event) => {
                      setClientFilter(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Nome do cliente"
                    className={inputClass}
                  />
                </label>
                <label className="block text-label-md text-on-surface-variant">
                  Nº do documento
                  <input
                    value={documentFilter}
                    onChange={(event) => {
                      setDocumentFilter(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Ex.: 130"
                    className={inputClass}
                  />
                </label>
                <label className="block text-label-md text-on-surface-variant">
                  Empresa
                  <select
                    value={appFilter}
                    onChange={(event) => {
                      setAppFilter(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  >
                    <option value="all">Todas</option>
                    {apps.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-secondary hover:bg-surface-container-high"
                    >
                      Limpar filtros
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-sm border-t border-outline-variant/70 pt-md md:grid-cols-2 lg:grid-cols-4">
                <label className="block text-label-md text-on-surface-variant">
                  Vencimento de
                  <input
                    type="date"
                    value={dueFrom}
                    onChange={(event) => {
                      setDueFrom(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="block text-label-md text-on-surface-variant">
                  Vencimento até
                  <input
                    type="date"
                    value={dueTo}
                    onChange={(event) => {
                      setDueTo(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="block text-label-md text-on-surface-variant">
                  Emissão de
                  <input
                    type="date"
                    value={issueFrom}
                    onChange={(event) => {
                      setIssueFrom(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="block text-label-md text-on-surface-variant">
                  Emissão até
                  <input
                    type="date"
                    value={issueTo}
                    onChange={(event) => {
                      setIssueTo(event.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-sm">
            <label className="inline-flex cursor-pointer items-start gap-sm text-body-md text-primary">
              <input
                type="checkbox"
                checked={includeXml}
                disabled={busy}
                onChange={(e) => setIncludeXml(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-secondary)]"
              />
              <span>
                <span className="font-semibold">Anexar XML da nota</span>
                <span className="mt-0.5 block text-label-md text-on-surface-variant">
                  Opcional. No envio pelo WhatsApp, manda o XML da NF-e/NFS-e quando a Omie tiver.
                </span>
              </span>
            </label>
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-sm">
                <p className="text-body-md text-primary">
                  <span className="font-semibold tabular-nums">{selectedIds.size}</span>{" "}
                  documento(s) selecionado(s)
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedIds(new Set())}
                  className="rounded-lg border border-outline-variant bg-surface px-md py-sm text-label-md text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendSelected()}
                  className="inline-flex items-center gap-xs rounded-lg bg-secondary-container px-md py-sm text-label-md font-semibold text-on-secondary-container hover:opacity-90 disabled:opacity-50"
                >
                  <Icon name={bulkSending ? "hourglass_empty" : "send"} className="text-[16px]" />
                  {bulkSending ? "Enviando..." : "Enviar selecionados"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="overflow-x-auto p-md">
              <table className="min-w-full text-left text-body-md">
                <thead className="sticky top-0 z-10 bg-primary text-label-md font-semibold uppercase tracking-wide text-on-primary">
                  <tr>
                    <th className="w-10 px-sm py-xs">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        disabled={pageIds.length === 0 || busy}
                        onChange={toggleSelectPage}
                        aria-label="Selecionar página"
                        className="size-4 accent-[var(--color-secondary)]"
                      />
                    </th>
                    <th className="px-sm py-xs">Tipo</th>
                    <th className="px-sm py-xs">Cliente</th>
                    <th className="px-sm py-xs">Documento</th>
                    <th className="px-sm py-xs">Emissão</th>
                    <th className="px-sm py-xs">Vencimento</th>
                    <th className="px-sm py-xs">Empresa</th>
                    <th className="px-sm py-xs text-right">Valor</th>
                    <th className="px-sm py-xs">Contato</th>
                    <th className="px-sm py-xs">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-md py-2xl text-center text-on-surface-variant"
                      >
                        {items.length === 0
                          ? listScope === "received"
                            ? "Nenhum documento recebido/fechado na janela recente."
                            : "Nenhum documento na janela sincronizada. Configure os apps Omie e sincronize."
                          : "Nenhum resultado para os filtros aplicados."}
                      </td>
                    </tr>
                  ) : (
                    pagination.items.map((item) => {
                      const tone = dueTone(item.dueDate);
                      const selected = selectedIds.has(item.id);
                      const statusLabel = (item.status ?? "").trim() || "RECEBIDO";
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "border-b border-outline-variant/50 transition-colors hover:bg-surface-container-low/70",
                            selected && "bg-secondary-container/20",
                          )}
                        >
                          <td className="px-md py-sm">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={busy}
                              onChange={() => toggleSelected(item.id)}
                              aria-label={`Selecionar ${item.clientName ?? item.documentNumber ?? item.id}`}
                              className="size-4 accent-[var(--color-secondary)]"
                            />
                          </td>
                          <td className="px-md py-sm">
                            <TypeBadge type={item.itemType} />
                          </td>
                          <td className="max-w-[14rem] px-md py-sm">
                            <p className="truncate font-medium text-primary">
                              {item.clientName ?? "—"}
                            </p>
                            {listScope === "received" ? (
                              <p className="mt-px text-label-md text-secondary">{statusLabel}</p>
                            ) : null}
                          </td>
                          <td className="px-md py-sm tabular-nums text-on-surface">
                            {item.documentNumber ?? "—"}
                          </td>
                          <td className="px-md py-sm text-on-surface-variant">
                            {item.issueDate ? formatDate(item.issueDate) : "—"}
                          </td>
                          <td className="px-md py-sm">
                            <span
                              className={cn(
                                "inline-flex rounded-md px-sm py-xs text-label-md font-semibold tabular-nums",
                                listScope === "received"
                                  ? "bg-secondary-container/40 text-on-secondary-container"
                                  : tone === "overdue"
                                    ? "bg-error-container/40 text-error"
                                    : tone === "today"
                                      ? "bg-secondary-container/60 text-on-secondary-container"
                                      : "text-primary",
                              )}
                            >
                              {formatDate(item.dueDate)}
                            </span>
                          </td>
                          <td className="px-md py-sm text-on-surface-variant">{item.omieAppName}</td>
                          <td className="px-md py-sm text-right font-medium tabular-nums text-primary">
                            {formatMoney(item.amount)}
                          </td>
                          <td className="px-md py-sm">
                            <div className="flex flex-col gap-0.5">
                              {editingPhoneId === item.id ? (
                                <div className="flex flex-wrap items-center gap-xs">
                                  <input
                                    type="tel"
                                    value={phoneDraft}
                                    disabled={savingPhoneId === item.id}
                                    onChange={(event) => setPhoneDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") void savePhone(item);
                                      if (event.key === "Escape") setEditingPhoneId(null);
                                    }}
                                    placeholder="DDD + número"
                                    className="w-36 rounded-md border border-outline-variant bg-surface px-sm py-xs text-label-md tabular-nums"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    disabled={savingPhoneId === item.id}
                                    onClick={() => void savePhone(item)}
                                    className="rounded-md bg-secondary-container px-sm py-xs text-label-md font-semibold text-on-secondary-container disabled:opacity-50"
                                  >
                                    {savingPhoneId === item.id ? "..." : "Salvar"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingPhoneId === item.id}
                                    onClick={() => setEditingPhoneId(null)}
                                    className="rounded-md border border-outline-variant px-sm py-xs text-label-md text-on-surface-variant disabled:opacity-50"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy || !item.clientCode}
                                  onClick={() => startEditPhone(item)}
                                  title={
                                    item.clientCode
                                      ? "Alterar telefone no cadastro Omie"
                                      : "Sem código de cliente Omie"
                                  }
                                  className="inline-flex max-w-full items-center gap-xs rounded-md text-left hover:bg-surface-container-high disabled:opacity-60"
                                >
                                  {item.clientPhone ? (
                                    <span className="text-label-md tabular-nums text-on-surface-variant">
                                      {item.clientPhone}
                                    </span>
                                  ) : (
                                    <span className="text-label-md text-error">Sem telefone</span>
                                  )}
                                  <Icon name="edit" className="text-[14px] text-on-surface-variant" />
                                </button>
                              )}
                              {item.notifiedAt ? (
                                <span className="text-label-md text-secondary">Pré-vencimento</span>
                              ) : null}
                              {item.overdueNotifiedAt ? (
                                <span className="text-label-md text-error">Atraso alertado</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-md py-sm">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={busy && (viewingId === item.id || sendingId === item.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                                  aria-label={`Ações de ${item.clientName || item.documentNumber || "documento"}`}
                                >
                                  <Icon
                                    name={
                                      viewingId === item.id || sendingId === item.id
                                        ? "hourglass_empty"
                                        : "more_vert"
                                    }
                                    className="text-[20px]"
                                  />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[11rem]">
                                <DropdownMenuItem
                                  disabled={busy}
                                  onSelect={() => void viewDocument(item)}
                                >
                                  <Icon
                                    name={item.itemType === "boleto" ? "picture_as_pdf" : "download"}
                                    className="text-[16px]"
                                  />
                                  {item.itemType === "boleto" ? "Abrir boleto" : "Baixar PDF"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={busy}
                                  onSelect={(event) => {
                                    // Evita o menu “roubar” o foco e fechar o diálogo de aviso.
                                    event.preventDefault();
                                    void sendAlert(item);
                                  }}
                                >
                                  <Icon name="send" className="text-[16px]" />
                                  Enviar WhatsApp
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePager
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>
      </main>

      <Dialog
        open={paidConfirmWarnings != null}
        onOpenChange={(open) => {
          if (!open) {
            // Clique residual do dropdown pode disparar close logo ao abrir.
            if (Date.now() - paidConfirmOpenedAtRef.current < 400) return;
            closePaidConfirm(false);
          }
        }}
      >
        <DialogContent className="max-w-[32rem]">
          <DialogHeader>
            <DialogTitle>Documento já pago / fechado</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-sm text-left text-sm text-muted-foreground">
                <p>
                  A Omie indica que{" "}
                  {(paidConfirmWarnings?.length ?? 0) === 1
                    ? "este documento já foi pago ou fechado"
                    : `${paidConfirmWarnings?.length ?? 0} documentos já foram pagos ou fechados`}
                  . O envio automático bloqueia; no manual você pode seguir se quiser.
                </p>
                <ul className="max-h-56 list-disc space-y-xs overflow-y-auto rounded-md border border-outline-variant bg-surface px-md py-sm pl-lg text-primary">
                  {(paidConfirmWarnings ?? []).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-sm">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
              onClick={() => closePaidConfirm(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => closePaidConfirm(true)}
            >
              Enviar mesmo assim
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
