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
import { geminiJudgment, geminiVoice } from "@micmane/vocal-processing/gemini";
import {
  openaiCompletion,
  tonalitySettings,
} from "@micmane/vocal-processing/openai";
import { predictPacing } from "@micmane/vocal-processing/pacing";
import { PAUSE_VERSION, type PauseMark } from "@micmane/vocal-processing/pause";
import { reviewPause } from "@micmane/vocal-processing/pause-review";
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
  type Emotion,
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

const copy = {
  // A passage whose key points went by no slower than its setup.
  RATE_CONTRAST: {
    observation: "Your key points go by as fast as the setup around them.",
    why_it_matters:
      "Slowing down on what matters tells the listener what to focus on.",
    practice: "Slow down on the point, then move through the setup.",
  },
  RATE_IMPORTANCE_FAST: {
    observation: "This passage moves quickly.",
    why_it_matters:
      "A little more time can make this passage easier to follow.",
    practice:
      "Give this phrase a little more time, then resume your natural pace.",
  },
  RATE_IMPORTANCE_SLOW: {
    observation: "This passage moves slowly.",
    why_it_matters: "A brisker pace can help this passage keep its momentum.",
    practice:
      "Move through this phrase more briskly and save time for the key idea.",
  },
} as const;
const pauseCopy = {
  PAUSE_NECESSARY: {
    observation: "This stretch runs on without a pause.",
    why_it_matters:
      "A pause gives the listener a moment to take in what you just said.",
    practice:
      "Stop at the marked place and let the point land before you go on.",
  },
  PAUSE_TOO_SHORT: {
    observation: "This moment passes too quickly.",
    why_it_matters: "The point needs a moment to sink in before you move on.",
    practice: "Hold the marked pause longer and let the point land.",
  },
  PAUSE_UNNECESSARY: {
    observation: "The pauses here break up the thought.",
    why_it_matters: "Stopping every few words makes one idea hard to follow.",
    practice:
      "Say this thought in one breath, without stopping at the marked places.",
  },
  PAUSE_TOO_LONG: {
    observation: "This silence goes on too long.",
    why_it_matters:
      "A silence this long stops sounding deliberate, and the listener starts to wonder if you lost your place.",
    practice: "Keep the pause, but move on after a beat or two.",
  },
} as const;
const volumeCopy = {
  // A stretch whose voice turned softer and duller than the speaker's normal.
  VOLUME_LOW: {
    observation: "Your voice drops here and loses its projection.",
    why_it_matters:
      "Volume carries confidence and energy; when it drops, listeners have to work to stay with you.",
    practice:
      "Keep the volume you use elsewhere through this stretch, about a 6 or 7 out of 10.",
  },
  // Phrase endings that repeatedly drop well below the speaker's normal.
  VOLUME_FADE: {
    observation: "Your voice trails off at the end of these sentences.",
    why_it_matters:
      "The end of a sentence often carries the point; when it fades, it gets lost.",
    practice:
      "Take a breath at the pause before, and carry your volume through to the last word.",
  },
} as const;
// Vinh's pitch lesson: melody is the different notes you hit; anything distracting takes away from the message.
const pitchCopy = {
  // 10 s of speaking whose pitch barely moves.
  PITCH_VARIETY: {
    observation: "Your voice stays on one note through this stretch.",
    why_it_matters:
      "Melody tells listeners what matters and makes it easier to remember; a voice on one note is easy to tune out.",
    practice:
      "Say it again and let your voice move: lift the word that matters, then let it fall. To widen your range, read a page while sliding slowly from low to high and back.",
  },
  // Far above the speaker's normal pitch in the same take.
  PITCH_HIGH: {
    observation:
      "Your voice sits much higher here than in the rest of your talk.",
    why_it_matters:
      "A voice stuck high draws attention to itself and away from your message.",
    practice:
      "Say it again in your usual speaking voice, and let it rise only on the words that matter.",
  },
  // Far below the speaker's normal pitch in the same take.
  PITCH_LOW: {
    observation:
      "Your voice drops much lower here than in the rest of your talk.",
    why_it_matters:
      "Stuck low, your voice loses its energy, and listeners notice the drop more than the message.",
    practice:
      "Say it again in your usual speaking voice and let it move: lift the word that matters, then let it fall.",
  },
} as const;

// Vinh's tonality lesson: the face is the remote control for the emotion in the voice.
const toneCopy = {
  TONE_FLAT: {
    observation: "Your voice sounds flat here.",
    why_it_matters:
      "Listeners connect with the feeling in your voice, not only with the words.",
    practice:
      "Decide what this passage should feel like, let your face show it, and say it again.",
  },
} as const;

