import { useEffect, useState } from "react";

import { apiDc } from "@/sgo/lib/dc";

type Resumo = {
  id: string;
  num: string;
  cliente: string;
  cidade: string;
  servico: string;
  tecnico: string;
  tipo: string;
  sub: string;
  agenda: string;
  quando: number;
};

type Item = { qtd: string; nome: string; st: string };
type CheckItem = { rotulo: string; resultado: string; obs: string };
type Check = { nome: string; status: string; obs: string; itens: CheckItem[] };
type Hist = { quando: string; quem: string; acao: string };
type Detalhe = Resumo & {
  obs: string;
  subproblema: { nome: string; problema: string } | null;
  rel: { texto: string; fotos: string[]; assinatura: string; assinNome: string; por: string; quando: string };
  itens: Item[];
  checks: Check[];
  hist: Hist[];
};

const TIPOS: Record<string, string> = {
  pedido: "Instalação",
  manut: "Manutenção",
  monit: "Monitoramento",
  visita: "Visita técnica",
};

function quando(ms: number) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function HistoricoOs() {
  const [q, setQ] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [itens, setItens] = useState<Resumo[]>([]);
  const [os, setOs] = useState<Detalhe | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function buscar(extra?: { q?: string; de?: string; ate?: string }) {
    const busca = extra?.q ?? q;
    const inicio = extra?.de ?? de;
    const fim = extra?.ate ?? ate;
    setOcupado(true);
    setErro("");
    const params = new URLSearchParams();
    if (busca.trim()) params.set("q", busca.trim());
    if (inicio) params.set("de", inicio);
    if (fim) params.set("ate", fim);
    try {
      const r = await apiDc("GET", "/api/os/historico" + (params.toString() ? "?" + params.toString() : ""));
      if (r.__status !== 200) {
        setErro(String(r.erro || "Não foi possível buscar o histórico."));
        return;
      }
      setItens((r.itens as Resumo[]) || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível buscar o histórico.");
    } finally {
      setOcupado(false);
    }
  }

  function iso(d: Date) {
    const p = (n: number) => (n < 10 ? "0" : "") + n;
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function periodo(dias: number | "mes" | "tudo") {
    const hoje = new Date();
    let inicio = "";
    const fim = dias === "tudo" ? "" : iso(hoje);
    if (dias === "mes") {
      inicio = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    } else if (typeof dias === "number") {
      const d = new Date(hoje);
      d.setDate(d.getDate() - (dias - 1));
      inicio = iso(d);
    }
    setDe(inicio);
    setAte(fim);
    void buscar({ de: inicio, ate: fim });
  }

  function fechar() {
    setAberta(null);
    setOs(null);
  }

  async function abrir(id: string) {
    setAberta(id);
    setOs(null);
    setErro("");
    try {
      const r = await apiDc("GET", "/api/os/historico?id=" + encodeURIComponent(id));
      if (r.__status !== 200) {
        setErro(String(r.erro || "Não foi possível abrir a OS."));
        setAberta(null);
        return;
      }
      setOs(r.os as Detalhe);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a OS.");
      setAberta(null);
    }
  }

  useEffect(() => {
    if (!aberta) return;
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta]);

  useEffect(() => {
    void buscar({ q: "", de: "", ate: "" });
  }, []);

  const tipo = os ? TIPOS[os.tipo] || os.tipo : "";

  return (
    <div className="tela-os ck-pagina">
      <header className="ck-topo">
        <div>
          <div className="ck-kicker">Assistência técnica</div>
          <h1>Histórico de OS</h1>
          <p>OS finalizadas. Pesquise pelo número, cliente, cidade, técnico ou serviço.</p>
        </div>
        <a className="btn-ghost" href="/assistencia/os">
          Voltar ao quadro
        </a>
      </header>

      <form
        className="ck-card hist-busca"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <input className="field hist-q" value={q} placeholder="OS, cliente, cidade, técnico ou serviço" onChange={(e) => setQ(e.target.value)} />
        <div className="hist-periodo">
          <span>De</span>
          <input className="field" type="date" value={de} aria-label="Data inicial" onChange={(e) => setDe(e.target.value)} />
          <span>Até</span>
          <input className="field" type="date" value={ate} aria-label="Data final" onChange={(e) => setAte(e.target.value)} />
        </div>
        <button type="submit" className="btn-dark" disabled={ocupado}>
          {ocupado ? "Buscando…" : "Buscar"}
        </button>
        <div className="hist-atalhos">
          <button type="button" onClick={() => periodo(7)}>7 dias</button>
          <button type="button" onClick={() => periodo(30)}>30 dias</button>
          <button type="button" onClick={() => periodo("mes")}>Este mês</button>
          <button type="button" onClick={() => periodo("tudo")}>Tudo</button>
        </div>
      </form>

      {erro ? <div className="os-erro">{erro}</div> : null}

      <section className="ck-card">
        <h2>{itens.length === 0 ? "Nenhuma OS finalizada" : itens.length === 1 ? "1 OS finalizada" : itens.length + " OS finalizadas"}</h2>
        <div className="hist-lista">
          {itens.map((item) => (
            <button key={item.id} type="button" className={aberta === item.id ? "hist-linha hist-linha-on" : "hist-linha"} onClick={() => void abrir(item.id)}>
              <strong>OS {item.num}</strong>
              <span>{item.cliente}</span>
              <span className="os-mute">{[item.cidade, TIPOS[item.tipo] || item.tipo].filter(Boolean).join(" · ")}</span>
              <span className="os-mute">{item.tecnico || "—"}</span>
              <span className="os-mute">{quando(item.quando)}</span>
            </button>
          ))}
        </div>
      </section>

      {aberta ? (
        <div className="hist-modal" role="presentation" onClick={fechar}>
          <div className="hist-janela" role="dialog" aria-modal="true" aria-label={os ? "OS " + os.num : "OS"} onClick={(e) => e.stopPropagation()}>
            <header className="hist-topo">
              <div>
                <h2>{os ? "OS " + os.num : "Abrindo OS"}</h2>
                <p>{os ? os.cliente : "Carregando o atendimento…"}</p>
              </div>
              <button type="button" className="x-btn" onClick={fechar} aria-label="Fechar">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>
            <div className="hist-corpo">
              {!os ? <p className="os-mute">Carregando…</p> : null}
              {os ? (
                <>
                  <p className="os-mute">{[os.cidade, tipo, os.sub, os.servico].filter(Boolean).join(" · ")}</p>
                  <div className="hist-fatos">
                    <span>Técnico: {os.tecnico || "—"}</span>
                    <span>Agenda: {os.agenda || "—"}</span>
                    <span>Finalizada: {quando(os.quando) || "—"}</span>
                  </div>
                  {os.subproblema?.nome ? (
                    <p className="os-mute">
                      Problema: {os.subproblema.problema ? os.subproblema.problema + " · " : ""}
                      {os.subproblema.nome}
                    </p>
                  ) : null}
                  {os.obs ? (
                    <div>
                      <h3>Observação</h3>
                      <p className="z3m">{os.obs}</p>
                    </div>
                  ) : null}
                  <div>
                    <h3>Resolução</h3>
                    <p className="z3m">{os.rel.texto || "Sem texto de resolução."}</p>
                    {os.rel.por ? (
                      <p className="os-mute">
                        {os.rel.por}
                        {os.rel.quando ? " · " + os.rel.quando : ""}
                      </p>
                    ) : null}
                    {os.rel.fotos.length ? (
                      <div className="hist-fotos">
                        {os.rel.fotos.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="Foto da OS" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {os.rel.assinatura ? (
                      <div className="hist-assin">
                        <img src={os.rel.assinatura} alt="Assinatura do cliente" />
                        <span>{os.rel.assinNome || "Assinatura do cliente"}</span>
                      </div>
                    ) : null}
                  </div>
                  {os.itens.length ? (
                    <div>
                      <h3>Materiais</h3>
                      <ul className="hist-ul">
                        {os.itens.map((item, i) => (
                          <li key={item.nome + i}>
                            {item.qtd} {item.nome}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {os.checks.length ? (
                    <div>
                      <h3>Checklists</h3>
                      {os.checks.map((ch, i) => (
                        <div key={ch.nome + i} className="os-bloco">
                          <div className="os-head">
                            <strong>{ch.nome}</strong>
                            <span className={ch.status === "feito" ? "chip chip-ok" : "chip chip-warn"}>
                              {ch.status === "feito" ? "Preenchido" : "Pendente"}
                            </span>
                          </div>
                          {ch.obs ? <p className="z3m">{ch.obs}</p> : <p className="os-mute">Sem observação.</p>}
                          {ch.itens.map((it, j) => (
                            <p key={it.rotulo + j} className="os-mute">
                              {it.resultado ? it.resultado.toUpperCase() + " · " : ""}
                              {it.rotulo}
                              {it.obs ? " — " + it.obs : ""}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {os.hist.length ? (
                    <div>
                      <h3>Histórico</h3>
                      <ul className="hist-ul">
                        {os.hist.map((h, i) => (
                          <li key={h.quando + i}>
                            <span className="os-mute">{[h.quando, h.quem].filter(Boolean).join(" · ")}</span>
                            <div>{h.acao}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
