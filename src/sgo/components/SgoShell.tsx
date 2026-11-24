/**
 * SGO Âncora — casca do sistema (faixa preta, menu lateral escuro, barra de busca e conta).
 * Mesma marcação, classes e comportamento da casca original (index.html + app.js).
 */
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { api, avisar, esc, type EntradaMenu, type GrupoMenu, type ItemMenu, type SgoEu } from "@/sgo/lib/api";
import { ICONES, ROTAS } from "@/sgo/lib/rotas";
import { BUSCA_POR_ROTA, ROTA_DO_ITEM_BASE } from "@/sgo/lib/telas";
import { PERMISSAO_DA_ROTA } from "@/sgo/lib/rotas";
import moduloUsuarios from "@/sgo/telas/usuarios/modulo.js?raw";
import moduloVoip from "@/sgo/telas/voip/modulo.js?raw";

/* ---------------- contextos ---------------- */

type Ctx = {
  eu: SgoEu | null;
  /** Define título/subtítulo da faixa preta para a tela atual. */
  definirTitulo: (titulo: string, sub?: string) => void;
  /** Busca única do topo (usada pelas telas do sistema base). */
  busca: string;
  setBusca: (v: string) => void;
  /** A tela atual pede a busca do topo com este texto de ajuda. */
  registrarBusca: (placeholder: string | null) => void;
  avisarAlteracao: () => void;
};

const SgoCtx = createContext<Ctx>({
  eu: null,
  definirTitulo: () => undefined,
  busca: "",
  setBusca: () => undefined,
  registrarBusca: () => undefined,
  avisarAlteracao: () => undefined,
});

export function useSgo() {
  return useContext(SgoCtx);
}

/* ---------------- auxiliares ---------------- */

