import type { LyricLine } from "@applemusic-like-lyrics/core";
import { shiftLyricLines } from "../helpers/lyrics";
import { isLyricCreditLine } from "./lyric-quality";

const DEFAULT_MAX_OFFSET_MS = 15_000;
const MIN_CONFIDENCE = 0.35;
const MIN_HITS = 3;

export function lyricOnsetTimesMs(
  lines: readonly LyricLine[],
): number[] {
  return lines
    .map((line) => ({
      startTime: line.startTime,
      text: line.words.map((word) => word.word).join("").trim(),
    }))
    .filter(
      (line) =>
        line.text &&
        !isLyricCreditLine(line.text) &&
        Number.isFinite(line.startTime) &&
        line.startTime >= 0,
    )
    .map((line) => line.startTime);
}

export { shiftLyricLines };

export function estimateLyricOffsetMs(options: {
  lyricTimesMs: readonly number[];
  envelope: readonly number[];
  hopMs: number;
  maxOffsetMs?: number;
}): { offsetMs: number; confidence: number } | null {
  const { lyricTimesMs, envelope, hopMs } = options;
  if (lyricTimesMs.length < MIN_HITS || envelope.length < 4 || hopMs <= 0) {
    return null;
  }

  const maxOffsetMs = options.maxOffsetMs ?? DEFAULT_MAX_OFFSET_MS;
  const scores: number[] = [];
  let bestOffset = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let offsetMs = -maxOffsetMs; offsetMs <= maxOffsetMs; offsetMs += hopMs) {
    const scored = scoreOffset(lyricTimesMs, envelope, hopMs, offsetMs);
    if (scored.hits < MIN_HITS && scored.hits < lyricTimesMs.length / 2) {
      continue;
    }
    scores.push(scored.score);
    if (scored.score > bestScore) {
      bestScore = scored.score;
      bestOffset = offsetMs;
    }
  }

  if (!scores.length || bestScore <= 0) {
    return null;
  }

  const ranked = [...scores].sort((left, right) => left - right);
  const median = ranked[Math.floor(ranked.length / 2)] ?? 0;
  const confidence = (bestScore - median) / (bestScore + 1e-6);
  if (confidence < MIN_CONFIDENCE || bestOffset === 0) {
    return null;
  }
  return { offsetMs: bestOffset, confidence };
}

function scoreOffset(
  lyricTimesMs: readonly number[],
  envelope: readonly number[],
  hopMs: number,
  offsetMs: number,
): { score: number; hits: number } {
  let sum = 0;
  let hits = 0;
  for (const timeMs of lyricTimesMs) {
    const index = Math.round((timeMs + offsetMs) / hopMs);
    if (index < 0 || index >= envelope.length) {
      continue;
    }
    sum += envelope[index] ?? 0;
    hits += 1;
  }
  return { score: hits > 0 ? sum / hits : 0, hits };
}
