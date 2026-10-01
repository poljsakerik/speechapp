import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ListIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"

import { Badge } from "@micmane/ui/components/badge"
import { Button } from "@micmane/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@micmane/ui/components/sheet"
import { Slider } from "@micmane/ui/components/slider"
import { ToggleGroup, ToggleGroupItem } from "@micmane/ui/components/toggle-group"
import { FOUNDATIONS, FOUNDATION_BY_KEY, VERDICT_LABEL, type FoundationKey } from "@/lib/foundations"
import { formatTime, type Finding, type Review, type Take } from "@/lib/review"
import { cn } from "@micmane/ui/lib/utils"

type EditorProps = {
  take: Take
  review: Review
  audioSrc: string
  title: string
  badge?: ReactNode
  action?: ReactNode
  className?: string
}

export const LANE_H = 46
const ALL_LAYERS = FOUNDATIONS.map((f) => f.key)

/**
 * The MicMane editor: a take scrubbed across five foundation layers. Notes are
 * pinned to the second they refer to; a solid leader is a clear note, a dashed
 * one tentative; a filled pin is a strength, an open ring an improvement.
 */
export function Editor({ take, review, audioSrc, title, badge, action, className }: EditorProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [layers, setLayers] = useState<string[]>(ALL_LAYERS)
  const [awake, setAwake] = useState(false)

  // The five layers wake once, in sequence, when the editor first comes into view.
  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAwake(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) setTime(audio.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const seek = useCallback(
    (t: number) => {
      const next = Math.min(Math.max(t, 0), take.duration)
      if (audioRef.current) audioRef.current.currentTime = next
      setTime(next)
    },
    [take.duration],
  )

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (audio.ended || audio.currentTime >= take.duration - 0.05) audio.currentTime = 0
      try {
        await audio.play()
      } catch {
        setPlaying(false)
      }
    } else {
      audio.pause()
    }
  }, [take.duration])

  const visible = useMemo(
    () => review.findings.filter((f) => layers.includes(f.foundation)),
    [review.findings, layers],
  )
  const active = useMemo(() => {
    let current: Finding | undefined
    for (const f of visible) if (f.at <= time + 0.05) current = f
    return current ?? visible[0]
  }, [visible, time])

  const pct = (t: number) => `${(t / take.duration) * 100}%`
  const verdictOf = (key: FoundationKey) => review.assessments.find((a) => a.foundation === key)?.verdict

  return (
    <div
      ref={rootRef}
      data-awake={awake || undefined}
      className={cn(
        "group/editor overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[0_1px_2px_oklch(0.2_0.01_55/0.06),0_30px_80px_-40px_oklch(0.25_0.005_60/0.35)]",
        className,
      )}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest("[role=slider], button, input, a")) return
        if (event.key === " " || event.key === "k") {
          event.preventDefault()
          void toggle()
        }
      }}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setTime(take.duration)
        }}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-3 py-2.5 sm:px-4">
        <Button
          variant={playing ? "glass" : "glassOff"}
          size="icon"
          className="rounded-full"
          onClick={() => void toggle()}
          aria-label={playing ? "Pause the take" : time >= take.duration - 0.05 ? "Replay the take" : "Play the take"}
        >
          {playing ? (
            <PauseIcon className="fill-current" />
          ) : time >= take.duration - 0.05 ? (
            <RotateCcwIcon />
          ) : (
            <PlayIcon className="translate-x-px fill-current" />
          )}
        </Button>
        <p className="font-mono text-[0.75rem] tracking-tight text-ink-3 tabular" aria-live="off">
          <span className="text-ink">{formatTime(time)}</span> / {formatTime(take.duration)}
        </p>
        <div className="hidden h-5 w-px bg-line sm:block" />
        <div className="flex min-w-0 items-center gap-2.5">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {badge}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {action && <div className="hidden sm:block">{action}</div>}
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
        <div className="min-w-0 md:border-r md:border-line">
          <Monitor take={take} time={time} active={active} />
          {/* Timeline */}
          <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] border-t border-line sm:grid-cols-[8.5rem_minmax(0,1fr)]">
            {/* Label column */}
            <div className="border-r border-line bg-paper">
              <div className="h-7" />
              <RowLabel className="h-11">Words</RowLabel>
              <RowLabel className="h-14">Take</RowLabel>
              <ToggleGroup
                type="multiple"
                value={layers}
                onValueChange={(value) => setLayers(value)}
                orientation="vertical"
                spacing={0}
                className="w-full gap-0! bg-transparent! p-0!"
                aria-label="Foundation layers"
              >
                {FOUNDATIONS.map((f) => {
                  const verdict = verdictOf(f.key)
                  return (
                    <ToggleGroupItem
                      key={f.key}
                      value={f.key}
                      variant="layer"
                      className="h-[46px]! w-full rounded-none!"
                      aria-label={`${f.label} layer${verdict ? `, ${VERDICT_LABEL[verdict]}` : ""}`}
                    >
                      <span data-swatch className="size-2.5 shrink-0 rounded-[2px] transition-opacity" style={{ background: f.fill, boxShadow: `inset 0 0 0 1px ${f.ink}` }} />
                      <span className="flex min-w-0 flex-col leading-none">
                        <span className="truncate text-[0.75rem] font-semibold">{f.short}</span>
                        {verdict && (
                          <span className="mt-1 hidden truncate text-[0.625rem] font-normal text-ink-3 sm:block">
                            {VERDICT_LABEL[verdict]}
                          </span>
                        )}
                      </span>
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </div>

            {/* Track column */}
            <div className="relative min-w-0">
              <div className="relative h-7 border-b border-line">
                <Ruler duration={take.duration} />
                <Slider
                  aria-label="Scrub the take"
                  min={0}
                  max={take.duration}
                  step={0.1}
                  value={[time]}
                  onValueChange={([value]) => seek(value)}
                  className="absolute inset-x-0 bottom-0 h-full **:data-[slot=slider-track]:opacity-0 **:data-[slot=slider-range]:opacity-0"
                />
              </div>
              <div
                className="relative cursor-text"
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return
                  const box = event.currentTarget.getBoundingClientRect()
                  seek(((event.clientX - box.left) / box.width) * take.duration)
                }}
              >
                <CaptionTrack take={take} time={time} pct={pct} />
                <Waveform take={take} time={time} />
                {FOUNDATIONS.map((f, index) => (
                  <Lane
                    key={f.key}
                    foundationKey={f.key}
                    take={take}
                    index={index}
                    hidden={!layers.includes(f.key)}
                    findings={review.findings.filter((n) => n.foundation === f.key)}
                    active={active}
                    onPin={(n) => seek(n.at)}
                    pct={pct}
                  />
                ))}
                {active && layers.includes(active.foundation) && (
                  <Leader finding={active} pct={pct} />
                )}
              </div>
              {/* Playhead */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-glass shadow-[0_0_0_1px_oklch(1_0_0/0.8)]"
                style={{ left: pct(time) }}
              />
            </div>
          </div>
        </div>

        <NotesRail
          review={review}
          findings={visible}
          active={active}
          onSelect={(f) => seek(f.at)}
        />
      </div>
    </div>
  )
}

function RowLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center px-2 text-[0.6875rem] font-medium text-ink-3", className)}>
      {children}
    </div>
  )
}

