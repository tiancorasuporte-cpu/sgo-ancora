/**
 * Tickets — marcação da tela (gerada a partir do template original do SGO, sem alterações de layout).
 * Os valores vêm de `renderVals()` da lógica da tela (ver logica.js).
 */
/* eslint-disable */
// @ts-nocheck
import { Fragment } from "react";

import { E, a, arr, chave, css, fn, s, t } from "@/sgo/lib/dc";

export function TicketsView({ v }: { v: any }) {
  return (
    <div className="tela-tickets">
      <div className={"z0"}>
        <header className={"z1"}>
          <div className={"z2"}>
            <div className={"z3"}>
              {"Controle interno · todos os setores da Âncora"}
            </div>
            <div className={"z4"}>
              <div className={"z5"}>
                <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#5A5A5A"} strokeWidth={"2"} strokeLinecap={"round"} className={"z6"}>
                  <circle cx={"11"} cy={"11"} r={"7"} />
                  <path d={"M20 20l-3.5-3.5"} />
                </svg>
                <label htmlFor={"tk-busca"} className={"z7"}>
                  {"Buscar ticket"}
                </label>
                <input id={"tk-busca"} className={"search"} type={"search"} placeholder={"Buscar nº, cliente, código ou assunto"} onChange={fn(v["onSearch"])} />
              </div>
              <span className={"z8"}>
                {"Gravando no banco de teste"}
              </span>
            </div>
          </div>
        </header>
        <div className={"z9"}>
          <div className={"za"}>
            <div className={"z4"}>
              <label htmlFor={"tk-user"} className={"zb"}>
                {t(v["userLbl"])}
              </label>
              {E(v["userEscolhe"]) ? (
                <>
                  <select id={"tk-user"} className={"user-sel"} value={s(v["userId"])} onChange={fn(v["onUser"])}>
                    {arr(v["users"]).map((_u1: any, _i1: number) => (
                      <Fragment key={chave(_u1, _i1)}>
                          <option value={a(_u1?.["id"])}>
                            {t(_u1?.["label"])}
                          </option>
                      </Fragment>
                    ))}
                  </select>
                </>
              ) : null}
              {E(v["userNaoEscolhe"]) ? (
                <>
                  <span style={css("font-weight:700;color:#FFD200")}>
                    {t(v["userFixo"])}
                  </span>
                </>
              ) : null}
            </div>
            <div className={"zc"}>
              {t(v["userHint"])}
            </div>
          </div>
        </div>
        <nav aria-label={"Telas"} className={"zd"}>
          <div className={"ze"}>
            <span className={"tab tab-on"} aria-current={"page"}>
              <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"}>
                <path d={"M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"} />
              </svg>
              {" Tickets"}
            </span>
            <a className={"tab"} href={"/assistencia/os"} target={"_top"}>
              <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                <rect x={"3"} y={"4"} width={"5"} height={"16"} rx={"1"} />
                <rect x={"10"} y={"4"} width={"5"} height={"11"} rx={"1"} />
                <rect x={"17"} y={"4"} width={"4"} height={"7"} rx={"1"} />
              </svg>
              {" Kanban da Assistência (OS)"}
            </a>
          </div>
        </nav>
        <main className={"zf"}>
          <div className={"zg"}>
            {arr(v["kpis"]).map((_k2: any, _i2: number) => (
              <Fragment key={chave(_k2, _i2)}>
                  <div className={"kpi"}>
                    <span className={"flabel"}>
                      {t(_k2?.["label"])}
                    </span>
                    <span className={"zh"}>
                      {t(_k2?.["value"])}
                    </span>
                  </div>
              </Fragment>
            ))}
          </div>
          <div className={"zi"}>
            <div className={"zj"}>
              <div className={"seg"} role={"group"} aria-label={"Fila"}>
                {arr(v["queues"]).map((_qq3: any, _i3: number) => (
                  <Fragment key={chave(_qq3, _i3)}>
                      <button className={a(_qq3?.["cls"])} aria-pressed={a(_qq3?.["on"])} onClick={fn(_qq3?.["pick"])}>
                        {t(_qq3?.["label"])}
                        <span className={"seg-count"}>
                          {t(_qq3?.["count"])}
                        </span>
                      </button>
                  </Fragment>
                ))}
              </div>
              <div className={"seg"} role={"group"} aria-label={"Situação"}>
                {arr(v["statusF"]).map((_sf4: any, _i4: number) => (
                  <Fragment key={chave(_sf4, _i4)}>
                      <button className={a(_sf4?.["cls"])} aria-pressed={a(_sf4?.["on"])} onClick={fn(_sf4?.["pick"])}>
                        {t(_sf4?.["label"])}
                      </button>
                  </Fragment>
                ))}
              </div>
              {E(v["showSetorF"]) ? (
                <>
                  <div className={"zk"}>
                    <label className={"flabel"} htmlFor={"tk-setor"}>
                      {"Setor"}
                    </label>
                    <select id={"tk-setor"} className={"field zl"} value={s(v["setorF"])} onChange={fn(v["onSetorF"])}>
                      <option value={"all"}>
                        {"Todos os setores"}
                      </option>
                      {arr(v["setores"]).map((_st5: any, _i5: number) => (
                        <Fragment key={chave(_st5, _i5)}>
                            <option value={a(_st5?.["id"])}>
                              {t(_st5?.["nome"])}
                            </option>
                        </Fragment>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
            </div>
            <div style={css("display:flex;gap:8px;flex-wrap:wrap;align-items:center")}>
              <button className={"btn-ghost"} disabled={E(v["syncingOmie"])} onClick={fn(v["onSyncCli"])}>
                {t(v["syncCliLabel"] || "Sync clientes")}
              </button>
              <button className={"btn-adv"} onClick={fn(v["openNew"])}>
                <svg aria-hidden={"true"} width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.6"} strokeLinecap={"round"}>
                  <path d={"M12 5v14M5 12h14"} />
                </svg>
                {" Novo ticket"}
              </button>
            </div>
          </div>
          <div className={"zm"}>
            <section aria-label={"Lista de tickets"} className={"zn"}>
              <div className={"zo"}>
                {t(v["listTitle"])}
              </div>
              {arr(v["list"]).map((_t6: any, _i6: number) => (
                <Fragment key={chave(_t6, _i6)}>
                    <button className={a(_t6?.["cls"])} onClick={fn(_t6?.["pick"])} aria-label={a(("Ticket " + s(_t6?.["num"]) + ": " + s(_t6?.["catNome"]) + ", " + s(_t6?.["cliente"])))}>
                      <span className={"zp"}>
                        <span className={"zq"}>
                          {t(_t6?.["num"])}
                        </span>
                        <span className={a(_t6?.["statusCls"])}>
                          {t(_t6?.["statusNome"])}
                        </span>
                        <span className={a(_t6?.["prioCls"])}>
                          {t(_t6?.["prio"])}
                        </span>
                        <span className={"zr"}>
                          {t(_t6?.["idade"])}
                        </span>
                      </span>
                      <span className={"zs"}>
                        {t(_t6?.["catNome"])}
                      </span>
                      <span className={"zt"}>
                        {t(_t6?.["cliente"])}
                      </span>
                      <span className={"zu"}>
                        {arr(_t6?.["setorChips"]).map((_sc7: any, _i7: number) => (
                          <Fragment key={chave(_sc7, _i7)}>
                              <span className={a(_sc7?.["cls"])}>
                                {t(_sc7?.["nome"])}
                              </span>
                          </Fragment>
                        ))}
                      </span>
                    </button>
                </Fragment>
              ))}
              {E(v["listEmpty"]) ? (
                <>
                  <div className={"zv"}>
                    {"Nenhum ticket nesta fila."}
                  </div>
                </>
              ) : null}
            </section>
            <section aria-label={"Detalhe do ticket"} className={"zw"}>
              {E(v["hasSel"]) ? (
                <>
                  <div className={"zx"}>
                    <div className={"zp"}>
                      <span className={"zy"}>
                        {t(v["sel"]?.["num"])}
                      </span>
                      <span className={a(v["sel"]?.["statusCls"])}>
                        {t(v["sel"]?.["statusNome"])}
                      </span>
                      <span className={a(v["sel"]?.["prioCls"])}>
                        {t(("Prioridade " + s(v["sel"]?.["prio"])))}
                      </span>
                    </div>
                    <div className={"zz"}>
                      {t(v["sel"]?.["catNome"])}
                    </div>
                    <div className={"z10"}>
                      {t(v["sel"]?.["cliente"])}
                    </div>
                  </div>
                  <div className={"z11"}>
                    <div className={"z12"}>
                      <div className={"z13"}>
                        <span className={"flabel"}>
                          {"Aberto por"}
                        </span>
                        <span className={"z14"}>
                          {t(v["sel"]?.["abertoPor"])}
                        </span>
                      </div>
                      <div className={"z13"}>
                        <span className={"flabel"}>
                          {"Aberto em"}
                        </span>
                        <span className={"z14"}>
                          {t(v["sel"]?.["criado"])}
                        </span>
                      </div>
                      <div className={"z13"}>
                        <span className={"flabel"}>
                          {"Contato"}
                        </span>
                        <span className={"z14"}>
                          {t(v["sel"]?.["contato"])}
                        </span>
                      </div>
                      <div className={"z13"}>
                        <span className={"flabel"}>
                          {"Responsável"}
                        </span>
                        <span className={"z14"}>
                          {t(v["sel"]?.["resp"])}
                        </span>
                      </div>
                    </div>
                    <div className={"z15"}>
                      <span className={"flabel"}>
                        {"Setores envolvidos"}
                      </span>
                      <div className={"z16"}>
                        {arr(v["sel"]?.["setorChips"]).map((_sc8: any, _i8: number) => (
                          <Fragment key={chave(_sc8, _i8)}>
                              <span className={a((s(_sc8?.["cls"]) + " z17"))}>
                                {t(_sc8?.["nome"])}
                              </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <div className={"z18"}>
                      <span className={"flabel"}>
                        {"Descrição"}
                      </span>
                      <div className={"z19"}>
                        {t(v["sel"]?.["desc"])}
                      </div>
                    </div>
                    {E(v["sel"]?.["hasLev"]) ? (
                      <>
                        <div className={"z15"}>
                          <div className={"z1a"}>
                            <span className={"flabel"}>
                              {"Itens levantados pelo técnico"}
                            </span>
                            <span className={"z1b"}>
                              {t(v["sel"]?.["levOrigem"])}
                            </span>
                          </div>
                          <div className={"z1c"}>
                            <div className={"z1d"}>
                              <span >
                                {"Qtd."}
                              </span>
                              <span >
                                {"Equipamento / serviço"}
                              </span>
                              <span >
                                {"Local / obs."}
                              </span>
                            </div>
                            {arr(v["sel"]?.["levItens"]).map((_lv9: any, _i9: number) => (
                              <Fragment key={chave(_lv9, _i9)}>
                                  <div className={"z1e"}>
                                    <span className={"z1f"}>
                                      {t(_lv9?.["qtd"])}
                                    </span>
                                    <span >
                                      {t(_lv9?.["nome"])}
                                    </span>
                                    <span className={"z1g"}>
                                      {t(_lv9?.["obs"])}
                                    </span>
                                  </div>
                              </Fragment>
                            ))}
                            {E(v["sel"]?.["hasLevObs"]) ? (
                              <>
                                <div className={"z1h"}>
                                  {t(("Observações do técnico: " + s(v["sel"]?.["levObs"])))}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : null}
                    {E(v["sel"]?.["hasOs"]) ? (
                      <>
                        <div className={"z1i"}>
                          <div className={"z1j"}>
                            <span className={"z1k"}>
                              {t(("OS " + s(v["sel"]?.["os"]) + " aberta a partir deste ticket"))}
                            </span>
                            <span className={"zt"}>
                              {t((s(v["sel"]?.["osTipo"]) + " · acompanhe no Kanban da Assistência"))}
                            </span>
                          </div>
                          <a className={"btn-dark"} href={"/assistencia/os"} target={"_top"}>
                            {"Ver no Kanban"}
                          </a>
                        </div>
                      </>
                    ) : null}
                    <div className={"z1l"}>
                      <h3 className={"z1m"}>
                        {"Histórico"}
                      </h3>
                      {arr(v["sel"]?.["timeline"]).map((_ev10: any, _i10: number) => (
                        <Fragment key={chave(_ev10, _i10)}>
                            <div className={"z1n"}>
                              <span className={a(_ev10?.["dotCls"])} aria-hidden={"true"}>
                                <svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                                  <circle cx={"12"} cy={"12"} r={"3"} />
                                </svg>
                              </span>
                              <div className={"z1o"}>
                                <div className={"z1p"}>
                                  <span className={"z1q"}>
                                    {t(_ev10?.["titulo"])}
                                  </span>
                                  <span className={"z1r"}>
                                    {t((s(_ev10?.["quando"]) + " · " + s(_ev10?.["quem"])))}
                                  </span>
                                </div>
                                {E(_ev10?.["hasTexto"]) ? (
                                  <>
                                    <div className={"z1s"}>
                                      {t(_ev10?.["texto"])}
                                    </div>
                                  </>
                                ) : null}
                                {E(_ev10?.["hasAnexos"]) ? (
                                  <>
                                    <div className={"z1t"}>
                                      {arr(_ev10?.["anexos"]).map((_ax11: any, _i11: number) => (
                                        <Fragment key={chave(_ax11, _i11)}>
                                            {E(_ax11?.["hasUrl"]) ? (
                                              <>
                                                <img className={"thumb"} src={a(_ax11?.["url"])} alt={a(_ax11?.["name"])} />
                                              </>
                                            ) : null}
                                            {E(_ax11?.["noUrl"]) ? (
                                              <>
                                                <span className={"file-chip"}>
                                                  <svg aria-hidden={"true"} width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinejoin={"round"}>
                                                    <rect x={"3"} y={"3"} width={"18"} height={"18"} rx={"2"} />
                                                    <circle cx={"9"} cy={"9"} r={"2"} />
                                                    <path d={"M21 15l-5-5L5 21"} />
                                                  </svg>
                                                  {t((" " + s(_ax11?.["name"])))}
                                                </span>
                                              </>
                                            ) : null}
                                        </Fragment>
                                      ))}
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                        </Fragment>
                      ))}
                    </div>
                    <div className={"z1u"}>
                      <div role={"group"} aria-label={"Ações do ticket"} className={"z1t"}>
                        {arr(v["sel"]?.["actions"]).map((_ac12: any, _i12: number) => (
                          <Fragment key={chave(_ac12, _i12)}>
                              <button className={a(_ac12?.["cls"])} aria-pressed={a(_ac12?.["on"])} onClick={fn(_ac12?.["pick"])}>
                                {t(_ac12?.["label"])}
                              </button>
                          </Fragment>
                        ))}
                      </div>
                      {E(v["sel"]?.["hasNote"]) ? (
                        <>
                          <div className={"z1v"}>
                            {t(v["sel"]?.["note"])}
                          </div>
                        </>
                      ) : null}
                      {E(v["form"]?.["show"]) ? (
                        <>
                          <div className={"z1w"}>
                            {E(v["form"]?.["isFwd"]) ? (
                              <>
                                <div className={"z15"}>
                                  <span className={"flabel"}>
                                    {"Encaminhar para"}
                                  </span>
                                  <div className={"z16"}>
                                    {arr(v["form"]?.["fwdOpts"]).map((_fo13: any, _i13: number) => (
                                      <Fragment key={chave(_fo13, _i13)}>
                                          <button className={a(_fo13?.["cls"])} aria-pressed={a(_fo13?.["on"])} onClick={fn(_fo13?.["pick"])}>
                                            {t(_fo13?.["nome"])}
                                          </button>
                                      </Fragment>
                                    ))}
                                  </div>
                                  {E(v["form"]?.["canRemoveMine"]) ? (
                                    <>
                                      <label className={"chk"} htmlFor={"fwd-rm"}>
                                        <input id={"fwd-rm"} type={"checkbox"} checked={E(v["form"]?.["removeMine"])} onChange={fn(v["form"]?.["onRemoveMine"])} />
                                        {t(("Retirar meu setor (" + s(v["form"]?.["mySetor"]) + ") do ticket"))}
                                      </label>
                                    </>
                                  ) : null}
                                </div>
                              </>
                            ) : null}
                            {E(v["form"]?.["isOs"]) ? (
                              <>
                                <div className={"z1x"}>
                                  <span className={"flabel"}>
                                    {"Tipo de OS"}
                                  </span>
                                  <div role={"radiogroup"} aria-label={"Tipo de OS"} className={"z1y"}>
                                    {arr(v["form"]?.["osTipos"]).map((_ot14: any, _i14: number) => (
                                      <Fragment key={chave(_ot14, _i14)}>
                                          <button className={a(_ot14?.["cls"])} role={"radio"} aria-checked={a(_ot14?.["on"])} onClick={fn(_ot14?.["pick"])}>
                                            <span className={"eq-dot"} aria-hidden={"true"}>
                                            </span>
                                            <span className={"z1z"}>
                                              <span className={"z1q"}>
                                                {t(_ot14?.["label"])}
                                              </span>
                                              <span className={"z20"}>
                                                {t(_ot14?.["info"])}
                                              </span>
                                            </span>
                                          </button>
                                      </Fragment>
                                    ))}
                                  </div>
                                  {E(v["form"]?.["osHasSub"]) ? (
                                    <>
                                      <div className={"z18"}>
                                        <label className={"flabel"} htmlFor={"os-sub"}>
                                          {t(v["form"]?.["osSubLabel"])}
                                        </label>
                                        <select id={"os-sub"} className={"field"} value={s(v["form"]?.["osSub"])} onChange={fn(v["form"]?.["onOsSub"])}>
                                          <option value={""}>
                                            {"Selecione"}
                                          </option>
                                          {arr(v["form"]?.["subs"]).map((_sb15: any, _i15: number) => (
                                            <Fragment key={chave(_sb15, _i15)}>
                                                <option value={a(_sb15)}>
                                                  {t(_sb15)}
                                                </option>
                                            </Fragment>
                                          ))}
                                        </select>
                                      </div>
                                    </>
                                  ) : null}
                                  {E(v["form"]?.["osIsPedido"]) ? (
                                    <>
                                      <div className={"z18"}>
                                        <label className={"flabel"} htmlFor={"os-orc"}>
                                          {"Nº do orçamento aprovado"}
                                        </label>
                                        <input id={"os-orc"} className={"field"} type={"text"} placeholder={"Ex.: ORC-2026-00150"} value={s(v["form"]?.["osOrc"])} onChange={fn(v["form"]?.["onOsOrc"])} />
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </>
                            ) : null}
                            <div className={"z18"}>
                              <label className={"flabel"} htmlFor={"tk-texto"}>
                                {t(v["form"]?.["textLabel"])}
                              </label>
                              <textarea id={"tk-texto"} className={"field z21"} rows={"4"} placeholder={a(v["form"]?.["textPh"])} value={s(v["form"]?.["text"])} onChange={fn(v["form"]?.["onText"])}>
                              </textarea>
                            </div>
                            {E(v["form"]?.["allowFiles"]) ? (
                              <>
                                <div className={"z15"}>
                                  <label className={"flabel"} htmlFor={"tk-files"}>
                                    {"Prints / anexos"}
                                  </label>
                                  <input id={"tk-files"} type={"file"} accept={"image/*,.pdf"} multiple={E(v["true"])} onChange={fn(v["form"]?.["onFiles"])} className={"z22"} />
                                  {E(v["form"]?.["hasFiles"]) ? (
                                    <>
                                      <div className={"z1t"}>
                                        {arr(v["form"]?.["files"]).map((_ff16: any, _i16: number) => (
                                          <Fragment key={chave(_ff16, _i16)}>
                                              <span className={"file-chip"}>
                                                {t(_ff16?.["name"])}
                                              </span>
                                          </Fragment>
                                        ))}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </>
                            ) : null}
                            {E(v["form"]?.["hasErr"]) ? (
                              <>
                                <div role={"alert"} className={"z23"}>
                                  {t(v["form"]?.["err"])}
                                </div>
                              </>
                            ) : null}
                            <div className={"z24"}>
                              <button className={"btn-ghost"} onClick={fn(v["form"]?.["cancel"])}>
                                {"Cancelar"}
                              </button>
                              <button className={"btn-adv"} onClick={fn(v["form"]?.["submit"])}>
                                {t(v["form"]?.["submitLabel"])}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
              {E(v["noSel"]) ? (
                <>
                  <div className={"z25"}>
                    {"Selecione um ticket na lista para ver os detalhes."}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        </main>
        {E(v["hasNew"]) ? (
          <>
            <div className={"z26"}>
              <div role={"dialog"} aria-modal={"true"} aria-label={"Novo ticket"} className={"z27"}>
                <div className={"z28"}>
                  <div className={"z1j"}>
                    <span className={"z29"}>
                      {t((s(v["nt"]?.["num"]) + " · aberto por " + s(v["nt"]?.["por"])))}
                    </span>
                    <span className={"z2a"}>
                      {"Novo ticket"}
                    </span>
                  </div>
                  <button className={"x-btn z2b"} onClick={fn(v["closeNew"])} aria-label={"Cancelar"}>
                    <svg aria-hidden={"true"} width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"}>
                      <path d={"M6 6l12 12M18 6L6 18"} />
                    </svg>
                  </button>
                </div>
                <div className={"z2c"}>
                  <div className={"z2d"}>
                    <div className={"z18"}>
                      <label className={"flabel"} htmlFor={"nt-cat"}>
                        {"Assunto"}
                      </label>
                      <select id={"nt-cat"} className={"field"} value={s(v["nt"]?.["cat"])} onChange={fn(v["nt"]?.["onCat"])}>
                        <option value={""}>
                          {"Selecione"}
                        </option>
                        {arr(v["nt"]?.["cats"]).map((_ct17: any, _i17: number) => (
                          <Fragment key={chave(_ct17, _i17)}>
                              <option value={a(_ct17?.["id"])}>
                                {t(_ct17?.["nome"])}
                              </option>
                          </Fragment>
                        ))}
                      </select>
                    </div>
                    <div className={"z18"}>
                      <label className={"flabel"} htmlFor={"nt-prio"}>
                        {"Prioridade"}
                      </label>
                      <select id={"nt-prio"} className={"field"} value={s(v["nt"]?.["prio"])} onChange={fn(v["nt"]?.["onPrio"])}>
                        <option value={"Baixa"}>
                          {"Baixa"}
                        </option>
                        <option value={"Normal"}>
                          {"Normal"}
                        </option>
                        <option value={"Alta"}>
                          {"Alta"}
                        </option>
                        <option value={"Urgente"}>
                          {"Urgente"}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className={"z2e"}>
                    <div className={"z18"}>
                      <label className={"flabel"} htmlFor={"nt-cod"}>
                        {"Código do cliente"}
                      </label>
                      <input id={"nt-cod"} className={"field"} type={"text"} placeholder={"Ex.: 1000"} value={s(v["nt"]?.["cod"])} onChange={fn(v["nt"]?.["onCod"])} />
                    </div>
                    <div className={"z18"}>
                      <label className={"flabel"} htmlFor={"nt-cli"}>
                        {"Cliente"}
                      </label>
                      <input id={"nt-cli"} className={"field"} type={"text"} placeholder={"Digite nome ou CNPJ/CPF (Omie)"} autoComplete={"off"} value={s(v["nt"]?.["cli"])} onChange={fn(v["nt"]?.["onCli"])} />
                    </div>
                  </div>
                  <div className={"z18"}>
                    <label className={"flabel"} htmlFor={"nt-contato"}>
                      {"Contato (quem falou com a Âncora)"}
                    </label>
                    <input id={"nt-contato"} className={"field"} type={"text"} placeholder={"Ex.: o próprio cliente, por telefone"} value={s(v["nt"]?.["contato"])} onChange={fn(v["nt"]?.["onContato"])} />
                  </div>
                  <div className={"z18"}>
                    <label className={"flabel"} htmlFor={"nt-desc"}>
                      {"Descrição"}
                    </label>
                    <textarea id={"nt-desc"} className={"field z21"} rows={"3"} placeholder={"O que foi relatado?"} value={s(v["nt"]?.["desc"])} onChange={fn(v["nt"]?.["onDesc"])}>
                    </textarea>
                  </div>
                  <div className={"z15"}>
                    <span className={"flabel"}>
                      {"Setores responsáveis (um ou mais)"}
                    </span>
                    <div className={"z16"}>
                      {arr(v["nt"]?.["setorOpts"]).map((_so18: any, _i18: number) => (
                        <Fragment key={chave(_so18, _i18)}>
                            <button className={a(_so18?.["cls"])} aria-pressed={a(_so18?.["on"])} onClick={fn(_so18?.["pick"])}>
                              {t(_so18?.["nome"])}
                            </button>
                        </Fragment>
                      ))}
                    </div>
                    <span className={"z2f"}>
                      {"O assunto já sugere os setores; ajuste se precisar envolver mais alguém."}
                    </span>
                  </div>
                  <div className={"z15"}>
                    <label className={"flabel"} htmlFor={"nt-files"}>
                      {"Prints / anexos (opcional)"}
                    </label>
                    <input id={"nt-files"} type={"file"} accept={"image/*,.pdf"} multiple={E(v["true"])} onChange={fn(v["nt"]?.["onFiles"])} className={"z22"} />
                  </div>
                  {E(v["nt"]?.["hasErr"]) ? (
                    <>
                      <div role={"alert"} className={"z23"}>
                        {t(v["nt"]?.["err"])}
                      </div>
                    </>
                  ) : null}
                  <div className={"z2g"}>
                    <button className={"btn-ghost z2h"} onClick={fn(v["closeNew"])}>
                      {"Cancelar"}
                    </button>
                    <button className={"btn-adv"} onClick={fn(v["nt"]?.["confirm"])}>
                      {"Abrir ticket"}
                    </button>
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
              {E(v["toastKanban"]) ? (
                <>
                  <a href={"/assistencia/os"} target={"_top"}>
                    {"Abrir Kanban"}
                  </a>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
