import type {
  FindingEvidence,
  FindingRule,
} from "@micmane/validation/feedback";
import {
  alignEmission,
  loadAligner,
  type Aligner,
  type Emission,
} from "@micmane/vocal-processing/align";
import {
  transcribe,
  wordsFromDeepgram,
} from "@micmane/vocal-processing/deepgram";
import {
  carryMap,
  mapDelivery,
  pacingOf,
  placesOf,
  type DeliveryMap,
} from "@micmane/vocal-processing/delivery-map";
import { geminiJudgment, geminiVoice } from "@micmane/vocal-processing/gemini";
import {
  openaiCompletion,
  tonalitySettings,
} from "@micmane/vocal-processing/openai";
import { PAUSE_VERSION, type PauseMark } from "@micmane/vocal-processing/pause";
import { pausesMet, reviewPause } from "@micmane/vocal-processing/pause-review";
import {
  faulted,
  PAUSE_STRENGTH_VERSION,
  type PauseStrengthMark,
} from "@micmane/vocal-processing/pause-strength";
import { findPauses, type Pause } from "@micmane/vocal-processing/pauses";
import {
  detectPitch,
  PITCH_VERSION,
  trackPitchInSteps,
  type PitchMark,
  type PitchStrengthMark,
} from "@micmane/vocal-processing/pitch";
import {
  listenForPitch,
  type Heard,
} from "@micmane/vocal-processing/pitch-listen";
import {
  detectRate,
  RATE_VERSION,
  syllables,
  type RateMark,
  type RateStrengthMark,
} from "@micmane/vocal-processing/rate";
import {
  reviewConfig,
  type ReviewConfig,
} from "@micmane/vocal-processing/review-config";
import {
  reviewTonality,
  TONALITY_VERSION,
  type ToneMark,
  type ToneStrengthMark,
} from "@micmane/vocal-processing/tonality";
import {
  detectVolume,
  VOLUME_VERSION,
  type VolumeMark,
} from "@micmane/vocal-processing/volume";
import { decodeAudio } from "./audio.ts";

type Word = { text: string; start: number; end: number };
type Segment = {
  id: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
  speakingRate: number;
};

export function segmentWords(words: Word[]): Segment[] {
  const segments: Segment[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    const seconds = Math.max(last.end - first.start, 0.1);
    segments.push({
      id: `segment-${segments.length + 1}`,
      start: first.start,
      end: last.end,
      text: current.map((word) => word.text).join(" "),
      words: current,
      speakingRate:
        current.reduce((sum, word) => sum + syllables(word.text), 0) / seconds,
    });
    current = [];
  };
  for (const word of words) {
    if (
      current.length &&
      (word.start - current[current.length - 1].end >= 0.5 ||
        current.length >= 25)
    )
      flush();
    current.push(word);
    if (/[.!?]$/.test(word.text)) flush();
  }
  flush();
  return segments;
}

/** Evidence stays language-neutral; the frontend owns all coaching copy. */
const phrase = (words: Word[], first: number, last: number) =>
  words
    .slice(first, last + 1)
    .map((word) => word.text)
    .join(" ");

const strengthEvidence = {
  RATE_SLOWS_FOR_POINT: (mark: RateStrengthMark): FindingEvidence => ({
    focusText: mark.focus.text,
    pace: mark.pace,
  }),
  PAUSE_LETS_IT_LAND: (
    mark: PauseStrengthMark,
    words: Word[],
  ): FindingEvidence => ({
    seconds: mark.seconds,
    focusText: phrase(words, mark.first, mark.at),
  }),
  PAUSE_BUILDS_ANTICIPATION: (
    mark: PauseStrengthMark,
    words: Word[],
  ): FindingEvidence => ({
    seconds: mark.seconds,
    focusText: phrase(words, mark.at + 1, mark.last),
  }),
  TONE_EXPRESSIVE: (mark: ToneStrengthMark): FindingEvidence => ({
    expected: mark.expected,
    expressiveness: mark.expressiveness,
  }),
  PITCH_MELODY: (): FindingEvidence => ({}),
};

/** One finding per segment a mark covers; the shared group ID lets the app rejoin them into one highlight. */
function findingsFor<
  M extends {
    start: number;
    end: number;
    rule: FindingRule;
    suggestions?: RateMark["suggestions"];
  },
