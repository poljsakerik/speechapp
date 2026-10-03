import { formatNumber, REVIEW_NS } from "@/core/i18n";
import { CornerDownRightIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Pin } from "@/components/editor/Editor";
import { RULES } from "@/components/feedback/FeedbackView";
import { FOUNDATION_BY_KEY } from "@/lib/foundations";
import {
  formatTime,
  type Finding,
  type Review,
  type Take,
  type Word,
} from "@/lib/review";
import { cn } from "@micmane/ui/lib/utils";

type LyricSheetProps = {
  take: Take;
  review: Review;
  time: number;
  started: boolean;
  onPlayFrom: (seconds: number) => void;
  header?: ReactNode;
  footer?: ReactNode;
};

const ROW = "grid gap-x-6 gap-y-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]";

const covers = (f: Finding, w: Word) =>
  !!f.span &&
  f.span[1] > f.span[0] &&
  w.start >= f.span[0] - 0.02 &&
  w.end <= f.span[1] + 0.02;

/** The silence between two lines, as space: 8px steps, longer pauses breathe more. */
const breath = (seconds: number) => 8 * Math.round(2 + seconds * 4);

/**
 * A take read as a lyric sheet: each spoken line with its timecode, the words a
 * note is about marked in that foundation's highlighter, and the notes written
 * in the margin. While the take plays, the sheet fills in word by word.
 */
