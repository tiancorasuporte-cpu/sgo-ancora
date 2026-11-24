import { createFileRoute, redirect } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";

/** Operações · Movimentações → tela React de estoque (histórico no saldo). */
export const Route = createFileRoute("/operacoes/estoque_/movimentacoes")({
  beforeLoad: (ctx) => {
    exigirLogin(ctx);
    throw redirect({ to: "/estoque", search: { tab: "empresa" } });
  },
});
