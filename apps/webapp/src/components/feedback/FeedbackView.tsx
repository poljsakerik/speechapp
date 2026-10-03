import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CornerDownRightIcon,
  LoaderCircleIcon,
  LocateFixedIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  FOUNDATIONS,
  FOUNDATION_BY_KEY,
  VERDICT_LABEL,
  type FoundationKey,
} from "@/lib/foundations";
import {
  emptyReviewMessage,
  formatTime,
  type Finding,
  type Review,
  type Segment,
  type Suggestion,
  type Take,
  type Word,
} from "@/lib/review";
import { cn } from "@micmane/ui/lib/utils";
import { useVoiceDemo, type VoiceDemoStatus } from "./useVoiceDemo";

type FeedbackViewProps = {
  take: Take;
  review: Review;
  audioSrc: string;
  /** Offer each passage to work on said the way its note asks, in the speaker's own voice. */
  voiceDemo?: boolean;
  /** Shown at the end of the transport, e.g. a button to upload another take. */
  action?: ReactNode;
  /** Shown under the page. */
  footer?: ReactNode;
  className?: string;
};

/** What each rule is called in a note. */
export const RULES: Record<string, { label: string }> = {
  RATE_IMPORTANCE_FAST: { label: "Rushed passage" },
  RATE_IMPORTANCE_SLOW: { label: "Dragged passage" },
  RATE_CONTRAST: { label: "Flat pacing" },
  PAUSE_NECESSARY: { label: "Missing pause" },
  PAUSE_TOO_SHORT: { label: "Pause too short" },
  PAUSE_UNNECESSARY: { label: "Pause out of place" },
  PAUSE_TOO_LONG: { label: "Pause too long" },
  VOLUME_LOW: { label: "Volume drop" },
  VOLUME_FADE: { label: "Trailing off" },
  TONE_FLAT: { label: "Flat voice" },
  PITCH_VARIETY: { label: "Monotone stretch" },
  PITCH_HIGH: { label: "Stuck high" },
  PITCH_LOW: { label: "Stuck low" },
  RATE_SLOWS_FOR_POINT: { label: "Slows down for the point" },
  PAUSE_LETS_IT_LAND: { label: "Pause that lets it land" },
  PAUSE_BUILDS_ANTICIPATION: { label: "Pause that builds anticipation" },
  TONE_EXPRESSIVE: { label: "Expressive voice" },
  PITCH_MELODY: { label: "Melodic stretch" },
};

const SUGGESTION_LABELS: Record<Suggestion["direction"], string> = {
  slow_down: "Slow down on",
  speed_up: "Speed up through",
  pause_after: "Pause after",
  lengthen_pause_after: "Hold the pause longer after",
  no_pause_after: "Don’t stop after",
  shorten_pause_after: "Shorten the pause after",
};

const SPEEDS = [0.75, 1, 1.25, 1.5];
const SHELL = "mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10";
/** Timecode, then the line with its notes beneath. Every row of the sheet shares it. */
const ROW =
  "grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6 lg:gap-x-10";
/** Where the playhead holds while the page follows it, as a share of the viewport. */
const READING_LINE = 0.42;

// Words are matched by where they start: the recognizer sometimes stretches a word's end over the next one.
const within = (word: Word, span: [number, number]) =>
  word.start >= span[0] - 0.02 && word.start < span[1] - 0.01;
/** The silence between two lines, as space alone: 8px steps, longer pauses breathe more. */
const breath = (seconds: number) =>
  8 * Math.round(2 + Math.min(seconds, 4) * 6);
const passage = (f: Finding): [number, number] => f.span ?? [f.at, f.at + 2];

type Lens = "all" | FoundationKey;

/** A note covering more than one line: the lines it runs from and to, and its lane in the margin. */
type Rail = { note: Finding; first: number; last: number; lane: number };

type Row = { id: string; start: number; end: number; segment?: Segment };

/**
 * A reviewed take as one long page: each line with its timecode, silences as space,
 * and its notes listed under it. One note is in focus at a time, and the page can
 * show a single foundation's notes. The transport's scrubber is the timeline; while
 * the take plays, the page follows the playhead.
 */