function Icone({ id, tam = 18 }: { id: string; tam?: number }) {
  const d = ICONES[id];
  if (!d) return <span style={{ width: tam, flex: "none" }} />;
  return (
    <svg
      aria-hidden="true"
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

const Chev = () => (
  <svg className="chev" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Endereço de um item do menu (itens "Em breve" que já existem no sistema base abrem a tela dele). */
export function hrefDoItem(e: ItemMenu) {
  if (ROTA_DO_ITEM_BASE[e.id]) return ROTA_DO_ITEM_BASE[e.id]!;
  if ((e.destino === "novo" || e.destino === "sgo_atual") && e.url) return e.url;
  return "/em-breve/" + e.id;
}
function itemAtivo(e: ItemMenu) {
  return e.destino === "novo" || !!ROTA_DO_ITEM_BASE[e.id];
}
function caminhoDoHref(href: string) {
  return href.split("?")[0] || href;
}

function contem(e: ItemMenu, caminho: string): boolean {
  return (
    caminhoDoHref(hrefDoItem(e)) === caminho ||
    (e.filhos || []).some((f) => contem(f, caminho))
  );
}

/** Onde está a tela atual: Shadow DOM (telas isoladas), iframe ou a própria página. */
function docDaTela(): Document | ShadowRoot | null {
  const host = document.querySelector<HTMLElement>(".sgo-tela-host");
  if (host?.shadowRoot) return host.shadowRoot;
  const f = document.querySelector<HTMLIFrameElement>("iframe.frame");
  if (f) {
    try {
      return f.contentDocument;
    } catch {
      return null;
    }
  }
  return document;
}

function lerLocal<T>(k: string, padrao: T): T {
  try {
    const v = localStorage.getItem(k);
    return v == null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
}

/* ---------------- casca ---------------- */

export function SgoShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [eu, setEu] = useState<SgoEu | null>(null);
  const [menu, setMenu] = useState<EntradaMenu[] | null>(null);
  const [erroMenu, setErroMenu] = useState(false);
  const [tickets, setTickets] = useState<number | null>(null);
  const [mini, setMini] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [menuMovel, setMenuMovel] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [titulo, setTitulo] = useState<{ t: string; s: string }>({ t: "Painel", s: "Visão geral da operação" });
  const [busca, setBusca] = useState("");
  const [buscaTela, setBuscaTela] = useState<string | null>(null);
  const contaBtn = useRef<HTMLButtonElement>(null);

  // preferências do menu (só no navegador)
  useEffect(() => {
    setMini(String(lerLocal<unknown>("sgo.menu.mini", "0")) === "1");
    setAbertos(lerLocal<Record<string, boolean>>("sgo.menu.abertos", {}));
  }, []);
  useEffect(() => {
    document.body.classList.toggle("menu-mini", mini);
  }, [mini]);

  const carregarContadores = useCallback(() => {
    fetch("/api/contadores", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { tickets_abertos?: number | null }) => setTickets(d.tickets_abertos ?? null))
      .catch(() => undefined);
  }, []);

  // scripts do SGO que ainda rodam como estão: central de ajuda, Usuários e Ramais VoIP
  useEffect(() => {
    if (!eu) return;
    const w = window as unknown as Record<string, unknown>;
    w["SGO_APP"] = { api, avisar, esc };
    w["SGO_TELAS"] = w["SGO_TELAS"] || {};
    // módulos Usuários e Ramais VoIP (e o softphone flutuante): código original do SGO, executado uma vez
    if (!w["__sgoModulos"]) {
      w["__sgoModulos"] = true;
      for (const [nome, codigo] of [
        ["usuarios", moduloUsuarios],
        ["voip", moduloVoip],
      ] as const) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          new Function(codigo + "\n//# sourceURL=sgo-modulo-" + nome + ".js")();
        } catch (e) {
          console.error("[sgo] módulo " + nome, e);
        }
      }
    }
    // central de ajuda: conteúdo editável pelo administrador, servido da pasta de arquivos
    if (!document.querySelector('script[data-sgo="/ajuda/app.js"]')) {
      const sc = document.createElement("script");
      sc.src = "/ajuda/app.js";
      sc.defer = true;
      sc.setAttribute("data-sgo", "/ajuda/app.js");
      document.body.appendChild(sc);
    }
  }, [eu]);

  useEffect(() => {
    api<SgoEu>("GET", "/api/eu")
      .then((d) => {
        if (d.perfil === "tecnico") {
          location.replace("/app");
          throw new Error("técnico");
        }
        setEu(d);
        return api<{ menu: EntradaMenu[] }>("GET", "/api/menu");
      })
      .then((d) => setMenu(d.menu || []))
      .catch(() => setErroMenu(true));
    carregarContadores();
    const t = setInterval(carregarContadores, 60000);
    const ao = () => carregarContadores();
    window.addEventListener("sgo:alterou", ao);
    // telas ainda servidas pelo SGO (iframe) conversam com a casca por postMessage
    const msg = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.sgo === "alterou") carregarContadores();
      if (e.data.sgo === "ir" && typeof e.data.url === "string" && e.data.url[0] === "/" && e.data.url[1] !== "/") {
        void router.navigate({ href: e.data.url });
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("message", msg);
    return () => {
      clearInterval(t);
      window.removeEventListener("sgo:alterou", ao);
      window.removeEventListener("message", msg);
    };
  }, [carregarContadores, router]);

  // links internos com data-link (cards do Painel, páginas "Em breve"…) navegam sem recarregar
  useEffect(() => {
    const f = (e: globalThis.MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[data-link]") as HTMLAnchorElement | null;
      if (!a || a.target || a.origin !== location.origin || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      void router.navigate({ href: a.pathname + a.search });
      window.scrollTo(0, 0);
    };
    document.addEventListener("click", f);
    return () => document.removeEventListener("click", f);
  }, [router]);

  // sem acesso ao Painel: abre a primeira tela liberada (como na casca original)
  useEffect(() => {
    if (!eu || eu.admin || caminho !== "/painel" || eu.permissoes.includes("painel")) return;
    const alvo = Object.keys(PERMISSAO_DA_ROTA).find((r) => eu.permissoes.includes(PERMISSAO_DA_ROTA[r]!));
    if (alvo) void router.navigate({ href: alvo, replace: true });
  }, [eu, caminho, router]);

  // fecha o menu de celular e limpa a busca a cada troca de tela
  useEffect(() => {
    setMenuMovel(false);
    setBusca("");
  }, [caminho]);

  // título padrão da rota (a tela pode trocar com definirTitulo)
  const titulos = useMemo(() => {
    const m: Record<string, { titulo: string; grupo?: string }> = {};
    for (const g of menu || []) {
      if (g.tipo === "item") m[g.id] = { titulo: g.titulo };
      else
        for (const i of g.itens) {
          m[i.id] = { titulo: i.titulo, grupo: g.titulo };
          for (const f of i.filhos || []) m[f.id] = { titulo: f.titulo, grupo: g.titulo + " › " + i.titulo };
        }
    }
    return m;
  }, [menu]);

  useEffect(() => {
    const r = ROTAS[caminho];
    if (r) setTitulo({ t: r.titulo, s: r.sub });
    else if (caminho.startsWith("/em-breve/")) {
      const it = titulos[decodeURIComponent(caminho.slice(10))];
      setTitulo({ t: it ? it.titulo : "Em breve", s: it?.grupo ? it.grupo.split(" › ")[0]! : "SGO Âncora" });
    } else {
      const id = Object.keys(ROTA_DO_ITEM_BASE).find((k) => caminho === ROTA_DO_ITEM_BASE[k] || caminho.startsWith(ROTA_DO_ITEM_BASE[k] + "/"));
      const it = id ? titulos[id] : undefined;
      if (it) setTitulo({ t: it.titulo, s: it.grupo || "SGO Âncora" });
    }
  }, [caminho, titulos]);

  useEffect(() => {
    document.title = titulo.t + " · SGO Âncora";
  }, [titulo]);

  // conta: fecha ao clicar fora / Esc
  useEffect(() => {
    if (!contaAberta) return;
    const f = (e: Event) => {
      if (!(e.target as HTMLElement).closest(".conta")) setContaAberta(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setContaAberta(false);
    document.addEventListener("click", f);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("click", f);
      document.removeEventListener("keydown", k);
    };
  }, [contaAberta]);

  const navegar = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    void router.navigate({ href });
    window.scrollTo(0, 0);
  };

  const alternarMini = () => {
    const v = !mini;
    setMini(v);
    try {
      localStorage.setItem("sgo.menu.mini", v ? "1" : "0");
    } catch {
      /* ok */
    }
  };
  const alternarGrupo = (id: string, aberto: boolean) => {
    if (mini) {
      setMini(false);
      try {
        localStorage.setItem("sgo.menu.mini", "0");
      } catch {
        /* ok */
      }
      const n = { ...abertos, [id]: true };
      setAbertos(n);
      return;
    }
    const n = { ...abertos, [id]: !aberto };
    setAbertos(n);
    try {
      localStorage.setItem("sgo.menu.abertos", JSON.stringify(n));
    } catch {
      /* ok */
    }
  };

  const sair = () => {
    api("POST", "/api/logout")
      .catch(() => undefined)
      .then(() => location.replace("/login"));
  };

  /* ---------- busca única do topo ---------- */
  const seletor = BUSCA_POR_ROTA[caminho] || null;
  const temBusca = !!seletor || buscaTela !== null;
  const [placeholder, setPlaceholder] = useState("Buscar nesta tela…");

  useEffect(() => {
    if (!seletor) return;
    // liga a busca do topo ao campo de busca da própria tela (que fica oculto)
    const docAlvo = () => docDaTela();
    const t = setInterval(() => {
      const d = docAlvo();
      if (!d) return;
      const css = seletor + "{display:none!important}[data-sgo-busca-oculta]{display:none!important}";
      let st = d.getElementById("sgo-busca-oculta");
      if (!st) {
        st = document.createElement("style");
        st.id = "sgo-busca-oculta";
        if (d instanceof ShadowRoot) d.appendChild(st);
        else (d.head || d.body || d.documentElement).appendChild(st);
      }
      if (st.textContent !== css) st.textContent = css;
      const a = d.querySelector<HTMLInputElement>(seletor);
      if (a) {
        if (d !== document || a.closest("#page")) {
          const p = a.parentElement;
          if (p && p !== (d as Document).body && !p.hasAttribute("data-sgo-busca-oculta") && p.querySelectorAll("input,select,textarea,button").length === 1 && p.children.length <= 3)
            p.setAttribute("data-sgo-busca-oculta", "");
        }
        setPlaceholder(a.getAttribute("placeholder") || "Buscar nesta tela…");
      }
    }, 400);
    return () => clearInterval(t);
  }, [seletor, caminho]);

  const aplicarBusca = (valor: string, tecla?: string) => {
    if (!seletor) return;
    const d = docDaTela();
    const a = d?.querySelector<HTMLInputElement>(seletor);
    if (!a) return;
    // React controla o valor do campo: usa o setter nativo para disparar o onChange
    const proto = Object.getPrototypeOf(a) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (a.value !== valor) {
      if (setter) setter.call(a, valor);
      else a.value = valor;
    }
    if (tecla === "Enter") a.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    a.dispatchEvent(new Event("input", { bubbles: true }));
    a.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: tecla || "" }));
    a.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const ctx = useMemo<Ctx>(
    () => ({
      eu,
      definirTitulo: (t, s) => setTitulo({ t, s: s || "" }),
      busca,
      setBusca,
      registrarBusca: setBuscaTela,
      avisarAlteracao: carregarContadores,
    }),
    [eu, busca, carregarContadores],
  );

  /* ---------- menu ---------- */
  function linkItem(e: ItemMenu, nivel: 1 | 2 | 3): ReactNode {
    const href = hrefDoItem(e);
    const on = href === caminho || (ROTA_DO_ITEM_BASE[e.id] ? caminho.startsWith(href + "/") : false);
    const cls = "side-i" + (nivel === 2 ? " side-sub" : nivel === 3 ? " side-sub2" : "") + (on ? " side-on" : "");
    const t = tickets;
    return (
      <a
        key={e.id}
        className={cls}
        href={href}
        data-link=""
        title={e.titulo}
        aria-current={on ? "page" : undefined}
        {...(e.destino === "sgo_atual" ? { target: "_blank", rel: "noopener" } : {})}
        onClick={e.destino === "sgo_atual" ? undefined : (ev) => navegar(ev, href)}
      >
        <Icone id={e.id} tam={nivel === 1 ? 18 : 16} />
        <span className="lbl">{e.titulo}</span>
        {e.id === "tickets" && t != null ? (
          <span className={"cnt" + (t ? "" : " cnt-zero")} title={t + (t === 1 ? " ticket em aberto" : " tickets em aberto")}>
            {t}
          </span>
        ) : null}
        {itemAtivo(e) ? null : <span className="soon">Em breve</span>}
      </a>
    );
  }

  function itensComFilhos(e: ItemMenu, nivel: 1 | 2): ReactNode[] {
    const out: ReactNode[] = [linkItem(e, nivel)];
    for (const f of e.filhos || []) out.push(linkItem(f, 3));
    return out;
  }

  function grupo(g: GrupoMenu): ReactNode {
    const temAtivo = g.itens.some((i) => contem(i, caminho));
    // Preferência do usuário (localStorage) vence o auto-abrir por rota ativa.
    const aberto = !mini && (abertos[g.id] ?? temAtivo);
    return (
      <div key={g.id} className={"grp" + (aberto ? " open" : "") + (temAtivo ? " grp-on" : "")}>
        <button type="button" className="side-i" data-grp={g.id} aria-expanded={aberto ? "true" : "false"} title={g.titulo} onClick={() => alternarGrupo(g.id, !!aberto)}>
          <Icone id={g.ic || g.titulo} />
          <span className="lbl">{g.titulo}</span>
          <Chev />
        </button>
        <div className="subs">{g.itens.flatMap((i) => itensComFilhos(i, 2))}</div>
      </div>
    );
  }

  const iniciais =
    (eu?.nome || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "··";

  return (
    <SgoCtx.Provider value={ctx}>
      <div className="app">
        <div className="band">
          <a className="band-brand" href="/painel" data-link="" onClick={(e) => navegar(e, "/painel")}>
            <span className="logo-tile">
              <img src="/img/logo-sgo.png" alt="Âncora Segurança Patrimonial" />
            </span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ font: "800 20px 'Barlow Semi Condensed',sans-serif", textTransform: "uppercase", color: "#fff", lineHeight: 1 }}>SGO Âncora</span>
              <span style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".4px", color: "#BDBDBD", textTransform: "uppercase" }}>Gestão Operacional</span>
            </span>
          </a>
          <button className="side-toggle" type="button" aria-controls="menu" aria-expanded={menuMovel ? "true" : "false"} id="btn-menu" onClick={() => setMenuMovel(!menuMovel)}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </button>
          <div className="band-title">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h1 id="page-title">{titulo.t}</h1>
              <span className="sub" id="page-sub">
                {titulo.s}
              </span>
            </div>
            <span className="tag-env" title="Ambiente de teste">
              Ambiente de teste
            </span>
          </div>
        </div>

        <div className="body">
          <nav className={"side" + (menuMovel ? " show" : "")} id="menu" aria-label="Menu principal">
            {erroMenu ? (
              <div className="erro">Não foi possível carregar o menu.</div>
            ) : !menu ? (
              <div className="loading">Carregando menu…</div>
            ) : (
              <>
                <button type="button" className="side-i side-collapse" id="btn-encolher" aria-pressed={mini ? "true" : "false"} title={mini ? "Expandir menu" : "Encolher menu"} onClick={alternarMini}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
                  </svg>
                  <span className="lbl">{mini ? "Expandir" : "Encolher"}</span>
                </button>
                {menu.map((m) => {
                  if (m.tipo === "item" && !(m.filhos && m.filhos.length)) return linkItem(m, 1);
                  if (m.tipo === "item")
                    return grupo({ tipo: "grupo", id: "g-" + m.id, titulo: m.titulo, ic: m.id, itens: (m.filhos || []).map((f) => ({ ...f, filhos: [] })) });
                  return grupo(m);
                })}
              </>
            )}
          </nav>

          <div className="content">
            <header className="topbar">
              <div className="search" style={{ visibility: temBusca ? undefined : "hidden" }}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A5A5A" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <label htmlFor="g-busca" className="vh">
                  Buscar no sistema
                </label>
                <input
                  id="g-busca"
                  className="field"
                  type="search"
                  placeholder={seletor ? placeholder : buscaTela || "Buscar nesta tela…"}
                  style={{ paddingLeft: 36, background: "#F6F6F2", borderColor: "#E0E0DA" }}
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    aplicarBusca(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      aplicarBusca(busca, "Enter");
                    }
                    if (e.key === "Escape") {
                      setBusca("");
                      aplicarBusca("");
                    }
                  }}
                />
              </div>
              {/* preenchido pela central de ajuda (/ajuda/app.js) */}
              <button type="button" id="btn-ajuda" className="btn-ajuda" />
              <div className="conta">
                <button
                  ref={contaBtn}
                  type="button"
                  className="conta-btn"
                  id="conta-btn"
                  aria-haspopup="menu"
                  aria-expanded={contaAberta ? "true" : "false"}
                  aria-controls="conta-menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContaAberta(!contaAberta);
                  }}
                >
                  <span className="conta-txt">
                    <span id="usuario" className="conta-nome">
                      {eu ? eu.nome : "…"}
                    </span>
                    <span id="usuario-setor" className="conta-setor">
                      {eu ? (eu.perfil === "superadmin" ? "Super Admin" : eu.setor_nome || (eu.admin ? "Administrador" : "")) : ""}
                    </span>
                  </span>
                  <span className="avatar" id="avatar" aria-hidden="true">
                    {iniciais}
                  </span>
                </button>
                <div className="conta-menu" id="conta-menu" role="menu" hidden={!contaAberta}>
                  <button
                    type="button"
                    role="menuitem"
                    id="btn-senha"
                    onClick={() => {
                      setContaAberta(false);
                      setTrocarSenha(true);
                    }}
                  >
                    Trocar minha senha
                  </button>
                  <button type="button" role="menuitem" id="btn-sair" onClick={sair}>
                    Sair
                  </button>
                </div>
              </div>
            </header>
            <main className={"page" + (ROTAS[caminho]?.frame ? " page-frame" : "")} id="page" tabIndex={-1}>
              {!eu ? (
                <div className="loading">Carregando…</div>
              ) : PERMISSAO_DA_ROTA[caminho] && !eu.admin && !eu.permissoes.includes(PERMISSAO_DA_ROTA[caminho]!) ? (
                <SemAcesso />
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </div>
      {trocarSenha ? (
        <TrocarSenha
          fechar={() => {
            setTrocarSenha(false);
            contaBtn.current?.focus();
          }}
        />
      ) : null}
    </SgoCtx.Provider>
  );
}

