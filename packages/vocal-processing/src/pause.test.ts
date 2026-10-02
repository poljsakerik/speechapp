import assert from "node:assert/strict";
import { test } from "node:test";
import { pauseAfterWords, timed } from "./pause.ts";

const words = "we keep talking about this point today."
  .split(" ")
  .map((text, i) => ({ text, start: i * 0.2, end: (i + 1) * 0.2 }));

test("a measured silence belongs to the word before its midpoint, even when a recognizer stretched that word over it", () => {
  const stretched = words.map((w, i) =>
    i === 3
      ? { ...w, end: w.end + 0.5 }
      : i > 3
        ? { ...w, start: w.start + 0.5, end: w.end + 0.5 }
        : w,
  );
  assert.deepEqual(
    pauseAfterWords(stretched, []).map((s) => +s.toFixed(2)),
    [0, 0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    pauseAfterWords(stretched, [{ start: 0.85, end: 1.25 }]).map(
      (s) => +s.toFixed(2),
    ),
    [0, 0, 0, 0.4, 0, 0, 0],
  );
});

test("silences too short to be heard as a pause are ignored", () => {
  assert.deepEqual(
    pauseAfterWords(words, [{ start: 0.39, end: 0.5 }]),
    [0, 0, 0, 0, 0, 0, 0],
  );
});

test("only words with valid, increasing timing can be measured", () => {
  assert.equal(timed(words), true);
  assert.equal(timed([{ text: "hi" }]), false);
  assert.equal(
    timed([
      { text: "a", start: 1, end: 2 },
      { text: "b", start: 0.5, end: 1 },
    ]),
    false,
  );
});
