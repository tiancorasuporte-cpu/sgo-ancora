import { useEffect, useState } from "react";

import { apiDc } from "@/sgo/lib/dc";

type Item = { id: string; rotulo: string; obrigatorio?: boolean; resultado?: string | null; obs?: string };
type Check = { id: string; checklistId?: string; nome: string; status?: string; obs?: string; itens?: Item[] };
type Modelo = { id: string; nome: string; ativo?: boolean; subproblemaIds?: string[]; itens: Item[] };
type Sub = { id: string; nome: string; ativo?: boolean; problema: string };
type Problema = { id: string; nome: string; ativo?: boolean; subs?: Array<{ id: string; nome: string; ativo?: boolean }> };

type Os = {
  id?: string;
  num?: string;
  stage?: number;
  co?: number | null;
  pausa?: { motivo?: string; por?: string } | null;
  subproblema?: { id?: string; nome?: string; problema?: string } | null;
  checks?: Check[];
  pausarCom?: (motivo: string) => void;
  retomar?: () => void;
  excluir?: () => void;
  definirSub?: (sub: Sub, cats: Modelo[]) => void;
  anexarCheck?: (cat: Modelo) => void;
  obsDoCheck?: (id: string, obs: string) => void;
  tirarCheck?: (id: string) => void;
  marcarCheck?: (ck: string, item: string, res: "ok" | "nok", obs?: string) => void;
};

function chamado<T>(v: unknown): T | null {
  return typeof v === "function" ? (v as T) : null;
}

export function ExcluirOs({ acao, num, stage }: { acao: unknown; num?: string; stage?: number }) {
  const [ok, setOk] = useState(false);
  const excluir = chamado<() => void>(acao);
  if (!excluir || Number(stage) >= 7) return null;
  if (!ok) {
    return (
      <button type="button" className="btn-exc" onClick={() => setOk(true)}>
        Excluir OS
      </button>
    );
  }
  return (
    <span className="os-row">
      <button type="button" className="btn-exc" onClick={() => excluir()}>
        Confirmar exclusão {num}
      </button>
      <button type="button" className="btn-exc-no" onClick={() => setOk(false)}>
        Cancelar
      </button>
    </span>
  );
}

