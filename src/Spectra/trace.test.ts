import assert from "node:assert/strict";
import { test } from "node:test";
import { lowBandTrace } from "./trace";

test("低频正弦能留下来，高频被平均掉", () => {
  const sampleRate = 48000;
  const low = new Float32Array(sampleRate);
  const high = new Float32Array(sampleRate);
  for (let i = 0; i < sampleRate; i += 1) {
    low[i] = 0.5 * Math.sin((2 * Math.PI * 40 * i) / sampleRate);
    high[i] = 0.5 * Math.sin((2 * Math.PI * 9000 * i) / sampleRate);
  }
  const options = {
    centerSample: sampleRate / 2,
    windowSamples: sampleRate / 2,
    points: 120,
    gain: 1,
  };
  const lowTrace = lowBandTrace({ ...options, samples: low });
  const highTrace = lowBandTrace({ ...options, samples: high });
  assert.equal(lowTrace.length, 120);
  assert.ok(Math.max(...lowTrace.map(Math.abs)) > 0.35);
  assert.ok(Math.max(...highTrace.map(Math.abs)) < 0.05);
});

test("结果限制在 -1..1，越界部分按静音处理", () => {
  const loud = new Float32Array(1000).fill(1);
  const trace = lowBandTrace({
    samples: loud,
    centerSample: 0,
    windowSamples: 400,
    points: 20,
    gain: 10,
  });
  assert.ok(trace.every((value) => value >= -1 && value <= 1));
  assert.equal(trace[0], 0);
  assert.equal(trace[trace.length - 1], 1);
});
