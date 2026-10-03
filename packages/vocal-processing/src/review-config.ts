/**
 * Every setting that decides what a review praises, and how pauses are
 * measured and heard, in one place, with environment overrides so they can change
 * without a release.
 *
 * The defaults live with the code that uses them (DEFAULT_RATE_CONFIG and so
 * on) and are measured in the README's Strengths and Pauses sections; change
 * one and the figures there no longer describe the review. An invalid value
 * throws rather than being ignored.
 *
 * | Variable                    | Default | Meaning                                                              |
 * | --------------------------- | ------- | -------------------------------------------------------------------- |
 * | STRENGTHS                   | 1       | 0 reports no strengths at all                                        |
 * | STRENGTH_RATE_PACE_PERCENT  | 62      | A key phrase at this share of the usual pace, or slower              |
 * | STRENGTH_RATE_SCORE         | -1      | ...scored this or lower by the delivery map (-2 or -1)               |
 * | STRENGTH_PAUSE_SECONDS      | 0.6     | Shortest pause that can be a strength                                |
 * | STRENGTH_PAUSES_PER_MINUTE  | 2       | Most pause strengths named per minute                                |
 * | STRENGTH_PAUSES_AT_LEAST    | 2       | ...but a short take may have this many                               |
 * | STRENGTH_TONE_SCORE         | 4       | Expressiveness rating a passage needs (1-5)                          |
 * | STRENGTH_TONE_ABOVE_USUAL   | 1       | 1 marks only passages above the take's median rating; 0 marks all    |
 * | STRENGTH_PITCH_SPREAD       | 4.5     | Pitch standard deviation over 10 s of speaking, in semitones         |
 * | STRENGTH_PITCH_PER_MINUTE   | 1       | Most lively stretches named per minute of speaking                   |
 * | STRENGTH_PITCH_AT_LEAST     | 1       | ...but a short take may have this many                               |
 * | PAUSE_HEAR_BREAKS           | 1       | 1 keeps a "breaks the thought" finding only if it sounds hesitant    |
 * | PAUSE_HEAR_MISSING          | 1       | 1 keeps a "missing pause" finding only if the words sound run on     |
 * | PAUSE_HEAR_LEAD_IN_SECONDS  | 6       | Audio the model hears before a pause                                 |
 * | PAUSE_HEAR_AFTER_SECONDS    | 2.5     | ...and after it                                                      |
 * | PAUSE_HEAR_CLIP_SECONDS     | 20      | Longest clip that moments close together are heard in; 1 hears each alone |
 * TONALITY_FLAT_SCORE (tonality.ts) sets which ratings count as flat.
 */
import { DEFAULT_HEARING_CONFIG, type HearingConfig } from "./pause-hearing.ts";
import {
  DEFAULT_PAUSE_REVIEW_CONFIG,
  type PauseReviewConfig,
} from "./pause-review.ts";
import {
  DEFAULT_PAUSE_STRENGTH_CONFIG,
  type PauseStrengthConfig,
} from "./pause-strength.ts";
import type { PauseRule } from "./pause.ts";
import { DEFAULT_PITCH_CONFIG, type PitchConfig } from "./pitch.ts";
import { DEFAULT_RATE_CONFIG, type RateConfig } from "./rate.ts";
import { tonalityConfig, type TonalityConfig } from "./tonality.ts";

export type ReviewConfig = {
  /** False reports no strengths. */
  strengths: boolean;
  rate: RateConfig;
  pitch: PitchConfig;
  tonality: TonalityConfig;
  pauseStrength: PauseStrengthConfig;
  /** How a take's pauses are measured against its map and checked against the audio. */
  pauseReview: PauseReviewConfig;
  hearing: HearingConfig;
  /**
   * Pause findings that undo a strength when they fall inside its words: a
   * hesitation inside a slowed phrase, or any fault at a praised pause.
   */
  faults: { rate: PauseRule[]; pauses: PauseRule[] };
};

const FAULTS: ReviewConfig["faults"] = {
  rate: ["PAUSE_UNNECESSARY"],
  pauses: ["PAUSE_UNNECESSARY", "PAUSE_TOO_SHORT", "PAUSE_TOO_LONG"],
};