export function OsCampo({ os }: { os: Os | null | undefined }) {
  const [motivo, setMotivo] = useState("");
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [problemaId, setProblemaId] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    apiDc("GET", "/api/checklists")
      .then((r) => {
        if (!vivo) return;
        if (r.__status !== 200) {
          setErro(String(r.erro || "Não foi possível carregar os checklists."));
          return;
        }
        setModelos((r.checklists as Modelo[]) || []);
        setProblemas((r.problemas as Problema[]) || []);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar os checklists.");
      });
    return () => {
      vivo = false;
    };
  }, [os?.id]);

  if (!os?.id) return null;
  const stage = Number(os.stage);
  const aberta = stage < 7;
  const emCampo = stage === 5 && !os.co;
  const checks = Array.isArray(os.checks) ? os.checks : [];
  const pausar = chamado<(motivo: string) => void>(os.pausarCom);
  const retomar = chamado<() => void>(os.retomar);
  const definir = chamado<(sub: Sub, cats: Modelo[]) => void>(os.definirSub);
  const anexar = chamado<(cat: Modelo) => void>(os.anexarCheck);
  const ativos = problemas.filter((p) => p.ativo !== false);
  const problema = ativos.find((p) => p.id === problemaId) || ativos.find((p) => (p.subs || []).some((s) => s.id === os.subproblema?.id));
  const subs = (problema?.subs || []).filter((s) => s.ativo !== false).map((s) => ({ id: s.id, nome: s.nome, problema: problema?.nome || "" }));
  const ligados = modelos.filter((m) => m.ativo !== false && os.subproblema?.id && (m.subproblemaIds || []).includes(os.subproblema.id));
  const jaTem = (id: string) => checks.some((ch) => ch.checklistId === id);

  function aplicarSub(sub: Sub) {
    if (!definir) return;
    const cats = modelos.filter((m) => m.ativo !== false && (m.subproblemaIds || []).includes(sub.id));
    definir(sub, cats.length === 1 ? cats : []);
  }
  const obsCheck = chamado<(id: string, obs: string) => void>(os.obsDoCheck);
  const tirar = chamado<(id: string) => void>(os.tirarCheck);
  const marcar = chamado<(ck: string, item: string, res: "ok" | "nok", obs?: string) => void>(os.marcarCheck);

  return (
    <div className="os-extra">
      {os.pausa ? (
        <div className="os-pausa">
          <strong>OS pausada</strong>
          <span>{os.pausa.motivo}</span>
          {os.pausa.por ? <span className="os-mute">por {os.pausa.por}</span> : null}
          {retomar ? (
            <button type="button" className="btn-dark" onClick={() => retomar()}>
              Retomar OS
            </button>
          ) : null}
        </div>
      ) : emCampo && pausar ? (
        <div className="os-pausa">
          <strong>Pausar OS</strong>
          <span className="os-mute">O técnico não faz check-in nem check-out enquanto a OS estiver pausada.</span>
          <input className="field" value={motivo} placeholder="Motivo da pausa" onChange={(e) => setMotivo(e.target.value)} />
          <button
            type="button"
            className="btn-dark"
            onClick={() => {
              pausar(motivo.trim());
              setMotivo("");
            }}
          >
            Pausar
          </button>
        </div>
      ) : null}

      {aberta ? (
        <div className="os-check">
          <div className="os-head">
            <h3 className="z36">Checklist</h3>
            <a className="btn-ghost" href="/assistencia/checklists">
              Configurar
            </a>
          </div>
          <p className="os-mute">
            Escolha o problema e o subproblema. Se houver um checklist vinculado, ele entra sozinho. Se houver mais de um, escolha qual vai na OS.
          </p>
          {erro ? <div className="os-erro">{erro}</div> : null}
          {definir ? (
            <div className="os-linha">
              <label className="os-mute">
                Problema
                <select
                  className="field"
                  value={problema?.id || ""}
                  onChange={(e) => {
                    setProblemaId(e.target.value);
                  }}
                >
                  <option value="">{ativos.length ? "Escolher problema…" : "Nenhum problema cadastrado"}</option>
                  {ativos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="os-mute">
                Subproblema
                <select
                  className="field"
                  value={subs.some((s) => s.id === os.subproblema?.id) ? os.subproblema?.id || "" : ""}
                  onChange={(e) => {
                    const sub = subs.find((s) => s.id === e.target.value);
                    if (sub) aplicarSub(sub);
                  }}
                >
                  <option value="">{problema ? "Escolher subproblema…" : "Escolha o problema antes"}</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {os.subproblema?.nome && ligados.length > 1 ? (
            <div className="os-row">
              <span className="os-mute">Checklists deste subproblema</span>
              {ligados.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={jaTem(m.id) ? "os-pill os-on-ok" : "os-pill"}
                  disabled={jaTem(m.id) || !anexar}
                  onClick={() => anexar?.(m)}
                >
                  {jaTem(m.id) ? m.nome + " na OS" : "Usar " + m.nome}
                </button>
              ))}
              {definir && ligados.some((m) => !jaTem(m.id)) ? (
                <button
                  type="button"
                  className="btn-ghost os-mini"
                  onClick={() => {
                    const sub = subs.find((s) => s.id === os.subproblema?.id);
                    if (sub) definir(sub, ligados);
                  }}
                >
                  Trazer todos
                </button>
              ) : null}
            </div>
          ) : null}
          {os.subproblema?.nome && ligados.length === 1 && jaTem(ligados[0].id) ? (
            <div className="os-mute">Checklist {ligados[0].nome} entrou pelo subproblema.</div>
          ) : null}
          {os.subproblema?.nome && ligados.length === 1 && !jaTem(ligados[0].id) && anexar ? (
            <button type="button" className="btn-dark" onClick={() => anexar(ligados[0])}>
              Usar {ligados[0].nome}
            </button>
          ) : null}
          {os.subproblema?.nome && !ligados.length ? (
            <div className="os-mute">Esse subproblema não tem checklist vinculado. Escolha um abaixo ou cadastre em Configurar.</div>
          ) : null}
          {anexar ? (
            <label className="os-mute">
              Ou escolher um checklist
              <select
                className="field"
                value=""
                onChange={(e) => {
                  const cat = modelos.find((m) => m.id === e.target.value);
                  if (cat) anexar(cat);
                }}
              >
                <option value="">Incluir um checklist…</option>
                {modelos
                  .filter((m) => m.ativo !== false && !jaTem(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {checks.length === 0 ? <div className="os-mute">Nenhum checklist nesta OS.</div> : null}
          {checks.map((ch) => (
            <div key={ch.id} className="os-bloco">
              <div className="os-head">
                <strong>{ch.nome}</strong>
                <span className={ch.status === "feito" ? "chip chip-ok" : "chip chip-warn"}>
                  {ch.status === "feito" ? "Preenchido" : "Pendente"}
                </span>
                {tirar && ch.status !== "feito" ? (
                  <button type="button" className="btn-ghost os-mini" onClick={() => tirar(ch.id)}>
                    Remover
                  </button>
                ) : null}
              </div>
              <label className="os-mute">
                Observação
                <textarea
                  className="field os-obs"
                  key={ch.id + ":" + (ch.obs || "")}
                  defaultValue={ch.obs || ""}
                  placeholder="O que foi visto neste checklist"
                  onBlur={(e) => obsCheck?.(ch.id, e.target.value)}
                />
              </label>
              {(ch.itens || []).map((it) => (
                <div key={it.id} className="os-item">
                  <div className="os-head">
                    <span>
                      {it.rotulo}
                      {it.obrigatorio === false ? <em className="os-mute"> · opcional</em> : null}
                    </span>
                    <span className="os-row">
                      <button
                        type="button"
                        className={it.resultado === "ok" ? "os-pill os-on-ok" : "os-pill"}
                        onClick={() => marcar?.(ch.id, it.id, "ok", it.obs || "")}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        className={it.resultado === "nok" ? "os-pill os-on-nok" : "os-pill"}
                        onClick={() => marcar?.(ch.id, it.id, "nok", it.obs || "")}
                      >
                        NOK
                      </button>
                    </span>
                  </div>
                  <input
                    className="field"
                    key={it.id + ":" + (it.obs || "")}
                    defaultValue={it.obs || ""}
                    placeholder="Observação do item"
                    onBlur={(e) => {
                      if (it.resultado === "ok" || it.resultado === "nok") marcar?.(ch.id, it.id, it.resultado, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

    </div>
  );
}
