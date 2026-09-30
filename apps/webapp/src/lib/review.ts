import { FOUNDATION_BY_KEY, type FoundationKey } from "./foundations.ts"

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
  relatedRuleIds?: string[]
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
 * Normalize a backend review. Pins and spans must resolve to the real transcript;
 * older segment-only reviews retain their segment-start fallback.
 */
export function normalizeReview(raw: unknown, segments: Segment[]): Review {
  const data = (raw ?? {}) as Record<string, unknown>
  const byId = new Map(segments.map((s) => [s.id, s]))
  const words = segments.flatMap((s) => s.words)
  const byStart = new Map(words.map((w) => [w.start, w]))
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
      const rawSpan = f.span
      const span: [number, number] | undefined = Array.isArray(rawSpan) && rawSpan.length === 2
        && byStart.has(rawSpan[0]) && byStart.has(rawSpan[1]) && rawSpan[0] <= rawSpan[1]
        && rawSpan[0] >= segment.start && rawSpan[0] <= segment.end
        ? [rawSpan[0], rawSpan[1]] : undefined
      const end = span ? byStart.get(span[1])!.end : segment.end
      const at = typeof f.at === "number" && Number.isFinite(f.at)
        && f.at >= (span?.[0] ?? segment.start) && f.at <= end ? f.at : segment.start
      findings.push({
        id: `${foundation}-${index}`,
        foundation,
        segmentId: segment.id,
        ruleId: text(f.rule_id),
        relatedRuleIds: Array.isArray(f.related_rule_ids) ? f.related_rule_ids.filter((r): r is string => typeof r === "string") : undefined,
        kind: f.kind === "strength" ? "strength" : "improvement",
        uncertainty: f.uncertainty === "clear" ? "clear" : "tentative",
        observation,
        why: text(f.why_it_matters),
        practice: text(f.practice),
        at,
        span,
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
