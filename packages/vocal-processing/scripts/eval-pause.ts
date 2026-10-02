/**
 * Evaluate pause review on the annotated pause development benchmark.
 *
 * A demonstration can rightly get several findings, e.g. two places to pause
 * in one run-on, so a finding is correct when it falls inside an annotated span
 * of the same kind, and a span is found when any such finding falls inside it.
 * Clean takes report findings per minute rather than pass/fail: skilled
 * speakers hesitate too, and the lessons' jump cuts remove real pauses.
 * Model replies are cached per take and run label.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadAnnotation, loadCorpus } from "../src/benchmark.ts";
import { alignMarks, wordOffsets } from "../src/golden.ts";
import { openaiCompletion, rateModelSettings } from "../src/openai.ts";
import { reviewPause } from "../src/pause-review.ts";
import {
  PAUSE_VERSION,
  pauseAfterWords,
  type PauseRule,
} from "../src/pause.ts";
import { cachedCompletion, loadTake } from "./take-audio.ts";

const RULES: PauseRule[] = [
  "PAUSE_NECESSARY",
  "PAUSE_TOO_SHORT",
  "PAUSE_UNNECESSARY",
  "PAUSE_TOO_LONG",
];
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "recordings-dir": { type: "string" },
    "recognizer-timing": { type: "boolean", default: false },
    report: { type: "string" },
    run: { type: "string", default: "default" },
  },
});
const root = resolve(
  values["recordings-dir"] ??
    join(import.meta.dirname, "../../../recordings-pause-development"),
);
const corpus = loadCorpus(root),
  takes = corpus.takes.filter(
    (t) => !positionals.length || positionals.includes(t.id),
  );
if (positionals.some((id) => !corpus.takes.some((t) => t.id === id)))
  throw new Error("Unknown take ID");
const settings = { ...rateModelSettings(), run: values.run };
const rows: Record<string, unknown>[] = [];
let spans = 0,
  found = 0,
  findingsInFlawed = 0,
  correct = 0,
  cleanFindings = 0,
  cleanMinutes = 0,
  failed = 0;
for (const take of takes) {
  try {
    const annotation = loadAnnotation(join(root, take.base));
    if (annotation.reviews.pauses?.status !== "reviewed") {
      rows.push({ id: take.id, status: "unreviewed" });
      continue;
    }
    // Takes are reviewed one at a time: a burst of parallel takes exhausts the API's rate limit.
    const { base, original, words, text, pauses } = await loadTake(
      root,
      take,
      !values["recognizer-timing"],
    );
    const complete = cachedCompletion(
      join(root, take.base, "..", ".cache"),
      openaiCompletion(settings),
      settings,
    );
    const review = await reviewPause(
      words,
      pauses,
      complete,
      values["recognizer-timing"] ? undefined : original,
    );
    if (!review.reliable) throw new Error(`pause review ${review.status}`);
    const gold = annotation.marks.filter((m) => m.foundationType === "pauses");
    if (gold.some((m) => !RULES.includes(m.rule as PauseRule)))
      throw new Error("Unknown pause rule");
    const goldWords = alignMarks(text, original, gold);
    // A finding is about the pauses after its `at` words.
    const hit = review.marks.map((m) =>
      gold.some(
        (g, j) =>
          g.rule === m.rule && m.at.some((i) => goldWords[j].includes(i)),
      ),
    );
    const goldFound = gold.map((g, j) =>
      review.marks.some(
        (m) => g.rule === m.rule && m.at.some((i) => goldWords[j].includes(i)),
      ),
    );
    const minutes = take.duration / 60;
    if (gold.length) {
      spans += gold.length;
      found += goldFound.filter(Boolean).length;
      findingsInFlawed += review.marks.length;
      correct += hit.filter(Boolean).length;
    } else {
      cleanFindings += review.marks.length;
      cleanMinutes += minutes;
    }
    const offsets = wordOffsets(text, original),
      after = pauseAfterWords(words as never, pauses);
    writeFileSync(
      `${base}.pauses.pred.json`,
      JSON.stringify(
        {
          model: `${settings.model}:${settings.effort}`,
          version: PAUSE_VERSION,
          run: values.run,
          pauses,
          marks: review.marks.map((m, i) => ({
            startAt: m.start,
            endAt: m.end,
            startIndex: offsets[m.first]![0],
            endIndex: offsets[m.last]![1],
            foundationType: "pauses",
            rule: m.rule,
            hit: hit[i],
            at: m.at.map((w) => ({
              word: words[w].text,
              pause: +after[w].toFixed(2),
            })),
          })),
          annotationSignature: JSON.stringify(annotation),
          corpus: corpus.id,
        },
        null,
        2,
      ) + "\n",
    );
    rows.push({
      id: take.id,
      status: "reviewed",
      gold: gold.length,
      goldFound: goldFound.filter(Boolean).length,
      findings: review.marks.length,
      correct: hit.filter(Boolean).length,
      minutes,
    });
    const list = review.marks
      .map(
        (m) =>
          `${m.rule.slice(6)} after “${m.at.map((i) => words[i].text).join("”, “")}”${gold.length ? "" : ""}`,
      )
      .join("; ");
    console.log(
      `${take.id}: ${gold.length ? `${goldFound.filter(Boolean).length}/${gold.length} annotated found, ${hit.filter(Boolean).length}/${review.marks.length} findings inside them` : `clean, ${review.marks.length} findings`}${list ? ` | ${list}` : ""}`,
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
const summary = {
  annotatedFound: `${found}/${spans}`,
  findingsInsideAnnotations: `${correct}/${findingsInFlawed}`,
  cleanFindingsPerMinute: +(cleanFindings / cleanMinutes).toFixed(2),
};
writeFileSync(
  values.report ? resolve(values.report) : join(root, "pause-benchmark.json"),
  JSON.stringify(
    {
      corpus: corpus.id,
      version: PAUSE_VERSION,
      createdAt: new Date().toISOString(),
      model: settings,
      timing: values["recognizer-timing"] ? "recognizer" : "forced alignment",
      summary,
      failed,
      takes: rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `\nAnnotated mistakes found ${found}/${spans}; findings in flawed takes inside an annotation ${correct}/${findingsInFlawed}; clean takes ${cleanFindings} findings in ${cleanMinutes.toFixed(1)} min (${summary.cleanFindingsPerMinute}/min); ${failed} failed. Development corpus, not held-out accuracy.`,
);
if (failed) process.exitCode = 1;
