import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { api } from "@/sgo/lib/api";
import { exigirLogin } from "@/sgo/lib/guarda";

/** SGO Âncora — Painel (visão geral da operação, dados reais, atualiza a cada minuto). */
export const Route = createFileRoute("/painel")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: Painel,
});

const ETAPAS = ["OS aberta · pedido", "Em separação", "Compras", "Aguardando agendamento", "Agendado", "Em execução", "Executado", "Finalizado (semana)"];
const TIPOS: [string, string][] = [
  ["pedido", "Pedido · instalação"],
  ["manut", "Manutenção"],
  ["monit", "Monitoramento"],
  ["visita", "Orçamento (visita)"],
];

type Equipe = {
  nome: string;
  status: "local" | "execucao" | "agendada" | "livre" | string;
  hoje: number;
  atual?: { num: string; cliente: string; cidade?: string; ci?: number } | null;
  proxima?: { num: string; agDate?: string; periodo?: string; cidade?: string } | null;
};
type Dados = {
  gerado: number;
  os: {
    andamento: number;
    tipos: Record<string, number>;
    etapas: number[];
    parado: number[];
    tPedidoDias: number | null;
    tManutDias: number | null;
    finMes: number;
    finMesExtras: number;
    tempoLocal: Record<string, { min: number | null; n: number }>;
  };
  tickets: { abertos: number; mais24: number; urgentes: number; porSetor: { id: string; nome: string; n: number }[]; primeiroMin: number | null; mes: number; viraramOS: number };
  orcamentos: { salvos: number; enviados: number; aprovados: number; valorAprovado: number; mensalAprovado: number };
  estoque: { comSaldo: number; produtos: number; aComprar: number; paraSeparar: number; confPend: number; comEquipes: number; docsPend: number };
  compras: { atrasadas: number; aguardando: number };
  equipes: Equipe[];
  atencao: { cor: string; t: string; s: string; link: string }[];
  atencaoTotal: number;
  levantamentos: number;
};

