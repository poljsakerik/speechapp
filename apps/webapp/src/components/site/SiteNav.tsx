import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
  { hash: "foundations", label: "Foundations" },
  { hash: "retake", label: "The retake" },
  { hash: "promises", label: "Promises" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
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
        className="mx-auto flex h-14 max-w-[1320px] items-center gap-8 px-4 sm:px-6 lg:px-10"
        aria-label="Main"
      >
        <Link to="/" className="rounded-sm" aria-label="MicMane home">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-6 text-[0.8125rem] font-medium text-ink-2 md:flex">
          {LINKS.map((l) => (
            <li key={l.hash}>
              <Link
                to="/"
                hash={l.hash}
                className="transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/upload">Try a free review</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Open menu"
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-xs">
              <SheetHeader>
                <SheetTitle>MicMane</SheetTitle>
                <SheetDescription>
                  Hear yourself the way they hear you.
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
                      Components
                    </Link>
                  </SheetClose>
                </li>
              </ul>
              <div className="p-4">
                <SheetClose asChild>
                  <Button asChild className="w-full" size="lg">
                    <Link to="/upload">Try a free review</Link>
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
