import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});

const invalidLogin = { ok: false as const, error: "Usuário ou senha inválidos." };

export const loginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const { isDatabaseConfigured } = await import("@/db/client");
    if (!isDatabaseConfigured()) {
      return { ok: false as const, error: "Configure o banco de dados antes de entrar." };
    }
    const { authenticateUser } = await import("@/db/users");
    const { getAuthSession } = await import("@/server/session");

    const user = await authenticateUser(data.username, data.password);
    if (!user) return invalidLogin;

    const session = await getAuthSession();
    await session.update({ userId: user.id });
    return { ok: true as const, user };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getAuthSession } = await import("@/server/session");
  const session = await getAuthSession();
  await session.clear();
  return { ok: true as const };
});

/**
 * SGO Âncora: o usuário logado é o da sessão do SGO (cookie `sgo_sessao`).
 * As telas do sistema base recebem um AppUser equivalente (ver src/sgo/server/sessao.ts).
 */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { isDatabaseConfigured } = await import("@/db/client");
  if (!isDatabaseConfigured()) return null;
  const { getRequest } = await import("@tanstack/react-start/server");
  const { usuarioSgo, appUserDoSgo } = await import("@/sgo/server/sessao");
  const eu = await usuarioSgo(getRequest());
  if (!eu) return null;
  return appUserDoSgo(eu);
});
