import * as v from "valibot";

export const demoDirections = [
  "slow_down",
  "speed_up",
  "pause_after",
  "lengthen_pause_after",
  "no_pause_after",
  "shorten_pause_after",
] as const;

/** A voice sample is a short mono WAV cut in the browser, far below this. */
export const maxReferenceBytes = 4 * 1024 * 1024;
/** Longest passage voiced in one demo; speech is billed by length. */
export const maxDemoWords = 160;

const wordIndex = v.pipe(v.number(), v.integer(), v.minValue(0));

/**
 * The passage to say again: its words, and each note on it with the rule it broke, the
 * words it covers and the phrases to change, all by word position.
 */
export const demoPassageSchema = v.object({
  words: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(48))),
    v.minLength(1),
    v.maxLength(maxDemoWords),
  ),
  notes: v.pipe(
    v.array(
      v.object({
        ruleId: v.pipe(v.string(), v.maxLength(64)),
        from: wordIndex,
        to: wordIndex,
        suggestions: v.pipe(
          v.array(
            v.object({
              direction: v.picklist(demoDirections),
              from: wordIndex,
              to: wordIndex,
            }),
          ),
          v.maxLength(32),
        ),
      }),
    ),
    v.maxLength(24),
  ),
});

export type DemoPassage = v.InferOutput<typeof demoPassageSchema>;

/** The `demo.create` form: a sample of the speaker's voice, what it says, and the passage as JSON. */
export const demoUploadSchema = v.pipe(
  v.instance(FormData, "A multipart form is required"),
  v.transform((form) => ({
    reference: form.get("reference"),
    referenceText: form.get("referenceText"),
    passage: form.get("passage"),
  })),
  v.object({
    reference: v.pipe(
      v.instance(File, "A voice sample is required"),
      v.minSize(1, "Empty voice sample"),
      v.maxSize(maxReferenceBytes, "Voice sample exceeds 4 MB"),
    ),
    referenceText: v.pipe(v.string(), v.maxLength(4000)),
    passage: v.pipe(
      v.string(),
      v.maxLength(16000),
      v.parseJson(),
      demoPassageSchema,
    ),
  }),
);
