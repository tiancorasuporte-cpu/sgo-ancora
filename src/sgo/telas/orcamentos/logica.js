/* Lógica original da tela do SGO (executada pelo motor de telas isoladas: src/sgo/lib/tela-isolada.ts). */

(function(){
"use strict";
var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function brl(v){return(+v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function n2(v){return(+v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function qtdTxt(v){return(+v||0).toLocaleString("pt-BR",{maximumFractionDigits:3})}
function num(v){if(typeof v==="number")return v;var s=String(v==null?"":v).trim().replace(/[^\d,.-]/g,"");if(!s)return 0;if(s.indexOf(",")>=0)s=s.replace(/\./g,"").replace(",",".");var n=parseFloat(s);return isFinite(n)?n:0}
function r2(v){return Math.round((+v||0)*100)/100}
function round90(v){return!(v>0)?null:Math.floor(v)+0.9}
function sugPreco(custo,markup){var c=+custo,m=+markup;if(!(c>0))return null;if(!(m>0))m=1.7;return round90(c*m)}
function abaixoSug(preco,sug){return sug!=null&&sug>0&&isFinite(+preco)&&(+preco)+0.0001<sug}
function aplicarCatalogoNoItem(i,p){
  if(!i||!p||ehSvc(i))return i;
  i.estoque=p.estoque!=null?Number(p.estoque):i.estoque;
  i.custo=p.custo!=null?Number(p.custo):i.custo;
  i.markup=p.markup!=null&&Number(p.markup)>0?Number(p.markup):(i.markup||1.7);
  i.preco_sug=p.preco_sug!=null?Number(p.preco_sug):sugPreco(i.custo,i.markup);
  return i;
}
function dataHora(ms){return ms?new Date(ms).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}):""}
function dataBR(iso){if(!iso)return"";var p=String(iso).slice(0,10).split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:iso}
function hojeISO(n){var d=new Date();d.setDate(d.getDate()+(n||0));return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function cidade(c){return String(c||"").replace(/\s*\([A-Z]{2}\)\s*$/,"")}
function doc(d){d=String(d||"").replace(/\D+/g,"");if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,"$1.$2.$3-$4");return d}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function api(m,u,b){return fetch(u,{method:m,credentials:"same-origin",headers:{"content-type":"application/json","x-sgo":"1"},body:b?JSON.stringify(b):undefined}).then(function(r){
  if(r.status===401){(window.top||window).location.href="/login";throw new Error("Sessão expirada")}
  return r.json().catch(function(){return{}}).then(function(d){if(!r.ok){var e=new Error(d.erro||("Erro "+r.status));e.status=r.status;throw e}return d})})}
var tT=null;function toast(t,ms){var el=$("#toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=t;el.hidden=false;clearTimeout(tT);tT=setTimeout(function(){el.hidden=true},ms||3500)}

var ST={salvo:["Salvo","p-cin"],enviado:["Enviado ao cliente","p-azr"],aprovado:["Aprovado","p-ver"],recusado:["Recusado","p-red"]};
var S={aba:"orc",lista:null,lts:null,q:"",fst:"todos",ltf:"pendente",E:null};

/* ===================== LISTA ===================== */
function carregar(){
  return Promise.all([api("GET","/api/orcamentos"),api("GET","/api/levantamentos")]).then(function(r){S.lista=r[0].itens||[];S.lts=r[1].itens||[];desenhar()})
  .catch(function(e){$("#pag").innerHTML='<div class="card vazio erro">Não foi possível carregar: '+esc(e.message)+'</div>'})}
function desenharTabs(){
  var pend=(S.lts||[]).filter(function(l){return l.status==="pendente"}).length;
  var t=[["orc","Orçamentos",S.lista?S.lista.length:""],["lt","Levantamentos técnicos",pend]];
  $("#tabs").innerHTML=t.map(function(x){return'<button type="button" class="tab'+(S.aba===x[0]&&!S.E?" on":"")+'" data-aba="'+x[0]+'">'+x[1]+(x[2]!==""?'<span class="bdg'+(x[0]==="lt"&&x[2]?" y":"")+'">'+x[2]+"</span>":"")+"</button>"}).join("");
  $$("#tabs [data-aba]").forEach(function(b){b.onclick=function(){if(S.E&&!sairEditor())return;S.aba=b.dataset.aba;S.E=null;desenhar()}});
}
function desenhar(){desenharTabs();$("#bt-novo").hidden=!!S.E;var sc=$("#bt-sync-cli"),sp=$("#bt-sync-prod");if(sc)sc.hidden=!!S.E;if(sp)sp.hidden=!!S.E;if(S.E)return desenharEditor();if(S.aba==="lt")return desenharLTs();desenharLista()}
function syncOmie(tipo,btn){
  if(btn.disabled)return;
  var rotulo=btn.textContent;btn.disabled=true;btn.textContent="Sincronizando…";
  api("POST","/api/cadastros/sync-omie",{tipo:tipo}).then(function(d){
    var msg="";
    if(tipo==="clientes"||tipo==="ambos")msg+=(d.clientes?d.clientes.total:0)+" cliente(s)";
    if(tipo==="produtos"||tipo==="ambos")msg+=(msg?" · ":"")+(d.produtos?d.produtos.total:0)+" produto(s)";
    if(d.erros&&d.erros.length)toast("Sync parcial: "+msg+". "+d.erros.join(" · "),8000);
    else toast("Sincronizado: "+msg+".",5000);
  }).catch(function(e){toast(e.message,6000)}).then(function(){btn.disabled=false;btn.textContent=rotulo})}
function desenharLista(){
  var q=norm(S.q).split(/\s+/).filter(Boolean);
  var its=(S.lista||[]).filter(function(o){if(S.fst!=="todos"&&o.status!==S.fst)return false;var t=norm([o.num,o.cliente,o.criado_nome,o.cidade,o.documento,o.lt_num?"lt "+o.lt_num:"",o.op_cod||"",o.os_num?"os "+o.os_num:""].join(" "));return q.every(function(p){return t.indexOf(p)>=0})});
  var segs=[["todos","Todos"],["salvo","Salvos"],["enviado","Enviados"],["aprovado","Aprovados"],["recusado","Recusados"]];
  var h='<div class="filtros"><input class="field" type="search" id="f-q" placeholder="Buscar por número, cliente, cidade, usuário, L.T. ou OS" value="'+esc(S.q)+'" aria-label="Buscar orçamentos"><div class="seg" role="group" aria-label="Situação">'+segs.map(function(s){return'<button type="button" class="'+(S.fst===s[0]?"on":"")+'" data-fst="'+s[0]+'" aria-pressed="'+(S.fst===s[0])+'">'+s[1]+"</button>"}).join("")+'</div><span class="dica">'+(q.length||S.fst!=="todos"?its.length+" de "+S.lista.length:"")+"</span></div>";
  h+='<section class="card"><div class="tw"><table class="tbl"><thead><tr><th>Nº</th><th>Cliente</th><th>Usuário</th><th class="r">Total</th><th>Status</th><th>Cotação</th><th>Quando</th><th class="c">Ações</th></tr></thead><tbody>';
  if(!its.length)h+='<tr><td colspan="8" class="vazio">'+(S.lista.length?"Nenhum orçamento encontrado com esse filtro.":"Nenhum orçamento ainda. Clique em “+ Novo orçamento” ou converta um levantamento técnico.")+"</td></tr>";
  its.forEach(function(o){var st=ST[o.status]||ST.salvo;
    h+='<tr class="h" data-abrir="'+esc(o.id)+'"><td style="white-space:nowrap"><b>'+esc(o.num)+"</b>"+(o.lt_num?' <span class="lt-bdg" title="Veio do levantamento técnico">L.T. '+esc(o.lt_num)+"</span>":"")+(o.op_cod?' <span class="op-bdg" title="Oportunidade do CRM">'+esc(o.op_cod)+"</span>":"")+'</td><td><b>'+esc(o.cliente)+'</b><div class="sub">'+esc([doc(o.documento),cidade(o.cidade)].filter(Boolean).join(" · "))+"</div></td><td>"+esc(o.criado_nome||o.criado_por||"")+'</td><td class="r" style="white-space:nowrap">'+(o.n_itens||!o.mensal?brl(o.total):"—")+(o.mensal?'<div class="sub" style="font-weight:600;color:#141414">+ '+brl(o.mensal)+"/mês</div>":"")+'</td><td><span class="pill '+st[1]+'">'+st[0]+"</span></td><td>"+(o.os_num?'<span class="os-bdg">Enviado ao pedido · OS '+esc(o.os_num)+"</span>"+(o.autorizou?'<div class="sub">Autorizado por '+esc(o.autorizou)+"</div>":""):"—")+'</td><td style="white-space:nowrap">'+dataHora(o.criado_em)+'</td><td class="c"><div class="menu-wrap"><button class="ico" type="button" data-menu="'+esc(o.id)+'" aria-label="Ações do '+esc(o.num)+'" aria-haspopup="true">⋮</button></div></td></tr>'});
  h+="</tbody></table></div></section>";
  $("#pag").innerHTML=h;
  var fq=$("#f-q");fq.oninput=function(){S.q=fq.value;var p=fq.selectionStart;desenharLista();var n=$("#f-q");n.focus();n.setSelectionRange(p,p)};
  $$("[data-fst]").forEach(function(b){b.onclick=function(){S.fst=b.dataset.fst;desenharLista()}});
  $$("tr[data-abrir]").forEach(function(tr){tr.onclick=function(e){if(e.target.closest(".menu-wrap"))return;abrirOrc(tr.dataset.abrir)}});
  $$("[data-menu]").forEach(function(b){b.onclick=function(e){e.stopPropagation();menuOrc(b)}});
}
function posMenu(m,b){var r=b.getBoundingClientRect(),w=m.offsetWidth,h=m.offsetHeight,vw=innerWidth,vh=innerHeight;
  var x=Math.max(8,Math.min(r.right-w,vw-w-8)),y=r.bottom+4;
  if(y+h>vh-8){y=r.top-4-h;if(y<8)y=Math.max(8,vh-8-h)}
  m.style.left=x+"px";m.style.top=y+"px"}
addEventListener("resize",function(){fecharMenus()});addEventListener("scroll",function(e){if(!(e.target.closest&&e.target.closest(".menu")))fecharMenus()},true);
function fecharMenus(){$$(".menu").forEach(function(m){m.remove()})}
document.addEventListener("click",function(e){if(!e.target.closest(".menu"))fecharMenus()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){fecharMenus();var o=$("#ov");if(o&&!VER)o.remove()}});
function menuOrc(b){
  var aberto=document.querySelector('.menu[data-dono="'+b.dataset.menu+'"]');fecharMenus();if(aberto)return;
  var o=S.lista.find(function(x){return x.id===b.dataset.menu});if(!o)return;
  var m=document.createElement("div");m.className="menu";m.setAttribute("role","menu");m.dataset.dono=b.dataset.menu;
  var ac=[["abrir","Abrir / editar"],["doc","Visualizar · PDF · imprimir"],["dup","Duplicar como novo"],["opp",o.op_id?"Na oportunidade "+(o.op_cod||"")+" (CRM)":"Enviar para oportunidade (CRM)",!!o.op_id||!!o.os_num],["pedido",o.op_id?"Enviar ao pedido: pela oportunidade "+(o.op_cod||"")+" no CRM":"Enviar ao pedido (abre OS)",!!o.os_num||!!o.op_id],["del","Excluir",!!o.os_num,"del"]];
  m.innerHTML=ac.map(function(a){return'<button type="button" role="menuitem" data-ac="'+a[0]+'"'+(a[2]?" disabled":"")+(a[3]?' class="'+a[3]+'"':"")+">"+a[1]+"</button>"}).join("");
  document.body.appendChild(m);posMenu(m,b);m.querySelector("button:not([disabled])").focus();
  m.onclick=function(e){var x=e.target.closest("[data-ac]");if(!x||x.disabled)return;fecharMenus();var ac=x.dataset.ac;
    if(ac==="abrir")abrirOrc(o.id);
    else if(ac==="doc")api("GET","/api/orcamentos/"+o.id).then(function(d){documento(edDe(d.item),true)}).catch(function(er){toast(er.message)});
    else if(ac==="dup")api("GET","/api/orcamentos/"+o.id).then(function(d){duplicar(d.item)}).catch(function(er){toast(er.message)});
    else if(ac==="opp")enviarOportunidade(o);
    else if(ac==="pedido")enviarPedido(o);
    else if(ac==="del")excluir(o)};
}
function excluir(o){
  if(!confirm("Excluir o orçamento "+o.num+" ("+o.cliente+")?"+(o.lt_num?" O L.T. "+o.lt_num+" volta para a lista de levantamentos pendentes.":"")))return;
  api("DELETE","/api/orcamentos/"+o.id).then(function(){toast("Orçamento "+o.num+" excluído.");if(S.E&&S.E.id===o.id)S.E=null;return carregar()}).catch(function(e){toast(e.message,6000)})}
function enviarOportunidade(o){
  var ov=document.createElement("div");ov.className="ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-label","Enviar para oportunidade");
  ov.innerHTML='<div class="card" style="max-width:520px;margin:60px auto"><div class="card-h"><span class="card-t">Enviar para oportunidade</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px"><div>O orçamento <b>'+esc(o.num)+'</b> ('+esc(o.cliente)+') vira uma oportunidade no CRM, em <b>Montado · a enviar</b>, com o número, os valores e os itens.</div><div class="f"><label class="flabel" for="op-vend">Vendedor responsável</label><select class="field" id="op-vend"><option value="">Carregando…</option></select><span class="dica">Sem vendedor, a oportunidade aparece para todos no CRM até alguém assumir. Com vendedor, só ele (e administradores) a veem até ele encaminhar.</span></div><div class="erro" id="op-err"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" type="button" id="op-c">Cancelar</button><button class="btn adv" type="button" id="op-ok" disabled>Criar oportunidade</button></div></div></div>';
  document.body.appendChild(ov);
  var fechar=function(){ov.remove()};$("#op-c").onclick=fechar;ov.addEventListener("click",function(e){if(e.target===ov)fechar()});
  api("GET","/api/orcamentos/vendedores").then(function(d){var v=d.vendedores||[];$("#op-vend").innerHTML='<option value="">— sem vendedor (fica para todos) —</option>'+v.map(function(x){return'<option>'+esc(x.nome)+"</option>"}).join("");$("#op-ok").disabled=false;$("#op-vend").focus()}).catch(function(e){$("#op-err").textContent=e.message});
  $("#op-ok").onclick=function(){var b=this;b.disabled=true;var vend=$("#op-vend").value;
    api("POST","/api/orcamentos/"+o.id+"/oportunidade",{vendedor:vend}).then(function(d){fechar();toast("Oportunidade "+d.op.cod+" criada"+(vend?" para "+vend:" sem vendedor (visível para todos)")+".",6000);if(S.E&&S.E.id===o.id){var n=edDe(d.item);n.base=snap(n);S.E=n}return carregar()})
    .catch(function(e){$("#op-err").textContent=e.message;b.disabled=false})}}
function enviarPedido(o){
  var ov=document.createElement("div");ov.className="ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-label","Enviar ao pedido");
  var html=[];
  html.push('<div class="card" style="max-width:560px;margin:60px auto"><div class="card-h"><span class="card-t">Enviar ao pedido</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">');
  html.push("<div>O orçamento <b>"+esc(o.num)+"</b> ("+esc(o.cliente||"")+") vira uma OS de pedido aprovado no Quadro de OS. Depois disso ele fica aprovado e não pode mais ser alterado.</div>");
  html.push('<div class="f"><label class="flabel" for="ped-quem">Quem autorizou</label><input class="field" id="ped-quem" maxlength="120" placeholder="Nome de quem autorizou" autocomplete="off"><span class="dica">Obrigatório. Esse nome vai na OS.</span></div>');
  html.push('<div class="f"><label class="flabel" for="ped-doc">Documento da autorização</label><input class="field" id="ped-doc" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"><span class="dica">Opcional. PDF, imagem ou Word, até 8 MB. Fica vinculado à OS.</span></div>');
  html.push('<div class="erro" id="ped-err"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" type="button" id="ped-c">Cancelar</button><button class="btn adv" type="button" id="ped-ok">Enviar e abrir OS</button></div></div></div>');
  ov.innerHTML=html.join("");
  document.body.appendChild(ov);
  var fechar=function(){ov.remove()};$("#ped-c").onclick=fechar;ov.addEventListener("click",function(e){if(e.target===ov)fechar()});$("#ped-quem").focus();
  $("#ped-ok").onclick=function(){var b=this,quem=$("#ped-quem").value.replace(/\s+/g," ").trim(),arq=$("#ped-doc").files&&$("#ped-doc").files[0];
    if(quem.length<2){$("#ped-err").textContent="Informe quem autorizou.";$("#ped-quem").focus();return}
    if(arq&&arq.size>8*1024*1024){$("#ped-err").textContent="O documento passa de 8 MB.";return}
    b.disabled=true;$("#ped-err").textContent="";
    var seguir=function(doc){api("POST","/api/orcamentos/"+o.id+"/pedido",{autorizou:quem,documento:doc}).then(function(d){fechar();toast("Pedido enviado: OS "+d.os.num+" aberta no Quadro de OS.",6000);if(S.E&&S.E.id===o.id){var n=edDe(d.item);n.base=snap(n);S.E=n}return carregar()}).catch(function(e){$("#ped-err").textContent=e.message;b.disabled=false})};
    if(!arq)return seguir(null);
    var rd=new FileReader();
    rd.onload=function(){var s=String(rd.result||""),i=s.indexOf(",");seguir({nome:arq.name,tipo:arq.type||"application/octet-stream",base64:s.slice(i+1)})};
    rd.onerror=function(){$("#ped-err").textContent="Não foi possível ler o documento.";b.disabled=false};
    rd.readAsDataURL(arq)}}

/* ===================== LEVANTAMENTOS ===================== */
function desenharLTs(){
  var its=(S.lts||[]).filter(function(l){return S.ltf==="todos"||l.status===S.ltf});
  var segs=[["pendente","Pendentes"],["convertido","Convertidos"],["descartado","Descartados"],["todos","Todos"]];
  var h='<div class="aviso azul">Levantamentos técnicos feitos pelos técnicos em campo (OS de orçamento · visita técnica). Clique em <b>Converter em orçamento</b>: os itens do técnico viram as linhas do orçamento e você escolhe o produto do cadastro em cada uma.</div>';
  h+='<div class="filtros"><div class="seg" role="group" aria-label="Situação do levantamento">'+segs.map(function(s){return'<button type="button" class="'+(S.ltf===s[0]?"on":"")+'" data-ltf="'+s[0]+'" aria-pressed="'+(S.ltf===s[0])+'">'+s[1]+"</button>"}).join("")+"</div></div>";
  h+='<section class="card"><div class="tw"><table class="tbl"><thead><tr><th>L.T.</th><th>OS</th><th>Cliente</th><th>Técnico</th><th>Visita</th><th>Itens levantados</th><th>Situação</th><th class="r">Ações</th></tr></thead><tbody>';
  if(!its.length)h+='<tr><td colspan="8" class="vazio">'+(S.ltf==="pendente"?"Nenhum levantamento pendente. Eles aparecem aqui quando o técnico conclui uma OS de orçamento com itens levantados.":"Nada aqui.")+"</td></tr>";
  its.forEach(function(l){
    var it=l.itens.map(function(i){return i.qtd+"x "+i.nome+(i.obs?" ("+i.obs+")":"")}).join(" · ");
    var st=l.status==="pendente"?'<span class="pill p-ama">Pendente</span>':l.status==="convertido"?'<span class="pill p-ver">Convertido'+(l.orc_num?" · "+esc(l.orc_num):"")+"</span>":'<span class="pill p-cin">Descartado</span>';
    var ac=l.status==="pendente"?'<button class="mini y" type="button" data-conv="'+esc(l.id)+'">Converter em orçamento</button> <button class="mini" type="button" data-desc="'+esc(l.id)+'">Descartar</button>':l.status==="convertido"&&l.orc_id?'<button class="mini" type="button" data-orc="'+esc(l.orc_id)+'">Abrir orçamento</button>':l.status==="descartado"?'<button class="mini" type="button" data-reab="'+esc(l.id)+'">Reabrir</button>':"";
    h+='<tr><td><span class="lt-bdg">L.T. '+esc(l.num)+'</span></td><td style="white-space:nowrap">OS '+esc(l.os_num)+"</td><td><b>"+esc(l.cliente)+'</b><div class="sub">'+esc(cidade(l.cidade))+"</div></td><td>"+esc(l.tecnico)+'</td><td style="white-space:nowrap">'+dataBR(l.data)+'</td><td style="max-width:380px">'+esc(it)+(l.obs?'<div class="sub">Obs.: '+esc(l.obs)+"</div>":"")+"</td><td>"+st+'</td><td class="r" style="white-space:nowrap">'+ac+"</td></tr>"});
  h+="</tbody></table></div></section>";
  $("#pag").innerHTML=h;
  $$("[data-ltf]").forEach(function(b){b.onclick=function(){S.ltf=b.dataset.ltf;desenharLTs()}});
  $$("[data-conv]").forEach(function(b){b.onclick=function(){converter(b.dataset.conv,b)}});
  $$("[data-orc]").forEach(function(b){b.onclick=function(){abrirOrc(b.dataset.orc)}});
  $$("[data-desc]").forEach(function(b){b.onclick=function(){var l=S.lts.find(function(x){return x.id===b.dataset.desc});if(!confirm("Descartar o L.T. "+l.num+" ("+l.cliente+")? Ele sai dos pendentes e pode ser reaberto depois."))return;api("POST","/api/levantamentos/"+l.id+"/descartar").then(carregar).catch(function(e){toast(e.message)})}});
  $$("[data-reab]").forEach(function(b){b.onclick=function(){api("POST","/api/levantamentos/"+b.dataset.reab+"/reabrir").then(carregar).catch(function(e){toast(e.message)})}});
}
function converter(id,bt){
  if(bt)bt.disabled=true;
  api("GET","/api/levantamentos/"+id+"/sugestao").then(function(s){
    var L=s.lt,E=novoE();
    E.lt={id:L.id,num:L.num,os_num:L.os_num,tecnico:L.tecnico,data:L.data,obs:L.obs,cliente:L.cliente};
    E.cliSug=s.clientes||[];if(s.op)E.op={id:s.op.id,cod:s.op.cod};
    E.itens=L.itens.map(function(i){var p=i.produto;var it={produto_id:p?p.id:null,codigo:p?p.codigo:"",descricao:p?p.descricao:"",unidade:p?p.unidade:"",qtd:i.qtd,preco:p?+p.preco_venda||0:0,desc:0,obs:i.obs||"",lt_nome:i.nome,lt_qtd:i.qtd};if(p)aplicarCatalogoNoItem(it,p);return it});
    if(L.obs)E.obs="";
    var fim=function(){return enriquecerItensCatalogo(E).then(function(){E.base=snap(E);S.E=E;desenhar();window.scrollTo(0,0)})};
    if(s.cliente)return carregarCliente(E,s.cliente.id).then(fim);return fim();
  }).catch(function(e){toast(e.message);if(bt)bt.disabled=false})}

/* ===================== EDITOR ===================== */
function novoE(){return{id:null,num:null,versao:0,status:"salvo",os_num:null,lt:null,cli:null,cliSug:[],itens:[],desconto:0,validade:hojeISO(15),pagamento:"",prazo:"",garantia:"",obs:"",ref:"",ocultarItens:false,ocultarTotal:false,criado_nome:"",criado_em:null,mensal:novoM(),comodato:novoC(),empresaDoc:"ancora",op:null,base:""}}
function novoM(){return{ativo:false,itens:[],prazo_meses:"",inicio:""}}
function novoC(){return{ativo:false,pct_mes:"1,5",meses:"36",pct_depreciacao:"20"}}
function edDe(it){var D=it.dados||{},c=D.cliente||{},Co=D.comodato&&D.comodato.ativo?D.comodato:null;
  return{id:it.id,num:it.num,versao:it.versao,status:it.status,os_num:it.os_num,criado_nome:it.criado_nome,criado_em:it.criado_em,
    lt:it.lt_num?{id:it.lt_id,num:it.lt_num}:null,cliSug:[],op:it.op_id?{id:it.op_id,cod:it.op_cod||""}:null,
    cli:{id:it.parceiro_id,razao:c.razao,fantasia:c.fantasia,documento:c.documento,endereco:c.endereco,bairro:c.bairro,cidade:c.cidade,uf:c.uf,cep:c.cep,telefone:c.telefone,email:c.email,contato:c.contato,ie:c.ie},
    itens:(D.itens||[]).map(function(i){return{tipo:i.tipo==="servico"?"servico":undefined,mo_id:i.mo_id,produto_id:i.produto_id,codigo:i.codigo,descricao:i.descricao,unidade:i.unidade,qtd:i.qtd,preco:i.preco,desc:i.desc||0,obs:i.obs||"",lt_nome:i.lt_nome}}),
    autorizacao:D.autorizacao&&D.autorizacao.por?D.autorizacao:null,
    desconto:D.desconto||0,validade:D.validade||"",pagamento:D.pagamento||"",prazo:D.prazo||"",garantia:D.garantia||"",obs:D.obs||"",ref:D.ref||"",ocultarItens:!!D.ocultarItens,ocultarTotal:!!D.ocultarTotal,
    mensal:D.mensal&&D.mensal.ativo?{ativo:true,itens:(D.mensal.itens||[]).map(function(i){return{servico_id:i.servico_id,codigo:i.codigo,descricao:i.descricao,unidade:i.unidade,qtd:i.qtd,preco:i.preco,desc:i.desc||0,obs:i.obs||""}}),prazo_meses:D.mensal.prazo_meses||"",inicio:D.mensal.inicio||""}:novoM(),
    comodato:Co?{ativo:true,pct_mes:n2(Math.max(1,num(Co.pct_mes)||1)),meses:String(Co.meses||""),pct_depreciacao:n2(Math.max(10,num(Co.pct_depreciacao)||10))}:novoC(),
    empresaDoc:Co?"angela":(D.empresaDoc||"ancora"),base:""}}
function snap(E){return JSON.stringify({c:E.cli&&E.cli.id,i:E.itens.map(function(i){return[i.tipo==="servico"?"s"+i.mo_id:i.produto_id,r2(num(i.qtd)),r2(num(i.preco)),r2(num(i.desc)),i.obs]}),d:r2(num(E.desconto)),v:E.validade,p:E.pagamento,z:E.prazo,g:E.garantia,o:E.obs,r:E.ref,oi:E.ocultarItens,ot:E.ocultarTotal,m:E.mensal.ativo?[E.mensal.itens.map(function(i){return[i.servico_id,r2(num(i.qtd)),r2(num(i.preco)),r2(num(i.desc)),i.obs]}),String(E.mensal.prazo_meses||""),E.mensal.inicio]:0,co:E.comodato&&E.comodato.ativo?[String(E.comodato.pct_mes||""),String(E.comodato.meses||""),String(E.comodato.pct_depreciacao||"")]:0})}
function sujo(){var E=S.E;if(!E||E.os_num)return false;return E.id?snap(E)!==E.base:!!(E.itens.length||E.cli||E.mensal.itens.length||(E.comodato&&E.comodato.ativo))}
function sairEditor(){return!sujo()||confirm("Há alterações não salvas neste orçamento. Sair mesmo assim?")}
function enriquecerItensCatalogo(E){
  var ids=E.itens.filter(function(i){return!ehSvc(i)&&i.produto_id}).map(function(i){return i.produto_id});
  if(!ids.length)return Promise.resolve(E);
  return api("POST","/api/cadastros/produtos/info",{ids:ids}).then(function(d){
    var map={};(d.itens||[]).forEach(function(p){map[p.id]=p});
    E.itens.forEach(function(i){if(i.produto_id&&map[i.produto_id])aplicarCatalogoNoItem(i,map[i.produto_id])});
    return E;
  }).catch(function(){return E});
}
function abrirOrc(id){if(S.E&&S.E.id!==id&&!sairEditor())return;api("GET","/api/orcamentos/"+id).then(function(d){var E=edDe(d.item);return enriquecerItensCatalogo(E).then(function(){E.base=snap(E);S.E=E;desenhar();window.scrollTo(0,0)})}).catch(function(e){toast(e.message)})}
function duplicar(it){var E=edDe(it);E.id=null;E.num=null;E.versao=0;E.status="salvo";E.os_num=null;E.lt=null;E.criado_nome="";E.criado_em=null;E.validade=hojeISO(15);E.base="";enriquecerItensCatalogo(E).then(function(){S.E=E;desenhar();window.scrollTo(0,0);toast("Cópia de "+it.num+": confira e clique em Salvar para gerar o número novo.",5000)})}
function carregarCliente(E,id){return api("GET","/api/cadastros/parceiros/"+id).then(function(d){var p=d.item;E.cli={id:p.id,razao:p.razao,fantasia:p.fantasia,documento:p.documento,endereco:p.endereco,bairro:p.bairro,cidade:p.cidade,uf:p.uf,cep:p.cep,telefone:p.telefone,email:p.email,contato:p.contato,ie:p.ie}})}
function calc(E){var sub=0,sv=0;E.itens.forEach(function(i){i._t=r2(num(i.qtd)*num(i.preco)*(1-Math.min(100,Math.max(0,num(i.desc)))/100));sub+=i._t;if(ehSvc(i))sv+=i._t});sub=r2(sub);sv=r2(sv);var d=Math.min(sub,Math.max(0,r2(num(E.desconto))));return{sub:sub,desc:d,total:r2(sub-d),sv:sv,pr:r2(sub-sv)}}
function ehSvc(i){return!!i&&i.tipo==="servico"}
function faltaProd(i){return!ehSvc(i)&&!i.produto_id}
function ordenar(E){var p=E.itens.filter(function(i){return!ehSvc(i)}),s=E.itens.filter(ehSvc);E.itens=p.concat(s)}
function carregarMO(){if(S.mos)return Promise.resolve(S.mos);return api("GET","/api/cadastros/maoobra").then(function(d){S.mos=(d.itens||[]).filter(function(m){return m.situacao!=="Inativo"});return S.mos})}
function calcM(E){var t=0;E.mensal.itens.forEach(function(i){i._t=r2(num(i.qtd)*num(i.preco)*(1-Math.min(100,Math.max(0,num(i.desc)))/100));t+=i._t});return E.mensal.ativo?r2(t):0}
/** Comodato: taxa = valor×%×meses; parcela = ceil((valor+taxa)/meses); mensalidade = round(parcela×(1+dep%)). */
function calcC(E){
  var C=E.comodato||novoC();
  if(!C.ativo)return{valor:0,taxa:0,parcela:0,mensalidade:0,meses:0,pct:0,dep:0};
  var valor=calc(E).total,pct=Math.min(100,Math.max(1,num(C.pct_mes)||1)),meses=Math.min(240,Math.max(0,parseInt(String(C.meses).replace(/\D+/g,""),10)||0)),dep=Math.min(100,Math.max(10,num(C.pct_depreciacao)||10));
  if(!meses)return{valor:valor,taxa:0,parcela:0,mensalidade:0,meses:0,pct:pct,dep:dep};
  var taxa=r2(valor*(pct/100)*meses),parcela=Math.ceil((valor+taxa)/meses),mensalidade=Math.round(parcela*(1+dep/100));
  return{valor:valor,taxa:taxa,parcela:parcela,mensalidade:mensalidade,meses:meses,pct:pct,dep:dep};
}
function carregarSvcs(){if(S.svcs)return Promise.resolve(S.svcs);return api("GET","/api/cadastros/servicos").then(function(d){S.svcs=d.itens||[];return S.svcs})}
function barraTot(E){
  var T=calc(E),M=calcM(E),C=calcC(E),parts=[];
  if(E.itens.length||(!E.mensal.ativo&&!(E.comodato&&E.comodato.ativo)))parts.push(brl(T.total));
  if(E.mensal.ativo)parts.push('<span class="tm"'+(E.itens.length?"":' style="font:inherit;color:#FFD200"')+">"+brl(M)+"/mês</span>");
  if(E.comodato&&E.comodato.ativo)parts.push('<span class="tm"'+(parts.length?"":' style="font:inherit;color:#FFD200"')+">comodato "+brl(C.mensalidade)+"/mês</span>");
  return parts.join(" + ")||brl(0);
}
function travado(){return!!(S.E&&S.E.os_num)}

function desenharEditor(){
  var E=S.E,tv=travado(),st=ST[E.status]||ST.salvo,c=E.cli;
  var h='<div class="ed-top"><div class="ed-tit"><button class="voltar" type="button" id="ed-voltar">← Orçamentos</button><span class="ed-num">'+(E.num?esc(E.num):"Novo orçamento")+"</span>"+(E.num?'<span class="pill '+st[1]+'">'+st[0]+"</span>":"")+(E.lt?'<span class="lt-bdg">L.T. '+esc(E.lt.num)+"</span>":"")+(E.op?'<span class="op-bdg">Oportunidade '+esc(E.op.cod||"")+"</span>":"")+(E.os_num?'<span class="os-bdg">Enviado ao pedido · OS '+esc(E.os_num)+"</span>":"")+'</div><span class="dica">'+(E.num?"Criado por "+esc(E.criado_nome||"")+" em "+dataHora(E.criado_em):"O número ORC-AAAA-00000 é gerado ao salvar.")+"</span></div>";
  if(tv)h+='<div class="aviso ok">Este orçamento já foi enviado ao pedido (OS '+esc(E.os_num)+')'+(E.autorizacao?' · autorizado por <b>'+esc(E.autorizacao.por)+'</b>':'')+(E.autorizacao&&E.autorizacao.doc?' · <a href="'+esc(E.autorizacao.doc.url)+'" target="_blank" rel="noopener">ver documento</a>':'')+' e não pode mais ser alterado. Para fazer outra versão, use <b>Duplicar</b>.</div>';
  if(E.op&&!tv)h+='<div class="aviso azul" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><span>Este orçamento é da oportunidade <b>'+esc(E.op.cod||"")+'</b> do CRM. Ao salvar, o número e os valores vão para a oportunidade. A OS de instalação é aberta quando a oportunidade for finalizada como <b>Fechado</b>.</span><button class="mini" type="button" id="bt-op">Abrir oportunidade</button></div>';
  if(E.lt&&E.lt.os_num)h+='<div class="aviso">Levantamento técnico <b>L.T. '+esc(E.lt.num)+"</b> · OS "+esc(E.lt.os_num)+" · técnico "+esc(E.lt.tecnico||"")+(E.lt.data?" · visita em "+dataBR(E.lt.data):"")+(E.lt.obs?'<div style="margin-top:6px"><b>Observação do técnico:</b> '+esc(E.lt.obs)+"</div>":"")+'<div class="sub" style="margin-top:6px">As linhas em amarelo ainda não têm produto do cadastro: escolha o produto em cada uma (obrigatório para salvar). O sistema guarda a escolha e reconhece sozinho na próxima vez.</div></div>';
  var dis=tv?" disabled":"",dis0=dis;
  // cliente
  h+='<section class="card"><div class="card-h"><span class="card-t">Cliente</span>'+(c&&!tv?'<button class="mini" type="button" id="cli-trocar">Trocar cliente</button>':"")+'</div><div class="card-b">';
  if(!c){
    h+='<div class="f"><label class="flabel" for="cli-busca">Buscar no cadastro de clientes</label><input class="field" id="cli-busca" type="text" data-busca="cliente" placeholder="Digite o nome, CNPJ/CPF ou cidade e escolha na lista" autocomplete="off"></div>';
    var cliInf=(E.lt&&E.lt.cliente)||E.cliHint;
    if(cliInf)h+='<div class="dica" style="margin-top:8px">Cliente informado '+(E.lt?"na OS":"na oportunidade")+': <b>'+esc(cliInf)+"</b>"+(E.cliSug.length?" · parecidos no cadastro:":" · nenhum parecido no cadastro. Se não existir, cadastre em Cadastros → Clientes e fornecedores.")+"</div>";
    if(E.cliSug.length)h+='<div class="chips">'+E.cliSug.slice(0,8).map(function(p){return'<button class="chip" type="button" data-cli="'+p.id+'">'+esc(p.fantasia||p.razao)+(p.cidade?" · "+esc(cidade(p.cidade)):"")+"</button>"}).join("")+"</div>";
  }else{
    var nm=c.fantasia||c.razao;
    h+='<div class="cli-nome">'+esc(nm)+"</div>"+(c.razao&&c.razao!==nm?'<div class="sub">'+esc(c.razao)+"</div>":"");
    var cp=[["CNPJ / CPF",doc(c.documento)],["Inscrição estadual",c.ie],["Telefone",c.telefone],["E-mail",c.email],["Endereço",c.endereco],["Bairro",c.bairro],["Cidade / UF",[cidade(c.cidade),c.uf].filter(Boolean).join(" / ")],["CEP",c.cep],["Contato",c.contato]];
    h+='<div class="cli-grid">'+cp.map(function(x){return'<div><div class="k">'+x[0]+'</div><div class="v">'+(x[1]?esc(x[1]):'<span class="sub">—</span>')+"</div></div>"}).join("")+"</div>";
  }
  h+="</div></section>";
  // itens
  h+='<section class="card"><div class="card-h"><span class="card-t">Produtos e serviços (execução)</span><span class="dica">'+E.itens.length+(E.itens.length===1?" item":" itens")+"</span></div><div class=\"card-b\">";
  if(!tv)h+='<div class="add-row"><input class="field" id="add-prod" type="text" data-busca="produto" placeholder="Adicionar produto: digite código ou descrição e escolha na lista" autocomplete="off" aria-label="Adicionar produto"><select class="field sv-add" id="add-svc" aria-label="Incluir serviço de mão de obra"><option value="">'+(S.mos?"+ Incluir serviço (mão de obra)…":"Carregando serviços…")+"</option>"+(S.mos||[]).map(function(m){return'<option value="'+m.id+'">'+esc(m.descricao)+(m.preco_venda!=null?" · "+brl(m.preco_venda)+"/"+esc(String(m.unidade||"").toLowerCase()):"")+"</option>"}).join("")+"</select></div>";
  h+='<div class="tw"><table class="tbl itens"><thead><tr><th style="width:36px">#</th><th>Produto</th><th>Un.</th><th class="r">Qtd</th><th class="r">Preço unit.</th><th class="r">Desc. %</th><th class="r">Total</th>'+(tv?"":'<th class="r"></th>')+"</tr></thead><tbody id=\"it-body\">"+linhasItens()+"</tbody></table></div>";
  var T=calc(E);
  h+='<div class="tot"><div class="tot-box"><div class="tot-l sv-l"'+(T.sv?"":" hidden")+'><span>Produtos</span><b id="t-pr">'+brl(T.pr)+'</b></div><div class="tot-l sv-l"'+(T.sv?"":" hidden")+'><span>Serviços (mão de obra)</span><b id="t-sv">'+brl(T.sv)+'</b></div><div class="tot-l"><span>Subtotal</span><b id="t-sub">'+brl(T.sub)+'</b></div><div class="tot-l"><label for="t-desc">Desconto (R$)</label>'+(tv?"<b>"+brl(T.desc)+"</b>":'<input class="num" id="t-desc" inputmode="decimal" value="'+(E.desconto?n2(E.desconto):"")+'" placeholder="0,00">')+'</div><div class="tot-l g"><span>Total</span><span id="t-tot">'+brl(T.total)+"</span></div></div></div>";
  h+="</div></section>";
  // serviço mensal
  var M=E.mensal;
  h+='<section class="card m-card'+(M.ativo?" on":"")+'"><div class="card-h"><label class="m-flag"><input type="checkbox" id="m-ativo"'+(M.ativo?" checked":"")+dis0+'><span>Incluir serviço mensal</span></label><span class="dica">'+(M.ativo?M.itens.length+(M.itens.length===1?" serviço":" serviços"):"Monitoramento, rastreamento e outros serviços cobrados por mês")+"</span></div>";
  if(M.ativo){
    h+='<div class="card-b">';
    if(!tv)h+='<div class="add-row"><select class="field" id="m-add" aria-label="Adicionar serviço mensal"><option value="">'+(S.svcs?"Adicionar serviço mensal do cadastro…":"Carregando serviços…")+"</option>"+(S.svcs||[]).map(function(v){return'<option value="'+v.id+'">'+esc(v.codigo+" · "+v.descricao)+(v.preco_venda!=null?" — "+brl(v.preco_venda)+"/mês":"")+"</option>"}).join("")+"</select></div>"+(S.svcs&&!S.svcs.length?'<div class="dica" style="margin-bottom:10px">Nenhum serviço ativo no cadastro. Cadastre em Cadastros → Serviços mensais.</div>':"");
    h+='<div class="tw"><table class="tbl itens"><thead><tr><th style="width:36px">#</th><th>Serviço</th><th>Un.</th><th class="r">Qtd</th><th class="r">Valor mensal unit.</th><th class="r">Desc. %</th><th class="r">Total mensal</th>'+(tv?"":'<th class="r"></th>')+'</tr></thead><tbody id="m-body">'+linhasM()+"</tbody></table></div>";
    h+='<div class="tot"><div class="tot-box m-tot"><div class="tot-l g"><span>Valor mensal</span><span id="m-tot">'+brl(calcM(E))+"</span></div></div></div>";
    h+='<div class="grid2" style="margin-top:14px"><div class="f"><label class="flabel" for="m-prazo">Prazo contratual (meses)</label><input class="field" id="m-prazo" inputmode="numeric" value="'+esc(M.prazo_meses)+'" placeholder="Ex.: 36"'+dis0+'></div><div class="f" style="grid-column:span 3"><label class="flabel" for="m-ini">Início da cobrança (opcional)</label><input class="field" id="m-ini" value="'+esc(M.inicio)+'" placeholder="Ex.: a partir da ativação do sistema"'+dis0+"></div></div>";
    h+="</div>";
  }
  h+="</section>";
  // comodato
  var C=E.comodato||novoC(),CC=calcC(E);
  h+='<section class="card m-card c-card'+(C.ativo?" on":"")+'"><div class="card-h"><label class="m-flag"><input type="checkbox" id="c-ativo"'+(C.ativo?" checked":"")+dis0+'><span>Comodato</span></label><span class="dica">'+(C.ativo?"Empresa Angela · mensalidade sobre o total do orçamento":"Marque para gerar contrato de comodato (OS e faturamento na Angela)")+"</span></div>";
  if(C.ativo){
    h+='<div class="card-b">';
    h+='<div class="grid2"><div class="f"><label class="flabel" for="c-pct">Porcentagem ao mês (%) · mín. 1%</label><input class="field" id="c-pct" inputmode="decimal" value="'+esc(C.pct_mes)+'" placeholder="Ex.: 1,5" min="1"'+dis0+'></div>';
    h+='<div class="f"><label class="flabel" for="c-meses">Meses do contrato</label><input class="field" id="c-meses" inputmode="numeric" value="'+esc(C.meses)+'" placeholder="Ex.: 36"'+dis0+'></div>';
    h+='<div class="f"><label class="flabel" for="c-dep">Depreciação (%) · mín. 10%</label><input class="field" id="c-dep" inputmode="decimal" value="'+esc(C.pct_depreciacao)+'" placeholder="Ex.: 20" min="10"'+dis0+"></div></div>";
    h+='<div class="tot" style="margin-top:14px"><div class="tot-box m-tot"><div class="tot-l g"><span>Mensalidade comodato</span><span id="c-men">'+brl(CC.mensalidade)+"</span></div></div></div>";
    h+="</div>";
  }
  h+="</section>";
  // condições

  h+='<section class="card"><div class="card-h"><span class="card-t">Condições</span></div><div class="card-b"><div class="grid2">'+
    '<div class="f"><label class="flabel" for="c-val">Validade da proposta</label><input class="field" type="date" id="c-val" value="'+esc(E.validade)+'"'+dis+'></div>'+
    '<div class="f"><label class="flabel" for="c-pag">Forma de pagamento</label><input class="field" id="c-pag" value="'+esc(E.pagamento)+'" placeholder="Ex.: 50% na aprovação e 50% na entrega"'+dis+'></div>'+
    '<div class="f"><label class="flabel" for="c-pra">Prazo de execução</label><input class="field" id="c-pra" value="'+esc(E.prazo)+'" placeholder="Ex.: 10 dias úteis após a aprovação"'+dis+'></div>'+
    '<div class="f"><label class="flabel" for="c-gar">Garantia</label><input class="field" id="c-gar" value="'+esc(E.garantia)+'" placeholder="Ex.: 12 meses para equipamentos"'+dis+'></div>'+
    '<div class="f span4"><label class="flabel" for="c-ref">Referência / local da instalação (opcional)</label><input class="field" id="c-ref" value="'+esc(E.ref)+'" placeholder="Ex.: Portaria e garagem do bloco B"'+dis+'></div>'+
    '<div class="f span4"><label class="flabel" for="c-obs">Observações para o cliente</label><textarea class="field" id="c-obs"'+dis+'>'+esc(E.obs)+"</textarea></div></div></div></section>";
  // documento
  h+='<section class="card"><div class="card-h"><span class="card-t">Documento para o cliente</span><button class="btn ghost" type="button" id="bt-doc">Visualizar · PDF · imprimir</button></div><div class="card-b"><div class="cks">'+
    '<label class="ck"><input type="checkbox" id="o-itens"'+(E.ocultarItens?" checked":"")+dis+'><span>Ocultar valores dos itens<small>O documento mostra os itens e só os totais (produtos e mensal).</small></span></label>'+
    '<label class="ck"><input type="checkbox" id="o-total"'+(E.ocultarTotal?" checked":"")+dis+'><span>Ocultar valor total<small>Esconde o total dos produtos e o valor mensal. Com as duas marcadas, o documento sai sem nenhum valor.</small></span></label></div></div></section>';
  // barra
  h+='<div class="barra"><div><div class="tt" id="b-tot">'+barraTot(E)+'</div><div class="st" id="b-st"></div></div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
  if(E.id){
    h+='<label class="sub" for="e-st" style="color:#E6E6E0">Situação</label><select class="field" id="e-st" style="width:auto;min-height:40px"'+(tv?" disabled":"")+">"+Object.keys(ST).map(function(k){return'<option value="'+k+'"'+(E.status===k?" selected":"")+">"+ST[k][0]+"</option>"}).join("")+"</select>";
    h+='<button class="btn bt-claro" type="button" id="bt-dup">Duplicar</button>';
    if(!tv&&!E.op)h+='<button class="btn bt-claro" type="button" id="bt-opp">Enviar para oportunidade</button><button class="btn bt-claro" type="button" id="bt-ped">Enviar ao pedido</button>';
    if(E.op)h+='<button class="btn bt-claro" type="button" id="bt-op2">Abrir oportunidade '+esc(E.op.cod||"")+'</button>';
  }
  if(!tv)h+='<button class="btn adv" type="button" id="bt-salvar">'+(E.id?"Salvar alterações":"Salvar orçamento")+"</button>";
  h+='</div><div class="erro" id="e-erro" role="alert" style="flex-basis:100%"></div></div>';
  $("#pag").innerHTML=h;
  ligarEditor();marcar();
  if(M.ativo&&!S.svcs)carregarSvcs().then(function(){if(S.E===E)desenharEditor()}).catch(function(e){toast("Serviços mensais: "+e.message)});
}
function linhasM(){
  var E=S.E,tv=travado(),M=E.mensal,dis=tv?" disabled":"";
  if(!M.itens.length)return'<tr><td colspan="8" class="vazio">Nenhum serviço mensal. Escolha no campo acima.</td></tr>';
  return M.itens.map(function(i,k){
    return"<tr><td>"+(k+1)+'</td><td><div class="prod-d">'+esc(i.descricao)+'</div><div class="prod-c">Cód. '+esc(i.codigo)+"</div>"+(tv?(i.obs?'<div class="sub">'+esc(i.obs)+"</div>":""):'<input class="obs-in" data-mobs="'+k+'" value="'+esc(i.obs)+'" placeholder="Complemento (opcional) · ex.: 4 câmeras, 1 veículo" aria-label="Complemento do serviço '+(k+1)+'">')+"</td><td>"+esc(i.unidade||"MÊS")+'</td><td class="q"><input class="num" data-mq="'+k+'" inputmode="decimal" value="'+qtdTxt(i.qtd)+'" aria-label="Quantidade serviço '+(k+1)+'"'+dis+'></td><td class="p"><input class="num" data-mp="'+k+'" inputmode="decimal" value="'+n2(i.preco)+'" aria-label="Valor mensal serviço '+(k+1)+'"'+dis+'></td><td class="d"><input class="num" data-md="'+k+'" inputmode="decimal" value="'+(i.desc?n2(i.desc):"")+'" placeholder="0" aria-label="Desconto % serviço '+(k+1)+'"'+dis+'></td><td class="r" style="white-space:nowrap;font-weight:700" data-mt="'+k+'">'+brl(r2(num(i.qtd)*num(i.preco)*(1-num(i.desc)/100)))+"</td>"+(tv?"":'<td class="r"><button class="ico del" type="button" data-mrm="'+k+'" aria-label="Remover serviço '+(k+1)+'">✕</button></td>')+"</tr>"}).join("")}
function redesenharM(){var er=$("#e-erro");if(er)er.textContent="";var b=$("#m-body");if(!b)return desenharEditor();b.innerHTML=linhasM();ligarM();totais()}
function ligarM(){
  var M=S.E.mensal;
  $$("[data-mq]").forEach(function(x){x.oninput=function(){M.itens[+x.dataset.mq].qtd=num(x.value);totais()};x.onblur=function(){x.value=qtdTxt(M.itens[+x.dataset.mq].qtd||0)}});
  $$("[data-mp]").forEach(function(x){x.oninput=function(){M.itens[+x.dataset.mp].preco=num(x.value);totais()};x.onblur=function(){x.value=n2(M.itens[+x.dataset.mp].preco)}});
  $$("[data-md]").forEach(function(x){x.oninput=function(){M.itens[+x.dataset.md].desc=Math.min(100,Math.max(0,num(x.value)));totais()}});
  $$("[data-mobs]").forEach(function(x){x.oninput=function(){M.itens[+x.dataset.mobs].obs=x.value;marcar()}});
  $$("[data-mrm]").forEach(function(b){b.onclick=function(){var k=+b.dataset.mrm;if(!confirm("Remover “"+M.itens[k].descricao+"” do serviço mensal?"))return;M.itens.splice(k,1);desenharEditor()}});
}
function linhasItens(){
  var E=S.E,tv=travado();
  if(!E.itens.length)return'<tr><td colspan="8" class="vazio">Nenhum item. Use o campo acima para adicionar produtos e serviços do cadastro.</td></tr>';
  return E.itens.map(function(i,k){var falta=faltaProd(i),sv=ehSvc(i),dis=tv?" disabled":"";
    var sug=sv?null:(i.preco_sug!=null?Number(i.preco_sug):sugPreco(i.custo,i.markup));
    var baixo=!sv&&abaixoSug(i.preco,sug);
    var prod=sv?'<div class="prod-d"><span class="sv-tag">Serviço</span>'+esc(i.descricao)+'</div><div class="prod-c">Cód. '+esc(i.codigo)+" · mão de obra</div>":falta?'<div class="lt-orig">L.T.: '+qtdTxt(i.lt_qtd||i.qtd)+"x "+esc(i.lt_nome||"")+"</div>"+(tv?"":'<input class="field" type="text" data-busca="produto" data-escolher="'+k+'" placeholder="Escolha o produto do cadastro para este item" autocomplete="off" aria-label="Produto para '+esc(i.lt_nome||"item")+'">')
      :(i.lt_nome&&norm(i.lt_nome)!==norm(i.descricao)?'<div class="lt-orig">L.T.: '+esc(i.lt_nome)+(tv?"":' · <button class="lnk" type="button" data-trocar="'+k+'" style="all:unset;cursor:pointer;text-decoration:underline">trocar produto</button>')+"</div>":"")+'<div class="prod-d">'+esc(i.descricao)+'</div><div class="prod-c">Cód. '+esc(i.codigo)+(i.estoque!=null?" · estoque "+qtdTxt(i.estoque):"")+"</div>";
    prod+=tv?(i.obs?'<div class="sub">'+esc(i.obs)+"</div>":""):'<input class="obs-in" data-obs="'+k+'" value="'+esc(i.obs)+'" placeholder="Complemento (opcional) · ex.: Portão social" aria-label="Complemento do item '+(k+1)+'">';
    var precoCell='<td class="p'+(baixo?" abaixo-sug":"")+'"><input class="num'+(baixo?" abaixo-sug":"")+'" data-p="'+k+'" inputmode="decimal" value="'+n2(i.preco)+'" aria-label="Preço item '+(k+1)+'"'+dis+'>'+(sug>0?'<div class="sug-preco'+(baixo?" abaixo":"")+'">Sugestão '+brl(sug)+(baixo?" · abaixo":"")+"</div>":"")+"</td>";
    return'<tr class="'+(falta?"falta":"")+(sv?" sv-row":"")+(baixo?" abaixo-sug-row":"")+'"><td>'+(k+1)+"</td><td>"+prod+"</td><td>"+esc(i.unidade||"")+'</td><td class="q"><input class="num" data-q="'+k+'" inputmode="decimal" value="'+qtdTxt(i.qtd)+'" aria-label="Quantidade item '+(k+1)+'"'+dis+'></td>'+precoCell+'<td class="d"><input class="num" data-d="'+k+'" inputmode="decimal" value="'+(i.desc?n2(i.desc):"")+'" placeholder="0" aria-label="Desconto % item '+(k+1)+'"'+dis+'></td><td class="r" style="white-space:nowrap;font-weight:700" data-t="'+k+'">'+brl(r2(num(i.qtd)*num(i.preco)*(1-num(i.desc)/100)))+"</td>"+(tv?"":'<td class="r" style="white-space:nowrap"><button class="ico" type="button" data-up="'+k+'" aria-label="Subir item '+(k+1)+'"'+(k===0||ehSvc(E.itens[k-1])!==sv?" disabled":"")+'>↑</button> <button class="ico" type="button" data-dn="'+k+'" aria-label="Descer item '+(k+1)+'"'+(k===E.itens.length-1||ehSvc(E.itens[k+1])!==sv?" disabled":"")+'>↓</button> <button class="ico del" type="button" data-rm="'+k+'" aria-label="Remover item '+(k+1)+'">✕</button></td>')+"</tr>"}).join("")}
function totais(){var E=S.E,T=calc(E),M=calcM(E),C=calcC(E);$("#t-sub").textContent=brl(T.sub);var tp=$("#t-pr"),ts=$("#t-sv");if(tp){tp.textContent=brl(T.pr);ts.textContent=brl(T.sv);$$(".sv-l").forEach(function(x){x.hidden=!T.sv})}$("#t-tot").textContent=brl(T.total);$("#b-tot").innerHTML=barraTot(E);E.itens.forEach(function(i,k){var c=$('[data-t="'+k+'"]');if(c)c.textContent=brl(i._t);var sug=ehSvc(i)?null:(i.preco_sug!=null?Number(i.preco_sug):sugPreco(i.custo,i.markup));var baixo=!ehSvc(i)&&abaixoSug(i.preco,sug);var inp=$('[data-p="'+k+'"]');if(inp){inp.classList.toggle("abaixo-sug",!!baixo);var cell=inp.closest("td");if(cell)cell.classList.toggle("abaixo-sug",!!baixo);var row=inp.closest("tr");if(row)row.classList.toggle("abaixo-sug-row",!!baixo);var lab=cell&&cell.querySelector(".sug-preco");if(lab&&sug>0){lab.textContent="Sugestão "+brl(sug)+(baixo?" · abaixo":"");lab.classList.toggle("abaixo",!!baixo)}}});var mt=$("#m-tot");if(mt)mt.textContent=brl(M);E.mensal.itens.forEach(function(i,k){var c=$('[data-mt="'+k+'"]');if(c)c.textContent=brl(i._t)});var cm=$("#c-men");if(cm)cm.textContent=brl(C.mensalidade);marcar()}
function marcar(){var E=S.E,el=$("#b-st");if(!el)return;var falta=E.itens.filter(faltaProd).length;
  el.textContent=E.os_num?"Enviado ao pedido · OS "+E.os_num:!E.id?"Ainda não salvo"+(falta?" · "+falta+" item(ns) sem produto":""):sujo()?"Alterações não salvas"+(falta?" · "+falta+" item(ns) sem produto":""):"Salvo";
  var bs=$("#bt-salvar");if(bs)bs.disabled=!!(E.id&&!sujo())}
function redesenharItens(){var er=$("#e-erro");if(er)er.textContent="";ordenar(S.E);$("#it-body").innerHTML=linhasItens();ligarItens();totais()}
function ligarItens(){if(window.SGOBusca){$$("[data-busca=produto]").forEach(function(inp){window.SGOBusca.ligar(inp,{tipo:"produto"})})}
  var E=S.E;
  $$("[data-q]").forEach(function(x){x.oninput=function(){E.itens[+x.dataset.q].qtd=num(x.value);totais()};x.onblur=function(){x.value=qtdTxt(E.itens[+x.dataset.q].qtd||0)}});
  $$("[data-p]").forEach(function(x){x.oninput=function(){E.itens[+x.dataset.p].preco=num(x.value);totais()};x.onblur=function(){x.value=n2(E.itens[+x.dataset.p].preco)}});
  $$("[data-d]").forEach(function(x){x.oninput=function(){E.itens[+x.dataset.d].desc=Math.min(100,Math.max(0,num(x.value)));totais()}});
  $$("[data-obs]").forEach(function(x){x.oninput=function(){E.itens[+x.dataset.obs].obs=x.value;marcar()}});
  $$("[data-rm]").forEach(function(b){b.onclick=function(){var k=+b.dataset.rm,i=E.itens[k];if(!confirm("Remover “"+(i.descricao||i.lt_nome)+"” do orçamento?"))return;E.itens.splice(k,1);redesenharItens()}});
  $$("[data-up]").forEach(function(b){b.onclick=function(){var k=+b.dataset.up;if(k<1)return;var t=E.itens[k];E.itens[k]=E.itens[k-1];E.itens[k-1]=t;redesenharItens();var n=$('[data-up="'+(k-1)+'"]');if(n&&!n.disabled)n.focus()}});
  $$("[data-dn]").forEach(function(b){b.onclick=function(){var k=+b.dataset.dn;if(k>=E.itens.length-1)return;var t=E.itens[k];E.itens[k]=E.itens[k+1];E.itens[k+1]=t;redesenharItens();var n=$('[data-dn="'+(k+1)+'"]');if(n&&!n.disabled)n.focus()}});
  $$("[data-trocar]").forEach(function(b){b.onclick=function(){var i=E.itens[+b.dataset.trocar];i.produto_id=null;i.codigo="";i.descricao="";i.unidade="";redesenharItens();var x=$('[data-escolher="'+b.dataset.trocar+'"]');if(x)x.focus()}});
  $$("[data-escolher]").forEach(function(x){x.addEventListener("sgo-busca",function(e){var p=e.detail.item,i=E.itens[+x.dataset.escolher];i.produto_id=p.id;i.codigo=p.codigo;i.descricao=p.descricao;i.unidade=p.unidade;aplicarCatalogoNoItem(i,p);if(!num(i.preco))i.preco=+p.preco_venda||0;setTimeout(redesenharItens,0)})});
}
function ligarEditor(){
  var E=S.E;
  $("#ed-voltar").onclick=function(){if(!sairEditor())return;S.E=null;desenhar();carregar()};
  var cb=$("#cli-busca");if(cb){if(window.SGOBusca)window.SGOBusca.ligar(cb,{tipo:"cliente"});cb.addEventListener("sgo-busca",function(e){carregarCliente(E,e.detail.item.id).then(function(){desenharEditor()}).catch(function(er){toast(er.message)})});setTimeout(function(){if(!E.itens.length||E.lt)cb.focus()},50)}
  $$("[data-cli]").forEach(function(b){b.onclick=function(){carregarCliente(E,+b.dataset.cli).then(function(){desenharEditor()}).catch(function(er){toast(er.message)})}});
  var tr=$("#cli-trocar");if(tr)tr.onclick=function(){E.cli=null;desenharEditor()};
  var ap=$("#add-prod");if(ap){if(window.SGOBusca)window.SGOBusca.ligar(ap,{tipo:"produto"});ap.addEventListener("sgo-busca",function(e){var p=e.detail.item;var ks=E.itens.findIndex(ehSvc);var novo={produto_id:p.id,codigo:p.codigo,descricao:p.descricao,unidade:p.unidade,qtd:1,preco:+p.preco_venda||0,desc:0,obs:""};aplicarCatalogoNoItem(novo,p);E.itens.splice(ks<0?E.itens.length:ks,0,novo);setTimeout(function(){ap.value="";redesenharItens();ap.focus();toast("Adicionado: "+p.descricao,2200)},0)})};
  var as=$("#add-svc");if(as){if(!S.mos)carregarMO().then(function(){if(S.E===E&&$("#add-svc"))desenharEditor()}).catch(function(er){toast(er.message)});as.onchange=function(){var m=(S.mos||[]).find(function(x){return String(x.id)===as.value});if(!m)return;E.itens.push({tipo:"servico",mo_id:m.id,codigo:m.codigo,descricao:m.descricao,unidade:m.unidade,qtd:1,preco:+m.preco_venda||0,desc:0,obs:""});as.value="";redesenharItens();toast("Serviço incluído: "+m.descricao,2200);var q=$('[data-q="'+(E.itens.length-1)+'"]');if(q)q.focus()}}
  ligarItens();ligarM();
  var ma=$("#m-ativo");if(ma)ma.onchange=function(){E.mensal.ativo=ma.checked;if(ma.checked){carregarSvcs().catch(function(e){toast(e.message)})}desenharEditor();if(ma.checked){var s=$("#m-add");if(s)s.focus()}};
  var mad=$("#m-add");if(mad)mad.onchange=function(){var v=(S.svcs||[]).find(function(x){return String(x.id)===mad.value});if(!v)return;E.mensal.itens.push({servico_id:v.id,codigo:v.codigo,descricao:v.descricao,unidade:v.unidade||"MÊS",qtd:1,preco:+v.preco_venda||0,desc:0,obs:""});desenharEditor();toast("Adicionado: "+v.descricao,2200);var s=$("#m-add");if(s)s.focus()};
  var mpz=$("#m-prazo");if(mpz)mpz.oninput=function(){E.mensal.prazo_meses=mpz.value.replace(/\D+/g,"").slice(0,3);marcar()};
  var mini=$("#m-ini");if(mini)mini.oninput=function(){E.mensal.inicio=mini.value;marcar()};
  var ca=$("#c-ativo");if(ca)ca.onchange=function(){E.comodato.ativo=ca.checked;if(ca.checked)E.empresaDoc="angela";desenharEditor()};
  var cpct=$("#c-pct");if(cpct){cpct.oninput=function(){E.comodato.pct_mes=cpct.value;totais()};cpct.onblur=function(){E.comodato.pct_mes=n2(Math.max(1,num(cpct.value)||1));cpct.value=E.comodato.pct_mes;totais()}};
  var cmes=$("#c-meses");if(cmes)cmes.oninput=function(){E.comodato.meses=cmes.value.replace(/\D+/g,"").slice(0,3);totais()};
  var cdep=$("#c-dep");if(cdep){cdep.oninput=function(){E.comodato.pct_depreciacao=cdep.value;totais()};cdep.onblur=function(){E.comodato.pct_depreciacao=n2(Math.max(10,num(cdep.value)||10));cdep.value=E.comodato.pct_depreciacao;totais()}};
  var td=$("#t-desc");if(td){td.oninput=function(){E.desconto=num(td.value);totais()};td.onblur=function(){td.value=E.desconto?n2(E.desconto):""}}
  [["c-val","validade"],["c-pag","pagamento"],["c-pra","prazo"],["c-gar","garantia"],["c-ref","ref"],["c-obs","obs"]].forEach(function(x){var el=$("#"+x[0]);el.oninput=el.onchange=function(){E[x[1]]=el.value;marcar()}});
  $("#o-itens").onchange=function(){E.ocultarItens=this.checked;marcar()};
  $("#o-total").onchange=function(){E.ocultarTotal=this.checked;marcar()};
  $("#bt-doc").onclick=function(){documento(E,false)};
  var bs=$("#bt-salvar");if(bs)bs.onclick=salvar;
  var sel=$("#e-st");if(sel)sel.onchange=function(){if(sujo()){toast("Salve as alterações antes de mudar a situação.");sel.value=E.status;return}api("POST","/api/orcamentos/"+E.id+"/status",{status:sel.value}).then(function(d){var n=edDe(d.item);n.base=snap(n);S.E=n;desenharEditor();toast("Situação: "+ST[n.status][0]+".");carregarListaSilenciosa()}).catch(function(er){toast(er.message);sel.value=E.status})};
  var bd=$("#bt-dup");if(bd)bd.onclick=function(){if(!sairEditor())return;api("GET","/api/orcamentos/"+E.id).then(function(d){duplicar(d.item)})};
  [$("#bt-op"),$("#bt-op2")].forEach(function(b){if(b)b.onclick=function(){if(!sairEditor())return;irPara("/comercial/crm?op="+encodeURIComponent(E.op.id))}});
  var bo=$("#bt-opp");if(bo)bo.onclick=function(){if(sujo()){toast("Salve as alterações antes de enviar para oportunidade.");return}enviarOportunidade({id:E.id,num:E.num,cliente:(E.cli&&(E.cli.fantasia||E.cli.razao))||""})};
  var bp=$("#bt-ped");if(bp)bp.onclick=function(){if(sujo()){toast("Salve as alterações antes de enviar ao pedido.");return}enviarPedido({id:E.id,num:E.num})};
}
function carregarListaSilenciosa(){api("GET","/api/orcamentos").then(function(d){S.lista=d.itens||[];desenharTabs()}).catch(function(){})}
function salvar(){
  var E=S.E,er=$("#e-erro");er.textContent="";
  if(!E.cli||!E.cli.id){er.textContent="Escolha o cliente no cadastro antes de salvar.";var c=$("#cli-busca");if(c)c.focus();return}
  var M=E.mensal,C=E.comodato||novoC();
  if(M.ativo&&!M.itens.length){er.textContent="Inclua pelo menos um serviço mensal ou desmarque “Incluir serviço mensal”.";var ms=$("#m-add");if(ms)ms.focus();return}
  if(C.ativo&&!E.itens.length){er.textContent="Comodato exige produtos/serviços de execução (base do valor).";$("#add-prod").focus();return}
  if(C.ativo&&!(num(C.pct_mes)>=1)){er.textContent="A porcentagem ao mês do comodato não pode ser menor que 1%.";var xp=$("#c-pct");if(xp)xp.focus();return}
  if(C.ativo&&!(num(C.pct_depreciacao)>=10)){er.textContent="A depreciação do comodato não pode ser menor que 10%.";var xd=$("#c-dep");if(xd)xd.focus();return}
  if(C.ativo&&!(parseInt(String(C.meses).replace(/\D+/g,""),10)>0)){er.textContent="Informe a quantidade de meses do contrato de comodato.";var xm=$("#c-meses");if(xm)xm.focus();return}
  if(!E.itens.length&&!M.ativo){er.textContent="Inclua pelo menos um produto ou serviço (ou marque “Incluir serviço mensal”).";$("#add-prod").focus();return}
  ordenar(E);var falta=E.itens.findIndex(faltaProd);
  if(falta>=0){er.textContent="Escolha o produto do cadastro em todas as linhas (falta na linha "+(falta+1)+").";var x=$('[data-escolher="'+falta+'"]');if(x)x.focus();return}
  var zero=E.itens.filter(function(i){return!num(i.preco)}).length+(M.ativo?M.itens.filter(function(i){return!num(i.preco)}).length:0);
  if(zero&&!confirm(zero+(zero===1?" item está":" itens estão")+" com preço zero. Salvar mesmo assim?"))return;
  if(C.ativo)E.empresaDoc="angela";
  var CC=calcC(E);
  var body={parceiro_id:E.cli.id,lt_id:!E.id&&E.lt?E.lt.id:undefined,op_id:!E.id&&E.op?E.op.id:undefined,versao:E.versao,dados:{itens:E.itens.map(function(i){return ehSvc(i)?{tipo:"servico",mo_id:i.mo_id,qtd:num(i.qtd),preco:num(i.preco),desc:num(i.desc),obs:i.obs}:{produto_id:i.produto_id,qtd:num(i.qtd),preco:num(i.preco),desc:num(i.desc),obs:i.obs,lt_nome:i.lt_nome}}),desconto:num(E.desconto),validade:E.validade,pagamento:E.pagamento,prazo:E.prazo,garantia:E.garantia,obs:E.obs,ref:E.ref,ocultarItens:E.ocultarItens,ocultarTotal:E.ocultarTotal,empresaDoc:E.empresaDoc||null,mensal:M.ativo?{ativo:true,itens:M.itens.map(function(i){return{servico_id:i.servico_id,qtd:num(i.qtd),preco:num(i.preco),desc:num(i.desc),obs:i.obs}}),prazo_meses:parseInt(M.prazo_meses,10)||null,inicio:M.inicio}:null,comodato:C.ativo?{ativo:true,pct_mes:CC.pct,meses:CC.meses,pct_depreciacao:CC.dep,valor_base:CC.valor,taxa:CC.taxa,parcela:CC.parcela,mensalidade:CC.mensalidade,empresa:"angela"}:null}};
  var bs=$("#bt-salvar");bs.disabled=true;
  api(E.id?"PUT":"POST",E.id?"/api/orcamentos/"+E.id:"/api/orcamentos",body).then(function(d){var n=edDe(d.item);n.base=snap(n);var novo=!E.id;S.E=n;desenhar();toast((novo?"Salvo como "+n.num:"Alterações salvas")+(n.op?" · oportunidade "+(n.op.cod||"")+" atualizada.":"."));return carregar().then(function(){S.E=n;desenhar()})})
  .catch(function(e){er.textContent=e.message;bs.disabled=false})}

/* ===================== DOCUMENTO ===================== */
var LOGO="";(function(){var i=new Image();i.onload=function(){try{var c=document.createElement("canvas");c.width=i.naturalWidth*2;c.height=i.naturalHeight*2;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0,c.width,c.height);LOGO=c.toDataURL("image/jpeg",.92)}catch(e){}};i.src="/img/logo-ancora.png"})();
/** Fallback (Omie); atualizado em runtime por /api/orcamentos/empresas-doc. */
var EMPRESAS_DOC=[
  {id:"ancora",label:"Âncora",nome:"ANCORA SEGURANCA LTDA",nomePdf:"ANCORA SEGURANCA LTDA",cnpj:"07.836.724/0001-19",fantasia:"ANCORA SEGURANCA PATRIMONIAL",email:"atendimento@ancoraseguranca.com.br"},
  {id:"angela",label:"Angela",nome:"ANGELA EQUIPAM ELETRONICOS E SERVIÇOS DE MONITORAMENTO LTDA",nomePdf:"ANGELA EQUIPAM ELETRONICOS E SERVIÇOS DE MONITORAMENTO LTDA",cnpj:"08.009.975/0001-92",fantasia:"ANGELA SERVIÇOS DIVERSOS",email:"atendimento@ancoraseguranca.com.br"},
  {id:"belfer",label:"Belfer",nome:"AUTOMACAO E SEGURANCA ELETRONICA BELFER LTDA",nomePdf:"AUTOMACAO E SEGURANCA ELETRONICA BELFER LTDA",cnpj:"15.699.646/0001-86",fantasia:"ANCORA AUTOMACAO E SEGURANCA ELETRONICA",email:"atendimento@ancoraseguranca.com.br"}
];
var EMPRESAS_DOC_OK=false;
function empDoc(id){return EMPRESAS_DOC.find(function(e){return e.id===id})||EMPRESAS_DOC[0]}
function carregarEmpresasDoc(){
  if(EMPRESAS_DOC_OK)return Promise.resolve();
  return api("GET","/api/orcamentos/empresas-doc").then(function(d){
    var lista=d&&d.empresas;if(!Array.isArray(lista)||!lista.length)return;
    EMPRESAS_DOC=lista.map(function(e){return{id:e.id,label:e.label,nome:e.nome,nomePdf:e.nomePdf||String(e.nome||"").toUpperCase(),cnpj:e.cnpj||"",fantasia:e.fantasia||"",email:e.email||"atendimento@ancoraseguranca.com.br"}});
    EMPRESAS_DOC_OK=true;
  }).catch(function(){});
}
function docDados(E){
  if(E.comodato&&E.comodato.ativo)E.empresaDoc="angela";
  var c=E.cli||{},T=calc(E),Mt=calcM(E),M=E.mensal.ativo?{itens:E.mensal.itens,total:Mt,prazo:E.mensal.prazo_meses,inicio:E.mensal.inicio}:null,CC=calcC(E),Co=E.comodato&&E.comodato.ativo?CC:null,emp=empDoc(E.empresaDoc);
  var cond=[["Validade da proposta",dataBR(E.validade)],["Forma de pagamento",E.pagamento],["Prazo de execução",E.prazo],["Garantia",E.garantia]].concat(M&&M.prazo?[["Prazo contratual",M.prazo+" meses"]]:[]).concat(M&&M.inicio?[["Início da cobrança mensal",M.inicio]]:[]);
  if(Co)cond=cond.concat([["Comodato (meses)",String(Co.meses)],["Mensalidade comodato",brl(Co.mensalidade)]]);
  return{M:M,C:Co,num:E.num||"(rascunho — não salvo)",emissao:E.criado_em?new Date(E.criado_em).toLocaleDateString("pt-BR"):new Date().toLocaleDateString("pt-BR"),validade:dataBR(E.validade),resp:E.criado_nome||"",c:c,itens:E.itens,T:T,oi:E.ocultarItens,ot:E.ocultarTotal,emp:emp,cond:cond.filter(function(x){return x[1]}),ref:E.ref,obs:E.obs};
}
function lnTot(i){return r2(num(i.qtd)*num(i.preco)*(1-num(i.desc)/100))}
function docHTML(D){
  var c=D.c,nm=c.fantasia||c.razao||"",emp=D.emp||empDoc();
  var h='<div class="ph"><div class="l"><img src="'+(LOGO||"/img/logo-ancora.png")+'" alt="'+esc(emp.label)+'"><div><div class="emp">'+esc(emp.nome)+'</div>'+(emp.cnpj?'<div class="em">CNPJ '+esc(emp.cnpj)+"</div>":"")+(emp.fantasia?'<div class="em">'+esc(emp.fantasia)+"</div>":"")+'<div class="em">'+esc(emp.email)+'</div></div></div><div class="dr"><div class="dl">Orçamento</div><div class="dn">'+esc(D.num)+'</div><div class="dd">Emitido em '+esc(D.emissao)+(D.validade?" · válido até "+esc(D.validade):"")+"</div></div></div>";
  h+='<div class="pc"><div class="t">Cliente</div><div><span class="sub">Nome / razão social:</span> <b>'+esc(c.razao||nm)+"</b></div><div><span class=\"sub\">CNPJ / CPF:</span> <b>"+esc(doc(c.documento)||"—")+"</b></div>"+(c.fantasia&&c.fantasia!==c.razao?'<div><span class="sub">Nome fantasia:</span> <b>'+esc(c.fantasia)+"</b></div>":"")+'<div><span class="sub">Endereço:</span> <b>'+esc([c.endereco,c.bairro].filter(Boolean).join(" · ")||"—")+'</b></div><div><span class="sub">Cidade / UF:</span> <b>'+esc([cidade(c.cidade),c.uf].filter(Boolean).join(" / ")||"—")+(c.cep?" · CEP "+esc(c.cep):"")+'</b></div><div><span class="sub">Telefone:</span> <b>'+esc(c.telefone||"—")+'</b></div><div><span class="sub">E-mail:</span> <b>'+esc(c.email||"—")+"</b></div>"+(c.contato?'<div><span class="sub">Contato:</span> <b>'+esc(c.contato)+"</b></div>":"")+(D.ref?'<div style="grid-column:1/-1"><span class="sub">Referência:</span> <b>'+esc(D.ref)+"</b></div>":"")+"</div>";
  if(D.itens.length){if(D.M)h+='<div class="pt-sec">Produtos e serviços</div>';
  h+='<table class="pt"'+(D.M?' style="margin-top:6px"':"")+'><thead><tr><th style="width:34px">Item</th><th>Código</th><th>Descrição</th><th>Un.</th><th style="text-align:right">Qtd</th>'+(D.oi?"":'<th style="text-align:right">Valor unit.</th><th style="text-align:right">Desc.</th><th style="text-align:right">Total</th>')+"</tr></thead><tbody>"+
    D.itens.map(function(i,k){return"<tr><td>"+(k+1)+"</td><td>"+esc(i.codigo)+"</td><td>"+esc(i.descricao)+(i.obs?'<span class="o">'+esc(i.obs)+"</span>":"")+"</td><td>"+esc(i.unidade)+'</td><td style="text-align:right">'+qtdTxt(i.qtd)+"</td>"+(D.oi?"":'<td style="text-align:right;white-space:nowrap">'+brl(i.preco)+'</td><td style="text-align:right">'+(num(i.desc)?n2(i.desc)+"%":"—")+'</td><td style="text-align:right;white-space:nowrap">'+brl(r2(num(i.qtd)*num(i.preco)*(1-num(i.desc)/100)))+"</td>")+"</tr>"}).join("")+"</tbody></table>";
  if(!D.ot){h+='<div class="ptot"><div>'+(!D.oi&&D.T.desc?'<div class="l"><span>Subtotal</span><b>'+brl(D.T.sub)+'</b></div><div class="l"><span>Desconto</span><b>− '+brl(D.T.desc)+"</b></div>":"")+'<div class="g" style="display:flex;justify-content:space-between;gap:20px"><span>'+(D.M?"Total dos produtos e serviços":"Valor total")+"</span><span>"+brl(D.T.total)+"</span></div></div></div>"}}
  if(D.M){
    h+='<div class="pt-sec">Serviço mensal</div><table class="pt" style="margin-top:6px"><thead><tr><th style="width:34px">Item</th><th>Código</th><th>Descrição</th><th>Un.</th><th style="text-align:right">Qtd</th>'+(D.oi?"":'<th style="text-align:right">Valor mensal</th><th style="text-align:right">Desc.</th><th style="text-align:right">Total mensal</th>')+"</tr></thead><tbody>"+
      D.M.itens.map(function(i,k){return"<tr><td>"+(k+1)+"</td><td>"+esc(i.codigo)+"</td><td>"+esc(i.descricao)+(i.obs?'<span class="o">'+esc(i.obs)+"</span>":"")+"</td><td>"+esc(i.unidade||"MÊS")+'</td><td style="text-align:right">'+qtdTxt(i.qtd)+"</td>"+(D.oi?"":'<td style="text-align:right;white-space:nowrap">'+brl(i.preco)+'</td><td style="text-align:right">'+(num(i.desc)?n2(i.desc)+"%":"—")+'</td><td style="text-align:right;white-space:nowrap">'+brl(lnTot(i))+"</td>")+"</tr>"}).join("")+"</tbody></table>";
    if(!D.ot)h+='<div class="ptot"><div><div class="g" style="display:flex;justify-content:space-between;gap:20px"><span>Valor mensal</span><span>'+brl(D.M.total)+"</span></div>"+(D.M.prazo?'<div class="l" style="justify-content:flex-end;color:#555">Contrato de '+esc(D.M.prazo)+" meses</div>":"")+"</div></div>";
  }
  if(D.C&&!D.ot){
    h+='<div class="pt-sec">Comodato (Angela)</div>';
    h+='<div class="ptot"><div><div class="g" style="display:flex;justify-content:space-between;gap:20px"><span>Mensalidade comodato</span><span>'+brl(D.C.mensalidade)+"</span></div>"+(D.C.meses?'<div class="l" style="justify-content:flex-end;color:#555">Contrato de '+esc(String(D.C.meses))+" meses</div>":"")+"</div></div>";
  }
  if(D.cond.length)h+='<div class="pcond">'+D.cond.map(function(x){return"<div><span>"+esc(x[0])+"</span><b>"+esc(x[1])+"</b></div>"}).join("")+"</div>";
  if(D.obs)h+='<div class="pobs"><b>Observações</b>'+esc(D.obs)+"</div>";
  h+='<div class="pf"><span>'+esc(emp.nome)+(emp.cnpj?" · CNPJ "+esc(emp.cnpj):"")+(D.resp?" · Responsável: "+esc(D.resp):"")+"</span><span>"+esc(emp.email)+"</span></div>";
  return h}
function documento(E,daLista,soLeitura){
  var o=$("#ov");if(o)o.remove();
  if(E.comodato&&E.comodato.ativo)E.empresaDoc="angela";
  else if(!E.empresaDoc)E.empresaDoc="ancora";
  var comodatoTrava=!!(E.comodato&&E.comodato.ativo);
  o=document.createElement("div");o.id="ov";o.className="ov";o.setAttribute("role","dialog");o.setAttribute("aria-label","Documento do orçamento");
  var pinta=function(){var D=docDados(E);o.innerHTML='<div class="ovbar"><span class="t">'+esc(D.num)+'</span><div class="cks emp-doc" role="radiogroup" aria-label="Empresa no orçamento"><span class="emp-doc-l">Empresa:</span>'+EMPRESAS_DOC.map(function(e){return'<label class="ck"><input type="radio" name="v-emp" value="'+e.id+'"'+(E.empresaDoc===e.id?" checked":"")+(comodatoTrava&&e.id!=="angela"?" disabled":"")+'><span>'+esc(e.label)+"</span></label>"}).join("")+(comodatoTrava?'<span class="dica">Comodato → Angela</span>':"")+'</div><div class="cks"><label class="ck"><input type="checkbox" id="v-oi"'+(E.ocultarItens?" checked":"")+'><span>Ocultar valores dos itens</span></label><label class="ck"><input type="checkbox" id="v-ot"'+(E.ocultarTotal?" checked":"")+'><span>Ocultar valor total</span></label></div><button class="btn adv" type="button" id="v-pdf">Baixar PDF</button><button class="btn ghost" type="button" id="v-print">Imprimir</button><button class="btn ghost" type="button" id="v-close">Fechar</button></div><div class="paper">'+docHTML(D)+"</div>";
    $("#v-close").onclick=function(){if(soLeitura){if(history.length>1)history.back();else window.close();return}o.remove()};$("#v-print").onclick=function(){window.print()};$("#v-pdf").onclick=function(){baixarPDF(docDados(E),this)};
    $("#v-oi").onchange=function(){E.ocultarItens=this.checked;sync();pinta()};$("#v-ot").onchange=function(){E.ocultarTotal=this.checked;sync();pinta()};
    o.querySelectorAll('input[name="v-emp"]').forEach(function(r){r.onchange=function(){if(comodatoTrava){E.empresaDoc="angela";pinta();return}E.empresaDoc=r.value;pinta()}});
    $("#v-close").focus()};
  var sync=function(){if(!daLista&&S.E===E){var a=$("#o-itens"),b=$("#o-total");if(a)a.checked=E.ocultarItens;if(b)b.checked=E.ocultarTotal;marcar()}};
  if(!soLeitura)o.addEventListener("click",function(e){if(e.target===o)o.remove()});
  document.body.appendChild(o);pinta();
  carregarEmpresasDoc().then(function(){if(document.body.contains(o))pinta()});
  if(!E.num)toast("Rascunho: salve o orçamento para o documento sair com o número.",4500)}
var LIBS={pdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",at:"https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"};
function lib(u){return new Promise(function(ok,no){var s=document.createElement("script");s.src=u;s.onload=ok;s.onerror=function(){no(new Error("não foi possível carregar o gerador de PDF (verifique a internet)"))};document.head.appendChild(s)})}
function libsPDF(){if(window.jspdf&&window.jspdf.jsPDF&&window.jspdf.jsPDF.API.autoTable)return Promise.resolve();return lib(LIBS.pdf).then(function(){return lib(LIBS.at)})}
function T(s){return String(s==null?"":s).replace(/[\u00a0\u202f]/g," ").replace(/[–—]/g,"-").replace(/−/g,"-")}
function baixarPDF(D,bt){
  bt.disabled=true;
  libsPDF().then(function(){
    var emp=D.emp||empDoc(),J=new window.jspdf.jsPDF({unit:"mm",format:"a4"}),W=210,M=14,P=[20,20,20],Y=[255,210,0],G=[90,90,90];
    try{if(LOGO)J.addImage(LOGO,"JPEG",M,9,18,17.7)}catch(e){}
    var xNome=M+22,largDir=58,largNome=W-M-largDir-xNome-4;
    J.setFont("helvetica","bold");J.setFontSize(10);J.setTextColor.apply(J,P);
    var nomeEmp=T(emp.nomePdf||emp.nome);var nomeLinhas=J.splitTextToSize(nomeEmp,Math.max(60,largNome));
    J.text(nomeLinhas,xNome,14);
    var yEmp=14+(nomeLinhas.length-1)*3.8+3.6;
    J.setFont("helvetica","normal");J.setFontSize(7.5);J.setTextColor.apply(J,G);
    if(emp.cnpj){J.text(T("CNPJ "+emp.cnpj),xNome,yEmp);yEmp+=3.4}
    if(emp.fantasia&&emp.fantasia!==emp.nome){J.text(T(emp.fantasia),xNome,yEmp);yEmp+=3.4}
    J.text(T(emp.email),xNome,yEmp);
    J.setFont("helvetica","bold");J.setFontSize(9.5);J.setTextColor.apply(J,P);
    J.text("ORÇAMENTO",W-M,13.5,{align:"right"});
    J.setFontSize(11);J.text(T(D.num),W-M,18.5,{align:"right"});
    J.setFont("helvetica","normal");J.setFontSize(7.5);J.setTextColor.apply(J,G);
    var emis=T("Emitido em "+D.emissao+(D.validade?" · válido até "+D.validade:""));
    var emisLinhas=J.splitTextToSize(emis,largDir);J.text(emisLinhas,W-M,23,{align:"right"});
    var yBar=Math.max(29,yEmp+4,23+(emisLinhas.length-1)*3.4+4);
    J.setFillColor.apply(J,Y);J.rect(M,yBar,W-2*M,1.4,"F");
    var c=D.c,cli=[["Nome / razão social",c.razao||c.fantasia||""],["CNPJ / CPF",doc(c.documento)||"-"]];
    if(c.fantasia&&c.fantasia!==c.razao)cli.push(["Nome fantasia",c.fantasia]);
    cli.push(["Endereço",[c.endereco,c.bairro].filter(Boolean).join(" · ")||"-"],["Cidade / UF",[cidade(c.cidade),c.uf].filter(Boolean).join(" / ")+(c.cep?" · CEP "+c.cep:"")||"-"],["Telefone",c.telefone||"-"],["E-mail",c.email||"-"]);
    if(c.contato)cli.push(["Contato",c.contato]);if(D.ref)cli.push(["Referência",D.ref]);
    J.autoTable({startY:yBar+4,margin:{left:M,right:M},theme:"plain",styles:{fontSize:8.8,cellPadding:1},columnStyles:{0:{textColor:G,cellWidth:38},1:{fontStyle:"bold",textColor:P}},body:cli.map(function(r){return[T(r[0]),T(r[1])]})});
    var y=J.lastAutoTable.finalY+5;
    var secao=function(t){if(y>262){J.addPage();y=20}J.setFont("helvetica","bold");J.setFontSize(8.5);J.setTextColor(122,93,0);J.text(T(t.toUpperCase()),M,y+2);y+=4};
    var caixa=function(rot,val,extra){if(y>262){J.addPage();y=20}J.setFillColor.apply(J,P);J.rect(W-M-90,y,90,11,"F");J.setFillColor.apply(J,Y);J.rect(W-M-90,y,1.6,11,"F");J.setFont("helvetica","bold");J.setFontSize(11);J.setTextColor(255,255,255);J.text(T(rot),W-M-86,y+7.2);J.setTextColor.apply(J,Y);J.text(T(val),W-M-3,y+7.2,{align:"right"});y+=11;if(extra){J.setFont("helvetica","normal");J.setFontSize(8.5);J.setTextColor.apply(J,G);J.text(T(extra),W-M,y+4,{align:"right"});y+=5}y+=6};
    var tabela=function(lista,cabVal){
      var head=["Item","Código","Descrição","Un.","Qtd"].concat(D.oi?[]:cabVal);
      var body=lista.map(function(i,k){var d=T(i.descricao)+(i.obs?"\n"+T(i.obs):"");var r=[String(k+1),T(i.codigo),d,T(i.unidade||"MÊS"),qtdTxt(i.qtd)];if(!D.oi)r=r.concat([T(brl(i.preco)),num(i.desc)?n2(i.desc)+"%":"-",T(brl(lnTot(i)))]);return r});
      var cs={0:{cellWidth:10},1:{cellWidth:22},3:{cellWidth:11},4:{halign:"right",cellWidth:14}};if(!D.oi){cs[5]={halign:"right",cellWidth:25};cs[6]={halign:"right",cellWidth:15};cs[7]={halign:"right",cellWidth:27}}
      J.autoTable({startY:y,margin:{left:M,right:M},head:[head],body:body,theme:"striped",headStyles:{fillColor:P,textColor:Y,fontSize:8},styles:{fontSize:8.5,cellPadding:1.6,valign:"top"},alternateRowStyles:{fillColor:[246,246,242]},columnStyles:cs,
        didParseCell:function(h){if(h.section==="head"&&h.column.index>=4)h.cell.styles.halign="right"}});
      y=J.lastAutoTable.finalY+5};
    if(D.itens.length){
      if(D.M)secao("Produtos e serviços");
      tabela(D.itens,["Valor unit.","Desc.","Total"]);
      if(!D.ot){
        if(!D.oi&&D.T.desc){J.setFont("helvetica","normal");J.setFontSize(9.5);J.setTextColor.apply(J,P);J.text("Subtotal",W-M-60,y);J.text(T(brl(D.T.sub)),W-M,y,{align:"right"});y+=5;J.text("Desconto",W-M-60,y);J.text(T("- "+brl(D.T.desc)),W-M,y,{align:"right"});y+=3}
        caixa(D.M?"TOTAL PRODUTOS E SERVIÇOS":"VALOR TOTAL",brl(D.T.total))}
    }
    if(D.M){
      secao("Serviço mensal");
      tabela(D.M.itens,["Valor mensal","Desc.","Total mensal"]);
      if(!D.ot)caixa("VALOR MENSAL",brl(D.M.total),D.M.prazo?"Contrato de "+D.M.prazo+" meses":"")}
    if(D.C&&!D.ot){
      secao("Comodato (Angela)");
      caixa("MENSALIDADE COMODATO",brl(D.C.mensalidade),D.C.meses?"Contrato de "+D.C.meses+" meses":"")}
    if(D.cond.length){J.autoTable({startY:y,margin:{left:M,right:M},theme:"plain",styles:{fontSize:8.8,cellPadding:1},columnStyles:{0:{textColor:G,cellWidth:45},1:{fontStyle:"bold",textColor:P}},body:D.cond.map(function(r){return[T(r[0]),T(r[1])]})});y=J.lastAutoTable.finalY+4}
    if(D.obs){if(y>255){J.addPage();y=20}J.setFont("helvetica","bold");J.setFontSize(8.5);J.setTextColor(122,93,0);J.text("OBSERVAÇÕES",M,y);y+=4.5;J.setFont("helvetica","normal");J.setFontSize(8.8);J.setTextColor.apply(J,P);var ls=J.splitTextToSize(T(D.obs),W-2*M);ls.forEach(function(l){if(y>280){J.addPage();y=20}J.text(l,M,y);y+=4.2})}
    var n=J.getNumberOfPages();for(var p=1;p<=n;p++){J.setPage(p);J.setDrawColor(210,210,205);J.line(M,285,W-M,285);J.setFont("helvetica","normal");J.setFontSize(7.2);J.setTextColor.apply(J,G);J.text(T(emp.nome+(emp.cnpj?" · CNPJ "+emp.cnpj:"")+(D.resp?" · Resp.: "+D.resp:"")),M,289.5);J.text(T(emp.email+" · pág. "+p+"/"+n),W-M,289.5,{align:"right"})}
    var nome=(D.num+" - "+(D.c.fantasia||D.c.razao||"cliente")).replace(/[\\/:*?"<>|]/g,"").slice(0,120)+".pdf";
    J.save(nome);toast("PDF gerado: "+nome)
  }).catch(function(e){toast("Não foi possível gerar o PDF: "+e.message,6000)}).then(function(){bt.disabled=false})}

/* ===================== INÍCIO ===================== */
$("#bt-novo").onclick=function(){S.E=novoE();S.E.base=snap(S.E);desenhar()};
var bsc=$("#bt-sync-cli");if(bsc)bsc.onclick=function(){syncOmie("clientes",bsc)};
var bsp=$("#bt-sync-prod");if(bsp)bsp.onclick=function(){syncOmie("produtos",bsp)};
function irPara(u){if(window.parent!==window)parent.postMessage({sgo:"ir",url:u},location.origin);else location.href=u}
function limparEndereco(){try{history.replaceState(null,"",location.pathname);if(window.parent!==window&&parent.location.pathname==="/comercial/orcamentos")parent.history.replaceState(null,"","/comercial/orcamentos")}catch(e){}}
function pedidoDoEndereco(){
  var P=new URLSearchParams(location.search),lt=P.get("lt"),orc=P.get("orc"),op=P.get("op");
  if(!lt&&!orc&&!op)return;limparEndereco();
  if(orc)return abrirOrc(orc);
  if(lt){var L=(S.lts||[]).find(function(x){return x.id===lt});if(L&&L.status==="convertido"&&L.orc_id)return abrirOrc(L.orc_id);return converter(lt)}
  if(op){var E=novoE();E.op={id:op,cod:P.get("cod")||""};var cli=P.get("cli")||"";S.E=E;E.base=snap(E);
    var fim=function(){S.aba="orc";desenhar();window.scrollTo(0,0)};
    if(cli.length<2)return fim();
    api("GET","/api/cadastros/busca?tipo=cliente&limite=8&q="+encodeURIComponent(cli)).then(function(d){var its=d.itens||[];var n=norm(cli).trim(),ex=its.filter(function(p){return norm(p.fantasia).trim()===n||norm(p.razao).trim()===n});if(ex.length===1)return carregarCliente(E,ex[0].id).then(function(){E.base=snap(E)});E.cliSug=its;E.cliHint=cli}).catch(function(){}).then(fim)}
}
window.addEventListener("beforeunload",function(e){if(sujo()){e.preventDefault();e.returnValue=""}});
var VER=location.pathname.match(/^\/orcamento\/ver\/([A-Za-z0-9_-]{3,40})$/);
if(VER){
  document.title="Orçamento · SGO Âncora";$(".topo").hidden=true;$("#pag").innerHTML='<div class="vazio">Carregando o orçamento…</div>';
  api("GET","/api/orcamento-ver/"+VER[1]).then(function(d){var E=edDe(d.item);document.title=E.num+" · "+((E.cli&&(E.cli.fantasia||E.cli.razao))||"")+" · Orçamento";$("#pag").innerHTML="";documento(E,true,true)})
  .catch(function(e){$("#pag").innerHTML='<div class="card vazio erro">Não foi possível abrir o orçamento: '+esc(e.message)+"</div>"});
}else carregar().then(pedidoDoEndereco);
})();