>(
  segments: Segment[],
  marks: M[],
  evidenceOf: (mark: M) => FindingEvidence = () => ({}),
  kind: "improvement" | "strength" = "improvement",
) {
  return marks.flatMap((mark, markIndex) =>
    segments.flatMap((segment) => {
      const covered = segment.words.filter(
        (word) => word.start >= mark.start && word.end <= mark.end,
      );
      if (!covered.length) return [];
      const phrase = covered.map((word) => word.text).join(" ");
      return [
        {
          segment_id: segment.id,
          group_id:
            kind === "strength" ? `strength-${markIndex}` : String(markIndex),
          rule_id: mark.rule,
          kind,
          uncertainty: "tentative",
          evidence: evidenceOf(mark),
          start: covered[0].start,
          end: covered[covered.length - 1].end,
          text: phrase,
          // Every part of a passage carries its suggestions; the editor keeps them when it rejoins the parts.
          ...(mark.suggestions?.length
            ? {
                suggestions: mark.suggestions.map(
                  ({ direction, start, end, text }) => ({
                    direction,
                    start,
                    end,
                    text,
                  }),
                ),
              }
            : {}),
        },
      ];
    }),
  );
}

/**
 * Pauses are judged only with pauses measured from the audio and a model
 * review; otherwise they are not assessed. Each finding names its words.
 * Strengths are pauses that let a point land or build anticipation.
 */
export function pauseAssessment(
  segments: Segment[],
  marks: PauseMark[] | undefined,
  words: Word[] = [],
  strengths: PauseStrengthMark[] = [],
) {
  const findings = findingsFor(segments, marks ?? [], () => ({})).map((f) => {
    const mark = marks![Number(f.group_id)];
    const direction = (
      {
        PAUSE_NECESSARY: "pause_after",
        PAUSE_TOO_SHORT: "lengthen_pause_after",
        PAUSE_UNNECESSARY: "no_pause_after",
        PAUSE_TOO_LONG: "shorten_pause_after",
      } as const
    )[mark.rule];
    const suggestions = mark.at
      .map((i) => words[i])
      .filter((w) => w && w.start >= f.start && w.end <= f.end)
      .map((w) => ({ direction, start: w.start, end: w.end, text: w.text }));
    return { ...f, uncertainty: "clear", suggestions };
  });
  findings.push(
    ...findingsFor(
      segments,
      marks ? strengths : [],
      (m) => strengthEvidence[m.rule](m, words),
      "strength",
    ).map((f) => ({ ...f, suggestions: [] })),
  );
  return {
    foundation: "pauses" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summaryCode: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    findings,
  };
}

/**
 * Volume is judged against the speaker's own level in the recording, so it
 * needs the decoded audio; otherwise it is not assessed.
 */
export function volumeAssessment(
  segments: Segment[],
  marks: VolumeMark[] | undefined,
) {
  return {
    foundation: "volume" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summaryCode: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    findings: findingsFor(segments, marks ?? [], () => ({})),
  };
}

/**
 * Spans measured on the recognizer's word timing, moved onto the aligned
 * transcript the segments are built from. Alignment keeps the same words in
 * the same order, so word indexes carry over.
 */
export function onto<
  S extends { first: number; last: number; start: number; end: number },
>(spans: S[], transcript: Word[]): S[] {
  return spans.map((s) => ({
    ...s,
    start: transcript[s.first].start,
    end: transcript[s.last].end,
  }));
}

/**
 * Volume uses the recognizer's word timing, as its benchmark does: forced
 * alignment refines words against measured pauses and trims a fading voice
 * as if it were silence.
 */
export function measureVolume(
  samples: Float32Array,
  sampleRate: number,
  recognized: Word[],
  transcript: Word[],
): VolumeMark[] | undefined {
  const volume = detectVolume(samples, sampleRate, recognized);
  return volume.reliable ? onto(volume.marks, transcript) : undefined;
}

/**
 * Pitch is measured from the decoded audio; otherwise it is not assessed.
 * Listening judgments affect the rule selection, never the frontend wording.
 */
