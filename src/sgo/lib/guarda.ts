import { redirect } from "@tanstack/react-router";

import type { AppUser } from "@/db/schema";

/** Exige sessão do SGO; sem sessão, vai para /login e volta depois. */
export function exigirLogin({ context, location }: { context: { user: AppUser | null }; location: { href: string } }) {
  if (!context.user) throw redirect({ href: "/login?volta=" + encodeURIComponent(location.href) });
}
