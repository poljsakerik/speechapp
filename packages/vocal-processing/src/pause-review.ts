/**
 * Pause review: a take measured against the delivery map of its text.
 *
 * The map (delivery-map.ts) says, from the words alone, where a pause fits, where
 * the listener needs one, and which moments should be held. Timing measures
 * every real pause in the take (pause.ts). Comparing the two is plain
 * bookkeeping, so the same take always gets the same reading, and two takes of
 * one text are judged against the same places:
 * - a pause inside a phrase breaks the thought;
 * - a place that needs a pause and got none is a missing pause, and so is the
 *   middle of a long run of places where one fits, said without any;
 * - a moment to hold with only a breath is too short;
 * - a silence of several seconds is too long.
 *
 * What the map reads isn't what a listener hears, so with an audio model the
 * findings are kept only where they also sound that way (pause-hearing.ts): a
 * pause that breaks the thought must sound hesitant, a missing pause must
 * sound like the words run on, and a long silence must not sound deliberate.
 * The same hearing checks whether the held moments sound deliberate enough to
 * praise (pause-strength.ts), so a pause is never faulted and praised at once.
 *
 * Without a map the pause review is not assessed: no fixed syllable count
 * decides where a pause belongs.
 */
import type { Place } from "./delivery-map.ts";
import type { AudioJudgment } from "./gemini.ts";
import {
  hearingClips,
  hearMoments,
  type Audio,
  type HearingConfig,
  type Moment,
  type PauseSound,
} from "./pause-hearing.ts";
import {
  DEFAULT_PAUSE_STRENGTH_CONFIG,
  nameStrengths,
  proposeStrength,
  type PauseStrengthConfig,
  type PauseStrengthMark,
} from "./pause-strength.ts";
import {
  pauseAfterWords,
  timed,
  type PauseMark,
  type PauseRule,
} from "./pause.ts";
import type { Pause } from "./pauses.ts";
import type { Word } from "./types.ts";

export type MarkedPause = { after: number; seconds: number };

/**
 * Pauses whose word boundary the recognizer's own timing confirms. The aligner
 * occasionally moves a short word across a silence ("Here we | go."), which
 * would misplace the pause by a word; findings at such pauses are dropped.
 */
export function confirmedPauses(
  words: Word[],
  recognized: Word[],
  marked: MarkedPause[],
) {
  if (recognized.length !== words.length) return marked;
  return marked.filter(({ after: i }) => {
    const middle = (words[i].end! + words[i + 1].start!) / 2;
    return recognized.findLastIndex((w) => w.start! < middle) === i;
  });
}

/** How a take's pauses are measured against the map, and which findings must also be heard, and as what. */
export const DEFAULT_PAUSE_REVIEW_CONFIG = {
  breakSeconds: 0.3, // A stop inside a phrase counts from this long: listeners clearly hear it, and shorter gaps are mostly articulation.
  shortSeconds: 0.4, // At a moment to hold, a pause shorter than this is only a breath.
  runPlaces: 8, // Passing this many places in a row where a pause fits is a run-on: the coach passes six at most, his run-on demonstrations nine to twelve.
  longSeconds: 3, // A silence this long is too long, unless it sounds deliberate; the coach's longest held pauses are 2.3 s.
  breakSounds: ["hesitant"] as PauseSound[], // A break is kept when its pause sounds like one of these; empty keeps every break.
  missingMustRunOn: true, // A missing pause is kept only where the words sound like they run on.
};
export type PauseReviewConfig = typeof DEFAULT_PAUSE_REVIEW_CONFIG;

/**
 * What happened at a place the map says needs a pause, for comparing takes:
 * - "paused": a place that needs a pause got one;
 * - "held": a moment to hold got a pause long enough to be one to copy;
 * - "short": a moment to hold got only a breath;
 * - "missed": no pause;
 * - "clear": no pause, but the voice was heard to finish the thought;
 * - "unsure": the two word timings disagree about where the pauses here sit.
 */
