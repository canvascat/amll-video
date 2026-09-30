import type { LyricLine } from "@applemusic-like-lyrics/core";

export type TextMeasure = (text: string, font: string) => { width: number; height: number };

export type LyricPiece = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: number;
  translation: boolean;
};

const MAIN_FONT = "600 32px sans-serif";
const TRANSLATION_FONT = "500 16px sans-serif";

export function lyricLineAt(lines: readonly LyricLine[], timeMs: number): LyricLine | null {
  return lines.find((line) => timeMs >= line.startTime && timeMs < line.endTime) ?? null;
}

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};
type GraphemeSegmenterConstructor = new (
  locales?: string,
  options?: { granularity: "grapheme" },
) => GraphemeSegmenter;

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = (Intl as typeof Intl & { Segmenter: GraphemeSegmenterConstructor }).Segmenter;
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
  }
  return [...text];
}

function staggered(line: LyricLine): boolean {
  return line.words.some((word) => word.startTime !== line.startTime || word.endTime !== line.endTime);
}

function wordFill(line: LyricLine, word: LyricLine["words"][number], timeMs: number): number {
  if (!staggered(line)) {
    return timeMs >= line.startTime ? 1 : 0;
  }
  if (timeMs >= word.endTime) return 1;
  if (timeMs <= word.startTime) return 0;
  const span = word.endTime - word.startTime;
  return span <= 0 ? 1 : (timeMs - word.startTime) / span;
}

function wrap(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
  measure: TextMeasure,
  fill: number,
  translation: boolean,
  y: number,
): LyricPiece[] {
  const pieces: LyricPiece[] = [];
  let x = 0;
  let row = 0;
  const units = translation ? graphemes(text) : [text];
  const push = (unit: string) => {
    const size = measure(unit, font);
    if (x > 0 && x + size.width > maxWidth) {
      row += 1;
      x = 0;
    }
    pieces.push({
      text: unit,
      x,
      y: y + row * lineHeight,
      width: size.width,
      height: lineHeight,
      fill,
      translation,
    });
    x += size.width;
  };
  if (!translation) {
    let current = "";
    for (const unit of graphemes(text)) {
      const next = current + unit;
      if (current && measure(next, font).width > maxWidth) {
        push(current);
        current = unit;
      } else {
        current = next;
      }
    }
    if (current) push(current);
    return pieces;
  }
  for (const unit of units) push(unit);
  return pieces;
}

export function layoutPlaylistLyric(input: {
  line: LyricLine | null;
  timeMs: number;
  width: number;
  height: number;
  measure: TextMeasure;
}): LyricPiece[] {
  const { line, timeMs, width, measure } = input;
  if (!line || width <= 0) return [];
  const padding = 24;
  const maxWidth = Math.max(1, width - padding * 2);
  const mainHeight = 38;
  let x = 0;
  let y = 0;
  const pieces: LyricPiece[] = [];
  for (const word of line.words) {
    if (!word.word) continue;
    const fill = wordFill(line, word, timeMs);
    const size = measure(word.word, MAIN_FONT);
    if (size.width <= maxWidth) {
      if (x > 0 && x + size.width > maxWidth) {
        x = 0;
        y += mainHeight;
      }
      pieces.push({
        text: word.word,
        x,
        y,
        width: size.width,
        height: mainHeight,
        fill,
        translation: false,
      });
      x += size.width;
      continue;
    }
    if (x > 0) {
      x = 0;
      y += mainHeight;
    }
    const wordPieces = wrap(word.word, MAIN_FONT, mainHeight, maxWidth, measure, fill, false, y);
    pieces.push(...wordPieces);
    const lastY = Math.max(...wordPieces.map((piece) => piece.y));
    x = wordPieces
      .filter((piece) => piece.y === lastY)
      .reduce((end, piece) => Math.max(end, piece.x + piece.width), 0);
    y = lastY;
  }
  const translation = line.translatedLyric.trim();
  if (!translation) return pieces;
  if (pieces.length > 0) y += mainHeight;
  const translated = wrap(translation, TRANSLATION_FONT, 22, maxWidth, measure, wordFill(line, line.words[0] ?? { word: "", startTime: line.startTime, endTime: line.endTime, obscene: false }, timeMs), true, y);
  const rows = [...new Set(translated.map((piece) => piece.y))].slice(0, 2);
  return [...pieces, ...translated.filter((piece) => rows.includes(piece.y))];
}
