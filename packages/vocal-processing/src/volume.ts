/**
 * Volume: whether the voice keeps its projection.
 *
 * A recording's level is set as much by the microphone, its gain and its
 * distance as by the voice, so nothing here judges absolute level. A take
 * that is quiet throughout can't be told from a low microphone and is never
 * flagged. Both checks compare the speaker with their own normal: their
 * typical word in the body of a phrase, in the same recording.
 * - Fade (VOLUME_FADE): phrase endings (the last second) that drop 12 dB or
 *   more, repeatedly. One low ending is ordinary falling intonation; everyday
 *   speech often has one at 10-14 dB, but never two of three in a row at
 *   10 dB. The course coach's trail-off demonstration drops 16-17 dB three
 *   times running. 12 dB leaves room for microphones that cut the bass, which
 *   deepens endings.
 * - Low (VOLUME_LOW): 10 s of phrase bodies that turned softer and duller.
 *   The drop is level plus brightness (energy above 1 kHz relative to below
 *   it), which falls with vocal effort whatever the microphone gain. A single
 *   quieter line can be deliberate; 10 s of it is a habit. Everyday speech,
 *   the coach's or untrained, stays within 5.3 dB. The coach's "3 out of 10"
 *   demonstration drops 8-10 dB, depending on how much normal speech
 *   surrounds it and on word timing.
 * A word's loudness is its loudest part, so word timing that stretches over
 * silence or a decaying ending doesn't lower it.
 */
import type { Span } from "./rate.ts"
import { syllables } from "./syllables.ts"
import type { Word } from "./types.ts"

export type VolumeRule = "VOLUME_LOW" | "VOLUME_FADE"
/** `drop` is decibels below the speaker's normal: level for a fade, level plus brightness for a low stretch. */
export type VolumeMark = Span & { rule: VolumeRule; drop: number }
/** `reliable` is false when there is too little usable speech to judge. */
export type VolumeAnalysis = { marks: VolumeMark[]; reliable: boolean }
export const VOLUME_VERSION = 1
/** Durations are seconds of speaking; drops are dB below the speaker's typical word. */
export const DEFAULT_VOLUME_CONFIG = {
  fadeSeconds: 1, // The end of a phrase that must stay projected; phrases need twice this much speech.
  fadeDrop: 12,
  lowSeconds: 10,
  lowDrop: 8,
  minSpeechSeconds: 5, // Less speech than this cannot be judged.
}
export type VolumeConfig = typeof DEFAULT_VOLUME_CONFIG

const HOP = 0.01, FRAME = 0.03
// Voice is within this many dB of the loud frames, and this many dB above the
// background (the quietest 5% of frames). In a noisy recording a fade into the
// noise can't be heard apart from it, so it isn't judged.
const SPEECH_RANGE = 35, ABOVE_NOISE = 6
// This much silence between words ends a phrase, as does a full stop.
const PHRASE_BREAK = 0.3

type Timed = Word & { index: number; start: number; end: number }
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b), at = (s.length - 1) * q, i = Math.floor(at); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (at - i) }
const median = (xs: number[]) => quantile(xs, 0.5)