export type PlaceOutcome = {
  at: number;
  place: Exclude<Place, "optional">;
  seconds: number;
  outcome: "paused" | "held" | "short" | "missed" | "clear" | "unsure";
};
export type PauseReview = {
  marks: PauseMark[];
  reliable: boolean;
  status: "reviewed" | "no timing" | "no map";
  marked: MarkedPause[];
  /** Every place that needs a pause in the words this take covers, and what the speaker did there. */
  places?: PlaceOutcome[];
  /** Whether breaks and missing pauses were also heard; if not, they are the map's alone. */
  heard?: boolean;
  /** How many places the map faulted, and how many of them were kept. */
  read?: number;
  kept?: number;
  /** How many moments were heard, and in how many requests. */
  hearing?: { moments: number; clips: number };
  /** The pauses that do real work; undefined unless they were heard. */
  strengths?: PauseStrengthMark[];
};

const RULES: PauseRule[] = [
  "PAUSE_NECESSARY",
  "PAUSE_TOO_SHORT",
  "PAUSE_UNNECESSARY",
  "PAUSE_TOO_LONG",
];
const met = ["paused", "held", "clear"];
/** The share of places needing a pause where the speaker gave the listener one, for comparing takes of one text. */
export function pausesMet(places: PlaceOutcome[]) {
  const assessed = places.filter((p) => p.outcome !== "unsure");
  return {
    met: assessed.filter((p) => met.includes(p.outcome)).length,
    of: assessed.length,
  };
}

/**
 * Measure every pause in a take against `places`, the delivery map of its words:
 * the pause that fits after each word, null inside a phrase, and undefined
 * where the map doesn't cover the word (delivery-map.ts, carryMap), which is not
 * assessed. `recognized` is the recognizer's timing for the same words when
 * `words` were re-aligned. Findings of one kind close together (within a
 * sentence or so) form one highlight. With `hear`, breaks, missing pauses and
 * long silences are kept only where they sound like one, and the held moments
 * become strengths where they sound deliberate. If a fault can't be heard, the
 * map's findings stand; if a held moment can't, no strength is reported;
 * neither failure touches the other. With `strength` false, no pause is heard
 * about its work.
 */
