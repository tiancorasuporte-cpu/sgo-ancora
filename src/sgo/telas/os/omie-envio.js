// Complemento da tela de OS (roda no navegador).
/* eslint-disable */
// @ts-nocheck
if (typeof window !== "undefined") {
/* Enviar para a Omie · v2
   Na OS finalizada, prepara o faturamento em um de três modos:
   - normal: produto vai como produto e mão de obra como serviço;
   - diluir: a mão de obra é rateada nos produtos, proporcional ao valor de cada um;
   - servico: tudo numa nota de serviço, com os produtos listados na descrição.
   A OS não muda: o que vai para a Omie fica guardado em card.faturamento.
   Depende de window.sgoTela (tela de OS). */
(function () {
  "use strict";
  var LAST = 7;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function brl(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function cts(v) { return Math.round((Number(v) || 0) * 100); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function agoraTxt() { var d = new Date(); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function cardAberto() { var T = window.sgoTela; return T && T.state && T.state.openId ? T.find(T.state.openId) : null; }

  /* ---------- regra do rateio (centavos inteiros, o total sempre fecha) ----------
     produtos: [{ descricao, codigo, qtd, unit }]  (unit em reais)
     servico: valor da mão de obra em reais
     Devolve as linhas com unit ajustado. A sobra de centavos vai num item de qtd 1;
     se não houver, uma unidade do item de maior valor vira uma linha à parte. */
  function diluir(produtos, servico) {
    var base = produtos.reduce(function (s, p) { return s + cts(p.unit) * p.qtd; }, 0);
    if (!(base > 0)) return null;
    var alvo = base + cts(servico), fator = alvo / base;
    var L = produtos.map(function (p) { return Object.assign({}, p, { orig: cts(p.unit), u: Math.round(cts(p.unit) * fator) }); });
    var resto = alvo - L.reduce(function (s, l) { return s + l.u * l.qtd; }, 0);
    if (resto !== 0) {
      var ord = L.slice().sort(function (a, b) { return b.u - a.u; });
      var um = ord.filter(function (l) { return l.qtd === 1; })[0];
      if (um) um.u += resto;
      else { var g = ord[0]; g.qtd -= 1; L.splice(L.indexOf(g) + 1, 0, Object.assign({}, g, { qtd: 1, u: g.u + resto, ajuste: true })); }
    }
    return L.filter(function (l) { return l.qtd > 0; }).map(function (l) {
      return { descricao: l.descricao, codigo: l.codigo, origem: l.origem, qtd: l.qtd, unitOriginal: l.orig / 100, unit: l.u / 100, total: (l.u * l.qtd) / 100, rateio: ((l.u - l.orig) * l.qtd) / 100, ajuste: !!l.ajuste };
    });
  }
  window.sgoRateio = diluir;

  /* ---------- mão de obra: a do fechamento; sem fechamento, a prevista no orçamento ---------- */
  function maoDeObra(c) {
    var fe = c.fech;
    if (fe && fe.valorMO != null) return { valor: Number(fe.valorMO) || 0, fonte: "valor fechado na finalização", itens: fe.mo || [] };
    var sv = (c.servicosOrc || []).filter(function (x) { return x && x.qtd > 0; });
    var v = Math.round(sv.reduce(function (t, x) { return t + (Number(x.total) || 0); }, 0) * 100) / 100;
    return { valor: v, fonte: sv.length ? "previsto no orçamento (OS sem fechamento)" : "OS sem fechamento e sem mão de obra no orçamento", itens: sv.map(function (x) { return { qtd: Math.round(x.qtd * 100) / 100, descricao: x.descricao }; }), semFech: true };
  }

  /* ---------- produtos da OS: orçamento (com descontos) + material adicional do fechamento ---------- */
  function deProdutosOrc(c) {
    return (c.produtosOrc || []).filter(function (p) { return p && (Number(p.qtd) > 0 || p.nome || p.descricao); }).map(function (p) {
      var q = Math.max(1, Math.round(Number(p.qtd) || 1));
      var u = Number(p.preco) || (q ? (Number(p.total) || 0) / q : 0);
      return { descricao: String(p.descricao || p.nome || ""), codigo: p.codigo || "", qtd: q, unit: Math.round(u * 100) / 100, origem: "Produtos vinculados da OS" };
    });
  }
  function produtosDaOs(c) {
    var fe = c.fech || {};
    var extras = (fe.mat || []).filter(function (m) { return m.qtd > 0; }).map(function (m) { return { descricao: m.descricao, codigo: m.codigo || "", qtd: m.qtd, unit: Number(m.preco) || 0, origem: "Adicional da OS" }; });
    var ligados = deProdutosOrc(c);
    var orc = c.orcamento && c.orcamento.id;
    if (!orc) return Promise.resolve({ itens: (ligados.length ? ligados : []).concat(extras), desconto: Number(c.descontoProd) || 0 });
    return fetch("/api/orcamento-ver/" + encodeURIComponent(orc), { credentials: "same-origin", headers: { "x-sgo": "1" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("não consegui abrir o orçamento " + (c.orcamento.num || ""))); })
      .then(function (j) {
        var d = (j.item && j.item.dados) || {};
        var todos = d.itens || [];
        var prod = todos.filter(function (i) { return i.tipo !== "servico"; });
        var sub = 0, pr = 0;
        todos.forEach(function (i) { var t = (Number(i.qtd) || 0) * (Number(i.preco) || 0) * (1 - Math.min(100, Math.max(0, Number(i.desc) || 0)) / 100); sub += t; if (i.tipo !== "servico") pr += t; });
        /* o desconto geral do orçamento entra nos produtos na proporção que eles têm no subtotal */
        var dg = Math.min(sub, Math.max(0, Number(d.desconto) || 0)), fator = sub > 0 && pr > 0 ? 1 - dg / sub : 1;
        var itens = prod.map(function (i) {
          var q = Math.max(1, Math.round(Number(i.qtd) || 1));
          var u = (Number(i.preco) || 0) * (1 - Math.min(100, Math.max(0, Number(i.desc) || 0)) / 100) * fator;
          return { descricao: String(i.descricao || ""), codigo: i.codigo || "", qtd: q, unit: Math.round(u * 100) / 100, origem: "Orçamento " + (c.orcamento.num || "") };
        });
        return { itens: itens.concat(extras), desconto: Math.round(dg * pr / (sub || 1) * 100) / 100 };
      });
  }

  /* ---------- montagem do que vai para a Omie em cada modo ---------- */
  function montar(modo, c, prods) {
    var M = maoDeObra(c), mo = M.valor;
    var totProd = prods.reduce(function (s, p) { return s + cts(p.unit) * p.qtd; }, 0) / 100;
    var descMo = (M.itens || []).map(function (x) { return x.qtd + " × " + x.descricao; }).join(" + ") || "Mão de obra de instalação";
    var r = { modo: modo, produtos: [], servicos: [], totalProdutos: 0, totalServicos: 0 };
    if (modo === "normal") {
      r.produtos = prods.map(function (p) { return { descricao: p.descricao, codigo: p.codigo, origem: p.origem, qtd: p.qtd, unitOriginal: p.unit, unit: p.unit, total: cts(p.unit) * p.qtd / 100, rateio: 0 }; });
      if (mo > 0) r.servicos = [{ descricao: "Mão de obra · OS " + c.num, detalhe: descMo, valor: mo }];
    } else if (modo === "diluir") {
      r.produtos = diluir(prods, mo) || [];
    } else {
      var lista = prods.map(function (p) { return p.qtd + " × " + p.descricao; }).join("; ");
      r.servicos = [{ descricao: "Serviço de instalação · OS " + c.num, detalhe: descMo + (lista ? ". Materiais aplicados: " + lista : ""), valor: Math.round((totProd + mo) * 100) / 100 }];
    }
    r.totalProdutos = r.produtos.reduce(function (s, p) { return s + cts(p.total); }, 0) / 100;
    r.totalServicos = r.servicos.reduce(function (s, x) { return s + cts(x.valor); }, 0) / 100;
    r.total = Math.round((r.totalProdutos + r.totalServicos) * 100) / 100;
    return r;
  }

  /* ---------- visual ---------- */
  function css() {
    if (document.getElementById("om-css")) return;
    var s = document.createElement("style"); s.id = "om-css";
    s.textContent =
      ".om-row{margin-top:12px;border-radius:12px;background:#E7EFFF;box-shadow:inset 0 0 0 1.5px #1D3F6E;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:Inter,system-ui,sans-serif}" +
      ".om-row .om-lbl{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#1D3F6E}.om-row .om-st{font-size:13px;color:#1D3F6E;flex:1;min-width:160px}" +
      ".om-btn{font:700 13.5px Inter,system-ui,sans-serif;min-height:44px;padding:0 16px;border-radius:9px;border:1.5px solid #141414;background:#FFD200;color:#141414;cursor:pointer}.om-btn:hover{background:#f2c500}.om-btn:focus-visible{outline:3px solid #141414;outline-offset:2px}" +
      ".om-f{position:fixed;inset:0;background:#1414148c;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;overflow:auto;font:14px Inter,system-ui,sans-serif;color:#141414}" +
      ".om-m{background:#fff;border-radius:14px;width:100%;max-width:820px;box-shadow:0 20px 60px #00000059;display:flex;flex-direction:column}" +
      ".om-t{display:flex;justify-content:space-between;gap:12px;padding:16px 20px;background:#141414;color:#fff;border-radius:14px 14px 0 0;border-bottom:4px solid #FFD200}" +
      ".om-t .k{font:700 11px Inter,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#FFD200}.om-t h2{margin:2px 0 0;font:800 21px system-ui,sans-serif;text-transform:uppercase}.om-t p{margin:4px 0 0;color:#cfcfc8;font-size:13px}" +
      ".om-x{border:0;background:none;color:#fff;font-size:26px;width:36px;height:36px;border-radius:6px;cursor:pointer}.om-x:hover{background:#ffffff1f}" +
      ".om-c{padding:16px 20px;display:flex;flex-direction:column;gap:14px}.om-h{font:800 14px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.3px}" +
      ".om-base{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.om-base>div{background:#F6F6F2;border-radius:10px;padding:10px 12px}.om-base small{display:block;font:700 11px Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#5a5a5a}.om-base b{font-size:18px;font-variant-numeric:tabular-nums}" +
      ".om-modos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}" +
      ".om-modo{display:flex;flex-direction:column;gap:4px;border:1.5px solid #D6D6CF;border-radius:12px;padding:12px;cursor:pointer;position:relative}.om-modo:hover{border-color:#141414}.om-modo:has(input:checked){border-color:#141414;background:#FFF6CC;box-shadow:inset 0 0 0 1px #141414}.om-modo:has(input:disabled){opacity:.5;cursor:not-allowed}" +
      ".om-modo input{position:absolute;opacity:0;pointer-events:none}.om-modo b{font-size:14.5px}.om-modo span{font-size:12.5px;color:#4a4a4a;line-height:1.4}.om-modo:has(input:focus-visible){outline:3px solid #141414;outline-offset:2px}" +
      ".om-tb{width:100%;border-collapse:collapse;font-size:13.5px}.om-tb th{text-align:left;font:700 11px Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#FFD200;background:#141414;padding:8px 10px}.om-tb td{padding:7px 10px;border-bottom:1px solid #EEEEEA;vertical-align:top}.om-tb .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.om-tb tfoot td{font-weight:700;border-bottom:0;background:#F6F6F2}" +
      ".om-d{font-size:12.5px;color:#5a5a5a}.om-up{color:#1E5A2D;font-weight:600}.om-tag{display:inline-block;font:700 10.5px Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;padding:2px 7px;border-radius:10px;background:#141414;color:#FFD200;margin-right:6px}.om-tag.s{background:#1D3F6E;color:#fff}" +
      ".om-geral{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#141414;color:#fff;border-radius:10px;padding:12px 16px;font-weight:700}.om-geral b{color:#FFD200;font-size:19px}.om-geral small{display:block;font-weight:500;color:#bdbdb5;font-size:12px}" +
      ".om-ok{background:#E3F1E6;color:#1E5A2D;border-radius:8px;padding:8px 10px;font-weight:600;font-size:13px}.om-warn{background:#FFF1D6;color:#7A4A00;border-radius:8px;padding:8px 10px;font-weight:600;font-size:13px}.om-err{background:#FDECEA;color:#8C1D18;border:1px solid #F5C2BE;border-radius:8px;padding:10px 12px;font-weight:500}" +
      ".om-a{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #E6E6E0;flex-wrap:wrap}.om-b{border:1.5px solid #141414;background:#fff;border-radius:8px;padding:0 14px;min-height:42px;font:600 13.5px Inter,sans-serif;cursor:pointer}.om-b:hover{background:#F1F1EC}.om-b.y{background:#FFD200;border-color:#FFD200}.om-b.y:hover{background:#F2C500}.om-b:disabled{opacity:.5;cursor:not-allowed}" +
      "@media (max-width:640px){.om-modos,.om-base{grid-template-columns:1fr}}";
    document.head.appendChild(s);
  }

  var MODOS = [
    { id: "normal", t: "Separado", d: "Produto vai para Vendas, coluna Faturar. A mão de obra vai para Serviços, coluna Faturar." },
    { id: "diluir", t: "Diluir serviço nos produtos", d: "Só um pedido de venda. A mão de obra entra no preço dos produtos e não cria ordem de serviço." },
    { id: "servico", t: "Tudo como serviço", d: "Só uma ordem de serviço, com o valor total. Os produtos vão listados na descrição." }
  ];
  var NOME = { normal: "faturar normal", diluir: "serviço diluído nos produtos", servico: "tudo como serviço" };

  function tabela(r) {
    var h = "";
    if (r.produtos.length) {
      var dil = r.modo === "diluir";
      h += '<table class="om-tb"><thead><tr><th>Produto</th><th class="r">Qtd.</th>' + (dil ? '<th class="r">Unit. original</th><th class="r">+ Mão de obra</th>' : "") + '<th class="r">Unit. faturado</th><th class="r">Total</th></tr></thead><tbody>' +
        r.produtos.map(function (p) {
          return "<tr><td><span class=\"om-tag\">Produto</span>" + esc(p.descricao) + (p.codigo ? ' <span class="om-d">· ' + esc(p.codigo) + "</span>" : "") + (p.ajuste ? ' <span class="om-d">· linha separada para fechar os centavos</span>' : "") + '</td><td class="r">' + p.qtd + "</td>" +
            (dil ? '<td class="r">' + brl(p.unitOriginal) + '</td><td class="r om-up">+' + brl(p.rateio) + "</td>" : "") +
            '<td class="r"><b>' + brl(p.unit) + '</b></td><td class="r">' + brl(p.total) + "</td></tr>";
        }).join("") +
        '</tbody><tfoot><tr><td colspan="' + (dil ? 5 : 3) + '">Total em produtos (pedido de venda)</td><td class="r">' + brl(r.totalProdutos) + "</td></tr></tfoot></table>";
    }
    if (r.servicos.length) {
      h += '<table class="om-tb"><thead><tr><th>Serviço</th><th class="r">Valor</th></tr></thead><tbody>' +
        r.servicos.map(function (s) { return '<tr><td><span class="om-tag s">Serviço</span>' + esc(s.descricao) + '<div class="om-d">' + esc(s.detalhe) + '</div></td><td class="r"><b>' + brl(s.valor) + "</b></td></tr>"; }).join("") +
        '</tbody><tfoot><tr><td>Total em serviços (nota de serviço)</td><td class="r">' + brl(r.totalServicos) + "</td></tr></tfoot></table>";
    }
    return h;
  }

  function empresaOmie(c) {
    if ((c.comodato && c.comodato.ativo) || String(c.omieEmpresa || "").toLowerCase() === "angela") return "Angela";
    return "Belfer";
  }
  function abrir(c) {
    css();
    var M = maoDeObra(c), mo = M.valor, emp = empresaOmie(c);
    var jaFoi = c.faturamento && c.faturamento.status === "enviado";
    var st = { modo: (jaFoi && c.faturamento.modo) || "normal", prods: null, desconto: 0, err: "", carregando: true, enviando: false };
    var f = document.createElement("div"); f.className = "om-f";
    f.innerHTML = '<div class="om-m" role="dialog" aria-modal="true" aria-labelledby="om-tt"><div class="om-t"><div><div class="k">OS ' + esc(c.num) + " · " + esc(emp) + ' · coluna Faturar</div><h2 id="om-tt">Enviar para a Omie</h2><p>Produto vai para Vendas, passo 3. Serviço vai para Serviços, passo 3.' + (emp === "Angela" ? " Comodato: faturamento na Angela." : "") + '</p></div><button type="button" class="om-x" aria-label="Fechar">×</button></div><div class="om-c" id="om-c"></div><div class="om-a"><button type="button" class="om-b" data-x>Cancelar</button><button type="button" class="om-b y" id="om-ok" disabled>Enviar para a coluna Faturar</button></div></div>';
    document.body.appendChild(f);
    function fechar() { f.remove(); document.removeEventListener("keydown", tecla); }
    function tecla(e) { if (e.key === "Escape") fechar(); }
    document.addEventListener("keydown", tecla);
    f.querySelector(".om-x").onclick = fechar; f.querySelector("[data-x]").onclick = fechar;
    f.addEventListener("click", function (e) { if (e.target === f) fechar(); });

    function desenhar() {
      var c0 = f.querySelector("#om-c"), ok = f.querySelector("#om-ok");
      if (st.carregando) { c0.innerHTML = '<div class="om-d">Buscando os produtos do orçamento…</div>'; ok.disabled = true; return; }
      var prods = st.prods || [], totProd = prods.reduce(function (s, p) { return s + cts(p.unit) * p.qtd; }, 0) / 100;
      if (!prods.length && st.modo === "diluir") st.modo = "normal";
      var r = montar(st.modo, c, prods);
      var h = st.err ? '<div class="om-err" role="alert">' + esc(st.err) + "</div>" : "";
      if (M.semFech) h += '<div class="om-warn">Esta OS foi finalizada sem a tela de fechamento. A mão de obra veio do orçamento; confira antes de enviar.</div>';
      if (c.faturamento && c.faturamento.status === "enviado") h += '<div class="om-warn">Enviar de novo apaga o pedido e a OS de serviço na ' + esc(emp) + ' e cria outros. Se o anterior já foi apagado na Omie, só o novo é criado. Documento já faturado não pode ser substituído.</div>';
      else if (c.faturamento) h += '<div class="om-warn">O clique anterior só guardou o plano nesta OS. A Omie não recebeu. O modo Separado manda o produto para Vendas e a mão de obra para Serviços.</div>';
      if (emp === "Angela") h += '<div class="om-ok">Esta OS é de comodato: o envio vai para a empresa Angela na Omie.</div>';
      h += '<div class="om-base"><div><small>Produtos</small><b>' + brl(totProd) + '</b><div class="om-d">' + prods.length + (prods.length === 1 ? " item" : " itens") + (st.desconto ? " · desconto de " + brl(st.desconto) + " já aplicado" : "") + '</div></div><div><small>Mão de obra (serviço)</small><b>' + brl(mo) + '</b><div class="om-d">' + esc(M.fonte) + '</div></div><div><small>Total da OS</small><b>' + brl(totProd + mo) + "</b></div></div>";
      h += '<div class="om-h">Como faturar</div><div class="om-modos" role="radiogroup" aria-label="Como faturar">' + MODOS.map(function (m) {
        var off = m.id === "diluir" && (!prods.length || !(mo > 0));
        return '<label class="om-modo"><input type="radio" name="om-modo" value="' + m.id + '"' + (st.modo === m.id ? " checked" : "") + (off ? " disabled" : "") + "><b>" + m.t + "</b><span>" + (off ? (!prods.length ? "Sem produtos nesta OS para receber a mão de obra." : "Sem mão de obra para diluir.") : m.d) + "</span></label>";
      }).join("") + "</div>";
      if (st.modo === "diluir" && totProd > 0) h += '<div class="om-ok">Cada produto sobe ' + ((mo / totProd) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "% (fator " + (1 + mo / totProd).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "). O total fecha com a OS até o centavo.</div>";
      h += '<div class="om-h">Prévia do que vai para a Omie</div>' + (tabela(r) || '<div class="om-d">Nada a faturar nesta OS.</div>');
      h += '<div class="om-geral"><span>Total faturado<small>' + (r.produtos.length ? "Produtos " + brl(r.totalProdutos) : "") + (r.produtos.length && r.servicos.length ? " + " : "") + (r.servicos.length ? "Serviços " + brl(r.totalServicos) : "") + "</small></span><b>" + brl(r.total) + "</b></div>";
      if (Math.abs(r.total - (totProd + mo)) > 0.009) h += '<div class="om-err">O total faturado não bate com o total da OS. Confira os valores antes de enviar.</div>';
      c0.innerHTML = h;
      ok.disabled = st.enviando || !(r.total > 0);
      ok.textContent = st.enviando ? ("Enviando para a " + emp + "…") : "Enviar para a coluna Faturar";
      Array.prototype.forEach.call(f.querySelectorAll('input[name="om-modo"]'), function (i) { i.onchange = function () { st.modo = i.value; st.err = ""; desenhar(); var n = f.querySelector('input[name="om-modo"]:checked'); if (n) n.focus(); }; });
      st.ultimo = r;
    }

    f.querySelector("#om-ok").onclick = function () {
      var r = st.ultimo, T = window.sgoTela, ok = f.querySelector("#om-ok");
      if (!r || !T || st.enviando) return;
      st.enviando = true;
      ok.disabled = true;
      ok.textContent = "Enviando para a " + emp + "…";
      var quem = (window.EU && EU.nome) || "Assistência";
      var jaEnviado = c.faturamento && c.faturamento.status === "enviado";
      fetch("/api/os/faturar-omie", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-sgo": "1" },
        body: JSON.stringify({ id: c.id, faturamento: r, substituir: !!jaEnviado })
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); }).then(function (x) {
        if (!x.ok || !x.j || !x.j.faturamento) throw new Error((x.j && x.j.erro) || "A Omie não confirmou o envio.");
        var fat = x.j.faturamento;
        var om = fat.omie || {};
        var partes = [];
        if (om.pedidoNumero) partes.push("Vendas · pedido " + om.pedidoNumero);
        if (om.osNumero) partes.push("Serviços · OS " + om.osNumero);
        T.patch(c.id, function (o) {
          return Object.assign({}, o, {
            faturamento: fat,
            hist: (o.hist || []).concat([{ quando: fat.quandoTxt || agoraTxt(), quem: quem + " (Assistência)", acao: "Enviado para a coluna Faturar da " + emp + " · " + (partes.join(" · ") || NOME[r.modo]) }])
          });
        });
        if (T.showToast) T.showToast("ok", "OS " + c.num + " na coluna Faturar (" + emp + ") · " + (partes.join(" · ") || brl(r.total)));
        fechar();
      }).catch(function (e) {
        st.enviando = false;
        st.err = e.message || "Falha ao enviar para a Omie.";
        if (document.body.contains(f)) desenhar();
      });
    };

    desenhar();
    produtosDaOs(c)
      .then(function (p) { st.prods = p.itens; st.desconto = p.desconto; })
      .catch(function (e) {
        var extras = ((c.fech && c.fech.mat) || []).filter(function (m) { return m.qtd > 0; }).map(function (m) { return { descricao: m.descricao, codigo: m.codigo || "", qtd: m.qtd, unit: Number(m.preco) || 0, origem: "Adicional da OS" }; });
        var fb = deProdutosOrc(c).concat(extras);
        st.prods = fb;
        st.err = fb.length ? "" : "Não foi possível carregar os produtos: " + e.message + ".";
      })
      .then(function () { st.carregando = false; if (document.body.contains(f)) desenhar(); });
  }

  /* ---------- botão no painel da OS finalizada ---------- */
  function botao() {
    var painel = document.querySelector("aside.z2i");
    var atual = document.querySelector(".om-row");
    var c = painel ? cardAberto() : null;
    if (!c || c.stage !== LAST) { if (atual) atual.remove(); return; }
    var chave = c.id + "|" + (c.faturamento ? c.faturamento.quando : "");
    if (atual && atual.dataset.k === chave && painel.contains(atual)) return;
    if (atual) atual.remove();
    var via = painel.querySelector(".vc-row"), alvo = via;
    if (!alvo) { var bts = painel.querySelectorAll("button"); for (var i = 0; i < bts.length; i++) if (/Imprimir OS/.test(bts[i].textContent)) { alvo = bts[i].parentElement; break; } }
    if (!alvo) return;
    css();
    var fa = c.faturamento;
    var resumo = "Ainda não enviado";
    if (fa && fa.status === "enviado" && fa.omie) {
      var ped = fa.omie.pedidoNumero ? "Vendas · pedido " + fa.omie.pedidoNumero : "";
      var osv = fa.omie.osNumero ? "Serviços · OS " + fa.omie.osNumero : "";
      resumo = "Na coluna Faturar · " + [ped, osv].filter(Boolean).join(" · ");
    } else if (fa) resumo = "Ainda não foi para a Omie · " + (NOME[fa.modo] || fa.modo);
    var row = document.createElement("div"); row.className = "om-row"; row.dataset.k = chave;
    row.innerHTML = '<div style="flex:1;min-width:160px"><div class="om-lbl">Faturamento · Omie · ' + esc(empresaOmie(c)) + '</div><div class="om-st">' +
      esc(resumo) +
      '</div></div><button type="button" class="om-btn">' + (fa && fa.status === "enviado" ? "Enviar de novo" : "Enviar para Omie") + "</button>";
    row.querySelector(".om-btn").onclick = function () { var k = cardAberto(); if (k) abrir(k); };
    alvo.parentNode.insertBefore(row, alvo.nextSibling);
  }
  var ag = false;
  new MutationObserver(function () { if (ag) return; ag = true; requestAnimationFrame(function () { ag = false; botao(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  botao();
  window.sgoOmieEnvio = { abrir: abrir, montar: montar, diluir: diluir };
})();

}
