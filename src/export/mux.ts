import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMuxChapterArgs } from "./chapters";

export type ConcatAudioInput = {
  path: string;
  offsetInSeconds: number;
  durationInSeconds: number;
};

export function collapseSharedSourceAudios(
  inputs: ConcatAudioInput[],
): ConcatAudioInput[] {
  const first = inputs[0];
  if (!first || inputs.length < 2) {
    return inputs;
  }
  const shared = inputs.every(
    (input) => path.resolve(input.path) === path.resolve(first.path),
  );
  if (!shared) {
    return inputs;
  }
  const last = inputs[inputs.length - 1];
  return [
    {
      path: first.path,
      offsetInSeconds: first.offsetInSeconds,
      durationInSeconds: last?.durationInSeconds ?? first.durationInSeconds,
    },
  ];
}

export function audioPlayableSeconds(input: ConcatAudioInput): number {
  return Math.max(0.001, input.durationInSeconds - input.offsetInSeconds);
}

export type CueStill = {
  path: string;
  durationSeconds: number;
};

export function buildImageConcatList(stills: readonly CueStill[]): string {
  if (stills.length === 0) {
    throw new Error("至少需要一帧专辑画面");
  }
  const quote = (filePath: string) => filePath.replace(/'/g, "'\\''");
  const lines = ["ffconcat version 1.0"];
  for (const still of stills) {
    lines.push(`file '${quote(still.path)}'`);
    lines.push(`duration ${still.durationSeconds}`);
  }
  const last = stills[stills.length - 1];
  if (last) {
    lines.push(`file '${quote(last.path)}'`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildHoldStillsArgs(
  concatPath: string,
  outputPath: string,
  fps: number,
): string[] {
  return [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-vf",
    `fps=${fps}`,
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-tune",
    "stillimage",
    "-preset",
    "ultrafast",
    "-an",
    outputPath,
  ];
}

export function buildMuxArgs(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  trim?: { startSeconds: number; durationSeconds: number },
): string[] {
  const audioInput =
    trim && (trim.startSeconds > 0 || trim.durationSeconds > 0)
      ? [
          ...(trim.startSeconds > 0 ? ["-ss", String(trim.startSeconds)] : []),
          ...(trim.durationSeconds > 0
            ? ["-t", String(trim.durationSeconds)]
            : []),
          "-i",
          audioPath,
        ]
      : ["-i", audioPath];

  return [
    "-y",
    "-i",
    videoPath,
    ...audioInput,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-shortest",
    outputPath,
  ];
}

export function buildConcatAudioArgs(
  inputs: ConcatAudioInput[],
  outputPath: string,
): string[] {
  const ffmpegInputs = inputs.flatMap((input) => ["-i", input.path]);
  const filters = inputs.map((input, index) => {
    const playable = audioPlayableSeconds(input);
    return `[${index}:a]atrim=start=${input.offsetInSeconds}:duration=${playable},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`;
  });
  const concatIn = inputs.map((_, index) => `[a${index}]`).join("");
  const filter = `${filters.join(";")};${concatIn}concat=n=${inputs.length}:v=0:a=1[a]`;
  return [
    "-y",
    ...ffmpegInputs,
    "-filter_complex",
    filter,
    "-map",
    "[a]",
    "-c:a",
    "flac",
    outputPath,
  ];
}

function remotionBin(): string {
  return path.join(process.cwd(), "node_modules", ".bin", "remotion");
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} 失败（退出码 ${code}）\n${stderr.trim()}`));
    });
  });
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await runCommand("ffmpeg", args);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      try {
        await runCommand(remotionBin(), ["ffmpeg", ...args]);
        return;
      } catch (fallbackError) {
        throw new Error(
          `未找到 ffmpeg，合成原音轨需要系统已安装 ffmpeg，或使用 npx remotion ffmpeg。\n${
            fallbackError instanceof Error ? fallbackError.message : fallbackError
          }`,
        );
      }
    }
    throw error;
  }
}

export async function concatAudioToFlac(
  inputs: ConcatAudioInput[],
  outputPath: string,
): Promise<void> {
  if (inputs.length < 2) {
    throw new Error("拼接音轨至少需要两首歌");
  }
  await runFfmpeg(buildConcatAudioArgs(inputs, outputPath));
}

export async function muxOriginalAudio(
  videoPath: string,
  audio: ConcatAudioInput,
  outputPath: string,
): Promise<void> {
  const playable = audioPlayableSeconds(audio);
  const trim =
    audio.offsetInSeconds > 0
      ? { startSeconds: audio.offsetInSeconds, durationSeconds: playable }
      : undefined;
  await runFfmpeg(buildMuxArgs(videoPath, audio.path, outputPath, trim));
}

export async function muxChapters(
  videoPath: string,
  metadataPath: string,
  outputPath: string,
): Promise<void> {
  await runFfmpeg(buildMuxChapterArgs(videoPath, metadataPath, outputPath));
}

export async function holdStillsToVideo(
  stills: readonly CueStill[],
  outputPath: string,
  fps: number,
): Promise<void> {
  const concatPath = path.join(path.dirname(outputPath), "album-stills.txt");
  await writeFile(concatPath, buildImageConcatList(stills));
  await runFfmpeg(buildHoldStillsArgs(concatPath, outputPath, fps));
}

export async function extractVideoFrames(
  videoPath: string,
  outputPattern: string,
): Promise<void> {
  await runFfmpeg(["-y", "-i", videoPath, "-fps_mode", "passthrough", outputPattern]);
}
