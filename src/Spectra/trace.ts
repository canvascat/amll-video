/**
 * 低频波形：把当前时刻前后一小段切成 points 份，每份取采样平均值。
 * 每份足够长，高频被平均掉，只留下低频的起伏，画出来是一条平缓的线。
 * 返回值在 -1..1，gain 用来放大安静的段落。
 */
export function lowBandTrace(options: {
  samples: Float32Array;
  centerSample: number;
  windowSamples: number;
  points: number;
  gain?: number;
}): number[] {
  const { samples, centerSample, windowSamples, points, gain = 4 } = options;
  const start = Math.round(centerSample - windowSamples / 2);
  const slice = windowSamples / points;
  const raw = Array.from({ length: points }, (_, point) => {
    const from = Math.round(start + point * slice);
    const to = Math.max(from + 1, Math.round(start + (point + 1) * slice));
    let sum = 0;
    let count = 0;
    for (let i = from; i < to; i += 1) {
      if (i < 0 || i >= samples.length) continue;
      sum += samples[i] as number;
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  });
  return raw.map((value, index) => {
    const smoothed =
      ((raw[index - 1] ?? value) + value * 2 + (raw[index + 1] ?? value)) / 4;
    return Math.max(-1, Math.min(1, smoothed * gain));
  });
}
