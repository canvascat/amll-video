import { ALL_FORMATS, AudioBufferSink, Input, UrlSource } from "mediabunny";
import { parseWebStream, type IAudioMetadata } from "music-metadata";

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
  bpm?: number;
  composer?: string;
};

export const TIMELINE_BAR_COUNT = 300;

/** music-metadata 的容器名 / 编码名 → 面板上的格式名。 */
export function formatLabel(
  container: string | undefined,
  codec: string | undefined,
): string | undefined {
  if (codec && /layer\s*3/i.test(codec)) return "MP3";
  if (codec && /aac/i.test(codec)) return "AAC";
  if (codec && /opus/i.test(codec)) return "OPUS";
  if (codec && /vorbis/i.test(codec)) return "VORBIS";
  if (container && /^wav/i.test(container)) return "WAV";
  const name = container || codec;
  return name ? name.toUpperCase() : undefined;
}

/** 把 music-metadata 的解析结果折成面板用到的字段，大小和时长由调用方给。 */
export function infoFromMetadata(
  metadata: Pick<IAudioMetadata, "format" | "common">,
  fileSizeBytes: number | undefined,
  durationInSeconds: number,
): { info: SpectraAudioInfo; tags: SpectraTags } {
  const { format, common } = metadata;
  const info: SpectraAudioInfo = {
    sampleRate: format.sampleRate,
    // 有损格式没有位深，music-metadata 也不会给
    bitDepth: format.bitsPerSample,
    channels: format.numberOfChannels,
    format: formatLabel(format.container, format.codec),
  };
  if (fileSizeBytes) {
    info.fileSizeBytes = fileSizeBytes;
    info.bitrateKbps = Math.round(
      (fileSizeBytes * 8) / durationInSeconds / 1000,
    );
  }
  const tags: SpectraTags = {};
  if (common.year) tags.year = common.year;
  if (common.track.no) tags.trackNumber = common.track.no;
  const genre = common.genre?.[0];
  if (genre) tags.genre = genre;
  if (common.bpm) tags.bpm = Math.round(common.bpm);
  const composer = [common.composer]
    .flat()
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ");
  if (composer) tags.composer = composer;
  return { info, tags };
}

/** 流式读取标签：只把文件头读到解析完就停，不会下载整首。 */
async function probeMetadata(url: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`读取音频失败: ${response.status}`);
  const length = Number(response.headers.get("content-length"));
  const size = Number.isFinite(length) && length > 0 ? length : undefined;
  try {
    const metadata = await parseWebStream(
      response.body,
      { size, mimeType: response.headers.get("content-type") ?? undefined },
      { skipCovers: true, skipPostHeaders: true },
    );
    return { metadata, size };
  } finally {
    await response.body.cancel().catch(() => undefined);
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
  let info: SpectraAudioInfo = {};
  let tags: SpectraTags = {};

  // 技术参数和标签交给 music-metadata；读不出来就留空，界面显示 “—”
  try {
    const { metadata, size } = await probeMetadata(src);
    ({ info, tags } = infoFromMetadata(metadata, size, durationInSeconds));
  } catch {
    // 忽略，下面用解码器兜底
  }

  // 响度包络要真的解码一遍，用 mediabunny；顺便给采样率 / 声道兜底
  const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (track) {
      info.sampleRate = info.sampleRate ?? (await track.getSampleRate());
      info.channels = info.channels ?? (await track.getNumberOfChannels());
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
