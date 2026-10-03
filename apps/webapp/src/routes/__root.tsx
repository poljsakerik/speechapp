import { COMMON_NS } from "@/core/i18n";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { useTranslation } from "react-i18next";

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
  errorComponent: RouteError,
});

function RootLayout() {
  const { t: translate } = useTranslation([COMMON_NS]);
  return (
    <TooltipProvider delayDuration={200}>
      <Outlet />
      <Toaster
        position="bottom-right"
        containerAriaLabel={translate("common:notifications")}
        toastOptions={{
          closeButtonAriaLabel: translate("common:closeNotification"),
        }}
      />
    </TooltipProvider>
  );
}

function NotFound() {
  const { t: translate } = useTranslation([COMMON_NS]);
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-wide text-3xl font-bold">
        {translate("common:rootPageNotFound")}
      </h1>
      <p className="mt-4 text-ink-2">
        {translate("common:rootStartANewReviewByUploadingYourRecording")}
      </p>
      <Button asChild className="mt-6">
        <Link to="/upload">{translate("common:rootUploadARecording")}</Link>
      </Button>
    </main>
  );
}

function RouteError({ reset }: ErrorComponentProps) {
  const { t } = useTranslation(COMMON_NS);
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-wide text-3xl font-bold">{t("unexpectedError")}</h1>
      <p className="mt-4 text-ink-2">{t("unexpectedErrorDescription")}</p>
      <Button className="mt-6" onClick={reset}>
        {t("retry")}
      </Button>
    </main>
  );
}
