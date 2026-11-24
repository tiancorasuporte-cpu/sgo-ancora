import { createFileRoute } from "@tanstack/react-router";

import { ModuloSgo } from "@/sgo/components/ModuloSgo";
import { exigirLogin } from "@/sgo/lib/guarda";

/** SGO Âncora — Ramais VoIP (softphone dos operadores). */
export const Route = createFileRoute("/voip")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <ModuloSgo modulo="voip" />,
});
