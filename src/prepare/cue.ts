import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { titleFromAudioPath } from "../export/timing";

export type CueTrack = {
  number: number;
  title: string;
  performer: string;
  file: string;
  startSeconds: number;
};

export type CueSheet = {
  albumTitle: string;
  albumPerformer: string;
  cuePath: string;
  tracks: CueTrack[];
};

const AUDIO_EXTS = [".flac", ".wav", ".ape", ".wv", ".m4a", ".mp3", ".ogg"];
const COVER_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    const end = trimmed.lastIndexOf('"');
    return trimmed.slice(1, end > 0 ? end : trimmed.length).replace(/""/g, '"');
  }
  return trimmed.split(/\s+/)[0] ?? "";
}

export function cueIndexToSeconds(value: string): number {
  const parts = value.trim().split(":");
  if (parts.length !== 3) {
    throw new Error(`无法解析 CUE INDEX: ${value}`);
  }
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  const frames = Number(parts[2]);
  if (![minutes, seconds, frames].every(Number.isFinite)) {
    throw new Error(`无法解析 CUE INDEX: ${value}`);
  }
  return minutes * 60 + seconds + frames / 75;
}

function looksLikeCue(text: string): boolean {
  return /^\s*(FILE|TRACK|INDEX)\b/im.test(text);
}

function parseCueText(text: string, cuePath: string): CueSheet {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let albumTitle = "";
  let albumPerformer = "";
  let currentFile = "";
  let inTrack = false;
  const tracks: CueTrack[] = [];
  let pending: Partial<CueTrack> | undefined;

  const flush = () => {
    if (!pending) {
      return;
    }
    if (
      pending.number === undefined ||
      pending.startSeconds === undefined ||
      !pending.file
    ) {
      pending = undefined;
      return;
    }
    tracks.push({
      number: pending.number,
      title: pending.title?.trim() || `Track ${pending.number}`,
      performer: pending.performer?.trim() || albumPerformer,
      file: pending.file,
      startSeconds: pending.startSeconds,
    });
    pending = undefined;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("REM ")) {
      continue;
    }
    const command = line.match(/^([A-Z]+)\b/i)?.[1]?.toUpperCase();
    const rest = line.slice(command?.length ?? 0).trim();
    if (command === "FILE") {
      flush();
      inTrack = false;
      const quoted = rest.match(/^"([\s\S]*)"\s+\S+$/);
      currentFile = quoted ? quoted[1].replace(/""/g, '"') : unquote(rest);
      continue;
    }
    if (command === "TRACK") {
      flush();
      inTrack = true;
      const number = Number(rest.split(/\s+/)[0]);
      pending = {
        number,
        file: currentFile,
        performer: albumPerformer,
      };
      continue;
    }
    if (command === "TITLE") {
      const title = unquote(rest);
      if (inTrack && pending) {
        pending.title = title;
      } else if (!inTrack) {
        albumTitle = title;
      }
      continue;
    }
    if (command === "PERFORMER") {
      const performer = unquote(rest);
      if (inTrack && pending) {
        pending.performer = performer;
      } else if (!inTrack) {
        albumPerformer = performer;
      }
      continue;
    }
    if (command === "INDEX" && pending) {
      const match = rest.match(/^(\d+)\s+(\d+:\d+:\d+)/);
      if (match?.[1] === "01") {
        pending.startSeconds = cueIndexToSeconds(match[2]);
      } else if (
        match?.[1] === "00" &&
        pending.startSeconds === undefined
      ) {
        pending.startSeconds = cueIndexToSeconds(match[2]);
      }
    }
  }
  flush();

  if (!tracks.length) {
    throw new Error(`CUE 中没有可播放的 TRACK: ${cuePath}`);
  }

  const fromName = titleFromRipName(cuePath);
  return {
    cuePath,
    albumTitle: albumTitle || fromName.album,
    albumPerformer:
      albumPerformer || tracks[0]?.performer || fromName.artist,
    tracks: tracks.map((track) => ({
      ...track,
      performer: track.performer || albumPerformer || fromName.artist,
    })),
  };
}

function titleFromRipName(cuePath: string): { artist: string; album: string } {
  const base = titleFromAudioPath(cuePath);
  const parts = base.split(".-.");
  if (parts.length >= 3) {
    return { artist: parts[0]?.trim() || "", album: parts[2]?.trim() || base };
  }
  return { artist: "", album: base };
}

async function readCueText(cuePath: string): Promise<string> {
  const bytes = await readFile(cuePath);
  const utf8 = bytes.toString("utf8");
  if (!utf8.includes("\uFFFD") && looksLikeCue(utf8)) {
    return utf8;
  }
  try {
    const gbk = new TextDecoder("gb18030").decode(bytes);
    if (looksLikeCue(gbk)) {
      return gbk;
    }
  } catch {
    // 继续用 utf8
  }
  return utf8;
}

export async function parseCueSheet(cuePath: string): Promise<CueSheet> {
  const text = await readCueText(cuePath);
  return parseCueText(text, cuePath);
}

export function resolveCueAudioPath(sheet: CueSheet, file: string): string {
  const dir = path.dirname(sheet.cuePath);
  const direct = path.resolve(dir, file);
  if (existsSync(direct)) {
    return direct;
  }
  const cueBase = sheet.cuePath.replace(/\.cue$/i, "");
  for (const ext of AUDIO_EXTS) {
    const candidate = `${cueBase}${ext}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`找不到 CUE 引用的音频: ${direct}`);
}

export function resolveCueCoverPath(sheet: CueSheet): string | undefined {
  const cueBase = sheet.cuePath.replace(/\.cue$/i, "");
  for (const ext of COVER_EXTS) {
    const candidate = `${cueBase}${ext}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  const dir = path.dirname(sheet.cuePath);
  for (const name of ["cover", "folder", "front", "Cover", "Folder"]) {
    for (const ext of COVER_EXTS) {
      const candidate = path.join(dir, `${name}${ext}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function isCuePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".cue";
}
