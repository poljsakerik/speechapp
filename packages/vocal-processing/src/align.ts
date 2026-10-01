/**
 * Forced alignment: re-time a recognizer's words against the audio.
 *
 * Recognizer timestamps can stretch over silence and hide pauses. Here an
 * English wav2vec2 CTC model scores every
 * 20 ms frame of audio for every letter, and a Viterbi pass finds the best
 * path that spells the known transcript, so each word gets the frames it was
 * spoken in. CTC models mark letters in a few peaky frames, so the result is
 * then refined with the pauses measured from the audio: a gap that isn't
 * silent is speech and closes, and a gap that is silent snaps to the pause.
 *
 * The search stays within `margin` seconds of the recognizer's own times,
 * which keeps it linear in the length of the recording.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { Word } from "./importance.ts"
import type { Pause } from "./pauses.ts"

export const ALIGN_MODEL = {
  url: "https://huggingface.co/Xenova/wav2vec2-base-960h/resolve/a19f851b3d42865797e410752b4c570c871e4825/onnx/model_quantized.onnx",
  sha256: "cd5040c147381580ed73258143dd8e0c28e800a09e74ee42ee2b3e8cb4d760a3",
  sampleRate: 16000,
  /** Seconds per output frame. */
  frameSeconds: 0.02,
}

/** The model's letters; index 0, padding, is the CTC blank and "|" separates words. */
const VOCAB = ["<pad>", "<s>", "</s>", "<unk>", "|", "E", "T", "A", "O", "N", "I", "H", "S", "R", "D", "L", "U", "M", "W", "C", "F", "G", "Y", "P", "B", "V", "K", "'", "X", "J", "Q", "Z"]
const TOKEN = new Map(VOCAB.map((ch, i) => [ch, i]))
const BLANK = 0
const SPACE = TOKEN.get("|")!

export type Emission = {
  /** Log probabilities, frames × VOCAB.length, row-major. */
  logProbs: Float32Array
  frames: number
}

export type Aligner = { emit(samples: Float32Array): Promise<Emission> }

export type AlignOptions = {
  /** Seconds either side of the recognizer's word times the alignment may move a word. */
  margin?: number
}

/** Model file location; ALIGN_MODEL_PATH overrides the per-user cache. */
export function alignModelPath(): string {
  return process.env.ALIGN_MODEL_PATH ?? join(homedir(), ".cache", "micmane", "wav2vec2-base-960h-quantized.onnx")
}

