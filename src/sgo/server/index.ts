/**
 * SGO Âncora — ponto de entrada do servidor do SGO dentro do TanStack Start.
 *
 * `ehRotaSgo()` decide quais caminhos são atendidos pelo servidor do SGO
 * (API, via pública, App do Técnico, arquivos) — o resto segue para o React.
 */
import "@tanstack/react-start/server-only";

import { D1Pg } from "./d1";
import { R2Local } from "./r2";

/** APIs do sistema base (dev) que continuam com ele. */
const API_BASE = /^\/api\/(integgri|mobile|waha)(\/|$)/;

const SGO_PREFIXOS = [
  /^\/api\//,
  /^\/v\/[A-Za-z0-9_-]{24,48}/, // via pública da OS (cliente)
  /^\/app(\.html)?$/, // App do Técnico (PWA, sgo/app-tecnico/)
  /^\/app-sw\.js$/,
  /^\/tecnico\//,
  /^\/softphone\//,
  /^\/telas\//, // telas guardadas na pasta de arquivos (reserva)
  /^\/ajuda\//, // central de ajuda (conteúdo editável pelo administrador)
  /^\/img\/logo-(sgo|ancora)\.png$/,
];

export function ehRotaSgo(pathname: string) {
  if (API_BASE.test(pathname)) return false;
  return SGO_PREFIXOS.some((re) => re.test(pathname));
}

let env: { DB: D1Pg; FOTOS: R2Local; VOIP_KEY?: string | undefined } | null = null;

function sgoEnv() {
  if (!env) env = { DB: new D1Pg(), FOTOS: new R2Local(), VOIP_KEY: process.env["SGO_VOIP_KEY"] };
  return env;
}

/**
 * App do Técnico: PWA própria (funciona sem internet), fora do React de propósito.
 * Os arquivos ficam em sgo/app-tecnico/ e entram no mapa de arquivos do servidor.
 */
const APP_TECNICO: Record<string, [string, string]> = {
  "/app": ["app.html", "text/html; charset=utf-8"],
  "/app-sw.js": ["app-sw.js", "application/javascript; charset=utf-8"],
  "/tecnico/app.js": ["tecnico/app.js", "application/javascript; charset=utf-8"],
  "/tecnico/regras.js": ["tecnico/regras.js", "application/javascript; charset=utf-8"],
  "/tecnico/app.css": ["tecnico/app.css", "text/css; charset=utf-8"],
  "/tecnico/manifest.webmanifest": ["tecnico/manifest.webmanifest", "application/manifest+json; charset=utf-8"],
  "/tecnico/icone-192.png": ["tecnico/icone-192.png", "image/png"],
  "/tecnico/icone-512.png": ["tecnico/icone-512.png", "image/png"],
};
let appCarregado = false;
async function carregarAppTecnico() {
  if (appCarregado && process.env["NODE_ENV"] === "production") return;
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const { ARQUIVOS } = (await import("./arquivos.js")) as unknown as {
    ARQUIVOS: Record<string, { t: string; b64: boolean; d: string }>;
  };
  for (const [rota, [arq, tipo]] of Object.entries(APP_TECNICO)) {
    const buf = await readFile(resolve(process.cwd(), "sgo/app-tecnico", arq));
    const texto = !tipo.startsWith("image/");
    ARQUIVOS[rota] = { t: tipo, b64: !texto, d: texto ? buf.toString("utf8") : buf.toString("base64") };
  }
  appCarregado = true;
}

async function atenderSyncOmieCadastros(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/cadastros/sync-omie" || request.method !== "POST") return null;

  if (request.headers.get("x-sgo") !== "1") {
    return Response.json({ erro: "Requisição recusada." }, { status: 403 });
  }

  const { usuarioSgo, ehAdminSgo } = await import("./sessao");
  const eu = await usuarioSgo(request);
  if (!eu) return Response.json({ erro: "Faça login para continuar." }, { status: 401 });

  const pode =
    ehAdminSgo(eu) ||
    eu.permissoes.includes("cad-parceiros") ||
    eu.permissoes.includes("cad-produtos") ||
    eu.permissoes.includes("com-orc");
  if (!pode) {
    return Response.json({ erro: "Sem permissão para sincronizar cadastros do Omie." }, { status: 403 });
  }

  let body: { tipo?: string } = {};
  try {
    body = (await request.json()) as { tipo?: string };
  } catch {
    body = {};
  }
  const tipoRaw = String(body.tipo || "ambos").toLowerCase();
  const tipo =
    tipoRaw === "clientes" || tipoRaw === "produtos" || tipoRaw === "ambos"
      ? (tipoRaw as "clientes" | "produtos" | "ambos")
      : null;
  if (!tipo) {
    return Response.json({ erro: "Informe tipo: clientes, produtos ou ambos." }, { status: 400 });
  }

  try {
    const { syncOmieParaCadastrosSgo } = await import("@/server/omie/sgo-cadastros-sync");
    const result = await syncOmieParaCadastrosSgo(tipo, eu.login);
    return Response.json(result);
  } catch (e) {
    console.error("[sgo] sync-omie", e);
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao sincronizar Omie." },
      { status: 500 },
    );
  }
}

export async function atenderSgo(request: Request): Promise<Response> {
  const { garantirInstalacao } = await import("./instalar");
  await garantirInstalacao();
  await carregarAppTecnico();

  const syncResp = await atenderSyncOmieCadastros(request);
  if (syncResp) return syncResp;

  const mod = await import("./worker.js");
  const worker = (mod as { default: { fetch: (r: Request, e: unknown) => Promise<Response> } }).default;
  try {
    return await worker.fetch(request, sgoEnv());
  } catch (e) {
    console.error("[sgo] erro não tratado", e);
    return Response.json({ erro: "Falha no servidor do SGO." }, { status: 500 });
  }
}
