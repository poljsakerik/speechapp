/**
 * Evaluate strengths on whole recordings: how often each one is found in the
 * course coach's teaching, untrained talks and other groups, whether the
 * moments the coach performs and names himself are found, whether his
 * deliberate mistakes are left unpraised, and whether coached readings get
 * more than the same student's first try.
 *
 *   node scripts/eval-strengths.ts recordings.json [--recipe <benchmarks/strength-development.json>] [--report out.json] [--run label]
 *
 * recordings.json lists { name, group, audio, transcript, source? }: a PCM WAV,
 * its Deepgram JSON response, and for a lesson the video file it was decoded
 * from (from its start, so source times hold), which links it to the recipe.
 * Paths are relative to the list file. Model replies are cached next to it,
 * per run label.
 *
 * Strengths are tentative by nature: great delivery has many valid forms, and
 * the coach's lessons are edited (jump cuts remove pauses). The comparison
 * between groups is the evidence; no single moment should decide anything.
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
import { wordsFromDeepgram } from "../src/deepgram.ts";
import {
  geminiSettings,
  geminiVoice,
  VOICE_PROMPT,
  wav as wavFile,
} from "../src/gemini.ts";
import {
  openaiCompletion,
  rateModelSettings,
  tonalitySettings,
} from "../src/openai.ts";
import { predictPacing } from "../src/pacing.ts";
import { reviewPause } from "../src/pause-review.ts";
import { faulted, PAUSE_STRENGTH_VERSION } from "../src/pause-strength.ts";
import { decodeWav, findPauses } from "../src/pauses.ts";
import { listenForPitch } from "../src/pitch-listen.ts";
import { detectPitch, PITCH_VERSION } from "../src/pitch.ts";
import { detectRate, RATE_VERSION } from "../src/rate.ts";
import { reviewConfig } from "../src/review-config.ts";
import { reviewTonality, TONALITY_VERSION } from "../src/tonality.ts";
import type { Word } from "../src/types.ts";
import { cachedJudgment, cachedCompletion as cachedPacing } from "./cache.ts";
import { cachedCompletion } from "./take-audio.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    recipe: { type: "string" },
    report: { type: "string" },
    run: { type: "string", default: "default" },
  },
});
if (!positionals[0])
  throw new Error(
    "Usage: node scripts/eval-strengths.ts recordings.json [--recipe <recipe>] [--report out.json] [--run label]",
  );
const list = resolve(positionals[0]),
  root = dirname(list),
  cache = join(root, ".cache"),
  run = values.run!;
const recordings = JSON.parse(readFileSync(list, "utf8")) as {
  name: string;
  group: string;
  audio: string;
  transcript: string;
  source?: string;
}[];
type Span = { start: number; end: number };
type Source = {
  file: string;
  notTeaching: (Span & { reason: string })[];
  praise: (Span & { foundation: Foundation; note: string })[];
  noPraise: (Span & { foundation: Foundation; note: string })[];
  pairs: {
    foundation: Foundation;
    before: Span;
    after: Span;
    note: string;
  }[];
};
const recipe = JSON.parse(
  readFileSync(
    resolve(
      values.recipe ??
        join(
          import.meta.dirname,
          "../../../benchmarks/strength-development.json",
        ),
    ),
    "utf8",
  ),
) as { id: string; sources: Source[] };

const FOUNDATIONS = ["rate", "pauses", "tonality", "pitch_melody"] as const;
type Foundation = (typeof FOUNDATIONS)[number];
/** A strength where it was found; `point` is the pause itself, the slowest phrase or the whole stretch. */
type Found = Span & {
  foundation: Foundation;
  rule: string;
  text: string;
  point: Span;
};
// Points are counted per minute; stretches as a share of speaking time.
const STRETCHES: Foundation[] = ["tonality", "pitch_melody"];

const hash = (value: unknown) =>
  createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest("hex");
async function cached<T>(file: string, make: () => Promise<T>): Promise<T> {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  const value = await make();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value) + "\n");
  return value;
}
const overlap = (a: Span, b: Span) =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

const rateSettings = rateModelSettings(),
  toneSettings = tonalitySettings(),
  gemini = geminiSettings(),
  voice = geminiVoice();
const complete = cachedCompletion(
  join(cache, run),
  openaiCompletion(rateSettings),
  // The request is part of the key; this number only marks the reply format.
  { ...rateSettings, strength: 1 },
);
const judge = cachedJudgment(cache, run);
// The live review's settings, environment overrides included, so a changed setting can be measured here first.
const config = reviewConfig();
let aligner: Aligner | undefined;

