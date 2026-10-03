import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { planDemos, voiceSample, type DemoPassage } from "@/lib/demo";
import type { Finding, Take } from "@/lib/review";
import { trpc } from "@/lib/trpc";
import { maxDemoWords } from "@micmane/validation/demo";

export type VoiceDemoStatus = "making" | "playing" | "failed";

/**
 * A flagged passage said the way its notes ask, in the speaker's own voice. The voice is
 * learned once from the take; each passage is made when first asked for and kept while the
 * review is open. Notes close together share one passage. One demo is heard at a time.
 */
export function useVoiceDemo(
  audioSrc: string,
  take: Take,
  findings: Finding[],
  /** Called as a demo starts, so the take can stop playing. */
  onStart: () => void,
) {
  const { mutateAsync: createDemo } = useMutation(
    trpc.demo.create.mutationOptions(),
  );
  const player = useRef<HTMLAudioElement>(null);
  const sample = useRef<ReturnType<typeof voiceSample>>(null);
  /** Each passage's audio, made or still being made, so a passage is never asked for twice. */
  const made = useRef(new Map<string, Promise<string>>());
  const demos = useMemo(
    () => planDemos(take, findings, maxDemoWords),
    [take, findings],
  );
  /** Counts presses; audio that arrives after a later press, or a stop, stays silent. */
  const asked = useRef(0);
  /** The demo being made or heard, with the notes it answers. */
  const [state, setState] = useState<{
    id: string;
    noteIds: string[];
    status: VoiceDemoStatus;
  } | null>(null);

  useEffect(() => {
    const audio = new Audio();
    const urls = made.current;
    const presses = asked;
    // Only a demo being heard comes to rest; one being made is not the player's to clear.
    const rest = () => setState((s) => (s?.status === "playing" ? null : s));
    audio.addEventListener("pause", rest);
    audio.addEventListener("ended", rest);
    player.current = audio;
    return () => {
      audio.removeEventListener("pause", rest);
      audio.removeEventListener("ended", rest);
      audio.pause();
      // Audio still on its way when the take changes is not for the next one.
      presses.current++;
      urls.forEach((url) =>
        url.then(
          (made) => URL.revokeObjectURL(made),
          () => undefined,
        ),
      );
      urls.clear();
      sample.current = null;
    };
  }, [audioSrc]);

  const stop = useCallback(() => {
    asked.current++;
    player.current?.pause();
    setState(null);
  }, []);

  const make = useCallback(
    async (passage: DemoPassage) => {
      sample.current ??= fetch(audioSrc)
        .then((response) => response.blob())
        .then((recording) => voiceSample(recording, take, findings));
      // A sample that could not be cut is tried again on the next press.
      sample.current.catch(() => (sample.current = null));
      const { wav, text } = await sample.current;
      const form = new FormData();
      form.append("reference", wav, "voice.wav");
      form.append("referenceText", text);
      form.append("passage", JSON.stringify(passage));
      const { audio, mimeType } = await createDemo(form);
      const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
      return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    },
    [audioSrc, take, findings, createDemo],
  );

  const toggle = useCallback(
    async (note: Finding) => {
      const audio = player.current;
      if (!audio) return;
      const demo = demos.find((d) => d.noteIds.includes(note.id));
      const { id = note.id, noteIds = [note.id] } = demo ?? {};
      // Pressing the demo being made or heard stops it.
      if (state?.id === id && state.status !== "failed") return stop();
      audio.pause();
      const ask = ++asked.current;
      const urls = made.current;
      try {
        if (!demo) throw new Error("No words to say");
        let url = urls.get(id);
        if (!url) {
          url = make(demo.passage);
          urls.set(id, url);
          // A passage that could not be made is tried again on the next press.
          url.catch(() => urls.get(id) === url && urls.delete(id));
        }
        setState({ id, noteIds, status: "making" });
        const src = await url;
        if (asked.current !== ask) return;
        onStart();
        audio.src = src;
        await audio.play();
        if (asked.current === ask) setState({ id, noteIds, status: "playing" });
      } catch {
        if (asked.current === ask) setState({ id, noteIds, status: "failed" });
      }
    },
    [demos, make, onStart, state, stop],
  );

  return { state, toggle, stop };
}