export async function reviewPause(
  words: Word[],
  pauses: Pause[],
  places?: (Place | null | undefined)[],
  {
    recognized,
    hear,
    strength = {},
    config,
  }: {
    recognized?: Word[];
    hear?: {
      audio: Audio;
      judge: AudioJudgment;
      hearing?: Partial<HearingConfig>;
    };
    strength?: Partial<PauseStrengthConfig> | false;
    config?: Partial<PauseReviewConfig>;
  } = {},
): Promise<PauseReview> {
  if (!timed(words))
    return { marks: [], reliable: false, status: "no timing", marked: [] };
  const after = pauseAfterWords(words, pauses);
  const marked = after.flatMap((seconds, i) =>
    seconds > 0 ? [{ after: i, seconds }] : [],
  );
  if (places?.length !== words.length)
    return { marks: [], reliable: false, status: "no map", marked };
  // Findings next to a pause whose position the two timings disagree on are not reliable.
  const sure = new Set(
    (recognized ? confirmedPauses(words, recognized, marked) : marked).map(
      (p) => p.after,
    ),
  );
  const unsure = marked.filter((p) => !sure.has(p.after)).map((p) => p.after);
  const s = { ...DEFAULT_PAUSE_STRENGTH_CONFIG, ...strength },
    c = { ...DEFAULT_PAUSE_REVIEW_CONFIG, ...config };
  const held = (i: number) =>
    places[i] === "land" || places[i] === "anticipation";
  const read: { at: number; rule: PauseRule }[] = [];
  const needing: PlaceOutcome[] = [];
  places.slice(0, -1).forEach((place, at) => {
    const seconds = after[at];
    if (place && place !== "optional")
      needing.push({
        at,
        place,
        seconds,
        outcome: (
          seconds ? !sure.has(at) : unsure.some((u) => Math.abs(u - at) <= 1)
        )
          ? "unsure"
          : !seconds
            ? "missed"
            : !held(at) || (seconds >= c.shortSeconds && seconds < s.minSeconds)
              ? "paused"
              : seconds < c.shortSeconds
                ? "short"
                : "held",
      });
    const outcome = needing.at(-1)?.at === at && needing.at(-1)!.outcome;
    if (outcome === "missed") read.push({ at, rule: "PAUSE_NECESSARY" });
    else if (!seconds || !sure.has(at)) return;
    else if (place === null) {
      if (seconds >= c.breakSeconds)
        read.push({ at, rule: "PAUSE_UNNECESSARY" });
    } else if (place !== undefined && seconds >= c.longSeconds)
      read.push({ at, rule: "PAUSE_TOO_LONG" });
    else if (outcome === "short") read.push({ at, rule: "PAUSE_TOO_SHORT" });
  });
  // A run-on: place after place where a pause fits, and the speaker took none. The middle one needed it, whatever else the run is missing.
  let run: number[] = [];
  const ended = () => {
    const at = run[Math.floor((run.length - 1) / 2)];
    if (
      run.length >= c.runPlaces &&
      !read.some((p) => p.at === at) &&
      !unsure.some((u) => Math.abs(u - at) <= 1)
    )
      read.push({ at, rule: "PAUSE_NECESSARY" });
    run = [];
  };
  places.slice(0, -1).forEach((place, at) => {
    if (after[at] || place === undefined) ended();
    else if (place) run.push(at);
  });
  ended();
  read.sort((a, b) => a.at - b.at);
  // A held moment that is long enough can be one to copy.
  const proposed = strength
    ? needing.flatMap((p) =>
        p.outcome === "held" && p.place !== "needed"
          ? [
              proposeStrength(
                words,
                marked,
                { after: p.at, seconds: p.seconds },
                p.place === "land" ? "lets_it_land" : "builds_anticipation",
                s,
              ),
            ]
          : [],
      )
    : [];
  let points = read,
    heard = false,
    hearing: PauseReview["hearing"],
    strengths: PauseStrengthMark[] | undefined;
  if (hear) {
    // What must be heard: breaks, missing pauses, long silences and proposed strengths, each with the fault or strength it decides.
    const moments: Moment[] = [],
      faults: number[] = [];
    read.forEach(({ at, rule }, i) => {
      if (
        (rule === "PAUSE_UNNECESSARY" && c.breakSounds.length) ||
        rule === "PAUSE_TOO_LONG"
      )
        moments.push({ kind: "pause", at, seconds: after[at] });
      else if (rule === "PAUSE_NECESSARY" && c.missingMustRunOn)
        moments.push({ kind: "missing", at });
      else return;
      faults.push(i);
    });
    for (const p of proposed)
      moments.push({
        kind: "pause",
        at: p.at,
        seconds: p.seconds,
        first: p.first,
      });
    const sounds = await hearMoments(
      words,
      moments,
      hear.audio,
      hear.judge,
      hear.hearing,
    );
    hearing = {
      moments: moments.length,
      clips: hearingClips(words, moments, hear.hearing).length,
    };
    // A fault that couldn't be heard leaves the map's findings standing, as they were read.
    heard = faults.every((_, n) => sounds[n]);
    if (heard) {
      points = read.filter(({ rule }, i) => {
        const n = faults.indexOf(i);
        return (
          n < 0 ||
          sounds[n] === "runs_on" ||
          (rule === "PAUSE_TOO_LONG"
            ? sounds[n] !== "deliberate"
            : c.breakSounds.includes(sounds[n] as PauseSound))
        );
      });
      // A place without a pause where the voice still finishes the thought gave the listener the break.
      const dropped = new Set(
        read.filter((p) => !points.includes(p)).map((p) => p.at),
      );
      for (const p of needing)
        if (p.outcome === "missed" && dropped.has(p.at)) p.outcome = "clear";
    }
    const sound = (n: number) => sounds[faults.length + n];
    // Strengths are named only when every proposed one was heard.
    if (strength && proposed.every((_, n) => sound(n)))
      strengths = nameStrengths(
        words,
        proposed.filter((_, n) => s.sounds.includes(sound(n) as PauseSound)),
        s,
      );
  }
  const marks: PauseMark[] = [];
  for (const rule of RULES) {
    const groups: number[][] = [];
    for (const { at } of points.filter((p) => p.rule === rule)) {
      const last = groups.at(-1);
      if (last && at - last.at(-1)! <= 6) last.push(at);
      else groups.push([at]);
    }
    for (const at of groups) {
      const first = Math.max(0, at[0] - 2),
        last = Math.min(words.length - 1, at.at(-1)! + 2);
      marks.push({
        first,
        last,
        start: words[first].start,
        end: words[last].end,
        text: words
          .slice(first, last + 1)
          .map((w) => w.text)
          .join(" "),
        rule,
        at,
      });
    }
  }
  return {
    marks: marks.sort((a, b) => a.start - b.start),
    reliable: true,
    status: "reviewed",
    marked,
    places: needing,
    heard,
    read: read.length,
    kept: points.length,
    hearing,
    strengths,
  };
}