export function pitchAssessment(
  segments: Segment[],
  marks: PitchMark[] | undefined,
  strengths: PitchStrengthMark[] = [],
  /** Whether the melody of the whole take moves as much as a lively stretch must. */
  lively = false,
) {
  const findings = [
    ...findingsFor(segments, marks ?? []),
    // A lively melody is measured, so it is as sure as the measurement.
    ...findingsFor(
      segments,
      marks ? strengths : [],
      strengthEvidence.PITCH_MELODY,
      "strength",
    ).map((f) => ({ ...f, uncertainty: "clear" })),
  ];
  return {
    foundation: "pitch_melody" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summaryCode: !marks
      ? "uncertain"
      : marks.length
        ? "mixed"
        : lively
          ? strengths.length
            ? "lively_marked"
            : "lively"
          : "effective",
    findings,
  };
}

/**
 * Tonality is judged only when Gemini and the text model both answered;
 * otherwise it is not assessed. Its marks are moved onto the aligned transcript.
 */
export function tonalityAssessment(
  segments: Segment[],
  marks: ToneMark[] | undefined,
  strengths: ToneStrengthMark[] = [],
  /** Whether the speaker's usual passage in this take is already expressive. */
  expressive = false,
) {
  const findings = [
    ...findingsFor(segments, marks ?? [], (m) => ({ expected: m.expected })),
    ...findingsFor(
      segments,
      marks ? strengths : [],
      strengthEvidence.TONE_EXPRESSIVE,
      "strength",
    ),
  ];
  return {
    foundation: "tonality" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summaryCode: !marks
      ? "uncertain"
      : marks.length
        ? "mixed"
        : expressive
          ? strengths.length
            ? "expressive_marked"
            : "expressive"
          : "effective",
    findings,
  };
}

export function rateReview(
  segments: Segment[],
  marks: RateMark[],
  message = "",
  status: "reviewed" | "uncertain" = "reviewed",
  strengths: RateStrengthMark[] = [],
) {
  const findings = [
    ...findingsFor(segments, marks, () => ({})),
    ...findingsFor(
      segments,
      strengths,
      strengthEvidence.RATE_SLOWS_FOR_POINT,
      "strength",
    ),
  ];
  return {
    mainMessage: message,
    assessments: [
      {
        foundation: "rate",
        verdict: marks.length
          ? "mixed"
          : status === "uncertain"
            ? "uncertain"
            : "effective",
        summaryCode: marks.length
          ? "mixed"
          : status === "uncertain"
            ? "uncertain"
            : "effective",
        findings,
      },
      ...(["volume", "pitch_melody", "tonality", "pauses"] as const).map(
        (foundation) => ({
          foundation,
          verdict: "uncertain",
          summaryCode: "unassessed",
          findings: [],
        }),
      ),
    ],
  };
}

/** The decoded audio and its measured pauses, since recognizers stretch words over them; undefined if it can't be decoded. */
async function measurePauses(
  audio: Uint8Array,
): Promise<
  { samples: Float32Array; sampleRate: number; pauses: Pause[] } | undefined
> {
  try {
    const { samples, sampleRate } = await decodeAudio(audio);
    return { samples, sampleRate, pauses: findPauses(samples, sampleRate) };
  } catch {
    return undefined;
  }
}

// How expressive the voice sounds per passage, compared with the feeling the words call for.
async function analyzeTonality(
  words: Word[],
  decoded: { samples: Float32Array; sampleRate: number },
  config: ReviewConfig["tonality"],
) {
  try {
    return await reviewTonality(
      words,
      decoded.samples,
      decoded.sampleRate,
      geminiVoice(),
      openaiCompletion(tonalitySettings()),
      config,
    );
  } catch {
    return undefined;
  }
}

/** Pitch problems as Gemini hears them; undefined without the waveform, an API key, or a reply. */
async function listen(
  decoded: { samples: Float32Array; sampleRate: number } | undefined,
  words: Word[],
): Promise<Heard[] | undefined> {
  if (!decoded || !process.env.GEMINI_API_KEY) return undefined;
  try {
    // Its 30 s chunks are the slowest Gemini requests; the shared Gemini limit (GEMINI_CONCURRENCY) still caps it and tonality together.
    return await listenForPitch(
      decoded.samples,
      decoded.sampleRate,
      words,
      geminiJudgment(),
      { concurrency: 8 },
    );
  } catch {
    return undefined;
  }
}

// Refine recognizer timing before measuring speaking time.
let aligner: Promise<Aligner> | undefined;
const aligning = () => process.env.ALIGN_WORDS !== "0";

/** Load the alignment model before the first review needs it; if loading fails, the next review tries again. */
export function warmUp() {
  if (!aligning() || aligner) return;
  aligner = loadAligner();
  aligner.catch(() => {
    aligner = undefined;
  });
}

