import assert from "node:assert/strict";
import { test } from "node:test";
import type { LyricLine } from "@applemusic-like-lyrics/core";
import { parseFlacStreamInfo, toLoudnessEnvelope } from "./audio-info";
import {
  amplitudeLabel,
  currentLyricIndex,
  formatBitrate,
  formatClock,
  formatFileSize,
  formatQuality,
  formatQualityHeadline,
  fitFontSize,
  formatSampleRate,
  frequencyTicks,
  lyricEntries,
} from "./format";

test("时间格式", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(114.9), "01:54");
  assert.equal(formatClock(302), "05:02");
  assert.equal(formatClock(3725), "1:02:05");
  assert.equal(formatClock(Number.NaN), "00:00");
});

test("技术参数格式，缺项显示破折号", () => {
  assert.equal(formatSampleRate(96000), "96.0 kHz");
  assert.equal(formatSampleRate(44100), "44.1 kHz");
  assert.equal(formatSampleRate(undefined), "—");
  assert.equal(formatQuality(96000, 24), "24-bit / 96.0 kHz");
  assert.equal(formatQuality(undefined, undefined), "—");
  assert.equal(formatQualityHeadline(96000, 24), "96.0 kHz / 24 BIT");
  assert.equal(formatQualityHeadline(44100, undefined), "44.1 kHz");
  assert.equal(formatBitrate(2862), "2862 kbps");
  assert.equal(formatFileSize(103.1 * 1024 * 1024), "103.1 MB");
  assert.equal(formatFileSize(undefined), "—");
});

test("频率刻度按对数排布，最右端是奈奎斯特频率", () => {
  const ticks = frequencyTicks(48000);
  assert.equal(ticks[0]?.label, "20");
  assert.equal(ticks[0]?.position, 0);
  assert.equal(ticks[ticks.length - 1]?.label, "48k");
  assert.equal(ticks[ticks.length - 1]?.position, 1);
  assert.deepEqual(
    ticks.map((tick) => tick.label),
    ["20", "50", "100", "200", "500", "1k", "2k", "5k", "10k", "20k", "48k"],
  );
  const narrow = frequencyTicks(22050);
  assert.equal(narrow[narrow.length - 1]?.label, "22.1k");
  assert.ok(!narrow.some((tick) => tick.label === "20k"));
});

test("右侧幅度轴", () => {
  assert.deepEqual([0, -20, -40, -60, -80, -180].map(amplitudeLabel), [
    "1",
    "0.1",
    "0.01",
    "0.001",
    "1e-4",
    "1e-9",
  ]);
});

const line = (
  startTime: number,
  text: string,
  extra: Partial<LyricLine> = {},
): LyricLine => ({
  startTime,
  endTime: startTime + 1000,
  words: [
    {
      startTime,
      endTime: startTime + 1000,
      word: text,
      obscene: false,
      romanWord: "",
    },
  ],
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
  ...extra,
});

test("歌词条目去掉背景声和空行，带上翻译，按时间排序", () => {
  const entries = lyricEntries([
    line(5000, "second", { translatedLyric: "第二句" }),
    line(1000, "first"),
    line(2000, "   "),
    line(3000, "bg", { isBG: true }),
  ]);
  assert.deepEqual(
    entries.map((entry) => [entry.startMs, entry.text, entry.translation]),
    [
      [1000, "first", ""],
      [5000, "second", "第二句"],
    ],
  );
});

test("当前歌词：没开始是 -1，之后是最后一句已开始的", () => {
  const entries = lyricEntries([
    line(1000, "a"),
    line(5000, "b"),
    line(9000, "c"),
  ]);
  assert.equal(currentLyricIndex(entries, 0), -1);
  assert.equal(currentLyricIndex(entries, 1000), 0);
  assert.equal(currentLyricIndex(entries, 6000), 1);
  assert.equal(currentLyricIndex(entries, 99999), 2);
});

test("解析 FLAC STREAMINFO：96 kHz / 24 bit / 立体声", () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x66, 0x4c, 0x61, 0x43], 0);
  // 采样率 96000 = 0x17700（20 位），声道 2 → 1（3 位），位深 24 → 23（5 位）
  const sampleRate = 96000;
  const packed = (sampleRate << 12) | (1 << 9) | (23 << 4);
  const base = 4 + 4 + 10;
  bytes[base] = (packed >>> 24) & 0xff;
  bytes[base + 1] = (packed >>> 16) & 0xff;
  bytes[base + 2] = (packed >>> 8) & 0xff;
  bytes[base + 3] = packed & 0xff;
  assert.deepEqual(parseFlacStreamInfo(bytes), {
    sampleRate: 96000,
    channels: 2,
    bitDepth: 24,
  });
});

test("FLAC 前面有 ID3v2 时跳过；不是 FLAC 返回 null", () => {
  const id3Size = 20;
  const bytes = new Uint8Array(10 + id3Size + 40);
  bytes.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, id3Size], 0);
  const at = 10 + id3Size;
  bytes.set([0x66, 0x4c, 0x61, 0x43], at);
  const packed = (44100 << 12) | (1 << 9) | (15 << 4);
  const base = at + 4 + 4 + 10;
  bytes[base] = (packed >>> 24) & 0xff;
  bytes[base + 1] = (packed >>> 16) & 0xff;
  bytes[base + 2] = (packed >>> 8) & 0xff;
  bytes[base + 3] = packed & 0xff;
  assert.deepEqual(parseFlacStreamInfo(bytes), {
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
  });
  assert.equal(parseFlacStreamInfo(new Uint8Array(64)), null);
});

test("响度包络按最大值归一，空桶为 0", () => {
  const envelope = toLoudnessEnvelope([4, 1, 0], [1, 1, 0]);
  assert.equal(envelope[0], 1);
  assert.ok((envelope[1] as number) > 0 && (envelope[1] as number) < 1);
  assert.equal(envelope[2], 0);
  assert.deepEqual(toLoudnessEnvelope([0, 0], [0, 0]), [0, 0]);
});

test("长歌词按宽度缩小字号，有下限", () => {
  assert.equal(fitFontSize("短句", 14, 245), 14);
  const medium = fitFontSize(
    "I could have been your lover, I could have been your best friend",
    14,
    245,
  );
  assert.ok(medium < 14 && medium >= 14 * 0.62);
  assert.equal(fitFontSize("x".repeat(400), 14, 245), 14 * 0.62);
});
