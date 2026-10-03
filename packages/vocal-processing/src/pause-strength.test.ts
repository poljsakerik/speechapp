import assert from "node:assert/strict";
import { test } from "node:test";
import type { Place } from "./delivery-map.ts";
import type { AudioJudgment } from "./gemini.ts";
import { reviewPause } from "./pause-review.ts";
import { faulted } from "./pause-strength.ts";

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
// Held pauses after "said." and before the answer to "guess what you can do?", a breath after "breathe.", and a held pause after "the".
const t = take(
  "You give people time to process what you've just said. Now guess what you can do? You can breathe. It allows the body to rest.".split(
    " ",
  ),
  { 9: 2.2, 15: 1.7, 18: 0.4, 21: 0.8 },
);
const audio = { samples: new Float32Array(16000 * 12), sampleRate: 16000 };
/** A map of `length` words with a phrase ending after each of `ends`. */
const mapped = (length: number, ends: Record<number, Place>) =>
  Array.from({ length }, (_, i) => ends[i] ?? null);
// "said." is a line meant to land and the question sets up its answer; a pause is needed after "breathe.", and "the" is inside a phrase.
const placed = mapped(t.words.length, {
  9: "land",
  15: "anticipation",
  18: "needed",
});
/** Hears each listed pause as `sound(its line)`. */
const hearing =
  (sound: (line: string) => string): AudioJudgment =>
  async ({ prompt }) => ({
    moments: [...prompt.matchAll(/^(\d+)\. .*$/gm)].map((m) => ({
      id: Number(m[1]),
      sound: sound(m[0]),
    })),
  });
const strengthsOf = async (
  take: typeof t,
  places: (Place | null)[],
  judge?: AudioJudgment,
) =>
  (
    await reviewPause(take.words, take.pauses, places, {
      hear: judge && { audio, judge },
    })
  ).strengths;

test("a held moment is a strength only if the pause is long enough and sounds deliberate", async () => {
  /** The break after "the" sounds hesitant; the other pauses as `sound(its line)`. */
  const heard = (sound: (line: string) => string) =>
    hearing((line) => (line.includes("allows the") ? "hesitant" : sound(line)));
  const strengths = await strengthsOf(
    t,
    placed,
    heard(() => "deliberate"),
  );
  assert.deepEqual(
    strengths!.map((s) => [
      s.rule,
      s.at,
      s.seconds.toFixed(1),
      s.first,
      s.last,
    ]),
    [
      // The span runs from the phrase before the pause to the one after, at most six words each way;
      // the pause after "breathe." is needed but not a moment to hold.
      ["PAUSE_LETS_IT_LAND", 9, "2.2", 4, 15],
      ["PAUSE_BUILDS_ANTICIPATION", 15, "1.7", 10, 18],
    ],
  );
  // The hearing is asked about the pause after the words that lead into it.
  const prompts: string[] = [];
  const hesitant = await strengthsOf(t, placed, async (request) => {
    prompts.push(request.prompt);
    return heard((line) =>
      line.includes("Now guess") ? "hesitant" : "deliberate",
    )(request);
  });
  assert.deepEqual(
    hesitant!.map((s) => s.at),
    [9],
  );
  assert.ok(prompts.some((p) => p.includes('"Now guess what you can do?"')));
  assert.ok(prompts.some((p) => /pauses for 2\.2 seconds/.test(p)));
  // A moment to hold that got only a breath is not praised.
  const breath = take(
    t.words.map((w) => w.text),
    { 9: 0.5, 15: 1.7 },
  );
  assert.deepEqual(
    (await strengthsOf(
      breath,
      placed,
      hearing((line) => (line.includes("pauses for") ? "deliberate" : "clear")),
    ))!.map((s) => s.at),
    [15],
  );
});

test("without a hearing of every held moment there is no pause strength", async () => {
  assert.equal(await strengthsOf(t, placed), undefined);
  assert.equal(
    await strengthsOf(t, placed, async () => {
      throw new Error("Gemini unavailable");
    }),
    undefined,
  );
  // A hearing that skips a moment is asked once more, then fails.
  let hearings = 0;
  assert.equal(
    await strengthsOf(t, placed, async () => {
      hearings++;
      return { moments: [] };
    }),
    undefined,
  );
  assert.ok(hearings >= 2);
});

