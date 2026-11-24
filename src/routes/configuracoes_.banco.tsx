import { createFileRoute, redirect } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";

/** Tela de banco removida — redireciona para Integrações e APIs. */
export const Route = createFileRoute("/configuracoes_/banco")({
  beforeLoad: (ctx) => {
    exigirLogin(ctx);
    throw redirect({ to: "/configuracoes/integracoes" });
  },
});
