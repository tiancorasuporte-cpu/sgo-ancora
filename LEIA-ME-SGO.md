# SGO Âncora em React

Este é o projeto do sistema base (TanStack Start + React + PostgreSQL), com o **SGO Âncora** por dentro. Tudo que existe hoje em sgo.ancoraseguranca.app continua igual: telas, layout, regras e menu. Do sistema base vieram as telas que no SGO estavam "Em breve".

## O que está pronto: 100% do SGO dentro do React

| Parte | Como ficou |
|---|---|
| Casca: faixa preta, menu lateral escuro, busca única do topo, conta, trocar senha, "Como usar" | React (`src/sgo/components/SgoShell.tsx`) |
| Login e Painel | React (`src/routes/login.tsx`, `painel.tsx`) |
| Central de Tickets, Quadro de OS e Agenda | React: marcação em JSX com a lógica original (`src/sgo/telas/tickets`, `src/sgo/telas/os`) |
| Comercial: Leads, CRM, Relatórios comerciais, Comissões, Orçamentos, Postos, Tabela de preços | Rotas React (`src/routes/comercial.*.tsx`) com tela isolada |
| Operações: Estoque da empresa, Estoque dos técnicos, Movimentações, Compras | Rotas React (`src/routes/operacoes.*.tsx`) com tela isolada |
| Cadastros: Clientes e fornecedores, Produtos, Serviços mensais, Mão de obra | Rotas React (`src/routes/cadastros.*.tsx`) com tela isolada |
| Assistência: Equipes técnicas, Relatórios de OS | Rotas React (`src/routes/assistencia.*.tsx`) com tela isolada |
| Configurações: Integrações e APIs, Banco de dados | Rotas React (`src/routes/configuracoes*.tsx`) com tela isolada |
| Usuários e Ramais VoIP (com o softphone flutuante) | Rotas React (`src/routes/usuarios.tsx`, `voip.tsx`) com os módulos originais (`src/sgo/telas/usuarios`, `voip`) |
| Servidor do SGO (toda a API `/api/...`) | Dentro do TanStack Start, sobre PostgreSQL (`src/sgo/server`) |
| Telas do sistema base no menu do SGO | Vencimentos, Notificações, Contas monitoradas (Contratos), Facilities, Terceiros, Uniformes, Frota |

Continuam "Em breve", porque o sistema base também não tem essas telas: **Recados / Informações**, **Separação de OS** e **Conferências** (no sistema base, elas ficam dentro do fluxo da OS).

### App do Técnico

O App do Técnico (`/app`) é um app de celular à parte (PWA), feito para funcionar **sem internet** no campo. O service worker dele guarda a página e os arquivos para abrir offline. Por isso ele ficou **fora do React de propósito**: dentro do React, os arquivos mudariam de nome a cada build e o modo offline deixaria de funcionar.

Os arquivos agora ficam legíveis em `sgo/app-tecnico/` e são servidos pelo servidor do SGO. Se o sistema base for usar o app mobile dele (Expo), o caminho é ligar esse app à API do SGO (`/api/tecnico/...`).

## Como está organizado

```
src/
  routes/                 rotas (padrão do TanStack Start)
    login.tsx  painel.tsx  tickets.tsx  assistencia.os.tsx  assistencia.agenda.tsx
    $.tsx                 demais caminhos do SGO (telas ainda em conversão, "Em breve")
    vencimentos.tsx ...   telas do sistema base (sem alteração)
  sgo/
    components/SgoShell   casca do SGO (montada uma vez no __root)
    components/TelaDc     monta as telas de Tickets e OS
    lib/                  api, rotas/ícones do menu, motor das telas (dc.ts), guarda de login
    estilo/sgo.css        estilo do SGO (o mesmo de produção)
    telas/<tela>/         marcação (View.tsx), lógica original (logica.js) e CSS com escopo
    server/               servidor do SGO: worker.js (API), d1.ts (PostgreSQL), r2.ts (arquivos), sessao.ts
  components/AppShell.tsx agora só repassa para a casca do SGO (o original ficou em referencia/)
sgo/banco/                scripts do banco do SGO no PostgreSQL
referencia/               arquivos do sistema base que foram substituídos pelos do SGO
ferramentas/conversao/    scripts usados na conversão (banco SQLite→PostgreSQL, telas → React)
```

