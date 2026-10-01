import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react"

import { Button } from "@micmane/ui/components/button"
import { Popover, PopoverAnchor, PopoverContent } from "@micmane/ui/components/popover"
import { FOUNDATION_BY_KEY } from "@/lib/foundations"
import { emptyReviewMessage, formatTime, type Assessment, type Finding, type Take, type Word } from "@/lib/review"
import { cn } from "@micmane/ui/lib/utils"

type FeedbackViewProps = {
  take: Take
  findings: Finding[]
  assessments: Assessment[]
  audioSrc: string
  /** Shown at the end of the player bar, e.g. a button to upload another take. */
  action?: ReactNode
  /** Shown under the transcript, in its column. */
  footer?: ReactNode
  className?: string
}

/** What each rule is called in a note, and whether it marks a whole stretch rather than one phrase. */
const RULES: Record<string, { label: string; stretch?: boolean }> = {
  RATE_IMPORTANCE_FAST: { label: "Rushed passage", stretch: true },
  RATE_IMPORTANCE_SLOW: { label: "Dragged passage", stretch: true },
}

const SPEEDS = [0.75, 1, 1.25, 1.5]
/** Silence long enough to start a new paragraph in the transcript. */
const PARAGRAPH_GAP = 2

type Run = { key: string; finding?: Finding; words: { word: Word; index: number }[] }

// Words are matched by where they start: Deepgram sometimes stretches a word's end over the next one.
const within = (word: Word, span: [number, number]) => word.start >= span[0] - 0.02 && word.start < span[1] - 0.01

/**
 * A reviewed take as its transcript: every note is a highlight on the words it
 * is about, and opens above them when clicked. The graphite bar plays the take.
 */
