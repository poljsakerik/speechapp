/**
 * Tonality: does the voice carry the feeling the words call for?
 *
 * The voice and the words are judged apart, each by what it is good at:
 * - Gemini listens to each passage and rates how expressive the voice sounds,
 *   from 1 (flat, blank) to 5 (vivid) (gemini.ts).
 * - A language model reads the whole transcript and lists, for each passage,
 *   every emotion a skilled speaker's voice could carry there. It never hears
 *   the audio. Delivery has many valid readings, so this is a set, and it says
 *   whether a calm, matter-of-fact voice would serve as well.
 *
 * A passage is flagged when the voice is flat (rated at or below `flatScore`)
 * where the words call for feeling: Vinh's "blank face", judged against the
 * text. Which emotion the voice carries is not compared: on natural speech
 * emotion labels are too unreliable (an exact-emotion rule flagged 27-54% of
 * Vinh's teaching). Passages are 10-30 s because one sentence is too little
 * speech to judge a voice by. Adjacent flagged passages form one highlight.
 */
import type { JsonCompletion, Word } from "./types.ts"

/** The feelings the text model may call for; neutral means a calm voice serves as well. */
export const EMOTIONS = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral"] as const
export type Emotion = (typeof EMOTIONS)[number]
/** How expressive a voice sounds, from 1 (flat, blank) to 5 (vivid). */
export type VoiceRating = (samples: Float32Array, sampleRate: number) => Promise<number>

export type ToneRule = "TONE_FLAT"
export type Passage = { id: string; first: number; last: number; start: number; end: number; text: string }
export type PassageTone = Passage & { expressiveness: number; fits: Emotion[]; flat: boolean }
export type ToneMark = { first: number; last: number; start: number; end: number; text: string; rule: ToneRule
  /** The emotions the words call for, most fitting first, and the lowest expressiveness heard. */
  expected: Emotion[]; expressiveness: number }
export type TonalityAnalysis = { passages: PassageTone[]; marks: ToneMark[]; reliable: boolean }
export const TONALITY_VERSION = 3
export const DEFAULT_TONALITY_CONFIG = {
  minPassageSeconds: 10, // Sentences are joined until a passage is this long...
  maxPassageSeconds: 30, // ...and a run-on sentence is cut here.
  flatScore: 2, // The voice is flat when rated this or lower: 1 = flat, blank; 2 = mostly flat; 3 = ordinary.
}
export type TonalityConfig = typeof DEFAULT_TONALITY_CONFIG

/** The configuration with TONALITY_FLAT_SCORE applied, so the sensitivity can change without a release. */
export function tonalityConfig(env: NodeJS.ProcessEnv = process.env): TonalityConfig {
  const value = env.TONALITY_FLAT_SCORE
  if (value === undefined || value === "") return DEFAULT_TONALITY_CONFIG
  const flatScore = Number(value)
  if (![1, 2, 3, 4].includes(flatScore)) throw new Error(`Invalid TONALITY_FLAT_SCORE: ${value} (use 1-4)`)
  return { ...DEFAULT_TONALITY_CONFIG, flatScore }
}

type Timed = Word & { index: number; start: number; end: number }

/** Sentences joined into passages long enough to judge a voice by. A short clip is one passage. */
export function passages(words: Word[], config: Partial<TonalityConfig> = {}): Passage[] {
  const c = { ...DEFAULT_TONALITY_CONFIG, ...config }
  const ws = words.map((w, index) => ({ ...w, index })).filter((w): w is Timed =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.end! > w.start!)
  const out: Passage[] = []
  let current: Timed[] = []
  const flush = () => {
    if (!current.length) return
    out.push({ id: `p${out.length + 1}`, first: current[0].index, last: current.at(-1)!.index, start: current[0].start, end: current.at(-1)!.end, text: current.map(w => w.text).join(" ") })
    current = []
  }
  for (const w of ws) {
    if (current.length && w.end - current[0].start > c.maxPassageSeconds) flush()
    current.push(w)
    if (/[.!?]["”’)]*$/.test(w.text) && w.end - current[0].start >= c.minPassageSeconds) flush()
  }
  // A short tail joins the passage before it rather than being judged alone.
  if (current.length && out.length && current.at(-1)!.end - current[0].start < c.minPassageSeconds) {
    const last = out.pop()!
    current = [...ws.filter(w => w.index >= last.first && w.index <= last.last), ...current]
  }
  flush()
  return out
}

const SYSTEM = `You coach speakers on tonality: the emotion underneath the voice.
You will get the transcript of a talk split into numbered passages. For each passage, list every emotion a skilled, engaging speaker's voice could naturally carry while saying it, given what the whole talk is doing. Several readings are usually valid, so include all that would sound natural, most fitting first.

Emotions:
- happy: warm, enthusiastic, amused, proud
- sad: concerned, grave, sorry, sympathetic
- angry: indignant, forceful, frustrated
- surprised: amazed, curious, intrigued
- fearful: anxious, urgent, worried
- disgusted: repelled, scornful
- neutral: calm and matter-of-fact

A talk usually carries some feeling. Include neutral only where a calm, matter-of-fact voice would serve the passage as well as feeling would, such as logistics, definitions or reading out figures. Judge from the words and their context only; you cannot hear the speaker.`

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["passages"],
  properties: { passages: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "fits"],
    properties: { id: { type: "string" }, fits: { type: "array", minItems: 1, items: { type: "string", enum: [...EMOTIONS] } } } } } },
}

