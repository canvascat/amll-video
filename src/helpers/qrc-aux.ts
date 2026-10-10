import type { LyricLine, LyricWord } from "@applemusic-like-lyrics/core";

const ALIGN_TOLERANCE_MS = 300;
const BOUNDARY_TOLERANCE_MS = 5;
const KANJI = /[\u4e00-\u9fff\u3400-\u4dbf\u3005\u30060-9]/;
const PLACEHOLDER = /^[\s/\\_.\-—~～·•…]+$/;
const DISCLAIMERS = ["著作权", "版权所有", "未经许可", "大模型提供", "机器翻译"];

type RubySpan = { word: string; startTime: number; endTime: number };

interface KanaUnit {
  kanjiCount: number;
  kanaText: string;
  spans?: RubySpan[];
}

export function parseKanaUnits(rawKanaTag: string): KanaUnit[] {
  const content = rawKanaTag.replace(/^\[kana:/i, "").replace(/\]$/, "");
  const units: KanaUnit[] = [];
  let index = 0;
  while (index < content.length) {
    const current = content[index] ?? "";
    if (current < "1" || current > "9") {
      index += 1;
      continue;
    }
    const kanjiCount = Number(current);
    index += 1;
    let kanaText = "";
    const spans: RubySpan[] = [];
    while (index < content.length) {
      const next = content[index] ?? "";
      if (next >= "1" && next <= "9") {
        break;
      }
      if (next === "(") {
        const close = content.indexOf(")", index);
        if (close !== -1) {
          const timeSlice = content.slice(index + 1, close);
          const comma = timeSlice.indexOf(",");
          const startMs = Number(timeSlice.slice(0, comma));
          const durationMs = Number(timeSlice.slice(comma + 1));
          if (comma !== -1 && Number.isFinite(startMs) && Number.isFinite(durationMs)) {
            spans.push({
              word: kanaText[kanaText.length - 1] ?? "",
              startTime: startMs,
              endTime: startMs + durationMs,
            });
          }
          index = close + 1;
          continue;
        }
      }
      kanaText += next;
      index += 1;
    }
    units.push({
      kanjiCount,
      kanaText,
      spans: spans.length > 0 ? spans : undefined,
    });
  }
  return units;
}

function lineText(line: LyricLine): string {
  return line.words
    .map((word) => word.word)
    .join("")
    .trim();
}

function isMeaningful(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) {
    return false;
  }
  return !DISCLAIMERS.some((keyword) => trimmed.includes(keyword));
}

function hasWordTiming(words: readonly LyricWord[]): boolean {
  return (
    words.length > 1 ||
    (words.length === 1 && words[0].endTime > words[0].startTime)
  );
}

export function alignRomanization(
  mainWords: LyricWord[],
  romanWords: readonly LyricWord[],
): void {
  if (mainWords.length === 0 || romanWords.length === 0) {
    return;
  }
  if (mainWords.length > 1 && romanWords.length === 1) {
    return;
  }
  let searchFrom = 0;
  for (const main of mainWords) {
    if (!main.word.trim()) {
      continue;
    }
    const syllables: string[] = [];
    let romanIndex = searchFrom;
    let fallbackIndex = -1;
    let bestOverlap = 0;
    while (romanIndex < romanWords.length) {
      const syllable = romanWords[romanIndex];
      if (syllable.endTime <= main.startTime - BOUNDARY_TOLERANCE_MS) {
        searchFrom = romanIndex + 1;
        romanIndex += 1;
        continue;
      }
      if (
        syllables.length > 0 &&
        syllable.startTime >= main.endTime - BOUNDARY_TOLERANCE_MS
      ) {
        break;
      }
      if (syllable.startTime >= main.endTime) {
        break;
      }
      const overlap = Math.max(
        0,
        Math.min(main.endTime, syllable.endTime) -
          Math.max(main.startTime, syllable.startTime),
      );
      const duration = Math.max(1, syllable.endTime - syllable.startTime);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        fallbackIndex = romanIndex;
      }
      const inside =
        syllable.startTime >= main.startTime - BOUNDARY_TOLERANCE_MS &&
        syllable.endTime <= main.endTime + BOUNDARY_TOLERANCE_MS;
      if (
        overlap / duration >= 0.4 ||
        Math.abs(syllable.startTime - main.startTime) <= BOUNDARY_TOLERANCE_MS ||
        inside
      ) {
        const text = syllable.word.trim();
        if (text) {
          syllables.push(text);
        }
        searchFrom = romanIndex + 1;
      }
      romanIndex += 1;
    }
    if (syllables.length > 0) {
      main.romanWord = syllables.join("");
    } else if (fallbackIndex >= 0 && bestOverlap > 0) {
      const text = romanWords[fallbackIndex]?.word.trim() ?? "";
      if (text) {
        main.romanWord = text;
        searchFrom = fallbackIndex + 1;
      }
    }
  }
}

