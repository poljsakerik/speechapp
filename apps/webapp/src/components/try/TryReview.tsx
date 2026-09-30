import { useCallback, useEffect, useRef, useState } from "react"
import { FileAudioIcon, MicIcon, MicOffIcon, SquareIcon, UploadIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Editor } from "@/components/editor/Editor"
import { Alert, AlertDescription, AlertTitle } from "@micmane/ui/components/alert"
import { Badge } from "@micmane/ui/components/badge"
import { Button } from "@micmane/ui/components/button"
import { Progress } from "@micmane/ui/components/progress"
import { ReviewError, requestReview, type ReviewResult } from "@/lib/api"
import { FOUNDATIONS } from "@/lib/foundations"
import { formatTime } from "@/lib/review"
import { cn } from "@micmane/ui/lib/utils"

const MAX_SECONDS = 60
const ACCEPT = "audio/wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,video/mp4,video/webm,video/quicktime,.m4a,.mp3,.wav,.webm,.mp4,.mov"

type State =
  | { name: "idle" }
  | { name: "asking" }
  | { name: "denied" }
  | { name: "recording"; started: number }
  | { name: "ready"; blob: Blob; label: string; url: string }
  | { name: "reviewing"; blob: Blob; label: string; started: number }
  | { name: "done"; result: ReviewResult }
  | { name: "error"; message: string; blob?: Blob; label?: string }

