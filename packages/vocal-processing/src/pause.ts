/**
 * Pause measurement. Timing only measures where the speaker paused and for how
 * long; whether a pause fits, is missing, or is too short or too long is a
 * judgment about meaning, made in pause-review.ts.
 *
 * Pauses must be measured from the audio: recognizer timestamps hide about
 * half of them.
 */
import { mergePauses } from "./pace.ts";
import type { Pause } from "./pauses.ts";
import type { Word } from "./types.ts";

export type PauseRule =
  | "PAUSE_NECESSARY"
  | "PAUSE_TOO_SHORT"
  | "PAUSE_UNNECESSARY"
  | "PAUSE_TOO_LONG";
/** `at` lists the words the finding is about: the pause after each of them is missing, too short, out of place or too long. */
export type PauseMark = {
  first: number;
  last: number;
  start: number;
  end: number;
  text: string;
  rule: PauseRule;
  at: number[];
};
export const PAUSE_VERSION = 6;
/** Any silence this long is a pause, as in findPauses; shorter gaps are mostly consonant closures. */
export const PAUSE_SECONDS = 0.2;

export type Timed = Word & { start: number; end: number };

/** True when every word has valid, increasing timing. */
export function timed(words: Word[]): words is Timed[] {
  return (
    words.length >= 2 &&
    words.every(
      (w, i) =>
        Number.isFinite(w.start) &&
        Number.isFinite(w.end) &&
        w.end! > w.start! &&
        (!i || w.start! >= words[i - 1].start!),
    )
  );
}

/**
 * Seconds of silence after each word: measured pauses plus timestamp gaps,
 * assigned to the word before their midpoint, since recognizers stretch words
 * over them.
 */
export function pauseAfterWords(
  words: Timed[],
  pauses: Pause[],
  minSeconds = PAUSE_SECONDS,
): number[] {
  const silence = mergePauses([
    ...pauses,
    ...words
      .slice(1)
      .flatMap((w, i) =>
        w.start - words[i].end >= minSeconds
          ? [{ start: words[i].end, end: w.start }]
          : [],
      ),
  ]);
  const after = words.map(() => 0);
  for (const p of silence) {
    if (p.end - p.start < minSeconds) continue;
    const i = words.findLastIndex((w) => w.start < (p.start + p.end) / 2);
    if (i >= 0 && i < words.length - 1) after[i] += p.end - p.start;
  }
  return after;
}
