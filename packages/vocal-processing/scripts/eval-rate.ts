/**
 * Evaluate the annotated rate development benchmark. Gold marks cover the
 * obvious sustained-speed mistakes, which are gated. The contrast check is
 * reported, not gated: speech allows several valid paces, so a perfect match
 * with any annotation would suggest overfitting.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  ALIGN_MODEL,
  alignWords,
  loadAligner,
  resample,
  type Aligner,
} from "../src/align.ts";
import {
  loadAnnotation,
  loadCorpus,
  metrics,
  RATE_RULES,
  scoreRate,
  type Counts,
} from "../src/benchmark.ts";
import { wordsFromDeepgram } from "../src/deepgram.ts";
import { wordOffsets } from "../src/golden.ts";
import { predictPacing } from "../src/pacing.ts";
import { decodeWav, findPauses } from "../src/pauses.ts";
import {
  DEFAULT_RATE_CONFIG,
  detectRate,
  RATE_VERSION,
  type SpeedRule,
} from "../src/rate.ts";
import { cachedCompletion } from "./cache.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "recordings-dir": { type: "string" },
    "recognizer-timing": { type: "boolean", default: false },
    report: { type: "string" },
    "require-pass": { type: "boolean", default: false },
    // Skip the text-based pacing prediction (and so the contrast check), e.g. offline.
    "no-pacing": { type: "boolean", default: false },
  },
});
const root = resolve(
  values["recordings-dir"] ??
    join(import.meta.dirname, "../../../recordings-rate-development"),
);
const corpus = loadCorpus(root),
  takes = corpus.takes.filter(
    (t) => !positionals.length || positionals.includes(t.id),
  );
if (positionals.some((id) => !corpus.takes.some((t) => t.id === id)))
  throw new Error("Unknown take ID");
const totals: Counts = { tp: 0, fp: 0, fn: 0 };
const byRule = Object.fromEntries(
  RATE_RULES.map((r) => [r, { tp: 0, fp: 0, fn: 0 }]),
) as Record<SpeedRule, Counts>;
const rows: Record<string, unknown>[] = [];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const add = (a: Counts, b: Counts) => {
  a.tp += b.tp;
  a.fp += b.fp;
  a.fn += b.fn;
};
let aligner: Aligner | undefined;
let selected = 0,
  reviewed = 0,
  failed = 0,
  uncertain = 0,
  cleanTakes = 0,
  cleanTakesWithFalseAlarms = 0;
for (const take of takes) {
  const base = join(root, take.base);
  try {
    const annotation = loadAnnotation(base),
      review = annotation.reviews.rate;
    // An excluded take is deliberately out of scope for rate, e.g. too little speech to judge.
    if (review?.status === "excluded") {
      rows.push({ id: take.id, status: "excluded", notes: review.notes });
      console.log(`${take.id}: excluded`);
      continue;
    }
    selected++;
    if (review?.status !== "reviewed") {
      rows.push({ id: take.id, status: "unreviewed" });
      continue;
    }
    const original = wordsFromDeepgram(
      JSON.parse(readFileSync(`${base}.json`, "utf8")),
    );
    const text = readFileSync(`${base}.txt`, "utf8");
    const bytes = readFileSync(`${base}.${take.audioExtension}`),
      wav = decodeWav(bytes);
    const pauses = findPauses(wav.samples, wav.sampleRate);
    const audioHash = createHash("sha256").update(bytes).digest("hex");
    let words = original;
    if (!values["recognizer-timing"]) {
      const file = join(
        dirname(base),
        ".cache",
        `aligned-${hash({ original, audioHash, model: ALIGN_MODEL.sha256, version: 1 })}.json`,
      );
      if (existsSync(file)) words = JSON.parse(readFileSync(file, "utf8"));
      else {
        aligner ??= await loadAligner();
        words = await alignWords(
          original,
          resample(wav.samples, wav.sampleRate),
          aligner,
          pauses,
        );
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(words) + "\n");
      }
    }
    const pacing = values["no-pacing"]
      ? undefined
      : await predictPacing(
          original,
          cachedCompletion(join(dirname(base), ".cache")),
        );
    const analysis = detectRate(words, {}, pauses, pacing);
    if (!analysis.reliable) uncertain++;
    const offsets = wordOffsets(text, original);
    const predicted = (
      analysis.reliable
        ? analysis.marks.filter((m) => m.rule !== "RATE_CONTRAST")
        : []
    ).map((m) => ({
      startAt: m.start,
      endAt: m.end,
      startIndex: offsets[m.first]![0],
      endIndex: offsets[m.last]![1],
      foundationType: "rate",
      rule: m.rule,
    }));
    const score = scoreRate(text, original, annotation.marks, predicted);
    reviewed++;
    add(totals, score);
    for (const rule of RATE_RULES) add(byRule[rule], score.byRule[rule]);
    const clean = !annotation.marks.some((m) => m.foundationType === "rate");
    if (clean) {
      cleanTakes++;
      if (predicted.length) cleanTakesWithFalseAlarms++;
    }
    const status = analysis.reliable ? "reviewed" : "uncertain";
    writeFileSync(
      `${base}.rate.pred.json`,
      JSON.stringify(
        {
          model: "pacing",
          version: RATE_VERSION,
          config: DEFAULT_RATE_CONFIG,
          ...analysis,
          status,
          pauses,
          contrastMarks: analysis.marks.filter(
            (m) => m.rule === "RATE_CONTRAST",
          ),
          marks: predicted.map((m, i) => ({ ...m, hit: score.hits[i] })),
          score,
          annotationSignature: JSON.stringify(annotation),
          corpus: corpus.id,
        },
        null,
        2,
      ) + "\n",
    );
    const flagged = analysis.passages.filter((p) => p.flagged).length;
    rows.push({
      id: take.id,
      assignment: take.assignment,
      status,
      articulationRate: analysis.articulationRate,
      score,
      clean,
      audioHash,
      passages: analysis.passages.length,
      flagged,
    });
    console.log(
      `${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn}; ${status}, ${analysis.articulationRate?.toFixed(1)} syllables/s; ${flagged}/${analysis.passages.length} passages flagged`,
    );
  } catch (error) {
    failed++;
    rows.push({
      id: take.id,
      status: "error",
      error: (error as Error).message,
    });
    console.error(`${take.id}: ${(error as Error).message}`);
  }
}
const passed =
  reviewed === selected &&
  reviewed > 0 &&
  !failed &&
  !uncertain &&
  !totals.fp &&
  !totals.fn;
const report = {
  corpus: corpus.id,
  version: RATE_VERSION,
  createdAt: new Date().toISOString(),
  timing: values["recognizer-timing"] ? "recognizer" : "forced alignment",
  config: DEFAULT_RATE_CONFIG,
  selected,
  reviewed,
  failed,
  uncertain,
  totals: { ...totals, ...metrics(totals) },
  byRule,
  cleanTakes,
  cleanTakesWithFalseAlarms,
  passed,
  takes: rows,
};
writeFileSync(
  values.report ? resolve(values.report) : join(root, "rate-benchmark.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `\nSustained speed: TP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}; ${cleanTakesWithFalseAlarms}/${cleanTakes} clean takes flagged; ${uncertain} uncertain, ${failed} failed, ${takes.length - selected} excluded. Gate: ${passed ? "PASS" : "FAIL"}.`,
);
const groups = new Map<string, [number, number]>();
for (const r of rows as {
  assignment?: string;
  passages?: number;
  flagged?: number;
}[]) {
  if (r.passages === undefined) continue;
  const g = groups.get(r.assignment!) ?? [0, 0];
  groups.set(r.assignment!, [g[0] + r.flagged!, g[1] + r.passages]);
}
console.log(
  `Contrast (reported, not gated): ${[...groups].map(([g, [f, n]]) => `${g} ${f}/${n} passages flagged`).join("; ")}. Development corpus, not held-out accuracy.`,
);
if (failed || !reviewed || (values["require-pass"] && !passed))
  process.exitCode = 1;