/** The alignment model's scores for the audio, most of alignment's work; they need no words. */
async function scoreAudio(
  decoded: { samples: Float32Array } | undefined,
): Promise<Emission | undefined> {
  if (!aligning() || !decoded) return undefined;
  try {
    aligner ??= loadAligner();
    return await (await aligner).emit(decoded.samples);
  } catch {
    aligner = undefined;
    return undefined;
  }
}

function retime(
  words: Word[],
  pauses: Pause[] | undefined,
  emission: Emission | undefined,
): Word[] {
  if (!pauses || !emission) return words;
  try {
    return alignEmission(words, emission, pauses);
  } catch {
    return words;
  }
}

/**
 * Review a take. `script` is the text of an earlier take with its delivery
 * map: this take's pauses and pace are then measured against the same phrases,
 * so the two takes can be compared. Without it, the map is made from this
 * take's words and returned as `script`, to pass in with the next take of the
 * same text.
 */
export async function reviewAudio(
  audio: Buffer,
  script?: { words: string[]; map: DeliveryMap },
) {
  // What counts as a strength and how pauses are heard; see review-config.ts for the environment overrides.
  const config = reviewConfig();
  // When each step finished, in milliseconds after the upload arrived.
  const began = performance.now(),
    timings: Record<string, number> = {};
  const done = (step: string) => {
    timings[step] = Math.round(performance.now() - began);
  };
  const timed = <T>(step: string, work: Promise<T>) =>
    work.finally(() => done(step));
  const decoding = timed("decode", measurePauses(audio));
  // Alignment scores the audio while the recognizer transcribes it; only matching the words to the scores waits for the transcript.
  const scoring = timed("alignmentScores", decoding.then(scoreAudio));
  const [response, decoded] = await Promise.all([
    timed("transcript", transcribe(new Uint8Array(audio))),
    decoding,
  ]);
  const recognized = wordsFromDeepgram(response) as Word[];
  if (recognized.length < 3) return undefined;
  // What needs only the recognizer's words starts at once. How the text should be delivered (where pauses belong, which
  // phrases to slow down on) is read from the words alone in one request, once per text; a later take reuses it.
  // Pitch listening and tonality cut the audio into passages of 10 s or more, on recognizer timing as in their benchmarks.
  const mapping = timed(
    "deliveryMap",
    script
      ? Promise.resolve(script.map)
      : mapDelivery(recognized, openaiCompletion()).catch(() => undefined),
  );
  // The map over this take's words: the pause that fits after each, and the phrases with their pace.
  const delivering = mapping.then(
    (map) =>
      map &&
      (script
        ? carryMap(
            map,
            script.words.map((text) => ({ text })),
            recognized,
          )
        : {
            places: placesOf(map, recognized.length),
            pacing: pacingOf(map),
          }),
  );
  const listening = timed("pitchListening", listen(decoded, recognized));
  const toning = timed(
    "tonality",
    decoded
      ? analyzeTonality(recognized, decoded, config.tonality)
      : Promise.resolve(undefined),
  );
  const transcript = retime(recognized, decoded?.pauses, await scoring);
  done("alignment");
  const pauses = decoded?.pauses;
  // Timing measures every pause in this take against the map.
  const reviewing = timed(
    "pauseReview",
    pauses
      ? delivering.then((delivery) =>
          reviewPause(transcript, pauses, delivery?.places, {
            recognized: transcript === recognized ? undefined : recognized,
            // Breaks and missing pauses count only where they also sound like one, and a pause is praised only if it sounds deliberate.
            hear:
              decoded && process.env.GEMINI_API_KEY
                ? {
                    audio: decoded,
                    judge: geminiJudgment(),
                    hearing: config.hearing,
                  }
                : undefined,
            strength: config.strengths && config.pauseStrength,
            config: config.pauseReview,
          }),
        )
      : Promise.resolve(undefined),
  );
  // While the models answer, measure what needs only the audio. Pitch is tracked in steps so their requests keep moving.
  const measuring = timed(
    "measurement",
    decoded
      ? trackPitchInSteps(decoded.samples, decoded.sampleRate).then(
          (track) => ({
            track,
            volume: measureVolume(
              decoded.samples,
              decoded.sampleRate,
              recognized,
              transcript,
            ),
          }),
        )
      : Promise.resolve(undefined),
  );
  const [pacing, heard, tone, pause, measured, map] = await Promise.all([
    delivering.then((delivery) => delivery?.pacing),
    listening,
    toning,
    reviewing,
    measuring,
    mapping,
  ]);
  const segments = segmentWords(transcript);
  const analysis = detectRate(transcript, config.rate, pauses, pacing);
  // Without the waveform, silence cannot be told from speech; without the prediction, contrast is unjudged.
  const status =
    !!decoded && analysis.reliable && analysis.contrast
      ? ("reviewed" as const)
      : ("uncertain" as const);
  const marks = decoded && analysis.reliable ? analysis.marks : [];
  const toneMarks = tone?.reliable ? onto(tone.marks, transcript) : undefined;
  const pauseMarks = pause?.reliable ? pause.marks : undefined;
  const rateStrengths =
    decoded && analysis.reliable && config.strengths
      ? analysis.strengths.filter(
          (s) => !faulted(s, pauseMarks, config.faults.rate),
        )
      : [];
  const kept = (pause?.strengths ?? []).filter(
    (s) => !faulted(s, pauseMarks, config.faults.pauses),
  );
  const toneStrengths =
    tone?.reliable && config.strengths ? onto(tone.strengths, transcript) : [];
  const rate = rateReview(segments, marks, "", status, rateStrengths);
  const volumeMarks = measured?.volume;
  // Pitch movement is measured inside the spoken words; what Gemini heard counts only where the measurement agrees.
  const melody =
    decoded &&
    detectPitch(
      decoded.samples,
      decoded.sampleRate,
      transcript,
      config.pitch,
      heard,
      measured?.track,
    );
  const pitchMarks = melody && melody.reliable ? melody.marks : undefined;
  const pitchStrengths =
    melody && melody.reliable && config.strengths ? melody.strengths : [];
  const review = {
    ...rate,
    assessments: rate.assessments.map((a) =>
      a.foundation === "pauses"
        ? pauseAssessment(segments, pauseMarks, transcript, kept)
        : a.foundation === "volume"
          ? volumeAssessment(segments, volumeMarks)
          : a.foundation === "tonality"
            ? tonalityAssessment(
                segments,
                toneMarks,
                toneStrengths,
                (tone?.usual ?? 0) >= config.tonality.expressiveScore,
              )
            : a.foundation === "pitch_melody"
              ? pitchAssessment(
                  segments,
                  pitchMarks,
                  pitchStrengths,
                  !!melody && (melody.spread ?? 0) >= config.pitch.melodySpread,
                )
              : a,
    ),
  };
  done("total");
  return {
    segments,
    rateDiagnostics: {
      version: RATE_VERSION,
      status,
      pace: analysis.pace,
      articulationRate: analysis.articulationRate,
      pacing,
      marks,
      strengths: rateStrengths,
    },
    pauseDiagnostics: {
      version: PAUSE_VERSION,
      status: pauseMarks ? ("reviewed" as const) : ("uncertain" as const),
      review: pause?.status,
      heard: pause?.heard,
      hearing: pause?.hearing,
      pauses,
      marks: pauseMarks ?? [],
      // What the speaker did at each place the map says needs a pause, and how many of them got one.
      places: pause?.places,
      met: pause?.places && pausesMet(pause.places),
      strengthVersion: PAUSE_STRENGTH_VERSION,
      strengths: pauseMarks ? kept : [],
    },
    volumeDiagnostics: {
      version: VOLUME_VERSION,
      status: volumeMarks ? ("reviewed" as const) : ("uncertain" as const),
      marks: volumeMarks ?? [],
    },
    tonalityDiagnostics: {
      version: TONALITY_VERSION,
      status: toneMarks ? ("reviewed" as const) : ("uncertain" as const),
      passages: tone && onto(tone.passages, transcript),
      marks: toneMarks ?? [],
      strengths: toneStrengths,
    },
    pitchDiagnostics: {
      version: PITCH_VERSION,
      status: pitchMarks ? ("reviewed" as const) : ("uncertain" as const),
      marks: pitchMarks ?? [],
      strengths: pitchStrengths,
      spread: melody ? melody.spread : undefined,
      heard,
    },
    // The text and its delivery map, for measuring the next take of it against the same phrases.
    script: map && {
      words: script?.words ?? recognized.map((w) => w.text),
      map,
    },
    timings,
    review,
  };
}
