import { createFileRoute } from "@tanstack/react-router";

import { TelaIsolada } from "@/sgo/components/TelaIsolada";
import { exigirLogin } from "@/sgo/lib/guarda";
import { tela } from "@/sgo/telas/cadastros";

/** SGO Âncora — Cadastros · Serviços mensais. */
export const Route = createFileRoute("/cadastros/servicos")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: () => <TelaIsolada def={tela} busca={"?tipo=servicos" + (typeof location !== "undefined" && location.search ? "&" + location.search.slice(1) : "")} />,
});