function Ruler({ duration }: { duration: number }) {
  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i)
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {ticks.map((s) => (
        <div
          key={s}
          className="absolute bottom-0 flex flex-col items-start"
          style={{ left: `${(s / duration) * 100}%` }}
        >
          {s % 5 === 0 && s > 0 && s < duration - 1.2 && (
            <span className="mb-0.5 -translate-x-1/2 font-mono text-[0.5625rem] text-ink-3 tabular">
              {formatTime(s, false)}
            </span>
          )}
          <span className={cn("w-px bg-line-strong", s % 5 === 0 ? "h-2.5" : "h-1.5")} />
        </div>
      ))}
    </div>
  )
}

function Monitor({ take, time, active }: { take: Take; time: number; active?: Finding }) {
  const segment =
    [...take.segments].reverse().find((s) => s.start <= time + 0.05) ?? take.segments[0]
  const foundation = active ? FOUNDATION_BY_KEY[active.foundation] : undefined
  const span = active?.span
  const marked = (t: number) => !!span && t >= span[0] - 0.01 && t <= span[1] + 0.01
  return (
    <div className="relative flex min-h-36 flex-col justify-center px-5 py-6 sm:min-h-44 sm:px-8">
      <p className="mb-3 font-mono text-[0.6875rem] text-ink-3 tabular">
        {formatTime(segment.start)} – {formatTime(segment.end)}
      </p>
      <p
        className="max-w-[34ch] font-wide text-[1.375rem] leading-[1.25] font-semibold tracking-[-0.015em] text-balance sm:text-[1.875rem]"
        aria-live="polite"
      >
        {segment.words.map((w, i) => {
          const spoken = w.start <= time
          const on = marked(w.start)
          const next = segment.words[i + 1]
          const joined = on && next && marked(next.start)
          return (
            <span key={i}>
              <span
                className={cn(
                  "transition-colors duration-150 [box-decoration-break:clone]",
                  spoken ? "text-ink" : on ? "text-ink-2" : "text-ink-3",
                  on && "rounded-[3px] px-[0.08em]",
                  on && joined && "rounded-r-none pr-[0.28em]",
                  on && i > 0 && marked(segment.words[i - 1].start) && "-ml-[0.28em] rounded-l-none pl-[0.28em]",
                )}
                style={on && foundation ? { background: foundation.fill } : undefined}
              >
                {w.text}
              </span>{" "}
            </span>
          )
        })}
      </p>
    </div>
  )
}