export function detectVolume(samples: Float32Array, sampleRate: number, words: Word[], config: Partial<VolumeConfig> = {}): VolumeAnalysis {
  const c = { ...DEFAULT_VOLUME_CONFIG, ...config }
  const timed = words.map((w, index) => ({ ...w, index })).filter((w): w is Timed =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start! >= 0 && w.end! > w.start!)
  if (timed.length < 2 || timed.length !== words.length) return { marks: [], reliable: false }
  const { level, brightness } = measureFrames(samples, sampleRate)
  if (!level.length) return { marks: [], reliable: false }

  // Each word's voice: frames inside its timing that are loud enough to be voice.
  // Pause detection isn't used: a trailing-off voice is exactly what it would
  // call silence. A word is never credited with more than 1 s per syllable, so
  // music absorbed into its timing isn't voice.
  const sorted = [...level].sort((a, b) => a - b)
  const floor = Math.max(sorted[Math.floor(sorted.length * 0.99)] - SPEECH_RANGE, sorted[Math.floor(sorted.length * 0.05)] + ABOVE_NOISE)
  const ws = timed.map(w => {
    const voice: number[] = []
    for (let f = Math.ceil(w.start / HOP), to = Math.min(level.length - 1, Math.floor(Math.min(w.end, w.start + syllables(w.text)) / HOP)); f <= to; f++) if (level[f] > floor) voice.push(f)
    // A word's loudness is its loudest part, whatever the recognizer's timing adds around it.
    return { ...w, voice, loudness: voice.length ? quantile(voice.map(f => level[f]), 0.9) : NaN }
  }).filter(w => w.voice.length)
  const seconds = (from: number, to: number) => ws.slice(from, to + 1).reduce((s, w) => s + w.voice.length * HOP, 0)
  if (!ws.length || seconds(0, ws.length - 1) < c.minSpeechSeconds) return { marks: [], reliable: false }
  const span = (from: number, to: number): Span => ({ first: ws[from].index, last: ws[to].index, start: ws[from].start, end: ws[to].end, text: ws.slice(from, to + 1).map(w => w.text).join(" ") })

  // Phrases end at a full stop or a silence. Each phrase's last second is its
  // ending; the rest is its body. Fades are judged on endings, low stretches on
  // bodies, so a run of fading endings can't add up to a low stretch.
  const phrases: { body: number[]; ending: [number, number] }[] = []
  const ends = (i: number) => i + 1 === ws.length || /[.!?]["')\]]*$/.test(ws[i].text) || (ws[i + 1].voice[0] - ws[i].voice.at(-1)!) * HOP > PHRASE_BREAK
  for (let a = 0; a < ws.length;) {
    let b = a
    while (!ends(b)) b++
    let from = b
    while (from > a && seconds(from, b) < c.fadeSeconds) from--
    phrases.push({ body: Array.from({ length: from - a }, (_, k) => a + k), ending: [from, b] })
    a = b + 1
  }
  const body = phrases.flatMap(p => p.body)
  if (!body.length) return { marks: [], reliable: false }
  // The speaker's normal: their typical word in the body of a phrase.
  const normalLevel = median(body.map(i => ws[i].loudness)), normalBrightness = median(body.flatMap(i => ws[i].voice.map(f => brightness[f])))

  // Low: windows of speaking time. A window is flagged once most of it is
  // quiet, which always includes its middle half, so a flagged window marks
  // its middle half; overlapping marks form one stretch.
  const stretches: { from: number; to: number; drop: number }[] = []
  for (let a = 0, b = 0, have = 0; a < body.length; have -= ws[body[a]].voice.length * HOP, a++) {
    while (b < body.length && have < c.lowSeconds - 1e-9) have += ws[body[b++]].voice.length * HOP
    if (have < c.lowSeconds - 1e-9) break
    const part = body.slice(a, b).map(i => ws[i])
    const drop = normalLevel - median(part.map(w => w.loudness)) + normalBrightness - median(part.flatMap(w => w.voice.map(f => brightness[f])))
    if (drop < c.lowDrop) continue
    let from = a, to = b - 1
    for (let s = 0; s < have / 4; ) s += ws[body[from++]].voice.length * HOP
    for (let s = 0; s < have / 4; ) s += ws[body[to--]].voice.length * HOP
    const last = stretches.at(-1)
    if (last && from <= last.to + 1) Object.assign(last, { to: Math.max(last.to, to), drop: Math.max(last.drop, drop) })
    else if (from <= to) stretches.push({ from, to, drop })
  }
  const marks: VolumeMark[] = stretches.map(({ from, to, drop }) => ({ ...span(body[from], body[to]), rule: "VOLUME_LOW", drop }))

  // Fade: a phrase's ending against the speaker's normal. Only phrases with as
  // much body as ending are judged. One faded ending is ordinary falling
  // intonation; trailing off is a habit, so a faded ending counts when another
  // of the two judged endings on either side fades too. A fade inside a low
  // stretch is part of that stretch.
  const endings = phrases.filter(p => p.body.length && seconds(p.body[0], p.ending[1]) >= 2 * c.fadeSeconds)
    .map(({ ending: [from, to] }) => ({ ...span(from, to), drop: normalLevel - median(ws.slice(from, to + 1).map(w => w.loudness)) }))
  const lows = marks.slice()
  endings.forEach((e, k) => {
    const faded = (j: number) => (endings[j]?.drop ?? -Infinity) >= c.fadeDrop
    if (faded(k) && [k - 2, k - 1, k + 1, k + 2].some(faded) && !lows.some(m => m.first <= e.last && e.first <= m.last)) marks.push({ ...e, rule: "VOLUME_FADE" })
  })
  return { marks: marks.sort((x, y) => x.start - y.start), reliable: true }
}

/**
 * Level (dB) and brightness (dB of energy at 1-5 kHz over 50 Hz-1 kHz) of
 * 30 ms frames every 10 ms. Both are relative measures: a gain change shifts
 * every level equally and leaves brightness untouched.
 */
export function measureFrames(samples: Float32Array, sampleRate: number): { level: Float64Array; brightness: Float64Array } {
  const hop = Math.round(sampleRate * HOP), n = Math.round(sampleRate * FRAME)
  const size = 2 ** Math.ceil(Math.log2(n)), count = Math.max(0, Math.floor((samples.length - n) / hop) + 1)
  const hann = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)))
  const bin = (hz: number) => Math.round(hz * size / sampleRate)
  const [lo0, lo1, hi1] = [bin(50), bin(1000), Math.min(size / 2, bin(5000))]
  const level = new Float64Array(count), brightness = new Float64Array(count)
  const re = new Float64Array(size), im = new Float64Array(size)
  for (let k = 0; k < count; k++) {
    let energy = 0
    re.fill(0); im.fill(0)
    for (let i = 0; i < n; i++) {
      const x = samples[k * hop + i]
      energy += x * x
      re[i] = x * hann[i]
    }
    level[k] = 10 * Math.log10(energy / n + 1e-12)
    fft(re, im)
    let low = 1e-12, high = 1e-12
    for (let j = lo0; j < hi1; j++) {
      if (j < lo1) low += re[j] ** 2 + im[j] ** 2
      else high += re[j] ** 2 + im[j] ** 2
    }
    brightness[k] = 10 * Math.log10(high / low)
  }
  return { level, brightness }
}

/** In-place radix-2 FFT; the length must be a power of two. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len, wr = Math.cos(angle), wi = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      for (let j = 0, cr = 1, ci = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
        const next = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = next
      }
    }
  }
}
