import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectTonality,
  parseFits,
  passages,
  reviewTonality,
  tonalityConfig,
  tonalityRequest,
  type Emotion,
} from "./tonality.ts";
import type { Word } from "./types.ts";

/** One word a second; every fifth word ends a sentence. */
const words = (count: number): Word[] =>
  Array.from({ length: count }, (_, i) => ({
    text: (i + 1) % 5 ? `w${i}` : `w${i}.`,
    start: i,
    end: i + 0.8,
  }));

test("sentences join into passages of 10-30 s, and a short clip is one passage", () => {
  const ps = passages(words(45));
  assert.deepEqual(
    ps.map((p) => [p.first, p.last]),
    [
      [0, 14],
      [15, 29],
      [30, 44],
    ],
  );
  // A tail shorter than a passage joins the one before it.
  assert.deepEqual(
    passages(words(40)).map((p) => [p.first, p.last]),
    [
      [0, 14],
      [15, 39],
    ],
  );
  assert.equal(passages(words(4)).length, 1);
  const runOn = Array.from({ length: 50 }, (_, i) => ({
    text: `w${i}`,
    start: i,
    end: i + 0.8,
  }));
  assert.ok(passages(runOn).every((p) => p.end - p.start <= 30));
});

test("a short tail never stretches a passage past 30 s", () => {
  // Joined, the last two would span 34.8 s: they are split evenly instead.
  const runOn = Array.from({ length: 35 }, (_, i) => ({
    text: `w${i}`,
    start: i,
    end: i + 0.8,
  }));
  assert.deepEqual(
    passages(runOn).map((p) => [p.first, p.last]),
    [
      [0, 16],
      [17, 34],
    ],
  );
  // A sentence end inside the limits is preferred to an even split.
  const sentences = runOn.map((w, i) =>
    i === 21 ? { ...w, text: "w21." } : w,
  );
  assert.deepEqual(
    passages(sentences).map((p) => [p.first, p.last]),
    [
      [0, 21],
      [22, 34],
    ],
  );
  // After a long silence no split fits, so the tail is judged alone rather than across the gap.
  const late = [
    ...words(20),
    { text: "late", start: 100, end: 100.8 },
    { text: "words.", start: 101, end: 101.8 },
  ];
  assert.deepEqual(
    passages(late).map((p) => [p.first, p.last]),
    [
      [0, 14],
      [15, 19],
      [20, 21],
    ],
  );
});

test("a flat voice is flagged only where the words call for feeling", () => {
  const ps = passages(words(45));
  const fits = new Map<string, Emotion[]>([
    ["p1", ["happy"]],
    ["p2", ["neutral", "sad"]],
    ["p3", ["happy", "surprised"]],
  ]);
  const flat = detectTonality(ps, [2, 1, 4], fits);
  assert.deepEqual(
    flat.marks.map((m) => [
      m.rule,
      m.first,
      m.last,
      m.expected,
      m.expressiveness,
    ]),
    [["TONE_FLAT", 0, 14, ["happy"], 2]],
  );
  assert.deepEqual(detectTonality(ps, [3, 3, 3], fits).marks, []);
});

test("the flagged score is configurable", () => {
  const ps = passages(words(45));
  const fits = new Map<string, Emotion[]>(
    ps.map((p) => [p.id, ["happy"] as Emotion[]]),
  );
  const flagged = (flatScore: number) =>
    detectTonality(ps, [1, 2, 3], fits, { flatScore })
      .passages.filter((p) => p.flat)
      .map((p) => p.id);
  assert.deepEqual(flagged(1), ["p1"]);
  assert.deepEqual(flagged(2), ["p1", "p2"]);
  assert.deepEqual(flagged(3), ["p1", "p2", "p3"]);
  assert.equal(tonalityConfig({}).flatScore, 2);
  assert.equal(tonalityConfig({ TONALITY_FLAT_SCORE: "3" }).flatScore, 3);
  assert.throws(
    () => tonalityConfig({ TONALITY_FLAT_SCORE: "5" }),
    /Invalid TONALITY_FLAT_SCORE/,
  );
});

test("adjacent flat passages form one highlight", () => {
  const ps = passages(words(45));
  const fits = new Map<string, Emotion[]>(
    ps.map((p) => [p.id, ["happy"] as Emotion[]]),
  );
  const { marks } = detectTonality(ps, [2, 1, 2], fits);
  assert.equal(marks.length, 1);
  assert.deepEqual(
    [marks[0].first, marks[0].last, marks[0].expressiveness],
    [0, 44, 1],
  );
});

test("the text model gets passages, never audio, and must cover every passage", () => {
  const ps = passages(words(45));
  const request = tonalityRequest(ps);
  assert.deepEqual(
    JSON.parse(request.user).passages.map((p: { id: string }) => p.id),
    ["p1", "p2", "p3"],
  );
  assert.throws(
    () => parseFits(ps, { passages: [{ id: "p1", fits: ["happy"] }] }),
    /missing passages/,
  );
  assert.throws(
    () =>
      parseFits(ps, {
        passages: ps.map((p) => ({ id: p.id, fits: ["bored"] })),
      }),
    /missing passages/,
  );
});

test("the review rates each passage's audio and asks the text model once", async () => {
  const sampleRate = 16000,
    samples = new Float32Array(45 * sampleRate);
  const heard: number[][] = [];
  let requests = 0;
  const analysis = await reviewTonality(
    words(45),
    samples,
    sampleRate,
    async (s, rate) => {
      heard.push([s.length, rate]);
      return 2;
    },
    async (request) => {
      requests++;
      return {
        passages: JSON.parse(request.user).passages.map(
          (p: { id: string }) => ({ id: p.id, fits: ["happy"] }),
        ),
      };
    },
  );
  assert.equal(requests, 1);
  assert.deepEqual(heard, [
    [236800, 16000],
    [236800, 16000],
    [236800, 16000],
  ]);
  assert.equal(analysis.marks.length, 1);
  assert.equal(
    (
      await reviewTonality(
        [],
        samples,
        sampleRate,
        async () => 1,
        async () => ({}),
      )
    ).reliable,
    false,
  );
});

test("a failed review sends no further audio and cancels what is in flight", async () => {
  const sampleRate = 16000,
    samples = new Float32Array(75 * sampleRate),
    ws = words(75); // five passages
  const never = (signal?: AbortSignal) =>
    new Promise<number>((_, reject) =>
      signal!.addEventListener("abort", () => reject(signal!.reason)),
    );
  // The text model fails at once: four ratings had started, none follows, and all four are cancelled.
  const started: AbortSignal[] = [];
  await assert.rejects(
    reviewTonality(
      ws,
      samples,
      sampleRate,
      async (_, __, signal) => {
        started.push(signal!);
        return never(signal);
      },
      async () => {
        throw new Error("text model down");
      },
    ),
    /text model down/,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started.length, 4);
  assert.ok(started.every((s) => s.aborted));
  // One rating fails: its siblings are cancelled and the queued passage is never sent.
  let calls = 0;
  const textSignal: AbortSignal[] = [];
  await assert.rejects(
    reviewTonality(
      ws,
      samples,
      sampleRate,
      async (_, __, signal) => {
        if (calls++ === 0) throw new Error("rating failed");
        return never(signal);
      },
      async (_, signal) => {
        textSignal.push(signal!);
        return never(signal);
      },
    ),
    /rating failed/,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 4);
  assert.ok(textSignal[0].aborted);
});