/** The review's settings with any environment overrides applied. */
export function reviewConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReviewConfig {
  /** A number from `name` within [min, max], or `fallback` when it is unset. */
  const number = (
    name: string,
    fallback: number,
    min: number,
    max: number,
    whole = false,
  ) => {
    const value = env[name];
    if (value === undefined || value === "") return fallback;
    const n = Number(value);
    if (
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (whole && !Number.isInteger(n))
    )
      throw new Error(
        `Invalid ${name}: ${value} (use ${whole ? "a whole number" : "a number"} from ${min} to ${max})`,
      );
    return n;
  };
  const flag = (name: string, fallback: boolean) =>
    number(name, fallback ? 1 : 0, 0, 1, true) === 1;
  const pace = env.STRENGTH_RATE_PACE_PERCENT;
  return {
    strengths: flag("STRENGTHS", true),
    rate: {
      ...DEFAULT_RATE_CONFIG,
      // The config holds log2 of the pace over the speaker's usual; people think in percent.
      highlightPace:
        pace === undefined || pace === ""
          ? DEFAULT_RATE_CONFIG.highlightPace
          : Math.log2(number("STRENGTH_RATE_PACE_PERCENT", 62, 10, 100) / 100),
      highlightScore: number(
        "STRENGTH_RATE_SCORE",
        DEFAULT_RATE_CONFIG.highlightScore,
        -2,
        -1,
        true,
      ),
    },
    pitch: {
      ...DEFAULT_PITCH_CONFIG,
      melodySpread: number(
        "STRENGTH_PITCH_SPREAD",
        DEFAULT_PITCH_CONFIG.melodySpread,
        DEFAULT_PITCH_CONFIG.minSpread,
        12,
      ),
      melodyPerMinute: number(
        "STRENGTH_PITCH_PER_MINUTE",
        DEFAULT_PITCH_CONFIG.melodyPerMinute,
        0,
        60,
      ),
      melodyAtLeast: number(
        "STRENGTH_PITCH_AT_LEAST",
        DEFAULT_PITCH_CONFIG.melodyAtLeast,
        0,
        60,
        true,
      ),
    },
    tonality: {
      ...tonalityConfig(env),
      expressiveScore: number(
        "STRENGTH_TONE_SCORE",
        tonalityConfig(env).expressiveScore,
        1,
        5,
        true,
      ),
      aboveUsual: flag(
        "STRENGTH_TONE_ABOVE_USUAL",
        tonalityConfig(env).aboveUsual,
      ),
    },
    pauseStrength: {
      ...DEFAULT_PAUSE_STRENGTH_CONFIG,
      minSeconds: number(
        "STRENGTH_PAUSE_SECONDS",
        DEFAULT_PAUSE_STRENGTH_CONFIG.minSeconds,
        0.2,
        10,
      ),
      perMinute: number(
        "STRENGTH_PAUSES_PER_MINUTE",
        DEFAULT_PAUSE_STRENGTH_CONFIG.perMinute,
        0,
        60,
      ),
      atLeast: number(
        "STRENGTH_PAUSES_AT_LEAST",
        DEFAULT_PAUSE_STRENGTH_CONFIG.atLeast,
        0,
        60,
        true,
      ),
    },
    pauseReview: {
      ...DEFAULT_PAUSE_REVIEW_CONFIG,
      breakSounds: flag("PAUSE_HEAR_BREAKS", true)
        ? DEFAULT_PAUSE_REVIEW_CONFIG.breakSounds
        : [],
      missingMustRunOn: flag(
        "PAUSE_HEAR_MISSING",
        DEFAULT_PAUSE_REVIEW_CONFIG.missingMustRunOn,
      ),
    },
    hearing: {
      leadInSeconds: number(
        "PAUSE_HEAR_LEAD_IN_SECONDS",
        DEFAULT_HEARING_CONFIG.leadInSeconds,
        1,
        30,
      ),
      afterSeconds: number(
        "PAUSE_HEAR_AFTER_SECONDS",
        DEFAULT_HEARING_CONFIG.afterSeconds,
        0.5,
        30,
      ),
      clipSeconds: number(
        "PAUSE_HEAR_CLIP_SECONDS",
        DEFAULT_HEARING_CONFIG.clipSeconds,
        1,
        120,
      ),
    },
    faults: FAULTS,
  };
}
