/**
 * Importance marking: splits a transcript into phrases and labels each word
 * important, unimportant or filler.
 *
 * The rate-of-speech lesson teaches slowing down on important points and
 * moving faster through less important material. Later stages compare the
 * speaker's pace against these labels.
 */

export type Importance = "important" | "unimportant" | "filler"

export type Word = { text: string; start?: number; end?: number }

export type MarkedWord = Word & { index: number; importance: Importance }

export type Phrase = { first: number; last: number; importance: Importance; text: string }

export type ImportanceResult = { words: MarkedWord[]; phrases: Phrase[] }

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
}

const LABELS: Importance[] = ["important", "unimportant", "filler"]

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

export const PHRASES_SCHEMA = {
  type: "object",
  properties: {
    phrases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          first: { type: "integer" },
          last: { type: "integer" },
          importance: { type: "string", enum: LABELS },
        },
        required: ["first", "last", "importance"],
        additionalProperties: false,
      },
    },
  },
  required: ["phrases"],
  additionalProperties: false,
}

export async function markImportance(words: Word[], options: MarkOptions): Promise<ImportanceResult> {
  const { complete, chunkWords = 150, concurrency = 4 } = options
  const chunks = splitChunks(words, chunkWords)
  const passage = words.map((w) => w.text).join(" ")
  const labels = new Array<Importance | undefined>(words.length)

  await mapLimit(chunks, concurrency, async ([from, to]) => {
    const user = buildUserPrompt(words, from, to, chunks.length > 1 ? passage : undefined)
    const reply = await complete({ system: SYSTEM_PROMPT, user, schema: PHRASES_SCHEMA, schemaName: "phrases" })
    applyPhrases(reply, from, to, labels)
  })

  const marked = words.map((w, index) => ({ ...w, index, importance: labels[index] ?? "unimportant" }))
  return { words: marked, phrases: groupPhrases(marked) }
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
export function applyPhrases(reply: unknown, from: number, to: number, labels: (Importance | undefined)[]): void {
  const phrases = (reply as { phrases?: unknown })?.phrases
  if (!Array.isArray(phrases)) throw new Error("Model reply has no phrases array")
  for (const p of phrases as Record<string, unknown>[]) {
    if (!LABELS.includes(p.importance as Importance)) continue
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