export function FeedbackView({
  take,
  review,
  audioSrc,
  voiceDemo = false,
  action,
  footer,
  className,
}: FeedbackViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  /** The line a note was picked on, so it opens there even when it began on an earlier line. */
  const [selectedAt, setSelectedAt] = useState<string | null>(null);

  const allFindings = useMemo(
    () => [...review.findings].sort((a, b) => a.at - b.at),
    [review.findings],
  );
  // The page shows every note with one in focus, or one foundation's notes on their own.
  const [lens, setLens] = useState<Lens>("all");
  // And either everything, only what to work on, or only what already works.
  const [kind, setKind] = useState<"all" | Finding["kind"]>("all");
  const ofKind = useMemo(
    () =>
      kind === "all" ? allFindings : allFindings.filter((f) => f.kind === kind),
    [allFindings, kind],
  );
  const findings = useMemo(
    () =>
      lens === "all" ? ofKind : ofKind.filter((f) => f.foundation === lens),
    [ofKind, lens],
  );
  const strengths = allFindings.filter((f) => f.kind === "strength").length;
  const toWorkOn = allFindings.length - strengths;
  const rows = useMemo(() => {
    const result: Row[] = [];
    take.segments.forEach((segment, i) => {
      result.push({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        segment,
      });
      const next = take.segments[i + 1];
      if (next)
        result.push({
          id: `${segment.id}-gap`,
          start: segment.end,
          end: next.start,
        });
    });
    return result;
  }, [take.segments]);

  // The note being heard wins over the one last picked.
  const live = playing
    ? findings.find(
        (f) => time >= passage(f)[0] - 0.2 && time <= passage(f)[1] + 0.6,
      )?.id
    : undefined;
  const activeId =
    live ?? (findings.some((f) => f.id === selected) ? selected : null);
  // Hovering a note previews its words without opening it.
  const markId = hovered ?? activeId;
  const focusAt = activeId === selected ? selectedAt : null;
  const noteIndex = findings.findIndex((f) => f.id === activeId);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
          audio.pause();
          stopAt.current = null;
        }
        setTime(audio.currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // The take and a demo are never heard together: starting one stops the other.
  const pauseTake = useCallback(() => {
    stopAt.current = null;
    audioRef.current?.pause();
  }, []);
  const demo = useVoiceDemo(audioSrc, take, allFindings, pauseTake);
  const stopDemo = demo.stop;

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    stopDemo();
    setStarted(true);
    await audio.play().catch(() => setPlaying(false));
  }, [stopDemo]);

  const seek = useCallback(
    (t: number) => {
      const next = Math.min(Math.max(t, 0), take.duration);
      stopAt.current = null;
      if (audioRef.current) audioRef.current.currentTime = next;
      setTime(next);
      setStarted(true);
    },
    [take.duration],
  );

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) return audio.pause();
    stopAt.current = null;
    if (audio.ended || audio.currentTime >= take.duration - 0.05)
      audio.currentTime = 0;
    setFollow(true);
    await play();
  }, [take.duration, play]);

  /** Play one passage with a little air on either side, then stop. */
  const playSpan = useCallback(
    (span: [number, number]) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, span[0] - 0.3);
      setTime(audio.currentTime);
      stopAt.current = Math.min(take.duration, span[1] + 0.3);
      void play();
    },
    [take.duration, play],
  );

  const playNote = useCallback(
    (f: Finding, at?: string) => {
      setSelected(f.id);
      setSelectedAt(at ?? null);
      playSpan(passage(f));
    },
    [playSpan],
  );

  /** Open a note where it was pressed, without playing it; pressing the open note closes it. */
  const openNote = useCallback(
    (f: Finding, at?: string) => {
      const here = at ?? f.segmentId;
      const isOpen = selected === f.id && (selectedAt ?? f.segmentId) === here;
      setSelected(isOpen ? null : f.id);
      setSelectedAt(isOpen ? null : here);
    },
    [selected, selectedAt],
  );

  /** Step to the next or previous note in take order and bring it into view. */
  const step = useCallback(
    (by: 1 | -1) => {
      if (!findings.length) return;
      const from = noteIndex < 0 ? (by > 0 ? -1 : findings.length) : noteIndex;
      const note = findings[(from + by + findings.length) % findings.length];
      setSelected(note.id);
      setSelectedAt(null);
      setFollow(false);
      // The note opens on the next paint; bring it into view once it has.
      requestAnimationFrame(() =>
        document.querySelector(`[data-note="${note.id}"]`)?.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        }),
      );
    },
    [findings, noteIndex],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, select")
      )
        return;
      if (event.key === "j" || event.key === "k")
        return step(event.key === "j" ? 1 : -1);
      if (
        event.key !== " " ||
        target.closest("button, a, [role=button], [role=slider]")
      )
        return;
      event.preventDefault();
      void toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, step]);

  // Scrolling by hand releases the page from the playhead; Follow brings it back.
  useEffect(() => {
    if (!playing || !follow) return;
    const release = () => setFollow(false);
    const onKey = (event: KeyboardEvent) => {
      if (
        ["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) &&
        !(event.target as HTMLElement).closest("[role=slider]")
      )
        release();
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
    };
  }, [playing, follow]);

  // The page follows the playhead, easing it towards the reading line; under reduced motion it jumps line by line.
  const currentRow = rows.findIndex((r) => time >= r.start && time < r.end);
  const lastRow = useRef(-1);
  useEffect(() => {
    if (!playing || !follow || currentRow < 0) return;
    const row = rows[currentRow];
    const el = rowRefs.current.get(row.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      if (lastRow.current !== currentRow)
        window.scrollBy({
          top: rect.top - window.innerHeight * READING_LINE,
          behavior: "instant",
        });
    } else {
      const y =
        rect.top + ((time - row.start) / (row.end - row.start)) * rect.height;
      const delta = y - window.innerHeight * READING_LINE;
      if (Math.abs(delta) > 1)
        window.scrollBy({ top: delta * 0.12, behavior: "instant" });
    }
    lastRow.current = currentRow;
  }, [time, playing, follow, currentRow, rows]);

  // A note that runs over several lines is written once, where it begins, and a bar in the
  // margin runs beside every line it covers. Bars that overlap sit side by side in lanes.
  const rails = useMemo(() => {
    const long: Rail[] = findings.flatMap((note) => {
      if (!note.span) return [];
      const covered = take.segments.flatMap((sg, i) =>
        sg.words.some((w) => within(w, note.span!)) ? [i] : [],
      );
      return covered.length > 1
        ? [
            {
              note,
              first: covered[0],
              last: covered[covered.length - 1],
              lane: 0,
            },
          ]
        : [];
    });
    const ends: number[] = [];
    for (const rail of long) {
      const free = ends.findIndex((end) => end < rail.first);
      rail.lane = free < 0 ? ends.length : free;
      ends[rail.lane] = rail.last;
    }
    return long;
  }, [take.segments, findings]);

  const pct = (t: number) =>
    `${(Math.min(Math.max(t, 0), take.duration) / take.duration) * 100}%`;
  const lines = take.segments.length;
  const unreviewed = FOUNDATIONS.filter((f) => {
    const a = review.assessments.find((x) => x.foundation === f.key);
    return !a || a.verdict === "uncertain";
  });

  return (
    <div className={className}>
      {/* Transport */}
      <div className="sticky top-0 z-20 bg-graphite text-on-graphite">
        <div
          className={cn(
            SHELL,
            "grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto_auto]",
          )}
        >
          <button
            type="button"
            onClick={() => void toggle()}
            aria-label={playing ? "Pause" : "Play"}
            className={cn(
              "grid size-10 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-(--ease-out) active:scale-95",
              "glass-lit text-graphite-deep hover:bg-glass-hot",
            )}
          >
            {playing ? (
              <PauseIcon className="size-4 fill-current" />
            ) : (
              <PlayIcon className="size-4 translate-x-px fill-current" />
            )}
          </button>
          <p className="font-mono text-[0.75rem] text-on-graphite-muted tabular sm:min-w-[9rem]">
            <span className="text-on-graphite">{formatTime(time)}</span> /{" "}
            {formatTime(take.duration, false)}
          </p>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Position in take"
            aria-valuemin={0}
            aria-valuemax={Math.round(take.duration)}
            aria-valuenow={Math.round(time)}
            aria-valuetext={formatTime(time, false)}
            className="relative h-8 cursor-pointer rounded-sm"
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              seek(((event.clientX - rect.left) / rect.width) * take.duration);
            }}
            onKeyDown={(event) => {
              const to = {
                ArrowLeft: time - 5,
                ArrowRight: time + 5,
                Home: 0,
                End: take.duration,
              }[event.key];
              if (to === undefined) return;
              event.preventDefault();
              seek(to);
            }}
          >
            <div className="absolute inset-x-0 top-[15px] h-0.5 rounded-full bg-graphite-line" />
            <div
              className="absolute top-[15px] left-0 h-0.5 rounded-full bg-on-graphite-muted"
              style={{ width: pct(time) }}
            />
            {findings.map((f) => {
              const [from, to] = passage(f);
              const foundation = FOUNDATION_BY_KEY[f.foundation];
              return (
                <button
                  key={f.id}
                  type="button"
                  tabIndex={-1}
                  aria-label={`${RULES[f.ruleId]?.label ?? foundation.label} at ${formatTime(from, false)}`}
                  className={cn(
                    "absolute top-1.5 h-5 min-w-1 rounded-[2px] transition-opacity duration-200",
                    f.id === activeId
                      ? "opacity-100"
                      : "opacity-45 hover:opacity-80",
                  )}
                  style={{
                    left: pct(from),
                    width: pct(to - from),
                    // Filled for a strength, open for something to work on, as the pins are.
                    background:
                      f.kind === "strength" ? foundation.fill : undefined,
                    boxShadow: `inset 0 0 0 1.5px ${foundation.fill}`,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => playNote(f)}
                />
              );
            })}
            {started && (
              <div
                className={cn(
                  "pointer-events-none absolute top-1 h-6 w-0.5 -translate-x-1/2 rounded-full",
                  playing ? "bg-glass" : "bg-on-graphite",
                )}
                style={{ left: pct(time) }}
              />
            )}
          </div>
          {action && <div className="sm:order-last sm:ml-2">{action}</div>}
          <div className="col-span-4 flex items-center justify-between gap-x-3 sm:contents">
            <div
              className="flex gap-0.5"
              role="group"
              aria-label="Playback speed"
            >
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => {
                    setSpeed(s);
                    if (audioRef.current) audioRef.current.playbackRate = s;
                  }}
                  className="h-8 rounded-sm px-1.5 font-mono text-[0.6875rem] text-on-graphite-muted transition-colors hover:text-on-graphite aria-pressed:bg-graphite-line aria-pressed:text-on-graphite sm:h-6"
                >
                  {s}×
                </button>
              ))}
            </div>
            {findings.length > 0 && (
              <div
                className="flex items-center"
                role="group"
                aria-label="Notes"
                aria-keyshortcuts="j k"
              >
                <button
                  type="button"
                  aria-label="Previous note (K)"
                  onClick={() => step(-1)}
                  className={STEP}
                >
                  <ChevronLeftIcon className="size-3.5" />
                </button>
                <span className="min-w-[4rem] text-center text-[0.75rem] text-on-graphite-muted">
                  {noteIndex < 0 ? (
                    <>
                      <span className="font-mono tabular">
                        {findings.length}
                      </span>{" "}
                      {findings.length === 1 ? "note" : "notes"}
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-on-graphite tabular">
                        {noteIndex + 1}
                      </span>{" "}
                      of{" "}
                      <span className="font-mono tabular">
                        {findings.length}
                      </span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  aria-label="Next note (J)"
                  onClick={() => step(1)}
                  className={STEP}
                >
                  <ChevronRightIcon className="size-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFollow(true)}
              aria-pressed={follow}
              aria-label="Follow the playhead"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-sm px-2 text-[0.75rem] font-medium transition-colors sm:h-7",
                follow
                  ? "text-on-graphite-muted"
                  : "bg-graphite-line text-on-graphite hover:bg-[color-mix(in_oklch,var(--graphite-line),white_8%)]",
              )}
            >
              <LocateFixedIcon className="size-3.5" />
              <span className="max-sm:hidden">
                {follow ? "Following" : "Follow"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={cn(SHELL, "pt-12 pb-24 sm:pt-16 lg:pb-36")}>
        {/* What was reviewed */}
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-5">
            <h1 className="font-wide text-[clamp(2rem,3.4vw,3.25rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance">
              Notes on your take
            </h1>
            <p className="mt-4 text-[0.8125rem] leading-5 text-ink-3 [&>span]:font-mono [&>span]:text-[0.75rem] [&>span]:tabular">
              <span>{formatTime(take.duration, false)}</span> ·{" "}
              <span>{lines}</span> {lines === 1 ? "line" : "lines"} ·{" "}
              <span>{toWorkOn}</span> to work on · <span>{strengths}</span>{" "}
              {strengths === 1 ? "strength" : "strengths"}
            </p>
            {!allFindings.length && (
              <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-7 text-ink-2">
                {emptyReviewMessage(review.assessments)}
              </p>
            )}
          </div>
          <ul
            className="grid content-start gap-5 lg:col-span-7 lg:col-start-6"
            aria-label="Foundations"
          >
            {FOUNDATIONS.map((f) => {
              const assessment = review.assessments.find(
                (a) => a.foundation === f.key,
              );
              const reviewed =
                !!assessment && assessment.verdict !== "uncertain";
              const notes = allFindings.filter((n) => n.foundation === f.key);
              return (
                <li
                  key={f.key}
                  className={cn(
                    "grid grid-cols-[0.625rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[0.625rem_9.5rem_minmax(0,1fr)_10rem] sm:gap-x-4",
                    !reviewed && unreviewed.length > 1 && "max-sm:hidden",
                  )}
                >
                  <Swatch
                    foundation={f}
                    reviewed={reviewed}
                    working={assessment?.verdict === "effective"}
                  />
                  <p
                    className={cn(
                      "text-[0.875rem] leading-5 font-semibold",
                      reviewed ? "text-ink" : "text-ink-3",
                    )}
                  >
                    {f.label}
                  </p>
                  <p className="col-start-2 text-[0.8125rem] leading-5 sm:col-start-3">
                    {reviewed ? (
                      <>
                        <span
                          className="font-semibold"
                          style={{ color: f.ink }}
                        >
                          {VERDICT_LABEL[assessment.verdict]}
                        </span>
                        <span className="text-ink-2">
                          {" "}
                          · {assessment.summary}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-3">
                        {notReviewed(assessment?.summary)}
                      </span>
                    )}
                  </p>
                  {/* Where this foundation's notes fall in the take. */}
                  {reviewed && (
                    <div
                      aria-hidden="true"
                      className="relative col-start-2 mt-2 h-2.5 rounded-[2px] bg-sunken sm:col-start-4 sm:mt-[5px]"
                    >
                      {notes.map((n) => {
                        const [from, to] = passage(n);
                        return (
                          <span
                            key={n.id}
                            className="absolute inset-y-0 min-w-[3px] rounded-[2px]"
                            style={{
                              left: pct(from),
                              width: pct(to - from),
                              // Filled for a strength, open for something to work on, as the pins are.
                              background:
                                n.kind === "strength"
                                  ? f.fill
                                  : "var(--surface)",
                              boxShadow: `inset 0 0 0 1px ${f.ink}`,
                            }}
                          />
                        );
                      })}
                      {started && (
                        <span
                          className={cn(
                            "absolute -inset-y-1 w-0.5 rounded-full",
                            playing ? "bg-glass" : "bg-ink-3",
                          )}
                          style={{ left: pct(time) }}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {/* On phones the foundations that couldn't be judged share one row, so the page starts sooner. */}
            {unreviewed.length > 1 && (
              <li className="grid grid-cols-[0.625rem_minmax(0,1fr)] gap-x-3 sm:hidden">
                <Swatch reviewed={false} />
                <p className="text-[0.875rem] leading-5 font-semibold text-ink-3">
                  {unreviewed.map((f) => f.label).join(", ")}
                </p>
                <p className="col-start-2 text-[0.8125rem] leading-5 text-ink-3">
                  Not enough evidence to judge on this take
                </p>
              </li>
            )}
          </ul>
        </div>

        {/* The tape */}
        <div className="booklet-page mt-12 px-3 py-8 sm:px-8 sm:py-10 lg:mt-16 xl:px-12">
          {allFindings.length > 0 && (
            <div
              role="group"
              aria-label="Notes to show"
              className="mb-10 flex flex-wrap items-center gap-2"
            >
              <LensButton
                pressed={kind === "all"}
                onClick={() => setKind("all")}
                count={allFindings.length}
              >
                All notes
              </LensButton>
              <LensButton
                pressed={kind === "improvement"}
                onClick={() => setKind("improvement")}
                count={toWorkOn}
                mark="improvement"
              >
                To work on
              </LensButton>
              <LensButton
                pressed={kind === "strength"}
                onClick={() => setKind("strength")}
                count={strengths}
                mark="strength"
              >
                Strengths
              </LensButton>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
              {FOUNDATIONS.map((f) => {
                const count = ofKind.filter(
                  (n) => n.foundation === f.key,
                ).length;
                return (
                  <LensButton
                    key={f.key}
                    pressed={lens === f.key}
                    // Pressing the foundation in view again shows every foundation.
                    onClick={() => setLens(lens === f.key ? "all" : f.key)}
                    count={count}
                    foundation={f}
                  >
                    {f.short}
                  </LensButton>
                );
              })}
            </div>
          )}
          <ol aria-label="Transcript of the take, with notes">
            {rows.map((row, r) =>
              row.segment ? (
                <Line
                  key={row.id}
                  ref={(el) =>
                    void (el
                      ? rowRefs.current.set(row.id, el)
                      : rowRefs.current.delete(row.id))
                  }
                  take={take}
                  segment={row.segment}
                  findings={findings}
                  rails={rails.filter(
                    (rail) => rail.first <= r / 2 && rail.last >= r / 2,
                  )}
                  index={r / 2}
                  time={time}
                  playing={playing}
                  lens={lens}
                  focusId={activeId}
                  focusAt={focusAt}
                  markId={markId}
                  onPlayFrom={(t) => {
                    seek(t);
                    void play();
                  }}
                  onOpenNote={openNote}
                  onPlayNote={playNote}
                  onPlaySpan={playSpan}
                  demo={voiceDemo ? demo.state : undefined}
                  onDemo={(f) => void demo.toggle(f)}
                  onHover={setHovered}
                />
              ) : (
                <li
                  key={row.id}
                  ref={(el) =>
                    void (el
                      ? rowRefs.current.set(row.id, el)
                      : rowRefs.current.delete(row.id))
                  }
                  aria-hidden="true"
                  className={cn(ROW, "relative")}
                  style={{ height: breath(row.end - row.start) }}
                >
                  {/* The bars carry on through the silence between two lines of the same note. */}
                  <Rails
                    rails={rails.filter(
                      (rail) =>
                        rail.first <= (r - 1) / 2 && rail.last > (r - 1) / 2,
                    )}
                    index={-1}
                    lens={lens}
                    markId={markId}
                  />
                </li>
              ),
            )}
          </ol>
        </div>
        {footer && <div className="mt-4">{footer}</div>}
      </div>

      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onSeeked={(event) => setTime(event.currentTarget.currentTime)}
      />
    </div>
  );
}

/** A foundation's own reason it could not be judged on this take, or a plain one. */
const notReviewed = (summary?: string) =>
  summary && !/not been analy[sz]ed/.test(summary)
    ? summary
    : "Not enough evidence to judge on this take";

function Swatch({
  foundation,
  reviewed,
  working = false,
}: {
  foundation?: (typeof FOUNDATIONS)[number];
  reviewed: boolean;
  /** Filled when the foundation is working as it is, open when there is something to work on. */
  working?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[5px] size-2.5 rounded-[2px]",
        !reviewed && "border border-dashed border-line-strong",
      )}
      style={
        reviewed && foundation
          ? {
              background: working ? foundation.fill : "var(--surface)",
              boxShadow: `inset 0 0 0 ${working ? 1 : 1.5}px ${foundation.ink}`,
            }
          : undefined
      }
    />
  );
}

const STEP =
  "grid size-8 place-items-center rounded-sm text-on-graphite-muted transition-colors hover:bg-graphite-line hover:text-on-graphite sm:size-6";

function LensButton({
  pressed,
  onClick,
  count,
  foundation,
  mark,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  count: number;
  foundation?: (typeof FOUNDATIONS)[number];
  /** The mark this kind of note leaves on the words: a band for a strength, a line for something to work on. */
  mark?: Finding["kind"];
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      // A pressed chip stays live at zero, so it can always be released.
      disabled={!count && !pressed}
      onClick={onClick}
      className="flex h-8 items-center gap-2 rounded-[3px] px-2.5 text-[0.8125rem] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:text-ink-3 disabled:opacity-60 disabled:shadow-[inset_0_0_0_1px_var(--line)] aria-pressed:bg-ink aria-pressed:text-paper aria-pressed:shadow-none"
    >
      {mark && (
        <span
          aria-hidden="true"
          className={cn(
            "w-3.5 rounded-[1px] bg-current",
            mark === "strength" ? "h-2.5 opacity-25" : "h-0.5 self-end mb-2",
          )}
        />
      )}
      {foundation && (
        <span
          aria-hidden="true"
          className="size-2.5 rounded-[2px]"
          style={{
            background: count ? foundation.fill : "transparent",
            boxShadow: `inset 0 0 0 1px ${count ? foundation.ink : "var(--line-strong)"}`,
          }}
        />
      )}
      {children}
      <span className="font-mono text-[0.6875rem] tabular opacity-70">
        {count}
      </span>
    </button>
  );
}

type LineProps = {
  ref: (el: HTMLLIElement | null) => void;
  take: Take;
  segment: Segment;
  /** The notes in view: all of them, or one foundation's. */
  findings: Finding[];
  /** The several-line notes passing through this line. */
  rails: Rail[];
  /** This line's place among the lines. */
  index: number;
  lens: Lens;
  time: number;
  playing: boolean;
  /** The note that is open. */
  focusId: string | null | undefined;
  /** The line the open note was picked on, when it was picked on one. */
  focusAt: string | null;
  /** The note whose words are coloured: the open one, or one being hovered. */
  markId: string | null | undefined;
  onPlayFrom: (t: number) => void;
  /** Reading a note and hearing it are separate: opening never starts playback. */
  onOpenNote: (f: Finding, at?: string) => void;
  onPlayNote: (f: Finding, at?: string) => void;
  onPlaySpan: (span: [number, number]) => void;
  /** The demo being made or heard, or null when none is; undefined when demos are not offered. */
  demo?: { noteIds: string[]; status: VoiceDemoStatus } | null;
  onDemo: (f: Finding) => void;
  onHover: (id: string | null) => void;
};

/** Consecutive words marked by the same set of notes. */
type Run = { findings: Finding[]; words: Word[] };

function Line({
  ref,
  take,
  segment,
  findings,
  rails,
  index,
  lens,
  time,
  playing,
  focusId,
  focusAt,
  markId,
  onPlayFrom,
  onOpenNote,
  onPlayNote,
  onPlaySpan,
  demo,
  onDemo,
  onHover,
}: LineProps) {
  const current = playing && time >= segment.start && time < segment.end;
  // A note is written once, under the line it begins on. A note from an earlier line shows
  // here only while it is open and was picked on this line.
  const notes = findings.filter(
    (f) =>
      f.segmentId === segment.id ||
      (f.id === focusId &&
        focusAt === segment.id &&
        rails.some((rail) => rail.note === f)),
  );

  const runs = useMemo(() => {
    const result: Run[] = [];
    for (const word of segment.words) {
      const marks = findings.filter((f) =>
        f.span ? within(word, f.span) : f.segmentId === segment.id,
      );
      const last = result[result.length - 1];
      if (
        last &&
        last.findings.length === marks.length &&
        last.findings.every((f, i) => f === marks[i])
      )
        last.words.push(word);
      else result.push({ findings: marks, words: [word] });
    }
    return result;
  }, [segment, findings]);

  const pauses = take.pauses.filter(
    (p) =>
      p.start >= segment.start - 0.05 &&
      p.end <= segment.end + 0.05 &&
      p.end - p.start >= 0.3,
  );
  const words = useMemo(
    () => take.segments.flatMap((sg) => sg.words),
    [take.segments],
  );

  const entry = (note: Finding) => {
    return (
      <Note
        key={note.id}
        note={note}
        quote={quoteOf(note, words)}
        // A note opens on the line it was picked on, or else on the line it begins on.
        open={note.id === focusId && (focusAt ?? note.segmentId) === segment.id}
        marked={note.id === markId}
        onOpen={() => onOpenNote(note, segment.id)}
        onPlay={() => onPlayNote(note, segment.id)}
        onPlaySpan={onPlaySpan}
        // Only something to work on has a better way to be said.
        demo={
          demo !== undefined && note.kind === "improvement"
            ? {
                status: demo?.noteIds.includes(note.id)
                  ? demo.status
                  : undefined,
                onToggle: () => onDemo(note),
              }
            : undefined
        }
        onHover={onHover}
      />
    );
  };

  return (
    <li ref={ref} className={cn(ROW, "relative")}>
      <Rails
        rails={rails}
        index={index}
        lens={lens}
        markId={markId}
        onOpen={(note) => onOpenNote(note, segment.id)}
        onHover={onHover}
      />
      <div className="pt-1 sm:pt-2">
        <button
          type="button"
          onClick={() => onPlayFrom(segment.start)}
          className={cn(
            "rounded-sm font-mono text-[0.75rem] tabular transition-colors hover:text-glass-ink",
            current ? "text-glass-ink" : "text-ink-3",
          )}
          aria-label={`Play from ${formatTime(segment.start)}`}
        >
          {formatTime(segment.start)}
        </button>
      </div>
      <div className="pt-2 pb-8 sm:pb-10">
        <p className="max-w-[40ch] font-wide text-[clamp(1.25rem,1.9vw,1.75rem)] leading-[1.4] font-semibold tracking-[-0.015em] text-pretty">
          {runs.map((run, r) => (
            <Fragment key={r}>
              {r > 0 && " "}
              <Words
                run={run}
                lens={lens}
                time={time}
                current={current}
                pauses={pauses}
                markId={markId}
                onOpen={(f) => onOpenNote(f, segment.id)}
              />
            </Fragment>
          ))}
        </p>
        {notes.length > 0 && (
          <ul className="mt-4 grid max-w-[38rem] gap-1">{notes.map(entry)}</ul>
        )}
      </div>
    </li>
  );
}

/**
 * Margin bars for notes that run over several lines, one lane each. A bar is quiet until
 * its note is in focus, then it takes the foundation's ink. `index` is the line's place,
 * or -1 for the silence between two lines, where the bars only pass through.
 */
function Rails({
  rails,
  index,
  lens,
  markId,
  onOpen,
  onHover,
}: {
  rails: Rail[];
  index: number;
  lens: Lens;
  markId: string | null | undefined;
  onOpen?: (note: Finding) => void;
  onHover?: (id: string | null) => void;
}) {
  if (!rails.length) return null;
  return (
    <div className="absolute inset-y-0 left-[-0.625rem] sm:left-[calc(4.5rem+0.375rem)]">
      {rails.map((rail) => {
        const foundation = FOUNDATION_BY_KEY[rail.note.foundation];
        const focused = rail.note.id === markId;
        const label = RULES[rail.note.ruleId]?.label ?? foundation.label;
        return (
          <button
            key={rail.note.id}
            type="button"
            tabIndex={-1}
            disabled={!onOpen}
            aria-label={`${foundation.short}: ${label}, lines ${rail.first + 1} to ${rail.last + 1}`}
            title={`${foundation.short} · ${label}`}
            onClick={() => onOpen?.(rail.note)}
            onPointerEnter={() => onHover?.(rail.note.id)}
            onPointerLeave={() => onHover?.(null)}
            className={cn(
              "absolute w-[3px] rounded-full transition-colors duration-150 before:absolute before:inset-y-0 before:-inset-x-1 disabled:pointer-events-none",
              // The bar starts level with the first line's words and stops under the last line's.
              index === rail.first ? "top-3 sm:top-4" : "top-0",
              index === rail.last ? "bottom-8 sm:bottom-10" : "bottom-0",
              index !== rail.first && "rounded-t-none",
              index !== rail.last && "rounded-b-none",
            )}
            style={{
              left: rail.lane * 6,
              // Colour is a strength's: its bar wears its ink at rest too. Work stays grey until in focus.
              background: focused
                ? foundation.ink
                : rail.note.kind === "strength"
                  ? `color-mix(in oklch, ${foundation.ink} 55%, transparent)`
                  : lens === "all"
                    ? "var(--line-strong)"
                    : `color-mix(in oklch, ${foundation.ink} 40%, transparent)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** The words a note is about, shortened in the middle when the passage is long. */
function quoteOf(note: Finding, words: Word[]) {
  const said = note.span
    ? words.filter((w) => within(w, note.span!)).map((w) => w.text)
    : [];
  return said.length > 9
    ? `${said.slice(0, 4).join(" ")} … ${said.slice(-3).join(" ")}`
    : said.join(" ");
}

const highlighter = (fill: string) =>
  `linear-gradient(transparent 10%, ${fill} 10%, ${fill} 92%, transparent 92%)`;

function Words({
  run,
  lens,
  time,
  current,
  pauses,
  markId,
  onOpen,
}: {
  run: Run;
  lens: Lens;
  time: number;
  current: boolean;
  pauses: Take["pauses"];
  markId: string | null | undefined;
  onOpen: (f: Finding) => void;
}) {
  const marks = run.findings;
  // Colour on the words means a strength: a band in its foundation's fill, like a highlighter
  // (keep this), the way a cover fills with colour as strengths are earned. Something to work
  // on is never a band: it is a dark line under the words, like an editor's mark, which takes
  // its foundation's ink only while its note is in focus.
  const focus = marks.find((f) => f.id === markId);
  const shown = focus ? [focus] : lens === "all" ? [] : marks;
  const words = run.words.map((word, i) => {
    const suggested = shown.flatMap((f) =>
      (f.suggestions ?? [])
        .filter((s) => within(word, s.span))
        .map((s) => ({ s, f })),
    );
    const marksPause = suggested.some(({ s }) =>
      ["pause_after", "lengthen_pause_after"].includes(s.direction),
    );
    const emphasis = suggested.find(
      ({ s }) => !["pause_after", "lengthen_pause_after"].includes(s.direction),
    );
    const pause = pauses.find((p) => Math.abs(p.start - word.end) < 0.08);
    const now = current && time >= word.start && time < word.end + 0.05;
    return (
      <Fragment key={i}>
        {i > 0 && " "}
        <span
          className={cn(
            "transition-colors duration-150",
            current && time < word.start ? "text-ink-3" : "text-ink",
            now &&
              "underline decoration-glass decoration-[3px] underline-offset-[0.22em]",
            !now &&
              emphasis &&
              "underline decoration-2 underline-offset-[0.24em]",
          )}
          style={
            !now && emphasis
              ? {
                  textDecorationColor:
                    FOUNDATION_BY_KEY[emphasis.f.foundation].ink,
                }
              : undefined
          }
        >
          {word.text}
        </span>
        {pause && (
          <PauseMark
            seconds={pause.end - pause.start}
            noted={shown.some((f) => f.foundation === "pauses")}
          />
        )}
        {marksPause && !pause && (
          <>
            {" "}
            <span
              className="inline-block h-[0.42em] w-[1.1em] rounded-[2px] border-2 border-dashed align-middle"
              style={{ borderColor: "var(--f-pauses-ink)" }}
              title="A pause belongs here"
            />
            <span className="sr-only">(a pause belongs here)</span>
          </>
        )}
      </Fragment>
    );
  });
  if (!marks.length) return words;

  // The note in focus has its words to itself: other notes' marks on them step back.
  const strength = focus
    ? focus.kind === "strength"
      ? focus
      : undefined
    : marks.find((f) => f.kind === "strength");
  const work = focus
    ? focus.kind === "improvement"
      ? focus
      : undefined
    : marks.find((f) => f.kind === "improvement");
  const band =
    strength &&
    (strength === focus
      ? FOUNDATION_BY_KEY[strength.foundation].fill
      : `color-mix(in oklch, ${FOUNDATION_BY_KEY[strength.foundation].fill} 65%, transparent)`);
  const line =
    work &&
    (work === focus ? FOUNDATION_BY_KEY[work.foundation].ink : "var(--ink)");
  // Pressing a marked phrase opens its note without playing it; pressing again moves to the next note on the same words.
  const at = marks.findIndex((f) => f.id === markId);
  return (
    <span
      onClick={() => onOpen(marks[(at + 1) % marks.length])}
      className={cn(
        "cursor-pointer rounded-[0.14em] [box-decoration-break:clone]",
        line && "underline underline-offset-[0.3em]",
        line && (work === focus ? "decoration-[3px]" : "decoration-2"),
      )}
      style={{
        background: band ? highlighter(band) : undefined,
        mixBlendMode: band ? "multiply" : undefined,
        textDecorationColor: line,
      }}
    >
      {words}
    </span>
  );
}

function PauseMark({ seconds, noted }: { seconds: number; noted: boolean }) {
  return (
    <>
      {" "}
      <span
        className={cn(
          "inline-block h-[0.36em] rounded-[2px] align-middle",
          noted ? "bg-f-pauses-ink" : "bg-line-strong",
        )}
        style={{ width: `${Math.min(seconds * 1.6, 4).toFixed(2)}em` }}
        title={`${seconds.toFixed(1)} second pause`}
      />
      <span className="sr-only">(pause, {seconds.toFixed(1)} seconds)</span>
    </>
  );
}

/**
 * The pin on a review note says which kind it is at a glance: a filled disc with a tick for
 * a strength, an open ring with an upward arrow for something to work on. Dashed when tentative.
 */
function KindPin({
  kind,
  tentative,
  color,
  active,
}: {
  kind: Finding["kind"];
  tentative: boolean;
  color: string;
  active?: boolean;
}) {
  const strength = kind === "strength";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      {active && (
        <circle
          cx="11"
          cy="11"
          r="10"
          fill="none"
          stroke={color}
          strokeOpacity="0.35"
        />
      )}
      <circle
        cx="11"
        cy="11"
        r="7"
        fill={strength ? color : "var(--surface)"}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={tentative ? "3.4 2.1" : undefined}
      />
      {strength ? (
        <path
          d="M7.9 11.2l2.1 2.1 4.1-4.4"
          fill="none"
          stroke="var(--surface)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M11 14.2V8M8.4 10.4 11 7.8l2.6 2.6"
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function Note({
  note,
  quote,
  open = true,
  marked = open,
  onOpen,
  onPlay,
  onPlaySpan,
  demo,
  onHover,
}: {
  note: Finding;
  /** The words the note is about, shown in its highlighter so the two can be matched. */
  quote?: string;
  /** Closed, a note is one line naming it; open, it says everything. */
  open?: boolean;
  /** Its words are coloured in the line right now. */
  marked?: boolean;
  /** Pressing the entry opens or closes it; it never plays. */
  onOpen?: () => void;
  /** The play control on the right plays the passage. */
  onPlay: () => void;
  onPlaySpan: (span: [number, number]) => void;
  /** The passage said the way the note asks, in the speaker's own voice. */
  demo?: { status?: VoiceDemoStatus; onToggle: () => void };
  onHover?: (id: string | null) => void;
}) {
  const f = FOUNDATION_BY_KEY[note.foundation];
  const tentative = note.uncertainty === "tentative";
  const label =
    RULES[note.ruleId]?.label ??
    // An unnamed rule still gets a plain name; its pin says which kind it is.
    "Note";
  return (
    <li
      data-note={open ? note.id : undefined}
      className={cn(
        "grid scroll-mt-28 grid-cols-[1.375rem_minmax(0,1fr)] gap-x-2",
        open && "py-2",
      )}
      onPointerEnter={() => onHover?.(note.id)}
      onPointerLeave={() => onHover?.(null)}
    >
      {/* The pin is centred on the label line, so it reads as that line's bullet. */}
      <span className="flex h-6 items-center justify-center">
        <KindPin
          kind={note.kind}
          tentative={tentative}
          color={f.ink}
          active={marked}
        />
      </span>
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="group/note block w-full rounded-sm pr-16 text-left"
          aria-label={`${note.kind === "strength" ? "Strength" : "To work on"}: ${f.label}, ${label}${tentative ? ", tentative" : ""}. ${note.observation}`}
        >
          <span className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] leading-6">
            <span className="font-semibold" style={{ color: f.ink }}>
              {f.short}
            </span>
            <span
              className={cn(
                "transition-colors group-hover/note:text-ink",
                open ? "text-ink" : "text-ink-2",
              )}
            >
              {label}
            </span>
            {tentative && <span className="text-ink-3">tentative</span>}
          </span>
          {open && quote && (
            <span className="mt-1 block text-[0.8125rem] leading-5 font-semibold text-ink">
              <span
                className="rounded-[2px] px-1 [box-decoration-break:clone]"
                style={{ background: f.fill }}
              >
                {quote}
              </span>
            </span>
          )}
        </button>
        {/* Hearing the passage is its own control, so reading a note never starts the audio. */}
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play this passage, from ${formatTime(passage(note)[0], false)}`}
          className="group/play absolute top-0 right-0 flex h-6 items-center gap-1.5 rounded-sm font-mono text-[0.6875rem] text-ink-3 tabular transition-colors hover:text-glass-ink"
        >
          <PlayIcon
            className="size-2.5 fill-current text-glass transition-colors group-hover/play:text-glass-ink"
            aria-hidden="true"
          />
          {formatTime(passage(note)[0], false)}
        </button>
        {open && note.why && (
          <p className="mt-2 text-[0.875rem] leading-5 text-ink-2">
            {note.why}
          </p>
        )}
        {open && note.practice && (
          <p className="mt-3 flex gap-2 text-[0.8125rem] leading-5 font-medium text-ink">
            <CornerDownRightIcon
              className="mt-0.5 size-4 shrink-0"
              style={{ color: f.ink }}
              aria-hidden="true"
            />
            {note.practice}
          </p>
        )}
        {open && note.suggestions?.length ? (
          <ul className="mt-2 grid gap-1 pl-6">
            {note.suggestions.map((s) => (
              <li key={`${s.direction}-${s.span[0]}`}>
                <button
                  type="button"
                  onClick={() => onPlaySpan(s.span)}
                  className="group/try flex items-baseline gap-2 rounded-sm text-left text-[0.8125rem] leading-5"
                >
                  <PlayIcon
                    className="size-2.5 shrink-0 translate-y-px fill-current text-glass transition-colors group-hover/try:text-glass-ink"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="text-ink-2">
                      {SUGGESTION_LABELS[s.direction]}
                    </span>{" "}
                    <span className="font-semibold text-ink">“{s.text}”</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open && demo && (
          <button
            type="button"
            onClick={demo.onToggle}
            aria-busy={demo.status === "making"}
            // The words stay put while it is heard, so the stop action is named for screen readers.
            aria-label={
              demo.status === "playing"
                ? "Stop the demo in your voice"
                : undefined
            }
            className={cn(
              "group/demo ml-6 flex items-baseline gap-2 rounded-sm text-left text-[0.8125rem] leading-5 font-semibold text-ink",
              note.suggestions?.length ? "mt-1" : "mt-2",
            )}
          >
            {demo.status === "making" ? (
              <LoaderCircleIcon
                className="size-2.5 shrink-0 translate-y-px animate-spin text-glass motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : demo.status === "playing" ? (
              <PauseIcon
                className="size-2.5 shrink-0 translate-y-px fill-current text-glass transition-colors group-hover/demo:text-glass-ink"
                aria-hidden="true"
              />
            ) : (
              <PlayIcon
                className="size-2.5 shrink-0 translate-y-px fill-current text-glass transition-colors group-hover/demo:text-glass-ink"
                aria-hidden="true"
              />
            )}
            {demo.status === "making"
              ? "Making it in your voice…"
              : demo.status === "failed"
                ? "That didn’t work. Try again"
                : "Hear it in your voice"}
          </button>
        )}
      </div>
    </li>
  );
}
