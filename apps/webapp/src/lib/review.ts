import { FOUNDATION_BY_KEY, type FoundationKey } from "./foundations.ts"

export type Word = { text: string; start: number; end: number }
export type Segment = { id: string; start: number; end: number; text: string; words: Word[]; speakingRate?: number }

/** A recording as the editor draws it. Measurement lanes are optional. */
export type Take = {
  duration: number
  peaks: number[]
  volume?: number[]
  pitch?: (number | null)[]
  pauses: { start: number; end: number }[]
  segments: Segment[]
}

/** A phrase to change inside a passage; pause directions point at the word a pause follows. */
export type Suggestion = { direction: "slow_down" | "speed_up" | "pause_after" | "lengthen_pause_after" | "no_pause_after" | "shorten_pause_after"; span: [number, number]; text: string }
const DIRECTIONS: Suggestion["direction"][] = ["slow_down", "speed_up", "pause_after", "lengthen_pause_after", "no_pause_after", "shorten_pause_after"]

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
  /** Seconds the passage the note is about starts and ends at, when known. */
  span?: [number, number]
  /** Phrases inside the passage to change, e.g. where to slow down in an even stretch. */
  suggestions?: Suggestion[]
}

export type Assessment = { foundation: FoundationKey; verdict: Verdict; summary: string }

export type Review = {
  overall: string
  nextTake?: string
  assessments: Assessment[]
  findings: Finding[]
}

const ISSUE_NAMES: Record<FoundationKey, string> = { rate: "rate-of-speech", volume: "volume", pitch_melody: "pitch", tonality: "tonality", pauses: "pause" }
const COUNTS = ["", "one", "two", "three", "four"]

/** An empty findings list is not evidence that every foundation was assessed. */
export function emptyReviewMessage(assessments: Assessment[]): string {
  const assessed = assessments.filter(a => a.verdict !== "uncertain").map(a => ISSUE_NAMES[a.foundation])
  if (!assessed.length) return "There wasn’t enough reliable evidence to assess this take."
  const others = COUNTS[5 - assessed.length]
  const rest = others === "one" ? " The other fundamental hasn’t been assessed." : others ? ` The other ${others} fundamentals haven’t been assessed.` : ""
  return `No ${assessed.join(" or ")} issues were flagged.${rest}`
}

const VERDICTS: Verdict[] = ["effective", "mixed", "needs_work", "uncertain"]

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function timeSpan(start: unknown, end: unknown): [number, number] | undefined {
  return typeof start === "number" && typeof end === "number" && Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : undefined
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
      const range = timeSpan(f.start, f.end)
      const covered = range && range[0] >= segment.start && range[1] <= segment.end
        ? segment.words.filter(w => w.start >= range[0] && w.end <= range[1]) : []
      const span: [number, number] | undefined = covered.length
        ? [covered[0].start, covered[covered.length - 1].end] : undefined
      const suggestions = (Array.isArray(f.suggestions) ? (f.suggestions as Record<string, unknown>[]) : []).flatMap(
        (s): Suggestion[] => {
          const at = timeSpan(s.start, s.end)
          const direction = DIRECTIONS.find(d => d === s.direction)
          return at && direction ? [{ direction, span: at, text: text(s.text) }] : []
        },
      )
      findings.push({
        id: text(f.group_id) ? `${foundation}-group-${text(f.group_id)}` : `${foundation}-${index}`,
        foundation,
        segmentId: segment.id,
        ruleId: text(f.rule_id),
        kind: f.kind === "strength" ? "strength" : "improvement",
        uncertainty: f.uncertainty === "clear" ? "clear" : "tentative",
        observation,
        why: text(f.why_it_matters),
        practice: text(f.practice),
        at: span?.[0] ?? segment.start,
        ...(span ? { span } : {}),
        ...(suggestions.length ? { suggestions } : {}),
      })
    })
  }
  findings.sort((a, b) => a.at - b.at)
  // One measured passage can cross several ASR segments. Rejoin only adjacent
  // validated highlights, so one interrupted thought gets one note and replay.
  const joined: Finding[] = []
  const words = segments.flatMap(s => s.words)
  for (const finding of findings) {
    const previous = joined.find(f => f.id === finding.id && f.ruleId === finding.ruleId)
    if (previous?.span && finding.span && previous.span[1] <= finding.span[0] &&
      !words.some(w => w.start >= previous.span![1] && w.end <= finding.span![0])) {
      previous.span[1] = finding.span[1]
    } else joined.push(previous ? { ...finding, id: `${finding.id}-part-${joined.length}` } : finding)
  }
  return { overall: text(data.overall), assessments, findings: joined }
}

export function formatTime(seconds: number, precise = true): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  return precise
    ? `${String(m).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`
    : `${String(m).padStart(2, "0")}:${String(Math.floor(rest)).padStart(2, "0")}`
}
