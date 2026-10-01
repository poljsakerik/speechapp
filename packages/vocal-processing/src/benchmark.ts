import { readFileSync } from "node:fs"
import { isAbsolute, relative, resolve } from "node:path"
import { alignMarks, type GoldenMark } from "./golden.ts"
import type { Word } from "./importance.ts"
import type { RateRule } from "./rate.ts"

export const RATE_RULES: RateRule[] = ["RATE_IMPORTANCE_FAST", "RATE_IMPORTANCE_SLOW", "RATE_VARIATION", "RATE_REPETITIVE", "RATE_FLOW"]
export type Review = { status: "pending" | "reviewed" | "excluded"; notes: string }
export type Annotation = { schemaVersion: 2; marks: GoldenMark[]; reviews: Record<string, Review> }
export type Take = { id: string; foundation: string; take: number; base: string; audioExtension: string; duration: number; source: string; sourceStart: number; sourceEnd: number; assignment: string; evidence: string }
export type Corpus = { schemaVersion: 1; id: string; takes: Take[]; referenceTakes?: Record<string, string> }
export function loadCorpus(root: string): Corpus {
  const corpus = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as Corpus
  if (corpus.schemaVersion !== 1 || !Array.isArray(corpus.takes) || !corpus.takes.length) throw new Error("Invalid corpus manifest; import the rate corpus with pnpm import:rate --videos-dir <videos>")
  const ids = new Set<string>()
  for (const take of corpus.takes) {
    const path = relative(resolve(root), resolve(root, take.base))
    if (ids.has(take.id) || !/^[a-z_]+-\d+$/.test(take.id) || path.startsWith("..") || isAbsolute(path)) throw new Error("Invalid corpus manifest")
    ids.add(take.id)
  }
  return corpus
}
export function loadAnnotation(base: string): Annotation {
  const data = JSON.parse(readFileSync(`${base}.golden.json`, "utf8")) as Annotation
  if (data.schemaVersion !== 2 || !Array.isArray(data.marks) || !data.reviews) throw new Error(`Invalid annotation: ${base}.golden.json`)
  return data
}
export type Counts = { tp: number; fp: number; fn: number }
export function metrics({ tp, fp, fn }: Counts) {
  return { precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null }
}

/** Maximum one-to-one matching by rule and word IoU. Every prediction is a concrete phrase adjustment. */
export function scoreRate(text: string, words: Word[], golden: GoldenMark[], predicted: GoldenMark[], minIou = 0.3) {
  if ([...golden, ...predicted].some(m => m.foundationType === "rate" && !RATE_RULES.includes(m.rule as RateRule))) throw new Error("Unknown rate rule: use a supported pacing rule")
  const gold = golden.filter(m => m.foundationType === "rate" && RATE_RULES.includes(m.rule as RateRule))
  const pred = predicted.filter(m => m.foundationType === "rate" && RATE_RULES.includes(m.rule as RateRule))
  const gs = alignMarks(text, words, gold), ps = alignMarks(text, words, pred)
  if ([...gs, ...ps].some(s => !s.length)) throw new Error("A rate mark does not align with the transcript; review the annotation before benchmarking")
  const edges = ps.map((p, i) => gs.flatMap((g, j) => {
    const intersection = p.filter(w => g.includes(w)).length
    return pred[i].rule === gold[j].rule && intersection / (p.length + g.length - intersection) >= minIou ? [j] : []
  }))
  const matchedGold = new Map<number, number>()
  function match(p: number, seen: Set<number>): boolean {
    for (const g of edges[p]) {
      if (seen.has(g)) continue
      seen.add(g)
      const previous = matchedGold.get(g)
      if (previous === undefined || match(previous, seen)) { matchedGold.set(g, p); return true }
    }
    return false
  }
  for (let p = 0; p < pred.length; p++) match(p, new Set())
  const matchedPred = new Set(matchedGold.values())
  const byRule = Object.fromEntries(RATE_RULES.map(rule => {
    const tp = [...matchedGold.keys()].filter(g => gold[g].rule === rule).length
    return [rule, { tp, fp: pred.filter(p => p.rule === rule).length - tp, fn: gold.filter(g => g.rule === rule).length - tp }]
  })) as Record<RateRule, Counts>
  const counts = { tp: matchedGold.size, fp: pred.length - matchedGold.size, fn: gold.length - matchedGold.size }
  return { ...counts, ...metrics(counts), byRule, hits: pred.map((_, i) => matchedPred.has(i)) }
}
