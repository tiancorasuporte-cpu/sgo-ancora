import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/PageChrome";
import {
  getCompanyLocationFn,
  saveCompanyLocationFn,
} from "@/lib/assistencia";
import { getOmieAppsFn } from "@/lib/omie";
import {
  getGroqSettingsFn,
  saveGroqSettingsFn,
  testGroqFn,
} from "@/lib/groq-settings";
import { getWahaSettingsFn, saveWahaSettingsFn, testWahaFn, registerWahaWebhookFn, restartWahaBotFn, stopWahaBotFn } from "@/lib/waha";
import { getInteggriSettingsFn, saveInteggriSettingsFn, testInteggriFn } from "@/lib/integgri";
import { getMoniSettingsFn, saveMoniSettingsFn, testMoniFn } from "@/lib/moni-settings";
import {
  companyHasCoords,
  type CompanyLocation,
} from "@/lib/geo";

export type IntegracoesApisData = {
  waha: Awaited<ReturnType<typeof getWahaSettingsFn>>;
  integgri: Awaited<ReturnType<typeof getInteggriSettingsFn>>;
  apps: Awaited<ReturnType<typeof getOmieAppsFn>>;
  groq: Awaited<ReturnType<typeof getGroqSettingsFn>> | null;
  companyLocation: CompanyLocation;
  moni: Awaited<ReturnType<typeof getMoniSettingsFn>> | null;
};

export async function loadIntegracoesApisData(): Promise<IntegracoesApisData> {
  const [waha, integgri, apps, groq, companyLocation, moni] = await Promise.all([
    getWahaSettingsFn(),
    getInteggriSettingsFn(),
    getOmieAppsFn(),
    getGroqSettingsFn().catch(() => null),
    getCompanyLocationFn(),
    getMoniSettingsFn().catch(() => null),
  ]);
  return { waha, integgri, apps, groq, companyLocation, moni };
}

export function IntegracoesApisSettings({
  data,
  showGroq,
  onSaved,
}: {
  data: IntegracoesApisData;
  showGroq: boolean;
  onSaved: () => void;
}) {
  const { waha, integgri, apps, groq, companyLocation, moni } = data;
  const router = useRouter();
  const invalidate = () => {
    onSaved();
    void router.invalidate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-lg">
      <PageTitle
        title="Integrações e APIs"
        subtitle="Base da empresa, Omie, Moni, Integgri Chat, WAHA e Groq."
      />

      <CompanyLocationSettings initial={companyLocation} onSaved={invalidate} />

      <div className="grid items-stretch gap-md lg:grid-cols-2">
        <section className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
          <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
            <Icon name="apps" className="text-secondary" />
            Aplicativos Omie
          </h3>
          {apps.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Nenhum app configurado. Defina `OMIE_APPS` e as chaves no arquivo `.env`.
            </p>
          ) : (
            <ul className="space-y-sm">
              {apps.map((app) => (
                <li
                  key={app.id}
                  className="rounded-lg border border-outline-variant px-md py-sm text-body-md text-on-surface"
                >
                  <strong>{app.name}</strong> ({app.id})
                  {app.notifyPhone ? (
                    <span className="block text-label-md text-on-surface-variant">
                      WhatsApp fallback: {app.notifyPhone}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {moni ? <MoniSettings initial={moni} /> : null}
        {integgri ? <InteggriSettings initial={integgri} /> : null}
        {waha ? <WahaSettings initial={waha} /> : null}
        {showGroq && groq ? <GroqSettings initial={groq} /> : null}
      </div>
    </div>
  );
}

function CompanyLocationSettings({
  initial,
  onSaved,
}: {
  initial: CompanyLocation;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
        <Icon name="location_on" className="text-secondary" />
        Localização da empresa
      </h3>
      <p className="mb-md text-body-md text-on-surface-variant">
        Usada na Assistência para calcular a distância até o cliente e ordenar o cronograma de
        técnicos por região.
      </p>
      <form
        className="space-y-md"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage(null);
          try {
            const next = await saveCompanyLocationFn({
              data: {
                label: draft.label,
                address: draft.address,
                city: draft.city,
                uf: draft.uf,
                cep: draft.cep,
                geocode: true,
              },
            });
            setDraft(next);
            setMessage(
              next.lat != null
                ? `Base salva · ${next.lat.toFixed(5)}, ${next.lng?.toFixed(5)}`
                : "Base salva, mas não foi possível geocodificar. Confira CEP/endereço.",
            );
            onSaved();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Falha ao salvar a base.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="grid gap-md sm:grid-cols-2">
          <label className="flex flex-col gap-2xs text-label-md text-on-surface-variant">
            Nome da base
            <input
              value={draft.label}
              onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
              className="rounded-lg border border-outline-variant bg-surface px-sm py-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </label>
          <label className="flex flex-col gap-2xs text-label-md text-on-surface-variant">
            CEP
            <input
              value={draft.cep}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  cep: e.target.value.replace(/\D/g, "").slice(0, 8),
                }))
              }
              placeholder="00000000"
              className="rounded-lg border border-outline-variant bg-surface px-sm py-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </label>
          <label className="flex flex-col gap-2xs text-label-md text-on-surface-variant sm:col-span-2">
            Endereço
            <input
              value={draft.address}
              onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
              className="rounded-lg border border-outline-variant bg-surface px-sm py-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </label>
          <label className="flex flex-col gap-2xs text-label-md text-on-surface-variant">
            Cidade
            <input
              value={draft.city}
              onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
              className="rounded-lg border border-outline-variant bg-surface px-sm py-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </label>
          <label className="flex flex-col gap-2xs text-label-md text-on-surface-variant">
            UF
            <input
              value={draft.uf}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  uf: e.target.value.toUpperCase().slice(0, 2),
                }))
              }
              maxLength={2}
              className="rounded-lg border border-outline-variant bg-surface px-sm py-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-xs rounded-lg bg-secondary-container px-sm py-xs text-label-md font-semibold text-on-secondary-container disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar e geocodificar base"}
          </button>
          {companyHasCoords(draft) ? (
            <span className="text-label-sm text-emerald-800">
              Ativa: {draft.lat!.toFixed(5)}, {draft.lng!.toFixed(5)}
            </span>
          ) : (
            <span className="text-label-sm text-amber-900">
              Sem coordenadas ainda — salve com CEP válido.
            </span>
          )}
        </div>
        {message ? (
          <p className="text-label-md text-on-surface-variant">{message}</p>
        ) : null}
      </form>
    </section>
  );
}

