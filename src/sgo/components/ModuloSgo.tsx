/**
 * SGO Âncora — monta um módulo da casca (Usuários, Ramais VoIP) na área da tela.
 * Os módulos são o código original do SGO (src/sgo/telas/<modulo>/modulo.js), carregados pela casca.
 *
 * Importante: o conteúdo do DOM é controlado pelo módulo (innerHTML), NÃO pelo React.
 * Por isso este componente não usa dangerouslySetInnerHTML — senão qualquer re-render
 * (ex.: digitar na busca do topo) apaga a tela e volta para "Carregando…".
 */
import { useEffect, useRef } from "react";

import { useSgoBase } from "@/sgo/components/SgoShell";
import { api, avisar, esc } from "@/sgo/lib/api";

type Fn = (el: HTMLElement, ctx: unknown) => void;

export function ModuloSgo({ modulo }: { modulo: "usuarios" | "voip" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { eu } = useSgoBase();

  useEffect(() => {
    const el = ref.current;
    if (!el || !eu) return;

    let vivo = true;
    let tentativas = 0;
    el.innerHTML = '<div class="loading">Carregando…</div>';

    const montar = () => {
      if (!vivo || !ref.current) return false;
      const f = (window as unknown as { SGO_TELAS?: Record<string, Fn> }).SGO_TELAS?.[modulo];
      if (!f) return false;
      f(ref.current, { eu, api, esc, avisar });
      return true;
    };

    const tentar = () => {
      if (!vivo) return;
      if (montar()) return;
      tentativas += 1;
      if (tentativas > 80) {
        if (ref.current) {
          ref.current.innerHTML =
            '<div class="erro">Não foi possível carregar este módulo. Recarregue a página.</div>';
        }
        return;
      }
      setTimeout(tentar, 100);
    };

    const onReload = () => {
      tentativas = 0;
      if (ref.current) ref.current.innerHTML = '<div class="loading">Carregando…</div>';
      tentar();
    };

    window.addEventListener("sgo-modulos", onReload);
    tentar();
    return () => {
      vivo = false;
      window.removeEventListener("sgo-modulos", onReload);
    };
  }, [modulo, eu]);

  return <div ref={ref} />;
}
