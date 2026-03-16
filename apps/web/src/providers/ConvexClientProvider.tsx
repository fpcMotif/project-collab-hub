"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

const ConvexEnabledContext = createContext(false);

export function useConvexEnabled() {
  return useContext(ConvexEnabledContext);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <ConvexEnabledContext.Provider value={false}>
        {children}
      </ConvexEnabledContext.Provider>
    );
  }

  return (
    <ConvexEnabledContext.Provider value>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </ConvexEnabledContext.Provider>
  );
}
