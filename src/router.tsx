import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { RoutePending } from "./components/RoutePending";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, user: null },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Sem pendingComponent o Outlet mantém a tela anterior enquanto a URL/título
    // já mudaram — conteúdo “preso” e item do menu piscando amarelo.
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
