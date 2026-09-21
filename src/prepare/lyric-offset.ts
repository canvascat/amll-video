import type { LyricLine } from "@applemusic-like-lyrics/core";
import { shiftLyricLines } from "../helpers/lyrics";
import { isLyricCreditLine } from "./lyric-quality";

const DEFAULT_MAX_OFFSET_MS = 15_000;
const MIN_CONFIDENCE = 0.35;
const MIN_HITS = 3;
const MIN_IMPROVE_OVER_ZERO = 1.2;
const SCORE_TIE_EPS = 1e-6;

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
  const { lyricTimesMs, hopMs } = options;
  if (lyricTimesMs.length < MIN_HITS || options.envelope.length < 4 || hopMs <= 0) {
    return null;
  }

  const envelope = toVocalActivity(options.envelope);
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
    if (isBetterOffset(scored.score, offsetMs, bestScore, bestOffset)) {
      bestScore = scored.score;
      bestOffset = offsetMs;
    }
  }

  if (!scores.length || bestScore <= 0) {
    return null;
  }

  const zero = scoreOffset(lyricTimesMs, envelope, hopMs, 0);
  if (bestOffset !== 0 && bestScore < zero.score * MIN_IMPROVE_OVER_ZERO) {
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

function toVocalActivity(envelope: readonly number[]): number[] {
  if (!envelope.length) {
    return [];
  }
  const sorted = [...envelope].sort((left, right) => left - right);
  const at = (quantile: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] ?? 0;
  const floor = at(0.35);
  const peak = Math.max(at(0.9), floor);
  const span = Math.max(peak - floor, 1e-9);
  return envelope.map((value) =>
    Math.max(0, Math.min(1, (value - floor) / span)),
  );
}

function isBetterOffset(
  score: number,
  offsetMs: number,
  bestScore: number,
  bestOffset: number,
): boolean {
  if (score > bestScore + SCORE_TIE_EPS) {
    return true;
  }
  return (
    Math.abs(score - bestScore) <= SCORE_TIE_EPS &&
    Math.abs(offsetMs) < Math.abs(bestOffset)
  );
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
