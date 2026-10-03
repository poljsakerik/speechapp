import assert from "node:assert/strict";
import { test } from "node:test";
import type { Place } from "./delivery-map.ts";
import type { AudioJudgment } from "./gemini.ts";
import { confirmedPauses, pausesMet, reviewPause } from "./pause-review.ts";

/** Words of 0.2 s; `gaps` maps a word index to the measured silence after it. */
function take(texts: string[], gaps: Record<number, number>) {
  let t = 0;
  const pauses: { start: number; end: number }[] = [];
  const words = texts.map((text, i) => {
    const w = { text, start: t, end: t + 0.2 };
    t += 0.2;
    if (gaps[i]) {
      pauses.push({ start: t, end: t + gaps[i] });
      t += gaps[i];
    }
    return w;
  });
  return { words, pauses };
}
/** A map of `length` words with a phrase ending after each of `ends`. */
const mapped = (length: number, ends: Record<number, Place>) =>
  Array.from({ length }, (_, i) => ends[i] ?? null);
const t = take(
  "We looked at the data. It was clear that the plan had worked well for everyone involved.".split(
    " ",
  ),
  { 1: 0.6, 4: 3.4, 8: 0.7 },
);
const marked = [
  { after: 1, seconds: 0.6 },
  { after: 4, seconds: 3.4 },
  { after: 8, seconds: 0.7 },
];
// A pause is needed after "data." and after "worked", and fits after "clear".
const places = mapped(17, { 4: "needed", 7: "optional", 12: "needed" });
const rules = (review: Awaited<ReturnType<typeof reviewPause>>) =>
  review.marks.map((m) => [m.rule, m.at]);

test("a pause inside a phrase breaks it, a needed place without one misses it, and a silence of seconds is too long", async () => {
  const review = await reviewPause(t.words, t.pauses, places);
  assert.equal(review.status, "reviewed");
  assert.deepEqual(rules(review), [
    ["PAUSE_UNNECESSARY", [1]],
    ["PAUSE_TOO_LONG", [4]],
    ["PAUSE_UNNECESSARY", [8]],
    ["PAUSE_NECESSARY", [12]],
  ]);
  assert.deepEqual(
    review.marked.map((p) => [p.after, +p.seconds.toFixed(1)]),
    marked.map((p) => [p.after, p.seconds]),
  );
  // What the speaker did at each place needing a pause: the measure two takes are compared on.
  assert.deepEqual(
    review.places!.map((p) => [p.at, p.place, p.outcome]),
    [
      [4, "needed", "paused"],
      [12, "needed", "missed"],
    ],
  );
  assert.deepEqual(pausesMet(review.places!), { met: 1, of: 2 });
  // The same take against the same map always reads the same.
  assert.deepEqual(await reviewPause(t.words, t.pauses, places), review);
});

test("a pause where one fits yields nothing, and a stop too short to hear inside a phrase is not a break", async () => {
  const fits = await reviewPause(
    t.words,
    t.pauses,
    mapped(17, { 1: "optional", 4: "optional", 8: "optional" }),
    { config: { longSeconds: 5 } },
  );
  assert.deepEqual(fits.marks, []);
  const brief = take(
    t.words.map((w) => w.text),
    { 2: 0.25, 4: 0.5 },
  );
  assert.deepEqual(
    rules(await reviewPause(brief.words, brief.pauses, places)),
    [["PAUSE_NECESSARY", [12]]],
  );
});

test("a moment to hold is missed, too short with only a breath, or held", async () => {
  const outcome = async (seconds: number) => {
    const held = take(
      t.words.map((w) => w.text),
      seconds ? { 4: seconds } : {},
    );
    const review = await reviewPause(
      held.words,
      held.pauses,
      mapped(17, { 4: "land" }),
    );
    return [review.places![0].outcome, review.marks[0]?.rule];
  };
  assert.deepEqual(await outcome(0), ["missed", "PAUSE_NECESSARY"]);
  assert.deepEqual(await outcome(0.3), ["short", "PAUSE_TOO_SHORT"]);
  assert.deepEqual(await outcome(0.5), ["paused", undefined]);
  assert.deepEqual(await outcome(1.2), ["held", undefined]);
});

test("passing place after place where a pause fits is a run-on, even when none of them needs one", async () => {
  const texts = Array.from({ length: 40 }, (_, i) => `w${i}`);
  // A phrase ends every fourth word; none is marked as needed.
  const optional = mapped(
    40,
    Object.fromEntries(
      Array.from({ length: 9 }, (_, k) => [k * 4 + 3, "optional" as const]),
    ),
  );
  const rushed = take(texts, {});
  assert.deepEqual(
    rules(await reviewPause(rushed.words, rushed.pauses, optional)),
    // The middle of the nine places passed.
    [["PAUSE_NECESSARY", [19]]],
  );
  // One pause on the way, and neither half is a run-on.
  const once = take(texts, { 15: 0.5 });
  assert.deepEqual(
    rules(await reviewPause(once.words, once.pauses, optional)),
    [],
  );
  // A place in the run that needs a pause is a finding of its own.
  const needed = [...optional];
  needed[7] = "needed";
  assert.deepEqual(
    (await reviewPause(rushed.words, rushed.pauses, needed)).marks.flatMap(
      (m) => m.at,
    ),
    [7, 19],
  );
});

