import {
  InfoIcon,
  Loader2Icon,
  MicIcon,
  OctagonXIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  UploadIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Mark, Wordmark } from "@/components/brand/Mark";
import { Pin } from "@/components/editor/Editor";
import { Note } from "@/components/feedback/FeedbackView";
import { CoverArt } from "@/components/liner/CoverArt";
import { LyricSheet } from "@/components/liner/LyricSheet";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Tape } from "@/components/try/TryReview";
import { REVIEW_FIXTURE } from "@/data/review-fixture";
import sampleTake from "@/data/sample-take.json";
import { FOUNDATIONS } from "@/lib/foundations";
import { formatTime, type Take } from "@/lib/review";
import { SAMPLE_REVIEW, SAMPLE_TITLE } from "@/lib/sample";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@micmane/ui/components/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@micmane/ui/components/alert";
import { Badge } from "@micmane/ui/components/badge";
import { Button } from "@micmane/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@micmane/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@micmane/ui/components/dialog";
import { Input } from "@micmane/ui/components/input";
import { Label } from "@micmane/ui/components/label";
import { Progress } from "@micmane/ui/components/progress";
import { Separator } from "@micmane/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@micmane/ui/components/sheet";
import { Skeleton } from "@micmane/ui/components/skeleton";
import { Slider } from "@micmane/ui/components/slider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@micmane/ui/components/tabs";
import { Toggle } from "@micmane/ui/components/toggle";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@micmane/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@micmane/ui/components/tooltip";
import { cn } from "@micmane/ui/lib/utils";

const SHELL = "mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10";
const SPREAD = "grid gap-x-12 gap-y-8 lg:grid-cols-12 lg:gap-x-16";
const LEFT = "lg:col-span-5";
const RIGHT = "lg:col-span-7 lg:col-start-6";

const TAKE = sampleTake as Take;
const SHORT_TAKE: Take = { ...TAKE, segments: TAKE.segments.slice(0, 2) };
const COVER_PALETTE = FOUNDATIONS.map((f) => f.fill);

const SECTIONS = [
  ["tokens", "Color"],
  ["type", "Type"],
  ["mark", "Mark"],
  ["cover", "Cover"],
  ["lyric", "Lyric sheet"],
  ["note", "Margin note"],
  ["recorder", "Recorder tape"],
  ["pin", "Note pins"],
  ["button", "Button"],
  ["badge", "Badge"],
  ["input", "Input & label"],
  ["tabs", "Tabs"],
  ["toggle", "Toggle & layers"],
  ["slider", "Scrubber"],
  ["card", "Card"],
  ["tooltip", "Tooltip"],
  ["dialog", "Dialog"],
  ["sheet", "Sheet"],
  ["progress", "Progress"],
  ["alert", "Alert"],
  ["accordion", "Accordion"],
  ["toast", "Toast"],
  ["skeleton", "Skeleton"],
  ["separator", "Separator"],
] as const;

