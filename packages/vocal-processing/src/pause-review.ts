/**
 * Pause review: the way a speaking coach marks up a recording. Timing measures
 * every real pause (pause.ts); a model reads the whole transcript with each
 * pause marked in place and judges it from meaning: it fits, breaks the
 * thought, is too short for the moment to land, or too long. For every
 * stretch said without a pause, it decides whether the listener needed one.
 *
 * No fixed syllable counts or durations decide anything: without a model the
 * pause review is not assessed.
 *
 * What the model reads isn't what a listener hears, so with an audio model its
 * two commonest findings are kept only where they also sound that way
 * (pause-hearing.ts): a pause that breaks the thought must sound hesitant, and
 * a missing pause must sound like the words run on.
 *
 * The same reply says what work each held pause does, and the same hearing
 * checks whether the ones worth praising sound deliberate (pause-strength.ts):
 * one reading of the transcript and one hearing per stretch of audio, so a
 * pause is never faulted by one request and praised by another.
 */
import { createHash } from "node:crypto";
import type { AudioJudgment } from "./gemini.ts";
import {
  hearingClips,
  hearMoments,
  type Audio,
  type HearingConfig,
  type Moment,
  type PauseSound,
} from "./pause-hearing.ts";
import {
  DEFAULT_PAUSE_STRENGTH_CONFIG,
  nameStrengths,
  proposeStrength,
  WORKS,
  type PauseStrengthConfig,
  type PauseStrengthMark,
  type Work,
} from "./pause-strength.ts";
import {
  pauseAfterWords,
  timed,
  type PauseMark,
  type PauseRule,
} from "./pause.ts";
import type { Pause } from "./pauses.ts";
import { syllables } from "./syllables.ts";
import type { JsonCompletion, Word } from "./types.ts";

export type Verdict = "fits" | "breaks" | "too_short" | "too_long";
export type MarkedPause = { after: number; seconds: number };

export const REVIEW_SYSTEM = `You coach spoken delivery, the way a speaking coach marks up a recording. You get the transcript of a real recording as numbered words. Every pause the speaker made is marked in place, like [P3 0.8s] (pause 3, lasting 0.8 seconds), right after the word it follows. Pauses give the listener time to take in what was said; judge them from the meaning of the whole recording.
1. For every marked pause, give one verdict:
- "fits": a fluent speaker could pause here, for about this long. That includes the end of an idea, after a key point or question, before a reveal or key word for effect, between list items, around an aside, between a long subject and its verb, and before a new clause. Most pauses fit. Very short pauses (under about half a second) are usually breaths or natural phrasing.
- "breaks": a clearly audible stop that interrupts a small unit that belongs together, so it sounds like hesitation or a lost thread: right after an article, preposition, possessive or auxiliary (the, a, of, to, my, is), inside a name, number or fixed phrase, or within a false start, restart or repeated word.
- "too_short": the place is right, but the moment needs time to sink in (a key point, a striking claim or number, a question put to the audience, a reveal) and this pause is too brief to let it land.
- "too_long": for this moment, the silence goes on so long that it stops sounding deliberate and the listener starts to wonder whether the speaker lost their place.
2. Then the stretches the speaker said without any pause are listed with their length. For each, decide whether the listener needed a pause inside it: because ideas blur together, or a key point, claim or question gets no time to land. Answer every listed stretch: give the indexes of the words a pause should follow, or an empty list when it needs none, as most do.
3. Some of the pauses are also listed as held. For each of those, say what work the pause does; you are looking for the few pauses worth praising:
- "lets_it_land": the words just before it are a line meant to land: the main point of the passage, a striking claim or number, a punchline, or a question the listener is meant to think about. The silence gives the listener time to take it in.
- "builds_anticipation": the speaker has set up something and pauses just before delivering it: the answer to a question they just asked, a reveal, a punchline, or the last item a list was building to. The listener leans in.
- "ordinary": anything else. That includes a pause after an ordinary statement, even an important one, a breath, a pause between list items or around an aside, a pause that fits but does no special work, and one that breaks up a thought, hesitates, or sounds like the speaker is searching for words.
Most pauses are ordinary, including most good ones; a whole talk usually has only a few that a speaking coach would single out as a model to copy. When in doubt, say "ordinary", and say "ordinary" for every pause not listed as held.
Many deliveries are valid. Only flag what a good speaking coach would clearly correct; when in doubt, leave it. The punctuation comes from speech recognition and can be wrong.`;
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["pauses", "stretches"],
  properties: {
    pauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "verdict", "work"],
        properties: {
          id: { type: "integer" },
          verdict: {
            type: "string",
            enum: ["fits", "breaks", "too_short", "too_long"],
          },
          work: { type: "string", enum: [...WORKS] },
        },
      },
    },
    stretches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "pause_after"],
        properties: {
          id: { type: "integer" },
          pause_after: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
};

