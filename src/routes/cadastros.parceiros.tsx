import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/cadastros";

/** SGO Âncora — Cadastros · Clientes e fornecedores. */
export const Route = createFileRoute("/cadastros/parceiros")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} busca={"?tipo=parceiros" + (typeof location !== "undefined" && location.search ? "&" + location.search.slice(1) : "")} />,
});
