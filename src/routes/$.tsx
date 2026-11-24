import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { exigirLogin } from "@/sgo/lib/guarda";
import { ROTAS } from "@/sgo/lib/rotas";

/**
 * SGO Âncora — demais endereços:
 *  - /em-breve/<item>: página "Em breve";
 *  - reserva: tela do SGO sem rota própria abre a página original (pasta de arquivos);
 *  - página não encontrada.
 */
export const Route = createFileRoute("/$")({
  beforeLoad: exigirLogin,
  ssr: false,
  component: Pagina,
});

function Pagina() {
  const { _splat } = Route.useParams();
  const caminho = "/" + (_splat || "");
  const meta = ROTAS[caminho];
  if (caminho.startsWith("/em-breve/")) return <EmBreve />;
  if (meta?.frame) return <TelaServida frame={meta.frame} titulo={meta.titulo} />;
  return <NaoEncontrada />;
}

function EmBreve() {
  return (
    <section className="soon-page" aria-labelledby="soon-t">
      <span className="soon-badge">Em breve</span>
      <h2 id="soon-t">{typeof document !== "undefined" ? document.getElementById("page-title")?.textContent : ""}</h2>
      <p>Esta tela ainda está sendo construída no novo SGO. Assim que for publicada, ela abre direto por aqui.</p>
      <a className="btn-adv" href="/painel" data-link="" style={{ textDecoration: "none" }}>
        Voltar ao Painel
      </a>
    </section>
  );
}

function NaoEncontrada() {
  return (
    <section className="soon-page">
      <h2>Página não encontrada</h2>
      <a className="btn-adv" href="/painel" data-link="" style={{ textDecoration: "none" }}>
        Ir para o Painel
      </a>
    </section>
  );
}

function TelaServida({ frame, titulo }: { frame: string; titulo: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const busca = typeof location !== "undefined" ? location.search : "";
  const src = frame + (busca ? (frame.indexOf("?") < 0 ? "?" : "&") + busca.slice(1) : "");
  useEffect(() => {
    const ajustar = () => {
      const f = ref.current;
      if (f) f.style.height = Math.max(480, window.innerHeight - f.getBoundingClientRect().top - window.scrollY) + "px";
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [src]);
  return <iframe ref={ref} className="frame" title={titulo} src={src} />;
}