function pairLines(
  lines: LyricLine[],
  auxLines: readonly LyricLine[],
  field: "translatedLyric" | "romanLyric",
): void {
  const aux = [...auxLines].sort((left, right) => left.startTime - right.startTime);
  let mainIndex = 0;
  let auxIndex = 0;
  while (mainIndex < lines.length && auxIndex < aux.length) {
    const main = lines[mainIndex];
    const extra = aux[auxIndex];
    if (!main || !extra) {
      break;
    }
    const diff = main.startTime - extra.startTime;
    if (Math.abs(diff) <= ALIGN_TOLERANCE_MS) {
      const text = lineText(extra);
      if (isMeaningful(text)) {
        main[field] = text;
      }
      if (
        field === "romanLyric" &&
        hasWordTiming(main.words) &&
        hasWordTiming(extra.words)
      ) {
        alignRomanization(main.words, extra.words);
      }
      mainIndex += 1;
      auxIndex += 1;
    } else if (diff < 0) {
      mainIndex += 1;
    } else {
      auxIndex += 1;
    }
  }
}

export function applyKanaToLines(lines: readonly LyricLine[], rawKanaTag: string): void {
  if (!rawKanaTag.includes("[kana:")) {
    return;
  }
  const units = parseKanaUnits(rawKanaTag);
  if (units.length === 0) {
    return;
  }
  const kanji = lines.flatMap((line) =>
    line.words.flatMap((word) =>
      [...word.word].flatMap((char, charIndex) =>
        KANJI.test(char) ? [{ charIndex, word }] : [],
      ),
    ),
  );
  let cursor = 0;
  for (const unit of units) {
    if (cursor >= kanji.length) {
      break;
    }
    const matched = kanji.slice(cursor, cursor + unit.kanjiCount);
    cursor += matched.length;
    if (!unit.kanaText || matched.length === 0) {
      continue;
    }
    const primary = matched[0];
    if (!primary) {
      continue;
    }
    if (unit.spans && unit.spans.length > 0) {
      primary.word.ruby = [...(primary.word.ruby ?? []), ...unit.spans];
      continue;
    }
    const last = matched[matched.length - 1] ?? primary;
    let startTime = primary.word.startTime;
    let endTime = last.word.endTime;
    if (matched.length === 1 && primary.word.word.length > 1 && endTime > startTime) {
      const charDuration = (endTime - startTime) / primary.word.word.length;
      startTime = Math.round(primary.word.startTime + primary.charIndex * charDuration);
      endTime = Math.round(startTime + charDuration);
    }
    primary.word.ruby = [
      ...(primary.word.ruby ?? []),
      { word: unit.kanaText, startTime, endTime: Math.max(endTime, startTime) },
    ];
  }
}

export function attachQrcAnnotations(
  lines: LyricLine[],
  aux: {
    translations: readonly LyricLine[];
    romans: readonly LyricLine[];
    kana: string;
  },
): LyricLine[] {
  const annotated = lines.map((line) => ({
    ...line,
    words: line.words.map((word) => ({ ...word })),
  }));
  pairLines(annotated, aux.translations, "translatedLyric");
  pairLines(annotated, aux.romans, "romanLyric");
  for (const line of annotated) {
    if (line.words.some((word) => word.romanWord?.trim())) {
      line.romanLyric = "";
    }
  }
  applyKanaToLines(annotated, aux.kana);
  return annotated;
}
