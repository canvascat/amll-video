import { spawn } from "node:child_process";
import path from "node:path";

export const ENVELOPE_HOP_MS = 50;
const SAMPLE_RATE = 16_000;
const VOCAL_BANDPASS = "highpass=f=200,lowpass=f=4000";

function remotionBin(): string {
  return path.join(process.cwd(), "node_modules", ".bin", "remotion");
}

function runFfmpegPcm(args: string[]): Promise<Buffer> {
  const tryCommand = (command: string, commandArgs: string[]) =>
    new Promise<Buffer>((resolve, reject) => {
      const child = spawn(command, commandArgs, { stdio: ["ignore", "pipe", "pipe"] });
      const chunks: Buffer[] = [];
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
          return;
        }
        reject(new Error(`${command} 失败（退出码 ${code}）\n${stderr.trim()}`));
      });
    });

  return tryCommand("ffmpeg", args).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return tryCommand(remotionBin(), ["ffmpeg", ...args]);
    }
    throw error;
  });
}

function rmsEnvelope(pcm: Float32Array, hopSamples: number): number[] {
  const envelope: number[] = [];
  for (let start = 0; start + hopSamples <= pcm.length; start += hopSamples) {
    let sum = 0;
    for (let i = 0; i < hopSamples; i += 1) {
      const sample = pcm[start + i] ?? 0;
      sum += sample * sample;
    }
    envelope.push(Math.sqrt(sum / hopSamples));
  }
  return envelope;
}

export async function readRmsEnvelope(options: {
  audioPath: string;
  startSeconds?: number;
  durationSeconds: number;
  hopMs?: number;
}): Promise<{ envelope: number[]; hopMs: number }> {
  const hopMs = options.hopMs ?? ENVELOPE_HOP_MS;
  const startSeconds = Math.max(0, options.startSeconds ?? 0);
  const durationSeconds = Math.max(0.1, options.durationSeconds);
  const pcm = await runFfmpegPcm([
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    startSeconds.toFixed(3),
    "-t",
    durationSeconds.toFixed(3),
    "-i",
    options.audioPath,
    "-ac",
    "1",
    "-af",
    VOCAL_BANDPASS,
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "f32le",
    "pipe:1",
  ]);
  const samples = new Float32Array(
    pcm.buffer,
    pcm.byteOffset,
    Math.floor(pcm.byteLength / 4),
  );
  const hopSamples = Math.max(1, Math.round((SAMPLE_RATE * hopMs) / 1000));
  return {
    envelope: rmsEnvelope(samples, hopSamples),
    hopMs,
  };
}
