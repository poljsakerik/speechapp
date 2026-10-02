/**
 * Pitch & melody: whether the voice moves between notes, or gets stuck.
 *
 * The course teaches melody as "the different notes that you can hit": a voice
 * that moves is easier to follow and remember, and anything distracting takes
 * away from the message. Two ways to get stuck, each judged over 10 s of
 * speaking:
 * - Monotone (PITCH_VARIETY): pitch varies by less than 2.6 semitones
 *   (standard deviation). The threshold is not fitted to our recordings. It is
 *   Hincks (2005): over 10 s of speech, listeners rated a pitch standard
 *   deviation below 15% of the mean pitch as monotone, which is 2.6 semitones.
 *   Clips with less speech are judged whole, and a talk that is flat
 *   throughout is flagged throughout.
 * - Stuck high or low (PITCH_HIGH, PITCH_LOW): the stretch sits 7 semitones or
 *   more from the speaker's normal, their median pitch in the same recording.
 *   Everyday speech, the coach's or untrained, drifts at most 5; a falsetto
 *   reading sits 17 above and the coach's quiet and sad demonstrations about
 *   10 below. A squeak needs less: 5 s an octave above normal is high too.
 *   Over 5 s, excited speech reaches 10 semitones up; a falsetto, 19. Without normal speech to compare with, a take that is high or
 *   low throughout can't be told from a high or low natural voice, and isn't
 *   flagged: men's, women's and children's voices overlap.
 * Semitones measure pitch relative to the speaker's own voice, so a voice is
 * never judged against anyone else's.
 *
 * A listening model (pitch-listen.ts) adds what measurement can't hear: a
 * shorter flat stretch, or a voice that sounds pushed high with no normal
 * speech to compare. Its stretches count only when badly distracting
 * (severity 1-2) and when the measured pitch agrees: flat by the monotone bar,
 * at least 7 semitones low, or an octave or more high. A voice heard as too
 * high needs no normal when it sits above 350 Hz, above everyday speaking for
 * men and women alike.
 * Marks carry its description of what the voice does and a fix when it heard
 * the same problem there, even as minor (severity 3): measurement decides,
 * the listener explains.
 *
 * Only frames inside spoken words count, so music and noise between words
 * don't add movement. A word is never credited with more than 1 s per
 * syllable, as in rate.
 */
import { PitchDetector } from "pitchy"
import type { Heard } from "./pitch-listen.ts"
import type { Span } from "./rate.ts"
import { syllables } from "./syllables.ts"
import type { Word } from "./types.ts"

export type PitchRule = "PITCH_VARIETY" | "PITCH_HIGH" | "PITCH_LOW"
/**
 * Measured on the mark's most extreme window: `spread` is its pitch standard
 * deviation and `shift` its median pitch above the speaker's normal (below if
 * negative), both in semitones.
 */
export type PitchMark = Span & { rule: PitchRule; spread: number; shift: number; how?: string; fix?: string }
/** `reliable` is false when there is too little voiced speech to judge; `spread` is the whole take's. */
export type PitchAnalysis = { marks: PitchMark[]; reliable: boolean; spread?: number }
export const PITCH_VERSION = 5
/** Durations are seconds of speaking; spreads and shifts are semitones. */
export const DEFAULT_PITCH_CONFIG = {
  windowSeconds: 10,
  minSpread: 2.6, // Hincks (2005): PVQ 0.15.
  registerShift: 7,
  squeakSeconds: 5, // A shorter stretch counts as high only an octave up: excited speech reaches 10 semitones for a moment.
  squeakShift: 12,
  minSpeechSeconds: 5, // Less speech than this cannot be judged.
  minVoicedSeconds: 2, // A window or heard stretch with less pitch than this is not judged.
  maxSeverity: 2, // Heard stretches count at this severity or worse (1 = badly distracting).
  describeSeverity: 3, // A measured mark takes the description of a problem heard at this severity or worse.
  highPitch: 350, // Hz.
}
export type PitchConfig = typeof DEFAULT_PITCH_CONFIG

const HOP = 0.01
type Timed = Word & { index: number; start: number; end: number }
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const deviation = (xs: number[]) => { const mean = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length) }

