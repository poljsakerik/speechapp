import { COMMON_NS, PUBLIC_WEBSITE_NS, t as translate } from "@/core/i18n";
import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Wordmark } from "@/components/brand/Mark";
import { Button } from "@micmane/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@micmane/ui/components/sheet";
import { cn } from "@micmane/ui/lib/utils";

const LINKS = [
  {
    hash: "sample",
    get label() {
      return translate("publicWebsite:sitenavTheExample");
    },
  },
  {
    hash: "lessons",
    get label() {
      return translate("publicWebsite:sitefooterLessons");
    },
  },
  {
    hash: "retake",
    get label() {
      return translate("publicWebsite:sitenavTheRetake");
    },
  },
  {
    hash: "promises",
    get label() {
      return translate("publicWebsite:sitenavPromises");
    },
  },
];

/** The section under the reading line, so the nav can light where you are. */
function useCurrentSection() {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.35;
      let found: string | null = null;
      for (const { hash } of LINKS) {
        const el = document.getElementById(hash);
        if (el && el.getBoundingClientRect().top <= line) found = hash;
      }
      setCurrent(found);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return current;
}

export function SiteNav() {
  const { t: translate } = useTranslation([COMMON_NS, PUBLIC_WEBSITE_NS]);
  const [scrolled, setScrolled] = useState(false);
  const current = useCurrentSection();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300",
        scrolled
          ? "border-line bg-[oklch(0.985_0.003_80/0.84)] backdrop-blur-md"
          : "border-transparent bg-paper",
      )}
    >
      <nav
        className="mx-auto flex h-14 max-w-[1440px] items-center gap-8 px-4 sm:px-6 lg:px-10"
        aria-label={translate("publicWebsite:sitenavMain")}
      >
        <Link
          to="/"
          className="rounded-sm"
          aria-label={translate("publicWebsite:sitenavMicmaneHome")}
        >
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-6 text-[0.8125rem] font-medium text-ink-2 md:flex">
          {LINKS.map((l) => (
            <li key={l.hash}>
              <Link
                to="/"
                hash={l.hash}
                aria-current={current === l.hash ? "location" : undefined}
                className={cn(
                  "relative py-1 transition-colors hover:text-ink",
                  current === l.hash &&
                    "text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-glass",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/upload">
              {translate("publicWebsite:sitefooterTryAFreeReview")}
            </Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label={translate("publicWebsite:sitenavOpenMenu")}
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent
              closeLabel={translate("common:close")}
              side="right"
              className="w-[85vw] max-w-xs"
            >
              <SheetHeader>
                <SheetTitle>{translate("common:markMicmane")}</SheetTitle>
                <SheetDescription>
                  {translate(
                    "publicWebsite:sitenavUnlockTheFullPotentialOfYourVoice",
                  )}
                </SheetDescription>
              </SheetHeader>
              <ul className="grid gap-1 px-4 text-base font-medium">
                {LINKS.map((l) => (
                  <li key={l.hash}>
                    <SheetClose asChild>
                      <Link to="/" hash={l.hash} className="block py-3">
                        {l.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
                <li>
                  <SheetClose asChild>
                    <Link to="/components" className="block py-3">
                      {translate("publicWebsite:sitefooterComponents")}
                    </Link>
                  </SheetClose>
                </li>
              </ul>
              <div className="p-4">
                <SheetClose asChild>
                  <Button asChild className="w-full" size="lg">
                    <Link to="/upload">
                      {translate("publicWebsite:sitefooterTryAFreeReview")}
                    </Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
