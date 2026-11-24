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
  await copiarArquivosIniciais();
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
