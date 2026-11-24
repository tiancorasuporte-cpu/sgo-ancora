/**
 * SGO Âncora — ligação entre o menu do SGO e as telas.
 */

/**
 * Itens que no SGO estavam "Em breve" e que já existem no sistema base:
 * o menu abre a tela do sistema base no lugar da página "Em breve".
 */
export const ROTA_DO_ITEM_BASE: Record<string, string> = {
  "cob-venc": "/vencimentos",
  "cob-notif": "/notificacoes",
  "cob-alertas": "/settings",
  "mon-contas": "/contratos",
  "op-facilities": "/facilities",
  "op-terceiros": "/terceiros",
  "op-uniformes": "/uniformes",
  "op-frota": "/frota",
};

/** Busca única do topo: campo de busca de cada tela do SGO que ela comanda. */
export const BUSCA_POR_ROTA: Record<string, string> = {
  "/tickets": "#tk-busca",
  "/assistencia/os": "#busca",
  "/assistencia/agenda": "#busca",
  "/assistencia/equipes": "#q",
  "/comercial/crm": "#fBusca",
  "/comercial/relatorios": "#fBusca",
  "/comercial/comissoes": "#fBusca",
  "/comercial/postos": "#l-busca",
  "/comercial/leads": "#busca",
  "/comercial/orcamentos": "#f-q",
  "/comercial/precos": "#q",
  "/operacoes/estoque": "#e-q",
  "/cadastros/parceiros": "#q",
  "/cadastros/produtos": "#q",
  "/cadastros/servicos": "#q",
  "/cadastros/maoobra": "#q",
  "/usuarios": "#u-q",
};
