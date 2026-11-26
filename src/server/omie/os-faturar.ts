import "@tanstack/react-start/server-only";

import { getSetting } from "@/db/settings";
import { sgoSql } from "@/sgo/server/d1";
import {
  requireOrcamentosOmieApp,
  requireOmieAppByHint,
  omieCall,
  type OmieAppConfig,
} from "@/server/omie/client";
import { searchOmieClients } from "@/server/omie/quotes";

type LinhaProduto = {
  descricao?: string;
  codigo?: string;
  qtd?: number;
  unit?: number;
  total?: number;
};

type LinhaServico = {
  descricao?: string;
  detalhe?: string;
  valor?: number;
};

type FaturamentoIn = {
  modo?: string;
  produtos?: LinhaProduto[];
  servicos?: LinhaServico[];
  total?: number;
  status?: string;
  omie?: Record<string, unknown> | null;
};

type OsRow = { id: string; num: string; stage: number; dados: string; versao: number };

const ETAPA_FATURAR = "50";

function txt(v: unknown, max = 200) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hojeOmie() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-");
  return `${d}/${m}/${y}`;
}

function codigoIntegracao(numOs: string, tipo: "P" | "S") {
  const base = String(numOs || "").replace(/[^0-9A-Za-z]/g, "").slice(-12) || "OS";
  return `SGO${base}${tipo}`.slice(0, 20);
}

function extraDe(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw || "{}")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function codigoOmieDoExtra(extra: Record<string, unknown>, app: OmieAppConfig) {
  const mapa = extra["omie_codigos"];
  if (mapa && typeof mapa === "object") {
    const rec = mapa as Record<string, unknown>;
    const direto = num(rec[app.id] ?? rec[app.name]);
    if (direto > 0) return direto;
  }
  const appDoCadastro = txt(extra["omie_app"] ?? extra["omie_app_name"], 40).toLowerCase();
  const casa =
    !appDoCadastro ||
    appDoCadastro === app.id.toLowerCase() ||
    appDoCadastro === app.name.toLowerCase() ||
    appDoCadastro.includes("belfer");
  if (!casa) return 0;
  return num(extra["omie_codigo"] ?? extra["codigo_cliente_omie"] ?? extra["codigo_produto"]);
}

async function etapaColunaFaturar(app: OmieAppConfig, operacao: "produto" | "servico") {
  try {
    const resp = await omieCall<{
      cadastros?: Array<{
        cDescOperacao?: string;
        etapas?: Array<{ cCodigo?: string; cDescricao?: string; cDescrPadrao?: string; cInativo?: string }>;
      }>;
    }>(app, "/produtos/etapafat/", "ListarEtapasFaturamento", {
      pagina: 1,
      registros_por_pagina: 50,
    });
    const want = operacao === "produto" ? /produto/i : /servi/i;
    const ativas = (resp.cadastros ?? [])
      .filter((b) => want.test(String(b.cDescOperacao || "")))
      .flatMap((b) => b.etapas ?? [])
      .filter((e) => String(e.cInativo || "N").toUpperCase() !== "S" && txt(e.cCodigo, 2));
    const nome = (e: { cDescricao?: string; cDescrPadrao?: string }) =>
      `${e.cDescricao || ""} ${e.cDescrPadrao || ""}`;
    const fat =
      ativas.find((e) => /faturar/i.test(nome(e)) && !/faturad/i.test(nome(e))) ||
      ativas.find((e) => String(e.cCodigo) === ETAPA_FATURAR);
    if (fat?.cCodigo) return String(fat.cCodigo);
  } catch {
    // a coluna padrão da Omie para Faturar é 50
  }
  return ETAPA_FATURAR;
}

