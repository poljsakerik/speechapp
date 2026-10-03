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
 *   meaning. A text model reads the whole transcript with every measured pause
 *   marked in place, as in the pause review (pause-review.ts), and judges each
 *   pause of 0.6 s or more: a shorter one is a breath.
 * - How it sounds: text can't tell a pause held for effect from one spent
 *   searching for words, and the text model alone praised 36-42% of held
 *   pauses, in the coach's lessons and untrained talks alike. An audio model
 *   (gemini.ts) hears each candidate in context and keeps it only if it
 *   sounds deliberate: 90% of the coach's candidates and 41% of untrained
 *   speakers', 18% of whose it heard as hesitant.
 * The caller also drops a strength the pause review faults (too short, too
 * long, or breaking a thought). A strength is a moment to point at, so at most
 * two a minute are named, the longest-held first: the coach's lessons have
 * about four a minute that qualify.
 *
 * Separate requests from the pause review, so its prompt and benchmark stay as
 * measured. Without both models, audio and complete replies, no pause
 * strengths are reported.
 */
import { createHash } from "node:crypto";
import type { AudioJudgment } from "./gemini.ts";
import {
  hearPause,
  type Audio,
  type HearingConfig,
  type PauseSound,
} from "./pause-hearing.ts";
import {
  confirmedPauses,
  reviewParts,
  type MarkedPause,
} from "./pause-review.ts";
import {
  pauseAfterWords,
  timed,
  type PauseMark,
  type PauseRule,
} from "./pause.ts";
import type { Pause } from "./pauses.ts";
import type { JsonCompletion, Word } from "./types.ts";

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
export const PAUSE_STRENGTH_VERSION = 2;
export const DEFAULT_PAUSE_STRENGTH_CONFIG = {
  minSeconds: 0.6, // Shorter pauses are breaths and ordinary phrasing; the course's examples hold 0.9-2.2 s.
  sounds: ["deliberate"] as PauseSound[], // What the audio model must hear in a proposed pause.
  perMinute: 2, // At most this many are named per minute, the longest-held first...
  atLeast: 2, // ...and a short take may still have this many.
  wordsBefore: 5, // The highlight reaches this many words back from the pause, or to the pause before it...
  wordsAfter: 6, // ...and this many words on, or to the next pause.
};
export type PauseStrengthConfig = typeof DEFAULT_PAUSE_STRENGTH_CONFIG;

type Verdict = "lets_it_land" | "builds_anticipation" | "ordinary";
const RULES: Record<Exclude<Verdict, "ordinary">, PauseStrength> = {
  lets_it_land: "PAUSE_LETS_IT_LAND",
  builds_anticipation: "PAUSE_BUILDS_ANTICIPATION",
};

export const STRENGTH_SYSTEM = `You coach spoken delivery, the way a speaking coach marks up a recording, and you are looking for the few pauses worth praising. You get the transcript of a real recording as numbered words. Every pause the speaker made is marked in place, like [P3 0.8s] (pause 3, lasting 0.8 seconds), right after the word it follows. Some of the pauses are listed for you to judge. For each listed pause, give one verdict:
- "lets_it_land": the words just before it are a line meant to land: the main point of the passage, a striking claim or number, a punchline, or a question the listener is meant to think about. The silence gives the listener time to take it in.
- "builds_anticipation": the speaker has set up something and pauses just before delivering it: the answer to a question they just asked, a reveal, a punchline, or the last item a list was building to. The listener leans in.
- "ordinary": anything else. That includes a pause after an ordinary statement, even an important one, a breath, a pause between list items or around an aside, a pause that fits but does no special work, and one that breaks up a thought, hesitates, or sounds like the speaker is searching for words.
Most pauses are ordinary, including most good ones; a whole talk usually has only a few that a speaking coach would single out as a model to copy. When in doubt, say "ordinary". The punctuation comes from speech recognition and can be wrong.`;
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["pauses"],
  properties: {
    pauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "verdict"],
        properties: {
          id: { type: "integer" },
          verdict: {
            type: "string",
            enum: ["lets_it_land", "builds_anticipation", "ordinary"],
          },
        },
      },
    },
  },
};

/** One request judges the candidate pauses after words [from, to]; the whole transcript is always included. */
export function strengthRequest(
  words: Word[],
  marked: MarkedPause[],
  candidates: number[],
  [from, to] = [0, words.length - 1],
) {
  const id = new Map(marked.map((p, k) => [p.after, k]));
  const transcript = words
    .map(
      (w, i) =>
        `${i}:${w.text}${id.has(i) ? ` [P${id.get(i)} ${marked[id.get(i)!].seconds.toFixed(1)}s]` : ""}`,
    )
    .join(" ");
  const asked = candidates.filter(
    (k) => marked[k].after >= from && marked[k].after <= to,
  );
  const cacheKey = `pause-strength-${createHash("sha256").update(transcript).digest("hex").slice(0, 32)}`;
  return {
    system: STRENGTH_SYSTEM,
    user: `Transcript:\n${transcript}\n\nJudge these pauses: ${asked.map((k) => `P${k}`).join(", ")}`,
    schema,
    schemaName: "pause_strengths",
    cacheKey,
    asked,
  };
}

