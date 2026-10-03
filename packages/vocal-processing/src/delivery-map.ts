/**
 * Delivery map: how a text should be spoken, decided before anyone is heard
 * saying it, the way a speaking coach marks up a script.
 *
 * In one request, a model reads the words alone and splits them into phrases,
 * the smallest groups that belong together. For each phrase it says two
 * things:
 * - the pause after it. A pause fits after any phrase and nowhere inside one,
 *   and each phrase end says how much the listener needs it: optional, needed,
 *   or a moment to hold (a line that should land, or a setup about to be
 *   delivered). pause-review.ts measures a take's pauses against these places.
 * - its pace, from -2 (a skilled speaker would slow down: the point, a key
 *   term, a number) to +2 (move through: setup, asides, restatements).
 *   rate.ts measures a take's pace against these scores.
 * The map says nothing about how a take was spoken, so every take of the same
 * text is measured against the same phrases, and a second attempt can be
 * compared with the first.
 *
 * The words are sent without punctuation or capitals: a recognizer puts commas
 * and full stops where the speaker paused, so punctuation would write the
 * first take's pauses into the map every later take is judged by.
 */
import { createHash } from "node:crypto";
import type { JsonCompletion, Word } from "./types.ts";

export const DELIVERY_MAP_VERSION = 1;
/** What the pause after a phrase is for; the last two are moments to hold. */
export const PLACES = ["optional", "needed", "land", "anticipation"] as const;
export type Place = (typeof PLACES)[number];
const PACES = [-2, -1, 0, 1, 2];
/**
 * The phrases of a text in order, each by its last word, with the pause that
 * fits after it and the pace it should be spoken at. The pause after the last
 * phrase means nothing: no words follow it.
 */
export type DeliveryMap = {
  version: number;
  phrases: { last: number; pause: Place; pace: number }[];
};
/** Inclusive word index ranges of the phrases whose pace is measured, and the pace each should have (-2 slower to +2 faster). */
export type PacingPhrase = [first: number, last: number];
export type PacingPrediction = { phrases: PacingPhrase[]; scores: number[] };
/** One reading of the words, per word: the pause that fits after it (null inside a phrase) and its phrase's pace. */
type Reading = { after: (Place | null)[]; pace: number[] };

export const MAP_SYSTEM = `You mark up a script for delivery, the way a speaking coach prepares a speech before it is spoken. You get the words numbered, without punctuation or capitals: decide from the meaning alone where the speaker should pause and how each phrase should be paced.
Split the words you are asked about into phrases: the smallest groups of words that belong together when spoken. A fluent speaker could pause after any phrase, and a stop inside one would sound like hesitation. Phrases are short, mostly two to six words: end one wherever a pause could fit, also where no pause is needed.
- End a phrase at the end of every sentence, idea and clause, after a key point or question, after an opening word or phrase that leads into a sentence (now, however, so, for a lot of people), before a reveal or a key word set up for effect, between list items, around an aside, between a long subject and its verb, and before a new clause (before because, when, that, which, so that, and a new statement).
- Keep inside one phrase only what a stop would break: an article, preposition, possessive, conjunction or auxiliary with the words it leads into (the, a, of, to, my, and, is), a name, a number, a fixed phrase, and a false start or repeated word with what it restarts.
For each phrase, say what the pause after it is. Pauses give the listener time to take in what was said:
- "optional": a pause fits here, but the listener doesn't need one. Most phrases, including many ends of sentences (a speaker can run two short sentences together) and every opening word or phrase: the moment the listener needs comes before "now" or "however", not after it.
- "needed": without a pause here the ideas blur together. One thought is finished and another begins, and the listener needs a moment between them.
- "land": the phrase ends a line meant to land: the main point of the passage, a striking claim or number, a punchline, or a question the listener is meant to think about. A held silence gives the listener time to take it in.
- "anticipation": the speaker has set up something and the words after the pause deliver it: the answer to a question just asked, a reveal, a punchline, or the last item a list was building to. A held silence makes the listener lean in.
A whole talk has only a few moments to hold; when in doubt between "land" or "anticipation" and "needed", say "needed", and when in doubt between "needed" and "optional", say "optional". Many deliveries are valid: mark what a good speaking coach would insist on.
For each phrase, also predict how a skilled, engaging speaker would pace it relative to their own normal speed:
-2: clearly slower; the point, a key term, a contrast, a number, or a line meant to land.
-1: a little slower.
0: normal.
1: a little faster.
2: clearly faster; setup, asides, transitions, restatements, filler, or things the listener can predict.
A skilled speaker's pace keeps changing: every few phrases there is something to slow down on and something to move through, so about as many phrases are faster as slower, and only a phrase that is neither is 0. The pace is a separate judgment from the pause: a phrase can be quick and still end in a needed pause. Several deliveries can be good. Predict what most skilled speakers would do.
Give every phrase in order by the number of its last word. Together they must cover every word you are asked about, ending with the last one.`;
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["phrases"],
  properties: {
    phrases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["last", "pause", "pace"],
        properties: {
          last: { type: "integer" },
          pause: { type: "string", enum: [...PLACES] },
          pace: { type: "integer", enum: PACES },
        },
      },
    },
  },
};