async function contaCorrente(app: OmieAppConfig) {
  const envName = `OMIE_${app.id.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_ORCAMENTO_CONTA_CORRENTE`;
  const fromEnv = num(process.env[envName]);
  if (fromEnv > 0) return fromEnv;
  const salva = async (key: string) => {
    try {
      return num(await getSetting(key));
    } catch {
      return 0;
    }
  };
  const fromApp = await salva(`orcamento.${app.id}.conta_corrente`);
  if (fromApp > 0) return fromApp;
  const global = await salva("orcamento.conta_corrente");
  if (global > 0) return global;
  try {
    const response = await omieCall<{
      ListarContasCorrentes?: Array<Record<string, unknown>>;
      conta_corrente_lista?: Array<Record<string, unknown>>;
      cadastros?: Array<Record<string, unknown>>;
    }>(app, "/geral/contacorrente/", "ListarContasCorrentes", {
      pagina: 1,
      registros_por_pagina: 50,
    });
    const rows = response.ListarContasCorrentes ?? response.conta_corrente_lista ?? response.cadastros ?? [];
    for (const row of rows) {
      if (String(row["inativo"] ?? row["cInativo"] ?? "N").toUpperCase() === "S") continue;
      const code = num(row["nCodCC"] ?? row["codigo_conta_corrente"] ?? row["codigo"]);
      if (code > 0) return code;
    }
  } catch {
    // a conta segue obrigatória na mensagem abaixo
  }
  throw new Error("A Belfer exige a conta corrente no pedido e nenhuma conta ativa foi encontrada.");
}

async function clienteBelfer(app: OmieAppConfig, dados: Record<string, unknown>) {
  const sql = sgoSql();
  const orc = (dados["orcamento"] ?? {}) as { id?: string };
  const nome = txt(dados["cliente"], 160);
  let documento = "";
  let extra: Record<string, unknown> = {};

  if (orc.id) {
    const rows = await sql<{ documento: string | null; extra: string | null; razao: string | null }[]>`
      select p.documento, p.extra, p.razao
      from orcamentos o
      left join parceiros p on p.id = o.parceiro_id
      where o.id = ${orc.id}
      limit 1
    `;
    if (rows[0]?.extra) extra = extraDe(rows[0].extra);
    documento = String(rows[0]?.documento || "").replace(/\D/g, "");
  }

  let codigo = codigoOmieDoExtra(extra, app);
  if (!codigo && documento) {
    const porDoc = await sql<{ codigo_cliente: string | number }[]>`
      select codigo_cliente from omie_clients
      where omie_app_id = ${app.id}
        and inactive = false
        and regexp_replace(coalesce(cnpj_cpf, ''), '\\D', '', 'g') = ${documento}
      limit 1
    `;
    codigo = num(porDoc[0]?.codigo_cliente);
  }
  if (!codigo && nome) {
    const rows = await sql<{ extra: string; documento: string | null }[]>`
      select extra, documento from parceiros
      where situacao = 'Ativo'
        and (lower(razao) = lower(${nome}) or lower(coalesce(fantasia, '')) = lower(${nome}))
      limit 8
    `;
    for (const row of rows) {
      const achado = codigoOmieDoExtra(extraDe(row.extra), app);
      if (achado > 0) {
        codigo = achado;
        if (!documento) documento = String(row.documento || "").replace(/\D/g, "");
        break;
      }
    }
  }

  if (!codigo && (nome || documento)) {
    const busca = documento || nome;
    const achados = await searchOmieClients(app, busca);
    const exato = achados.find((c) => {
      const doc = String(c.cnpjCpf || "").replace(/\D/g, "");
      if (documento && doc === documento) return true;
      const n = nome.toLowerCase();
      return !!n && c.nome.toLowerCase() === n;
    });
    const unico = achados.length === 1 ? achados[0] : undefined;
    codigo = num((exato ?? unico)?.codigo);
  }

  if (!codigo) {
    throw new Error(
      `O cliente "${nome || "desta OS"}" não está na Belfer. Sincronize os cadastros da Omie e vincule o cliente antes de enviar.`,
    );
  }
  return codigo;
}

