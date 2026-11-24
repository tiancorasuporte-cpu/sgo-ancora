import { createFileRoute } from "@tanstack/react-router";

import { ModuloSgo } from "@/sgo/components/ModuloSgo";
import { exigirLogin } from "@/sgo/lib/guarda";

/** SGO Âncora — Usuários (acessos, setores e permissões). */
export const Route = createFileRoute("/usuarios")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <ModuloSgo modulo="usuarios" />,
});
