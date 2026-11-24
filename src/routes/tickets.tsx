import { createFileRoute } from "@tanstack/react-router";

import { TelaDc } from "@/sgo/components/TelaDc";
import { exigirLogin } from "@/sgo/lib/guarda";
import { montar } from "@/sgo/telas/tickets/logica.js";
import { TicketsView } from "@/sgo/telas/tickets/TicketsView";
import estilo from "@/sgo/telas/tickets/estilo.css?url";

/** SGO Âncora — Central de Tickets. */
export const Route = createFileRoute("/tickets")({
  beforeLoad: exigirLogin,
  ssr: false,
  head: () => ({ links: [{ rel: "stylesheet", href: estilo }] }),
  component: () => <TelaDc montar={montar} View={TicketsView} />,
});