function MoniSettings({
  initial,
}: {
  initial: {
    baseUrl: string;
    username: string;
    hasPassword: boolean;
    defaultEmpresa: number;
    configured: boolean;
  };
}) {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [defaultEmpresa, setDefaultEmpresa] = useState(String(initial.defaultEmpresa || 1));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(initial.baseUrl);
    setUsername(initial.username);
    setDefaultEmpresa(String(initial.defaultEmpresa || 1));
  }, [initial.baseUrl, initial.username, initial.defaultEmpresa]);

  return (
    <section className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
        <Icon name="sensors" className="text-secondary" />
        Moni Integração
      </h3>
      <p className="mb-md text-body-sm text-on-surface-variant">
        Basic Auth + <code>/LerDados</code> · URL sem barra no final, ex.{" "}
        <code>http://192.168.0.100:8080</code>.
      </p>
      <form
        className="space-y-md"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          setMessage(null);
          try {
            const emp = Number(defaultEmpresa);
            if (!Number.isFinite(emp) || emp <= 0) {
              throw new Error("Informe a empresa Moni padrão (código numérico, ex.: 3).");
            }
            await saveMoniSettingsFn({
              data: { baseUrl, username, password, defaultEmpresa: Math.trunc(emp) },
            });
            setMessage("Dados do Moni salvos.");
            setPassword("");
            await router.invalidate();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao salvar Moni.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-label-md text-on-surface-variant">
          URL do servidor Moni
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://IP:PORTA"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Usuário
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Senha {initial.hasPassword ? "(deixe vazio para manter)" : ""}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={initial.hasPassword ? "••••••••" : "Senha do Moni Integração"}
            autoComplete="new-password"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Empresa Moni padrão (tenant)
          <input
            type="number"
            min={1}
            step={1}
            value={defaultEmpresa}
            onChange={(e) => setDefaultEmpresa(e.target.value)}
            placeholder="Ex.: 3"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <span className="mt-2xs block text-label-sm font-normal text-on-surface-variant">
            Código da empresa no Moni usado por padrão ao vincular contas nos contratos.
          </span>
        </label>
        <div className="flex flex-wrap gap-sm">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-secondary-container px-md py-sm text-label-md font-semibold text-on-secondary-container disabled:opacity-60"
          >
            Salvar Moni
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              setMessage(null);
              try {
                const result = await testMoniFn();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const sample =
                  result.sample.length > 0
                    ? ` Ex.: ${result.sample
                        .map((s) => `Emp.${s.empresa ?? "?"} #${s.codigo} ${s.nome}`)
                        .join(" · ")}`
                    : "";
                setMessage(
                  `Conexão ok — leitura de Clientes retornou ${result.countHint} registro(s).${sample}`,
                );
              } catch (err) {
                setError(err instanceof Error ? err.message : "Falha no teste Moni.");
              } finally {
                setPending(false);
              }
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary disabled:opacity-60"
          >
            Testar conexão
          </button>
        </div>
        {message ? <p className="text-body-md text-primary">{message}</p> : null}
        {error ? <p className="text-body-md text-on-error-container">{error}</p> : null}
        {!initial.configured ? (
          <p className="text-label-md text-on-surface-variant">
            Preencha URL, usuário e senha para habilitar o Sync Moni em Contratos.
          </p>
        ) : (
          <p className="text-label-md text-on-surface-variant">Moni configurado. Pode sincronizar as contas em Contratos.</p>
        )}
      </form>
    </section>
  );
}

function InteggriSettings({
  initial,
}: {
  initial: {
    url: string;
    hasToken: boolean;
    whatsappId: string;
    queueId: string;
    userId: string;
    configured: boolean;
    enabled: boolean;
    provider: string;
  };
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState("");
  const [whatsappId, setWhatsappId] = useState(initial.whatsappId);
  const [queueId, setQueueId] = useState(initial.queueId);
  const [userId, setUserId] = useState(initial.userId);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [testPhone, setTestPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
        <Icon name="hub" className="text-secondary" />
        Integgri Chat
      </h3>
      <p className="mb-md text-body-sm text-on-surface-variant">
        API <code>https://iapi.integgri.com.br</code> · token em Conexões → API. Ativo, substitui o WAHA no envio.{" "}
        <a href="https://app.integgri.com.br/api-docs" className="text-primary underline" target="_blank" rel="noreferrer">
          Docs
        </a>
      </p>
      <form
        className="space-y-md"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          setMessage(null);
          try {
            await saveInteggriSettingsFn({
              data: { url, token, whatsappId, queueId, userId, enabled },
            });
            setMessage(enabled ? "Integgri salva. Envios passam a usar a Integgri." : "Integgri salva. Envios continuam no WAHA.");
            setToken("");
            await router.invalidate();
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="flex items-center gap-sm text-body-md text-on-surface">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Usar Integgri para enviar mensagens
        </label>
        <label className="block text-label-md text-on-surface-variant">
          URL da API
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://iapi.integgri.com.br"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Token {initial.hasToken ? "(deixe vazio para manter)" : ""}
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={initial.hasToken ? "••••••••" : "Bearer token da conexão"}
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          ID da conexão WhatsApp (opcional)
          <input
            value={whatsappId}
            onChange={(e) => setWhatsappId(e.target.value)}
            placeholder="whatsappId da API"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <div className="grid gap-md md:grid-cols-2">
          <label className="block text-label-md text-on-surface-variant">
            Fila / departamento (opcional)
            <input
              value={queueId}
              onChange={(e) => setQueueId(e.target.value)}
              className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </label>
          <label className="block text-label-md text-on-surface-variant">
            Usuário Integgri (opcional)
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-sm">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-secondary-container px-md py-sm text-label-md font-semibold text-on-secondary-container"
          >
            Salvar Integgri
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError(null);
              setMessage(null);
              const result = await testInteggriFn({ data: { phone: testPhone } });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              const templates =
                "templates" in result && Array.isArray(result.templates)
                  ? result.templates.join(", ")
                  : "envio_para_pagamento_1_documento";
              setMessage(`Template WABA enviado (${templates}). Confira o WhatsApp.`);
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary"
          >
            Testar envio
          </button>
        </div>
        <input
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="WhatsApp para teste (ex: 5511999999999)"
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        />
        {message ? <p className="text-body-md text-primary">{message}</p> : null}
        {error ? <p className="text-body-md text-on-error-container">{error}</p> : null}
        {!initial.configured ? (
          <p className="text-label-md text-on-surface-variant">Cole o token da Integgri para habilitar o envio oficial.</p>
        ) : null}
      </form>
    </section>
  );
}

function WahaSettings({
  initial,
}: {
  initial: {
    url: string;
    session: string;
    hasApiKey: boolean;
    configured: boolean;
    publicAppUrl: string;
    webhookUrl: string | null;
    whatsappBotEnabled: boolean;
    botStatus: {
      pid: number;
      readyAt: number;
      connected: boolean;
      updatedAt: number;
      lastRestartAt?: number;
    } | null;
  };
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initial.url);
  const [session, setSession] = useState(initial.session);
  const [apiKey, setApiKey] = useState("");
  const [publicAppUrl, setPublicAppUrl] = useState(initial.publicAppUrl);
  const [botEnabled, setBotEnabled] = useState(initial.whatsappBotEnabled);
  const [testPhone, setTestPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [restartPending, setRestartPending] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const botActive =
    initial.botStatus != null && Date.now() - initial.botStatus.updatedAt < 45_000;
  const botStatusLabel = botActive
    ? initial.botStatus?.connected
      ? `Listener ativo (PID ${initial.botStatus.pid}) · conectado ao WAHA`
      : `Listener ativo (PID ${initial.botStatus.pid}) · reconectando…`
    : "Listener inativo — rode npm run bot:listen";

  return (
    <section className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
        <Icon name="chat" className="text-secondary" />
        WAHA (WhatsApp)
      </h3>
      <form
        className="space-y-md"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          setMessage(null);
          try {
            const result = await saveWahaSettingsFn({
              data: {
                url,
                session,
                apiKey,
                publicAppUrl,
                whatsappBotEnabled: botEnabled,
              },
            });
            if (result.webhook?.ok) {
              setMessage(`Configurações salvas. Webhook ativo: ${result.webhook.webhookUrl}`);
            } else if (result.webhook && !result.webhook.ok) {
              setMessage("Configurações salvas.");
              setError(result.webhook.error ?? "Webhook não registrado automaticamente.");
            } else {
              setMessage("Configurações do WAHA salvas.");
            }
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="flex items-center gap-sm text-body-md text-on-surface">
          <input type="checkbox" checked={botEnabled} onChange={(e) => setBotEnabled(e.target.checked)} />
          Bot IA no WhatsApp (responde mensagens recebidas)
        </label>
        <div className="rounded-lg border border-outline-variant bg-surface-container px-md py-sm text-body-md text-on-surface-variant">
          <span className="font-medium text-on-surface">Status do listener:</span> {botStatusLabel}
        </div>
        <label className="block text-label-md text-on-surface-variant">
          URL pública deste app (acessível pelo servidor do WAHA)
          <input
            value={publicAppUrl}
            onChange={(e) => setPublicAppUrl(e.target.value)}
            placeholder="http://192.168.10.x:3000 ou https://seu-dominio"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <span className="mt-xs block text-label-md text-on-surface-variant">
            Webhook (HTTP :18094, sem TLS):{" "}
            {publicAppUrl.trim()
              ? (() => {
                  try {
                    const u = new URL(publicAppUrl.trim());
                    u.protocol = "http:";
                    u.port = "18094";
                    u.pathname = "/api/waha/webhook";
                    return u.toString().replace(/\/$/, "");
                  } catch {
                    return `${publicAppUrl.trim().replace(/\/+$/, "")}/api/waha/webhook`;
                  }
                })()
              : "defina a URL pública acima"}
          </span>
        </label>
        <label className="block text-label-md text-on-surface-variant">
          URL do WAHA
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3000"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Sessão
          <input
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          API Key {initial.hasApiKey ? "(deixe vazio para manter)" : ""}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <div className="flex flex-wrap gap-sm">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-secondary-container px-md py-sm text-label-md font-semibold text-on-secondary-container"
          >
            Salvar WAHA
          </button>
          <button
            type="button"
            disabled={pending || restartPending}
            onClick={async () => {
              setRestartPending(true);
              setError(null);
              setMessage(null);
              try {
                const result = await restartWahaBotFn();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                if ("warning" in result && result.warning) {
                  setMessage(result.warning);
                } else {
                  setMessage("Bot reiniciado. WebSocket reconectado ao WAHA.");
                }
                await router.invalidate();
              } finally {
                setRestartPending(false);
              }
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary"
          >
            {restartPending ? "Reiniciando…" : "Reiniciar bot"}
          </button>
          <button
            type="button"
            disabled={pending || restartPending || stopPending}
            onClick={async () => {
              setStopPending(true);
              setError(null);
              setMessage(null);
              try {
                const result = await stopWahaBotFn();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setBotEnabled(false);
                if (result.stopped === 0) {
                  setMessage(
                    "Bot desativado nas configurações. Nenhum processo listener estava rodando.",
                  );
                } else {
                  setMessage(
                    `Bot parado (${result.stopped} processo(s)). Desmarque e salve para manter desligado, ou rode npm run bot:listen para reativar.`,
                  );
                }
                await router.invalidate();
              } finally {
                setStopPending(false);
              }
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary"
          >
            {stopPending ? "Parando…" : "Parar bot"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError(null);
              setMessage(null);
              const result = await registerWahaWebhookFn();
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(`Webhook registrado: ${result.webhookUrl}`);
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary"
          >
            Registrar webhook
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError(null);
              setMessage(null);
              const result = await testWahaFn({ data: { phone: testPhone } });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage("Mensagem de teste enviada.");
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary"
          >
            Testar envio
          </button>
        </div>
        <input
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="WhatsApp para teste"
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        />
        {message ? <p className="text-body-md text-primary">{message}</p> : null}
        {error ? <p className="text-body-md text-on-error-container">{error}</p> : null}
        {!initial.configured ? (
          <p className="text-label-md text-on-surface-variant">Informe a URL do WAHA para habilitar os alertas.</p>
        ) : null}
      </form>
    </section>
  );
}

function GroqSettings({
  initial,
}: {
  initial: {
    model: string;
    hasApiKey: boolean;
    configured: boolean;
    maskedKey: string | null;
  };
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
      <h3 className="mb-sm flex items-center gap-xs text-title-lg text-primary">
        <Icon name="smart_toy" className="text-secondary" />
        Assistente Groq (IA)
      </h3>
      <p className="mb-md text-body-sm text-on-surface-variant">
        Chat flutuante e consulta de títulos no Omie. Sem chave, usa respostas fixas por CNPJ.
      </p>
      <form
        className="space-y-md"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          setMessage(null);
          try {
            await saveGroqSettingsFn({ data: { apiKey, model } });
            setApiKey("");
            setMessage("Configurações do Groq salvas.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao salvar.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-label-md text-on-surface-variant">
          API Key {initial.hasApiKey ? `(atual: ${initial.maskedKey})` : ""}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={initial.hasApiKey ? "Deixe vazio para manter" : "gsk_..."}
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <label className="block text-label-md text-on-surface-variant">
          Modelo
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="openai/gpt-oss-20b"
            className="mt-base w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </label>
        <div className="flex flex-wrap gap-sm">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-secondary-container px-md py-sm text-label-md font-semibold text-on-secondary-container"
          >
            Salvar Groq
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError(null);
              setMessage(null);
              const result = await testGroqFn();
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(`Teste OK: ${result.answer}`);
            }}
            className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-primary"
          >
            Testar IA
          </button>
          {initial.hasApiKey ? (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                try {
                  await saveGroqSettingsFn({ data: { apiKey: "", model, clearKey: true } });
                  setMessage("Chave Groq removida.");
                } finally {
                  setPending(false);
                }
              }}
              className="rounded-lg border border-outline-variant px-md py-sm text-label-md text-error"
            >
              Remover chave
            </button>
          ) : null}
        </div>
        {message ? <p className="text-body-md text-primary">{message}</p> : null}
        {error ? <p className="text-body-md text-on-error-container">{error}</p> : null}
        {!initial.configured ? (
          <p className="text-label-md text-on-surface-variant">
            Obtenha a chave em console.groq.com/keys e salve aqui.
          </p>
        ) : null}
      </form>
    </section>
  );
}
