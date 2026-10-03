import assert from "node:assert/strict";
import { test } from "node:test";
import { detectPitch, trackPitch, trackPitchInSteps } from "./pitch.ts";
import type { Word } from "./types.ts";

const RATE = 16000;
// Semitones from the speaker's base pitch, one per word: a sentence's melody (about 3.6 standard deviation) or a near monotone (0.4).
const MELODIC = [0, 4, 2, -3, 5, 1, -2, -6],
  FLAT = [0, 0.5, 0, -0.5, 0, 0.5, 0, -0.5];
/**
 * Sentences of eight 0.3 s one-syllable words with 0.5 s of silence between
 * sentences. Each word is a voice with harmonics to 5 kHz, held on its note.
 */
function take(
  sentences: number[][],
  base = 130,
): { samples: Float32Array; words: Word[] } {
  const words: Word[] = [],
    chunks: number[] = [];
  let phase = 0;
  for (const notes of sentences) {
    for (const [w, note] of notes.entries()) {
      const start = chunks.length / RATE,
        f0 = base * 2 ** (note / 12);
      for (let i = 0; i < 0.3 * RATE; i++) {
        phase += (2 * Math.PI * f0) / RATE;
        let x = 0;
        for (let k = 1; k * f0 < 5000; k++) x += Math.sin(k * phase) / k;
        chunks.push(0.05 * x);
      }
      words.push({
        text: w === notes.length - 1 ? "day." : "day",
        start,
        end: chunks.length / RATE,
      });
    }
    for (let i = 0; i < 0.5 * RATE; i++) chunks.push(0);
  }
  return { samples: Float32Array.from(chunks), words };
}
const sentences = (notes: number[], n: number) => Array(n).fill(notes);

test("a monotone stretch inside melodic speech is flagged, whether the voice is low or high", () => {
  for (const base of [110, 220]) {
    const { samples, words } = take(
      [
        ...sentences(MELODIC, 5),
        ...sentences(FLAT, 8),
        ...sentences(MELODIC, 5),
      ],
      base,
    );
    const analysis = detectPitch(samples, RATE, words);
    assert.deepEqual(
      analysis.marks.map((m) => m.rule),
      ["PITCH_VARIETY"],
    );
    const [mark] = analysis.marks;
    // Sentences last 2.9 s; the flat ones run from 14.5 s to 37.7 s.
    assert.ok(
      mark.start <= 20 && mark.end >= 32,
      "the mark covers the flat stretch",
    );
    // A window mostly on one note averages flat, so a mark can reach into the melody on either side.
    assert.ok(
      mark.start >= 14.5 - 2.9 * 2 && mark.end <= 37.7 + 2.9 * 2,
      "give or take two sentences",
    );
    assert.ok(mark.spread < 1, "the flat stretch barely moves");
  }
});

test("melodic speech isn't flagged; a clip with less than 10 s of speech is judged whole", () => {
  const melodic = take(sentences(MELODIC, 12));
  assert.deepEqual(detectPitch(melodic.samples, RATE, melodic.words).marks, []);
  const flat = take(sentences(FLAT, 3));
  const analysis = detectPitch(flat.samples, RATE, flat.words);
  assert.deepEqual(
    analysis.marks.map((m) => [m.first, m.last]),
    [[0, flat.words.length - 1]],
  );
});

test("too little speech or missing word timing can't be judged", () => {
  const short = take(sentences(MELODIC, 2));
  assert.equal(detectPitch(short.samples, RATE, short.words).reliable, false);
  const long = take(sentences(MELODIC, 5));
  assert.equal(
    detectPitch(long.samples, RATE, [...long.words, { text: "day" }]).reliable,
    false,
  );
  assert.equal(detectPitch(long.samples, RATE, long.words).reliable, true);
  // Words over silence have no pitch to measure.
  assert.equal(
    detectPitch(new Float32Array(long.samples.length), RATE, long.words)
      .reliable,
    false,
  );
});

test("a stretch stuck well above or below the speaker's normal is flagged as high or low, not monotone", () => {
  const up = (notes: number[], by: number) => notes.map((n) => n + by);
  const high = take(
    [
      ...sentences(MELODIC, 5),
      ...sentences(up(FLAT, 14), 5),
      ...sentences(MELODIC, 5),
    ],
    120,
  );
  const marks = detectPitch(high.samples, RATE, high.words).marks;
  assert.deepEqual(
    marks.map((m) => m.rule),
    ["PITCH_HIGH"],
  );
  // The high sentences run from 14.5 s to 29 s.
  // The normal is the median of the whole take, which the high third pulls up a little.
  assert.ok(
    marks[0].start >= 14.5 - 2.9 * 2 &&
      marks[0].end <= 29 + 2.9 * 2 &&
      marks[0].shift > 9,
  );
  const low = take(
    [
      ...sentences(MELODIC, 5),
      ...sentences(up(MELODIC, -11), 5),
      ...sentences(MELODIC, 5),
    ],
    160,
  );
  assert.deepEqual(
    detectPitch(low.samples, RATE, low.words).marks.map((m) => m.rule),
    ["PITCH_LOW"],
  );
  // Everyday drift between sentences is no register change.
  const drift = take([
    ...sentences(MELODIC, 5),
    ...sentences(up(MELODIC, 4), 5),
    ...sentences(MELODIC, 5),
  ]);
  assert.deepEqual(detectPitch(drift.samples, RATE, drift.words).marks, []);
});