export function Components() {
  return (
    <>
      <main className={cn(SHELL, "pt-12 pb-24 sm:pt-16 lg:pt-20 lg:pb-36")}>
        <header className={SPREAD}>
          <div className={LEFT}>
            <h1 className="font-wide text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
              Components
            </h1>
          </div>
          <div className={RIGHT}>
            <p className="max-w-[46ch] text-[1.0625rem] leading-7 text-ink-2">
              The parts MicMane is built from, set the way the product sets
              them: white booklet pages on paper, ink type, one colour per
              foundation, graphite sleeves, and orange glass for whatever is
              live.
            </p>
            <nav aria-label="Components" className="mt-10">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[0.8125rem] leading-6 sm:grid-cols-3">
                {SECTIONS.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="rounded-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <div className="mt-24 grid gap-24 lg:mt-36 lg:gap-36">
          <Showcase
            id="tokens"
            title="Color"
            note="A near-white canvas and graphite inks. Each foundation is a pair: pastel for fields, deep ink for text. Orange glass is the one warm light, for what is live."
          >
            <div className="grid gap-10">
              <SwatchRow
                label="Canvas and ink"
                items={[
                  ["Paper", "--paper"],
                  ["Surface", "--surface"],
                  ["Sunken", "--sunken"],
                  ["Line", "--line"],
                  ["Line strong", "--line-strong"],
                  ["Ink 3", "--ink-3"],
                  ["Ink 2", "--ink-2"],
                  ["Ink", "--ink"],
                ]}
              />
              <SwatchRow
                label="Graphite and glass"
                items={[
                  ["Graphite deep", "--graphite-deep"],
                  ["Graphite", "--graphite"],
                  ["Graphite line", "--graphite-line"],
                  ["Glass ink", "--glass-ink"],
                  ["Glass", "--glass"],
                  ["Glass hot", "--glass-hot"],
                ]}
              />
              <div>
                <p className="mb-3 text-[0.75rem] leading-5 font-semibold text-ink-3">
                  Foundations: fill and ink
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-5">
                  {FOUNDATIONS.map((f) => (
                    <li key={f.key}>
                      <div
                        className="h-16 rounded-[3px]"
                        style={{
                          background: f.fill,
                          boxShadow: `inset 0 -8px 0 ${f.ink}`,
                        }}
                      />
                      <p
                        className="mt-2 text-[0.75rem] leading-5 font-semibold"
                        style={{ color: f.ink }}
                      >
                        {f.label}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Showcase>

          <Showcase
            id="type"
            title="Type"
            note="Archivo stretched two ways: wide and extra-bold for anything that names a thing, normal width for reading. Martian Mono numbers the take and the label."
          >
            <div className="grid gap-8">
              <TypeRow meta="Display · wide 800">
                <span className="font-wide text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
                  Unlock your voice.
                </span>
              </TypeRow>
              <TypeRow meta="Headline · wide 800">
                <span className="font-wide text-[clamp(1.75rem,3vw,2.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">
                  Notes on your take
                </span>
              </TypeRow>
              <TypeRow meta="Lyric · wide 600">
                <span className="font-wide text-[clamp(1.375rem,2.1vw,1.875rem)] leading-[1.3] font-semibold tracking-[-0.015em]">
                  It's saying no.
                </span>
              </TypeRow>
              <TypeRow meta="Title · wide 700">
                <span className="font-wide text-[1.5rem] leading-10 font-bold tracking-[-0.02em]">
                  Rate of speech
                </span>
              </TypeRow>
              <TypeRow meta="Body lead · 400">
                <span className="block max-w-[46ch] text-[1.0625rem] leading-7 text-ink-2">
                  Every note ends with one thing to try on the next take.
                </span>
              </TypeRow>
              <TypeRow meta="Body small · 400">
                <span className="block max-w-[52ch] text-[0.8125rem] leading-5 text-ink-2">
                  A little more time can make this passage easier to follow.
                </span>
              </TypeRow>
              <TypeRow meta="Label · 600">
                <span
                  className="text-[0.75rem] leading-5 font-semibold"
                  style={{ color: "var(--f-pauses-ink)" }}
                >
                  Pauses{" "}
                  <span className="font-normal text-ink-3">Pause too long</span>
                </span>
              </TypeRow>
              <TypeRow meta="Time, catalog · Martian Mono">
                <span className="font-mono text-[0.75rem] tabular">
                  00:04.7 / 00:15 · 4.1 syl/s · MMV 001
                </span>
              </TypeRow>
            </div>
          </Showcase>

          <Showcase
            id="mark"
            title="Mark"
            note="Placeholder until the mark is designed: a microphone wearing a mane in the five foundation inks."
          >
            <div className="flex flex-wrap items-center gap-10">
              <Wordmark />
              <Mark className="size-16" />
              <div className="rounded-[10px] bg-graphite p-4">
                <Mark className="size-10 [&_path]:stroke-on-graphite [&_rect]:fill-on-graphite" />
              </div>
            </div>
          </Showcase>

          <Showcase
            id="cover"
            title="Cover"
            note="Drawn from the take: one ridge for each line that showed a strength, filled with that foundation and stacked up from the bottom. Few strengths make a low stack; covers fill up as you practise. The promotional sleeve shows every foundation."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <figure>
                <CoverArt
                  take={TAKE}
                  review={SAMPLE_REVIEW}
                  title={SAMPLE_TITLE}
                  className="cover-shadow"
                  top={<CoverTop no="MMV 001" />}
                  bottom={<CoverTitle title={SAMPLE_TITLE} />}
                />
                <figcaption className="mt-4 text-[0.8125rem] leading-5 text-ink-3">
                  A take's cover
                </figcaption>
              </figure>
              <figure>
                <CoverArt
                  take={TAKE}
                  review={SAMPLE_REVIEW}
                  title={SAMPLE_TITLE}
                  palette={COVER_PALETTE}
                  className="cover-shadow"
                  top={<CoverTop no="MMV 001" />}
                  bottom={<CoverTitle title={SAMPLE_TITLE} />}
                />
                <figcaption className="mt-4 text-[0.8125rem] leading-5 text-ink-3">
                  Promotional sleeve
                </figcaption>
              </figure>
            </div>
          </Showcase>

          <Showcase
            id="lyric"
            title="Lyric sheet"
            note="A take read as its lyrics: timecodes in the gutter, noted words under a foundation highlighter, notes beneath the line. Silence between lines becomes space."
          >
            <LyricSheet
              take={SHORT_TAKE}
              review={REVIEW_FIXTURE.review}
              time={0}
              started={false}
              onPlayFrom={() => undefined}
            />
          </Showcase>

          <Showcase
            id="note"
            title="Margin note"
            note="Pinned to its words: foundation and rule, the observation, why it matters, and one thing to try. Every note and every phrase in it can be played."
          >
            <ul className="grid max-w-[34rem] gap-8">
              {REVIEW_FIXTURE.review.findings.slice(0, 2).map((f, i) => (
                <Note
                  key={f.id}
                  note={f}
                  active={i === 0}
                  onPlay={() => undefined}
                  onPlaySpan={() => undefined}
                />
              ))}
            </ul>
          </Showcase>

          <Showcase
            id="recorder"
            title="Recorder tape"
            note="One minute of tape, left to right. It fills with your level as you speak; what is left is a bare line, waiting."
          >
            <div className="grid gap-8">
              {[
                { label: "Empty", length: 0 },
                { label: "A 15-second take", length: TAKE.duration },
              ].map((t) => (
                <div key={t.label}>
                  <Tape
                    level={TAKE.volume ?? TAKE.peaks}
                    length={t.length}
                    live={false}
                    scanning={false}
                  />
                  <p className="mt-3 text-[0.8125rem] leading-5 text-ink-2">
                    {t.label}
                  </p>
                </div>
              ))}
            </div>
          </Showcase>

          <Showcase
            id="pin"
            title="Note pins"
            note="State is drawn with stroke, never colour: filled is a strength, an open ring is an improvement, dashed means tentative."
          >
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  kind: "strength" as const,
                  tentative: false,
                  label: "Strength · clear",
                },
                {
                  kind: "improvement" as const,
                  tentative: false,
                  label: "To improve · clear",
                },
                {
                  kind: "strength" as const,
                  tentative: true,
                  label: "Strength · tentative",
                },
                {
                  kind: "improvement" as const,
                  tentative: true,
                  label: "To improve · tentative",
                },
              ].map((p, i) => (
                <li key={p.label} className="flex items-center gap-3">
                  <Pin
                    kind={p.kind}
                    tentative={p.tentative}
                    color={FOUNDATIONS[i + 1].ink}
                    size={12}
                    active={i === 0}
                  />
                  <span className="text-[0.875rem]">{p.label}</span>
                  <span className="ml-auto font-mono text-[0.6875rem] text-ink-3 tabular sm:mr-8">
                    {formatTime(4.66 + i * 2.1)}
                  </span>
                </li>
              ))}
            </ul>
          </Showcase>

          <Showcase
            id="button"
            title="Button"
            note="Ink for the primary action. Orange glass for play controls and recording. Graphite is the sleeve's colour."
          >
            <div className="grid gap-6">
              <Row>
                <Button>Try a free review</Button>
                <Button variant="outline">
                  <PlayIcon />
                  See an example
                  <span className="font-mono text-[0.75rem] text-ink-3 tabular">
                    0:15
                  </span>
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Read the lesson</Button>
                <Button variant="destructive">Discard take</Button>
              </Row>
              <Row>
                <Button variant="glass">
                  <SquareIcon className="fill-current" />
                  Stop recording
                </Button>
                <Button
                  variant="glass"
                  size="icon-lg"
                  className="rounded-full"
                  aria-label="Pause"
                >
                  <PauseIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="rounded-full"
                  aria-label="Play"
                >
                  <PlayIcon className="translate-x-px" />
                </Button>
                <Button variant="graphite">
                  <UploadIcon />
                  Upload a file
                </Button>
              </Row>
              <Row>
                <Button size="xs">Extra small</Button>
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
              </Row>
              <Row>
                <Button disabled>Disabled</Button>
                <Button aria-busy="true">
                  <Loader2Icon className="animate-spin" />
                  Reviewing
                </Button>
                <Button variant="glass" disabled>
                  Glass disabled
                </Button>
              </Row>
            </div>
          </Showcase>

          <Showcase
            id="badge"
            title="Badge"
            note="Square-shouldered tags, never pills. Foundations carry their fill with ink text; illustrated data is labelled with a dashed edge."
          >
            <div className="grid gap-4">
              <Row>
                {FOUNDATIONS.map((f) => (
                  <Badge key={f.key} variant={f.key}>
                    {f.label}
                  </Badge>
                ))}
              </Row>
              <Row>
                <Badge>Default</Badge>
                <Badge variant="secondary">Mixed</Badge>
                <Badge variant="outline">AI review</Badge>
                <Badge variant="sample">Illustration</Badge>
                <Badge variant="live">Recording</Badge>
                <Badge variant="destructive">Failed</Badge>
              </Row>
            </div>
          </Showcase>

          <Showcase
            id="input"
            title="Input & label"
            note="Glass-ink focus. Errors name the problem and the fix."
          >
            <div className="grid max-w-md gap-6">
              <div className="grid gap-2">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-title">Take title</Label>
                <Input id="c-title" defaultValue="Night shift" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-bad">Email</Label>
                <Input
                  id="c-bad"
                  aria-invalid="true"
                  defaultValue="you@example"
                  aria-describedby="c-bad-hint"
                />
                <p
                  id="c-bad-hint"
                  className="text-[0.8125rem] text-destructive"
                >
                  Add the domain, for example you@example.com.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-off">Disabled</Label>
                <Input id="c-off" disabled placeholder="Not available yet" />
              </div>
            </div>
          </Showcase>

          <Showcase
            id="tabs"
            title="Tabs"
            note="Segmented on sunken ground, or a single-pixel line."
          >
            <div className="grid gap-8">
              <Tabs defaultValue="notes">
                <TabsList>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="lesson">Lesson</TabsTrigger>
                </TabsList>
                <TabsContent value="notes" className="pt-3 text-ink-2">
                  Six notes across five foundations.
                </TabsContent>
                <TabsContent value="transcript" className="pt-3 text-ink-2">
                  For three years, I ran the night shift…
                </TabsContent>
                <TabsContent value="lesson" className="pt-3 text-ink-2">
                  Give important points enough time.
                </TabsContent>
              </Tabs>
              <Tabs defaultValue="take-2">
                <TabsList variant="line">
                  <TabsTrigger value="take-1">Take 1</TabsTrigger>
                  <TabsTrigger value="take-2">Take 2</TabsTrigger>
                  <TabsTrigger value="take-3" disabled>
                    Take 3
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Showcase>

          <Showcase
            id="toggle"
            title="Toggle & layers"
            note="Layer switches keep the label ink; only the swatch carries colour, and it dims when off."
          >
            <div className="grid gap-8 md:grid-cols-2">
              <ToggleGroup
                type="multiple"
                defaultValue={["rate", "volume", "pauses"]}
                orientation="vertical"
                spacing={0}
                className="w-56 gap-0! overflow-hidden rounded-md border border-line bg-paper! p-0!"
                aria-label="Layers"
              >
                {FOUNDATIONS.map((f) => (
                  <ToggleGroupItem
                    key={f.key}
                    value={f.key}
                    variant="layer"
                    className="h-9! w-full rounded-none!"
                  >
                    <span
                      data-swatch
                      className="size-2.5 rounded-[2px] transition-opacity"
                      style={{
                        background: f.fill,
                        boxShadow: `inset 0 0 0 1px ${f.ink}`,
                      }}
                    />
                    <span className="text-[0.8125rem] font-semibold">
                      {f.label}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="grid content-start gap-5">
                <ToggleGroup
                  type="single"
                  defaultValue="all"
                  spacing={0}
                  aria-label="Filter notes"
                >
                  <ToggleGroupItem value="all" size="sm">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="strengths" size="sm">
                    Strengths
                  </ToggleGroupItem>
                  <ToggleGroupItem value="improve" size="sm">
                    To improve
                  </ToggleGroupItem>
                </ToggleGroup>
                <Row>
                  <Toggle aria-label="Loop" defaultPressed>
                    Loop passage
                  </Toggle>
                  <Toggle variant="outline" aria-label="Show transcript">
                    Transcript
                  </Toggle>
                </Row>
              </div>
            </div>
          </Showcase>

          <Showcase
            id="slider"
            title="Scrubber"
            note="The slider is the playhead: a one-pixel ruler and an orange glass handle."
          >
            <ScrubberDemo />
          </Showcase>

          <Showcase
            id="card"
            title="Card"
            note="Hairline border, barely lifted. Never nested."
          >
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Night shift</CardTitle>
                <CardDescription>
                  Recorded today · 0:15 · 6 notes
                </CardDescription>
              </CardHeader>
              <CardContent className="text-ink-2">
                All five foundations reviewed: two notes on pace, two on pauses,
                one on volume, one on tonality.
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Open review</Button>
                <Button size="sm" variant="ghost">
                  Retake
                </Button>
              </CardFooter>
            </Card>
          </Showcase>

          <Showcase
            id="tooltip"
            title="Tooltip"
            note="Ink on white, used for measured values and terms."
          >
            <Row>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">5.4 syl/s</Button>
                </TooltipTrigger>
                <TooltipContent>
                  Syllables per second in this passage, including silence
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="About tentative notes"
                  >
                    <InfoIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Tentative notes are judgment calls. Other readings could work
                  too.
                </TooltipContent>
              </Tooltip>
            </Row>
          </Showcase>

          <Showcase
            id="dialog"
            title="Dialog"
            note="Only where focus must be protected, such as discarding a take."
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Discard this take</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Discard this take?</DialogTitle>
                  <DialogDescription>
                    The recording and its review will be gone. MicMane doesn't
                    keep a copy.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Keep it</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive">Discard take</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Showcase>

          <Showcase
            id="sheet"
            title="Sheet"
            note="On phones, notes and navigation arrive from the edge."
          >
            <Row>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open notes</Button>
                </SheetTrigger>
                <SheetContent side="bottom">
                  <SheetHeader>
                    <SheetTitle>Notes</SheetTitle>
                    <SheetDescription>
                      Six notes across five foundations.
                    </SheetDescription>
                  </SheetHeader>
                  <p className="px-4 pb-6 text-ink-2">
                    Each note is pinned to the second it refers to.
                  </p>
                </SheetContent>
              </Sheet>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open menu</Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>MicMane</SheetTitle>
                    <SheetDescription>Navigation</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </Row>
          </Showcase>

          <Showcase
            id="progress"
            title="Progress"
            note="A glass bead filling a sunken track, for work that takes a while."
          >
            <div className="grid max-w-md gap-4">
              <Progress value={18} aria-label="Early" />
              <Progress value={64} aria-label="Midway" />
              <Progress value={100} aria-label="Done" />
            </div>
          </Showcase>

          <Showcase
            id="alert"
            title="Alert"
            note="Hairline for information, tinted for errors, graphite on dark ground."
          >
            <div className="grid max-w-2xl gap-4">
              <Alert>
                <InfoIcon />
                <AlertTitle>Takes over a minute are trimmed</AlertTitle>
                <AlertDescription>
                  The coach reviews the middle minute. Timestamps refer to that
                  excerpt.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <OctagonXIcon />
                <AlertTitle>The coach is busy right now</AlertTitle>
                <AlertDescription>
                  Wait a minute and send the take again.
                </AlertDescription>
              </Alert>
              <Alert variant="graphite">
                <MicIcon />
                <AlertTitle>Microphone access is blocked</AlertTitle>
                <AlertDescription>
                  Allow the microphone for this site in your browser's settings.
                </AlertDescription>
              </Alert>
            </div>
          </Showcase>

          <Showcase
            id="accordion"
            title="Accordion"
            note="Questions and long explanations."
          >
            <Accordion type="single" collapsible className="max-w-2xl">
              <AccordionItem value="a">
                <AccordionTrigger>
                  Does MicMane score my voice?
                </AccordionTrigger>
                <AccordionContent>
                  No. You get notes on moments in your take, each with something
                  to try next.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Is my recording stored?</AccordionTrigger>
                <AccordionContent>
                  No. It is sent to Deepgram and Mistral for the review and not
                  kept by MicMane.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="c">
                <AccordionTrigger>Which languages work?</AccordionTrigger>
                <AccordionContent>
                  English, with one speaker, for now.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Showcase>

          <Showcase
            id="toast"
            title="Toast"
            note="Quiet confirmation from the corner."
          >
            <Row>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success("Your review is ready", {
                    description: "6 notes on your take.",
                  })
                }
              >
                Success
              </Button>
              <Button
                variant="outline"
                onClick={() => toast("Take saved to this session")}
              >
                Neutral
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error("The review couldn't be completed", {
                    description: "Send the take again.",
                  })
                }
              >
                Error
              </Button>
            </Row>
          </Showcase>

          <Showcase
            id="skeleton"
            title="Skeleton"
            note="Holds the review's shape while it loads: a timecode and a line."
          >
            <div className="grid gap-8">
              {[0.75, 0.5].map((w, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-6"
                >
                  <Skeleton className="mt-2 h-3 w-14" />
                  <div className="grid content-start gap-3 pt-2">
                    <Skeleton
                      className="h-6"
                      style={{ width: `${w * 100}%` }}
                    />
                    <Skeleton className="h-6 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          </Showcase>

          <Showcase
            id="separator"
            title="Separator"
            note="Rows and sections separate by spacing. A line marks a pane split or a scroll edge; a free-standing separator fades out at both ends."
          >
            <div className="max-w-md">
              <p className="text-sm">Rate of speech</p>
              <Separator className="my-3" />
              <p className="text-sm">Volume</p>
              <div className="mt-4 flex h-5 items-center gap-3 text-sm">
                <span>00:04.7</span>
                <Separator orientation="vertical" />
                <span>Pauses</span>
                <Separator orientation="vertical" />
                <span>Strength</span>
              </div>
            </div>
          </Showcase>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Showcase({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(SPREAD, "scroll-mt-20")}>
      <div className={LEFT}>
        <div className="lg:sticky lg:top-24">
          <h2
            id={id}
            className="font-wide text-[1.5rem] leading-10 font-bold tracking-[-0.02em]"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-[44ch] text-[0.9375rem] leading-6 text-ink-2">
            {note}
          </p>
        </div>
      </div>
      <div
        className={cn(RIGHT, "booklet-page min-w-0 px-4 py-6 sm:px-8 sm:py-8")}
      >
        {children}
      </div>
    </section>
  );
}

function CoverTop({ no }: { no: string }) {
  return (
    <>
      <span className="font-wide text-[0.9375rem] font-extrabold tracking-[-0.02em]">
        MicMane
      </span>
      <span className="font-mono text-[0.6875rem] text-on-graphite-muted tabular">
        {no}
      </span>
    </>
  );
}

function CoverTitle({ title }: { title: string }) {
  return (
    <span className="min-w-0">
      <span className="block font-wide text-[1.5rem] leading-none font-extrabold tracking-[-0.03em]">
        {title}
      </span>
      <span className="mt-2 block font-mono text-[0.75rem] text-on-graphite-muted tabular">
        Take 1 · 0:15
      </span>
    </span>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function SwatchRow({
  label,
  items,
}: {
  label: string;
  items: [string, string][];
}) {
  return (
    <div>
      <p className="mb-3 text-[0.75rem] leading-5 font-semibold text-ink-3">
        {label}
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {items.map(([name, token]) => (
          <li key={token}>
            <div
              className="h-14 rounded-[3px] shadow-[inset_0_0_0_1px_var(--line)]"
              style={{ background: `var(${token})` }}
            />
            <p className="mt-2 text-[0.75rem] leading-5 font-semibold">
              {name}
            </p>
            <p className="font-mono text-[0.625rem] leading-4 text-ink-3">
              {token}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypeRow({ meta, children }: { meta: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:items-baseline md:gap-6">
      <p className="text-[0.75rem] leading-5 text-ink-3">{meta}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ScrubberDemo() {
  const [t, setT] = useState(4.7);
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between font-mono text-[0.75rem] text-ink-3 tabular">
        <span>
          <span className="text-ink">{formatTime(t)}</span> /{" "}
          {formatTime(TAKE.duration, false)}
        </span>
        <span>Arrow keys move 0.1 s</span>
      </div>
      <Slider
        aria-label="Scrub"
        min={0}
        max={TAKE.duration}
        step={0.1}
        value={[t]}
        onValueChange={([v]) => setT(v)}
      />
      <div className="mt-6 max-w-xs">
        <Slider aria-label="Disabled scrubber" defaultValue={[40]} disabled />
      </div>
    </div>
  );
}
