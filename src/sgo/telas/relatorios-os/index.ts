/** Tela "relatorios-os" do SGO (isolada): marcação, estilo e lógica originais. */
import type { DefTela } from "@/sgo/components/TelaIsolada";

import logica from "./logica.js?raw";
import marcacao from "./marcacao.html?raw";
import meta from "./meta.json";
import estilo from "./estilo.css?raw";

export const tela: DefTela = { id: "relatorios-os", endereco: "/telas/relatorios-os", marcacao, estilo, logica, meta };