### Telas isoladas (etapa 2 em diante)

As telas do Comercial foram escritas em JavaScript puro, para rodar numa página própria. Cada uma virou um componente React (`TelaIsolada`) que monta a tela num **Shadow DOM**, com:
- estilo isolado, como no iframe;
- um ambiente próprio (`src/sgo/lib/tela-isolada.ts`): `document` e `window` da tela, endereço virtual (`?tab=rel`) e limpeza de timers e listeners ao sair.

As regras e o desenho são os mesmos de produção. Arquivos por tela, em `src/sgo/telas/<tela>/`:
- `marcacao.html`
- `estilo.css`
- `logica.js`
- `meta.json`

### Login e usuários

O login é o do SGO (tabela `sgo.usuarios`, cookie `sgo_sessao`). As telas do sistema base recebem o usuário pelo `getCurrentUser()` de sempre: o usuário do SGO é espelhado em `public.users` com os módulos equivalentes às permissões dele (`src/sgo/server/sessao.ts`). Exemplo: quem tem "Frota" no SGO recebe o módulo `frota`.

### Banco de dados

Tudo fica no mesmo PostgreSQL:
- `public`: tabelas do sistema base (criadas pelo `ensureSchema()` de sempre);
- `sgo`: tabelas do SGO.

O servidor do SGO foi escrito para o Cloudflare D1 (SQLite). O `src/sgo/server/d1.ts` dá a mesma interface sobre o PostgreSQL e traduz as poucas diferenças de SQL. Assim, as regras do servidor do SGO ficaram iguais às de produção.

## Como rodar

**No Windows, o jeito mais fácil:** instale o Node.js (LTS) e o PostgreSQL e dê dois cliques em `RODAR-NO-WINDOWS.bat`.

Manualmente:
1. Instale as dependências: `npm install` (ou `bun install`).
2. Crie o `.env` com a conexão do PostgreSQL (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) e `SGO_ARQUIVOS_DIR`.
3. Rode `npm run dev` e abra `https://localhost:8080/login`.

**No primeiro acesso, o sistema se instala sozinho** (`src/sgo/server/instalar.ts`):
- cria as tabelas do sistema base (`ensureSchema`);
- se não existir o schema `sgo`, roda os scripts de `sgo/banco/`: estrutura, cadastros-base (menu, setores, assuntos, mão de obra, serviços), compatibilidade e o usuário `superadmin`, com senha provisória `trocar123`;
- se a pasta de arquivos estiver vazia, copia `sgo/arquivos-iniciais/` (telas do SGO, central de ajuda, logo, softphone).

Os scripts de `sgo/banco/` também podem ser rodados à mão com `psql`. O arquivo 01 **apaga e recria o schema `sgo`**.

## Para ligar ao banco do sistema base

1. Aponte o `.env` para o PostgreSQL do sistema base.
2. Rode os 3 scripts de `sgo/banco/`. Eles só mexem no schema `sgo`.
3. Os usuários do SGO são espelhados em `public.users` pelo id. Se o banco do sistema base já tiver usuários com os mesmos ids, ajuste antes: por exemplo, criando os usuários do SGO com ids livres.

## Telas isoladas: como mexer

Cada tela isolada fica em `src/sgo/telas/<tela>/`:
- `marcacao.html`: a estrutura da tela;
- `estilo.css`: o visual, só daquela tela;
- `logica.js`: as regras, que é o código de produção;
- `meta.json`: bibliotecas externas e busca de cadastros.

Para alterar uma tela, edite esses arquivos. Para reescrever alguma em JSX puro mais adiante, use as rotas `src/routes/*.tsx` como ponto de entrada. As ferramentas que geraram as pastas estão em `ferramentas/conversao/`.

## Próximos passos sugeridos

- Se quiser tudo no padrão do sistema base, reescrever o servidor do SGO (`src/sgo/server/worker.js`) como server functions.
- Ligar no PostgreSQL do sistema base: ver "Para ligar ao banco do sistema base".
