/**
 * SGO Âncora — monta uma tela "dc" (lógica original + marcação gerada) dentro da casca.
 */
import type { ComponentType } from "react";

import { useSgo } from "@/sgo/components/SgoShell";
import { useTelaDc } from "@/sgo/lib/dc";
import type { SgoEu } from "@/sgo/lib/api";

type Montar = Parameters<typeof useTelaDc>[0];

export function TelaDc({ montar, View }: { montar: Montar; View: ComponentType<{ v: Record<string, unknown> }> }) {
  const { eu } = useSgo();
  const st = useTelaDc(montar, eu as SgoEu | null);
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
