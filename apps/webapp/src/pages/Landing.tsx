import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, MicIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";

import { LANE_H, LaneSignal, Pin } from "@/components/editor/Editor";
import { CoverArt } from "@/components/liner/CoverArt";
import { LyricSheet } from "@/components/liner/LyricSheet";
import { useTakePlayer } from "@/components/liner/useTakePlayer";
import { SiteFooter } from "@/components/site/SiteFooter";
import sampleTake from "@/data/sample-take.json";
import { FOUNDATIONS, FOUNDATION_BY_KEY } from "@/lib/foundations";
import { formatTime, type Take } from "@/lib/review";
import { SAMPLE_REVIEW, SAMPLE_TITLE } from "@/lib/sample";
import { Badge } from "@micmane/ui/components/badge";
import { Button } from "@micmane/ui/components/button";
import { cn } from "@micmane/ui/lib/utils";

const TAKE = sampleTake as Take;
/** The hero sleeve is promotional: a full cover, every foundation earned. */
const COVER_PALETTE = FOUNDATIONS.map((f) => f.fill);
const pct = (t: number) => `${(t / TAKE.duration) * 100}%`;

/*
 * The page is a booklet spread on one twelve-column grid: the left five
 * columns hold covers and titles, the right seven hold the reading. Every
 * section keeps that split, so the page has one rhythm from top to bottom.
 */
const SHELL = "mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10";
const SPREAD = "grid gap-x-12 gap-y-12 lg:grid-cols-12 lg:gap-x-16";
const LEFT = "lg:col-span-5";
const RIGHT = "lg:col-span-7 lg:col-start-6";
const H2 =
  "font-wide text-[clamp(2rem,3.4vw,3.25rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance";
const LEAD = "max-w-[46ch] text-[1.0625rem] leading-7 text-pretty text-ink-2";

/** A white booklet page: the page the notes are written on. */
const PAGE = "booklet-page";

