/// <reference types="vite/client" />

export const useConvexEnabled = (): boolean =>
  !!import.meta.env.VITE_CONVEX_URL;
