// The five foundations, in course order. Names and principles follow
// speechapp/rubric.py; the careful wording is part of the product.
export type FoundationKey = "rate" | "volume" | "pitch_melody" | "tonality" | "pauses"

export type Foundation = {
  key: FoundationKey
  label: string
  short: string
  fill: string
  ink: string
  listensFor: string
  measure: string
  wontClaim: string
}

export const FOUNDATIONS: Foundation[] = [
  {
    key: "rate",
    label: "Rate of speech",
    short: "Rate",
    fill: "var(--f-rate)",
    ink: "var(--f-rate-ink)",
    listensFor:
      "Whether important points get enough time, and whether your pace changes when the meaning changes.",
    measure: "Syllables per second, including silence.",
    wontClaim: "Uniform pace is not a fault on its own. There is no correct speed.",
  },
  {
    key: "volume",
    label: "Volume",
    short: "Volume",
    fill: "var(--f-volume)",
    ink: "var(--f-volume-ink)",
    listensFor:
      "Projection and contrast that support the message, and whether meaningful endings stay audible.",
    measure: "Recorded level across the take.",
    wontClaim: "Recorded level is not how loud you were in the room.",
  },
  {
    key: "pitch_melody",
    label: "Pitch & melody",
    short: "Pitch",
    fill: "var(--f-pitch)",
    ink: "var(--f-pitch-ink)",
    listensFor: "Melodic movement that carries meaning: which word lifts, which one falls away.",
    measure: "Pitch contour, relative to your own voice.",
    wontClaim: "A bigger range is not automatically better, and your natural pitch is never compared to anyone else's.",
  },
  {
    key: "tonality",
    label: "Tonality",
    short: "Tonality",
    fill: "var(--f-tonality)",
    ink: "var(--f-tonality-ink)",
    listensFor: "How the expression you can hear fits what the passage seems to mean.",
    measure: "Heard, not measured.",
    wontClaim: "It describes how you sound, never what you feel.",
  },
  {
    key: "pauses",
    label: "Pauses",
    short: "Pauses",
    fill: "var(--f-pauses)",
    ink: "var(--f-pauses-ink)",
    listensFor: "Space that gives the listener time to process, and you time to breathe.",
    measure: "Silences and their length.",
    wontClaim: "A comma does not require a pause.",
  },
]

export const FOUNDATION_BY_KEY = Object.fromEntries(FOUNDATIONS.map((f) => [f.key, f])) as Record<
  FoundationKey,
  Foundation
>

export const VERDICT_LABEL = {
  effective: "Effective",
  mixed: "Mixed",
  needs_work: "Needs work",
  uncertain: "Uncertain",
} as const
