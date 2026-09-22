import { isLyricMetadataLine } from "../helpers/lyric-metadata";
import type { LyricFormat } from "../helpers/lyrics";
import { parseLyricText } from "../helpers/lyrics";

const MUSIC_MARK = /^(（|\()?music(）|\))?$/i;

export function isLyricCreditLine(text: string): boolean {
  const trimmed = text.trim();
  return isLyricMetadataLine(trimmed) || MUSIC_MARK.test(trimmed);
}

export function isUsableParsedLyric(
  lines: Array<{ words: Array<{ word: string }> }>,
): boolean {
  const texts = lines
    .map((line) => line.words.map((word) => word.word).join("").trim())
    .filter(Boolean);
  const body = texts.filter((text) => !isLyricCreditLine(text));
  return body.length >= 3;
}

const FORMAT_RANK: Record<LyricFormat, number> = {
  ttml: 3,
  yrc: 2,
  qrc: 2,
  lys: 2,
  lrc: 1,
};

export function lyricFormatRank(format: LyricFormat): number {
  return FORMAT_RANK[format];
}

export function mergeLrcTranslation(
  content: string,
  translation: string | undefined,
): string {
  if (!translation?.trim()) {
    return content;
  }
  return `${content.trimEnd()}\n${translation.trim()}\n`;
}

export function validateLyric(
  content: string,
  format: LyricFormat,
): boolean {
  try {
    const lines = parseLyricText(content, format);
    return isUsableParsedLyric(lines);
  } catch {
    return false;
  }
}
