// Complemento original da tela (roda no navegador).
/* eslint-disable */
// @ts-nocheck
if (typeof window !== "undefined") {

/* Via do cliente na OS finalizada: imprimir · salvar PDF · compartilhar link · v25
   Depende de window.sgoVia (via-montar.js) e de window.sgoTela (tela de OS). */
(function () {
  "use strict";
  var LAST = 7;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cardAberto() { var T = window.sgoTela; return T && T.state && T.state.openId ? T.find(T.state.openId) : null; }
  function aviso(txt) { var T = window.sgoTela; if (T && T.showToast) T.showToast("ok", txt); }

  /* janela escondida com a via desenhada (para imprimir ou gerar o PDF) */
  function frame(c) {
    var velho = document.getElementById("via-cli-frame");
    if (velho) velho.remove();
    var fr = document.createElement("iframe");
    fr.id = "via-cli-frame"; fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(fr);
    var d = fr.contentWindow.document;
    d.open(); d.write(window.sgoVia.montar(c)); d.close();
    return fr;
  }
  function esperaImagens(doc) {
    return Promise.all([].slice.call(doc.images).map(function (im) { return im.complete ? 0 : new Promise(function (ok) { im.onload = im.onerror = ok; setTimeout(ok, 6000); }); }));
  }
  function imprimir(c) {
    var fr = frame(c);
    esperaImagens(fr.contentWindow.document).then(function () {
      setTimeout(function () {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { alert("Não foi possível abrir a impressão neste navegador."); }
      }, 150);
    });
  }
  function salvarPdf(c, bt) {
    var txt = bt.innerHTML;
    bt.disabled = true; bt.lastChild.textContent = "Gerando PDF…";
    var nome = window.sgoVia.nomeArquivo(c);
    window.sgoVia.baixarPdf(c)
      .then(function () { aviso("PDF salvo: " + nome); })
      .catch(function (e) { alert("Não foi possível gerar o PDF: " + e.message + ". Use “Imprimir” e escolha “Salvar como PDF”."); })
      .then(function () { bt.disabled = false; bt.innerHTML = txt; });
  }

  /* ---------- compartilhar ---------- */
  function pedirLink(c) {
    return fetch("/api/os/via-link", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-sgo": "1" }, body: JSON.stringify({ os: c.id }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw new Error(j.erro || "falha ao gerar o link"); return j.url; }); });
  }
  function fecharDialogo() { var d = document.getElementById("vc-dlg"); if (d) d.remove(); }
  function dialogo(c, url) {
    fecharDialogo();
    var msg = "Olá! Segue a via do cliente da OS " + c.num + " (" + (c.cliente || "") + ") da Âncora Segurança: " + url;
    var w = document.createElement("div");
    w.id = "vc-dlg"; w.className = "vc-fundo";
    w.innerHTML = '<div class="vc-caixa" role="dialog" aria-modal="true" aria-labelledby="vc-tit">' +
      '<div class="vc-topo"><div><span class="vc-kick">Via do cliente · OS ' + esc(c.num) + '</span><h2 id="vc-tit">Compartilhar com o cliente</h2></div><button type="button" class="vc-x" aria-label="Fechar">×</button></div>' +
      '<div class="vc-corpo"><p>Quem abrir este link vê a via do cliente desta OS e pode baixar o PDF. Não precisa de login.</p>' +
      '<label class="vc-rot" for="vc-url">Link da via</label><div class="vc-linha"><input id="vc-url" class="vc-in" readonly value="' + esc(url) + '"><button type="button" class="vc-b" id="vc-copiar">Copiar link</button></div>' +
      '<div class="vc-acoes"><a class="vc-b vc-zap" id="vc-zap" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">' +
      '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2l-.5-.3z"/></svg>Enviar no WhatsApp</a>' +
      (navigator.share ? '<button type="button" class="vc-b" id="vc-mais">Outras opções</button>' : "") +
      '<a class="vc-b" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir a via</a></div></div></div>';
    document.body.appendChild(w);
    var inp = w.querySelector("#vc-url");
    w.querySelector(".vc-x").onclick = fecharDialogo;
    w.addEventListener("click", function (e) { if (e.target === w) fecharDialogo(); });
    w.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharDialogo(); });
    w.querySelector("#vc-copiar").onclick = function () {
      var b = this;
      function ok() { b.textContent = "Copiado!"; setTimeout(function () { b.textContent = "Copiar link"; }, 2000); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { inp.select(); document.execCommand("copy"); ok(); });
      else { inp.select(); document.execCommand("copy"); ok(); }
    };
    var mais = w.querySelector("#vc-mais");
    if (mais) mais.onclick = function () { navigator.share({ title: "Via do cliente · OS " + c.num, text: "Via do cliente da OS " + c.num + " · Âncora Segurança", url: url }).catch(function () {}); };
    w.querySelector("#vc-copiar").focus();
  }
  function compartilhar(c, bt) {
    var txt = bt.innerHTML;
    bt.disabled = true; bt.lastChild.textContent = "Gerando link…";
    pedirLink(c).then(function (url) { dialogo(c, url); })
      .catch(function (e) { alert("Não foi possível gerar o link: " + e.message); })
      .then(function () { bt.disabled = false; bt.innerHTML = txt; });
  }

  /* ---------- botões no painel da OS ---------- */
  var IC = {
    imp: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>',
    pdf: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>',
    sh: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
  };
  function css() {
    if (document.getElementById("vc-css")) return;
    var s = document.createElement("style"); s.id = "vc-css";
    s.textContent = ".vc-row{margin-top:12px;border-radius:12px;background:#fff8d6;box-shadow:inset 0 0 0 1.5px #141414;padding:10px 12px}" +
      ".vc-lbl{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#141414;margin-bottom:8px}" +
      ".vc-bts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}" +
      ".vc-btn{font:700 13.5px Inter,system-ui,sans-serif;min-height:46px;padding:0 10px;border-radius:9px;border:1.5px solid #141414;background:#fff;color:#141414;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:0}" +
      ".vc-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vc-btn:hover{background:#f1f1ec}.vc-btn.y{background:#FFD200}.vc-btn.y:hover{background:#f2c500}.vc-btn:disabled{opacity:.6;cursor:wait}.vc-btn:focus-visible{outline:3px solid #141414;outline-offset:2px}" +
      "@media (max-width:560px){.vc-bts{grid-template-columns:1fr}}" +
      ".vc-fundo{position:fixed;inset:0;background:#1414148c;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".vc-caixa{background:#fff;border-radius:14px;width:100%;max-width:540px;box-shadow:0 24px 70px #00000059;overflow:hidden;font-family:Inter,system-ui,sans-serif}" +
      ".vc-topo{display:flex;justify-content:space-between;gap:12px;background:#141414;color:#fff;padding:16px 20px;border-bottom:4px solid #FFD200}.vc-topo h2{margin:2px 0 0;font:800 21px 'Barlow Semi Condensed',Inter,sans-serif;text-transform:uppercase}" +
      ".vc-kick{font:700 11px Inter,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#FFD200}.vc-x{all:unset;cursor:pointer;color:#fff;font-size:26px;line-height:1;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px}.vc-x:hover{background:#ffffff1f}.vc-x:focus-visible{outline:2px solid #FFD200}" +
      ".vc-corpo{padding:16px 20px 20px;display:flex;flex-direction:column;gap:10px}.vc-corpo p{margin:0;font-size:14px;color:#3d3d3d;line-height:1.5}" +
      ".vc-rot{font:600 12px Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#3d3d3d}.vc-linha{display:flex;gap:8px}.vc-in{flex:1;min-width:0;font:400 13.5px Inter,sans-serif;min-height:44px;padding:0 12px;border:1px solid #BDBDB5;border-radius:8px;background:#f6f6f2;color:#141414}" +
      ".vc-b{font:700 14px Inter,sans-serif;min-height:44px;padding:0 14px;border-radius:9px;border:1.5px solid #141414;background:#fff;color:#141414;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}.vc-b:hover{background:#f1f1ec}.vc-b:focus-visible{outline:3px solid #141414;outline-offset:2px}" +
      ".vc-acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.vc-zap{background:#1e7e45;border-color:#1e7e45;color:#fff;flex:1 1 220px}.vc-zap:hover{background:#18693a}";
    document.head.appendChild(s);
  }
  function botoes() {
    var painel = document.querySelector("aside.z2i");
    var atual = document.querySelector(".vc-row");
    var c = painel ? cardAberto() : null;
    if (!c || c.stage !== LAST || !window.sgoVia) { if (atual) atual.remove(); return; }
    if (atual && atual.dataset.os === c.id && painel.contains(atual)) return;
    if (atual) atual.remove();
    var alvo = null, bts = painel.querySelectorAll("button");
    for (var i = 0; i < bts.length; i++) if (/Imprimir OS/.test(bts[i].textContent)) { alvo = bts[i].parentElement; break; }
    if (!alvo) return;
    css();
    var row = document.createElement("div"); row.className = "vc-row"; row.dataset.os = c.id;
    row.innerHTML = '<div class="vc-lbl">Via do cliente</div><div class="vc-bts">' +
      '<button type="button" class="vc-btn" data-v="imp">' + IC.imp + '<span>Imprimir</span></button>' +
      '<button type="button" class="vc-btn" data-v="pdf">' + IC.pdf + '<span>Salvar PDF</span></button>' +
      '<button type="button" class="vc-btn y" data-v="sh">' + IC.sh + '<span>Compartilhar</span></button></div>';
    row.addEventListener("click", function (e) {
      var b = e.target.closest(".vc-btn"); if (!b || b.disabled) return;
      var k = cardAberto(); if (!k) return;
      if (b.dataset.v === "imp") imprimir(k);
      else if (b.dataset.v === "pdf") salvarPdf(k, b);
      else compartilhar(k, b);
    });
    alvo.parentNode.insertBefore(row, alvo.nextSibling);
  }
  var ag = false;
  new MutationObserver(function () { if (ag) return; ag = true; requestAnimationFrame(function () { ag = false; botoes(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  botoes();
})();

}
