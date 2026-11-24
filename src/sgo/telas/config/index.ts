/** Tela "config" do SGO (isolada): marcação, estilo e lógica originais. */
import type { DefTela } from "@/sgo/components/TelaIsolada";

import logica from "./logica.js?raw";
import marcacao from "./marcacao.html?raw";
import meta from "./meta.json";
import estilo from "./estilo.css?raw";

export const tela: DefTela = { id: "config", endereco: "/telas/config", marcacao, estilo, logica, meta };
