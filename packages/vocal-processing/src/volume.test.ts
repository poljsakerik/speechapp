import assert from "node:assert/strict";
import { test } from "node:test";
import type { Word } from "./types.ts";
import { detectVolume } from "./volume.ts";

const RATE = 16000;
type Sentence = { gain?: number; dull?: boolean; fade?: boolean };
/**
 * Sentences of eight 0.3 s one-syllable words with 0.5 s of silence between
 * sentences. Each word is a 150 Hz voice with harmonics to 5 kHz; a dull voice
 * loses its upper harmonics faster. A fading sentence says its last four words
 * (its last second and a bit) 20 dB down.
 */
function take(sentences: Sentence[]): { samples: Float32Array; words: Word[] } {
  const words: Word[] = [],
    chunks: number[] = [];
  for (const { gain = 1, dull = false, fade = false } of sentences) {
    for (let w = 0; w < 8; w++) {
      const start = chunks.length / RATE,
        amplitude = gain * (fade && w >= 4 ? 0.1 : 1);
      for (let i = 0; i < 0.3 * RATE; i++) {
        let x = 0;
        for (let k = 1; k <= 33; k++)
          x +=
            Math.sin((2 * Math.PI * 150 * k * i) / RATE) / (dull ? k * k : k);
        chunks.push(0.05 * amplitude * x);
      }
      words.push({
        text: w === 7 ? "day." : "day",
        start,
        end: chunks.length / RATE,
      });
    }
    for (let i = 0; i < 0.5 * RATE; i++) chunks.push(0);
  }
  return { samples: Float32Array.from(chunks), words };
}
const rules = ({ samples, words }: ReturnType<typeof take>) =>
  detectVolume(samples, RATE, words).marks.map((m) => m.rule);
const normal = (n: number): Sentence[] => Array(n).fill({});

test("a sustained softer, duller stretch is flagged the same at any microphone gain", () => {
  const recording = take([
    ...normal(12),
    ...Array(10).fill({ gain: 0.4, dull: true }),
    ...normal(12),
  ]);
  const analysis = detectVolume(recording.samples, RATE, recording.words);
  assert.deepEqual(
    analysis.marks.map((m) => m.rule),
    ["VOLUME_LOW"],
  );
  const [mark] = analysis.marks;
  // Sentences last 2.9 s; the quiet ones run from 34.8 s to 63.8 s.
  assert.ok(
    mark.start <= 40 && mark.end >= 58,
    "the mark covers the quiet stretch",
  );
  assert.ok(
    mark.start >= 34.8 - 2.9 * 2 && mark.end <= 63.8 + 2.9 * 2,
    "give or take a sentence or two",
  );
  const quieter = detectVolume(
    recording.samples.map((x) => x * 0.05),
    RATE,
    recording.words,
  );
  const rounded = (marks: typeof analysis.marks) =>
    marks.map((m) => ({ ...m, drop: m.drop.toFixed(3) }));
  assert.deepEqual(rounded(quieter.marks), rounded(analysis.marks));
});

test("a take that is quiet throughout can't be told from a low microphone and isn't flagged", () => {
  assert.deepEqual(rules(take(Array(30).fill({ gain: 0.1, dull: true }))), []);
});

test("repeated fading endings are flagged; a single faded ending is ordinary intonation", () => {
  assert.deepEqual(
    rules(
      take([
        ...normal(10),
        { fade: true },
        { fade: true },
        { fade: true },
        ...normal(10),
      ]),
    ),
    ["VOLUME_FADE", "VOLUME_FADE", "VOLUME_FADE"],
  );
  assert.deepEqual(
    rules(
      take([
        ...normal(10),
        { fade: true },
        {},
        {},
        { fade: true },
        ...normal(10),
      ]),
    ),
    [],
  );
});

test("too little speech or missing word timing can't be judged", () => {
  const short = take(normal(1));
  assert.equal(detectVolume(short.samples, RATE, short.words).reliable, false);
  const long = take(normal(10));
  assert.equal(
    detectVolume(long.samples, RATE, [...long.words, { text: "day" }]).reliable,
    false,
  );
  assert.equal(detectVolume(long.samples, RATE, long.words).reliable, true);
});
