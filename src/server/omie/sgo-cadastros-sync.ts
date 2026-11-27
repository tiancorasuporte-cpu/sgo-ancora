/**
 * Sync Omie → cadastros SGO (sgo.parceiros / sgo.produtos) + cache omie_*.
 */
import "@tanstack/react-start/server-only";

import {
  listOmieApps,
  listOrcamentosOmieApps,
  omiePaginate,
  parseAmount,
  type OmieAppConfig,
} from "@/server/omie/client";
import { normalizeCliente } from "@/server/omie/clients";
import { upsertOmieClient } from "@/db/clients";
import { upsertOmieProduct } from "@/db/products";
import { syncProductCmcFromStock } from "@/server/omie/products";
import { sgoSql } from "@/sgo/server/d1";

function clientInactive(raw: Record<string, unknown>) {
  const flag = String(raw["inativo"] ?? raw["inactive"] ?? "N").trim().toUpperCase();
  return flag === "S" || flag === "1" || flag === "TRUE";
}

export type SyncOmieCadastrosTipo = "clientes" | "produtos" | "ambos";

export type SyncOmieCadastrosResult = {
  ok: true;
  clientes: { novos: number; atualizados: number; total: number };
  produtos: { novos: number; atualizados: number; total: number };
  erros: string[];
};

function cadNorm(s: unknown) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function soDig(s: unknown) {
  return String(s ?? "").replace(/\D+/g, "");
}

function cadTxt(v: unknown, max = 200) {
  if (v == null || v === "") return null;
  return String(v).replace(/\s+/g, " ").trim().slice(0, max) || null;
}

/** Características do Omie: pode vir texto, lista ou objeto. Nunca devolve "[object Object]". */
function textoLivre(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() && v.trim() !== "[object Object]" ? v : null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const umItem = (o: unknown): string => {
    if (o == null) return "";
    if (typeof o !== "object") return String(o);
    const r = o as Record<string, unknown>;
    const nome = r["nomeCaract"] || r["cNomeCaract"] || r["nome"] || r["descricao"] || r["cDescricao"] || "";
    const cont = r["conteudo"] || r["cConteudo"] || r["valor"] || r["cValor"] || "";
    if (nome || cont) return [nome, cont].filter(Boolean).join(": ");
    return "";
  };
  if (!Array.isArray(v) && !("nomeCaract" in (v as object)) && !("cNomeCaract" in (v as object))) return null;
  const t = (Array.isArray(v) ? v.map(umItem) : [umItem(v)]).filter(Boolean).join("; ");
  return t || null;
}

function agoraMs() {
  return Date.now();
}

function phoneFromRaw(raw: Record<string, unknown>) {
  const ddd = String(raw["telefone1_ddd"] ?? raw["ddd"] ?? "").replace(/\D/g, "");
  const num = String(raw["telefone1_numero"] ?? raw["telefone"] ?? "").replace(/\D/g, "");
  const celular = String(raw["celular"] ?? "").replace(/\D/g, "");
  const joined = ddd && num ? `${ddd}${num}` : num || celular;
  return joined ? joined.slice(0, 20) : null;
}

function enderecoLinha(raw: Record<string, unknown>) {
  const rua = cadTxt(raw["endereco"], 160);
  const numero = cadTxt(raw["endereco_numero"], 20);
  if (!rua) return null;
  return numero ? `${rua}, ${numero}` : rua;
}

function buscaParceiro(p: {
  razao: string;
  fantasia: string | null;
  documento: string | null;
  contato: string | null;
  cidade: string | null;
  email: string | null;
  telefone: string | null;
  tags: string[];
}) {
  return cadNorm(
    [p.razao, p.fantasia, p.documento, p.contato, p.cidade, p.email, p.telefone, p.tags.join(" ")].join(
      " ",
    ),
  );
}

function buscaProduto(p: {
  codigo: string;
  descricao: string;
  marca: string | null;
  modelo: string | null;
  ean: string | null;
  caracteristicas: string | null;
  familia: string | null;
}) {
  return cadNorm(
    [p.codigo, p.descricao, p.marca, p.modelo, p.ean, p.caracteristicas, p.familia].join(" "),
  );
}