/** Download the alignment model (about 95 MB) into the cache if it isn't there, checking its hash. */
export async function ensureAlignModel(path = alignModelPath()): Promise<string> {
  if (existsSync(path)) return path
  const response = await fetch(ALIGN_MODEL.url)
  if (!response.ok) throw new Error(`Alignment model download failed: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const digest = createHash("sha256").update(bytes).digest("hex")
  if (digest !== ALIGN_MODEL.sha256) throw new Error("Alignment model download has the wrong hash")
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(`${path}.partial`, bytes)
  renameSync(`${path}.partial`, path)
  return path
}

/**
 * A wav2vec2 aligner on onnxruntime. Audio is scored in chunks of
 * `chunkSeconds` with `contextSeconds` of extra audio either side, so memory
 * stays flat on long recordings.
 */
export async function loadAligner(path?: string, chunkSeconds = 20, contextSeconds = 1): Promise<Aligner> {
  const ort = await import("onnxruntime-node")
  const session = await ort.InferenceSession.create(await ensureAlignModel(path))
  const rate = ALIGN_MODEL.sampleRate
  const frameSamples = rate * ALIGN_MODEL.frameSeconds
  return {
    async emit(samples) {
      const frames = Math.max(1, Math.floor(samples.length / frameSamples))
      // Frames no chunk reaches, at the very end, default to blank.
      const logProbs = new Float32Array(frames * VOCAB.length).fill(-20)
      for (let f = 0; f < frames; f++) logProbs[f * VOCAB.length + BLANK] = 0
      const step = chunkSeconds * rate
      const context = contextSeconds * rate
      for (let from = 0; from < samples.length; from += step) {
        const lo = Math.max(0, from - context)
        const hi = Math.min(samples.length, from + step + context)
        const input = normalize(samples.subarray(lo, hi))
        if (input.length < 400) continue
        const output = await session.run({ input_values: new ort.Tensor("float32", input, [1, input.length]) })
        const logits = output.logits.data as Float32Array
        const count = output.logits.dims[1]
        // Keep the frames of this chunk proper, dropping the context.
        const first = Math.round((from - lo) / frameSamples)
        for (let f = first; f < count; f++) {
          const frame = Math.floor(lo / frameSamples) + f
          if (frame >= frames || frame * frameSamples >= from + step) break
          logSoftmax(logits, f * VOCAB.length, logProbs, frame * VOCAB.length)
        }
      }
      return { logProbs, frames }
    },
  }
}

/** Re-time `words` against the audio: align, then refine with the measured pauses. */
export async function alignWords<W extends Word>(words: W[], samples: Float32Array, aligner: Aligner, pauses: Pause[], options: AlignOptions = {}): Promise<W[]> {
  const emission = await aligner.emit(samples)
  return refineTimings(viterbiAlign(words, emission, options), pauses)
}

/** Letters of a word in the model's alphabet; numbers are spelled out. */
export function spell(text: string): number[] {
  const spelled = text.replace(/\d+(\.\d+)?/g, (n) => ` ${numberWords(n)} `).toUpperCase().replace(/[’‘]/g, "'")
  const parts = spelled.split(/\s+/).map((part) => [...part].filter((ch) => /[A-Z']/.test(ch)).map((ch) => TOKEN.get(ch)!)).filter((part) => part.length)
  return parts.flatMap((part, i) => i ? [SPACE, ...part] : part)
}

/**
 * The best CTC path through the emission that spells the words in order, with
 * each word confined to `margin` seconds around its recognizer times. Words
 * with nothing to spell, and any word the band can't fit, keep their times.
 */
export function viterbiAlign<W extends Word>(words: W[], emission: Emission, options: AlignOptions = {}): W[] {
  const margin = options.margin ?? 1.5
  const { logProbs, frames } = emission
  const V = VOCAB.length
  const toFrame = (s: number) => Math.min(frames - 1, Math.max(0, Math.floor(s / ALIGN_MODEL.frameSeconds)))
  // CTC states: blank, letter, blank, letter, ..., with "|" between words.
  const states: { token: number; word: number; lo: number; hi: number }[] = [{ token: BLANK, word: -1, lo: 0, hi: 0 }]
  let lastLo = 0
  words.forEach((w, i) => {
    const letters = spell(w.text)
    if (!letters.length || w.start === undefined || w.end === undefined) return
    if (states.length > 1) states.push({ token: SPACE, word: -1, lo: 0, hi: 0 }, { token: BLANK, word: -1, lo: 0, hi: 0 })
    const lo = Math.max(lastLo, toFrame(w.start - margin))
    const hi = Math.max(lo, toFrame(w.end + margin))
    lastLo = lo
    for (const token of letters) states.push({ token, word: i, lo, hi }, { token: BLANK, word: -1, lo: 0, hi: 0 })
  })
  if (states.length < 3) return words
  // Separators and blanks may sit anywhere between their neighbouring letters.
  for (let s = 0; s < states.length; s++) {
    if (states[s].word >= 0) continue
    const before = states.slice(0, s).reverse().find((x) => x.word >= 0)
    const after = states.slice(s + 1).find((x) => x.word >= 0)
    states[s].lo = before ? before.lo : 0
    states[s].hi = after ? after.hi : frames - 1
  }
  for (let s = 1; s < states.length; s++) states[s].hi = Math.max(states[s].hi, states[s - 1].hi)
  for (let s = states.length - 2; s >= 0; s--) states[s].lo = Math.min(states[s].lo, states[s + 1].lo)

  const S = states.length
  const NEG = -Infinity
  let score = new Float64Array(S).fill(NEG)
  let next = new Float64Array(S)
  // Back pointers per frame for the states active in it: 0 stay, 1 from s-1, 2 from s-2.
  const active: [number, number][] = []
  const back: Uint8Array[] = []
  let sLo = 0
  let sHi = 0
  for (let t = 0; t < frames; t++) {
    while (sHi + 1 < S && states[sHi + 1].lo <= t) sHi++
    while (sLo < sHi && states[sLo].hi < t) sLo++
    const ptr = new Uint8Array(sHi - sLo + 1)
    next.fill(NEG)
    for (let s = sLo; s <= sHi; s++) {
      const emit = logProbs[t * V + states[s].token]
      if (t === 0) {
        if (s <= 1) next[s] = emit
        continue
      }
      let best = score[s]
      let from = 0
      if (s > 0 && score[s - 1] > best) { best = score[s - 1]; from = 1 }
      if (s > 1 && states[s].token !== BLANK && states[s].token !== states[s - 2].token && score[s - 2] > best) { best = score[s - 2]; from = 2 }
      if (best === NEG) continue
      next[s] = best + emit
      ptr[s - sLo] = from
    }
    active.push([sLo, sHi])
    back.push(ptr)
    ;[score, next] = [next, score]
  }
  let s = score[S - 1] >= score[S - 2] ? S - 1 : S - 2
  if (score[s] === NEG) return words
  const firstFrame = new Map<number, number>()
  const lastFrame = new Map<number, number>()
  for (let t = frames - 1; t >= 0; t--) {
    const w = states[s].word
    if (w >= 0) {
      firstFrame.set(w, t)
      if (!lastFrame.has(w)) lastFrame.set(w, t)
    }
    if (t > 0) s -= back[t][s - active[t][0]]
  }
  return words.map((w, i) => firstFrame.has(i)
    ? { ...w, start: firstFrame.get(i)! * ALIGN_MODEL.frameSeconds, end: (lastFrame.get(i)! + 1) * ALIGN_MODEL.frameSeconds }
    : w)
}

/**
 * Trim a word that runs into a measured pause at either edge, close gaps
 * between words that aren't silent, and move word edges to the measured
 * pauses in the gaps that are.
 */
export function refineTimings<W extends Word>(words: W[], pauses: Pause[]): W[] {
  const out = words.map((w) => ({ ...w }))
  for (const w of out) {
    if (w.start === undefined || w.end === undefined) continue
    const shortest = Math.min(0.05, w.end - w.start)
    for (const p of pauses) {
      if (p.start >= w.end || p.end <= w.start) continue
      if (p.end >= w.end - 0.05) w.end = Math.max(w.start + shortest, p.start)
      else if (p.start <= w.start + 0.05) w.start = Math.min(w.end - shortest, p.end)
    }
  }
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i]
    const b = out[i + 1]
    if (a.start === undefined || a.end === undefined || b.start === undefined || b.end === undefined) continue
    const inGap = pauses.filter((p) => p.end > a.end! - 0.1 && p.start < b.start! + 0.1)
    if (!inGap.length) {
      if (b.start > a.end) a.end = b.start
      continue
    }
    a.end = Math.min(b.start, Math.max(a.end, inGap[0].start))
    b.start = Math.max(a.end, Math.min(b.start, inGap[inGap.length - 1].end))
  }
  return out
}

/** Resample mono audio to `to` Hz, averaging the source over each output sample's span. */
export function resample(samples: Float32Array, from: number, to = ALIGN_MODEL.sampleRate): Float32Array {
  if (from === to) return samples
  const ratio = from / to
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const lo = Math.floor(i * ratio)
    const hi = Math.max(lo + 1, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let k = lo; k < hi && k < samples.length; k++) sum += samples[k]
    out[i] = sum / (hi - lo)
  }
  return out
}

function normalize(x: Float32Array): Float32Array {
  let mean = 0
  for (const v of x) mean += v
  mean /= x.length
  let variance = 0
  for (const v of x) variance += (v - mean) ** 2
  const scale = 1 / Math.sqrt(variance / x.length + 1e-7)
  return Float32Array.from(x, (v) => (v - mean) * scale)
}

function logSoftmax(from: Float32Array, at: number, to: Float32Array, toAt: number) {
  let max = -Infinity
  for (let i = 0; i < VOCAB.length; i++) max = Math.max(max, from[at + i])
  let sum = 0
  for (let i = 0; i < VOCAB.length; i++) sum += Math.exp(from[at + i] - max)
  const log = max + Math.log(sum)
  for (let i = 0; i < VOCAB.length; i++) to[toAt + i] = from[at + i] - log
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

/** English words for a number as written ("1992" is read as a year, "0.03" digit by digit after the point). */
export function numberWords(text: string): string {
  const [whole, fraction] = text.split(".")
  const n = Number(whole)
  const below100 = (x: number) => x < 20 ? ONES[x] : `${TENS[Math.floor(x / 10)]}${x % 10 ? ` ${ONES[x % 10]}` : ""}`
  const below1000 = (x: number): string => x < 100 ? below100(x) : `${ONES[Math.floor(x / 100)]} hundred${x % 100 ? ` ${below100(x % 100)}` : ""}`
  let said: string
  if (whole.length === 4 && n >= 1100 && n < 2000) said = `${below100(Math.floor(n / 100))} ${n % 100 ? (n % 100 < 10 ? `oh ${ONES[n % 100]}` : below100(n % 100)) : "hundred"}`
  else if (n >= 1_000_000) said = [...whole].map((d) => ONES[Number(d)]).join(" ")
  else if (n >= 1000) said = `${below1000(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${below1000(n % 1000)}` : ""}`
  else said = below1000(n)
  return fraction ? `${said} point ${[...fraction].map((d) => ONES[Number(d)]).join(" ")}` : said
}