/** How a tonality note names the feeling the words call for. */
const FEELING: Record<Emotion, string> = {
  happy: "warmth or enthusiasm",
  sad: "concern",
  angry: "conviction",
  surprised: "curiosity",
  fearful: "urgency",
  disgusted: "disapproval",
  neutral: "a calm voice",
};

export function flatObservation(expected: Emotion[]): string {
  const feelings = expected
    .filter((e) => e !== "neutral")
    .slice(0, 2)
    .map((e) => FEELING[e]);
  return feelings.length
    ? `Your voice sounds flat here, while the words call for ${feelings.join(" and ")}.`
    : toneCopy.TONE_FLAT.observation;
}

type Copy = { observation: string; why_it_matters: string; practice: string };
/** Words in quotes, without the full stop or comma recognition put after the last one. */
const quoted = (text: string) => `“${text.replace(/[.,;:]+$/, "")}”`;
const quote = (words: Word[], first: number, last: number) =>
  quoted(
    words
      .slice(first, last + 1)
      .map((w) => w.text)
      .join(" "),
  );

/**
 * What a speaker did well, and why it works, in the lessons' terms. Each
 * strength names what was measured or heard there; the reason is the one the
 * course gives for the technique.
 */
const strengthCopy = {
  // Vinh's rate lesson: slowing down on what matters is a verbal highlight.
  RATE_SLOWS_FOR_POINT: (m: RateStrengthMark): Copy => ({
    observation: `You slow right down on ${quoted(m.focus.text)}, to about ${Math.round((100 * 2 ** m.pace) / 5) * 5}% of your usual pace.`,
    why_it_matters:
      "Slowing down on what matters is a verbal highlight: it tells the listener this is the part to focus on.",
    practice:
      "Keep this. In your next take, find the line that matters most and give it the same room.",
  }),
  // Vinh's pause lesson: a pause gives people time to process what you just said.
  PAUSE_LETS_IT_LAND: (m: PauseStrengthMark, words: Word[]): Copy => ({
    observation: `You stop for ${m.seconds.toFixed(1)} seconds after ${quote(words, m.first, m.at)} and let it land.`,
    why_it_matters:
      "The silence gives the listener time to process the point before you move on.",
    practice: "Keep this pause. Give your next key point the same beat.",
  }),
  PAUSE_BUILDS_ANTICIPATION: (m: PauseStrengthMark, words: Word[]): Copy => ({
    observation: `You pause for ${m.seconds.toFixed(1)} seconds just before ${quote(words, m.at + 1, m.last)}.`,
    why_it_matters:
      "Holding back what comes next makes the listener lean in for it.",
    practice: "Keep it. Try the same pause before your next answer or reveal.",
  }),
  // Vinh's tonality lesson: the emotion underneath the voice is what listeners connect with.
  TONE_EXPRESSIVE: (m: ToneStrengthMark): Copy => {
    const feelings = m.expected
      .filter((e) => e !== "neutral")
      .slice(0, 2)
      .map((e) => FEELING[e]);
    return {
      observation: `Your voice is ${m.expressiveness >= 5 ? "vivid" : "clearly expressive"} here, where the words call for ${feelings.join(" and ")}.`,
      why_it_matters:
        "Listeners connect with the feeling in your voice, not only with the words; here they can hear that you mean it.",
      practice:
        "Keep this. Notice what your face is doing here, and bring it to the flatter passages.",
    };
  },
  // Vinh's pitch lesson: melody makes a message memorable, the way a song is.
  PITCH_MELODY: (): Copy => ({
    observation:
      "Your voice moves freely between high and low notes through this stretch.",
    why_it_matters:
      "Melody tells listeners what matters and makes your message easier to remember, the way a song is.",
    practice:
      "Keep this range, and bring the same movement to the stretches where your voice settles on one note.",
  }),
};

/** One finding per segment a mark covers; the shared group ID lets the app rejoin them into one highlight. */
function findingsFor<
  M extends {
    start: number;
    end: number;
    rule: string;
    suggestions?: RateMark["suggestions"];
  },
