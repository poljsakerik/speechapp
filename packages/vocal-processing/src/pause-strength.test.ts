import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudioJudgment } from "./gemini.ts";
import { reviewPause, reviewRequest } from "./pause-review.ts";
import { faulted } from "./pause-strength.ts";
import type { JsonCompletion } from "./types.ts";

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
const ids = (line: string) =>
  [...line.matchAll(/P(\d+)/g)].map((m) => Number(m[1]));
/** A reply in which every pause fits, each held pause does `work(id)`, and no stretch needs a pause. */
const reply =
  (work: (id: number) => string): JsonCompletion =>
  async ({ user }) => {
    const asked = user.split("Review only")[1],
      held = ids(asked.split("Held pauses")[1]);
    return {
      pauses: ids(asked.split("\n")[0]).map((id) => ({
        id,
        verdict: "fits",
        work: held.includes(id) ? work(id) : "ordinary",
      })),
      stretches: [...asked.matchAll(/S(\d+):/g)].map((m) => ({
        id: Number(m[1]),
        pause_after: [],
      })),
    };
  };
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
  complete: JsonCompletion,
  judge?: AudioJudgment,
) =>
  (
    await reviewPause(
      take.words,
      take.pauses,
      complete,
      undefined,
      judge && { audio, judge },
    )
  ).strengths;

test("only held pauses are asked what work they do", () => {
  const marked = [
    { after: 9, seconds: 2.2 },
    { after: 15, seconds: 1.7 },
    { after: 18, seconds: 0.4 },
  ];
  const { user } = reviewRequest(t.words, marked, () => 1, undefined, [0, 1]);
  assert.match(user, /18:breathe\. \[P2 0\.4s\]/);
  assert.match(user, /pauses P0, P1, P2 and these stretches/);
  assert.match(user, /Held pauses to judge the work of: P0, P1$/);
});

test("a pause placed to do work is a strength only if it fits and sounds deliberate", async () => {
  const placed = reply((id) =>
    id === 0 ? "lets_it_land" : id === 1 ? "builds_anticipation" : "ordinary",
  );
  const strengths = await strengthsOf(
    t,
    placed,
    hearing(() => "deliberate"),
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
      // the held pause after "the" is ordinary and the breath isn't asked about.
      ["PAUSE_LETS_IT_LAND", 9, "2.2", 4, 15],
      ["PAUSE_BUILDS_ANTICIPATION", 15, "1.7", 10, 18],
    ],
  );
  // The hearing is asked about the pause after the words that lead into it.
  const prompts: string[] = [];
  const hesitant = await strengthsOf(t, placed, async (request) => {
    prompts.push(request.prompt);
    return hearing((line) =>
      line.includes("Now guess") ? "hesitant" : "deliberate",
    )(request);
  });
  assert.deepEqual(
    hesitant!.map((s) => s.at),
    [9],
  );
  assert.ok(prompts.some((p) => p.includes('"Now guess what you can do?"')));
  assert.ok(prompts.some((p) => /pauses for 2\.2 seconds/.test(p)));
  // A pause the same reply faults is not also praised.
  const faultedToo: JsonCompletion = async (request) => {
    const answer = (await placed(request)) as {
      pauses: { id: number; verdict: string }[];
    };
    answer.pauses[0].verdict = "too_short";
    return answer;
  };
  assert.deepEqual(
    (await strengthsOf(
      t,
      faultedToo,
      hearing(() => "deliberate"),
    ))!.map((s) => s.at),
    [15],
  );
});

test("without both models or a complete reply there is no pause strength", async () => {
  const placed = reply(() => "lets_it_land");
  assert.equal(await strengthsOf(t, placed), undefined);
  // A reply that leaves a held pause's work out is asked once more, then nothing is assessed.
  let calls = 0;
  const incomplete: JsonCompletion = async (request) => {
    calls++;
    const answer = (await placed(request)) as {
      pauses: { work?: string }[];
    };
    delete answer.pauses[0].work;
    return answer;
  };
  const review = await reviewPause(t.words, t.pauses, incomplete, undefined, {
    audio,
    judge: hearing(() => "deliberate"),
  });
  assert.deepEqual(
    [review.status, review.strengths],
    ["unusable reply", undefined],
  );
  assert.equal(calls, 2, "asked once more before giving up");
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
    reply(() => "lets_it_land"),
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
/** The first pause breaks the thought; the second fits and lets the line land. */
const breakThenStrength: JsonCompletion = async (request) => {
  const answer = (await reply(() => "lets_it_land")(request)) as {
    pauses: { id: number; verdict: string }[];
  };
  for (const p of answer.pauses) if (p.id === 0) p.verdict = "breaks";
  return answer;
};

test("a strength that can't be heard doesn't undo what was heard about a fault", async () => {
  const prompts: string[] = [];
  const review = await reviewPause(
    apart.words,
    apart.pauses,
    breakThenStrength,
    undefined,
    {
      audio: { samples: new Float32Array(16000 * 60), sampleRate: 16000 },
      judge: async (request) => {
        prompts.push(request.prompt);
        // The break sounds deliberate, so it is no fault; the strength's own clip fails.
        if (request.prompt.includes('"We saw the"'))
          return hearing(() => "deliberate")(request);
        throw new Error("Gemini unavailable");
      },
    },
  );
  assert.ok(prompts.length >= 2, "two clips");
  assert.deepEqual(
    [review.marks.length, review.heard, review.strengths],
    [0, true, undefined],
  );
});

test("with strengths off, no pause is asked or heard about its work", async () => {
  const requests: string[] = [];
  let hearings = 0;
  const review = await reviewPause(
    apart.words,
    apart.pauses,
    async (request) => {
      requests.push(request.user);
      return reply(() => "lets_it_land")(request);
    },
    undefined,
    {
      audio,
      judge: async (request) => {
        hearings++;
        return hearing(() => "deliberate")(request);
      },
    },
    false,
  );
  assert.match(requests[0], /Held pauses to judge the work of: \(none\)$/);
  assert.deepEqual(
    [hearings, review.status, review.heard, review.strengths],
    [0, "reviewed", true, undefined],
  );
});
