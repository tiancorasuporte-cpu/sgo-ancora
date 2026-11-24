import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/crm";

/** SGO Âncora — Comercial · CRM. */
export const Route = createFileRoute("/comercial/crm")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} />,
});
