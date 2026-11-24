import { createFileRoute, redirect } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";

/** Operações · Estoque → tela React (saldo, PDV, equipes). */
export const Route = createFileRoute("/operacoes/estoque")({
  beforeLoad: (ctx) => {
    exigirLogin(ctx);
    throw redirect({ to: "/estoque", search: { tab: "empresa" } });
  },
});
