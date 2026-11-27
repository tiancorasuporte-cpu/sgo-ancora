/* Lógica original da tela do SGO (executada pelo motor de telas isoladas: src/sgo/lib/tela-isolada.ts). */

"use strict";
var $ = function (s) { return document.querySelector(s); };
var Q = new URLSearchParams(location.search);
var S = { tipo: Q.get("tipo") === "produtos" ? "produtos" : Q.get("tipo") === "servicos" ? "servicos" : Q.get("tipo") === "maoobra" ? "maoobra" : "parceiros", q: "", sit: "Ativo", tags: [], est: false, fCusto: false, fMarkup: false, famFora: [], pag: 1, dados: null, aberto: null, todasTags: [] };
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function brl(n) { return n == null || n === "" ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function num(n) { return Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 }); }
function doc(d) { d = String(d || ""); if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); return d; }
function cid(c) { return String(c || "").replace(/\s*\([A-Z]{2}\)\s*$/, ""); }
function dataBR(ms) { if (!ms) return ""; var d = new Date(ms); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
function toast(t) { var e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 3200); }
function api(m, u, b) {
  return fetch(u, { method: m, credentials: "same-origin", headers: { "content-type": "application/json", "x-sgo": "1" }, body: b ? JSON.stringify(b) : undefined }).then(function (r) {
    if (r.status === 401) { (window.top || window).location.href = "/login"; throw new Error("Sessão expirada"); }
    return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.erro || "Erro " + r.status); e.status = r.status; throw e; } return d; });
  });
}
function avisarShell() { try { window.parent.postMessage({ sgo: "alterou" }, location.origin); } catch (e) {} }
function fat(n) { return n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "×"; }
// ---------- aplicar o preço sugerido em todos os produtos abaixo do markup (filtro ligado) ----------
// 1º clique simula (não grava) e mostra o resumo; "Confirmar" grava. Só sobe preço.
function mkFiltros() { return { q: S.q, situacao: S.sit, estoque: S.tipo === "produtos" && S.est ? 1 : 0, familias_fora: S.tipo === "produtos" ? S.famFora : [] }; }
function mkAcao() {
  var el = $("#mk-acao"); if (!el) return;
  var d = S.dados, on = S.tipo === "produtos" && S.fMarkup && d && d.total > 0;
  if (!on) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "";
  var s = S.mkSim;
  if (!s) {
    el.innerHTML = '<div><b>' + d.total + (d.total === 1 ? " produto está" : " produtos estão") + " abaixo do markup mínimo.</b> Aplicar a regra: preço de venda = custo de referência × markup (padrão " + fat(1.7) + '), terminando em ,90.</div><button type="button" class="btn sm" id="mk-sim">Aplicar regra em todos</button>';
    $("#mk-sim").onclick = function () {
      var b = this; b.disabled = true; b.textContent = "Calculando…";
      api("POST", "/api/cadastros/precificacao/aplicar-abaixo", Object.assign({ simular: true }, mkFiltros())).then(function (r) { S.mkSim = r; mkAcao(); })
        .catch(function (e) { toast(e.message); b.disabled = false; b.textContent = "Aplicar regra em todos"; });
    };
    return;
  }
  if (!s.total) { el.innerHTML = "<div>Nenhum preço muda com a regra (o sugerido não é maior que o preço atual).</div>" + '<button type="button" class="btn ghost sm" id="mk-cancel">Fechar</button>'; $("#mk-cancel").onclick = function () { S.mkSim = null; mkAcao(); }; return; }
  var pct = s.soma_de > 0 ? Math.round(((s.soma_para - s.soma_de) / s.soma_de) * 1000) / 10 : null;
  el.innerHTML = '<div><b>Confirmar: ' + s.total + (s.total === 1 ? " preço vai mudar" : " preços vão mudar") + ".</b> Soma dos preços: " + brl(s.soma_de) + " → <b>" + brl(s.soma_para) + "</b>" + (pct != null ? " (+" + String(pct).replace(".", ",") + "%)" : "") + '. Maiores aumentos: ' + s.exemplos.map(function (x) { return esc(x.codigo) + " " + brl(x.de) + " → " + brl(x.para); }).join("; ") + '. Fica registrado no histórico de cada produto.</div><span style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn ghost sm" id="mk-cancel">Cancelar</button><button type="button" class="btn sm" id="mk-ok">Confirmar e aplicar</button></span>';
  $("#mk-cancel").onclick = function () { S.mkSim = null; mkAcao(); };
  $("#mk-ok").onclick = function () {
    var b = this; b.disabled = true; $("#mk-cancel").disabled = true; b.textContent = "Aplicando…";
    api("POST", "/api/cadastros/precificacao/aplicar-abaixo", mkFiltros()).then(function (r) {
      toast("Preço sugerido aplicado em " + (r.aplicados || 0) + " produto(s).");
      carregar(); avisarShell();
    }).catch(function (e) { toast(e.message); b.disabled = false; $("#mk-cancel").disabled = false; b.textContent = "Confirmar e aplicar"; });
  };
}
// Filtro de família no cabeçalho: "todas menos estas". Clicar em "Família" abre a lista com caixas
// (todas marcadas); desmarque o que não quer ver. "Só esta" deixa marcada só uma.
function thFamilia() {
  var n = S.famFora.length;
  var dica = n ? "Escondendo: " + S.famFora.map(function (x) { return x === "__sem__" ? "sem família" : x; }).join(", ") : "Filtrar famílias";
  return '<button type="button" class="th-f' + (n ? " on" : "") + '" id="th-fam" aria-haspopup="dialog" aria-expanded="' + !$("#fam-pop").hidden + '" title="' + esc(dica) + '">' + (n ? "Família (−" + n + ")" : 'Família <span aria-hidden="true">⏷</span>') + "</button>" + (n ? ' <button type="button" class="th-x" data-f="fam" aria-label="Mostrar todas as famílias" title="Mostrar todas as famílias">✕</button>' : "");
}
function famPopItens() {
  var L = (S.familias || []).filter(function (f) { return f.situacao !== "Inativo" || Number(f.produtos) > 0; });
  return [{ nome: "__sem__", rot: "— Sem família —", n: S.semFamilia || 0 }].concat(L.map(function (f) { return { nome: f.nome, rot: f.nome, n: f.produtos }; }));
}
function famFora(nome) { return S.famFora.some(function (x) { return x.toLowerCase() === nome.toLowerCase(); }); }
function famPopAbrir() {
  var pop = $("#fam-pop"), b = $("#th-fam"); if (!pop || !b) return;
  if (!S.familias) { famCarregar().then(function () { if (S.familias) famPopAbrir(); }); return; }
  var it = famPopItens(), marc = it.filter(function (x) { return !famFora(x.nome); }).length;
  pop.innerHTML = '<div class="pop-t"><b>Mostrar famílias</b><span class="sub">' + marc + " de " + it.length + '</span></div><div class="pop-a"><button type="button" class="btn ghost sm" data-p="todas">Marcar todas</button><button type="button" class="btn ghost sm" data-p="nenhuma">Desmarcar todas</button></div><div class="pop-l">' +
    it.map(function (x, i) { var on = !famFora(x.nome); return '<div class="pop-i"><label><input type="checkbox" data-n="' + esc(x.nome) + '"' + (on ? " checked" : "") + "> <span>" + esc(x.rot) + '</span> <span class="sub">' + num(x.n) + '</span></label><button type="button" class="pop-so" data-so="' + esc(x.nome) + '" title="Mostrar só esta família">só esta</button></div>'; }).join("") +
    '</div><div class="pop-r"><button type="button" class="btn adv sm" data-p="ok">Pronto</button></div>';
  var card = pop.parentNode.getBoundingClientRect(), r = b.getBoundingClientRect();
  pop.style.top = Math.round(r.bottom - card.top + 8) + "px";
  pop.style.left = Math.max(8, Math.min(Math.round(r.left - card.left), Math.round(card.width) - 300)) + "px";
  pop.hidden = false; b.setAttribute("aria-expanded", "true");
  pop.onchange = function (e) {
    var c = e.target.closest("[data-n]"); if (!c) return;
    var n = c.dataset.n;
    S.famFora = S.famFora.filter(function (x) { return x.toLowerCase() !== n.toLowerCase(); });
    if (!c.checked) S.famFora.push(n);
    famPopAplicar();
  };
  pop.onclick = function (e) {
    var so = e.target.closest("[data-so]"), p = e.target.closest("[data-p]");
    if (so) { S.famFora = famPopItens().map(function (x) { return x.nome; }).filter(function (n) { return n !== so.dataset.so; }); famPopAplicar(); famPopAbrir(); return; }
    if (!p) return;
    if (p.dataset.p === "ok") { famPopFechar(); return; }
    S.famFora = p.dataset.p === "todas" ? [] : famPopItens().map(function (x) { return x.nome; });
    famPopAplicar(); famPopAbrir();
  };
  setTimeout(function () { var c = pop.querySelector("input"); if (c) c.focus(); }, 30);
}
function famPopFechar() { var pop = $("#fam-pop"); if (!pop || pop.hidden) return; pop.hidden = true; var b = $("#th-fam"); if (b) { b.setAttribute("aria-expanded", "false"); b.focus(); } }
// recarrega a lista um instante depois da última marcação (dá para ir desmarcando várias)
function famPopAplicar() {
  var t = $("#fam-pop .pop-t .sub"), it = famPopItens();
  if (t) t.textContent = it.filter(function (x) { return !famFora(x.nome); }).length + " de " + it.length;
  clearTimeout(S.famTimer);
  S.famTimer = setTimeout(function () { S.pag = 1; carregar(); }, 450);
}
// Filtro no cabeçalho da coluna (Custo / Markup): clique liga e desliga.
function thFiltro(f, nome, on, rotuloOn, dica) {
  return '<button type="button" class="th-f' + (on ? " on" : "") + '" data-f="' + f + '" aria-pressed="' + on + '" title="' + esc(on ? "Filtro ligado: " + rotuloOn + ". Clique para mostrar todos." : dica) + '">' + (on ? esc(rotuloOn) + " ✕" : esc(nome) + ' <span aria-hidden="true">⏷</span>') + "</button>";
}
function tagCls(t) { return t === "Cliente" ? "t-cli" : t === "Fornecedor" ? "t-for" : "t-out"; }
function tagsHTML(ts) { return (ts || []).map(function (t) { return '<span class="pill ' + tagCls(t) + '">' + esc(t) + "</span>"; }).join(""); }

