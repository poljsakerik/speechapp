import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { UploadIcon } from "lucide-react"

import { FeedbackView } from "@/components/feedback/FeedbackView"
import { TryReview } from "@/components/try/TryReview"
import { Button } from "@micmane/ui/components/button"
import type { ReviewResult } from "@/lib/api"

export const Route = createFileRoute("/_protected/upload")({
  component: Upload,
})

function Upload() {
  const [result, setResult] = useState<ReviewResult>()

  useEffect(() => {
    if (!result) return
    window.scrollTo({ top: 0 })
    return () => URL.revokeObjectURL(result.audioUrl)
  }, [result])

  if (result) {
    return (
      <main className="min-h-svh">
        <FeedbackView
          take={result.take}
          findings={result.review.findings}
          audioSrc={result.audioUrl}
          action={
            <Button
              size="sm"
              aria-label="Upload another take"
              className="bg-on-graphite text-graphite-deep hover:bg-white max-sm:size-8 max-sm:px-0"
              onClick={() => setResult(undefined)}
            >
              <UploadIcon />
              <span className="max-sm:hidden">Upload another take</span>
            </Button>
          }
          footer={
            <p className="text-[0.8125rem] text-ink-3">
              This is AI feedback and it can be wrong. Listen back to the passage before you act on a note.
            </p>
          }
        />
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-svh max-w-[1320px] px-4 py-12 sm:px-6 sm:py-20 lg:px-10">
      <h1 className="font-wide text-[clamp(2.5rem,4.5vw,4.25rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
        Upload your recording.
      </h1>
      <div className="mt-10">
        <TryReview uploadFirst onReviewed={setResult} />
      </div>
    </main>
  )
}