async function strengthsOf(r: (typeof recordings)[number]) {
  const bytes = readFileSync(resolve(root, r.audio)),
    { samples, sampleRate } = decodeWav(bytes);
  const recognized = wordsFromDeepgram(
    JSON.parse(readFileSync(resolve(root, r.transcript), "utf8")),
  );
  const pauses = findPauses(samples, sampleRate);
  // Same cache key as eval-pacing, so the evaluations share alignments.
  const words = await cached(
    join(
      cache,
      `aligned-${hash({ original: recognized, audio: hash(bytes.toString("base64")), model: ALIGN_MODEL.sha256, version: 1 })}.json`,
    ),
    async () => {
      aligner ??= await loadAligner();
      return alignWords(
        recognized,
        resample(samples, sampleRate),
        aligner,
        pauses,
      );
    },
  );
  const audio = { samples, sampleRate };
  const [pacing, pauseReview, tone, heard] = await Promise.all([
    predictPacing(recognized, cachedPacing(cache, run)).catch(() => undefined),
    reviewPause(
      words,
      pauses,
      complete,
      recognized,
      { audio, judge, config: config.pauseHeard, hearing: config.hearing },
      config.strengths && config.pauseStrength,
    ),
    reviewTonality(
      recognized,
      samples,
      sampleRate,
      (clip, rate) =>
        cached(
          join(
            cache,
            run,
            `voice-${hash({ audio: hash(wavFile(clip, rate)), prompt: VOICE_PROMPT, ...gemini })}.json`,
          ),
          () => voice(clip, rate),
        ),
      cachedCompletion(join(cache, run), openaiCompletion(toneSettings), {
        ...toneSettings,
        version: TONALITY_VERSION,
      }),
      config.tonality,
    ).catch(() => undefined),
    listenForPitch(samples, sampleRate, recognized, judge).catch(() => []),
  ]);
  const marks = pauseReview.reliable ? pauseReview.marks : undefined,
    pauseStrengths = pauseReview.strengths;
  const rate = detectRate(words, config.rate, pauses, pacing);
  const melody = detectPitch(samples, sampleRate, words, config.pitch, heard);
  const found: Found[] = [
    ...(rate.reliable ? rate.strengths : [])
      .filter((s) => !faulted(s, marks, config.faults.rate))
      .map((s) => ({
        ...s,
        foundation: "rate" as const,
        point: { start: s.focus.start, end: s.focus.end },
      })),
    ...(marks ? (pauseStrengths ?? []) : [])
      .filter((s) => !faulted(s, marks, config.faults.pauses))
      .map((s) => ({
        ...s,
        foundation: "pauses" as const,
        point: {
          start: words[s.at].end!,
          end: words[s.at].end! + s.seconds,
        },
      })),
    ...(tone?.reliable ? tone.strengths : []).map((s) => ({
      ...s,
      foundation: "tonality" as const,
      point: { start: s.start, end: s.end },
    })),
    ...(melody.reliable ? melody.strengths : []).map((s) => ({
      ...s,
      foundation: "pitch_melody" as const,
      point: { start: s.start, end: s.end },
    })),
  ].map(({ foundation, rule, start, end, text, point }) => ({
    foundation,
    rule,
    start,
    end,
    text,
    point,
  }));
  const assessed: Record<Foundation, boolean> = {
    rate: rate.reliable && !!pacing,
    pauses: !!marks && !!pauseStrengths,
    tonality: !!tone?.reliable,
    pitch_melody: melody.reliable,
  };
  // Everything the review would highlight, strengths and issues alike.
  const issues: (Span & { foundation: Foundation })[] = [
    ...(rate.reliable ? rate.marks : []).map((m) => ({
      ...m,
      foundation: "rate" as const,
    })),
    ...(marks ?? []).map((m) => ({ ...m, foundation: "pauses" as const })),
    ...(tone?.reliable ? tone.marks : []).map((m) => ({
      ...m,
      foundation: "tonality" as const,
    })),
    ...(melody.reliable ? melody.marks : []).map((m) => ({
      ...m,
      foundation: "pitch_melody" as const,
    })),
  ].map(({ foundation, start, end }) => ({ foundation, start, end }));
  return {
    words: words as (Word & Span)[],
    found,
    issues,
    assessed,
    pausePoints: { read: pauseReview.read ?? 0, kept: pauseReview.kept ?? 0 },
    hearing: pauseReview.hearing ?? { moments: 0, clips: 0 },
  };
}

/** Points found in `span`, or the share of it a stretch covers. */
function amount(found: Found[], foundation: Foundation, span: Span) {
  const own = found.filter((f) => f.foundation === foundation);
  return STRETCHES.includes(foundation)
    ? own.reduce((s, f) => s + overlap(f.point, span), 0) /
        Math.max(1e-9, span.end - span.start)
    : own.filter((f) => overlap(f.point, span) > 0).length;
}