function productInactive(raw: Record<string, unknown>) {
  const flag = String(raw["inativo"] ?? raw["inactive"] ?? "N").trim().toUpperCase();
  return flag === "S" || flag === "1" || flag === "TRUE";
}

// ---------- progresso do sync (para o botão "Sincronizando… 45%") ----------
export type SyncOmieProgresso = {
  ativo: boolean;
  pct: number;
  etapa: string;
  inicio: number | null;
  fim: number | null;
};
type ProgTipo = "clientes" | "produtos";
const PROG: Record<ProgTipo, SyncOmieProgresso> = ((globalThis as Record<string, unknown>)[
  "__sgoSyncOmieProg"
] ??= {
  clientes: { ativo: false, pct: 0, etapa: "", inicio: null, fim: null },
  produtos: { ativo: false, pct: 0, etapa: "", inicio: null, fim: null },
}) as Record<ProgTipo, SyncOmieProgresso>;

export function progressoSyncOmie(tipo: ProgTipo): SyncOmieProgresso {
  return { ...PROG[tipo] };
}
function progIniciar(tipo: ProgTipo) {
  PROG[tipo] = { ativo: true, pct: 0, etapa: "Iniciando", inicio: Date.now(), fim: null };
}
function progFim(tipo: ProgTipo) {
  PROG[tipo] = { ...PROG[tipo], ativo: false, pct: 100, etapa: "Concluído", fim: Date.now() };
}
/** pct dentro da faixa [de, ate] (0–100), só para frente; 100 só no fim. */
function progMarcar(tipo: ProgTipo, de: number, ate: number, fracao: number, etapa: string) {
  const f = Math.max(0, Math.min(1, fracao || 0));
  const pct = Math.min(99, Math.floor(de + (ate - de) * f));
  PROG[tipo] = { ...PROG[tipo], pct: Math.max(PROG[tipo].pct, pct), etapa };
}

async function upsertParceiroFromOmie(
  app: OmieAppConfig,
  raw: Record<string, unknown>,
  porLogin: string,
) {
  const client = normalizeCliente(raw);
  if (!client) return null;

  await upsertOmieClient({
    omieAppId: app.id,
    omieAppName: app.name,
    codigoCliente: client.codigo_cliente_omie,
    razaoSocial: client.razao_social || client.nome_fantasia || `Cliente ${client.codigo_cliente_omie}`,
    nomeFantasia: client.nome_fantasia || null,
    cnpjCpf: client.cnpj_cpf,
    endereco: client.endereco,
    contato: client.contato,
    inactive: clientInactive(raw),
  });

  const root = (raw["clientes_cadastro"] ?? raw["cadastro"] ?? raw) as Record<string, unknown>;
  const documento = soDig(client.cnpj_cpf) || null;
  const razao =
    cadTxt(client.razao_social || client.nome_fantasia || `Cliente ${client.codigo_cliente_omie}`, 160) ||
    `Cliente ${client.codigo_cliente_omie}`;
  const fantasia = cadTxt(client.nome_fantasia, 160);
  const tipoPessoa =
    documento && documento.length === 11 ? "PF" : documento && documento.length === 14 ? "PJ" : null;
  const telefone = phoneFromRaw(root);
  const email = cadTxt(root["email"] ?? root["email_nfe"] ?? root["cEmail"], 160);
  const contato = cadTxt(client.contato, 120);
  const cidade = cadTxt(client.cidade, 80);
  const uf = cadTxt(client.estado, 2);
  const endereco = enderecoLinha(root);
  const bairro = cadTxt(root["bairro"], 80);
  const cep = client.cep ? client.cep.slice(0, 8) : null;
  const ie = cadTxt(root["inscricao_estadual"] ?? root["cIE"], 40);
  const im = cadTxt(root["inscricao_municipal"] ?? root["cIM"], 40);
  const situacao = clientInactive(root) ? "Inativo" : "Ativo";
  const tags = ["Cliente"];
  const extra = {
    omie_codigo: client.codigo_cliente_omie,
    omie_app: app.id,
    omie_app_name: app.name,
  };
  const busca = buscaParceiro({
    razao,
    fantasia,
    documento,
    contato,
    cidade,
    email,
    telefone,
    tags,
  });
  const agora = agoraMs();
  const sql = sgoSql();

  let existing: { id: number; tags: string } | undefined;
  if (documento) {
    const rows = await sql<{ id: number; tags: string }[]>`
      select id, tags from parceiros where documento = ${documento} limit 1
    `;
    existing = rows[0];
  }
  if (!existing) {
    const rows = await sql<{ id: number; tags: string }[]>`
      select id, tags from parceiros
      where extra::jsonb->>'omie_codigo' = ${String(client.codigo_cliente_omie)}
        and extra::jsonb->>'omie_app' = ${app.id}
      limit 1
    `;
    existing = rows[0];
  }

  if (existing) {
    let tagsAnt: string[] = [];
    try {
      tagsAnt = JSON.parse(existing.tags || "[]") as string[];
    } catch {
      tagsAnt = [];
    }
    const merged = [...new Set([...tagsAnt.map(String), ...tags])];
    await sql`
      update parceiros set
        documento = ${documento},
        tipo_pessoa = ${tipoPessoa},
        razao = ${razao},
        fantasia = ${fantasia},
        tags = ${JSON.stringify(merged)},
        situacao = ${situacao},
        telefone = ${telefone},
        contato = ${contato},
        email = ${email},
        cidade = ${cidade},
        uf = ${uf},
        endereco = ${endereco},
        bairro = ${bairro},
        cep = ${cep},
        ie = ${ie},
        im = ${im},
        extra = ${JSON.stringify(extra)},
        busca = ${busca},
        origem = 'omie',
        atualizado_em = ${agora},
        atualizado_por = ${porLogin},
        versao = versao + 1
      where id = ${existing.id}
    `;
    return "atualizado" as const;
  }

  await sql`
    insert into parceiros (
      documento, tipo_pessoa, razao, fantasia, tags, situacao,
      telefone, contato, email, cidade, uf, endereco, bairro, cep, ie, im, obs,
      extra, busca, origem, criado_em, atualizado_em, atualizado_por
    ) values (
      ${documento}, ${tipoPessoa}, ${razao}, ${fantasia}, ${JSON.stringify(tags)}, ${situacao},
      ${telefone}, ${contato}, ${email}, ${cidade}, ${uf}, ${endereco}, ${bairro}, ${cep}, ${ie}, ${im}, null,
      ${JSON.stringify(extra)}, ${busca}, 'omie', ${agora}, ${agora}, ${porLogin}
    )
  `;
  return "novo" as const;
}

