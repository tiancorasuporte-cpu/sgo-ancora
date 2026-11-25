/**
 * QuadroOs — marcação da tela (gerada a partir do template original do SGO, sem alterações de layout).
 * Os valores vêm de `renderVals()` da lógica da tela (ver logica.js).
 */
/* eslint-disable */
// @ts-nocheck
import { Fragment, useState } from "react";

import { E, a, arr, chave, css, fn, s, t } from "@/sgo/lib/dc";
import { ligarComplementosOs } from "@/sgo/telas/os/complementos";
import { GeoLinha } from "@/sgo/telas/os/GeoLinha";
import { ExcluirOs, OsCampo } from "@/sgo/telas/os/OsCampo";

ligarComplementosOs();

type FiltroCol = { aberto: boolean; nome: string; de: string; ate: string };
const FILTRO_VAZIO: FiltroCol = { aberto: false, nome: "", de: "", ate: "" };

function passaCard(card: any, filtro: FiltroCol) {
  const nome = filtro.nome.trim().toLocaleLowerCase();
  if (nome) {
    const texto = [card?.num, card?.cliente, card?.servico, card?.cidade, card?.tecnico]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    if (!texto.includes(nome)) return false;
  }
  if (filtro.de || filtro.ate) {
    const dia = String(card?.agDate || "");
    if (!dia) return false;
    if (filtro.de && dia < filtro.de) return false;
    if (filtro.ate && dia > filtro.ate) return false;
  }
  return true;
}