export function Landing() {
  return (
    <>
      <main>
        <Hero />
        <Lessons />
        <Retake />
        <Promises />
        <Record />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  const player = useTakePlayer(TAKE.duration);
  const { time, playing, started, toggle, playFrom } = player;
  const progress = Math.min(1, time / TAKE.duration);
  const sheetRef = useRef<HTMLDivElement>(null);

  // The example plays where it can be read: bring the sheet up, then start the take.
  const seeExample = () => {
    if (playing) return void toggle();
    sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void (started ? toggle() : playFrom(0));
  };

  return (
    <section
      id="sample"
      aria-labelledby="hero-title"
      className={cn(
        SHELL,
        "scroll-mt-20 pt-12 pb-24 sm:pt-16 lg:pt-20 lg:pb-36",
      )}
    >
      <audio src="/sample/take.mp3" {...player.audioProps} />
      <div className={SPREAD}>
        <div className={cn(RIGHT, "lg:row-start-1")}>
          <h1
            id="hero-title"
            className="font-wide text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance"
          >
            Unlock the full potential of your voice.
          </h1>
          <p className={cn(LEAD, "mt-6")}>
            Learn what makes a voice carry, practise out loud with a coach that
            listens, and grow more confident one take at a time.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/upload">Try a free review</Link>
            </Button>
            <Button variant="outline" size="lg" onClick={seeExample}>
              {playing ? (
                <PauseIcon aria-hidden="true" className="text-glass-ink" />
              ) : (
                <PlayIcon
                  aria-hidden="true"
                  className="fill-glass text-glass"
                />
              )}
              {playing ? "Pause the example" : "See an example"}
              <span className="font-mono text-[0.75rem] text-ink-3 tabular">
                0:15
              </span>
            </Button>
          </div>
        </div>

        <div
          className={cn(LEFT, "lg:col-start-1 lg:row-span-2 lg:row-start-1")}
        >
          <div className="lg:sticky lg:top-20">
            <CoverArt
              take={TAKE}
              review={SAMPLE_REVIEW}
              title={SAMPLE_TITLE}
              time={time}
              live={started}
              palette={COVER_PALETTE}
              className="cover-shadow"
              top={
                <>
                  <span className="font-wide text-[0.9375rem] font-extrabold tracking-[-0.02em]">
                    MicMane
                  </span>
                  <span className="font-mono text-[0.6875rem] text-on-graphite-muted tabular">
                    MMV 001
                  </span>
                </>
              }
              bottom={
                <>
                  <span className="min-w-0">
                    <span className="block font-wide text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-extrabold tracking-[-0.03em]">
                      {SAMPLE_TITLE}
                    </span>
                    <span className="mt-2 block font-mono text-[0.75rem] text-on-graphite-muted tabular">
                      Take 1 · 0:15
                    </span>
                  </span>
                  <Button
                    variant="glass"
                    size="icon-lg"
                    className="shrink-0 rounded-full"
                    onClick={() => void toggle()}
                    aria-label={
                      playing
                        ? "Pause the example take"
                        : "Play the example take"
                    }
                  >
                    {playing ? (
                      <PauseIcon className="fill-current" />
                    ) : (
                      <PlayIcon className="translate-x-px fill-current" />
                    )}
                  </Button>
                </>
              }
            />
          </div>
        </div>

        <div
          ref={sheetRef}
          className={cn(RIGHT, "scroll-mt-24 lg:row-start-2")}
        >
          <div
            className={cn(PAGE, "px-4 py-6 sm:px-8 sm:py-8 xl:px-12 xl:py-10")}
          >
            <LyricSheet
              take={TAKE}
              review={SAMPLE_REVIEW}
              time={time}
              started={started}
              onPlayFrom={(t) => void playFrom(t)}
              header={
                <div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="font-wide text-[1.125rem] font-bold tracking-[-0.01em]">
                      Notes on “{SAMPLE_TITLE}”
                    </p>
                    <p
                      className="ml-auto font-mono text-[0.75rem] text-ink-3 tabular"
                      aria-live="off"
                    >
                      <span className={playing ? "text-glass-ink" : undefined}>
                        {formatTime(time)}
                      </span>{" "}
                      / {formatTime(TAKE.duration)}
                    </p>
                  </div>
                  <div
                    className="relative mt-4 h-px bg-line"
                    aria-hidden="true"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-glass"
                      style={{
                        width: `${progress * 100}%`,
                        height: 2,
                        top: -0.5,
                      }}
                    />
                  </div>
                </div>
              }
              footer={
                <div className="mt-10 grid gap-x-6 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                  <p className="pt-1 text-[0.75rem] font-semibold text-ink-3">
                    Overall
                  </p>
                  <div>
                    <p className="max-w-[52ch] text-[0.9375rem] leading-6 text-ink-2">
                      {SAMPLE_REVIEW.overall}
                    </p>
                    {SAMPLE_REVIEW.nextTake && (
                      <p className="mt-4 flex max-w-[34ch] items-start gap-2 font-wide text-[1.25rem] leading-7 font-bold tracking-[-0.015em]">
                        <ArrowRightIcon
                          className="mt-1.5 size-4 shrink-0 text-ink"
                          aria-hidden="true"
                        />
                        {SAMPLE_REVIEW.nextTake}
                      </p>
                    )}
                  </div>
                </div>
              }
            />
          </div>
          <p className="mt-4 text-[0.8125rem] leading-5 text-ink-3">
            Press a timecode or a note to hear that passage. The live review
            checks rate of speech for now; the other four foundations are shown
            as they will read.
          </p>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn(LEFT, "lg:col-start-1")}>
      <div className="lg:sticky lg:top-24">
        <h2 id={id} className={H2}>
          {title}
        </h2>
        {children && <div className={cn(LEAD, "mt-6")}>{children}</div>}
      </div>
    </div>
  );
}

