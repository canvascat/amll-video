import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateLyricOffsetMs,
  shiftLyricLines,
} from "./lyric-offset";

function line(startMs: number, text: string): LyricLine {
  return {
    words: [{ word: text, startTime: startMs, endTime: startMs + 500, obscene: false }],
    startTime: startMs,
    endTime: startMs + 500,
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  };
}

test("shiftLyricLines 把整句和逐字时间一起平移", () => {
  const shifted = shiftLyricLines([line(1000, "a"), line(2000, "b")], -400);
  assert.equal(shifted[0]?.startTime, 600);
  assert.equal(shifted[0]?.words[0]?.startTime, 600);
  assert.equal(shifted[1]?.startTime, 1600);
});

test("歌词时间轴整体偏晚时，估出负向偏移", () => {
  const hopMs = 50;
  const envelope = new Array(400).fill(0.05);
  for (const peakMs of [5000, 8000, 12000]) {
    envelope[Math.round(peakMs / hopMs)] = 1;
  }
  const estimated = estimateLyricOffsetMs({
    lyricTimesMs: [7000, 10000, 14000],
    envelope,
    hopMs,
  });
  assert.ok(estimated);
  assert.equal(estimated.offsetMs, -2000);
});

test("包络没有对应峰值时不套用偏移", () => {
  const estimated = estimateLyricOffsetMs({
    lyricTimesMs: [1000, 2000, 3000],
    envelope: new Array(200).fill(0.2),
    hopMs: 50,
  });
  assert.equal(estimated, null);
});
