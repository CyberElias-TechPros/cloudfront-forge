import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "./lib/api";

function retryQuery(failureCount: number, error: unknown): boolean {
  // Authentication, authorization, validation and rate-limit failures cannot be
  // repaired by an immediate replay. A transient network/5xx failure gets one
  // retry; the previous default retried each dashboard query three times and
  // amplified one backend incident into dozens of requests.
  if (error instanceof ApiError) {
    if (
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 422 ||
      error.status === 429
    ) {
      return false;
    }
  }
  return failureCount < 1;
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: retryQuery,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