async function upsertProdutoFromOmie(
  app: OmieAppConfig,
  raw: Record<string, unknown>,
  porLogin: string,
) {
  const codigoProduto = Number(raw["codigo_produto"] ?? 0);
  if (!codigoProduto) return null;
  const descricao = cadTxt(raw["descricao"] ?? raw["descricao_familia"], 255);
  if (!descricao) return null;

  const codigoInterno = cadTxt(raw["codigo"] ?? raw["codigo_produto_integracao"], 80);
  const codigo = (codigoInterno || `OMIE-${codigoProduto}`).slice(0, 80);

  await upsertOmieProduct({
    omieAppId: app.id,
    omieAppName: app.name,
    codigoProduto,
    codigoInterno: codigoInterno,
    descricao: descricao.slice(0, 255),
    unidade: cadTxt(raw["unidade"], 20) || "UN",
    valorUnitario: parseAmount(raw["valor_unitario"] ?? raw["nPrecoUnitario"] ?? raw["preco_unitario"]),
    cmc: parseAmount(
      raw["nCMC"] ?? raw["cmc"] ?? raw["valor_custo"] ?? raw["custo_unitario"] ?? raw["nValorCusto"],
    ),
    ncm: cadTxt(raw["ncm"], 20),
    inactive: productInactive(raw),
  });
  const familia = cadTxt(raw["descricao_familia"] ?? raw["familia"], 120);
  const unidade = cadTxt(raw["unidade"], 20) || "UN";
  const ncm = cadTxt(raw["ncm"], 20);
  const cest = cadTxt(raw["cest"], 20);
  const ean = cadTxt(raw["ean"] ?? raw["codigo_barra"], 40);
  const marca = cadTxt(raw["marca"], 80);
  const modelo = cadTxt(raw["modelo"], 80);
  const preco = parseAmount(raw["valor_unitario"] ?? raw["nPrecoUnitario"] ?? raw["preco_unitario"]);
  const custo = parseAmount(
    raw["nCMC"] ?? raw["cmc"] ?? raw["valor_custo"] ?? raw["custo_unitario"] ?? raw["nValorCusto"],
  );
  const situacao = productInactive(raw) ? "Inativo" : "Ativo";
  // Texto livre do Omie. "recomendacoes_fiscais" é objeto e virava "[object Object]": nunca grava objeto cru.
  const caracteristicas = cadTxt(
    textoLivre(raw["descr_detalhada"]) ??
      textoLivre(raw["caracteristicas"]) ??
      textoLivre(raw["obs_internas"]),
    500,
  );
  const extra = {
    omie_codigo: codigoProduto,
    omie_app: app.id,
    omie_app_name: app.name,
  };
  const busca = buscaProduto({
    codigo,
    descricao,
    marca,
    modelo,
    ean,
    caracteristicas,
    familia,
  });
  const agora = agoraMs();
  const sql = sgoSql();

  const existing = await sql<{ id: number }[]>`
    select id from produtos where lower(codigo::text) = ${codigo.toLowerCase()} limit 1
  `;

  if (existing[0]) {
    await sql`
      update produtos set
        descricao = ${descricao},
        familia = ${familia},
        unidade = ${unidade},
        ncm = ${ncm},
        cest = ${cest},
        ean = ${ean},
        marca = ${marca},
        modelo = ${modelo},
        -- O preço de venda é do SGO: a Omie só preenche produto novo (ou ainda sem preço).
        preco_venda = coalesce(preco_venda, ${preco}),
        custo = coalesce(${custo}, custo),
        caracteristicas = ${caracteristicas},
        situacao = ${situacao},
        extra = ${JSON.stringify(extra)},
        busca = ${busca},
        origem = 'omie',
        atualizado_em = ${agora},
        atualizado_por = ${porLogin},
        versao = versao + 1
      where id = ${existing[0].id}
    `;
    return "atualizado" as const;
  }

  await sql`
    insert into produtos (
      codigo, descricao, familia, unidade, ncm, cest, ean, marca, modelo,
      preco_venda, custo, estoque, garantia_dias, tipo_item, caracteristicas, situacao,
      extra, busca, origem, criado_em, atualizado_em, atualizado_por
    ) values (
      ${codigo}, ${descricao}, ${familia}, ${unidade}, ${ncm}, ${cest}, ${ean}, ${marca}, ${modelo},
      ${preco}, ${custo}, 0, null, null, ${caracteristicas}, ${situacao},
      ${JSON.stringify(extra)}, ${busca}, 'omie', ${agora}, ${agora}, ${porLogin}
    )
  `;
  return "novo" as const;
}

