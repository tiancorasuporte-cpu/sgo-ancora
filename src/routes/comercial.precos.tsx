import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/precos";

/** SGO Âncora — Comercial · Tabela de preços. */
export const Route = createFileRoute("/comercial/precos")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} />,
});