function CaptionTrack({ take, time, pct }: { take: Take; time: number; pct: (t: number) => string }) {
  return (
    <div className="relative h-11">
      {take.segments.map((s) => {
        if (s.end - s.start < 1.6) return null
        const current = s.start <= time && time < s.end
        return (
          <div
            key={s.id}
            className={cn(
              "absolute top-1.5 bottom-1.5 overflow-hidden rounded-[3px] border px-1.5 py-1 text-[0.625rem] leading-[1.3] transition-colors",
              current ? "border-ink/40 bg-sunken text-ink" : "border-line bg-surface text-ink-3",
            )}
            style={{ left: pct(s.start), width: `calc(${pct(s.end - s.start)} - 2px)` }}
          >
            <span className="line-clamp-2 break-words">{s.text}</span>
          </div>
        )
      })}
    </div>
  )
}

function Waveform({ take, time }: { take: Take; time: number }) {
  const path = useMemo(() => {
    const n = take.peaks.length
    return take.peaks
      .map((p, i) => {
        const x = ((i + 0.5) / n) * 1000
        const h = Math.max(0.6, p * 21)
        return `M${x.toFixed(1)} ${(24 - h).toFixed(1)}V${(24 + h).toFixed(1)}`
      })
      .join("")
  }, [take.peaks])
  const played = (time / take.duration) * 100
  return (
    <div className="relative h-14">
      <svg viewBox="0 0 1000 48" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <path d={path} stroke="var(--line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path
          d={path}
          stroke="var(--ink)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          style={{ clipPath: `inset(0 ${100 - played}% 0 0)` }}
        />
      </svg>
    </div>
  )
}

type LaneProps = {
  foundationKey: FoundationKey
  take: Take
  index: number
  hidden: boolean
  findings: Finding[]
  active?: Finding
  onPin: (f: Finding) => void
  pct: (t: number) => string
}

