import type { TimedTrack } from "../helpers/track-duration";

export type ChapterSource = TimedTrack & {
  songName?: string;
};

export type ChapterCue = {
  title: string;
  startSeconds: number;
  endSeconds: number;
};

function cueEndSeconds(track: ChapterSource): number {
  return (
    track.audioEndInSeconds ??
    track.durationInSeconds ??
    track.audioOffsetInSeconds
  );
}

export function albumChaptersFromTracks(
  tracks: readonly ChapterSource[],
): ChapterCue[] {
  const firstOffset = tracks[0]?.audioOffsetInSeconds ?? 0;
  return tracks.map((track, index) => ({
    title: track.songName?.trim() || `Track ${index + 1}`,
    startSeconds: Math.max(0, track.audioOffsetInSeconds - firstOffset),
    endSeconds: Math.max(0, cueEndSeconds(track) - firstOffset),
  }));
}

function escapeFfmeta(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("=", "\\=")
    .replaceAll(";", "\\;")
    .replaceAll("#", "\\#")
    .replaceAll("\n", " ");
}

function secondsToMs(value: number): number {
  return Math.max(0, Math.round(value * 1000));
}

export function buildFfmetadata(options: {
  title?: string;
  chapters: readonly ChapterCue[];
}): string {
  const lines = [";FFMETADATA1"];
  if (options.title?.trim()) {
    lines.push(`title=${escapeFfmeta(options.title.trim())}`);
  }
  for (let index = 0; index < options.chapters.length; index++) {
    const chapter = options.chapters[index];
    if (!chapter) {
      continue;
    }
    const startMs = secondsToMs(chapter.startSeconds);
    const next = options.chapters[index + 1];
    const endMs = Math.max(
      startMs + 1,
      secondsToMs(next ? next.startSeconds : chapter.endSeconds),
    );
    lines.push(
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${startMs}`,
      `END=${endMs}`,
      `title=${escapeFfmeta(chapter.title)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function formatChapterClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function buildChapterSidecar(chapters: readonly ChapterCue[]): string {
  return chapters
    .map((chapter) => `${formatChapterClock(chapter.startSeconds)} ${chapter.title}`)
    .join("\n") + (chapters.length ? "\n" : "");
}

export function buildMuxChapterArgs(
  videoPath: string,
  metadataPath: string,
  outputPath: string,
): string[] {
  return [
    "-y",
    "-i",
    videoPath,
    "-i",
    metadataPath,
    "-map_metadata",
    "1",
    "-map_chapters",
    "1",
    "-map",
    "0",
    "-c",
    "copy",
    outputPath,
  ];
}