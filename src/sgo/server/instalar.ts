/**
 * SGO Âncora — instalação automática no primeiro acesso.
 *
 * Se o banco ainda não tem o schema `sgo`, roda os scripts de `sgo/banco/`
 * (estrutura, cadastros-base, compatibilidade e usuário superadmin). Também cria as
 * tabelas do sistema base (`ensureSchema`) e copia os arquivos iniciais do SGO
 * (telas, central de ajuda, logo, softphone) para a pasta de arquivos, se estiver vazia.
 */
import "@tanstack/react-start/server-only";
import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { sgoSql } from "./d1";

let pronto: Promise<void> | null = null;

export function garantirInstalacao() {
  if (!pronto) {
    pronto = instalar().catch((e: Error) => {
      pronto = null;
      const onde = `${process.env["PGHOST"] || "?"}:${process.env["PGPORT"] || "5432"}`;
      const msg =
        `Não consegui usar o PostgreSQL em ${onde} (${e.message}). ` +
        "Confira se o PostgreSQL está instalado e rodando (Serviços do Windows › postgresql) " +
        "e se a porta e a senha do arquivo .env estão certas.";
      console.error("[sgo] " + msg);
      throw new Error(msg);
    });
  }
  return pronto;
}

async function instalar() {
  const sql = sgoSql();
  const [r] = await sql`select to_regclass('sgo.usuarios') is not null as ok`;
  if (!r?.["ok"]) {
    console.info("[sgo] criando o banco do SGO (schema sgo)…");
    const pasta = resolve(process.cwd(), "sgo/banco");
    const arquivos = (await readdir(pasta)).filter((f) => /^\d{2}-.*\.sql$/.test(f)).sort();
    for (const f of arquivos) await sql.unsafe(await readFile(join(pasta, f), "utf8"));
    console.info("[sgo] banco do SGO criado. Entre com superadmin / trocar123.");
  }
  const { ensureSchema } = await import("@/db/schema");
  await ensureSchema();
  await garantirExtrasUsuarios(sql);
  await copiarArquivosIniciais();
}

/** Colunas/tabelas de Usuários: comprador, frota, multi-setor, ver/usar e transições OS. */
async function garantirExtrasUsuarios(sql: ReturnType<typeof sgoSql>) {
  await sql.unsafe(`
    do $$ begin
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'sgo' and table_name = 'usuarios' and column_name = 'comprador'
      ) then
        alter table sgo.usuarios add column comprador bigint not null default 0;
      end if;
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'sgo' and table_name = 'usuario_permissoes' and column_name = 'nivel'
      ) then
        alter table sgo.usuario_permissoes add column nivel text not null default 'usar';
        update sgo.usuario_permissoes set nivel = 'usar' where nivel is null or nivel = '';
      end if;
    end $$;
  `);
  await sql.unsafe(`
    create table if not exists sgo.usuario_veiculos (
      usuario_id bigint not null references sgo.usuarios(id) on delete cascade,
      vehicle_id bigint not null,
      primary key (usuario_id, vehicle_id)
    );
  `);
  await sql.unsafe(`
    create table if not exists sgo.usuario_setores (
      usuario_id bigint not null references sgo.usuarios(id) on delete cascade,
      setor_id text not null references sgo.setores(id),
      primary key (usuario_id, setor_id)
    );
  `);
  // Separado do CREATE: o driver postgres.js pode executar só o 1º statement em unsafe().
  await sql.unsafe(`
    insert into sgo.usuario_setores (usuario_id, setor_id)
      select u.id, u.setor_id from sgo.usuarios u
      where u.setor_id is not null and u.setor_id <> ''
        and not exists (
          select 1 from sgo.usuario_setores x
          where x.usuario_id = u.id and x.setor_id = u.setor_id
        );
  `);
  await sql.unsafe(`
    create table if not exists sgo.usuario_os_transicoes (
      usuario_id bigint not null references sgo.usuarios(id) on delete cascade,
      de smallint not null check (de between 0 and 7),
      para smallint not null check (para between 0 and 7),
      primary key (usuario_id, de, para)
    );
  `);
  // Módulos já existentes no React: tira "Em breve" do menu/cadastro de usuários.
  await sql.unsafe(`
    update sgo.menu_itens
    set destino = 'novo',
        url = case id
          when 'cob-venc' then coalesce(nullif(url, ''), '/vencimentos')
          when 'cob-notif' then coalesce(nullif(url, ''), '/notificacoes')
          when 'cob-alertas' then coalesce(nullif(url, ''), '/settings')
          when 'mon-contas' then coalesce(nullif(url, ''), '/contratos')
          when 'op-facilities' then coalesce(nullif(url, ''), '/facilities')
          when 'op-terceiros' then coalesce(nullif(url, ''), '/terceiros')
          when 'op-uniformes' then coalesce(nullif(url, ''), '/uniformes')
          when 'op-frota' then coalesce(nullif(url, ''), '/frota')
          else url
        end
    where id in (
      'cob-venc','cob-notif','cob-alertas','mon-contas',
      'op-facilities','op-terceiros','op-uniformes','op-frota'
    )
      and (destino is distinct from 'novo' or url is null or url = '')
  `);
}

async function copiarArquivosIniciais() {
  const destino = resolve(process.cwd(), process.env["SGO_ARQUIVOS_DIR"] || "data/arquivos");
  const origem = resolve(process.cwd(), "sgo/arquivos-iniciais");
  let vazio = true;
  try {
    vazio = (await readdir(destino)).length === 0;
  } catch {
    vazio = true;
  }
  if (!vazio) return;
  try {
    await mkdir(destino, { recursive: true });
    await cp(origem, destino, { recursive: true });
    console.info("[sgo] arquivos iniciais copiados para", destino);
  } catch (e) {
    console.error("[sgo] não foi possível copiar os arquivos iniciais:", e);
  }
}
