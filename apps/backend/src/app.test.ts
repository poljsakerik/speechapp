import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "./app.ts";

test("health and upload contract", async (context) => {
  let received: Buffer | undefined;
  const app = buildApp(async (audio) => {
    received = audio;
    return {
      segments: [],
      rateDiagnostics: {
        version: 9,
        status: "reviewed" as const,
        pace: undefined,
        articulationRate: undefined,
        pacing: undefined,
        marks: [],
        strengths: [],
      },
      pauseDiagnostics: {
        version: 1,
        status: "reviewed" as const,
        review: undefined,
        heard: undefined,
        hearing: undefined,
        pauses: [],
        marks: [],
        strengthVersion: 1,
        strengths: [],
      },
      volumeDiagnostics: { version: 1, status: "reviewed" as const, marks: [] },
      tonalityDiagnostics: {
        version: 3,
        status: "reviewed" as const,
        passages: undefined,
        marks: [],
        strengths: [],
      },
      pitchDiagnostics: {
        version: 1,
        status: "reviewed" as const,
        marks: [],
        strengths: [],
        spread: undefined,
        heard: undefined,
        hearing: undefined,
      },
      timings: {},
      review: { mainMessage: "test", assessments: [] },
    };
  });
  context.after(() => app.close());
  // tRPC reads multipart bodies from the raw socket, so this test talks to a real listener.
  const base = await app.listen({ port: 0, host: "127.0.0.1" });

  const health = await fetch(`${base}/trpc/health.get`);
  assert.equal(health.status, 200);
  assert.deepEqual(
    ((await health.json()) as { result: { data: unknown } }).result.data,
    { ok: true },
  );

  const upload = (field: string, type: string, body = "abc") => {
    const form = new FormData();
    form.append(field, new Blob([body], { type }), "take.mp3");
    return fetch(`${base}/trpc/review.create`, { method: "POST", body: form });
  };

  assert.equal((await upload("other", "audio/mpeg")).status, 400);
  const unsupported = await upload("file", "text/plain");
  assert.equal(unsupported.status, 415);
  assert.equal(
    ((await unsupported.json()) as { error: { message: string } }).error
      .message,
    "validation:recordingFormat",
  );
  assert.equal((await upload("file", "audio/mpeg", "")).status, 422);

  const extraField = new FormData();
  extraField.append("file", new Blob(["abc"], { type: "audio/mpeg" }), "a.mp3");
  extraField.append("note", "hello");
  const extra = await fetch(`${base}/trpc/review.create`, {
    method: "POST",
    body: extraField,
  });
  assert.equal(extra.status, 400);

  // Recorders add codec parameters to the type.
  for (const type of [
    "audio/webm;codecs=opus",
    "audio/mp4; codecs=mp4a.40.2",
  ]) {
    received = undefined;
    assert.equal((await upload("file", type)).status, 200);
    assert.deepEqual(received, Buffer.from("abc"));
  }

  // A chunked body has no Content-Length, so the limit must hold while reading.
  received = undefined;
  const boundary = "micmane-boundary";
  const part = (name: string, type: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}.mp3"\r\nContent-Type: ${type}\r\n\r\n`;
  const chunks = [
    part("file", "audio/mpeg") + "abc\r\n" + part("extra", "audio/mpeg"),
    ...Array.from({ length: 28 }, () => "x".repeat(1024 * 1024)),
    `\r\n--${boundary}--\r\n`,
  ];
  const chunked = await fetch(`${base}/trpc/review.create`, {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: new ReadableStream({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk === undefined) controller.close();
        else controller.enqueue(new TextEncoder().encode(chunk));
      },
    }),
    duplex: "half",
  } as RequestInit);
  assert.equal(chunked.status, 413);
  assert.equal(received, undefined);

  const review = await upload("file", "audio/mpeg");
  assert.equal(review.status, 200);
  const data = (
    (await review.json()) as {
      result: { data: { audio?: string; rateDiagnostics: { status: string } } };
    }
  ).result.data;
  assert.equal(data.audio, undefined, "the browser already has the recording");
  assert.equal(data.rateDiagnostics.status, "reviewed");
  assert.deepEqual(received, Buffer.from("abc"));
});

test("service failures return machine-readable errors without upstream prose", async (context) => {
  const app = buildApp(async () => {
    throw new Error("private upstream diagnostic");
  });
  context.after(() => app.close());
  const base = await app.listen({ port: 0, host: "127.0.0.1" });
  const form = new FormData();
  form.append("file", new Blob(["abc"], { type: "audio/mpeg" }), "take.mp3");
  const response = await fetch(`${base}/trpc/review.create`, {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.doesNotMatch(
    body,
    /private upstream diagnostic|Review service unavailable|stack/,
  );
  assert.equal(JSON.parse(body).error.message, "BAD_GATEWAY");
});