async function produtoBelfer(app: OmieAppConfig, linha: LinhaProduto) {
  const sql = sgoSql();
  const codigo = txt(linha.codigo, 80);
  const descricao = txt(linha.descricao, 255);
  if (codigo) {
    const rows = await sql<{ extra: string; unidade: string | null; descricao: string }[]>`
      select extra, unidade, descricao from produtos
      where lower(codigo::text) = lower(${codigo})
      limit 1
    `;
    const code = rows[0] ? codigoOmieDoExtra(extraDe(rows[0].extra), app) : 0;
    if (code > 0) {
      return {
        codigoProduto: code,
        descricao: descricao || txt(rows[0]?.descricao, 120),
        unidade: txt(rows[0]?.unidade, 6) || "UN",
      };
    }
  }

  const porCodigo = codigo
    ? await sql<{ codigo_produto: string | number; descricao: string; unidade: string | null }[]>`
        select codigo_produto, descricao, unidade from omie_products
        where omie_app_id = ${app.id}
          and (lower(coalesce(codigo_interno, '')) = lower(${codigo}) or cast(codigo_produto as text) = ${codigo})
        limit 1
      `
    : [];
  const porNome =
    !porCodigo[0] && descricao
      ? await sql<{ codigo_produto: string | number; descricao: string; unidade: string | null }[]>`
          select codigo_produto, descricao, unidade from omie_products
          where omie_app_id = ${app.id} and lower(descricao) = lower(${descricao})
          limit 1
        `
      : [];
  const row = porCodigo[0] ?? porNome[0];
  const code = num(row?.codigo_produto);
  if (code > 0) {
    return { codigoProduto: code, descricao: descricao || txt(row?.descricao, 120), unidade: txt(row?.unidade, 6) || "UN" };
  }
  throw new Error(
    `O produto "${descricao || codigo}" não está vinculado à Belfer. Sincronize o estoque/cadastro da Omie e tente de novo.`,
  );
}

function servicoAtivo(rec: Record<string, unknown>) {
  const info = (rec["info"] ?? {}) as Record<string, unknown>;
  const cab = (rec["cabecalho"] ?? {}) as Record<string, unknown>;
  const flag = txt(info["inativo"] ?? cab["inativo"] ?? rec["inativo"], 1).toUpperCase();
  return flag !== "S";
}

function codigoServico(rec: Record<string, unknown>) {
  const cab = (rec["cabecalho"] ?? {}) as Record<string, unknown>;
  const ide = (rec["intListar"] ?? rec) as Record<string, unknown>;
  return num(ide["nCodServ"] ?? cab["nCodServ"] ?? rec["nCodServ"] ?? cab["nCodServico"]);
}

function descricaoServico(rec: Record<string, unknown>) {
  const cab = (rec["cabecalho"] ?? {}) as Record<string, unknown>;
  const desc = (rec["descricao"] ?? {}) as Record<string, unknown>;
  return txt(cab["cDescricao"] ?? desc["cDescrCompleta"] ?? rec["descricao"], 160).toLowerCase();
}

async function servicoCatalogo(app: OmieAppConfig) {
  const forçado = num(
    process.env[`OMIE_${app.id.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_OS_SERVICO`] ??
      process.env["OMIE_OS_SERVICO"],
  );
  if (forçado > 0) {
    const consulta = await omieCall<Record<string, unknown>>(app, "/servicos/servico/", "ConsultarCadastroServico", {
      nCodServ: forçado,
    });
    if (servicoAtivo(consulta)) return forçado;
  }

  let preferido = 0;
  let fallback = 0;
  for (let pagina = 1; pagina <= 6; pagina++) {
    const resp = await omieCall<Record<string, unknown>>(app, "/servicos/servico/", "ListarCadastroServico", {
      nPagina: pagina,
      nRegPorPagina: 50,
      inativo: "N",
    });
    const lista = (resp["cadastros"] ?? []) as unknown[];
    for (const item of lista) {
      const rec = item as Record<string, unknown>;
      if (!servicoAtivo(rec)) continue;
      const code = codigoServico(rec);
      if (!code) continue;
      const desc = descricaoServico(rec);
      if (!fallback) fallback = code;
      if (/m[aã]o de obra|instala/.test(desc)) {
        preferido = code;
        break;
      }
    }
    if (preferido) break;
    const total = num(resp["nTotPaginas"]) || 1;
    if (pagina >= total) break;
  }
  const code = preferido || fallback;
  if (!code) {
    throw new Error(
      "A Belfer não tem um serviço ativo para a mão de obra. Ative um serviço na Omie ou defina OMIE_OS_SERVICO com um código ativo.",
    );
  }
  return code;
}

function sumiuNaOmie(message: string) {
  return /n[aã]o cadastrad|n[aã]o encontrad|n[aã]o existe|inexistente/i.test(message);
}