/** The verdict for every pause asked about, or undefined when the reply leaves one unjudged. */
export function parseStrengths(
  reply: unknown,
  asked: number[],
): Map<number, Verdict> | undefined {
  const items = (reply as { pauses?: { id?: unknown; verdict?: unknown }[] })
    ?.pauses;
  if (!Array.isArray(items)) return undefined;
  const verdicts = new Map(
    items.map((p) => [p?.id as number, p?.verdict as Verdict]),
  );
  return asked.every((k) =>
    ["lets_it_land", "builds_anticipation", "ordinary"].includes(
      verdicts.get(k) as string,
    ),
  )
    ? new Map(asked.map((k) => [k, verdicts.get(k)!]))
    : undefined;
}

/**
 * The pauses in a take that do real work. `recognized` is the recognizer's
 * timing for the same words when `words` were re-aligned: a pause whose place
 * the two timings disagree on isn't judged. Undefined without timing, either
 * model or a complete reply.
 */
export async function findPauseStrengths(
  words: Word[],
  pauses: Pause[],
  audio: Audio,
  complete?: JsonCompletion,
  judge?: AudioJudgment,
  recognized?: Word[],
  config: Partial<PauseStrengthConfig> = {},
  hearing: Partial<HearingConfig> = {},
): Promise<PauseStrengthMark[] | undefined> {
  const c = { ...DEFAULT_PAUSE_STRENGTH_CONFIG, ...config };
  if (!timed(words) || !complete || !judge) return undefined;
  const marked = pauseAfterWords(words, pauses).flatMap((seconds, i) =>
    seconds > 0 ? [{ after: i, seconds }] : [],
  );
  const sure = new Set(
    (recognized ? confirmedPauses(words, recognized, marked) : marked).map(
      (p) => p.after,
    ),
  );
  const candidates = marked.flatMap((p, k) =>
    p.seconds >= c.minSeconds && sure.has(p.after) ? [k] : [],
  );
  if (!candidates.length) return [];
  const parts = reviewParts(words, marked).filter(([from, to]) =>
    candidates.some((k) => marked[k].after >= from && marked[k].after <= to),
  );
  // A part with an incomplete reply is asked once more; failing that, no strengths are reported.
  const replies = await Promise.all(
    parts.map(async (part) => {
      const { asked, ...request } = strengthRequest(
        words,
        marked,
        candidates,
        part,
      );
      for (const user of [
        request.user,
        `${request.user}\n\nAnswer every listed pause.`,
      ]) {
        try {
          const parsed = parseStrengths(
            await complete({ ...request, user }),
            asked,
          );
          if (parsed) return parsed;
        } catch {
          /* asked again below */
        }
      }
      return undefined;
    }),
  );
  if (replies.some((r) => !r)) return undefined;
  const verdicts = new Map(replies.flatMap((r) => [...r!]));
  // The highlight runs from the phrase before the pause to the phrase after it, at most 6 words each way.
  const breaks = new Set(marked.map((p) => p.after));
  const proposed = candidates.flatMap((k): PauseStrengthMark[] => {
    const verdict = verdicts.get(k);
    if (!verdict || verdict === "ordinary") return [];
    const at = marked[k].after;
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
    return [
      {
        first,
        last,
        start: words[first].start,
        end: words[last].end,
        text: words
          .slice(first, last + 1)
          .map((w) => w.text)
          .join(" "),
        rule: RULES[verdict],
        at,
        seconds: marked[k].seconds,
      },
    ];
  });
  // Each proposed pause is heard with its lead-in and what follows; any failed hearing fails them all.
  try {
    const heard = await Promise.all(
      proposed.map((s) =>
        hearPause(words, s.at, s.seconds, audio, judge, s.first, hearing),
      ),
    );
    // A talk full of good pauses gets its longest-held ones named, not every one.
    const minutes = (words.at(-1)!.end - words[0].start) / 60,
      most = Math.max(c.atLeast, Math.round(minutes * c.perMinute));
    return proposed
      .filter((_, i) => heard[i] && c.sounds.includes(heard[i]))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, most)
      .sort((a, b) => a.at - b.at);
  } catch {
    return undefined;
  }
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
