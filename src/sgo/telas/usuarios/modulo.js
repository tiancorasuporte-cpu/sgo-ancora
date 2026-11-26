/* Módulo Usuários do SGO (código original). Executado pela casca: src/sgo/components/SgoShell.tsx */
(function () {
  "use strict";
  ((window.SGO_TELAS = window.SGO_TELAS || {}),
    (window.SGO_TELAS.usuarios = function (y, w) {
      var A = w.api,
        o = w.esc,
        j = w.eu,
        f = null,
        m = { q: "", setor: "", situacao: "ativos", pagina: 1, porPagina: 20 };
      function C(e) {
        if (!e) return "Nunca entrou";
        var i = new Date(e),
          s = function (l) {
            return (l < 10 ? "0" : "") + l;
          };
        return (
          s(i.getDate()) +
          "/" +
          s(i.getMonth() + 1) +
          "/" +
          i.getFullYear() +
          " " +
          s(i.getHours()) +
          ":" +
          s(i.getMinutes())
        );
      }
      function N(e) {
        var i = f.setores.find(function (s) {
          return s.id === e;
        });
        return i ? i.nome : "\u2014";
      }
      function M(e) {
        return e.perfil === "superadmin" || e.perfil === "administrador";
      }
      function G(e) {
        return e.ativo
          ? e.bloqueado_ate > Date.now()
            ? { t: "Bloqueado (senha errada)", c: "st-bloq" }
            : { t: "Ativo", c: "st-on" }
          : { t: "Desativado", c: "st-off" };
      }
      function L() {
        return f.itens.filter(function (e) {
          return e.id !== "usuarios";
        });
      }
      function U(e) {
        if (e.perfil === "tecnico")
          return "App do T\xE9cnico" + (e.equipe ? " \xB7 " + e.equipe : "");
        if (M(e)) return "Tudo";
        var i = e.permissoes.length,
          s = L().length;
        return i ? i + " de " + s + " itens" : "Nenhum";
      }
      function P() {
        return A("GET", "/api/usuarios")
          .then(function (e) {
            ((f = e), E());
          })
          .catch(function (e) {
            y.innerHTML =
              '<div class="erro">N\xE3o foi poss\xEDvel carregar os usu\xE1rios: ' +
              o(e.message) +
              "</div>";
          });
      }
      function E() {
        var e = m.q.trim().toLowerCase(),
          i = f.usuarios.filter(function (a) {
            return (m.situacao === "ativos" && !a.ativo) ||
              (m.situacao === "desativados" && a.ativo) ||
              (m.setor &&
                !(
                  a.setor_id === m.setor ||
                  (a.setores_ids && a.setores_ids.indexOf(m.setor) >= 0)
                ))
              ? !1
              : !e ||
                  (a.nome + " " + a.login + " " + (a.email || "")).toLowerCase().indexOf(e) >= 0;
          }),
          s = f.usuarios.filter(function (a) {
            return a.ativo;
          }).length,
          PP = m.porPagina || 20,
          TP = Math.max(1, Math.ceil(i.length / PP));
        m.pagina = Math.min(Math.max(1, m.pagina || 1), TP);
        var ini = (m.pagina - 1) * PP,
          pag = i.slice(ini, ini + PP),
          l =
            '<section class="usr"><div class="usr-barra"><div class="usr-filtros"><label class="vh" for="u-q">Buscar usu\xe1rio</label><input id="u-q" class="field" type="search" placeholder="Buscar por nome, usu\xe1rio ou e-mail" value="' +
            o(m.q) +
            '"><label class="vh" for="u-setor">Setor</label><select id="u-setor" class="field"><option value="">Todos os setores</option>' +
            f.setores
              .map(function (a) {
                return (
                  '<option value="' +
                  o(a.id) +
                  '"' +
                  (m.setor === a.id ? " selected" : "") +
                  ">" +
                  o(a.nome) +
                  "</option>"
                );
              })
              .join("") +
            '</select><div class="seg-app" role="group" aria-label="Situa\xe7\xe3o">' +
            [
              ["ativos", "Ativos"],
              ["desativados", "Desativados"],
              ["todos", "Todos"],
            ]
              .map(function (a) {
                return (
                  '<button type="button" data-sit="' +
                  a[0] +
                  '" aria-pressed="' +
                  (m.situacao === a[0]) +
                  '" class="' +
                  (m.situacao === a[0] ? "on" : "") +
                  '">' +
                  a[1] +
                  "</button>"
                );
              })
              .join("") +
            '</div></div><div class="usr-botoes"><button type="button" class="btn-ghost" id="u-aux" style="min-height:44px">Auxiliares (' +
            f.auxiliares.filter(function (a) {
              return a.ativo;
            }).length +
            ')</button><button type="button" class="btn-adv" id="u-novo" style="min-height:44px"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Novo usu\xe1rio</button></div></div><p class="usr-resumo">' +
            s +
            (s === 1 ? " usu\xe1rio ativo" : " usu\xe1rios ativos") +
            " \xb7 " +
            i.length +
            (i.length ? " \xb7 p\xe1g. " + m.pagina + "/" + TP : "") +
            '</p><div class="usr-tabela"><table class="tbl-usr"><thead><tr><th scope="col">Nome</th><th scope="col">Setor</th><th scope="col">Perfil</th><th scope="col">Acessos</th><th scope="col">Situa\xe7\xe3o</th><th scope="col">\xdaltimo acesso</th><th scope="col"><span class="vh">A\xe7\xf5es</span></th></tr></thead><tbody>' +
            (pag.length
              ? pag
                  .map(function (a) {
                    var n = G(a),
                      podeApagar = a.perfil !== "superadmin" && a.id !== j.id;
                    return (
                      '<tr><td><div class="u-nome">' +
                      o(a.nome) +
                      '</div><div class="u-login">' +
                      o(a.login) +
                      (a.email ? " \xb7 " + o(a.email) : "") +
                      "</div></td><td>" +
                      o(
                        (
                          (a.setores_ids && a.setores_ids.length
                            ? a.setores_ids
                            : a.setor_id
                              ? [a.setor_id]
                              : []
                          )
                            .map(N)
                            .join(", ") || "\u2014"
                        ),
                      ) +
                      '</td><td><span class="pf pf-' +
                      o(a.perfil) +
                      '">' +
                      o(f.perfis[a.perfil] || a.perfil) +
                      "</span>" +
                      (a.vendedor
                        ? ' <span class="pf" style="background:#FFD200;color:#141414">Vendedor</span>'
                        : "") +
                      (a.comprador
                        ? ' <span class="pf" style="background:#c8e6c9;color:#1b5e20">Comprador</span>'
                        : "") +
                      "</td><td>" +
                      o(U(a)) +
                      '</td><td><span class="st ' +
                      n.c +
                      '">' +
                      o(n.t) +
                      '</span></td><td class="u-data">' +
                      o(C(a.ultimo_acesso)) +
                      '</td><td><div class="usr-menu"><button type="button" class="btn-ghost sm usr-menu-btn" data-menu="' +
                      a.id +
                      '" aria-label="A\xe7\xf5es de ' +
                      o(a.nome) +
                      '" aria-haspopup="menu" aria-expanded="false"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button><div class="usr-menu-drop" role="menu" hidden><button type="button" role="menuitem" data-editar="' +
                      a.id +
                      '">Editar</button>' +
                      (a.perfil !== "superadmin"
                        ? '<button type="button" role="menuitem" data-ativo="' +
                          a.id +
                          '">' +
                          (a.ativo ? "Desativar" : "Reativar") +
                          "</button>"
                        : "") +
                      (podeApagar
                        ? '<button type="button" role="menuitem" class="danger" data-apagar="' +
                          a.id +
                          '">Apagar</button>'
                        : "") +
                      "</div></div></td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="7" class="u-vazio">Nenhum usu\xe1rio encontrado com esses filtros.</td></tr>') +
            "</tbody></table></div>" +
            (i.length
              ? '<div class="usr-pag"><span class="usr-pag-info">Mostrando ' +
                (ini + 1) +
                "\u2013" +
                Math.min(ini + PP, i.length) +
                " de " +
                i.length +
                '</span><div class="usr-pag-btns"><button type="button" class="btn-ghost sm" id="u-prev"' +
                (m.pagina <= 1 ? " disabled" : "") +
                '>Anterior</button><button type="button" class="btn-ghost sm" id="u-next"' +
                (m.pagina >= TP ? " disabled" : "") +
                ">Pr\xf3xima</button></div></div>"
              : "") +
            "</section>";
        y.innerHTML = l;
        var d = y.querySelector("#u-q");
        (d.addEventListener("input", function () {
          m.q = d.value;
          m.pagina = 1;
          var a = d.selectionStart,
            shell = document.getElementById("g-busca"),
            fromShell = !!(shell && document.activeElement === shell);
          E();
          if (fromShell) {
            shell.focus();
          } else {
            var n = y.querySelector("#u-q");
            if (n) {
              n.focus();
              n.setSelectionRange(a, a);
            }
          }
        }),
          y.querySelector("#u-setor").addEventListener("change", function (a) {
            ((m.setor = a.target.value), (m.pagina = 1), E());
          }),
          y.querySelectorAll("[data-sit]").forEach(function (a) {
            a.addEventListener("click", function () {
              ((m.situacao = a.getAttribute("data-sit")), (m.pagina = 1), E());
            });
          }),
          y.querySelector("#u-novo").addEventListener("click", function () {
            _(null);
          }),
          y.querySelector("#u-aux").addEventListener("click", H),
          y.querySelectorAll("[data-menu]").forEach(function (a) {
            a.addEventListener("click", function (ev) {
              ev.stopPropagation();
              var drop = a.parentElement.querySelector(".usr-menu-drop"),
                open = drop && !drop.hidden;
              y.querySelectorAll(".usr-menu-drop").forEach(function (d) {
                d.hidden = !0;
                d.classList.remove("usr-menu-drop-open");
                d.style.top = "";
                d.style.left = "";
                d.style.right = "";
              });
              y.querySelectorAll("[data-menu]").forEach(function (b) {
                b.setAttribute("aria-expanded", "false");
              });
              if (drop && !open) {
                drop.hidden = !1;
                drop.classList.add("usr-menu-drop-open");
                a.setAttribute("aria-expanded", "true");
                var r = a.getBoundingClientRect(),
                  w = Math.max(148, drop.offsetWidth),
                  left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w)),
                  top = r.bottom + 4;
                if (top + drop.offsetHeight > window.innerHeight - 8)
                  top = Math.max(8, r.top - drop.offsetHeight - 4);
                drop.style.left = left + "px";
                drop.style.top = top + "px";
                drop.style.right = "auto";
              }
            });
          }));
        if (!window.__sgoUsrMenuDoc) {
          window.__sgoUsrMenuDoc = 1;
          document.addEventListener("click", function () {
            document.querySelectorAll(".usr-menu-drop").forEach(function (d) {
              d.hidden = !0;
              d.classList.remove("usr-menu-drop-open");
              d.style.top = "";
              d.style.left = "";
              d.style.right = "";
            });
            document.querySelectorAll("[data-menu]").forEach(function (b) {
              b.setAttribute("aria-expanded", "false");
            });
          });
        }
        y.querySelectorAll("[data-editar]").forEach(function (a) {
          a.addEventListener("click", function () {
            _(
              f.usuarios.find(function (n) {
                return n.id === +a.getAttribute("data-editar");
              }),
            );
          });
        });
        var prev = y.querySelector("#u-prev"),
          next = y.querySelector("#u-next");
        (prev &&
          prev.addEventListener("click", function () {
            ((m.pagina = Math.max(1, m.pagina - 1)), E());
          }),
          next &&
            next.addEventListener("click", function () {
              ((m.pagina = m.pagina + 1), E());
            }),
          y.querySelectorAll("[data-ativo]").forEach(function (a) {
            a.addEventListener("click", function () {
              var id = +a.getAttribute("data-ativo"),
                u = f.usuarios.find(function (n) {
                  return n.id === id;
                });
              if (!u) return;
              if (u.id === j.id && u.ativo)
                return window.SGO_APP.avisar(
                  "Voc\xea n\xe3o pode desativar o seu pr\xf3prio usu\xe1rio.",
                );
              var msg = u.ativo
                ? "Desativar " + u.nome + "? A pessoa n\xe3o consegue mais entrar."
                : "Reativar " + u.nome + "?";
              if (!confirm(msg)) return;
              ((a.disabled = !0),
                A("PUT", "/api/usuarios/" + id, {
                  nome: u.nome,
                  login: u.login,
                  email: u.email || "",
                  setor_id: u.setor_id || "",
                  perfil: u.perfil,
                  equipe: u.equipe || "",
                  ativo: !u.ativo,
                  vendedor: !!u.vendedor,
                  comprador: !!u.comprador,
                  permissoes: u.permissoes || [],
                  veiculos_ids: u.veiculos_ids || [],
                })
                  .then(function () {
                    return (
                      window.SGO_APP.avisar(
                        u.ativo ? "Usu\xe1rio desativado." : "Usu\xe1rio reativado.",
                      ),
                      P()
                    );
                  })
                  .catch(function (err) {
                    ((a.disabled = !1),
                      window.SGO_APP.avisar(err.message || "Falha ao alterar situa\xe7\xe3o."));
                  }));
            });
          }),
          y.querySelectorAll("[data-apagar]").forEach(function (a) {
            a.addEventListener("click", function () {
              var id = +a.getAttribute("data-apagar"),
                u = f.usuarios.find(function (n) {
                  return n.id === id;
                });
              if (!u) return;
              if (
                !confirm(
                  "Apagar definitivamente " +
                    u.nome +
                    " (" +
                    u.login +
                    ")? Esta a\xe7\xe3o n\xe3o tem volta.",
                )
              )
                return;
              ((a.disabled = !0),
                A("DELETE", "/api/usuarios/" + id)
                  .then(function () {
                    return (window.SGO_APP.avisar("Usu\xe1rio apagado."), P());
                  })
                  .catch(function (err) {
                    ((a.disabled = !1), window.SGO_APP.avisar(err.message || "Falha ao apagar."));
                  }));
            });
          }));
      }
      function z() {
        var e = [],
          i = {};
        return (
          L().forEach(function (s) {
            if (!s.pai) {
              var l = s.grupo || "Geral";
              (i[l] || ((i[l] = { nome: l, itens: [] }), e.push(i[l])),
                i[l].itens.push({
                  item: s,
                  filhos: L().filter(function (d) {
                    return d.pai === s.id;
                  }),
                }));
            }
          }),
          e
        );
      }
      function osTrHtml(e) {
        var L = [
            "Aberta",
            "Separa\xe7\xe3o",
            "Compras",
            "Agendar",
            "Agendado",
            "Execu\xe7\xe3o",
            "Executado",
            "Finalizado",
          ],
          pares = [
            [0, 1],
            [1, 2],
            [2, 1],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6],
            [6, 7],
            [5, 1],
          ];
        return pares
          .map(function (par) {
            var on = (e && e.os_transicoes ? e.os_transicoes : []).some(function (t) {
              return +t.de === par[0] && +t.para === par[1];
            });
            return (
              '<label class="ue-item"><input type="checkbox" data-os-tr="' +
              par[0] +
              "-" +
              par[1] +
              '"' +
              (on ? " checked" : "") +
              "> " +
              L[par[0]] +
              " \u2192 " +
              L[par[1]] +
              (par[0] === 6 && par[1] === 7 ? " (conferir)" : "") +
              "</label>"
            );
          })
          .join("");
      }
      function _(e) {
        var i = !e,
          s = e && e.perfil === "superadmin",
          l = !(s && j.perfil !== "superadmin"),
          d = {},
          dN = {};
        (
          e && e.permissoes_detalhe && e.permissoes_detalhe.length
            ? e.permissoes_detalhe
            : (e ? e.permissoes : []).map(function (t) {
                return { id: t, nivel: "usar" };
              })
        ).forEach(function (t) {
          var id = typeof t === "string" ? t : t.id;
          d[id] = !0;
          dN[id] = t && t.nivel === "ver" ? "ver" : "usar";
        });
        var a = f.usuarios.filter(function (t) {
            return (!e || t.id !== e.id) && t.perfil === "usuario";
          }),
          n = document.createElement("div");
        n.className = "modal-fundo";
        var g = e ? e.perfil : "usuario";
        ((n.innerHTML =
          '<form class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="ue-t" novalidate><div class="modal-topo"><div><span class="modal-kicker">' +
          (i ? "Novo cadastro" : "Editar usu\xE1rio") +
          '</span><h2 id="ue-t">' +
          (i ? "Novo usu\xE1rio" : o(e.nome)) +
          '</h2></div><button type="button" class="x-btn" data-fechar aria-label="Fechar">\xD7</button></div><div class="modal-corpo ue-grid"><div class="ue-col"><div class="erro-form" role="alert" hidden></div><h3 class="ue-sec">Dados de acesso</h3><label class="flabel" for="ue-nome">Nome completo</label><input id="ue-nome" class="field" maxlength="80" value="' +
          o(e ? e.nome : "") +
          '"><label class="flabel" for="ue-login">Usu\xE1rio (para entrar)</label><input id="ue-login" class="field" maxlength="40" autocapitalize="none" spellcheck="false" value="' +
          o(e ? e.login : "") +
          '"' +
          (s ? " readonly" : "") +
          '><span class="dica">Ex.: joao.silva \u2014 sem acento e sem espa\xE7o.</span><label class="flabel" for="ue-email">E-mail (opcional)</label><input id="ue-email" class="field" type="email" maxlength="120" value="' +
          o(e && e.email ? e.email : "") +
          '"><span class="flabel">Setores</span><div class="ue-setores">' +
          f.setores
            .map(function (t) {
              var on =
                (e && (e.setores_ids || []).indexOf(t.id) >= 0) ||
                (e && e.setor_id === t.id);
              return (
                '<label class="ue-item"><input type="checkbox" data-setor="' +
                o(t.id) +
                '"' +
                (on ? " checked" : "") +
                "> " +
                o(t.nome) +
                "</label>"
              );
            })
            .join("") +
          '</div><label class="flabel" for="ue-setor">Setor principal</label><select id="ue-setor" class="field"><option value="">Sem setor</option>' +
          f.setores
            .map(function (t) {
              return (
                '<option value="' +
                o(t.id) +
                '"' +
                (e && e.setor_id === t.id ? " selected" : "") +
                ">" +
                o(t.nome) +
                "</option>"
              );
            })
            .join("") +
          '</select><span class="dica">Os setores liberam o papel no Quadro de OS (Assist\xeancia / Estoque / Compras).</span>' +
          (s
            ? '<div class="ue-info">Super Admin: acesso total, n\xE3o pode ser desativado.</div>'
            : '<span class="flabel">Perfil</span><div class="ue-perfis" role="radiogroup" aria-label="Perfil">' +
              [
                ["usuario", "Usu\xE1rio", "Acessa s\xF3 o que for liberado ao lado"],
                ["administrador", "Administrador", "Acessa tudo e cadastra usu\xE1rios"],
                ["tecnico", "T\xE9cnico", "Usa o App do T\xE9cnico em campo"],
              ]
                .map(function (t) {
                  return (
                    '<label class="ue-perfil"><input type="radio" name="ue-perfil" value="' +
                    t[0] +
                    '"' +
                    (g === t[0] ? " checked" : "") +
                    "><span><b>" +
                    t[1] +
                    "</b><small>" +
                    t[2] +
                    "</small></span></label>"
                  );
                })
                .join("") +
              '</div><div class="ue-equipe" hidden><label class="flabel" for="ue-equipe">Nome da equipe</label><input id="ue-equipe" class="field" maxlength="40" placeholder="Equipe ' +
              o(e ? e.nome.split(" ")[0] : "Alex") +
              '" value="' +
              o(e && e.equipe ? e.equipe : "") +
              '"><span class="dica">\xC9 como a equipe aparece nas OS e na agenda. Em branco, fica "Equipe" + o primeiro nome. O auxiliar \xE9 escolhido em cada OS.</span></div><label class="ue-ativo"><input type="checkbox" id="ue-ativo"' +
              (!e || e.ativo ? " checked" : "") +
              "> Usu\xE1rio ativo (pode entrar no sistema)</label>") +
          (e && e.bloqueado_ate > Date.now()
            ? '<label class="ue-ativo"><input type="checkbox" id="ue-desbloq" checked> Desbloquear agora (est\xE1 bloqueado por senha errada)</label>'
            : "") +
          '<label class="ue-ativo"><input type="checkbox" id="ue-vend"' +
          (e && e.vendedor ? " checked" : "") +
          '> <b>Vendedor</b>&nbsp;— aparece no CRM e nos relatórios comerciais (vale para qualquer perfil)</label><label class="ue-ativo"><input type="checkbox" id="ue-comp"' +
          (e && e.comprador ? " checked" : "") +
          '> <b>Comprador</b>&nbsp;— libera Compras e cotações (vale para qualquer perfil)</label><h3 class="ue-sec">' +
          (i ? "Senha inicial" : "Redefinir senha") +
          "</h3>" +
          (i
            ? ""
            : '<span class="dica" style="margin-top:-4px">Deixe em branco para manter a senha atual.</span>') +
          '<label class="flabel" for="ue-senha">' +
          (i ? "Senha" : "Nova senha") +
          '</label><input id="ue-senha" class="field" type="password" autocomplete="new-password"><label class="flabel" for="ue-senha2">Repita a senha</label><input id="ue-senha2" class="field" type="password" autocomplete="new-password"><span class="dica">M\xEDnimo de 8 caracteres, com letras e n\xFAmeros. Passe a senha \xE0 pessoa: ela pode trocar depois em "Trocar minha senha".</span></div><div class="ue-col ue-tec" hidden><h3 class="ue-sec" style="margin:0">App do T\xE9cnico</h3><p class="ue-tec-txt">Com o perfil T\xE9cnico, o login e a senha acima entram direto no <b>App do T\xE9cnico</b> (celular Android). O restante do sistema fica fechado para ele.</p><ul class="ue-tec-lista">' +
          [
            "Ver as OS enviadas para a equipe",
            "Conferir o material e dar OK ou apontar diverg\xEAncia",
            "Fazer check-in ao chegar e check-out ao sair",
            "Tirar fotos do atendimento e descrever a resolu\xE7\xE3o",
            "Pedir material extra e registrar o que voltou",
            "Aceitar ou contestar a confer\xEAncia do estoque",
            "Trabalhar sem sinal: tudo \xE9 enviado quando a internet voltar",
          ]
            .map(function (t) {
              return (
                '<li><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"></path></svg>' +
                t +
                "</li>"
              );
            })
            .join("") +
          '</ul><p class="ue-tec-txt" style="margin-top:0">Depois de entrar uma vez, o t\xE9cnico <b>fica conectado no celular at\xE9 tocar em Sair</b>. Para tirar o acesso dele, desative o usu\xE1rio ou troque a senha aqui.</p><p class="dica">Endere\xE7o do app: <b>sgo.ancoraseguranca.app/app</b> \u2014 o t\xE9cnico entra pelo navegador do celular e toca em "Instalar".</p><h3 class="ue-sec" style="margin-top:18px">Veículos da frota</h3><p class="ue-tec-txt" style="margin-top:0">Vincule um ou mais veículos que este técnico usa no app e na frota.</p><div class="ue-veic-lista">' +
          (f.veiculos && f.veiculos.length
            ? f.veiculos
                .map(function (t) {
                  var on = ((e && e.veiculos_ids) || []).indexOf(t.id) >= 0;
                  return (
                    '<label class="ue-item"><input type="checkbox" data-veic="' +
                    t.id +
                    '"' +
                    (on ? " checked" : "") +
                    "> " +
                    o(t.nome) +
                    (t.placa ? " · " + o(t.placa) : "") +
                    "</label>"
                  );
                })
                .join("")
            : '<p class="dica" style="margin:0 0 8px">Nenhum veículo ativo na Frota ainda — por isso não há o que marcar aqui.</p><a class="lnk-btn" href="/frota" target="_blank" rel="noopener">Abrir Frota e cadastrar veículo</a>') +
          '</div></div><div class="ue-col ue-acessos"><div class="ue-acessos-topo"><h3 class="ue-sec" style="margin:0">O que pode acessar</h3><div class="ue-acoes-mini"><button type="button" class="lnk-btn" data-tudo>Marcar tudo</button><button type="button" class="lnk-btn" data-nada>Limpar</button></div></div>' +
          (a.length
            ? '<div class="ue-copiar"><label class="flabel" for="ue-copiar">Copiar acessos de</label><select id="ue-copiar" class="field"><option value="">Escolha um usu\xE1rio\u2026</option>' +
              a
                .map(function (t) {
                  return (
                    '<option value="' +
                    t.id +
                    '">' +
                    o(t.nome) +
                    (t.setor_id ? " \xB7 " + o(N(t.setor_id)) : "") +
                    "</option>"
                  );
                })
                .join("") +
              "</select></div>"
            : "") +
          '<div class="ue-aviso-total" hidden>Administrador acessa todos os itens do menu e o cadastro de usu\xE1rios.</div><div class="ue-arvore">' +
          z()
            .map(function (t) {
              var r =
                '<div class="ue-grupo"><div class="ue-grupo-topo"><label><input type="checkbox" data-grupo="' +
                o(t.nome) +
                '"> ' +
                o(t.nome) +
                "</label></div>";
              return (
                t.itens.forEach(function (p) {
                  ((r +=
                    '<div class="ue-item-row"><label class="ue-item"><input type="checkbox" data-item="' +
                    o(p.item.id) +
                    '" data-g="' +
                    o(t.nome) +
                    '"> ' +
                    o(p.item.titulo) +
                    '</label><select class="field ue-nivel" data-nivel-item="' +
                    o(p.item.id) +
                    '" title="N\xedvel de acesso"><option value="usar">Usar</option><option value="ver">Ver</option></select></div>'),
                    p.filhos.forEach(function (v) {
                      r +=
                        '<div class="ue-item-row ue-sub-row"><label class="ue-item ue-sub"><input type="checkbox" data-item="' +
                        o(v.id) +
                        '" data-g="' +
                        o(t.nome) +
                        '" data-pai="' +
                        o(p.item.id) +
                        '"> ' +
                        o(v.titulo) +
                        '</label><select class="field ue-nivel" data-nivel-item="' +
                        o(v.id) +
                        '" title="N\xedvel de acesso"><option value="usar">Usar</option><option value="ver">Ver</option></select></div>';
                    }));
                }),
                r + "</div>"
              );
            })
            .join("") +
          '</div></div><div class="ue-col ue-os" style="grid-column:1/-1"><h3 class="ue-sec">Quadro de OS \xb7 movimenta\xe7\xe3o</h3><p class="dica" style="margin-top:0">Complementa o setor: s\xf3 move se o setor permitir <b>e</b> a seta estiver marcada. Vazio = s\xf3 regra do setor. Estoque tamb\xe9m confere (6\u21927).</p><div class="ue-os-grid">' +
          osTrHtml(e) +
          '</div></div></div><div class="modal-acoes"><button type="button" class="btn-ghost" data-fechar>Cancelar</button>' +
          (l
            ? '<button type="submit" class="btn-adv">' +
              (i ? "Criar usu\xE1rio" : "Salvar altera\xE7\xF5es") +
              "</button>"
            : "") +
          "</div></form>"),
          document.body.appendChild(n));
        var u = n.querySelector("form"),
          h = n.querySelector(".erro-form"),
          k = function () {
            return Array.prototype.slice.call(u.querySelectorAll("[data-item]"));
          };
        function T() {
          if (s) return "superadmin";
          var t = u.querySelector("input[name=ue-perfil]:checked");
          return t ? t.value : "usuario";
        }
        function q() {
          var t = T() === "tecnico",
            r = u.querySelector("#ue-equipe");
          (r &&
            (r.placeholder =
              "Equipe " + (u.querySelector("#ue-nome").value.trim().split(/\s+/)[0] || "Alex")),
            (u.querySelector(".ue-tec").hidden = !t),
            (u.querySelector(".ue-acessos").hidden = t));
          var p = u.querySelector(".ue-equipe");
          p && (p.hidden = !0);
          var v = T() !== "usuario";
          ((u.querySelector(".ue-aviso-total").hidden = !v),
            k().forEach(function (c) {
              ((c.checked = v || !!d[c.getAttribute("data-item")]), (c.disabled = v || !l));
            }),
            u.querySelectorAll("[data-grupo]").forEach(function (c) {
              var S = k().filter(function (b) {
                  return b.getAttribute("data-g") === c.getAttribute("data-grupo");
                }),
                x = S.filter(function (b) {
                  return b.checked;
                }).length;
              ((c.checked = x === S.length && x > 0),
                (c.indeterminate = x > 0 && x < S.length),
                (c.disabled = v || !l));
            }),
            u.querySelectorAll("[data-tudo],[data-nada],#ue-copiar").forEach(function (c) {
              c.disabled = v || !l;
            }),
            u.querySelectorAll("[data-nivel-item]").forEach(function (sel) {
              var id = sel.getAttribute("data-nivel-item");
              sel.value = dN[id] || "usar";
              sel.disabled = v || !l || !d[id];
              sel.hidden = !d[id];
            }));
        }
        (u.addEventListener("change", function (t) {
          var r = t.target;
          if (r.name === "ue-perfil") {
            q();
            return;
          }
          if (r.hasAttribute("data-item")) {
            var p = r.getAttribute("data-item");
            d[p] = r.checked;
            if (r.checked) {
              dN[p] = dN[p] || "usar";
              if (r.hasAttribute("data-pai")) {
                d[r.getAttribute("data-pai")] = !0;
                dN[r.getAttribute("data-pai")] = dN[r.getAttribute("data-pai")] || "usar";
              }
            } else {
              delete dN[p];
              k().forEach(function (c) {
                if (c.getAttribute("data-pai") === p) {
                  d[c.getAttribute("data-item")] = !1;
                  delete dN[c.getAttribute("data-item")];
                }
              });
            }
            q();
          } else if (r.hasAttribute("data-nivel-item")) {
            dN[r.getAttribute("data-nivel-item")] = r.value === "ver" ? "ver" : "usar";
          } else if (r.hasAttribute("data-grupo"))
            (k().forEach(function (c) {
              c.getAttribute("data-g") === r.getAttribute("data-grupo") &&
                (d[c.getAttribute("data-item")] = r.checked);
            }),
              q());
          else if (r.id === "ue-copiar" && r.value) {
            var v = f.usuarios.find(function (c) {
              return c.id === +r.value;
            });
            d = {};
            dN = {};
            (
              v.permissoes_detalhe && v.permissoes_detalhe.length
                ? v.permissoes_detalhe
                : v.permissoes.map(function (c) {
                    return { id: c, nivel: "usar" };
                  })
            ).forEach(function (c) {
              var id = typeof c === "string" ? c : c.id;
              d[id] = !0;
              dN[id] = c && c.nivel === "ver" ? "ver" : "usar";
            });
            q();
          }
        }),
          u.querySelector("[data-tudo]").addEventListener("click", function () {
            (k().forEach(function (t) {
              var id = t.getAttribute("data-item");
              d[id] = !0;
              dN[id] = dN[id] || "usar";
            }),
              q());
          }),
          u.querySelector("[data-nada]").addEventListener("click", function () {
            ((d = {}), (dN = {}), q());
          }),
          q());
        function O() {
          n.remove();
        }
        (u.querySelector("#ue-nome").addEventListener("input", q),
          n.addEventListener("click", function (t) {
            (t.target === n || t.target.hasAttribute("data-fechar")) && O();
          }),
          n.addEventListener("keydown", function (t) {
            t.key === "Escape" && O();
          }),
          u.addEventListener("submit", function (t) {
            t.preventDefault();
            var r = function (b) {
                var D = u.querySelector("#" + b);
                return D ? D.value : "";
              },
              p = function (b) {
                ((h.textContent = b), (h.hidden = !1), h.scrollIntoView({ block: "nearest" }));
              };
            if (!r("ue-nome").trim()) return p("Informe o nome.");
            if (!r("ue-login").trim()) return p("Informe o usu\xE1rio de acesso.");
            if (i && !r("ue-senha")) return p("Defina a senha inicial.");
            if (r("ue-senha") !== r("ue-senha2")) return p("As duas senhas n\xE3o conferem.");
            var v = u.querySelector("#ue-ativo"),
              c = u.querySelector("#ue-desbloq"),
              setoresIds = Array.prototype.slice
                .call(u.querySelectorAll("[data-setor]:checked"))
                .map(function (b) {
                  return b.getAttribute("data-setor");
                }),
              S = {
                nome: r("ue-nome"),
                login: r("ue-login"),
                email: r("ue-email"),
                setor_id: r("ue-setor"),
                setores_ids: setoresIds,
                perfil: T(),
                equipe: r("ue-equipe"),
                ativo: v ? v.checked : !0,
                senha: r("ue-senha"),
                desbloquear: !!(c && c.checked),
                vendedor: !!(u.querySelector("#ue-vend") && u.querySelector("#ue-vend").checked),
                comprador: !!(u.querySelector("#ue-comp") && u.querySelector("#ue-comp").checked),
                veiculos_ids: Array.prototype.slice
                  .call(u.querySelectorAll("[data-veic]:checked"))
                  .map(function (b) {
                    return +b.getAttribute("data-veic");
                  }),
                permissoes_detalhe: Object.keys(d)
                  .filter(function (b) {
                    return d[b];
                  })
                  .map(function (b) {
                    return { id: b, nivel: dN[b] || "usar" };
                  }),
                os_transicoes: Array.prototype.slice
                  .call(u.querySelectorAll("[data-os-tr]:checked"))
                  .map(function (b) {
                    var parts = String(b.getAttribute("data-os-tr")).split("-");
                    return { de: +parts[0], para: +parts[1] };
                  }),
              },
              x = u.querySelector("button[type=submit]");
            ((x.disabled = !0),
              A(i ? "POST" : "PUT", "/api/usuarios" + (i ? "" : "/" + e.id), S)
                .then(function () {
                  return (
                    O(),
                    window.SGO_APP.avisar(
                      i ? "Usu\xE1rio " + S.login + " criado." : "Altera\xE7\xF5es salvas.",
                    ),
                    P()
                  );
                })
                .catch(function (b) {
                  ((x.disabled = !1), p(b.message));
                }));
          }),
          u.querySelector("#ue-nome").focus());
      }
      function H() {
        var e = document.createElement("div");
        e.className = "modal-fundo";
        function i(l) {
          var d = f.auxiliares;
          e.innerHTML =
            '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ax-t"><div class="modal-topo"><div><span class="modal-kicker">Acompanham o t\xE9cnico na OS</span><h2 id="ax-t">Auxiliares</h2></div><button type="button" class="x-btn" data-fechar aria-label="Fechar">\xD7</button></div><div class="modal-corpo"><p class="dica" style="margin:0 0 12px">O auxiliar n\xE3o entra no sistema nem no app. Ele \xE9 escolhido na OS, junto com o t\xE9cnico respons\xE1vel.</p><form class="ax-novo" novalidate><label class="vh" for="ax-nome">Nome do novo auxiliar</label><input id="ax-nome" class="field" maxlength="80" placeholder="Nome do auxiliar"><button type="submit" class="btn-adv" style="min-height:44px">Adicionar</button></form>' +
            (l ? '<div class="erro-form" role="alert">' + o(l) + "</div>" : "") +
            '<ul class="ax-lista">' +
            (d.length
              ? d
                  .map(function (n) {
                    return (
                      '<li class="' +
                      (n.ativo ? "" : "ax-off") +
                      '"><input class="field" data-ax-nome="' +
                      n.id +
                      '" value="' +
                      o(n.nome) +
                      '" aria-label="Nome do auxiliar"><button type="button" class="btn-ghost sm" data-ax-salvar="' +
                      n.id +
                      '">Salvar</button><button type="button" class="btn-ghost sm" data-ax-ativo="' +
                      n.id +
                      '">' +
                      (n.ativo ? "Desativar" : "Reativar") +
                      "</button></li>"
                    );
                  })
                  .join("")
              : '<li class="u-vazio">Nenhum auxiliar cadastrado.</li>') +
            '</ul></div><div class="modal-acoes"><button type="button" class="btn-ghost" data-fechar>Fechar</button></div></div>';
          var a = e.querySelector("#ax-nome");
          (a.focus(),
            e.querySelector(".ax-novo").addEventListener("submit", function (n) {
              if ((n.preventDefault(), !a.value.trim())) return i("Informe o nome do auxiliar.");
              A("POST", "/api/auxiliares", { nome: a.value })
                .then(s)
                .catch(function (g) {
                  i(g.message);
                });
            }),
            e.querySelectorAll("[data-ax-salvar]").forEach(function (n) {
              n.addEventListener("click", function () {
                var g = +n.getAttribute("data-ax-salvar"),
                  u = f.auxiliares.find(function (h) {
                    return h.id === g;
                  });
                A("PUT", "/api/auxiliares/" + g, {
                  nome: e.querySelector('[data-ax-nome="' + g + '"]').value,
                  ativo: u.ativo,
                })
                  .then(function () {
                    return (window.SGO_APP.avisar("Auxiliar salvo."), s());
                  })
                  .catch(function (h) {
                    i(h.message);
                  });
              });
            }),
            e.querySelectorAll("[data-ax-ativo]").forEach(function (n) {
              n.addEventListener("click", function () {
                var g = +n.getAttribute("data-ax-ativo"),
                  u = f.auxiliares.find(function (h) {
                    return h.id === g;
                  });
                A("PUT", "/api/auxiliares/" + g, { nome: u.nome, ativo: !u.ativo })
                  .then(s)
                  .catch(function (h) {
                    i(h.message);
                  });
              });
            }));
        }
        function s() {
          return A("GET", "/api/auxiliares").then(function (l) {
            ((f.auxiliares = l.auxiliares), i(), E());
          });
        }
        (document.body.appendChild(e),
          e.addEventListener("click", function (l) {
            (l.target === e || l.target.hasAttribute("data-fechar")) && e.remove();
          }),
          e.addEventListener("keydown", function (l) {
            l.key === "Escape" && e.remove();
          }),
          i());
      }
      P();
    }));
})();
