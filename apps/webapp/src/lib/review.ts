import { FOUNDATION_BY_KEY, type FoundationKey } from "@/lib/foundations"

export type Word = { text: string; start: number; end: number }
export type Segment = { id: string; start: number; end: number; text: string; words: Word[]; wpm?: number }

/** A recording as the editor draws it. Measurement lanes are optional. */
export type Take = {
  duration: number
  peaks: number[]
  volume?: number[]
  pitch?: (number | null)[]
  pauses: { start: number; end: number }[]
  segments: Segment[]
}

export type Verdict = "effective" | "mixed" | "needs_work" | "uncertain"

export type Finding = {
  id: string
  foundation: FoundationKey
  segmentId: string
  ruleId: string
  kind: "strength" | "improvement"
  uncertainty: "clear" | "tentative"
  observation: string
  why: string
  practice: string
  /** Seconds into the take where the note is pinned. */
  at: number
  /** Start times of the first and last words the note is about, when known. */
  span?: [number, number]
}

export type Assessment = { foundation: FoundationKey; verdict: Verdict; summary: string }

export type Review = {
  overall: string
  nextTake?: string
  assessments: Assessment[]
  findings: Finding[]
}

const VERDICTS: Verdict[] = ["effective", "mixed", "needs_work", "uncertain"]

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Normalize the model's JSON review (speechapp/coach.py). The model is not
 * validated, so anything that cannot be tied to a real segment is dropped.
 */
export function normalizeReview(raw: unknown, segments: Segment[]): Review {
  const data = (raw ?? {}) as Record<string, unknown>
  const byId = new Map(segments.map((s) => [s.id, s]))
  const assessments: Assessment[] = []
  const findings: Finding[] = []
  const list = Array.isArray(data.assessments) ? data.assessments : []
  for (const item of list as Record<string, unknown>[]) {
    const foundation = text(item.foundation) as FoundationKey
    if (!(foundation in FOUNDATION_BY_KEY)) continue
    const verdict = VERDICTS.includes(item.verdict as Verdict) ? (item.verdict as Verdict) : "uncertain"
    assessments.push({ foundation, verdict, summary: text(item.summary) })
    const raws = Array.isArray(item.findings) ? (item.findings as Record<string, unknown>[]) : []
    raws.forEach((f, index) => {
      const segment = byId.get(text(f.segment_id))
      const observation = text(f.observation)
      if (!segment || !observation) return
      findings.push({
        id: `${foundation}-${index}`,
        foundation,
        segmentId: segment.id,
        ruleId: text(f.rule_id),
        kind: f.kind === "strength" ? "strength" : "improvement",
        uncertainty: f.uncertainty === "clear" ? "clear" : "tentative",
        observation,
        why: text(f.why_it_matters),
        practice: text(f.practice),
        at: segment.start,
      })
    })
  }
  findings.sort((a, b) => a.at - b.at)
  return { overall: text(data.overall), assessments, findings }
}

export function formatTime(seconds: number, precise = true): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  return precise
    ? `${String(m).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`
    : `${String(m).padStart(2, "0")}:${String(Math.floor(rest)).padStart(2, "0")}`
}
