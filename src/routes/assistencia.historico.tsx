import { createFileRoute } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";
import { HistoricoOs } from "@/sgo/telas/os/HistoricoOs";
import estilo from "@/sgo/telas/os/estilo.css?url";

export const Route = createFileRoute("/assistencia/historico")({
  beforeLoad: exigirLogin,
  ssr: false,
  head: () => ({ links: [{ rel: "stylesheet", href: estilo }] }),
  component: HistoricoOs,
});
