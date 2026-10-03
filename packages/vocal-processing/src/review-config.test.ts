import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_HEARING_CONFIG } from "./pause-hearing.ts";
import { DEFAULT_PAUSE_REVIEW_CONFIG } from "./pause-review.ts";
import { DEFAULT_PAUSE_STRENGTH_CONFIG } from "./pause-strength.ts";
import { DEFAULT_PITCH_CONFIG } from "./pitch.ts";
import { DEFAULT_RATE_CONFIG } from "./rate.ts";
import { reviewConfig } from "./review-config.ts";
import { DEFAULT_TONALITY_CONFIG } from "./tonality.ts";

test("with nothing set, the review uses each module's defaults", () => {
  const config = reviewConfig({});
  assert.equal(config.strengths, true);
  assert.deepEqual(config.rate, DEFAULT_RATE_CONFIG);
  assert.deepEqual(config.pitch, DEFAULT_PITCH_CONFIG);
  assert.deepEqual(config.tonality, DEFAULT_TONALITY_CONFIG);
  assert.deepEqual(config.pauseStrength, DEFAULT_PAUSE_STRENGTH_CONFIG);
  assert.deepEqual(config.pauseReview, DEFAULT_PAUSE_REVIEW_CONFIG);
  assert.deepEqual(config.hearing, DEFAULT_HEARING_CONFIG);
});

test("every strength setting can be changed from the environment", () => {
  const config = reviewConfig({
    STRENGTHS: "0",
    STRENGTH_RATE_PACE_PERCENT: "50",
    STRENGTH_RATE_SCORE: "-2",
    STRENGTH_PAUSE_SECONDS: "1",
    STRENGTH_PAUSES_PER_MINUTE: "0.5",
    STRENGTH_PAUSES_AT_LEAST: "1",
    STRENGTH_TONE_SCORE: "5",
    STRENGTH_TONE_ABOVE_USUAL: "0",
    STRENGTH_PITCH_SPREAD: "5.5",
    STRENGTH_PITCH_PER_MINUTE: "2",
    STRENGTH_PITCH_AT_LEAST: "0",
    PAUSE_HEAR_BREAKS: "0",
    PAUSE_HEAR_MISSING: "0",
    PAUSE_HEAR_LEAD_IN_SECONDS: "4",
    PAUSE_HEAR_AFTER_SECONDS: "1.5",
    TONALITY_FLAT_SCORE: "1",
  });
  assert.equal(config.strengths, false);
  // Half the usual pace is one octave down in log2.
  assert.deepEqual(
    [config.rate.highlightPace, config.rate.highlightScore],
    [-1, -2],
  );
  assert.deepEqual(
    [
      config.pauseStrength.minSeconds,
      config.pauseStrength.perMinute,
      config.pauseStrength.atLeast,
    ],
    [1, 0.5, 1],
  );
  assert.deepEqual(
    [
      config.tonality.expressiveScore,
      config.tonality.aboveUsual,
      config.tonality.flatScore,
    ],
    [5, false, 1],
  );
  assert.deepEqual(
    [
      config.pitch.melodySpread,
      config.pitch.melodyPerMinute,
      config.pitch.melodyAtLeast,
    ],
    [5.5, 2, 0],
  );
  assert.deepEqual(config.pauseReview, {
    ...DEFAULT_PAUSE_REVIEW_CONFIG,
    breakSounds: [],
    missingMustRunOn: false,
  });
  assert.deepEqual(config.hearing, {
    leadInSeconds: 4,
    afterSeconds: 1.5,
    clipSeconds: 20,
  });
  // What isn't a strength setting keeps its default.
  assert.equal(config.rate.fastRate, DEFAULT_RATE_CONFIG.fastRate);
  assert.equal(config.pitch.minSpread, DEFAULT_PITCH_CONFIG.minSpread);
});

test("an invalid setting is refused, naming the variable", () => {
  for (const [name, value] of [
    ["STRENGTH_TONE_SCORE", "6"],
    ["STRENGTH_TONE_SCORE", "4.5"],
    ["STRENGTH_RATE_PACE_PERCENT", "fast"],
    ["STRENGTH_RATE_SCORE", "0"],
    ["STRENGTH_PITCH_SPREAD", "1"],
    ["STRENGTHS", "yes"],
    ["PAUSE_HEAR_BREAKS", "2"],
  ])
    assert.throws(
      () => reviewConfig({ [name]: value }),
      new RegExp(`Invalid ${name}`),
    );
});
