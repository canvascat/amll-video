import assert from "node:assert/strict";
import { test } from "node:test";
import chroma from "chroma-js";
import {
  DEFAULT_THEME,
  pickAccent,
  themeFromAccent,
  type AccentColor,
} from "./palette";

const hueOf = (color: string) => chroma(color).hsl()[0];

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

const accent = (hue: number): AccentColor => ({
  hue,
  saturation: 0.7,
  lightness: 0.5,
});

test("强调色跟着封面主色走，柱子和波形取互补色", () => {
  const blue = themeFromAccent(accent(220));
  assert.ok(hueDistance(hueOf(blue.accent), 220) < 6, blue.accent);
  assert.ok(hueDistance(hueOf(blue.bar), 40) < 12, blue.bar);
  assert.ok(hueDistance(hueOf(blue.paper), 220) < 12, blue.paper);

  const red = themeFromAccent(accent(355));
  assert.ok(hueDistance(hueOf(red.accent), 355) < 6, red.accent);
  assert.notEqual(blue.accent, red.accent);
});

test("饱和度和明度被限制在好看的范围内", () => {
  const dull = chroma(
    themeFromAccent({ hue: 20, saturation: 0.3, lightness: 0.9 }).accent,
  ).hsl();
  assert.ok(dull[1] >= 0.5 && dull[2] <= 0.6, `${dull}`);
  const loud = chroma(
    themeFromAccent({ hue: 20, saturation: 1, lightness: 0.1 }).accent,
  ).hsl();
  assert.ok(loud[1] <= 0.85 && loud[2] >= 0.43, `${loud}`);
});

test("挑占比最大的鲜艳 swatch，忽略不够鲜的和空的", () => {
  const picked = pickAccent([
    null,
    { hsl: [0.1, 0.8, 0.5], population: 40 },
    { hsl: [0.6, 0.7, 0.4], population: 300 },
    { hsl: [0.3, 0.1, 0.5], population: 5000 },
    undefined,
  ]);
  assert.ok(picked);
  assert.ok(Math.abs(picked.hue - 216) < 1e-9);
  assert.equal(picked.saturation, 0.7);
  assert.equal(pickAccent([]), null);
  assert.equal(
    pickAccent([null, { hsl: [0.5, 0.1, 0.5], population: 100 }]),
    null,
  );
});

test("任何主色下，正文、标签和翻译都读得清", () => {
  for (let hue = 0; hue < 360; hue += 15) {
    const theme = themeFromAccent({ hue, saturation: 0.75, lightness: 0.5 });
    const contrast = (color: string) => chroma.contrast(color, theme.paper);
    assert.ok(contrast(theme.ink) >= 10, `ink ${hue} ${theme.ink}`);
    assert.ok(
      contrast(theme.inkSoft) >= 2.8,
      `inkSoft ${hue} ${theme.inkSoft}`,
    );
    assert.ok(
      contrast(theme.translation) >= 3,
      `translation ${hue} ${theme.translation}`,
    );
    assert.ok(contrast(theme.bar) >= 6, `bar ${hue} ${theme.bar}`);
    assert.ok(contrast(theme.accent) >= 1.8, `accent ${hue} ${theme.accent}`);
  }
});

test("默认配色本身也满足同样的可读性", () => {
  assert.ok(chroma.contrast(DEFAULT_THEME.ink, DEFAULT_THEME.paper) >= 10);
  assert.ok(
    chroma.contrast(DEFAULT_THEME.translation, DEFAULT_THEME.paper) >= 3,
  );
});