function carregar() {
  var p = new URLSearchParams({ q: S.q, situacao: S.sit, pagina: S.pag });
  if (S.tipo === "parceiros" && S.tags.length) p.set("tags", S.tags.join(","));
  if (S.tipo === "produtos" && S.est) p.set("estoque", "1");
  if (S.tipo === "produtos" && S.fCusto) p.set("custo", "sem");
  if (S.tipo === "produtos" && S.fMarkup) p.set("markup", "abaixo");
  if (S.tipo === "produtos" && S.famFora.length) p.set("familias_fora", JSON.stringify(S.famFora));
  $("#tb").innerHTML = '<tr><td colspan="9" class="vazio">Carregando…</td></tr>';
  S.mkSim = null; mkAcao();
  api("GET", "/api/cadastros/" + S.tipo + "?" + p).then(function (d) { S.dados = d; if (d.tags) S.todasTags = d.tags; desenhar(); mkAcao(); }).catch(function (e) { $("#tb").innerHTML = '<tr><td colspan="9" class="vazio">' + esc(e.message) + "</td></tr>"; });
}
function desenhar() {
  document.querySelectorAll(".seg button").forEach(function (b) { b.classList.toggle("on", b.dataset.tipo === S.tipo); b.setAttribute("aria-pressed", b.dataset.tipo === S.tipo); });
  $("#q").placeholder = S.tipo === "parceiros" ? "Buscar por nome, fantasia, CNPJ/CPF, contato, cidade…" : S.tipo === "servicos" || S.tipo === "maoobra" ? "Buscar por código, descrição ou categoria…" : "Buscar por código, descrição, marca, modelo, EAN…";
  $("#b-imp").style.display = S.tipo === "servicos" || S.tipo === "maoobra" ? "none" : "";
  var bSync = $("#b-sync-omie");
  if (bSync) bSync.style.display = S.tipo === "parceiros" || S.tipo === "produtos" ? "" : "none";
  $("#b-fam").style.display = S.tipo === "produtos" ? "" : "none";
  if (S.tipo !== "produtos") { var pp = $("#fam-pop"); if (pp) pp.hidden = true; }
  if (S.tipo === "produtos" && !S.familias) famCarregar();
  $("#b-novo").textContent = S.tipo === "servicos" ? "+ Novo serviço" : S.tipo === "maoobra" ? "+ Nova mão de obra" : "+ Novo";
  $("#l-est").style.display = S.tipo === "produtos" ? "inline-flex" : "none";
  $("#tags").style.display = S.tipo === "parceiros" ? "flex" : "none";
  $("#tags").innerHTML = S.tipo === "parceiros" ? S.todasTags.map(function (t) { var on = S.tags.indexOf(t.tag) >= 0; return '<button type="button" class="chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-tag="' + esc(t.tag) + '">' + esc(t.tag) + " <em>" + t.n + "</em></button>"; }).join("") : "";
  var d = S.dados || { itens: [], total: 0, por: 50, pagina: 1 };
  if (S.tipo === "parceiros") {
    $("#th").innerHTML = "<tr><th>Nome</th><th>Tags</th><th>CNPJ / CPF</th><th>Contato</th><th>Telefone</th><th>E-mail</th><th>Cidade</th></tr>";
    $("#tb").innerHTML = d.itens.map(function (p) {
      var nome = p.fantasia || p.razao;
      return '<tr class="lin" tabindex="0" data-id="' + p.id + '"><td><div style="font-weight:600">' + esc(nome) + (p.situacao === "Inativo" ? ' <span class="pill t-ina">Inativo</span>' : "") + "</div>" + (p.razao !== nome ? '<div class="sub">' + esc(p.razao) + "</div>" : "") + "</td><td>" + tagsHTML(p.tags) + "</td><td style=\"white-space:nowrap\">" + esc(doc(p.documento)) + "</td><td>" + esc(p.contato || "") + "</td><td style=\"white-space:nowrap\">" + esc(p.telefone || "") + '</td><td class="sub" style="max-width:220px;overflow:hidden;text-overflow:ellipsis">' + esc(p.email || "") + "</td><td>" + esc(cid(p.cidade)) + (p.uf ? " · " + esc(p.uf) : "") + "</td></tr>";
    }).join("") || '<tr><td colspan="7" class="vazio">Nenhum cadastro encontrado.</td></tr>';
  } else if (S.tipo === "maoobra") {
    $("#th").innerHTML = '<tr><th>Código</th><th>Mão de obra</th><th>Unidade</th><th style="text-align:right">Valor de venda</th><th style="text-align:right">Custo</th><th style="text-align:right">Margem</th></tr>';
    $("#tb").innerHTML = d.itens.map(function (p) {
      var mg = p.preco_venda && p.custo != null ? Math.round(((p.preco_venda - p.custo) / p.preco_venda) * 1000) / 10 : null;
      return '<tr class="lin" tabindex="0" data-id="' + p.id + '"><td style="font-weight:700;white-space:nowrap">' + esc(p.codigo) + '</td><td><div style="font-weight:500">' + esc(p.descricao) + (p.situacao === "Inativo" ? ' <span class="pill t-ina">Inativo</span>' : "") + '</div><div class="sub">' + esc([p.categoria, p.obs].filter(Boolean).join(" · ").slice(0, 140)) + "</div></td><td>" + esc(p.unidade) + '</td><td class="num" style="font-weight:600">' + (p.preco_venda == null ? '<span class="sub">a definir</span>' : brl(p.preco_venda)) + '</td><td class="num">' + (p.custo == null ? '<span class="sub">a definir</span>' : brl(p.custo)) + '</td><td class="num">' + (mg == null ? "—" : String(mg).replace(".", ",") + "%") + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="vazio">Nenhuma mão de obra cadastrada.</td></tr>';
  } else if (S.tipo === "servicos") {
    $("#th").innerHTML = '<tr><th>Código</th><th>Serviço</th><th>Un.</th><th style="text-align:right">Valor de venda mensal</th><th style="text-align:right">Custo mensal</th><th style="text-align:right">Margem</th></tr>';
    $("#tb").innerHTML = d.itens.map(function (p) {
      var mg = p.preco_venda && p.custo != null ? Math.round(((p.preco_venda - p.custo) / p.preco_venda) * 1000) / 10 : null;
      return '<tr class="lin" tabindex="0" data-id="' + p.id + '"><td style="font-weight:700;white-space:nowrap">' + esc(p.codigo) + '</td><td><div style="font-weight:500">' + esc(p.descricao) + (p.situacao === "Inativo" ? ' <span class="pill t-ina">Inativo</span>' : "") + '</div><div class="sub">' + esc([p.categoria, p.obs].filter(Boolean).join(" · ").slice(0, 140)) + "</div></td><td>" + esc(p.unidade) + '</td><td class="num" style="font-weight:600">' + (p.preco_venda == null ? '<span class="sub">a definir</span>' : brl(p.preco_venda)) + '</td><td class="num">' + (p.custo == null ? '<span class="sub">a definir</span>' : brl(p.custo)) + '</td><td class="num">' + (mg == null ? "—" : String(mg).replace(".", ",") + "%") + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="vazio">Nenhum serviço mensal encontrado.</td></tr>';
  } else {
    $("#th").innerHTML = '<tr><th>Código</th><th>Descrição</th><th>' + thFamilia() + '</th><th>Un.</th><th style="text-align:right">Estoque</th><th style="text-align:right">Preço de venda</th><th style="text-align:right">' + thFiltro("custo", "Custo", S.fCusto, "Sem custo", "Mostrar só os produtos sem custo") + '</th><th style="text-align:right">Última compra</th><th style="text-align:right">' + thFiltro("markup", "Markup", S.fMarkup, "Abaixo do mínimo", "Mostrar só os produtos com preço abaixo do markup mínimo (preço ÷ custo de referência, o maior entre o custo e a última compra)") + "</th></tr>";
    $("#tb").innerHTML = d.itens.map(function (p) {
      var pr = p.prec || {};
      return '<tr class="lin' + (pr.alerta ? " alerta" : "") + '" tabindex="0" data-id="' + p.id + '"><td style="font-weight:700;white-space:nowrap">' + esc(p.codigo) + "</td><td><div style=\"font-weight:500\">" + esc(p.descricao) + (p.situacao === "Inativo" ? ' <span class="pill t-ina">Inativo</span>' : "") + '</div><div class="sub">' + esc([p.marca, p.modelo, p.ncm ? "NCM " + p.ncm : ""].filter(Boolean).join(" · ")) + "</div></td><td>" + (p.familia ? '<span class="fam">' + esc(p.familia) + "</span>" : '<span class="sub">—</span>') + "</td><td>" + esc(p.unidade) + '</td><td class="num" style="font-weight:600">' + num(p.estoque) + '</td><td class="num">' + brl(p.preco_venda) + (pr.pendente ? '<div class="sub mk-pend" title="O cálculo da última compra deu um preço menor. Abra o produto para aplicar ou manter.">sugerido ' + brl(pr.pendente) + "</div>" : "") + '</td><td class="num">' + brl(p.custo) + '</td><td class="num">' + (p.ultima ? brl(p.ultima.preco) + '<div class="sub">' + esc(p.ultima.fornecedor || "") + " · " + esc(String(p.ultima.data).split("-").reverse().join("/")) + "</div>" : '<span class="sub">sem compra no SGO</span>') + '</td><td class="num">' + (pr.fator == null ? '<span class="sub">' + (pr.custo_ref ? "sem preço" : "sem custo") + "</span>" : '<span class="' + (pr.alerta ? "mk-al" : "mk-ok") + '">' + fat(pr.fator) + "</span>" + (pr.alerta ? '<div class="sub mk-al">abaixo de ' + fat(pr.minimo) + "</div>" : "")) + "</td></tr>";
    }).join("") || '<tr><td colspan="9" class="vazio">' + (S.fCusto || S.fMarkup || S.famFora.length ? "Nenhum produto neste filtro." : "Nenhum produto encontrado.") + "</td></tr>";
  }
  var ini = d.total ? (d.pagina - 1) * d.por + 1 : 0, fim = Math.min(d.total, d.pagina * d.por);
  $("#tot").textContent = d.total ? ini + "–" + fim + " de " + d.total + (S.tipo === "parceiros" ? " cadastros" : S.tipo === "servicos" ? " serviços" : S.tipo === "maoobra" ? " itens de mão de obra" : " produtos") : "";
  $("#ant").disabled = d.pagina <= 1; $("#prox").disabled = fim >= d.total;
}

// ---------- formulário ----------
var CAMPOS = {
  parceiros: [
    ["sec", "Identificação"], ["razao", "Razão social / nome completo *", "full"], ["fantasia", "Nome fantasia / abreviado", "full"], ["documento", "CNPJ / CPF"], ["situacao", "Situação", "", "sel", ["Ativo", "Inativo"]],
    ["sec", "Contato"], ["contato", "Contato"], ["telefone", "Telefone"], ["email", "E-mail", "full"],
    ["sec", "Endereço"], ["endereco", "Endereço", "full"], ["bairro", "Bairro"], ["cep", "CEP"], ["cidade", "Cidade"], ["uf", "UF"],
    ["sec", "Fiscal"], ["ie", "Inscrição estadual"], ["im", "Inscrição municipal"], ["obs", "Observação", "full", "area"],
  ],
  produtos: [
    ["sec", "Produto"], ["codigo", "Código *"], ["unidade", "Unidade (sigla)"], ["descricao", "Descrição *", "full"], ["familia", "Família", "", "fam"], ["situacao", "Situação", "", "sel", ["Ativo", "Inativo"]], ["marca", "Marca"], ["modelo", "Modelo"],
    ["sec", "Valores e estoque"], ["preco_venda", "Preço de venda (R$)", "", "dec"], ["custo", "Custo médio / CMC (R$)", "", "dec"], ["markup", "Markup do produto (vazio = automático)", "", "dec"], ["estoque", "Estoque disponível", "", "dec"], ["garantia_dias", "Garantia (dias)", "", "dec"], ["prec"],
    ["sec", "Fiscal"], ["ncm", "NCM"], ["cest", "CEST"], ["ean", "EAN (código de barras)"], ["tipo_item", "Tipo do item"], ["caracteristicas", "Características", "full", "area"],
  ],
  servicos: [
    ["sec", "Serviço mensal"], ["codigo", "Código (em branco = automático)"], ["unidade", "Unidade"], ["descricao", "Descrição *", "full"], ["categoria", "Categoria (ex.: Monitoramento)"], ["situacao", "Situação", "", "sel", ["Ativo", "Inativo"]],
    ["sec", "Valores mensais"], ["preco_venda", "Valor de venda mensal (R$)", "", "dec"], ["custo", "Custo mensal (R$)", "", "dec"],
    ["obs", "O que está incluso / observação", "full", "area"],
  ],
  maoobra: [
    ["sec", "Mão de obra"], ["codigo", "Código (em branco = automático)"], ["unidade", "Unidade", "", "sel", ["HORA", "MEIO DIA", "DIA", "VISITA", "OUTRO"]], ["descricao", "Descrição *", "full"], ["categoria", "Tipo (ex.: Técnico, Auxiliar)"], ["situacao", "Situação", "", "sel", ["Ativo", "Inativo"]],
    ["sec", "Valores"], ["preco_venda", "Valor de venda (R$)", "", "dec"], ["custo", "Custo (R$)", "", "dec"],
    ["obs", "Observação (ex.: horário comercial, deslocamento à parte)", "full", "area"],
  ],
};
function valIn(v, dec) { if (v == null) return ""; if (dec && typeof v === "number") return String(v).replace(".", ","); return String(v); }
function abrir(item) {
  S.aberto = item || {};
  var novo = !item || !item.id, t = S.tipo;
  $("#g-kick").textContent = t === "parceiros" ? "Cliente / fornecedor" : t === "servicos" ? "Serviço mensal" : t === "maoobra" ? "Mão de obra" : "Produto";
  $("#g-tit").textContent = novo ? (t === "parceiros" ? "Novo cadastro" : t === "servicos" ? "Novo serviço mensal" : t === "maoobra" ? "Nova mão de obra" : "Novo produto") : (t === "parceiros" ? item.fantasia || item.razao : item.codigo + " · " + item.descricao);
  var h = "";
  if (t === "parceiros") {
    var tagsSel = (item && item.tags) || ["Cliente"];
    var todas = S.todasTags.map(function (x) { return x.tag; });
    tagsSel.forEach(function (x) { if (todas.indexOf(x) < 0) todas.push(x); });
    h += '<div class="f full"><span class="flabel">Tags * — o que este cadastro é</span><div class="chips" id="f-tags">' + todas.map(function (x) { var on = tagsSel.indexOf(x) >= 0; return '<button type="button" class="chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-t="' + esc(x) + '">' + (on ? "✓ " : "") + esc(x) + "</button>"; }).join("") + '</div><div style="display:flex;gap:6px;margin-top:4px"><input class="field" id="f-novatag" placeholder="Nova tag (ex.: Prestador de serviço)" style="max-width:280px"><button class="btn ghost sm" type="button" id="f-addtag">Adicionar</button></div></div>';
  }
  CAMPOS[t].forEach(function (c) {
    if (c[0] === "sec") { h += '<div class="sec">' + c[1] + "</div>"; return; }
    if (c[0] === "prec") { h += precBloco(item); return; }
    var v = item ? item[c[0]] : c[0] === "situacao" ? "Ativo" : c[0] === "unidade" && t === "servicos" ? "MÊS" : c[0] === "unidade" && t === "maoobra" ? "HORA" : "";
    if (c[0] === "documento") v = doc(v);
    if (c[0] === "caracteristicas" && String(v || "").trim() === "[object Object]") v = "";
    var id = "f-" + c[0], cls = "f" + (c[2] === "full" ? " full" : ""), inp;
    if (c[3] === "fam") inp = famSelect(id, v);
    else if (c[3] === "sel") inp = '<select class="field" id="' + id + '">' + c[4].map(function (o) { return "<option" + (o === v ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select>";
    else if (c[3] === "area") inp = '<textarea class="field" id="' + id + '">' + esc(v || "") + "</textarea>";
    else inp = '<input class="field" id="' + id + '" value="' + esc(valIn(v, c[3] === "dec")) + '"' + (c[3] === "dec" ? ' inputmode="decimal"' : "") + ">";
    h += '<div class="' + cls + '"><label class="flabel" for="' + id + '">' + c[1] + "</label>" + inp + "</div>";
  });
  if (t === "produtos" && item && item.id) h += '<div class="info">Última compra pelo SGO: <b>' + (item.ultima ? brl(item.ultima.preco) + " · " + esc(item.ultima.fornecedor || "") : "nenhuma ainda") + "</b>. O custo médio (CMC) vem da sincronização com o Omie; se não vier, preencha aqui.</div>";
  if (t === "maoobra") h += '<div class="info">A mão de obra aparece na <b>Tabela de preços</b> (Comercial) junto com os serviços mensais, para o vendedor consultar. O custo e a margem só o administrador vê lá.</div>';
  if (t === "servicos") h += '<div class="info">Estes serviços aparecem nos orçamentos ao marcar <b>Incluir serviço mensal</b>. O valor de venda vem sugerido no orçamento e pode ser ajustado lá.</div>';
  h += '<p class="erro" id="f-erro"></p>';
  $("#form").innerHTML = h;
  if (t === "produtos") precLigar(item);
  $("#g-meta").textContent = item && item.id ? (t === "servicos" || t === "maoobra" ? "" : "Origem: " + (item.origem === "omie" ? "Omie" : "SGO") + " · ") + "alterado " + dataBR(item.atualizado_em) + " por " + (item.atualizado_por || "") : "";
  if (t === "parceiros") {
    $("#f-tags").onclick = function (e) { var b = e.target.closest("[data-t]"); if (!b) return; var on = !b.classList.contains("on"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = (on ? "✓ " : "") + b.dataset.t; };
    $("#f-addtag").onclick = function () { var v = $("#f-novatag").value.trim(); if (!v) return; var b = document.createElement("button"); b.type = "button"; b.className = "chip on"; b.dataset.t = v; b.setAttribute("aria-pressed", "true"); b.textContent = "✓ " + v; $("#f-tags").appendChild(b); $("#f-novatag").value = ""; };
  }
  $("#gav").classList.add("on"); $("#fundo").classList.add("on");
  setTimeout(function () { var p = $("#form .field"); if (p && novo) p.focus(); }, 60);
}
// ---------- precificação (produto) ----------
// O preço de venda é do SGO. A cada compra aprovada ele é recalculado: sobe sozinho; se der menor, fica como sugestão.
function precBloco(item) {
  var pr = (item && item.prec) || null;
  var h = '<div class="info full prec">';
  if (!item || !item.id || !pr) return h + "<b>Preço automático:</b> a cada compra aprovada em Compras, o preço de venda é recalculado pelo custo de referência (o maior entre o custo e a última compra) × o markup, terminando em ,90. Sem markup próprio, usa " + fat(1.7) + ".</div>";
  h += '<div class="prec-g"><div><small>Custo de referência</small><b>' + brl(pr.custo_ref) + "</b><span>" + (pr.fonte === "ultima" ? "última compra" : pr.fonte === "custo" ? "custo / CMC" : "sem custo") + "</span></div>";
  h += "<div><small>Markup em uso</small><b>" + fat(pr.markup) + "</b><span>" + (pr.markup_proprio ? "gravado no produto" : pr.markup > pr.padrao + 0.0001 ? "mantido (já estava acima de " + fat(pr.padrao) + ")" : "padrão") + "</span></div>";
  h += "<div><small>Preço sugerido</small><b>" + brl(pr.sugerido) + "</b><span>custo de ref. × markup</span></div>";
  h += '<div class="' + (pr.alerta ? "prec-al" : "") + '"><small>Markup atual do preço</small><b>' + fat(pr.fator) + "</b><span>" + (pr.alerta ? "abaixo de " + fat(pr.minimo) + "!" : pr.fator == null ? "sem preço ou custo" : "mínimo " + fat(pr.minimo)) + "</span></div></div>";
  if (pr.pendente) h += '<div class="prec-pend">A última compra calculou um preço <b>menor</b>: ' + brl(pr.pendente) + " (hoje " + brl(item.preco_venda) + '). <button type="button" class="btn ghost sm" id="f-aplicar" data-v="' + pr.pendente + '">Aplicar ' + brl(pr.pendente) + "</button> ou deixe como está e salve para manter.</div>";
  else if (pr.sugerido && item.preco_venda && pr.sugerido > Number(item.preco_venda) + 0.004) h += '<div class="prec-pend">O preço atual está abaixo do sugerido. Ele sobe sozinho na próxima compra, ou <button type="button" class="btn ghost sm" id="f-aplicar" data-v="' + pr.sugerido + '">Aplicar ' + brl(pr.sugerido) + "</button> agora.</div>";
  h += '<div class="prec-hist" id="f-hist">' + (item.prec_hist && item.prec_hist.length ? precHistHTML(item.prec_hist) : "") + "</div>";
  return h + "</div>";
}
function precLigar(item) {
  var b = $("#f-aplicar");
  if (b) b.onclick = function () {
    var f = $("#f-preco_venda"); if (!f) return;
    f.value = Number(b.dataset.v).toFixed(2).replace(".", ",");
    f.focus(); toast("Preço preenchido. Clique em Salvar para valer.");
  };
  // histórico de preços: vem só ao abrir o produto (a listagem não traz)
  if (!item || !item.id || item.prec_hist) return;
  api("GET", "/api/cadastros/produtos/" + item.id).then(function (d) {
    var hi = (d.item && d.item.prec_hist) || [], alvo = $("#f-hist");
    if (!alvo || !S.aberto || S.aberto.id !== item.id || !hi.length) return;
    alvo.innerHTML = precHistHTML(hi);
  }).catch(function () {});
}
function precHistHTML(hi) {
  return "<small>Últimas mudanças de preço</small>" + hi.map(function (x) { return "<div>" + dataBR(x.quando) + " · " + esc(x.motivo === "compra" ? "compra " + (x.ref || "") : x.ref || "manual") + " · " + brl(x.preco_antigo) + " → <b>" + brl(x.preco_novo) + "</b>" + (x.markup ? " (" + fat(x.markup) + ")" : "") + " · " + esc(x.por || "") + "</div>"; }).join("");
}
function fechar() { $("#gav").classList.remove("on"); $("#fundo").classList.remove("on"); S.aberto = null; }
function salvar() {
  var t = S.tipo, it = S.aberto || {}, d = { versao: it.versao };
  CAMPOS[t].forEach(function (c) { if (c[0] !== "sec" && c[0] !== "prec") d[c[0]] = $("#f-" + c[0]).value; });
  if (t === "parceiros") d.tags = Array.prototype.map.call(document.querySelectorAll("#f-tags .chip.on"), function (b) { return b.dataset.t; });
  var b = $("#g-salvar"); b.disabled = true;
  api(it.id ? "PUT" : "POST", "/api/cadastros/" + t + (it.id ? "/" + it.id : ""), d).then(function () {
    fechar(); toast(it.id ? "Cadastro atualizado." : "Cadastro criado."); carregar();
  }).catch(function (e) { var er = $("#f-erro"); er.textContent = e.message; er.style.display = "block"; }).finally(function () { b.disabled = false; });
}

// ---------- importação do Omie ----------
function lerCSV(txt) {
  txt = txt.replace(/^﻿/, "");
  var linhas = [], campo = "", lin = [], aspas = false;
  var sep = (txt.split("\n")[0].match(/;/g) || []).length >= (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  for (var i = 0; i < txt.length; i++) {
    var c = txt[i];
    if (aspas) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === sep) { lin.push(campo); campo = ""; }
    else if (c === "\n") { lin.push(campo.replace(/\r$/, "")); linhas.push(lin); lin = []; campo = ""; }
    else campo += c;
  }
  if (campo || lin.length) { lin.push(campo); linhas.push(lin); }
  var h = linhas.shift() || [];
  return linhas.filter(function (l) { return l.some(function (x) { return x.trim(); }); }).map(function (l) { var o = {}; h.forEach(function (k, i) { o[k.trim()] = (l[i] || "").trim(); }); return o; });
}
function mapParceiro(r) {
  return {
    documento: r["CNPJ / CPF"], razao: r["Razão Social / Nome Completo"], fantasia: r["Nome Fantasia / Nome Abreviado"], tags: r["Tags"], situacao: r["Situação"] === "Inativo" ? "Inativo" : "Ativo",
    telefone: r["Telefone"], contato: r["Contato"], email: r["E-mail"], cidade: cid(r["Cidade"]), uf: r["Estado"], endereco: r["Endereço"], bairro: r["Bairro"], cep: r["CEP"], ie: r["Inscrição Estadual"], im: r["Inscrição Municipal"],
    extra: { banco: r["Banco"] || undefined, agencia: r["Agência"] || undefined, conta: r["Conta Corrente"] || undefined, contribuinte_icms: r["Contribuinte do ICMS"], tipo_atividade: r["Tipo de Atividade"] || undefined, vendedor_padrao: r["Vendedor (padrão)"] || undefined, inclusao_omie: r["Inclusão"], alteracao_omie: r["Última Alteração"] },
  };
}
function mapProduto(r) {
  var u = r["Unidade"] || "", m = u.match(/\(([^)]+)\)\s*$/);
  return {
    codigo: r["Código"], descricao: r["Descrição"], familia: r["Família de Produto"], unidade: m ? m[1] : u, ncm: r["Código NCM"], cest: r["CEST"], ean: r["Código EAN (GTIN)"], preco_venda: r["Preço Unitário de Venda"], estoque: r["Estoque Disponível"],
    marca: r["Marca"], modelo: r["Modelo"], garantia_dias: r["Dias de Garantia"], tipo_item: r["Tipo do Item (Bloco K)"], caracteristicas: r["Características"], situacao: r["Situação"] === "Inativo" ? "Inativo" : "Ativo",
    extra: { unidade_nome: u.replace(/\s*\([^)]*\)\s*$/, ""), origem_mercadoria: r["Origem da Mercadoria"] || undefined, inclusao_omie: r["Inclusão"], alteracao_omie: r["Última Alteração"] },
  };
}
var IMP = { arquivos: [] };
function abrirImp() {
  IMP = { arquivos: [] };
  $("#mi-corpo").innerHTML = '<label class="drop"><input type="file" id="mi-f" accept=".csv,text/csv" multiple style="position:absolute;width:1px;height:1px;opacity:0"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg><b>Escolha os arquivos CSV exportados do Omie</b><span class="sub">Clientes, Fornecedores e/ou Produtos — pode escolher os três de uma vez</span></label><div class="info" style="margin:0">O sistema reconhece o tipo de cada arquivo pelas colunas. Clientes e fornecedores vão para o mesmo cadastro: quem estiver nos dois arquivos fica com as duas tags. Ninguém é apagado e nenhuma tag é retirada; quem já existe é atualizado (o custo digitado no SGO é mantido).</div><div id="mi-res"></div>';
  $("#mi-f").onchange = function (e) { lerArquivos(e.target.files); };
  $("#mimp").classList.add("on");
}
function lerArquivos(files) {
  var tarefas = Array.prototype.map.call(files, function (f) {
    return f.text().then(function (txt) {
      var rows = lerCSV(txt), h = rows[0] || {};
      var tipo = "Razão Social / Nome Completo" in h ? "parceiros" : "Código NCM" in h || "Família de Produto" in h ? "produtos" : null;
      return { nome: f.name, tipo: tipo, linhas: tipo === "parceiros" ? rows.map(mapParceiro) : tipo === "produtos" ? rows.map(mapProduto) : [] };
    });
  });
  Promise.all(tarefas).then(function (arqs) {
    IMP.arquivos = arqs;
    var ok = arqs.filter(function (a) { return a.tipo; });
    $("#mi-res").innerHTML = '<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:6px">' + arqs.map(function (a) { return "<div><b>" + esc(a.nome) + "</b> — " + (a.tipo ? a.linhas.length + (a.tipo === "parceiros" ? " clientes/fornecedores" : " produtos") : '<span style="color:#8E1B1B">formato não reconhecido</span>') + "</div>"; }).join("") + '</div><div id="mi-prog" style="display:none;margin-top:10px"><div class="barra"><i id="mi-bar"></i></div><div class="sub" id="mi-ptxt" style="margin-top:6px"></div></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn ghost" type="button" id="mi-c">Cancelar</button><button class="btn adv" type="button" id="mi-ok"' + (ok.length ? "" : " disabled") + ">Importar " + ok.reduce(function (s, a) { return s + a.linhas.length; }, 0) + " registros</button></div>";
    $("#mi-c").onclick = fecharImp; $("#mi-ok").onclick = importar;
  });
}
function importar() {
  var lotes = [];
  // parceiros primeiro (clientes e fornecedores se juntam pela chave documento + endereço)
  IMP.arquivos.filter(function (a) { return a.tipo; }).sort(function (a, b) { return a.tipo === b.tipo ? 0 : a.tipo === "parceiros" ? -1 : 1; }).forEach(function (a) {
    for (var i = 0; i < a.linhas.length; i += 200) lotes.push({ tipo: a.tipo, linhas: a.linhas.slice(i, i + 200) });
  });
  var tot = { parceiros: { novos: 0, atualizados: 0, ignorados: 0 }, produtos: { novos: 0, atualizados: 0, ignorados: 0 } }, feito = 0;
  $("#mi-ok").disabled = true; $("#mi-prog").style.display = "block";
  var cadeia = Promise.resolve();
  lotes.forEach(function (l) {
    cadeia = cadeia.then(function () {
      $("#mi-ptxt").textContent = "Enviando lote " + (feito + 1) + " de " + lotes.length + "…";
      return api("POST", "/api/cadastros/importar", l).then(function (r) { ["novos", "atualizados", "ignorados"].forEach(function (k) { tot[l.tipo][k] += r[k] || 0; }); feito++; $("#mi-bar").style.width = Math.round((feito / lotes.length) * 100) + "%"; });
    });
  });
  cadeia.then(function () {
    var f = function (k, n) { var t = tot[k]; return t.novos + t.atualizados + t.ignorados ? "<div><b>" + n + ":</b> " + t.novos + " novos · " + t.atualizados + " atualizados" + (t.ignorados ? " · " + t.ignorados + " ignorados (sem nome/código)" : "") + "</div>" : ""; };
    $("#mi-ptxt").innerHTML = '<div style="color:#1E5A2D;font-weight:700;margin-bottom:4px">Importação concluída.</div>' + f("parceiros", "Clientes e fornecedores") + f("produtos", "Produtos");
    $("#mi-c").textContent = "Fechar";
    carregar(); avisarShell();
  }).catch(function (e) { $("#mi-ptxt").innerHTML = '<span style="color:#8E1B1B;font-weight:600">Parou no lote ' + (feito + 1) + ": " + esc(e.message) + ". O que já foi enviado ficou salvo; pode importar de novo sem duplicar.</span>"; $("#mi-ok").disabled = false; });
}
function fecharImp() { $("#mimp").classList.remove("on"); }

// ---------- famílias de produto (cadastro próprio; o produto escolhe da lista) ----------
function famCarregar() {
  return api("GET", "/api/cadastros/familias").then(function (d) { S.familias = d.itens || []; S.semFamilia = d.sem_familia || 0; famAtualizarSelect(); if (S.tipo === "produtos" && S.dados && $("#th-fam")) { var th = $("#th-fam").closest("th"); if (th) th.innerHTML = thFamilia(); } return d; })
    .catch(function (e) { toast(e.message); });
}
function famSelect(id, v) {
  var atual = String(v || "").trim(), lista = S.familias || [], tem = false;
  var h = '<select class="field" id="' + id + '"><option value="">— Sem família —</option>';
  lista.forEach(function (f) {
    var sel = atual && f.nome.toLowerCase() === atual.toLowerCase();
    if (sel) tem = true;
    if (f.situacao === "Inativo" && !sel) return;
    h += '<option value="' + esc(f.nome) + '"' + (sel ? " selected" : "") + ">" + esc(f.nome) + (f.situacao === "Inativo" ? " (inativa)" : "") + "</option>";
  });
  if (atual && !tem) h += '<option value="' + esc(atual) + '" selected>' + esc(atual) + (S.familias ? " (não cadastrada)" : "") + "</option>";
  return h + "</select>";
}
// a gaveta pode abrir antes da lista chegar: refaz o select mantendo o valor escolhido
function famAtualizarSelect() {
  var s = $("#f-familia"); if (!s) return;
  var w = document.createElement("div"); w.innerHTML = famSelect("f-familia", s.value);
  s.parentNode.replaceChild(w.firstChild, s);
}
function famAbrir() { $("#mfam").classList.add("on"); famDesenhar(); famCarregar().then(famDesenhar); setTimeout(function () { var i = $("#mf-novo"); if (i) i.focus(); }, 60); }
function famFechar() { $("#mfam").classList.remove("on"); }
function famDesenhar() {
  var L = S.familias, c = $("#mf-corpo");
  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap"><label for="mf-novo" style="position:absolute;width:1px;height:1px;overflow:hidden">Nova família</label><input class="field" id="mf-novo" placeholder="Nova família (ex.: CFTV)" maxlength="80" style="flex:1 1 220px"><button type="button" class="btn adv" id="mf-add">Adicionar</button></div>';
  if (!L) { c.innerHTML = h + '<div class="sub">Carregando…</div>'; famLigar(); return; }
  h += '<div class="tw"><table class="tbl"><thead><tr><th>Família</th><th style="text-align:right">Produtos</th><th>Situação</th><th style="text-align:right">Ações</th></tr></thead><tbody>' +
    (L.map(function (f) {
      return '<tr data-id="' + f.id + '"><td style="font-weight:600">' + esc(f.nome) + '</td><td class="num">' + num(f.produtos) + "</td><td>" + (f.situacao === "Inativo" ? '<span class="pill t-ina">Inativa</span>' : "Ativa") + '</td><td style="text-align:right;white-space:nowrap"><button type="button" class="btn ghost sm" data-a="ren">Renomear</button> <button type="button" class="btn ghost sm" data-a="sit">' + (f.situacao === "Inativo" ? "Ativar" : "Inativar") + "</button>" + (Number(f.produtos) ? "" : ' <button type="button" class="btn ghost sm" data-a="del">Excluir</button>') + "</td></tr>";
    }).join("") || '<tr><td colspan="4" class="vazio">Nenhuma família cadastrada.</td></tr>') + "</tbody></table></div>";
  h += '<div class="info">' + L.length + (L.length === 1 ? " família" : " famílias") + (S.semFamilia ? " · <b>" + num(S.semFamilia) + " produto(s) sem família</b>" : "") + ". Renomear muda o nome em todos os produtos da família. Família inativa não aparece para novos produtos. Só dá para excluir família sem produtos.</div>";
  c.innerHTML = h; famLigar();
}
function famLigar() {
  var inp = $("#mf-novo"), add = $("#mf-add");
  add.onclick = function () {
    var v = inp.value.trim(); if (!v) { inp.focus(); return; }
    add.disabled = true;
    api("POST", "/api/cadastros/familias", { nome: v }).then(function (r) { toast("Família " + r.item.nome + " cadastrada."); return famCarregar(); }).then(famDesenhar)
      .catch(function (e) { toast(e.message); add.disabled = false; });
  };
  inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); add.onclick(); } };
  var tb = $("#mf-corpo tbody"); if (!tb) return;
  tb.onclick = function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var tr = b.closest("tr"), id = Number(tr.dataset.id), f = (S.familias || []).filter(function (x) { return Number(x.id) === id; })[0]; if (!f) return;
    var a = b.dataset.a;
    if (a === "ren") {
      var td = tr.children[0];
      td.innerHTML = '<span style="display:flex;gap:6px"><input class="field" value="' + esc(f.nome) + '" maxlength="80" aria-label="Novo nome da família" style="min-width:160px"><button type="button" class="btn adv sm">Salvar</button></span>';
      var i2 = td.querySelector("input"), s2 = td.querySelector("button"); i2.focus(); i2.select();
      s2.onclick = function () {
        var nv = i2.value.trim(); if (!nv || nv.toUpperCase() === f.nome) { famDesenhar(); return; }
        s2.disabled = true;
        api("PUT", "/api/cadastros/familias/" + id, { nome: nv }).then(function (r) { toast("Família renomeada para " + r.item.nome + (r.renomeados ? " em " + r.renomeados + " produto(s)" : "") + "."); return famCarregar(); })
          .then(function () { famDesenhar(); carregar(); }).catch(function (er) { toast(er.message); s2.disabled = false; });
      };
      i2.onkeydown = function (ev) { if (ev.key === "Enter") { ev.preventDefault(); s2.onclick(); } else if (ev.key === "Escape") { ev.stopPropagation(); famDesenhar(); } };
      return;
    }
    b.disabled = true;
    var req = a === "sit" ? api("PUT", "/api/cadastros/familias/" + id, { situacao: f.situacao === "Inativo" ? "Ativo" : "Inativo" }) : api("DELETE", "/api/cadastros/familias/" + id);
    req.then(function () { toast(a === "del" ? "Família " + f.nome + " excluída." : "Família " + f.nome + (f.situacao === "Inativo" ? " ativada." : " inativada.")); return famCarregar(); })
      .then(famDesenhar).catch(function (er) { toast(er.message); b.disabled = false; });
  };
}

// ---------- eventos ----------
document.querySelectorAll(".seg button").forEach(function (b) { b.onclick = function () { if (S.tipo === b.dataset.tipo) return; S.tipo = b.dataset.tipo; S.pag = 1; S.tags = []; history.replaceState(null, "", "?tipo=" + S.tipo); try { window.parent.postMessage({ sgo: "rota", url: S.tipo === "produtos" ? "/cadastros/produtos" : S.tipo === "servicos" ? "/cadastros/servicos" : S.tipo === "maoobra" ? "/cadastros/maoobra" : "/cadastros/parceiros" }, location.origin); } catch (e) {} carregar(); }; });
var tq; $("#q").oninput = function () { clearTimeout(tq); tq = setTimeout(function () { S.q = $("#q").value.trim(); S.pag = 1; carregar(); }, 250); };
$("#sit").onchange = function () { S.sit = $("#sit").value; S.pag = 1; carregar(); };
$("#est").onchange = function () { S.est = $("#est").checked; S.pag = 1; carregar(); };
$("#th").onclick = function (e) { var b = e.target.closest("[data-f]"); if (!b) return; if (b.dataset.f === "fam") { S.famFora = []; famPopFechar(); } else if (b.dataset.f === "custo") S.fCusto = !S.fCusto; else S.fMarkup = !S.fMarkup; S.pag = 1; carregar(); };
$("#th").addEventListener("click", function (e) { if (e.target.closest("#th-fam")) { if ($("#fam-pop").hidden) famPopAbrir(); else famPopFechar(); } });
document.addEventListener("mousedown", function (e) { var pop = $("#fam-pop"); if (pop && !pop.hidden && !e.target.closest("#fam-pop") && !e.target.closest("#th-fam")) famPopFechar(); });
$("#tags").onclick = function (e) { var b = e.target.closest("[data-tag]"); if (!b) return; var t = b.dataset.tag, i = S.tags.indexOf(t); if (i >= 0) S.tags.splice(i, 1); else S.tags.push(t); S.pag = 1; carregar(); };
$("#ant").onclick = function () { S.pag--; carregar(); };
$("#prox").onclick = function () { S.pag++; carregar(); };
$("#tb").onclick = function (e) { var tr = e.target.closest("tr[data-id]"); if (!tr) return; var it = S.dados.itens.find(function (x) { return String(x.id) === tr.dataset.id; }); abrir(it); };
$("#tb").onkeydown = function (e) { if (e.key === "Enter") $("#tb").onclick(e); };
$("#b-novo").onclick = function () { abrir(null); };
$("#b-imp").onclick = abrirImp;
var bSyncOmie = $("#b-sync-omie");
var syncRotulo = bSyncOmie ? bSyncOmie.textContent : "";
var syncTimer = null;
// Porcentagem no botão: consulta o progresso no servidor a cada segundo enquanto sincroniza.
function syncMostrar(p) {
  if (!bSyncOmie) return;
  bSyncOmie.textContent = "Sincronizando… " + Math.max(0, Math.min(100, Math.round((p && p.pct) || 0))) + "%";
  bSyncOmie.title = (p && p.etapa) || "";
}
function syncAcompanhar(tipo) {
  clearInterval(syncTimer);
  syncTimer = setInterval(function () {
    api("GET", "/api/cadastros/sync-omie/progresso?tipo=" + tipo).then(function (p) {
      if (!bSyncOmie.disabled) { clearInterval(syncTimer); return; }
      if (p && p.ativo) syncMostrar(p);
    }).catch(function () {});
  }, 1000);
}
function syncParar() { clearInterval(syncTimer); syncTimer = null; if (bSyncOmie) { bSyncOmie.disabled = false; bSyncOmie.textContent = syncRotulo; bSyncOmie.title = ""; } }
// Se a página abrir no meio de um sync (ex.: recarregou), retoma a porcentagem e recarrega a lista no fim.
function syncRetomar() {
  if (!bSyncOmie || bSyncOmie.disabled || (S.tipo !== "parceiros" && S.tipo !== "produtos")) return;
  var tipo = S.tipo === "produtos" ? "produtos" : "clientes";
  api("GET", "/api/cadastros/sync-omie/progresso?tipo=" + tipo).then(function (p) {
    if (!p || !p.ativo || bSyncOmie.disabled) return;
    bSyncOmie.disabled = true; syncMostrar(p);
    clearInterval(syncTimer);
    syncTimer = setInterval(function () {
      api("GET", "/api/cadastros/sync-omie/progresso?tipo=" + tipo).then(function (q) {
        if (q && q.ativo) { syncMostrar(q); return; }
        syncParar(); toast("Sincronização com a Omie concluída."); carregar(); avisarShell();
      }).catch(function () {});
    }, 1000);
  }).catch(function () {});
}
if (bSyncOmie) bSyncOmie.onclick = function () {
  if (bSyncOmie.disabled) return;
  if (S.tipo !== "parceiros" && S.tipo !== "produtos") return;
  var tipo = S.tipo === "produtos" ? "produtos" : "clientes";
  bSyncOmie.disabled = true;
  syncMostrar({ pct: 0, etapa: "Iniciando" });
  syncAcompanhar(tipo);
  api("POST", "/api/cadastros/sync-omie", { tipo: tipo }).then(function (d) {
    clearInterval(syncTimer); syncMostrar({ pct: 100 });
    var bloco = tipo === "produtos" ? d.produtos : d.clientes;
    var msg = (bloco ? bloco.total : 0) + (tipo === "produtos" ? " produto(s)" : " cliente(s)") +
      " · " + (bloco ? bloco.novos : 0) + " novos · " + (bloco ? bloco.atualizados : 0) + " atualizados";
    if (d.erros && d.erros.length) toast("Sync parcial: " + msg);
    else toast("Sincronizado: " + msg);
    carregar();
    avisarShell();
  }).catch(function (e) {
    toast(e.message);
  }).then(function () {
    setTimeout(syncParar, 600);
  });
};
$("#g-x").onclick = fechar; $("#g-cancel").onclick = fechar; $("#fundo").onclick = fechar; $("#g-salvar").onclick = salvar;
$("#mi-x").onclick = fecharImp;
document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!$("#fam-pop").hidden) famPopFechar(); else if ($("#mfam").classList.contains("on")) famFechar(); else if ($("#mimp").classList.contains("on")) fecharImp(); else if (S.aberto) fechar(); } });
$("#b-fam").onclick = famAbrir; $("#mf-x").onclick = famFechar;
$("#mfam").onclick = function (e) { if (e.target === $("#mfam")) famFechar(); };
desenhar(); carregar(); syncRetomar();

