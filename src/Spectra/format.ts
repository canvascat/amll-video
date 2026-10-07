import type { LyricLine } from "@applemusic-like-lyrics/core";

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 01:54；一小时以上写成 1:01:54。 */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0
    ? `${hours}:${pad2(minutes)}:${pad2(rest)}`
    : `${pad2(minutes)}:${pad2(rest)}`;
}

export function formatSampleRate(hz: number | undefined): string {
  return hz ? `${(hz / 1000).toFixed(1)} kHz` : "—";
}

export function formatBitDepth(bits: number | undefined): string {
  return bits ? `${bits} bit` : "—";
}

export function formatChannels(channels: number | undefined): string {
  if (!channels) return "—";
  if (channels === 1) return "Mono";
  if (channels === 2) return "Stereo";
  return `${channels} ch`;
}

export function formatBitrate(kbps: number | undefined): string {
  return kbps ? `${kbps} kbps` : "—";
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

/** 顶部 “96.0 kHz / 24 BIT”；缺哪一项就只写另一项。 */
export function formatQualityHeadline(
  sampleRate: number | undefined,
  bitDepth: number | undefined,
): string {
  return [
    sampleRate ? formatSampleRate(sampleRate) : "",
    bitDepth ? `${bitDepth} BIT` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

/** 24-bit / 96.0 kHz；缺项时回到 “—”。 */
export function formatQuality(
  sampleRate: number | undefined,
  bitDepth: number | undefined,
): string {
  if (!sampleRate && !bitDepth) return "—";
  return [
    bitDepth ? `${bitDepth}-bit` : "",
    sampleRate ? formatSampleRate(sampleRate) : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

export function formatFrequencyTick(hz: number): string {
  if (hz >= 1000) {
    const k = hz / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(Math.round(hz));
}

const FREQUENCY_TICKS = [
  20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
];

/** 横轴刻度：常用刻度加上最右端的奈奎斯特频率，位置按对数 0..1。 */
export function frequencyTicks(
  maxHz: number,
  minHz = 20,
): { label: string; position: number }[] {
  const span = Math.log(maxHz / minHz);
  const position = (hz: number) => Math.log(hz / minHz) / span;
  // 离最右端太近的刻度会和奈奎斯特标签挤在一起，直接略掉
  const ticks = FREQUENCY_TICKS.map((hz) => ({
    label: formatFrequencyTick(hz),
    position: position(hz),
  })).filter((tick) => tick.position <= 0.95);
  ticks.push({ label: formatFrequencyTick(maxHz), position: 1 });
  return ticks;
}

/** 右侧线性幅度轴：0 dBFS = 1，每 20 dB 缩小 10 倍。 */
export function amplitudeLabel(db: number): string {
  const exponent = Math.round(db / 20);
  if (exponent === 0) return "1";
  if (exponent === -1) return "0.1";
  if (exponent === -2) return "0.01";
  if (exponent === -3) return "0.001";
  return `1e${exponent}`;
}

export type LyricWord = { text: string; startMs: number; endMs: number };

export type LyricEntry = {
  startMs: number;
  text: string;
  translation: string;
  /** 逐字时间；只有按字 / 词给了时间的歌词才有，整句一个时间的 LRC 是 undefined。 */
  words?: LyricWord[];
};

const FALLBACK_WORD_MS = 400;

/** 把一行里的词整理成逐字时间：补上缺失 / 异常的结束时间，去掉首尾空白。 */
function timedWords(line: LyricLine): LyricWord[] | undefined {
  const raw = line.words.filter((word) => word.word !== "");
  if (raw.length < 2) return undefined;
  const starts = new Set(raw.map((word) => word.startTime));
  // 所有词同一个开始时间说明只有整句时间，不是逐字
  if (starts.size < 2) return undefined;
  const words = raw.map((word, index) => {
    const next = raw[index + 1];
    const end =
      Number.isFinite(word.endTime) && word.endTime > word.startTime
        ? word.endTime
        : (next?.startTime ?? word.startTime + FALLBACK_WORD_MS);
    return { text: word.word, startMs: word.startTime, endMs: end };
  });
  const first = words[0] as LyricWord;
  const last = words[words.length - 1] as LyricWord;
  first.text = first.text.trimStart();
  last.text = last.text.trimEnd();
  return words.filter((word) => word.text !== "");
}

export function lyricEntries(lines: readonly LyricLine[]): LyricEntry[] {
  return lines
    .filter((line) => !line.isBG)
    .map((line) => ({
      startMs: line.startTime,
      text: line.words
        .map((word) => word.word)
        .join("")
        .trim(),
      translation: (line.translatedLyric || line.romanLyric || "").trim(),
      words: timedWords(line),
    }))
    .filter((entry) => entry.text !== "")
    .sort((a, b) => a.startMs - b.startMs);
}

/** 一个词唱到了多少：0（还没唱）到 1（唱完）。 */
export function wordProgress(word: LyricWord, timeMs: number): number {
  const span = Math.max(1, word.endMs - word.startMs);
  return Math.max(0, Math.min(1, (timeMs - word.startMs) / span));
}

/**
 * 逐字高亮用的渐变：左边已唱的颜色、右边未唱的颜色，中间留一小段柔和过渡。
 * progress=0 时整个词都是未唱色，=1 时整个词都是已唱色。
 */
export function karaokeGradient(
  progress: number,
  sung: string,
  unsung: string,
  soft = 10,
): string {
  const edge = progress * (100 + soft);
  return `linear-gradient(90deg, ${sung} ${(edge - soft).toFixed(2)}%, ${unsung} ${edge.toFixed(2)}%)`;
}

/** 当前正在唱的是第几句：最后一句 startMs <= 当前时间的歌词，没开始唱时是 -1。 */
export function currentLyricIndex(
  entries: readonly LyricEntry[],
  timeMs: number,
): number {
  let index = -1;
  for (let i = 0; i < entries.length; i += 1) {
    if ((entries[i] as LyricEntry).startMs <= timeMs) index = i;
    else break;
  }
  return index;
}

/** 粗略估算文字宽度：全角字符按 1em，其余按 0.56em。 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    em +=
      /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(
        char,
      )
        ? 1
        : 0.56;
  }
  return em * fontSize;
}

/** 一行放不下时按比例缩小字号，但不低于 minSize。 */
export function fitFontSize(
  text: string,
  maxSize: number,
  width: number,
  minSize = maxSize * 0.62,
): number {
  const natural = estimateTextWidth(text, maxSize);
  if (natural <= width) return maxSize;
  return Math.max(minSize, Math.round(((maxSize * width) / natural) * 10) / 10);
}
