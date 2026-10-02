import { TRPCClientError } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";

import {
  normalizeReview,
  type Review,
  type Segment,
  type Take,
} from "@/lib/review";
import type { AppRouter } from "@micmane/backend";

type ReviewResponse = inferRouterOutputs<AppRouter>["review"]["create"];

export type ReviewResult = { take: Take; review: Review; audioUrl: string };

type ReviewErrorKind =
  "busy" | "format" | "size" | "speech" | "offline" | "failed";

const MESSAGES: Record<ReviewErrorKind, string> = {
  busy: "The coach is busy right now. Wait a minute and send the take again.",
  format:
    "That file type isn't supported. Use a WAV, MP3, M4A, MP4 or WebM recording.",
  size: "That file is larger than 25 MB. Trim it to the minute you want reviewed.",
  speech:
    "The coach couldn't hear enough speech in that take. Record closer to the mic and try again.",
  offline:
    "The review service can't be reached. Check your connection and try again.",
  failed:
    "The review couldn't be completed. Your take wasn't saved; send it again.",
};

/** What to tell the speaker when `review.create` fails. */
export function reviewErrorMessage(error: unknown): string {
  if (!(error instanceof TRPCClientError)) return MESSAGES.failed;
  const status: number | undefined =
    error.data?.httpStatus ??
    (error.meta?.response as Response | undefined)?.status;
  const kind: ReviewErrorKind =
    status === undefined
      ? "offline"
      : status === 429
        ? "busy"
        : status === 415
          ? "format"
          : status === 413
            ? "size"
            : status === 422
              ? "speech"
              : status === 502 || status === 504
                ? "offline"
                : "failed";
  return MESSAGES[kind];
}

/** Turn the `review.create` response for `recording` into what the editor draws. The caller owns the audio URL. */
export async function toReviewResult(
  data: ReviewResponse,
  recording: Blob,
): Promise<ReviewResult> {
  // The review is of the file sent, so it plays and is drawn from that.
  const take = await measureTake(recording, data.segments);
  return {
    take,
    review: normalizeReview(data.review, take.segments),
    audioUrl: URL.createObjectURL(recording),
  };
}

/** Draw the reviewed excerpt: waveform and recorded level from the audio, pauses from word timings. */
export async function measureTake(
  audio: Blob,
  segments: Segment[],
  bins = 480,
): Promise<Take> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await audio.arrayBuffer());
    const data = buffer.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / bins));
    const peaks: number[] = [];
    const volume: number[] = [];
    for (let b = 0; b < bins; b++) {
      let peak = 0;
      let sum = 0;
      for (let i = b * size; i < Math.min((b + 1) * size, data.length); i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
        sum += v * v;
      }
      peaks.push(peak);
      volume.push(Math.sqrt(sum / size));
    }
    const maxPeak = Math.max(...peaks, 1e-6);
    const maxVol = Math.max(...volume, 1e-6);
    const pauses: Take["pauses"] = [];
    const words = segments.flatMap((s) => s.words);
    for (let i = 1; i < words.length; i++) {
      if (words[i].start - words[i - 1].end >= 0.3)
        pauses.push({ start: words[i - 1].end, end: words[i].start });
    }
    return {
      duration: buffer.duration,
      peaks: peaks.map((p) => p / maxPeak),
      volume: volume.map((v) => v / maxVol),
      pauses,
      segments,
    };
  } finally {
    void context.close();
  }
}
