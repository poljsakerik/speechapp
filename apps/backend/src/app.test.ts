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
      },
      pauseDiagnostics: {
        version: 1,
        status: "reviewed" as const,
        review: undefined,
        pauses: [],
        marks: [],
      },
      volumeDiagnostics: { version: 1, status: "reviewed" as const, marks: [] },
      tonalityDiagnostics: {
        version: 3,
        status: "reviewed" as const,
        passages: undefined,
        marks: [],
      },
      pitchDiagnostics: {
        version: 1,
        status: "reviewed" as const,
        marks: [],
        spread: undefined,
        heard: undefined,
      },
      timings: {},
      review: { overall: "test", assessments: [] },
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
  assert.equal((await upload("file", "text/plain")).status, 415);
  assert.equal((await upload("file", "audio/mpeg", "")).status, 422);

  const tooLarge = await app.inject({
    method: "POST",
    url: "/trpc/review.create",
    headers: {
      "content-type": "multipart/form-data; boundary=x",
      "content-length": String(30 * 1024 * 1024),
    },
    payload: "",
  });
  assert.equal(tooLarge.statusCode, 413);

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
