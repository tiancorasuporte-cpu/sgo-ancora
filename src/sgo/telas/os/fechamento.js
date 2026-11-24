// Complemento original da tela (roda no navegador).
/* eslint-disable */
// @ts-nocheck
if (typeof window !== "undefined") {
/* Fechamento da OS (Executado → Finalizado) · v23
   Mostra o tempo no cliente (check-in/check-out de todas as visitas), quem executou e
   sugere a mão de obra pelo Cadastro de Mão de obra. A Assistência confirma ou ajusta. */
(function () {
  "use strict";
  var TOL = 10; // minutos de tolerância antes de cobrar mais uma hora
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function brl(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : NaN; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(ms) { var d = new Date(ms); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function hora(ms) { var d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function durTxt(min) { min = Math.round(min); return min < 60 ? min + " min" : Math.floor(min / 60) + " h" + (min % 60 ? " " + pad(min % 60) + " min" : ""); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  // todas as idas ao cliente: as que ficaram guardadas + a atual
  function visitas(c) {
    var l = (c.visitas || []).slice();
    if (c.ci) l.push({ ci: c.ci, co: c.co || null, fim: null });
    return l.map(function (v) {
      var fim = v.co || v.fim || null, min = fim && fim > v.ci ? (fim - v.ci) / 6e4 : 0;
      return { ci: v.ci, co: v.co || null, fim: fim, min: min, semCo: !v.co };
    });
  }
  function papel(x) { return /aux/.test(norm(x.categoria + " " + x.descricao)) ? "aux" : "tec"; }
  function unid(x) { var u = norm(x.unidade); return u.indexOf("meio") >= 0 ? "M" : u === "dia" ? "D" : u === "hora" ? "H" : null; }
  // combinação mais barata de dia (8 h), meio dia (4 h) e hora que cobre as horas cobradas
  function sugerir(tabela, quem, minutos) {
    if (!(minutos > 0)) return null;
    var it = { H: null, M: null, D: null };
    tabela.forEach(function (x) { if (papel(x) === quem && x.preco_venda != null) { var u = unid(x); if (u && !it[u]) it[u] = x; } });
    if (!it.H && !it.M && !it.D) return null;
    var hb = Math.max(1, Math.ceil((minutos - TOL) / 60)), best = null;
    for (var d = 0; d <= Math.ceil(hb / 8) + 1; d++) for (var m = 0; m <= 2; m++) {
      var h = Math.max(0, hb - 8 * d - 4 * m);
      if ((d && !it.D) || (m && !it.M) || (h && !it.H)) continue;
      var v = d * (it.D ? it.D.preco_venda : 0) + m * (it.M ? it.M.preco_venda : 0) + h * (it.H ? it.H.preco_venda : 0);
      var n = d + m + h;
      if (!best || v < best.v - 0.001 || (Math.abs(v - best.v) < 0.001 && n < best.n)) best = { v: v, n: n, d: d, m: m, h: h };
    }
    if (!best) return null;
    var q = {};
    if (best.d) q[it.D.id] = best.d; if (best.m) q[it.M.id] = best.m; if (best.h) q[it.H.id] = best.h;
    return { horas: hb, valor: best.v, qtd: q };
  }
  function css() {
    if (document.getElementById("fx-css")) return;
    var s = document.createElement("style"); s.id = "fx-css";
    s.textContent = ".fx-f{position:fixed;inset:0;background:#1414148c;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;overflow:auto;font:14px Inter,system-ui,sans-serif;color:#141414}" +
      ".fx-m{background:#fff;border-radius:14px;width:100%;max-width:760px;box-shadow:0 20px 60px #00000059;display:flex;flex-direction:column}" +
      ".fx-t{display:flex;justify-content:space-between;gap:12px;padding:16px 20px;background:#141414;color:#fff;border-radius:14px 14px 0 0;border-bottom:4px solid #FFD200}" +
      ".fx-t .k{font:700 11px Inter,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#FFD200}.fx-t h2{margin:2px 0 0;font:800 21px system-ui,sans-serif;text-transform:uppercase}.fx-t p{margin:4px 0 0;color:#cfcfc8;font-size:13px}" +
      ".fx-x{border:0;background:none;color:#fff;font-size:26px;width:36px;height:36px;border-radius:6px;cursor:pointer}.fx-x:hover{background:#ffffff1f}" +
      ".fx-c{padding:16px 20px;display:flex;flex-direction:column;gap:14px}.fx-s{display:flex;flex-direction:column;gap:8px}.fx-h{font:800 14px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.3px;display:flex;align-items:center;gap:8px}.fx-h i{font-style:normal;width:22px;height:22px;border-radius:50%;background:#141414;color:#FFD200;font-size:12px;display:inline-flex;align-items:center;justify-content:center}" +
      ".fx-tempo{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch}.fx-big{background:#141414;color:#fff;border-radius:12px;padding:12px 16px;min-width:190px;border-left:5px solid #FFD200}.fx-big small{display:block;color:#FFD200;font:700 11px Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px}.fx-big b{font:800 30px system-ui,sans-serif;line-height:1.1}" +
      ".fx-vis{flex:1;min-width:240px;display:flex;flex-direction:column;gap:4px;font-size:13px}.fx-vis div{display:flex;justify-content:space-between;gap:8px;background:#F6F6F2;border-radius:8px;padding:6px 10px}.fx-warn{background:#FFF1D6;color:#7A4A00;border-radius:8px;padding:8px 10px;font-weight:600;font-size:13px}" +
      ".fx-pp{display:flex;flex-wrap:wrap;gap:6px}.fx-pp label{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #D6D6CF;border-radius:20px;padding:5px 10px;cursor:pointer;font-weight:500}.fx-pp label:has(input:checked){border-color:#141414;background:#FFF6CC}.fx-pp input{accent-color:#141414}" +
      ".fx-tb{width:100%;border-collapse:collapse;font-size:13.5px}.fx-tb th{text-align:left;font:700 11px Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#FFD200;background:#141414;padding:8px 10px}.fx-tb td{padding:7px 10px;border-bottom:1px solid #EEEEEA}.fx-tb .r{text-align:right;font-variant-numeric:tabular-nums}.fx-tb input{width:64px;min-height:34px;border:1px solid #BDBDB5;border-radius:6px;text-align:center;font:600 13px Inter,sans-serif}" +
      ".fx-sug{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#E3F1E6;color:#1E5A2D;border-radius:10px;padding:10px 12px;font-weight:600}.fx-sug button{margin-left:auto}" +
      ".fx-tot{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}.fx-tot label{display:flex;flex-direction:column;gap:4px;font:600 12px Inter,sans-serif;text-transform:uppercase;color:#3d3d3d}.fx-tot input,.fx-in{min-height:42px;border:1px solid #BDBDB5;border-radius:8px;padding:8px 12px;font:600 15px Inter,sans-serif}.fx-tot input{width:170px}" +
      ".fx-dif{font-weight:700;font-size:13px;padding:6px 10px;border-radius:8px}.fx-dif.up{background:#E3F1E6;color:#1E5A2D}.fx-dif.dn{background:#FDE2E1;color:#8E1B1B}" +
      ".fx-b{border:1.5px solid #141414;background:#fff;border-radius:8px;padding:0 14px;min-height:40px;font:600 13px Inter,sans-serif;cursor:pointer}.fx-b:hover{background:#F1F1EC}.fx-b.y{background:#FFD200;border-color:#FFD200}.fx-b.y:hover{background:#F2C500}.fx-b.sm{min-height:32px;padding:0 10px}" +
      ".fx-a{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #E6E6E0;flex-wrap:wrap}.fx-err{background:#FDECEA;color:#8C1D18;border:1px solid #F5C2BE;border-radius:8px;padding:10px 12px;font-weight:500}.fx-dica{font-size:12.5px;color:#5a5a5a}" +
      ".fx-man{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fx-man input{width:70px}" +
      ".fx-orc{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#E7EFFF;color:#1D3F6E;border-radius:10px;padding:10px 12px;font-size:13.5px}.fx-orc button{margin-left:auto}" +
      ".fx-tb input[data-mp]{width:110px;text-align:right}.fx-geral{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#141414;color:#fff;border-radius:10px;padding:12px 16px;font-weight:700}.fx-geral b{color:#FFD200;font-size:19px}.fx-geral small{display:block;font-weight:500;color:#bdbdb5;font-size:12px}";
    document.head.appendChild(s);
  }
  window.sgoFechamento = function (card, papelUsuario, ok) {
    css();
    var SG = (window.SGO && SGO.equipes) || {}, tabela = (SG.maoobra || []).slice();
    var eq = (SG.tecnicos || []).filter(function (t) { return t.equipe === card.tecnico; })[0];
    var pessoas = eq ? [eq.nome].concat(eq.outros || []) : (card.tecnico ? [card.tecnico] : []);
    var orcSv = (card.servicosOrc || []).filter(function (x) { return x && x.qtd > 0; }), orcTot = Math.round(orcSv.reduce(function (t, x) { return t + (Number(x.total) || 0); }, 0) * 100) / 100;
    var V = visitas(card), minCheck = V.reduce(function (s, v) { return s + v.min; }, 0);
    /* material a cobrar: adicionais usados em campo; sem orçamento, também o material aplicado (com orçamento ele já foi cobrado no orçamento) */
    var temOrc = !!(card.orcamento || card.orc);
    var mat = (card.itens || []).map(function (i) {
      var q = i.st === "extra" ? (parseInt(i.qtd, 10) || 1) : i.st === "aplicado" && !temOrc ? (parseInt(i.usado, 10) || 0) : 0;
      return q > 0 ? { nome: i.nome, pid: i.pid, qtd: q, origem: i.st === "extra" ? (i.origem === "empresa" ? "adicional · estoque da empresa" : "adicional · estoque do técnico") : "material da OS", preco: "", achou: null } : null;
    }).filter(Boolean);
    var matCarregando = mat.length > 0;
    if (mat.length) fetch("/api/estoque/precos", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-sgo": "1" }, body: JSON.stringify({ itens: mat.map(function (m) { return { nome: m.nome, pid: m.pid }; }) }) })
      .then(function (r) { return r.ok ? r.json() : { itens: [] }; })
      .then(function (j) { (j.itens || []).forEach(function (p, k) { var m = mat[k]; if (!m) return; m.achou = !!p.produto_id; m.codigo = p.codigo || ""; if (p.preco != null && m.preco === "") m.preco = Number(p.preco).toFixed(2).replace(".", ","); }); })
      .catch(function () {}).then(function () { matCarregando = false; if (document.body.contains(f)) desenhar(); });
    function totalMat() { return mat.reduce(function (t, m) { var p = num(m.preco); return t + (isFinite(p) ? p * m.qtd : 0); }, 0); }
    var st = {
      manual: !minCheck, horasMan: "", minMan: "",
      marcados: pessoas.slice(), aux: card.auxiliar || "",
      qtd: {}, valor: "", motivo: "", err: ""
    };
    function minutos() { if (!st.manual) return minCheck; var h = parseInt(st.horasMan, 10) || 0, m = parseInt(st.minMan, 10) || 0; return h * 60 + m; }
    function sug() {
      var mi = minutos(), a = sugerir(tabela, "tec", mi), b = st.aux ? sugerir(tabela, "aux", mi) : null;
      if (!a && !b) return null;
      var q = {}, v = 0, t = [];
      [a, b].forEach(function (s) { if (!s) return; v += s.valor; Object.keys(s.qtd).forEach(function (k) { q[k] = (q[k] || 0) + s.qtd[k]; }); });
      tabela.forEach(function (x) { if (q[x.id]) t.push(q[x.id] + " × " + x.descricao); });
      return { valor: v, qtd: q, texto: t.join(" + "), horas: (a || b).horas };
    }
    function totalItens() { return tabela.reduce(function (s, x) { return s + (st.qtd[x.id] || 0) * (x.preco_venda || 0); }, 0); }
    function aplicarSug() { var s = sug(); st.qtd = s ? Object.assign({}, s.qtd) : {}; st.valor = ""; }
    aplicarSug();
    var f = document.createElement("div"); f.className = "fx-f";
    f.innerHTML = '<div class="fx-m" role="dialog" aria-modal="true" aria-labelledby="fx-tt"><div class="fx-t"><div><div class="k">OS ' + esc(card.num) + ' · fechamento</div><h2 id="fx-tt">Finalizar a OS</h2><p>' + esc(card.cliente || "") + (card.servico ? " · " + esc(card.servico) : "") + '</p></div><button type="button" class="fx-x" aria-label="Fechar">×</button></div><div class="fx-c" id="fx-c"></div><div class="fx-a"><button type="button" class="fx-b" data-x>Cancelar</button><button type="button" class="fx-b y" id="fx-ok">Confirmar e finalizar</button></div></div>';
    document.body.appendChild(f);
    function fechar() { f.remove(); document.removeEventListener("keydown", tecla); }
    function tecla(e) { if (e.key === "Escape") fechar(); }
    document.addEventListener("keydown", tecla);
    f.querySelector(".fx-x").onclick = fechar; f.querySelector("[data-x]").onclick = fechar;
    function desenhar() {
      var ae = document.activeElement, foco = null, pos = null;
      if (ae && f.contains(ae)) { foco = ae.id ? "#" + ae.id : ae.dataset && ae.dataset.q ? '[data-q="' + ae.dataset.q + '"]' : ae.dataset && ae.dataset.mp ? '[data-mp="' + ae.dataset.mp + '"]' : null; try { pos = ae.selectionStart; } catch (e) { pos = null; } }
      var mi = minutos(), s = sug(), tot = totalItens(), fin = st.valor === "" ? tot : num(st.valor);
      var h = st.err ? '<div class="fx-err" role="alert">' + esc(st.err) + "</div>" : "";
      // 1. tempo
      h += '<div class="fx-s"><div class="fx-h"><i>1</i>Tempo no cliente</div><div class="fx-tempo"><div class="fx-big"><small>' + (st.manual ? "Informado à mão" : "Pelo check-in e check-out") + "</small><b>" + (mi ? durTxt(mi) : "—") + "</b></div>";
      if (V.length) h += '<div class="fx-vis">' + V.map(function (v, i) { return "<div><span>" + (V.length > 1 ? i + 1 + "ª ida · " : "") + hm(v.ci) + " → " + (v.co ? hora(v.co) : v.fim ? hora(v.fim) + " (sem check-out)" : "sem check-out") + "</span><b>" + (v.min ? durTxt(v.min) : "—") + "</b></div>"; }).join("") + "</div>";
      h += "</div>";
      if (!V.length) h += '<div class="fx-warn">Esta OS não tem check-in e check-out no app. Informe o tempo que a equipe ficou no cliente.</div>';
      else if (V.some(function (v) { return v.semCo; })) h += '<div class="fx-warn">Uma das idas ficou sem check-out. O tempo foi contado até a OS sair da execução; confira com o técnico.</div>';
      h += '<label class="fx-man" style="font-weight:500"><input type="checkbox" id="fx-mck"' + (st.manual ? " checked" : "") + (V.length ? "" : " disabled") + ' style="width:18px;height:18px;accent-color:#141414">Corrigir o tempo à mão</label>';
      if (st.manual) h += '<div class="fx-man"><input class="fx-in" id="fx-hh" inputmode="numeric" value="' + esc(st.horasMan) + '" aria-label="Horas"> h <input class="fx-in" id="fx-mm" inputmode="numeric" value="' + esc(st.minMan) + '" aria-label="Minutos"> min</div>';
      h += "</div>";
      // 2. quem executou
      h += '<div class="fx-s"><div class="fx-h"><i>2</i>Quem executou</div><div class="fx-dica">' + esc(card.tecnico || "Equipe não informada") + ". Desmarque quem não foi.</div>";
      h += '<div class="fx-pp">' + pessoas.map(function (p, i) { return '<label><input type="checkbox" data-p="' + i + '"' + (st.marcados.indexOf(p) >= 0 ? " checked" : "") + ">" + esc(p) + (i === 0 && eq ? " · principal" : "") + "</label>"; }).join("") + "</div>";
      var auxs = (SG.auxiliares || []).map(function (a) { return a.nome; });
      if (st.aux && auxs.indexOf(st.aux) < 0) auxs.unshift(st.aux);
      h += '<label class="fx-dica" for="fx-aux">Auxiliar técnico</label><select id="fx-aux" class="fx-in" style="max-width:320px"><option value="">Sem auxiliar</option>' + auxs.map(function (a) { return "<option" + (a === st.aux ? " selected" : "") + ">" + esc(a) + "</option>"; }).join("") + "</select></div>";
      // 3. mão de obra
      h += '<div class="fx-s"><div class="fx-h"><i>3</i>Mão de obra</div>';
      if (orcSv.length) h += '<div class="fx-orc"><div><b>Previsto no orçamento' + (card.orc ? " " + esc(card.orc) : "") + ':</b> ' + esc(orcSv.map(function (x) { return (Math.round(x.qtd * 100) / 100).toString().replace(".", ",") + " × " + x.descricao; }).join(" + ")) + " = " + brl(orcTot) + '</div><button type="button" class="fx-b sm" id="fx-uo">Usar o do orçamento</button></div>';
      if (!tabela.length) h += '<div class="fx-warn">Nenhuma mão de obra com valor em Cadastros › Mão de obra. Informe o valor final abaixo.</div>';
      else {
        h += s ? '<div class="fx-sug">Sugestão pelo tempo (' + s.horas + (s.horas === 1 ? " hora cobrada" : " horas cobradas") + "): " + esc(s.texto) + " = " + brl(s.valor) + '<button type="button" class="fx-b sm" id="fx-us">Usar sugestão</button></div>' : '<div class="fx-warn">Sem tempo registrado, não há sugestão. Escolha as quantidades.</div>';
        h += '<table class="fx-tb"><thead><tr><th>Mão de obra</th><th class="r">Valor</th><th class="r">Qtd.</th><th class="r">Subtotal</th></tr></thead><tbody>' + tabela.map(function (x) { var q = st.qtd[x.id] || 0; return "<tr><td>" + esc(x.descricao) + (x.categoria ? ' <span class="fx-dica">· ' + esc(x.categoria) + "</span>" : "") + '</td><td class="r">' + brl(x.preco_venda) + " /" + esc(String(x.unidade || "").toLowerCase()) + '</td><td class="r"><input inputmode="numeric" data-q="' + x.id + '" value="' + q + '" aria-label="Quantidade de ' + esc(x.descricao) + '"></td><td class="r">' + brl(q * (x.preco_venda || 0)) + "</td></tr>"; }).join("") + "</tbody></table>";
      }
      h += '<div class="fx-tot"><label>Valor final da mão de obra<input id="fx-val" inputmode="decimal" placeholder="' + esc(tot.toLocaleString("pt-BR", { minimumFractionDigits: 2 })) + '" value="' + esc(st.valor) + '"></label>';
      if (s && isFinite(fin) && Math.abs(fin - s.valor) > 0.009) h += '<span class="fx-dif ' + (fin > s.valor ? "up" : "dn") + '">' + (fin > s.valor ? "+" : "−") + brl(Math.abs(fin - s.valor)) + " em relação à sugestão</span>";
      h += "</div>";
      var precisa = s && isFinite(fin) && Math.abs(fin - s.valor) > 0.009;
      if (precisa || !s) h += '<label class="fx-dica" for="fx-mot">' + (s ? "Motivo do ajuste (obrigatório)" : "Observação (opcional)") + '</label><input id="fx-mot" class="fx-in" maxlength="300" value="' + esc(st.motivo) + '" placeholder="Ex.: cliente com contrato, cobrar só a visita">';
      h += '<div class="fx-dica">Em branco, vale a soma da tabela acima. O material já foi conferido na etapa Executado.</div></div>';
      // 4. material a cobrar
      var vm = totalMat();
      h += '<div class="fx-s"><div class="fx-h"><i>4</i>Material a cobrar do cliente</div>';
      if (!mat.length) h += '<div class="fx-dica">' + (temOrc ? "O material desta OS já está no orçamento" + (card.orc ? " " + esc(card.orc) : "") + ". Nenhum item adicional para cobrar." : "Nenhum material usado nesta OS.") + "</div>";
      else {
        if (matCarregando) h += '<div class="fx-dica">Buscando os preços no cadastro de produtos…</div>';
        h += '<table class="fx-tb"><thead><tr><th>Produto</th><th class="r">Qtd.</th><th class="r">Valor unit.</th><th class="r">Subtotal</th></tr></thead><tbody>' + mat.map(function (m, k) { var p = num(m.preco); return "<tr><td>" + esc(m.nome) + ' <span class="fx-dica">· ' + esc(m.origem) + (m.achou === false ? " · sem cadastro" : "") + '</span></td><td class="r">' + m.qtd + '</td><td class="r"><input inputmode="decimal" data-mp="' + k + '" value="' + esc(m.preco) + '" placeholder="0,00" aria-label="Valor unitário de ' + esc(m.nome) + '"></td><td class="r">' + brl(isFinite(p) ? p * m.qtd : 0) + "</td></tr>"; }).join("") + "</tbody></table>";
        if (temOrc) h += '<div class="fx-dica">O material previsto no orçamento' + (card.orc ? " " + esc(card.orc) : "") + ' já foi cobrado nele; aqui entram só os adicionais.</div>';
        h += '<div class="fx-dica">Preço de venda do cadastro; pode ajustar. O material sai do estoque quando a OS é executada.</div>';
      }
      h += "</div>";
      h += '<div class="fx-geral"><span>Valor fechado do atendimento<small>Mão de obra ' + brl(isFinite(fin) ? fin : 0) + (mat.length ? " + material " + brl(vm) : "") + "</small></span><b>" + brl((isFinite(fin) ? fin : 0) + vm) + "</b></div>";
      var c = f.querySelector("#fx-c"); c.innerHTML = h;
      ligar();
      var el = foco && f.querySelector(foco);
      if (el) { el.focus(); try { if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } catch (e) {} }
    }
    function ligar() {
      var q = function (s) { return f.querySelector(s); };
      Array.prototype.forEach.call(f.querySelectorAll("input,select"), function (x) { x.addEventListener("input", function () { st.err = ""; var e = f.querySelector(".fx-err"); if (e) e.remove(); }); });
      q("#fx-mck").onchange = function () { st.manual = this.checked || !minCheck; if (st.manual && !st.horasMan && minCheck) { st.horasMan = String(Math.floor(minCheck / 60)); st.minMan = String(Math.round(minCheck % 60)); } aplicarSug(); desenhar(); };
      if (q("#fx-hh")) { q("#fx-hh").oninput = function () { st.horasMan = this.value.replace(/\D/g, ""); aplicarSug(); desenhar(); }; q("#fx-mm").oninput = function () { st.minMan = this.value.replace(/\D/g, ""); aplicarSug(); desenhar(); }; }
      Array.prototype.forEach.call(f.querySelectorAll("[data-p]"), function (b) { b.onchange = function () { var p = pessoas[+b.dataset.p]; st.marcados = st.marcados.filter(function (x) { return x !== p; }); if (b.checked) st.marcados.push(p); }; });
      q("#fx-aux").onchange = function () { st.aux = this.value; aplicarSug(); desenhar(); };
      if (q("#fx-uo")) q("#fx-uo").onclick = function () { st.qtd = {}; orcSv.forEach(function (x) { if (tabela.some(function (t) { return t.id === x.mo_id; })) st.qtd[x.mo_id] = (st.qtd[x.mo_id] || 0) + Math.round(x.qtd); }); st.valor = orcTot.toFixed(2).replace(".", ","); var sg = sug(); st.motivo = sg && Math.abs(orcTot - sg.valor) > 0.009 ? "Conforme o orçamento" + (card.orc ? " " + card.orc : "") : ""; st.err = ""; desenhar(); };
      if (q("#fx-us")) q("#fx-us").onclick = function () { aplicarSug(); st.motivo = ""; desenhar(); };
      Array.prototype.forEach.call(f.querySelectorAll("[data-q]"), function (i) { i.oninput = function () { st.qtd[i.dataset.q] = Math.max(0, Math.min(999, parseInt(i.value, 10) || 0)); desenhar(); }; });
      q("#fx-val").oninput = function () { st.valor = this.value; desenhar(); };
      if (q("#fx-mot")) q("#fx-mot").oninput = function () { st.motivo = this.value; };
      Array.prototype.forEach.call(f.querySelectorAll("[data-mp]"), function (i) { i.oninput = function () { mat[+i.dataset.mp].preco = i.value; desenhar(); }; });
    }
    f.querySelector("#fx-ok").onclick = function () {
      var mi = Math.round(minutos()), s = sug(), tot = totalItens(), fin = st.valor === "" ? tot : num(st.valor);
      st.err = "";
      if (!(mi > 0)) st.err = "Informe o tempo no cliente.";
      else if (!st.marcados.length) st.err = "Marque pelo menos um técnico que executou.";
      else if (!isFinite(fin) || fin < 0) st.err = "Valor final da mão de obra inválido.";
      else if (s && Math.abs(fin - s.valor) > 0.009 && !st.motivo.trim()) st.err = "Explique o motivo do ajuste da mão de obra.";
      else if (mat.some(function (m) { var p = num(m.preco); return m.preco !== "" && (!isFinite(p) || p < 0); })) st.err = "Confira o valor unitário do material.";
      if (st.err) { desenhar(); return; }
      fin = Math.round(fin * 100) / 100;
      var itens = tabela.filter(function (x) { return st.qtd[x.id] > 0; }).map(function (x) { return { id: x.id, descricao: x.descricao, unidade: x.unidade, categoria: x.categoria || "", qtd: st.qtd[x.id], preco: x.preco_venda }; });
      var quem = (window.EU && EU.nome) || papelUsuario || "Assistência";
      var fe = {
        quando: Date.now(), por: quem, minutos: mi, manual: !!st.manual, minCheck: Math.round(minCheck),
        visitas: V.map(function (v) { return { ci: v.ci, co: v.co, min: Math.round(v.min) }; }),
        equipe: card.tecnico || "", pessoas: st.marcados.slice(), auxiliar: st.aux || null,
        mo: itens, valorItens: Math.round(tot * 100) / 100, valorMO: fin,
        sugestao: s ? { valor: s.valor, texto: s.texto, horas: s.horas } : null,
        ajuste: s && Math.abs(fin - s.valor) > 0.009 ? st.motivo.trim() : null, obs: !s && st.motivo.trim() ? st.motivo.trim() : null
      };
      fe.mat = mat.map(function (m) { var p = num(m.preco); return { descricao: m.nome, codigo: m.codigo || "", qtd: m.qtd, preco: isFinite(p) ? Math.round(p * 100) / 100 : 0, origem: m.origem }; });
      fe.valorMat = Math.round(fe.mat.reduce(function (t, m) { return t + m.qtd * m.preco; }, 0) * 100) / 100;
      fe.valorTotal = Math.round((fin + fe.valorMat) * 100) / 100;
      fe.resumo = "tempo no cliente " + durTxt(mi) + (st.manual ? " (corrigido à mão)" : "") + " · mão de obra " + brl(fin) + (fe.ajuste ? " (ajustada: " + fe.ajuste + ")" : s ? " (conforme sugestão)" : "") + (fe.mat.length ? " · material " + brl(fe.valorMat) + " · total " + brl(fe.valorTotal) : "");
      fe.valorTxt = brl(fe.valorTotal);
      fechar(); ok(fe);
    };
    desenhar();
  };
})();

}
