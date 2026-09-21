import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  LookupResult,
  PreparedAlbum,
  PreparedTrack,
  ResolvedCover,
} from "./types";

const COVER_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;

export function coverExtension(mimeType: string | undefined): string {
  if (mimeType?.includes("png")) {
    return ".png";
  }
  if (mimeType?.includes("webp")) {
    return ".webp";
  }
  if (mimeType?.includes("gif")) {
    return ".gif";
  }
  return ".jpg";
}

export function fileStem(filePath: string): string {
  const base = path.basename(filePath);
  const ext = path.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}

export function safeFileStem(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+$/, "");
  return cleaned || "track";
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isSameFile(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function toPreparedTrack(
  audioFileUrl: string,
  lyricsFileUrl: string,
  coverImageUrl: string,
  result: LookupResult,
  timing?: { startSeconds: number; endSeconds: number },
): PreparedTrack {
  return {
    audioFileUrl,
    lyricsFileUrl,
    coverImageUrl,
    audioOffsetInSeconds: timing ? roundTime(timing.startSeconds) : 0,
    audioEndInSeconds: timing ? roundTime(timing.endSeconds) : undefined,
    songName: result.songName,
    artistName: result.artistName,
    albumName: result.albumName,
    durationInSeconds: timing
      ? roundTime(timing.endSeconds)
      : result.durationInSeconds,
    match: {
      lyricSource: result.lyric?.source,
      lyricFormat: result.lyric?.format,
      coverSource: result.cover?.source,
    },
  };
}

async function ensureAudioBeside(
  audioPath: string,
  outDir: string,
): Promise<string> {
  const name = path.basename(audioPath);
  const dest = path.join(outDir, name);
  if (!isSameFile(audioPath, dest)) {
    await copyFile(audioPath, dest);
  }
  return name;
}

function existingCoverName(dir: string, stem: string): string | undefined {
  for (const ext of COVER_EXTS) {
    const name = `${stem}${ext}`;
    if (existsSync(path.join(dir, name))) {
      return name;
    }
  }
  return undefined;
}

async function placeCover(
  outDir: string,
  stem: string,
  cover?: ResolvedCover,
): Promise<string> {
  const existing = existingCoverName(outDir, stem);
  if (existing) {
    return existing;
  }
  if (!cover) {
    return "";
  }
  const name = `${stem}${coverExtension(cover.mimeType)}`;
  await writeFile(path.join(outDir, name), cover.data);
  return name;
}

function allocateLyricName(
  used: Set<string>,
  title: string,
  format: string,
): string {
  const stem = safeFileStem(title);
  let name = `${stem}.${format}`;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${stem}-${n}.${format}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export async function writeMaterials(options: {
  audioPath: string;
  result: LookupResult;
  outDir?: string;
}): Promise<{
  jsonPath: string;
  prepared: PreparedTrack;
  hasLyrics: boolean;
}> {
  const { audioPath, result } = options;
  const outDir = options.outDir ?? path.dirname(audioPath);
  const stem = fileStem(audioPath);
  await mkdir(outDir, { recursive: true });

  const audioFileUrl = await ensureAudioBeside(audioPath, outDir);

  let lyricsFileUrl = "";
  if (result.lyric) {
    lyricsFileUrl = `${stem}.${result.lyric.format}`;
    await writeFile(path.join(outDir, lyricsFileUrl), result.lyric.content, "utf8");
  }

  const coverImageUrl = await placeCover(outDir, stem, result.cover);

  const prepared = toPreparedTrack(
    audioFileUrl,
    lyricsFileUrl,
    coverImageUrl,
    result,
  );
  const jsonPath = path.join(outDir, `${stem}.json`);
  await writeFile(jsonPath, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");

  return {
    jsonPath,
    prepared,
    hasLyrics: Boolean(result.lyric),
  };
}

export async function writeAlbumMaterials(options: {
  audioPath: string;
  albumName: string;
  artistName: string;
  cover?: ResolvedCover;
  tracks: Array<{
    result: LookupResult;
    startSeconds: number;
    endSeconds: number;
  }>;
  outDir?: string;
}): Promise<{
  jsonPath: string;
  prepared: PreparedAlbum;
  missingLyrics: number;
}> {
  const { audioPath, cover } = options;
  const outDir = options.outDir ?? path.dirname(audioPath);
  const stem = fileStem(audioPath);
  await mkdir(outDir, { recursive: true });

  const audioFileUrl = await ensureAudioBeside(audioPath, outDir);
  const coverImageUrl = await placeCover(outDir, stem, cover);

  const usedLyricNames = new Set<string>();
  const tracks: PreparedTrack[] = [];
  let missingLyrics = 0;
  for (const item of options.tracks) {
    let lyricsFileUrl = "";
    if (item.result.lyric) {
      lyricsFileUrl = allocateLyricName(
        usedLyricNames,
        item.result.songName,
        item.result.lyric.format,
      );
      await writeFile(
        path.join(outDir, lyricsFileUrl),
        item.result.lyric.content,
        "utf8",
      );
    } else {
      missingLyrics += 1;
    }
    tracks.push(
      toPreparedTrack(audioFileUrl, lyricsFileUrl, coverImageUrl, item.result, {
        startSeconds: item.startSeconds,
        endSeconds: item.endSeconds,
      }),
    );
  }

  const prepared: PreparedAlbum = {
    albumName: options.albumName,
    artistName: options.artistName,
    audioFileUrl,
    coverImageUrl,
    tracks,
  };
  const jsonPath = path.join(outDir, `${stem}.json`);
  await writeFile(jsonPath, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");

  return { jsonPath, prepared, missingLyrics };
}