>(
  segments: Segment[],
  marks: M[],
  copyOf: (mark: M) => Copy,
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
          ...copyOf(mark),
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
  const findings = findingsFor(
    segments,
    marks ?? [],
    (m) => pauseCopy[m.rule],
  ).map((f) => {
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
      (m) => strengthCopy[m.rule](m, words),
      "strength",
    ).map((f) => ({ ...f, suggestions: [] })),
  );
  return {
    foundation: "pauses" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summary: !marks
      ? "Pauses could not be assessed for this take."
      : marks.length
        ? "Some pauses are missing, out of place, too short or too long."
        : "No pause issue was detected in this take.",
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
    summary: !marks
      ? "There is not enough clear speech to judge volume in this take."
      : marks.length
        ? "Your voice drops or trails off in a few places."
        : "No drop in volume or trailing off was detected in this take.",
    findings: findingsFor(segments, marks ?? [], (m) => volumeCopy[m.rule]),
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
 * Pitch is measured from the decoded audio; otherwise it is not assessed. A
 * mark the listening model heard the same way uses its description and fix.
 */
export function pitchAssessment(
  segments: Segment[],
  marks: PitchMark[] | undefined,
  strengths: PitchStrengthMark[] = [],
  /** Whether the melody of the whole take moves as much as a lively stretch must. */
  lively = false,
) {
  const findings = [
    ...findingsFor(segments, marks ?? [], (m) => pitchCopy[m.rule]).map((f) => {
      const { how, fix } = marks![Number(f.group_id)];
      return how ? { ...f, observation: how, practice: fix! } : f;
    }),
    // A lively melody is measured, so it is as sure as the measurement.
    ...findingsFor(
      segments,
      marks ? strengths : [],
      strengthCopy.PITCH_MELODY,
      "strength",
    ).map((f) => ({ ...f, uncertainty: "clear" })),
  ];
  return {
    foundation: "pitch_melody" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summary: !marks
      ? "There is not enough voiced speech to judge pitch in this take."
      : marks.length
        ? "Your voice stays on one note, or stays too high or low, in a few places."
        : lively
          ? `Your voice moves freely between high and low notes throughout this take.${strengths.length ? " The marked stretches move the most." : ""}`
          : "Your voice moves between notes; no monotone stretch was detected.",
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
    ...findingsFor(segments, marks ?? [], (m) => toneCopy[m.rule]).map((f) => ({
      ...f,
      observation: flatObservation(marks![Number(f.group_id)].expected),
    })),
    ...findingsFor(
      segments,
      marks ? strengths : [],
      strengthCopy.TONE_EXPRESSIVE,
      "strength",
    ),
  ];
  return {
    foundation: "tonality" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summary: !marks
      ? "Tonality could not be assessed for this take."
      : marks.length
        ? "Your voice sounds flat in places; a little more feeling would help the words land."
        : expressive
          ? `Your voice is expressive throughout this take.${strengths.length ? " The marked passages are the most vivid." : ""}`
          : "No flat stretch was detected; your voice carries some expression.",
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
    ...findingsFor(segments, marks, (m) => copy[m.rule]),
    ...findingsFor(
      segments,
      strengths,
      strengthCopy.RATE_SLOWS_FOR_POINT,
      "strength",
    ),
  ];
  return {
    overall: message
      ? `Your main message: ${message}`
      : "Review your rate of speech.",
    assessments: [
      {
        foundation: "rate",
        verdict: marks.length
          ? "mixed"
          : status === "uncertain"
            ? "uncertain"
            : "effective",
        summary: marks.length
          ? "There are a few places where a pace change may help the point land."
          : status === "uncertain"
            ? "There is not enough reliable evidence to judge the rate in this take."
            : "No substantial rate issue was detected in this take.",
        findings,
      },
      ...(["volume", "pitch_melody", "tonality", "pauses"] as const).map(
        (foundation) => ({
          foundation,
          verdict: "uncertain",
          summary: "This foundation has not been analyzed yet.",
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

export async function reviewAudio(audio: Buffer) {
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
  // What needs only the recognizer's words starts at once. The pacing prediction reads only the text;
  // pitch listening and tonality cut the audio into passages of 10 s or more, on recognizer timing as in their benchmarks.
  const predicting = timed(
    "pacing",
    predictPacing(recognized, openaiCompletion()).catch(() => undefined),
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
  // Timing measures every pause; a model judges each one, the work it does, and every stretch without one.
  const reviewing = timed(
    "pauseReview",
    pauses
      ? reviewPause(
          transcript,
          pauses,
          openaiCompletion(),
          transcript === recognized ? undefined : recognized,
          // Breaks and missing pauses count only where they also sound like one, and a pause is praised only if it sounds deliberate.
          decoded && process.env.GEMINI_API_KEY
            ? {
                audio: decoded,
                judge: geminiJudgment(),
                config: config.pauseHeard,
                hearing: config.hearing,
              }
            : undefined,
          config.strengths && config.pauseStrength,
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
  const [pacing, heard, tone, pause, measured] = await Promise.all([
    predicting,
    listening,
    toning,
    reviewing,
    measuring,
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
    timings,
    review,
  };
}
