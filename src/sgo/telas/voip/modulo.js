/* Módulo Ramais VoIP do SGO + softphone flutuante (código original). Executado pela casca: src/sgo/components/SgoShell.tsx */
(function () {
  "use strict";
  /* ---------- 1) Softphone flutuante: carrega o widget só para usuário com VoIP ---------- */
  function carregarWidget() {
    if (window.AncoraPhoneWidget || document.getElementById("ancora-widget-js")) return;
    fetch("/api/voip/status", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      if (!s || !s.enabled || !s.softphone) return;
      var v = s.versao ? "?v=" + s.versao : "";
      var sc = document.createElement("script");
      sc.id = "ancora-widget-js";
      sc.src = "/softphone/ancora-phone-widget.js" + v;
      sc.setAttribute("data-src", "/softphone/ancora-softphone.html" + v);
      sc.setAttribute("data-config", "/api/voip/me");
      document.body.appendChild(sc);
    }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", carregarWidget); else carregarWidget();
  // Ao sair do SGO: desregistra o ramal e fecha a janela separada do softphone
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("#btn-sair") && window.AncoraPhoneWidget) { try { window.AncoraPhoneWidget.logout(); } catch (x) {} }
  }, true);

  /* ---------- 2) Tela "Ramais VoIP" ---------- */
  var CSS = '<style>.vp{display:flex;flex-direction:column;gap:18px;max-width:1180px}.vp-card{background:#fff;border-radius:14px;box-shadow:0 0 0 1px #0000000f;padding:18px 20px}' +
    '.vp-card h2{margin:0 0 4px;font:800 19px "Barlow Semi Condensed",sans-serif;text-transform:uppercase}.vp-card>p{margin:0 0 14px;color:#5a5a5a;font-size:13.5px}' +
    '.vp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 18px}.vp-grid .full{grid-column:1/-1}.vp textarea.field{min-height:84px;font:13px ui-monospace,Consolas,monospace;resize:vertical}' +
    '.vp-linha{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px}.vp-ok{color:#1b7a43;font-weight:600}.vp-warn{color:#a15c00;font-weight:600}.vp-err{color:#b3261e;font-weight:600}' +
    '.vp-aviso{background:#fff8d6;border-left:4px solid #FFD200;padding:10px 12px;border-radius:8px;font-size:13px;margin-top:12px}.vp-aviso a{color:#141414;font-weight:600}' +
    '.vp-check{display:flex;align-items:center;gap:8px;margin-top:14px;font-weight:600}.vp-check input{width:18px;height:18px}</style>';
  function data(ms) { if (!ms) return "—"; var d = new Date(ms), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }
  function contaLinhas(t) { return String(t || "").split(/\n/).filter(function (l) { return l.trim(); }).length; }

  window.SGO_TELAS = window.SGO_TELAS || {};
  window.SGO_TELAS.voip = function (el, ctx) {
    var api = ctx.api, esc = ctx.esc, D = null;
    var avisar = (window.SGO_APP && window.SGO_APP.avisar) || function (m) { alert(m); };
    function carregar() {
      return api("GET", "/api/voip/admin").then(function (d) { D = d; render(); }).catch(function (e) {
        el.innerHTML = '<div class="erro">Não foi possível carregar os ramais: ' + esc(e.message) + "</div>";
      });
    }
    function linkCert() {
      try { var u = new URL(D.config.wss.replace(/^ws/i, "http")); return u.protocol === "https:" ? u.href : null; } catch (e) { return null; }
    }
    function render() {
      var c = D.config, sp = D.softphone, cert = linkCert();
      var h = CSS + '<section class="vp">';
      // Ramais
      h += '<div class="vp-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h2>Ramais dos operadores</h2>' +
        '<p>Quem estiver aqui vê o softphone no canto da tela do SGO, já registrado no ramal. O ramal precisa existir no Issabel com o mesmo secret.</p></div>' +
        '<button type="button" class="btn-adv" id="vp-novo" style="min-height:44px">+ Habilitar VoIP para um usuário</button></div>';
      h += '<div class="usr-tabela"><table class="tbl-usr" style="min-width:720px"><thead><tr><th>Ramal</th><th>Operador</th><th>Nome no softphone</th><th>Ramais dedicados</th><th>Situação</th><th>Alterado</th><th><span class="vh">Ações</span></th></tr></thead><tbody>';
      if (!D.contas.length) h += '<tr><td colspan="7" class="u-vazio">Nenhum usuário com VoIP ainda.</td></tr>';
      D.contas.forEach(function (a) {
        var st = !a.usuario_ativo ? '<span class="st st-off">Usuário desativado</span>' : a.ativo ? '<span class="st st-on">Ativo</span>' : '<span class="st st-off">Desligado</span>';
        h += '<tr><td><strong style="font-size:16px">' + esc(a.ramal) + "</strong></td><td><div class=\"u-nome\">" + esc(a.nome) + '</div><div class="u-login">' + esc(a.login) + (a.auth_user && a.auth_user !== a.ramal ? " · auth " + esc(a.auth_user) : "") + "</div></td><td>" + esc(a.nome_exibicao || a.nome) +
          "</td><td>" + (contaLinhas(a.ramais) ? contaLinhas(a.ramais) : '<span class="u-login">Lista padrão</span>') + "</td><td>" + st + (a.tem_senha ? "" : ' <span class="vp-err">sem senha</span>') +
          '</td><td class="u-data">' + esc(a.atualizado_em ? a.atualizado_em.replace(/^(\d+)-(\d+)-(\d+) (\d+:\d+).*/, "$3/$2/$1 $4") + " UTC" : "") + "<br><span class=\"u-login\">" + esc(a.atualizado_por || "") + '</span></td><td><button type="button" class="btn-ghost sm" data-ed="' + a.usuario_id + '">Editar</button></td></tr>';
      });
      h += "</tbody></table></div></div>";
      // Servidor
      h += '<form class="vp-card" id="vp-cfg" novalidate><h2>Servidor VoIP (Issabel)</h2><p>Vale para todos os ramais. A senha SIP fica no cadastro de cada operador, gravada cifrada.</p><div class="erro-form" role="alert" hidden></div><div class="vp-grid">' +
        '<div><label class="flabel" for="vp-wss">Endereço WebSocket (WSS)</label><input id="vp-wss" class="field" value="' + esc(c.wss) + '" placeholder="wss://192.168.10.80:8089/ws"><span class="dica">Hoje: Issabel de teste na rede interna. Para fora da empresa: wss://voip.ancoraseguranca.app/ws (quando existir).</span></div>' +
        '<div><label class="flabel" for="vp-dom">Domínio SIP</label><input id="vp-dom" class="field" value="' + esc(c.domain) + '" placeholder="192.168.10.80"></div>' +
        '<div><label class="flabel" for="vp-dtmf">DTMF</label><select id="vp-dtmf" class="field"><option value="RFC2833"' + (c.dtmf !== "INFO" ? " selected" : "") + '>RFC 2833</option><option value="INFO"' + (c.dtmf === "INFO" ? " selected" : "") + ">SIP INFO</option></select></div>" +
        '<div><label class="flabel" for="vp-exp">Expiração do registro (s)</label><input id="vp-exp" class="field" type="number" min="60" max="3600" value="' + esc(c.expires) + '"></div>' +
        '<div><label class="flabel" for="vp-ct">Transporte no Contact</label><select id="vp-ct" class="field"><option value="">Automático (recomendado)</option><option value="wss"' + (c.contact_transport === "wss" ? " selected" : "") + '>wss</option><option value="ws"' + (c.contact_transport === "ws" ? " selected" : "") + '>ws (túnel que entrega ws na 8088)</option></select></div>' +
        '<div class="full"><label class="flabel" for="vp-ice">Servidores STUN/TURN</label><textarea id="vp-ice" class="field" placeholder="Em branco na rede interna. Ex.: stun:stun.l.google.com:19302  ou JSON com TURN">' + esc(c.ice) + "</textarea></div>" +
        '<div class="full"><label class="flabel" for="vp-cp">Ramais padrão (quando o operador não tem lista própria)</label><textarea id="vp-cp" class="field" placeholder="200;Recepção&#10;201;Portaria">' + esc(c.contatos_padrao) + '</textarea><span class="dica">Um por linha: ramal;nome</span></div></div>';
      if (cert) h += '<div class="vp-aviso">Issabel com certificado próprio: em cada computador, abra uma vez <a href="' + esc(cert) + '" target="_blank" rel="noopener">' + esc(cert) + "</a> e aceite o aviso de segurança (“Upgrade Required” é normal). Sem isso o softphone não conecta. Se o Chrome perguntar sobre acesso à rede local, clique em Permitir.</div>";
      h += '<div class="vp-linha"><button type="submit" class="btn-adv">Salvar servidor</button></div></form>';
      // Arquivo
      h += '<div class="vp-card"><h2>Arquivo do softphone</h2><p>O SGO usa o <strong>ancora-softphone.html</strong> gerado pelo build (pasta do projeto do softphone). Para atualizar a versão, é só enviar o arquivo novo aqui.</p>' +
        "<div>" + (sp ? '<span class="vp-ok">✔ Enviado</span> em ' + esc(data(sp.enviado)) + (sp.por ? " por " + esc(sp.por) : "") + " · " + Math.round(sp.tamanho / 1024) + " KB" : '<span class="vp-warn">⚠ Ainda não enviado — o softphone não aparece para ninguém até enviar.</span>') + "</div>" +
        (D.chave ? "" : '<div class="vp-aviso vp-err">A chave de criptografia (VOIP_KEY) não está configurada no servidor: não dá para gravar senhas SIP.</div>') +
        '<div class="vp-linha"><input type="file" id="vp-arq" accept=".html,.js" class="field" style="max-width:420px"><button type="button" class="btn-adv" id="vp-env">Enviar arquivo</button></div></div>';
      h += "</section>";
      el.innerHTML = h;

      el.querySelector("#vp-novo").onclick = function () { editar(null); };
      el.querySelectorAll("[data-ed]").forEach(function (b) { b.onclick = function () { editar(D.contas.find(function (a) { return a.usuario_id === +b.getAttribute("data-ed"); })); }; });
      var f = el.querySelector("#vp-cfg");
      f.addEventListener("submit", function (e) {
        e.preventDefault(); var er = f.querySelector(".erro-form"); er.hidden = true;
        api("PUT", "/api/voip/admin/config", { wss: f.querySelector("#vp-wss").value, domain: f.querySelector("#vp-dom").value, dtmf: f.querySelector("#vp-dtmf").value, expires: f.querySelector("#vp-exp").value, contact_transport: f.querySelector("#vp-ct").value, ice: f.querySelector("#vp-ice").value, contatos_padrao: f.querySelector("#vp-cp").value })
          .then(function () { avisar("Servidor VoIP salvo. Vale a partir da próxima vez que cada operador abrir o SGO."); carregar(); })
          .catch(function (x) { er.textContent = x.message; er.hidden = false; er.scrollIntoView({ block: "center" }); });
      });
      el.querySelector("#vp-env").onclick = function () {
        var inp = el.querySelector("#vp-arq"), arq = inp.files && inp.files[0], bt = this;
        if (!arq) { avisar("Escolha o arquivo ancora-softphone.html."); return; }
        bt.disabled = true; bt.textContent = "Enviando…";
        fetch("/api/voip/softphone/" + encodeURIComponent(arq.name.toLowerCase()), { method: "PUT", credentials: "same-origin", headers: { "x-sgo": "1", "content-type": "application/octet-stream" }, body: arq })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || "Erro " + r.status); return j; }); })
          .then(function () { avisar("Arquivo enviado. Recarregue o SGO (F5) para o softphone aparecer."); carregar(); })
          .catch(function (x) { avisar(x.message); bt.disabled = false; bt.textContent = "Enviar arquivo"; });
      };
    }
    function editar(a) {
      var usados = D.contas.map(function (x) { return x.usuario_id; });
      var livres = D.usuarios.filter(function (u) { return usados.indexOf(u.id) < 0; });
      if (!a && !livres.length) { avisar("Todos os usuários ativos já têm VoIP."); return; }
      var m = document.createElement("div");
      m.className = "modal-fundo";
      m.innerHTML = '<form class="modal" role="dialog" aria-modal="true" aria-labelledby="vp-mt" novalidate style="max-width:560px"><div class="modal-topo"><h2 id="vp-mt">' + (a ? "VoIP de " + esc(a.nome) : "Habilitar VoIP") + '</h2><button type="button" class="x-btn" data-fechar aria-label="Fechar">×</button></div><div class="modal-corpo vp"><div class="erro-form" role="alert" hidden></div>' +
        (a ? "" : '<label class="flabel" for="vm-u">Usuário do SGO</label><select id="vm-u" class="field">' + livres.map(function (u) { return '<option value="' + u.id + '">' + esc(u.nome) + " (" + esc(u.login) + ")</option>"; }).join("") + "</select>") +
        '<div class="vp-grid"><div><label class="flabel" for="vm-r">Ramal</label><input id="vm-r" class="field" inputmode="numeric" value="' + esc(a ? a.ramal : "") + '" placeholder="1001"></div>' +
        '<div><label class="flabel" for="vm-a">Usuário de autenticação</label><input id="vm-a" class="field" value="' + esc(a && a.auth_user || "") + '" placeholder="igual ao ramal"></div></div>' +
        '<label class="flabel" for="vm-s">Senha SIP (secret do ramal no Issabel)</label><input id="vm-s" class="field" type="password" autocomplete="new-password" placeholder="' + (a && a.tem_senha ? "Gravada — deixe em branco para manter" : "") + '"><span class="dica">Fica cifrada no banco e nunca aparece de volta nesta tela.</span>' +
        '<label class="flabel" for="vm-n">Nome no softphone</label><input id="vm-n" class="field" value="' + esc(a && a.nome_exibicao || "") + '" placeholder="' + esc(a ? a.nome : "nome do usuário") + '">' +
        '<label class="flabel" for="vm-l">Ramais dedicados</label><textarea id="vm-l" class="field" placeholder="200;Recepção&#10;201;Portaria">' + esc(a ? a.ramais : "") + '</textarea><span class="dica">Um por linha: ramal;nome. Em branco usa a lista padrão.</span>' +
        '<label class="vp-check"><input type="checkbox" id="vm-at"' + (!a || a.ativo ? " checked" : "") + "> VoIP ligado para este usuário</label></div>" +
        '<div class="modal-acoes">' + (a ? '<button type="button" class="btn-ghost" id="vm-del" style="margin-right:auto;color:#b3261e">Remover VoIP</button>' : "") + '<button type="button" class="btn-ghost" data-fechar>Cancelar</button><button type="submit" class="btn-adv">Salvar</button></div></form>';
      document.body.appendChild(m);
      var f = m.querySelector("form"), er = m.querySelector(".erro-form");
      function fechar() { m.remove(); }
      m.addEventListener("click", function (e) { if (e.target === m || e.target.hasAttribute("data-fechar")) fechar(); });
      m.addEventListener("keydown", function (e) { if (e.key === "Escape") fechar(); });
      var del = m.querySelector("#vm-del");
      if (del) del.onclick = function () {
        if (!confirm("Remover o VoIP de " + a.nome + "? O softphone some da tela dele.")) return;
        api("DELETE", "/api/voip/admin/conta/" + a.usuario_id).then(function () { fechar(); avisar("VoIP removido."); carregar(); }).catch(function (x) { er.textContent = x.message; er.hidden = false; });
      };
      f.addEventListener("submit", function (e) {
        e.preventDefault(); er.hidden = true;
        var uid = a ? a.usuario_id : +f.querySelector("#vm-u").value;
        api("PUT", "/api/voip/admin/conta/" + uid, { ramal: f.querySelector("#vm-r").value, auth_user: f.querySelector("#vm-a").value, senha: f.querySelector("#vm-s").value, nome_exibicao: f.querySelector("#vm-n").value, ramais: f.querySelector("#vm-l").value, ativo: f.querySelector("#vm-at").checked })
          .then(function () { fechar(); avisar("VoIP salvo. O operador vê o softphone ao recarregar o SGO."); carregar(); })
          .catch(function (x) { er.textContent = x.message; er.hidden = false; });
      });
      (f.querySelector("#vm-u") || f.querySelector("#vm-r")).focus();
    }
    carregar();
  };
})();
