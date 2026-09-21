import type { LyricLine } from "@applemusic-like-lyrics/core";
import { parseFile } from "music-metadata";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultPlayerProps } from "../helpers/default-props";
import { detectLyricFormat, parseLyricText } from "../helpers/lyrics";
import type { PlayerCompositionProps, TrackProps } from "../helpers/schema";
import { trackDurationInFrames } from "../helpers/track-duration";
import type { ConcatAudioInput } from "./mux";
import type { ExportArgs } from "./parse-args";
import {
  defaultOutputPath,
  losslessOutputPath,
  titleFromAudioPath,
} from "./timing";

export type ExportJob = {
  publicDir: string;
  ownsPublicDir: boolean;
  outputPath: string;
  fps: number;
  durationInFrames: number;
  sourceAudios: ConcatAudioInput[];
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

export function publicAssetToPath(fileUrl: string): string {
  let relative = fileUrl.trim();
  try {
    relative = new URL(fileUrl, "http://local.invalid").pathname;
  } catch {
    // keep relative as-is
  }
  relative = decodeURIComponent(relative.replace(/^\/+/, ""));
  return path.resolve(process.cwd(), "public", relative);
}

type MaterializedTrack = {
  track: TrackProps;
  sourceAudio: ConcatAudioInput;
  durationInFrames: number;
};

async function materializeTrack(options: {
  index: number;
  audioPath: string;
  lyricPath: string;
  publicDir: string;
  fps: number;
  offsetInSeconds: number;
  audioEndInSeconds?: number;
  coverPath?: string;
  title?: string;
  artist?: string;
  album?: string;
}): Promise<MaterializedTrack> {
  const { index, audioPath, lyricPath, publicDir, fps, offsetInSeconds } =
    options;

  const [audioMeta, lyricRaw] = await Promise.all([
    parseFile(audioPath),
    readFile(lyricPath, "utf8"),
  ]);

  const durationSec = audioMeta.format.duration;
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`无法读取音频时长: ${audioPath}`);
  }
  const endSec = options.audioEndInSeconds ?? durationSec;

  const title =
    options.title || audioMeta.common.title || titleFromAudioPath(audioPath);
  const artist = options.artist || audioMeta.common.artist || "未知创作者";
  const album = options.album || audioMeta.common.album || "未知专辑";
  const lyricLines = parseLyricText(lyricRaw, detectLyricFormat(lyricPath));

  const prefix = `track-${index}`;
  const audioFileName = `${prefix}-audio${path.extname(audioPath) || ".bin"}`;
  const lyricFileName = `${prefix}-lyric${path.extname(lyricPath) || ".txt"}`;
  await copyFile(audioPath, path.join(publicDir, audioFileName));
  await copyFile(lyricPath, path.join(publicDir, lyricFileName));

  let coverFileName: string | undefined;
  if (options.coverPath) {
    coverFileName = `${prefix}-cover${path.extname(options.coverPath) || ".jpg"}`;
    await copyFile(options.coverPath, path.join(publicDir, coverFileName));
  } else {
    const picture = audioMeta.common.picture?.[0];
    if (picture) {
      coverFileName = `${prefix}-cover${coverExtension(picture.format)}`;
      await writeFile(path.join(publicDir, coverFileName), picture.data);
    }
  }

  return {
    track: {
      audioOffsetInSeconds: offsetInSeconds,
      audioEndInSeconds: options.audioEndInSeconds,
      audioFileUrl: audioFileName,
      lyricsFileUrl: lyricFileName,
      coverImageUrl: coverFileName ?? "",
      songName: title,
      artistName: artist,
      albumName: album,
      durationInSeconds: endSec,
      lyricLines: jsonSafeLyricLines(lyricLines),
    },
    sourceAudio: {
      path: audioPath,
      offsetInSeconds,
      durationInSeconds: endSec,
    },
    durationInFrames: trackDurationInFrames(
      endSec,
      offsetInSeconds,
      fps,
      options.audioEndInSeconds,
    ),
  };
}

async function prepareSingleTrackJob(args: ExportArgs): Promise<ExportJob> {
  const publicDir = await mkdtemp(path.join(os.tmpdir(), "rmv-export-"));
  const materialized = await materializeTrack({
    index: 0,
    audioPath: path.resolve(args.audio as string),
    lyricPath: path.resolve(args.lyric as string),
    publicDir,
    fps: args.fps,
    offsetInSeconds: 0,
    coverPath: args.cover ? path.resolve(args.cover) : undefined,
    title: args.title,
    artist: args.artist,
    album: args.album,
  });

  return {
    publicDir,
    ownsPublicDir: true,
    title: materialized.track.songName as string,
    fps: args.fps,
    durationInFrames: materialized.durationInFrames,
    outputPath: losslessOutputPath(
      args.out ?? defaultOutputPath(materialized.track.songName as string),
    ),
    sourceAudios: [materialized.sourceAudio],
    inputProps: { tracks: [materialized.track] },
  };
}

async function prepareDefaultPlaylistJob(args: ExportArgs): Promise<ExportJob> {
  const tracks = defaultPlayerProps.tracks;
  if (!tracks.length) {
    throw new Error("默认曲目列表为空");
  }

  const publicDir = await mkdtemp(path.join(os.tmpdir(), "rmv-export-"));
  const materialized: MaterializedTrack[] = [];

  for (const [index, track] of tracks.entries()) {
    const audioPath = publicAssetToPath(track.audioFileUrl);
    if (!existsSync(audioPath)) {
      throw new Error(`找不到音频文件: ${audioPath}`);
    }
    const lyricPath = publicAssetToPath(track.lyricsFileUrl);
    if (!existsSync(lyricPath)) {
      throw new Error(`找不到歌词文件: ${lyricPath}`);
    }
    materialized.push(
      await materializeTrack({
        index,
        audioPath,
        lyricPath,
        publicDir,
        fps: args.fps,
        offsetInSeconds: track.audioOffsetInSeconds,
        audioEndInSeconds: track.audioEndInSeconds,
        coverPath:
          track.coverImageUrl &&
          !/^(https?:|data:)/i.test(track.coverImageUrl) &&
          existsSync(publicAssetToPath(track.coverImageUrl))
            ? publicAssetToPath(track.coverImageUrl)
            : undefined,
        title: track.songName,
        artist: track.artistName,
        album: track.albumName,
      }),
    );
  }

  const title =
    args.title || materialized[0]?.track.songName || "playlist";
  const durationInFrames = materialized.reduce(
    (sum, item) => sum + item.durationInFrames,
    0,
  );

  return {
    publicDir,
    ownsPublicDir: true,
    title,
    fps: args.fps,
    durationInFrames: Math.max(1, durationInFrames),
    outputPath: losslessOutputPath(args.out ?? defaultOutputPath(title)),
    sourceAudios: materialized.map((item) => item.sourceAudio),
    inputProps: { tracks: materialized.map((item) => item.track) },
  };
}

export async function prepareExportJob(args: ExportArgs): Promise<ExportJob> {
  if (args.audio && args.lyric) {
    return prepareSingleTrackJob(args);
  }
  return prepareDefaultPlaylistJob(args);
}

export async function ensureOutputDir(outputPath: string): Promise<void> {
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
}
