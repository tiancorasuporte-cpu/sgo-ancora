import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/PageChrome";
import {
  getNotificationSettingsFn,
  saveNotificationSettingsFn,
} from "@/lib/omie";
import { requireAdmin } from "@/lib/require-auth";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAdmin,
  loader: async () => {
    const notifications = await getNotificationSettingsFn();
    return { notifications };
  },
  head: () => ({
    meta: [{ title: `Alertas e horário — ${APP_NAME}` }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { notifications } = Route.useLoaderData();
  const router = useRouter();

  return (
    <AppShell mobileTitle="Alertas e horário">
      <main className="flex-1 p-margin-mobile md:p-margin-desktop">
        <div className="mx-auto max-w-3xl space-y-lg">
          <PageTitle
            title="Alertas e horário"
            subtitle="Envio automático de cobrança, modo teste e horário diário."
          />
          <NotificationSettings
            initial={notifications}
            onSaved={() => router.invalidate()}
          />
        </div>
      </main>
    </AppShell>
  );
}

function NotificationSettings({
  initial,
  onSaved,
}: {
  initial: {
    notificationsEnabled: boolean;
    notificationTime: string;
    defaultNotifyPhone: string;
    testModeEnabled: boolean;
    testNotifyPhone: string;
    hourlyLimit: number;
  };
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(initial.notificationsEnabled);
  const [time, setTime] = useState(initial.notificationTime);
  const [phone, setPhone] = useState(initial.defaultNotifyPhone);
  const [testMode, setTestMode] = useState(initial.testModeEnabled);
  const [testPhone, setTestPhone] = useState(initial.testNotifyPhone);
  const [hourlyLimit, setHourlyLimit] = useState(initial.hourlyLimit);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
        <Icon name="notifications" className="text-secondary" />
        Alertas de vencimento
      </h3>
      <p className="mb-md text-body-md text-on-surface-variant">
        Envia WhatsApp com 1 dia de antecedência para documentos (boleto, NF-e e NFS-e) que vencem
        amanhã, e um segundo lembrete 10 dias após o vencimento se ainda estiverem em aberto. Usa o
        telefone 2 do cadastro Omie; se estiver vazio, tenta celular / telefone 1.
      </p>
      <form
        className="space-y-md"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage(null);
          try {
            await saveNotificationSettingsFn({
              data: {
                notificationsEnabled: enabled,
                notificationTime: time,
                defaultNotifyPhone: phone,
                testModeEnabled: testMode,
                testNotifyPhone: testPhone,
                hourlyLimit,
              },
            });
            setMessage("Configurações salvas.");
            onSaved();
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="flex items-center gap-sm text-body-md text-on-surface">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Alertas automáticos ativos
        </label>

        <div className="rounded-lg border border-secondary-container/40 bg-secondary-fixed/20 p-md">
          <label className="flex items-center gap-sm text-body-md font-semibold text-primary">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            Modo teste (recomendado no início)
          </label>
          <p className="mt-sm text-label-md text-on-surface-variant">
            Enquanto ativo, todas as mensagens vão para o número de teste abaixo — nenhum cliente recebe.
          </p>
          <label className="mt-md block text-label-md text-on-surface-variant">
            WhatsApp de teste
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="5511999999999"
              required={testMode}
              className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </label>
        </div>

        <label className="block text-label-md text-on-surface-variant">
          Horário diário de envio
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Limite de contatos por hora (0 = sem limite)
          <input
            type="number"
            min={0}
            max={500}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <span className="mt-xs block text-label-md text-on-surface-variant">
            Contatos distintos com envio OK na última hora. 0 = sem limite (padrão). Máx. 500 se
            quiser teto. Lote manual até 50 contatos por execução. Só envia para celular (DDD + 9…).
          </span>
        </label>
        <label className="block text-label-md text-on-surface-variant">
          WhatsApp padrão (quando o cliente Omie não tiver celular)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5511999999999"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        {message ? <p className="text-body-md text-primary">{message}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-secondary-container px-md py-sm text-label-md font-semibold text-on-secondary-container"
        >
          {pending ? "Salvando..." : "Salvar alertas"}
        </button>
      </form>
    </section>
  );
}
