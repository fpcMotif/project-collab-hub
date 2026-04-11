import type { QueryClient } from "@tanstack/react-query";
/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import appCss from "@/styles/app.css?url";

const RootComponent = () => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body className="font-sans antialiased">
      <Outlet />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
  head: () => ({
    links: [{ href: appCss, rel: "stylesheet" }],
    meta: [
      { charSet: "utf8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "Project Collab Hub" },
      {
        content: "Feishu-native collaborative project management hub",
        name: "description",
      },
    ],
  }),
});