const rows: Record<string, unknown>[] = [];
const totals = new Map<
  string,
  { minutes: Record<Foundation, number>; sum: Record<Foundation, number> }
>();
/** Whole recordings, demonstrations included: what a user uploading them would see. */
const wholes = new Map<
  string,
  {
    seconds: number;
    lit: number;
    pauseIssues: number;
    read: number;
    kept: number;
    moments: number;
    clips: number;
  }
>();
const praise: {
    recording: string;
    foundation: Foundation;
    note: string;
    found: boolean;
  }[] = [],
  falsePraise: {
    recording: string;
    foundation: Foundation;
    note: string;
    found: string[];
  }[] = [],
  pairs: {
    recording: string;
    foundation: Foundation;
    note: string;
    before: number;
    after: number;
  }[] = [];
for (const r of recordings) {
  const source = recipe.sources.find((s) => s.file === r.source);
  if (r.source && !source)
    throw new Error(`${r.name}: unknown source ${r.source}`);
  let result;
  try {
    result = await strengthsOf(r);
  } catch (error) {
    console.error(`${r.name}: ${(error as Error).message}`);
    rows.push({
      name: r.name,
      group: r.group,
      error: (error as Error).message,
    });
    continue;
  }
  const { words, found, issues, assessed, pausePoints, hearing } = result;
  // Only the speaker's own teaching counts towards their rates.
  const spoken: Span = { start: words[0].start, end: words.at(-1)!.end };
  const left = source?.notTeaching ?? [];
  // A point counts where most of it is; a stretch counts for the part outside.
  const counted = found.filter(
    (f) =>
      STRETCHES.includes(f.foundation) ||
      !left.some(
        (x) => overlap(x, f.point) >= (f.point.end - f.point.start) / 2,
      ),
  );
  const seconds =
    spoken.end -
    spoken.start -
    left.reduce((s, x) => s + overlap(x, spoken), 0);
  const per = Object.fromEntries(
    FOUNDATIONS.map((foundation) => {
      const own = counted.filter((f) => f.foundation === foundation);
      return [
        foundation,
        STRETCHES.includes(foundation)
          ? own.reduce((s, f) => {
              // Stretches on recognizer timing can reach past the aligned words.
              const inside = {
                start: Math.max(f.point.start, spoken.start),
                end: Math.min(f.point.end, spoken.end),
              };
              return (
                s +
                Math.max(0, inside.end - inside.start) -
                left.reduce((t, x) => t + overlap(x, inside), 0)
              );
            }, 0) / seconds
          : own.length / (seconds / 60),
      ];
    }),
  ) as Record<Foundation, number>;
  // Group figures weight each recording by its counted time; a foundation not assessed is left out.
  const group = totals.get(r.group) ?? {
    minutes: { rate: 0, pauses: 0, tonality: 0, pitch_melody: 0 },
    sum: { rate: 0, pauses: 0, tonality: 0, pitch_melody: 0 },
  };
  for (const f of FOUNDATIONS)
    if (assessed[f]) {
      group.minutes[f] += seconds / 60;
      group.sum[f] += per[f] * (seconds / 60);
    }
  totals.set(r.group, group);
  for (const p of source?.praise ?? []) {
    const hit = amount(found, p.foundation, p) > 0;
    praise.push({
      recording: r.name,
      foundation: p.foundation,
      note: p.note,
      found: hit,
    });
  }
  for (const p of source?.noPraise ?? [])
    falsePraise.push({
      recording: r.name,
      foundation: p.foundation,
      note: p.note,
      // A point belongs to where it starts (a pause, to the word it follows); a stretch to any part of it.
      found: found
        .filter(
          (f) =>
            f.foundation === p.foundation &&
            (STRETCHES.includes(f.foundation)
              ? overlap(f.point, p) > 0
              : f.point.start >= p.start && f.point.start < p.end),
        )
        .map((f) => `${f.rule} ${f.start.toFixed(1)}s "${f.text}"`),
    });
  for (const p of source?.pairs ?? [])
    pairs.push({
      recording: r.name,
      foundation: p.foundation,
      note: p.note,
      before: amount(found, p.foundation, p.before),
      after: amount(found, p.foundation, p.after),
    });
  // The share of the recording under any highlight, and its pause issues per minute.
  let lit = 0,
    reached = spoken.start;
  for (const x of [...found, ...issues].sort((a, b) => a.start - b.start)) {
    const from = Math.max(x.start, reached),
      to = Math.min(x.end, spoken.end);
    if (to > from) {
      lit += to - from;
      reached = to;
    }
  }
  const highlighted = lit / (spoken.end - spoken.start),
    pauseIssues =
      issues.filter((x) => x.foundation === "pauses").length /
      ((spoken.end - spoken.start) / 60);
  const whole = wholes.get(r.group) ?? {
    seconds: 0,
    lit: 0,
    pauseIssues: 0,
    read: 0,
    kept: 0,
    moments: 0,
    clips: 0,
  };
  whole.moments += hearing.moments;
  whole.clips += hearing.clips;
  whole.read += pausePoints.read;
  whole.kept += pausePoints.kept;
  whole.seconds += spoken.end - spoken.start;
  whole.lit += lit;
  whole.pauseIssues += issues.filter((x) => x.foundation === "pauses").length;
  wholes.set(r.group, whole);
  rows.push({
    name: r.name,
    group: r.group,
    minutes: seconds / 60,
    assessed,
    per,
    highlighted,
    pauseIssues,
    pausePoints,
    hearing,
    found,
    issues,
  });
  console.log(
    `${r.name} (${r.group}, ${(seconds / 60).toFixed(1)} min): rate ${per.rate.toFixed(1)}/min, pauses ${per.pauses.toFixed(1)}/min, tonality ${Math.round(100 * per.tonality)}%, pitch ${Math.round(100 * per.pitch_melody)}%${FOUNDATIONS.filter(
      (f) => !assessed[f],
    )
      .map((f) => `; ${f} not assessed`)
      .join("")}`,
  );
}

