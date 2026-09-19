export function durationToFrames(durationMs: number, fps: number): number {
  return Math.max(1, Math.round((durationMs / 1000) * fps));
}

export function defaultOutputPath(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, "_");
  return `out/${safe}.mkv`;
}

export function losslessOutputPath(outputPath: string): string {
  return outputPath.replace(/\.mp4$/i, ".mkv");
}

export function titleFromAudioPath(audioPath: string): string {
  const base = audioPath.replace(/\\/g, "/").split("/").pop() ?? "untitled";
  return base.replace(/\.[^.]+$/, "") || "untitled";
}
