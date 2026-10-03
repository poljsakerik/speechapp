/**
 * Expected pacing from the text: where a skilled speaker would slow down and
 * where they would move through.
 *
 * A language model scores each short phrase from -2 (clearly slower: the point,
 * a key term, a contrast, a number) to +2 (clearly faster: setup, asides,
 * restatements). It sees only the words, never the audio, so the prediction
 * is the same for every delivery of the same text. Several deliveries can be
 * good; the prediction describes what most skilled speakers would do.
 *
 * Checked against the course coach's own pacing, the scores agree with where
 * he actually slows down at a rank correlation of about 0.2, and not with
 * untrained talks (about 0). Agreement is partial by nature: speech allows
 * several valid interpretations.
 */
import type { JsonCompletion, Word } from "./types.ts";

export const PACING_VERSION = 1;

/** Inclusive word index ranges of the phrases the model scores. */
export type PacingPhrase = [first: number, last: number];
export type PacingPrediction = { phrases: PacingPhrase[]; scores: number[] };

export const PACING_PROMPT = `You are a speech coach. You get a spoken transcript split into numbered phrases. For each phrase, predict how a skilled, engaging speaker would pace it relative to their own normal speed:
-2: clearly slower; the point, a key term, a contrast, a number, or a line meant to land.
-1: a little slower.
0: normal.
+1: a little faster.
+2: clearly faster; setup, asides, transitions, restatements, filler, or things the listener can predict.
Several deliveries can be good. Predict what most skilled speakers would do. Judge only from the words; you have no audio. Return one score per phrase, in order. Text marked as context is only there to help you judge; do not score it.`;

const SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          score: { type: "integer", enum: [-2, -1, 0, 1, 2] },
        },
        required: ["id", "score"],
        additionalProperties: false,
      },
    },
  },
  required: ["scores"],
  additionalProperties: false,
};

/**
 * Split a transcript into phrases from the text alone: at sentence and clause
 * punctuation, then into near-equal pieces of at most `maxWords` words.
 */
export function pacingPhrases(words: Word[], maxWords = 8): PacingPhrase[] {
  const phrases: PacingPhrase[] = [];
  let first = 0;
  words.forEach((w, i) => {
    if (i < words.length - 1 && !/(?:[.!?,;:]|\.\.\.|…)["”’)]*$/.test(w.text))
      return;
    const count = i - first + 1,
      pieces = Math.ceil(count / maxWords);
    for (let k = 0; k < pieces; k++)
      phrases.push([
        first + Math.floor((k * count) / pieces),
        first + Math.floor(((k + 1) * count) / pieces) - 1,
      ]);
    first = i + 1;
  });
  return phrases;
}

/** Phrases per request; long talks are scored in chunks with the neighbouring text as context. */
const CHUNK = 120;
const CONTEXT = 30;

export function pacingRequest(
  words: Word[],
  phrases: PacingPhrase[],
  before: PacingPhrase[] = [],
  after: PacingPhrase[] = [],
) {
  const say = ([a, b]: PacingPhrase) =>
    words
      .slice(a, b + 1)
      .map((w) => w.text)
      .join(" ");
  const numbered = phrases.map((p, i) => `${i}: ${say(p)}`).join("\n");
  const user = [
    before.length
      ? `Context before (do not score):\n${before.map(say).join(" ")}`
      : "",
    numbered,
    after.length
      ? `Context after (do not score):\n${after.map(say).join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system: PACING_PROMPT, user, schema: SCHEMA, schemaName: "pacing" };
}

/** One integer score per phrase; a reply that skips, repeats or invents phrases is rejected. */
export function parsePacing(reply: unknown, count: number): number[] {
  const scores = (reply as { scores?: { id: unknown; score: unknown }[] })
    ?.scores;
  if (!Array.isArray(scores) || scores.length !== count)
    throw new Error("Pacing prediction must score every phrase");
  const out = new Array<number>(count).fill(NaN);
  for (const s of scores) {
    if (
      !Number.isInteger(s.id) ||
      (s.id as number) < 0 ||
      (s.id as number) >= count ||
      !Number.isNaN(out[s.id as number]) ||
      ![-2, -1, 0, 1, 2].includes(s.score as number)
    )
      throw new Error("Invalid pacing score");
    out[s.id as number] = s.score as number;
  }
  return out;
}

export async function predictPacing(
  words: Word[],
  complete: JsonCompletion,
  maxWords?: number,
  concurrency = 4,
): Promise<PacingPrediction> {
  const phrases = pacingPhrases(words, maxWords);
  const starts = Array.from(
    { length: Math.ceil(phrases.length / CHUNK) },
    (_, k) => k * CHUNK,
  );
  const scores = new Array<number[]>(starts.length);
  let next = 0;
  const worker = async () => {
    while (next < starts.length) {
      const k = next++,
        from = starts[k],
        to = Math.min(phrases.length, from + CHUNK);
      const request = pacingRequest(
        words,
        phrases.slice(from, to),
        phrases.slice(Math.max(0, from - CONTEXT), from),
        phrases.slice(to, to + CONTEXT),
      );
      scores[k] = parsePacing(await complete(request), to - from);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, starts.length) }, worker),
  );
  return { phrases, scores: scores.flat() };
}
