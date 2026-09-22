import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
  parseLrc,
  parseLys,
  parseQrc,
  parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { TTMLParser, toAmllLyrics } from "@applemusic-like-lyrics/ttml";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import { attachQrcAnnotations } from "./qrc-aux";

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

const QRC_TRANSLATION_MARK = "[rmv-translation]";
const QRC_ROMAN_MARK = "[rmv-roman]";

function splitQrcBundle(raw: string): {
  qrc: string;
  translation: string;
  roman: string;
} {
  const transAt = raw.indexOf(QRC_TRANSLATION_MARK);
  const romanAt = raw.indexOf(QRC_ROMAN_MARK);
  const cuts = [transAt, romanAt].filter((index) => index >= 0);
  const qrcEnd = cuts.length > 0 ? Math.min(...cuts) : raw.length;
  const sliceMark = (mark: string, start: number): string => {
    if (start < 0) {
      return "";
    }
    const from = start + mark.length;
    const next = cuts.filter((index) => index > start);
    const to = next.length > 0 ? Math.min(...next) : raw.length;
    return raw.slice(from, to);
  };
  return {
    qrc: raw.slice(0, qrcEnd),
    translation: sliceMark(QRC_TRANSLATION_MARK, transAt),
    roman: sliceMark(QRC_ROMAN_MARK, romanAt),
  };
}

function parsedLines(raw: string, format: "lrc" | "qrc"): LyricLine[] {
  const text = raw.trim();
  if (!text) {
    return [];
  }
  const parsed = format === "lrc" ? parseLrc(text) : parseQrc(text);
  return sanitizeLyricTimestamps(parsed.map(mapLyric));
}

function extractKanaTag(qrc: string): string {
  const matches = qrc.match(/\[kana:[^\]]*\]/gi);
  return matches?.[matches.length - 1] ?? "";
}

export function parseLyricText(raw: string, format: LyricFormat): LyricLine[] {
  let lines: MappableLyricLine[];
  let translation = "";
  let roman = "";
  let body = raw;
  if (format === "qrc") {
    const bundle = splitQrcBundle(raw);
    body = bundle.qrc;
    translation = bundle.translation;
    roman = bundle.roman;
  }
  switch (format) {
    case "lrc":
      lines = parseLrc(body);
      break;
    case "yrc":
      lines = parseYrc(body);
      break;
    case "qrc":
      lines = parseQrc(body);
      break;
    case "ttml":
      lines = toAmllLyrics(
        TTMLParser.parse(body, { domParser: new XmlDomParser() }),
      ).lines;
      break;
    case "lys":
      lines = parseLys(body);
      break;
  }
  const parsed = sanitizeLyricTimestamps(lines.map(mapLyric));
  if (format !== "qrc") {
    return parsed;
  }
  return attachQrcAnnotations(parsed, {
    translations: parsedLines(translation, "lrc"),
    romans: parsedLines(roman, "qrc"),
    kana: extractKanaTag(body),
  });
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
        ruby: word.ruby?.map((ruby) => ({
          ...ruby,
          startTime: shiftTime(ruby.startTime, offsetMs),
          endTime: shiftTime(ruby.endTime, offsetMs),
        })),
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
        ruby: word.ruby
          ?.map((ruby) => ({
            ...ruby,
            startTime: clampNonNegativeTime(ruby.startTime),
            endTime: clampNonNegativeTime(ruby.endTime),
          }))
          .filter((ruby) => !endedAtOrBeforeZero(ruby.endTime)),
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
