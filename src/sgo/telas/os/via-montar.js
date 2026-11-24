// Complemento original da tela (roda no navegador).
/* eslint-disable */
// @ts-nocheck
if (typeof window !== "undefined") {

/* Via do cliente da OS · montagem, PDF e página pública · v25
   Usado na tela de OS (botões da via) e na página pública /v/<link> que o cliente abre.
   Mostra só o que o cliente precisa: atendimento, tempo no local, produtos, valor fechado,
   resolução, fotos e assinatura. Não mostra histórico interno nem motivo de ajuste. */
(function () {
  "use strict";
  var H2P = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function brl(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  var TZ = { timeZone: "America/Sao_Paulo" };
  function data(ms) { try { return new Date(ms).toLocaleDateString("pt-BR", TZ); } catch (e) { var d = new Date(ms); return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear(); } }
  function hora(ms) { try { return new Date(ms).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }); } catch (e) { var d = new Date(ms); return p2(d.getHours()) + ":" + p2(d.getMinutes()); } }
  function dataIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function durTxt(min) { min = Math.max(0, Math.round(min || 0)); var h = Math.floor(min / 60), m = min % 60; return h ? h + " h" + (m ? " " + p2(m) + " min" : "") : m + " min"; }
  function qtdTxt(q) { var s = String(q == null ? "" : q).trim(); return s.replace(/x$/i, ""); }
  function tipoTxt(c) {
    if (c.tipo === "manut") return "Manutenção" + (c.sub ? " · " + c.sub : "");
    if (c.tipo === "monit") return "Monitoramento" + (c.sub ? " · " + c.sub : "");
    if (c.tipo === "visita") return "Visita técnica / orçamento";
    return "Instalação";
  }

  function visitas(c) {
    var v = (c.fech && c.fech.visitas && c.fech.visitas.length ? c.fech.visitas : (c.visitas || [])).filter(function (x) { return x && x.ci; });
    if (!v.length && c.ci) v = [{ ci: c.ci, co: c.co }];
    return v.map(function (x) { return { ci: x.ci, co: x.co, min: x.min != null ? x.min : (x.co ? (x.co - x.ci) / 6e4 : 0) }; });
  }
  function produtos(c) {
    return (c.itens || []).map(function (t) {
      var q = t.st === "aplicado" && t.usado != null && t.usado !== "" ? t.usado : t.qtd;
      return { qtd: qtdTxt(q), nome: t.nome };
    }).filter(function (t) { return t.nome && String(t.qtd) !== "0"; });
  }

  function partes(c, opts) {
    opts = opts || {};
    var f = c.fech || {}, rel = c.rel || {}, V = visitas(c), P = produtos(c);
    var minutos = f.minutos != null ? f.minutos : V.reduce(function (s, v) { return s + (v.min || 0); }, 0);
    var fotos = (rel.fotos || []).filter(function (u) { return String(u).charAt(0) === "/"; });
    var mo = (f.mo || []).filter(function (x) { return x.qtd > 0; });
    var valor = f.valorMO != null ? f.valorMO : null;
    var somaMO = mo.reduce(function (s, x) { return s + x.qtd * (x.preco || 0); }, 0);
    var tecnicos = (f.pessoas && f.pessoas.length ? f.pessoas.join(", ") : "") || c.tecnico || "—";
    var aux = f.auxiliar || c.auxiliar;
    var quando = c.finDate ? dataIso(c.finDate) : (f.quando ? data(f.quando) : data(Date.now()));
    var css = "@page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "body{margin:0;font:12px/1.45 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#141414}" +
      ".top{display:flex;align-items:center;gap:14px;border-bottom:4px solid #FFD200;padding-bottom:10px}.top img{width:58px;height:58px;object-fit:contain}" +
      ".top .emp{flex:1}.top .emp b{display:block;font-size:17px;letter-spacing:.3px}.top .emp span{color:#555;font-size:11px}" +
      ".top .os{text-align:right}.top .os .k{display:inline-block;background:#141414;color:#FFD200;font-weight:800;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;padding:3px 8px;border-radius:4px}" +
      ".top .os .n{font-size:20px;font-weight:800;margin-top:4px}.top .os .d{color:#555;font-size:11px}" +
      "h2{font-size:11px;letter-spacing:.7px;text-transform:uppercase;color:#141414;margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #ddd}" +
      ".g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 18px}.g .l{font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#666}.g .v{font-weight:600}" +
      "table{width:100%;border-collapse:collapse}th{font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#666;text-align:left;font-weight:600;padding:4px 6px;border-bottom:1px solid #ccc}" +
      "td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}td.q{width:60px;font-weight:700}" +
      ".tot{display:flex;justify-content:space-between;align-items:center;background:#141414;color:#fff;border-radius:6px;padding:9px 12px;margin-top:8px}.tot b{color:#FFD200;font-size:17px}" +
      ".tempo{display:flex;justify-content:space-between;background:#f4f4f0;border-radius:6px;padding:7px 10px;margin-top:6px;font-weight:600}" +
      ".rel{white-space:pre-wrap;background:#f7f7f3;border-left:3px solid #FFD200;padding:8px 10px;border-radius:0 6px 6px 0}" +
      ".fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fotos img{width:100%;height:150px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block}" +
      ".ass{display:grid;grid-template-columns:1.3fr 1fr;gap:24px;margin-top:6px;align-items:end;break-inside:avoid}" +
      ".ass .cx{border-bottom:1.5px solid #141414;height:90px;display:flex;align-items:flex-end;justify-content:center}.ass .cx img{max-height:86px;max-width:100%}" +
      ".ass .leg{font-size:10.5px;color:#444;margin-top:4px}.vazio{color:#777;font-style:italic}" +
      ".rod{margin-top:18px;border-top:1px solid #ddd;padding-top:6px;font-size:10px;color:#666;display:flex;justify-content:space-between;gap:10px}" +
      "section{break-inside:avoid}.quebra{break-inside:auto}" +
      ".folha{max-width:186mm;margin:0 auto;background:#fff}" +
      "@media screen{body{background:#ecece8}.folha{padding:14mm 12mm;margin:16px auto;box-shadow:0 2px 14px #0000001f;border-radius:4px}}" +
      ".vbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#141414;color:#fff;padding:10px 16px;border-bottom:4px solid #FFD200}.vbar .t{flex:1;min-width:180px;font-weight:700}.vbar .t small{display:block;font-weight:500;color:#bdbdb5}" +
      ".vbar button{font:700 14px Inter,system-ui,sans-serif;min-height:44px;padding:0 16px;border-radius:9px;border:0;cursor:pointer;background:#fff;color:#141414}.vbar button.y{background:#FFD200}.vbar button:focus-visible{outline:3px solid #FFD200;outline-offset:2px}.vbar button:disabled{opacity:.55;cursor:wait}" +
      "@media print{.vbar{display:none}body{background:#fff}.folha{padding:0;margin:0;box-shadow:none;max-width:none}}" +
      "@media screen and (max-width:640px){.folha{padding:16px 14px;margin:0;border-radius:0;box-shadow:none}.g{grid-template-columns:1fr 1fr}.top{flex-wrap:wrap}.top .os{text-align:left;width:100%}.fotos{grid-template-columns:1fr 1fr}.fotos img{height:120px}.ass{grid-template-columns:1fr}td,th{padding:5px 4px}}";
    var h = '<div class="folha">';
    h += '<div class="top"><img src="/img/logo-ancora.png" alt=""><div class="emp"><b>ÂNCORA SEGURANÇA</b><span>Portaria remota · monitoramento · segurança eletrônica</span></div>' +
      '<div class="os"><span class="k">Via do cliente</span><div class="n">OS Nº ' + esc(c.num) + '</div><div class="d">Finalizada em ' + esc(quando) + '</div></div></div>';
    h += '<section><h2>Cliente e serviço</h2><div class="g">' +
      '<div><div class="l">Cliente</div><div class="v">' + esc(c.cliente || "—") + '</div></div>' +
      '<div><div class="l">Cidade</div><div class="v">' + esc(c.cidade || "—") + '</div></div>' +
      '<div><div class="l">Tipo de atendimento</div><div class="v">' + esc(tipoTxt(c)) + '</div></div>' +
      '<div style="grid-column:span 2"><div class="l">Serviço</div><div class="v">' + esc(c.servico || "—") + '</div></div>' +
      '<div><div class="l">Orçamento</div><div class="v">' + esc((c.orcamento && c.orcamento.num) || c.orc || "—") + '</div></div>' +
      '</div></section>';
    h += '<section><h2>Atendimento no local</h2><div class="g" style="margin-bottom:6px">' +
      '<div><div class="l">Equipe técnica</div><div class="v">' + esc(c.tecnico || "—") + '</div></div>' +
      '<div><div class="l">Técnico(s)</div><div class="v">' + esc(tecnicos) + '</div></div>' +
      '<div><div class="l">Auxiliar</div><div class="v">' + esc(aux || "—") + '</div></div></div>';
    if (V.length) {
      h += '<table><tr><th>Data</th><th>Chegada</th><th>Saída</th><th class="n">Tempo</th></tr>' + V.map(function (v) {
        return "<tr><td>" + data(v.ci) + "</td><td>" + hora(v.ci) + "</td><td>" + (v.co ? hora(v.co) : "—") + '</td><td class="n">' + (v.co ? durTxt(v.min) : "—") + "</td></tr>";
      }).join("") + "</table>";
    }
    h += '<div class="tempo"><span>Tempo total no local</span><span>' + (minutos > 0 ? durTxt(minutos) : "—") + "</span></div></section>";
    h += '<section><h2>O que foi feito</h2><div class="rel">' + (rel.texto ? esc(rel.texto) : '<span class="vazio">Sem descrição registrada.</span>') + "</div></section>";
    h += '<section class="quebra"><h2>Produtos utilizados</h2>' + (P.length
      ? '<table><tr><th>Qtd</th><th>Produto</th></tr>' + P.map(function (t) { return '<tr><td class="q">' + esc(t.qtd) + "</td><td>" + esc(t.nome) + "</td></tr>"; }).join("") + "</table>"
      : '<div class="vazio">Nenhum produto utilizado neste atendimento.</div>') + "</section>";
    h += '<section><h2>Valor do atendimento</h2>';
    if (mo.length) {
      h += '<table><tr><th>Mão de obra</th><th class="n">Qtd</th><th class="n">Valor unit.</th><th class="n">Total</th></tr>' + mo.map(function (x) {
        return "<tr><td>" + esc(x.descricao) + '</td><td class="n">' + esc(x.qtd) + " " + esc(String(x.unidade || "").toLowerCase()) + '</td><td class="n">' + brl(x.preco) + '</td><td class="n">' + brl(x.qtd * (x.preco || 0)) + "</td></tr>";
      }).join("") + (valor != null && Math.abs(valor - somaMO) > 0.009 ? '<tr><td colspan="3">Ajuste no fechamento</td><td class="n">' + brl(valor - somaMO) + "</td></tr>" : "") + "</table>";
    }
    var mat = (f.mat || []).filter(function (x) { return x && x.qtd > 0; });
    if (mat.length) {
      h += '<table style="margin-top:6px"><tr><th>Material</th><th class="n">Qtd</th><th class="n">Valor unit.</th><th class="n">Total</th></tr>' + mat.map(function (x) {
        return "<tr><td>" + esc(x.descricao) + '</td><td class="n">' + esc(x.qtd) + '</td><td class="n">' + brl(x.preco) + '</td><td class="n">' + brl(x.qtd * (x.preco || 0)) + "</td></tr>";
      }).join("") + "</table>";
    }
    var total = f.valorTotal != null ? f.valorTotal : valor != null ? valor + mat.reduce(function (t, x) { return t + x.qtd * (x.preco || 0); }, 0) : null;
    h += total != null ? '<div class="tot"><span>Valor fechado do atendimento</span><b>' + brl(total) + "</b></div>" : '<div class="vazio">Valor não informado no fechamento.</div>';
    h += "</section>";
    if (fotos.length) h += '<section class="quebra"><h2>Fotos do local</h2><div class="fotos">' + fotos.map(function (u, i) { return '<img src="' + esc(u) + '" alt="Foto ' + (i + 1) + '">'; }).join("") + "</div></section>";
    var assImg = rel.assinatura && String(rel.assinatura).charAt(0) === "/" ? rel.assinatura : "";
    h += '<section><h2>Recebimento do serviço</h2><div class="ass"><div><div class="cx">' + (assImg ? '<img src="' + esc(assImg) + '" alt="Assinatura do cliente">' : "") + '</div><div class="leg">Assinatura do cliente' +
      (rel.assinNome ? " · " + esc(rel.assinNome) : " · nome legível: ______________________________") + (assImg && rel.quando ? " · " + esc(rel.quando) : "") + '</div></div>' +
      '<div><div class="cx" style="height:40px"><b style="font-size:12px">' + esc(tecnicos) + '</b></div><div class="leg">Técnico responsável</div></div></div></section>';
    h += '<div class="rod"><span>Âncora Segurança · atendimento@ancoraseguranca.com.br</span><span>Documento emitido em ' + data(Date.now()) + " " + hora(Date.now()) + "</span></div>";
    return { titulo: "OS-" + c.num + " · via do cliente", css: css, corpo: h + "</div>" };
  }


  function montar(c, opts) {
    var p = partes(c, opts);
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(p.titulo) + "</title><style>" + p.css + "</style></head><body>" + p.corpo + "</body></html>";
  }
  function nomeArquivo(c) {
    var cli = String(c.cliente || "cliente").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    return ("OS-" + c.num + " - " + cli + " - via do cliente").slice(0, 120) + ".pdf";
  }
  function lib(win) {
    if (win.html2pdf) return Promise.resolve();
    return new Promise(function (ok, erro) {
      var s = win.document.createElement("script"); s.src = H2P;
      s.onload = function () { win.html2pdf ? ok() : erro(new Error("gerador de PDF indisponível")); };
      s.onerror = function () { erro(new Error("não foi possível carregar o gerador de PDF (verifique a internet)")); };
      win.document.head.appendChild(s);
    });
  }
  function imagens(doc) {
    return Promise.all([].slice.call(doc.images).map(function (im) {
      return im.complete ? 0 : new Promise(function (ok) { im.onload = im.onerror = ok; setTimeout(ok, 8000); });
    }));
  }
  /* Gera e baixa o PDF a partir da folha já desenhada na janela "win" */
  function pdf(win, nome) {
    var doc = win.document, folha = doc.querySelector(".folha");
    return imagens(doc).then(function () { return lib(win); }).then(function () {
      /* as opções são criadas dentro da própria janela: o html2pdf recusa listas vindas de outra janela */
      var o = win.JSON.parse(JSON.stringify({
        margin: [10, 10, 10, 10], filename: nome,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 820 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["section:not(.quebra)", "tr", ".fotos img", ".ass", ".tot", ".tempo"] }
      }));
      o.html2canvas.onclone = function (d) { d.documentElement.style.background = d.body.style.background = "#fff"; var f = d.querySelector(".folha"); if (f) f.style.cssText = "padding:0;margin:0;box-shadow:none;max-width:186mm;border-radius:0;background:#fff"; };
      return win.html2pdf().set(o).from(folha).save();
    });
  }
  /* Desenha a via numa janela escondida de largura fixa e baixa o PDF (mesmo layout no celular e no computador) */
  function baixarPdf(c) {
    var velho = document.getElementById("via-pdf-frame");
    if (velho) velho.remove();
    var fr = document.createElement("iframe");
    fr.id = "via-pdf-frame"; fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
    fr.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;height:1200px;border:0";
    document.body.appendChild(fr);
    var d = fr.contentWindow.document;
    d.open(); d.write(montar(c)); d.close();
    return pdf(fr.contentWindow, nomeArquivo(c)).then(function (r) { setTimeout(function () { fr.remove(); }, 1500); return r; }, function (e) { fr.remove(); throw e; });
  }
  /* Página pública: desenha a via com a barra de ações (baixar PDF / imprimir) */
  function abrirPublica(c) {
    var p = partes(c, { publico: true });
    document.title = p.titulo + " · Âncora Segurança";
    var st = document.createElement("style"); st.textContent = p.css; document.head.appendChild(st);
    document.body.innerHTML = '<div class="vbar" data-html2canvas-ignore="true"><div class="t">Via do cliente · OS ' + esc(c.num) + "<small>" + esc(c.cliente || "") + '</small></div><button type="button" class="y" id="vb-pdf">Baixar PDF</button><button type="button" id="vb-print">Imprimir</button></div>' + p.corpo;
    document.getElementById("vb-print").onclick = function () { window.print(); };
    var bt = document.getElementById("vb-pdf");
    bt.onclick = function () {
      bt.disabled = true; bt.textContent = "Gerando PDF…";
      baixarPdf(c).catch(function (e) { alert("Não foi possível gerar o PDF: " + e.message + ". Use o botão Imprimir e escolha “Salvar como PDF”."); })
        .then(function () { bt.disabled = false; bt.textContent = "Baixar PDF"; });
    };
  }
  window.sgoVia = { partes: partes, montar: montar, nomeArquivo: nomeArquivo, pdf: pdf, baixarPdf: baixarPdf, abrirPublica: abrirPublica };
})();

}