/** A word as the model reads it: no capitals, no punctuation around it. */
export function bare(text: string) {
  return (
    text.toLowerCase().replace(/^[^\p{L}\p{N}$%&]+|[^\p{L}\p{N}%]+$/gu, "") ||
    text
  );
}

/**
 * Word ranges of about `size` words to mark up in one request. A part has to
 * end where a phrase does, so it ends at a sentence end where the text has
 * them; otherwise after `size` words.
 */
export function mapParts(words: Word[], size = 120): [number, number][] {
  const parts: [number, number][] = [];
  let from = 0;
  for (let i = 0; i < words.length - 1; i++) {
    const n = i - from + 1;
    if (
      (n >= size && /[.!?]["')\]]*$/.test(words[i].text)) ||
      n >= size * 1.5
    ) {
      parts.push([from, i]);
      from = i + 1;
    }
  }
  if (from < words.length) parts.push([from, words.length - 1]);
  return parts;
}

/** One request marks up words [from, to]; the whole text is always included for context. */
export function mapRequest(
  words: Word[],
  [from, to]: [number, number] = [0, words.length - 1],
  punctuation = false,
) {
  const script = words
    .map((w, i) => `${i}:${punctuation ? w.text : bare(w.text)}`)
    .join(" ");
  return {
    system: MAP_SYSTEM,
    user: `Script:\n${script}\n\nSplit words ${from}-${to} into phrases.`,
    schema,
    schemaName: "delivery_map",
    // Every part starts with the same prompt and script.
    cacheKey: `delivery-map-${createHash("sha256").update(script).digest("hex").slice(0, 32)}`,
  };
}

/**
 * The phrases of words [from, to], or undefined unless they cover them in
 * order and end with the last one: a gap is not evidence that no pause fits
 * there.
 */
export function parseMap(
  reply: unknown,
  [from, to]: [number, number],
): DeliveryMap["phrases"] | undefined {
  const phrases = (
    reply as { phrases?: { last?: unknown; pause?: unknown; pace?: unknown }[] }
  )?.phrases;
  if (!Array.isArray(phrases) || !phrases.length) return undefined;
  let previous = from - 1;
  for (const p of phrases) {
    if (
      !Number.isInteger(p?.last) ||
      (p.last as number) <= previous ||
      (p.last as number) > to ||
      !PLACES.includes(p.pause as Place) ||
      !PACES.includes(p.pace as number)
    )
      return undefined;
    previous = p.last as number;
  }
  return previous === to
    ? phrases.map((p) => ({
        last: p.last as number,
        pause: p.pause as Place,
        pace: p.pace as number,
      }))
    : undefined;
}

/** The pause that fits after each of `length` words (null inside a phrase and after the last word) and each word's pace. */
function perWord(phrases: DeliveryMap["phrases"], length: number): Reading {
  const after = new Array<Place | null>(length).fill(null),
    pace = new Array<number>(length).fill(0);
  let first = 0;
  for (const p of phrases) {
    if (p.last < length - 1) after[p.last] = p.pause;
    pace.fill(p.pace, first, p.last + 1);
    first = p.last + 1;
  }
  return { after, pace };
}

/** The pause that fits after each of the text's `length` words, null inside a phrase; what pause-review.ts measures against. */
export const placesOf = (map: DeliveryMap, length: number) =>
  perWord(map.phrases, length).after;

/** The text's phrases and their pace scores; what rate.ts measures against. */
export function pacingOf(map: DeliveryMap): PacingPrediction {
  return {
    phrases: map.phrases.map((p, k) => [
      k ? map.phrases[k - 1].last + 1 : 0,
      p.last,
    ]),
    scores: map.phrases.map((p) => p.pace),
  };
}

/** One reading of `words`: a part whose reply doesn't cover it is asked once more; undefined if one still doesn't. */
async function readMap(
  words: Word[],
  complete: JsonCompletion,
  punctuation: boolean,
): Promise<Reading | undefined> {
  const ask = async (part: [number, number]) => {
    const request = mapRequest(words, part, punctuation);
    for (const user of [
      request.user,
      `${request.user}\n\nCover every word from ${part[0]} to ${part[1]}.`,
    ]) {
      try {
        const parsed = parseMap(await complete({ ...request, user }), part);
        if (parsed) return parsed;
      } catch {
        /* asked again below */
      }
    }
    return undefined;
  };
  const replies = await Promise.all(mapParts(words).map(ask));
  return replies.every((r) => r)
    ? perWord(replies.flat() as DeliveryMap["phrases"], words.length)
    : undefined;
}

export const DEFAULT_DELIVERY_MAP_CONFIG = {
  readings: 1, // With more, the text is marked up this many times and each place gets the middle answer (mergeReadings). Three made no measurable difference on the pause or pacing benchmarks.
  punctuation: false, // True only for a script the speaker wrote: a recognizer's punctuation follows the pauses of the take it heard.
};
export type DeliveryMapConfig = typeof DEFAULT_DELIVERY_MAP_CONFIG;

/**
 * Mark up how `words` should be delivered, from their text alone. A reading
 * that stays incomplete is left out; undefined without a model, or if none is
 * complete.
 */
export async function mapDelivery(
  words: Word[],
  complete?: JsonCompletion,
  config: Partial<DeliveryMapConfig> = {},
): Promise<DeliveryMap | undefined> {
  if (!complete || words.length < 2) return undefined;
  const c = { ...DEFAULT_DELIVERY_MAP_CONFIG, ...config };
  const readings = await Promise.all(
    Array.from({ length: c.readings }, () =>
      readMap(words, complete, c.punctuation),
    ),
  );
  const read = readings.filter((r): r is Reading => !!r);
  return read.length ? mergeReadings(read) : undefined;
}

const HOLDS: Place[] = ["land", "anticipation"];
/** How much a place asks for a pause: none inside a phrase, then optional, needed, held. */
const level = (p: Place | null) =>
  p === null ? 0 : p === "optional" ? 1 : p === "needed" ? 2 : 3;
const middle = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

/**
 * One map from several readings of the same words. A model's markup varies
 * between readings, most of all in what it calls needed or a moment to hold,
 * so each place gets the middle answer: a phrase ends, or a pause is needed,
 * only where most readings say so. Each word gets its middle pace, and a
 * phrase the pace of its words.
 */
export function mergeReadings(readings: Reading[]): DeliveryMap {
  const phrases: DeliveryMap["phrases"] = [];
  let first = 0;
  readings[0].after.forEach((_, i) => {
    const answers = readings.map((r) => r.after[i]),
      asked = middle(answers.map(level));
    if (!asked && i < readings[0].after.length - 1) return;
    // Which kind of held moment: the one most readings name, land on a tie.
    const kinds = answers.filter((a): a is Place => HOLDS.includes(a!));
    const paces = Array.from({ length: i - first + 1 }, (_, k) =>
      middle(readings.map((r) => r.pace[first + k])),
    );
    phrases.push({
      last: i,
      pause:
        asked < 3
          ? asked === 2
            ? "needed"
            : "optional"
          : kinds.filter((a) => a === "anticipation").length > kinds.length / 2
            ? "anticipation"
            : "land",
      pace: Math.round(paces.reduce((a, b) => a + b, 0) / paces.length),
    });
    first = i + 1;
  });
  return { version: DELIVERY_MAP_VERSION, phrases };
}

/**
 * The map of a text laid over another take of it. `script` are the words the
 * map was made from; words are matched in order by their bare text.
 * - `places`: for each of the take's `words`, the pause that fits after it,
 *   or undefined where the take leaves the text (a filler, a restart, a
 *   skipped word), which is not assessed.
 * - `pacing`: the text's phrases over the take's words, each with its pace. A
 *   phrase the speaker said less than half of is left out.
 */
export function carryMap(
  map: DeliveryMap,
  script: Word[],
  words: Word[],
): { places: (Place | null | undefined)[]; pacing: PacingPrediction } {
  const a = script.map((w) => bare(w.text)),
    b = words.map((w) => bare(w.text));
  // Longest common subsequence: `longest[i][j]` words match from script word i and take word j on.
  const width = b.length + 1,
    longest = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      longest[i * width + j] =
        a[i] === b[j]
          ? longest[(i + 1) * width + j + 1] + 1
          : Math.max(longest[(i + 1) * width + j], longest[i * width + j + 1]);
  const at = new Array<number | undefined>(b.length).fill(undefined);
  // The last matched pair, and what to do with the unmatched words up to the next one.
  let i = 0,
    j = 0,
    [lastI, lastJ] = [-1, -1];
  const matched = () => {
    // As many unmatched words on both sides are the same words heard differently ("legion", "legions").
    if (i - lastI === j - lastJ)
      for (let k = 1; lastJ + k < j; k++) at[lastJ + k] = lastI + k;
    at[j] = i;
    [lastI, lastJ] = [i++, j++];
  };
  while (i < a.length && j < b.length)
    if (a[i] === b[j]) matched();
    else if (longest[(i + 1) * width + j] >= longest[i * width + j + 1]) i++;
    else j++;
  const after = placesOf(map, script.length);
  const text = pacingOf(map),
    pacing: PacingPrediction = { phrases: [], scores: [] };
  text.phrases.forEach(([first, last], k) => {
    const said = at.flatMap((s, j) =>
      s !== undefined && s >= first && s <= last ? [j] : [],
    );
    if (said.length * 2 <= last - first) return;
    pacing.phrases.push([said[0], said.at(-1)!]);
    pacing.scores.push(text.scores[k]);
  });
  return {
    // The end of a phrase is still its end when the speaker adds or drops words after it; inside a phrase, only the next word tells.
    places: words.map((_, j) =>
      at[j] !== undefined &&
      (after[at[j]!] !== null || at[j + 1] === at[j]! + 1)
        ? after[at[j]!]
        : undefined,
    ),
    pacing,
  };
}