test("a voice that is high throughout has no normal to compare with and isn't flagged", () => {
  const { samples, words } = take(sentences(MELODIC, 12), 380);
  assert.deepEqual(detectPitch(samples, RATE, words).marks, []);
});

test("a few seconds an octave above normal is a squeak; a shorter jump of a few semitones is expression", () => {
  const up = (notes: number[], by: number) => notes.map((n) => n + by);
  const squeak = take(
    [
      ...sentences(MELODIC, 6),
      ...sentences(up(MELODIC, 14), 2),
      ...sentences(MELODIC, 6),
    ],
    120,
  );
  assert.deepEqual(
    detectPitch(squeak.samples, RATE, squeak.words).marks.map((m) => m.rule),
    ["PITCH_HIGH"],
  );
  const excited = take(
    [
      ...sentences(MELODIC, 6),
      ...sentences(up(MELODIC, 8), 2),
      ...sentences(MELODIC, 6),
    ],
    120,
  );
  assert.deepEqual(detectPitch(excited.samples, RATE, excited.words).marks, []);
});

test("a heard stretch counts only when it is badly distracting and the measurement agrees", () => {
  // Lively speech around them, as the course coach's: about 5.4 semitones.
  const lively = MELODIC.map((n) => n * 1.5);
  const short = take([
    ...sentences(lively, 5),
    ...sentences(FLAT, 2),
    ...sentences(lively, 5),
  ]);
  // The flat sentences (14.5-20.3 s) are too short for a 10 s window.
  assert.deepEqual(detectPitch(short.samples, RATE, short.words).marks, []);
  const heard = (
    issue: "monotone" | "too_low" | "too_high",
    start: number,
    end: number,
    severity = 2,
  ) => ({
    start,
    end,
    issue,
    severity,
    how: "It stays on one note.",
    fix: "Lift the word that matters.",
  });
  const [mark] = detectPitch(short.samples, RATE, short.words, {}, [
    heard("monotone", 14.5, 20.3),
  ]).marks;
  assert.deepEqual(
    [mark.rule, mark.how, mark.fix],
    ["PITCH_VARIETY", "It stays on one note.", "Lift the word that matters."],
  );
  assert.ok(mark.start >= 14.5 && mark.end <= 20.3);
  // A minor problem heard over a measured mark only describes it.
  const flatTalk = take([
    ...sentences(MELODIC, 5),
    ...sentences(FLAT, 8),
    ...sentences(MELODIC, 5),
  ]);
  const described = detectPitch(flatTalk.samples, RATE, flatTalk.words, {}, [
    heard("monotone", 20, 25, 3),
  ]).marks;
  assert.deepEqual(
    described.map((m) => [m.rule, m.how]),
    [["PITCH_VARIETY", "It stays on one note."]],
  );
  // Minor problems don't count, and neither does a "monotone" stretch that measurably moves.
  assert.deepEqual(
    detectPitch(short.samples, RATE, short.words, {}, [
      heard("monotone", 14.5, 20.3, 3),
      heard("monotone", 0, 14),
    ]).marks,
    [],
  );
  // Heard as too high: only an octave above normal or above 350 Hz agrees.
  const high = take(sentences(MELODIC, 5), 380),
    normal = take(sentences(MELODIC, 5), 200);
  assert.deepEqual(
    detectPitch(high.samples, RATE, high.words, {}, [
      heard("too_high", 0, 14),
    ]).marks.map((m) => m.rule),
    ["PITCH_HIGH"],
  );
  assert.deepEqual(
    detectPitch(normal.samples, RATE, normal.words, {}, [
      heard("too_high", 0, 14),
    ]).marks,
    [],
  );
  // Heard as too low but measured flat in a normal register: monotone, without the "too low" description.
  const [flat] = detectPitch(short.samples, RATE, short.words, {}, [
    heard("too_low", 14.5, 20.3),
  ]).marks;
  assert.deepEqual([flat.rule, flat.how], ["PITCH_VARIETY", undefined]);
});

