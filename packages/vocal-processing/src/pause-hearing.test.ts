import assert from "node:assert/strict";
import { test } from "node:test";
import { hearingClips, hearMoments, type Moment } from "./pause-hearing.ts";

// A word every second, each 0.4 s long.
const words = Array.from({ length: 60 }, (_, i) => ({
  text: `w${i}`,
  start: i,
  end: i + 0.4,
}));
const audio = { samples: new Float32Array(16000 * 60), sampleRate: 16000 };
const moments: Moment[] = [
  { kind: "pause", at: 10, seconds: 0.6 },
  { kind: "missing", at: 13 },
  { kind: "pause", at: 40, seconds: 0.6, first: 38 },
  { kind: "pause", at: 16, seconds: 0.6 },
];

test("moments whose clips overlap share one, in spoken order, up to the longest clip", () => {
  assert.deepEqual(
    hearingClips(words, moments).map((c) => c.moments),
    [[0, 1, 3], [2]],
  );
  // The clip runs from the first moment's lead-in to what follows the last.
  const [clip, alone] = hearingClips(words, moments);
  assert.deepEqual(
    [clip.from, clip.to, alone.from, alone.to].map((x) => +x.toFixed(1)),
    [4.7, 19.5, 37.7, 43.5],
  );
  assert.deepEqual(
    hearingClips(words, moments, { clipSeconds: 12 }).map((c) => c.moments),
    [[0, 1], [3], [2]],
  );
  assert.equal(hearingClips(words, moments, { clipSeconds: 1 }).length, 4);
});

test("each moment gets its own answer, and only one of its kind", async () => {
  const prompts: string[] = [];
  const sounds = await hearMoments(
    words,
    moments,
    audio,
    async ({ prompt }) => {
      prompts.push(prompt);
      return prompt.includes("3. ")
        ? {
            moments: [
              { id: 1, sound: "hesitant" },
              { id: 2, sound: "clear" },
              { id: 3, sound: "deliberate" },
            ],
          }
        : { moments: [{ id: 1, sound: "ordinary" }] };
    },
  );
  assert.deepEqual(sounds, ["hesitant", "clear", "ordinary", "deliberate"]);
  // A clip of pauses only isn't told about places without one.
  assert.ok(!prompts.find((p) => !p.includes("3. "))!.includes("runs_on"));
  // A clip answered with the wrong kind, or that throws, leaves only its own moments unheard.
  assert.deepEqual(
    await hearMoments(words, moments, audio, async ({ prompt }) => {
      if (!prompt.includes("3. ")) throw new Error("Gemini unavailable");
      return { moments: [1, 2, 3].map((id) => ({ id, sound: "hesitant" })) };
    }),
    [undefined, undefined, undefined, undefined],
  );
  assert.deepEqual(
    await hearMoments(words, moments, audio, async ({ prompt }) => {
      if (!prompt.includes("3. ")) throw new Error("Gemini unavailable");
      return {
        moments: [
          { id: 1, sound: "hesitant" },
          { id: 2, sound: "clear" },
          { id: 3, sound: "ordinary" },
        ],
      };
    }),
    ["hesitant", "clear", undefined, "ordinary"],
  );
});
