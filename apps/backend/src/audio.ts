import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import ffmpegPath from "ffmpeg-static"

const run = promisify(execFile)

/**
 * Mono 16 kHz samples of an uploaded recording, decoded with FFmpeg. The
 * upload goes through a temporary file because MP4 and M4A files can't be
 * decoded from a pipe when their index comes last.
 */
export async function decodeAudio(audio: Uint8Array, sampleRate = 16000): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ffmpeg = process.env.FFMPEG ?? ffmpegPath
  if (!ffmpeg) throw new Error("FFmpeg is not available; set FFMPEG")
  const dir = await mkdtemp(join(tmpdir(), "micmane-"))
  try {
    const input = join(dir, "upload")
    await writeFile(input, audio)
    const { stdout } = await run(ffmpeg, ["-v", "error", "-i", input, "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "pipe:1"], { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 })
    const samples = new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength - (stdout.byteLength % 4)))
    return { samples, sampleRate }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
