// Complemento original da tela (roda no navegador).
/* eslint-disable */
// @ts-nocheck
if (typeof window !== "undefined") {

/* Barra de etapas no cabeçalho da OS aberta (igual à dos Leads) · v24 */
(function () {
  "use strict";
  var NOMES = ["OS aberta", "Em separação", "Compras", "Aguardando agendamento", "Agendado", "Em execução", "Executado", "Finalizado"];
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function valorDe(painel, rotulo) {
    var r = norm(rotulo), els = painel.querySelectorAll(".flabel");
    for (var i = 0; i < els.length; i++) if (norm(els[i].textContent) === r) { var v = els[i].nextElementSibling; return v ? v.textContent.trim() : ""; }
    return "";
  }
  function css() {
    if (document.getElementById("op-css")) return;
    var s = document.createElement("style"); s.id = "op-css";
    s.textContent = ".op-bar{margin-top:14px;padding-bottom:12px}.op-seg{display:grid;gap:6px}.op-seg>div{display:flex;flex-direction:column;gap:6px;min-width:0}.op-seg i{display:block;height:6px;border-radius:3px;background:#ffffff2e}.op-seg .ok i,.op-seg .at i{background:#FFD200}" +
      ".op-seg span{font:600 11px Inter,system-ui,sans-serif;color:#8f8f88;line-height:1.2;overflow-wrap:anywhere}.op-seg .ok span{color:#cfcfc8}.op-seg .at span{color:#141414;background:#FFD200;border-radius:4px;padding:2px 6px;font-weight:800;align-self:flex-start;text-transform:uppercase;letter-spacing:.3px}" +
      ".op-txt{margin-top:8px;font:600 12px Inter,system-ui,sans-serif;color:#cfcfc8}.op-txt b{color:#FFD200}";
    document.head.appendChild(s);
  }
  function desenhar() {
    var painel = document.querySelector("aside.z2i");
    if (!painel) return;
    var topo = painel.firstElementChild;
    if (!topo) return;
    var T = window.sgoTela, card = T && T.state && T.state.openId ? T.find(T.state.openId) : null, idx, ehPedido;
    if (card && typeof card.stage === "number") { idx = card.stage; ehPedido = card.tipo === "pedido"; }
    else {
      var etapa = norm(valorDe(painel, "Etapa atual"));
      idx = -1; for (var k = 0; k < NOMES.length; k++) if (etapa.indexOf(norm(NOMES[k])) === 0) { idx = k; break; }
      ehPedido = norm(valorDe(painel, "Tipo de OS")).indexOf("pedido") === 0;
    }
    var bar = topo.querySelector(".op-bar");
    if (idx < 0) { if (bar) bar.remove(); return; }
    var ini = ehPedido || idx < 3 ? 0 : 3; // manutenção, monitoramento e orçamento começam em "Aguardando agendamento"
    var lista = NOMES.slice(ini), pos = idx - ini;
    var chave = ini + ":" + idx;
    if (bar && bar.dataset.k === chave) return;
    css();
    if (!bar) { bar = document.createElement("div"); bar.className = "op-bar"; topo.appendChild(bar); }
    bar.dataset.k = chave;
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", "Etapa " + (pos + 1) + " de " + lista.length + ": " + lista[pos]);
    bar.innerHTML = '<div class="op-seg" style="grid-template-columns:repeat(' + lista.length + ',minmax(0,1fr))">' + lista.map(function (n, i) { return '<div class="' + (i < pos ? "ok" : i === pos ? "at" : "") + '"' + (i === pos ? ' aria-current="step"' : "") + '><i></i><span>' + n + "</span></div>"; }).join("") + '</div><div class="op-txt">Etapa ' + (pos + 1) + " de " + lista.length + " · <b>" + lista[pos] + "</b>" + (pos < lista.length - 1 ? " · próxima: " + lista[pos + 1] : " · concluída") + "</div>";
  }
  var agendado = false;
  new MutationObserver(function () { if (agendado) return; agendado = true; requestAnimationFrame(function () { agendado = false; desenhar(); }); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  desenhar();
})();

}
