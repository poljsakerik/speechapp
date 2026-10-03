import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CloudOffIcon, UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/brand/Mark";
import { FeedbackView } from "@/components/feedback/FeedbackView";
import { TryReview } from "@/components/try/TryReview";
import type { ReviewResult } from "@/lib/api";
import { trpc } from "@/lib/trpc";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@micmane/ui/components/alert";
import { Button } from "@micmane/ui/components/button";

// A down service should show a warning, not hold the page through retries.
const healthQuery = trpc.health.get.queryOptions(undefined, {
  retry: false,
  staleTime: 30_000,
});

export const Route = createFileRoute("/_protected/upload")({
  loader: ({ context: { queryClient } }) =>
    queryClient.prefetchQuery(healthQuery),
  component: Upload,
});

function Upload() {
  const [result, setResult] = useState<ReviewResult>();
  const { isError: offline, data: health } = useQuery(healthQuery);

  // Development only: /upload?fixture opens the review screen on the sample take.
  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      !new URLSearchParams(window.location.search).has("fixture")
    )
      return;
    void import("@/data/review-fixture").then(({ REVIEW_FIXTURE }) =>
      setResult(REVIEW_FIXTURE),
    );
  }, []);

  useEffect(() => {
    if (!result) return;
    window.scrollTo({ top: 0 });
    return () => {
      if (result.audioUrl.startsWith("blob:"))
        URL.revokeObjectURL(result.audioUrl);
    };
  }, [result]);

  if (result) {
    return (
      <main className="min-h-svh">
        <FeedbackView
          take={result.take}
          review={result.review}
          audioSrc={result.audioUrl}
          voiceDemo={health?.demo}
          action={
            <Button
              size="sm"
              aria-label="Upload another take"
              className="bg-on-graphite text-graphite-deep hover:bg-white max-sm:size-8 max-sm:px-0"
              onClick={() => setResult(undefined)}
            >
              <UploadIcon />
              <span className="max-sm:hidden">Another take</span>
            </Button>
          }
          footer={
            <p className="text-[0.8125rem] leading-5 text-ink-3">
              This is AI feedback and it can be wrong. Listen back to the
              passage before you act on a note.
            </p>
          }
        />
      </main>
    );
  }

  return (
    <>
      <header className="mx-auto flex h-14 max-w-[1440px] items-center px-4 sm:px-6 lg:px-10">
        <Link to="/" aria-label="MicMane home" className="rounded-sm">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-[1440px] flex-col justify-center px-4 pt-8 pb-24 sm:px-6 lg:px-10">
        {offline && (
          <Alert className="mb-10 max-w-2xl">
            <CloudOffIcon />
            <AlertTitle>The review service can't be reached</AlertTitle>
            <AlertDescription>
              You can still record a take. Send it once the service is back.
            </AlertDescription>
          </Alert>
        )}
        <TryReview uploadFirst onReviewed={setResult} />
      </main>
    </>
  );
}
