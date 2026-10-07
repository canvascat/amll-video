import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DB_FLOOR,
  FFT_SIZE,
  amplitudeToDb,
  dbToRatio,
  fftAmplitudes,
  logBandEdges,
  logBands,
  spectrumFrame,
} from "./analysis";

function sine(
  frequency: number,
  amplitude: number,
  sampleRate: number,
  length: number,
): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return out;
}

test("满刻度正弦在 FFT 里约等于 0 dBFS，半幅约 -6 dBFS", () => {
  const sampleRate = 48000;
  const binHz = sampleRate / FFT_SIZE;
  // 取恰好落在 bin 中心的频率，避免栅栏效应
  const frequency = binHz * 171;
  for (const [amplitude, expected] of [
    [1, 0],
    [0.5, -6.02],
  ] as const) {
    const amplitudes = fftAmplitudes(
      sine(frequency, amplitude, sampleRate, FFT_SIZE * 2),
      0,
    );
    const peak = Math.max(...amplitudes);
    assert.ok(
      Math.abs(amplitudeToDb(peak) - expected) < 0.2,
      `${amplitude} → ${amplitudeToDb(peak)}`,
    );
    assert.equal(amplitudes.indexOf(peak), 171);
  }
});

test("采样不够或越界时补 0，不会抛错", () => {
  const amplitudes = fftAmplitudes(new Float32Array(100), -500);
  assert.equal(amplitudes.length, FFT_SIZE / 2);
  assert.ok(amplitudes.every((value) => value === 0));
});

test("对数频带从 20 Hz 铺到奈奎斯特，边界首尾相接", () => {
  const count = 96;
  const maxHz = 48000;
  const first = logBandEdges(0, count, maxHz);
  const last = logBandEdges(count - 1, count, maxHz);
  assert.ok(Math.abs(first.low - 20) < 1e-9);
  assert.ok(Math.abs(last.high - maxHz) < 1e-6);
  for (let i = 1; i < count; i += 1) {
    assert.ok(
      Math.abs(
        logBandEdges(i, count, maxHz).low -
          logBandEdges(i - 1, count, maxHz).high,
      ) < 1e-6,
    );
  }
});

test("能量落在哪个频带，哪个频带就最高", () => {
  const sampleRate = 96000;
  const amplitudes = fftAmplitudes(
    sine(1000, 0.5, sampleRate, FFT_SIZE * 2),
    0,
  );
  const bands = logBands(amplitudes, sampleRate, 96);
  const peak = Math.max(...bands);
  const index = Array.from(bands).indexOf(peak);
  const { low, high } = logBandEdges(index, 96, sampleRate / 2);
  assert.ok(low <= 1000 + 1 && high >= 1000 - 1, `${low}–${high}`);
});

test("dB 换算：静音落到 -180，上限 0，位置按 -180..0 线性", () => {
  assert.equal(amplitudeToDb(0), DB_FLOOR);
  assert.equal(amplitudeToDb(1e-12), DB_FLOOR);
  assert.equal(amplitudeToDb(10), 0);
  assert.ok(Math.abs(amplitudeToDb(0.1) + 20) < 1e-9);
  assert.equal(dbToRatio(-180), 0);
  assert.equal(dbToRatio(0), 1);
  assert.equal(dbToRatio(-90), 0.5);
});

test("峰值保持不低于当前柱子，静音时两者都在底部", () => {
  const sampleRate = 48000;
  const samples = sine(1000, 0.5, sampleRate, sampleRate * 2);
  const frame = spectrumFrame({
    samples,
    sampleRate,
    centerSample: sampleRate,
    samplesPerFrame: sampleRate / 30,
    bandCount: 48,
  });
  assert.equal(frame.bars.length, 48);
  frame.bars.forEach((bar, index) =>
    assert.ok((frame.peaks[index] as number) >= bar),
  );
  const silent = spectrumFrame({
    samples: new Float32Array(sampleRate),
    sampleRate,
    centerSample: 1000,
    samplesPerFrame: sampleRate / 30,
    bandCount: 48,
  });
  assert.ok(silent.bars.every((bar) => bar === DB_FLOOR));
  assert.ok(silent.peaks.every((peak) => peak === DB_FLOOR));
});
