import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_THEME,
  contrastRatio,
  deriveTheme,
  hslToHex,
  rgbToHsl,
} from "./palette";

function solid(r: number, g: number, b: number, count = 400): number[] {
  return Array.from({ length: count }, () => [r, g, b, 255]).flat();
}

const hueOf = (hex: string) =>
  rgbToHsl(
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ).h;

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

test("HSL 和十六进制互转", () => {
  assert.equal(hslToHex(0, 1, 0.5), "#ff0000");
  assert.equal(hslToHex(120, 1, 0.5), "#00ff00");
  assert.equal(hslToHex(240, 1, 0.5), "#0000ff");
  assert.equal(hslToHex(0, 0, 1), "#ffffff");
  const { h, s, l } = rgbToHsl(229, 104, 63);
  assert.equal(hslToHex(h, s, l), "#e5683f");
});

test("黑白灰封面回到默认配色", () => {
  assert.deepEqual(deriveTheme(solid(128, 128, 128)), DEFAULT_THEME);
  assert.deepEqual(
    deriveTheme([...solid(255, 255, 255, 200), ...solid(0, 0, 0, 200)]),
    DEFAULT_THEME,
  );
  assert.deepEqual(deriveTheme([]), DEFAULT_THEME);
});

test("强调色跟着封面主色走，柱子和波形取互补色", () => {
  const blue = deriveTheme(solid(40, 90, 200));
  assert.ok(hueDistance(hueOf(blue.accent), 220) < 15, blue.accent);
  assert.ok(hueDistance(hueOf(blue.bar), 40) < 15, blue.bar);
  assert.ok(hueDistance(hueOf(blue.paper), hueOf(blue.accent)) < 15);

  const red = deriveTheme(solid(210, 40, 50));
  assert.ok(hueDistance(hueOf(red.accent), 355) < 15, red.accent);
  assert.notEqual(blue.accent, red.accent);
});

test("大片白底加少量彩色线条（白封面）也能取到彩色", () => {
  const pixels = [...solid(250, 250, 250, 900), ...solid(235, 120, 40, 100)];
  const theme = deriveTheme(pixels);
  assert.ok(hueDistance(hueOf(theme.accent), 25) < 15, theme.accent);
});

test("多种颜色里选面积更大、更鲜的那种", () => {
  const pixels = [...solid(30, 160, 80, 300), ...solid(200, 40, 40, 60)];
  const theme = deriveTheme(pixels);
  assert.ok(hueDistance(hueOf(theme.accent), 140) < 20, theme.accent);
});

test("透明像素不参与统计", () => {
  const pixels = [
    ...Array.from({ length: 500 }, () => [255, 0, 0, 0]).flat(),
    ...solid(40, 90, 200, 100),
  ];
  assert.ok(hueDistance(hueOf(deriveTheme(pixels).accent), 220) < 15);
});

test("任何主色下，正文、标签和翻译都读得清", () => {
  const swatches: [number, number, number][] = [
    [229, 104, 63],
    [40, 90, 200],
    [30, 160, 80],
    [240, 200, 40],
    [160, 50, 190],
    [210, 40, 50],
  ];
  for (const [r, g, b] of swatches) {
    const theme = deriveTheme(solid(r, g, b));
    assert.ok(contrastRatio(theme.ink, theme.paper) >= 10, `ink ${theme.ink}`);
    assert.ok(
      contrastRatio(theme.inkSoft, theme.paper) >= 2.8,
      `inkSoft ${theme.inkSoft}`,
    );
    assert.ok(
      contrastRatio(theme.translation, theme.paper) >= 3,
      `translation ${theme.translation}`,
    );
    assert.ok(contrastRatio(theme.bar, theme.paper) >= 6, `bar ${theme.bar}`);
    assert.ok(
      contrastRatio(theme.accent, theme.paper) >= 2,
      `accent ${theme.accent}`,
    );
  }
});

test("默认配色本身也满足同样的可读性", () => {
  assert.ok(contrastRatio(DEFAULT_THEME.ink, DEFAULT_THEME.paper) >= 10);
  assert.ok(contrastRatio(DEFAULT_THEME.translation, DEFAULT_THEME.paper) >= 3);
});
