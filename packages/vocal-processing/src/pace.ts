/** Descriptive pace measurements. Silence is an observation, never a pause-coaching verdict. */
import type { Word } from "./importance.ts"
import type { Pause } from "./pauses.ts"

type TimedWord = Word & { start: number; end: number }
export type PacePoint = { time: number; speakingWpm: number; articulationWpm: number | null; paused: boolean }
export type PacePause = Pause & { after: number; boundary: "sentence" | "clause" | "within" }
export type PaceClause = {
  first: number; last: number; start: number; end: number; text: string
  wordsPerMinute: number; articulationWpm: number; pauseSeconds: number
  internalPauses: PacePause[]; boundaryAfter: "sentence" | "clause" | "within"
}
export type PaceProfile = { curve: PacePoint[]; clauses: PaceClause[]; pauses: PacePause[]; baselineWpm: number }

export function boundaryAfter(text: string): PacePause["boundary"] {
  // ASR ellipses often mark an abandoned thought, not a completed sentence.
  if (/(?:\.{2,}|…)['"”’)]*$/.test(text)) return "within"
  if (/[.!?]['"”’)]*$/.test(text)) return "sentence"
  return /[,;:]['"”’)]*$/.test(text) ? "clause" : "within"
}

export function mergePauses(pauses: Pause[]): Pause[] {
  const merged: Pause[] = []
  for (const p of pauses.filter(p => Number.isFinite(p.start) && Number.isFinite(p.end) && p.end > p.start).sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1)
    if (previous && p.start <= previous.end) previous.end = Math.max(previous.end, p.end)
    else merged.push({ ...p })
  }
  return merged
}
export function silenceBetween(start: number, end: number, pauses: Pause[]): number {
  return pauses.reduce((s, p) => s + Math.max(0, Math.min(end, p.end) - Math.max(start, p.start)), 0)
}
const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
}

/** Six-second rolling WPM plus punctuation-based clauses; does not split a clause at a hesitation. */
export function measurePace(words: Word[], measured: Pause[] = []): PaceProfile {
  const empty = { curve: [], clauses: [], pauses: [], baselineWpm: 0 }
  if (!words.length || words.some((w, i) => !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start! < 0 || w.end! <= w.start! || (i && w.start! < words[i - 1].start!))) return empty
  const ws = words as TimedWord[]
  const silence = mergePauses([...measured, ...ws.slice(1).flatMap((w, i) => w.start - ws[i].end >= .3 ? [{ start: ws[i].end, end: w.start }] : [])])
  const pauses: PacePause[] = silence.map(p => {
    // Associate a silence with the preceding word, including ASR intervals smeared over silence.
    const middle = (p.start + p.end) / 2
    let after = -1
    for (let i = 0; i < ws.length && ws[i].start < middle; i++) after = i
    return { ...p, after, boundary: after >= 0 ? boundaryAfter(ws[after].text) : "sentence" }
  })
  const clauses: PaceClause[] = []
  let first = 0
  const add = (last: number) => {
    const selected = ws.slice(first, last + 1), start = selected[0].start, end = selected.at(-1)!.end
    const pauseSeconds = silenceBetween(start, end, silence), active = end - start - pauseSeconds
    clauses.push({ first, last, start, end, text: selected.map(w => w.text).join(" "), pauseSeconds,
      wordsPerMinute: selected.length * 60 / (end - start), articulationWpm: selected.length * 60 / Math.max(.01, active),
      internalPauses: pauses.filter(p => p.after >= first && p.after < last && p.boundary === "within" && p.end - p.start >= .35),
      boundaryAfter: boundaryAfter(ws[last].text) })
    first = last + 1
  }
  ws.forEach((w, i) => {
    const boundary = boundaryAfter(w.text)
    if (i === ws.length - 1 || boundary === "sentence" || (boundary === "clause" && i - first >= 3) || i - first >= 23) add(i)
  })
  const curve: PacePoint[] = []
  const start = ws[0].start, end = ws.at(-1)!.end
  for (let time = start; time <= end + .001; time += .5) {
    const left = Math.max(start, time - 3), right = Math.min(end, time + 3)
    const paused = silence.some(p => p.start <= time && p.end > time)
    let mass = 0
    for (const w of ws) {
      if (w.start >= right) break
      if (w.end <= left) continue
      // Fractional words smooth edges without counting silence stretched into an ASR word.
      const activeWord = w.end - w.start - silenceBetween(w.start, w.end, silence)
      if (activeWord <= .01) continue
      const a = Math.max(w.start, left), b = Math.min(w.end, right)
      mass += Math.max(0, b - a - silenceBetween(a, b, silence)) / activeWord
    }
    const active = right - left - silenceBetween(left, right, silence)
    curve.push({ time, speakingWpm: mass * 60 / (right - left), articulationWpm: paused || active < 1 || mass < 3 ? null : mass * 60 / active, paused })
  }
  return { curve, clauses, pauses, baselineWpm: median(clauses.filter(c => c.last - c.first >= 4 && c.end - c.start >= 1).map(c => c.articulationWpm)) }
}
