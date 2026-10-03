import { PUBLIC_WEBSITE_NS } from "@/core/i18n";
import { Link } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";

import { Wordmark } from "@/components/brand/Mark";

export function SiteFooter() {
  const { t: translate } = useTranslation([PUBLIC_WEBSITE_NS]);
  return (
    <footer className="bg-paper">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pt-8 pb-14 sm:px-6 md:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-[44ch] text-sm text-ink-2">
            {translate(
              "publicWebsite:sitefooterVocalSystemsForPeopleWhoWantToBe",
            )}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <li>
            <Link className="hover:text-ink" to="/" hash="lessons">
              {translate("publicWebsite:sitefooterLessons")}
            </Link>
          </li>
          <li>
            <Link className="hover:text-ink" to="/upload">
              {translate("publicWebsite:sitefooterTryAFreeReview")}
            </Link>
          </li>
          <li>
            <Link className="hover:text-ink" to="/components">
              {translate("publicWebsite:sitefooterComponents")}
            </Link>
          </li>
        </ul>
        <div className="pt-6 text-[0.75rem] leading-relaxed text-ink-3 md:col-span-2">
          <p className="max-w-[90ch]">
            {translate(
              "publicWebsite:sitefooterTheSampleTakeIsReadByASynthetic",
            )}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4">
            <span>
              {translate("publicWebsite:sitefooter2026MicmaneVocalSystems")}
            </span>
            <span>
              <Trans
                t={translate}
                i18nKey="publicWebsite:footerCatalog"
                values={{
                  catalog: translate("publicWebsite:sitefooterMmv001"),
                }}
                components={{ catalog: <span className="font-mono tabular" /> }}
              />
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
