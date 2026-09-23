import { parseFile } from "music-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseCueSheet,
  resolveCueAudioPath,
  resolveCueCoverPath,
  type CueSheet,
} from "./cue";
import { readLocalTags } from "./tags";
import type { ResolvedCover } from "./types";
import { writeAlbumMaterials } from "./write-materials";

function mimeFromCoverPath(coverPath: string): string {
  const ext = path.extname(coverPath).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  return "image/jpeg";
}

async function loadAlbumCover(
  sheet: CueSheet,
  audioPath: string,
): Promise<ResolvedCover | undefined> {
  const sidecar = resolveCueCoverPath(sheet);
  if (sidecar) {
    return {
      source: "embedded",
      data: await readFile(sidecar),
      mimeType: mimeFromCoverPath(sidecar),
    };
  }
  const tags = await readLocalTags(audioPath).catch(() => undefined);
  if (!tags?.cover) {
    return undefined;
  }
  return {
    source: "embedded",
    data: tags.cover.data,
    mimeType: tags.cover.mimeType,
  };
}

async function audioDuration(audioPath: string): Promise<number> {
  const metadata = await parseFile(audioPath);
  const duration = metadata.format.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`无法读取音频时长: ${audioPath}`);
  }
  return duration;
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type CueAlbum = {
  albumName: string;
  artistName: string;
  audioPath: string;
  coverPath?: string;
  cover?: ResolvedCover;
  tracks: Array<{
    songName: string;
    audioOffsetInSeconds: number;
    audioEndInSeconds: number;
  }>;
};

export async function loadCueAlbum(options: {
  cuePath: string;
  album?: string;
  artist?: string;
}): Promise<CueAlbum> {
  const sheet = await parseCueSheet(options.cuePath);
  const audioPath = resolveCueAudioPath(sheet, sheet.tracks[0]?.file ?? "");
  const mixedFiles = sheet.tracks.some((track) => track.file !== sheet.tracks[0]?.file);
  if (mixedFiles) {
    throw new Error("暂只支持整轨 CUE（所有 TRACK 指向同一个音频文件）");
  }

  const [fileDuration, cover] = await Promise.all([
    audioDuration(audioPath),
    loadAlbumCover(sheet, audioPath),
  ]);

  return {
    albumName: options.album?.trim() || sheet.albumTitle,
    artistName: options.artist?.trim() || sheet.albumPerformer,
    audioPath,
    coverPath: resolveCueCoverPath(sheet),
    cover,
    tracks: sheet.tracks.map((track, index) => {
      const startSeconds = track.startSeconds;
      const endSeconds = sheet.tracks[index + 1]?.startSeconds ?? fileDuration;
      return {
        songName: track.title,
        audioOffsetInSeconds: roundTime(startSeconds),
        audioEndInSeconds: roundTime(endSeconds),
      };
    }),
  };
}

export async function prepareCueAlbum(options: {
  cuePath: string;
  outDir?: string;
  album?: string;
  artist?: string;
}): Promise<{
  jsonPath: string;
  trackCount: number;
}> {
  const album = await loadCueAlbum(options);
  for (const [index, track] of album.tracks.entries()) {
    console.log(
      `[${index + 1}/${album.tracks.length}] ${track.songName}  ${track.audioOffsetInSeconds.toFixed(3)}–${track.audioEndInSeconds.toFixed(3)}s`,
    );
  }

  const written = await writeAlbumMaterials({
    audioPath: album.audioPath,
    outDir: options.outDir,
    albumName: album.albumName,
    artistName: album.artistName,
    cover: album.cover,
    tracks: album.tracks,
  });

  return {
    jsonPath: written.jsonPath,
    trackCount: written.prepared.tracks.length,
  };
}