export function QuadroOsView({ v }: { v: any }) {
  const [filtros, setFiltros] = useState<Record<string, FiltroCol>>({});
  const mudarFiltro = (id: string, patch: Partial<FiltroCol>) => {
    setFiltros((atual) => ({ ...atual, [id]: { ...(atual[id] || FILTRO_VAZIO), ...patch } }));
  };
  return (
    <div className="tela-os">
      <div className={"z0"}>
        <header className={"z1"}>
          <div className={"z2"}>
            <div className={"z3"}>
              {"Ordens de serviço · pedidos aprovados, manutenções, monitoramento e orçamentos"}
            </div>
            <div className={"z4"}>
              <div className={"z5"}>
                <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#5A5A5A"} strokeWidth={"2"} strokeLinecap={"round"} className={"z6"}>
                  <circle cx={"11"} cy={"11"} r={"7"} />
                  <path d={"M20 20l-3.5-3.5"} />
                </svg>
                <label htmlFor={"busca"} className={"z7"}>
                  {"Buscar OS ou cliente"}
                </label>
                <input id={"busca"} className={"search"} type={"search"} placeholder={"Buscar OS, cliente ou cidade"} onChange={fn(v["onSearch"])} />
              </div>
              <a className={"btn-ghost"} href={"/assistencia/historico"}>
                {"Histórico"}
              </a>
              <a className={"btn-ghost"} href={"/assistencia/checklists"}>
                {"Checklists"}
              </a>
              <span className={"z8"}>
                {"Gravando no banco de teste"}
              </span>
            </div>
          </div>
        </header>
        <div className={"z9"}>
          <div className={"za"}>
            {E(v["showRoles"]) ? (
              <>
                <div className={"z4"}>
                  <span className={"zb"}>
                    {"Visualizando como"}
                  </span>
                  <div role={"group"} aria-label={"Perfil do usuário"} className={"zc"}>
                    {arr(v["roles"]).map((_r1: any, _i1: number) => (
                      <Fragment key={chave(_r1, _i1)}>
                          <button className={a(_r1?.["cls"])} aria-pressed={a(_r1?.["pressed"])} onClick={fn(_r1?.["pick"])}>
                            {t(_r1?.["name"])}
                          </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {E(v["showEu"]) ? (
              <>
                <div className={"z4"}>
                  <span className={"zb"}>
                    {"Logado como"}
                  </span>
                  <span style={css("font-weight:700;color:#FFD200")}>
                    {t(v["euTxt"])}
                  </span>
                </div>
              </>
            ) : null}
            <div className={"zd"}>
              {t(v["roleHint"])}
            </div>
          </div>
        </div>
        <nav aria-label={"Telas"} className={"ze"}>
          <div className={"zf"}>
            <button className={a(v["tabKanbanCls"])} aria-pressed={a(v["tabKanbanOn"])} onClick={fn(v["goKanban"])}>
              <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                <rect x={"3"} y={"4"} width={"5"} height={"16"} rx={"1"} />
                <rect x={"10"} y={"4"} width={"5"} height={"11"} rx={"1"} />
                <rect x={"17"} y={"4"} width={"4"} height={"7"} rx={"1"} />
              </svg>
              {" Quadro de OS"}
            </button>
            <button className={a(v["tabAgendaCls"])} aria-pressed={a(v["tabAgendaOn"])} onClick={fn(v["goAgenda"])}>
              <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                <rect x={"3"} y={"5"} width={"18"} height={"16"} rx={"2"} />
                <path d={"M3 10h18M8 3v4M16 3v4"} />
              </svg>
              {" Agendamento "}
              <span className={"tab-count"}>
                {t(v["agendaCount"])}
              </span>
            </button>
            <a className={"tab zg"} href={"/tickets"} target={"_top"}>
              <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"}>
                <path d={"M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"} />
              </svg>
              {" Central de Tickets"}
            </a>
          </div>
        </nav>
        {E(v["showApprovals"]) ? (
          <>
            <div className={"zh"}>
              <div className={"zi"}>
                <div className={"zj"}>
                  <svg aria-hidden={"true"} width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#141414"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                    <rect x={"4"} y={"10"} width={"16"} height={"11"} rx={"2"} />
                    <path d={"M8 10V7a4 4 0 0 1 8 0v3"} />
                  </svg>
                  <h2 className={"zk"}>
                    {t(v["approvalsTitle"])}
                  </h2>
                </div>
                <div className={"zl"}>
                  {arr(v["approvals"]).map((_ap2: any, _i2: number) => (
                    <Fragment key={chave(_ap2, _i2)}>
                        <div className={"zm"}>
                          <div className={"zn"}>
                            <span className={"zo"}>
                              {t(("OS " + s(_ap2?.["num"]) + " · " + s(_ap2?.["cliente"])))}
                            </span>
                            <span className={"zp"}>
                              {t(("Voltar de “" + s(_ap2?.["fromName"]) + "” para “" + s(_ap2?.["toName"]) + "”"))}
                            </span>
                            <span className={"zq"}>
                              {t(("Motivo: " + s(_ap2?.["motivo"])))}
                            </span>
                            <span className={"zr"}>
                              {t(("Solicitado por " + s(_ap2?.["by"]) + " · " + s(_ap2?.["quando"])))}
                            </span>
                          </div>
                          <div className={"zs"}>
                            <button className={"btn-ghost"} onClick={fn(_ap2?.["reject"])}>
                              {"Recusar"}
                            </button>
                            <button className={"btn-dark"} onClick={fn(_ap2?.["approve"])}>
                              {"Aprovar retorno"}
                            </button>
                          </div>
                        </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["isKanban"]) ? (
          <>
            <main className={"zt"}>
              <div className={"zu"}>
                <div className={"zv"}>
                  <span className={"flabel"}>
                    {"Tipo de OS"}
                  </span>
                  <div className={"seg zw"} role={"group"} aria-label={"Filtrar por tipo de OS"}>
                    {arr(v["tipoFilters"]).map((_tf3: any, _i3: number) => (
                      <Fragment key={chave(_tf3, _i3)}>
                          <button className={a(_tf3?.["cls"])} aria-pressed={a(_tf3?.["on"])} onClick={fn(_tf3?.["pick"])}>
                            {t(_tf3?.["label"])}
                          </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div style={css("display:flex;gap:8px;flex-wrap:wrap;align-items:center")}>
                  <button className={"btn-ghost"} disabled={E(v["syncingOmie"])} onClick={fn(v["onSyncCli"])}>
                    {t(v["syncCliLabel"] || "Sync clientes")}
                  </button>
                  <button className={"btn-ghost"} disabled={E(v["syncingOmie"])} onClick={fn(v["onSyncProd"])}>
                    {t(v["syncProdLabel"] || "Sync produtos")}
                  </button>
                  {E(v["canNewOs"]) ? (
                    <>
                      <button className={"btn-adv zx"} onClick={fn(v["openNewOs"])}>
                        <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.6"} strokeLinecap={"round"}>
                          <path d={"M12 5v14M5 12h14"} />
                        </svg>
                        {" Nova OS"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className={"zy"}>
                <span >
                  {"Cada cartão é uma OS: pedido aprovado (segue separação e compras) ou manutenção (vai direto para o agendamento). Arraste para a próxima etapa ou use o botão do cartão. Cada etapa só sai do lugar pelo setor responsável, destacado em amarelo. Para voltar um cartão, arraste para uma coluna anterior: o Administrador volta direto; os demais setores precisam da aprovação dele."}
                </span>
              </div>
              {E(v["hasLate"]) ? (
                <>
                  <div role={"alert"} className={"zz"}>
                    <div className={"z10"}>
                      <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                        <path d={"M12 3l10 18H2z"} />
                        <path d={"M12 10v5M12 18v.5"} />
                      </svg>
                      <span className={"z11"}>
                        {t(v["lateTitle"])}
                      </span>
                      <span className={"z12"}>
                        {"Confirme se o material chegou. O Estoque dá entrada na OS e ela volta para a Separação."}
                      </span>
                    </div>
                    <div className={"z13"}>
                      {arr(v["lateItems"]).map((_li4: any, _i4: number) => (
                        <Fragment key={chave(_li4, _i4)}>
                            <button className={"alert-row"} onClick={fn(_li4?.["open"])}>
                              <span className={"z14"}>
                                {t(("OS " + s(_li4?.["num"])))}
                              </span>
                              <span >
                                {t((s(_li4?.["qtd"]) + " " + s(_li4?.["nome"])))}
                              </span>
                              <span className={"z15"}>
                                {t(_li4?.["when"])}
                              </span>
                            </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              <div className={"z16"}>
                <div className={"z17"}>
                  {arr(v["cols"]).map((_col5: any, _i5: number) => {
                    const fid = String(_col5?.["step"] ?? _i5);
                    const filtro = filtros[fid] || FILTRO_VAZIO;
                    const filtrando = !!(filtro.nome.trim() || filtro.de || filtro.ate);
                    const visiveis = arr(_col5?.["lanes"]).reduce((n: number, lane: any) => n + arr(lane?.["cards"]).filter((card: any) => passaCard(card, filtro)).length, 0);
                    return (
                    <Fragment key={chave(_col5, _i5)}>
                        <section className={a((s(_col5?.["cls"]) + " z18"))} aria-label={a(_col5?.["name"])} onDragOver={fn(_col5?.["onDragOver"])} onDrop={fn(_col5?.["onDrop"])}>
                          <div className={"col-bar"}>
                          </div>
                          <div className={"z19"}>
                            <div className={"z1a"}>
                              <h2 className={"z1b"}>
                                {t((s(_col5?.["step"]) + ". " + s(_col5?.["name"])))}
                              </h2>
                              <span style={css("display:flex;align-items:center;gap:6px")}>
                                <button
                                  type={"button"}
                                  className={a("col-filt" + (filtro.aberto || filtrando ? " on" : ""))}
                                  aria-label={"Filtrar esta coluna"}
                                  aria-expanded={filtro.aberto}
                                  onClick={() => mudarFiltro(fid, { aberto: !filtro.aberto })}
                                >
                                  <svg aria-hidden={"true"} width={"15"} height={"15"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                                    <path d={"M4 5h16l-6 7v6l-4 2v-8z"} />
                                  </svg>
                                </button>
                                <span className={"col-badge z1c"}>
                                  {t(filtrando ? visiveis : _col5?.["count"])}
                                </span>
                              </span>
                            </div>
                            <div className={"z1d"}>
                              {t(_col5?.["hint"])}
                            </div>
                            <div className={"z1e"}>
                              <svg aria-hidden={"true"} width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                <circle cx={"12"} cy={"8"} r={"4"} />
                                <path d={"M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"} />
                              </svg>
                              <span >
                                {t(_col5?.["moverLabel"])}
                              </span>
                            </div>
                            {filtro.aberto ? (
                              <div className={"col-filtro"}>
                                <label>
                                  {"Nome"}
                                  <input
                                    type={"search"}
                                    value={filtro.nome}
                                    placeholder={"Cliente, OS ou cidade"}
                                    onChange={(e) => mudarFiltro(fid, { nome: e.target.value })}
                                  />
                                </label>
                                <label>
                                  {"De"}
                                  <input
                                    type={"date"}
                                    value={filtro.de}
                                    onChange={(e) => mudarFiltro(fid, { de: e.target.value })}
                                  />
                                </label>
                                <label>
                                  {"Até"}
                                  <input
                                    type={"date"}
                                    value={filtro.ate}
                                    onChange={(e) => mudarFiltro(fid, { ate: e.target.value })}
                                  />
                                </label>
                                {filtrando ? (
                                  <button type={"button"} className={"btn-ghost"} onClick={() => mudarFiltro(fid, { nome: "", de: "", ate: "" })}>
                                    {"Limpar"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className={"z1f"}>
                            {arr(_col5?.["lanes"]).map((_lane6: any, _i6: number) => (
                              <Fragment key={chave(_lane6, _i6)}>
                                  {E(_lane6?.["hasTitle"]) && (!filtrando || arr(_lane6?.["cards"]).some((card: any) => passaCard(card, filtro))) ? (
                                    <>
                                      <div className={a(_lane6?.["cls"])}>
                                        <span >
                                          {t(_lane6?.["title"])}
                                        </span>
                                        <span >
                                          {t(_lane6?.["count"])}
                                        </span>
                                      </div>
                                    </>
                                  ) : null}
                                  {arr(_lane6?.["cards"]).filter((_card7: any) => passaCard(_card7, filtro)).map((_card7: any, _i7: number) => (
                                    <Fragment key={chave(_card7, _i7)}>
                                        <article className={a((s(_card7?.["cls"]) + " z1g"))} draggable={a(_card7?.["drag"])} onDragStart={fn(_card7?.["onDragStart"])} onDragEnd={fn(_card7?.["onDragEnd"])}>
                                          {E(_card7?.["hasSite"]) ? (
                                            <>
                                              <div className={a((s(_card7?.["siteCls"]) + " z1h"))}>
                                                <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                  <path d={"M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"} />
                                                  <circle cx={"12"} cy={"9.5"} r={"2.5"} />
                                                </svg>
                                                {t((" " + s(_card7?.["siteChip"]) + " "))}
                                              </div>
                                            </>
                                          ) : null}
                                          {E(_card7?.["pausa"]) ? (
                                            <div className={"chip chip-warn z1h"}>
                                              {"Pausada"}
                                            </div>
                                          ) : null}
                                          {Array.isArray(_card7?.["checks"]) && _card7["checks"].some((ch: any) => (ch?.itens || []).some((it: any) => it?.obrigatorio !== false && it?.resultado !== "ok" && it?.resultado !== "nok")) ? (
                                            <div className={"chip chip-warn z1h"}>
                                              {"Checklist pendente"}
                                            </div>
                                          ) : null}
                                          {E(_card7?.["hasApp"]) ? (
                                            <>
                                              <div className={a((s(_card7?.["appChipCls"]) + " z1h"))}>
                                                <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                  <rect x={"7"} y={"2"} width={"10"} height={"20"} rx={"2"} />
                                                  <path d={"M11 18h2"} />
                                                </svg>
                                                {t((" " + s(_card7?.["appChip"]) + " "))}
                                              </div>
                                            </>
                                          ) : null}
                                          {E(_card7?.["isPending"]) ? (
                                            <>
                                              <div className={"chip chip-lock z1h"}>
                                                <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                  <rect x={"4"} y={"10"} width={"16"} height={"11"} rx={"2"} />
                                                  <path d={"M8 10V7a4 4 0 0 1 8 0v3"} />
                                                </svg>
                                                {t((" Retorno p/ “" + s(_card7?.["pendingTo"]) + "” aguardando aprovação "))}
                                              </div>
                                            </>
                                          ) : null}
                                          <button className={"card-title"} onClick={fn(_card7?.["open"])} aria-label={a(("Abrir detalhes da OS " + s(_card7?.["num"])))}>
                                            <span className={"z1i"}>
                                              <span className={"z1j"}>
                                                {t(("OS " + s(_card7?.["num"])))}
                                              </span>
                                              <span className={a(_card7?.["tipoCls"])}>
                                                {t(_card7?.["tipoLabel"])}
                                              </span>
                                            </span>
                                            <span className={"ct-client z1k"}>
                                              {t(_card7?.["cliente"])}
                                            </span>
                                            <span className={"zq"}>
                                              {t((s(_card7?.["cidade"]) + " · " + s(_card7?.["servico"])))}
                                            </span>
                                          </button>
                                          <div className={"z1l"}>
                                            <span className={a(_card7?.["matCls"])}>
                                              <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"}>
                                                <path d={"M3 7l9-4 9 4-9 4-9-4z"} />
                                                <path d={"M3 7v10l9 4 9-4V7"} />
                                                <path d={"M12 11v10"} />
                                              </svg>
                                              {t((" " + s(_card7?.["matLabel"]) + " "))}
                                            </span>
                                            {E(_card7?.["fromTecnico"]) ? (
                                              <>
                                                <span className={"chip chip-info"}>
                                                  <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                    <path d={"M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"} />
                                                  </svg>
                                                  {t((" " + s(_card7?.["fromTecnicoLabel"]) + " "))}
                                                </span>
                                              </>
                                            ) : null}
                                            {E(_card7?.["fromCompras"]) ? (
                                              <>
                                                <span className={"chip chip-info"}>
                                                  <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                    <path d={"M9 14l-5-5 5-5"} />
                                                    <path d={"M4 9h11a5 5 0 0 1 0 10h-3"} />
                                                  </svg>
                                                  {t((" " + s(_card7?.["fromComprasLabel"]) + " "))}
                                                </span>
                                              </>
                                            ) : null}
                                            {E(_card7?.["hasPrev"]) ? (
                                              <>
                                                <span className={a(_card7?.["prevCls"])}>
                                                  <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                    <path d={"M1 6h13v10H1z"} />
                                                    <path d={"M14 10h4l3 3v3h-7"} />
                                                    <circle cx={"5.5"} cy={"18"} r={"1.8"} />
                                                    <circle cx={"17.5"} cy={"18"} r={"1.8"} />
                                                  </svg>
                                                  {t((" " + s(_card7?.["prevLabel"]) + " "))}
                                                </span>
                                              </>
                                            ) : null}
                                            <span className={"chip"}>
                                              <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                                                <rect x={"3"} y={"5"} width={"18"} height={"16"} rx={"2"} />
                                                <path d={"M3 10h18M8 3v4M16 3v4"} />
                                              </svg>
                                              {t((" " + s(_card7?.["agenda"]) + " "))}
                                            </span>
                                            {E(_card7?.["hasLevChip"]) ? (
                                              <>
                                                <span className={"chip chip-info"}>
                                                  <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                    <path d={"M9 5h10M9 12h10M9 19h10M4 5h1M4 12h1M4 19h1"} />
                                                  </svg>
                                                  {t((" " + s(_card7?.["levChip"]) + " "))}
                                                </span>
                                              </>
                                            ) : null}
                                            {E(_card7?.["hasExtras"]) ? (
                                              <>
                                                <span className={"chip chip-warn"}>
                                                  <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.4"} strokeLinecap={"round"}>
                                                    <path d={"M12 5v14M5 12h14"} />
                                                  </svg>
                                                  {t((" " + s(_card7?.["extrasLabel"]) + " "))}
                                                </span>
                                              </>
                                            ) : null}
                                            {E(_card7?.["hasTec"]) ? (
                                              <>
                                                <span className={"chip"}>
                                                  <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                    <path d={"M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"} />
                                                  </svg>
                                                  {t((" " + s(_card7?.["tecLabel"]) + " "))}
                                                </span>
                                              </>
                                            ) : null}
                                          </div>
                                          <div className={"z1m"}>
                                            <span className={"z1n"}>
                                              {t(_card7?.["waitLabel"])}
                                            </span>
                                            {E(_card7?.["canAdvance"]) ? (
                                              <>
                                                <button className={"btn-adv"} onClick={fn(_card7?.["advance"])} aria-label={a((s(_card7?.["advLabel"]) + ": OS " + s(_card7?.["num"]) + " para " + s(_card7?.["nextName"])))}>
                                                  {t((s(_card7?.["advLabel"]) + " "))}
                                                  <svg aria-hidden={"true"} width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                                    <path d={"M5 12h14M13 6l6 6-6 6"} />
                                                  </svg>
                                                </button>
                                              </>
                                            ) : null}
                                            {E(_card7?.["adminPending"]) ? (
                                              <>
                                                <div className={"z1o"}>
                                                  <button className={"btn-ghost"} onClick={fn(_card7?.["reject"])} aria-label={a(("Recusar retorno da OS " + s(_card7?.["num"])))}>
                                                    {"Recusar"}
                                                  </button>
                                                  <button className={"btn-dark"} onClick={fn(_card7?.["approve"])} aria-label={a(("Aprovar retorno da OS " + s(_card7?.["num"])))}>
                                                    {"Aprovar"}
                                                  </button>
                                                </div>
                                              </>
                                            ) : null}
                                          </div>
                                        </article>
                                    </Fragment>
                                  ))}
                                  {!filtrando && E(_lane6?.["emptyLane"]) ? (
                                    <>
                                      <div className={"z1p"}>
                                        {t(_lane6?.["emptyText"])}
                                      </div>
                                    </>
                                  ) : null}
                              </Fragment>
                            ))}
                            {E(_col5?.["hasMore"]) ? (
                              <>
                                <button className={"btn-ghost z1q"} onClick={fn(_col5?.["toggleMore"])} aria-expanded={a(_col5?.["moreExpanded"])}>
                                  {t(_col5?.["moreLabel"])}
                                </button>
                              </>
                            ) : null}
                            {filtrando && visiveis === 0 ? (
                              <div className={"z1r"}>
                                {"Nenhum card com esse filtro"}
                              </div>
                            ) : null}
                            {!filtrando && E(_col5?.["empty"]) ? (
                              <>
                                <div className={"z1r"}>
                                  {"Nenhuma OS nesta etapa"}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </section>
                    </Fragment>
                    );
                  })}
                </div>
              </div>
            </main>
          </>
        ) : null}
        {E(v["isAgenda"]) ? (
          <>
            <main className={"z1s"}>
              <div className={"z1t"}>
                <div className={"z10"}>
                  <button className={"btn-ghost z1u"} onClick={fn(v["cal"]?.["today"])}>
                    {"Hoje"}
                  </button>
                  <button className={"nav-btn"} onClick={fn(v["cal"]?.["prev"])} aria-label={a(v["cal"]?.["prevLabel"])}>
                    <svg aria-hidden={"true"} width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#141414"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                      <path d={"M15 6l-6 6 6 6"} />
                    </svg>
                  </button>
                  <button className={"nav-btn"} onClick={fn(v["cal"]?.["next"])} aria-label={a(v["cal"]?.["nextLabel"])}>
                    <svg aria-hidden={"true"} width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#141414"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                      <path d={"M9 6l6 6-6 6"} />
                    </svg>
                  </button>
                  <h2 className={"z1v"}>
                    {t(v["cal"]?.["title"])}
                  </h2>
                </div>
                <div className={"z1w"}>
                  <div className={"z1x"}>
                    <span className={"z1y"}>
                      <span aria-hidden={"true"} className={"z1z"}>
                      </span>
                      {"Agendado"}
                    </span>
                    <span className={"z1y"}>
                      <span aria-hidden={"true"} className={"z20"}>
                      </span>
                      {"Em execução"}
                    </span>
                    <span className={"z1y"}>
                      <span aria-hidden={"true"} className={"z21"}>
                      </span>
                      {"Executado / finalizado"}
                    </span>
                  </div>
                  <div className={"seg"} role={"group"} aria-label={"Visualização"}>
                    <button className={a(v["cal"]?.["weekCls"])} aria-pressed={a(v["cal"]?.["weekOn"])} onClick={fn(v["cal"]?.["toWeek"])}>
                      {"Semana"}
                    </button>
                    <button className={a(v["cal"]?.["monthCls"])} aria-pressed={a(v["cal"]?.["monthOn"])} onClick={fn(v["cal"]?.["toMonth"])}>
                      {"Mês"}
                    </button>
                  </div>
                </div>
              </div>
              <div className={"zv"}>
                <span className={"flabel"}>
                  {"Equipe"}
                </span>
                <div className={"seg zw"} role={"group"} aria-label={"Filtrar por técnico"}>
                  {arr(v["cal"]?.["eqFilters"]).map((_f8: any, _i8: number) => (
                    <Fragment key={chave(_f8, _i8)}>
                        <button className={a(_f8?.["cls"])} aria-pressed={a(_f8?.["on"])} onClick={fn(_f8?.["pick"])}>
                          {t(_f8?.["label"])}
                        </button>
                    </Fragment>
                  ))}
                </div>
                <span className={"z22"}>
                  {t(v["cal"]?.["eqSummary"])}
                </span>
              </div>
              {E(v["cal"]?.["isWeek"]) ? (
                <>
                  <div className={"z23"}>
                    <div className={"z24"}>
                      <div className={"z25"}>
                        <div >
                        </div>
                        {arr(v["cal"]?.["days"]).map((_d9: any, _i9: number) => (
                          <Fragment key={chave(_d9, _i9)}>
                              <div className={a(_d9?.["headCls"])}>
                                <span >
                                  {t(_d9?.["dow"])}
                                </span>
                                <span className={"z26"}>
                                  {t(_d9?.["num"])}
                                </span>
                              </div>
                          </Fragment>
                        ))}
                      </div>
                      <div className={"z27"}>
                        <div className={"z28"}>
                          {"Dia todo"}
                        </div>
                        {arr(v["cal"]?.["days"]).map((_d10: any, _i10: number) => (
                          <Fragment key={chave(_d10, _i10)}>
                              <div className={a(_d10?.["cellCls"])}>
                                {arr(_d10?.["allday"]).map((_ev11: any, _i11: number) => (
                                  <Fragment key={chave(_ev11, _i11)}>
                                      <button className={a(_ev11?.["cls"])} onClick={fn(_ev11?.["open"])} aria-label={a(_ev11?.["aria"])}>
                                        <span className={"z14"}>
                                          {t((s(_ev11?.["time"]) + " · " + s(_ev11?.["num"])))}
                                        </span>
                                        <span >
                                          {t(_ev11?.["cliente"])}
                                        </span>
                                        <span className={"z29"}>
                                          {t(_ev11?.["sub"])}
                                        </span>
                                      </button>
                                  </Fragment>
                                ))}
                              </div>
                          </Fragment>
                        ))}
                      </div>
                      {arr(v["cal"]?.["hours"]).map((_hr12: any, _i12: number) => (
                        <Fragment key={chave(_hr12, _i12)}>
                            <div className={"z2a"}>
                              <div className={"z2b"}>
                                {t(_hr12?.["label"])}
                              </div>
                              {arr(_hr12?.["cells"]).map((_cell13: any, _i13: number) => (
                                <Fragment key={chave(_cell13, _i13)}>
                                    <div className={a(_cell13?.["cls"])}>
                                      {arr(_cell13?.["evs"]).map((_ev14: any, _i14: number) => (
                                        <Fragment key={chave(_ev14, _i14)}>
                                            <button className={a(_ev14?.["cls"])} onClick={fn(_ev14?.["open"])} aria-label={a(_ev14?.["aria"])}>
                                              <span className={"z14"}>
                                                {t((s(_ev14?.["time"]) + " · " + s(_ev14?.["num"])))}
                                              </span>
                                              <span >
                                                {t(_ev14?.["cliente"])}
                                              </span>
                                              <span className={"z29"}>
                                                {t(_ev14?.["sub"])}
                                              </span>
                                            </button>
                                        </Fragment>
                                      ))}
                                    </div>
                                </Fragment>
                              ))}
                            </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              {E(v["cal"]?.["isMonth"]) ? (
                <>
                  <div className={"z23"}>
                    <div className={"z2c"}>
                      <div className={"z2d"}>
                        {arr(v["cal"]?.["dows"]).map((_w15: any, _i15: number) => (
                          <Fragment key={chave(_w15, _i15)}>
                              <div className={"z2e"}>
                                {t(_w15)}
                              </div>
                          </Fragment>
                        ))}
                      </div>
                      {arr(v["cal"]?.["weeks"]).map((_wk16: any, _i16: number) => (
                        <Fragment key={chave(_wk16, _i16)}>
                            <div className={"z2f"}>
                              {arr(_wk16?.["days"]).map((_d17: any, _i17: number) => (
                                <Fragment key={chave(_d17, _i17)}>
                                    <div className={a(_d17?.["cls"])}>
                                      <button className={"mday-num"} onClick={fn(_d17?.["pick"])} aria-label={a(("Ver semana de " + s(_d17?.["full"])))}>
                                        {t(_d17?.["num"])}
                                      </button>
                                      {arr(_d17?.["evs"]).map((_ev18: any, _i18: number) => (
                                        <Fragment key={chave(_ev18, _i18)}>
                                            <button className={a(_ev18?.["mcls"])} onClick={fn(_ev18?.["open"])} aria-label={a(_ev18?.["aria"])}>
                                              {t((s(_ev18?.["time"]) + " · " + s(_ev18?.["cliente"])))}
                                            </button>
                                        </Fragment>
                                      ))}
                                      {E(_d17?.["hasMore"]) ? (
                                        <>
                                          <button className={"mev z2g"} onClick={fn(_d17?.["pick"])}>
                                            {t(("+" + s(_d17?.["more"]) + " mais"))}
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                </Fragment>
                              ))}
                            </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </main>
          </>
        ) : null}
        {E(v["hasOpen"]) ? (
          <>
            <div className={"z2h"}>
              <aside role={"dialog"} aria-modal={"true"} aria-label={a(("Detalhes da OS " + s(v["open"]?.["num"])))} className={"z2i"}>
                <div className={"z2j"}>
                  <div className={"z2k"}>
                    <span className={"z2l"}>
                      {t(("OS " + s(v["open"]?.["num"])))}
                    </span>
                    <span className={"os-row"}>
                      <ExcluirOs acao={v["excluir"]} num={s(v["open"]?.["num"])} stage={Number(v["open"]?.["stage"])} />
                      <button className={"x-btn z2m"} onClick={fn(v["closeOpen"])} aria-label={"Fechar detalhes"}>
                      <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                        <path d={"M6 6l12 12M18 6L6 18"} />
                      </svg>
                      </button>
                    </span>
                  </div>
                  <div className={"z2n"}>
                    {t(v["open"]?.["cliente"])}
                  </div>
                  <div className={"z2o"}>
                    {t((s(v["open"]?.["cidade"]) + " · " + s(v["open"]?.["servico"])))}
                  </div>
                  <GeoLinha osId={s(v["open"]?.["id"])} />
                </div>
                <div className={"z2p"}>
                  <div className={"z2q"}>
                    <label className={"flabel"} htmlFor={"os-obs"}>
                      {"Observação da OS"}
                    </label>
                    <textarea id={"os-obs"} className={"field z2r"} rows={"5"} placeholder={"Informações para o atendimento: o que o cliente relatou, acesso ao local, contato…"} value={s(v["open"]?.["obsVal"])} onChange={fn(v["open"]?.["onObs"])}>
                    </textarea>
                    {E(v["open"]?.["obsMudou"]) ? (
                      <>
                        <div className={"z2s"}>
                          <button className={"btn-ghost sm"} onClick={fn(v["open"]?.["obsDesfazer"])}>
                            {"Desfazer"}
                          </button>
                          <button className={"btn-adv sm"} onClick={fn(v["open"]?.["obsSalvar"])}>
                            {"Salvar observação"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                  {E(v["open"]?.["hasSite"]) ? (
                    <>
                      <div className={"appbox z2t"}>
                        <div className={"z2u"}>
                          <svg aria-hidden={"true"} width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                            <path d={"M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"} />
                            <circle cx={"12"} cy={"9.5"} r={"2.5"} />
                          </svg>
                          <span className={"zo"}>
                            {"Atendimento no local"}
                          </span>
                        </div>
                        <div className={"z2v"}>
                          <div className={"z2w"}>
                            <span className={"flabel"}>
                              {"Check-in"}
                            </span>
                            <span className={"z2x"}>
                              {t(v["open"]?.["ciTxt"])}
                            </span>
                          </div>
                          <div className={"z2w"}>
                            <span className={"flabel"}>
                              {"Check-out"}
                            </span>
                            <span className={"z2x"}>
                              {t(v["open"]?.["coTxt"])}
                            </span>
                          </div>
                          <div className={"z2w"}>
                            <span className={"flabel"}>
                              {"Tempo no local"}
                            </span>
                            <span className={"z2x"}>
                              {t(v["open"]?.["durTxt"])}
                            </span>
                          </div>
                        </div>
                        <span className={"zp"}>
                          {t(v["open"]?.["siteText"])}
                        </span>
                        <div className={"z13"}>
                          {E(v["open"]?.["canSimCi"]) ? (
                            <>
                              <button className={"btn-dark"} onClick={fn(v["open"]?.["simCi"])}>
                                {"Simular check-in no app"}
                              </button>
                            </>
                          ) : null}
                          {E(v["open"]?.["canSimCo"]) ? (
                            <>
                              <button className={"btn-dark"} onClick={fn(v["open"]?.["simCo"])}>
                                {"Simular check-out no app"}
                              </button>
                            </>
                          ) : null}
                          {E(v["open"]?.["hasConfPend"]) ? (
                            <>
                              <button className={"btn-dark"} onClick={fn(v["open"]?.["simAccept"])}>
                                {"Simular aceite do técnico"}
                              </button>
                              <button className={"btn-ghost"} onClick={fn(v["open"]?.["simContest"])}>
                                {"Simular “não concordo”"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                  {E(v["open"]?.["hasApp"]) ? (
                    <>
                      <div className={a((s(v["open"]?.["appCls"]) + " z2t"))}>
                        <div className={"z2u"}>
                          <svg aria-hidden={"true"} width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                            <rect x={"7"} y={"2"} width={"10"} height={"20"} rx={"2"} />
                            <path d={"M11 18h2"} />
                          </svg>
                          <span className={"zo"}>
                            {t(v["open"]?.["appTitle"])}
                          </span>
                        </div>
                        <span className={"zp"}>
                          {t(v["open"]?.["appText"])}
                        </span>
                        {E(v["open"]?.["hasDiv"]) ? (
                          <>
                            <div className={"z2y"}>
                              {t(("Divergência: " + s(v["open"]?.["divText"])))}
                            </div>
                          </>
                        ) : null}
                        <div className={"z13"}>
                          {E(v["open"]?.["canSimOk"]) ? (
                            <>
                              <button className={"btn-dark"} onClick={fn(v["open"]?.["simOk"])}>
                                {"Simular OK do técnico no app"}
                              </button>
                            </>
                          ) : null}
                          {E(v["open"]?.["canSimDiv"]) ? (
                            <>
                              <button className={"btn-ghost"} onClick={fn(v["open"]?.["simDiv"])}>
                                {"Simular divergência"}
                              </button>
                            </>
                          ) : null}
                          {E(v["open"]?.["canResend"]) ? (
                            <>
                              <button className={"btn-adv"} onClick={fn(v["open"]?.["resend"])}>
                                {"Reenviar ao técnico"}
                              </button>
                            </>
                          ) : null}
                          {E(v["open"]?.["canCancelApp"]) ? (
                            <>
                              <button className={"btn-ghost"} onClick={fn(v["open"]?.["cancelApp"])}>
                                {"Cancelar envio"}
                              </button>
                            </>
                          ) : null}
                        </div>
                        <span className={"zr"}>
                          {"No sistema real, o OK e a divergência vêm do aplicativo do técnico. Veja a tela “App do Técnico” no canvas."}
                        </span>
                      </div>
                    </>
                  ) : null}
                  {E(v["open"]?.["isPending"]) ? (
                    <>
                      <div className={"z2z"}>
                        <span className={"zo"}>
                          {"Retorno aguardando aprovação do Administrador"}
                        </span>
                        <span className={"zp"}>
                          {t(("Voltar para “" + s(v["open"]?.["pendingTo"]) + "” · solicitado por " + s(v["open"]?.["pendingBy"])))}
                        </span>
                        <span className={"z30"}>
                          {t(("Motivo: " + s(v["open"]?.["pendingMotivo"])))}
                        </span>
                        {E(v["open"]?.["adminPending"]) ? (
                          <>
                            <div className={"z31"}>
                              <button className={"btn-ghost"} onClick={fn(v["open"]?.["reject"])}>
                                {"Recusar"}
                              </button>
                              <button className={"btn-dark"} onClick={fn(v["open"]?.["approve"])}>
                                {"Aprovar retorno"}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  <div className={"z32"}>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Etapa atual"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["stageName"])}
                      </span>
                    </div>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Responsável agora"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["mover"])}
                      </span>
                    </div>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Tipo de OS"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["tipoFull"])}
                      </span>
                    </div>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Ticket de origem"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["ticketTxt"])}
                      </span>
                    </div>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Orçamento de origem"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["orcTxt"])}
                        {E(v["open"]?.["hasOrcLink"]) ? (
                          <>
                            {" · "}
                            <a href={a(v["open"]?.["orcLink"])} target={"_blank"} rel={"noopener"} style={css("font-weight:700;color:#141414;text-decoration:underline")}>
                              {"📎 Ver orçamento"}
                            </a>
                          </>
                        ) : null}
                      </span>
                    </div>
                    {E(v["open"]?.["hasAutorizacao"]) ? (
                      <div className={"z33"}>
                        <span className={"flabel"}>
                          {"Autorizado por"}
                        </span>
                        <span className={"z34"}>
                          {t(v["open"]?.["autorizou"])}
                          {E(v["open"]?.["docAutorizacao"]) ? (
                            <>
                              {" · "}
                              <a href={a(v["open"]?.["docAutorizacao"])} target={"_blank"} rel={"noopener"} style={css("font-weight:700;color:#141414;text-decoration:underline")}>
                                {"📎 "}
                                {t(v["open"]?.["docNome"]) || "Documento"}
                              </a>
                            </>
                          ) : null}
                        </span>
                      </div>
                    ) : null}
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Agendamento"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["agenda"])}
                      </span>
                    </div>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Previsão de chegada"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["prevista"])}
                      </span>
                    </div>
                    <div className={"z33"}>
                      <span className={"flabel"}>
                        {"Equipe técnica"}
                      </span>
                      <span className={"z34"}>
                        {t(v["open"]?.["tecnicoTxt"])}
                      </span>
                    </div>
                  </div>
                  {E(v["open"]?.["hasLev"]) ? (
                    <>
                      <div className={"z35"}>
                        <h3 className={"z36"}>
                          {"Orçamento levantado pelo técnico"}
                        </h3>
                        <div className={"z37"}>
                          {arr(v["open"]?.["levItens"]).map((_lv19: any, _i19: number) => (
                            <Fragment key={chave(_lv19, _i19)}>
                                <div className={"z38"}>
                                  <span className={"z39"}>
                                    {t(_lv19?.["qtd"])}
                                  </span>
                                  <span className={"z3a"}>
                                    <span className={"z12"}>
                                      {t(_lv19?.["nome"])}
                                    </span>
                                    {E(_lv19?.["hasObs"]) ? (
                                      <>
                                        <span className={"z3b"}>
                                          {t(_lv19?.["obs"])}
                                        </span>
                                      </>
                                    ) : null}
                                  </span>
                                </div>
                            </Fragment>
                          ))}
                          {E(v["open"]?.["hasLevObs"]) ? (
                            <>
                              <div className={"z3c"}>
                                {t(("Observações: " + s(v["open"]?.["levObs"])))}
                              </div>
                            </>
                          ) : null}
                        </div>
                        <span className={"z1d"}>
                          {t(v["open"]?.["levStatus"])}
                        </span>
                      </div>
                    </>
                  ) : null}
                  {E(v["open"]?.["showMat"]) ? (
                    <>
                      <div className={"z35"}>
                        <h3 className={"z36"}>
                          {"Materiais da OS"}
                        </h3>
                        {E(v["open"]?.["hasMatHelp"]) ? (
                          <>
                            <div className={"z3d"}>
                              {t(v["open"]?.["matHelp"])}
                            </div>
                          </>
                        ) : null}
                        <div className={"z3e"}>
                          {arr(v["open"]?.["itens"]).map((_it20: any, _i20: number) => (
                            <Fragment key={chave(_it20, _i20)}>
                                <div className={"z3f"}>
                                  <div className={"zj"}>
                                    <span className={"z3g"}>
                                      {t(_it20?.["qtd"])}
                                    </span>
                                    <span className={"z3h"}>
                                      {t(_it20?.["nome"])}
                                    </span>
                                    <span className={a(_it20?.["cls"])}>
                                      {t(_it20?.["label"])}
                                    </span>
                                  </div>
                                  {E(_it20?.["editSep"]) ? (
                                    <>
                                      <div role={"group"} aria-label={a(("Separação de " + s(_it20?.["nome"])))} className={"z3i"}>
                                        <button className={a(_it20?.["sepCls"])} aria-pressed={a(_it20?.["sepOn"])} onClick={fn(_it20?.["setSep"])}>
                                          <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.6"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                            <path d={"M5 12l5 5 9-10"} />
                                          </svg>
                                          {" Separado"}
                                        </button>
                                        <button className={a(_it20?.["buyCls"])} aria-pressed={a(_it20?.["buyOn"])} onClick={fn(_it20?.["setBuy"])}>
                                          <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                            <circle cx={"9"} cy={"20"} r={"1.5"} />
                                            <circle cx={"18"} cy={"20"} r={"1.5"} />
                                            <path d={"M2 3h3l2.5 12h12l2-8H6"} />
                                          </svg>
                                          {" A comprar"}
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                  {E(_it20?.["editBuy"]) ? (
                                    <>
                                      <div className={"z3j"}>
                                        <label htmlFor={a(_it20?.["prevId"])} className={"z3k"}>
                                          {"Previsão de chegada"}
                                        </label>
                                        <input id={a(_it20?.["prevId"])} className={"field-sm"} type={"date"} value={s(_it20?.["prev"])} onChange={fn(_it20?.["onPrev"])} />
                                        {E(_it20?.["notBought"]) ? (
                                          <>
                                            <button className={"mini mini-dark"} onClick={fn(_it20?.["markBought"])}>
                                              {"Marcar como comprado"}
                                            </button>
                                          </>
                                        ) : null}
                                        {E(_it20?.["isBought"]) ? (
                                          <>
                                            <button className={"mini"} onClick={fn(_it20?.["undoBought"])}>
                                              {"Desfazer"}
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </>
                                  ) : null}
                                  {E(_it20?.["canReceive"]) ? (
                                    <>
                                      <div className={"z3j"}>
                                        <button className={"mini mini-ok"} onClick={fn(_it20?.["receive"])}>
                                          <svg aria-hidden={"true"} width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                            <path d={"M5 12l5 5 9-10"} />
                                          </svg>
                                          {" Chegou · dar entrada no estoque"}
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                  {E(_it20?.["waitReceive"]) ? (
                                    <>
                                      <div className={"z3l"}>
                                        {"Aguardando o Estoque confirmar a chegada."}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                  {E(v["open"]?.["hasRel"]) ? (
                    <>
                      <div className={"z35"}>
                        <h3 className={"z36"}>
                          {"Resolução do técnico"}
                        </h3>
                        <div className={"z3m"}>
                          {t(v["open"]?.["relTexto"])}
                        </div>
                        <div className={"z13"}>
                          {arr(v["open"]?.["relFotosImg"]).map((_ft21: any, _i21: number) => (
                            <Fragment key={chave(_ft21, _i21)}>
                                <a href={a(_ft21?.["url"])} target={"_blank"} rel={"noopener"} aria-label={a(("Abrir foto " + s(_ft21?.["n"]) + " do atendimento em tamanho real"))} className={"z3n"}>
                                  <img src={a(_ft21?.["url"])} alt={a(("Foto " + s(_ft21?.["n"]) + " do atendimento"))} loading={"lazy"} className={"z3o"} />
                                </a>
                            </Fragment>
                          ))}
                          {arr(v["open"]?.["relFotos"]).map((_ft22: any, _i22: number) => (
                            <Fragment key={chave(_ft22, _i22)}>
                                <span className={"z3p"}>
                                  <svg aria-hidden={"true"} width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"}>
                                    <rect x={"3"} y={"5"} width={"18"} height={"15"} rx={"2"} />
                                    <circle cx={"12"} cy={"12.5"} r={"3.5"} />
                                    <path d={"M8 5l1.5-2h5L16 5"} />
                                  </svg>
                                  {t((" " + s(_ft22)))}
                                </span>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className={"z35"}>
                    <h3 className={"z36"}>
                      {"Histórico"}
                    </h3>
                    <div className={"z3q"}>
                      {arr(v["open"]?.["hist"]).map((_h23: any, _i23: number) => (
                        <Fragment key={chave(_h23, _i23)}>
                            <div className={"z3r"}>
                              <span aria-hidden={"true"} className={"z3s"}>
                              </span>
                              <div className={"z2w"}>
                                <span className={"z3t"}>
                                  {t(_h23?.["acao"])}
                                </span>
                                <span className={"zr"}>
                                  {t((s(_h23?.["quando"]) + " · " + s(_h23?.["quem"])))}
                                </span>
                              </div>
                            </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <OsCampo os={{ ...(v["open"] || {}), pausarCom: v["pausarCom"], retomar: v["retomar"], definirSub: v["definirSub"], anexarCheck: v["anexarCheck"], obsDoCheck: v["obsDoCheck"], tirarCheck: v["tirarCheck"], marcarCheck: v["marcarCheck"] }} />
                  <div className={"z35"}>
                    {E(v["open"]?.["canLev"]) ? (
                      <>
                        <button className={"btn-dark z3u"} onClick={fn(v["open"]?.["lev"])}>
                          {t(v["open"]?.["levBtn"])}
                        </button>
                      </>
                    ) : null}
                    {E(v["open"]?.["canRequest"]) ? (
                      <>
                        <button className={"btn-dark z3u"} onClick={fn(v["open"]?.["request"])}>
                          {"Solicitar material ao estoque (volta para Separação)"}
                        </button>
                      </>
                    ) : null}
                    {E(v["open"]?.["canAddExtra"]) ? (
                      <>
                        <button className={"btn-ghost z3u"} onClick={fn(v["open"]?.["addExtra"])}>
                          {"+ Incluir item adicional (usado na execução)"}
                        </button>
                      </>
                    ) : null}
                    {E(v["open"]?.["canPrint"]) ? (
                      <>
                        <div className={"z3v"}>
                          <button className={"btn-dark z3u"} onClick={fn(v["open"]?.["printRep"])}>
                            <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"}>
                              <path d={"M6 9V3h12v6"} />
                              <rect x={"3"} y={"9"} width={"18"} height={"8"} rx={"2"} />
                              <path d={"M6 14h12v7H6z"} />
                            </svg>
                            {" Imprimir OS"}
                          </button>
                          <button className={"btn-ghost z3u"} onClick={fn(v["open"]?.["exportRep"])}>
                            <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                              <path d={"M12 3v12M7 10l5 5 5-5"} />
                              <path d={"M4 19h16"} />
                            </svg>
                            {" Exportar PDF"}
                          </button>
                        </div>
                      </>
                    ) : null}
                    {E(v["open"]?.["canAdvance"]) ? (
                      <>
                        <button className={"btn-adv z3u"} onClick={fn(v["open"]?.["advance"])}>
                          {t((s(v["open"]?.["advLabel"]) + " → “" + s(v["open"]?.["nextName"]) + "”"))}
                        </button>
                      </>
                    ) : null}
                    {E(v["open"]?.["canReturn"]) ? (
                      <>
                        <button className={"btn-ghost z3u"} onClick={fn(v["open"]?.["askReturn"])}>
                          {t(v["open"]?.["returnLabel"])}
                        </button>
                      </>
                    ) : null}
                    {E(v["open"]?.["blocked"]) ? (
                      <>
                        <div className={"z3w"}>
                          {t(v["open"]?.["blockedMsg"])}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : null}
        {E(v["hasRet"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Voltar etapa da OS " + s(v["ret"]?.["num"])))} className={"z3y"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["ret"]?.["num"])))}
                    </span>
                    <span className={"z41"}>
                      {t(v["ret"]?.["title"])}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeRet"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z42"}>
                  <div className={"z43"}>
                    {t((s(v["ret"]?.["cliente"]) + " · hoje em “" + s(v["ret"]?.["fromName"]) + "”"))}
                  </div>
                  <div className={"z44"}>
                    <label className={"flabel"} htmlFor={"ret-to"}>
                      {"Voltar para"}
                    </label>
                    <select id={"ret-to"} className={"field"} value={s(v["ret"]?.["to"])} onChange={fn(v["ret"]?.["onTo"])}>
                      {arr(v["ret"]?.["options"]).map((_o24: any, _i24: number) => (
                        <Fragment key={chave(_o24, _i24)}>
                            <option value={a(_o24?.["v"])}>
                              {t(_o24?.["label"])}
                            </option>
                        </Fragment>
                      ))}
                    </select>
                  </div>
                  <div className={"z44"}>
                    <label className={"flabel"} htmlFor={"ret-motivo"}>
                      {t(v["ret"]?.["motivoLabel"])}
                    </label>
                    <textarea id={"ret-motivo"} className={"field z45"} rows={"3"} placeholder={"Ex.: item informado como faltante está no estoque"} value={s(v["ret"]?.["motivo"])} onChange={fn(v["ret"]?.["onMotivo"])}>
                    </textarea>
                  </div>
                  {E(v["ret"]?.["isAdmin"]) ? (
                    <>
                      <button className={"btn-dark z3u"} onClick={fn(v["ret"]?.["adminGo"])}>
                        {"Voltar OS agora"}
                      </button>
                    </>
                  ) : null}
                  {E(v["ret"]?.["notAdmin"]) ? (
                    <>
                      <div className={"z46"}>
                        <div className={"z47"}>
                          <span className={"zo"}>
                            {"Opção 1 · Enviar para aprovação"}
                          </span>
                          <span className={"zq"}>
                            {"O cartão fica travado com o aviso “aguardando aprovação” até o Administrador aprovar ou recusar."}
                          </span>
                          <button className={"btn-adv z48"} onClick={fn(v["ret"]?.["request"])}>
                            {"Enviar para aprovação do Administrador"}
                          </button>
                        </div>
                        <div className={"z47"}>
                          <span className={"zo"}>
                            {"Opção 2 · Administrador presente"}
                          </span>
                          <span className={"zq"}>
                            {"O Administrador digita a senha aqui e o retorno é feito na hora."}
                          </span>
                          <label className={"flabel"} htmlFor={"ret-senha"}>
                            {"Senha do Administrador"}
                          </label>
                          <div className={"z49"}>
                            <input id={"ret-senha"} className={"field z4a"} type={"password"} autoComplete={"off"} value={s(v["ret"]?.["senha"])} onChange={fn(v["ret"]?.["onSenha"])} />
                            <button className={"btn-dark z4b"} onClick={fn(v["ret"]?.["authorize"])}>
                              {"Autorizar agora"}
                            </button>
                          </div>
                          <span className={"zr"}>
                            {"Protótipo: a senha de teste é 1234."}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : null}
                  {E(v["ret"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["ret"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasSched"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Agendar OS " + s(v["sched"]?.["num"])))} className={"z4d"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["sched"]?.["num"])))}
                    </span>
                    <span className={"z41"}>
                      {"Agendar instalação"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeSched"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z42"}>
                  <div className={"z43"}>
                    {t((s(v["sched"]?.["cliente"]) + " · " + s(v["sched"]?.["cidade"])))}
                  </div>
                  <GeoLinha osId={s(v["sched"]?.["id"])} />
                  <div className={"z4e"}>
                    <div className={"z44"}>
                      <label className={"flabel"} htmlFor={"sc-data"}>
                        {"Data"}
                      </label>
                      <input id={"sc-data"} className={"field"} type={"date"} value={s(v["sched"]?.["date"])} onChange={fn(v["sched"]?.["onDate"])} />
                    </div>
                    <div className={"z44"}>
                      <label className={"flabel"} htmlFor={"sc-per"}>
                        {"Período"}
                      </label>
                      <select id={"sc-per"} className={"field"} value={s(v["sched"]?.["periodo"])} onChange={fn(v["sched"]?.["onPer"])} disabled={E(v["sched"]?.["useHora"])}>
                        <option value={"Manhã"}>
                          {"Manhã"}
                        </option>
                        <option value={"Tarde"}>
                          {"Tarde"}
                        </option>
                        <option value={"Noite"}>
                          {"Noite"}
                        </option>
                        <option value={"Dia inteiro"}>
                          {"Dia inteiro"}
                        </option>
                      </select>
                    </div>
                  </div>
                  <label className={"chk"} htmlFor={"sc-usehora"}>
                    <input id={"sc-usehora"} type={"checkbox"} checked={E(v["sched"]?.["useHora"])} onChange={fn(v["sched"]?.["onUseHora"])} />
                    {" Horário específico "}
                  </label>
                  {E(v["sched"]?.["useHora"]) ? (
                    <>
                      <div className={"z4f"}>
                        <label className={"flabel"} htmlFor={"sc-hora"}>
                          {"Hora"}
                        </label>
                        <input id={"sc-hora"} className={"field"} type={"time"} step={"900"} value={s(v["sched"]?.["hora"])} onChange={fn(v["sched"]?.["onHora"])} />
                      </div>
                    </>
                  ) : null}
                  <div className={"z44"}>
                    <label className={"flabel"} htmlFor={"sc-eq"}>
                      {"Equipe técnica (opcional)"}
                    </label>
                    <select id={"sc-eq"} className={"field"} value={s(v["sched"]?.["equipe"])} onChange={fn(v["sched"]?.["onEq"])}>
                      <option value={""}>
                        {"Definir depois, na execução"}
                      </option>
                      {arr(v["sched"]?.["equipes"]).map((_eq25: any, _i25: number) => (
                        <Fragment key={chave(_eq25, _i25)}>
                            <option value={a(_eq25?.["nome"])}>
                              {t((s(_eq25?.["nome"]) + " · " + s(_eq25?.["info"])))}
                            </option>
                        </Fragment>
                      ))}
                    </select>
                    <span className={"z3b"}>
                      {"Escolher a equipe agora só reserva a agenda dela. A OS vai para o app do técnico principal. O material só sai do estoque quando a OS for colocada em execução."}
                    </span>
                    {E(v["sched"]?.["semTecnicos"]) ? (
                      <>
                        <span className={"z4g"}>
                          {"Nenhuma equipe técnica ativa. Monte em Assistência Técnica › Equipes técnicas."}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {E(v["sched"]?.["temAux"]) ? (
                    <>
                      <div className={"z44"}>
                        <label className={"flabel"} htmlFor={"sc-aux"}>
                          {"Auxiliar (opcional)"}
                        </label>
                        <select id={"sc-aux"} className={"field"} value={s(v["sched"]?.["auxiliar"])} onChange={fn(v["sched"]?.["onAux"])}>
                          <option value={""}>
                            {"Sem auxiliar"}
                          </option>
                          {arr(v["sched"]?.["auxiliares"]).map((_ax26: any, _i26: number) => (
                            <Fragment key={chave(_ax26, _i26)}>
                                <option value={a(_ax26)}>
                                  {t(_ax26)}
                                </option>
                            </Fragment>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                  {E(v["sched"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["sched"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2s"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeSched"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["sched"]?.["confirm"])}>
                      {"Confirmar agendamento"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasExec"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Enviar OS " + s(v["exec"]?.["num"]) + " ao técnico"))} className={"z4d"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["exec"]?.["num"])))}
                    </span>
                    <span className={"z41"}>
                      {"Enviar OS ao técnico"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeExec"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z42"}>
                  <div className={"z43"}>
                    {t((s(v["exec"]?.["cliente"]) + " · " + s(v["exec"]?.["cidade"]) + " · agendado " + s(v["exec"]?.["agenda"])))}
                  </div>
                  <GeoLinha osId={s(v["exec"]?.["id"])} />
                  {E(v["exec"]?.["hasPre"]) ? (
                    <>
                      <div className={"z4h"}>
                        {t(("Equipe definida no agendamento: " + s(v["exec"]?.["pre"]) + ". Confirme ou troque abaixo."))}
                      </div>
                    </>
                  ) : null}
                  <div className={"z4i"}>
                    <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"} className={"z4j"}>
                      <path d={"M3 7l9-4 9 4-9 4-9-4z"} />
                      <path d={"M3 7v10l9 4 9-4V7"} />
                    </svg>
                    <span >
                      {t(v["exec"]?.["saidaTxt"])}
                    </span>
                  </div>
                  <div role={"radiogroup"} aria-label={"Equipe técnica"} className={"z2q"}>
                    <span className={"flabel"}>
                      {"Equipe técnica"}
                    </span>
                    {E(v["exec"]?.["semTecnicos"]) ? (
                      <>
                        <span className={"z4k"}>
                          {"Nenhuma equipe técnica ativa. Monte em Assistência Técnica › Equipes técnicas."}
                        </span>
                      </>
                    ) : null}
                    {arr(v["exec"]?.["equipes"]).map((_eq27: any, _i27: number) => (
                      <Fragment key={chave(_eq27, _i27)}>
                          <button className={a(_eq27?.["cls"])} role={"radio"} aria-checked={a(_eq27?.["checked"])} onClick={fn(_eq27?.["pick"])}>
                            <span className={"eq-dot"} aria-hidden={"true"}>
                            </span>
                            <span className={"z4l"}>
                              <span className={"zo"}>
                                {t(_eq27?.["nome"])}
                              </span>
                              <span className={"z3b"}>
                                {t(_eq27?.["info"])}
                              </span>
                            </span>
                          </button>
                      </Fragment>
                    ))}
                  </div>
                  {E(v["exec"]?.["temAux"]) ? (
                    <>
                      <div className={"z44"}>
                        <label className={"flabel"} htmlFor={"ex-aux"}>
                          {"Auxiliar (opcional)"}
                        </label>
                        <select id={"ex-aux"} className={"field"} value={s(v["exec"]?.["auxiliar"])} onChange={fn(v["exec"]?.["onAux"])}>
                          <option value={""}>
                            {"Sem auxiliar"}
                          </option>
                          {arr(v["exec"]?.["auxiliares"]).map((_ax28: any, _i28: number) => (
                            <Fragment key={chave(_ax28, _i28)}>
                                <option value={a(_ax28)}>
                                  {t(_ax28)}
                                </option>
                            </Fragment>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                  {E(v["exec"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["exec"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2s"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeExec"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["exec"]?.["confirm"])}>
                      {"Enviar para o app do técnico"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasConf"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Conferência de material da OS " + s(v["conf"]?.["num"])))} className={"z4m"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["conf"]?.["num"]) + " · " + s(v["conf"]?.["equipe"])))}
                    </span>
                    <span className={"z41"}>
                      {"Conferência de material"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeConf"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z4n"}>
                  <div className={"z43"}>
                    {t((s(v["conf"]?.["cliente"]) + " · Técnico e Estoque conferem juntos o que foi usado e o que volta para o estoque da empresa."))}
                  </div>
                  <div className={"z2q"}>
                    <h3 className={"z36"}>
                      {"Itens da OS"}
                    </h3>
                    <div className={"z3e"}>
                      <div className={"z4o"}>
                        <span >
                          {"Item"}
                        </span>
                        <span className={"z4p"}>
                          {"Saiu"}
                        </span>
                        <span className={"z4p"}>
                          {"Usado"}
                        </span>
                        <span className={"z4p"}>
                          {"Devolve"}
                        </span>
                      </div>
                      {arr(v["conf"]?.["rows"]).map((_row29: any, _i29: number) => (
                        <Fragment key={chave(_row29, _i29)}>
                            <div className={"z4q"}>
                              <label htmlFor={a(_row29?.["inputId"])} className={"z4r"}>
                                {t(_row29?.["nome"])}
                              </label>
                              <span className={"z4s"}>
                                {t(_row29?.["saiu"])}
                              </span>
                              <input id={a(_row29?.["inputId"])} className={"num"} type={"number"} min={"0"} max={a(_row29?.["saiu"])} value={s(_row29?.["usado"])} onChange={fn(_row29?.["onUsado"])} />
                              <span className={a((s(_row29?.["devCls"]) + " z4t"))}>
                                {t(_row29?.["devLabel"])}
                              </span>
                            </div>
                        </Fragment>
                      ))}
                    </div>
                    <span className={"z3b"}>
                      {"Usou mais do que saiu? Lance a diferença como item adicional abaixo, informando de qual estoque saiu."}
                    </span>
                  </div>
                  <div className={"z2q"}>
                    <div className={"z4u"}>
                      <h3 className={"z36"}>
                        {"Itens adicionais"}
                      </h3>
                      <button className={"btn-ghost"} onClick={fn(v["conf"]?.["addExtra"])}>
                        {"+ Incluir item adicional"}
                      </button>
                    </div>
                    {E(v["conf"]?.["hasExtras"]) ? (
                      <>
                        <div className={"z3e"}>
                          {arr(v["conf"]?.["extras"]).map((_ex30: any, _i30: number) => (
                            <Fragment key={chave(_ex30, _i30)}>
                                <div className={"z4v"}>
                                  <span className={"z39"}>
                                    {t(_ex30?.["qtd"])}
                                  </span>
                                  <span className={"z4w"}>
                                    {t(_ex30?.["nome"])}
                                  </span>
                                  <span className={"st st-extra"}>
                                    {t(_ex30?.["origemLabel"])}
                                  </span>
                                </div>
                            </Fragment>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {E(v["conf"]?.["noExtras"]) ? (
                      <>
                        <div className={"z4x"}>
                          {"Nenhum item adicional lançado."}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className={"z4y"}>
                    <span className={"z14"}>
                      {"Resumo"}
                    </span>
                    <span >
                      {t(v["conf"]?.["resumoDev"])}
                    </span>
                    <span >
                      {t(v["conf"]?.["resumoExtra"])}
                    </span>
                  </div>
                  <div className={"z4z"}>
                    <span className={"flabel z50"}>
                      {"Conferência em duas etapas"}
                    </span>
                    <label className={"chk"} htmlFor={"conf-est"}>
                      <input id={"conf-est"} type={"checkbox"} checked={E(v["conf"]?.["chkEst"])} onChange={fn(v["conf"]?.["onEst"])} />
                      {" 1. Conferido pelo Estoque "}
                    </label>
                    <div className={"z51"}>
                      <svg aria-hidden={"true"} width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                        <rect x={"7"} y={"2"} width={"10"} height={"20"} rx={"2"} />
                        <path d={"M11 18h2"} />
                      </svg>
                      {t((" 2. Aceite do Técnico (" + s(v["conf"]?.["equipe"]) + ") no app · enviado depois do check do Estoque "))}
                    </div>
                  </div>
                  {E(v["conf"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["conf"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z52"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeConf"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["conf"]?.["confirm"])}>
                      {"Confirmar conferência e enviar ao técnico"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasNewOs"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={"Nova ordem de serviço"} className={"z53"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["newOs"]?.["num"])))}
                    </span>
                    <span className={"z41"}>
                      {"Nova ordem de serviço"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeNewOs"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z54"}>
                  <div role={"radiogroup"} aria-label={"Tipo de OS"} className={"z3v"}>
                    {arr(v["newOs"]?.["tipos"]).map((_t31: any, _i31: number) => (
                      <Fragment key={chave(_t31, _i31)}>
                          <button className={a(_t31?.["cls"])} role={"radio"} aria-checked={a(_t31?.["checked"])} onClick={fn(_t31?.["pick"])}>
                            <span className={"eq-dot"} aria-hidden={"true"}>
                            </span>
                            <span className={"z4l"}>
                              <span className={"zo"}>
                                {t(_t31?.["label"])}
                              </span>
                              <span className={"z3b"}>
                                {t(_t31?.["info"])}
                              </span>
                            </span>
                          </button>
                      </Fragment>
                    ))}
                  </div>
                  {E(v["newOs"]?.["isPedido"]) ? (
                    <>
                      <div className={"z44"}>
                        <label className={"flabel"} htmlFor={"nos-orc"}>
                          {"Nº do orçamento aprovado"}
                        </label>
                        <input id={"nos-orc"} className={"field"} type={"text"} placeholder={"Ex.: ORC-2026-00150"} value={s(v["newOs"]?.["orc"])} onChange={fn(v["newOs"]?.["onOrc"])} />
                      </div>
                    </>
                  ) : null}
                  {E(v["newOs"]?.["hasSub"]) ? (
                    <>
                      <div className={"z44"}>
                        <label className={"flabel"} htmlFor={"nos-sub"}>
                          {t(v["newOs"]?.["subLabel"])}
                        </label>
                        <select id={"nos-sub"} className={"field"} value={s(v["newOs"]?.["sub"])} onChange={fn(v["newOs"]?.["onSub"])}>
                          <option value={""}>
                            {"Selecione"}
                          </option>
                          {arr(v["newOs"]?.["subs"]).map((_sb32: any, _i32: number) => (
                            <Fragment key={chave(_sb32, _i32)}>
                                <option value={a(_sb32)}>
                                  {t(_sb32)}
                                </option>
                            </Fragment>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                  <div className={"z55"}>
                    <div className={"z44"}>
                      <label className={"flabel"} htmlFor={"nos-cli"}>
                        {"Cliente"}
                      </label>
                      <input id={"nos-cli"} className={"field"} type={"text"} placeholder={"Digite nome ou CNPJ/CPF (Omie)"} autoComplete={"off"} value={s(v["newOs"]?.["cliente"])} onChange={fn(v["newOs"]?.["onCli"])} />
                    </div>
                    <div className={"z44"}>
                      <label className={"flabel"} htmlFor={"nos-cid"}>
                        {"Cidade"}
                      </label>
                      <input id={"nos-cid"} className={"field"} type={"text"} value={s(v["newOs"]?.["cidade"])} onChange={fn(v["newOs"]?.["onCid"])} />
                    </div>
                  </div>
                  <div className={"z44"}>
                    <label className={"flabel"} htmlFor={"nos-desc"}>
                      {t(v["newOs"]?.["descLabel"])}
                    </label>
                    <textarea id={"nos-desc"} className={"field z45"} rows={"2"} placeholder={a(v["newOs"]?.["descPh"])} value={s(v["newOs"]?.["desc"])} onChange={fn(v["newOs"]?.["onDesc"])}>
                    </textarea>
                  </div>
                  <div className={"z56"}>
                    {t(v["newOs"]?.["fluxo"])}
                  </div>
                  {E(v["newOs"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["newOs"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2s"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeNewOs"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["newOs"]?.["confirm"])}>
                      {"Abrir OS"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasReq"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Solicitar material para a OS " + s(v["req"]?.["num"])))} className={"z53"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["req"]?.["num"]) + " · " + s(v["req"]?.["equipe"])))}
                    </span>
                    <span className={"z41"}>
                      {"Solicitar material"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeReq"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z54"}>
                  <div className={"z43"}>
                    {t((s(v["req"]?.["cliente"]) + " · o técnico informa o que precisa para concluir a manutenção."))}
                  </div>
                  {arr(v["req"]?.["rows"]).map((_rw33: any, _i33: number) => (
                    <Fragment key={chave(_rw33, _i33)}>
                        <div className={"z57"}>
                          <div className={"z44"}>
                            <label className={"flabel"} htmlFor={a(_rw33?.["qId"])}>
                              {"Qtd."}
                            </label>
                            <input id={a(_rw33?.["qId"])} className={"field"} type={"number"} min={"1"} value={s(_rw33?.["qtd"])} onChange={fn(_rw33?.["onQtd"])} />
                          </div>
                          <div className={"z44"}>
                            <label className={"flabel"} htmlFor={a(_rw33?.["nId"])}>
                              {"Produto"}
                            </label>
                            <input id={a(_rw33?.["nId"])} className={"field"} type={"text"} placeholder={"Ex.: Fonte 12 V 5 A"} value={s(_rw33?.["nome"])} onChange={fn(_rw33?.["onNome"])} />
                          </div>
                          <button className={"x-btn z58"} onClick={fn(_rw33?.["remove"])} aria-label={"Remover linha"}>
                            <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#141414"} strokeWidth={"2"} strokeLinecap={"round"}>
                              <path d={"M6 6l12 12M18 6L6 18"} />
                            </svg>
                          </button>
                        </div>
                    </Fragment>
                  ))}
                  <button className={"btn-ghost z1h"} onClick={fn(v["req"]?.["addRow"])}>
                    {"+ Adicionar outro produto"}
                  </button>
                  <div className={"z44"}>
                    <label className={"flabel"} htmlFor={"req-obs"}>
                      {"Observação para o estoque (opcional)"}
                    </label>
                    <textarea id={"req-obs"} className={"field z45"} rows={"2"} placeholder={"Ex.: fonte queimada na portaria"} value={s(v["req"]?.["obs"])} onChange={fn(v["req"]?.["onObs"])}>
                    </textarea>
                  </div>
                  <div className={"z56"}>
                    {"A OS volta para “Em separação”. O Estoque separa (ou manda para Compras) e a OS segue para “Aguardando agendamento” para a Assistência marcar o retorno do técnico."}
                  </div>
                  {E(v["req"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["req"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2s"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeReq"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["req"]?.["confirm"])}>
                      {"Enviar solicitação ao estoque"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasLevM"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Orçamento da OS " + s(v["levM"]?.["num"])))} className={"z59"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["levM"]?.["num"]) + " · " + s(v["levM"]?.["equipe"])))}
                    </span>
                    <span className={"z41"}>
                      {"Incluir orçamento"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeLevM"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z54"}>
                  <div className={"z43"}>
                    {t((s(v["levM"]?.["cliente"]) + " · liste todos os equipamentos e serviços que o local precisa. Isso vai para o Comercial negociar com o cliente."))}
                  </div>
                  {arr(v["levM"]?.["rows"]).map((_rw34: any, _i34: number) => (
                    <Fragment key={chave(_rw34, _i34)}>
                        <div className={"z5a"}>
                          <div className={"z44"}>
                            <label className={"flabel"} htmlFor={a(_rw34?.["qId"])}>
                              {"Qtd."}
                            </label>
                            <input id={a(_rw34?.["qId"])} className={"field"} type={"number"} min={"1"} value={s(_rw34?.["qtd"])} onChange={fn(_rw34?.["onQtd"])} />
                          </div>
                          <div className={"z44"}>
                            <label className={"flabel"} htmlFor={a(_rw34?.["nId"])}>
                              {"Equipamento / serviço"}
                            </label>
                            <input id={a(_rw34?.["nId"])} className={"field"} type={"text"} placeholder={"Ex.: Câmera IP bullet 4 MP"} value={s(_rw34?.["nome"])} onChange={fn(_rw34?.["onNome"])} />
                          </div>
                          <div className={"z44"}>
                            <label className={"flabel"} htmlFor={a(_rw34?.["oId"])}>
                              {"Local / obs."}
                            </label>
                            <input id={a(_rw34?.["oId"])} className={"field"} type={"text"} placeholder={"Ex.: portão de garagem"} value={s(_rw34?.["obs"])} onChange={fn(_rw34?.["onObs"])} />
                          </div>
                          <button className={"x-btn z58"} onClick={fn(_rw34?.["remove"])} aria-label={"Remover linha"}>
                            <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#141414"} strokeWidth={"2"} strokeLinecap={"round"}>
                              <path d={"M6 6l12 12M18 6L6 18"} />
                            </svg>
                          </button>
                        </div>
                    </Fragment>
                  ))}
                  <button className={"btn-ghost z1h"} onClick={fn(v["levM"]?.["addRow"])}>
                    {"+ Adicionar item"}
                  </button>
                  <div className={"z44"}>
                    <label className={"flabel"} htmlFor={"lev-obs"}>
                      {"Observações gerais (infraestrutura, acesso, prazos)"}
                    </label>
                    <textarea id={"lev-obs"} className={"field z45"} rows={"3"} placeholder={"Ex.: precisa de 120 m de tubulação aparente; cliente quer instalação em dezembro"} value={s(v["levM"]?.["obs"])} onChange={fn(v["levM"]?.["onObs"])}>
                    </textarea>
                  </div>
                  <div className={"z56"}>
                    {"O orçamento fica salvo na OS. Quando a visita for concluída, ele vira uma oportunidade no CRM do Comercial."}
                  </div>
                  {E(v["levM"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["levM"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2s"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeLevM"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["levM"]?.["confirm"])}>
                      {"Salvar orçamento"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasVdone"]) ? (
          <>
            <div className={"z3x"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Concluir visita da OS " + s(v["vdone"]?.["num"])))} className={"z5b"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["vdone"]?.["num"])))}
                    </span>
                    <span className={"z41"}>
                      {"Concluir visita de orçamento"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeVdone"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z54"}>
                  <div className={"z43"}>
                    {t((s(v["vdone"]?.["cliente"]) + " · " + s(v["vdone"]?.["resumo"])))}
                  </div>
                  <div className={"z5c"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#141414"} strokeWidth={"2"} strokeLinejoin={"round"} className={"z5d"}>
                      <path d={"M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"} />
                    </svg>
                    <span className={"z12"}>
                      {"Ao concluir, a OS vai para “Executado” o orçamento vira uma "}
                      <strong >
                        {"oportunidade no CRM do Comercial"}
                      </strong>
                      {", com todos os itens levantados, para negociar com o cliente."}
                    </span>
                  </div>
                  <div className={"z52"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["vdone"]?.["edit"])}>
                      {"Revisar orçamento"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["vdone"]?.["confirm"])}>
                      {"Concluir e enviar ao Comercial"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasAddx"]) ? (
          <>
            <div className={"z5e"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Incluir item adicional na OS " + s(v["addx"]?.["num"])))} className={"z4d"}>
                <div className={"z3z"}>
                  <div className={"z2w"}>
                    <span className={"z40"}>
                      {t(("OS " + s(v["addx"]?.["num"])))}
                    </span>
                    <span className={"z41"}>
                      {"Item adicional"}
                    </span>
                  </div>
                  <button className={"x-btn z2m"} onClick={fn(v["closeAddx"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z54"}>
                  <div className={"z5f"}>
                    <div className={"z44"}>
                      <label className={"flabel"} htmlFor={"ax-qtd"}>
                        {"Qtd."}
                      </label>
                      <input id={"ax-qtd"} className={"field"} type={"number"} min={"1"} value={s(v["addx"]?.["qtd"])} onChange={fn(v["addx"]?.["onQtd"])} />
                    </div>
                    <div className={"z44"}>
                      <label className={"flabel"} htmlFor={"ax-nome"}>
                        {"Produto"}
                      </label>
                      <input id={"ax-nome"} className={"field"} type={"text"} placeholder={"Ex.: Câmera IP bullet 4 MP"} value={s(v["addx"]?.["nome"])} onChange={fn(v["addx"]?.["onNome"])} />
                    </div>
                  </div>
                  <div role={"radiogroup"} aria-label={"De qual estoque saiu"} className={"z2q"}>
                    <span className={"flabel"}>
                      {"De onde saiu este item?"}
                    </span>
                    {arr(v["addx"]?.["origens"]).map((_o35: any, _i35: number) => (
                      <Fragment key={chave(_o35, _i35)}>
                          <button className={a(_o35?.["cls"])} role={"radio"} aria-checked={a(_o35?.["checked"])} onClick={fn(_o35?.["pick"])}>
                            <span className={"eq-dot"} aria-hidden={"true"}>
                            </span>
                            <span className={"z4l"}>
                              <span className={"zo"}>
                                {t(_o35?.["label"])}
                              </span>
                              <span className={"z3b"}>
                                {t(_o35?.["info"])}
                              </span>
                            </span>
                          </button>
                      </Fragment>
                    ))}
                  </div>
                  <div className={"z1d"}>
                    {"O item entra na OS como adicional, para ser incluído no orçamento e no faturamento."}
                  </div>
                  {E(v["addx"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z4c"}>
                        {t(v["addx"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2s"}>
                    <button className={"btn-ghost z48"} onClick={fn(v["closeAddx"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv z48"} onClick={fn(v["addx"]?.["confirm"])}>
                      {"Confirmar item adicional"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasRep"]) ? (
          <>
            <div className={"z5g"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={a(("Relatório da OS " + s(v["rep"]?.["num"])))} className={"z5h"}>
                <div className={"no-print z5i"}>
                  <span className={"z3t"}>
                    {t(v["rep"]?.["barText"])}
                  </span>
                  <div className={"zs"}>
                    <button className={"btn-adv"} onClick={fn(v["rep"]?.["doPrint"])}>
                      {t(v["rep"]?.["printLabel"])}
                    </button>
                    <button className={"x-btn z2m"} onClick={fn(v["closeRep"])} aria-label={"Fechar relatório"}>
                      <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                        <path d={"M6 6l12 12M18 6L6 18"} />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className={"rep-doc print-area z5j"}>
                  <div className={"z5k"}>
                    <div className={"z5l"}>
                      <img src={"/img/logo-ancora.png"} alt={"Âncora Segurança Patrimonial"} className={"z5m"} />
                      <div className={"z2w"}>
                        <span className={"z5n"}>
                          {t(("Ordem de Serviço " + s(v["rep"]?.["num"])))}
                        </span>
                        <span className={"z1d"}>
                          {t((s(v["rep"]?.["tipo"]) + " · emitido em " + s(v["rep"]?.["emitido"])))}
                        </span>
                      </div>
                    </div>
                    <span className={"z5o"}>
                      {t(v["rep"]?.["status"])}
                    </span>
                  </div>
                  <div className={"z5p"}>
                    <div >
                      <div className={"flabel"}>
                        {"Cliente"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["cliente"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Cidade"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["cidade"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Serviço"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["servico"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Orçamento / ticket"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["origem"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Equipe técnica"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["equipe"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Agendamento"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["agenda"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Check-in"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["ci"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Check-out"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["co"])}
                      </div>
                    </div>
                    <div >
                      <div className={"flabel"}>
                        {"Tempo no local"}
                      </div>
                      <div className={"z5q"}>
                        {t(v["rep"]?.["dur"])}
                      </div>
                    </div>
                  </div>
                  {E(v["rep"]?.["hasObs"]) ? (
                    <>
                      <div >
                        <div className={"flabel"}>
                          {"Observação da OS"}
                        </div>
                        <div className={"z5r"}>
                          {t(v["rep"]?.["obs"])}
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div >
                    <h4 >
                      {"Resolução do técnico"}
                    </h4>
                    <div className={"z5s"}>
                      {t(v["rep"]?.["relTexto"])}
                    </div>
                    {E(v["rep"]?.["hasFotos"]) ? (
                      <>
                        <div className={"z5t"}>
                          {arr(v["rep"]?.["fotosImg"]).map((_ft36: any, _i36: number) => (
                            <Fragment key={chave(_ft36, _i36)}>
                                <img src={a(_ft36?.["url"])} alt={a(("Foto " + s(_ft36?.["n"]) + " do atendimento"))} className={"z5u"} />
                            </Fragment>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {E(v["rep"]?.["hasMat"]) ? (
                    <>
                      <div >
                        <h4 >
                          {"Materiais"}
                        </h4>
                        <table className={"rep-tbl"}>
                          <thead >
                            <tr >
                              <th className={"z5v"}>
                                {"Qtd."}
                              </th>
                              <th >
                                {"Item"}
                              </th>
                              <th className={"z5w"}>
                                {"Situação"}
                              </th>
                            </tr>
                          </thead>
                          <tbody >
                            {arr(v["rep"]?.["mat"]).map((_m37: any, _i37: number) => (
                              <Fragment key={chave(_m37, _i37)}>
                                  <tr >
                                    <td >
                                      {t(_m37?.["qtd"])}
                                    </td>
                                    <td >
                                      {t(_m37?.["nome"])}
                                    </td>
                                    <td >
                                      {t(_m37?.["sit"])}
                                    </td>
                                  </tr>
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                  {E(v["rep"]?.["hasLev"]) ? (
                    <>
                      <div >
                        <h4 >
                          {"Orçamento levantado no local"}
                        </h4>
                        <table className={"rep-tbl"}>
                          <thead >
                            <tr >
                              <th className={"z5v"}>
                                {"Qtd."}
                              </th>
                              <th >
                                {"Equipamento / serviço"}
                              </th>
                              <th className={"z5w"}>
                                {"Local / obs."}
                              </th>
                            </tr>
                          </thead>
                          <tbody >
                            {arr(v["rep"]?.["lev"]).map((_l38: any, _i38: number) => (
                              <Fragment key={chave(_l38, _i38)}>
                                  <tr >
                                    <td >
                                      {t(_l38?.["qtd"])}
                                    </td>
                                    <td >
                                      {t(_l38?.["nome"])}
                                    </td>
                                    <td >
                                      {t(_l38?.["obs"])}
                                    </td>
                                  </tr>
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                  <div >
                    <h4 >
                      {"Conferência de material"}
                    </h4>
                    <div className={"z5x"}>
                      <div className={"z5y"}>
                        {"Estoque: "}
                        <strong >
                          {t(v["rep"]?.["confEst"])}
                        </strong>
                      </div>
                      <div className={"z5y"}>
                        {"Técnico: "}
                        <strong >
                          {t(v["rep"]?.["confTec"])}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div >
                    <h4 >
                      {"Histórico"}
                    </h4>
                    <table className={"rep-tbl"}>
                      <tbody >
                        {arr(v["rep"]?.["hist"]).map((_hh39: any, _i39: number) => (
                          <Fragment key={chave(_hh39, _i39)}>
                              <tr >
                                <td className={"z5z"}>
                                  {t(_hh39?.["quando"])}
                                </td>
                                <td className={"z60"}>
                                  {t(_hh39?.["quem"])}
                                </td>
                                <td >
                                  {t(_hh39?.["acao"])}
                                </td>
                              </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={"z61"}>
                    <div className={"sig"}>
                      {"Técnico responsável"}
                    </div>
                    <div className={"sig"}>
                      {"Cliente / responsável no local"}
                    </div>
                    <div className={"sig"}>
                      {"Âncora Segurança Patrimonial"}
                    </div>
                  </div>
                  <div className={"z62"}>
                    {"Âncora Segurança Patrimonial · atendimento@ancoraseguranca.com.br"}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {E(v["hasToast"]) ? (
          <>
            <div className={a(v["toastCls"])} role={"status"} aria-live={"polite"}>
              <span >
                {t(v["toastMsg"])}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
