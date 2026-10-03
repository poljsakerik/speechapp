import i18next from "i18next";
import Backend from "i18next-fetch-backend";
import { initReactI18next } from "react-i18next";
import { resources, supportedLanguages } from "./resources.ts";

export const COMMON_NS = "common";
export const PUBLIC_WEBSITE_NS = "publicWebsite";
export const REVIEW_NS = "review";
export const COMPONENTS_NS = "components";
export const VALIDATION_NS = "validation";

const options = {
  defaultNS: COMMON_NS,
  ns: [COMMON_NS, PUBLIC_WEBSITE_NS, REVIEW_NS, COMPONENTS_NS, VALIDATION_NS],
  supportedLngs: supportedLanguages,
  fallbackLng: "en",
  lng: "en",
  keySeparator: false as const,
  interpolation: { escapeValue: false },
};

// Leksoro's setup: fetch namespace files in the browser, bundle them for SSR/tests.
// English is the only supplied locale; add catalogs and supportedLanguages together.
export const initialized =
  (import.meta.env?.SSR ?? typeof window === "undefined")
    ? i18next
        .use(initReactI18next)
        .init({ ...options, resources, initAsync: false })
    : i18next
        .use(Backend)
        .use(initReactI18next)
        .init({
          ...options,
          backend: {
            loadPath: `/locales/{{lng}}/{{ns}}.json${import.meta.env.VITE_COMMIT_SHA ? `?v=${import.meta.env.VITE_COMMIT_SHA}` : ""}`,
          },
        });

export { i18next as i18n };
export default i18next;
// Pure data formatters also translate at read time; React views use useTranslation.
export const t = i18next.t.bind(i18next);
type Catalogs = typeof resources.en;
export type TranslationKey = {
  [NS in keyof Catalogs]: `${NS}:${keyof Catalogs[NS] & string}`;
}[keyof Catalogs];

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(
    i18next.resolvedLanguage ?? "en",
    options,
  ).format(value);
}
export function formatList(
  values: string[],
  type: "conjunction" | "disjunction" = "conjunction",
) {
  return new Intl.ListFormat(i18next.resolvedLanguage ?? "en", { type }).format(
    values,
  );
}
