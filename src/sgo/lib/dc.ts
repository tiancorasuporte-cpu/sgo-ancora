/**
 * SGO Âncora — motor das telas "dc" (Tickets e Quadro de OS) dentro do React.
 *
 * As telas guardam as regras numa classe de lógica (`logica.js`) com `state`,
 * `setState()` e `renderVals()`. Este módulo:
 *   - fornece os auxiliares usados pela marcação gerada (`E`, `s`, `t`, `css`...);
 *   - instala `window.DCLogic` e `window.SGO` (mesmo contrato do SGO original);
 *   - `useTelaDc()` carrega a coleção da API, sincroniza a cada 15 s e grava as
 *     alterações com controle de versão (409 = outra pessoa alterou).
 */
import { useEffect, useReducer, useRef } from "react";

import type { SgoEu } from "./api";

// Os documentos das telas (tickets, OS) têm formato livre, definido pela lógica original.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = any;

/* ---------------- auxiliares da marcação ---------------- */

export function E(v: unknown) {
  return !!v && v !== "false";
}
export function s(v: unknown) {
  return v == null ? "" : String(v);
}
export function t(v: unknown) {
  if (v == null || v === false) return "";
  if (typeof v === "object" && !Array.isArray(v)) return String(v);
  return v as string;
}
export function a(v: unknown) {
  return v == null ? "" : (v as string);
}
export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
export function fn(v: unknown) {
  return typeof v === "function" ? (v as (...x: unknown[]) => unknown) : undefined;
}
export function chave(item: unknown, i: number) {
  if (item && typeof item === "object" && "id" in (item as Obj)) {
    const id = (item as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return `${id}`;
  }
  return i;
}

const cssCache = new Map<string, Record<string, string>>();
/** Converte "a:b;c-d:e" em objeto de estilo do React (com cache). */
export function css(v: unknown): Record<string, string> | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "object") return v as Record<string, string>;
  const txt = String(v);
  const c = cssCache.get(txt);
  if (c) return c;
  const out: Record<string, string> = {};
  for (const dec of txt.split(";")) {
    const i = dec.indexOf(":");
    if (i < 0) continue;
    const prop = dec.slice(0, i).trim();
    const val = dec.slice(i + 1).trim();
    if (!prop) continue;
    const key = prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
    out[key] = val;
  }
  if (cssCache.size > 4000) cssCache.clear();
  cssCache.set(txt, out);
  return out;
}

/* ---------------- runtime global (mesmo contrato do SGO) ---------------- */

type Resp = Obj;

function replacer(k: string, v: unknown) {
  return k === "url" && typeof v === "string" && v.indexOf("blob:") === 0 ? null : v;
}

export function apiDc(method: string, url: string, body?: unknown): Promise<Resp> {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json", "x-sgo": "1" },
    body: body ? JSON.stringify(body, replacer) : null,
    credentials: "same-origin",
  }).then((r) => {
    if (r.status === 401) {
      window.location.replace("/login?volta=" + encodeURIComponent(window.location.pathname));
      throw new Error("Sessão expirada.");
    }
    if ((r.headers.get("content-type") || "").indexOf("json") < 0)
      throw new Error("Sessão expirada. Recarregue a página para entrar de novo.");
    return r.json().then((d: Obj) => Object.assign(d, { __status: r.status }) as Resp);
  });
}

function novoId(prefixo: string) {
  const e =
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefixo + "-" + e;
}
const p2 = (n: number) => (n < 10 ? "0" : "") + n;
function agoraTxt() {
  const d = new Date();
  return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
}

/** Avisa a casca (contador de tickets etc.) que algo mudou. */
export function avisarAlteracao() {
  window.dispatchEvent(new CustomEvent("sgo:alterou"));
}

function gravarNovo(colecao: string, dados: Obj) {
  dados.id = novoId(colecao === "os" ? "os" : "tk");
  return apiDc("PUT", "/api/" + colecao + "/" + dados.id, { versao: 0, dados }).then((r) => {
    if (r.__status !== 200) throw new Error((r.erro as string) || "falha ao gravar");
    avisarAlteracao();
    return (r.dados as { num: string }).num;
  });
}

class DCLogic<S = Obj> {
  props: Obj;
  state: S;
  __aoMudar?: () => void;
  constructor(props?: Obj) {
    this.props = props || {};
    this.state = {} as S;
  }
  setState(p: Partial<S> | ((s: S, pr: Obj) => Partial<S>), cb?: () => void) {
    const patch = typeof p === "function" ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state, patch);
    this.__aoMudar?.();
    cb?.();
  }
  forceUpdate() {
    this.__aoMudar?.();
  }
}

type AbrirOS = {
  tipo: string;
  sub?: string;
  orc?: string;
  cliente: string;
  cidade?: string;
  desc?: string;
  obs?: string;
  quem?: string;
  ticket?: string;
};

