import { inflateSync } from "node:zlib";
import { stringifyYrc } from "@applemusic-like-lyrics/lyric";
import type { LyricLine } from "@applemusic-like-lyrics/core";

const KRC_KEY = Uint8Array.from([
  0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce,
  0xd2, 0x6e, 0x69,
]);

const TIMED_LINE = /^\[(\d+),(\d+)\](.*)$/;
const WORD = /<(\d+),(\d+),\d+>([^<]*)/g;

export function prefersKugouKrc(candidate: {
  krctype?: number;
  contenttype?: number;
}): boolean {
  return candidate.krctype === 1 && candidate.contenttype !== 1;
}

export function decryptKrc(base64Content: string): string {
  const buf = Buffer.from(base64Content, "base64").subarray(4);
  if (buf.length === 0) {
    throw new Error("空的 KRC");
  }
  for (let i = 0; i < buf.length; i++) {
    buf[i] ^= KRC_KEY[i % KRC_KEY.length] ?? 0;
  }
  return inflateSync(buf).toString("utf8");
}

export function krcToYrc(raw: string): string {
  const lines: LyricLine[] = [];
  for (const rawLine of raw.replace(/\r/g, "").split("\n")) {
    const match = TIMED_LINE.exec(rawLine);
    if (!match) {
      continue;
    }
    const lineStart = Number(match[1]);
    const lineDuration = Number(match[2]);
    const body = match[3] ?? "";
    const words: LyricLine["words"] = [];
    for (const wordMatch of body.matchAll(WORD)) {
      const offset = Number(wordMatch[1]);
      const duration = Number(wordMatch[2]);
      const word = wordMatch[3] ?? "";
      if (!word) {
        continue;
      }
      const startTime = lineStart + offset;
      words.push({
        word,
        startTime,
        endTime: startTime + duration,
        obscene: false,
      });
    }
    if (words.length === 0) {
      continue;
    }
    lines.push({
      words,
      startTime: lineStart,
      endTime: lineStart + lineDuration,
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    });
  }
  return stringifyYrc(lines);
}
