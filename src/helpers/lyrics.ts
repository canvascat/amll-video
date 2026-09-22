import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
  parseLrc,
  parseLys,
  parseQrc,
  parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { TTMLParser, toAmllLyrics } from "@applemusic-like-lyrics/ttml";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";

export type LyricFormat = "lrc" | "ttml" | "yrc" | "qrc" | "lys";

const FORMAT_BY_EXT: Record<string, LyricFormat> = {
  ".lrc": "lrc",
  ".ttml": "ttml",
  ".yrc": "yrc",
  ".qrc": "qrc",
  ".lys": "lys",
};

function extname(filePath: string): string {
  const clean = filePath.split("?")[0] ?? filePath;
  const base = clean.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

export function detectLyricFormat(filePath: string): LyricFormat {
  const format = FORMAT_BY_EXT[extname(filePath)];
  if (!format) {
    throw new Error(`不支持的歌词格式: ${extname(filePath) || "(无扩展名)"}`);
  }
  return format;
}

type MappableLyricLine = {
  words: Array<{
    startTime: number;
    endTime: number;
    word: string;
    romanWord?: string;
  }>;
  startTime: number;
  endTime: number;
  translatedLyric?: string;
  romanLyric?: string;
  isBG?: boolean;
  isDuet?: boolean;
};

export function mapLyric(line: MappableLyricLine): LyricLine {
  return {
    words: line.words.map((w) => ({ ...w, obscene: false })),
    startTime: line.words[0]?.startTime ?? line.startTime ?? 0,
    endTime:
      line.words[line.words.length - 1]?.endTime ??
      line.endTime ??
      Number.POSITIVE_INFINITY,
    translatedLyric: line.translatedLyric ?? "",
    romanLyric: line.romanLyric ?? "",
    isBG: line.isBG ?? false,
    isDuet: line.isDuet ?? false,
  };
}

export function parseLyricText(raw: string, format: LyricFormat): LyricLine[] {
  let lines: MappableLyricLine[];
  switch (format) {
    case "lrc":
      lines = parseLrc(raw);
      break;
    case "yrc":
      lines = parseYrc(raw);
      break;
    case "qrc":
      lines = parseQrc(raw);
      break;
    case "ttml":
      lines = toAmllLyrics(
        TTMLParser.parse(raw, { domParser: new XmlDomParser() }),
      ).lines;
      break;
    case "lys":
      lines = parseLys(raw);
      break;
  }
  return sanitizeLyricTimestamps(lines.map(mapLyric));
}

export function shiftLyricLines(
  lines: readonly LyricLine[],
  offsetMs: number,
): LyricLine[] {
  if (!offsetMs) {
    return sanitizeLyricTimestamps(lines);
  }
  return sanitizeLyricTimestamps(
    lines.map((line) => ({
      ...line,
      startTime: shiftTime(line.startTime, offsetMs),
      endTime: shiftTime(line.endTime, offsetMs),
      words: line.words.map((word) => ({
        ...word,
        startTime: shiftTime(word.startTime, offsetMs),
        endTime: shiftTime(word.endTime, offsetMs),
      })),
    })),
  );
}

export function sanitizeLyricTimestamps(
  lines: readonly LyricLine[],
): LyricLine[] {
  return lines.flatMap((line) => {
    const words = line.words
      .map((word) => ({
        ...word,
        startTime: clampNonNegativeTime(word.startTime),
        endTime: clampNonNegativeTime(word.endTime),
      }))
      .filter((word) => !endedAtOrBeforeZero(word.endTime));
    const startTime = clampNonNegativeTime(line.startTime);
    const endTime = clampNonNegativeTime(line.endTime);
    if (endedAtOrBeforeZero(endTime)) {
      return [];
    }
    if (Number.isFinite(endTime) && startTime > endTime) {
      return [];
    }
    return [{ ...line, startTime, endTime, words }];
  });
}

function clampNonNegativeTime(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  return Math.max(0, value);
}

function endedAtOrBeforeZero(endTime: number): boolean {
  return Number.isFinite(endTime) && endTime <= 0;
}

function shiftTime(value: number, offsetMs: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  return value + offsetMs;
}

export async function loadLyricLines(
  lyricsFileUrl: string,
  abortSignal?: AbortSignal,
): Promise<LyricLine[]> {
  const response = await fetch(lyricsFileUrl, { signal: abortSignal });
  if (!response.ok) {
    throw new Error(
      `无法读取歌词文件: ${lyricsFileUrl} (${response.status})`,
    );
  }
  const raw = await response.text();
  return parseLyricText(raw, detectLyricFormat(lyricsFileUrl));
}
