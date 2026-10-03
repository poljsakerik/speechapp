import { i18n, t } from "@/core/i18n";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { router } from "@/router";

export default function App() {
  const { i18n: locale } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? "en";
    document.documentElement.dir = i18n.dir();
    document.title = t("common:metadataTitle");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("common:metadataDescription"));
  }, [locale.language]);
  return <RouterProvider router={router} />;
}
