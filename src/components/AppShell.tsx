/**
 * SGO Âncora — as telas do sistema base continuam chamando <AppShell>, mas a casca
 * agora é a do SGO (src/sgo/components/SgoShell.tsx), montada uma vez no __root.
 * Aqui o AppShell só repassa o conteúdo e liga a busca do topo à tela.
 * O AppShell original está em referencia/sistema-base-substituido/components/.
 */
import { useEffect, type ReactNode } from "react";

import { useSgo } from "@/sgo/components/SgoShell";

export function useShellSearch() {
  const { busca, setBusca } = useSgo();
  return { query: busca, setQuery: setBusca };
}

export function AppShell({
  children,
  searchPlaceholder = "Buscar...",
}: {
  children: ReactNode;
  mobileTitle: string;
  searchPlaceholder?: string;
  fullHeight?: boolean;
}) {
  const { registrarBusca } = useSgo();
  useEffect(() => {
    registrarBusca(searchPlaceholder);
    return () => registrarBusca(null);
  }, [registrarBusca, searchPlaceholder]);
  return <div className="sgo-tela-base">{children}</div>;
}