/** Runs of words said without any pause, as [first, last] word indexes. */
export function stretches(
  words: Word[],
  marked: MarkedPause[],
): [number, number][] {
  const out: [number, number][] = [];
  let first = 0;
  for (const p of [...marked, { after: words.length - 1 }]) {
    out.push([first, p.after]);
    first = p.after + 1;
  }
  return out;
}

/**
 * What one part reviews: the pauses after words [from, to] and the stretches
 * inside it. Parts end at a pause, so that pause is the last one in its part.
 */
function covered(
  words: Word[],
  marked: MarkedPause[],
  [from, to]: [number, number],
) {
  return {
    pauses: marked.flatMap((p, k) =>
      p.after >= from && p.after <= to ? [k] : [],
    ),
    stretches: stretches(words, marked).flatMap(([a, b], k) =>
      a >= from && b <= to ? [k] : [],
    ),
  };
}

/**
 * One request reviews the pauses and stretches in words [from, to]; the whole
 * transcript is always included for context. Long lists made the model's
 * verdicts swing between runs, so takes are reviewed in parts. `held` are the
 * pauses long enough to be asked what work they do.
 */
export function reviewRequest(
  words: (Word & { start: number; end: number })[],
  marked: MarkedPause[],
  syllables: (text: string) => number,
  [from, to] = [0, words.length - 1],
  held: number[] = [],
) {
  const id = new Map(marked.map((p, k) => [p.after, k]));
  const transcript = words
    .map(
      (w, i) =>
        `${i}:${w.text}${id.has(i) ? ` [P${id.get(i)} ${marked[id.get(i)!].seconds.toFixed(1)}s]` : ""}`,
    )
    .join(" ");
  const part = covered(words, marked, [from, to]),
    runs = stretches(words, marked);
  const listed = part.stretches.map((k) => {
    const [a, b] = runs[k];
    return `S${k}: words ${a}-${b}, ${(words[b].end - words[a].start).toFixed(1)}s, ${words.slice(a, b + 1).reduce((n, w) => n + syllables(w.text), 0)} syllables`;
  });
  const ids = part.pauses.map((k) => `P${k}`),
    asked = part.pauses.filter((k) => held.includes(k)).map((k) => `P${k}`);
  // Every part starts with the same prompt and transcript, and the key sends them to the same cache.
  // Measured on gpt-6-luna, only a repeat of an identical request was served from it, not the shared start.
  const cacheKey = `pause-review-${createHash("sha256").update(transcript).digest("hex").slice(0, 32)}`;
  return {
    system: REVIEW_SYSTEM,
    user: `Transcript:\n${transcript}\n\nReview only words ${from}-${to}: pauses ${ids.length ? ids.join(", ") : "(none)"} and these stretches without a pause:\n${listed.join("\n")}\nHeld pauses to judge the work of: ${asked.length ? asked.join(", ") : "(none)"}`,
    schema,
    schemaName: "pause_review",
    cacheKey,
  };
}

/** Word ranges of about `size` words, cut at pauses so no stretch is split. */
export function reviewParts(
  words: Word[],
  marked: MarkedPause[],
  size = 120,
): [number, number][] {
  const parts: [number, number][] = [];
  let from = 0;
  for (const p of marked)
    if (p.after - from + 1 >= size) {
      parts.push([from, p.after]);
      from = p.after + 1;
    }
  if (from < words.length) parts.push([from, words.length - 1]);
  return parts;
}

/**
 * Verdicts for the pauses in words [from, to] (undefined outside it), the work
 * of the `held` ones among them and valid missing positions, or undefined when
 * the reply leaves a pause, its work or a stretch unjudged: silence about a
 * stretch is not evidence that it needs no pause.
 */
export function parseReview(
  words: Word[],
  marked: MarkedPause[],
  reply: unknown,
  [from, to] = [0, words.length - 1],
  held: number[] = [],
):
  | {
      verdicts: (Verdict | undefined)[];
      works: (Work | undefined)[];
      missing: number[];
    }
  | undefined {
  const data = reply as {
    pauses?: { id?: unknown; verdict?: unknown; work?: unknown }[];
    stretches?: { id?: unknown; pause_after?: unknown }[];
  };
  if (!Array.isArray(data?.pauses) || !Array.isArray(data?.stretches))
    return undefined;
  const part = covered(words, marked, [from, to]);
  const byId = new Map(data.pauses.map((p) => [p?.id, p?.verdict]));
  const verdicts = marked.map((_, k) =>
    part.pauses.includes(k) ? byId.get(k) : undefined,
  );
  if (
    part.pauses.some(
      (k) =>
        !["fits", "breaks", "too_short", "too_long"].includes(
          verdicts[k] as string,
        ),
    )
  )
    return undefined;
  const workOf = new Map(data.pauses.map((p) => [p?.id, p?.work]));
  const works = marked.map((_, k) =>
    part.pauses.includes(k) && held.includes(k) ? workOf.get(k) : undefined,
  );
  if (
    part.pauses.some(
      (k) => held.includes(k) && !WORKS.includes(works[k] as Work),
    )
  )
    return undefined;
  const answers = new Map(data.stretches.map((s) => [s?.id, s?.pause_after]));
  if (part.stretches.some((k) => !Array.isArray(answers.get(k))))
    return undefined;
  const runs = stretches(words, marked);
  const missing = part.stretches.flatMap((k) =>
    (answers.get(k) as unknown[]).filter(
      (n): n is number =>
        typeof n === "number" &&
        Number.isInteger(n) &&
        n >= runs[k][0] &&
        n < runs[k][1],
    ),
  );
  return {
    verdicts: verdicts as (Verdict | undefined)[],
    works: works as (Work | undefined)[],
    missing: [...new Set(missing)].sort((a, b) => a - b),
  };
}

