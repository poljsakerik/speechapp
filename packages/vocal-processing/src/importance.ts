/**
 * Importance marking: splits a transcript into phrases and labels each word
 * important, unimportant or filler.
 *
 * The rate-of-speech lesson teaches slowing down on important points and
 * moving faster through less important material. Later stages compare the
 * speaker's pace against these labels.
 */

import { PAUSE_BOUNDARY_SCHEMA, PAUSE_CONTEXT_PROMPT, readPauseBoundaries, type PauseBoundary } from "./pauses.ts"
import { wordGaps } from "./timing.ts"

/** "message" is only produced by message-first marking: the few words that carry the speaker's message. */
export type Importance = "message" | "important" | "unimportant" | "filler"

export type Word = { text: string; start?: number; end?: number }

export type MarkedWord = Word & { index: number; importance: Importance }

export type Phrase = { first: number; last: number; importance: Importance; text: string }

export type ImportanceResult = { words: MarkedWord[]; phrases: Phrase[]; pauseBoundaries?: PauseBoundary[] }

/** Sends a system and user prompt and returns the parsed JSON reply. */
export type JsonCompletion = (request: {
  system: string
  user: string
  schema: Record<string, unknown>
  schemaName: string
}) => Promise<unknown>

export type MarkOptions = {
  complete: JsonCompletion
  /** Words per request. Long transcripts are split at sentence ends. */
  chunkWords?: number
  /** Requests in flight at once. */
  concurrency?: number
  /** Instructions for labeling; SYSTEM_PROMPT unless given. */
  system?: string
  /** Text put before every chunk's words, such as the speaker's message. */
  preface?: string
  /** Labels the model may use; the three of SYSTEM_PROMPT unless given. */
  labels?: Importance[]
  /** Include contextual pause placement in the same labeling requests. */
  analyzePauses?: boolean
}

const LABELS: Importance[] = ["important", "unimportant", "filler"]
const MESSAGE_LABELS: Importance[] = ["message", "important", "unimportant", "filler"]

export const SYSTEM_PROMPT = `You mark which words in a spoken transcript carry its meaning, for a speech coach.
The coach teaches: slow down on important points, move faster through less important material, and drop filler.

Split the passage you are given into consecutive phrases and label every phrase:
- "important": the words the listener must not miss. The main claim or point, the new information, punchlines, contrasts, surprising facts, numbers, names, and emotionally loaded words. A speaker would slow down or stress these.
- "unimportant": words that carry the sentence but not the point. Setup, context the listener already has or can predict, connectives, asides, restatements, and grammatical glue. A speaker can move quickly through these.
- "filler": words that add nothing and could be replaced by a silent pause. Hesitation sounds (um, uh, er), discourse fillers used without meaning ("you know", "like", "I mean", "basically", "so", "right", "kind of"), and the repeated first attempt in a repetition or false start ("It's it's" -> the first "It's" is filler). Keep "like", "so" and similar words when they carry meaning.

Rules:
- Phrases are short, usually 1 to 6 words. Keep an important phrase tight: only the words that carry the point, not the whole sentence.
- Most sentences have one important phrase; some have none, a few have two. Usually a quarter to a third of the words are important.
- Judge importance against the whole passage: a phrase that repeats an earlier point is less important the second time.
- Cover every word index in the "Words" list exactly once, in order, with no gaps or overlaps. "first" and "last" are inclusive word indexes.
- Context text is only there to help you judge; do not label it.`

export const phrasesSchema = (labels: Importance[]) => ({
  type: "object",
  properties: {
    phrases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          first: { type: "integer" },
          last: { type: "integer" },
          importance: { type: "string", enum: labels },
        },
        required: ["first", "last", "importance"],
        additionalProperties: false,
      },
    },
  },
  required: ["phrases"],
  additionalProperties: false,
})

export const PHRASES_SCHEMA = phrasesSchema(LABELS)

