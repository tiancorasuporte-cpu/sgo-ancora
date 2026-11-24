/* Lógica original da tela do SGO (executada pelo motor de telas isoladas: src/sgo/lib/tela-isolada.ts). */

"use strict";
var S = { eq: [], tec: [], f: "ativas", q: "", m: null };
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function ini(n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
function toast(t) { var e = $(".toast"); if (e) e.remove(); e = document.createElement("div"); e.className = "toast"; e.setAttribute("role", "status"); e.textContent = t; document.body.appendChild(e); setTimeout(function () { e.remove(); }, 2800); }
function api(m, u, b) { return fetch(u, { method: m, credentials: "same-origin", headers: { "content-type": "application/json", "x-sgo": "1" }, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || "Erro " + r.status); return j; }); }); }
function dt(ms) { return ms ? new Date(ms).toLocaleDateString("pt-BR") : ""; }
var ICO = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.7.8 3 2.6 3.5 5.5"/></svg>';
function carregar() { return api("GET", "/api/equipes-tecnicas").then(function (d) { S.eq = d.equipes; S.tec = d.tecnicos; desenhar(); }).catch(function (e) { $("#lista").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }); }
function equipesDe(id) { return S.eq.filter(function (e) { return e.ativo && e.membros.some(function (m) { return m.id === id; }); }); }
function desenhar() {
  var ativas = S.eq.filter(function (e) { return e.ativo; }), tecAt = S.tec.filter(function (t) { return t.ativo; });
  var livres = tecAt.filter(function (t) { return !equipesDe(t.id).length; });
  $("#kpis").innerHTML = '<div class="kpi"><b>' + ativas.length + '</b><span>equipes ativas</span></div><div class="kpi"><b>' + tecAt.length + '</b><span>técnicos ativos</span></div><div class="kpi' + (livres.length ? " alerta" : "") + '"><b>' + livres.length + '</b><span>técnicos sem equipe</span></div><div class="kpi"><b>' + ativas.filter(function (e) { return e.membros.length > 1; }).length + '</b><span>equipes com mais de um técnico</span></div>';
  var q = norm(S.q);
  var l = S.eq.filter(function (e) { return S.f === "todas" || (S.f === "ativas") === e.ativo; }).filter(function (e) { return !q || norm(e.nome + " " + e.membros.map(function (m) { return m.nome; }).join(" ")).indexOf(q) >= 0; });
  if (!S.eq.length) $("#lista").innerHTML = '<div class="vazio">' + ICO + '<b>Nenhuma equipe técnica ainda</b><span>Crie a primeira equipe e vincule os técnicos.</span><button type="button" class="btn btn-y" data-novo>+ Nova equipe técnica</button></div>';
  else if (!l.length) $("#lista").innerHTML = '<div class="vazio">Nenhuma equipe ' + (S.f === "inativas" ? "inativa" : S.f === "ativas" ? "ativa" : "") + (S.q ? " com “" + esc(S.q) + "”" : "") + ".</div>";
  else $("#lista").innerHTML = '<div class="grade">' + l.map(card).join("") + "</div>";
  $("#livres").innerHTML = livres.length ? '<div class="livres"><h3>Técnicos sem equipe</h3><span class="dica">Eles não recebem OS enquanto não estiverem em uma equipe ativa.</span><div class="chips">' + livres.map(function (t) { return '<span class="chip">' + esc(t.nome) + "</span>"; }).join("") + "</div></div>" : "";
  $$("[data-ed]").forEach(function (b) { b.onclick = function () { abrir(S.eq.filter(function (e) { return e.id === +b.dataset.ed; })[0]); }; });
  $$("[data-novo]").forEach(function (b) { b.onclick = function () { abrir(null); }; });
}
function card(e) {
  var p = e.membros.filter(function (m) { return m.principal; })[0], outros = e.membros.filter(function (m) { return !m.principal; });
  return '<article class="eq' + (e.ativo ? "" : " off") + '"><div class="eq-top"><span class="eq-ic">' + ICO + '</span><div><div class="eq-nome">' + esc(e.nome) + '</div><div class="eq-sub">' + e.membros.length + (e.membros.length === 1 ? " técnico" : " técnicos") + '</div></div><span class="st ' + (e.ativo ? "st-on" : "st-off") + '">' + (e.ativo ? "Ativa" : "Inativa") + "</span></div>" +
    (p ? '<div class="pri"><span class="av">' + esc(ini(p.nome)) + '</span><div><b>' + esc(p.nome) + '</b><small>Recebe as OS no App do Técnico</small></div><span class="tag">Principal</span></div>' : "") +
    (!e.principalAtivo ? '<div class="aviso">O técnico principal está desativado em Usuários. Escolha outro principal.</div>' : "") +
    (outros.length ? '<div class="membros">' + outros.map(function (m) { return '<div class="mb"><span class="av sm">' + esc(ini(m.nome)) + "</span>" + esc(m.nome) + (m.ativo ? "" : ' <span class="x">· desativado</span>') + "</div>"; }).join("") + "</div>" : '<div class="dica">Equipe de um técnico só.</div>') +
    (e.obs ? '<div class="dica">' + esc(e.obs) + "</div>" : "") +
    '<div class="eq-foot"><span>' + (e.atualizado_em ? "Alterada em " + dt(e.atualizado_em) + (e.atualizado_por && e.atualizado_por !== "migracao" ? " por " + esc(e.atualizado_por) : "") : "") + '</span><button type="button" class="btn" data-ed="' + e.id + '">Editar equipe</button></div></article>';
}
// ===== modal =====
function abrir(e) {
  S.m = { id: e ? e.id : null, versao: e ? e.versao : 0, nome: e ? e.nome : "", ativo: e ? e.ativo : true, obs: e ? e.obs : "", membros: e ? e.membros.map(function (m) { return m.id; }) : [], principal: e ? e.principal_id : null, busca: false, err: "" };
  var f = document.createElement("div"); f.className = "fundo"; f.id = "fundo";
  f.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t"><div class="m-topo"><div><div class="k">Assistência Técnica</div><h2 id="m-t">' + (e ? "Editar equipe técnica" : "Nova equipe técnica") + '</h2></div><button type="button" class="xb" data-fechar aria-label="Fechar">×</button></div><div class="m-corpo" id="m-corpo"></div><div class="m-acoes"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-d" id="m-ok">' + (e ? "Salvar alterações" : "Criar equipe") + "</button></div></div>";
  document.body.appendChild(f);
  $$("[data-fechar]", f).forEach(function (b) { b.onclick = fechar; });
  f.addEventListener("keydown", function (ev) { if (ev.key === "Escape") fechar(); });
  $("#m-ok").onclick = salvar;
  corpo();
  setTimeout(function () { var n = $("#m-nome"); if (n) n.focus(); }, 30);
}
function fechar() { var f = $("#fundo"); if (f) f.remove(); S.m = null; }
function tecPorId(id) { return S.tec.filter(function (t) { return t.id === id; })[0]; }
function corpo() {
  var m = S.m;
  if (m.membros.length && m.membros.indexOf(m.principal) < 0) m.principal = m.membros[0];
  var h = (m.err ? '<div class="err" role="alert">' + esc(m.err) + "</div>" : "") +
    '<label class="flabel" for="m-nome">Nome da equipe</label><input id="m-nome" class="field" maxlength="40" placeholder="Ex.: Equipe Guilherme" value="' + esc(m.nome) + '"><span class="dica">É assim que a equipe aparece na OS, na agenda e no App do Técnico.</span>' +
    '<div class="flabel">Técnicos da equipe</div>';
  if (!m.membros.length) h += '<div class="dica">Nenhum técnico vinculado ainda.</div>';
  else h += '<div class="sel">' + m.membros.map(function (id) { var t = tecPorId(id) || { nome: "?", ativo: false }, p = id === m.principal, outras = equipesDe(id).filter(function (e) { return e.id !== m.id; }); return '<div class="sl' + (p ? " p" : "") + '"><span class="av' + (p ? "" : " sm") + '">' + esc(ini(t.nome)) + '</span><span class="nm">' + esc(t.nome) + "<small>" + (t.ativo ? "" : "Desativado em Usuários · ") + (outras.length ? "Também em " + esc(outras.map(function (e) { return e.nome; }).join(", ")) : p ? "Recebe as OS desta equipe no app" : "Acompanha o principal") + '</small></span><label class="rp"><input type="radio" name="m-pri" value="' + id + '"' + (p ? " checked" : "") + (t.ativo ? "" : " disabled") + '>Principal</label><button type="button" class="rm" data-rm="' + id + '" aria-label="Tirar ' + esc(t.nome) + ' da equipe">Tirar</button></div>'; }).join("") + "</div>";
  var disp = S.tec.filter(function (t) { return t.ativo && m.membros.indexOf(t.id) < 0; });
  if (m.busca) h += '<div class="lista" role="group" aria-label="Técnicos para vincular">' + (disp.length ? disp.map(function (t) { var em = equipesDe(t.id); return '<label class="op"><input type="checkbox" data-add="' + t.id + '">' + esc(t.nome) + '<span class="em">' + (em.length ? "em " + esc(em.map(function (e) { return e.nome; }).join(", ")) : "sem equipe") + "</span></label>"; }).join("") : '<div class="op" style="cursor:default">Todos os técnicos ativos já estão nesta equipe. Para cadastrar outro, use Usuários com o perfil Técnico.</div>') + '</div><div><button type="button" class="btn btn-y" id="m-vinc">Vincular selecionados</button> <button type="button" class="btn" id="m-cancb">Fechar lista</button></div>';
  else h += '<div><button type="button" class="btn" id="m-busca"' + (m.membros.length >= 10 ? " disabled" : "") + '>+ Vincular técnico</button></div><span class="dica">A maioria das equipes tem um técnico só. Vincule mais quando alguém acompanhar o principal.</span>';
  h += '<label class="flabel" for="m-obs">Observação (opcional)</label><textarea id="m-obs" class="field" rows="2" maxlength="500" placeholder="Ex.: carro 2, atende Franca e região">' + esc(m.obs) + "</textarea>" +
    '<label class="chk"><input type="checkbox" id="m-ativo"' + (m.ativo ? " checked" : "") + '>Equipe ativa (aparece na hora de agendar e executar a OS)</label>';
  $("#m-corpo").innerHTML = h;
  $("#m-nome").oninput = function () { m.nome = this.value; };
  $("#m-obs").oninput = function () { m.obs = this.value; };
  $("#m-ativo").onchange = function () { m.ativo = this.checked; };
  $$('input[name="m-pri"]').forEach(function (r) { r.onchange = function () { m.principal = +r.value; corpo(); }; });
  $$("[data-rm]").forEach(function (b) { b.onclick = function () { var id = +b.dataset.rm; m.membros = m.membros.filter(function (x) { return x !== id; }); corpo(); }; });
  var bb = $("#m-busca"); if (bb) bb.onclick = function () { m.busca = true; corpo(); };
  var bc = $("#m-cancb"); if (bc) bc.onclick = function () { m.busca = false; corpo(); };
  var bv = $("#m-vinc"); if (bv) bv.onclick = function () { var sel = $$("[data-add]:checked").map(function (c) { return +c.dataset.add; }); if (!sel.length) { toast("Marque pelo menos um técnico."); return; } m.membros = m.membros.concat(sel).slice(0, 10); if (!m.principal) m.principal = m.membros[0]; m.busca = false; corpo(); };
}
function salvar() {
  var m = S.m, b = $("#m-ok");
  m.nome = $("#m-nome").value.trim();
  if (!m.nome) { m.err = "Informe o nome da equipe."; corpo(); return; }
  if (!m.membros.length) { m.err = "Vincule pelo menos um técnico."; corpo(); return; }
  b.disabled = true;
  api(m.id ? "PUT" : "POST", "/api/equipes-tecnicas" + (m.id ? "/" + m.id : ""), { nome: m.nome, membros: m.membros, principal_id: m.principal, ativo: m.ativo, obs: m.obs, versao: m.versao })
    .then(function (r) { var novo = !m.id; fechar(); toast((novo ? "Equipe criada: " : "Equipe salva: ") + r.item.nome + " · principal " + r.item.principal); return carregar(); })
    .catch(function (e) { b.disabled = false; m.err = e.message; corpo(); });
}
$$(".seg button").forEach(function (b) { b.onclick = function () { S.f = b.dataset.f; $$(".seg button").forEach(function (z) { z.classList.toggle("on", z === b); z.setAttribute("aria-pressed", z === b); }); desenhar(); }; });
$("#q").oninput = function () { S.q = this.value.trim(); desenhar(); };
$("#b-nova").onclick = function () { abrir(null); };
carregar();

