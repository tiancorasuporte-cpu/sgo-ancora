import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/cadastros";

/** SGO Âncora — Cadastros · Produtos. */
export const Route = createFileRoute("/cadastros/produtos")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} busca={"?tipo=produtos" + (typeof location !== "undefined" && location.search ? "&" + location.search.slice(1) : "")} />,
});