export function tonalityRequest(ps: Passage[]) {
  return { system: SYSTEM, user: JSON.stringify({ passages: ps.map(p => ({ id: p.id, text: p.text })) }), schema: SCHEMA, schemaName: "tonality_fit" }
}

/** The expected emotions per passage id; throws on a reply that doesn't cover every passage. */
export function parseFits(ps: Passage[], reply: unknown): Map<string, Emotion[]> {
  const items = (reply as { passages?: { id?: unknown; fits?: unknown }[] })?.passages
  if (!Array.isArray(items)) throw new Error("Tonality reply has no passages")
  const fits = new Map<string, Emotion[]>()
  for (const item of items) {
    const list = Array.isArray(item.fits) ? item.fits.filter((e): e is Emotion => EMOTIONS.includes(e as Emotion)) : []
    if (typeof item.id === "string" && list.length) fits.set(item.id, [...new Set(list)])
  }
  if (ps.some(p => !fits.has(p.id))) throw new Error("Tonality reply is missing passages")
  return fits
}

/** Flag flat voice where the words call for feeling. */
export function detectTonality(ps: Passage[], ratings: number[], fits: Map<string, Emotion[]>, config: Partial<TonalityConfig> = {}): TonalityAnalysis {
  const c = { ...DEFAULT_TONALITY_CONFIG, ...config }
  const judged: PassageTone[] = ps.map((p, i) => {
    const expected = fits.get(p.id)!
    return { ...p, expressiveness: ratings[i], fits: expected, flat: ratings[i] <= c.flatScore && !expected.includes("neutral") }
  })
  const marks: ToneMark[] = []
  judged.forEach((p, i) => {
    if (!p.flat) return
    const last = marks.at(-1)
    if (last && judged[i - 1]?.flat) {
      Object.assign(last, { last: p.last, end: p.end, text: `${last.text} ${p.text}`, expected: [...new Set([...last.expected, ...p.fits])], expressiveness: Math.min(last.expressiveness, p.expressiveness) })
      return
    }
    marks.push({ first: p.first, last: p.last, start: p.start, end: p.end, text: p.text, rule: "TONE_FLAT", expected: p.fits, expressiveness: p.expressiveness })
  })
  return { passages: judged, marks, reliable: ps.length > 0 }
}

/** The whole tonality review: passages, the voice's expressiveness per passage, and the expected emotions from the words. */
export async function reviewTonality(words: Word[], samples: Float32Array, sampleRate: number,
  rate: VoiceRating, complete: JsonCompletion, config: Partial<TonalityConfig> = {}): Promise<TonalityAnalysis> {
  const ps = passages(words, config)
  if (!ps.length) return { passages: [], marks: [], reliable: false }
  const clips = ps.map(p => samples.subarray(Math.floor(p.start * sampleRate), Math.ceil(p.end * sampleRate)))
  // Each rating is a network call of a few seconds, so a few run at once, alongside the text model.
  const ratings: number[] = new Array(clips.length)
  let next = 0
  const rateAll = Promise.all(Array.from({ length: Math.min(4, clips.length) }, async () => {
    while (next < clips.length) { const i = next++; ratings[i] = await rate(clips[i], sampleRate) }
  }))
  const [fits] = await Promise.all([complete(tonalityRequest(ps)).then(reply => parseFits(ps, reply)), rateAll])
  return detectTonality(ps, ratings, fits, config)
}
