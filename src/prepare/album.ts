import { parseFile } from "music-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseCueSheet,
  resolveCueAudioPath,
  resolveCueCoverPath,
  type CueSheet,
} from "./cue";
import { lookupTrack } from "./lookup";
import { readLocalTags } from "./tags";
import type { LookupResult, ResolvedCover } from "./types";
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

export async function prepareCueAlbum(options: {
  cuePath: string;
  outDir?: string;
  album?: string;
  artist?: string;
}): Promise<{
  jsonPath: string;
  missingLyrics: number;
  trackCount: number;
}> {
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

  const albumName = options.album?.trim() || sheet.albumTitle;
  const artistName = options.artist?.trim() || sheet.albumPerformer;
  const lookedUp: Array<{
    result: LookupResult;
    startSeconds: number;
    endSeconds: number;
  }> = [];

  for (const [index, track] of sheet.tracks.entries()) {
    const startSeconds = track.startSeconds;
    const endSeconds = sheet.tracks[index + 1]?.startSeconds ?? fileDuration;
    const length = Math.max(0.001, endSeconds - startSeconds);
    console.log(
      `[${index + 1}/${sheet.tracks.length}] ${track.title}  ${startSeconds.toFixed(3)}–${endSeconds.toFixed(3)}s`,
    );
    const result = await lookupTrack({
      audioPath,
      title: track.title,
      artist: track.performer || artistName,
      album: albumName,
      durationInSeconds: length,
      cover,
      ignoreEmbeddedLyric: true,
    });
    lookedUp.push({ result, startSeconds, endSeconds });
  }

  const written = await writeAlbumMaterials({
    audioPath,
    outDir: options.outDir,
    albumName,
    artistName,
    cover: lookedUp[0]?.result.cover ?? cover,
    tracks: lookedUp,
  });

  return {
    jsonPath: written.jsonPath,
    missingLyrics: written.missingLyrics,
    trackCount: written.prepared.tracks.length,
  };
}
