import common from "../../../public/locales/en/common.json" with { type: "json" };
import components from "../../../public/locales/en/components.json" with { type: "json" };
import publicWebsite from "../../../public/locales/en/publicWebsite.json" with { type: "json" };
import review from "../../../public/locales/en/review.json" with { type: "json" };
import validation from "../../../public/locales/en/validation.json" with { type: "json" };

export const resources = {
  en: { common, components, publicWebsite, review, validation },
} as const;
export const supportedLanguages = ["en"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