export async function markImportance(words: Word[], options: MarkOptions): Promise<ImportanceResult> {
  const { complete, chunkWords = 150, concurrency = 4, system = SYSTEM_PROMPT, preface, labels: allowed = LABELS, analyzePauses = false } = options
  const baseSchema = phrasesSchema(allowed)
  const schema = analyzePauses ? { ...baseSchema,
    properties: { ...baseSchema.properties, pauseBoundaries: PAUSE_BOUNDARY_SCHEMA },
    required: [...baseSchema.required, "pauseBoundaries"],
  } : baseSchema
  const chunks = splitChunks(words, chunkWords)
  const passage = words.map((w) => w.text).join(" ")
  const labels = new Array<Importance | undefined>(words.length)
  const pauseBoundaries: PauseBoundary[] = []
  const observedGaps = analyzePauses ? wordGaps(words).filter((g) => g.seconds >= 0.3) : []

  await mapLimit(chunks, concurrency, async ([from, to]) => {
    const context = buildUserPrompt(words, from, to, chunks.length > 1 ? passage : undefined)
    const nextWord = analyzePauses && to + 1 < words.length ? `\nFollowing word (context only): ${to + 1}: ${words[to + 1].text}` : ""
    const candidates = analyzePauses ? `\nObserved-gap boundaries to assess (left word indexes): ${observedGaps.filter((g) => g.after >= from && g.after <= to).map((g) => g.after).join(", ") || "none"}` : ""
    const user = (preface ? `${preface}\n\n` : "") + context + nextWord + candidates
    const reply = await complete({ system: system + (analyzePauses ? PAUSE_CONTEXT_PROMPT : ""), user, schema, schemaName: analyzePauses ? "phrases_and_pauses" : "phrases" })
    applyPhrases(reply, from, to, labels, allowed)
    if (analyzePauses) pauseBoundaries.push(...readPauseBoundaries(reply, from, to, words.length))
  })

  const marked = words.map((w, index) => ({ ...w, index, importance: labels[index] ?? "unimportant" }))
  return { words: marked, phrases: groupPhrases(marked), ...(analyzePauses ? { pauseBoundaries: pauseBoundaries.sort((a, b) => a.after - b.after) } : {}) }
}

/** What the speaker is trying to say: one sentence, and the few points that build it. */
export type Message = { message: string; points: string[] }

export const MESSAGE_PROMPT = `You read a spoken transcript for a speech coach and say what the speaker is trying to get across.
Give the message in one plain sentence, as the speaker would want a listener to repeat it afterwards.
Then list the few points (usually 2 to 5) the speaker uses to build that message, each in a short sentence.
Judge by what the talk is for, not by what is said most often or most loudly.`

export const MESSAGE_SCHEMA = {
  type: "object",
  properties: { message: { type: "string" }, points: { type: "array", items: { type: "string" } } },
  required: ["message", "points"],
  additionalProperties: false,
}

export const MESSAGE_MARKING_PROMPT = `You mark which words in a spoken transcript deliver the speaker's message, for a speech coach.
You are given the message and its points. The coach flags "message" words the speaker rushes, and "unimportant" words the speaker drags, so both labels should be sure.

Split the passage you are given into consecutive phrases and label every phrase:
- "message": the words a listener must catch to take the message or one of its points home. The claim itself, the turn or contrast that makes the point, the number or name the point rests on. Only the words that carry it, not the sentence around it.
- "important": words a good speaker might well slow down on or stress, though they don't carry the message: punchlines, surprising facts, numbers, names, contrasts and emotionally loaded words in the stories and examples.
- "unimportant": everything else said with meaning: setup, context, asides, restatements, connectives, grammatical glue. A speaker can move quickly through these.
- "filler": words that add nothing and could be replaced by a silent pause. Hesitation sounds (um, uh, er), discourse fillers used without meaning ("you know", "like", "I mean", "basically", "so", "right", "kind of"), and the repeated first attempt in a repetition or false start.

Rules:
- Phrases are short, usually 1 to 6 words.
- Most sentences have no message words. Mark each point where it lands, once; a later restatement is not message. Usually a tenth of the words or fewer are message, and a fifth or fewer important.
- Cover every word index in the "Words" list exactly once, in order, with no gaps or overlaps. "first" and "last" are inclusive word indexes.
- Context text is only there to help you judge; do not label it.`

