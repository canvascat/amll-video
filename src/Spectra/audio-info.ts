import {
  ALL_FORMATS,
  AudioBufferSink,
  Input,
  UrlSource,
  type AudioCodec,
} from "mediabunny";

/** 底部技术参数条和时间轴用到的音频信息。取不到的字段留空，界面显示 “—”。 */
export type SpectraAudioInfo = {
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  format?: string;
  bitrateKbps?: number;
  fileSizeBytes?: number;
  /** 整首歌的响度包络，0..1，用来画曲目时间轴。 */
  peaks?: number[];
};

export type SpectraTags = {
  year?: number;
  trackNumber?: number;
  genre?: string;
};

export const TIMELINE_BAR_COUNT = 300;

export function parseFlacStreamInfo(
  bytes: Uint8Array,
): { sampleRate: number; channels: number; bitDepth: number } | null {
  let offset = 0;
  if (
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33 &&
    bytes.length >= 10
  ) {
    // ID3v2：10 字节头 + 4×7 位的同步安全长度
    const size =
      ((bytes[6] as number) << 21) |
      ((bytes[7] as number) << 14) |
      ((bytes[8] as number) << 7) |
      (bytes[9] as number);
    offset = 10 + size;
  }
  const magic = String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
  if (magic !== "fLaC" || bytes.length < offset + 8 + 14) return null;
  // 4 字节块头之后依次是 16+16+24+24 位，共 10 字节，再往后是采样率 / 声道 / 位深
  const base = offset + 8 + 10;
  const b0 = bytes[base] as number;
  const b1 = bytes[base + 1] as number;
  const b2 = bytes[base + 2] as number;
  const b3 = bytes[base + 3] as number;
  return {
    sampleRate: (b0 << 12) | (b1 << 4) | (b2 >> 4),
    channels: ((b2 >> 1) & 0x7) + 1,
    bitDepth: (((b2 & 0x1) << 4) | (b3 >> 4)) + 1,
  };
}

export function pcmBitDepth(codec: AudioCodec | null): number | undefined {
  switch (codec) {
    case "pcm-s8":
    case "pcm-u8":
    case "ulaw":
    case "alaw":
      return 8;
    case "pcm-s16":
    case "pcm-s16be":
      return 16;
    case "pcm-s24":
    case "pcm-s24be":
      return 24;
    case "pcm-s32":
    case "pcm-s32be":
    case "pcm-f32":
    case "pcm-f32be":
      return 32;
    case "pcm-f64":
    case "pcm-f64be":
      return 64;
    default:
      return undefined;
  }
}

export function formatName(
  inputFormat: string,
  codec: AudioCodec | null,
): string | undefined {
  if (codec === "flac") return "FLAC";
  if (codec === "mp3") return "MP3";
  if (codec === "aac") return "AAC";
  if (codec === "opus") return "OPUS";
  if (codec === "vorbis") return "VORBIS";
  if (codec?.startsWith("pcm")) return /wav/i.test(inputFormat) ? "WAV" : "PCM";
  return inputFormat ? inputFormat.toUpperCase() : undefined;
}

type ProbedHead = { bytes: Uint8Array; totalSize?: number };

async function probeHead(url: string): Promise<ProbedHead | null> {
  try {
    const response = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    if (!response.ok) return null;
    const range = /\/(\d+)\s*$/.exec(
      response.headers.get("content-range") ?? "",
    );
    const length = Number(response.headers.get("content-length"));
    const totalSize = range
      ? Number(range[1])
      : Number.isFinite(length) && length > 0
        ? length
        : undefined;
    const reader = response.body?.getReader();
    if (!reader)
      return {
        bytes: new Uint8Array(await response.arrayBuffer()).slice(0, 65536),
        totalSize,
      };
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < 65536) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
    }
    await reader.cancel().catch(() => undefined);
    const bytes = new Uint8Array(received);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    return { bytes, totalSize };
  } catch {
    return null;
  }
}

/** 按桶累加平方和，最后得到每桶的 RMS，再按最大值归一并略微压缩。 */
export function toLoudnessEnvelope(
  sumSquares: ArrayLike<number>,
  counts: ArrayLike<number>,
): number[] {
  const rms = Array.from({ length: sumSquares.length }, (_, i) =>
    (counts[i] ?? 0) > 0
      ? Math.sqrt((sumSquares[i] as number) / (counts[i] as number))
      : 0,
  );
  const max = Math.max(...rms, 0);
  if (max <= 0) return rms.map(() => 0);
  return rms.map(
    (value) => Math.round(Math.pow(value / max, 0.85) * 1000) / 1000,
  );
}