/**
 * Pauses whose word boundary the recognizer's own timing confirms. The aligner
 * occasionally moves a short word across a silence ("Here we | go."), which
 * would misplace the pause by a word; findings at such pauses are dropped.
 */
export function confirmedPauses(
  words: Word[],
  recognized: Word[],
  marked: MarkedPause[],
) {
  if (recognized.length !== words.length) return marked;
  return marked.filter(({ after: i }) => {
    const middle = (words[i].end! + words[i + 1].start!) / 2;
    return recognized.findLastIndex((w) => w.start! < middle) === i;
  });
}

/** Which of the text model's findings must also be heard, and as what. */
export const DEFAULT_PAUSE_HEARD_CONFIG = {
  breakSounds: ["hesitant"] as PauseSound[], // A break is kept when its pause sounds like one of these; empty keeps every break.
  missingMustRunOn: true, // A missing pause is kept only where the words sound like they run on.
};
export type PauseHeardConfig = typeof DEFAULT_PAUSE_HEARD_CONFIG;
export type PauseReview = {
  marks: PauseMark[];
  reliable: boolean;
  status: "reviewed" | "no timing" | "no model" | "unusable reply";
  marked: MarkedPause[];
  /** Whether breaks and missing pauses were also heard; if not, they are the text model's alone. */
  heard?: boolean;
  /** How many places the text model faulted, and how many of them were kept. */
  read?: number;
  kept?: number;
  /** How many moments were heard, and in how many requests. */
  hearing?: { moments: number; clips: number };
  /** The pauses that do real work; undefined unless they were heard. */
  strengths?: PauseStrengthMark[];
};

const RULES: Record<Exclude<Verdict, "fits"> | "missing", PauseRule> = {
  missing: "PAUSE_NECESSARY",
  too_short: "PAUSE_TOO_SHORT",
  breaks: "PAUSE_UNNECESSARY",
  too_long: "PAUSE_TOO_LONG",
};

/**
 * Review every pause in a take. `recognized` is the recognizer's timing for the
 * same words when `words` were re-aligned. Findings of one kind close together
 * (within a sentence or so) form one highlight. With `hear`, breaks and missing
 * pauses are kept only where they sound like one, and the held pauses the
 * model says do real work become strengths where they sound deliberate. If a
 * fault can't be heard, the text model's findings stand; if a proposed strength
 * can't, no strength is reported; neither failure touches the other. With
 * `strength` false, no pause is asked or heard about its work.
 */
