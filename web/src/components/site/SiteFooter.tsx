import { Link } from "react-router-dom"

import { Wordmark } from "@/components/brand/Mark"

export function SiteFooter() {
  return (
    <footer className="bg-paper">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 pt-8 pb-14 sm:px-6 md:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-[44ch] text-sm text-ink-2">Vocal systems for people who want to be heard.</p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <li><a className="hover:text-ink" href="/#foundations">Foundations</a></li>
          <li><a className="hover:text-ink" href="/#try">Try a free review</a></li>
          <li><Link className="hover:text-ink" to="/components">Components</Link></li>
        </ul>
        <div className="pt-6 text-[0.75rem] leading-relaxed text-ink-3 md:col-span-2">
          <p className="max-w-[90ch]">
            The sample take is read by a synthetic voice, and its review was written by hand in the format MicMane
            returns. Reviews of your own takes are AI feedback: check them against your recording before you rely on
            them.
          </p>
          <p className="mt-3">© 2026 MicMane Vocal Systems</p>
        </div>
      </div>
    </footer>
  )
}