async function syncClientesParaSgo(porLogin: string) {
  const apps = listOmieApps();
  let novos = 0;
  let atualizados = 0;
  let total = 0;
  const erros: string[] = [];

  for (const [ai, app] of apps.entries()) {
    const fx = (a: number, b: number, f: number, etapa: string) => {
      const ini = (ai / apps.length) * 100, tam = 100 / apps.length;
      progMarcar("clientes", ini + (tam * a) / 100, ini + (tam * b) / 100, f, etapa);
    };
    try {
      fx(0, 40, 0, `Baixando clientes da Omie (${app.name})`);
      const items = await omiePaginate<{
        pagina?: number;
        total_de_paginas?: number;
        clientes_cadastro?: Record<string, unknown>[];
      }>(
        app,
        "/geral/clientes/",
        "ListarClientes",
        (page) => ({
          pagina: page,
          registros_por_pagina: 100,
          apenas_importado_api: "N",
        }),
        (response) => {
          const pg = response.pagina ?? 1, tp = response.total_de_paginas ?? 1;
          fx(0, 40, pg / Math.max(1, tp), `Baixando clientes da Omie (${app.name}) · página ${pg} de ${tp}`);
          return { page: pg, totalPages: tp, items: response.clientes_cadastro ?? [] };
        },
      );

      for (const [i, item] of items.entries()) {
        if (i % 10 === 0) fx(40, 100, i / Math.max(1, items.length), `Gravando clientes (${app.name}) · ${i} de ${items.length}`);
        const raw = item as Record<string, unknown>;
        const result = await upsertParceiroFromOmie(app, raw, porLogin);
        if (!result) continue;
        total += 1;
        if (result === "novo") novos += 1;
        else atualizados += 1;
      }
    } catch (error) {
      erros.push(
        `${app.name}: ${error instanceof Error ? error.message : "Falha ao sincronizar clientes"}`,
      );
    }
  }

  return { novos, atualizados, total, erros };
}

