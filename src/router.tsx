import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 min — evita refetch ao trocar de aba
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega rotas ao passar o mouse/tocar nos links — navegação instantânea
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30 * 1000,
    defaultPreloadDelay: 50,
  });

  return router;
};