export function LyricSheet({
  take,
  review,
  time,
  started,
  onPlayFrom,
  header,
  footer,
}: LyricSheetProps) {
  const { t: translate } = useTranslation([REVIEW_NS]);
  const segments = take.segments;
  const activeId = started
    ? review.findings.find((f) => {
        const from = (f.span?.[0] ?? f.at) - 0.2;
        const to = Math.max(f.span?.[1] ?? f.at, f.at) + 0.8;
        return time >= from && time <= to;
      })?.id
    : undefined;

  return (
    <div>
      {header}
      <ol
        className="mt-8"
        aria-label={translate(
          "review:feedbackviewTranscriptOfTheTakeWithNotes",
        )}
      >
        {segments.map((segment, index) => {
          const notes = review.findings.filter(
            (f) => f.segmentId === segment.id,
          );
          const next = segments[index + 1];
          const gap = next ? next.start - segment.end : 0;
          const inner = take.pauses.filter(
            (p) =>
              p.start >= segment.start &&
              p.end <= segment.end &&
              p.end - p.start >= 0.3,
          );
          const current =
            started && time >= segment.start && time <= segment.end;
          return (
            <Fragment key={segment.id}>
              <li className={ROW}>
                <button
                  type="button"
                  onClick={() => onPlayFrom(segment.start)}
                  className={cn(
                    "h-fit justify-self-start rounded-sm pt-2 font-mono text-[0.75rem] tabular transition-colors hover:text-glass-ink sm:pt-3",
                    current ? "text-glass-ink" : "text-ink-3",
                  )}
                  aria-label={translate("review:feedbackPlayFrom", {
                    time: formatTime(segment.start),
                  })}
                >
                  {formatTime(segment.start)}
                </button>
                <p className="max-w-[34ch] font-wide text-[clamp(1.375rem,2.1vw,1.875rem)] leading-[1.3] font-semibold tracking-[-0.015em] text-pretty">
                  {segment.words.map((word, w) => {
                    const marks = notes.filter((f) => covers(f, word));
                    const [mark, second] = marks;
                    const pause = inner.find(
                      (p) => Math.abs(p.start - word.end) < 0.05,
                    );
                    const said = !started || time >= word.start;
                    const now =
                      started && time >= word.start && time < word.end;
                    return (
                      <Fragment key={w}>
                        <span
                          className={cn(
                            "rounded-[0.18em] transition-colors duration-150 [box-decoration-break:clone]",
                            said ? "text-ink" : "text-ink/35",
                            now &&
                              "underline decoration-glass decoration-[3px] underline-offset-[0.22em]",
                            second &&
                              "underline decoration-2 underline-offset-[0.28em]",
                          )}
                          style={{
                            background: mark
                              ? `linear-gradient(transparent 14%, ${FOUNDATION_BY_KEY[mark.foundation].fill} 14%, ${FOUNDATION_BY_KEY[mark.foundation].fill} 92%, transparent 92%)`
                              : undefined,
                            textDecorationColor:
                              !now && second
                                ? FOUNDATION_BY_KEY[second.foundation].ink
                                : undefined,
                            textDecorationStyle:
                              !now && second?.uncertainty === "tentative"
                                ? "dashed"
                                : undefined,
                            mixBlendMode: "multiply",
                          }}
                        >
                          {word.text}
                        </span>
                        {pause && (
                          <PauseMark
                            seconds={pause.end - pause.start}
                            noted={notes.some(
                              (f) =>
                                f.foundation === "pauses" &&
                                (Math.abs(f.at - pause.start) < 0.4 ||
                                  (!!f.span &&
                                    f.span[0] <= pause.start &&
                                    f.span[1] >= pause.end)),
                            )}
                          />
                        )}
                        {w < segment.words.length - 1 && " "}
                      </Fragment>
                    );
                  })}
                </p>
                {notes.length > 0 && (
                  <ul className="grid gap-x-8 gap-y-5 sm:col-start-2 md:grid-cols-2">
                    {notes.map((note) => (
                      <MarginNote
                        key={note.id}
                        note={note}
                        active={note.id === activeId}
                        onPlay={() =>
                          onPlayFrom(
                            Math.max(0, (note.span?.[0] ?? note.at) - 0.4),
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </li>
              {next && (
                <li
                  aria-hidden="true"
                  className={ROW}
                  style={{ height: breath(gap) }}
                >
                  {gap >= 0.25 && (
                    <span className="flex items-center gap-2 self-center font-mono text-[0.625rem] text-ink-3 tabular">
                      <span className="h-px w-3 bg-line-strong" />
                      {translate("review:feedbackSeconds", {
                        seconds: formatNumber(gap, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }),
                      })}
                    </span>
                  )}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      {footer}
    </div>
  );
}

function PauseMark({ seconds, noted }: { seconds: number; noted: boolean }) {
  const { t: translate } = useTranslation([REVIEW_NS]);
  return (
    <>
      {" "}
      <span
        className={cn(
          "inline-block h-[0.36em] rounded-[2px] align-middle",
          noted ? "bg-f-pauses" : "bg-line-strong",
        )}
        style={{
          width: `${(seconds * 1.6).toFixed(2)}em`,
          boxShadow: noted ? "inset 0 0 0 1px var(--f-pauses-ink)" : undefined,
        }}
        title={translate("review:feedbackPauseTitle", {
          count: seconds,
          seconds: formatNumber(seconds, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
        })}
      />
      <span className="sr-only">
        {translate("review:feedbackPauseAccessible", {
          count: seconds,
          seconds: formatNumber(seconds, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
        })}
      </span>
    </>
  );
}

function MarginNote({
  note,
  active,
  onPlay,
}: {
  note: Finding;
  active: boolean;
  onPlay: () => void;
}) {
  const { t: translate } = useTranslation([REVIEW_NS]);
  const f = FOUNDATION_BY_KEY[note.foundation];
  const kind =
    RULES[note.ruleId]?.label ??
    (note.kind === "strength"
      ? translate("review:editorStrength")
      : translate("review:editorToImprove2"));
  return (
    <li>
      <button
        type="button"
        onClick={onPlay}
        className="group/note grid w-full grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 rounded-md text-left"
        aria-label={translate(
          note.uncertainty === "tentative"
            ? "review:feedbackMarginLabelTentative"
            : "review:feedbackMarginLabel",
          { foundation: f.label, kind },
        )}
      >
        <span className="flex h-5 items-center justify-center">
          <Pin
            kind={note.kind}
            tentative={note.uncertainty === "tentative"}
            color={f.ink}
            active={active}
            size={12}
          />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 text-[0.75rem] leading-5">
            <span className="font-semibold" style={{ color: f.ink }}>
              {f.short}
            </span>
            <span className="text-ink-3">
              {kind}
              {note.uncertainty === "tentative" &&
                translate("review:editorTentative2")}
            </span>
          </span>
          <span
            className={cn(
              "mt-1 block text-[0.8125rem] leading-5 transition-colors group-hover/note:text-ink",
              active ? "text-ink" : "text-ink-2",
            )}
          >
            {note.observation}
          </span>
          {note.kind === "improvement" && note.practice && (
            <span className="mt-2 flex gap-2 text-[0.8125rem] leading-5 font-medium text-ink">
              <CornerDownRightIcon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: f.ink }}
                aria-hidden="true"
              />
              {note.practice}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
