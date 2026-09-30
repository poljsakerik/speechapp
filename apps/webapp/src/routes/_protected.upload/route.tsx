import { createFileRoute } from "@tanstack/react-router"

import { SiteFooter } from "@/components/site/SiteFooter"
import { TryReview } from "@/components/try/TryReview"

export const Route = createFileRoute("/_protected/upload")({
  component: Upload,
})

function Upload() {
  return (
    <>
      <main className="mx-auto min-h-svh max-w-[1320px] px-4 py-12 sm:px-6 sm:py-20 lg:px-10">
        <h1 className="font-wide text-[clamp(2.5rem,4.5vw,4.25rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
          Upload your recording.
        </h1>
        <div className="mt-10">
          <TryReview uploadFirst />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
