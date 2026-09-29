import { useState, type ReactNode } from "react"
import { InfoIcon, Loader2Icon, MicIcon, OctagonXIcon, PlayIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Mark, Wordmark } from "@/components/brand/Mark"
import { Pin } from "@/components/editor/Editor"
import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteNav } from "@/components/site/SiteNav"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@micmane/ui/components/accordion"
import { Alert, AlertDescription, AlertTitle } from "@micmane/ui/components/alert"
import { Badge } from "@micmane/ui/components/badge"
import { Button } from "@micmane/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@micmane/ui/components/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@micmane/ui/components/dialog"
import { Input } from "@micmane/ui/components/input"
import { Label } from "@micmane/ui/components/label"
import { Progress } from "@micmane/ui/components/progress"
import { Separator } from "@micmane/ui/components/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@micmane/ui/components/sheet"
import { Skeleton } from "@micmane/ui/components/skeleton"
import { Slider } from "@micmane/ui/components/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@micmane/ui/components/tabs"
import { Toggle } from "@micmane/ui/components/toggle"
import { ToggleGroup, ToggleGroupItem } from "@micmane/ui/components/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@micmane/ui/components/tooltip"
import { FOUNDATIONS } from "@/lib/foundations"
import { formatTime } from "@/lib/review"

const SECTIONS = [
  ["tokens", "Color"],
  ["type", "Type"],
  ["mark", "Mark"],
  ["button", "Button"],
  ["badge", "Badge"],
  ["pin", "Note pins"],
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
] as const

