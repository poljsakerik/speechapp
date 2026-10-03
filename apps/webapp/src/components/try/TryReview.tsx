import { formatList, REVIEW_NS, VALIDATION_NS } from "@/core/i18n";
import type { ReviewErrorKey } from "@/lib/api";
import { FormMessage } from "@micmane/ui/components/form";
import { useMutation } from "@tanstack/react-query";
import {
  FileAudioIcon,
  MicIcon,
  MicOffIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTakePlayer } from "@/components/liner/useTakePlayer";
import {
  measureTake,
  recordingErrorKey,
  reviewErrorKey,
  toReviewResult,
  type ReviewResult,
} from "@/lib/api";
import { FOUNDATIONS } from "@/lib/foundations";
import { formatTime } from "@/lib/review";
import { trpc } from "@/lib/trpc";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@micmane/ui/components/alert";
import { Button } from "@micmane/ui/components/button";
import { cn } from "@micmane/ui/lib/utils";

const MAX_SECONDS = 60;
const ACCEPT =
  "audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,video/mp4,video/webm,video/quicktime,.m4a,.mp3,.wav,.webm,.mp4,.mov";
/** Level samples per second while recording. */
const RATE_HZ = 14;

type State =
  | { name: "idle" }
  | { name: "asking" }
  | { name: "denied" }
  | { name: "recording"; started: number }
  | { name: "ready"; blob: Blob; label: string; url: string }
  | {
      name: "reviewing";
      blob: Blob;
      label: string;
      url: string;
      started: number;
    }
  | {
      name: "error";
      message: ReviewErrorKey;
      blob?: Blob;
      label?: string;
      url?: string;
    };

type TryReviewProps = {
  uploadFirst?: boolean;
  /** Called with the finished review; the caller shows it and owns its audio URL. */
  onReviewed: (result: ReviewResult) => void;
};

/**
 * Record or upload a take. The page carries a minute of tape: it fills with
 * your level as you speak, and holds the take while the coach listens.
 */
