import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyReviewMessage, normalizeReview } from "../src/lib/review.ts";

const words = "We need more time now."
  .split(" ")
  .map((text, i) => ({ text, start: i, end: i + 0.8 }));
const segments = [
  { id: "s1", start: 0, end: 4.8, words, text: "We need more time now." },
];
const raw = (range) => ({
  assessments: [
    {
      foundation: "rate",
      findings: [
        { segment_id: "s1", observation: "Slow down on more time", ...range },
      ],
    },
  ],
});
test("empty feedback distinguishes an inconclusive review from no detected rate issues", () => {
  const uncertain = normalizeReview(
    { assessments: [{ foundation: "rate", verdict: "uncertain" }] },
    segments,
  );
  assert.match(
    emptyReviewMessage(uncertain.assessments),
    /enough reliable evidence/,
  );
  assert.equal(
    emptyReviewMessage([]),
    emptyReviewMessage(uncertain.assessments),
  );
  const reviewed = normalizeReview(
    { assessments: [{ foundation: "rate", verdict: "effective" }] },
    segments,
  );
  assert.match(
    emptyReviewMessage(reviewed.assessments),
    /No rate-of-speech issues were flagged/,
  );
  assert.match(
    emptyReviewMessage(reviewed.assessments),
    /other 4 fundamentals haven’t been assessed/,
  );
  const both = normalizeReview(
    {
      assessments: [
        { foundation: "rate", verdict: "effective" },
        { foundation: "pauses", verdict: "effective" },
        { foundation: "volume", verdict: "uncertain" },
      ],
    },
    segments,
  );
  assert.equal(
    emptyReviewMessage(both.assessments),
    "No rate-of-speech or pause issues were flagged. The other 3 fundamentals haven’t been assessed.",
  );
});
test("phrase feedback seeks to and highlights only its words", () => {
  const finding = normalizeReview(raw({ start: 2, end: 3.8 }), segments)
    .findings[0];
  assert.equal(finding.at, 2);
  assert.deepEqual(finding.span, [2, 3.8]);
});
test("absent or invalid phrase bounds fall back safely to the segment", () => {
  for (const range of [
    {},
    { start: -1, end: 3.8 },
    { start: 2, end: 100 },
    { start: 3, end: 2 },
    { start: NaN, end: 3 },
  ]) {
    const finding = normalizeReview(raw(range), segments).findings[0];
    assert.equal(finding.at, 0);
    assert.equal(finding.span, undefined);
  }
});

test("a connected passage split by ASR gets one note and complete replay without bridging unmarked words", () => {
  const parts = [
    { id: "a", start: 0, end: 1.8, words: words.slice(0, 2), text: "We need" },
    {
      id: "b",
      start: 2,
      end: 4.8,
      words: words.slice(2),
      text: "more time now.",
    },
  ];
  const findings = [
    {
      segment_id: "a",
      group_id: "0",
      rule_id: "RATE_FLOW",
      start: 0,
      end: 1.8,
      observation: "Carry this thought forward",
    },
    {
      segment_id: "b",
      group_id: "0",
      rule_id: "RATE_FLOW",
      start: 2,
      end: 4.8,
      observation: "Carry this thought forward",
    },
  ];
  const review = () =>
    normalizeReview({ assessments: [{ foundation: "rate", findings }] }, parts);
  assert.equal(review().findings.length, 1);
  assert.deepEqual(review().findings[0].span, [0, 4.8]);
  findings[1].start = 3;
  assert.equal(
    review().findings.length,
    2,
    "an unmarked word between spans must stay unmarked",
  );
});
test("pause pointers survive normalization; unknown directions are dropped", () => {
  const review = normalizeReview(
    {
      assessments: [
        {
          foundation: "pauses",
          findings: [
            {
              segment_id: "s1",
              observation: "Runs on",
              start: 0,
              end: 4.8,
              suggestions: [
                { direction: "pause_after", start: 1, end: 1.8, text: "need" },
                {
                  direction: "no_pause_after",
                  start: 2,
                  end: 2.8,
                  text: "more",
                },
                { direction: "shout", start: 3, end: 3.8, text: "time" },
              ],
            },
          ],
        },
      ],
    },
    segments,
  );
  assert.deepEqual(
    review.findings[0].suggestions.map((s) => s.direction),
    ["pause_after", "no_pause_after"],
  );
});