export function Components() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1320px] px-4 pt-10 pb-24 sm:px-6 lg:px-10">
        <header className="pb-6">
          <h1 className="font-wide text-[clamp(2.25rem,4.6vw,4rem)] leading-[0.96] font-extrabold tracking-[-0.035em]">
            Components
          </h1>
          <p className="mt-5 max-w-[60ch] text-[1.0625rem] leading-relaxed text-ink-2">
            The shadcn/ui components MicMane uses, restyled: white chrome, gray and black structure, one iridescent
            color per foundation, and orange glass for anything live.
          </p>
        </header>

        <div className="mt-10 grid gap-12 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <nav aria-label="Components" className="hidden lg:block">
            <ul className="sticky top-20 grid gap-0.5 text-[0.8125rem]">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="block rounded-sm py-1 text-ink-3 transition-colors hover:text-ink">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid gap-16">
            <Showcase id="tokens" title="Color" note="Mostly white, gray and black. Color points at a foundation; orange glass means something is live.">
              <div className="grid gap-8">
                <SwatchRow
                  label="Canvas"
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
                  <p className="mb-3 text-[0.75rem] font-semibold text-ink-3">Foundations: field and ink</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {FOUNDATIONS.map((f) => (
                      <div key={f.key} className="overflow-hidden rounded-md border border-line">
                        <div className="h-16" style={{ background: f.fill }} />
                        <div className="h-3" style={{ background: f.ink }} />
                        <p className="px-2.5 py-2 text-[0.75rem] font-semibold" style={{ color: f.ink }}>{f.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-[0.75rem] font-semibold text-ink-3">Owned material: iridescent film, orange glass</p>
                  <div className="grid grid-cols-[2fr_1fr] gap-3">
                    <div className="film h-16 rounded-md" />
                    <div className="glass-lit h-16 rounded-md" />
                  </div>
                </div>
              </div>
            </Showcase>

            <Showcase id="type" title="Type" note="Archivo across its width axis: expanded for display, normal for reading. Martian Mono only for time and measurement.">
              <div className="grid gap-6">
                <TypeRow meta="Display · Archivo 125 wdth · 800">
                  <span className="font-wide text-5xl leading-none font-extrabold tracking-[-0.035em]">Hear yourself.</span>
                </TypeRow>
                <TypeRow meta="Heading · Archivo 125 wdth · 700">
                  <span className="font-wide text-2xl font-bold tracking-[-0.02em]">Five layers. One take.</span>
                </TypeRow>
                <TypeRow meta="Monitor · Archivo 125 wdth · 600">
                  <span className="font-wide text-[1.875rem] leading-tight font-semibold tracking-[-0.015em]">It's saying no.</span>
                </TypeRow>
                <TypeRow meta="Body · Archivo 100 wdth · 400">
                  <span className="max-w-[60ch] text-[1.0625rem] leading-relaxed text-ink-2">
                    Every note ends with one thing to try on the next take.
                  </span>
                </TypeRow>
                <TypeRow meta="Time · Martian Mono · tabular">
                  <span className="font-mono text-sm tabular">00:04.7 / 00:15.6</span>
                </TypeRow>
              </div>
            </Showcase>

            <Showcase id="mark" title="Mark" note="Placeholder: a microphone wearing a mane, drawn in the iridescent film.">
              <div className="flex flex-wrap items-center gap-10">
                <Wordmark />
                <Mark className="size-16" />
                <div className="rounded-md bg-graphite p-4"><Mark className="size-10 [&_rect]:fill-[oklch(0.96_0.002_80)] [&_path]:stroke-[oklch(0.96_0.002_80)]" /></div>
              </div>
            </Showcase>

            <Showcase id="button" title="Button" note="Ink for the primary action. Glass only for recording and playback. Graphite belongs to the recorder.">
              <div className="grid gap-6">
                <Row>
                  <Button>Try a free review</Button>
                  <Button variant="outline">Record another take</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Read the lesson</Button>
                  <Button variant="destructive">Discard take</Button>
                </Row>
                <Row>
                  <Button variant="glass"><MicIcon />Start recording</Button>
                  <Button variant="glass" size="icon" className="rounded-full" aria-label="Play"><PlayIcon className="translate-x-px fill-current" /></Button>
                  <Button variant="graphite"><UploadIcon />Upload a file</Button>
                </Row>
                <Row>
                  <Button size="xs">Extra small</Button>
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                </Row>
                <Row>
                  <Button disabled>Disabled</Button>
                  <Button aria-busy="true"><Loader2Icon className="animate-spin" />Reviewing</Button>
                  <Button variant="glass" disabled>Glass disabled</Button>
                </Row>
              </div>
            </Showcase>

            <Showcase id="badge" title="Badge" note="Square-shouldered tags. Foundations carry their field color; sample content is always labeled with a dashed edge.">
              <div className="grid gap-4">
                <Row>
                  {FOUNDATIONS.map((f) => (
                    <Badge key={f.key} variant={f.key}>{f.label}</Badge>
                  ))}
                </Row>
                <Row>
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Mixed</Badge>
                  <Badge variant="outline">AI review</Badge>
                  <Badge variant="sample">Sample · synthetic voice</Badge>
                  <Badge variant="live">Recording</Badge>
                  <Badge variant="destructive">Failed</Badge>
                </Row>
              </div>
            </Showcase>

            <Showcase id="pin" title="Note pins" note="State is drawn with stroke, never color: filled is a strength, an open ring is an improvement, dashed means tentative.">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { kind: "strength" as const, tentative: false, label: "Strength · clear" },
                  { kind: "improvement" as const, tentative: false, label: "To improve · clear" },
                  { kind: "strength" as const, tentative: true, label: "Strength · tentative" },
                  { kind: "improvement" as const, tentative: true, label: "To improve · tentative" },
                ].map((p, i) => (
                  <div key={p.label} className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3">
                    <Pin kind={p.kind} tentative={p.tentative} color={FOUNDATIONS[i + 1].ink} size={12} active={i === 0} />
                    <span className="text-sm">{p.label}</span>
                    <span className="ml-auto font-mono text-[0.6875rem] text-ink-3 tabular">{formatTime(4.66 + i * 2.1)}</span>
                  </div>
                ))}
              </div>
            </Showcase>

            <Showcase id="input" title="Input & label" note="Glass-ink focus. Errors name the problem and the fix.">
              <div className="grid max-w-md gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="c-email">Email</Label>
                  <Input id="c-email" type="email" placeholder="you@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-title">Take title</Label>
                  <Input id="c-title" defaultValue="Night shift" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-bad">Email</Label>
                  <Input id="c-bad" aria-invalid="true" defaultValue="you@example" aria-describedby="c-bad-hint" />
                  <p id="c-bad-hint" className="text-[0.8125rem] text-destructive">Add the domain, for example you@example.com.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-off">Disabled</Label>
                  <Input id="c-off" disabled placeholder="Not available yet" />
                </div>
              </div>
            </Showcase>

            <Showcase id="tabs" title="Tabs" note="Segmented on sunken ground, or a single-pixel line.">
              <div className="grid gap-8">
                <Tabs defaultValue="notes">
                  <TabsList>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="transcript">Transcript</TabsTrigger>
                    <TabsTrigger value="lesson">Lesson</TabsTrigger>
                  </TabsList>
                  <TabsContent value="notes" className="pt-3 text-ink-2">Six notes across five foundations.</TabsContent>
                  <TabsContent value="transcript" className="pt-3 text-ink-2">For three years, I ran the night shift…</TabsContent>
                  <TabsContent value="lesson" className="pt-3 text-ink-2">Give important points enough time.</TabsContent>
                </Tabs>
                <Tabs defaultValue="take-2">
                  <TabsList variant="line">
                    <TabsTrigger value="take-1">Take 1</TabsTrigger>
                    <TabsTrigger value="take-2">Take 2</TabsTrigger>
                    <TabsTrigger value="take-3" disabled>Take 3</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </Showcase>

            <Showcase id="toggle" title="Toggle & layers" note="Layer switches keep the label ink; only the swatch carries color, and it dims when off.">
              <div className="grid gap-8 md:grid-cols-2">
                <ToggleGroup type="multiple" defaultValue={["rate", "volume", "pauses"]} orientation="vertical" spacing={0} className="w-56 gap-0! overflow-hidden rounded-md border border-line bg-paper! p-0!" aria-label="Layers">
                  {FOUNDATIONS.map((f) => (
                    <ToggleGroupItem key={f.key} value={f.key} variant="layer" className="h-9! w-full rounded-none!">
                      <span data-swatch className="size-2.5 rounded-[2px] transition-opacity" style={{ background: f.fill, boxShadow: `inset 0 0 0 1px ${f.ink}` }} />
                      <span className="text-[0.8125rem] font-semibold">{f.label}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="grid content-start gap-5">
                  <ToggleGroup type="single" defaultValue="all" spacing={0} aria-label="Filter notes">
                    <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
                    <ToggleGroupItem value="strengths" size="sm">Strengths</ToggleGroupItem>
                    <ToggleGroupItem value="improve" size="sm">To improve</ToggleGroupItem>
                  </ToggleGroup>
                  <Row>
                    <Toggle aria-label="Loop" defaultPressed>Loop passage</Toggle>
                    <Toggle variant="outline" aria-label="Show transcript">Transcript</Toggle>
                  </Row>
                </div>
              </div>
            </Showcase>

            <Showcase id="slider" title="Scrubber" note="The slider is the playhead: a one-pixel ruler and an orange glass handle.">
              <ScrubberDemo />
            </Showcase>

            <Showcase id="card" title="Card" note="Hairline border, barely lifted. Never nested.">
              <Card className="max-w-md">
                <CardHeader>
                  <CardTitle>Night shift</CardTitle>
                  <CardDescription>Recorded today · 15.6 s · six notes</CardDescription>
                </CardHeader>
                <CardContent className="text-ink-2">
                  A clear story with a strong middle. The opening rushes, and the ending fades.
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm">Open review</Button>
                  <Button size="sm" variant="ghost">Retake</Button>
                </CardFooter>
              </Card>
            </Showcase>

            <Showcase id="tooltip" title="Tooltip" note="Ink on white, used for measured values and terms.">
              <Row>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">280 wpm</Button>
                  </TooltipTrigger>
                  <TooltipContent>Words per minute in this passage</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="About tentative notes"><InfoIcon /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Tentative notes are judgment calls. Other readings could work too.</TooltipContent>
                </Tooltip>
              </Row>
            </Showcase>

            <Showcase id="dialog" title="Dialog" note="Only where focus must be protected, such as discarding a take.">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Discard this take</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Discard this take?</DialogTitle>
                    <DialogDescription>
                      The recording and its review will be gone. MicMane doesn't keep a copy.
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

            <Showcase id="sheet" title="Sheet" note="On phones, notes and navigation arrive from the edge.">
              <Row>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">Open notes</Button>
                  </SheetTrigger>
                  <SheetContent side="bottom">
                    <SheetHeader>
                      <SheetTitle>Notes</SheetTitle>
                      <SheetDescription>Six notes across five foundations.</SheetDescription>
                    </SheetHeader>
                    <p className="px-4 pb-6 text-ink-2">Each note is pinned to the second it refers to.</p>
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

            <Showcase id="progress" title="Progress" note="A glass bead filling a sunken track, used while the coach listens.">
              <div className="grid max-w-md gap-4">
                <Progress value={18} aria-label="Early" />
                <Progress value={64} aria-label="Midway" />
                <Progress value={100} aria-label="Done" />
              </div>
            </Showcase>

            <Showcase id="alert" title="Alert" note="Hairline for information, tinted for errors, graphite inside the recorder.">
              <div className="grid max-w-2xl gap-4">
                <Alert>
                  <InfoIcon />
                  <AlertTitle>Takes over a minute are trimmed</AlertTitle>
                  <AlertDescription>The coach reviews the middle minute. Timestamps refer to that excerpt.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <OctagonXIcon />
                  <AlertTitle>The coach is busy right now</AlertTitle>
                  <AlertDescription>Wait a minute and send the take again.</AlertDescription>
                </Alert>
                <Alert variant="graphite">
                  <MicIcon />
                  <AlertTitle>Microphone access is blocked</AlertTitle>
                  <AlertDescription>Allow the microphone for this site in your browser's settings.</AlertDescription>
                </Alert>
              </div>
            </Showcase>

            <Showcase id="accordion" title="Accordion" note="Questions and long explanations.">
              <Accordion type="single" collapsible className="max-w-2xl">
                <AccordionItem value="a">
                  <AccordionTrigger>Does MicMane score my voice?</AccordionTrigger>
                  <AccordionContent>No. You get notes on moments in your take, each with something to try next.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="b">
                  <AccordionTrigger>Is my recording stored?</AccordionTrigger>
                  <AccordionContent>No. It is sent to Deepgram and Mistral for the review and not kept by MicMane.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="c">
                  <AccordionTrigger>Which languages work?</AccordionTrigger>
                  <AccordionContent>English, with one speaker, for now.</AccordionContent>
                </AccordionItem>
              </Accordion>
            </Showcase>

            <Showcase id="toast" title="Toast" note="Quiet confirmation from the corner.">
              <Row>
                <Button variant="outline" onClick={() => toast.success("Your review is ready", { description: "6 notes across five foundations." })}>Success</Button>
                <Button variant="outline" onClick={() => toast("Take saved to this session")}>Neutral</Button>
                <Button variant="outline" onClick={() => toast.error("The review couldn't be completed", { description: "Send the take again." })}>Error</Button>
              </Row>
            </Showcase>

            <Showcase id="skeleton" title="Skeleton" note="Holds the editor's shape while a review loads.">
              <div className="grid max-w-2xl gap-3 rounded-lg border border-line bg-surface p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-3/4" />
                <div className="grid gap-2 pt-2">
                  {FOUNDATIONS.map((f) => <Skeleton key={f.key} className="h-6 w-full" />)}
                </div>
              </div>
            </Showcase>

            <Showcase id="separator" title="Separator" note="Rows and sections separate by spacing. A line marks a pane split or a scroll edge; a free-standing separator fades out at both ends.">
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
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

function Showcase({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <div className="mb-7 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h2 id={id} className="font-wide text-xl font-bold tracking-[-0.015em]">{title}</h2>
        <p className="text-[0.8125rem] text-ink-3">{note}</p>
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

function SwatchRow({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-[0.75rem] font-semibold text-ink-3">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {items.map(([name, token]) => (
          <div key={token} className="overflow-hidden rounded-md border border-line">
            <div className="h-14" style={{ background: `var(${token})` }} />
            <div className="px-2.5 py-2">
              <p className="text-[0.75rem] font-semibold">{name}</p>
              <p className="font-mono text-[0.625rem] text-ink-3">{token}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TypeRow({ meta, children }: { meta: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 pb-3 md:grid-cols-[14rem_minmax(0,1fr)] md:items-baseline">
      <p className="text-[0.75rem] text-ink-3">{meta}</p>
      <div>{children}</div>
    </div>
  )
}

function ScrubberDemo() {
  const [t, setT] = useState(4.7)
  return (
    <div className="max-w-2xl rounded-lg border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between font-mono text-[0.75rem] text-ink-3 tabular">
        <span><span className="text-ink">{formatTime(t)}</span> / {formatTime(15.6)}</span>
        <span>Arrow keys move 0.1 s</span>
      </div>
      <Slider aria-label="Scrub" min={0} max={15.6} step={0.1} value={[t]} onValueChange={([v]) => setT(v)} />
      <div className="mt-6 max-w-xs">
        <Slider aria-label="Disabled scrubber" defaultValue={[40]} disabled />
      </div>
    </div>
  )
}