export function TryReview({ uploadFirst = false, onReviewed }: TryReviewProps) {
  const { t: translate } = useTranslation([REVIEW_NS, VALIDATION_NS]);
  const [state, setState] = useState<State>({ name: "idle" });
  const [now, setNow] = useState(() => performance.now());
  const [history, setHistory] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<{
    blob: Blob;
    duration: number;
    level: number[];
  }>();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<{ context: AudioContext; frame: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { mutateAsync: createReview } = useMutation(
    trpc.review.create.mutationOptions(),
  );
  const [dragging, setDragging] = useState(false);

  const live = state.name === "recording" || state.name === "reviewing";
  const url =
    state.name === "ready" ||
    state.name === "reviewing" ||
    state.name === "error"
      ? state.url
      : undefined;
  const blob =
    state.name === "ready" ||
    state.name === "reviewing" ||
    state.name === "error"
      ? state.blob
      : undefined;
  const measured = drawn && drawn.blob === blob ? drawn : undefined;
  const player = useTakePlayer(measured?.duration ?? MAX_SECONDS);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [live]);

  // Draw the chosen take on the tape from its own audio.
  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    measureTake(blob, [], 240)
      .then(
        (take) =>
          !cancelled &&
          setDrawn({
            blob,
            duration: take.duration,
            level: take.volume ?? take.peaks,
          }),
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [blob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const stopMeter = () => {
    if (meter.current) {
      cancelAnimationFrame(meter.current.frame);
      void meter.current.context.close();
      meter.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => stopMeter, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  // Recordings stop on their own at one minute, the length the coach reviews.
  useEffect(() => {
    if (
      state.name === "recording" &&
      (now - state.started) / 1000 >= MAX_SECONDS
    )
      stop();
  }, [now, state, stop]);

  const record = async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setState({
        name: "error",
        message: "review:tryreviewThisBrowserCanTRecordAudioUploadA",
      });
      return;
    }
    setState({ name: "asking" });
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch {
      setState({ name: "denied" });
      return;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream.current).connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);
    const levels: number[] = [];
    let last = 0;
    setHistory([]);
    const loop = (t: number) => {
      analyser.getByteTimeDomainData(buffer);
      if (t - last > 1000 / RATE_HZ) {
        let sum = 0;
        for (const v of buffer) sum += ((v - 128) / 128) ** 2;
        levels.push(Math.min(1, Math.sqrt(sum / buffer.length) * 4));
        setHistory([...levels]);
        last = t;
      }
      if (meter.current) meter.current.frame = requestAnimationFrame(loop);
    };
    meter.current = { context, frame: requestAnimationFrame(loop) };

    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream.current);
    media.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    media.onstop = () => {
      stopMeter();
      const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
      setState({
        name: "ready",
        blob,
        get label() {
          return translate("review:tryreviewYourRecording");
        },
        url: URL.createObjectURL(blob),
      });
    };
    recorder.current = media;
    media.start();
    setState({ name: "recording", started: performance.now() });
  };

  const choose = (file: File | undefined) => {
    if (!file) return;
    // Say what is wrong with a file as soon as it is chosen, not after it is sent.
    const invalid = recordingErrorKey(file);
    if (invalid) {
      setState({ name: "error", message: invalid });
      return;
    }
    setState({
      name: "ready",
      blob: file,
      label: file.name,
      url: URL.createObjectURL(file),
    });
  };

  const send = async (blob: Blob, label: string, url: string) => {
    // The same checks the backend runs, so a take it would refuse isn't uploaded.
    const invalid = recordingErrorKey(blob);
    if (invalid) {
      setState({
        name: "error",
        message: invalid,
        blob,
        label,
        url,
      });
      return;
    }
    setState({
      name: "reviewing",
      blob,
      label,
      url,
      started: performance.now(),
    });
    try {
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("mpeg")
          ? "mp3"
          : blob.type.includes("wav")
            ? "wav"
            : "webm";
      const body = new FormData();
      body.append("file", blob, label.includes(".") ? label : `take.${ext}`);
      const result = await toReviewResult(await createReview(body), blob);
      setState({ name: "idle" });
      onReviewed(result);
      const strengths = result.review.findings.filter(
          (f) => f.kind === "strength",
        ).length,
        notes = result.review.findings.length - strengths;
      const counts = [
        ...(notes
          ? [translate("review:reviewReadyNotes", { count: notes })]
          : []),
        ...(strengths
          ? [translate("review:reviewReadyStrengths", { count: strengths })]
          : []),
      ];
      toast.success(translate("review:tryreviewYourReviewIsReady"), {
        description: counts.length
          ? translate("review:reviewReadyDescription", {
              counts: formatList(counts),
            })
          : translate("review:tryreviewNoNotesOnThisTake"),
      });
    } catch (error) {
      setState({
        name: "error",
        message: reviewErrorKey(error),
        blob,
        label,
        url,
      });
    }
  };

  const reset = () => setState({ name: "idle" });

  const elapsed =
    state.name === "recording"
      ? Math.min(MAX_SECONDS, (now - state.started) / 1000)
      : 0;
  const listening =
    state.name === "reviewing" ? (now - state.started) / 1000 : 0;

  // What the tape shows: the voice as it arrives, then the take itself.
  const tape =
    state.name === "recording"
      ? { level: history, length: elapsed }
      : measured &&
          (state.name === "ready" ||
            state.name === "reviewing" ||
            state.name === "error")
        ? {
            level: measured.level,
            length: Math.min(measured.duration, MAX_SECONDS),
          }
        : { level: [], length: 0 };
  const head =
    state.name === "recording"
      ? elapsed
      : player.started && state.name === "ready"
        ? player.time
        : undefined;

  return (
    <div className="grid gap-x-12 gap-y-12 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      <div className="lg:col-span-5">
        {/* Trimmed to the capitals, so the letters, not their line box, meet the card's top edge. */}
        <h1 className="font-wide text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance lg:[text-box:trim-start_cap_alphabetic]">
          {translate("review:tryreviewRecordATake")}
        </h1>
        <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-7 text-pretty text-ink-2">
          {translate("review:tryreviewSpeakForUpToAMinuteTellA")}
        </p>
      </div>

      <div
        className={cn(
          "booklet-page relative flex flex-col justify-center p-4 transition-shadow duration-200 sm:p-8 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 xl:p-12",
          dragging && "ring-2 ring-glass ring-offset-4 ring-offset-paper",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!live) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!live) choose(e.dataTransfer.files[0]);
        }}
      >
        <Tape
          level={tape.level}
          length={tape.length}
          head={head}
          live={state.name === "recording" || player.playing}
          scanning={state.name === "reviewing"}
        />

        <div className="mt-10 min-w-0" aria-live="polite">
          {state.name === "idle" && (
            <>
              <p className="font-wide text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.15] font-bold tracking-[-0.02em] text-balance">
                {uploadFirst
                  ? translate(
                      "review:tryreviewDropARecordingHereOrRecordOneNow",
                    )
                  : translate("review:tryreviewPressRecordAndTalk")}
              </p>
              <p className="mt-4 max-w-[44ch] text-[0.9375rem] leading-6 text-ink-2">
                {translate("review:tryreviewTheTapeAboveHoldsOneMinuteItFills")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() =>
                    uploadFirst ? fileInput.current?.click() : void record()
                  }
                >
                  {uploadFirst ? <UploadIcon /> : <MicIcon />}
                  {uploadFirst
                    ? translate("review:tryreviewChooseARecording")
                    : translate("review:tryreviewRecord")}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() =>
                    uploadFirst ? void record() : fileInput.current?.click()
                  }
                >
                  {uploadFirst ? <MicIcon /> : <UploadIcon />}
                  {uploadFirst
                    ? translate("review:tryreviewRecordInstead")
                    : translate("review:tryreviewUploadAFile")}
                </Button>
              </div>
            </>
          )}

          {state.name === "asking" && (
            <p className="font-wide text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.15] font-bold tracking-[-0.02em] text-balance">
              {translate(
                "review:tryreviewAllowTheMicrophoneInYourBrowserToStart",
              )}
            </p>
          )}

          {state.name === "denied" && (
            <Alert variant="destructive" className="max-w-xl">
              <MicOffIcon />
              <AlertTitle>
                {translate("review:tryreviewTheMicrophoneIsBlocked")}
              </AlertTitle>
              <AlertDescription>
                {translate(
                  "review:tryreviewAllowTheMicrophoneForThisSiteInYour",
                )}
              </AlertDescription>
              <div className="col-start-2 mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void record()}>
                  {translate("review:tryreviewTryAgain")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                >
                  {translate("review:tryreviewUploadAFile")}
                </Button>
              </div>
            </Alert>
          )}

          {state.name === "recording" && (
            <>
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-light text-ink tabular">
                  {formatTime(elapsed)}
                </span>
                <span className="font-mono text-[0.75rem] text-ink-3 tabular">
                  {translate("review:recordingLimit", {
                    duration: formatTime(MAX_SECONDS, false),
                  })}
                </span>
              </p>
              <p className="mt-6 max-w-[44ch] text-[0.9375rem] leading-6 text-ink-2">
                {translate("review:tryreviewRecordingSpeakAsYouWouldToARoom")}
              </p>
              <Button variant="glass" size="lg" className="mt-8" onClick={stop}>
                <SquareIcon className="fill-current" />
                {translate("review:tryreviewStopRecording")}
              </Button>
            </>
          )}

          {(state.name === "ready" || state.name === "error") && state.url && (
            <>
              <audio src={state.url} {...player.audioProps} />
              <p className="font-wide text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.15] font-bold tracking-[-0.02em]">
                {translate("review:tryreviewYourTake")}
              </p>
              <p className="mt-2 flex min-w-0 items-center gap-2 text-[0.8125rem] leading-5 text-ink-3">
                <FileAudioIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{state.label}</span>
                {measured && (
                  <span className="shrink-0 font-mono text-[0.75rem] tabular">
                    · {formatTime(measured.duration, false)}
                  </span>
                )}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button
                  variant="glass"
                  size="icon-lg"
                  className="rounded-full"
                  onClick={() => void player.toggle()}
                  aria-label={
                    player.playing
                      ? translate("review:tryreviewPauseYourTake")
                      : translate("review:tryreviewPlayYourTake")
                  }
                >
                  {player.playing ? (
                    <PauseIcon className="fill-current" />
                  ) : (
                    <PlayIcon className="translate-x-px fill-current" />
                  )}
                </Button>
                <span className="font-mono text-[0.75rem] text-ink-3 tabular">
                  <span
                    className={player.playing ? "text-glass-ink" : "text-ink"}
                  >
                    {formatTime(player.time)}
                  </span>
                  {measured && <> / {formatTime(measured.duration, false)}</>}
                </span>
              </div>
              {measured && measured.duration > MAX_SECONDS && (
                <p className="mt-4 max-w-[44ch] text-[0.8125rem] leading-5 text-ink-2">
                  {translate("review:tryreviewThisTakeIsLongerThanAMinuteThe")}
                </p>
              )}
              {state.name === "error" && (
                <Alert variant="destructive" className="mt-6 max-w-xl">
                  <MicOffIcon />
                  <AlertTitle>
                    {translate("review:tryreviewThatDidnTWork")}
                  </AlertTitle>
                  <AlertDescription>
                    <FormMessage message={state.message} t={translate} />
                  </AlertDescription>
                </Alert>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() =>
                    void send(state.blob!, state.label ?? "take", state.url!)
                  }
                >
                  {state.name === "error"
                    ? translate("review:tryreviewSendItAgain")
                    : translate("review:tryreviewReviewThisTake")}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"

                  onClick={reset}
                >
                  <XIcon />
                  {state.name === "error"
                    ? translate("review:tryreviewStartOver")
                    : translate("review:tryreviewDiscard")}
                </Button>
              </div>
            </>
          )}

          {state.name === "error" && !state.url && (
            <Alert variant="destructive" className="max-w-xl">
              <MicOffIcon />
              <AlertTitle>
                {translate("review:tryreviewThatDidnTWork")}
              </AlertTitle>
              <AlertDescription>
                <FormMessage message={state.message} t={translate} />
              </AlertDescription>
              <div className="col-start-2 mt-3 flex gap-2">
                <Button size="sm" onClick={() => fileInput.current?.click()}>
                  {translate("review:tryreviewUploadAFile")}
                </Button>
                <Button variant="outline" size="sm" onClick={reset}>
                  {translate("review:tryreviewStartOver")}
                </Button>
              </div>
            </Alert>
          )}

          {state.name === "reviewing" && (
            <>
              <p className="font-wide text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.15] font-bold tracking-[-0.02em]">
                {translate("review:tryreviewListeningToYourTake")}
              </p>
              <p className="mt-4 max-w-[44ch] text-[0.9375rem] leading-6 text-ink-2">
                {translate(
                  "review:tryreviewTheCoachTranscribesItThenListensForAll",
                )}
              </p>
              <p className="mt-6 font-mono text-[0.75rem] text-ink-3 tabular">
                {formatTime(listening, false)}
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Sits on the card's bottom edge, so the left column is as tall as the card. */}
      <div className="lg:col-span-5 lg:row-start-2 lg:self-end">
        <h2
          className={cn(
            "text-[0.75rem] leading-5 font-semibold transition-colors",
            state.name === "reviewing" ? "text-glass-ink" : "text-ink-3",
          )}
        >
          {state.name === "reviewing"
            ? translate("review:tryreviewTheCoachIsListeningFor")
            : translate("review:tryreviewTheCoachListensFor")}
        </h2>
        <ul className="mt-2 grid gap-1">
          {FOUNDATIONS.map((f) => (
            <li
              key={f.key}
              className="group/f flex items-baseline gap-3 text-[0.875rem] leading-6 font-semibold text-ink"
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[2px]"
                style={{
                  background: f.fill,
                  boxShadow: `inset 0 0 0 1px ${f.ink}`,
                }}
              />
              {/* The last name is trimmed to its baseline, so the letters meet the card's bottom edge. */}
              <span className="block lg:group-last/f:[text-box:trim-end_cap_alphabetic]">
                {f.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * One minute of tape, left to right. What has been recorded is drawn as its
 * level; what is left is a bare line, waiting.
 */
export function Tape({
  level,
  length,
  head,
  live,
  scanning,
}: {
  level: number[];
  length: number;
  head?: number;
  live: boolean;
  scanning: boolean;
}) {
  useTranslation();
  const end = (Math.min(length, MAX_SECONDS) / MAX_SECONDS) * 100;
  const shape = useMemo(() => {
    if (!level.length || end <= 0) return "";
    // About one point per stretch of tape, each the average of its stretch, so the level reads smoothly.
    const N = Math.max(2, Math.min(level.length, Math.round(end * 0.8) + 2));
    const averages = Array.from({ length: N }, (_, i) => {
      const a = Math.floor((i / N) * level.length);
      const stretch = level.slice(
        a,
        Math.max(a + 1, Math.floor(((i + 1) / N) * level.length)),
      );
      return stretch.reduce((sum, x) => sum + x, 0) / stretch.length;
    });
    const peak = Math.max(...averages, 0.05);
    const points = averages.map(
      (v, i) => [(i / (N - 1)) * end, 50 - 4 - (v / peak) * 40] as const,
    );
    const upper = points
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" L");
    const lower = [...points]
      .reverse()
      .map(([x, y]) => `${x.toFixed(2)},${(100 - y).toFixed(2)}`)
      .join(" L");
    return `M${upper} L${lower} Z`;
  }, [level, end]);
  const at =
    head !== undefined
      ? (Math.min(head, MAX_SECONDS) / MAX_SECONDS) * 100
      : undefined;

  return (
    <div aria-hidden="true">
      <div className="relative h-14 rounded-[4px] bg-paper shadow-[inset_0_0_0_1px_var(--line)]">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-x-3 inset-y-0 h-full w-[calc(100%-1.5rem)] overflow-visible"
        >
          <line
            x1={end}
            y1="50"
            x2="100"
            y2="50"
            stroke="var(--line-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {shape && <path d={shape} fill="var(--ink)" />}
        </svg>
        <div className="absolute inset-x-3 inset-y-0">
          {scanning && end > 0 && (
            <span
              className="tape-scan absolute -inset-y-1.5 w-0.5 rounded-full bg-glass"
              style={{ "--tape-end": `${end}%` } as CSSProperties}
            />
          )}
          {at !== undefined && (
            <span
              className={cn(
                "absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full",
                live ? "bg-glass" : "bg-ink",
              )}
              style={{ left: `${at}%` }}
            />
          )}
        </div>
      </div>
      <div className="relative mx-3 mt-2 h-4">
        {[0, 15, 30, 45, 60].map((s) => (
          <span
            key={s}
            className={cn(
              "absolute top-0 font-mono text-[0.625rem] leading-4 text-ink-3 tabular",
              s === 0
                ? ""
                : s === 60
                  ? "-translate-x-full"
                  : "-translate-x-1/2",
            )}
            style={{ left: `${(s / 60) * 100}%` }}
          >
            {formatTime(s, false)}
          </span>
        ))}
      </div>
    </div>
  );
}
