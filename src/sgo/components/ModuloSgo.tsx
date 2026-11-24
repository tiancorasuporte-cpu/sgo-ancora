/**
 * SGO Âncora — monta um módulo da casca (Usuários, Ramais VoIP) na área da tela.
 * Os módulos são o código original do SGO (src/sgo/telas/<modulo>/modulo.js), carregados pela casca.
 */
import { useEffect, useRef } from "react";

import { useSgo } from "@/sgo/components/SgoShell";
import { api, avisar, esc } from "@/sgo/lib/api";

type Fn = (el: HTMLElement, ctx: unknown) => void;

export function ModuloSgo({ modulo }: { modulo: "usuarios" | "voip" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { eu } = useSgo();
  useEffect(() => {
    let vivo = true;
    const tentar = () => {
      const f = (window as unknown as { SGO_TELAS?: Record<string, Fn> }).SGO_TELAS?.[modulo];
      if (!f) {
        if (vivo) setTimeout(tentar, 100);
        return;
      }
      if (ref.current && vivo) f(ref.current, { eu, api, esc, avisar });
    };
    tentar();
    return () => {
      vivo = false;
    };
  }, [modulo, eu]);
  // conteúdo controlado pelo módulo do SGO (não pelo React)
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: '<div class="loading">Carregando…</div>' }} />;
}
