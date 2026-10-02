import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@micmane/backend";

import { Button } from "@micmane/ui/components/button";
import { Toaster } from "@micmane/ui/components/sonner";
import { TooltipProvider } from "@micmane/ui/components/tooltip";

export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <TooltipProvider delayDuration={200}>
      <Outlet />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-wide text-3xl font-bold">Page not found.</h1>
      <p className="mt-4 text-ink-2">
        Start a new review by uploading your recording.
      </p>
      <Button asChild className="mt-6">
        <Link to="/upload">Upload a recording</Link>
      </Button>
    </main>
  );
}
