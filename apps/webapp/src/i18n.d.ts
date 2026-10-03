import type { resources } from "./core/i18n/resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    keySeparator: false;
    returnNull: false;
    strictKeyChecks: true;
    resources: typeof resources.en;
  }
}