async function readLoudnessEnvelope(
  input: Input,
  startInSeconds: number,
  endInSeconds: number,
  bucketCount: number,
) {
  const track = await input.getPrimaryAudioTrack();
  if (!track || !(await track.canDecode())) return undefined;
  const sink = new AudioBufferSink(track);
  const sumSquares = new Float64Array(bucketCount);
  const counts = new Float64Array(bucketCount);
  const span = Math.max(1e-6, endInSeconds - startInSeconds);
  for await (const { buffer, timestamp } of sink.buffers(
    startInSeconds,
    endInSeconds,
  )) {
    const channels = buffer.numberOfChannels;
    const data = Array.from({ length: channels }, (_, channel) =>
      buffer.getChannelData(channel),
    );
    for (let i = 0; i < buffer.length; i += 1) {
      const seconds = timestamp + i / buffer.sampleRate;
      if (seconds < startInSeconds || seconds >= endInSeconds) continue;
      const bucket = Math.min(
        bucketCount - 1,
        Math.floor(((seconds - startInSeconds) / span) * bucketCount),
      );
      let mixed = 0;
      for (let channel = 0; channel < channels; channel += 1) {
        mixed += (data[channel] as Float32Array)[i] as number;
      }
      mixed /= channels;
      sumSquares[bucket] = (sumSquares[bucket] as number) + mixed * mixed;
      counts[bucket] = (counts[bucket] as number) + 1;
    }
  }
  return toLoudnessEnvelope(sumSquares, counts);
}

const cache = new Map<
  string,
  Promise<{ info: SpectraAudioInfo; tags: SpectraTags }>
>();

/** 读取技术参数、标签和整首歌的响度包络。仅在浏览器里使用（Studio / 渲染页）。 */
export function loadSpectraAudioInfo(
  src: string,
  durationInSeconds: number,
  range: { startInSeconds: number; endInSeconds: number },
): Promise<{ info: SpectraAudioInfo; tags: SpectraTags }> {
  const key = `${src}@${durationInSeconds}@${range.startInSeconds}-${range.endInSeconds}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const task = readSpectraAudioInfo(src, durationInSeconds, range);
  cache.set(key, task);
  task.catch(() => cache.delete(key));
  return task;
}

async function readSpectraAudioInfo(
  src: string,
  durationInSeconds: number,
  range: { startInSeconds: number; endInSeconds: number },
) {
  const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
  const info: SpectraAudioInfo = {};
  const tags: SpectraTags = {};
  try {
    const track = await input.getPrimaryAudioTrack();
    const codec = track ? await track.getCodec() : null;
    if (track) {
      info.sampleRate = await track.getSampleRate();
      info.channels = await track.getNumberOfChannels();
      info.bitDepth = pcmBitDepth(codec);
    }
    const inputFormat = await input.getFormat().catch(() => null);
    info.format = formatName(inputFormat?.name ?? "", codec);

    const head = await probeHead(src);
    if (head) {
      if (head.totalSize) {
        info.fileSizeBytes = head.totalSize;
        info.bitrateKbps = Math.round(
          (head.totalSize * 8) / durationInSeconds / 1000,
        );
      }
      const flac = parseFlacStreamInfo(head.bytes);
      if (flac) {
        info.bitDepth = flac.bitDepth;
        info.sampleRate = info.sampleRate ?? flac.sampleRate;
        info.channels = info.channels ?? flac.channels;
      }
    }

    const metadata = await input.getMetadataTags().catch(() => null);
    if (metadata) {
      const year = metadata.date?.getUTCFullYear();
      if (year && Number.isFinite(year)) tags.year = year;
      if (metadata.trackNumber) tags.trackNumber = metadata.trackNumber;
      if (metadata.genre) tags.genre = metadata.genre;
    }

    info.peaks = await readLoudnessEnvelope(
      input,
      range.startInSeconds,
      range.endInSeconds,
      TIMELINE_BAR_COUNT,
    ).catch(() => undefined);
  } finally {
    input.dispose();
  }
  return { info, tags };
}