export function SemAcesso() {
  return (
    <section className="soon-page">
      <span className="soon-badge" style={{ background: "#141414", color: "#FFD200" }}>
        Sem acesso
      </span>
      <h2>Você não tem acesso a esta tela</h2>
      <p>Se precisar dela no seu trabalho, peça ao administrador para liberar no cadastro de usuários.</p>
      <a className="btn-adv" href="/painel" data-link="" style={{ textDecoration: "none" }}>
        Voltar ao Painel
      </a>
    </section>
  );
}

function TrocarSenha({ fechar }: { fechar: () => void }) {
  const [erro, setErro] = useState("");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (nova !== conf) {
      setErro("A confirmação não confere com a nova senha.");
      return;
    }
    api("POST", "/api/eu/senha", { atual, nova })
      .then(() => {
        fechar();
        avisar("Senha alterada. As outras sessões abertas com o seu usuário foram encerradas.");
      })
      .catch((x: Error) => setErro(x.message));
  };
  return (
    <div className="modal-fundo" onClick={(e) => e.target === e.currentTarget && fechar()} onKeyDown={(e) => e.key === "Escape" && fechar()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ts-t" noValidate onSubmit={enviar}>
        <div className="modal-topo">
          <h2 id="ts-t">Trocar minha senha</h2>
          <button type="button" className="x-btn" aria-label="Fechar" onClick={fechar}>
            ×
          </button>
        </div>
        <div className="modal-corpo">
          <div className="erro-form" role="alert" hidden={!erro}>
            {erro}
          </div>
          <label className="flabel" htmlFor="ts-a">
            Senha atual
          </label>
          <input id="ts-a" className="field" type="password" autoComplete="current-password" autoFocus value={atual} onChange={(e) => setAtual(e.target.value)} />
          <label className="flabel" htmlFor="ts-n">
            Nova senha
          </label>
          <input id="ts-n" className="field" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
          <span className="dica">Mínimo de 8 caracteres, com letras e números.</span>
          <label className="flabel" htmlFor="ts-c">
            Repita a nova senha
          </label>
          <input id="ts-c" className="field" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />
        </div>
        <div className="modal-acoes">
          <button type="button" className="btn-ghost" onClick={fechar}>
            Cancelar
          </button>
          <button type="submit" className="btn-adv">
            Salvar nova senha
          </button>
        </div>
      </form>
    </div>
  );
}
