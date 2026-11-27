import "@tanstack/react-start/server-only";

import type { DueItem } from "@/db/schema";
import { listOmieApps, omieCall, type OmieAppConfig } from "@/server/omie/client";
import {
  isCancelledReceivableStatus,
  isClosedReceivableStatus,
  isOpenReceivableStatus,
  isPaidReceivableStatus,
} from "@/server/omie/status";

/**
 * Por parcela (app+omie_code+due): prefere boleto; senão um fiscal.
 * Evita mandar boleto+NF do mesmo título no WhatsApp.
 */
export function preferPayableDocsPerTitle(items: DueItem[]): DueItem[] {
  const groups = new Map<string, DueItem[]>();
  const passthrough: DueItem[] = [];

  for (const item of items) {
    const code = item.omieCode;
    if (!code) {
      passthrough.push(item);
      continue;
    }
    const key = `${item.omieAppId}|${code}|${item.dueDate.slice(0, 10)}`;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const picked: DueItem[] = [...passthrough];
  for (const list of groups.values()) {
    const boleto = list.find((row) => row.itemType === "boleto");
    if (boleto) {
      picked.push(boleto);
      continue;
    }
    const nfe = list.find((row) => row.itemType === "nfe");
    const nfse = list.find((row) => row.itemType === "nfse");
    picked.push(nfe ?? nfse ?? list[0]!);
  }
  return picked;
}

/** Extrai nCodTitulo do item (boleto, titulo:, ou …:titulo:N). */
export function tituloCodeFromDueItem(item: {
  itemType: string;
  omieCode: number | null;
  integrationCode: string | null;
}): number | null {
  const integ = item.integrationCode?.trim() || "";
  const tituloMatch = /(?:^|:)titulo:(\d+)/i.exec(integ);
  if (tituloMatch) {
    const n = Number(tituloMatch[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (item.itemType === "boleto" && item.omieCode && item.omieCode > 0) return item.omieCode;
  // Companions fiscais costumam gravar omie_code = nCodTitulo.
  if ((item.itemType === "nfe" || item.itemType === "nfse") && item.omieCode && item.omieCode > 0) {
    return item.omieCode;
  }
  return null;
}

function flattenTituloRecord(hit: Record<string, unknown>) {
  const cab = (
    (hit["cabecTitulo"] as Record<string, unknown> | undefined) ??
    (hit["Cabecalho"] as Record<string, unknown> | undefined) ??
    (hit["cabecalho"] as Record<string, unknown> | undefined) ??
    (hit["detalhes"] as Record<string, unknown> | undefined) ??
    (hit["Detalhes"] as Record<string, unknown> | undefined) ??
    {}
  ) as Record<string, unknown>;
  const resumo = (
    (hit["resumo"] as Record<string, unknown> | undefined) ??
    (hit["Resumo"] as Record<string, unknown> | undefined) ??
    {}
  ) as Record<string, unknown>;
  return { ...hit, ...resumo, ...cab };
}

function statusFromTituloRecord(record: Record<string, unknown>) {
  const candidates = [
    record["cStatus"],
    record["status_titulo"],
    record["cDesStatus"],
    record["status"],
    record["cLiquidado"],
    record["cStatusTitulo"],
  ];
  for (const raw of candidates) {
    const value = String(raw ?? "").trim();
    if (value) return value;
  }
  return null;
}

function recordTituloCode(record: Record<string, unknown>) {
  const n =
    Number(record["nCodTitulo"] ?? record["codigo_lancamento_omie"] ?? record["nCodigoTitulo"] ?? 0) ||
    0;
  return n > 0 ? n : null;
}

/** Omie às vezes deixa cStatus “aberto” mas já preenche data/valor de pagamento. */
function hasPaymentEvidence(record: Record<string, unknown>) {
  const payDate = String(
    record["dDtPagamento"] ??
      record["data_pagamento"] ??
      record["dDtCredito"] ??
      record["dDtLiquidacao"] ??
      "",
  ).trim();
  if (payDate && payDate !== "00/00/0000" && !/^0+\/0+\/0+$/.test(payDate)) {
    return true;
  }

  const paidFlag = String(record["cLiquidado"] ?? record["liquidado"] ?? "")
    .trim()
    .toUpperCase();
  if (paidFlag === "S" || paidFlag === "SIM" || paidFlag === "1") return true;

  const valorPago = Number(
    record["nValPago"] ?? record["valor_pago"] ?? record["nValorPago"] ?? record["nValLiquidado"] ?? 0,
  );
  const valorTitulo = Number(
    record["nValorTitulo"] ?? record["valor_documento"] ?? record["nValDocumento"] ?? 0,
  );
  if (Number.isFinite(valorPago) && valorPago > 0) {
    if (!Number.isFinite(valorTitulo) || valorTitulo <= 0) return true;
    if (valorPago >= valorTitulo * 0.99) return true;
  }
  return false;
}

function interpretTituloOpen(record: Record<string, unknown>): {
  open: boolean;
  status: string | null;
  closedAs: "RECEBIDO" | "CANCELADO";
} {
  const status = statusFromTituloRecord(record);

  if (isCancelledReceivableStatus(status)) {
    return { open: false, status, closedAs: "CANCELADO" };
  }
  if (isPaidReceivableStatus(status) || isClosedReceivableStatus(status)) {
    return { open: false, status, closedAs: "RECEBIDO" };
  }
  if (hasPaymentEvidence(record)) {
    return {
      open: false,
      status: status || "RECEBIDO",
      closedAs: "RECEBIDO",
    };
  }
  if (isOpenReceivableStatus(status)) {
    return { open: true, status, closedAs: "RECEBIDO" };
  }
  // Status desconhecido/ausente: fail-closed (trata como não cobrável).
  return {
    open: false,
    status: status || "RECEBIDO",
    closedAs: "RECEBIDO",
  };
}

async function fetchTituloLive(app: OmieAppConfig, nCodTitulo: number) {
  // ContaReceber é a fonte mais confiável para 1 título.
  try {
    const cr = await omieCall<Record<string, unknown>>(
      app,
      "/financas/contareceber/",
      "ConsultarContaReceber",
      { codigo_lancamento_omie: nCodTitulo },
    );
    const flat = flattenTituloRecord(cr);
    const code = recordTituloCode(flat);
    if (!code || code === nCodTitulo) return flat;
  } catch {
    // tenta PesquisarLancamentos abaixo
  }

  try {
    const response = await omieCall<{
      titulosEncontrados?: Record<string, unknown>[];
    }>(app, "/financas/pesquisartitulos/", "PesquisarLancamentos", {
      nPagina: 1,
      nRegPorPagina: 5,
      nCodTitulo,
      cNatureza: "R",
    });
    const hits = response.titulosEncontrados ?? [];
    for (const hit of hits) {
      const flat = flattenTituloRecord(hit);
      const code = recordTituloCode(flat);
      if (code === nCodTitulo) return flat;
    }
    // Sem match explícito: se veio 1 e o filtro foi por código, usa.
    if (hits.length === 1) return flattenTituloRecord(hits[0]!);
  } catch {
    return null;
  }

  return null;
}

export type LiveOpenCheck =
  | { ok: true; open: true; status: string | null; nCodTitulo: number }
  | {
      ok: true;
      open: false;
      status: string | null;
      nCodTitulo: number;
      closedAs: "RECEBIDO" | "CANCELADO";
    }
  | { ok: false; error: string; nCodTitulo: number | null };

/**
 * Confirma na Omie se o título ainda está cobrável.
 * Fail-closed: erro de API / app ausente / sem código → não enviar.
 */
export async function verifyDueItemOpenLive(item: DueItem): Promise<LiveOpenCheck> {
  const nCodTitulo = tituloCodeFromDueItem(item);
  if (!nCodTitulo) {
    return {
      ok: false,
      error: "Sem código de título Omie para confirmar se está em aberto.",
      nCodTitulo: null,
    };
  }

  const app = listOmieApps().find((entry) => entry.id === item.omieAppId);
  if (!app) {
    return {
      ok: false,
      error: `App Omie não encontrado (${item.omieAppId}).`,
      nCodTitulo,
    };
  }

  try {
    const record = await fetchTituloLive(app, nCodTitulo);
    if (!record) {
      return {
        ok: true,
        open: false,
        status: "RECEBIDO",
        nCodTitulo,
        closedAs: "RECEBIDO",
      };
    }

    const interpreted = interpretTituloOpen(record);
    if (interpreted.open) {
      return { ok: true, open: true, status: interpreted.status, nCodTitulo };
    }
    return {
      ok: true,
      open: false,
      status: interpreted.status,
      nCodTitulo,
      closedAs: interpreted.closedAs,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao consultar título na Omie.",
      nCodTitulo,
    };
  }
}