console.log(
  "\ngroup                    minutes   rate/min  pauses/min  tonality  pitch (share of speaking time)",
);
const groups = [...totals].map(([name, g]) => ({
  group: name,
  minutes: Math.max(...Object.values(g.minutes)),
  ...(Object.fromEntries(
    FOUNDATIONS.map((f) => [f, g.minutes[f] ? g.sum[f] / g.minutes[f] : null]),
  ) as Record<Foundation, number | null>),
}));
const show = (x: number | null, share: boolean) =>
  x === null ? "-" : share ? `${Math.round(100 * x)}%` : x.toFixed(2);
for (const g of groups)
  console.log(
    `${g.group.padEnd(24)} ${g.minutes.toFixed(1).padStart(7)} ${show(g.rate, false).padStart(10)} ${show(g.pauses, false).padStart(11)} ${show(g.tonality, true).padStart(9)} ${show(g.pitch_melody, true).padStart(6)}`,
  );
console.log(
  "\ngroup                    highlighted  pause issues/min  pause faults read → heard, per min  moments heard → requests, per min (whole recordings)",
);
for (const [name, w] of wholes)
  console.log(
    `${name.padEnd(24)} ${`${Math.round((100 * w.lit) / w.seconds)}%`.padStart(11)} ${(w.pauseIssues / (w.seconds / 60)).toFixed(1).padStart(10)}   ${(w.read / (w.seconds / 60)).toFixed(1)} → ${(w.kept / (w.seconds / 60)).toFixed(1)}   ${(w.moments / (w.seconds / 60)).toFixed(1)} → ${(w.clips / (w.seconds / 60)).toFixed(1)}`,
  );
if (praise.length) {
  console.log(
    `\nMoments the coach names: ${praise.filter((p) => p.found).length}/${praise.length} found`,
  );
  for (const p of praise)
    console.log(
      `  ${p.found ? "found " : "missed"} ${p.foundation}: ${p.note}`,
    );
}
if (falsePraise.length) {
  console.log(
    `\nDeliberate mistakes praised: ${falsePraise.filter((p) => p.found.length).length}/${falsePraise.length}`,
  );
  for (const p of falsePraise.filter((p) => p.found.length))
    console.log(`  ${p.foundation}: ${p.note} ← ${p.found.join("; ")}`);
}
if (pairs.length) {
  console.log(
    "\nCoached pairs (before → after; points, or share of time for stretches):",
  );
  for (const p of pairs)
    console.log(
      `  ${p.foundation}: ${STRETCHES.includes(p.foundation) ? `${Math.round(100 * p.before)}% → ${Math.round(100 * p.after)}%` : `${p.before} → ${p.after}`}  ${p.note.split(".")[0]}.`,
    );
}
if (values.report)
  writeFileSync(
    resolve(values.report),
    JSON.stringify(
      {
        recipe: recipe.id,
        versions: {
          rate: RATE_VERSION,
          pauseStrength: PAUSE_STRENGTH_VERSION,
          tonality: TONALITY_VERSION,
          pitch: PITCH_VERSION,
        },
        createdAt: new Date().toISOString(),
        run,
        groups,
        praise,
        falsePraise,
        pairs,
        recordings: rows,
      },
      null,
      2,
    ) + "\n",
  );