export function FeedbackView({ take, findings, assessments, audioSrc, action, footer, className }: FeedbackViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const stopAt = useRef<number | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const words = useMemo(() => take.segments.flatMap((s) => s.words), [take.segments])

  // Each word belongs to the narrowest note covering it; consecutive words of one note form a run.
  const paragraphs = useMemo(() => {
    const covers = (f: Finding, w: Word) =>
      f.span ? within(w, f.span) : take.segments.find((s) => s.id === f.segmentId)?.words.includes(w)
    const width = (f: Finding) => (f.span ? f.span[1] - f.span[0] : Infinity)
    const result: Run[][] = [[]]
    words.forEach((word, index) => {
      const finding = findings.filter((f) => covers(f, word)).sort((a, b) => width(a) - width(b))[0]
      if (index && word.start - words[index - 1].end >= PARAGRAPH_GAP) result.push([])
      const current = result[result.length - 1]
      const last = current[current.length - 1]
      if (last && last.finding === finding) last.words.push({ word, index })
      else current.push({ key: `${finding?.id ?? "plain"}-${index}`, finding, words: [{ word, index }] })
    })
    return result
  }, [words, findings, take.segments])

  const firstRun = useMemo(() => {
    const byFinding = new Map<string, string>()
    for (const run of paragraphs.flat()) if (run.finding && !byFinding.has(run.finding.id)) byFinding.set(run.finding.id, run.key)
    return byFinding
  }, [paragraphs])
  const noteKeys = useMemo(() => Array.from(firstRun.values()), [firstRun])
  const noteIndex = openKey ? noteKeys.indexOf(openKey) : -1

  const openNote = useCallback((key: string | undefined) => {
    if (!key) return
    document.querySelector(`[data-run="${key}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })
    setOpenKey(key)
  }, [])

  /** Step to the next or previous note in transcript order. */
  const step = useCallback(
    (by: 1 | -1) => {
      if (!noteKeys.length) return
      const from = noteIndex < 0 ? (by > 0 ? -1 : noteKeys.length) : noteIndex
      openNote(noteKeys[(from + by + noteKeys.length) % noteKeys.length])
    },
    [noteKeys, noteIndex, openNote],
  )

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) {
        if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
          audio.pause()
          stopAt.current = null
        }
        setTime(audio.currentTime)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const seek = useCallback(
    (t: number) => {
      const next = Math.min(Math.max(t, 0), take.duration)
      stopAt.current = null
      if (audioRef.current) audioRef.current.currentTime = next
      setTime(next)
    },
    [take.duration],
  )

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) return audio.pause()
    stopAt.current = null
    if (audio.ended || audio.currentTime >= take.duration - 0.05) audio.currentTime = 0
    await audio.play().catch(() => setPlaying(false))
  }, [take.duration])

  /** Play one passage with a little air on either side, then stop. */
  const playSpan = useCallback((span: [number, number]) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, span[0] - 0.3)
    stopAt.current = span[1] + 0.3
    void audio.play().catch(() => setPlaying(false))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input, textarea, select")) return
      if (event.key === "j" || event.key === "k") return step(event.key === "j" ? 1 : -1)
      if (event.key !== " " || target.closest("button, a, [role=button], [role=slider], [role=dialog]")) return
      event.preventDefault()
      void toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle, step])

  // The word being spoken, so the listener can follow along. Only while it plays: the glass is lit only when live.
  let now = -1
  if (playing) {
    let lo = 0
    let hi = words.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (words[mid].start <= time) {
        now = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    if (now >= 0 && time > words[now].end + 0.6) now = -1
  }

  const pct = (t: number) => `${(Math.min(t, take.duration) / take.duration) * 100}%`

  return (
    <div className={className}>
      <div
        data-player-bar
        className="sticky top-0 z-10 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 bg-graphite px-4 py-3 text-on-graphite sm:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] sm:px-6 lg:px-10"
      >
        <button
          type="button"
          onClick={() => void toggle()}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "grid size-9 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-(--ease-out) focus-visible:outline-offset-4 active:scale-95",
            playing ? "glass-lit text-graphite-deep hover:bg-glass-hot" : "glass-dim text-on-graphite hover:text-glass-hot",
          )}
        >
          {playing ? <PauseIcon className="size-3.5 fill-current" /> : <PlayIcon className="size-3.5 translate-x-px fill-current" />}
        </button>
        <p className="font-mono text-xs text-on-graphite-muted tabular sm:min-w-[8.5rem]">
          {formatTime(time)} / {formatTime(take.duration, false)}
        </p>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position in take"
          aria-valuemin={0}
          aria-valuemax={Math.round(take.duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={formatTime(time, false)}
          className="relative h-7 cursor-pointer rounded-sm"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            seek(((event.clientX - rect.left) / rect.width) * take.duration)
          }}
          onKeyDown={(event) => {
            const to = { ArrowLeft: time - 5, ArrowRight: time + 5, Home: 0, End: take.duration }[event.key]
            if (to === undefined) return
            event.preventDefault()
            seek(to)
          }}
        >
          <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-graphite-line" />
          <div className="absolute top-3 left-0 h-1 rounded-full bg-on-graphite-muted" style={{ width: pct(time) }} />
          {findings.map((f) => {
            const span = f.span ?? [f.at, f.at]
            const foundation = FOUNDATION_BY_KEY[f.foundation]
            const key = firstRun.get(f.id)
            return (
              <button
                key={f.id}
                type="button"
                tabIndex={-1}
                aria-label={`${RULES[f.ruleId]?.label ?? foundation.label} at ${formatTime(span[0], false)}`}
                className={cn(
                  "absolute top-1 h-5 min-w-1 rounded-[2px] transition-opacity duration-200",
                  key && key === openKey ? "opacity-95" : "opacity-40 hover:opacity-80",
                )}
                style={{ left: pct(span[0]), width: pct(span[1] - span[0]), background: foundation.fill }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => openNote(key)}
              />
            )
          })}
          <div className="pointer-events-none absolute top-[3px] h-[22px] w-0.5 -translate-x-1/2 rounded-full bg-glass" style={{ left: pct(time) }} />
        </div>
        <div className="col-span-3 flex items-center gap-x-2 sm:contents">
          <div className="flex gap-0.5" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => {
                  setSpeed(s)
                  if (audioRef.current) audioRef.current.playbackRate = s
                }}
                className="h-8 rounded-sm px-1.5 font-mono text-[0.6875rem] text-on-graphite-muted transition-colors hover:text-on-graphite aria-pressed:bg-graphite-line aria-pressed:text-on-graphite sm:h-6"
              >
                {s}×
              </button>
            ))}
          </div>
          {noteKeys.length > 0 && (
            <div className="flex items-center" role="group" aria-label="Notes" aria-keyshortcuts="j k">
              <button
                type="button"
                aria-label="Previous note (K)"
                onClick={() => step(-1)}
                className="grid size-8 place-items-center rounded-sm text-on-graphite-muted transition-colors hover:bg-graphite-line hover:text-on-graphite sm:size-6"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>
              <span className="min-w-[3.75rem] text-center text-xs text-on-graphite-muted">
                <span className="font-mono tabular text-on-graphite">{noteIndex < 0 ? "–" : noteIndex + 1}</span> of{" "}
                <span className="font-mono tabular">{noteKeys.length}</span>
              </span>
              <button
                type="button"
                aria-label="Next note (J)"
                onClick={() => step(1)}
                className="grid size-8 place-items-center rounded-sm text-on-graphite-muted transition-colors hover:bg-graphite-line hover:text-on-graphite sm:size-6"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>
          )}
          {action && <div className="ml-auto sm:justify-self-end">{action}</div>}
        </div>
      </div>

      <div className="px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-[62ch]">
          {!findings.length && (
            <p className="mb-6 text-[0.8125rem] text-ink-3">{emptyReviewMessage(assessments)}</p>
          )}
          <Transcript paragraphs={paragraphs} now={now} openKey={openKey} onOpenChange={setOpenKey} onPlay={playSpan} />
          {footer && <div className="mt-16">{footer}</div>}
        </div>
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
  )
}

type TranscriptProps = {
  paragraphs: Run[][]
  now: number
  openKey: string | null
  onOpenChange: (key: string | null) => void
  onPlay: (span: [number, number]) => void
}

const Transcript = memo(function Transcript({ paragraphs, now, openKey, onOpenChange, onPlay }: TranscriptProps) {
  return (
    <div className="space-y-5 text-[1.1875rem] leading-[1.9] text-ink">
      {paragraphs.map((runs, p) => (
        <p key={p}>
          {runs.map((run, r) => {
            const finding = run.finding
            return (
              <Fragment key={run.key}>
                {r > 0 && " "}
                {finding ? (
                  <Highlight
                    runKey={run.key}
                    finding={finding}
                    open={openKey === run.key}
                    onOpenChange={(open) => onOpenChange(open ? run.key : null)}
                    onPlay={onPlay}
                  >
                    <Words words={run.words} now={now} emphasized={(w) => !!finding.suggestions?.some((s) => within(w, s.span))} />
                  </Highlight>
                ) : (
                  <Words words={run.words} now={now} />
                )}
              </Fragment>
            )
          })}
        </p>
      ))}
    </div>
  )
})

type WordsProps = {
  words: Run["words"]
  now: number
  /** Phrases a note singles out inside a stretch, e.g. where to slow down. */
  emphasized?: (word: Word) => boolean
}

function Words({ words, now, emphasized }: WordsProps) {
  const groups: { emphasis: boolean; words: Run["words"] }[] = []
  for (const item of words) {
    const emphasis = emphasized?.(item.word) ?? false
    const last = groups[groups.length - 1]
    if (last && last.emphasis === emphasis) last.words.push(item)
    else groups.push({ emphasis, words: [item] })
  }
  return groups.map((group, g) => {
    const text = group.words.map(({ word, index }, i) => (
      <Fragment key={index}>
        {i > 0 && " "}
        <span className={cn(index === now && "shadow-[inset_0_-3px_0_var(--glass)]")}>{word.text}</span>
      </Fragment>
    ))
    return (
      <Fragment key={g}>
        {g > 0 && " "}
        {group.emphasis ? (
          <span className="rounded-[2px] bg-(--hl) underline decoration-(--hl-ink) decoration-2 underline-offset-[5px] box-decoration-clone in-data-[state=open]:bg-transparent in-data-[state=open]:decoration-surface">
            {text}
          </span>
        ) : (
          text
        )}
      </Fragment>
    )
  })
}

type HighlightProps = {
  runKey: string
  finding: Finding
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlay: (span: [number, number]) => void
  children: ReactNode
}

function Highlight({ runKey, finding, open, onOpenChange, onPlay, children }: HighlightProps) {
  const trigger = useRef<HTMLSpanElement>(null)
  const line = useRef(0)
  // The note opens right above the line that was clicked, not above the whole wrapped passage. The
  // highlight opens it itself rather than through a trigger, so this is the popover's only anchor.
  const anchor = useRef({
    getBoundingClientRect: () => {
      const rects = trigger.current?.getClientRects()
      return rects?.[Math.min(line.current, rects.length - 1)] ?? trigger.current?.getBoundingClientRect() ?? new DOMRect()
    },
  })
  const foundation = FOUNDATION_BY_KEY[finding.foundation]
  const rule = RULES[finding.ruleId]
  const style = { "--hl": foundation.fill, "--hl-ink": foundation.ink } as CSSProperties
  const tentative = finding.uncertainty === "tentative"
  // Keep the note clear of the sticky player bar, which wraps to two rows on phones.
  const barBottom = open ? (document.querySelector("[data-player-bar]")?.getBoundingClientRect().bottom ?? 60) : 60

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchor} />
      <span
        ref={trigger}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        data-run={runKey}
        style={style}
        className={cn(
          "cursor-pointer rounded-[3px] px-0.5 py-0.5 outline-offset-2 box-decoration-clone transition-[background-color,color,box-shadow] duration-150",
          rule?.stretch ? "bg-[color-mix(in_oklch,var(--hl)_45%,transparent)]" : "bg-(--hl)",
          // State by stroke: a tentative note is drawn with a dashed edge.
          tentative && "rounded-none border-b-2 border-dashed border-(--hl-ink) data-[state=open]:border-surface",
          "hover:shadow-[0_0_0_1px_var(--hl-ink)] data-[state=open]:bg-(--hl-ink) data-[state=open]:text-surface",
        )}
        onPointerDown={(event) => {
          const rects = Array.from(event.currentTarget.getClientRects())
          const hit = rects.findIndex((r) => event.clientY >= r.top && event.clientY <= r.bottom)
          line.current = Math.max(0, hit)
        }}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          line.current = 0
          onOpenChange(!open)
        }}
      >
        <span className="sr-only">
          {rule?.label ?? foundation.label} note{tentative && ", tentative"}, {formatTime(finding.span?.[0] ?? finding.at, false)}:{" "}
        </span>
        {children}
      </span>
      <PopoverContent
        side="top"
        style={style}
        className="w-96 max-w-[calc(100vw-1.5rem)]"
        aria-label={finding.observation}
        collisionPadding={{ top: barBottom + 12, right: 12, bottom: 12, left: 12 }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (trigger.current?.contains(event.target as Node)) event.preventDefault()
        }}
      >
        <Note finding={finding} onPlay={onPlay} />
      </PopoverContent>
    </Popover>
  )
}

function Note({ finding, onPlay }: { finding: Finding; onPlay: (span: [number, number]) => void }) {
  const foundation = FOUNDATION_BY_KEY[finding.foundation]
  const span = finding.span ?? [finding.at, finding.at + 3]
  const tentative = finding.uncertainty === "tentative"
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-2">
        {/* Filled for a strength, an open ring for an improvement; dashed when tentative. */}
        <span
          className={cn(
            "size-2.5 rounded-[2px] border border-(--hl-ink)",
            finding.kind === "strength" ? "bg-(--hl-ink)" : "bg-(--hl)",
            tentative && "border-dashed",
          )}
        />
        {foundation.label}
        <span className="font-normal text-ink-3">
          {[RULES[finding.ruleId]?.label, finding.kind === "strength" && "Strength", tentative && "Tentative"].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-auto font-mono text-[0.6875rem] font-normal text-ink-3 tabular">{formatTime(span[0], false)}</span>
      </p>
      <p className="mt-3 font-semibold text-pretty text-ink">{finding.observation}</p>
      {finding.why && <p className="mt-1 text-[0.8125rem] leading-relaxed text-pretty text-ink-2">{finding.why}</p>}
      {(finding.practice || finding.suggestions?.length) && (
        <div className="mt-3 rounded-md bg-sunken px-3 py-2.5">
          <p className="text-xs font-semibold text-ink-3">Try</p>
          {finding.practice && <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-pretty">{finding.practice}</p>}
          {finding.suggestions?.map((s) => (
            <button
              key={s.direction}
              type="button"
              onClick={() => onPlay(s.span)}
              className="mt-2 flex w-full items-start gap-2 rounded-sm text-left text-[0.8125rem] leading-snug hover:text-(--hl-ink)"
            >
              <PlayIcon className="mt-0.5 size-3 shrink-0 fill-current text-ink-3" />
              <span>
                <span className="font-semibold">{s.direction === "slow_down" ? "Slow down on" : "Speed up through"}</span>{" "}
                <span className="text-ink-2">“{s.text}”</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="mt-3" onClick={() => onPlay(span)}>
        <PlayIcon className="fill-current" />
        Play this part
      </Button>
    </div>
  )
}
