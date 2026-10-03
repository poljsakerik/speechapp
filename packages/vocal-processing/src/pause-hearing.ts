/**
 * How a pause, or the lack of one, sounds: an audio model (gemini.ts) hears
 * the moment with its lead-in and what follows.
 *
 * A transcript with pause lengths can't tell a pause held for effect from one
 * spent searching for words, or a sentence that rushes into the next from one
 * the voice clearly finishes. Reading text alone, the pause review called
 * "You're not a [0.2 s] fake [0.3 s] pianist" a broken thought and asked for a
 * pause at nearly every sentence end of a tightly edited talk. So what the
 * text model proposes is kept only where it also sounds that way:
 * - a pause that breaks a thought must sound hesitant: 74% of an untrained
 *   bad take's did, 27% of its good retake's and 14-35% of the coach's;
 * - a missing pause must sound like the words run on: the coach's rushed,
 *   constant-pace and run-on demonstrations all did, and 8 of 20 places in
 *   one of his edited videos;
 * - a pause worth praising must sound deliberate (pause-strength.ts).
 */
import { wav, type AudioJudgment } from "./gemini.ts";
import type { Timed } from "./pause.ts";

export type Audio = { samples: Float32Array; sampleRate: number };
export type PauseSound = "deliberate" | "hesitant" | "ordinary";
export const HEARING_VERSION = 1;
/** Seconds of context around the moment: the lead-in and what follows. */
const BEFORE = 6,
  AFTER = 2.5;

/** What the audio model is asked about one pause, `at` seconds into its clip. */
export function hearingPrompt(at: number, seconds: number, before: string) {
  return `You are a speaking coach. Listen to this clip. At ${at.toFixed(1)} seconds into it, right after the words "${before}", the speaker pauses for ${seconds.toFixed(1)} seconds. Judge only that pause, from how the voice sounds before and after it:
- "deliberate": a controlled, confident stop the speaker chose, so the words before it land or the words after it hit harder.
- "hesitant": the speaker sounds like they are searching for words, unsure, or losing their thread.
- "ordinary": an ordinary break between thoughts, neither.
Reply with JSON only.`;
}
export const HEARING_SCHEMA = {
  type: "OBJECT",
  properties: {
    pause: { type: "STRING", enum: ["deliberate", "hesitant", "ordinary"] },
  },
  required: ["pause"],
};

/** What the audio model is asked about a place with no pause, `at` seconds into its clip. */
export function runOnPrompt(at: number, before: string) {
  return `You are a speaking coach. Listen to this clip. At ${at.toFixed(1)} seconds into it, right after the words "${before}", the speaker goes on without a real pause. Judge only that moment, from how it sounds:
- "runs_on": the words rush straight on into the next thought, so the listener gets no moment to take in what was just said.
- "clear": the voice clearly finishes the thought (it slows, falls or lands the last word) and the next one starts cleanly; the listener can follow without a longer pause.
Reply with JSON only.`;
}
export const RUN_ON_SCHEMA = {
  type: "OBJECT",
  properties: {
    moment: { type: "STRING", enum: ["runs_on", "clear"] },
  },
  required: ["moment"],
};

const said = (words: Timed[], first: number, last: number) =>
  words
    .slice(first, last + 1)
    .map((w) => w.text)
    .join(" ");
const clip = ({ samples, sampleRate }: Audio, from: number, to: number) =>
  wav(
    samples.subarray(
      Math.round(Math.max(0, from) * sampleRate),
      Math.round(Math.min(samples.length / sampleRate, to) * sampleRate),
    ),
    sampleRate,
  );

/** How the pause of `seconds` after word `at` sounds; the lead-in starts at word `first`. */
export async function hearPause(
  words: Timed[],
  at: number,
  seconds: number,
  audio: Audio,
  judge: AudioJudgment,
  first = Math.max(0, at - 5),
): Promise<PauseSound | undefined> {
  const pause = words[at].end,
    from = Math.max(0, Math.max(words[first].start, pause - BEFORE) - 0.3);
  const reply = (await judge({
    prompt: hearingPrompt(pause - from, seconds, said(words, first, at)),
    schema: HEARING_SCHEMA,
    wav: clip(audio, from, pause + seconds + AFTER),
  })) as { pause?: unknown };
  return ["deliberate", "hesitant", "ordinary"].includes(reply?.pause as string)
    ? (reply.pause as PauseSound)
    : undefined;
}

/** Whether the words run on after word `at`, where a pause was called for. */
export async function hearsRunOn(
  words: Timed[],
  at: number,
  audio: Audio,
  judge: AudioJudgment,
): Promise<boolean> {
  const end = words[at].end,
    from = Math.max(0, end - BEFORE);
  const reply = (await judge({
    prompt: runOnPrompt(end - from, said(words, Math.max(0, at - 5), at)),
    schema: RUN_ON_SCHEMA,
    wav: clip(audio, from, end + AFTER + 0.5),
  })) as { moment?: unknown };
  return reply?.moment === "runs_on";
}
