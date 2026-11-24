import { createFileRoute, redirect } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";

/** Configurações → Integrações e APIs. */
export const Route = createFileRoute("/configuracoes")({
  beforeLoad: (ctx) => {
    exigirLogin(ctx);
    throw redirect({ to: "/configuracoes/integracoes" });
  },
});
