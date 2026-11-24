/* Lógica original da tela do SGO (executada pelo motor de telas isoladas: src/sgo/lib/tela-isolada.ts). */

"use strict";
var TIPOS = { pedido: { nome: "Pedido · instalação", curto: "Pedido", c: "var(--t-pedido)" }, manut: { nome: "Manutenção", curto: "Manut.", c: "var(--t-manut)" }, monit: { nome: "Monitoramento", curto: "Monit.", c: "var(--t-monit)" }, visita: { nome: "Orçamento · visita", curto: "Orç.", c: "var(--t-visita)" } };
var ORDEM = ["pedido", "manut", "monit", "visita"];
var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
var hoje = new Date(), S = { ano: hoje.getFullYear(), mes: hoje.getMonth(), d: null, aba: "tec", f: { tipo: "", equipe: "", tec: "", aux: "" } };
try { var u = new URLSearchParams(location.search).get("mes"); if (/^\d{4}-\d{2}$/.test(u)) { S.ano = +u.slice(0, 4); S.mes = +u.slice(5) - 1; } } catch (e) {}
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function brl(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function pad(n) { return (n < 10 ? "0" : "") + n; }
function horas(min) { min = Math.round(min || 0); return Math.floor(min / 60) + "h" + pad(min % 60); }
function ini(n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
function dbr(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : ""; }
function api(u) { return fetch(u, { credentials: "same-origin", headers: { "x-sgo": "1" } }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || "Erro " + r.status); return j; }); }); }
function periodo() { var de = S.ano + "-" + pad(S.mes + 1) + "-01", ult = new Date(S.ano, S.mes + 1, 0).getDate(); return { de: de, ate: S.ano + "-" + pad(S.mes + 1) + "-" + pad(ult) }; }
function carregar() {
  $("#m-txt").textContent = MESES[S.mes] + " " + S.ano;
  $("#corpo").innerHTML = '<div class="vazio">Carregando…</div>';
  var p = periodo();
  api("/api/relatorios/os?de=" + p.de + "&ate=" + p.ate).then(function (d) { S.d = d; opcoes(); desenhar(); }).catch(function (e) { $("#corpo").innerHTML = '<div class="erro">' + esc(e.message) + "</div>"; });
}
function uniq(l) { var o = []; l.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return o.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }); }
function opcoes() {
  var os = S.d.os;
  function fill(id, vals, rot, cur) { var s = $(id); s.innerHTML = '<option value="">' + rot + "</option>" + vals.map(function (v) { return '<option value="' + esc(v[0]) + '"' + (v[0] === cur ? " selected" : "") + ">" + esc(v[1]) + "</option>"; }).join(""); }
  fill("#f-tipo", ORDEM.map(function (t) { return [t, TIPOS[t].nome]; }), "Todos os tipos", S.f.tipo);
  fill("#f-equipe", uniq(os.map(function (o) { return o.equipe; })).map(function (x) { return [x, x]; }), "Todas as equipes", S.f.equipe);
  fill("#f-tec", uniq([].concat.apply([], os.map(function (o) { return o.pessoas; }))).map(function (x) { return [x, x]; }), "Todos os técnicos", S.f.tec);
  fill("#f-aux", uniq(os.map(function (o) { return o.auxiliar; })).map(function (x) { return [x, x]; }), "Todos os auxiliares", S.f.aux);
}
function filtradas() { var f = S.f; return S.d.os.filter(function (o) { return (!f.tipo || o.tipo === f.tipo) && (!f.equipe || o.equipe === f.equipe) && (!f.tec || o.pessoas.indexOf(f.tec) >= 0) && (!f.aux || o.auxiliar === f.aux); }); }
function soma(l, k) { return l.reduce(function (s, o) { return s + (o[k] || 0); }, 0); }
function porTipo(l) { var r = {}; ORDEM.forEach(function (t) { r[t] = 0; }); l.forEach(function (o) { r[o.tipo] = (r[o.tipo] || 0) + 1; }); return r; }
function mini(l) { var t = porTipo(l); return '<div class="mini">' + ORDEM.filter(function (k) { return t[k]; }).map(function (k) { return '<span style="--c:' + TIPOS[k].c + '" title="' + TIPOS[k].nome + '">' + t[k] + " " + TIPOS[k].curto + "</span>"; }).join("") + "</div>"; }
function agrupar(l, chave) { var m = {}; l.forEach(function (o) { chave(o).forEach(function (k) { if (!k) return; (m[k] = m[k] || []).push(o); }); }); return Object.keys(m).map(function (k) { return { nome: k, os: m[k] }; }); }
function desenhar() {
  var l = filtradas(), mo = soma(l, "valorMO"), min = soma(l, "minutos"), orc = soma(l, "valorOrc"), aj = l.filter(function (o) { return o.ajuste; }).length;
  var semFech = l.filter(function (o) { return !o.fechado; }).length;
  $("#alerta").innerHTML = (S.d.pendentes ? '<div class="alerta">⚠ ' + S.d.pendentes + (S.d.pendentes === 1 ? " OS executada aguarda" : " OS executadas aguardam") + ' o fechamento da Assistência (tempo e mão de obra). Elas entram no relatório quando forem finalizadas. <a href="#" data-ir="/assistencia/os">Abrir Quadro de OS</a></div>' : "") +
    (semFech ? '<div class="alerta" style="margin-top:8px">' + semFech + (semFech === 1 ? " OS foi finalizada" : " OS foram finalizadas") + " antes do fechamento com mão de obra (sem valor).</div>" : "");
  $("#kpis").innerHTML = '<div class="kpi dark"><span>Total produzido no mês</span><b>' + brl(mo + orc) + '</b><small>instalações (produtos do orçamento) + mão de obra</small></div><div class="kpi"><span>Mão de obra</span><b>' + brl(mo) + "</b><small>" + (min ? brl(mo / (min / 60)) + " por hora no cliente" : "—") + '</small></div><div class="kpi"><span>OS finalizadas</span><b>' + l.length + "</b><small>" + (l.length ? "média de " + horas(min / l.length) + " por OS" : "") + '</small></div><div class="kpi"><span>Horas no cliente</span><b>' + horas(min) + '</b><small>pelo check-in e check-out</small></div><div class="kpi"><span>Instalações executadas</span><b>' + brl(orc) + "</b><small>" + l.filter(function (o) { return o.tipo === "pedido"; }).length + " pedido(s) · valor do orçamento" + (soma(l, "mensal") ? " · + " + brl(soma(l, "mensal")) + "/mês" : "") + '</small></div><div class="kpi"><span>Mão de obra ajustada</span><b>' + aj + "</b><small>" + (aj ? "OS com valor diferente da sugestão" : "todas conforme a sugestão") + "</small></div>";
  var tt = porTipo(l), mx = Math.max(1, Math.max.apply(null, ORDEM.map(function (k) { return tt[k]; })));
  $("#tipos").innerHTML = ORDEM.map(function (k) { var ls = l.filter(function (o) { return o.tipo === k; }); return '<button type="button" class="tp' + (S.f.tipo === k ? " on" : "") + '" style="--c:' + TIPOS[k].c + '" data-tp="' + k + '" aria-pressed="' + (S.f.tipo === k) + '"><div class="n"><b>' + ls.length + "</b><span>" + TIPOS[k].nome + '</span></div><div class="bar"><i style="width:' + (ls.length / mx * 100) + '%"></i></div><div class="l"><span>' + horas(soma(ls, "minutos")) + " no cliente</span><b>" + brl(soma(ls, "valorMO")) + "</b></div>" + (k === "pedido" && soma(ls, "valorOrc") ? '<div class="l"><span>Produtos instalados</span><b>' + brl(soma(ls, "valorOrc")) + "</b></div>" : "") + "</button>"; }).join("");
  $$("[data-tp]").forEach(function (b) { b.onclick = function () { S.f.tipo = S.f.tipo === b.dataset.tp ? "" : b.dataset.tp; $("#f-tipo").value = S.f.tipo; desenhar(); }; });
  $$("[data-ir]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); try { parent.postMessage({ sgo: "ir", url: a.dataset.ir }, "*"); } catch (er) {} }; });
  if (!S.d.os.length) { $("#corpo").innerHTML = '<div class="vazio">Nenhuma OS finalizada em ' + MESES[S.mes].toLowerCase() + " de " + S.ano + ".</div>"; return; }
  if (!l.length) { $("#corpo").innerHTML = '<div class="vazio">Nenhuma OS com esses filtros.</div>'; return; }
  $("#corpo").innerHTML = S.aba === "os" ? tabelaOS(l) : tabelaGrupo(l, S.aba);
}
function tabelaGrupo(l, aba) {
  var g = agrupar(l, aba === "tec" ? function (o) { return o.pessoas; } : aba === "aux" ? function (o) { return [o.auxiliar]; } : function (o) { return [o.equipe]; });
  if (!g.length) return '<div class="vazio">' + (aba === "aux" ? "Nenhuma OS com auxiliar técnico neste mês." : "Sem dados.") + "</div>";
  g.forEach(function (x) { x.min = soma(x.os, "minutos"); x.mo = soma(x.os, "valorMO"); x.ax = soma(x.os, "valorAux"); x.orc = soma(x.os, "valorOrc"); });
  g.sort(function (a, b) { return (b.mo + b.orc) - (a.mo + a.orc) || b.min - a.min; });
  var mx = Math.max.apply(null, g.map(function (x) { return x.min; })) || 1;
  var rot = aba === "tec" ? "Técnico" : aba === "aux" ? "Auxiliar técnico" : "Equipe";
  var h = '<div class="box"><table><thead><tr><th>' + rot + '</th><th>OS por tipo</th><th class="r">OS</th><th>Horas no cliente</th><th class="r">Média por OS</th>' + (aba === "aux" ? '<th class="r">Mão de obra do auxiliar</th><th class="r">Mão de obra total das OS</th>' : '<th class="r">Instalações<br>(produtos)</th><th class="r">Mão de obra</th><th class="r">Total produzido</th><th class="r">R$/h mão de obra</th>') + '</tr></thead><tbody>' +
    g.map(function (x) { return '<tr><td><div class="pess"><span class="av' + (aba === "aux" ? " aux" : "") + '">' + esc(ini(x.nome)) + "</span>" + esc(x.nome) + "</div></td><td>" + mini(x.os) + '</td><td class="r"><b>' + x.os.length + '</b></td><td><div class="hbar"><b>' + horas(x.min) + '</b><div class="bar"><i style="width:' + (x.min / mx * 100) + '%"></i></div></div></td><td class="r">' + horas(x.min / x.os.length) + '</td>' + (aba === "aux" ? '<td class="r"><b>' + brl(x.ax) + '</b></td><td class="r">' + brl(x.mo) + "</td>" : '<td class="r">' + (x.orc ? brl(x.orc) : "—") + '</td><td class="r">' + brl(x.mo) + '</td><td class="r"><b>' + brl(x.mo + x.orc) + '</b></td><td class="r">' + (x.min ? brl(x.mo / (x.min / 60)) : "—") + "</td>") + "</tr>"; }).join("") + "</tbody>";
  if (aba === "eq") h += '<tfoot><tr><td>Total da assistência</td><td>' + mini(l) + '</td><td class="r">' + l.length + "</td><td>" + horas(soma(l, "minutos")) + '</td><td class="r"></td><td class="r">' + brl(soma(l, "valorOrc")) + '</td><td class="r">' + brl(soma(l, "valorMO")) + '</td><td class="r">' + brl(soma(l, "valorOrc") + soma(l, "valorMO")) + '</td><td class="r"></td></tr></tfoot>';
  h += "</table>";
  if (aba !== "eq") h += '<div class="nota">Cada pessoa recebe o tempo, a mão de obra e o valor das instalações das OS em que participou. Quando dois vão juntos, a OS conta para os dois, por isso a soma desta tabela pode passar do total da assistência (veja a aba Por equipe).</div>';
  return h + "</div>";
}
function tabelaOS(l) {
  return '<div class="box"><table><thead><tr><th>OS</th><th>Finalizada</th><th>Tipo</th><th>Cliente</th><th>Equipe / técnicos</th><th>Auxiliar</th><th class="r">Tempo</th><th class="r">Mão de obra</th><th class="r">Instalação<br>(orçamento)</th></tr></thead><tbody>' +
    l.map(function (o) { var t = TIPOS[o.tipo] || TIPOS.pedido; return "<tr><td><b>" + esc(o.num) + "</b></td><td>" + dbr(o.fim) + '</td><td><span class="tag" style="--c:' + t.c + '">' + t.curto + "</span>" + (o.sub ? ' <span class="mut">' + esc(o.sub) + "</span>" : "") + '</td><td class="cli">' + esc(o.cliente) + (o.cidade ? '<div class="mut">' + esc(o.cidade) + "</div>" : "") + "</td><td>" + esc(o.equipe) + '<div class="mut">' + esc(o.pessoas.join(", ")) + "</div></td><td>" + (esc(o.auxiliar) || '<span class="mut">—</span>') + '</td><td class="r">' + (o.minutos ? horas(o.minutos) : "—") + (o.manual ? '<div class="mut">corrigido</div>' : "") + '</td><td class="r mo"><b>' + (o.fechado ? brl(o.valorMO) : '<span class="sf">sem fechamento</span>') + "</b>" + (o.ajuste ? '<span class="aj" title="' + esc("Sugestão " + brl(o.sugestao) + " · " + o.ajuste) + '">ajustada</span>' : "") + (o.mo ? '<div class="mut">' + esc(o.mo) + "</div>" : "") + '</td><td class="r">' + (o.valorOrc ? brl(o.valorOrc) + '<div class="mut">' + esc(o.orcNum) + "</div>" : '<span class="mut">—</span>') + "</td></tr>"; }).join("") +
    '</tbody><tfoot><tr><td colspan="6">Total · ' + l.length + ' OS</td><td class="r">' + horas(soma(l, "minutos")) + '</td><td class="r">' + brl(soma(l, "valorMO")) + '</td><td class="r">' + brl(soma(l, "valorOrc")) + "</td></tr></tfoot></table></div>";
}
function csv() {
  var l = filtradas(), sep = ";", n = function (v) { return String((Math.round((v || 0) * 100) / 100).toFixed(2)).replace(".", ","); };
  var q = function (s) { return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"'; };
  var linhas = [["OS", "Finalizada", "Tipo", "Subtipo", "Cliente", "Cidade", "Equipe", "Técnicos", "Auxiliar", "Minutos no cliente", "Horas no cliente", "Tempo corrigido à mão", "Mão de obra (R$)", "Sugestão (R$)", "Motivo do ajuste", "Itens de mão de obra", "Orçamento", "Valor do orçamento (R$)", "Mensal do orçamento (R$)"].map(q).join(sep)];
  l.forEach(function (o) { linhas.push([q(o.num), q(dbr(o.fim) + "/" + o.fim.slice(0, 4)), q((TIPOS[o.tipo] || {}).nome || o.tipo), q(o.sub), q(o.cliente), q(o.cidade), q(o.equipe), q(o.pessoas.join(", ")), q(o.auxiliar), o.minutos, n(o.minutos / 60), q(o.manual ? "sim" : "não"), n(o.valorMO), o.sugestao == null ? "" : n(o.sugestao), q(o.ajuste || ""), q(o.mo), q(o.orcNum), n(o.valorOrc), n(o.mensal)].join(sep)); });
  var b = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = "relatorio-os-" + S.ano + "-" + pad(S.mes + 1) + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$("#m-ant").onclick = function () { S.mes--; if (S.mes < 0) { S.mes = 11; S.ano--; } carregar(); };
$("#m-prox").onclick = function () { S.mes++; if (S.mes > 11) { S.mes = 0; S.ano++; } carregar(); };
[["#f-tipo", "tipo"], ["#f-equipe", "equipe"], ["#f-tec", "tec"], ["#f-aux", "aux"]].forEach(function (p) { $(p[0]).onchange = function () { S.f[p[1]] = this.value; desenhar(); }; });
$$(".abas button").forEach(function (b) { b.onclick = function () { S.aba = b.dataset.a; $$(".abas button").forEach(function (z) { z.classList.toggle("on", z === b); z.setAttribute("aria-selected", z === b); }); if (S.d) desenhar(); }; });
$("#b-csv").onclick = function () { if (S.d) csv(); };
$("#b-imp").onclick = function () { window.print(); };
carregar();

