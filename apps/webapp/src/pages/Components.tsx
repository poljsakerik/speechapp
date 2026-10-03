import {
  COMMON_NS,
  COMPONENTS_NS,
  PUBLIC_WEBSITE_NS,
  REVIEW_NS,
  t as translate,
} from "@/core/i18n";
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
import { useTranslation } from "react-i18next";
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
import { SAMPLE_REVIEW, sampleTitle } from "@/lib/sample";
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

const sections = () =>
  [
    ["tokens", translate("components:color")],
    ["type", translate("components:type")],
    ["mark", translate("components:mark")],
    ["cover", translate("components:cover")],
    ["lyric", translate("components:lyricSheet")],
    ["note", translate("review:feedbackviewNote")],
    ["recorder", translate("components:recorderTape")],
    ["pin", translate("components:notePins")],
    ["button", translate("components:button")],
    ["badge", translate("components:badge")],
    ["input", translate("components:inputLabel")],
    ["tabs", translate("components:tabs")],
    ["toggle", translate("components:toggleLayers")],
    ["slider", translate("components:scrubber")],
    ["card", translate("components:card")],
    ["tooltip", translate("components:tooltip")],
    ["dialog", translate("components:dialog")],
    ["sheet", translate("components:sheet")],
    ["progress", translate("components:progress")],
    ["alert", translate("components:alert")],
    ["accordion", translate("components:accordion")],
    ["toast", translate("components:toast")],
    ["skeleton", translate("components:skeleton")],
    ["separator", translate("components:separator")],
  ] as const;

