/** 频谱用到的纯计算：加窗 FFT、对数频带、dBFS 换算。不依赖 React，方便单测。 */

export const FFT_SIZE = 8192;
export const DB_FLOOR = -180;
export const DB_CEIL = 0;
export const SPECTRUM_MIN_HZ = 20;

type FftPlan = {
  size: number;
  reverse: Uint32Array;
  cos: Float64Array;
  sin: Float64Array;
  window: Float64Array;
};

const plans = new Map<number, FftPlan>();

function planFor(size: number): FftPlan {
  const cached = plans.get(size);
  if (cached) return cached;
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`FFT 点数必须是 2 的幂: ${size}`);
  }
  const bits = Math.log2(size);
  const reverse = new Uint32Array(size);
  for (let i = 0; i < size; i += 1) {
    let value = i;
    let out = 0;
    for (let bit = 0; bit < bits; bit += 1) {
      out = (out << 1) | (value & 1);
      value >>= 1;
    }
    reverse[i] = out;
  }
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i += 1) {
    cos[i] = Math.cos((2 * Math.PI * i) / size);
    sin[i] = -Math.sin((2 * Math.PI * i) / size);
  }
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  }
  const plan = { size, reverse, cos, sin, window };
  plans.set(size, plan);
  return plan;
}

/**
 * 对 samples 里从 start 起的 size 个采样做 Hann 加窗 FFT，返回 size/2 个幅度。
 * 幅度按满刻度正弦 = 1.0 校准，所以 20·log10(幅度) 就是 dBFS。
 * start 越界的部分补 0。
 */
export function fftAmplitudes(
  samples: Float32Array,
  start: number,
  size = FFT_SIZE,
): Float32Array {
  const plan = planFor(size);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    const index = start + i;
    const sample =
      index >= 0 && index < samples.length ? (samples[index] ?? 0) : 0;
    re[plan.reverse[i] as number] = sample * (plan.window[i] as number);
  }
  for (let half = 1; half < size; half <<= 1) {
    const step = size / (half << 1);
    for (let block = 0; block < size; block += half << 1) {
      for (let k = 0; k < half; k += 1) {
        const wr = plan.cos[k * step] as number;
        const wi = plan.sin[k * step] as number;
        const a = block + k;
        const b = a + half;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
  const bins = size / 2;
  const out = new Float32Array(bins);
  // Hann 窗的相干增益是 0.5，单边谱再乘 2：幅度 = |X| · 2 / (N · 0.5)
  const scale = 4 / size;
  for (let i = 0; i < bins; i += 1) {
    out[i] = Math.hypot(re[i]!, im[i]!) * scale;
  }
  return out;
}

/** 第 index 根柱子的频带边界（Hz），整体在 [minHz, maxHz] 上等比分布。 */
export function logBandEdges(
  index: number,
  count: number,
  maxHz: number,
  minHz = SPECTRUM_MIN_HZ,
): { low: number; high: number; center: number } {
  const ratio = maxHz / minHz;
  const low = minHz * Math.pow(ratio, index / count);
  const high = minHz * Math.pow(ratio, (index + 1) / count);
  return { low, high, center: Math.sqrt(low * high) };
}

/**
 * 把线性频率的幅度折成对数频带。频带比一个 bin 还窄时（低频）在相邻 bin 间插值，
 * 否则取频带内能量的均方根。
 */
export function logBands(
  amplitudes: ArrayLike<number>,
  sampleRate: number,
  count: number,
  minHz = SPECTRUM_MIN_HZ,
): Float32Array {
  const bins = amplitudes.length;
  const binHz = sampleRate / 2 / bins;
  const maxHz = sampleRate / 2;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const { low, high, center } = logBandEdges(i, count, maxHz, minHz);
    const lowBin = low / binHz;
    const highBin = Math.min(bins, high / binHz);
    if (highBin - lowBin < 1) {
      const position = Math.min(bins - 1, center / binHz);
      const left = Math.floor(position);
      const right = Math.min(bins - 1, left + 1);
      const mix = position - left;
      out[i] =
        (amplitudes[left] ?? 0) * (1 - mix) + (amplitudes[right] ?? 0) * mix;
      continue;
    }
    const from = Math.max(0, Math.ceil(lowBin));
    const to = Math.max(from + 1, Math.min(bins, Math.ceil(highBin)));
    let power = 0;
    for (let bin = from; bin < to; bin += 1) {
      const value = amplitudes[bin] ?? 0;
      power += value * value;
    }
    out[i] = Math.sqrt(power / (to - from));
  }
  return out;
}

export function amplitudeToDb(amplitude: number): number {
  if (!(amplitude > 0)) return DB_FLOOR;
  return Math.max(DB_FLOOR, Math.min(DB_CEIL, 20 * Math.log10(amplitude)));
}

/** dBFS → 0..1 的纵向位置（-180 dBFS 在底，0 dBFS 在顶）。 */
export function dbToRatio(db: number): number {
  return Math.max(0, Math.min(1, (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)));
}

export type SpectrumFrame = {
  /** 每根柱子的 dBFS，已按最近几帧平滑。 */
  bars: number[];
  /** 每根柱子的峰值保持 dBFS。 */
  peaks: number[];
};

export type SpectrumOptions = {
  samples: Float32Array;
  sampleRate: number;
  /** 当前帧对应的采样位置（相对 samples 起点）。 */
  centerSample: number;
  /** 一帧对应多少个采样。 */
  samplesPerFrame: number;
  bandCount: number;
  /** 平滑看几帧、峰值保持看几帧。 */
  smoothFrames?: number;
  holdFrames?: number;
  /** 峰值保持每过一帧下落多少 dB。 */
  peakFallDb?: number;
};

/** 往前看若干帧，得到平滑后的柱子和峰值保持。同一帧永远得到同一结果，渲染多路并行也一致。 */
export function spectrumFrame(options: SpectrumOptions): SpectrumFrame {
  const {
    samples,
    sampleRate,
    centerSample,
    samplesPerFrame,
    bandCount,
    smoothFrames = 4,
    holdFrames = 12,
    peakFallDb = 1.6,
  } = options;
  const history = Math.max(smoothFrames, holdFrames);
  const bars = Array.from({ length: bandCount }, () => 0);
  const peaks = Array.from({ length: bandCount }, () => DB_FLOOR);
  let weightSum = 0;
  for (let age = 0; age < history; age += 1) {
    const start =
      Math.round(centerSample - age * samplesPerFrame) - FFT_SIZE / 2;
    const bands = logBands(
      fftAmplitudes(samples, start),
      sampleRate,
      bandCount,
    );
    const weight = age < smoothFrames ? Math.pow(0.6, age) : 0;
    weightSum += weight;
    for (let i = 0; i < bandCount; i += 1) {
      const db = amplitudeToDb(bands[i] ?? 0);
      bars[i] = (bars[i] as number) + db * weight;
      peaks[i] = Math.max(peaks[i] as number, db - age * peakFallDb);
    }
  }
  for (let i = 0; i < bandCount; i += 1) {
    bars[i] = (bars[i] as number) / weightSum;
    peaks[i] = Math.max(peaks[i] as number, bars[i] as number);
  }
  return { bars, peaks };
}
