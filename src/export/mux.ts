import { spawn } from "node:child_process";
import path from "node:path";

export function buildMuxArgs(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): string[] {
  return [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
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

export async function muxOriginalAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  const args = buildMuxArgs(videoPath, audioPath, outputPath);
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
