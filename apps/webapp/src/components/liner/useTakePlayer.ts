import { useCallback, useEffect, useRef, useState } from "react";

/** One take's playback, shared by everything on the page that follows it. */
export function useTakePlayer(duration: number) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setTime(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.ended || audio.currentTime >= duration - 0.05)
      audio.currentTime = 0;
    setStarted(true);
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }, [duration]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await play();
    else audio.pause();
  }, [play]);

  const playFrom = useCallback(
    async (at: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const next = Math.max(0, Math.min(duration, at));
      audio.currentTime = next;
      setTime(next);
      await play();
    },
    [duration, play],
  );

  const audioProps = {
    ref: audioRef,
    preload: "auto" as const,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => {
      setPlaying(false);
      setTime(duration);
    },
  };

  return { time, playing, started, toggle, playFrom, audioProps };
}

export type TakePlayer = ReturnType<typeof useTakePlayer>;