export function Components() {
  const { t: translate } = useTranslation([
    COMMON_NS,
    REVIEW_NS,
    PUBLIC_WEBSITE_NS,
    COMPONENTS_NS,
  ]);
  return (
    <>
      <main className={cn(SHELL, "pt-12 pb-24 sm:pt-16 lg:pt-20 lg:pb-36")}>
        <header className={SPREAD}>
          <div className={LEFT}>
            <h1 className="font-wide text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
              {translate("publicWebsite:sitefooterComponents")}
            </h1>
          </div>
          <div className={RIGHT}>
            <p className="max-w-[46ch] text-[1.0625rem] leading-7 text-ink-2">
              {translate("components:thePartsMicmaneIsBuiltFromSetThe")}
            </p>
            <nav
              aria-label={translate("publicWebsite:sitefooterComponents")}
              className="mt-10"
            >
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[0.8125rem] leading-6 sm:grid-cols-3">
                {sections().map(([id, label]) => (
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
            title={translate("components:color")}
            note={translate("components:aNearWhiteCanvasAndGraphiteInksEach")}
          >
            <div className="grid gap-10">
              <SwatchRow
                label={translate("components:canvasAndInk")}
                items={[
                  [translate("components:paper"), "--paper"],
                  [translate("components:surface"), "--surface"],
                  [translate("components:sunken"), "--sunken"],
                  [translate("components:line"), "--line"],
                  [translate("components:lineStrong"), "--line-strong"],
                  [translate("components:ink3"), "--ink-3"],
                  [translate("components:ink2"), "--ink-2"],
                  [translate("components:ink"), "--ink"],
                ]}
              />
              <SwatchRow
                label={translate("components:graphiteAndGlass")}
                items={[
                  [translate("components:graphiteDeep"), "--graphite-deep"],
                  [translate("components:graphite"), "--graphite"],
                  [translate("components:graphiteLine"), "--graphite-line"],
                  [translate("components:glassInk"), "--glass-ink"],
                  [translate("components:glass"), "--glass"],
                  [translate("components:glassHot"), "--glass-hot"],
                ]}
              />
              <div>
                <p className="mb-3 text-[0.75rem] leading-5 font-semibold text-ink-3">
                  {translate("components:foundationsFillAndInk")}
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
            title={translate("components:type")}
            note={translate(
              "components:archivoStretchedTwoWaysWideAndExtraBold",
            )}
          >
            <div className="grid gap-8">
              <TypeRow meta={translate("components:displayWide800")}>
                <span className="font-wide text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">
                  {translate("components:unlockYourVoice")}
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:headlineWide800")}>
                <span className="font-wide text-[clamp(1.75rem,3vw,2.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">
                  {translate("review:feedbackviewNotesOnYourTake")}
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:lyricWide600")}>
                <span className="font-wide text-[clamp(1.375rem,2.1vw,1.875rem)] leading-[1.3] font-semibold tracking-[-0.015em]">
                  {translate("components:itSSayingNo")}
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:titleWide700")}>
                <span className="font-wide text-[1.5rem] leading-10 font-bold tracking-[-0.02em]">
                  {translate("common:foundationsRateOfSpeech")}
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:bodyLead400")}>
                <span className="block max-w-[46ch] text-[1.0625rem] leading-7 text-ink-2">
                  {translate("components:everyNoteEndsWithOneThingToTry")}
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:bodySmall400")}>
                <span className="block max-w-[52ch] text-[0.8125rem] leading-5 text-ink-2">
                  {translate("review:RATE_IMPORTANCE_FAST_why_it_matters")}
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:label600")}>
                <span
                  className="text-[0.75rem] leading-5 font-semibold"
                  style={{ color: "var(--f-pauses-ink)" }}
                >
                  {translate("common:foundationsPauses")}{" "}
                  <span className="font-normal text-ink-3">
                    {translate("review:feedbackviewPauseTooLong")}
                  </span>
                </span>
              </TypeRow>
              <TypeRow meta={translate("components:timeCatalogMartianMono")}>
                <span className="font-mono text-[0.75rem] tabular">
                  {translate("components:000470015Mmv001")}
                </span>
              </TypeRow>
            </div>
          </Showcase>

          <Showcase
            id="mark"
            title={translate("components:mark")}
            note={translate(
              "components:placeholderUntilTheMarkIsDesignedAMicrophone",
            )}
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
            title={translate("components:cover")}
            note={translate("components:drawnFromTheTakeOneRidgeForEach")}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <figure>
                <CoverArt
                  take={TAKE}
                  review={SAMPLE_REVIEW}
                  title={sampleTitle()}
                  className="cover-shadow"
                  top={<CoverTop no="MMV 001" />}
                  bottom={<CoverTitle title={sampleTitle()} />}
                />
                <figcaption className="mt-4 text-[0.8125rem] leading-5 text-ink-3">
                  {translate("components:aTakeSCover")}
                </figcaption>
              </figure>
              <figure>
                <CoverArt
                  take={TAKE}
                  review={SAMPLE_REVIEW}
                  title={sampleTitle()}
                  palette={COVER_PALETTE}
                  className="cover-shadow"
                  top={<CoverTop no="MMV 001" />}
                  bottom={<CoverTitle title={sampleTitle()} />}
                />
                <figcaption className="mt-4 text-[0.8125rem] leading-5 text-ink-3">
                  {translate("components:promotionalSleeve")}
                </figcaption>
              </figure>
            </div>
          </Showcase>

          <Showcase
            id="lyric"
            title={translate("components:lyricSheet")}
            note={translate("components:aTakeReadAsItsLyricsTimecodesIn")}
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
            title={translate("review:feedbackviewNote")}
            note={translate("components:sitsUnderTheLineItIsAboutAnd")}
          >
            <ul className="grid max-w-[38rem] gap-1">
              {REVIEW_FIXTURE.review.findings.slice(0, 2).map((f, i) => (
                <Note
                  key={f.id}
                  quote={
                    i === 0
                      ? translate("components:forThreeYearsIRanTheNightShift2")
                      : translate("components:nobodyTellsYouIsThat")
                  }
                  note={f}
                  open={i === 0}
                  onOpen={() => undefined}
                  onPlay={() => undefined}
                  onPlaySpan={() => undefined}
                />
              ))}
            </ul>
          </Showcase>

          <Showcase
            id="recorder"
            title={translate("components:recorderTape")}
            note={translate("components:oneMinuteOfTapeLeftToRightIt")}
          >
            <div className="grid gap-8">
              {[
                {
                  get label() {
                    return translate("components:empty");
                  },
                  length: 0,
                },
                {
                  get label() {
                    return translate("components:a15SecondTake");
                  },
                  length: TAKE.duration,
                },
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
            title={translate("components:notePins")}
            note={translate(
              "components:stateIsDrawnWithStrokeNeverColourFilled",
            )}
          >
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  kind: "strength" as const,
                  tentative: false,
                  get label() {
                    return translate("components:strengthClear");
                  },
                },
                {
                  kind: "improvement" as const,
                  tentative: false,
                  get label() {
                    return translate("components:toImproveClear");
                  },
                },
                {
                  kind: "strength" as const,
                  tentative: true,
                  get label() {
                    return translate("components:strengthTentative");
                  },
                },
                {
                  kind: "improvement" as const,
                  tentative: true,
                  get label() {
                    return translate("components:toImproveTentative");
                  },
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
            title={translate("components:button")}
            note={translate("components:inkForThePrimaryActionOrangeGlassFor")}
          >
            <div className="grid gap-6">
              <Row>
                <Button>
                  {translate("publicWebsite:sitefooterTryAFreeReview")}
                </Button>
                <Button variant="outline">
                  <PlayIcon className="fill-glass text-glass" />
                  {translate("components:seeAnExample")}
                  <span className="font-mono text-[0.75rem] text-ink-3 tabular">
                    0:15
                  </span>
                </Button>
                <Button variant="secondary">
                  {translate("components:secondary")}
                </Button>
                <Button variant="ghost">{translate("components:ghost")}</Button>
                <Button variant="link">
                  {translate("components:readTheLesson")}
                </Button>
                <Button variant="destructive">
                  {translate("components:discardTake")}
                </Button>
              </Row>
              <Row>
                <Button variant="glass">
                  <SquareIcon className="fill-current" />
                  {translate("review:tryreviewStopRecording")}
                </Button>
                <Button
                  variant="glass"
                  size="icon-lg"
                  className="rounded-full"
                  aria-label={translate("review:feedbackviewPause")}
                >
                  <PauseIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="rounded-full"
                  aria-label={translate("review:feedbackviewPlay")}
                >
                  <PlayIcon className="translate-x-px" />
                </Button>
                <Button variant="graphite">
                  <UploadIcon />
                  {translate("review:tryreviewUploadAFile")}
                </Button>
              </Row>
              <Row>
                <Button size="xs">{translate("components:extraSmall")}</Button>
                <Button size="sm">{translate("components:small")}</Button>
                <Button>{translate("components:default")}</Button>
                <Button size="lg">{translate("components:large")}</Button>
              </Row>
              <Row>
                <Button disabled>{translate("components:disabled")}</Button>
                <Button aria-busy="true">
                  <Loader2Icon className="animate-spin" />
                  {translate("components:reviewing")}
                </Button>
                <Button variant="glass" disabled>
                  {translate("components:glassDisabled")}
                </Button>
              </Row>
            </div>
          </Showcase>

          <Showcase
            id="badge"
            title={translate("components:badge")}
            note={translate(
              "components:squareShoulderedTagsNeverPillsFoundationsCarryTheir",
            )}
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
                <Badge>{translate("components:default")}</Badge>
                <Badge variant="secondary">
                  {translate("common:foundationsMixed")}
                </Badge>
                <Badge variant="outline">
                  {translate("components:aiReview")}
                </Badge>
                <Badge variant="sample">
                  {translate("components:illustration")}
                </Badge>
                <Badge variant="live">
                  {translate("components:recording")}
                </Badge>
                <Badge variant="destructive">
                  {translate("components:failed")}
                </Badge>
              </Row>
            </div>
          </Showcase>

          <Showcase
            id="input"
            title={translate("components:inputLabel")}
            note={translate("components:glassInkFocusErrorsNameTheProblemAnd")}
          >
            <div className="grid max-w-md gap-6">
              <div className="grid gap-2">
                <Label htmlFor="c-email">{translate("components:email")}</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder={translate("components:youExampleCom")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-title">
                  {translate("components:takeTitle")}
                </Label>
                <Input
                  id="c-title"
                  defaultValue={translate("publicWebsite:sampleNightShift")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-bad">{translate("components:email")}</Label>
                <Input
                  id="c-bad"
                  aria-invalid="true"
                  defaultValue={translate("components:youExample")}
                  aria-describedby="c-bad-hint"
                />
                <p
                  id="c-bad-hint"
                  className="text-[0.8125rem] text-destructive"
                >
                  {translate("components:addTheDomainForExampleYouExampleCom")}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-off">
                  {translate("components:disabled")}
                </Label>
                <Input
                  id="c-off"
                  disabled
                  placeholder={translate("components:notAvailableYet")}
                />
              </div>
            </div>
          </Showcase>

          <Showcase
            id="tabs"
            title={translate("components:tabs")}
            note={translate("components:segmentedOnSunkenGroundOrASinglePixel")}
          >
            <div className="grid gap-8">
              <Tabs defaultValue={translate("components:notes")}>
                <TabsList>
                  <TabsTrigger value="notes">
                    {translate("review:editorNotes")}
                  </TabsTrigger>
                  <TabsTrigger value="transcript">
                    {translate("components:transcript")}
                  </TabsTrigger>
                  <TabsTrigger value="lesson">
                    {translate("components:lesson")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="notes" className="pt-3 text-ink-2">
                  {translate("components:sixNotesAcrossFiveFoundations")}
                </TabsContent>
                <TabsContent value="transcript" className="pt-3 text-ink-2">
                  {translate("components:forThreeYearsIRanTheNightShift")}
                </TabsContent>
                <TabsContent value="lesson" className="pt-3 text-ink-2">
                  {translate("components:giveImportantPointsEnoughTime")}
                </TabsContent>
              </Tabs>
              <Tabs defaultValue="take-2">
                <TabsList variant="line">
                  <TabsTrigger value="take-1">
                    {translate("components:take1")}
                  </TabsTrigger>
                  <TabsTrigger value="take-2">
                    {translate("components:take2")}
                  </TabsTrigger>
                  <TabsTrigger value="take-3" disabled>
                    {translate("components:take3")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Showcase>

          <Showcase
            id="toggle"
            title={translate("components:toggleLayers")}
            note={translate("components:layerSwitchesKeepTheLabelInkOnlyThe")}
          >
            <div className="grid gap-8 md:grid-cols-2">
              <ToggleGroup
                type="multiple"
                defaultValue={["rate", "volume", "pauses"]}
                orientation="vertical"
                spacing={0}
                className="w-56 gap-0! overflow-hidden rounded-md border border-line bg-paper! p-0!"
                aria-label={translate("components:layers")}
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
                  defaultValue={translate("components:all")}
                  spacing={0}
                  aria-label={translate("components:filterNotes")}
                >
                  <ToggleGroupItem value="all" size="sm">
                    {translate("components:all2")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="strengths" size="sm">
                    {translate("review:feedbackviewStrengths")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="improve" size="sm">
                    {translate("review:editorToImprove2")}
                  </ToggleGroupItem>
                </ToggleGroup>
                <Row>
                  <Toggle
                    aria-label={translate("components:loop")}
                    defaultPressed
                  >
                    {translate("components:loopPassage")}
                  </Toggle>
                  <Toggle
                    variant="outline"
                    aria-label={translate("components:showTranscript")}
                  >
                    {translate("components:transcript")}
                  </Toggle>
                </Row>
              </div>
            </div>
          </Showcase>

          <Showcase
            id="slider"
            title={translate("components:scrubber")}
            note={translate("components:theSliderIsThePlayheadAOnePixel")}
          >
            <ScrubberDemo />
          </Showcase>

          <Showcase
            id="card"
            title={translate("components:card")}
            note={translate("components:hairlineBorderBarelyLiftedNeverNested")}
          >
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>
                  {translate("publicWebsite:sampleNightShift")}
                </CardTitle>
                <CardDescription>
                  {translate("components:recordedToday0156Notes")}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-ink-2">
                {translate(
                  "components:allFiveFoundationsReviewedTwoNotesOnPace",
                )}
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">{translate("components:openReview")}</Button>
                <Button size="sm" variant="ghost">
                  {translate("components:retake")}
                </Button>
              </CardFooter>
            </Card>
          </Showcase>

          <Showcase
            id="tooltip"
            title={translate("components:tooltip")}
            note={translate("components:inkOnWhiteUsedForMeasuredValuesAnd")}
          >
            <Row>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">
                    {translate("components:07S")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {translate("components:silenceBetweenTwoLinesInSeconds")}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={translate("components:aboutTentativeNotes")}
                  >
                    <InfoIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {translate(
                    "components:tentativeNotesAreJudgmentCallsOtherReadingsCould",
                  )}
                </TooltipContent>
              </Tooltip>
            </Row>
          </Showcase>

          <Showcase
            id="dialog"
            title={translate("components:dialog")}
            note={translate("components:onlyWhereFocusMustBeProtectedSuchAs")}
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  {translate("components:discardThisTake")}
                </Button>
              </DialogTrigger>
              <DialogContent closeLabel={translate("common:close")}>
                <DialogHeader>
                  <DialogTitle>
                    {translate("components:discardThisTake2")}
                  </DialogTitle>
                  <DialogDescription>
                    {translate("components:theRecordingAndItsReviewWillBeGone")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter closeLabel={translate("common:close")}>
                  <DialogClose asChild>
                    <Button variant="ghost">
                      {translate("components:keepIt")}
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive">
                      {translate("components:discardTake")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Showcase>

          <Showcase
            id="sheet"
            title={translate("components:sheet")}
            note={translate(
              "components:onPhonesNotesAndNavigationArriveFromThe",
            )}
          >
            <Row>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    {translate("components:openNotes")}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  closeLabel={translate("common:close")}
                  side="bottom"
                >
                  <SheetHeader>
                    <SheetTitle>{translate("review:editorNotes")}</SheetTitle>
                    <SheetDescription>
                      {translate("components:sixNotesAcrossFiveFoundations")}
                    </SheetDescription>
                  </SheetHeader>
                  <p className="px-4 pb-6 text-ink-2">
                    {translate("components:eachNoteIsPinnedToTheSecondIt")}
                  </p>
                </SheetContent>
              </Sheet>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    {translate("publicWebsite:sitenavOpenMenu")}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  closeLabel={translate("common:close")}
                  side="right"
                >
                  <SheetHeader>
                    <SheetTitle>{translate("common:markMicmane")}</SheetTitle>
                    <SheetDescription>
                      {translate("components:navigation")}
                    </SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </Row>
          </Showcase>

          <Showcase
            id="progress"
            title={translate("components:progress")}
            note={translate("components:aGlassBeadFillingASunkenTrackFor")}
          >
            <div className="grid max-w-md gap-4">
              <Progress value={18} aria-label={translate("components:early")} />
              <Progress
                value={64}
                aria-label={translate("components:midway")}
              />
              <Progress value={100} aria-label={translate("components:done")} />
            </div>
          </Showcase>

          <Showcase
            id="alert"
            title={translate("components:alert")}
            note={translate(
              "components:hairlineForInformationTintedForErrorsGraphiteOn",
            )}
          >
            <div className="grid max-w-2xl gap-4">
              <Alert>
                <InfoIcon />
                <AlertTitle>
                  {translate("components:takesOverAMinuteAreTrimmed")}
                </AlertTitle>
                <AlertDescription>
                  {translate(
                    "components:theCoachReviewsTheMiddleMinuteTimestampsRefer",
                  )}
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <OctagonXIcon />
                <AlertTitle>
                  {translate("components:theCoachIsBusyRightNow")}
                </AlertTitle>
                <AlertDescription>
                  {translate("components:waitAMinuteAndSendTheTakeAgain")}
                </AlertDescription>
              </Alert>
              <Alert variant="graphite">
                <MicIcon />
                <AlertTitle>
                  {translate("components:microphoneAccessIsBlocked")}
                </AlertTitle>
                <AlertDescription>
                  {translate("components:allowTheMicrophoneForThisSiteInYour")}
                </AlertDescription>
              </Alert>
            </div>
          </Showcase>

          <Showcase
            id="accordion"
            title={translate("components:accordion")}
            note={translate("components:questionsAndLongExplanations")}
          >
            <Accordion type="single" collapsible className="max-w-2xl">
              <AccordionItem value="a">
                <AccordionTrigger>
                  {translate("components:doesMicmaneScoreMyVoice")}
                </AccordionTrigger>
                <AccordionContent>
                  {translate("components:noYouGetNotesOnMomentsInYour")}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>
                  {translate("components:isMyRecordingStored")}
                </AccordionTrigger>
                <AccordionContent>
                  {translate("components:noItIsSentToDeepgramAndMistral")}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="c">
                <AccordionTrigger>
                  {translate("components:whichLanguagesWork")}
                </AccordionTrigger>
                <AccordionContent>
                  {translate("components:englishWithOneSpeakerForNow")}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Showcase>

          <Showcase
            id="toast"
            title={translate("components:toast")}
            note={translate("components:quietConfirmationFromTheCorner")}
          >
            <Row>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success(
                    translate("review:tryreviewYourReviewIsReady"),
                    {
                      get description() {
                        return translate("components:6NotesOnYourTake");
                      },
                    },
                  )
                }
              >
                {translate("components:success")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast(translate("components:takeSavedToThisSession"))
                }
              >
                {translate("components:neutral")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error(
                    translate("components:theReviewCouldnTBeCompleted"),
                    {
                      get description() {
                        return translate("components:sendTheTakeAgain");
                      },
                    },
                  )
                }
              >
                {translate("components:error")}
              </Button>
            </Row>
          </Showcase>

          <Showcase
            id="skeleton"
            title={translate("components:skeleton")}
            note={translate("components:holdsTheReviewSShapeWhileItLoads")}
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
            title={translate("components:separator")}
            note={translate("components:rowsAndSectionsSeparateBySpacingALine")}
          >
            <div className="max-w-md">
              <p className="text-sm">
                {translate("common:foundationsRateOfSpeech")}
              </p>
              <Separator className="my-3" />
              <p className="text-sm">{translate("common:foundationsVolume")}</p>
              <div className="mt-4 flex h-5 items-center gap-3 text-sm">
                <span>00:04.7</span>
                <Separator orientation="vertical" />
                <span>{translate("common:foundationsPauses")}</span>
                <Separator orientation="vertical" />
                <span>{translate("review:editorStrength")}</span>
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
  useTranslation();
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
  const { t: translate } = useTranslation([
    COMMON_NS,
    REVIEW_NS,
    PUBLIC_WEBSITE_NS,
    COMPONENTS_NS,
  ]);
  return (
    <>
      <span className="font-wide text-[0.9375rem] font-extrabold tracking-[-0.02em]">
        {translate("common:markMicmane")}
      </span>
      <span className="font-mono text-[0.6875rem] text-on-graphite-muted tabular">
        {no}
      </span>
    </>
  );
}

function CoverTitle({ title }: { title: string }) {
  const { t: translate } = useTranslation([
    COMMON_NS,
    REVIEW_NS,
    PUBLIC_WEBSITE_NS,
    COMPONENTS_NS,
  ]);
  return (
    <span className="min-w-0">
      <span className="block font-wide text-[1.5rem] leading-none font-extrabold tracking-[-0.03em]">
        {title}
      </span>
      <span className="mt-2 block font-mono text-[0.75rem] text-on-graphite-muted tabular">
        {translate("components:take1015")}
      </span>
    </span>
  );
}

function Row({ children }: { children: ReactNode }) {
  useTranslation();
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function SwatchRow({
  label,
  items,
}: {
  label: string;
  items: [string, string][];
}) {
  useTranslation();
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
  useTranslation();
  return (
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:items-baseline md:gap-6">
      <p className="text-[0.75rem] leading-5 text-ink-3">{meta}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ScrubberDemo() {
  const { t: translate } = useTranslation([
    COMMON_NS,
    REVIEW_NS,
    PUBLIC_WEBSITE_NS,
    COMPONENTS_NS,
  ]);
  const [t, setT] = useState(4.7);
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between font-mono text-[0.75rem] text-ink-3 tabular">
        <span>
          <span className="text-ink">{formatTime(t)}</span> /{" "}
          {formatTime(TAKE.duration, false)}
        </span>
        <span>{translate("components:arrowKeysMove01S")}</span>
      </div>
      <Slider
        aria-label={translate("components:scrub")}
        min={0}
        max={TAKE.duration}
        step={0.1}
        value={[t]}
        onValueChange={([v]) => setT(v)}
      />
      <div className="mt-6 max-w-xs">
        <Slider
          aria-label={translate("components:disabledScrubber")}
          defaultValue={[40]}
          disabled
        />
      </div>
    </div>
  );
}
