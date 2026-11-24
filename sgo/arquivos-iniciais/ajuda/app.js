/* SGO Âncora · Central de ajuda (tutorial passo a passo + manuais em PDF) */
(function () {
  "use strict";
  var DADOS = {"mods": [{"id": "inicio", "nome": "Primeiros passos", "icone": "compass", "perm": [], "rotas": ["/painel"], "passos": [{"t": "Bem-vindo ao SGO", "x": "O SGO é onde toda a operação da Âncora acontece. Tudo fica registrado: quem fez e quando. Esta central mostra, passo a passo, como usar cada parte.", "url": "/painel", "img": "inicio-1", "b": null}, {"t": "O menu lateral", "x": "Tudo o que você pode acessar fica no menu à esquerda. Clique no nome do grupo para abrir e fechar. Itens com o selo EM BREVE ainda estão em construção.", "url": "/painel", "img": "inicio-2", "b": [0.0, 0.0, 20.28, 100.0]}, {"t": "Encolher o menu", "x": "Precisa de mais espaço? Clique em Encolher e o menu fica só com os ícones. Clique de novo para voltar.", "url": "/painel", "img": "inicio-3", "b": [0.42, 9.33, 18.54, 6.0]}, {"t": "Busca rápida", "x": "Digite o número de uma OS, de um ticket, o nome de um cliente ou de um produto para achar direto.", "url": "/painel", "img": "inicio-4", "b": [20.97, 9.0, 30.0, 6.0]}, {"t": "O Painel", "x": "É a primeira tela ao entrar: o resumo de tudo o que está acontecendo. Os atalhos levam para a tela onde a coisa é resolvida.", "url": "/painel", "img": "inicio-5", "b": [19.03, 0.0, 80.97, 100.0]}, {"t": "Sua conta", "x": "Clique no seu nome para trocar a sua senha ou sair do sistema. Nunca use o usuário de outra pessoa.", "url": "/painel", "img": "inicio-6", "b": [88.04, 8.89, 10.44, 6.22]}, {"t": "Esta ajuda", "x": "Sempre que tiver dúvida, clique em Como usar. A ajuda abre já na parte da tela em que você está.", "url": "/painel", "img": "inicio-7", "b": [78.31, 9.11, 9.45, 5.78]}]}, {"id": "tickets", "nome": "Tickets", "icone": "ticket", "perm": ["tickets"], "rotas": ["/tickets"], "passos": [{"t": "Sem ticket, não tem pedido", "x": "Todo pedido, de cliente ou de outro setor, vira ticket. Conversa de corredor não vale. Abriu ticket, o setor responsável é obrigado a responder.", "url": "/tickets", "img": "tickets-1", "b": null}, {"t": "Abrir um ticket", "x": "Clique em + Novo ticket.", "url": "/tickets", "img": "tickets-2", "b": [88.57, 46.64, 9.9, 6.22]}, {"t": "Preencher", "x": "Escolha o assunto (ele já marca o setor que recebe), informe o cliente, o contato e descreva o pedido. Anexe prints se ajudar. Depois clique em Abrir ticket.", "url": "/tickets", "img": "tickets-3", "b": [38.47, 57.39, 42.5, 9.0]}, {"t": "A sua fila", "x": "Os tickets do seu setor aparecem na lista. Clique em um ticket para ver os detalhes e o histórico.", "url": "/tickets", "img": "tickets-4", "b": [20.97, 56.2, 28.62, 15.0]}, {"t": "Responder", "x": "Clique em Iniciar atendimento: você vira o responsável. Use Comentar para registrar novidades e anexar prints.", "url": "/tickets", "img": "tickets-5", "b": [51.26, 89.15, 11.29, 5.78]}, {"t": "Dar o destino", "x": "Resolver (descreva a solução), Encaminhar (para o setor do próximo passo) ou Abrir OS (quando precisa de serviço técnico). O ticket só sai da fila quando tem destino.", "url": "/tickets", "img": "tickets-6", "b": [89.53, 89.15, 6.61, 5.78]}, {"t": "Filtros", "x": "Use Em aberto, Resolvidos / OS ou Todos, e o filtro de setor, para achar o que procura.", "url": "/tickets", "img": "tickets-7", "b": [38.74, 47.09, 6.94, 5.33]}]}, {"id": "os", "nome": "Quadro de OS", "icone": "columns", "perm": ["at-os"], "rotas": ["/assistencia/os"], "passos": [{"t": "O Quadro de OS", "x": "Cada cartão é uma OS e cada coluna é uma etapa, da OS aberta até a OS finalizada e entregue ao faturamento. Se uma equipe entrou em campo, a OS está aqui.", "url": "/assistencia/os", "img": "os-1", "b": null}, {"t": "Filtrar por tipo", "x": "Veja só pedidos de instalação, manutenções, monitoramento ou orçamentos.", "url": "/assistencia/os", "img": "os-2", "b": [26.82, 38.67, 5.43, 5.33]}, {"t": "Quem move cada etapa", "x": "Cada coluna diz quem é o dono da etapa. Só o setor dono move a OS. Avança uma etapa por vez; voltar precisa da aprovação do administrador.", "url": "/assistencia/os", "img": "os-3", "b": [81.67, 53.78, 15.0, 5.98]}, {"t": "O cartão", "x": "Mostra o número, o tipo, o cliente, o material e a agenda. O botão amarelo leva a OS para a próxima etapa.", "url": "/assistencia/os", "img": "os-4", "b": [82.22, 69.31, 5.13, 3.0]}, {"t": "Abrir a OS", "x": "Clique no cartão. A barra de cima mostra a etapa atual e a próxima. Embaixo ficam os botões da etapa.", "url": "/assistencia/os", "img": "os-5", "b": null}, {"t": "Agendar", "x": "Informe a data e o período (ou o horário). A equipe pode ser escolhida depois, no dia.", "url": "/assistencia/os", "img": "os-6", "b": null}, {"t": "Enviar ao técnico", "x": "No dia, escolha a equipe e o auxiliar e envie. A OS aparece no App do Técnico do técnico principal.", "url": "/assistencia/os", "img": "os-7", "b": [54.67, 86.5, 10.12, 5.33]}, {"t": "Fechar a OS", "x": "Quando a OS chega em Executado, avance para Finalizado: confira o tempo no cliente, quem executou, a mão de obra sugerida e o material a cobrar.", "url": "/assistencia/os", "img": "os-8", "b": null}, {"t": "Via do cliente", "x": "Na OS finalizada: imprima, salve em PDF ou compartilhe o link da via pelo WhatsApp.", "url": "/assistencia/os", "img": "os-9", "b": [23.39, 76.47, 72.66, 11.11]}, {"t": "Nova OS", "x": "Para abrir uma OS na hora, clique em + Nova OS e escolha o tipo. Pedido aprovado precisa do número do orçamento.", "url": "/assistencia/os", "img": "os-10", "b": [90.39, 38.22, 8.09, 6.22]}]}, {"id": "agenda", "nome": "Agenda", "icone": "calendar", "perm": ["at-agenda", "at-os"], "rotas": ["/assistencia/agenda"], "passos": [{"t": "A agenda das equipes", "x": "As OS agendadas por dia e período. Clique em um horário para abrir a OS.", "url": "/assistencia/agenda", "img": "agenda-1", "b": null}, {"t": "Semana ou mês", "x": "Navegue com Hoje e as setas, e troque entre Semana e Mês.", "url": "/assistencia/agenda", "img": "agenda-2", "b": [93.62, 38.56, 4.64, 5.33]}, {"t": "Por equipe", "x": "Escolha uma equipe para ver só a agenda dela.", "url": "/assistencia/agenda", "img": "agenda-3", "b": [29.81, 44.78, 7.92, 5.33]}]}, {"id": "equipes", "nome": "Equipes técnicas", "icone": "users", "perm": ["at-equipes"], "rotas": ["/assistencia/equipes"], "passos": [{"t": "As equipes", "x": "Cada equipe tem um ou mais técnicos. O técnico principal é quem recebe a OS no App do Técnico.", "url": "/assistencia/equipes", "img": "equipes-1", "b": null}, {"t": "Criar ou editar", "x": "Clique em + Nova equipe técnica ou em Editar equipe. Dê o nome, vincule os técnicos e marque o principal.", "url": "/assistencia/equipes", "img": "equipes-2", "b": [85.34, 36.61, 13.41, 5.78]}]}, {"id": "relos", "nome": "Relatórios de OS", "icone": "chart", "perm": ["at-rel"], "rotas": ["/assistencia/relatorios"], "passos": [{"t": "O mês da Assistência", "x": "Total produzido, mão de obra, horas no cliente e OS finalizadas. Use as setas para ver os meses passados.", "url": "/assistencia/relatorios", "img": "relos-1", "b": null}, {"t": "Por técnico, auxiliar e equipe", "x": "Veja quem fez o quê. O total correto da Assistência está na aba Por equipe.", "url": "/assistencia/relatorios", "img": "relos-2", "b": [35.85, 79.78, 7.88, 5.78]}, {"t": "Exportar", "x": "Baixe em CSV ou imprima em PDF para o planejamento.", "url": "/assistencia/relatorios", "img": "relos-3", "b": [20.69, 23.22, 9.25, 5.78]}]}, {"id": "leads", "nome": "Leads", "icone": "filter", "perm": ["com-leads"], "rotas": ["/comercial/leads"], "passos": [{"t": "Todo contato novo cai aqui", "x": "Quem chega pelo WhatsApp, Instagram, Facebook, site ou indicação vira um lead. O primeiro contato deve ser feito em até 1 hora útil.", "url": "/comercial/leads", "img": "leads-1", "b": null}, {"t": "Novo lead", "x": "Para cadastrar um contato que chegou por telefone ou indicação, clique em + Novo lead.", "url": "/comercial/leads", "img": "leads-2", "b": [90.51, 16.94, 8.52, 5.33]}, {"t": "Registrar o contato", "x": "Abra o lead e registre como foi o contato e o resultado. Quem faz o 1º contato de um lead sem vendedor assume o lead.", "url": "/comercial/leads", "img": "leads-3", "b": [75.34, 88.94, 13.58, 5.33]}, {"t": "Qualificar e converter", "x": "Depois do contato, qualifique e converta: em visita técnica (abre uma OS) ou direto em oportunidade no CRM. Se não for venda, descarte com o motivo.", "url": "/comercial/leads", "img": "leads-4", "b": null}, {"t": "Relatório", "x": "Leads por origem, por vendedor e motivos de descarte.", "url": "/comercial/leads", "img": "leads-5", "b": [60.33, 17.22, 6.96, 4.78]}]}, {"id": "crm", "nome": "CRM", "icone": "handshake", "perm": ["com-crm"], "rotas": ["/comercial/crm"], "passos": [{"t": "As oportunidades", "x": "Cada cartão é uma venda em andamento. As colunas têm prazo em dias úteis; atrasou, o cartão fica vermelho.", "url": "/comercial/crm", "img": "crm-1", "b": null}, {"t": "Nova oportunidade", "x": "Normalmente ela nasce sozinha (visita técnica, lead ou orçamento). Para indicação ou cliente que ligou, use + Nova oportunidade.", "url": "/comercial/crm", "img": "crm-2", "b": [86.48, 16.72, 12.54, 5.0]}, {"t": "Dentro da oportunidade", "x": "Levantamento, orçamentos, proposta, equipe, documentos e histórico. Para mudar de etapa, use o botão amarelo ou Mover para: o sistema pede o que é obrigatório.", "url": "/comercial/crm", "img": "crm-3", "b": null}, {"t": "Só os atrasados", "x": "Marque Só atrasados / vencendo hoje para ver o que precisa de ação agora.", "url": "/comercial/crm", "img": "crm-4", "b": [81.74, 24.22, 15.34, 3.44]}]}, {"id": "comissoes", "nome": "Relatórios e comissões", "icone": "coins", "perm": ["com-crm-rel", "com-comissoes"], "rotas": ["/comercial/relatorios", "/comercial/comissoes"], "passos": [{"t": "Relatórios comerciais", "x": "Quem vendeu, quanto vendeu e por que perdemos, por período. Exporte em Excel ou PDF.", "url": "/comercial/relatorios", "img": "comissoes-1", "b": [78.1, 54.11, 10.36, 5.0]}, {"t": "Comissões", "x": "O resumo do mês por pessoa e os lançamentos. O vendedor vê as próprias; a administração vê as de todos.", "url": "/comercial/comissoes", "img": "comissoes-2", "b": null}]}, {"id": "orc", "nome": "Orçamentos", "icone": "file", "perm": ["com-orc"], "rotas": ["/comercial/orcamentos"], "passos": [{"t": "A lista de orçamentos", "x": "Todos os orçamentos, com situação, valor e a oportunidade ligada. Clique na linha para abrir.", "url": "/comercial/orcamentos", "img": "orc-1", "b": null}, {"t": "Novo orçamento", "x": "Clique em + Novo orçamento.", "url": "/comercial/orcamentos", "img": "orc-2", "b": [87.65, 15.89, 10.82, 5.78]}, {"t": "Montar", "x": "Escolha o cliente, adicione produtos e mão de obra (execução) e, se for mensal, marque Incluir serviço mensal. Os totais ficam separados.", "url": "/comercial/orcamentos", "img": "orc-3", "b": null}, {"t": "Ações do orçamento", "x": "No botão ⋮: visualizar e baixar o PDF, duplicar e enviar para uma oportunidade no CRM.", "url": "/comercial/orcamentos", "img": "orc-4", "b": null}, {"t": "Levantamentos técnicos", "x": "O que o técnico levantou na visita vira orçamento em um clique: Converter em orçamento.", "url": "/comercial/orcamentos", "img": "orc-5", "b": [31.23, 16.22, 16.36, 6.33]}]}, {"id": "postos", "nome": "Orçamento de postos", "icone": "building", "perm": ["com-postos"], "rotas": ["/comercial/postos"], "passos": [{"t": "Calcular o posto", "x": "Escolha a função, a jornada, os dias e o salário. O valor mensal do posto aparece na hora, no cartão preto.", "url": "/comercial/postos", "img": "postos-1", "b": [21.46, 48.47, 6.05, 5.56]}, {"t": "Salvar e imprimir", "x": "Informe o cliente e clique em Salvar orçamento. Imprima a versão interna (com custos) ou a do cliente.", "url": "/comercial/postos", "img": "postos-2", "b": [59.06, 77.83, 10.29, 5.78]}]}, {"id": "precos", "nome": "Tabela de preços", "icone": "tag", "perm": ["com-precos"], "rotas": ["/comercial/precos"], "passos": [{"t": "O mesmo preço para todos", "x": "Serviços mensais e mão de obra. Clique no cartão para copiar o preço.", "url": "/comercial/precos", "img": "precos-1", "b": null}, {"t": "Calculadora de mão de obra", "x": "Some horas, meio dia e dia e copie o resumo para mandar ao cliente.", "url": "/comercial/precos", "img": "precos-2", "b": [21.81, 63.21, 55.28, 3.67]}]}, {"id": "estoque", "nome": "Estoque", "icone": "warehouse", "perm": ["op-est-emp", "op-est-tec", "op-est-mov"], "rotas": ["/operacoes/estoque", "/operacoes/estoque/tecnicos", "/operacoes/estoque/movimentacoes"], "passos": [{"t": "A conta tem que fechar", "x": "Da porta para dentro, tudo contado. Saiu pela janelinha, tem endereço: um técnico ou uma OS. O saldo é a soma das movimentações.", "url": "/operacoes/estoque", "img": "estoque-1", "b": null}, {"t": "Contagem", "x": "Antes de operar (e sempre que houver dúvida), faça a contagem: digite o que contou e o sistema lança só a diferença.", "url": "/operacoes/estoque", "img": "estoque-2", "b": [84.37, 44.06, 13.27, 5.78]}, {"t": "Retirada do técnico", "x": "Em Estoque dos técnicos, clique em + Nova retirada. O material só sai da empresa quando o técnico confirma no app.", "url": "/operacoes/estoque/tecnicos", "img": "estoque-3", "b": [87.51, 46.39, 10.13, 5.78]}, {"t": "Devolução", "x": "O técnico devolve pelo app e o Estoque confere o que chegou. O que não chegou continua na conta do técnico.", "url": "/operacoes/estoque/tecnicos", "img": "estoque-4", "b": null}, {"t": "Movimentações", "x": "O extrato de tudo o que entrou e saiu, com origem, destino, OS e quem lançou. Use os filtros quando a conta não fechar.", "url": "/operacoes/estoque/movimentacoes", "img": "estoque-5", "b": [88.38, 24.67, 9.25, 5.78]}]}, {"id": "compras", "nome": "Compras", "icone": "cart", "perm": ["op-compras"], "rotas": ["/operacoes/compras"], "passos": [{"t": "O que precisa comprar", "x": "Os itens marcados A comprar nas OS e as solicitações de compra aparecem aqui.", "url": "/operacoes/compras", "img": "compras-1", "b": null}, {"t": "Solicitação de compra", "x": "Para comprar algo que não é de OS (ex.: reposição do estoque), crie uma solicitação.", "url": "/operacoes/compras", "img": "compras-2", "b": [20.97, 42.89, 14.13, 5.78]}, {"t": "Cotar", "x": "Marque os itens e clique em Nova cotação com os selecionados.", "url": "/operacoes/compras", "img": "compras-3", "b": [79.17, 92.22, 18.19, 5.78]}, {"t": "Mapa de cotação", "x": "Coloque até 3 fornecedores, os preços e as condições. Escolha o melhor de cada item e clique em Aprovar e gerar pedidos.", "url": "/operacoes/compras", "img": "compras-4", "b": [43.55, 29.33, 13.32, 5.78]}, {"t": "Pedidos de compra", "x": "Marque o pedido como enviado (com a previsão) e, quando chegar, como entregue. A entrega dá entrada no estoque.", "url": "/operacoes/compras", "img": "compras-5", "b": [29.89, 71.67, 9.06, 4.89]}]}, {"id": "cadastros", "nome": "Cadastros", "icone": "book", "perm": ["cad-parceiros", "cad-produtos", "cad-servicos", "cad-maoobra"], "rotas": ["/cadastros/parceiros", "/cadastros/produtos", "/cadastros/servicos", "/cadastros/maoobra"], "passos": [{"t": "Os cadastros", "x": "Clientes e fornecedores, produtos, serviços mensais e mão de obra. Todas as telas do SGO buscam aqui, nunca no Omie.", "url": "/cadastros/parceiros", "img": "cadastros-1", "b": null}, {"t": "Importar do Omie", "x": "Exporte a planilha do Omie e importe aqui para atualizar clientes e produtos.", "url": "/cadastros/parceiros", "img": "cadastros-2", "b": [77.87, 16.56, 14.99, 5.78]}, {"t": "Editar", "x": "Clique na linha para abrir o cadastro à direita. Altere e clique em Salvar.", "url": "/cadastros/parceiros", "img": "cadastros-3", "b": null}]}, {"id": "usuarios", "nome": "Usuários", "icone": "user", "perm": ["usuarios"], "rotas": ["/usuarios"], "passos": [{"t": "Os usuários", "x": "Cada pessoa tem o seu usuário. O perfil define o acesso: Usuário (só o liberado), Administrador (tudo) ou Técnico (só o app).", "url": "/usuarios", "img": "usuarios-1", "b": [88.25, 19.89, 10.23, 6.22]}, {"t": "Liberar acessos", "x": "Em Editar, marque item por item o que a pessoa pode acessar, o setor e se é Vendedor.", "url": "/usuarios", "img": "usuarios-2", "b": null}]}], "pdfs": [{"nome": "Apresentação geral do SGO", "arq": "SGO-Ancora-apresentacao-geral.pdf", "desc": "O que é o SGO, a ligação com o Omie, os módulos e a implantação."}, {"nome": "01 · Painel", "arq": "SGO-Ancora-01-Painel.pdf", "desc": "A tela de entrada: o resumo de tudo."}, {"nome": "02 · Tickets", "arq": "SGO-Ancora-02-Tickets.pdf", "desc": "Sem ticket, não tem pedido: abrir, responder e dar destino."}, {"nome": "04 · Comercial", "arq": "SGO-Ancora-04-Comercial.pdf", "desc": "Leads, CRM, orçamentos, postos, tabela de preços e comissões."}, {"nome": "05 · Assistência Técnica", "arq": "SGO-Ancora-05-Assistencia-Tecnica.pdf", "desc": "Quadro de OS, agenda, equipes, relatórios e App do Técnico."}, {"nome": "06 · Estoque e Compras", "arq": "SGO-Ancora-06-Estoque-e-Compras.pdf", "desc": "Controle físico do estoque, cotação e pedidos de compra."}]};
  var ICO = {
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/>',
    columns: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.7.8 3 2.6 3.5 5.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    handshake: '<path d="M2 12l5-5 4 2 4-2 5 5-8 8z"/><path d="M8 12l3 3 5-5"/>',
    coins: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9c-.5-.7-1.4-1-2.5-1-1.4 0-2.5.7-2.5 1.7 0 2.3 5 1.2 5 3.5 0 1-1.1 1.8-2.5 1.8-1.2 0-2.1-.4-2.6-1.1M12 6v1.8M12 16.2V18"/>',
    file: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>',
    building: '<path d="M4 21V5l8-3v19M12 9h8v12M7 7h2M7 11h2M7 15h2M15 13h2M15 17h2M2 21h20"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    warehouse: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12l2-8H6"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6"/>',
    pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 18h4"/>'
  };
  function svg(n, s) { return '<svg aria-hidden="true" width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICO[n] || "") + "</svg>"; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var CSS = '' +
    '.btn-ajuda{font:600 13px Inter,sans-serif;min-height:40px;padding:0 14px 0 8px;border-radius:20px;border:1.5px solid #141414;background:#fff;color:#141414;cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-left:auto}' +
    '.btn-ajuda:hover{background:#FFF6CC}.btn-ajuda:focus-visible{outline:2px solid #141414;outline-offset:2px}' +
    '.btn-ajuda .q{width:24px;height:24px;border-radius:50%;background:#FFD200;color:#141414;display:inline-flex;align-items:center;justify-content:center;font:800 14px Inter,sans-serif}' +
    '.aj-fundo{position:fixed;inset:0;background:#1414148C;z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.aj-box{background:#fff;border-radius:14px;width:min(1180px,100%);height:min(90vh,860px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px #00000059;font-family:Inter,system-ui,sans-serif;color:#141414}' +
    '.aj-top{background:#141414;border-bottom:4px solid #FFD200;padding:14px 20px;display:flex;align-items:center;gap:14px;flex:none}' +
    '.aj-top .k{font:700 11px Inter,sans-serif;letter-spacing:.5px;color:#FFD200;text-transform:uppercase}' +
    '.aj-top h2{margin:2px 0 0;font:800 22px "Barlow Semi Condensed",sans-serif;text-transform:uppercase;color:#fff;line-height:1}' +
    '.aj-x{all:unset;margin-left:auto;cursor:pointer;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px}' +
    '.aj-x:hover{background:#ffffff1f}.aj-x:focus-visible{outline:2px solid #FFD200}' +
    '.aj-corpo{flex:1;min-height:0;display:flex}' +
    '.aj-lado{flex:0 0 250px;border-right:1px solid #E6E6E0;overflow-y:auto;padding:12px 10px;background:#FAFAF7}' +
    '.aj-lado .g{font:700 11px Inter,sans-serif;letter-spacing:.4px;text-transform:uppercase;color:#5A5A5A;padding:10px 10px 6px}' +
    '.aj-it{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;min-height:40px;padding:0 10px;border-radius:8px;cursor:pointer;font:600 13.5px Inter,sans-serif;color:#141414}' +
    '.aj-it:hover{background:#F1F1EC}.aj-it:focus-visible{outline:2px solid #141414;outline-offset:-2px}' +
    '.aj-it.on{background:#141414;color:#FFD200}.aj-it .n{margin-left:auto;font:600 11px Inter,sans-serif;color:#8a8a84}.aj-it.on .n{color:#FFD200}' +
    '.aj-sel{display:none}' +
    '.aj-main{flex:1;min-width:0;display:flex;flex-direction:column;padding:18px 22px 16px;gap:12px;overflow-y:auto}' +
    '.aj-k{font:700 11.5px Inter,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#5A5A5A}' +
    '.aj-t{margin:0;font:800 26px "Barlow Semi Condensed",sans-serif;text-transform:uppercase;line-height:1.05}' +
    '.aj-fig{position:relative;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px #0000001f;background:#F3F3EF;flex:none;aspect-ratio:16/10;width:min(100%,calc(52vh * 1.6));align-self:flex-start}' +
    '.aj-fig img{display:block;width:100%;height:100%}' +
    '.aj-foco{position:absolute;border-radius:8px;box-shadow:0 0 0 9999px #1414146B;outline:3px solid #FFD200;outline-offset:2px;animation:ajPulso 1.6s ease-in-out infinite;transition:all .35s ease}' +
    '@keyframes ajPulso{0%,100%{outline-color:#FFD200;outline-offset:2px}50%{outline-color:#FFE666;outline-offset:6px}}' +
    '.aj-x2{font:400 16px/1.5 Inter,sans-serif;color:#262626;margin:0;max-width:820px}' +
    '.aj-anim{animation:ajEntra .32s ease}@keyframes ajEntra{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}' +
    '.aj-nav{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:8px;flex-wrap:wrap}' +
    '.aj-dots{display:flex;gap:6px;flex-wrap:wrap}.aj-dot{all:unset;cursor:pointer;width:10px;height:10px;border-radius:50%;background:#D9D9D3}.aj-dot.on{background:#141414;width:26px;border-radius:5px}.aj-dot:focus-visible{outline:2px solid #141414}' +
    '.aj-b{font:600 13px Inter,sans-serif;min-height:40px;padding:0 16px;border-radius:8px;border:1.5px solid #141414;background:#fff;color:#141414;cursor:pointer}' +
    '.aj-b:hover{background:#F1F1EC}.aj-b[disabled]{opacity:.35;cursor:default}' +
    '.aj-b.y{background:#FFD200;border-color:#FFD200}.aj-b.y:hover{background:#F2C500}' +
    '.aj-ir{all:unset;cursor:pointer;font:600 13px Inter,sans-serif;text-decoration:underline;margin-left:auto}.aj-ir:focus-visible{outline:2px solid #141414}' +
    '.aj-pdfs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}' +
    '.aj-pdf{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:12px;background:#F6F6F2;box-shadow:0 0 0 1px #0000000f}' +
    '.aj-pdf .ic{width:40px;height:40px;border-radius:10px;background:#141414;color:#FFD200;display:flex;align-items:center;justify-content:center}' +
    '.aj-pdf b{font:700 15px Inter,sans-serif}.aj-pdf span{font:400 13px Inter,sans-serif;color:#3D3D3D}' +
    '.aj-pdf .ac{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}' +
    '.aj-pdf a{font:600 12.5px Inter,sans-serif;min-height:34px;padding:0 12px;border-radius:8px;display:inline-flex;align-items:center;text-decoration:none;color:#141414;border:1.5px solid #141414;background:#fff}' +
    '.aj-pdf a.y{background:#FFD200;border-color:#FFD200}' +
    '@media (max-width:900px){.aj-fundo{padding:0}.aj-box{height:100%;border-radius:0}.aj-lado{display:none}.aj-sel{display:block;margin:0 0 4px}.aj-main{padding:14px}.aj-t{font-size:22px}.btn-ajuda .tx{display:none}.btn-ajuda{padding:0 8px}}';

  var permitidos = null, mods = DADOS.mods, atual = null, passo = 0, fundo = null;

  function carregarPermissoes() {
    return fetch("/api/menu", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var ids = {};
      (function andar(lista) {
        (lista || []).forEach(function (n) { if (n.id) ids[n.id] = 1; andar(n.itens); andar(n.filhos); });
      })(j && (j.menu || j.arvore || j.itens || j));
      permitidos = ids;
    }).catch(function () { permitidos = null; });
  }
  function visiveis() {
    return mods.filter(function (m) {
      if (!m.perm.length || !permitidos) return true;
      return m.perm.some(function (p) { return permitidos[p]; });
    });
  }
  function modDaRota() {
    var p = location.pathname, lst = visiveis();
    for (var i = 0; i < lst.length; i++) if (lst[i].rotas.indexOf(p) >= 0) return lst[i].id;
    return lst.length ? lst[0].id : null;
  }

  function abrir() {
    if (fundo) return;
    fundo = document.createElement("div");
    fundo.className = "aj-fundo";
    fundo.innerHTML = '<div class="aj-box" role="dialog" aria-modal="true" aria-labelledby="aj-tit">' +
      '<div class="aj-top"><div><div class="k">Central de ajuda</div><h2 id="aj-tit">Como usar o SGO</h2></div><button class="aj-x" type="button" aria-label="Fechar">×</button></div>' +
      '<div class="aj-corpo"><nav class="aj-lado" aria-label="Partes do sistema"></nav><div class="aj-main" aria-live="polite"></div></div></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener("click", function (e) { if (e.target === fundo) fechar(); });
    fundo.querySelector(".aj-x").addEventListener("click", fechar);
    document.addEventListener("keydown", tecla);
    var pronto = permitidos ? Promise.resolve() : carregarPermissoes();
    pronto.then(function () { lado(); mostrar(modDaRota(), 0); fundo.querySelector(".aj-x").focus(); });
  }
  function fechar() {
    if (!fundo) return;
    document.removeEventListener("keydown", tecla);
    fundo.remove(); fundo = null;
    var b = document.getElementById("btn-ajuda"); if (b) b.focus();
  }
  function tecla(e) {
    if (e.key === "Escape") fechar();
    else if (atual !== "pdf" && e.key === "ArrowRight") ir(1);
    else if (atual !== "pdf" && e.key === "ArrowLeft") ir(-1);
  }
  function lado() {
    var lst = visiveis(), h = '<div class="g">Passo a passo</div>';
    lst.forEach(function (m) { h += '<button type="button" class="aj-it" data-m="' + m.id + '">' + svg(m.icone) + "<span>" + esc(m.nome) + '</span><span class="n">' + m.passos.length + "</span></button>"; });
    h += '<div class="g">Materiais</div><button type="button" class="aj-it" data-m="pdf">' + svg("pdf") + '<span>Manuais em PDF</span><span class="n">' + DADOS.pdfs.length + "</span></button>";
    var nav = fundo.querySelector(".aj-lado"); nav.innerHTML = h;
    nav.addEventListener("click", function (e) { var b = e.target.closest("[data-m]"); if (b) mostrar(b.getAttribute("data-m"), 0); });
  }
  function seletor() {
    var o = visiveis().map(function (m) { return '<option value="' + m.id + '"' + (m.id === atual ? " selected" : "") + ">" + esc(m.nome) + "</option>"; }).join("");
    return '<select class="field aj-sel" aria-label="Parte do sistema">' + o + '<option value="pdf"' + (atual === "pdf" ? " selected" : "") + ">Manuais em PDF</option></select>";
  }
  function mostrar(id, p) {
    atual = id; passo = p || 0;
    fundo.querySelectorAll(".aj-it").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-m") === id); b.setAttribute("aria-current", b.getAttribute("data-m") === id ? "true" : "false"); });
    var main = fundo.querySelector(".aj-main");
    if (id === "pdf") {
      main.innerHTML = '<div class="aj-k">Materiais</div><p class="aj-x2">Carregando…</p>';
      carregarPdfs().then(function () { if (atual === "pdf") desenharPdfs(main); });
      return;
    } else {
      var m = mods.filter(function (x) { return x.id === id; })[0]; if (!m) return;
      var s = m.passos[passo], n = m.passos.length;
      var dots = ""; for (var i = 0; i < n; i++) dots += '<button type="button" class="aj-dot' + (i === passo ? " on" : "") + '" data-p="' + i + '" aria-label="Passo ' + (i + 1) + '"></button>';
      var foco = s.b ? '<div class="aj-foco" style="left:' + s.b[0] + "%;top:" + s.b[1] + "%;width:" + s.b[2] + "%;height:" + s.b[3] + '%"></div>' : "";
      main.innerHTML = seletor() +
        '<div class="aj-anim" style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="aj-k">' + esc(m.nome) + " · passo " + (passo + 1) + " de " + n + "</div>" +
        '<h3 class="aj-t">' + esc(s.t) + "</h3>" +
        '<div class="aj-fig"><img src="/ajuda/img/' + s.img + '.jpg" alt="Tela: ' + esc(s.t) + '" loading="lazy">' + foco + "</div>" +
        '<p class="aj-x2">' + esc(s.x) + "</p></div>" +
        '<div class="aj-nav"><button type="button" class="aj-b" data-nav="-1"' + (passo === 0 ? " disabled" : "") + '>‹ Anterior</button>' +
        '<div class="aj-dots">' + dots + "</div>" +
        '<button type="button" class="aj-b y" data-nav="1">' + (passo === n - 1 ? "Concluir ✓" : "Próximo ›") + "</button>" +
        (s.url && s.url !== location.pathname ? '<button type="button" class="aj-ir" data-ir="' + esc(s.url) + '">Abrir esta tela →</button>' : "") + "</div>";
      main.querySelectorAll("[data-nav]").forEach(function (b) { b.addEventListener("click", function () { ir(+b.getAttribute("data-nav")); }); });
      main.querySelectorAll("[data-p]").forEach(function (b) { b.addEventListener("click", function () { mostrar(atual, +b.getAttribute("data-p")); }); });
      var ir2 = main.querySelector("[data-ir]"); if (ir2) ir2.addEventListener("click", function () { location.href = ir2.getAttribute("data-ir"); });
    }
    var sel = main.querySelector(".aj-sel"); if (sel) sel.addEventListener("change", function () { mostrar(sel.value, 0); });
    main.scrollTop = 0;
  }

  var pdfInfo = null;
  function carregarPdfs() {
    return fetch("/api/ajuda/pdfs", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      pdfInfo = { lista: Array.isArray(j.pdfs) ? j.pdfs : DADOS.pdfs.slice(), admin: !!j.admin, salvo: Array.isArray(j.pdfs) };
    }).catch(function () { pdfInfo = { lista: DADOS.pdfs.slice(), admin: false }; });
  }
  function salvarLista() {
    return fetch("/api/ajuda/pdfs", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-sgo": "1" }, body: JSON.stringify({ pdfs: pdfInfo.lista }) }).then(function (r) { return r.json(); });
  }
  function nomeDoArquivo(a) { return a.replace(/\.pdf$/i, "").replace(/^SGO-Ancora-/, "").replace(/[-_]+/g, " "); }
  function desenharPdfs(main) {
    var h = seletor() + '<div class="aj-k">Materiais</div><h3 class="aj-t">Manuais em PDF</h3><p class="aj-x2">Os manuais de cada setor, para ler, imprimir ou mandar para quem precisa.</p>';
    if (pdfInfo.admin) h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="aj-b y" style="display:inline-flex;align-items:center;cursor:pointer">+ Enviar arquivos<input type="file" id="aj-up" accept=".pdf,.jpg,.jpeg" multiple hidden></label><span class="aj-k" id="aj-st" style="text-transform:none;letter-spacing:0">PDF entra na lista de manuais; JPG atualiza as imagens do tutorial. Só administrador.</span></div>';
    h += '<div class="aj-pdfs">';
    pdfInfo.lista.forEach(function (d, i) {
      var u = "/ajuda/pdf/" + encodeURIComponent(d.arq);
      h += '<div class="aj-pdf"><div class="ic">' + svg("pdf", 20) + "</div><b>" + esc(d.nome) + "</b><span>" + esc(d.desc || "") + '</span><div class="ac"><a class="y" href="' + u + '" target="_blank" rel="noopener">Abrir</a><a href="' + u + '?baixar=1" download>Baixar</a>' +
        (pdfInfo.admin ? '<a href="#" data-ed="' + i + '">Editar</a><a href="#" data-rm="' + i + '" style="border-color:#B3261E;color:#B3261E">Remover</a>' : "") + "</div></div>";
    });
    main.innerHTML = h + "</div>";
    var sel = main.querySelector(".aj-sel"); if (sel) sel.addEventListener("change", function () { mostrar(sel.value, 0); });
    var up = main.querySelector("#aj-up"); if (up) up.addEventListener("change", function () { enviar(up.files, main); });
    main.querySelectorAll("[data-ed]").forEach(function (a) { a.addEventListener("click", function (e) {
      e.preventDefault(); var d = pdfInfo.lista[+a.getAttribute("data-ed")];
      var n = window.prompt("Nome do manual:", d.nome); if (n == null) return;
      var ds = window.prompt("Descrição (aparece embaixo do nome):", d.desc || ""); if (ds == null) return;
      d.nome = n.trim() || d.nome; d.desc = ds.trim(); salvarLista().then(function () { desenharPdfs(main); });
    }); });
    main.querySelectorAll("[data-rm]").forEach(function (a) { a.addEventListener("click", function (e) {
      e.preventDefault(); var i = +a.getAttribute("data-rm"), d = pdfInfo.lista[i];
      if (!window.confirm("Remover o manual \"" + d.nome + "\" da lista?")) return;
      fetch("/api/ajuda/arquivo/pdf/" + encodeURIComponent(d.arq), { method: "DELETE", credentials: "same-origin", headers: { "x-sgo": "1" } }).finally(function () {
        pdfInfo.lista.splice(i, 1); salvarLista().then(function () { desenharPdfs(main); });
      });
    }); });
  }
  function enviar(files, main) {
    var lst = Array.prototype.slice.call(files || []), st = main.querySelector("#aj-st"), ok = 0, erros = [], i = 0;
    function prox() {
      if (i >= lst.length) {
        var fim = function () { desenharPdfs(main); var s2 = main.querySelector("#aj-st"); if (s2) s2.textContent = ok + " arquivo(s) enviado(s)" + (erros.length ? " · com problema: " + erros.join(", ") : "."); };
        return salvarLista().then(fim, fim);
      }
      var f = lst[i++], nome = f.name.toLowerCase().endsWith(".pdf") ? f.name.replace(/[^A-Za-z0-9._-]+/g, "-") : f.name.toLowerCase().replace(/\.jpeg$/, ".jpg");
      var pasta = /\.pdf$/i.test(nome) ? "pdf/" : "img/";
      if (st) st.textContent = "Enviando " + i + " de " + lst.length + "…";
      fetch("/api/ajuda/arquivo/" + pasta + encodeURIComponent(nome), { method: "PUT", credentials: "same-origin", headers: { "x-sgo": "1" }, body: f }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (r) {
        if (!r.ok) { erros.push(f.name); return; }
        ok++;
        if (pasta === "pdf/" && !pdfInfo.lista.some(function (d) { return d.arq === nome; })) {
          var pad = DADOS.pdfs.filter(function (d) { return d.arq === nome; })[0];
          pdfInfo.lista.push(pad ? { nome: pad.nome, arq: nome, desc: pad.desc } : { nome: nomeDoArquivo(nome), arq: nome, desc: "" });
        }
      }).catch(function () { erros.push(f.name); }).then(prox);
    }
    prox();
  }
  function ir(d) {
    var m = mods.filter(function (x) { return x.id === atual; })[0]; if (!m) return;
    var p = passo + d;
    if (p >= m.passos.length) { var lst = visiveis(), i = lst.indexOf(m); if (i >= 0 && i < lst.length - 1) return mostrar(lst[i + 1].id, 0); return; }
    if (p < 0) return;
    mostrar(atual, p);
  }

  function iniciar() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var b = document.getElementById("btn-ajuda");
    if (!b) {
      var conta = document.querySelector(".topbar .conta"); if (!conta) return;
      b = document.createElement("button"); b.type = "button"; b.id = "btn-ajuda"; b.className = "btn-ajuda";
      conta.parentNode.insertBefore(b, conta);
    }
    b.innerHTML = '<span class="q" aria-hidden="true">?</span><span class="tx">Como usar</span>';
    b.setAttribute("aria-haspopup", "dialog");
    b.title = "Tutorial de uso do SGO e manuais em PDF";
    b.addEventListener("click", abrir);
    window.sgoAjuda = { abrir: abrir };
    if (/[?&]ajuda=1/.test(location.search)) abrir();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