test("a strength is undone by a fault the pause review finds inside its words", () => {
  const strength = { first: 3, last: 13 };
  const mark = (rule: "PAUSE_TOO_SHORT" | "PAUSE_NECESSARY", at: number) => ({
    first: at - 2,
    last: at + 2,
    start: 0,
    end: 1,
    text: "",
    rule,
    at: [at],
  });
  assert.equal(
    faulted(strength, [mark("PAUSE_TOO_SHORT", 8)], ["PAUSE_TOO_SHORT"]),
    true,
  );
  assert.equal(
    faulted(strength, [mark("PAUSE_NECESSARY", 8)], ["PAUSE_TOO_SHORT"]),
    false,
  );
  assert.equal(
    faulted(strength, [mark("PAUSE_TOO_SHORT", 13)], ["PAUSE_TOO_SHORT"]),
    false,
    "a pause after its last word is outside it",
  );
  assert.equal(faulted(strength, undefined, ["PAUSE_TOO_SHORT"]), false);
});

test("a talk full of good pauses gets its longest-held ones named, at most two a minute", async () => {
  // Twelve sentences in under a minute, each followed by a held pause of a different length.
  const texts = Array.from({ length: 12 }, () =>
    "This is the point.".split(" "),
  ).flat();
  const gaps = Object.fromEntries(
    Array.from({ length: 11 }, (_, k) => [
      k * 4 + 3,
      0.7 + 0.1 * ((k * 5) % 11),
    ]),
  );
  const many = take(texts, gaps);
  const strengths = await strengthsOf(
    many,
    mapped(
      texts.length,
      Object.fromEntries(Object.keys(gaps).map((i) => [i, "land" as const])),
    ),
    hearing(() => "deliberate"),
  );
  assert.deepEqual(
    strengths!.map((s) => s.seconds.toFixed(1)),
    ["1.7", "1.6"],
    "in the order they were spoken",
  );
});

// A break after "the" (word 2) and, 35 s later, a held pause after a line meant to land (word 44): two clips.
const apart = take(
  [
    ..."We saw the data".split(" "),
    ...Array.from({ length: 35 }, (_, i) => `w${i}`),
    ..."and that changed everything. So we stopped. Then we began again here.".split(
      " ",
    ),
  ],
  { 2: 0.8, 43: 1.5 },
);
// "the" is inside a phrase, and "everything." is a line meant to land.
const apartPlaces = mapped(apart.words.length, { 43: "land" });

test("a strength that can't be heard doesn't undo what was heard about a fault", async () => {
  const prompts: string[] = [];
  const review = await reviewPause(apart.words, apart.pauses, apartPlaces, {
    hear: {
      audio: { samples: new Float32Array(16000 * 60), sampleRate: 16000 },
      judge: async (request) => {
        prompts.push(request.prompt);
        // The break sounds deliberate, so it is no fault; the strength's own clip fails.
        if (request.prompt.includes('"We saw the"'))
          return hearing(() => "deliberate")(request);
        throw new Error("Gemini unavailable");
      },
    },
  });
  assert.ok(prompts.length >= 2, "two clips");
  assert.deepEqual(
    [review.marks.length, review.heard, review.strengths],
    [0, true, undefined],
  );
});

test("with strengths off, no pause is heard about its work", async () => {
  const prompts: string[] = [];
  const review = await reviewPause(apart.words, apart.pauses, apartPlaces, {
    hear: {
      audio,
      judge: async (request) => {
        prompts.push(request.prompt);
        return hearing(() => "deliberate")(request);
      },
    },
    strength: false,
  });
  // Only the break is heard.
  assert.equal(prompts.length, 1);
  assert.doesNotMatch(prompts[0], /changed everything/);
  assert.deepEqual(
    [review.status, review.heard, review.strengths],
    ["reviewed", true, undefined],
  );
});