export async function reviewPause(
  words: Word[],
  pauses: Pause[],
  complete?: JsonCompletion,
  recognized?: Word[],
  hear?: {
    audio: Audio;
    judge: AudioJudgment;
    config?: Partial<PauseHeardConfig>;
    hearing?: Partial<HearingConfig>;
  },
  strength: Partial<PauseStrengthConfig> | false = {},
): Promise<PauseReview> {
  if (!timed(words))
    return { marks: [], reliable: false, status: "no timing", marked: [] };
  const after = pauseAfterWords(words, pauses);
  const marked = after.flatMap((seconds, i) =>
    seconds > 0 ? [{ after: i, seconds }] : [],
  );
  if (!complete)
    return { marks: [], reliable: false, status: "no model", marked };
  // Findings next to a pause whose position the two timings disagree on are not reliable.
  const sure = new Set(
    (recognized ? confirmedPauses(words, recognized, marked) : marked).map(
      (p) => p.after,
    ),
  );
  const s = { ...DEFAULT_PAUSE_STRENGTH_CONFIG, ...strength };
  const held = marked.flatMap((p, k) =>
    strength && p.seconds >= s.minSeconds && sure.has(p.after) ? [k] : [],
  );
  const parts = reviewParts(words, marked);
  // The model occasionally skips a stretch; a part is asked once more before the review gives up.
  const ask = async (part: [number, number]) => {
    const request = reviewRequest(words, marked, syllables, part, held);
    for (const user of [
      request.user,
      `${request.user}\n\nAnswer every listed pause and stretch.`,
    ]) {
      try {
        const parsed = parseReview(
          words,
          marked,
          await complete({ ...request, user }),
          part,
          held,
        );
        if (parsed) return parsed;
      } catch {
        /* asked again below */
      }
    }
    return undefined;
  };
  const replies = await Promise.all(parts.map(ask));
  if (replies.some((r) => !r))
    return { marks: [], reliable: false, status: "unusable reply", marked };
  const review = {
    verdicts: marked.map((_, k) =>
      replies.map((r) => r!.verdicts[k]).find(Boolean),
    ),
    works: marked.map((_, k) => replies.map((r) => r!.works[k]).find(Boolean)),
    missing: replies.flatMap((r) => r!.missing),
  };
  const unsure = marked.filter((p) => !sure.has(p.after)).map((p) => p.after);
  const read: { at: number; rule: PauseRule }[] = [
    ...marked.flatMap((p, k) =>
      review.verdicts[k] && review.verdicts[k] !== "fits" && sure.has(p.after)
        ? [
            {
              at: p.after,
              rule: RULES[review.verdicts[k] as Exclude<Verdict, "fits">],
            },
          ]
        : [],
    ),
    ...review.missing
      .filter((i) => !unsure.some((u) => Math.abs(u - i) <= 1))
      .map((at) => ({ at, rule: RULES.missing })),
  ].sort((a, b) => a.at - b.at);
  // Only a pause that fits can be one to copy.
  const proposed = held.flatMap((k) => {
    const work = review.works[k];
    return review.verdicts[k] === "fits" && work && work !== "ordinary"
      ? [proposeStrength(words, marked, marked[k], work, s)]
      : [];
  });
  let points = read,
    heard = false,
    hearing: PauseReview["hearing"],
    strengths: PauseStrengthMark[] | undefined;
  if (hear) {
    const c = { ...DEFAULT_PAUSE_HEARD_CONFIG, ...hear.config };
    const seconds = new Map(marked.map((p) => [p.after, p.seconds]));
    // What must be heard: breaks, missing pauses and proposed strengths, each with the fault or strength it decides.
    const moments: Moment[] = [],
      faults: number[] = [];
    read.forEach(({ at, rule }, i) => {
      if (rule === "PAUSE_UNNECESSARY" && c.breakSounds.length)
        moments.push({ kind: "pause", at, seconds: seconds.get(at)! });
      else if (rule === "PAUSE_NECESSARY" && c.missingMustRunOn)
        moments.push({ kind: "missing", at });
      else return;
      faults.push(i);
    });
    for (const p of proposed)
      moments.push({
        kind: "pause",
        at: p.at,
        seconds: p.seconds,
        first: p.first,
      });
    const sounds = await hearMoments(
      words,
      moments,
      hear.audio,
      hear.judge,
      hear.hearing,
    );
    hearing = {
      moments: moments.length,
      clips: hearingClips(words, moments, hear.hearing).length,
    };
    // A fault that couldn't be heard leaves the text model's findings standing, as they were read.
    heard = faults.every((_, n) => sounds[n]);
    if (heard)
      points = read.filter((_, i) => {
        const n = faults.indexOf(i);
        return (
          n < 0 ||
          sounds[n] === "runs_on" ||
          c.breakSounds.includes(sounds[n] as PauseSound)
        );
      });
    const sound = (n: number) => sounds[faults.length + n];
    // Strengths are named only when every proposed one was heard.
    if (strength && proposed.every((_, n) => sound(n)))
      strengths = nameStrengths(
        words,
        proposed.filter((_, n) => s.sounds.includes(sound(n) as PauseSound)),
        s,
      );
  }
  const marks: PauseMark[] = [];
  for (const rule of Object.values(RULES)) {
    const groups: number[][] = [];
    for (const { at } of points.filter((p) => p.rule === rule)) {
      const last = groups.at(-1);
      if (last && at - last.at(-1)! <= 6) last.push(at);
      else groups.push([at]);
    }
    for (const at of groups) {
      const first = Math.max(0, at[0] - 2),
        last = Math.min(words.length - 1, at.at(-1)! + 2);
      marks.push({
        first,
        last,
        start: words[first].start,
        end: words[last].end,
        text: words
          .slice(first, last + 1)
          .map((w) => w.text)
          .join(" "),
        rule,
        at,
      });
    }
  }
  return {
    marks: marks.sort((a, b) => a.start - b.start),
    reliable: true,
    status: "reviewed",
    marked,
    heard,
    read: read.length,
    kept: points.length,
    hearing,
    strengths,
  };
}