export function instalarRuntime() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Obj;
  if (!w.DCLogic) w.DCLogic = DCLogic;
  const atual = (w.SGO as Obj) || {};
  w.SGO = Object.assign(atual, {
    novoId,
    abrirOS(t: AbrirOS) {
      const ped = t.tipo === "pedido";
      const rot =
        t.tipo === "manut"
          ? "Manutenção · " + t.sub
          : t.tipo === "monit"
            ? "Monitoramento · " + t.sub
            : ped
              ? "Pedido aprovado · " + t.orc
              : "Orçamento · visita técnica";
      const desc = String(t.desc || "").replace(/\s+/g, " ").trim();
      const os = {
        num: "",
        tipo: t.tipo,
        sub: t.sub || null,
        orc: ped ? t.orc : null,
        cliente: t.cliente,
        cidade: t.cidade || "—",
        servico: desc.length > 140 ? desc.slice(0, 137) + "…" : desc || rot,
        stage: ped ? 0 : 3,
        agenda: "A agendar",
        tecnico: null,
        pending: null,
        ticket: t.ticket,
        obs: [String(t.desc || "").trim(), t.obs ? "Ao abrir a OS (" + (t.quem || "Assistência") + "): " + String(t.obs).trim() : ""]
          .filter(Boolean)
          .join("\n\n"),
        itens: ped ? [{ qtd: "1x", nome: "Itens conforme orçamento " + t.orc, st: "pendente", prev: "" }] : [],
        hist: [
          {
            quando: agoraTxt(),
            quem: "Assistência",
            acao:
              "OS aberta a partir do ticket " +
              t.ticket +
              " (" +
              rot +
              ")" +
              (ped ? "" : " · direto para agendamento") +
              (t.obs ? " · " + t.obs : ""),
          },
        ],
      };
      return gravarNovo("os", os);
    },
    abrirTicket(t: Obj) {
      const agora = new Date().toISOString();
      const tk = {
        num: "",
        cat: t.cat,
        cod: t.cod || "—",
        cli: t.cli,
        contato: t.contato || "—",
        prio: t.prio || "Normal",
        status: "aberto",
        setores: t.setores,
        por: t.por,
        criado: agora,
        resp: null,
        os: null,
        desc: t.desc,
        lev: t.lev || null,
        tl: [{ t: agora, quem: t.por, tipo: "abertura", titulo: t.tituloAbertura || "Ticket aberto", texto: "", anexos: [] }],
      };
      return gravarNovo("tickets", tk);
    },
  });
}

/* ---------------- hook da tela ---------------- */

type Logica = { new (p: Obj): Instancia };
type Instancia = DCLogic & {
  state: Obj;
  renderVals(): Obj;
  showToast?: (k: string, m: string) => void;
  componentWillUnmount?: () => void;
};
type Montar = (eu: SgoEu | null) => { Component: Logica; cfg: { colecao: string; chave: string; local?: string[] } };

type Estado = { fase: "carregando" | "erro" | "pronto"; erro?: string | undefined; vals?: Obj };

