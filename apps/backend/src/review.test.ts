import assert from "node:assert/strict";
import { test } from "node:test";
import {
  measureVolume,
  pauseAssessment,
  pitchAssessment,
  rateReview,
  segmentWords,
  tonalityAssessment,
  volumeAssessment,
} from "./review.ts";

test("segments report syllables per second including internal silence", () => {
  const [segment] = segmentWords([
    { text: "people", start: 0, end: 0.6 },
    { text: "day.", start: 0.9, end: 1.5 },
  ]);
  assert.equal(
    segment.speakingRate,
    2,
    "three syllables over 1.5 elapsed seconds",
  );
});

test("rate review preserves both phrase actions within one sentence", () => {
  const words = "We need more time now."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const marks = [
    {
      first: 0,
      last: 1,
      start: 0,
      end: 1.8,
      text: "We need",
      rule: "RATE_IMPORTANCE_SLOW" as const,
      articulationRate: 2.5,
    },
    {
      first: 2,
      last: 3,
      start: 2,
      end: 3.8,
      text: "more time",
      rule: "RATE_IMPORTANCE_FAST" as const,
      articulationRate: 8.5,
    },
  ];
  const findings = rateReview(segments, marks, "We need time").assessments[0]
    .findings;
  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map((f) => [f.rule_id, f.start, f.end]),
    [
      ["RATE_IMPORTANCE_SLOW", 0, 1.8],
      ["RATE_IMPORTANCE_FAST", 2, 3.8],
    ],
  );
  assert.deepEqual(findings[0].evidence, {});
  assert.deepEqual(findings[1].evidence, {});
  assert.deepEqual(
    findings.map((f) => f.text),
    ["We need", "more time"],
  );
});

test("an adjustment crossing segment boundaries retains a precise span in each segment", () => {
  const words = "One. Two three."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const marks = [
    {
      first: 0,
      last: 1,
      start: 0,
      end: 1.8,
      text: "One. Two",
      rule: "RATE_IMPORTANCE_FAST" as const,
      articulationRate: 8.5,
    },
  ];
  const findings = rateReview(segmentWords(words), marks, "").assessments[0]
    .findings;
  assert.deepEqual(
    findings.map((f) => [f.segment_id, f.start, f.end]),
    [
      ["segment-1", 0, 0.8],
      ["segment-2", 1, 1.8],
    ],
  );
});

test("insufficient evidence stays uncertain rather than effective", () => {
  const words = "This is one complete passage."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  assert.equal(
    rateReview(segments, [], "", "uncertain").assessments[0].verdict,
    "uncertain",
  );
  assert.equal(rateReview(segments, []).assessments[0].verdict, "effective");
  assert.equal(
    rateReview(segments, []).assessments.find((a) => a.foundation === "pauses")
      ?.verdict,
    "uncertain",
  );
});

test("a passage whose key points went by too fast carries one phrase to slow down and one to move through", () => {
  const words =
    "So the thing is. Sales fell by half. And then we just moved on."
      .split(" ")
      .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const at = (first: number, last: number) => ({
    first,
    last,
    start: words[first].start,
    end: words[last].end,
    text: words
      .slice(first, last + 1)
      .map((w) => w.text)
      .join(" "),
  });
  const mark = {
    ...at(0, 13),
    rule: "RATE_CONTRAST" as const,
    articulationRate: 5,
    suggestions: [
      { ...at(4, 7), direction: "slow_down" as const },
      { ...at(8, 13), direction: "speed_up" as const },
    ],
  };
  const findings = rateReview(segments, [mark]).assessments[0].findings;
  assert.equal(
    findings.length,
    segments.length,
    "one part per segment the passage crosses",
  );
  assert.ok(
    findings.every(
      (f) => f.rule_id === "RATE_CONTRAST" && !("observation" in f),
    ),
  );
  assert.ok(findings.every((f) => f.group_id === "0"));
  assert.deepEqual(findings[0].suggestions, [
    { direction: "slow_down", start: 4, end: 7.8, text: "Sales fell by half." },
    {
      direction: "speed_up",
      start: 8,
      end: 13.8,
      text: "And then we just moved on.",
    },
  ]);
});

