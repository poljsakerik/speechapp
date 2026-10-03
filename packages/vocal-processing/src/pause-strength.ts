/**
 * Pauses that do real work: the ones a speaking coach would hold up as a
 * model to copy, not the ones that merely fit.
 *
 * The course gives two jobs a pause does. After a key point, a striking claim
 * or a question, it gives the listener time to process what was said ("Notice
 * how you're processing what I just said?", 2.2 s, in the pause lesson).
 * Before a reveal or the key word, it makes the listener lean in for what comes
 * next ("guess what you can do? [1.7 s] You can breathe."). Two models judge:
 * - Where: whether a pause sits where it can do either job is a judgment about
 *   meaning, made from the text before anyone speaks it: the delivery map
 *   (delivery-map.ts) marks the few moments to hold. A pause of 0.6 s or more at
 *   one of them can be a strength; a shorter one is a breath.
 * - How it sounds: text can't tell a pause held for effect from one spent
 *   searching for words, and a text model asked about each held pause praised
 *   36-42% of them, in the coach's lessons and untrained talks alike. An audio
 *   model hears each candidate in context (pause-hearing.ts) and keeps it only
 *   if it sounds deliberate.
 * The caller also drops a strength the pause review faults (too short, too
 * long, or breaking a thought). A strength is a moment to point at, so at most
 * two a minute are named, the longest-held first: the coach's lessons have
 * about four a minute that qualify.
 *
 * Without a map, audio and a hearing of every candidate, no pause strengths
 * are reported.
 */
import type { PauseSound } from "./pause-hearing.ts";
import type { MarkedPause } from "./pause-review.ts";
import type { PauseMark, PauseRule, Timed } from "./pause.ts";

export const PAUSE_STRENGTHS = [
  // After a key point, a striking claim or a question: the listener has time to take it in.
  "PAUSE_LETS_IT_LAND",
  // Before a reveal, an answer or the key word: the listener leans in.
  "PAUSE_BUILDS_ANTICIPATION",
] as const;
export type PauseStrength = (typeof PAUSE_STRENGTHS)[number];
/** `at` is the word the pause follows; the span covers the phrases on either side of it. */
export type PauseStrengthMark = {
  first: number;
  last: number;
  start: number;
  end: number;
  text: string;
  rule: PauseStrength;
  at: number;
  seconds: number;
};
export const PAUSE_STRENGTH_VERSION = 3;
export const DEFAULT_PAUSE_STRENGTH_CONFIG = {
  minSeconds: 0.6, // Shorter pauses are breaths and ordinary phrasing; the course's examples hold 0.9-2.2 s.
  sounds: ["deliberate"] as PauseSound[], // What the audio model must hear in a proposed pause.
  perMinute: 2, // At most this many are named per minute, the longest-held first...
  atLeast: 2, // ...and a short take may still have this many.
  wordsBefore: 5, // The highlight reaches this many words back from the pause, or to the pause before it...
  wordsAfter: 6, // ...and this many words on, or to the next pause.
};
export type PauseStrengthConfig = typeof DEFAULT_PAUSE_STRENGTH_CONFIG;

/** The work a held pause does. */
export type Work = "lets_it_land" | "builds_anticipation";
const RULES: Record<Work, PauseStrength> = {
  lets_it_land: "PAUSE_LETS_IT_LAND",
  builds_anticipation: "PAUSE_BUILDS_ANTICIPATION",
};

/**
 * The pause after word `at` as a strength. The highlight runs from the phrase
 * before the pause to the phrase after it, a few words each way.
 */
export function proposeStrength(
  words: Timed[],
  marked: MarkedPause[],
  { after: at, seconds }: MarkedPause,
  work: Work,
  config: Partial<PauseStrengthConfig> = {},
): PauseStrengthMark {
  const c = { ...DEFAULT_PAUSE_STRENGTH_CONFIG, ...config };
  const breaks = new Set(marked.map((p) => p.after));
  let first = at,
    last = at + 1;
  while (first > 0 && at - first < c.wordsBefore && !breaks.has(first - 1))
    first--;
  while (
    last < words.length - 1 &&
    last - at < c.wordsAfter &&
    !breaks.has(last)
  )
    last++;
  return {
    first,
    last,
    start: words[first].start,
    end: words[last].end,
    text: words
      .slice(first, last + 1)
      .map((w) => w.text)
      .join(" "),
    rule: RULES[work],
    at,
    seconds,
  };
}

/** A talk full of good pauses gets its longest-held ones named, not every one; in the order they were spoken. */
export function nameStrengths(
  words: Timed[],
  strengths: PauseStrengthMark[],
  config: Partial<PauseStrengthConfig> = {},
): PauseStrengthMark[] {
  const c = { ...DEFAULT_PAUSE_STRENGTH_CONFIG, ...config };
  const minutes = (words.at(-1)!.end - words[0].start) / 60,
    most = Math.max(c.atLeast, Math.round(minutes * c.perMinute));
  return [...strengths]
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, most)
    .sort((a, b) => a.at - b.at);
}

/**
 * Whether the pause review faults a pause inside a strength's words, before
 * its last: a pause called out of place, too short or too long undoes a pause
 * strength, and a hesitation breaking up a slowed phrase means it wasn't a
 * highlight.
 */
export function faulted(
  strength: { first: number; last: number },
  marks: PauseMark[] | undefined,
  rules: PauseRule[],
) {
  return !!marks?.some(
    (m) =>
      rules.includes(m.rule) &&
      m.at.some((i) => i >= strength.first && i < strength.last),
  );
}
