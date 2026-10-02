import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloudOffIcon, UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
  const { isError: offline } = useQuery(healthQuery);

  useEffect(() => {
    if (!result) return;
    window.scrollTo({ top: 0 });
    return () => URL.revokeObjectURL(result.audioUrl);
  }, [result]);

  if (result) {
    return (
      <main className="min-h-svh">
        <FeedbackView
          take={result.take}
          findings={result.review.findings}
          assessments={result.review.assessments}
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
              This is AI feedback and it can be wrong. Listen back to the
              passage before you act on a note.
            </p>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-svh max-w-[1320px] px-4 py-12 sm:px-6 sm:py-20 lg:px-10">
      <h1 className="font-wide text-[clamp(2.5rem,4.5vw,4.25rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
        Upload your recording.
      </h1>
      {offline && (
        <Alert className="mt-8 max-w-2xl">
          <CloudOffIcon />
          <AlertTitle>The review service can't be reached</AlertTitle>
          <AlertDescription>
            You can still record a take. Send it once the service is back.
          </AlertDescription>
        </Alert>
      )}
      <div className="mt-10">
        <TryReview uploadFirst onReviewed={setResult} />
      </div>
    </main>
  );
}