/** Ask the model what the speaker is trying to say. */
export async function findMessage(words: Word[], complete: JsonCompletion): Promise<Message> {
  const user = words.map((w) => w.text).join(" ")
  const reply = (await complete({ system: MESSAGE_PROMPT, user, schema: MESSAGE_SCHEMA, schemaName: "message" })) as Message
  if (typeof reply?.message !== "string" || !Array.isArray(reply.points)) throw new Error("Model reply has no message")
  return reply
}

/**
 * Message-first marking: find what the speaker is trying to say, then label
 * the few words that deliver it "message", other words worth stressing
 * "important", and the rest "unimportant" or "filler".
 */
export async function markMessage(
  words: Word[],
  options: Omit<MarkOptions, "system" | "preface" | "labels">,
): Promise<ImportanceResult & { message: Message }> {
  const message = await findMessage(words, options.complete)
  const preface = `The speaker's message: ${message.message}\nIts points:\n${message.points.map((p) => `- ${p}`).join("\n")}`
  const result = await markImportance(words, { ...options, system: MESSAGE_MARKING_PROMPT, preface, labels: MESSAGE_LABELS })
  return { ...result, message }
}

export function buildUserPrompt(words: Word[], from: number, to: number, context?: string): string {
  const numbered = words
    .slice(from, to + 1)
    .map((w, i) => `${from + i}: ${w.text}`)
    .join("\n")
  const intro = context ? `Context, the whole passage:\n${context}\n\n` : ""
  return `${intro}Words ${from} to ${to}:\n${numbered}`
}

/**
 * Write the model's phrases into `labels` for words from..to. Out-of-range or
 * overlapping phrases are clipped; words the model left out stay undefined.
 */
export function applyPhrases(
  reply: unknown,
  from: number,
  to: number,
  labels: (Importance | undefined)[],
  allowed: Importance[] = LABELS,
): void {
  const phrases = (reply as { phrases?: unknown })?.phrases
  if (!Array.isArray(phrases)) throw new Error("Model reply has no phrases array")
  for (const p of phrases as Record<string, unknown>[]) {
    if (!allowed.includes(p.importance as Importance)) continue
    if (!Number.isInteger(p.first) || !Number.isInteger(p.last)) continue
    const first = Math.max(from, p.first as number)
    const last = Math.min(to, p.last as number)
    for (let i = first; i <= last; i++) labels[i] ??= p.importance as Importance
  }
}

/** Group consecutive words with the same label. */
function groupPhrases(words: MarkedWord[]): Phrase[] {
  const phrases: Phrase[] = []
  let current: Phrase | undefined
  for (const w of words) {
    if (current?.importance === w.importance) {
      current.last = w.index
      current.text += ` ${w.text}`
    } else {
      current = { first: w.index, last: w.index, importance: w.importance, text: w.text }
      phrases.push(current)
    }
  }
  return phrases
}

/** Split into inclusive [from, to] ranges of about `size` words, ending at a sentence end when possible. */
export function splitChunks(words: Word[], size: number): [number, number][] {
  const chunks: [number, number][] = []
  let from = 0
  while (from < words.length) {
    let to = Math.min(from + size - 1, words.length - 1)
    if (to < words.length - 1) {
      for (let i = to; i > from + size / 2; i--) {
        if (/[.!?]["”’)]*$/.test(words[i].text)) {
          to = i
          break
        }
      }
    }
    chunks.push([from, to])
    from = to + 1
  }
  return chunks
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