test("findings of one kind close together form one highlight", async () => {
  const choppy = take(
    t.words.map((w) => w.text),
    { 0: 0.5, 2: 0.5, 5: 0.5 },
  );
  const review = await reviewPause(choppy.words, choppy.pauses, mapped(17, {}));
  assert.deepEqual(rules(review), [["PAUSE_UNNECESSARY", [0, 2, 5]]]);
  assert.equal(review.marks[0].text, "We looked at the data. It was clear");
});

test("without a map of the take's words, pauses are not assessed rather than judged by fixed rules", async () => {
  assert.equal((await reviewPause(t.words, t.pauses)).status, "no map");
  assert.equal(
    (await reviewPause(t.words, t.pauses, places.slice(1))).reliable,
    false,
  );
  assert.equal(
    (
      await reviewPause(
        [{ text: "untimed" }, { text: "words" }],
        [],
        [null, null],
      )
    ).status,
    "no timing",
  );
});

test("words the map doesn't cover are not assessed", async () => {
  // A later take of the text: "at the data." is new to it, so its pauses and places are left alone.
  const carried = places.map((p, i) => (i >= 1 && i <= 4 ? undefined : p));
  const review = await reviewPause(t.words, t.pauses, carried);
  assert.deepEqual(rules(review), [
    ["PAUSE_UNNECESSARY", [8]],
    ["PAUSE_NECESSARY", [12]],
  ]);
  assert.deepEqual(pausesMet(review.places!), { met: 0, of: 1 });
});

test("a pause the two timings place at different words gets no finding", async () => {
  const recognized = t.words.map((w, i) =>
    i === 2 ? { ...w, start: w.start - 0.5 } : w,
  );
  assert.deepEqual(
    confirmedPauses(t.words, recognized, marked).map((p) => p.after),
    [4, 8],
  );
  const review = await reviewPause(t.words, t.pauses, places, { recognized });
  assert.deepEqual(
    rules(review).map(([rule]) => rule),
    ["PAUSE_TOO_LONG", "PAUSE_UNNECESSARY", "PAUSE_NECESSARY"],
  );
  // Nor does a place next to it count for or against the speaker.
  const beside = await reviewPause(
    t.words,
    t.pauses,
    mapped(17, { 2: "needed" }),
    { recognized },
  );
  assert.deepEqual(pausesMet(beside.places!), { met: 0, of: 0 });
});

/** Hears each listed pause as `pause(its line)` and each place without one as `moment`. */
const judge =
  (pause: (line: string) => string, moment: string): AudioJudgment =>
  async ({ prompt }) => ({
    moments: [...prompt.matchAll(/^(\d+)\. .*$/gm)].map((m) => ({
      id: Number(m[1]),
      sound: m[0].includes("pauses for") ? pause(m[0]) : moment,
    })),
  });
const audio = { samples: new Float32Array(16000 * 12), sampleRate: 16000 };

test("with an audio model, a break must sound hesitant, a missing pause like running on, and a long silence not deliberate", async () => {
  const heard = await reviewPause(t.words, t.pauses, places, {
    hear: {
      audio,
      judge: judge(
        (line) => (line.includes('"We looked"') ? "hesitant" : "deliberate"),
        "clear",
      ),
    },
  });
  // The second break and the long silence sound deliberate, and the voice finishes the thought after "worked".
  assert.deepEqual(rules(heard), [["PAUSE_UNNECESSARY", [1]]]);
  assert.deepEqual([heard.heard, heard.read, heard.kept], [true, 4, 1]);
  assert.deepEqual(
    heard.places!.map((p) => p.outcome),
    ["paused", "clear"],
  );
  assert.deepEqual(pausesMet(heard.places!), { met: 2, of: 2 });
  const runsOn = await reviewPause(t.words, t.pauses, places, {
    hear: { audio, judge: judge(() => "ordinary", "runs_on") },
  });
  assert.deepEqual(rules(runsOn), [
    ["PAUSE_TOO_LONG", [4]],
    ["PAUSE_NECESSARY", [12]],
  ]);
  // If the audio model fails, the map's findings stand, and the review says they were not heard.
  const unheard = await reviewPause(t.words, t.pauses, places, {
    hear: {
      audio,
      judge: async () => {
        throw new Error("Gemini unavailable");
      },
    },
  });
  assert.deepEqual(
    [unheard.marks.length, unheard.heard, unheard.reliable],
    [4, false, true],
  );
  assert.equal((await reviewPause(t.words, t.pauses, places)).heard, false);
  // Findings that need no hearing are kept as read.
  const kept = await reviewPause(t.words, t.pauses, places, {
    hear: { audio, judge: judge(() => "deliberate", "clear") },
    config: { breakSounds: [], missingMustRunOn: false },
  });
  assert.deepEqual(kept.kept, 3, "only the long silence was heard");
});

test("moments close together are heard in one request", async () => {
  const prompts: string[] = [];
  const review = await reviewPause(t.words, t.pauses, places, {
    config: { longSeconds: 5 },
    hear: {
      audio,
      judge: async ({ prompt }) => {
        prompts.push(prompt);
        return {
          moments: [
            { id: 1, sound: "hesitant" },
            { id: 2, sound: "hesitant" },
            { id: 3, sound: "runs_on" },
          ],
        };
      },
    },
  });
  assert.equal(prompts.length, 1);
  assert.match(
    prompts[0],
    /1\. At 0\.4 seconds, right after the words "We looked", the speaker pauses for 0\.6 seconds\./,
  );
  assert.match(
    prompts[0],
    /3\. At .* the speaker goes on without a real pause\./,
  );
  assert.equal(review.kept, 3);
  assert.deepEqual(review.hearing, { moments: 3, clips: 1 });
});
