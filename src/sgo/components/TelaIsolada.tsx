/**
 * SGO Âncora — componente que monta uma tela "isolada" do SGO (ver src/sgo/lib/tela-isolada.ts).
 * A tela fica num Shadow DOM: mesmo visual da página original, sem misturar estilos com a casca.
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import buscaCadastros from "@/sgo/telas/_comum/busca-cadastros.js?raw";
import { carregarScript, criarAmbiente, type Ambiente } from "@/sgo/lib/tela-isolada";

export type DefTela = {
  /** identificador (ex.: "crm") */
  id: string;
  /** endereço virtual da página original (ex.: "/telas/crm") */
  endereco: string;
  marcacao: string;
  estilo: string;
  logica: string;
  meta: { bibliotecas: string[]; buscaCadastros: boolean; classeCorpo: string; folhasExternas: string[] };
};

const NOMES: (keyof Ambiente)[] = [
  "document",
  "window",
  "self",
  "location",
  "history",
  "parent",
  "top",
  "setInterval",
  "setTimeout",
  "clearInterval",
  "clearTimeout",
  "requestAnimationFrame",
  "MutationObserver",
];

/** Executa o código original da tela com o ambiente dela (como se estivesse na própria página). */
function executar(codigo: string, amb: Ambiente, nome: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function(...NOMES, codigo + "\n//# sourceURL=sgo-tela-" + nome + ".js");
  f.apply(amb.window, NOMES.map((n) => amb[n]));
}

const BASE = ":host{display:block;position:relative}.sgo-corpo{min-height:100%}";

export function TelaIsolada({ def, busca }: { def: DefTela; busca?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [erro, setErro] = useState("");
  const consulta = busca ?? (typeof location !== "undefined" ? location.search : "");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const raiz = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    raiz.innerHTML = "";
    const st = document.createElement("style");
    st.textContent = BASE + "\n" + def.estilo;
    raiz.appendChild(st);
    const corpo = document.createElement("div");
    corpo.className = ("sgo-corpo " + def.meta.classeCorpo).trim();
    corpo.innerHTML = def.marcacao;
    raiz.appendChild(corpo);

    // fontes extras da página original (ficam na página para valer também no Shadow DOM)
    for (const href of def.meta.folhasExternas) {
      if (!document.querySelector('link[data-sgo-fonte="' + href + '"]')) {
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = href;
        l.setAttribute("data-sgo-fonte", href);
        document.head.appendChild(l);
      }
    }

    const endereco = def.endereco + (consulta && consulta !== "?" ? (def.endereco.includes("?") ? "&" + consulta.slice(1) : consulta) : "");
    const { amb, desmontar } = criarAmbiente({
      host,
      raiz,
      corpo,
      endereco,
      navegar: (u) => void router.navigate({ href: u }),
    });
    let vivo = true;
    // bibliotecas (jsPDF etc.): se alguma falhar, a tela abre mesmo assim (só o recurso dela fica indisponível)
    Promise.allSettled(def.meta.bibliotecas.map(carregarScript))
      .then(() => {
        if (!vivo) return;
        executar(def.logica, amb, def.id);
        if (def.meta.buscaCadastros) executar(buscaCadastros, amb, def.id + "-busca");
      })
      .catch((e: Error) => vivo && setErro(e.message));

    return () => {
      vivo = false;
      desmontar();
      raiz.innerHTML = "";
    };
    // a tela é montada de novo quando muda o endereço (ex.: aba ?tab=rel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, consulta]);

  if (erro) return <div className="erro">Não foi possível abrir a tela: {erro}</div>;
  return <div ref={hostRef} className="sgo-tela-host" data-tela={def.id} />;
}