test("structured coaching localizes evidence without translating recording content", async () => {
  const { findingCopy, assessmentCopy } =
    await import("../src/lib/coaching.ts");
  assert.equal(
    findingCopy("RATE_SLOWS_FOR_POINT", {
      focusText: "more time.",
      pace: Math.log2(0.43),
    }).observation,
    "You slow right down on “more time”, to about 45% of your usual pace.",
  );
  assert.equal(
    findingCopy("PAUSE_LETS_IT_LAND", {
      focusText: "more time,",
      seconds: 1.24,
    }).observation,
    "You stop for 1.2 seconds after “more time” and let it land.",
  );
  assert.equal(
    findingCopy("PAUSE_BUILDS_ANTICIPATION", {
      focusText: "more time.",
      seconds: 1,
    }).observation,
    "You pause for 1.0 second just before “more time”.",
  );
  assert.equal(
    findingCopy("TONE_FLAT", {
      expected: ["neutral", "happy", "surprised"],
    }).observation,
    "Your voice sounds flat here, while the words call for warmth or enthusiasm and curiosity.",
  );
  assert.match(
    findingCopy("TONE_EXPRESSIVE", {
      expected: ["sad"],
      expressiveness: 5,
    }).observation,
    /vivid.*concern/,
  );
  assert.equal(findingCopy("FUTURE_RULE"), undefined);
  assert.match(
    assessmentCopy("pitch_melody", "lively_marked"),
    /marked stretches/,
  );
  assert.match(
    assessmentCopy("tonality", "expressive"),
    /expressive throughout/,
  );
  assert.match(assessmentCopy("volume", "unassessed"), /not been analyzed/);
});

