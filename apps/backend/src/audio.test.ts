import { findPauses } from "@micmane/vocal-processing/pauses";
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeAudio } from "./audio.ts";

/** A 16-bit mono WAV: a tone, half a second of silence, and a tone. */
function wav(rate = 8000): Uint8Array {
  const parts: [number, boolean][] = [
    [1, true],
    [0.5, false],
    [1, true],
  ];
  const samples = parts.flatMap(([seconds, loud]) =>
    Array.from({ length: seconds * rate }, (_, i) =>
      loud ? Math.round(8000 * Math.sin(i / 3)) : 0,
    ),
  );
  const file = Buffer.alloc(44 + samples.length * 2);
  file.write("RIFF", 0);
  file.writeUInt32LE(36 + samples.length * 2, 4);
  file.write("WAVEfmt ", 8);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(rate, 24);
  file.writeUInt32LE(rate * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write("data", 36);
  file.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => file.writeInt16LE(x, 44 + i * 2));
  return file;
}

test("decodes an upload to 16 kHz mono and finds its pause", async () => {
  const { samples, sampleRate } = await decodeAudio(wav());
  assert.equal(sampleRate, 16000);
  assert.ok(Math.abs(samples.length / sampleRate - 2.5) < 0.05);
  const pauses = findPauses(samples, sampleRate);
  assert.equal(pauses.length, 1);
  assert.ok(
    Math.abs(pauses[0].start - 1) < 0.03 &&
      Math.abs(pauses[0].end - 1.5) < 0.03,
  );
});
