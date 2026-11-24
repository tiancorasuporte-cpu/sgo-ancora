/**
 * SGO Âncora — acesso à API do SGO a partir das telas (mesmo contrato da casca original).
 * Toda escrita leva o cabeçalho `x-sgo: 1` (o servidor recusa sem ele).
 */
export type SgoEu = {
  id: number;
  login: string;
  nome: string;
  perfil: "superadmin" | "administrador" | "usuario" | "tecnico";
  admin: boolean;
  setor: string | null;
  setor_nome: string | null;
  equipe: string | null;
  permissoes: string[];
};

export type ItemMenu = {
  tipo?: "item";
  id: string;
  titulo: string;
  destino: "novo" | "em_breve" | "sgo_atual" | string;
  url: string | null;
  filhos?: ItemMenu[];
};
export type GrupoMenu = { tipo: "grupo"; id: string; titulo: string; ic?: string; itens: ItemMenu[] };
export type EntradaMenu = (ItemMenu & { tipo: "item" }) | GrupoMenu;

export function irParaLogin() {
  if (typeof window === "undefined") return;
  window.location.replace("/login?volta=" + encodeURIComponent(window.location.pathname + window.location.search));
}

export async function api<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-sgo": "1" },
    body: body ? JSON.stringify(body) : null,
  });
  if (r.status === 401) {
    irParaLogin();
    throw new Error("Sessão expirada.");
  }
  const d = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw new Error(d.erro || "Erro " + r.status);
  return d;
}

export function esc(v: unknown) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Aviso rápido no rodapé (mesmo visual do SGO). */
export function avisar(msg: string) {
  if (typeof document === "undefined") return;
  const t = document.createElement("div");
  t.className = "toast-app";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}
