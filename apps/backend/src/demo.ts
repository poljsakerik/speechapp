import type { DemoPassage } from "@micmane/validation/demo";
import { encode } from "@msgpack/msgpack";

/**
 * How a note's words should sound when its rule is fixed, as a cue Fish's S2 models
 * read in square brackets. Rules fixed phrase by phrase have none.
 */
const LEAD: Record<string, string> = {
  RATE_IMPORTANCE_FAST: "[unhurried, taking time over each phrase]",
  RATE_IMPORTANCE_SLOW: "[brisk, moving along]",
  VOLUME_LOW: "[speaking up, projecting]",
  VOLUME_FADE: "[projecting, firm right to the last word]",
  TONE_FLAT: "[warm, animated, expressive]",
  PITCH_VARIETY: "[lively, with a wide melodic range]",
  PITCH_HIGH: "[relaxed, lower voice]",
  PITCH_LOW: "[brighter, lifted voice]",
};

/** Speed is set for the whole request, so a pace change is also set as a speed only when its note is most of what is said. */
const SPEED: Record<string, number> = {
  RATE_IMPORTANCE_FAST: 0.85,
  RATE_IMPORTANCE_SLOW: 1.15,
};

const BEFORE: Partial<Record<Direction, string>> = {
  // `[emphasis]` is one of Fish's own tags; it lands on the word that follows it.
  slow_down: "[emphasis]",
  speed_up: "[quickly, lightly]",
};
const AFTER: Partial<Record<Direction, string>> = {
  pause_after: "[break]",
  lengthen_pause_after: "[long-break]",
};
/** Fish suggests no more than three cues on one sentence. */
const CUES_AT_ONCE = 3;

type Direction =
  DemoPassage["notes"][number]["suggestions"][number]["direction"];

export type DemoScript = { text: string; speed?: number };

/**
 * The passage as text for the speech model, with cues for the delivery its notes ask for.
 * Words outside every note are context and are said as written.
 */
export function demoScript(passage: DemoPassage): DemoScript {
  // Brackets and angle brackets are the model's control syntax; the transcript must not carry any.
  const words = passage.words.map((word) => word.replace(/[[\]<>|]/g, ""));
  const before = new Map<number, string[]>();
  const after = new Map<number, string>();
  const cue = (at: number, text: string) => {
    const cues = before.get(at) ?? [];
    if (!cues.includes(text) && cues.length < CUES_AT_ONCE)
      before.set(at, [...cues, text]);
  };
  const inside = (from: number, to: number) => from <= to && to < words.length;
  let paced = 0;
  const speeds = new Set<number>();
  for (const note of passage.notes) {
    if (!inside(note.from, note.to)) continue;
    if (LEAD[note.ruleId]) cue(note.from, LEAD[note.ruleId]);
    if (SPEED[note.ruleId]) {
      speeds.add(SPEED[note.ruleId]);
      paced += note.to - note.from + 1;
    }
    for (const { direction, from, to } of note.suggestions) {
      if (!inside(from, to)) continue;
      if (BEFORE[direction]) cue(from, BEFORE[direction]);
      if (AFTER[direction]) after.set(to, AFTER[direction]);
      // A pause that ran long is kept, but brief: the voice takes a short one at any
      // punctuation, so a word without a mark gets a comma and a marked one is left alone.
      if (
        direction === "shorten_pause_after" &&
        /[\p{L}\p{N}]$/u.test(words[to])
      )
        words[to] += ",";
      if (direction !== "no_pause_after") continue;
      // The voice stops at punctuation, and the recognizer writes a full stop where the
      // speaker paused: the mark goes, and a capital it gave the next word with it.
      const ended = /[.!?…]+$/.test(words[to]);
      words[to] = words[to].replace(/[,.;:!?…—–-]+$/, "");
      const next = words[to + 1];
      if (ended && next && !/^I(['’]|$)/.test(next))
        words[to + 1] = next[0].toLowerCase() + next.slice(1);
    }
  }
  const text = words
    .flatMap((word, i) =>
      word ? [...(before.get(i) ?? []), word, after.get(i)] : [],
    )
    .filter(Boolean)
    .join(" ");
  const [speed] = speeds;
  return {
    text,
    ...(speeds.size === 1 && paced * 2 >= words.length ? { speed } : {}),
  };
}

export type DemoRequest = {
  /** A sample of the speaker's voice, as WAV, MP3 or FLAC bytes. */
  reference: Uint8Array;
  /** What the sample says. */
  referenceText: string;
  passage: DemoPassage;
};

export type Demo = (request: DemoRequest) => Promise<Uint8Array>;

/**
 * Say a passage the way its note asks, in the speaker's own voice: Fish Audio
 * clones the voice from the sample sent with the request and keeps nothing.
 * Undefined without `FISH_API_KEY`, so the app can leave the control out.
 */
export function fishDemo(
  env: Record<string, string | undefined> = process.env,
  request: typeof fetch = fetch,
): Demo | undefined {
  const key = env.FISH_API_KEY;
  if (!key) return undefined;
  const model = env.FISH_MODEL ?? "s2-pro";
  return async ({ reference, referenceText, passage }) => {
    const { text, speed } = demoScript(passage);
    const response = await request("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        // Voice samples sent inline must go as MessagePack.
        "content-type": "application/msgpack",
        model,
      },
      body: encode({
        text,
        references: [{ audio: reference, text: referenceText }],
        format: "mp3",
        ...(speed ? { prosody: { speed } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok)
      throw new Error(
        `Fish Audio ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    return new Uint8Array(await response.arrayBuffer());
  };
}
