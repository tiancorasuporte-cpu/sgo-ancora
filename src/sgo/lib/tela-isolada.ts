/**
 * SGO Âncora — motor das telas "isoladas" (Leads, CRM, Orçamentos, Postos, Preços…).
 *
 * Essas telas foram escritas em JavaScript puro, para rodar numa página própria.
 * Aqui cada uma roda dentro de um componente React, num Shadow DOM (estilo isolado,
 * como era no iframe), com um "ambiente" que imita a página dela:
 *   - document  → procura e insere dentro da própria tela;
 *   - window    → variáveis próprias da tela (sem vazar para as outras);
 *   - location/history → endereço virtual da tela (ex.: /telas/crm?tab=rel);
 *   - parent/top → a casca do SGO (postMessage "alterou" / "ir");
 *   - setInterval/setTimeout/listeners → desfeitos ao sair da tela.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Ambiente = {
  document: any;
  window: any;
  self: any;
  location: any;
  history: any;
  parent: any;
  top: any;
  setInterval: typeof setInterval;
  setTimeout: typeof setTimeout;
  clearInterval: typeof clearInterval;
  clearTimeout: typeof clearTimeout;
  requestAnimationFrame: typeof requestAnimationFrame;
  MutationObserver: typeof MutationObserver;
};

export type MontarTela = (amb: Ambiente) => void;

/** Eventos que só existem no documento real. */
const SO_DOCUMENTO = new Set(["visibilitychange", "selectionchange", "fullscreenchange"]);

