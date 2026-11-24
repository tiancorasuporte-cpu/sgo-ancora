/**
 * SGO Âncora — ponte de sessão.
 *
 * O login é o do SGO (cookie `sgo_sessao`, tabela sgo.usuarios). As telas que vieram
 * do sistema base (Vencimentos, Notificações, Facilities, Terceiros, Uniformes,
 * Frota, Contratos) esperam um `AppUser` da tabela `public.users`: aqui o usuário
 * do SGO é espelhado nessa tabela, com os módulos equivalentes às permissões dele.
 */
import "@tanstack/react-start/server-only";

import type { AppModuleId, AppUser } from "@/db/schema";
import { D1Pg, sgoSql } from "./d1";
import { R2Local } from "./r2";

/** Permissão do SGO (id do item de menu) → módulo(s) do sistema base. */
export const MODULOS_POR_PERMISSAO: Record<string, AppModuleId[]> = {
  "cob-venc": ["vencimentos"],
  "cob-notif": ["notificacoes"],
  "op-facilities": ["facilities"],
  "op-terceiros": ["terceiros", "terceiros_checar"],
  "op-uniformes": ["uniformes"],
  "op-frota": ["frota"],
  "op-compras": ["compras"],
  "com-crm": ["crm"],
  "com-crm-rel": ["crm"],
  "com-comissoes": ["crm", "crm_comissoes"],
  "com-orc": ["orcamentos"],
  "com-leads": ["crm"],
  "mon-contas": ["contratos", "contratos_valores"],
};

type UsuarioSgo = {
  id: number;
  login: string;
  nome: string;
  perfil: string;
  vendedor?: boolean | number;
  comprador?: boolean | number;
  veiculos_ids?: number[];
  permissoes: string[];
};

let env: { DB: D1Pg; FOTOS: R2Local } | null = null;

export async function usuarioSgo(request: Request): Promise<UsuarioSgo | null> {
  const { garantirInstalacao } = await import("./instalar");
  await garantirInstalacao();
  if (!env) env = { DB: new D1Pg(), FOTOS: new R2Local() };
  const mod = (await import("./worker.js")) as unknown as {
    usuarioDaSessao: (r: Request, e: unknown) => Promise<UsuarioSgo | null>;
  };
  try {
    return await mod.usuarioDaSessao(request, env);
  } catch (e) {
    console.error("[sgo] sessão", e);
    return null;
  }
}

export function ehAdminSgo(u: Pick<UsuarioSgo, "perfil">) {
  return u.perfil === "superadmin" || u.perfil === "administrador";
}

const espelhados = new Map<number, string>();

/** Converte o usuário do SGO em AppUser e mantém o espelho em public.users. */
export async function appUserDoSgo(u: UsuarioSgo): Promise<AppUser> {
  const admin = ehAdminSgo(u);
  const isVendedor = !!u.vendedor;
  const isComprador = !!u.comprador;
  const modulos = new Set<AppModuleId>();
  for (const p of u.permissoes) for (const m of MODULOS_POR_PERMISSAO[p] ?? []) modulos.add(m);
  // Flags de perfil liberam os módulos mesmo se o item de menu não estiver marcado à mão.
  if (isVendedor) {
    modulos.add("crm");
    modulos.add("orcamentos");
  }
  if (isComprador) modulos.add("compras");
  const veiculos = (u.veiculos_ids ?? []).map(Number).filter((n) => n > 0);
  const user: AppUser = {
    id: u.id,
    username: u.login,
    name: u.nome,
    role: u.perfil === "superadmin" ? "superadmin" : admin ? "admin" : "operator",
    active: true,
    modules: [...modulos],
    isTecnico: u.perfil === "tecnico",
    isComprador,
    isVendedor,
    defaultVehicleId: veiculos[0] ?? null,
  };
  const assinatura = JSON.stringify({ ...user, veiculos });
  if (espelhados.get(u.id) !== assinatura) {
    const sql = sgoSql();
    await sql`
      insert into public.users (
        id, username, password_hash, name, role, active, modules,
        is_tecnico, is_comprador, is_vendedor, default_vehicle_id
      )
      values (
        ${user.id}, ${"sgo:" + user.username}, ${"!sgo"}, ${user.name}, ${user.role}, true,
        ${JSON.stringify(user.modules)}, ${user.isTecnico}, ${user.isComprador}, ${user.isVendedor},
        ${user.defaultVehicleId}
      )
      on conflict (id) do update set
        username = excluded.username, name = excluded.name, role = excluded.role, active = true,
        modules = excluded.modules, is_tecnico = excluded.is_tecnico,
        is_comprador = excluded.is_comprador, is_vendedor = excluded.is_vendedor,
        default_vehicle_id = excluded.default_vehicle_id
    `;
    await sql`delete from public.user_vehicles where user_id = ${user.id}`.catch(() => undefined);
    for (const vid of veiculos) {
      await sql`
        insert into public.user_vehicles (user_id, vehicle_id)
        values (${user.id}, ${vid})
        on conflict do nothing
      `.catch(() => undefined);
    }
    await sql`select setval(pg_get_serial_sequence('public.users','id'), greatest((select max(id) from public.users), 1))`.catch(
      () => undefined,
    );
    espelhados.set(u.id, assinatura);
  }
  return user;
}
