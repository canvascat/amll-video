import assert from "node:assert/strict";
import { test } from "node:test";
import { SPECTRUM_RETAIN, WAVEFORM_BAR_COUNT, smoothBins, waveformBar, waveformLevels } from "./waveform";

test("波形两端被包络压低，能量出现在对应频段", () => {
  const bins = Array.from({ length: 16 }, () => 0);
  bins[8] = 1;
  const levels = waveformLevels(bins);
  assert.equal(levels.length, WAVEFORM_BAR_COUNT);
  assert.ok(levels.every((level) => level >= 0 && level <= 1));
  assert.ok(levels[0] < 0.05);
  assert.ok(levels[levels.length - 1] < 0.05);
  const peak = Math.max(...levels);
  const peakAt = levels.indexOf(peak);
  assert.ok(peak > 0.2);
  assert.ok(peakAt > 4 && peakAt < levels.length - 5);
});

test("柱子按画布宽度均分，宽度是格子的 34%", () => {
  const width = 450;
  const slot = width / WAVEFORM_BAR_COUNT;
  const first = waveformBar(0, 1, width, 40);
  assert.ok(Math.abs(first.x - slot * 0.14) < 1e-9);
  assert.ok(Math.abs(first.width - slot * 0.34) < 1e-9);
  assert.equal(first.y, 0);
  assert.equal(first.height, 40);
  const last = waveformBar(WAVEFORM_BAR_COUNT - 1, 0, width, 40);
  assert.equal(last.height, 0);
  assert.ok(last.x + last.width <= width);
});

test("频谱沿用分析器的保留系数，新的一帧不会立刻占满", () => {
  const quiet = Array.from({ length: 8 }, () => 0);
  const loud = Array.from({ length: 8 }, () => 1);
  const justArrived = smoothBins([quiet, quiet, loud], SPECTRUM_RETAIN);
  const held = smoothBins([loud, loud, loud], SPECTRUM_RETAIN);
  assert.ok(justArrived[0] < held[0] * 0.75);
  assert.ok(justArrived[0] > 0);
});
