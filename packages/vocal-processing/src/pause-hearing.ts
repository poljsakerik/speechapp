/**
 * How a pause, or the lack of one, sounds: an audio model (gemini.ts) hears
 * the moment with its lead-in and what follows.
 *
 * A transcript with pause lengths can't tell a pause held for effect from one
 * spent searching for words, or a sentence that rushes into the next from one
 * the voice clearly finishes. Reading text alone, the pause review called
 * "You're not a [0.2 s] fake [0.3 s] pianist" a broken thought and asked for a
 * pause at nearly every sentence end of a tightly edited talk. So what the
 * text model proposes is kept only where it also sounds that way:
 * - a pause that breaks a thought must sound hesitant: 74% of an untrained
 *   bad take's did, 27% of its good retake's and 14-35% of the coach's;
 * - a missing pause must sound like the words run on: the coach's rushed,
 *   constant-pace and run-on demonstrations all did, and 8 of 20 places in
 *   one of his edited videos;
 * - a pause worth praising must sound deliberate (pause-strength.ts).
 *
 * Findings come in clusters, and each moment's clip is mostly its lead-in, so
 * moments whose clips overlap are heard in one request: one clip, with every
 * moment in it listed by its time and the words before it.
 */
import { wav, type AudioJudgment } from "./gemini.ts";
import type { Timed } from "./pause.ts";

export type Audio = { samples: Float32Array; sampleRate: number };
export type PauseSound = "deliberate" | "hesitant" | "ordinary";
export type RunOnSound = "runs_on" | "clear";
/**
 * A place to hear: the pause of `seconds` after word `at`, or word `at` going
 * on without one. The words quoted to the model start at word `first`.
 */
export type Moment =
  | { kind: "pause"; at: number; seconds: number; first?: number }
  | { kind: "missing"; at: number };
export const HEARING_VERSION = 2;
/** Seconds of context the audio model hears around the moment. */
export const DEFAULT_HEARING_CONFIG = {
  leadInSeconds: 6, // Before the pause, back to the start of its phrase at most.
  afterSeconds: 2.5, // After it, so the model hears how the speaker goes on.
  clipSeconds: 20, // Moments whose clips overlap share one, up to this long; a clip never holds less than one moment.
};
export type HearingConfig = typeof DEFAULT_HEARING_CONFIG;

const SOUNDS = {
  pause: ["deliberate", "hesitant", "ordinary"],
  missing: ["runs_on", "clear"],
} as const;
const ASKED = {
  pause: `For a pause, say how it sounds:
- "deliberate": a controlled, confident stop the speaker chose, so the words before it land or the words after it hit harder.
- "hesitant": the speaker sounds like they are searching for words, unsure, or losing their thread.
- "ordinary": an ordinary break between thoughts, neither.`,
  missing: `For a moment without a pause, say how it sounds:
- "runs_on": the words rush straight on into the next thought, so the listener gets no moment to take in what was just said.
- "clear": the voice clearly finishes the thought (it slows, falls or lands the last word) and the next one starts cleanly; the listener can follow without a longer pause.`,
};

/** What the audio model is asked about the moments in one clip; `at` is seconds into the clip. */
export function hearingPrompt(
  moments: {
    kind: Moment["kind"];
    at: number;
    before: string;
    seconds?: number;
  }[],
) {
  const listed = moments.map(
    (m, i) =>
      `${i + 1}. At ${m.at.toFixed(1)} seconds, right after the words "${m.before}", the speaker ${m.kind === "pause" ? `pauses for ${m.seconds!.toFixed(1)} seconds` : "goes on without a real pause"}.`,
  );
  return `You are a speaking coach. Listen to this clip. Judge each of these moments on its own, only from how the voice sounds before and after it:
${listed.join("\n")}
${(["pause", "missing"] as const)
  .filter((kind) => moments.some((m) => m.kind === kind))
  .map((kind) => ASKED[kind])
  .join("\n")}
Answer every moment by its number. Reply with JSON only.`;
}
export const HEARING_SCHEMA = {
  type: "OBJECT",
  properties: {
    moments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          sound: {
            type: "STRING",
            enum: [...SOUNDS.pause, ...SOUNDS.missing],
          },
        },
        required: ["id", "sound"],
      },
    },
  },
  required: ["moments"],
};

