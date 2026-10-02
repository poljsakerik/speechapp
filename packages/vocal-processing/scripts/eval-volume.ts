/**
 * Evaluate the annotated volume development benchmark: the course coach's
 * deliberate volume mistakes inside his normal speech, and clips of his normal
 * teaching. These takes chose the thresholds, so a pass here is a sanity
 * check, not held-out accuracy.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  loadAnnotation,
  loadCorpus,
  metrics,
  scoreMarks,
  VOLUME_RULES,
  type Counts,
} from "../src/benchmark.ts";
import { transcribe, wordsFromDeepgram } from "../src/deepgram.ts";
import { wordOffsets } from "../src/golden.ts";
import { decodeWav } from "../src/pauses.ts";
import {
  DEFAULT_VOLUME_CONFIG,
  detectVolume,
  VOLUME_VERSION,
} from "../src/volume.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "recordings-dir": { type: "string" },
    report: { type: "string" },
    "require-pass": { type: "boolean", default: false },
  },
});
const root = resolve(
  values["recordings-dir"] ??
    join(import.meta.dirname, "../../../recordings-volume-development"),
);
const corpus = loadCorpus(root),
  takes = corpus.takes.filter(
    (t) => !positionals.length || positionals.includes(t.id),
  );
if (positionals.some((id) => !corpus.takes.some((t) => t.id === id)))
  throw new Error("Unknown take ID");
const totals: Counts = { tp: 0, fp: 0, fn: 0 };
const rows: Record<string, unknown>[] = [];
let selected = 0,
  reviewed = 0,
  failed = 0,
  uncertain = 0;
for (const take of takes) {
  const base = join(root, take.base);
  try {
    const annotation = loadAnnotation(base),
      review = annotation.reviews.volume;
    if (review?.status === "excluded") {
      rows.push({ id: take.id, status: "excluded", notes: review.notes });
      continue;
    }
    selected++;
    if (review?.status !== "reviewed") {
      rows.push({ id: take.id, status: "unreviewed" });
      continue;
    }
    // The production path: the take transcribed on its own, as an upload is, with
    // recognizer timing (forced alignment trims a fading voice as silence). The
    // source transcript's word boundaries and sentence ends differ, which moves
    // the measurements by up to 2 dB. Replies are cached by audio.
    const bytes = readFileSync(`${base}.${take.audioExtension}`),
      wav = decodeWav(bytes);
    const cached = join(
      dirname(base),
      ".cache",
      `deepgram-${createHash("sha256").update(bytes).digest("hex")}.json`,
    );
    if (!existsSync(cached)) {
      mkdirSync(dirname(cached), { recursive: true });
      writeFileSync(
        cached,
        JSON.stringify(await transcribe(new Uint8Array(bytes))) + "\n",
      );
    }
    const analysis = detectVolume(
      wav.samples,
      wav.sampleRate,
      wordsFromDeepgram(JSON.parse(readFileSync(cached, "utf8"))),
    );
    if (!analysis.reliable) uncertain++;
    // Gold marks index the imported transcript; each prediction covers the imported words it overlaps in time.
    const words = wordsFromDeepgram(
      JSON.parse(readFileSync(`${base}.json`, "utf8")),
    );
    const text = readFileSync(`${base}.txt`, "utf8"),
      offsets = wordOffsets(text, words);
    const predicted = analysis.marks.map((m) => {
      const covered = words.flatMap((w, i) =>
        w.end! > m.start && w.start! < m.end ? [i] : [],
      );
      if (!covered.length)
        throw new Error(
          `A predicted mark at ${m.start}s covers no imported words`,
        );
      return {
        startAt: m.start,
        endAt: m.end,
        startIndex: offsets[covered[0]]![0],
        endIndex: offsets[covered.at(-1)!]![1],
        foundationType: "volume",
        rule: m.rule,
      };
    });
    const score = scoreMarks(
      "volume",
      VOLUME_RULES,
      text,
      words,
      annotation.marks,
      predicted,
    );
    reviewed++;
    totals.tp += score.tp;
    totals.fp += score.fp;
    totals.fn += score.fn;
    const status = analysis.reliable ? "reviewed" : "uncertain";
    rows.push({
      id: take.id,
      assignment: take.assignment,
      status,
      score,
      marks: analysis.marks.map((m, i) => ({ ...m, hit: score.hits[i] })),
    });
    console.log(
      `${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn}; ${status}${analysis.marks.map((m) => `; ${m.rule} ${m.start.toFixed(1)}–${m.end.toFixed(1)}s, ${m.drop.toFixed(1)} dB`).join("")}`,
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
writeFileSync(
  values.report ? resolve(values.report) : join(root, "volume-benchmark.json"),
  JSON.stringify(
    {
      corpus: corpus.id,
      version: VOLUME_VERSION,
      createdAt: new Date().toISOString(),
      config: DEFAULT_VOLUME_CONFIG,
      selected,
      reviewed,
      failed,
      uncertain,
      totals: { ...totals, ...metrics(totals) },
      passed,
      takes: rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `\nVolume: TP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}; ${uncertain} uncertain, ${failed} failed, ${takes.length - selected} excluded. Gate: ${passed ? "PASS" : "FAIL"}. Development corpus, not held-out accuracy.`,
);
if (failed || !reviewed || (values["require-pass"] && !passed))
  process.exitCode = 1;