test("all supported rules and summaries have complete frontend copy", async () => {
  const { findingRules } = await import("@micmane/validation/feedback");
  const { findingCopy, assessmentCopy } =
    await import("../src/lib/coaching.ts");
  const evidence = {
    focusText: "more time",
    pace: -1,
    seconds: 2,
    expected: ["happy"],
    expressiveness: 5,
  };
  for (const rule of findingRules) {
    const copy = findingCopy(rule, evidence);
    for (const value of Object.values(copy)) {
      assert.ok(value.length > 10, rule);
      assert.doesNotMatch(value, /coaching\.|\{\{|undefined|NaN/, rule);
    }
  }
  for (const foundation of [
    "rate",
    "volume",
    "pitch_melody",
    "tonality",
    "pauses",
  ])
    for (const code of ["uncertain", "effective", "mixed", "unassessed"])
      assert.doesNotMatch(assessmentCopy(foundation, code), /coaching\./);
});

test("existing reviews and foundation metadata follow language changes", async () => {
  const { i18n, t } = await import("../src/core/i18n/index.ts");
  const { FOUNDATION_BY_KEY } = await import("../src/lib/foundations.ts");
  const review = normalizeReview(
    {
      mainMessage: "We need more time",
      assessments: [
        {
          foundation: "rate",
          verdict: "mixed",
          summaryCode: "mixed",
          findings: [
            {
              rule_id: "RATE_IMPORTANCE_FAST",
              segment_id: "s1",
              evidence: {},
              start: 0,
              end: 4.8,
            },
          ],
        },
      ],
    },
    segments,
  );
  assert.equal(review.findings[0].observation, "This passage moves quickly.");
  assert.equal(review.overall, "Your main message: We need more time");
  await i18n.changeLanguage("cimode");
  try {
    assert.equal(
      review.findings[0].observation,
      "RATE_IMPORTANCE_FAST_observation",
    );
    assert.equal(review.assessments[0].summary, "summary_rate_mixed");
    assert.equal(FOUNDATION_BY_KEY.rate.label, "foundationsRateOfSpeech");
    assert.equal(
      t("review:tryreviewYourReviewIsReady"),
      "tryreviewYourReviewIsReady",
    );
  } finally {
    await i18n.changeLanguage("en");
  }
  await i18n.changeLanguage("sl-SI");
  try {
    assert.equal(t("common:close"), "Close");
  } finally {
    await i18n.changeLanguage("en");
  }
});

test("toast counts use complete plural messages", async () => {
  const { t } = await import("../src/core/i18n/index.ts");
  assert.equal(t("review:reviewReadyNotes", { count: 1 }), "1 note to work on");
  assert.equal(
    t("review:reviewReadyNotes", { count: 2 }),
    "2 notes to work on",
  );
  assert.equal(t("review:reviewReadyStrengths", { count: 1 }), "1 strength");
  assert.equal(t("review:reviewReadyStrengths", { count: 0 }), "0 strengths");
});

test("recording and service failures use local copy, never server error messages", async () => {
  const { recordingErrorKey, reviewErrorKey } =
    await import("../src/lib/api.ts");
  const { t } = await import("../src/core/i18n/index.ts");
  const { TRPCClientError } = await import("@trpc/client");
  assert.equal(
    reviewErrorKey(new TRPCClientError("validation:recordingRequired")),
    "validation:recordingRequired",
  );
  assert.match(
    t(recordingErrorKey(new Blob(["x"], { type: "text/plain" }))),
    /file type/,
  );
  assert.match(
    t(recordingErrorKey(new Blob([], { type: "audio/mpeg" }))),
    /enough speech/,
  );
  assert.equal(
    recordingErrorKey(new Blob(["x"], { type: "audio/webm;codecs=opus" })),
    undefined,
  );
  for (const [httpStatus, expected] of [
    [429, /busy/],
    [415, /file type/],
    [413, /25 MB/],
    [422, /enough speech/],
    [502, /connection/],
    [504, /connection/],
    [500, /couldn't be completed/],
  ]) {
    const error = new TRPCClientError("private upstream diagnostic", {
      result: {
        error: {
          message: "private upstream diagnostic",
          code: -32603,
          data: { httpStatus },
        },
      },
    });
    assert.match(t(reviewErrorKey(error)), expected);
    assert.doesNotMatch(t(reviewErrorKey(error)), /private upstream/);
  }
  assert.match(
    t(reviewErrorKey(new TRPCClientError("network diagnostic"))),
    /connection/,
  );
});

test("validation schemas return keys from a separate flat namespace", async () => {
  const { resources } = await import("../src/core/i18n/resources.ts");
  const { recordingSchema, reviewUploadSchema } =
    await import("@micmane/validation/review");
  const { validationMessages } = await import("@micmane/validation/messages");
  const { t } = await import("../src/core/i18n/index.ts");
  const v = await import("valibot");
  for (const catalog of Object.values(resources.en)) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value, "string");
      assert.doesNotMatch(key, /[.:]/, "catalog keys must stay flat");
    }
  }
  for (const key of validationMessages) {
    assert.ok(resources.en.validation[key.slice("validation:".length)]);
    assert.notEqual(t(key), key);
  }
  for (const input of [
    null,
    new Blob([], { type: "audio/mpeg" }),
    new Blob(["x"], { type: "text/plain" }),
    new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: "audio/mpeg" }),
  ]) {
    const result = v.safeParse(recordingSchema, input);
    assert.equal(result.success, false);
    for (const issue of result.issues)
      assert.ok(validationMessages.includes(issue.message));
  }
  for (const input of [null, new FormData()]) {
    const result = v.safeParse(reviewUploadSchema, input);
    assert.equal(result.success, false);
    for (const issue of result.issues)
      assert.ok(validationMessages.includes(issue.message));
  }
});
