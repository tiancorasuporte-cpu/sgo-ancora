import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/orcamentos";

/** SGO Âncora — Comercial · Orçamentos. */
export const Route = createFileRoute("/comercial/orcamentos")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} />,
});