export function criarAmbiente(opts: {
  host: HTMLElement;
  raiz: ShadowRoot;
  corpo: HTMLElement;
  endereco: string; // ex.: /telas/crm?tab=rel
  navegar: (url: string) => void;
}) {
  const { host, raiz, corpo, navegar } = opts;
  const limpar: (() => void)[] = [];
  const timers = new Set<any>();
  const observers: MutationObserver[] = [];
  let url = new URL(opts.endereco, window.location.origin);

  /* ---- timers ---- */
  const _setInterval = ((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
    const id = window.setInterval(fn as any, ms, ...a);
    timers.add(id);
    return id;
  }) as typeof setInterval;
  const _setTimeout = ((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
    const id = window.setTimeout(fn as any, ms, ...a);
    timers.add(id);
    return id;
  }) as typeof setTimeout;
  const _clear = ((id: any) => {
    window.clearInterval(id);
    window.clearTimeout(id);
    timers.delete(id);
  }) as typeof clearInterval;

  class _MutationObserver extends MutationObserver {
    constructor(cb: MutationCallback) {
      super(cb);
      observers.push(this);
    }
  }

  /* ---- endereço virtual ---- */
  const location = {
    get href() {
      return url.href;
    },
    set href(v: string) {
      const alvo = new URL(v, url);
      if (alvo.origin === window.location.origin && alvo.pathname === url.pathname) url = alvo;
      else navegar(alvo.pathname + alvo.search + alvo.hash);
    },
    get search() {
      return url.search;
    },
    set search(v: string) {
      url.search = v;
    },
    get pathname() {
      return url.pathname;
    },
    get hash() {
      return url.hash;
    },
    get origin() {
      return url.origin;
    },
    get host() {
      return url.host;
    },
    get hostname() {
      return url.hostname;
    },
    get protocol() {
      return url.protocol;
    },
    assign(v: string) {
      location.href = v;
    },
    replace(v: string) {
      location.href = v;
    },
    reload() {
      window.location.reload();
    },
    toString() {
      return url.href;
    },
  };
  const history = {
    replaceState(_s: unknown, _t: string, u?: string | URL | null) {
      if (u != null) url = new URL(String(u), url);
    },
    pushState(_s: unknown, _t: string, u?: string | URL | null) {
      if (u != null) url = new URL(String(u), url);
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    go: (n?: number) => window.history.go(n),
    get length() {
      return window.history.length;
    },
    get state() {
      return null;
    },
  };

  /* ---- listeners ---- */
  function ouvirDocumento(tipo: string, fn: any, op?: any) {
    if (!fn) return;
    if (SO_DOCUMENTO.has(tipo)) {
      document.addEventListener(tipo, fn, op);
      limpar.push(() => document.removeEventListener(tipo, fn, op));
      return;
    }
    // dentro da tela: o evento chega pela raiz com o alvo real
    raiz.addEventListener(tipo, fn, op);
    // fora da tela (clicar fora, Esc com o foco na casca): o alvo é a própria página
    const fora = (e: Event) => {
      if (!e.composedPath().includes(host)) fn.call(docProxy, e);
    };
    document.addEventListener(tipo, fora, op);
    (fn as any).__sgoFora = fora;
    limpar.push(() => {
      raiz.removeEventListener(tipo, fn, op);
      document.removeEventListener(tipo, fora, op);
    });
  }
  function pararDocumento(tipo: string, fn: any, op?: any) {
    if (!fn) return;
    raiz.removeEventListener(tipo, fn, op);
    document.removeEventListener(tipo, fn, op);
    if (fn.__sgoFora) document.removeEventListener(tipo, fn.__sgoFora, op);
  }
  function ouvirJanela(tipo: string, fn: any, op?: any) {
    if (!fn) return;
    window.addEventListener(tipo, fn, op);
    limpar.push(() => window.removeEventListener(tipo, fn, op));
  }

  /* ---- document ---- */
  let titulo = "";
  const docExtra: Record<string, unknown> = {
    body: corpo,
    head: raiz,
    documentElement: corpo,
    querySelector: (s: string) => raiz.querySelector(s),
    querySelectorAll: (s: string) => raiz.querySelectorAll(s),
    getElementById: (id: string) => raiz.getElementById(id),
    getElementsByClassName: (c: string) => corpo.getElementsByClassName(c),
    getElementsByTagName: (t: string) => corpo.getElementsByTagName(t),
    addEventListener: ouvirDocumento,
    removeEventListener: pararDocumento,
    readyState: "complete",
  };
  const docProxy: any = new Proxy(document, {
    get(alvo, p) {
      if (p === "activeElement") return raiz.activeElement || document.activeElement;
      if (p === "title") return titulo;
      if (typeof p === "string" && p in docExtra) return docExtra[p];
      const v = Reflect.get(alvo, p);
      return typeof v === "function" ? v.bind(alvo) : v;
    },
    set(alvo, p, v) {
      if (p === "title") {
        titulo = String(v);
        return true;
      }
      return Reflect.set(alvo, p, v);
    },
  });

  /* ---- window ---- */
  const locais: Record<string | symbol, unknown> = {};
  const winExtra: Record<string, unknown> = {
    document: docProxy,
    location,
    history,
    parent: window,
    top: window,
    setInterval: _setInterval,
    setTimeout: _setTimeout,
    clearInterval: _clear,
    clearTimeout: _clear,
    MutationObserver: _MutationObserver,
    addEventListener: ouvirJanela,
    removeEventListener: (t: string, f: any, o?: any) => window.removeEventListener(t, f, o),
    print: () => imprimir(),
  };
  const winProxy: any = new Proxy(window, {
    get(alvo, p) {
      if (p === "window" || p === "self" || p === "globalThis") return winProxy;
      if (typeof p === "string" && p in winExtra) return winExtra[p];
      if (p in locais) return locais[p];
      const v = Reflect.get(alvo, p);
      // funções nativas (fetch, alert, getComputedStyle…) precisam do this = window
      return typeof v === "function" && !v.prototype ? v.bind(alvo) : v;
    },
    set(_alvo, p, v) {
      locais[p] = v;
      return true;
    },
    has(alvo, p) {
      return p in locais || p in winExtra || p in alvo;
    },
  });

  function imprimir() {
    document.documentElement.classList.add("sgo-imprimindo-tela");
    const fim = () => {
      document.documentElement.classList.remove("sgo-imprimindo-tela");
      window.removeEventListener("afterprint", fim);
    };
    window.addEventListener("afterprint", fim);
    window.print();
  }

  const amb: Ambiente = {
    document: docProxy,
    window: winProxy,
    self: winProxy,
    location,
    history,
    parent: window,
    top: window,
    setInterval: _setInterval,
    setTimeout: _setTimeout,
    clearInterval: _clear,
    clearTimeout: _clear,
    requestAnimationFrame: (cb: FrameRequestCallback) => window.requestAnimationFrame(cb),
    MutationObserver: _MutationObserver,
  };

  function desmontar() {
    timers.forEach((id) => {
      window.clearInterval(id);
      window.clearTimeout(id);
    });
    timers.clear();
    observers.forEach((o) => o.disconnect());
    limpar.splice(0).forEach((f) => {
      try {
        f();
      } catch {
        /* ok */
      }
    });
  }

  return { amb, desmontar };
}

/** Carrega uma biblioteca externa (jsPDF etc.) uma vez só, na página. */
const carregadas = new Map<string, Promise<void>>();
export function carregarScript(src: string) {
  let p = carregadas.get(src);
  if (!p) {
    p = new Promise<void>((ok, erro) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => erro(new Error("Falha ao carregar " + src));
      document.head.appendChild(s);
    });
    carregadas.set(src, p);
  }
  return p;
}
