export const WAVEFORM_BAR_COUNT = 72;
export const WAVEFORM_TRACK_HEIGHT = 40;

// Folia：格子宽 = 画布宽度 / 72，柱子落在格子左侧 14%，宽度为格子的 34%，且不低于 1.35px。
export function waveformBar(
  index: number,
  level: number,
  width: number,
  height: number,
  count = WAVEFORM_BAR_COUNT,
) {
  const slot = width / count;
  const barHeight = Math.max(0, level) * height;
  return {
    x: index * slot + slot * 0.14,
    y: height - barHeight,
    width: Math.max(1.35, slot * 0.34),
    height: barHeight,
  };
}

// Folia 的 AnalyserNode 在 60Hz 下 smoothingTimeConstant 为 0.6。
// 成片是 30fps，一帧相当于两次混合，保留 0.6²。
export const SPECTRUM_RETAIN = 0.36;

export function smoothBins(
  history: readonly (readonly number[])[],
  retain = SPECTRUM_RETAIN,
): number[] {
  const frames = history.filter((frame) => frame.length > 0);
  const width = frames[0]?.length ?? 0;
  if (width === 0) return [];
  let acc = Array.from({ length: width }, () => 0);
  for (const frame of frames) {
    acc = acc.map((previous, index) => previous * retain + (frame[index] ?? 0) * (1 - retain));
  }
  return acc;
}

export function waveformLevels(bins: readonly number[], count = WAVEFORM_BAR_COUNT): number[] {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    const envelope = Math.sin(t * Math.PI);
    if (bins.length === 0) {
      const idle = 0.12 + (Math.sin(index * 0.35) * 0.5 + 0.5) * 0.2;
      return 0.02 + idle * 0.35 * envelope;
    }
    const usable = Math.max(1, bins.length - 6);
    const center = 6 + Math.expm1(t * Math.log(usable + 1));
    const radius = 1;
    const start = Math.max(6, Math.floor(center - radius));
    const end = Math.min(bins.length - 1, Math.ceil(center + radius));
    let weighted = 0;
    let weight = 0;
    for (let bin = start; bin <= end; bin += 1) {
      const distance = Math.abs(bin - center);
      const share = Math.max(0.1, 1 - distance / (radius + 1));
      weighted += (bins[bin] ?? 0) * share;
      weight += share;
    }
    const band = weight > 0 ? weighted / weight : 0;
    const shaped = Math.pow(Math.min(1, band * 80), 1.8);
    return Math.max(0, Math.min(1, 0.02 + shaped * 0.82 * envelope));
  });
}