/** `pitch` is trackPitch of the samples, when it was already measured. */
export function detectPitch(samples: Float32Array, sampleRate: number, words: Word[], config: Partial<PitchConfig> = {}, heard: Heard[] = [], pitch?: Float64Array): PitchAnalysis {
  const c = { ...DEFAULT_PITCH_CONFIG, ...config }
  const timed = words.map((w, index) => ({ ...w, index })).filter((w): w is Timed =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start! >= 0 && w.end! > w.start!)
  if (timed.length < 2 || timed.length !== words.length) return { marks: [], reliable: false }
  pitch ??= trackPitch(samples, sampleRate)
  // Each word's speaking time and its voiced frames, in semitones.
  const ws = timed.map(w => {
    const end = Math.min(w.end, w.start + syllables(w.text)), notes: number[] = []
    for (let f = Math.ceil(w.start / HOP); f < Math.min(pitch.length, end / HOP); f++) if (pitch[f]) notes.push(12 * Math.log2(pitch[f]))
    return { ...w, seconds: end - w.start, notes }
  })
  const total = ws.reduce((s, w) => s + w.seconds, 0), all = ws.flatMap(w => w.notes)
  if (total < c.minSpeechSeconds || all.length * HOP < c.minVoicedSeconds) return { marks: [], reliable: false }
  const normal = median(all)

  // Windows of speaking time, one starting at each word; a shorter clip is
  // one window and is marked whole. Otherwise a window marks its middle half,
  // so a mark can't reach into a neighbouring window that moves; overlapping
  // marks of one rule form one stretch. Every `windowSeconds` window is judged
  // for all three rules; `squeakSeconds` windows only for a jump an octave up.
  type Stuck = { rule: PitchRule; from: number; to: number; spread: number; shift: number; how?: string; fix?: string }
  const hits: Stuck[] = []
  let judged = false
  const slide = (seconds: number, judge: (spread: number, shift: number) => PitchRule | undefined) => {
    const window = Math.min(seconds, total)
    for (let a = 0, b = 0, have = 0; a < ws.length; have -= ws[a].seconds, a++) {
      while (b < ws.length && have < window - 1e-9) have += ws[b++].seconds
      if (have < window - 1e-9) break
      const notes = ws.slice(a, b).flatMap(w => w.notes)
      if (notes.length * HOP < c.minVoicedSeconds) continue
      judged = true
      const spread = deviation(notes), shift = median(notes) - normal, rule = judge(spread, shift)
      if (!rule) continue
      let from = a, to = b - 1
      if (window < total) {
        for (let s = 0; s < have / 4; ) s += ws[from++].seconds
        for (let s = 0; s < have / 4; ) s += ws[to--].seconds
      }
      if (from <= to) hits.push({ rule, from, to, spread, shift })
    }
  }
  slide(c.windowSeconds, (spread, shift) => shift >= c.registerShift ? "PITCH_HIGH" : shift <= -c.registerShift ? "PITCH_LOW" : spread < c.minSpread ? "PITCH_VARIETY" : undefined)
  slide(c.squeakSeconds, (_, shift) => shift >= c.squeakShift ? "PITCH_HIGH" : undefined)
  // Heard stretches over the words they cover, kept where the measurement agrees.
  const named = { too_high: "PITCH_HIGH", too_low: "PITCH_LOW", monotone: "PITCH_VARIETY", sing_song: undefined } as const
  const cover = (h: Heard) => ws.flatMap((w, i) => (w.start + w.end) / 2 >= h.start && (w.start + w.end) / 2 < h.end ? [i] : [])
  for (const h of heard) {
    if (h.severity > c.maxSeverity) continue
    const inside = cover(h)
    const notes = inside.flatMap(i => ws[i].notes)
    if (notes.length * HOP < c.minVoicedSeconds) continue
    const spread = deviation(notes), level = median(notes), shift = level - normal
    const rule: PitchRule | undefined = h.issue === "too_high" ? (shift >= c.squeakShift || 2 ** (level / 12) >= c.highPitch ? "PITCH_HIGH" : undefined)
      : h.issue === "too_low" && shift <= -c.registerShift ? "PITCH_LOW"
      : (h.issue === "too_low" || h.issue === "monotone") && spread < c.minSpread ? "PITCH_VARIETY" : undefined
    // Its description is used only when it heard the same problem: a "too low" stretch measured flat is monotone.
    const same = rule === named[h.issue]
    if (rule) hits.push({ rule, from: inside[0], to: inside.at(-1)!, spread, shift, ...(same ? { how: h.how, fix: h.fix } : {}) })
  }
  const stuck: Stuck[] = []
  for (const hit of hits.sort((x, y) => x.from - y.from)) {
    const last = stuck.findLast(m => m.rule === hit.rule)
    const extreme = hit.rule === "PITCH_VARIETY" ? hit.spread < (last?.spread ?? Infinity) : Math.abs(hit.shift) > Math.abs(last?.shift ?? 0)
    if (last && hit.from <= last.to + 1) Object.assign(last, { to: Math.max(last.to, hit.to) }, extreme ? { spread: hit.spread, shift: hit.shift } : {}, last.how ? {} : { how: hit.how, fix: hit.fix })
    else stuck.push({ ...hit })
  }
  // A measured mark also takes the description of a minor problem heard as the same one over it.
  for (const m of stuck.filter(m => !m.how)) {
    const h = heard.find(h => h.severity <= c.describeSeverity && named[h.issue] === m.rule && cover(h).some(i => m.from <= i && i <= m.to))
    if (h) Object.assign(m, { how: h.how, fix: h.fix })
  }
  const span = (from: number, to: number): Span => ({ first: ws[from].index, last: ws[to].index, start: ws[from].start, end: ws[to].end, text: ws.slice(from, to + 1).map(w => w.text).join(" ") })
  // A stretch stuck high or low isn't also called monotone: register marks are
  // cut out of monotone marks, leaving the monotone parts on either side.
  const register = stuck.filter(m => m.rule !== "PITCH_VARIETY")
  const marks = stuck.flatMap(m => {
    if (m.rule !== "PITCH_VARIETY") return [m]
    let parts = [{ from: m.from, to: m.to }]
    for (const r of register) parts = parts.flatMap(p => r.to < p.from || p.to < r.from ? [p]
      : [{ from: p.from, to: r.from - 1 }, { from: r.to + 1, to: p.to }].filter(q => q.from <= q.to))
    return parts.map(p => ({ ...m, ...p }))
  })
  return {
    marks: marks.sort((x, y) => x.from - y.from).map(({ rule, from, to, spread, shift, how, fix }) => ({ ...span(from, to), rule, spread, shift, ...(how ? { how, fix } : {}) })),
    reliable: judged,
    spread: deviation(all),
  }
}

