import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteError } from "@/components/route-error";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Ett misslyckat första anrop visas som felsida för sidan i stället
        // för en laddningsvy som aldrig blir klar. Misslyckas en omhämtning
        // visas den data som redan finns.
        throwOnError: (_error, query) => query.state.data === undefined,
        retry: 1,
        // Undvik att hämta om samma data vid varje fokus och sidbyte; efter
        // ändringar invalideras frågorna ändå.
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
  });

  return router;
};
