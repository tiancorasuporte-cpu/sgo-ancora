import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/crm";

/** SGO Âncora — Comercial · Relatórios comerciais. */
export const Route = createFileRoute("/comercial/relatorios")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} busca={"?tab=rel" + (typeof location !== "undefined" && location.search ? "&" + location.search.slice(1) : "")} />,
});