test("pause findings highlight the stretch, and unmeasured audio leaves pauses unassessed", () => {
  const words = "We keep going. And going on."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const mark = {
    first: 0,
    last: 5,
    start: 0,
    end: 5.8,
    text: words.map((w) => w.text).join(" "),
    rule: "PAUSE_NECESSARY" as const,
    at: [2],
  };
  const assessment = pauseAssessment(segments, [mark], words);
  assert.equal(assessment.verdict, "mixed");
  assert.deepEqual(
    assessment.findings.map((f) => [
      f.rule_id,
      f.group_id,
      f.start,
      f.end,
      f.uncertainty,
    ]),
    [
      ["PAUSE_NECESSARY", "0", 0, 2.8, "clear"],
      ["PAUSE_NECESSARY", "0", 3, 5.8, "clear"],
    ],
  );
  assert.deepEqual(
    assessment.findings.map((f) => f.suggestions),
    [[{ direction: "pause_after", start: 2, end: 2.8, text: "going." }], []],
    "the pause point sits in the segment that holds its word",
  );
  assert.equal(pauseAssessment(segments, []).verdict, "effective");
  assert.equal(pauseAssessment(segments, undefined).verdict, "uncertain");
});

test("volume findings carry their own coaching; without measured audio volume stays uncertain", () => {
  const words = "We start strong. Then it fades away."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const fade = {
    first: 4,
    last: 6,
    start: 4,
    end: 6.8,
    text: "it fades away.",
    rule: "VOLUME_FADE" as const,
    drop: 15,
  };
  const volume = volumeAssessment(segments, [fade]);
  assert.equal(volume.verdict, "mixed");
  assert.deepEqual(
    volume.findings.map((f) => [f.rule_id, f.start, f.end, f.evidence]),
    [["VOLUME_FADE", 4, 6.8, {}]],
  );
  assert.equal(volumeAssessment(segments, []).verdict, "effective");
  assert.equal(volumeAssessment(segments, undefined).verdict, "uncertain");
});

test("volume is measured on recognizer timing and highlighted on the aligned transcript", () => {
  // Sentences of eight 0.3 s voiced words; three sentences in a row say their last four words 20 dB down.
  const rate = 16000,
    samples: number[] = [],
    recognized: { text: string; start: number; end: number }[] = [];
  for (let s = 0; s < 23; s++) {
    for (let w = 0; w < 8; w++) {
      const start = samples.length / rate,
        gain = s >= 10 && s < 13 && w >= 4 ? 0.1 : 1;
      for (let i = 0; i < 0.3 * rate; i++) {
        let x = 0;
        for (let k = 1; k <= 33; k++)
          x += Math.sin((2 * Math.PI * 150 * k * i) / rate) / k;
        samples.push(0.05 * gain * x);
      }
      recognized.push({
        text: w === 7 ? "day." : "day",
        start,
        end: samples.length / rate,
      });
    }
    for (let i = 0; i < 0.5 * rate; i++) samples.push(0);
  }
  // Alignment trims quiet words as if they were silence; volume must not depend on that.
  const aligned = recognized.map((w) => ({ ...w, end: w.start + 0.05 }));
  const marks = measureVolume(
    Float32Array.from(samples),
    rate,
    recognized,
    aligned,
  )!;
  assert.deepEqual(
    marks.map((m) => m.rule),
    ["VOLUME_FADE", "VOLUME_FADE", "VOLUME_FADE"],
  );
  assert.deepEqual(
    marks.map((m) => [m.start, m.end]),
    marks.map((m) => [aligned[m.first].start, aligned[m.last].end]),
  );
});

test("tonality findings name the feeling the words call for, and a missing review leaves tonality unassessed", () => {
  const words = "This is one complete passage."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const marks = [
    {
      first: 0,
      last: 4,
      start: 0,
      end: 4.8,
      text: "This is one complete passage.",
      rule: "TONE_FLAT" as const,
      expected: ["neutral" as const, "happy" as const],
      expressiveness: 2,
    },
  ];
  const tonality = tonalityAssessment(segments, marks);
  assert.equal(tonality.verdict, "mixed");
  assert.deepEqual(
    tonality.findings.map((f) => [f.rule_id, f.start, f.end]),
    [["TONE_FLAT", 0, 4.8]],
  );
  assert.deepEqual(tonality.findings[0].evidence, {
    expected: ["neutral", "happy"],
  });
  assert.equal("practice" in tonality.findings[0], false);
  assert.equal(tonalityAssessment(segments, []).verdict, "effective");
  assert.equal(tonalityAssessment(segments, undefined).verdict, "uncertain");
});

test("a monotone stretch becomes a pitch finding; without a pitch measurement, pitch stays uncertain", () => {
  const words = "So the thing is. Sales fell by half."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const mark = {
    first: 0,
    last: 7,
    start: 0,
    end: 7.8,
    text: words.map((w) => w.text).join(" "),
    rule: "PITCH_VARIETY" as const,
    spread: 1.7,
    shift: 0,
  };
  const pitch = pitchAssessment(segments, [mark]);
  assert.equal(pitch.verdict, "mixed");
  assert.deepEqual(
    pitch.findings.map((f) => [f.rule_id, f.segment_id]),
    [
      ["PITCH_VARIETY", "segment-1"],
      ["PITCH_VARIETY", "segment-2"],
    ],
  );
  assert.deepEqual(pitch.findings[0].evidence, {});
  assert.equal(pitchAssessment(segments, []).verdict, "effective");
  assert.equal(pitchAssessment(segments, undefined).verdict, "uncertain");
});

