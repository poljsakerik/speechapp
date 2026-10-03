/** Descriptive pace measurements. Silence is an observation, never a pause-coaching verdict. */
import type { Pause } from "./pauses.ts";
import { syllables } from "./syllables.ts";
import type { Word } from "./types.ts";

type TimedWord = Word & { start: number; end: number };
/** Pace rates are syllables per second. */
export type PacePoint = {
  time: number;
  speakingRate: number;
  articulationRate: number | null;
  paused: boolean;
};
export type PaceProfile = { curve: PacePoint[]; pauses: Pause[] };

export function mergePauses(pauses: Pause[]): Pause[] {
  const merged: Pause[] = [];
  for (const p of pauses
    .filter(
      (p) =>
        Number.isFinite(p.start) && Number.isFinite(p.end) && p.end > p.start,
    )
    .sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && p.start <= previous.end)
      previous.end = Math.max(previous.end, p.end);
    else merged.push({ ...p });
  }
  return merged;
}
export function silenceBetween(
  start: number,
  end: number,
  pauses: Pause[],
): number {
  return pauses.reduce(
    (s, p) => s + Math.max(0, Math.min(end, p.end) - Math.max(start, p.start)),
    0,
  );
}

/** Six-second rolling syllables/second, for display alongside the silences. */
export function measurePace(
  words: Word[],
  measured: Pause[] = [],
): PaceProfile {
  const empty = { curve: [], pauses: [] };
  if (
    !words.length ||
    words.some(
      (w, i) =>
        !Number.isFinite(w.start) ||
        !Number.isFinite(w.end) ||
        w.start! < 0 ||
        w.end! <= w.start! ||
        (i && w.start! < words[i - 1].start!),
    )
  )
    return empty;
  const ws = (words as TimedWord[]).map((w) => ({
    ...w,
    syllables: syllables(w.text),
  }));
  const silence = mergePauses([
    ...measured,
    ...ws
      .slice(1)
      .flatMap((w, i) =>
        w.start - ws[i].end >= 0.3 ? [{ start: ws[i].end, end: w.start }] : [],
      ),
  ]);
  const curve: PacePoint[] = [];
  const start = ws[0].start,
    end = ws.at(-1)!.end;
  for (let time = start; time <= end + 0.001; time += 0.5) {
    const left = Math.max(start, time - 3),
      right = Math.min(end, time + 3);
    const paused = silence.some((p) => p.start <= time && p.end > time);
    let mass = 0,
      wordMass = 0;
    for (const w of ws) {
      if (w.start >= right) break;
      if (w.end <= left) continue;
      // Spread each word’s syllables across its active duration, excluding measured silence.
      const activeWord =
        w.end - w.start - silenceBetween(w.start, w.end, silence);
      if (activeWord <= 0.01) continue;
      const a = Math.max(w.start, left),
        b = Math.min(w.end, right);
      const fraction =
        Math.max(0, b - a - silenceBetween(a, b, silence)) / activeWord;
      mass += w.syllables * fraction;
      wordMass += fraction;
    }
    const active = right - left - silenceBetween(left, right, silence);
    curve.push({
      time,
      speakingRate: mass / (right - left),
      articulationRate:
        paused || active < 1 || wordMass < 3 ? null : mass / active,
      paused,
    });
  }
  return { curve, pauses: silence };
}
