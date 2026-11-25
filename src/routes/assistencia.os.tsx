import { createFileRoute } from "@tanstack/react-router";

import { TelaDc } from "@/sgo/components/TelaDc";
import { exigirLogin } from "@/sgo/lib/guarda";
import { montar } from "@/sgo/telas/os/logica.js";
import { QuadroOsView } from "@/sgo/telas/os/QuadroOsView";
import estilo from "@/sgo/telas/os/estilo.css?url";

/** SGO Âncora — Assistência Técnica · Quadro de OS. */
export const Route = createFileRoute("/assistencia/os")({
  beforeLoad: exigirLogin,
  ssr: false,
  head: () => ({ links: [{ rel: "stylesheet", href: estilo }] }),
  component: () => <TelaDc montar={montar} View={QuadroOsView} />,
});