function emProcessamento(message: string) {
  return /j[aá] foi processada|sendo processada|tente novamente/i.test(message);
}

function jaExisteNaOmie(message: string) {
  return /j[aá] cadastrad|j[aá] existe|duplic/i.test(message);
}

async function chamarSeExistir(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (sumiuNaOmie(message)) return;
    throw error;
  }
}

async function incluirPedido(
  app: OmieAppConfig,
  input: {
    codigo: string;
    cliente: number;
    etapa: string;
    conta: number;
    categoria: string;
    obs: string;
    itens: Array<{ codigoProduto: number; descricao: string; qtd: number; unit: number; unidade: string }>;
    substituir?: boolean;
  },
  tentativa = 0,
) {
  const payload = {
    cabecalho: {
      codigo_cliente: input.cliente,
      codigo_pedido_integracao: input.codigo,
      data_previsao: hojeOmie(),
      etapa: input.etapa,
      codigo_parcela: "999",
      quantidade_itens: input.itens.length,
    },
    det: input.itens.map((item, index) => ({
      ide: { codigo_item_integracao: `${input.codigo}${index + 1}`.slice(0, 30) },
      produto: {
        codigo_produto: item.codigoProduto,
        descricao: item.descricao.slice(0, 120),
        quantidade: item.qtd,
        valor_unitario: item.unit,
        unidade: item.unidade || "UN",
      },
    })),
    frete: { modalidade: "9" },
    informacoes_adicionais: {
      codigo_categoria: input.categoria,
      consumidor_final: "S",
      enviar_email: "N",
      ...(input.conta > 0 ? { codigo_conta_corrente: input.conta } : {}),
    },
    observacoes: { obs_venda: input.obs.slice(0, 500) },
  };
  try {
    return await omieCall<{ codigo_pedido?: number; numero_pedido?: string }>(
      app,
      "/produtos/pedido/",
      "IncluirPedido",
      payload,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (input.substituir && jaExisteNaOmie(message) && tentativa < 1) {
      await chamarSeExistir(() =>
        omieCall(app, "/produtos/pedido/", "ExcluirPedido", { codigo_pedido_integracao: input.codigo }),
      );
      return incluirPedido(app, input, tentativa + 1);
    }
    if (input.substituir && jaExisteNaOmie(message)) {
      throw new Error("O pedido anterior continua na Omie e não foi possível substituir. Se ele já foi faturado, cancele a nota antes de enviar de novo.");
    }
    if (!jaExisteNaOmie(message)) throw error;
    const consulta = await omieCall<Record<string, unknown>>(app, "/produtos/pedido/", "ConsultarPedido", {
      codigo_pedido_integracao: input.codigo,
    });
    const root = (consulta["pedido_venda_produto"] ?? consulta) as Record<string, unknown>;
    const cab = (root["cabecalho"] ?? root) as Record<string, unknown>;
    return {
      codigo_pedido: num(consulta["codigo_pedido"] ?? cab["codigo_pedido"]),
      numero_pedido: txt(consulta["numero_pedido"] ?? cab["numero_pedido"], 20),
    };
  }
}

async function incluirOsServico(
  app: OmieAppConfig,
  input: {
    codigo: string;
    cliente: number;
    etapa: string;
    conta: number;
    categoria: string;
    obs: string;
    servico: number;
    linhas: LinhaServico[];
    substituir?: boolean;
  },
  tentativa = 0,
) {
  const payload = {
    Cabecalho: {
      cCodIntOS: input.codigo,
      nCodCli: input.cliente,
      cEtapa: input.etapa,
      dDtPrevisao: hojeOmie(),
      cCodParc: "999",
      nQtdeParc: 1,
    },
    InformacoesAdicionais: {
      cCodCateg: input.categoria,
      cDadosAdicNF: input.obs.slice(0, 500),
      ...(input.conta > 0 ? { nCodCC: input.conta } : {}),
    },
    ServicosPrestados: input.linhas.map((linha) => ({
      nCodServico: input.servico,
      nQtde: 1,
      nValUnit: Math.round(num(linha.valor) * 100) / 100,
      cDescServ: txt(linha.descricao, 200) || "Mão de obra",
      cDadosAdicItem: txt(linha.detalhe, 900),
    })),
    Email: { cEnvBoleto: "N", cEnvLink: "N" },
  };
  try {
    return await omieCall<{ nCodOS?: number; cNumOS?: string; cCodIntOS?: string }>(
      app,
      "/servicos/os/",
      "IncluirOS",
      payload,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (input.substituir && jaExisteNaOmie(message) && tentativa < 1) {
      await chamarSeExistir(() =>
        omieCall(app, "/servicos/os/", "ExcluirOS", { cCodIntOS: input.codigo }),
      );
      return incluirOsServico(app, input, tentativa + 1);
    }
    if (input.substituir && jaExisteNaOmie(message)) {
      throw new Error("A OS de serviço anterior continua na Omie e não foi possível substituir. Se ela já foi faturada, cancele a nota antes de enviar de novo.");
    }
    if (!jaExisteNaOmie(message)) throw error;
    const consulta = await omieCall<Record<string, unknown>>(app, "/servicos/os/", "ConsultarOS", {
      cCodIntOS: input.codigo,
    });
    const cab = (consulta["Cabecalho"] ?? consulta) as Record<string, unknown>;
    return {
      nCodOS: num(consulta["nCodOS"] ?? cab["nCodOS"]),
      cNumOS: txt(consulta["cNumOS"] ?? cab["cNumOS"], 20),
    };
  }
}

async function aindaExiste(app: OmieAppConfig, endpoint: string, call: string, param: Record<string, unknown>) {
  try {
    await omieCall(app, endpoint, call, param);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (sumiuNaOmie(message)) return false;
    throw error;
  }
}

async function apagarOuSeguir(
  app: OmieAppConfig,
  endpoint: string,
  call: string,
  consulta: string,
  param: Record<string, unknown>,
) {
  try {
    await omieCall(app, endpoint, call, param);
    return "apagou" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (sumiuNaOmie(message)) return "sumiu" as const;
    if (emProcessamento(message)) {
      const existe = await aindaExiste(app, endpoint, consulta, param);
      if (!existe) return "sumiu" as const;
      throw new Error("A Omie ainda está processando o envio anterior. Espere alguns segundos e clique em Enviar de novo.");
    }
    throw error;
  }
}

async function excluirDocumento(
  app: OmieAppConfig,
  endpoint: string,
  call: string,
  consulta: string,
  porId: Record<string, unknown> | null,
  porIntegracao: Record<string, unknown>,
) {
  if (porId) {
    const resultado = await apagarOuSeguir(app, endpoint, call, consulta, porId);
    if (resultado === "apagou") return;
  }
  await apagarOuSeguir(app, endpoint, call, consulta, porIntegracao);
}

async function excluirAnterior(app: OmieAppConfig, omie: Record<string, unknown> | null | undefined, numOs: string) {
  const pedido = num(omie?.["pedidoCodigo"]);
  const os = num(omie?.["osCodigo"]);
  await excluirDocumento(
    app,
    "/produtos/pedido/",
    "ExcluirPedido",
    "ConsultarPedido",
    pedido > 0 ? { codigo_pedido: pedido } : null,
    { codigo_pedido_integracao: codigoIntegracao(numOs, "P") },
  );
  await excluirDocumento(
    app,
    "/servicos/os/",
    "ExcluirOS",
    "ConsultarOS",
    os > 0 ? { nCodOS: os } : null,
    { cCodIntOS: codigoIntegracao(numOs, "S") },
  );
}

export async function enviarOsParaFaturarOmie(input: {
  id: string;
  faturamento: FaturamentoIn;
  substituir?: boolean;
  por: string;
}) {
  const id = txt(input.id, 80);
  if (!id) throw new Error("OS não informada.");
  const fat = input.faturamento;
  if (!fat || (fat.modo !== "normal" && fat.modo !== "diluir" && fat.modo !== "servico")) {
    throw new Error("Escolha como faturar antes de enviar.");
  }

  const sql = sgoSql();
  const rows = await sql<OsRow[]>`
    select id, num, stage, dados, versao from ordens_servico where id = ${id} limit 1
  `;
  const os = rows[0];
  if (!os) throw new Error("OS não encontrada.");
  if (Number(os.stage) !== 7) throw new Error("Só uma OS finalizada pode ir para a coluna Faturar.");

  let dados: Record<string, unknown> = {};
  try {
    dados = JSON.parse(os.dados) as Record<string, unknown>;
  } catch {
    throw new Error("Não foi possível ler os dados desta OS.");
  }

  const anterior = (dados["faturamento"] ?? null) as { status?: string; omie?: Record<string, unknown> | null } | null;
  if (anterior?.status === "enviado" && anterior.omie && !input.substituir) {
    throw new Error("Esta OS já foi enviada para a coluna Faturar. Abra de novo e confirme para substituir.");
  }

  const produtos = (fat.produtos ?? []).filter((p) => num(p.qtd) > 0 && num(p.unit) >= 0 && txt(p.descricao || p.codigo));
  const servicos = (fat.servicos ?? []).filter((s) => num(s.valor) > 0);
  if (!produtos.length && !servicos.length) throw new Error("Não há produto nem serviço para enviar.");

  const comodato = (dados["comodato"] ?? null) as { ativo?: boolean } | null;
  const omieEmpresa = String(dados["omieEmpresa"] || "").toLowerCase();
  const usarAngela = !!(comodato && comodato.ativo) || omieEmpresa === "angela";
  const app = usarAngela
    ? requireOmieAppByHint("angela", "Angela")
    : requireOrcamentosOmieApp();
  if (input.substituir) {
    await excluirAnterior(app, anterior?.omie, os.num);
  }

  const cliente = await clienteBelfer(app, dados);
  const conta = await contaCorrente(app);
  const categoria = "1.01.03";
  const categoriaServico = "1.01.03";
  const obs = `OS ${os.num} · ${fat.modo} · ${txt(dados["cliente"], 80)}`;
  const omie: Record<string, unknown> = {
    empresa: app.name,
    etapa: ETAPA_FATURAR,
  };

  try {
    if (produtos.length) {
      const etapa = await etapaColunaFaturar(app, "produto");
      omie["etapaPedido"] = etapa;
      const itens = [];
      for (const linha of produtos) {
        const vinculo = await produtoBelfer(app, linha);
        itens.push({
          ...vinculo,
          qtd: Math.max(1, Math.round(num(linha.qtd))),
          unit: Math.round(num(linha.unit) * 100) / 100,
        });
      }
      const resp = await incluirPedido(app, {
        codigo: codigoIntegracao(os.num, "P"),
        cliente,
        etapa,
        conta,
        categoria,
        obs,
        itens,
        substituir: input.substituir,
      });
      const pedidoCodigo = num(resp.codigo_pedido);
      if (!pedidoCodigo) throw new Error("A Omie não devolveu o pedido de venda.");
      omie["pedidoCodigo"] = pedidoCodigo;
      omie["pedidoNumero"] = txt(resp.numero_pedido, 20);
      omie["pedidoEtapa"] = etapa;
    }

    if (servicos.length) {
      const etapa = await etapaColunaFaturar(app, "servico");
      omie["etapaOs"] = etapa;
      const servico = await servicoCatalogo(app);
      const resp = await incluirOsServico(app, {
        codigo: codigoIntegracao(os.num, "S"),
        cliente,
        etapa,
        conta,
        categoria: categoriaServico,
        obs,
        servico,
        linhas: servicos,
        substituir: input.substituir,
      });
      const osCodigo = num(resp.nCodOS);
      if (!osCodigo) throw new Error("A Omie não devolveu a ordem de serviço.");
      omie["osCodigo"] = osCodigo;
      omie["osNumero"] = txt(resp.cNumOS, 20);
      omie["osEtapa"] = etapa;
      omie["servicoCodigo"] = servico;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar para a Omie.";
    const pedido = txt(omie["pedidoNumero"], 20);
    const extra = pedido ? ` O pedido ${pedido} já entrou em Vendas, na coluna Faturar.` : "";
    throw new Error(message + extra);
  }

  const quando = Date.now();
  const quandoTxt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(quando);
  const salvo = {
    ...fat,
    quando,
    quandoTxt,
    por: input.por,
    status: "enviado",
    omie,
  };

  return { ok: true as const, faturamento: salvo, num: os.num };
}
