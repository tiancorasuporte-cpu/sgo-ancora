import { createFileRoute, redirect } from "@tanstack/react-router";

/** SGO Âncora: a raiz abre o Painel (sem sessão, o Painel manda para /login). */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/painel" });
  },
});