async function syncProdutosParaSgo(porLogin: string) {
  const apps = listOrcamentosOmieApps();
  let novos = 0;
  let atualizados = 0;
  let total = 0;
  const erros: string[] = [];

  if (!apps.length) {
    return {
      novos: 0,
      atualizados: 0,
      total: 0,
      erros: [
        "Empresa Belfer não configurada. Inclua o app Belfer em OMIE_APPS (ou defina OMIE_ORCAMENTOS_APP).",
      ],
    };
  }

  for (const [ai, app] of apps.entries()) {
    const fx = (a: number, b: number, f: number, etapa: string) => {
      const ini = (ai / apps.length) * 100, tam = 100 / apps.length;
      progMarcar("produtos", ini + (tam * a) / 100, ini + (tam * b) / 100, f, etapa);
    };
    try {
      fx(0, 30, 0, `Baixando produtos da Omie (${app.name})`);
      const items = await omiePaginate<{
        pagina?: number;
        total_de_paginas?: number;
        produto_servico_cadastro?: Record<string, unknown>[];
      }>(
        app,
        "/geral/produtos/",
        "ListarProdutos",
        (page) => ({
          pagina: page,
          registros_por_pagina: 100,
          apenas_importado_api: "N",
          filtrar_apenas_omiepdv: "N",
        }),
        (response) => {
          const pg = response.pagina ?? 1, tp = response.total_de_paginas ?? 1;
          fx(0, 30, pg / Math.max(1, tp), `Baixando produtos da Omie (${app.name}) · página ${pg} de ${tp}`);
          return { page: pg, totalPages: tp, items: response.produto_servico_cadastro ?? [] };
        },
      );

      for (const [i, item] of items.entries()) {
        if (i % 10 === 0) fx(30, 90, i / Math.max(1, items.length), `Gravando produtos (${app.name}) · ${i} de ${items.length}`);
        const raw = item as Record<string, unknown>;
        const result = await upsertProdutoFromOmie(app, raw, porLogin);
        if (!result) continue;
        total += 1;
        if (result === "novo") novos += 1;
        else atualizados += 1;
      }

      // CMC vem de ListarPosEstoque (não de ListarProdutos) → omie_products + sgo.produtos.custo
      try {
        fx(90, 100, 0, `Atualizando custo (CMC) da Omie (${app.name})`);
        await syncProductCmcFromStock(app);
      } catch (error) {
        erros.push(
          `${app.name} (custo/CMC): ${error instanceof Error ? error.message : "Falha ao buscar CMC"}`,
        );
      }
    } catch (error) {
      erros.push(
        `${app.name}: ${error instanceof Error ? error.message : "Falha ao sincronizar produtos"}`,
      );
    }
  }

  return { novos, atualizados, total, erros };
}

export async function syncOmieParaCadastrosSgo(
  tipo: SyncOmieCadastrosTipo,
  porLogin: string,
): Promise<SyncOmieCadastrosResult> {
  const vazios = { novos: 0, atualizados: 0, total: 0 };
  const erros: string[] = [];
  let clientes = vazios;
  let produtos = vazios;

  if (tipo === "clientes" || tipo === "ambos") {
    progIniciar("clientes");
    try {
      const r = await syncClientesParaSgo(porLogin);
      clientes = { novos: r.novos, atualizados: r.atualizados, total: r.total };
      erros.push(...r.erros);
    } finally {
      progFim("clientes");
    }
  }
  if (tipo === "produtos" || tipo === "ambos") {
    progIniciar("produtos");
    try {
      const r = await syncProdutosParaSgo(porLogin);
      produtos = { novos: r.novos, atualizados: r.atualizados, total: r.total };
      erros.push(...r.erros);
    } finally {
      progFim("produtos");
    }
  }

  return { ok: true, clientes, produtos, erros };
}
