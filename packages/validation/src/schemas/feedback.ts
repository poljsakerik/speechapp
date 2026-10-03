/** Language-neutral evidence returned by the review service. Transcript excerpts
 * are recording content; observations, summaries and practice copy belong to UI. */
export type Emotion =
  "happy" | "sad" | "angry" | "surprised" | "fearful" | "disgusted" | "neutral";

export type FindingEvidence = {
  focusText?: string;
  pace?: number;
  seconds?: number;
  expected?: Emotion[];
  expressiveness?: number;
};

export const findingRules = [
  "RATE_CONTRAST",
  "RATE_IMPORTANCE_FAST",
  "RATE_IMPORTANCE_SLOW",
  "PAUSE_NECESSARY",
  "PAUSE_TOO_SHORT",
  "PAUSE_UNNECESSARY",
  "PAUSE_TOO_LONG",
  "VOLUME_LOW",
  "VOLUME_FADE",
  "PITCH_VARIETY",
  "PITCH_HIGH",
  "PITCH_LOW",
  "TONE_FLAT",
  "RATE_SLOWS_FOR_POINT",
  "PAUSE_LETS_IT_LAND",
  "PAUSE_BUILDS_ANTICIPATION",
  "TONE_EXPRESSIVE",
  "PITCH_MELODY",
] as const;
export type FindingRule = (typeof findingRules)[number];
