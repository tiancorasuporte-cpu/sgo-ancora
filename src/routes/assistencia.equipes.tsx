import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/equipes";

/** SGO Âncora — Assistência Técnica · Equipes técnicas. */
export const Route = createFileRoute("/assistencia/equipes")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} />,
});