test("a pitch mark returns its rule without model-authored UI copy", () => {
  const words = "So the thing is. Sales fell by half."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const mark = {
    first: 0,
    last: 3,
    start: 0,
    end: 3.8,
    text: "So the thing is.",
    rule: "PITCH_HIGH" as const,
    spread: 3,
    shift: 14,
    how: "The voice jumps into a squeaky falsetto.",
    fix: "Say it in your usual voice.",
  };
  const [finding] = pitchAssessment(segmentWords(words), [mark]).findings;
  assert.equal(finding.rule_id, "PITCH_HIGH");
  for (const key of ["observation", "practice", "why_it_matters", "how", "fix"])
    assert.equal(key in finding, false);
});

test("strengths return the evidence needed to localize coaching in the frontend", () => {
  const words = "So when it matters, make sure you slow down. Then move on."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const span = (first: number, last: number) => ({
    first,
    last,
    start: words[first].start,
    end: words[last].end,
    text: words
      .slice(first, last + 1)
      .map((w) => w.text)
      .join(" "),
  });
  const rate = rateReview(segments, [], "", "reviewed", [
    {
      ...span(4, 8),
      rule: "RATE_SLOWS_FOR_POINT",
      pace: Math.log2(0.43),
      focus: span(4, 8),
    },
  ]).assessments[0];
  assert.equal(
    rate.verdict,
    "effective",
    "a strength doesn't change the verdict",
  );
  assert.deepEqual(
    rate.findings.map((f) => [f.kind, f.rule_id, f.group_id, f.start, f.end]),
    [["strength", "RATE_SLOWS_FOR_POINT", "strength-0", 4, 8.8]],
  );
  assert.deepEqual(rate.findings[0].evidence, {
    focusText: "make sure you slow down.",
    pace: Math.log2(0.43),
  });

  const pause = {
    ...span(1, 6),
    rule: "PAUSE_LETS_IT_LAND" as const,
    at: 3,
    seconds: 1.24,
  };
  const pauses = pauseAssessment(segments, [], words, [
    pause,
    { ...pause, rule: "PAUSE_BUILDS_ANTICIPATION" },
  ]);
  assert.deepEqual(
    pauses.findings.map((f) => [f.kind, f.evidence, f.suggestions]),
    [
      ["strength", { seconds: 1.24, focusText: "when it matters," }, []],
      ["strength", { seconds: 1.24, focusText: "make sure you" }, []],
    ],
  );
  assert.deepEqual(
    pauseAssessment(segments, undefined, words, [pause]).findings,
    [],
    "strengths need an assessed review",
  );

  const tone = tonalityAssessment(
    segments,
    [],
    [
      {
        ...span(0, 8),
        rule: "TONE_EXPRESSIVE",
        expected: ["neutral", "happy", "surprised"],
        expressiveness: 4,
      },
    ],
  );
  assert.deepEqual(tone.findings[0].evidence, {
    expected: ["neutral", "happy", "surprised"],
    expressiveness: 4,
  });
  assert.equal(tone.findings[0].uncertainty, "tentative");

  const [melody] = pitchAssessment(
    segments,
    [],
    [{ ...span(0, 11), rule: "PITCH_MELODY", spread: 5.1 }],
  ).findings;
  assert.deepEqual(
    [melody.kind, melody.rule_id, melody.uncertainty],
    ["strength", "PITCH_MELODY", "clear"],
  );
  assert.deepEqual(melody.evidence, {});
});

test("a take that is expressive or melodic throughout says so in its summary instead of marking everything", () => {
  const words = "This is one complete passage."
    .split(" ")
    .map((text, i) => ({ text, start: i, end: i + 0.8 }));
  const segments = segmentWords(words);
  const tone = tonalityAssessment(segments, [], [], true);
  assert.deepEqual(
    [tone.verdict, tone.findings, tone.summaryCode],
    ["effective", [], "expressive"],
  );
  assert.equal(
    tonalityAssessment(segments, [], [], false).summaryCode,
    "effective",
  );
  const melody = { first: 0, last: 4, start: 0, end: 4.8, text: "", spread: 6 };
  assert.equal(
    pitchAssessment(segments, [], [{ ...melody, rule: "PITCH_MELODY" }], true)
      .summaryCode,
    "lively_marked",
  );
});