/**
 * Pitch (Hz) of 40 ms frames every 10 ms, 0 where unvoiced. McLeod pitch
 * estimates (pitchy) with clarity of at least 0.8, between 60 and 500 Hz. A
 * value that disagrees with its neighbours (by 3 semitones or more, in 3 of
 * the 5 frames around it) is a tracking error such as an octave jump, not
 * intonation, and is dropped.
 */
export function trackPitch(samples: Float32Array, sampleRate: number): Float64Array {
  const steps = tracking(samples, sampleRate, Infinity)
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

/**
 * trackPitch, handing the event loop back every `block` frames (about 60 ms
 * of work), so requests in flight keep moving while it runs. A 5-minute take
 * is about 2 s of work.
 */
export async function trackPitchInSteps(samples: Float32Array, sampleRate: number, block = 1000): Promise<Float64Array> {
  const steps = tracking(samples, sampleRate, block)
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
    await new Promise(resolve => setImmediate(resolve))
  }
}

function* tracking(samples: Float32Array, sampleRate: number, block: number): Generator<void, Float64Array> {
  const n = Math.round(sampleRate * 0.04), hop = Math.round(sampleRate * HOP)
  const count = Math.max(0, Math.floor((samples.length - n) / hop) + 1)
  if (!count) return new Float64Array(0)
  const detector = PitchDetector.forFloat32Array(n), raw = new Float64Array(count)
  for (let k = 0; k < count; k++) {
    if (k && k % block === 0) yield
    const [hz, clarity] = detector.findPitch(samples.subarray(k * hop, k * hop + n), sampleRate)
    raw[k] = clarity >= 0.8 && hz >= 60 && hz <= 500 ? hz : 0
  }
  const pitch = new Float64Array(count)
  for (let k = 0; k < count; k++) {
    if (!raw[k]) continue
    let near = 0
    for (let j = Math.max(0, k - 2); j <= Math.min(count - 1, k + 2); j++) if (raw[j] && Math.abs(12 * Math.log2(raw[j] / raw[k])) < 3) near++
    if (near >= 3) pitch[k] = raw[k]
  }
  return pitch
}
