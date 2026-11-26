import "@tanstack/react-start/server-only";

import { finishSyncLog, markStaleOpenDueItems, startSyncLog, closeNonOpenInvoiceDueItems } from "@/db/due-items";
import {
  formatOmieDate,
  listOmieApps,
  omiePaginate,
  parseOmieDate,
  type OmieAppConfig,
} from "@/server/omie/client";

import { clearClienteCache } from "@/server/omie/clients";
import { saveDueItemFromMovement, syncInvoiceDocuments } from "@/server/omie/invoice-sync";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncStageTimeoutMs() {
  const raw = process.env["OMIE_SYNC_STAGE_TIMEOUT_MS"]?.trim();
  const parsed = raw ? Number(raw) : 12 * 60_000;
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : 12 * 60_000;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timeout ${label} após ${Math.round(ms / 1000)}s`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function syncMovimentosFinanceiros(app: OmieAppConfig, from: Date, to: Date) {
  const fromStr = formatOmieDate(from);
  const toStr = formatOmieDate(to);

  const items = await omiePaginate<{
    nPagina?: number;
    nTotPaginas?: number;
    movimentos?: Record<string, unknown>[];
  }>(
    app,
    "/financas/mf/",
    "ListarMovimentos",
    (page) => ({
      nPagina: page,
      nRegPorPagina: 500,
      cNatureza: "R",
      cTpLancamento: "CR",
      dDtVencDe: fromStr,
      dDtVencAte: toStr,
    }),
    (response) => ({
      page: response.nPagina ?? 1,
      totalPages: response.nTotPaginas ?? 1,
      items: response.movimentos ?? [],
    }),
  );

  let count = 0;
  for (const raw of items) {
    const movimento = raw as Record<string, unknown>;
    const detalhes = (movimento["detalhes"] ?? movimento) as Record<string, unknown>;
    if (String(detalhes["cNatureza"] ?? "R").toUpperCase() !== "R") continue;
    if (await saveDueItemFromMovement(app, detalhes, { from, to })) count += 1;
  }

  return count;
}

async function syncContasReceber(app: OmieAppConfig, from: Date, to: Date) {
  const fromStr = formatOmieDate(from);
  const toStr = formatOmieDate(to);

  const items = await omiePaginate<{
    pagina?: number;
    total_de_paginas?: number;
    conta_receber_cadastro?: Record<string, unknown>[];
  }>(
    app,
    "/financas/contareceber/",
    "ListarContasReceber",
    (page) => ({
      pagina: page,
      registros_por_pagina: 100,
      filtrar_apenas_titulos_em_aberto: "S",
      filtrar_por_data_de: fromStr,
      filtrar_por_data_ate: toStr,
    }),
    (response) => ({
      page: response.pagina ?? 1,
      totalPages: response.total_de_paginas ?? 1,
      items: response.conta_receber_cadastro ?? [],
    }),
  );

  let count = 0;
  const openOmieCodes: number[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const boleto = (item["boleto"] as Record<string, unknown> | undefined) ?? {};
    const tipoDocumento = String(
      item["codigo_tipo_documento"] ?? item["cTipo"] ?? item["cCodTipoDocumento"] ?? "",
    )
      .trim()
      .toUpperCase();
    const mapped = {
      ...item,
      dDtVenc: item["dDtVenc"] ?? item["data_vencimento"],
      dDtEmissao: item["dDtEmissao"] ?? item["data_emissao"] ?? item["dDtEmis"],
      data_emissao: item["data_emissao"] ?? item["dDtEmissao"] ?? item["dDtEmis"],
      nCodTitulo: item["nCodTitulo"] ?? item["codigo_lancamento_omie"],
      nCodCliente: item["nCodCliente"] ?? item["codigo_cliente_fornecedor"],
      nValorTitulo: item["nValorTitulo"] ?? item["valor_documento"],
      cStatus: item["cStatus"] ?? item["status_titulo"] ?? "A VENCER",
      cNumBoleto: boleto["cNumBoleto"] ?? item["cNumBoleto"],
      // Omie lista costuma trazer codigo_tipo_documento=BOL mesmo com boleto.cGerado=N.
      cTipo: boleto["cGerado"] === "S" || tipoDocumento === "BOL" ? "BOL" : tipoDocumento || item["cTipo"],
      codigo_tipo_documento: tipoDocumento || item["codigo_tipo_documento"],
      chave_nfe: item["chave_nfe"],
      cChaveNFe: item["chave_nfe"],
      cNumDocFiscal: item["numero_documento_fiscal"] ?? item["cNumDocFiscal"],
      numero_documento_fiscal: item["numero_documento_fiscal"],
      numero_documento: item["numero_documento"],
      nCodOS: item["nCodOS"],
      id_origem: item["id_origem"],
      boleto,
    };
    const omieCode = Number(mapped.nCodTitulo ?? 0) || null;
    if (omieCode) openOmieCodes.push(omieCode);
    if (await saveDueItemFromMovement(app, mapped, { from, to })) count += 1;
  }

  const fromIso = parseOmieDate(fromStr) ?? fromStr;
  const toIso = parseOmieDate(toStr) ?? toStr;
  // Só fecha stale se a lista em aberto veio com sucesso (mesmo vazia = tudo quitado na janela).
  try {
    await markStaleOpenDueItems({
      omieAppId: app.id,
      from: fromIso,
      to: toIso,
      openOmieCodes,
    });
  } catch (error) {
    console.warn("[sync] falha ao fechar títulos stale", app.id, error);
  }

  return count;
}

function syncWindow(daysBack = 90, daysAhead = 120) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - daysBack);
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + daysAhead);
  return { from, to };
}

export type SyncProgress = {
  percent: number;
  label: string;
  appId?: string;
  appName?: string;
  appIndex?: number;
  appTotal?: number;
};

type SyncProgressHandler = (progress: SyncProgress) => void;

const STAGE_LABELS: Record<string, string> = {
  movimentos: "movimentos financeiros",
  contas_receber: "contas a receber",
  notas: "NFe/NFS-e",
};

export async function syncOmieApp(
  app: OmieAppConfig,
  daysBack = 90,
  daysAhead = 120,
  onStage?: (stage: string) => void,
) {
  const logId = await startSyncLog(app.id);
  clearClienteCache();
  const { from, to } = syncWindow(daysBack, daysAhead);
  const breakdown: Record<string, number> = {};
  const errors: string[] = [];

  const stageTimeoutMs = syncStageTimeoutMs();

  try {
    const tasks: Array<[string, (app: OmieAppConfig, from: Date, to: Date) => Promise<number>]> = [
      ["movimentos", syncMovimentosFinanceiros],
      ["contas_receber", syncContasReceber],
    ];

    for (const [name, fn] of tasks) {
      onStage?.(name);
      try {
        breakdown[name] = await withTimeout(fn(app, from, to), stageTimeoutMs, `${app.name}/${name}`);
        await sleep(1_500);
      } catch (error) {
        breakdown[name] = 0;
        errors.push(`${name}: ${error instanceof Error ? error.message : "erro"}`);
        console.warn("[sync] etapa falhou", app.id, name, error);
      }
    }

    onStage?.("notas");
    try {
      const invoiceResult = await withTimeout(
        syncInvoiceDocuments(app, from, to),
        stageTimeoutMs,
        `${app.name}/notas`,
      );
      breakdown.nfe = invoiceResult.nfe;
      breakdown.nfse = invoiceResult.nfse;
      errors.push(...invoiceResult.errors);
    } catch (error) {
      breakdown.nfe = 0;
      breakdown.nfse = 0;
      errors.push(`notas: ${error instanceof Error ? error.message : "erro"}`);
      console.warn("[sync] etapa falhou", app.id, "notas", error);
    }

    const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    await finishSyncLog(logId, total, errors.length ? errors.join(" | ") : null);
    console.info("[sync] app done", app.id, app.name, { total, errors: errors.length });
    return {
      ok: true as const,
      appId: app.id,
      appName: app.name,
      itemsFound: total,
      breakdown,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na sincronização";
    await finishSyncLog(logId, 0, message);
    console.error("[sync] app failed", app.id, app.name, message);
    return { ok: false as const, appId: app.id, appName: app.name, error: message };
  }
}

export async function syncAllOmieApps(
  daysBack = 90,
  daysAhead = 120,
  onProgress?: SyncProgressHandler,
) {
  const apps = listOmieApps();
  if (apps.length === 0) {
    return { ok: false as const, error: "Nenhum aplicativo Omie configurado no .env." };
  }

  const stagesPerApp = 3;
  const totalUnits = apps.length * stagesPerApp + 1; // +1 finalização
  let completedUnits = 0;

  const report = (label: string, app?: OmieAppConfig, appIndex?: number) => {
    const percent = Math.min(99, Math.round((completedUnits / totalUnits) * 100));
    onProgress?.({
      percent,
      label,
      appId: app?.id,
      appName: app?.name,
      appIndex: appIndex != null ? appIndex + 1 : undefined,
      appTotal: apps.length,
    });
  };

  report("Iniciando sincronização Omie...");

  const results = [];
  for (let index = 0; index < apps.length; index++) {
    const app = apps[index]!;
    if (index > 0) {
      report(`Aguardando próxima empresa (${app.name})...`, app, index);
      await sleep(3_000);
    }

    console.info("[sync] app start", app.id, app.name, `${index + 1}/${apps.length}`);
    results.push(
      await syncOmieApp(app, daysBack, daysAhead, (stage) => {
        completedUnits += 1;
        report(
          `${app.name}: ${STAGE_LABELS[stage] ?? stage} (${index + 1}/${apps.length})`,
          app,
          index,
        );
      }),
    );
  }

  report("Finalizando limpeza de títulos...");
  try {
    await closeNonOpenInvoiceDueItems();
  } catch (error) {
    console.warn("[sync] cleanup notas", error);
  }
  completedUnits = totalUnits;
  const failed = results.filter((r) => !r.ok || ("errors" in r && r.errors.length > 0));
  onProgress?.({
    percent: 100,
    label:
      failed.length > 0
        ? `Concluído com avisos (${failed.length}/${apps.length} empresa(s))`
        : "Sincronização concluída",
    appTotal: apps.length,
  });
  console.info("[sync] all apps done", {
    apps: apps.length,
    ok: results.filter((r) => r.ok).length,
    failed: failed.length,
  });
  return { ok: true as const, results };
}

/** Movimentos filtrados por data de emissão (não vencimento). */
async function syncMovimentosPorEmissao(app: OmieAppConfig, from: Date, to: Date) {
  const fromStr = formatOmieDate(from);
  const toStr = formatOmieDate(to);

  const items = await omiePaginate<{
    nPagina?: number;
    nTotPaginas?: number;
    movimentos?: Record<string, unknown>[];
  }>(
    app,
    "/financas/mf/",
    "ListarMovimentos",
    (page) => ({
      nPagina: page,
      nRegPorPagina: 500,
      cNatureza: "R",
      cTpLancamento: "CR",
      dDtEmisDe: fromStr,
      dDtEmisAte: toStr,
    }),
    (response) => ({
      page: response.nPagina ?? 1,
      totalPages: response.nTotPaginas ?? 1,
      items: response.movimentos ?? [],
    }),
  );

  let count = 0;
  for (const raw of items) {
    const movimento = raw as Record<string, unknown>;
    const detalhes = (movimento["detalhes"] ?? movimento) as Record<string, unknown>;
    if (String(detalhes["cNatureza"] ?? "R").toUpperCase() !== "R") continue;
    // Sem janela de vencimento: título faturado hoje pode vencer depois.
    if (await saveDueItemFromMovement(app, detalhes)) count += 1;
  }
  return count;
}

/**
 * Sync urgente: só o que foi faturado/emitido hoje (boletos + NFe/NFS-e) nas 3 empresas.
 * Não substitui o sync completo da tela de Vencimentos.
 */
export async function syncTodayFaturamento(onProgress?: SyncProgressHandler) {
  const apps = listOmieApps();
  if (apps.length === 0) {
    return { ok: false as const, error: "Nenhum aplicativo Omie configurado no .env." };
  }

  const { from, to } = syncWindow(0, 0);
  const totalUnits = apps.length * 2 + 1;
  let completedUnits = 0;

  const report = (label: string, app?: OmieAppConfig, appIndex?: number) => {
    const percent = Math.min(99, Math.round((completedUnits / totalUnits) * 100));
    onProgress?.({
      percent,
      label,
      appId: app?.id,
      appName: app?.name,
      appIndex: appIndex != null ? appIndex + 1 : undefined,
      appTotal: apps.length,
    });
  };

  report("Sync de hoje: iniciando...");
  const results = [];

  for (let index = 0; index < apps.length; index++) {
    const app = apps[index]!;
    if (index > 0) await sleep(2_000);
    clearClienteCache();
    const logId = await startSyncLog(app.id);
    const breakdown: Record<string, number> = {};
    const errors: string[] = [];

    try {
      completedUnits += 1;
      report(`${app.name}: boletos/movimentos emitidos hoje (${index + 1}/${apps.length})`, app, index);
      try {
        breakdown.movimentos = await withTimeout(
          syncMovimentosPorEmissao(app, from, to),
          syncStageTimeoutMs(),
          `${app.name}/emissao`,
        );
      } catch (error) {
        breakdown.movimentos = 0;
        errors.push(`movimentos: ${error instanceof Error ? error.message : "erro"}`);
      }

      completedUnits += 1;
      report(`${app.name}: NFe/NFS-e emitidas hoje (${index + 1}/${apps.length})`, app, index);
      try {
        const invoiceResult = await withTimeout(
          syncInvoiceDocuments(app, from, to, { enforceDueWindow: false }),
          syncStageTimeoutMs(),
          `${app.name}/notas-hoje`,
        );
        breakdown.nfe = invoiceResult.nfe;
        breakdown.nfse = invoiceResult.nfse;
        errors.push(...invoiceResult.errors);
      } catch (error) {
        breakdown.nfe = 0;
        breakdown.nfse = 0;
        errors.push(`notas: ${error instanceof Error ? error.message : "erro"}`);
      }

      const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
      await finishSyncLog(logId, total, errors.length ? errors.join(" | ") : null);
      console.info("[sync-hoje] app done", app.id, { total, breakdown, errors });
      results.push({
        ok: true as const,
        appId: app.id,
        appName: app.name,
        itemsFound: total,
        breakdown,
        errors,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na sincronização";
      await finishSyncLog(logId, 0, message);
      results.push({ ok: false as const, appId: app.id, appName: app.name, error: message });
    }
  }

  completedUnits = totalUnits;
  onProgress?.({ percent: 100, label: "Sync de hoje concluído", appTotal: apps.length });
  return { ok: true as const, results };
}
