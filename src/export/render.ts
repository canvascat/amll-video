import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { COMPOSITION_ID } from "../remotion/constants";
import { ensureOutputDir, prepareExportJob } from "./assets";
import { muxOriginalAudio } from "./mux";
import type { ExportArgs } from "./parse-args";

function resolveBrowserExecutable(): string | undefined {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) {
    return process.env.REMOTION_BROWSER_EXECUTABLE;
  }
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function projectRoot(): string {
  return process.cwd();
}

function remotionEntry(): string {
  return path.join(projectRoot(), "src/index.ts");
}

function remotionBin(): string {
  return path.join(projectRoot(), "node_modules", ".bin", "remotion");
}

function runRemotion(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(remotionBin(), args, {
      stdio: "inherit",
      cwd: projectRoot(),
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
        return;
      }
      reject(new Error(`Remotion 退出码 ${code}`));
    });
  });
}

export async function previewStudio(args: ExportArgs): Promise<void> {
  const job = await prepareExportJob(args);
  const propsPath = path.join(job.publicDir, "input-props.json");
  await writeFile(propsPath, JSON.stringify(job.inputProps));

  console.log(`正在启动 Remotion Studio 预览：《${job.title}》`);

  try {
    await runRemotion([
      "studio",
      remotionEntry(),
      `--props=${propsPath}`,
      `--public-dir=${job.publicDir}`,
    ]);
  } finally {
    await rm(job.publicDir, { recursive: true, force: true });
  }
}

export async function exportVideo(args: ExportArgs): Promise<string> {
  const job = await prepareExportJob(args);
  const outputLocation = path.resolve(job.outputPath);
  await ensureOutputDir(outputLocation);
  const workDir = await mkdtemp(path.join(os.tmpdir(), "rmv-render-"));
  const silentVideoPath = path.join(workDir, "video-only.mp4");
  const propsPath = path.join(job.publicDir, "input-props.json");
  await writeFile(propsPath, JSON.stringify(job.inputProps));

  const remotionArgs = [
    "render",
    remotionEntry(),
    COMPOSITION_ID,
    silentVideoPath,
    `--props=${propsPath}`,
    `--public-dir=${job.publicDir}`,
    "--muted",
    "--codec=h264",
    "--concurrency=1",
    "--gl=angle",
    "--chrome-mode=headless-shell",
    `--fps=${job.fps}`,
    "--timeout=120000",
  ];

  if (args.frames) {
    remotionArgs.push(`--frames=${args.frames}`);
  }

  const browserExecutable = resolveBrowserExecutable();
  if (browserExecutable) {
    remotionArgs.push(`--browser-executable=${browserExecutable}`);
  }

  try {
    console.log(
      `正在渲染无声画面：《${job.title}》（${job.durationInFrames} 帧）`,
    );
    await runRemotion(remotionArgs);
    console.log("正在无损合成原音轨…");
    await muxOriginalAudio(
      silentVideoPath,
      job.sourceAudioPath,
      outputLocation,
    );
  } finally {
    await rm(job.publicDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }

  return outputLocation;
}
