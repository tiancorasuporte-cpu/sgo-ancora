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

function normBusca(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Busca de clientes e fornecedores no cadastro sincronizado (parceiros e Omie). */
async function atenderBuscaCadastrosOmie(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/cadastros/busca" || request.method !== "GET") return null;

  const tipo = (url.searchParams.get("tipo") || "produto").toLowerCase();
  const tag =
    tipo === "cliente" || tipo === "clientes"
      ? "Cliente"
      : tipo === "fornecedor" || tipo === "fornecedores"
        ? "Fornecedor"
        : null;
  if (!tag) return null;

  const q = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  const lim = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limite") || "12", 10) || 12));
  if (q.length < 2) return Response.json({ itens: [] });

  try {
    const { usuarioSgo } = await import("./sessao");
    const eu = await usuarioSgo(request);
    if (!eu) return Response.json({ erro: "Faça login para continuar." }, { status: 401 });

    const { sgoSql } = await import("./d1");
    const sql = sgoSql();
    const pal = normBusca(q).split(" ").filter(Boolean).slice(0, 6);
    const dig = q.replace(/\D+/g, "");
    const nome = pal.length
      ? pal
          .map(
            (p) => sql`(
              t.busca ilike ${"%" + p + "%"}
              or t.razao ilike ${"%" + p + "%"}
              or coalesce(t.fantasia, '') ilike ${"%" + p + "%"}
              or coalesce(t.cidade, '') ilike ${"%" + p + "%"}
              or coalesce(t.contato, '') ilike ${"%" + p + "%"}
            )`,
          )
          .reduce((a, b) => sql`${a} and ${b}`)
      : sql`false`;
    const doc = dig.length >= 4 ? sql`regexp_replace(coalesce(t.documento, ''), '\\D', '', 'g') like ${"%" + dig + "%"}` : sql`false`;
    const tagSql =
      tag === "Fornecedor"
        ? sql`coalesce(t.tags, '[]')::jsonb @> '["Fornecedor"]'::jsonb`
        : sql`coalesce(t.tags, '[]')::jsonb @> '["Cliente"]'::jsonb`;
    const rows = await sql<Record<string, unknown>[]>`
      select t.id, t.documento, t.tipo_pessoa, t.razao, t.fantasia, t.tags, t.telefone, t.contato, t.email, t.cidade, t.uf, t.endereco, t.bairro, t.situacao
      from parceiros t
      where t.situacao = 'Ativo'
        and ${tagSql}
        and (${nome} or ${doc})
      order by coalesce(t.fantasia, t.razao)
      limit ${lim}
    `;
    const itens = rows.map((r) => {
      let tags: string[] = [];
      try { tags = JSON.parse(String(r.tags || "[]")) as string[]; } catch { tags = []; }
      return { ...r, tags };
    });
    if (tag === "Fornecedor" && itens.length < lim) {
      const docs = new Set(itens.map((r) => String(r.documento || "").replace(/\D+/g, "")).filter((d) => d.length >= 8));
      const { listOmieSuppliers } = await import("@/db/suppliers");
      const omie = await listOmieSuppliers({ query: q, activeOnly: true, limit: lim });
      for (const s of omie) {
        if (itens.length >= lim) break;
        const docOmie = String(s.cnpjCpf || "").replace(/\D+/g, "");
        if (docOmie.length >= 8 && docs.has(docOmie)) continue;
        itens.push({
          id: s.id,
          documento: s.cnpjCpf,
          tipo_pessoa: docOmie.length === 11 ? "PF" : docOmie.length === 14 ? "PJ" : null,
          razao: s.razaoSocial,
          fantasia: s.nomeFantasia || s.razaoSocial,
          tags: ["Fornecedor"],
          telefone: null,
          contato: null,
          email: null,
          cidade: null,
          situacao: "Ativo",
        });
      }
    }
    return Response.json({ itens });
  } catch (e) {
    console.error("[sgo] busca cadastros", e);
    return null;
  }
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

async function atenderFaturarOsOmie(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/os/faturar-omie" || request.method !== "POST") return null;
  if (request.headers.get("x-sgo") !== "1") {
    return Response.json({ erro: "Requisição recusada." }, { status: 403 });
  }

  const { usuarioSgo, ehAdminSgo } = await import("./sessao");
  const eu = await usuarioSgo(request);
  if (!eu) return Response.json({ erro: "Faça login para continuar." }, { status: 401 });
  const pode = ehAdminSgo(eu) || eu.permissoes.includes("at-os") || eu.permissoes.includes("at-agenda");
  if (!pode) return Response.json({ erro: "Sem permissão para enviar a OS para a Omie." }, { status: 403 });

  let body: { id?: string; faturamento?: Record<string, unknown>; substituir?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const { enviarOsParaFaturarOmie } = await import("@/server/omie/os-faturar");
    const result = await enviarOsParaFaturarOmie({
      id: String(body.id || ""),
      faturamento: (body.faturamento || {}) as never,
      substituir: !!body.substituir,
      por: eu.nome || eu.login,
    });
    return Response.json(result);
  } catch (e) {
    console.error("[sgo] faturar-omie", e);
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao enviar para a Omie." },
      { status: 400 },
    );
  }
}

export async function atenderSgo(request: Request): Promise<Response> {
  const { garantirInstalacao } = await import("./instalar");
  await garantirInstalacao();
  await carregarAppTecnico();

  const syncResp = await atenderSyncOmieCadastros(request);
  if (syncResp) return syncResp;

  const buscaOmie = await atenderBuscaCadastrosOmie(request);
  if (buscaOmie) return buscaOmie;

  const faturar = await atenderFaturarOsOmie(request);
  if (faturar) return faturar;

  const mod = await import("./worker.js");
  const worker = (mod as { default: { fetch: (r: Request, e: unknown) => Promise<Response> } }).default;
  try {
    return await worker.fetch(request, sgoEnv());
  } catch (e) {
    console.error("[sgo] erro não tratado", e);
    return Response.json({ erro: "Falha no servidor do SGO." }, { status: 500 });
  }
}
