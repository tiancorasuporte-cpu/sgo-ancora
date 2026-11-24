import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/crm";

/** SGO Âncora — Comercial · Comissões. */
export const Route = createFileRoute("/comercial/comissoes")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} busca={"?tab=com" + (typeof location !== "undefined" && location.search ? "&" + location.search.slice(1) : "")} />,
});