function Lane({ foundationKey, take, index, hidden, findings, active, onPin, pct }: LaneProps) {
  const f = FOUNDATION_BY_KEY[foundationKey]
  return (
    <div
      className={cn(
        "relative transition-opacity duration-300",
        hidden && "opacity-25",
      )}
      style={{ height: LANE_H }}
    >
      <div
        className="absolute inset-0 transition-[clip-path] duration-[1100ms] ease-(--ease-out) [clip-path:inset(0_100%_0_0)] group-data-awake/editor:[clip-path:inset(0_0_0_0)] motion-reduce:transition-none"
        style={{ transitionDelay: `${index * 150}ms` }}
      >
        <LaneSignal foundationKey={foundationKey} take={take} pct={pct} />
      </div>
      {!hidden &&
        findings.map((n) => {
          const isActive = active?.id === n.id
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onPin(n)}
              aria-label={`${formatTime(n.at)} · ${f.label} · ${n.kind === "strength" ? "strength" : "to improve"}${n.uncertainty === "tentative" ? ", tentative" : ""}`}
              className={cn(
                "absolute top-1/2 z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full opacity-0 transition-[opacity,transform] duration-500 group-data-awake/editor:opacity-100 hover:scale-110",
              )}
              style={{ left: pct(n.at), transitionDelay: `${900 + index * 150}ms` }}
            >
              <Pin kind={n.kind} tentative={n.uncertainty === "tentative"} color={f.ink} active={isActive} />
            </button>
          )
        })}
    </div>
  )
}

