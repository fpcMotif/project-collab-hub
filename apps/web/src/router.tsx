/// <reference types="vite/client" />
import { ConvexQueryClient } from "@convex-dev/react-query";
import {
  MutationCache,
  QueryClient,
  notifyManager,
} from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";

import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/components/not-found";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  if (typeof document !== "undefined") {
    notifyManager.setScheduler(window.requestAnimationFrame);
  }

  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

  const convexQueryClient = CONVEX_URL
    ? new ConvexQueryClient(CONVEX_URL)
    : null;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        ...(convexQueryClient && {
          queryFn: convexQueryClient.queryFn(),
          queryKeyHashFn: convexQueryClient.hashFn(),
        }),
      },
    },
    mutationCache: new MutationCache(),
  });

  convexQueryClient?.connect(queryClient);

  const router = createRouter({
    Wrap: ({ children }: { children: ReactNode }) => {
      if (convexQueryClient) {
        return (
          <ConvexProvider client={convexQueryClient.convexClient}>
            {children}
          </ConvexProvider>
        );
      }
      return <>{children}</>;
    },
    context: { queryClient },
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
