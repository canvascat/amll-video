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

test("负向偏移后时间戳不会小于 0，整段落在 0 之前的行丢掉", () => {
  const shifted = shiftLyricLines(
    [line(0, "credit"), line(1000, "a"), line(20000, "b")],
    -14450,
  );
  assert.equal(shifted.length, 1);
  assert.equal(shifted[0]?.startTime, 5550);
  assert.ok(shifted.every((item) => item.startTime >= 0));
  assert.ok(
    shifted.every((item) =>
      item.words.every((word) => word.startTime >= 0 && word.endTime >= 0),
    ),
  );
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

test("歌词已落在人声上时，不因后面更响而偏移", () => {
  const hopMs = 50;
  const envelope = new Array(600).fill(0.05);
  for (const peakMs of [5000, 8000, 12000]) {
    envelope[Math.round(peakMs / hopMs)] = 0.7;
  }
  for (const peakMs of [5000 + 8700, 8000 + 8700, 12000 + 8700]) {
    envelope[Math.round(peakMs / hopMs)] = 1;
  }
  const estimated = estimateLyricOffsetMs({
    lyricTimesMs: [5000, 8000, 12000],
    envelope,
    hopMs,
  });
  assert.equal(estimated, null);
});

test("歌词落在前奏无人声处时，估出正向偏移", () => {
  const hopMs = 50;
  const envelope = new Array(400).fill(0.05);
  for (const peakMs of [8000, 11000, 15000]) {
    envelope[Math.round(peakMs / hopMs)] = 1;
  }
  const estimated = estimateLyricOffsetMs({
    lyricTimesMs: [5000, 8000, 12000],
    envelope,
    hopMs,
  });
  assert.ok(estimated);
  assert.equal(estimated.offsetMs, 3000);
});

test("包络没有对应峰值时不套用偏移", () => {
  const estimated = estimateLyricOffsetMs({
    lyricTimesMs: [1000, 2000, 3000],
    envelope: new Array(200).fill(0.2),
    hopMs: 50,
  });
  assert.equal(estimated, null);
});
