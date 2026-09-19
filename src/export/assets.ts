import type { LyricLine } from "@applemusic-like-lyrics/core";
import { parseFile } from "music-metadata";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectLyricFormat, parseLyricText } from "../helpers/lyrics";
import type { PlayerCompositionProps } from "../helpers/schema";
import type { ExportArgs } from "./parse-args";
import {
  defaultOutputPath,
  durationToFrames,
  losslessOutputPath,
  titleFromAudioPath,
} from "./timing";

export type ExportJob = {
  publicDir: string;
  outputPath: string;
  fps: number;
  durationInFrames: number;
  sourceAudioPath: string;
  title: string;
  inputProps: PlayerCompositionProps;
};

function coverExtension(format: string | undefined): string {
  if (format?.includes("png")) return ".png";
  if (format?.includes("webp")) return ".webp";
  if (format?.includes("gif")) return ".gif";
  return ".jpg";
}

function jsonSafeTime(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function jsonSafeLyricLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => ({
    ...line,
    startTime: jsonSafeTime(line.startTime),
    endTime: Number.isFinite(line.endTime)
      ? line.endTime
      : Number.MAX_SAFE_INTEGER,
    words: line.words.map((word) => ({
      ...word,
      startTime: jsonSafeTime(word.startTime),
      endTime: Number.isFinite(word.endTime)
        ? word.endTime
        : Number.MAX_SAFE_INTEGER,
    })),
  }));
}

export async function prepareExportJob(args: ExportArgs): Promise<ExportJob> {
  const audioPath = path.resolve(args.audio);
  const lyricPath = path.resolve(args.lyric);
  const coverPath = args.cover ? path.resolve(args.cover) : undefined;

  const [audioMeta, lyricRaw] = await Promise.all([
    parseFile(audioPath),
    readFile(lyricPath, "utf8"),
  ]);

  const durationSec = audioMeta.format.duration;
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`无法读取音频时长: ${audioPath}`);
  }

  const durationMs = Math.round(durationSec * 1000);
  const title =
    args.title || audioMeta.common.title || titleFromAudioPath(audioPath);
  const artist = args.artist || audioMeta.common.artist || "未知创作者";
  const album = args.album || audioMeta.common.album || "未知专辑";
  const lyricLines = parseLyricText(lyricRaw, detectLyricFormat(lyricPath));

  const publicDir = await mkdtemp(path.join(os.tmpdir(), "rmv-export-"));
  const audioFileName = `audio${path.extname(audioPath) || ".bin"}`;
  const lyricFileName = `lyric${path.extname(lyricPath) || ".txt"}`;
  await copyFile(audioPath, path.join(publicDir, audioFileName));
  await copyFile(lyricPath, path.join(publicDir, lyricFileName));

  let coverFileName: string | undefined;
  if (coverPath) {
    coverFileName = `cover${path.extname(coverPath) || ".jpg"}`;
    await copyFile(coverPath, path.join(publicDir, coverFileName));
  } else {
    const picture = audioMeta.common.picture?.[0];
    if (picture) {
      coverFileName = `cover${coverExtension(picture.format)}`;
      await writeFile(path.join(publicDir, coverFileName), picture.data);
    }
  }

  return {
    publicDir,
    title,
    fps: args.fps,
    durationInFrames: durationToFrames(durationMs, args.fps),
    outputPath: losslessOutputPath(args.out ?? defaultOutputPath(title)),
    sourceAudioPath: audioPath,
    inputProps: {
      audioOffsetInSeconds: 0,
      audioFileUrl: audioFileName,
      lyricsFileUrl: lyricFileName,
      coverImageUrl: coverFileName ?? "",
      songName: title,
      artistName: artist,
      albumName: album,
      durationInSeconds: durationSec,
      lyricLines: jsonSafeLyricLines(lyricLines),
    },
  };
}

export async function ensureOutputDir(outputPath: string): Promise<void> {
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
}