export function TryReview({ uploadFirst = false }: { uploadFirst?: boolean }) {
  const [state, setState] = useState<State>({ name: "idle" })
  const [now, setNow] = useState(() => performance.now())
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0))
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const meter = useRef<{ context: AudioContext; frame: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const live = state.name === "recording" || state.name === "reviewing"
  const promptUpload = uploadFirst && state.name === "idle"

  const audioUrl = state.name === "ready" ? state.url : state.name === "done" ? state.result.audioUrl : undefined
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(id)
  }, [live])

  const stopMeter = () => {
    if (meter.current) {
      cancelAnimationFrame(meter.current.frame)
      void meter.current.context.close()
      meter.current = null
    }
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLevels(Array(28).fill(0))
  }

  useEffect(() => stopMeter, [])

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop()
  }, [])

  // Recordings stop on their own at one minute, the length the coach reviews.
  useEffect(() => {
    if (state.name === "recording" && (now - state.started) / 1000 >= MAX_SECONDS) stop()
  }, [now, state, stop])

  const record = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState({ name: "error", message: "This browser can't record audio. Upload a recording instead." })
      return
    }
    setState({ name: "asking" })
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setState({ name: "denied" })
      return
    }
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    context.createMediaStreamSource(stream.current).connect(analyser)
    const buffer = new Uint8Array(analyser.fftSize)
    const history: number[] = Array(28).fill(0)
    let last = 0
    const loop = (t: number) => {
      analyser.getByteTimeDomainData(buffer)
      if (t - last > 70) {
        let sum = 0
        for (const v of buffer) sum += ((v - 128) / 128) ** 2
        history.push(Math.min(1, Math.sqrt(sum / buffer.length) * 4))
        history.shift()
        setLevels([...history])
        last = t
      }
      if (meter.current) meter.current.frame = requestAnimationFrame(loop)
    }
    meter.current = { context, frame: requestAnimationFrame(loop) }

    const chunks: Blob[] = []
    const media = new MediaRecorder(stream.current)
    media.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    media.onstop = () => {
      stopMeter()
      const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" })
      setState({ name: "ready", blob, label: "Your recording", url: URL.createObjectURL(blob) })
    }
    recorder.current = media
    media.start()
    setState({ name: "recording", started: performance.now() })
  }

  const choose = (file: File | undefined) => {
    if (!file) return
    setState({ name: "ready", blob: file, label: file.name, url: URL.createObjectURL(file) })
  }

  const send = async (blob: Blob, label: string) => {
    setState({ name: "reviewing", blob, label, started: performance.now() })
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : "webm"
      const result = await requestReview(blob, label.includes(".") ? label : `take.${ext}`)
      setState({ name: "done", result })
      toast.success("Your review is ready", { description: `${result.review.findings.length} rate notes.` })
    } catch (error) {
      const message = error instanceof ReviewError ? error.message : "The review couldn't be completed. Send the take again."
      setState({ name: "error", message, blob, label })
    }
  }

  const reset = () => setState({ name: "idle" })

  if (state.name === "done") {
    return (
      <div className="space-y-4">
        <Editor
          take={state.result.take}
          review={state.result.review}
          audioSrc={state.result.audioUrl}
          title="Your take"
          badge={<Badge variant="outline">AI review</Badge>}
          action={
            <Button variant="outline" size="sm" onClick={reset}>
              {uploadFirst ? <UploadIcon /> : <MicIcon />}
              {uploadFirst ? "Upload another take" : "Record another take"}
            </Button>
          }
        />
        <p className="max-w-[70ch] text-[0.8125rem] text-ink-3">
          This is AI feedback and it can be wrong. Listen back to the passage before you act on a note. Timestamps
          refer to the minute that was reviewed.
        </p>
      </div>
    )
  }

  const elapsed = state.name === "recording" ? (now - state.started) / 1000 : 0
  const reviewingFor = state.name === "reviewing" ? (now - state.started) / 1000 : 0

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-graphite text-[oklch(0.95_0.002_80)] shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_1px_2px_oklch(0.2_0.005_60/0.3),0_40px_80px_-40px_oklch(0.25_0.005_60/0.6)]",
        dragging && "ring-2 ring-glass ring-offset-4 ring-offset-paper",
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!live) choose(e.dataTransfer.files[0])
      }}
    >
      <div className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-12 md:p-10 lg:grid-cols-[auto_minmax(0,1fr)_17rem]">
        {/* The orange glass: lit from inside only while it is working */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => (promptUpload ? fileInput.current?.click() : state.name === "recording" ? stop() : void record())}
            disabled={state.name === "asking" || state.name === "reviewing"}
            aria-label={promptUpload ? "Choose an audio recording" : state.name === "recording" ? "Stop recording" : "Start recording"}
            className={cn(
              "relative grid size-36 place-items-center rounded-full transition-[filter,transform] duration-300 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-glass-hot active:scale-[0.98] disabled:cursor-progress sm:size-44",
              live ? "glass-lit" : "glass-dim hover:brightness-110",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-3 rounded-full border transition-opacity duration-500",
                live ? "border-[oklch(1_0_0/0.4)] opacity-100" : "border-[oklch(1_0_0/0.14)] opacity-100",
              )}
            />
            {promptUpload ? (
              <UploadIcon className="size-9 text-[oklch(0.9_0.004_70)]" strokeWidth={1.75} />
            ) : state.name === "recording" ? (
              <SquareIcon className="size-8 fill-current text-[oklch(0.19_0.008_55)]" />
            ) : (
              <MicIcon className={cn("size-9", live ? "text-[oklch(0.19_0.008_55)]" : "text-[oklch(0.9_0.004_70)]")} strokeWidth={1.75} />
            )}
          </button>
          {/* Live level: the iridescent film only appears while recording */}
          <div className="flex h-7 items-center gap-[3px]" aria-hidden="true">
            {levels.map((v, i) => (
              <span
                key={i}
                className={cn("w-[3px] rounded-full transition-[height] duration-75", state.name === "recording" ? "film" : "bg-graphite-line")}
                style={{
                  height: `${4 + v * 24}px`,
                  backgroundSize: "3000% 100%",
                  backgroundPosition: `${(i / 27) * 100}% 0`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0" aria-live="polite">
          {state.name === "idle" && (
            <>
              <p className="font-wide text-2xl font-bold tracking-[-0.015em] text-[oklch(0.97_0.002_80)]">
                {uploadFirst ? "Drop your recording here." : "Press the glass and talk."}
              </p>
              <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-[oklch(0.85_0.004_70)]">
                {uploadFirst
                  ? "Choose an audio file or drag it here. Up to a minute, in English, one speaker. WAV, MP3, M4A, MP4 or WebM, up to 25 MB."
                  : "Tell a short story, pitch an idea, or introduce yourself. Up to a minute, in English, one speaker. You can also drop a recording here."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="glass" size="lg" onClick={() => (uploadFirst ? fileInput.current?.click() : void record())}>
                  {uploadFirst ? <UploadIcon /> : <MicIcon />}
                  {uploadFirst ? "Choose a recording" : "Start recording"}
                </Button>
                <Button
                  size="lg"
                  className="bg-[oklch(0.97_0.002_80)] text-graphite-deep hover:bg-white"
                  onClick={() => (uploadFirst ? void record() : fileInput.current?.click())}
                >
                  {uploadFirst ? <MicIcon /> : <UploadIcon />}
                  {uploadFirst ? "Record instead" : "Upload a file"}
                </Button>
              </div>
            </>
          )}

          {state.name === "asking" && (
            <p className="font-wide text-xl font-bold">Allow microphone access in your browser to start.</p>
          )}

          {state.name === "denied" && (
            <Alert variant="graphite" className="border-graphite-line bg-graphite-deep">
              <MicOffIcon />
              <AlertTitle>Microphone access is blocked</AlertTitle>
              <AlertDescription>
                Allow the microphone for this site in your browser's settings, then press the glass again. Or upload
                a recording instead.
              </AlertDescription>
              <div className="col-start-2 mt-3 flex gap-2">
                <Button variant="glass" size="sm" onClick={() => void record()}>Try again</Button>
                <Button size="sm" className="bg-[oklch(0.97_0.002_80)] text-graphite-deep hover:bg-white" onClick={() => fileInput.current?.click()}>
                  Upload a file
                </Button>
              </div>
            </Alert>
          )}

          {state.name === "recording" && (
            <>
              <p className="flex items-baseline gap-3">
                <span className="font-mono text-4xl font-light text-[oklch(0.97_0.002_80)] tabular">{formatTime(elapsed)}</span>
                <span className="text-sm text-[oklch(0.8_0.004_70)]">of {formatTime(MAX_SECONDS, false)}</span>
              </p>
              <p className="mt-3 max-w-[48ch] text-[0.9375rem] text-[oklch(0.85_0.004_70)]">
                Recording. Press the glass to stop. It stops by itself at one minute.
              </p>
              <Button variant="glass" size="lg" className="mt-6" onClick={stop}>
                <SquareIcon className="fill-current" />
                Stop recording
              </Button>
            </>
          )}

          {state.name === "ready" && (
            <>
              <p className="flex items-center gap-2 text-sm text-[oklch(0.85_0.004_70)]">
                <FileAudioIcon className="size-4" />
                <span className="truncate">{state.label}</span>
              </p>
              <audio controls src={state.url} className="mt-4 h-10 w-full max-w-md rounded-md" />
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="glass" size="lg" onClick={() => void send(state.blob, state.label)}>
                  Review this take
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-[oklch(0.88_0.004_70)] hover:bg-graphite-line/40 hover:text-white"
                  onClick={reset}
                >
                  <XIcon />
                  Discard
                </Button>
              </div>
            </>
          )}

          {state.name === "reviewing" && (
            <>
              <p className="font-wide text-2xl font-bold tracking-[-0.015em] text-[oklch(0.97_0.002_80)]">Listening to your take…</p>
              <p className="mt-2 text-[0.9375rem] text-[oklch(0.85_0.004_70)]">
                The coach transcribes your take and checks how your pace supports the message. This can take a minute.
              </p>
              <ul className="mt-6 grid max-w-md gap-2.5 lg:hidden">
                {FOUNDATIONS.filter((f) => f.key === "rate").map((f, i) => {
                  const lit = reviewingFor > 1.2 + i * 2.4
                  return (
                    <li key={f.key} className="flex items-center gap-3 text-sm">
                      <span
                        className="size-2.5 rounded-[2px] transition-[background-color,box-shadow] duration-700"
                        style={{ background: lit ? f.fill : "var(--graphite-line)" }}
                      />
                      <span className={cn("transition-colors duration-700", lit ? "text-[oklch(0.97_0.002_80)]" : "text-[oklch(0.7_0.004_70)]")}>
                        {f.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <Progress value={Math.min(92, (1 - Math.exp(-reviewingFor / 22)) * 100)} className="mt-6 max-w-md bg-graphite-deep shadow-none" aria-label="Review in progress" />
            </>
          )}

          {state.name === "error" && (
            <Alert variant="graphite" className="border-graphite-line bg-graphite-deep">
              <MicOffIcon />
              <AlertTitle>That didn't work</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
              <div className="col-start-2 mt-3 flex flex-wrap gap-2">
                {state.blob && (
                  <Button variant="glass" size="sm" onClick={() => void send(state.blob!, state.label ?? "take")}>
                    Send it again
                  </Button>
                )}
                <Button size="sm" className="bg-[oklch(0.97_0.002_80)] text-graphite-deep hover:bg-white" onClick={reset}>
                  Start over
                </Button>
              </div>
            </Alert>
          )}

        </div>

        {/* The live review currently evaluates rate of speech. */}
        <div className="hidden self-stretch rounded-lg bg-graphite-deep p-6 lg:block">
          <p className="text-[0.75rem] font-semibold text-[oklch(0.8_0.004_70)]">Listening for</p>
          <ul className="mt-4 grid gap-1">
            {FOUNDATIONS.filter((f) => f.key === "rate").map((f, i) => {
              const lit = state.name === "reviewing" && reviewingFor > 1.2 + i * 2.4
              return (
                <li key={f.key} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className="size-2.5 rounded-[2px] transition-colors duration-700"
                    style={{ background: lit ? f.fill : "transparent", boxShadow: `inset 0 0 0 1px ${lit ? f.fill : "var(--graphite-line)"}` }}
                  />
                  <span className={cn("transition-colors duration-700", lit ? "text-[oklch(0.97_0.002_80)]" : "text-[oklch(0.8_0.004_70)]")}>
                    {f.label}
                  </span>
                  {lit && <span className="ml-auto font-mono text-[0.625rem] text-[oklch(0.8_0.004_70)]">listening</span>}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          choose(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </div>
  )
}