test("a register mark inside a monotone stretch leaves the monotone parts on either side", () => {
  // 30 s of speaking on one high note: monotone throughout, with no normal to call it high.
  const { samples, words } = take(sentences(FLAT, 13), 380);
  const [flat] = detectPitch(samples, RATE, words).marks;
  assert.equal(flat.rule, "PITCH_VARIETY");
  const heard = {
    start: 12,
    end: 17,
    issue: "too_high" as const,
    severity: 2,
    how: "Squeaky.",
    fix: "Lower it.",
  };
  const marks = detectPitch(samples, RATE, words, {}, [heard]).marks;
  assert.deepEqual(
    marks.map((m) => m.rule),
    ["PITCH_VARIETY", "PITCH_HIGH", "PITCH_VARIETY"],
  );
  const [before, high, after] = marks;
  assert.deepEqual([before.start, after.end], [flat.start, flat.end]);
  assert.ok(
    before.last + 1 === high.first && high.last + 1 === after.first,
    "the parts meet the register mark without overlapping it",
  );
});

test("pitch tracked in steps matches the track measured at once, and detection can reuse it", async () => {
  const { samples, words } = take([
    ...sentences(MELODIC, 5),
    ...sentences(FLAT, 8),
    ...sentences(MELODIC, 5),
  ]);
  const track = trackPitch(samples, RATE);
  assert.deepEqual(await trackPitchInSteps(samples, RATE, 100), track);
  assert.deepEqual(
    detectPitch(samples, RATE, words, {}, [], track),
    detectPitch(samples, RATE, words),
  );
});

// A wider melody than MELODIC: about 5.5 semitones standard deviation.
const LIVELY = [0, 7, 3, -5, 8, 1, -4, -9];

test("a melody that moves as much as the coach's teaching is a strength; ordinary melody isn't", () => {
  const { samples, words } = take([
    ...sentences(MELODIC, 5),
    ...sentences(LIVELY, 8),
    ...sentences(MELODIC, 5),
  ]);
  const analysis = detectPitch(samples, RATE, words);
  assert.deepEqual(analysis.marks, []);
  assert.deepEqual(
    analysis.strengths.map((s) => s.rule),
    ["PITCH_MELODY"],
  );
  const [strength] = analysis.strengths;
  // The lively sentences run from 14.5 s to 37.7 s; the strength is the middle of their liveliest 10 s.
  assert.ok(strength.start >= 14.5 - 2.9 && strength.end <= 37.7 + 2.9);
  assert.ok(strength.end - strength.start < 10, "a stretch to point at");
  assert.ok(strength.spread >= 4.5);
  const melodic = take(sentences(MELODIC, 12));
  assert.deepEqual(
    detectPitch(melodic.samples, RATE, melodic.words).strengths,
    [],
  );
});

test("a take that is lively throughout gets its liveliest stretches named, at most one a minute", () => {
  // 50 sentences are two minutes of speaking, every window of it lively.
  const { samples, words } = take(sentences(LIVELY, 50));
  const { strengths, spread } = detectPitch(samples, RATE, words);
  assert.equal(strengths.length, 2);
  assert.ok(strengths[0].end <= strengths[1].start, "apart from each other");
  assert.ok(
    strengths.reduce((s, m) => s + m.end - m.start, 0) < 20,
    "not the whole take",
  );
  assert.ok(spread! >= 4.5, "the take's spread says it is lively throughout");
});

test("a lively stretch heard as a distracting problem isn't praised", () => {
  const { samples, words } = take(sentences(LIVELY, 12));
  assert.equal(detectPitch(samples, RATE, words).strengths.length, 1);
  const singSong = {
    start: 0,
    end: words.at(-1)!.end!,
    issue: "sing_song" as const,
    severity: 2,
    how: "The same rise and fall repeats.",
    fix: "Let the melody follow the meaning.",
  };
  assert.deepEqual(
    detectPitch(samples, RATE, words, {}, [singSong]).strengths,
    [],
  );
  assert.equal(
    detectPitch(samples, RATE, words, {}, [{ ...singSong, severity: 3 }])
      .strengths.length,
    1,
    "a minor problem doesn't undo it",
  );
});

test("what is left of a lively window after a problem is cut out must be lively itself", () => {
  // Five seconds leaping 16 semitones, then five on one note: 5.7 semitones over the whole clip.
  const leaping = [8, -8, 8, -8, 8, -8, 8, -8],
    still = Array(8).fill(0);
  const { samples, words } = take([leaping, leaping, still, still]);
  assert.equal(detectPitch(samples, RATE, words).strengths.length, 1);
  const singSong = {
    start: 0,
    end: words[15].end!,
    issue: "sing_song" as const,
    severity: 2,
    how: "The voice swings between two notes.",
    fix: "Let the melody follow the meaning.",
  };
  assert.deepEqual(
    detectPitch(samples, RATE, words, {}, [singSong]).strengths,
    [],
    "the monotone remainder isn't praised with the window's spread",
  );
});
