import type { Finding, Suggestion, Take, Word } from "./review.ts";

type Phrase = { direction: Suggestion["direction"]; from: number; to: number };
type Placed = {
  ruleId: string;
  from: number;
  to: number;
  suggestions: Phrase[];
};

/** What `demo.create` is told about a passage; notes and their phrases are placed by word position. */
export type DemoPassage = { words: string[]; notes: Placed[] };

/** One thing to hear: a passage, and the notes it answers. Notes close together share one. */
export type Demo = { id: string; noteIds: string[]; passage: DemoPassage };

// Words are matched by where they start, as the review page marks them.
const within = (word: Word, span: [number, number]) =>
  word.start >= span[0] - 0.02 && word.start < span[1] - 0.01;

const SENTENCE_END = /[.!?…]["'”’)\]]*$/;
/** Notes on the same or neighbouring sentences are said in one demo, up to this many words. */
const MERGE_WORDS = 90;
/** The speech model takes this many notes on one passage. */
const MAX_NOTES = 24;
/** A pause the note names only by the words after it: the silence ending where they begin. */
const PAUSE_BEFORE: Record<string, Phrase["direction"]> = {
  PAUSE_UNNECESSARY: "no_pause_after",
  PAUSE_TOO_LONG: "shorten_pause_after",
};
const AFTER_WORD = /pause_after$/;

/**
 * What to say for each note to work on. A phrase alone is hard to judge, so a demo says the
 * whole sentences its notes touch, with one sentence before and after for context, and
 * fixes everything flagged in what it says. Notes on the same or neighbouring sentences
 * share one demo, so a heavily marked passage is made once. At most `limit` words each.
 */
export function planDemos(
  take: Take,
  findings: Finding[],
  limit: number,
): Demo[] {
  const words = take.segments.flatMap((s) => s.words);
  // The last word of each sentence. Lines are no guide: a line also breaks at a pause
  // and when it grows long, in the middle of a sentence.
  const ends = words.flatMap((word, i) =>
    SENTENCE_END.test(word.text) || i === words.length - 1 ? [i] : [],
  );
  const sentenceOf = (index: number) => ends.findIndex((end) => end >= index);
  const startOf = (sentence: number) =>
    sentence > 0 ? ends[sentence - 1] + 1 : 0;

  const placed = findings
    .filter((f) => f.kind === "improvement")
    .flatMap((note): (Placed & { id: string })[] => {
      const segment = take.segments.find((s) => s.id === note.segmentId);
      const covered = (index: number) =>
        note.span
          ? within(words[index], note.span)
          : !!segment?.words.includes(words[index]);
      const first = words.findIndex((_, i) => covered(i));
      if (first < 0) return [];
      const last = words.findLastIndex((_, i) => covered(i));
      const suggestions = (note.suggestions ?? []).flatMap((s): Phrase[] => {
        const from = words.findIndex((w) => within(w, s.span));
        const to = words.findLastIndex((w) => within(w, s.span));
        return from < 0 ? [] : [{ direction: s.direction, from, to }];
      });
      const before = PAUSE_BEFORE[note.ruleId];
      if (
        before &&
        !suggestions.length &&
        first > 0 &&
        take.pauses.some((p) => Math.abs(p.end - words[first].start) < 0.15)
      )
        suggestions.push({ direction: before, from: first - 1, to: first - 1 });
      return [
        {
          id: note.id,
          ruleId: note.ruleId,
          // A pause sits between two words, so its note reaches the word after it.
          from: Math.min(first, ...suggestions.map((s) => s.from)),
          to: Math.max(
            last,
            ...suggestions.map((s) =>
              Math.min(
                s.to + (AFTER_WORD.test(s.direction) ? 1 : 0),
                words.length - 1,
              ),
            ),
          ),
          suggestions,
        },
      ];
    })
    .sort((a, b) => a.from - b.from);

  /** The sentences a demo's notes touch, and the words those notes cover. */
  type Group = {
    ids: string[];
    first: number;
    last: number;
    from: number;
    to: number;
  };
  const groups: Group[] = [];
  for (const note of placed) {
    const first = sentenceOf(note.from);
    const last = sentenceOf(note.to);
    const open = groups[groups.length - 1];
    if (
      open &&
      first <= open.last + 1 &&
      ends[Math.max(open.last, last)] - startOf(open.first) < MERGE_WORDS
    ) {
      open.ids.push(note.id);
      open.last = Math.max(open.last, last);
      open.to = Math.max(open.to, note.to);
    } else
      groups.push({
        ids: [note.id],
        first,
        last,
        from: note.from,
        to: note.to,
      });
  }

  return groups.map(({ ids, first, last, ...noted }) => {
    // Context gives way before the noted sentences do.
    let from = startOf(Math.max(0, first - 1));
    let to = ends[Math.min(ends.length - 1, last + 1)];
    if (to - from >= limit) to = ends[last];
    if (to - from >= limit) from = startOf(first);
    if (to - from >= limit) {
      // Sentences too long to say whole, as in a transcript without full stops: the
      // noted words are said with as much around them as fits, from where they begin
      // when they are too many themselves.
      const spare = Math.max(0, limit - (noted.to - noted.from + 1));
      from = Math.max(from, noted.from - Math.floor(spare / 2));
      to = Math.min(to, from + limit - 1);
      from = Math.max(startOf(first), Math.min(from, to - limit + 1));
    }
    const inside = (a: number, b: number) => a >= from && b <= to;
    return {
      id: `demo-${from}-${to}`,
      noteIds: ids,
      passage: {
        words: words.slice(from, to + 1).map((w) => w.text),
        // Everything flagged in what is said is fixed, whichever demo the note belongs to.
        notes: placed
          .filter((note) => note.from <= to && note.to >= from)
          .slice(0, MAX_NOTES)
          .map((note) => ({
            ruleId: note.ruleId,
            from: Math.max(note.from, from) - from,
            to: Math.min(note.to, to) - from,
            suggestions: note.suggestions
              .filter((s) => inside(s.from, s.to))
              .map((s) => ({ ...s, from: s.from - from, to: s.to - from })),
          })),
      },
    };
  });
}

/** The rules whose passages show the voice at its liveliest. */
const LIVELY = ["TONE_EXPRESSIVE", "PITCH_MELODY"];

/**
 * The stretch of the take to learn the speaker's voice from: the `seconds` holding
 * the most speech. A cloned voice keeps the delivery of its sample, so speech the
 * review found expressive or melodic counts double.
 */
export function sampleSpan(
  take: Take,
  findings: Finding[],
  seconds = 20,
): { start: number; end: number; text: string } | undefined {
  const words = take.segments.flatMap((s) => s.words);
  if (!words.length) return undefined;
  const lively = findings.flatMap((f) =>
    f.kind === "strength" && LIVELY.includes(f.ruleId) && f.span
      ? [f.span]
      : [],
  );
  const worth = words.map(
    (w) =>
      Math.max(0, w.end - w.start) *
      (lively.some((span) => within(w, span)) ? 2 : 1),
  );
  let best = { from: 0, to: 0, score: -1 };
  let score = 0;
  for (let from = 0, to = 0; to < words.length; to++) {
    score += worth[to];
    while (words[to].end - words[from].start > seconds && from < to)
      score -= worth[from++];
    if (score > best.score) best = { from, to, score };
  }
  const picked = words.slice(best.from, best.to + 1);
  return {
    start: Math.max(0, picked[0].start - 0.1),
    end: Math.min(
      take.duration,
      Math.min(picked[picked.length - 1].end, picked[0].start + seconds) + 0.1,
    ),
    text: picked.map((w) => w.text).join(" "),
  };
}

/** Mono 16-bit WAV of `samples`. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (at: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, s)) * 32767),
      true,
    ),
  );
  return new Blob([view], { type: "audio/wav" });
}

/** A sample of the speaker's voice cut from the take, with the words it says. */
export async function voiceSample(
  audio: Blob,
  take: Take,
  findings: Finding[],
): Promise<{ wav: Blob; text: string }> {
  const span = sampleSpan(take, findings);
  if (!span) throw new Error("No speech to learn the voice from");
  // 24 kHz keeps the voice and the upload small; decoding resamples to the context's rate.
  const context = new AudioContext({ sampleRate: 24000 });
  try {
    const buffer = await context.decodeAudioData(await audio.arrayBuffer());
    const samples = buffer
      .getChannelData(0)
      .subarray(
        Math.floor(span.start * buffer.sampleRate),
        Math.ceil(span.end * buffer.sampleRate),
      );
    return { wav: encodeWav(samples, buffer.sampleRate), text: span.text };
  } finally {
    void context.close();
  }
}
