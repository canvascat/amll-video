import type { LyricLine } from "@applemusic-like-lyrics/core";
import { copyFile, mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectLyricFormat, parseLyricText } from "../helpers/lyrics";
import type { PlayerCompositionProps, TrackProps } from "../helpers/schema";
import { trackDurationInFrames } from "../helpers/track-duration";
import { loadPreparedConfig, type ConfigTrack } from "./load-config";
import type { ConcatAudioInput } from "./mux";
import type { ExportArgs } from "./parse-args";
import { defaultOutputPath, losslessOutputPath } from "./timing";

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

type MaterializedTrack = {
  track: TrackProps;
  sourceAudio: ConcatAudioInput;
  durationInFrames: number;
};

type AssetCache = {
  audio: Map<string, string>;
  cover: Map<string, string>;
};

function createAssetCache(): AssetCache {
  return {
    audio: new Map(),
    cover: new Map(),
  };
}

async function copyOnce(
  cache: Map<string, string>,
  sourcePath: string,
  destDir: string,
  destName: string,
): Promise<string> {
  const key = path.resolve(sourcePath);
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }
  await copyFile(sourcePath, path.join(destDir, destName));
  cache.set(key, destName);
  return destName;
}

function playableEnd(track: ConfigTrack): number {
  const end = track.audioEndInSeconds ?? track.durationInSeconds;
  if (end === undefined || !Number.isFinite(end) || end <= 0) {
    throw new Error(
      `配置缺少 durationInSeconds: ${track.title || track.audioPath}`,
    );
  }
  return end;
}

async function materializeTrack(options: {
  index: number;
  track: ConfigTrack;
  publicDir: string;
  fps: number;
  cache: AssetCache;
}): Promise<MaterializedTrack> {
  const { index, track, publicDir, fps, cache } = options;
  const endSec = playableEnd(track);
  const lyricRaw = track.lyricPath
    ? await readFile(track.lyricPath, "utf8")
    : "";
  const lyricLines = track.lyricPath
    ? parseLyricText(lyricRaw, detectLyricFormat(track.lyricPath))
    : [];

  const prefix = `track-${index}`;
  const audioFileName = await copyOnce(
    cache.audio,
    track.audioPath,
    publicDir,
    `audio-${cache.audio.size}${path.extname(track.audioPath) || ".bin"}`,
  );

  let lyricFileName = "";
  if (track.lyricPath) {
    lyricFileName = `${prefix}-lyric${path.extname(track.lyricPath) || ".txt"}`;
    await copyFile(track.lyricPath, path.join(publicDir, lyricFileName));
  }

  let coverFileName = "";
  if (track.coverPath) {
    coverFileName = await copyOnce(
      cache.cover,
      track.coverPath,
      publicDir,
      `cover-${cache.cover.size}${path.extname(track.coverPath) || ".jpg"}`,
    );
  }

  return {
    track: {
      audioOffsetInSeconds: track.offsetInSeconds,
      audioEndInSeconds: track.audioEndInSeconds,
      audioFileUrl: audioFileName,
      lyricsFileUrl: lyricFileName,
      coverImageUrl: coverFileName,
      songName: track.title ?? "",
      artistName: track.artist ?? "",
      albumName: track.album ?? "",
      durationInSeconds: endSec,
      lyricOffsetMs: track.lyricOffsetMs,
      lyricLines: jsonSafeLyricLines(lyricLines),
    },
    sourceAudio: {
      path: track.audioPath,
      offsetInSeconds: track.offsetInSeconds,
      durationInSeconds: endSec,
    },
    durationInFrames: trackDurationInFrames(
      endSec,
      track.offsetInSeconds,
      fps,
      track.audioEndInSeconds,
    ),
  };
}

function sourceAudiosForJob(items: MaterializedTrack[]): ConcatAudioInput[] {
  const first = items[0]?.sourceAudio;
  if (!first) {
    return [];
  }
  const shared = items.every(
    (item) => path.resolve(item.sourceAudio.path) === path.resolve(first.path),
  );
  if (shared && first.offsetInSeconds === 0) {
    const last = items[items.length - 1]?.sourceAudio;
    return [
      {
        path: first.path,
        offsetInSeconds: 0,
        durationInSeconds: last?.durationInSeconds ?? first.durationInSeconds,
      },
    ];
  }
  return items.map((item) => item.sourceAudio);
}

export async function prepareExportJob(args: ExportArgs): Promise<ExportJob> {
  if (!args.config) {
    throw new Error("需要配置文件");
  }

  const loaded = await loadPreparedConfig(args.config);
  const publicDir = await mkdtemp(path.join(os.tmpdir(), "rmv-export-"));
  const cache = createAssetCache();
  const materialized: MaterializedTrack[] = [];
  for (const [index, track] of loaded.tracks.entries()) {
    materialized.push(
      await materializeTrack({
        index,
        track,
        publicDir,
        fps: args.fps,
        cache,
      }),
    );
  }
  const durationInFrames = materialized.reduce(
    (sum, item) => sum + item.durationInFrames,
    0,
  );

  return {
    publicDir,
    ownsPublicDir: true,
    title: loaded.title,
    fps: args.fps,
    durationInFrames: Math.max(1, durationInFrames),
    outputPath: losslessOutputPath(args.out ?? defaultOutputPath(loaded.title)),
    sourceAudios: sourceAudiosForJob(materialized),
    inputProps: { tracks: materialized.map((item) => item.track) },
  };
}

export async function ensureOutputDir(outputPath: string): Promise<void> {
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
}
