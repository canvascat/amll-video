import assert from "node:assert/strict";
import { test } from "node:test";
import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
  formatLabel,
  infoFromMetadata,
  toLoudnessEnvelope,
} from "./audio-info";
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

test("格式名：FLAC、MP3、AAC、WAV 等", () => {
  assert.equal(formatLabel("FLAC", "FLAC"), "FLAC");
  assert.equal(formatLabel("MPEG", "MPEG 1 Layer 3"), "MP3");
  assert.equal(formatLabel("MPEG", "AAC"), "AAC");
  assert.equal(formatLabel("WAVE", "PCM"), "WAV");
  assert.equal(formatLabel("Ogg", "Opus"), "OPUS");
  assert.equal(formatLabel(undefined, undefined), undefined);
});

test("music-metadata 结果折成面板字段，码率按文件大小和时长算", () => {
  const { info, tags } = infoFromMetadata(
    {
      format: {
        container: "FLAC",
        codec: "FLAC",
        sampleRate: 96000,
        bitsPerSample: 24,
        numberOfChannels: 2,
      },
      common: {
        year: 2014,
        track: { no: 5, of: 12 },
        genre: ["J-Pop", "Pop"],
        bpm: 119.6,
      },
    } as Parameters<typeof infoFromMetadata>[0],
    103.1 * 1024 * 1024,
    302,
  );
  assert.deepEqual(info, {
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    format: "FLAC",
    fileSizeBytes: 103.1 * 1024 * 1024,
    bitrateKbps: 2864,
  });
  assert.deepEqual(tags, {
    year: 2014,
    trackNumber: 5,
    genre: "J-Pop",
    bpm: 120,
  });
});

test("标签和大小缺失时字段留空", () => {
  const { info, tags } = infoFromMetadata(
    {
      format: {
        container: "MPEG",
        codec: "MPEG 1 Layer 3",
        sampleRate: 44100,
        numberOfChannels: 2,
      },
      common: { track: { no: null, of: null } },
    } as Parameters<typeof infoFromMetadata>[0],
    undefined,
    200,
  );
  assert.equal(info.bitDepth, undefined);
  assert.equal(info.fileSizeBytes, undefined);
  assert.equal(info.bitrateKbps, undefined);
  assert.deepEqual(tags, {});
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
