import assert from "node:assert/strict";
import test from "node:test";

import { encodeWav, planDemos, sampleSpan } from "../src/lib/demo.ts";

const words = (start, texts) =>
  texts.map((text, i) => ({ text, start: start + i, end: start + i + 0.8 }));
const take = {
  duration: 40,
  peaks: [],
  pauses: [],
  segments: [
    {
      id: "s1",
      start: 0,
      end: 4,
      text: "",
      words: words(0, ["One", "two,", "three", "four."]),
    },
    {
      id: "s2",
      start: 30,
      end: 34,
      text: "",
      words: words(30, ["Five", "six", "seven", "eight."]),
    },
  ],
};
const note = {
  id: "pauses-0",
  foundation: "pauses",
  segmentId: "s1",
  ruleId: "PAUSE_UNNECESSARY",
  kind: "improvement",
  uncertainty: "clear",
  observation: "",
  why: "",
  practice: "",
  at: 1,
};

const said = (start, text) =>
  text.split(" ").map((word, i) => ({
    text: word,
    start: start + i,
    end: start + i + 0.8,
  }));

test("a demo says whole sentences with one of context either side, and drops the pause before a note's words", () => {
  // The recognizer wrote a full stop where the speaker paused.
  const lines = [
    "Hi, I'm Sam.",
    "I've been a software engineer. For the last five years.",
    "Before that I taught maths.",
    "Now I build tools.",
  ];
  const talk = {
    ...take,
    pauses: [{ start: 8.8, end: 10.5 }],
    segments: lines.map((text, i) => ({
      id: `l${i}`,
      text,
      start: i * 10,
      end: i * 10 + 10,
      // The second line's words run 5 to 9, then 10.5 on after the pause.
      words: said(i === 1 ? 5 : i * 20, text).map((w, k) =>
        i === 1 && k >= 5
          ? { ...w, start: 10.5 + (k - 5), end: 11.3 + (k - 5) }
          : w,
      ),
    })),
  };
  const pause = {
    ...note,
    segmentId: "l1",
    span: [10.5, 15.3],
  };
  assert.deepEqual(planDemos(talk, [pause], 160), [
    {
      id: "demo-0-17",
      noteIds: ["pauses-0"],
      passage: {
        words: [
          ...lines[0].split(" "),
          ...lines[1].split(" "),
          ...lines[2].split(" "),
        ],
        notes: [
          {
            ruleId: "PAUSE_UNNECESSARY",
            from: 7,
            to: 12,
            suggestions: [{ direction: "no_pause_after", from: 7, to: 7 }],
          },
        ],
      },
    },
  ]);
  // Context gives way first when the passage is too long; strengths get no demo.
  assert.deepEqual(
    planDemos(talk, [pause, { ...note, kind: "strength", id: "s" }], 12)[0]
      .passage.words,
    lines[1].split(" "),
  );
});

test("sentences are found across lines, which also break at pauses and when they grow long", () => {
  const talk = (lines) => ({
    ...take,
    pauses: [],
    segments: lines.map((text, i) => ({
      id: `l${i}`,
      text,
      start: i * 100,
      end: i * 100 + 99,
      words: said(i * 100, text),
    })),
  });
  const on = (line, at) => ({
    ...note,
    ruleId: "TONE_FLAT",
    segmentId: `l${line}`,
    span: [line * 100 + at, line * 100 + at + 0.8],
  });
  const paused = talk([
    "Hello there.",
    "I have worked",
    "as a software engineer",
    "for the last five years.",
    "It was fun.",
  ]);
  assert.equal(
    planDemos(paused, [on(3, 2)], 160)[0].passage.words.join(" "),
    "Hello there. I have worked as a software engineer for the last five years. It was fun.",
  );
  // One 80-word sentence over lines of 25 words is said whole.
  const count = (from, to) =>
    Array.from({ length: to - from }, (_, i) => `w${from + i}`).join(" ");
  const long = talk([
    count(0, 25),
    count(25, 50),
    count(50, 75),
    `${count(75, 79)} end.`,
  ]);
  assert.equal(planDemos(long, [on(2, 10)], 160)[0].passage.words.length, 80);
  // Too long to say whole, it is said around the noted word.
  const cut = planDemos(long, [on(2, 10)], 21)[0].passage;
  assert.deepEqual(
    [cut.words[0], cut.words.at(-1), cut.notes[0].from],
    ["w50", "w70", 10],
  );
});

test("notes on the same or neighbouring sentences share one demo", () => {
  const lines = [
    "One two three.",
    "Four five six.",
    "Seven eight nine.",
    "Ten eleven twelve.",
    "Thirteen fourteen fifteen.",
  ];
  const talk = {
    ...take,
    segments: lines.map((text, i) => ({
      id: `l${i}`,
      text,
      start: i * 10,
      end: i * 10 + 3,
      words: said(i * 10, text),
    })),
  };
  const on = (id, line, extra = {}) => ({
    ...note,
    id,
    ruleId: "TONE_FLAT",
    segmentId: `l${line}`,
    span: [line * 10, line * 10 + 2.8],
    ...extra,
  });
  const demos = planDemos(
    talk,
    [
      on("a", 0),
      on("b", 1, {
        ruleId: "PAUSE_NECESSARY",
        suggestions: [
          { direction: "pause_after", span: [10, 10.8], text: "Four" },
        ],
      }),
      on("c", 4),
    ],
    160,
  );
  assert.deepEqual(
    demos.map((d) => [d.noteIds, d.passage.words.length]),
    [
      [["a", "b"], 9],
      [["c"], 6],
    ],
  );
  assert.deepEqual(demos[0].passage.notes, [
    { ruleId: "TONE_FLAT", from: 0, to: 2, suggestions: [] },
    {
      ruleId: "PAUSE_NECESSARY",
      from: 3,
      to: 5,
      suggestions: [{ direction: "pause_after", from: 3, to: 3 }],
    },
  ]);
});

test("the voice is learned from the stretch with the most speech, lively speech first", () => {
  const long = {
    ...take,
    segments: [
      take.segments[0],
      {
        id: "s2",
        start: 30,
        end: 36,
        text: "",
        words: words(30, ["Five", "six", "seven", "eight", "nine", "ten."]),
      },
    ],
  };
  assert.deepEqual(sampleSpan(long, []), {
    start: 29.9,
    end: 35.9,
    text: "Five six seven eight nine ten.",
  });
  const lively = {
    ...note,
    kind: "strength",
    ruleId: "TONE_EXPRESSIVE",
    span: [0, 3.8],
  };
  assert.equal(sampleSpan(long, [lively]).text, "One two, three four.");
  assert.equal(sampleSpan({ ...take, segments: [] }, []), undefined);
});

test("a voice sample is written as mono 16-bit WAV", async () => {
  const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 24000);
  const view = new DataView(await wav.arrayBuffer());
  assert.equal(wav.type, "audio/wav");
  assert.equal(view.byteLength, 52);
  assert.equal(view.getUint32(24, true), 24000);
  assert.deepEqual(
    [44, 46, 48, 50].map((at) => view.getInt16(at, true)),
    [0, 32767, -32767, 32767],
  );
});
