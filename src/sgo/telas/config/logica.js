/* Lógica original da tela do SGO (executada pelo motor de telas isoladas: src/sgo/lib/tela-isolada.ts). */

(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function api(m, u, b) {
    return fetch(u, { method: m, credentials: "same-origin", headers: { "content-type": "application/json", "x-sgo": "1" }, body: b ? JSON.stringify(b) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || "Falha (" + r.status + ")"); return j; }); });
  }
  function dh(ms) { if (!ms) return "—"; try { return new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function nf(n) { return (Number(n) || 0).toLocaleString("pt-BR"); }
  function toast(t) { var d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3800); }
  var INFO = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';
  var TAB0 = new URLSearchParams(location.search).get("tab");
  var S = { tab: TAB0 === "banco" ? "banco" : "int", I: null, B: null, bt: null, bd: null, bpag: 0 };

  function render() {
    var h = '<div class="barra"><div class="seg" role="tablist" aria-label="Configurações">' + [["int", "Integrações e APIs"], ["banco", "Banco de dados"]].map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '"' + (S.tab === t[0] ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div></div>";
    h += S.tab === "int" ? viewInt() : viewBanco();
    $("#pag").innerHTML = h;
  }

  /* ---------- integrações ---------- */
  function carregarInt() { return api("GET", "/api/config/integracoes").then(function (j) { S.I = j; render(); }).catch(function (e) { S.I = { erro: e.message }; render(); }); }
  function itensInt() {
    var I = S.I, lista = I.catalogo.map(function (c) { var it = I.itens.filter(function (x) { return x.id === c.tipo; })[0]; return { id: c.tipo, cat: c, it: it, nome: c.nome, campos: c.campos }; });
    I.itens.filter(function (x) { return x.tipo === "outra"; }).forEach(function (x) { lista.push({ id: x.id, cat: null, it: x, nome: x.nome, campos: x.campos || [] }); });
    return lista;
  }
  function statusInt(x) {
    var it = x.it; if (!it) return '<span class="chip c-off">Não configurada</span>';
    var faltam = x.campos.filter(function (f) { return f.segredo && !(it.segredos[f.k]); }).length;
    return (it.ativo ? '<span class="chip c-ok">Ativa</span>' : '<span class="chip c-off">Inativa</span>') + (faltam ? ' <span class="chip c-agu">' + faltam + (faltam > 1 ? " chaves faltando" : " chave faltando") + "</span>" : ' <span class="chip c-blu">Chaves salvas</span>');
  }
  function viewInt() {
    var I = S.I;
    if (!I) return '<div class="card"><div class="vazio">Carregando…</div></div>';
    if (I.erro) return '<div class="card"><div class="vazio">' + esc(I.erro) + "</div></div>";
    var h = '<div class="info">' + INFO + "<div>As chaves e senhas das integrações ficam <b>cifradas no banco</b> (AES-256) e, depois de salvas, <b>não aparecem mais</b> — só o final delas (••••ab12). Para trocar, digite a nova. Só administradores veem esta tela, e toda alteração fica registrada." + (I.cripto ? "" : " <b>Atenção: a chave de criptografia do servidor não está configurada; não será possível salvar chaves.</b>") + "</div></div>";
    h += '<div class="barra"><span class="card-t">Integrações com outros sistemas</span><span class="sp"></span><button type="button" class="btn" data-ac="outra">+ Outra integração</button></div>';
    h += '<div class="grade">' + itensInt().map(function (x) {
      var it = x.it;
      return '<div class="integ' + (it && it.ativo ? " on" : "") + '"><div class="ln">' + (x.cat ? '<span class="chip c-off">' + esc(x.cat.grupo) + "</span>" : '<span class="chip c-off">Personalizada</span>') + " " + statusInt(x) + "</div><h3>" + esc(x.nome) + "</h3><p>" + esc(x.cat ? x.cat.desc : (it && it.obs) || "Integração cadastrada por vocês.") + "</p>" +
        (it ? '<p class="dica">Alterada por ' + esc(it.atualizado_por || "—") + " em " + esc(dh(it.atualizado_em)) + "</p>" : "") +
        '<div class="ac"><button type="button" class="btn ' + (it ? "" : "btn-y") + ' sm" data-cfg="' + esc(x.id) + '">' + (it ? "Editar" : "Configurar") + "</button>" + (x.cat && x.cat.docs ? '<a class="lnk" href="' + esc(x.cat.docs) + '" target="_blank" rel="noopener">Documentação</a>' : "") + "</div></div>";
    }).join("") + "</div>";
    // chaves de acesso
    var tk = I.tokens;
    h += '<div class="card"><div class="card-h"><span class="card-t">Chaves de acesso à API do SGO</span><span class="dica">Para outros sistemas (Moni, site, aplicativos) mandarem comandos para o SGO.</span><span class="sp"></span><button type="button" class="btn btn-y" data-ac="token">+ Nova chave</button></div>';
    h += '<div class="card-c dica">Endereço da API: <span class="mono">' + esc(I.base) + '/api/externo/</span> · envie a chave no cabeçalho <span class="mono">Authorization: Bearer sgo_…</span>. Teste: <span class="mono">GET /api/externo/ping</span>. Os comandos (abrir OS, ticket, eventos do Moni) entram conforme formos ligando cada integração.</div>';
    h += !tk.length ? '<div class="vazio">Nenhuma chave criada.</div>' : '<div class="tw"><table><thead><tr><th>Nome</th><th>Sistema</th><th>Permissões</th><th>Chave</th><th>Criada</th><th>Último uso</th><th>Situação</th><th></th></tr></thead><tbody>' + tk.map(function (t) {
      return "<tr><td><b>" + esc(t.nome) + "</b></td><td>" + esc(t.integracao || "—") + "</td><td>" + t.escopos.map(function (e) { return '<span class="chip c-off">' + esc(I.escopos[e] || e) + "</span>"; }).join(" ") + '</td><td class="mono">' + esc(t.prefixo) + "…</td><td>" + esc(dh(t.criado_em)) + '<br><span class="dica">' + esc(t.criado_por || "") + "</span></td><td>" + esc(dh(t.ultimo_uso)) + (t.ultimo_ip ? '<br><span class="dica">' + esc(t.ultimo_ip) + "</span>" : "") + "</td><td>" + (t.ativo ? '<span class="chip c-ok">Ativa</span>' : '<span class="chip c-red">Revogada</span><br><span class="dica">' + esc(dh(t.revogado_em)) + "</span>") + '</td><td class="n">' + (t.ativo ? '<button type="button" class="btn btn-r sm" data-rev="' + esc(t.id) + '">Revogar</button>' : "") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
    return h + "</div>";
  }

  /* ---------- janelas ---------- */
  function modal(k, titulo, corpo, acoes) {
    $("#modal").innerHTML = '<div class="fundo"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-tt"><div class="m-top"><div><div class="k">' + esc(k) + '</div><h2 id="m-tt">' + esc(titulo) + '</h2></div><button type="button" class="m-x" aria-label="Fechar" data-fechar>×</button></div><div class="m-c" id="m-c">' + corpo + '</div><div class="m-a">' + acoes + "</div></div></div>";
    var f = $("#modal input:not([type=checkbox]), #modal textarea"); if (f) f.focus();
  }
  function fechar() { $("#modal").innerHTML = ""; S.edit = null; }
  function erroM(t) { var e = $("#m-c .erro"); if (!e) { e = document.createElement("div"); e.className = "erro"; e.setAttribute("role", "alert"); $("#m-c").prepend(e); } e.textContent = t; }
  function abrirInt(id) {
    var x = itensInt().filter(function (y) { return y.id === id; })[0], it = x.it || { config: {}, segredos: {}, ativo: false, obs: "" };
    S.edit = { x: x, apagar: {} };
    var h = (x.cat ? '<p class="dica" style="margin:0">' + esc(x.cat.desc) + "</p>" : "");
    h += '<label class="sw"><input type="checkbox" id="i-ativo"' + (it.ativo ? " checked" : "") + "> Integração ativa</label>";
    x.campos.forEach(function (f) {
      if (!f.segredo) { h += '<div><label class="lbl" for="i-' + esc(f.k) + '">' + esc(f.rot) + '</label><input class="field" id="i-' + esc(f.k) + '" data-cfgk="' + esc(f.k) + '" value="' + esc(it.config[f.k] || "") + '" placeholder="' + esc(f.ph || "") + '" autocomplete="off"></div>'; return; }
      var s = it.segredos[f.k];
      h += '<div class="segbox"><span class="lbl" style="margin:0">' + esc(f.rot) + ' · secreta</span>' + (s ? '<div class="st" data-st="' + esc(f.k) + '"><span class="chip c-ok">Definida</span><span class="mono">' + (s.fim ? "••••" + esc(s.fim) : "•••• (" + esc(s.tam || "") + " caracteres)") + '</span><span class="dica">por ' + esc(s.por || "—") + " em " + esc(dh(s.em)) + '</span><span class="sp"></span><button type="button" class="lnk" data-trocar="' + esc(f.k) + '">Trocar</button><button type="button" class="lnk" data-apagar="' + esc(f.k) + '" style="color:var(--red)">Apagar</button></div>' : "") +
        '<div class="pw" data-pw="' + esc(f.k) + '"' + (s ? " hidden" : "") + '><input class="field mono" type="password" id="s-' + esc(f.k) + '" data-segk="' + esc(f.k) + '" autocomplete="new-password" spellcheck="false" placeholder="' + (s ? "Digite a nova para trocar" : "Cole aqui") + '" aria-label="' + esc(f.rot) + '"><button type="button" class="btn sm" data-ver="' + esc(f.k) + '" aria-label="Mostrar ou esconder">Mostrar</button></div></div>';
    });
    h += '<div><label class="lbl" for="i-obs">Observação</label><input class="field" id="i-obs" maxlength="500" value="' + esc(it.obs || "") + '"></div>';
    modal(x.cat ? x.cat.grupo : "Personalizada", x.nome, h, (x.it ? '<button type="button" class="btn btn-r" data-ac="int-del" style="margin-right:auto">' + (x.cat ? "Zerar" : "Excluir") + "</button>" : "") + '<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-y" data-ac="int-salvar">Salvar</button>');
  }
  function abrirOutra() {
    S.campos = [{ k: "url", rot: "Endereço", segredo: false }, { k: "token", rot: "Token", segredo: true }];
    modal("Personalizada", "Nova integração", '<div><label class="lbl" for="o-nome">Nome</label><input class="field" id="o-nome" maxlength="80" placeholder="Ex.: Portal VoIP, Kora Access"></div><div><span class="lbl">Campos</span><div id="o-campos"></div><button type="button" class="lnk" data-ac="o-mais">+ Campo</button></div><p class="dica" style="margin:0">Depois de criar, abra a integração para preencher os valores.</p>',
      '<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-y" data-ac="o-criar">Criar</button>');
    desenharCampos();
  }
  function desenharCampos() {
    $("#o-campos").innerHTML = S.campos.map(function (f, i) { return '<div class="camp" style="margin-bottom:6px"><input class="field" data-oc="' + i + '" data-p="rot" value="' + esc(f.rot) + '" placeholder="Nome do campo" aria-label="Nome do campo"><input class="field mono" data-oc="' + i + '" data-p="k" value="' + esc(f.k) + '" placeholder="identificador" aria-label="Identificador"><label class="dica" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-oc="' + i + '" data-p="segredo"' + (f.segredo ? " checked" : "") + "> secreto</label><button type=\"button\" class=\"lnk\" data-orm=\"" + i + '" aria-label="Tirar campo">×</button></div>'; }).join("");
  }
  function abrirToken() {
    var I = S.I;
    modal("API do SGO", "Nova chave de acesso", '<div><label class="lbl" for="t-nome">Nome</label><input class="field" id="t-nome" maxlength="80" placeholder="Ex.: Moni da central"></div><div><label class="lbl" for="t-int">Sistema que vai usar</label><select class="field" id="t-int"><option value="moni">Moni</option><option value="site">Site / agente do site</option><option value="outro">Outro</option></select></div><div><span class="lbl">Pode fazer</span>' +
      Object.keys(I.escopos).map(function (k) { return '<label class="sw" style="font-weight:500;margin:4px 0"><input type="checkbox" data-esc="' + k + '"' + (k === "ping" ? " checked disabled" : "") + "> " + esc(I.escopos[k]) + "</label>"; }).join("") + '<p class="dica" style="margin:4px 0 0">Os comandos são liberados no servidor à medida que cada integração for ligada; a permissão já fica guardada na chave.</p></div>',
      '<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-y" data-ac="t-criar">Criar chave</button>');
  }

  /* ---------- banco de dados ---------- */
  function carregarBanco() { return api("GET", "/api/config/banco").then(function (j) { S.B = j; if (!S.bt && j.tabelas.length) S.bt = j.tabelas[0].nome; render(); carregarTabela(); }).catch(function (e) { S.B = { erro: e.message }; render(); }); }
  function carregarTabela() {
    var t = S.B && S.B.tabelas.filter(function (x) { return x.nome === S.bt; })[0];
    if (!t || !t.exporta) { S.bd = null; render(); return; }
    api("GET", "/api/config/banco/tabela/" + S.bt + "?pagina=" + S.bpag + "&limite=50").then(function (j) { S.bd = j; render(); }).catch(function (e) { S.bd = { erro: e.message }; render(); });
  }
  function baixar(q) { var a = document.createElement("a"); a.href = "/api/config/banco/exportar?" + q; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); toast("Preparando o arquivo…"); }
  function cel(v) { if (v === "[protegido]") return '<span class="prot">protegido</span>'; if (v == null) return '<span class="prot">null</span>'; var s = String(v); return esc(s.length > 140 ? s.slice(0, 140) + "…" : s); }
  function viewBanco() {
    var B = S.B;
    if (!B) return '<div class="card"><div class="vazio">Carregando…</div></div>';
    if (B.erro) return '<div class="card"><div class="vazio">' + esc(B.erro) + "</div></div>";
    var tot = B.tabelas.reduce(function (s, t) { return s + t.linhas; }, 0), v = B.migracoes.length ? B.migracoes[B.migracoes.length - 1].versao : "—";
    var h = '<div class="kpis"><div class="kpi"><b>' + B.tabelas.length + '</b><span>tabelas</span></div><div class="kpi"><b>' + nf(tot) + '</b><span>registros no total</span></div><div class="kpi"><b>' + esc(v) + '</b><span>versão do banco (migrações aplicadas)</span></div><div class="kpi"><b>PostgreSQL</b><span>formato (schema sgo)</span></div></div>';
    h += '<div class="card"><div class="card-h"><span class="card-t">Onde os dados estão</span><span class="sp"></span><button type="button" class="btn" data-exp="formato=json">Exportar tudo (JSON)</button><button type="button" class="btn btn-y" data-exp="formato=sql">Exportar tudo (SQL)</button></div><div class="card-c"><dl class="dl">' +
      "<dt>Banco de dados</dt><dd><b>" + esc(B.infra.banco) + "</b> · banco <span class=\"mono\">" + esc(B.infra.nome) + '</span> · servidor <span class="mono">' + esc(B.infra.id) + "</span> · ligação <span class=\"mono\">" + esc(B.infra.binding) + "</span></dd>" +
      "<dt>Arquivos</dt><dd><b>" + esc(B.infra.arquivos) + '</b> · pasta <span class="mono">' + esc(B.infra.bucket) + "</span>" + (B.r2 && B.r2.prefixos ? " · pastas: " + B.r2.prefixos.map(function (p) { return '<span class="mono">' + esc(p) + "</span>"; }).join(", ") : "") + '<br><span class="dica">Fotos das OS e assinaturas (os/), telas do sistema (telas/), arquivos do CRM (crm/) e backups (backup/).</span></dd>' +
      "<dt>Sistema</dt><dd>Servidor · <span class=\"mono\">" + esc(B.infra.worker) + '</span> · <span class="mono">' + esc(B.infra.dominio) + "</span></dd>" +
      '<dt>Como está salvo</dt><dd>Tabelas relacionais (PostgreSQL, schema sgo). Cadastros (clientes, produtos, usuários) têm uma coluna por campo. Documentos com muitos detalhes — OS, tickets, oportunidades, orçamentos, leads, pedidos de compra — guardam o conteúdo completo em JSON na coluna <span class="mono">dados</span>. Datas em milissegundos desde 01/01/1970 (UTC); valores em reais com centavos.</dd>' +
      '<dt>Exportação</dt><dd>O arquivo <b>SQL</b> recria as tabelas e os dados (estrutura e dados do schema sgo). O <b>JSON</b> e o <b>CSV</b> servem para planilhas e scripts de migração. Senhas, tokens e chaves saem como <span class="mono">[protegido]</span>, e a tabela de sessões de login não é exportada.</dd></dl></div></div>';
    var t = B.tabelas.filter(function (x) { return x.nome === S.bt; })[0];
    h += '<div class="bd"><div class="card"><div class="card-h"><span class="card-t">Tabelas</span></div><div class="tabs-l">' + B.tabelas.map(function (x) { return '<button type="button" data-bt="' + esc(x.nome) + '"' + (x.nome === S.bt ? ' class="on" aria-current="true"' : "") + '><span class="mono">' + esc(x.nome) + "</span><small>" + nf(x.linhas) + "</small></button>"; }).join("") + "</div></div>";
    if (!t) return h + "</div>";
    h += '<div style="display:flex;flex-direction:column;gap:16px;min-width:0"><div class="card"><div class="card-h"><span class="card-t mono" style="text-transform:none">' + esc(t.nome) + '</span><span class="chip c-off">' + nf(t.linhas) + " registros</span><span class=\"sp\"></span>" + (t.exporta ? '<button type="button" class="btn sm" data-exp="tabela=' + esc(t.nome) + '&formato=csv">CSV</button><button type="button" class="btn sm" data-exp="tabela=' + esc(t.nome) + '&formato=json">JSON</button><button type="button" class="btn sm" data-exp="tabela=' + esc(t.nome) + '&formato=sql">SQL</button>' : '<span class="chip c-red">Não exportada (sessões de login)</span>') + "</div>";
    h += '<div class="tw"><table><thead><tr><th>Coluna</th><th>Tipo</th><th>Chave</th><th>Obrigatória</th><th>Padrão</th><th></th></tr></thead><tbody>' + t.colunas.map(function (c) { return '<tr><td class="mono"><b>' + esc(c.nome) + "</b></td><td class=\"mono\">" + esc(c.tipo || "—") + "</td><td>" + (c.pk ? '<span class="chip c-blu">PK</span>' : "") + "</td><td>" + (c.obrigatorio ? "sim" : "") + '</td><td class="mono">' + esc(c.padrao == null ? "" : c.padrao) + "</td><td>" + (c.protegido ? '<span class="chip c-agu">protegida</span>' : "") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    h += '<div class="card-c"><details><summary class="dica" style="cursor:pointer">Ver o comando de criação' + (t.indices.length ? " e os " + t.indices.length + " índices" : "") + '</summary><pre class="sql" style="margin-top:8px">' + esc(t.sql) + (t.indices.length ? ";\n\n" + t.indices.map(function (i) { return esc(i.sql) + ";"; }).join("\n") : "") + "</pre></details></div></div>";
    var d = S.bd;
    h += '<div class="card"><div class="card-h"><span class="card-t">Dados</span>' + (d && !d.erro ? '<span class="dica">' + (d.total ? nf(d.pagina * d.limite + 1) + "–" + nf(Math.min(d.total, (d.pagina + 1) * d.limite)) + " de " + nf(d.total) : "vazia") + "</span>" : "") + '<span class="sp"></span>' + (d && !d.erro ? '<button type="button" class="btn sm" data-pg="-1"' + (d.pagina ? "" : " disabled") + '>Anteriores</button><button type="button" class="btn sm" data-pg="1"' + ((d.pagina + 1) * d.limite < d.total ? "" : " disabled") + ">Próximos</button>" : "") + "</div>";
    if (!t.exporta) h += '<div class="vazio">Esta tabela guarda as sessões de login e não é exibida.</div>';
    else if (!d) h += '<div class="vazio">Carregando…</div>';
    else if (d.erro) h += '<div class="vazio">' + esc(d.erro) + "</div>";
    else if (!d.linhas.length) h += '<div class="vazio">Tabela vazia.</div>';
    else { var ks = Object.keys(d.linhas[0]); h += '<div class="tw" style="max-height:60vh"><table class="prev"><thead><tr>' + ks.map(function (k) { return '<th class="mono">' + esc(k) + "</th>"; }).join("") + "</tr></thead><tbody>" + d.linhas.map(function (r) { return "<tr>" + ks.map(function (k) { return '<td title="' + esc(r[k] == null ? "" : String(r[k]).slice(0, 600)) + '">' + cel(r[k]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>"; }
    return h + "</div></div></div>";
  }

  /* ---------- eventos ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) { if (e.target.classList && e.target.classList.contains("fundo")) fechar(); return; }
    if (b.dataset.tab) { S.tab = b.dataset.tab; history.replaceState(null, "", "?tab=" + S.tab); render(); (S.tab === "int" ? (S.I ? 0 : carregarInt()) : (S.B ? 0 : carregarBanco())); return; }
    if (b.hasAttribute("data-fechar")) { fechar(); return; }
    if (b.dataset.cfg) { abrirInt(b.dataset.cfg); return; }
    if (b.dataset.trocar) { $('[data-pw="' + b.dataset.trocar + '"]').hidden = false; $("#s-" + b.dataset.trocar).focus(); return; }
    if (b.dataset.apagar) { var k = b.dataset.apagar; S.edit.apagar[k] = true; var st = $('[data-st="' + k + '"]'); st.innerHTML = '<span class="chip c-red">Será apagada ao salvar</span><span class="sp"></span><button type="button" class="lnk" data-desfaz="' + esc(k) + '">Desfazer</button>'; return; }
    if (b.dataset.desfaz) { delete S.edit.apagar[b.dataset.desfaz]; abrirInt(S.edit.x.id); return; }
    if (b.dataset.ver) { var i = $("#s-" + b.dataset.ver); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "Mostrar" : "Esconder"; return; }
    var ac = b.dataset.ac;
    if (ac === "int-salvar") {
      var x = S.edit.x, corpo = { ativo: $("#i-ativo").checked, obs: $("#i-obs").value, config: {}, segredos: {} };
      if (!x.cat) { corpo.nome = x.nome; corpo.campos = x.campos; }
      $$("[data-cfgk]").forEach(function (i) { corpo.config[i.dataset.cfgk] = i.value; });
      $$("[data-segk]").forEach(function (i) { if (i.value.trim()) corpo.segredos[i.dataset.segk] = i.value; });
      Object.keys(S.edit.apagar).forEach(function (k) { if (!corpo.segredos[k]) corpo.segredos[k] = null; });
      b.disabled = true;
      api("PUT", "/api/config/integracoes/" + x.id, corpo).then(function () { fechar(); toast("Integração salva."); carregarInt(); }).catch(function (er) { b.disabled = false; erroM(er.message); });
      return;
    }
    if (ac === "int-del") {
      var xx = S.edit.x;
      if (!confirm(xx.cat ? "Zerar " + xx.nome + "? Todas as chaves salvas serão apagadas." : "Excluir a integração " + xx.nome + "?")) return;
      api("DELETE", "/api/config/integracoes/" + xx.id).then(function () { fechar(); toast("Feito."); carregarInt(); }).catch(function (er) { erroM(er.message); });
      return;
    }
    if (ac === "outra") { abrirOutra(); return; }
    if (ac === "o-mais") { S.campos.push({ k: "", rot: "", segredo: false }); desenharCampos(); return; }
    if (b.dataset.orm != null) { S.campos.splice(+b.dataset.orm, 1); desenharCampos(); return; }
    if (ac === "o-criar") {
      var nome = $("#o-nome").value.trim(), campos = S.campos.filter(function (f) { return f.rot.trim(); }).map(function (f) { return { rot: f.rot.trim(), k: (f.k || f.rot).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, ""), segredo: !!f.segredo }; });
      if (!nome) { erroM("Dê um nome para a integração."); return; }
      if (!campos.length) { erroM("Inclua pelo menos um campo."); return; }
      var id = "outra-" + nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
      b.disabled = true;
      api("PUT", "/api/config/integracoes/" + id, { nome: nome, campos: campos, ativo: false, config: {}, segredos: {} }).then(function () { fechar(); return carregarInt(); }).then(function () { abrirInt(id); }).catch(function (er) { b.disabled = false; erroM(er.message); });
      return;
    }
    if (ac === "token") { abrirToken(); return; }
    if (ac === "t-criar") {
      var tn = $("#t-nome").value.trim(); if (!tn) { erroM("Dê um nome para a chave."); return; }
      var esc2 = $$("[data-esc]").filter(function (i) { return i.checked; }).map(function (i) { return i.dataset.esc; });
      b.disabled = true;
      api("POST", "/api/config/tokens", { nome: tn, integracao: $("#t-int").value, escopos: esc2 }).then(function (j) {
        modal("API do SGO", "Chave criada", '<p style="margin:0"><b>Copie agora.</b> Por segurança, esta chave não será mostrada de novo — se perder, revogue e crie outra.</p><div class="tok" id="t-val">' + esc(j.token) + '</div><p class="dica" style="margin:0">Teste no sistema que vai usar:</p><pre class="sql">curl -H "Authorization: Bearer ' + esc(j.token) + '" ' + esc(S.I.base) + "/api/externo/ping</pre>",
          '<button type="button" class="btn" data-ac="t-copiar">Copiar chave</button><button type="button" class="btn btn-y" data-fechar>Já copiei</button>');
        S.tokenVisivel = j.token; carregarInt();
      }).catch(function (er) { b.disabled = false; erroM(er.message); });
      return;
    }
    if (ac === "t-copiar") { var tv = S.tokenVisivel; (navigator.clipboard ? navigator.clipboard.writeText(tv) : Promise.reject()).then(function () { b.textContent = "Copiada!"; }, function () { var r = document.createRange(); r.selectNodeContents($("#t-val")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); b.textContent = "Copiada!"; }); return; }
    if (b.dataset.rev) { if (!confirm("Revogar esta chave? O sistema que usa ela para de conseguir acessar o SGO na hora.")) return; api("POST", "/api/config/tokens/" + b.dataset.rev + "/revogar", {}).then(function () { toast("Chave revogada."); carregarInt(); }).catch(function (er) { toast(er.message); }); return; }
    if (b.dataset.bt) { S.bt = b.dataset.bt; S.bpag = 0; S.bd = null; render(); carregarTabela(); return; }
    if (b.dataset.pg) { S.bpag = Math.max(0, S.bpag + (+b.dataset.pg)); S.bd = null; render(); carregarTabela(); return; }
    if (b.dataset.exp) { baixar(b.dataset.exp); return; }
  });
  document.addEventListener("input", function (e) { var t = e.target; if (t.dataset && t.dataset.oc != null) { var f = S.campos[+t.dataset.oc]; if (t.dataset.p === "segredo") f.segredo = t.checked; else f[t.dataset.p] = t.value; } });
  document.addEventListener("change", function (e) { var t = e.target; if (t.dataset && t.dataset.oc != null && t.dataset.p === "segredo") S.campos[+t.dataset.oc].segredo = t.checked; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("#modal").innerHTML) fechar(); });
  render();
  (S.tab === "int" ? carregarInt() : carregarBanco());
})();