function Lessons() {
  return (
    <section
      id="lessons"
      aria-labelledby="lessons-title"
      className="scroll-mt-14 bg-surface"
    >
      <div className={cn(SHELL, SPREAD, "py-24 lg:py-36")}>
        <SectionTitle id="lessons-title" title="Five lessons. Every take kept.">
          <p>
            The course follows five foundations, in order. Each lesson is one
            page: the lesson at the top, then every take you record under it,
            with its notes, so you can scroll back and hear what changed.
          </p>
        </SectionTitle>

        <div className={RIGHT}>
          <ol className="grid gap-y-10">
            {FOUNDATIONS.map((f, i) => (
              <li
                key={f.key}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-6 sm:grid-cols-[3rem_minmax(0,1fr)]"
              >
                <span
                  className="pt-2 font-mono text-[0.875rem] leading-6 text-ink-3 tabular"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="font-wide text-[1.5rem] leading-10 font-bold tracking-[-0.02em]">
                    <span className="sr-only">Lesson {i + 1}: </span>
                    {f.label}
                  </h3>
                  <p className="max-w-[52ch] text-[0.9375rem] leading-6 text-ink-2">
                    {f.listensFor}
                  </p>
                  <div
                    className="relative mt-4 overflow-hidden rounded-[4px] bg-paper shadow-[inset_0_0_0_1px_var(--line)]"
                    style={{ height: LANE_H }}
                    aria-hidden="true"
                  >
                    <LaneSignal
                      foundationKey={f.key}
                      take={TAKE}
                      pct={pct}
                      labels={false}
                    />
                  </div>
                  <p className="mt-2 text-[0.75rem] leading-5 text-ink-3">
                    {f.measure}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10 pl-16 text-[0.8125rem] leading-5 text-ink-3 sm:pl-[4.5rem]">
            Each strip is the same sample take, read through one foundation.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Take one is the sample's real level; take two is an illustration of the note being followed. */
function useRetakeCurves() {
  return useMemo(() => {
    const vol = TAKE.volume ?? [];
    const n = vol.length;
    const from = Math.floor((10.3 / TAKE.duration) * n);
    const to = Math.ceil((14.8 / TAKE.duration) * n);
    const drop = Math.floor((13.05 / TAKE.duration) * n) - from;
    const one = vol.slice(from, to);
    // Soft gain, so the illustration never looks like a clipped signal.
    const two = one.map((v, i) => (i >= drop ? (v * 2.4) / (1 + v * 1.4) : v));
    const toPath = (values: number[]) => {
      const pts = values.map(
        (v, i) =>
          `${((i + 0.5) / values.length) * 1000},${(58 - v * 52).toFixed(1)}`,
      );
      return {
        area: `M0,58 L${pts.join(" L")} L1000,58 Z`,
        line: `M${pts.join(" L")}`,
      };
    };
    return {
      one: toPath(one),
      two: toPath(two),
      split: (drop / one.length) * 100,
    };
  }, []);
}

function Retake() {
  const curves = useRetakeCurves();
  const volume = FOUNDATION_BY_KEY.volume;
  const note = SAMPLE_REVIEW.findings.find((f) => f.foundation === "volume");
  const takes = [
    {
      label: "Take 1",
      tag: "Needs work",
      curve: curves.one,
      kind: "improvement" as const,
      note: "The ending drops away on “out loud, and mean it”.",
    },
    {
      label: "Take 2",
      tag: "Effective",
      curve: curves.two,
      kind: "strength" as const,
      note: "The ending holds at the level of “So tonight”.",
      illustration: true,
    },
  ];

  return (
    <section
      id="retake"
      aria-labelledby="retake-title"
      className="scroll-mt-14"
    >
      <div className={cn(SHELL, SPREAD, "py-24 lg:py-36")}>
        <SectionTitle id="retake-title" title="The retake is the point.">
          <p>
            A review only matters if the next take is better. Every note ends
            with something to try, and MicMane listens again.
          </p>
        </SectionTitle>

        <div className={RIGHT}>
          <article
            className={cn(PAGE, "px-4 py-6 sm:px-8 sm:py-8")}
            aria-label="The Volume lesson page, with two takes of the same line"
          >
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                className="size-3.5 rounded-[3px]"
                style={{
                  background: volume.fill,
                  boxShadow: `inset 0 0 0 1px ${volume.ink}`,
                }}
                aria-hidden="true"
              />
              <h3 className="font-wide text-[1.125rem] font-bold tracking-[-0.01em]">
                Volume
              </h3>
              <p className="text-[0.8125rem] text-ink-3">
                Lesson 2 · one line, practised
              </p>
              <p className="ml-auto flex items-center gap-2 text-[0.75rem] font-semibold">
                <span className="text-ink-3">Needs work</span>
                <ArrowRightIcon
                  className="size-3.5 text-ink-3"
                  aria-hidden="true"
                />
                <span style={{ color: volume.ink }}>Effective</span>
              </p>
            </header>

            {/* The takes hang off one spine: a timeline of attempts, newest last. */}
            <ol className="relative mt-8 grid gap-y-8 pl-8 before:absolute before:top-2 before:bottom-10 before:left-[7.5px] before:w-px before:bg-line-strong">
              {takes.map((t, i) => (
                <li key={t.label} className="relative">
                  <span
                    className="absolute top-1 -left-8 size-4 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-wide text-[1rem] font-bold">{t.label}</p>
                    <p
                      className="text-[0.75rem] font-semibold"
                      style={{
                        color:
                          t.kind === "strength" ? volume.ink : "var(--ink-3)",
                      }}
                    >
                      {t.tag}
                    </p>
                    {t.illustration && (
                      <Badge variant="sample">Illustration</Badge>
                    )}
                  </div>
                  <div className="relative mt-3 h-24">
                    <svg
                      viewBox="0 0 1000 60"
                      preserveAspectRatio="none"
                      className="absolute inset-x-0 bottom-0 h-16 w-full"
                      aria-hidden="true"
                    >
                      <path
                        d={t.curve.area}
                        fill={volume.fill}
                        opacity={i === 0 ? 0.6 : 1}
                        style={{ mixBlendMode: "multiply" }}
                      />
                      <path
                        d={t.curve.line}
                        fill="none"
                        stroke={volume.ink}
                        strokeWidth="1.25"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <div
                      className="absolute top-6 bottom-0 border-l border-dashed"
                      style={{
                        left: `${curves.split}%`,
                        borderColor: volume.ink,
                      }}
                      aria-hidden="true"
                    />
                    <span
                      className="absolute bottom-1 -translate-x-1/2"
                      style={{ left: `${curves.split}%` }}
                      aria-hidden="true"
                    >
                      <Pin
                        kind={t.kind}
                        tentative={false}
                        color={volume.ink}
                        size={12}
                      />
                    </span>
                    <p className="absolute top-0 left-0 hidden text-[0.75rem] text-ink-3 sm:block">
                      So tonight, I want to talk about…
                    </p>
                    <p
                      className="absolute top-0 right-0 text-right text-[0.75rem] font-semibold"
                      style={{ color: i === 0 ? "var(--ink-3)" : volume.ink }}
                    >
                      out loud, and mean it.
                    </p>
                  </div>
                  <p className="mt-3 max-w-[52ch] text-[0.8125rem] leading-5 text-ink-2">
                    {t.note}
                  </p>
                </li>
              ))}

              <li className="relative">
                <span
                  className="absolute top-1 -left-8 size-4 rounded-full glass-lit"
                  aria-hidden="true"
                />
                <div className="rounded-[8px] border border-dashed border-line-strong bg-surface/80 p-5">
                  <p className="font-wide text-[1rem] font-bold">
                    Take 3 is yours
                  </p>
                  {note && (
                    <p className="mt-2 max-w-[52ch] text-[0.9375rem] leading-6 text-ink">
                      {note.practice}
                    </p>
                  )}
                  <Button asChild className="mt-4">
                    <Link to="/upload">
                      <MicIcon aria-hidden="true" />
                      Record a take
                    </Link>
                  </Button>
                </div>
              </li>
            </ol>
          </article>
          <p className="mt-4 text-[0.8125rem] leading-5 text-ink-3">
            Take one is the sample's measured level. Take two is drawn to show
            the same line with the note followed.
          </p>
        </div>
      </div>
    </section>
  );
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
  ];
  return (
    <section
      id="promises"
      aria-labelledby="promises-title"
      className="scroll-mt-14 bg-graphite text-on-graphite"
    >
      <div className={cn(SHELL, SPREAD, "py-24 lg:py-36")}>
        <div className={cn(LEFT, "lg:col-start-1")}>
          <h2 id="promises-title" className={H2}>
            What it will never tell you.
          </h2>
          <p className="mt-6 max-w-[40ch] text-[1.0625rem] leading-7 text-on-graphite-muted">
            Hearing your own voice is exposing. The coach is built to describe
            what it hears, and to stop there.
          </p>
        </div>
        {/* Set like liner notes: one continuous text in two columns, run-in titles. */}
        <div className={cn(RIGHT, "gap-x-12 lg:pt-2 xl:columns-2")}>
          {items.map((item) => (
            <p
              key={item.title}
              className="mb-8 break-inside-avoid text-[1.0625rem] leading-7 text-on-graphite-muted"
            >
              <span className="font-wide font-bold tracking-[-0.01em] text-on-graphite">
                {item.title}
              </span>{" "}
              {item.body}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Record() {
  return (
    <section
      id="record"
      aria-labelledby="record-title"
      className="scroll-mt-14"
    >
      <div className={cn(SHELL, SPREAD, "items-center py-24 lg:py-36")}>
        <div className={cn(LEFT, "lg:col-start-1")}>
          <EmptyCover />
        </div>
        <div className={RIGHT}>
          <h2 id="record-title" className={H2}>
            Record your first take.
          </h2>
          <p className={cn(LEAD, "mt-6")}>
            Thirty seconds to a minute, on your phone or laptop. The free review
            checks rate of speech and pins its notes to the second.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/upload">Try a free review</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** The visitor's own sleeve, not yet pressed: the ridges wait as outlines. */
function EmptyCover() {
  const bases = [168, 243, 318, 392];
  return (
    <figure className="relative mx-auto aspect-square w-full max-w-[22rem] overflow-hidden rounded-[10px] bg-graphite text-on-graphite cover-shadow lg:mx-0 lg:max-w-none">
      <svg
        viewBox="0 0 600 600"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        {bases.map((b, i) => (
          <path
            key={b}
            d={`M44,${b} C140,${b - 40 - i * 6} 220,${b - 90 + i * 10} 300,${b - 70} S470,${b - 30 - i * 8} 556,${b}`}
            fill="none"
            stroke="var(--graphite-line)"
            strokeWidth="3"
            strokeDasharray="8 10"
            strokeLinecap="round"
            className="ghost-ridge"
            style={{ animationDelay: `${i * -1.2}s` }}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 sm:p-6">
        <span className="font-wide text-[0.9375rem] font-extrabold tracking-[-0.02em]">
          MicMane
        </span>
        <span className="font-mono text-[0.6875rem] text-on-graphite-muted tabular">
          MMV 002
        </span>
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <span className="block font-wide text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-extrabold tracking-[-0.03em]">
          Your take
        </span>
        <span className="mt-2 block text-[0.8125rem] text-on-graphite-muted">
          Thirty seconds is enough to start.
        </span>
      </figcaption>
    </figure>
  );
}
