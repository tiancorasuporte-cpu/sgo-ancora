import { useEffect, useMemo, useState } from "react";

import { apiDc } from "@/sgo/lib/dc";

type Item = { id: string; rotulo: string; obrigatorio: boolean };
type Sub = { id: string; nome: string; ativo: boolean };
type Problema = { id: string; nome: string; ativo: boolean; subs: Sub[] };
type Modelo = { id: string; nome: string; ativo: boolean; subproblemaIds: string[]; itens: Item[] };

const vazio = (): Modelo => ({
  id: "",
  nome: "",
  ativo: true,
  subproblemaIds: [],
  itens: [{ id: "i" + Math.random().toString(36).slice(2, 8), rotulo: "", obrigatorio: true }],
});

export function ChecklistConfig() {
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [checklists, setChecklists] = useState<Modelo[]>([]);
  const [nomeProblema, setNomeProblema] = useState("");
  const [nomeSub, setNomeSub] = useState("");
  const [problemaId, setProblemaId] = useState("");
  const [editProblema, setEditProblema] = useState<string | null>(null);
  const [editSub, setEditSub] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Modelo>(vazio);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function aplicar(r: { problemas?: Problema[]; checklists?: Modelo[] }) {
    setProblemas(r.problemas || []);
    setChecklists(r.checklists || []);
  }

  useEffect(() => {
    apiDc("GET", "/api/checklists")
      .then((r) => {
        if (r.__status === 200) aplicar(r as { problemas?: Problema[]; checklists?: Modelo[] });
        else setErro(String(r.erro || "Não foi possível carregar."));
      })
      .catch(() => setErro("Não foi possível carregar."));
  }, []);

  const atual = problemas.find((p) => p.id === problemaId) || problemas[0];
  const subs = useMemo(() => problemas.flatMap((p) => p.subs.map((s) => ({ ...s, problema: p.nome, problemaId: p.id }))), [problemas]);
  const achados = subs.filter((s) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (s.problema + " " + s.nome).toLowerCase().includes(q);
  });

  async function enviar(corpo: Record<string, unknown>) {
    setOcupado(true);
    setErro("");
    setMsg("");
    try {
      const r = await apiDc("POST", "/api/checklists", corpo);
      if (r.__status !== 200) {
        setErro(String(r.erro || "Não foi possível salvar."));
        return false;
      }
      aplicar(r as { problemas?: Problema[]; checklists?: Modelo[] });
      setMsg("Salvo.");
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="tela-os ck-pagina">
      <header className="ck-topo">
        <div>
          <div className="ck-kicker">Assistência técnica</div>
          <h1>Checklists</h1>
          <p>Crie o problema, os subproblemas e o checklist vinculado. Na OS, cada checklist pede uma observação.</p>
        </div>
        <a className="btn-ghost" href="/assistencia/os">
          Voltar ao quadro
        </a>
      </header>
      {erro ? <div className="os-erro">{erro}</div> : null}
      {msg ? <div className="ck-ok">{msg}</div> : null}
      <div className="ck-grade">
        <section className="ck-card">
          <h2>Problemas</h2>
          <p className="os-mute">O checklist se vincula ao subproblema, não ao problema.</p>
          <div className="ck-linha">
            <input
              className="field"
              value={nomeProblema}
              placeholder="Nome do problema"
              onChange={(e) => setNomeProblema(e.target.value)}
            />
            <button
              type="button"
              className="btn-dark"
              disabled={ocupado}
              onClick={() => {
                const nome = nomeProblema.trim();
                if (!nome) return;
                void enviar({ acao: "problema", id: editProblema || undefined, nome }).then((ok) => {
                  if (!ok) return;
                  setNomeProblema("");
                  setEditProblema(null);
                });
              }}
            >
              {editProblema ? "Salvar" : "Adicionar"}
            </button>
          </div>
          {problemas.map((p) => (
            <div key={p.id} className={atual?.id === p.id ? "ck-item ck-item-on" : "ck-item"}>
              <button type="button" className="ck-nome" onClick={() => setProblemaId(p.id)}>
                <strong>{p.nome}</strong>
                <span className="os-mute">{p.ativo ? "Ativo" : "Inativo"} · {p.subs.length} subproblema(s)</span>
              </button>
              <button
                type="button"
                className="btn-ghost os-mini"
                onClick={() => {
                  setEditProblema(p.id);
                  setNomeProblema(p.nome);
                }}
              >
                Editar
              </button>
              <button type="button" className="btn-ghost os-mini" disabled={ocupado} onClick={() => void enviar({ acao: "ativo", tipo: "problema", id: p.id, ativo: !p.ativo })}>
                {p.ativo ? "Desativar" : "Ativar"}
              </button>
            </div>
          ))}
          {atual ? (
            <div className="ck-subs">
              <h3>Subproblemas de {atual.nome}</h3>
              <div className="ck-linha">
                <input className="field" value={nomeSub} placeholder="Ex.: manutenção de cerca" onChange={(e) => setNomeSub(e.target.value)} />
                <button
                  type="button"
                  className="btn-dark"
                  disabled={ocupado}
                  onClick={() => {
                    const nome = nomeSub.trim();
                    if (!nome) return;
                    void enviar({ acao: "subproblema", id: editSub || undefined, problemaId: atual.id, nome }).then((ok) => {
                      if (!ok) return;
                      setNomeSub("");
                      setEditSub(null);
                    });
                  }}
                >
                  {editSub ? "Salvar" : "Adicionar"}
                </button>
              </div>
              {atual.subs.length === 0 ? <p className="os-mute">Nenhum subproblema ainda.</p> : null}
              {atual.subs.map((s) => (
                <div key={s.id} className="ck-item">
                  <div className="ck-nome">
                    <strong>{s.nome}</strong>
                    <span className="os-mute">{s.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost os-mini"
                    onClick={() => {
                      setEditSub(s.id);
                      setNomeSub(s.nome);
                      setProblemaId(atual.id);
                    }}
                  >
                    Editar
                  </button>
                  <button type="button" className="btn-ghost os-mini" disabled={ocupado} onClick={() => void enviar({ acao: "ativo", tipo: "problema", id: s.id, ativo: !s.ativo })}>
                    {s.ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="ck-card">
          <div className="os-head">
            <h2>Checklists</h2>
            <button type="button" className="btn-ghost" onClick={() => setForm(vazio())}>
              Novo
            </button>
          </div>
          <p className="os-mute">Itens com OK / Não OK. A observação é preenchida na OS e no aplicativo, em cada checklist.</p>
          <label className="os-mute">
            Nome do checklist
            <input className="field" value={form.nome} placeholder="Nome do checklist" onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="os-mute">
            Subproblemas vinculados
            <input className="field" value={busca} placeholder="Buscar subproblema para vincular…" onChange={(e) => setBusca(e.target.value)} />
          </label>
          <div className="ck-vinc">
            {form.subproblemaIds.map((id) => {
              const s = subs.find((x) => x.id === id);
              return (
                <button key={id} type="button" className="chip chip-ok" onClick={() => setForm({ ...form, subproblemaIds: form.subproblemaIds.filter((x) => x !== id) })}>
                  {(s ? s.problema + " · " + s.nome : id) + " ×"}
                </button>
              );
            })}
          </div>
          <div className="ck-busca">
            {achados.filter((s) => !form.subproblemaIds.includes(s.id)).slice(0, 8).map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn-ghost"
                onClick={() => setForm({ ...form, subproblemaIds: [...form.subproblemaIds, s.id] })}
              >
                {s.problema} · {s.nome}
              </button>
            ))}
          </div>
          <div className="os-mute">Itens</div>
          {form.itens.map((it, i) => (
            <div key={it.id} className="ck-linha">
              <input
                className="field"
                value={it.rotulo}
                placeholder={"Item " + (i + 1)}
                onChange={(e) => setForm({ ...form, itens: form.itens.map((x, n) => (n === i ? { ...x, rotulo: e.target.value } : x)) })}
              />
              <label className="chk">
                <input
                  type="checkbox"
                  checked={it.obrigatorio}
                  onChange={(e) => setForm({ ...form, itens: form.itens.map((x, n) => (n === i ? { ...x, obrigatorio: e.target.checked } : x)) })}
                />
                Obrigatório
              </label>
              <button type="button" className="btn-ghost os-mini" onClick={() => setForm({ ...form, itens: form.itens.filter((_, n) => n !== i) })}>
                ×
              </button>
            </div>
          ))}
          <div className="ck-linha">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setForm({ ...form, itens: [...form.itens, { id: "i" + Math.random().toString(36).slice(2, 8), rotulo: "", obrigatorio: true }] })}
            >
              + Item
            </button>
            <button
              type="button"
              className="btn-dark"
              disabled={ocupado}
              onClick={() =>
                void enviar({
                  acao: "checklist",
                  id: form.id || undefined,
                  nome: form.nome,
                  subproblemaIds: form.subproblemaIds,
                  itens: form.itens,
                }).then((ok) => {
                  if (ok) setForm(vazio());
                })
              }
            >
              Salvar checklist
            </button>
          </div>
          <div className="ck-lista">
            {checklists.map((c) => (
              <button key={c.id} type="button" className="ck-item" onClick={() => setForm({ ...c, itens: c.itens.map((it) => ({ ...it })) })}>
                <div className="ck-nome">
                  <strong>{c.nome}</strong>
                  <span className="os-mute">
                    {c.ativo ? "Ativo" : "Inativo"} · {c.itens.length} item(ns) · {c.subproblemaIds.length} vínculo(s)
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