/** The seconds of audio a moment is heard with, and when in the recording it happens. */
function heardSpan(words: Timed[], m: Moment, c: HearingConfig) {
  const at = words[m.at].end;
  return m.kind === "pause"
    ? {
        at,
        from: Math.max(
          0,
          Math.max(
            words[m.first ?? Math.max(0, m.at - 5)].start,
            at - c.leadInSeconds,
          ) - 0.3,
        ),
        to: at + m.seconds + c.afterSeconds,
      }
    : {
        at,
        from: Math.max(0, at - c.leadInSeconds),
        to: at + c.afterSeconds + 0.5,
      };
}

/** The clips to hear `moments` in, each with the indexes of its moments in spoken order. */
export function hearingClips(
  words: Timed[],
  moments: Moment[],
  config: Partial<HearingConfig> = {},
): { from: number; to: number; moments: number[] }[] {
  const c = { ...DEFAULT_HEARING_CONFIG, ...config };
  const clips: { from: number; to: number; moments: number[] }[] = [];
  const windows = moments.map((m) => heardSpan(words, m, c));
  for (const i of moments
    .map((_, i) => i)
    .sort((a, b) => windows[a].at - windows[b].at)) {
    const w = windows[i],
      last = clips.at(-1);
    if (
      last &&
      w.from < last.to &&
      Math.max(last.to, w.to) - Math.min(last.from, w.from) <= c.clipSeconds
    ) {
      last.from = Math.min(last.from, w.from);
      last.to = Math.max(last.to, w.to);
      last.moments.push(i);
    } else clips.push({ from: w.from, to: w.to, moments: [i] });
  }
  return clips;
}

/**
 * How each moment sounds, in the order given: a pause is deliberate, hesitant
 * or ordinary, and a place without one runs on or is clear. A clip whose reply
 * leaves a moment unjudged is asked once more. A clip that fails leaves its own
 * moments undefined and the others heard.
 */
export async function hearMoments(
  words: Timed[],
  moments: Moment[],
  { samples, sampleRate }: Audio,
  judge: AudioJudgment,
  config: Partial<HearingConfig> = {},
): Promise<(PauseSound | RunOnSound | undefined)[]> {
  const sounds = new Array<PauseSound | RunOnSound | undefined>(
    moments.length,
  ).fill(undefined);
  await Promise.allSettled(
    hearingClips(words, moments, config).map(async (clip) => {
      const prompt = hearingPrompt(
        clip.moments.map((i) => {
          const m = moments[i];
          return {
            kind: m.kind,
            at: words[m.at].end - clip.from,
            seconds: m.kind === "pause" ? m.seconds : undefined,
            before: words
              .slice(
                (m.kind === "pause" ? m.first : undefined) ??
                  Math.max(0, m.at - 5),
                m.at + 1,
              )
              .map((w) => w.text)
              .join(" "),
          };
        }),
      );
      const audio = wav(
        samples.subarray(
          Math.round(clip.from * sampleRate),
          Math.round(
            Math.min(samples.length / sampleRate, clip.to) * sampleRate,
          ),
        ),
        sampleRate,
      );
      for (const asked of [prompt, `${prompt}\nAnswer every listed moment.`]) {
        const reply = (await judge({
          prompt: asked,
          schema: HEARING_SCHEMA,
          wav: audio,
        })) as { moments?: { id?: unknown; sound?: unknown }[] };
        const heard = new Map(
          (Array.isArray(reply?.moments) ? reply.moments : []).map((m) => [
            m?.id,
            m?.sound,
          ]),
        );
        if (
          clip.moments.every((i, n) =>
            (SOUNDS[moments[i].kind] as readonly unknown[]).includes(
              heard.get(n + 1),
            ),
          )
        ) {
          clip.moments.forEach((i, n) => {
            sounds[i] = heard.get(n + 1) as PauseSound | RunOnSound;
          });
          return;
        }
      }
      throw new Error("Pause hearing reply leaves a moment unjudged");
    }),
  );
  return sounds;
}