export function useTelaDc(montar: Montar, eu: SgoEu | null): Estado {
  const [, render] = useReducer((x: number) => x + 1, 0);
  const ref = useRef<{ n?: Instancia; erro?: string; ultimo?: Obj }>({});

  useEffect(() => {
    instalarRuntime();
    const { Component, cfg } = montar(eu);
    const ver: Record<string, number> = {};
    const gravando: Record<string, boolean> = {};
    const fila: Record<string, Obj> = {};
    let desde = 0;
    let anterior: unknown[] | null = null;
    let agendado = false;
    let vivo = true;
    const prefixo = "sgo." + cfg.colecao + ".";
    let timer: ReturnType<typeof setInterval> | null = null;

    const pedirRender = () => {
      if (agendado || !vivo) return;
      agendado = true;
      Promise.resolve().then(() => {
        agendado = false;
        if (vivo) render();
      });
    };
    const pintar = () => pedirRender();
    window.addEventListener("sgo:pintar", pintar);
    const aviso = (k: string, m: string) => ref.current.n?.showToast?.(k, m);

    function mesclar(docs: Obj[]) {
      const n = ref.current.n!;
      const lista = ((n.state[cfg.chave] as Obj[]) || []).slice();
      let mudou = false;
      for (const d of docs) {
        const i = lista.findIndex((x) => x.id === d.id);
        if (i >= 0) lista[i] = d;
        else lista.push(d);
        mudou = true;
      }
      if (mudou) {
        n.state = Object.assign({}, n.state, { [cfg.chave]: lista });
        anterior = lista;
        pedirRender();
      }
    }

    function salvar(doc: Obj) {
      const id = doc.id as string;
      if (gravando[id]) {
        fila[id] = doc;
        return;
      }
      gravando[id] = true;
      apiDc("PUT", "/api/" + cfg.colecao + "/" + id, {
        versao: ver[id] || 0,
        dados: doc,
        ...(cfg.colecao === "os"
          ? { papel_os: String((ref.current.n?.state?.role as string) || "") }
          : {}),
      })
        .then((r) => {
          if (r.__status === 200) {
            ver[id] = r.versao as number;
            const dados = r.dados as Obj;
            if (dados.num !== doc.num) {
              const atual = ((ref.current.n!.state[cfg.chave] as Obj[]) || []).find((x) => x.id === id);
              mesclar([Object.assign({}, atual || dados, { num: dados.num })]);
            }
            avisarAlteracao();
          } else if (r.__status === 409 && r.atual) {
            const atual = r.atual as { versao: number; dados: Obj };
            delete fila[id];
            ver[id] = atual.versao;
            mesclar([atual.dados]);
            aviso(
              "err",
              "Outra pessoa alterou o registro " +
                (atual.dados.num || "") +
                " ao mesmo tempo. Carreguei a versão mais recente: confira e refaça a última ação, se ainda for preciso.",
            );
          } else throw new Error((r.erro as string) || "erro " + r.__status);
        })
        .catch((e: Error) => {
          aviso("err", "Não foi possível salvar: " + e.message + " Vou tentar de novo em instantes.");
          if (!fila[id]) fila[id] = doc;
          return new Promise((ok) => setTimeout(ok, 5000));
        })
        .then(() => {
          gravando[id] = false;
          const prox = fila[id];
          if (prox) {
            delete fila[id];
            salvar(prox);
          }
        });
    }

    function aoMudar() {
      const n = ref.current.n!;
      const lista = n.state[cfg.chave] as Obj[];
      if (lista !== anterior && Array.isArray(lista)) {
        const antes = new Set(anterior || []);
        lista.forEach((d) => {
          if (!antes.has(d)) salvar(d);
        });
        anterior = lista;
      }
      for (const k of cfg.local || []) {
        try {
          localStorage.setItem(prefixo + k, JSON.stringify(n.state[k]));
        } catch {
          /* sem armazenamento local */
        }
      }
      pedirRender();
    }

    function sincronizar() {
      if (document.hidden || !vivo) return;
      apiDc("GET", "/api/" + cfg.colecao + "?desde=" + desde)
        .then((r) => {
          if (r.__status !== 200) return;
          desde = r.agora as number;
          const novos = (r.docs as { id: string; versao: number; dados: Obj }[])
            .filter((d) => {
              if (gravando[d.id] || fila[d.id] || (ver[d.id] && d.versao <= (ver[d.id] as number))) return false;
              ver[d.id] = d.versao;
              return true;
            })
            .map((d) => d.dados);
          if (novos.length) mesclar(novos);
        })
        .catch(() => undefined);
    }

    const w = window as unknown as { SGO: Obj };
    const pre =
      cfg.colecao === "os"
        ? apiDc("GET", "/api/equipes")
            .then((r) => {
              w.SGO.equipes = r.__status === 200 ? r : { tecnicos: [], auxiliares: [] };
            })
            .catch(() => {
              w.SGO.equipes = { tecnicos: [], auxiliares: [] };
            })
        : Promise.resolve();

    pre
      .then(() => apiDc("GET", "/api/" + cfg.colecao))
      .then((r) => {
        if (!vivo) return;
        if (r.__status !== 200) throw new Error((r.erro as string) || "erro " + r.__status);
        desde = r.agora as number;
        const docs = r.docs as { id: string; versao: number; dados: Obj }[];
        docs.forEach((d) => (ver[d.id] = d.versao));
        const n = new Component({});
        n.state[cfg.chave] = docs.map((d) => d.dados);
        for (const k of cfg.local || []) {
          try {
            const v = localStorage.getItem(prefixo + k);
            if (v != null) n.state[k] = JSON.parse(v);
          } catch {
            /* preferência inválida: fica o padrão */
          }
        }
        anterior = n.state[cfg.chave] as unknown[];
        n.__aoMudar = aoMudar;
        ref.current.n = n;
        render();
        timer = setInterval(sincronizar, 15000);
        document.addEventListener("visibilitychange", sincronizar);
      })
      .catch((e: Error) => {
        ref.current.erro = String(e.message);
        render();
      });

    return () => {
      vivo = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", sincronizar);
      window.removeEventListener("sgo:pintar", pintar);
      ref.current.n?.componentWillUnmount?.();
      ref.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = ref.current;
  if (r.erro) return { fase: "erro", erro: r.erro };
  if (!r.n) return { fase: "carregando" };
  try {
    r.ultimo = r.n.renderVals();
  } catch (e) {
    console.error(e);
  }
  return { fase: "pronto", vals: r.ultimo };
}