export function Pin({
  kind,
  tentative,
  color,
  active,
  size = 12,
}: {
  kind: Finding["kind"]
  tentative: boolean
  color: string
  active?: boolean
  size?: number
}) {
  const r = size / 2 - 1.5
  return (
    <svg width={size + 8} height={size + 8} viewBox={`0 0 ${size + 8} ${size + 8}`} aria-hidden="true">
      {active && <circle cx={(size + 8) / 2} cy={(size + 8) / 2} r={size / 2 + 3} fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1" />}
      <circle
        cx={(size + 8) / 2}
        cy={(size + 8) / 2}
        r={r}
        fill={kind === "strength" ? color : "var(--surface)"}
        stroke={color}
        strokeWidth={kind === "strength" ? 1.5 : 2}
        strokeDasharray={tentative ? "2.2 1.6" : undefined}
      />
    </svg>
  )
}

export function LaneSignal({ foundationKey, take, pct }: { foundationKey: FoundationKey; take: Take; pct: (t: number) => string }) {
  const f = FOUNDATION_BY_KEY[foundationKey]
  const H = LANE_H
  const mid = H / 2

  if (foundationKey === "rate") {
    const rates = take.segments.map((s) => s.wpm ?? Math.round((s.words.length / Math.max(s.end - s.start, 0.1)) * 60))
    const lo = Math.min(...rates)
    const hi = Math.max(...rates)
    return (
      <>
        {take.segments.map((s, i) => {
          const h = 6 + ((rates[i] - lo) / Math.max(hi - lo, 1)) * (H - 16)
          return (
            <div
              key={s.id}
              className="absolute rounded-[2px]"
              style={{ left: pct(s.start), width: pct(s.end - s.start), top: mid - h / 2, height: h, background: f.fill }}
            >
              {s.end - s.start > 1.6 && (
                <span className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 font-mono text-[0.5625rem] whitespace-nowrap tabular lg:block" style={{ color: f.ink }}>
                  {rates[i]} wpm
                </span>
              )}
            </div>
          )
        })}
      </>
    )
  }

  if (foundationKey === "volume" && take.volume) {
    const n = take.volume.length
    const top = take.volume.map((v, i) => `${((i + 0.5) / n) * 1000},${(H - 3 - v * (H - 8)).toFixed(1)}`)
    const d = `M0,${H - 3} L${top.join(" L")} L1000,${H - 3} Z`
    return (
      <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <path d={d} fill={f.fill} />
        <path d={`M${top.join(" L")}`} fill="none" stroke={f.ink} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  if (foundationKey === "pitch_melody" && take.pitch) {
    const n = take.pitch.length
    const runs: string[] = []
    let run: string[] = []
    take.pitch.forEach((v, i) => {
      if (v === null) {
        if (run.length > 1) runs.push(run.join(" L"))
        run = []
        return
      }
      run.push(`${((i + 0.5) / n) * 1000},${(mid - (Math.max(-9, Math.min(9, v)) / 9) * (mid - 4)).toFixed(1)}`)
    })
    if (run.length > 1) runs.push(run.join(" L"))
    return (
      <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <line x1="0" x2="1000" y1={mid} y2={mid} stroke={f.fill} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {runs.map((r, i) => (
          <path key={i} d={`M${r}`} fill="none" stroke={f.ink} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    )
  }

  if (foundationKey === "pauses") {
    return (
      <>
        {take.pauses.map((p, i) => {
          const d = p.end - p.start
          return (
            <div
              key={i}
              className="absolute top-1.5 bottom-1.5 rounded-[2px]"
              style={{ left: pct(p.start), width: pct(d), background: f.fill }}
            >
              {d >= 0.6 && (
                <span className="absolute top-1/2 right-1 hidden -translate-y-1/2 font-mono text-[0.5625rem] whitespace-nowrap tabular xl:block" style={{ color: f.ink }}>
                  {d.toFixed(1)} s
                </span>
              )}
            </div>
          )
        })}
      </>
    )
  }

  // Tonality is heard, not measured: spans of speech, hatched, with no fake signal.
  return (
    <>
      {take.segments.map((s) => (
        <div
          key={s.id}
          className="absolute top-2.5 bottom-2.5 rounded-[2px]"
          style={{
            left: pct(s.start),
            width: pct(s.end - s.start),
            backgroundImage: `repeating-linear-gradient(115deg, ${f.fill} 0 3px, transparent 3px 6px)`,
          }}
        />
      ))}
      {foundationKey === "tonality" && (
        <span className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-[2px] bg-surface px-1 text-[0.5625rem] text-ink-3 lg:block">
          heard, not measured
        </span>
      )}
    </>
  )
}

function Leader({ finding, pct }: { finding: Finding; pct: (t: number) => string }) {
  const f = FOUNDATION_BY_KEY[finding.foundation]
  const index = FOUNDATIONS.findIndex((x) => x.key === finding.foundation)
  // From the caption track down to the pin's lane centre.
  const top = 4
  const bottom = 44 + 56 + index * LANE_H + LANE_H / 2 - 7
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute w-0"
      style={{
        left: pct(finding.at),
        top,
        height: bottom - top,
        borderLeft: `1px ${finding.uncertainty === "tentative" ? "dashed" : "solid"} ${f.ink}`,
      }}
    />
  )
}

function NoteBody({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3 text-[0.8125rem] leading-[1.55]">
      <p className="text-ink">{finding.observation}</p>
      <p className="text-ink-2">{finding.why}</p>
      <div className="rounded-md border border-line bg-paper px-3 py-2.5">
        <p className="mb-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-ink">
          <span className="size-1.5 rounded-full bg-ink" />
          Next take
        </p>
        <p className="text-ink">{finding.practice}</p>
      </div>
    </div>
  )
}

function NoteRow({ finding, active, onSelect }: { finding: Finding; active: boolean; onSelect: () => void }) {
  const f = FOUNDATION_BY_KEY[finding.foundation]
  return (
    <li data-active={active || undefined} className={cn("mx-2 rounded-md transition-[background-color,box-shadow]", active && "bg-surface shadow-[0_0_0_1px_var(--line),0_4px_14px_-8px_oklch(0.2_0.005_60/0.25)]")}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active || undefined}
        className="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
      >
        <span className="mt-px w-14 shrink-0 font-mono text-[0.6875rem] text-ink-3 tabular">{formatTime(finding.at)}</span>
        <span className="-mt-0.5 grid w-5 shrink-0 place-items-center">
          <Pin kind={finding.kind} tentative={finding.uncertainty === "tentative"} color={f.ink} size={10} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[0.75rem] font-semibold" style={{ color: f.ink }}>
            {f.label}
            <span className="font-normal text-ink-3">
              {finding.kind === "strength" ? "Strength" : "To improve"}
              {finding.uncertainty === "tentative" && " · tentative"}
            </span>
          </span>
          {!active && <span className="mt-0.5 line-clamp-1 text-[0.8125rem] text-ink-2">{finding.observation}</span>}
        </span>
      </button>
      {active && (
        <div className="pr-3 pb-4 pl-[6.75rem]">
          <NoteBody finding={finding} />
        </div>
      )}
    </li>
  )
}

function NotesRail({
  review,
  findings,
  active,
  onSelect,
}: {
  review: Review
  findings: Finding[]
  active?: Finding
  onSelect: (f: Finding) => void
}) {
  // Keep the active note, including its next-take line, in view inside the rail only.
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>("[data-active]")
    if (!list || !item) return
    // Always land on a row boundary, so no header is ever sliced by the rail's edge.
    const top = item.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTo({ top, behavior: "smooth" })
  }, [active?.id])
  const [scrolled, setScrolled] = useState(false)
  return (
    <>
      {/* Desktop: the full rail */}
      <aside className="relative hidden bg-paper md:block" aria-label="Review notes">
        <div className="absolute inset-0 flex flex-col">
        <div className="border-b border-line px-4 py-4">
          <p className="text-[0.8125rem] leading-[1.5] text-pretty text-ink-2">{review.overall}</p>
          {review.nextTake && (
            <p className="mt-2 text-[0.8125rem] font-semibold text-ink">Next take: {review.nextTake}</p>
          )}
        </div>
        <ol
          ref={listRef}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 transition-shadow",
            scrolled && "shadow-[inset_0_10px_10px_-10px_oklch(0.2_0.01_55/0.25)]",
          )}
        >
          {findings.map((n) => (
            <NoteRow key={n.id} finding={n} active={n.id === active?.id} onSelect={() => onSelect(n)} />
          ))}
          {findings.length === 0 && (
            <li className="px-4 py-6 text-[0.8125rem] text-ink-3">All layers are hidden. Turn one back on to see its notes.</li>
          )}
          {/* End space, so even the last note can scroll up to a row boundary. */}
          {findings.length > 0 && <li aria-hidden="true" className="h-[70%]" />}
        </ol>
        </div>
      </aside>

      {/* Phone: the active note, with all notes in a sheet */}
      <div className="border-t border-line bg-paper md:hidden">
        {active ? (
          <div className="px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-[0.75rem]">
              <span className="font-mono text-ink-3 tabular">{formatTime(active.at)}</span>
              <Pin kind={active.kind} tentative={active.uncertainty === "tentative"} color={FOUNDATION_BY_KEY[active.foundation].ink} size={10} />
              <span className="font-semibold" style={{ color: FOUNDATION_BY_KEY[active.foundation].ink }}>
                {FOUNDATION_BY_KEY[active.foundation].label}
              </span>
            </div>
            <NoteBody finding={active} />
          </div>
        ) : (
          <p className="px-4 py-4 text-[0.8125rem] text-ink-3">All layers are hidden.</p>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="h-12 w-full justify-start rounded-none border-t border-line px-4">
              <ListIcon />
              All notes
              <Badge variant="secondary" className="ml-auto">{findings.length}</Badge>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80svh] gap-0">
            <SheetHeader className="border-b border-line">
              <SheetTitle>Notes</SheetTitle>
              <SheetDescription>{review.overall}</SheetDescription>
            </SheetHeader>
            <ol className="overflow-y-auto">
              {findings.map((n) => (
                <NoteRow key={n.id} finding={n} active={n.id === active?.id} onSelect={() => onSelect(n)} />
              ))}
            </ol>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
