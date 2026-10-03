import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudioJudgment } from "./gemini.ts";
import {
  faulted,
  findPauseStrengths,
  parseStrengths,
  strengthRequest,
} from "./pause-strength.ts";
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
const asked = (user: string) =>
  [...user.split("Judge these pauses:")[1].matchAll(/P(\d+)/g)].map((m) =>
    Number(m[1]),
  );
/** A reply giving each pause asked about `verdict(id)`. */
const reply =
  (verdict: (id: number) => string): JsonCompletion =>
  async ({ user }) => ({
    pauses: asked(user).map((id) => ({ id, verdict: verdict(id) })),
  });
const hearing =
  (sound: (prompt: string) => string): AudioJudgment =>
  async ({ prompt }) => ({ pause: sound(prompt) });

test("every pause is marked in place, and only held ones are asked about", () => {
  const marked = [
    { after: 9, seconds: 2.2 },
    { after: 15, seconds: 1.7 },
    { after: 18, seconds: 0.4 },
  ];
  const request = strengthRequest(t.words, marked, [0, 1]);
  assert.match(request.user, /9:said\. \[P0 2\.2s\] 10:Now/);
  assert.match(request.user, /18:breathe\. \[P2 0\.4s\]/);
  assert.deepEqual(request.asked, [0, 1]);
  assert.deepEqual(asked(request.user), [0, 1]);
});

test("a reply must judge every pause asked about", () => {
  assert.equal(
    parseStrengths({ pauses: [{ id: 0, verdict: "lets_it_land" }] }, [0, 1]),
    undefined,
  );
  assert.equal(
    parseStrengths({ pauses: [{ id: 0, verdict: "great" }] }, [0]),
    undefined,
  );
  assert.deepEqual(
    [
      ...parseStrengths(
        {
          pauses: [
            { id: 0, verdict: "lets_it_land" },
            { id: 1, verdict: "ordinary" },
          ],
        },
        [0, 1],
      )!,
    ],
    [
      [0, "lets_it_land"],
      [1, "ordinary"],
    ],
  );
});

test("a pause placed to do work is a strength only if it sounds deliberate", async () => {
  const placed = reply((id) =>
    id === 0 ? "lets_it_land" : id === 1 ? "builds_anticipation" : "ordinary",
  );
  const strengths = await findPauseStrengths(
    t.words,
    t.pauses,
    audio,
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
  const hesitant = await findPauseStrengths(
    t.words,
    t.pauses,
    audio,
    placed,
    async (request) => {
      prompts.push(request.prompt);
      return {
        pause: request.prompt.includes("Now guess") ? "hesitant" : "deliberate",
      };
    },
  );
  assert.deepEqual(
    hesitant!.map((s) => s.at),
    [9],
  );
  assert.ok(prompts.some((p) => p.includes('"Now guess what you can do?"')));
  assert.ok(prompts.some((p) => /pauses for 2\.2 seconds/.test(p)));
});

test("without both models or a complete reply there is no pause strength", async () => {
  const placed = reply(() => "lets_it_land");
  assert.equal(
    await findPauseStrengths(t.words, t.pauses, audio, placed),
    undefined,
  );
  assert.equal(
    await findPauseStrengths(
      t.words,
      t.pauses,
      audio,
      undefined,
      hearing(() => "deliberate"),
    ),
    undefined,
  );
  let calls = 0;
  const incomplete: JsonCompletion = async () => {
    calls++;
    return { pauses: [] };
  };
  assert.equal(
    await findPauseStrengths(
      t.words,
      t.pauses,
      audio,
      incomplete,
      hearing(() => "deliberate"),
    ),
    undefined,
  );
  assert.equal(calls, 2, "asked once more before giving up");
  assert.equal(
    await findPauseStrengths(t.words, t.pauses, audio, placed, async () => {
      throw new Error("Gemini unavailable");
    }),
    undefined,
  );
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
  const strengths = await findPauseStrengths(
    many.words,
    many.pauses,
    audio,
    reply(() => "lets_it_land"),
    hearing(() => "deliberate"),
  );
  assert.deepEqual(
    strengths!.map((s) => s.seconds.toFixed(1)),
    ["1.7", "1.6"],
    "in the order they were spoken",
  );
});
