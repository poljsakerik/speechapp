import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CornerDownRightIcon,
  LocateFixedIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { Pin } from "@/components/editor/Editor";
import {
  FOUNDATIONS,
  FOUNDATION_BY_KEY,
  VERDICT_LABEL,
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

type FeedbackViewProps = {
  take: Take;
  review: Review;
  audioSrc: string;
  /** Shown at the end of the transport, e.g. a button to upload another take. */
  action?: ReactNode;
  /** Shown under the page. */
  footer?: ReactNode;
  className?: string;
};

/** What each rule is called in a note, and whether it marks a whole stretch rather than one phrase. */
export const RULES: Record<string, { label: string; stretch?: boolean }> = {
  RATE_IMPORTANCE_FAST: { label: "Rushed passage", stretch: true },
  RATE_IMPORTANCE_SLOW: { label: "Dragged passage", stretch: true },
  RATE_CONTRAST: { label: "Flat pacing", stretch: true },
  PAUSE_NECESSARY: { label: "Missing pause", stretch: true },
  PAUSE_TOO_SHORT: { label: "Pause too short" },
  PAUSE_UNNECESSARY: { label: "Pause out of place", stretch: true },
  PAUSE_TOO_LONG: { label: "Pause too long" },
  VOLUME_LOW: { label: "Volume drop", stretch: true },
  VOLUME_FADE: { label: "Trailing off" },
  TONE_FLAT: { label: "Flat voice", stretch: true },
  PITCH_VARIETY: { label: "Monotone stretch", stretch: true },
  PITCH_HIGH: { label: "Stuck high", stretch: true },
  PITCH_LOW: { label: "Stuck low", stretch: true },
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
/** Timecode, line, and on large screens the margin. Every row of the sheet shares it. */
const ROW =
  "grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[4.5rem_minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-10";
/** Where the playhead holds while the page follows it, as a share of the viewport. */
const READING_LINE = 0.42;

// Words are matched by where they start: the recognizer sometimes stretches a word's end over the next one.
const within = (word: Word, span: [number, number]) =>
  word.start >= span[0] - 0.02 && word.start < span[1] - 0.01;
/** The silence between two lines, as space: 8px steps, longer pauses breathe more. */
const breath = (seconds: number) =>
  8 * Math.round(2 + Math.min(seconds, 4) * 6);
/** Space between two margin blocks when one has to give way to the other. */
const MARGIN_GAP = 32;
const passage = (f: Finding): [number, number] => f.span ?? [f.at, f.at + 2];

type Row = { id: string; start: number; end: number; segment?: Segment };

/**
 * A reviewed take as one long page: each line with its timecode and pace, silences
 * as space, and every note in the margin level with its words. The transport's
 * scrubber is the timeline; while the take plays, the page follows the playhead.
 */
export function FeedbackView({
  take,
  review,
  audioSrc,
  action,
  footer,
  className,
}: FeedbackViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const tapeRef = useRef<HTMLOListElement>(null);
  const [margin, setMargin] = useState<{
    pads: Record<string, number>;
    overflow: number;
  }>({ pads: {}, overflow: 0 });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const findings = useMemo(
    () => [...review.findings].sort((a, b) => a.at - b.at),
    [review.findings],
  );
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
  const activeId = live ?? selected;
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

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setStarted(true);
    await audio.play().catch(() => setPlaying(false));
  }, []);

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
    (f: Finding) => {
      setSelected(f.id);
      playSpan(passage(f));
    },
    [playSpan],
  );

  /** Step to the next or previous note in take order and bring it into view. */
  const step = useCallback(
    (by: 1 | -1) => {
      if (!findings.length) return;
      const from = noteIndex < 0 ? (by > 0 ? -1 : findings.length) : noteIndex;
      const note = findings[(from + by + findings.length) % findings.length];
      setSelected(note.id);
      setFollow(false);
      document
        .querySelector(`[data-note="${note.id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
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

  // On large screens notes hang in the margin level with their line without stretching it, so a line's
  // height stays its words and the space after it stays its silence. Only where a line's notes would
  // run into the next line's does that line grow, just enough; the page grows to hold the last block.
  useLayoutEffect(() => {
    const ol = tapeRef.current;
    if (!ol) return;
    const measure = () => {
      const pads: Record<string, number> = {};
      let overflow = 0;
      if (window.matchMedia("(min-width: 1024px)").matches) {
        const base = ol.getBoundingClientRect().top;
        const current = Object.fromEntries(
          Array.from(ol.querySelectorAll<HTMLElement>("[data-pad]"), (el) => [
            el.dataset.pad!,
            parseFloat(el.style.paddingBottom) || 0,
          ]),
        );
        let removed = 0;
        let added = 0;
        let previous: { id: string; bottom: number } | undefined;
        for (const el of ol.querySelectorAll<HTMLElement>("[data-margin]")) {
          const id = el.dataset.margin!;
          // Where this block would sit with no line grown, then with the growth decided so far.
          let top =
            el.parentElement!.getBoundingClientRect().top -
            base -
            removed +
            added;
          if (previous && previous.bottom + MARGIN_GAP > top) {
            const need = Math.ceil(previous.bottom + MARGIN_GAP - top);
            pads[previous.id] = need;
            added += need;
            top += need;
          }
          removed += current[id] ?? 0;
          previous = { id, bottom: top + el.offsetHeight };
        }
        const height =
          ol.offsetHeight -
          (parseFloat(ol.style.paddingBottom) || 0) -
          removed +
          added;
        overflow = previous
          ? Math.max(0, Math.ceil(previous.bottom - height))
          : 0;
      }
      setMargin((prev) =>
        JSON.stringify(prev) === JSON.stringify({ pads, overflow })
          ? prev
          : { pads, overflow },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(ol);
    ol.querySelectorAll("[data-margin]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rows, findings]);

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
                    background: foundation.fill,
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
            <p className="mt-4 font-mono text-[0.75rem] leading-5 text-ink-3 tabular">
              {formatTime(take.duration, false)} · {lines}{" "}
              {lines === 1 ? "line" : "lines"} · {findings.length}{" "}
              {findings.length === 1 ? "note" : "notes"}
            </p>
            <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-7 text-ink-2">
              {findings.length
                ? "Each note sits beside the words it is about. Press a highlighted phrase or a note to hear that passage."
                : emptyReviewMessage(review.assessments)}
            </p>
            <p className="mt-4 text-[0.8125rem] leading-5 text-ink-3 max-sm:hidden">
              Space plays and pauses. J and K step through the notes.
            </p>
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
              const notes = findings.filter((n) => n.foundation === f.key);
              return (
                <li
                  key={f.key}
                  className={cn(
                    "grid grid-cols-[0.625rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[0.625rem_9.5rem_minmax(0,1fr)_10rem] sm:gap-x-4",
                    !reviewed && unreviewed.length > 1 && "max-sm:hidden",
                  )}
                >
                  <Swatch foundation={f} reviewed={reviewed} />
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
                              background: f.fill,
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
          <ol
            ref={tapeRef}
            aria-label="Transcript of the take, with notes"
            style={{ paddingBottom: margin.overflow || undefined }}
          >
            {rows.map((row) =>
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
                  time={time}
                  playing={playing}
                  activeId={activeId}
                  onPlayFrom={(t) => {
                    seek(t);
                    void play();
                  }}
                  onPlayNote={playNote}
                  onPlaySpan={playSpan}
                  pad={margin.pads[row.id] ?? 0}
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
                  className={ROW}
                  style={{ height: breath(row.end - row.start) }}
                >
                  {row.end - row.start >= 0.25 && (
                    <span className="flex items-center gap-2 self-center font-mono text-[0.625rem] text-ink-3 tabular max-sm:hidden">
                      <span className="h-px w-3 bg-line-strong" />
                      {(row.end - row.start).toFixed(1)} s
                    </span>
                  )}
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
}: {
  foundation?: (typeof FOUNDATIONS)[number];
  reviewed: boolean;
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
              background: foundation.fill,
              boxShadow: `inset 0 0 0 1px ${foundation.ink}`,
            }
          : undefined
      }
    />
  );
}

const STEP =
  "grid size-8 place-items-center rounded-sm text-on-graphite-muted transition-colors hover:bg-graphite-line hover:text-on-graphite sm:size-6";

type LineProps = {
  ref: (el: HTMLLIElement | null) => void;
  take: Take;
  segment: Segment;
  findings: Finding[];
  time: number;
  playing: boolean;
  activeId: string | null | undefined;
  onPlayFrom: (t: number) => void;
  onPlayNote: (f: Finding) => void;
  onPlaySpan: (span: [number, number]) => void;
  /** Extra room under this line so its margin notes clear the next line's. */
  pad: number;
};

type Run = { finding?: Finding; words: Word[] };

function Line({
  ref,
  take,
  segment,
  findings,
  time,
  playing,
  activeId,
  onPlayFrom,
  onPlayNote,
  onPlaySpan,
  pad,
}: LineProps) {
  const notes = findings.filter((f) => f.segmentId === segment.id);
  const current = playing && time >= segment.start && time < segment.end;
  const rated = notes.some((f) => f.foundation === "rate");

  // Each word belongs to the narrowest note covering it; consecutive words of one note form a run.
  const runs = useMemo(() => {
    const width = (f: Finding) => (f.span ? f.span[1] - f.span[0] : Infinity);
    const result: Run[] = [];
    for (const word of segment.words) {
      const finding = findings
        .filter((f) =>
          f.span ? within(word, f.span) : f.segmentId === segment.id,
        )
        .sort((a, b) => width(a) - width(b))[0];
      const last = result[result.length - 1];
      if (last && last.finding === finding) last.words.push(word);
      else result.push({ finding, words: [word] });
    }
    return result;
  }, [segment, findings]);

  const pauses = take.pauses.filter(
    (p) =>
      p.start >= segment.start - 0.05 &&
      p.end <= segment.end + 0.05 &&
      p.end - p.start >= 0.3,
  );

  return (
    <li
      ref={ref}
      data-pad={segment.id}
      className={ROW}
      style={pad ? { paddingBottom: pad } : undefined}
    >
      <div className="flex items-baseline gap-3 pt-1 sm:block sm:pt-2">
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
        {segment.speakingRate !== undefined && (
          <p
            className="font-mono text-[0.625rem] leading-5 tabular sm:mt-1"
            style={{ color: rated ? "var(--f-rate-ink)" : "var(--ink-3)" }}
            title="Syllables per second in this line, including short silences"
          >
            {segment.speakingRate.toFixed(1)} syl/s
          </p>
        )}
      </div>
      <div className="pt-2 pb-8 sm:pb-10 lg:pb-6">
        <p className="max-w-[36ch] font-wide text-[clamp(1.25rem,1.9vw,1.75rem)] leading-[1.35] font-semibold tracking-[-0.015em] text-pretty">
          {runs.map((run, r) => (
            <Fragment key={r}>
              {r > 0 && " "}
              <Words
                run={run}
                time={time}
                current={current}
                pauses={pauses}
                active={!!run.finding && run.finding.id === activeId}
                onPlay={
                  run.finding ? () => onPlayNote(run.finding!) : undefined
                }
              />
            </Fragment>
          ))}
        </p>
        {notes.length > 0 && (
          <ul className="mt-6 grid gap-6 lg:hidden">
            {notes.map((note) => (
              <Note
                key={note.id}
                note={note}
                active={note.id === activeId}
                onPlay={() => onPlayNote(note)}
                onPlaySpan={onPlaySpan}
              />
            ))}
          </ul>
        )}
      </div>
      {notes.length > 0 && (
        <div className="relative max-lg:hidden">
          <ul
            data-margin={segment.id}
            className="absolute inset-x-0 top-0 grid gap-8 pt-3"
          >
            {notes.map((note) => (
              <Note
                key={note.id}
                note={note}
                active={note.id === activeId}
                onPlay={() => onPlayNote(note)}
                onPlaySpan={onPlaySpan}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function Words({
  run,
  time,
  current,
  pauses,
  active,
  onPlay,
}: {
  run: Run;
  time: number;
  current: boolean;
  pauses: Take["pauses"];
  active: boolean;
  onPlay?: () => void;
}) {
  const f = run.finding;
  const foundation = f && FOUNDATION_BY_KEY[f.foundation];
  // A stretch is laid on lighter than a single phrase; the note in focus is laid on in full.
  const band =
    foundation &&
    (active || !RULES[f.ruleId]?.stretch
      ? foundation.fill
      : `color-mix(in oklch, ${foundation.fill} 55%, transparent)`);
  const words = run.words.map((word, i) => {
    const suggestion = f?.suggestions?.find((s) => within(word, s.span));
    const marksPause =
      suggestion &&
      ["pause_after", "lengthen_pause_after"].includes(suggestion.direction);
    const emphasis = suggestion && !marksPause;
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
              ? { textDecorationColor: foundation!.ink }
              : undefined
          }
        >
          {word.text}
        </span>
        {pause && (
          <PauseMark
            seconds={pause.end - pause.start}
            noted={f?.foundation === "pauses"}
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
  if (!f || !foundation) return words;

  return (
    <span
      onClick={onPlay}
      className={cn(
        "cursor-pointer rounded-[0.14em] transition-[background-color,box-shadow] duration-200 [box-decoration-break:clone]",
        f.uncertainty === "tentative" && "border-b-2 border-dashed",
      )}
      style={
        {
          borderColor: foundation.ink,
          background: `linear-gradient(transparent 12%, ${band} 12%, ${band} 94%, transparent 94%)`,
          mixBlendMode: "multiply",
        } as CSSProperties
      }
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

export function Note({
  note,
  active,
  onPlay,
  onPlaySpan,
}: {
  note: Finding;
  active: boolean;
  onPlay: () => void;
  onPlaySpan: (span: [number, number]) => void;
}) {
  const f = FOUNDATION_BY_KEY[note.foundation];
  const tentative = note.uncertainty === "tentative";
  const label =
    RULES[note.ruleId]?.label ??
    (note.kind === "strength" ? "Strength" : "To improve");
  return (
    <li
      data-note={note.id}
      className="grid scroll-mt-28 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2"
    >
      {/* The pin is centred on the label line, so it reads as that line's bullet. */}
      <span className="flex h-5 items-center justify-center">
        <Pin
          kind={note.kind}
          tentative={tentative}
          color={f.ink}
          active={active}
          size={12}
        />
      </span>
      <div className="min-w-0">
        <button
          type="button"
          onClick={onPlay}
          className="group/note block w-full rounded-sm text-left"
          aria-label={`${f.label}, ${label}${tentative ? ", tentative" : ""}: ${note.observation} Play this passage.`}
        >
          <span className="flex flex-wrap items-baseline gap-x-2 text-[0.75rem] leading-5">
            <span className="font-semibold" style={{ color: f.ink }}>
              {f.short}
            </span>
            <span className="text-ink-3">
              {label}
              {tentative && " · tentative"}
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[0.6875rem] text-ink-3 tabular transition-colors group-hover/note:text-glass-ink">
              <PlayIcon
                className="size-2.5 fill-current text-glass"
                aria-hidden="true"
              />
              {formatTime(passage(note)[0], false)}
            </span>
          </span>
          <span
            className={cn(
              "mt-1 block text-[0.9375rem] leading-6 font-medium transition-colors group-hover/note:text-ink",
              active ? "text-ink" : "text-ink-2",
            )}
          >
            {note.observation}
          </span>
        </button>
        {note.why && (
          <p className="mt-1 text-[0.8125rem] leading-5 text-ink-3">
            {note.why}
          </p>
        )}
        {note.practice && (
          <p className="mt-3 flex gap-2 text-[0.8125rem] leading-5 font-medium text-ink">
            <CornerDownRightIcon
              className="mt-0.5 size-4 shrink-0"
              style={{ color: f.ink }}
              aria-hidden="true"
            />
            {note.practice}
          </p>
        )}
        {note.suggestions?.length ? (
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
      </div>
    </li>
  );
}
