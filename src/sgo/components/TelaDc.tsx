/**
 * SGO Âncora — monta uma tela "dc" (lógica original + marcação gerada) dentro da casca.
 */
import { useEffect, type ComponentType } from "react";

import { useSgo } from "@/sgo/components/SgoShell";
import { useTelaDc } from "@/sgo/lib/dc";
import type { SgoEu } from "@/sgo/lib/api";
import buscaCadastros from "@/sgo/telas/_comum/busca-cadastros.js?raw";

type Montar = Parameters<typeof useTelaDc>[0];

declare global {
  interface Window {
    SGOBusca?: { ligar: (el: Element, cfg: unknown) => void; varrer: (root: ParentNode) => void };
  }
}

function garantirSgoBusca() {
  if (typeof window === "undefined" || window.SGOBusca) return;
  // Mesmo padrão da TelaIsolada: executa o IIFE do autocomplete de cadastros.
  // eslint-disable-next-line no-new-func
  new Function(buscaCadastros)();
}

export function TelaDc({ montar, View }: { montar: Montar; View: ComponentType<{ v: Record<string, unknown> }> }) {
  const { eu } = useSgo();
  const st = useTelaDc(montar, eu as SgoEu | null);

  useEffect(() => {
    garantirSgoBusca();
    window.SGOBusca?.varrer(document);
  }, [st.fase]);

  if (st.fase === "carregando")
    return <div style={{ padding: 40, font: "500 15px Inter,system-ui,sans-serif", color: "#5A5A5A" }}>Carregando…</div>;
  if (st.fase === "erro")
    return (
      <div style={{ padding: 40, font: "500 15px Inter,system-ui,sans-serif", color: "#B3261E" }}>
        Não foi possível carregar os dados: {st.erro}
      </div>
    );
  return <View v={st.vals || {}} />;
}
