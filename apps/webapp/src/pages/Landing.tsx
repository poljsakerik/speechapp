import { Link } from "@tanstack/react-router"
import { useMemo } from "react"
import { ArrowDownIcon } from "lucide-react"

import { Editor, LANE_H, LaneSignal, Pin } from "@/components/editor/Editor"
import { SiteFooter } from "@/components/site/SiteFooter"
import { Badge } from "@micmane/ui/components/badge"
import { Button } from "@micmane/ui/components/button"
import sampleTake from "@/data/sample-take.json"
import { FOUNDATIONS } from "@/lib/foundations"
import type { Take } from "@/lib/review"
import { SAMPLE_REVIEW, SAMPLE_TITLE } from "@/lib/sample"

const TAKE = sampleTake as Take
const pct = (t: number) => `${(t / TAKE.duration) * 100}%`

export function Landing() {
  return (
    <>
      <main>
        <Hero />
        <Foundations />
        <Retake />
        <Promises />
        <Try />
      </main>
      <SiteFooter />
    </>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1320px] px-4 pt-6 pb-20 sm:px-6 sm:pt-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
        <h1 className="font-wide text-[clamp(2.5rem,4.5vw,4.25rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
          Hear yourself the way they hear you.
        </h1>
        <div className="lg:pb-2">
          <p className="max-w-[46ch] text-[1.0625rem] leading-relaxed text-pretty text-ink-2">
            Explore the five foundations in the sample take. The live review currently checks rate of speech and pins
            notes to the moments where a pace change may help your point land.
          </p>
          <Button asChild size="lg" className="mt-6 sm:hidden">
            <Link to="/upload">Try a free review</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <Editor
          take={TAKE}
          review={SAMPLE_REVIEW}
          audioSrc="/sample/take.mp3"
          title={SAMPLE_TITLE}
          badge={<Badge variant="sample">Sample · synthetic voice</Badge>}
          action={
            <Button asChild size="sm">
              <Link to="/upload">Try a free review</Link>
            </Button>
          }
        />
        <p className="mt-3 text-[0.8125rem] text-ink-3">
          Press play, drag the orange playhead, or switch layers off. The review is written by hand in the format
          MicMane returns.
        </p>
      </div>
    </section>
  )
}

function SectionHeading({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
      <h2 id={id} className="font-wide text-[clamp(2rem,3.8vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance">
        {title}
      </h2>
      {children && <div className="max-w-[46ch] text-[1.0625rem] leading-relaxed text-pretty text-ink-2 lg:pb-1.5">{children}</div>}
    </div>
  )
}

