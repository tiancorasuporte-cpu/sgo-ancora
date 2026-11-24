import { createFileRoute } from "@tanstack/react-router";

import { exigirLogin } from "@/sgo/lib/guarda";
import { ChecklistConfig } from "@/sgo/telas/os/ChecklistConfig";
import estilo from "@/sgo/telas/os/estilo.css?url";

export const Route = createFileRoute("/assistencia/checklists")({
  beforeLoad: exigirLogin,
  ssr: false,
  head: () => ({ links: [{ rel: "stylesheet", href: estilo }] }),
  component: ChecklistConfig,
});