const n = (v: number | null | undefined) => (v || 0).toLocaleString("pt-BR");
function brl(v: number) {
  v = v || 0;
  if (v >= 1e5) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dias(v: number | null) {
  if (v == null) return "—";
  if (v < 1) {
    const h = Math.round(v * 24);
    return h < 1 ? "menos de 1 h" : h + " h";
  }
  const d = Math.round(v * 10) / 10;
  return d.toLocaleString("pt-BR") + (d === 1 ? " dia" : " dias");
}
function mins(v: number | null) {
  if (v == null) return "—";
  v = Math.round(v);
  if (v < 60) return v + " min";
  const h = Math.floor(v / 60),
    m = v % 60;
  return h + " h" + (m ? " " + String(m).padStart(2, "0") : "");
}
const dm = (s?: string) => (s ? s.split("-").reverse().slice(0, 2).join("/") : "");
function hm(ms: number) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
const plural = (x: number, a: string, b: string) => x + " " + (x === 1 ? a : b);
const LINHA = { borderTop: "1px solid #EEEEEA", paddingTop: 12 } as const;

function Barra({ lbl, val, max, txt, amarela }: { lbl: ReactNode; val: number; max: number; txt: ReactNode; amarela?: boolean }) {
  const p = max ? Math.round((val / max) * 100) : 0;
  return (
    <>
      <span style={{ font: "500 13px Inter,sans-serif" }}>{lbl}</span>
      <div className="track">
        <div className={"fill" + (amarela ? " fill-y" : "")} style={{ width: p + "%" }} />
      </div>
      <span className="num" style={{ font: "700 13px Inter,sans-serif", textAlign: "right" }}>
        {txt}
      </span>
    </>
  );
}

function Mini({ lbl, val, sub, cor, tam }: { lbl: string; val: ReactNode; sub?: ReactNode; cor?: string | null; tam?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="flabel">{lbl}</span>
      <span style={{ font: `800 ${tam || 22}px 'Barlow Semi Condensed',sans-serif`, ...(cor ? { color: cor } : {}) }}>{val}</span>
      {sub ? <span className="kpi-s">{sub}</span> : null}
    </div>
  );
}

function Card({ titulo, link, lt, flex, children }: { titulo: string; link?: string; lt?: string; flex?: string; children: ReactNode }) {
  return (
    <section className="card" style={{ flex: flex || "1 1 340px", minWidth: 0, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 className="h2">{titulo}</h2>
        {link ? (
          <a className="lnk" href={link} data-link="">
            {lt}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Painel() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    const carregar = (primeira: boolean) =>
      api<Dados>("GET", "/api/painel")
        .then((x) => vivo && setD(x))
        .catch((e: Error) => primeira && vivo && setErro(e.message || ""));
    void carregar(true);
    const t = setInterval(() => void carregar(false), 60000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  if (erro && !d) return <div className="erro">Não foi possível carregar o Painel. {erro}</div>;
  if (!d) return <div className="loading">Carregando…</div>;

  const o = d.os,
    t = d.tickets,
    c = d.orcamentos,
    e = d.estoque;
  const eqCampo = d.equipes.filter((q) => q.status === "local" || q.status === "execucao").length;
  const eqLocal = d.equipes.filter((q) => q.status === "local").length;
  const eqCam = d.equipes.filter((q) => q.status === "execucao").length;
  const eqLivre = d.equipes.length - eqCampo;
  const conv = c.salvos ? Math.round((c.aprovados / c.salvos) * 100) : 0;
  const maxT = Math.max(...TIPOS.map((k) => o.tempoLocal[k[0]]?.min || 0)) || 1;
  const maxS = Math.max(...t.porSetor.map((s) => s.n)) || 1;
  const maxC = c.salvos || 1;

  return (
    <div className="page-painel" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{".page-painel .kpi{flex:1 1 150px}.page-painel .stage{min-width:70px}"}</style>
      <section aria-label="Indicadores principais" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className={"kpi" + (t.urgentes ? " kpi-alert" : "")}>
          <span className="flabel">Tickets abertos</span>
          <span className="kpi-v">{n(t.abertos)}</span>
          <span className="kpi-s">
            {n(t.mais24)} há mais de 24 h · {plural(t.urgentes, "urgente", "urgentes")}
          </span>
        </div>
        <div className="kpi">
          <span className="flabel">OS em andamento</span>
          <span className="kpi-v">{n(o.andamento)}</span>
          <span className="kpi-s">
            pedidos {o.tipos["pedido"]} · manutenção {o.tipos["manut"]} · monit. {o.tipos["monit"]} · orçamento {o.tipos["visita"]}
          </span>
        </div>
        <div className="kpi">
          <span className="flabel">Equipes em campo</span>
          <span className="kpi-v">
            {eqCampo} / {d.equipes.length}
          </span>
          <span className="kpi-s">
            {eqLocal} no local · {eqCam} a caminho · {plural(eqLivre, "livre", "livres")}
          </span>
        </div>
        <div className={"kpi" + (d.compras.atrasadas ? " kpi-alert" : "")}>
          <span className="flabel">Compras atrasadas</span>
          <span className="kpi-v">{n(d.compras.atrasadas)}</span>
          <span className="kpi-s">
            {d.compras.atrasadas ? "previsão vencida: confirmar chegada" : plural(d.compras.aguardando, "pedido aguardando entrega", "pedidos aguardando entrega")}
          </span>
        </div>
        <div className="kpi">
          <span className="flabel">Orçamentos no mês</span>
          <span className="kpi-v">{n(c.salvos)}</span>
          <span className="kpi-s">
            {plural(c.aprovados, "aprovado", "aprovados")} · {conv}% de conversão
          </span>
        </div>
        <div className="kpi">
          <span className="flabel">Contas monitoradas</span>
          <span className="kpi-v">0</span>
          <span className="kpi-s">integração com o Moni em breve</span>
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "stretch" }}>
        <Card titulo="Fluxo das OS · Assistência Técnica" link="/assistencia/os" lt="Abrir Quadro de OS" flex="2 1 640px">
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {ETAPAS.map((nome, i) => (
              <div key={i} className={"stage" + (i < 7 && o.parado[i] ? " stage-hot" : "")}>
                <span className="stage-n">{o.etapas[i]}</span>
                <span className="stage-l">{nome}</span>
              </div>
            ))}
          </div>
          <span style={{ font: "500 12px Inter,sans-serif", color: "#4A4A4A" }}>Contorno amarelo: etapas com OS paradas há mais de 2 dias.</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, ...LINHA }}>
            <Mini lbl="Tempo médio OS aberta → executada" val={dias(o.tPedidoDias)} sub="pedidos de instalação" tam={24} />
            <Mini lbl="Manutenção: abertura → execução" val={dias(o.tManutDias)} sub="meta: até 2 dias" tam={24} />
            <Mini lbl="OS finalizadas no mês" val={n(o.finMes)} sub={o.finMesExtras + " com itens adicionais"} tam={24} />
          </div>
        </Card>
        <Card titulo="Precisa de atenção" flex="1 1 360px">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {d.atencao.length ? (
              d.atencao.map((a, i) => (
                <a key={i} className="att" href={a.link} data-link="" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className={"dot " + (a.cor === "red" ? "d-red" : a.cor === "yel" ? "d-yel" : "d-blue")} aria-hidden="true" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ font: "600 13.5px Inter,sans-serif" }}>{a.t}</span>
                    <span className="kpi-s">{a.s}</span>
                  </div>
                </a>
              ))
            ) : (
              <p className="kpi-s" style={{ margin: "6px 0" }}>
                Nada pendente agora.
              </p>
            )}
            {d.atencaoTotal > d.atencao.length ? (
              <span className="kpi-s" style={{ paddingTop: 8 }}>
                + {d.atencaoTotal - d.atencao.length} outros itens
              </span>
            ) : null}
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "stretch" }}>
        <Card titulo="Equipes hoje" link="/assistencia/agenda" lt="Abrir Agenda" flex="2 1 640px">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {d.equipes.length ? (
              d.equipes.map((q, i) => {
                const pill =
                  q.status === "local" ? (
                    <span className="pill p-site">No local</span>
                  ) : q.status === "execucao" ? (
                    <span className="pill p-way">A caminho</span>
                  ) : q.status === "agendada" ? (
                    <span className="pill p-way">Agendada hoje</span>
                  ) : (
                    <span className="pill p-free">Livre</span>
                  );
                const l1 = q.atual ? "OS " + q.atual.num + " · " + q.atual.cliente : "Sem OS em execução";
                const l2 =
                  q.status === "local" && q.atual?.ci
                    ? "Check-in " + hm(q.atual.ci)
                    : q.atual
                      ? q.atual.cidade && q.atual.cidade !== "—"
                        ? q.atual.cidade
                        : "Em execução"
                      : plural(q.hoje, "OS agendada hoje", "OS agendadas hoje");
                const p = q.proxima;
                const l3 = p
                  ? (q.atual ? "Depois: " : "Próxima: ") + "OS " + p.num + " · " + dm(p.agDate) + (p.periodo ? " · " + p.periodo : "") + (p.cidade && p.cidade !== "—" ? " · " + p.cidade : "")
                  : "Sem outras OS agendadas";
                return (
                  <div key={i} className="eq">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ font: "700 15px Inter,sans-serif" }}>{q.nome}</span>
                      {pill}
                    </div>
                    <span style={{ font: "600 13px Inter,sans-serif" }}>{l1}</span>
                    <span className="kpi-s">{l2}</span>
                    <span className="kpi-s">{l3}</span>
                  </div>
                );
              })
            ) : (
              <p className="kpi-s">Nenhuma equipe técnica ativa.</p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, ...LINHA }}>
            <span className="flabel">Tempo médio no local por tipo de OS (mês)</span>
            <div style={{ display: "grid", gridTemplateColumns: "170px minmax(0,1fr) 80px", gap: "8px 12px", alignItems: "center" }}>
              {TIPOS.map((k) => {
                const v = o.tempoLocal[k[0]] || { min: 0, n: 0 };
                return <Barra key={k[0]} lbl={k[1]} val={v.min || 0} max={maxT} txt={v.n ? mins(v.min) : "—"} />;
              })}
            </div>
          </div>
        </Card>
        <Card titulo="Tickets abertos por setor" link="/tickets" lt="Abrir Tickets" flex="1 1 360px">
          <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr) 28px", gap: "10px 12px", alignItems: "center" }}>
            {t.porSetor.map((s) => (
              <Barra key={s.id} lbl={s.nome} val={s.n} max={maxS} txt={s.n} amarela />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, ...LINHA }}>
            <Mini lbl="1º atendimento" val={mins(t.primeiroMin)} sub="média da semana" />
            <Mini
              lbl="Viraram OS"
              val={t.mes ? Math.round((t.viraramOS / t.mes) * 100) + "%" : "—"}
              sub={t.mes ? t.viraramOS + " de " + t.mes + " tickets do mês" : "sem tickets no mês"}
            />
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "stretch" }}>
        <Card titulo="Comercial · orçamentos do mês" link="/comercial/orcamentos" lt="Abrir Orçamentos">
          <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr) 40px", gap: "10px 12px", alignItems: "center" }}>
            <Barra lbl="Salvos" val={c.salvos} max={maxC} txt={c.salvos} />
            <Barra lbl="Enviados" val={c.enviados} max={maxC} txt={c.enviados} />
            <Barra lbl="Aprovados" val={c.aprovados} max={maxC} txt={c.aprovados} amarela />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, ...LINHA }}>
            <Mini lbl="Valor aprovado" val={brl(c.valorAprovado)} sub={c.mensalAprovado ? "+ " + brl(c.mensalAprovado) + "/mês em serviços" : ""} />
            <Mini lbl="Levantados pelo técnico" val={n(d.levantamentos)} sub="aguardando o Comercial" />
          </div>
        </Card>
        <Card titulo="Monitoramento">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Mini lbl="Contas ativas" val="0" tam={26} />
            <Mini lbl="Câmeras offline" val="0" tam={26} />
            <Mini lbl="GPRS offline" val="0" tam={26} />
            <Mini lbl="Oscilando" val="0" tam={26} />
          </div>
          <div style={{ ...LINHA, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="flabel">Em breve</span>
            <span className="kpi-s">Os números do monitoramento entram quando o SGO for integrado ao Moni.</span>
          </div>
        </Card>
        <Card titulo="Estoque" link="/operacoes/estoque" lt="Abrir Estoque">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Mini lbl="Produtos com saldo" val={n(e.comSaldo)} sub={"de " + n(e.produtos) + " ativos"} tam={26} />
            <Mini lbl="Itens a comprar" val={n(e.aComprar)} sub="nas OS em andamento" cor={e.aComprar ? "#B3261E" : null} tam={26} />
            <Mini lbl="OS para separar" val={n(e.paraSeparar)} tam={26} />
            <Mini lbl="Conferências" val={n(e.confPend)} sub="aguardando o técnico" tam={26} />
          </div>
          <div style={{ ...LINHA, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="flabel">Estoque dos técnicos</span>
            <span className="kpi-s">
              {plural(e.comEquipes, "item", "itens")} com as equipes · {plural(e.docsPend, "retirada/devolução pendente", "retiradas/devoluções pendentes")}
            </span>
          </div>
        </Card>
      </div>
      <span className="kpi-s" style={{ textAlign: "right" }}>
        Atualizado às {hm(d.gerado)} · atualiza sozinho a cada minuto
      </span>
    </div>
  );
}
