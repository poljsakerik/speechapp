import { decode } from "@msgpack/msgpack";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "./app.ts";
import { demoScript, fishDemo, type DemoRequest } from "./demo.ts";

const words = "What nobody tells you, is that the night is long.".split(" ");

test("the script cues the delivery each note asks for", () => {
  assert.deepEqual(
    demoScript({
      words,
      notes: [
        {
          ruleId: "RATE_CONTRAST",
          from: 0,
          to: 9,
          suggestions: [
            { direction: "slow_down", from: 7, to: 9 },
            { direction: "speed_up", from: 0, to: 2 },
          ],
        },
      ],
    }),
    {
      text: "[quickly, lightly] What nobody tells you, is that the [emphasis] night is long.",
    },
  );
  // Several notes on one passage are said together; a phrase outside the passage is ignored.
  assert.deepEqual(
    demoScript({
      words,
      notes: [
        {
          ruleId: "PAUSE_UNNECESSARY",
          from: 0,
          to: 5,
          suggestions: [
            { direction: "no_pause_after", from: 3, to: 3 },
            { direction: "lengthen_pause_after", from: 40, to: 41 },
          ],
        },
        {
          ruleId: "PAUSE_NECESSARY",
          from: 4,
          to: 9,
          suggestions: [{ direction: "pause_after", from: 5, to: 5 }],
        },
        { ruleId: "TONE_FLAT", from: 6, to: 9, suggestions: [] },
        { ruleId: "PITCH_VARIETY", from: 6, to: 9, suggestions: [] },
        { ruleId: "TONE_FLAT", from: 6, to: 20, suggestions: [] },
      ],
    }).text,
    "What nobody tells you is that [break] [warm, animated, expressive] [lively, with a wide melodic range] the night is long.",
  );
});

test("a pause to drop loses the full stop the recognizer wrote for it", () => {
  const said =
    "I've been a software engineer. For the last five years. I".split(" ");
  assert.equal(
    demoScript({
      words: said,
      notes: [
        {
          ruleId: "PAUSE_UNNECESSARY",
          from: 0,
          to: 9,
          suggestions: [
            { direction: "no_pause_after", from: 4, to: 4 },
            { direction: "no_pause_after", from: 9, to: 9 },
          ],
        },
      ],
    }).text,
    "I've been a software engineer for the last five years I",
  );
});

test("a pause that ran long is kept, but brief", () => {
  const shorten = (to: number) => ({
    ruleId: "PAUSE_TOO_LONG",
    from: 0,
    to: 9,
    suggestions: [{ direction: "shorten_pause_after" as const, from: to, to }],
  });
  // Inside a sentence the pause becomes a comma's; at a full stop or a comma it is already brief.
  assert.equal(
    demoScript({ words, notes: [shorten(5), shorten(3), shorten(9)] }).text,
    "What nobody tells you, is that, the night is long.",
  );
});

test("a pace change sets the speed only when its note is most of what is said", () => {
  const rushed = { ruleId: "RATE_IMPORTANCE_FAST", suggestions: [] };
  assert.deepEqual(
    demoScript({
      words: ["[shouting]", "Hello", "<|speaker:1|>"],
      notes: [{ ...rushed, from: 0, to: 2 }],
    }),
    {
      text: "[unhurried, taking time over each phrase] shouting Hello speaker:1",
      speed: 0.85,
    },
  );
  assert.equal(
    demoScript({ words, notes: [{ ...rushed, from: 0, to: 2 }] }).speed,
    undefined,
  );
  assert.equal(
    demoScript({
      words,
      notes: [
        { ...rushed, from: 0, to: 4 },
        { ...rushed, ruleId: "RATE_IMPORTANCE_SLOW", from: 5, to: 9 },
      ],
    }).speed,
    undefined,
  );
});

test("the voice sample goes to Fish inline, as MessagePack", async () => {
  assert.equal(fishDemo({}), undefined);
  let sent: { url: string; init: RequestInit } | undefined;
  const demo = fishDemo({ FISH_API_KEY: "key" }, (async (
    url: string,
    init: RequestInit,
  ) => {
    sent = { url, init };
    return new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch);
  const audio = await demo!({
    reference: new Uint8Array([9, 9]),
    referenceText: "For three years",
    passage: {
      words: ["Hello", "there."],
      notes: [{ ruleId: "TONE_FLAT", from: 0, to: 1, suggestions: [] }],
    },
  });
  assert.deepEqual([...audio], [1, 2, 3]);
  assert.equal(sent!.url, "https://api.fish.audio/v1/tts");
  assert.deepEqual(sent!.init.headers, {
    authorization: "Bearer key",
    "content-type": "application/msgpack",
    model: "s2-pro",
  });
  assert.deepEqual(decode(sent!.init.body as Uint8Array), {
    text: "[warm, animated, expressive] Hello there.",
    references: [{ audio: new Uint8Array([9, 9]), text: "For three years" }],
    format: "mp3",
  });

  const failing = fishDemo(
    { FISH_API_KEY: "key" },
    (async () => new Response("no credit", { status: 402 })) as typeof fetch,
  );
  await assert.rejects(
    failing!({
      reference: new Uint8Array([9]),
      referenceText: "",
      passage: { words: ["Hi"], notes: [] },
    }),
    /Fish Audio 402: no credit/,
  );
});

test("demo upload contract", async (context) => {
  let received: DemoRequest | undefined;
  const review = async () => undefined;
  const app = buildApp(review, async (request) => {
    received = request;
    return new Uint8Array([1, 2, 3]);
  });
  const without = buildApp(review);
  context.after(() => Promise.all([app.close(), without.close()]));
  const base = await app.listen({ port: 0, host: "127.0.0.1" });

  const health = await fetch(`${base}/trpc/health.get`);
  assert.deepEqual(
    ((await health.json()) as { result: { data: unknown } }).result.data,
    { ok: true, demo: true },
  );

  const post = (to: string, passage: unknown, sample = "wav") => {
    const form = new FormData();
    form.append(
      "reference",
      new Blob([sample], { type: "audio/wav" }),
      "v.wav",
    );
    form.append("referenceText", "For three years");
    form.append("passage", JSON.stringify(passage));
    return fetch(`${to}/trpc/demo.create`, { method: "POST", body: form });
  };
  const passage = {
    words: ["Hello", "there."],
    notes: [
      {
        ruleId: "PAUSE_NECESSARY",
        from: 0,
        to: 1,
        suggestions: [{ direction: "pause_after", from: 0, to: 0 }],
      },
    ],
  };

  const made = await post(base, passage);
  assert.equal(made.status, 200);
  assert.deepEqual(
    ((await made.json()) as { result: { data: unknown } }).result.data,
    { audio: "AQID", mimeType: "audio/mpeg" },
  );
  assert.deepEqual(received, {
    reference: new Uint8Array(Buffer.from("wav")),
    referenceText: "For three years",
    passage,
  });

  assert.equal((await post(base, { ...passage, words: [] })).status, 400);
  assert.equal((await post(base, passage, "")).status, 400);
  assert.equal(
    (
      await post(base, {
        ...passage,
        notes: [
          {
            ...passage.notes[0],
            suggestions: [{ direction: "sing", from: 0, to: 0 }],
          },
        ],
      })
    ).status,
    400,
  );

  // Without a key the endpoint says so rather than failing as a gateway.
  const bare = await without.listen({ port: 0, host: "127.0.0.1" });
  assert.equal((await post(bare, passage)).status, 503);
});