function Foundations() {
  return (
    <section aria-labelledby="foundations" className="scroll-mt-16 bg-surface">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <SectionHeading id="foundations" title="Five layers. One take." />

        <ul className="mt-12 grid gap-3">
          {FOUNDATIONS.map((f) => (
            <li
              key={f.key}
              className="grid items-center gap-x-16 gap-y-4 py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
            >
              {/* Name and lane fill the heading column; the description sits in the lead column. */}
              <div className="grid items-center gap-x-10 gap-y-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                <h3 className="flex items-center gap-3 font-wide text-[1.625rem] leading-none font-bold tracking-[-0.02em]">
                  <span className="size-3.5 shrink-0 rounded-[3px]" style={{ background: f.fill, boxShadow: `inset 0 0 0 1px ${f.ink}` }} />
                  {f.label}
                </h3>
                <div
                  className="relative overflow-hidden rounded-[3px] bg-paper shadow-[inset_0_0_0_1px_var(--line)]"
                  style={{ height: LANE_H }}
                  aria-hidden="true"
                >
                  <LaneSignal foundationKey={f.key} take={TAKE} pct={pct} />
                </div>
              </div>
              <p className="max-w-[46ch] text-[1.0625rem] leading-relaxed text-pretty text-ink-2">{f.listensFor}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Take one is the sample's real level; take two is an illustration of the note being followed. */
function useRetakeCurves() {
  return useMemo(() => {
    const vol = TAKE.volume ?? []
    const n = vol.length
    const from = Math.floor((10.3 / TAKE.duration) * n)
    const to = Math.ceil((14.8 / TAKE.duration) * n)
    const drop = Math.floor((13.05 / TAKE.duration) * n) - from
    const one = vol.slice(from, to)
    // Soft gain, so the illustration never looks like a clipped signal.
    const two = one.map((v, i) => (i >= drop ? (v * 2.4) / (1 + v * 1.4) : v))
    const toPath = (values: number[]) => {
      const pts = values.map((v, i) => `${((i + 0.5) / values.length) * 1000},${(58 - v * 52).toFixed(1)}`)
      return { area: `M0,58 L${pts.join(" L")} L1000,58 Z`, line: `M${pts.join(" L")}` }
    }
    return { one: toPath(one), two: toPath(two), split: (drop / one.length) * 100 }
  }, [])
}

function Retake() {
  const curves = useRetakeCurves()
  const steps = [
    { title: "Learn", body: "A short lesson on one foundation, with the principle behind it." },
    { title: "Record", body: "Thirty seconds to a minute, on your phone or laptop." },
    { title: "Read", body: "Notes pinned to the exact second, strengths included." },
    { title: "Retake", body: "One instruction per note. Record again and compare." },
  ]
  return (
    <section aria-labelledby="retake" className="scroll-mt-16">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <SectionHeading id="retake" title="The retake is the point.">
          <p>A review only matters if the next take is better. Every note ends with something to try, and MicMane listens again.</p>
        </SectionHeading>

        {/* One ruled sequence, read like a timeline: the playhead rests on the retake. */}
        <ol className="relative mt-14 grid border-l border-line-strong pl-6 sm:grid-cols-4 sm:border-t sm:border-l-0 sm:pl-0">
          {steps.map((s, i) => (
            <li key={s.title} className="relative pb-8 last:pb-0 sm:pt-6 sm:pr-8 sm:pb-0">
              <span
                aria-hidden="true"
                className={
                  i === 3
                    ? "absolute top-0 -left-[25px] h-7 w-0.5 rounded-full bg-glass sm:-top-3 sm:left-0"
                    : "absolute top-1.5 -left-[28px] h-px w-2 bg-line-strong sm:-top-px sm:left-0 sm:h-2 sm:w-px"
                }
              />
              <p className="font-wide text-lg font-bold tracking-[-0.01em]">{s.title}</p>
              <p className="mt-2 max-w-[30ch] text-[0.9375rem] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>

        <figure className="mt-10 overflow-hidden rounded-lg border border-line-strong bg-surface">
          <div className="grid md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
            <figcaption className="border-b border-line bg-paper p-6 md:border-r md:border-b-0">
              <Badge variant="volume">Volume · to improve</Badge>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink">
                “Keep <em className="not-italic font-semibold">out loud, and mean it</em> at the level of <em className="not-italic font-semibold">So tonight</em>.”
              </p>
              <p className="mt-3 text-[0.8125rem] text-ink-3">
                Take one is the sample's measured level. Take two is an illustration of the same line with the note
                followed.
              </p>
            </figcaption>
            <div className="grid gap-2 py-3">
              {[
                { label: "Take 1", curve: curves.one, fill: "var(--f-volume)", ink: "var(--f-volume-ink)" },
                { label: "Take 2", curve: curves.two, fill: "var(--f-volume)", ink: "var(--f-volume-ink)" },
              ].map((row, i) => (
                <div key={row.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)]">
                  <p className="flex items-center px-4 text-[0.75rem] font-semibold text-ink-2">{row.label}</p>
                  <div className="relative h-24">
                    <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-2 h-16 w-full" aria-hidden="true">
                      <path d={row.curve.area} fill={row.fill} opacity={i === 0 ? 0.55 : 1} />
                      <path d={row.curve.line} fill="none" stroke={row.ink} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div
                      className="absolute top-2 bottom-2 border-l border-f-volume-ink"
                      style={{ left: `${curves.split}%` }}
                      aria-hidden="true"
                    />
                    <span className="absolute bottom-3 -translate-x-1/2" style={{ left: `${curves.split}%` }}>
                      <Pin kind={i === 0 ? "improvement" : "strength"} tentative={false} color="var(--f-volume-ink)" size={12} />
                      <span className="sr-only">{i === 0 ? "Note: the ending drops away" : "The ending held up"}</span>
                    </span>
                    <p className="absolute top-2 left-3 hidden text-[0.75rem] text-ink-3 sm:block">So tonight, I want to talk about…</p>
                    <p
                      className="absolute top-2 right-3 text-right text-[0.75rem] font-semibold"
                      style={{ color: i === 0 ? "var(--ink-3)" : "var(--f-volume-ink)" }}
                    >
                      out loud, and mean it.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </figure>
      </div>
    </section>
  )
}

function Promises() {
  const items = [
    {
      title: "How you feel.",
      body: "Tonality describes how you sound. It never guesses at your emotions, your confidence or your personality.",
    },
    {
      title: "A score.",
      body: "There is no number for your voice. You get notes on moments, and a next take.",
    },
    {
      title: "That everything is wrong.",
      body: "A delivery that already works is left alone. “No clear problem” is a real answer.",
    },
    {
      title: "The one right way.",
      body: "The same sentence can land in more than one way. When a note is a judgment call, it is marked tentative.",
    },
  ]
  return (
    <section aria-labelledby="promises" className="scroll-mt-16 bg-graphite text-[oklch(0.95_0.002_80)]">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16 lg:px-10">
        <div>
          <h2 id="promises" className="font-wide text-[clamp(2rem,3.8vw,3.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance text-[oklch(0.97_0.002_80)]">
            What it will never tell you.
          </h2>
          <p className="mt-6 max-w-[40ch] text-[1.0625rem] leading-relaxed text-[oklch(0.84_0.004_70)]">
            Hearing your own voice is exposing. The coach is built to describe what it hears, and to stop there.
          </p>
        </div>
        <ul className="grid gap-9 lg:pt-3">
          {items.map((item) => (
            <li key={item.title} className="grid gap-2">
              <p className="font-wide text-xl leading-tight font-bold tracking-[-0.015em] text-[oklch(0.97_0.002_80)]">{item.title}</p>
              <p className="max-w-[52ch] text-[0.9375rem] leading-relaxed text-[oklch(0.84_0.004_70)]">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Try() {
  return (
    <section aria-labelledby="try" className="scroll-mt-16">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <SectionHeading id="try" title="Try a free review.">
          <p className="flex items-start gap-2">
            <ArrowDownIcon className="mt-1.5 size-4 shrink-0 text-glass-ink" aria-hidden="true" />
            One take, rate of speech feedback pinned to the second.
          </p>
        </SectionHeading>
        <div className="mt-12">
          <Button asChild size="lg">
            <Link to="/upload">Upload your recording</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
