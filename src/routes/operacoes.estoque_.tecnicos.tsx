import { createFileRoute, redirect } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";

/** Operações · Estoque dos técnicos → aba Equipes da tela React. */
export const Route = createFileRoute("/operacoes/estoque_/tecnicos")({
  beforeLoad: (ctx) => {
    exigirLogin(ctx);
    throw redirect({ to: "/estoque", search: { tab: "equipes" } });
  },
});
