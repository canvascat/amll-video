import chroma from "chroma-js";

/** 由封面主色推出界面配色。取色交给 node-vibrant，颜色换算和对比度交给 chroma-js，这里只管配色规则。 */

export type SpectraTheme = {
  paper: string;
  ink: string;
  inkSoft: string;
  accent: string;
  bar: string;
  trace: string;
  translation: string;
  unplayed: string;
};

/** 米色底、橙色强调、青灰柱子：最初的那套配色，封面取不到颜色时回到它。 */
export const DEFAULT_THEME: SpectraTheme = {
  paper: "#ebe8e0",
  ink: "#23292c",
  inkSoft: "#8b8b86",
  accent: "#e5683f",
  bar: "#3b5357",
  trace: "#4f8f7d",
  translation: "#c27f6b",
  unplayed: "#d9dad4",
};

export type AccentColor = {
  /** 色相，0–360 */
  hue: number;
  /** 饱和度，0–1 */
  saturation: number;
  /** 明度，0–1 */
  lightness: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const hex = (hue: number, saturation: number, lightness: number) =>
  chroma.hsl(((hue % 360) + 360) % 360, saturation, lightness).hex();

/** 在纸色上从浅往深找第一个对比度够用（≥ 2.6）的明度，保证“淡”但仍读得清。 */
function softTone(hue: number, saturation: number, paper: string): string {
  for (let lightness = 0.62; lightness > 0.2; lightness -= 0.01) {
    const color = hex(hue, saturation, lightness);
    if (chroma.contrast(color, paper) >= 2.6) return color;
  }
  return hex(hue, saturation, 0.2);
}

/**
 * 以封面主色为强调色，围绕它的色相配出其余几色：
 * 纸色、墨色是同一色相的低饱和浅色 / 深色，柱子、低频波形取互补色，翻译沿用强调色的色相。
 */
export function themeFromAccent({
  hue,
  saturation,
  lightness,
}: AccentColor): SpectraTheme {
  const complement = hue + 180;
  const paper = hex(hue, 0.18, 0.91);
  return {
    paper,
    ink: hex(hue, 0.14, 0.15),
    inkSoft: hex(hue, 0.06, 0.47),
    // 黄绿色在同样明度下看起来更亮，压低一点才不会在米色底上发虚
    accent: hex(
      hue,
      clamp(saturation, 0.55, 0.82),
      clamp(lightness, 0.46, 0.57) - (hue >= 45 && hue <= 180 ? 0.15 : 0),
    ),
    bar: hex(complement, 0.24, 0.27),
    trace: hex(complement, 0.38, 0.44),
    // 翻译跟强调色同一色相，比强调色更淡、更灰，当副文本不抢正文
    translation: softTone(hue, 0.42, paper),
    unplayed: hex(hue, 0.06, 0.845),
  };
}

/** 供 node-vibrant 的色板使用：只要色板里的 swatch 够“鲜”，就能当强调色。 */
export type PaletteSwatch = {
  /** 与 node-vibrant 一致：h、s、l 都是 0–1 */
  hsl: readonly [number, number, number];
  population: number;
};

/** 在 Vibrant / LightVibrant / DarkVibrant 里挑占比最大的一个，没有就返回 null（黑白灰封面）。 */
export function pickAccent(
  swatches: readonly (PaletteSwatch | null | undefined)[],
): AccentColor | null {
  let best: PaletteSwatch | null = null;
  for (const swatch of swatches) {
    if (!swatch || swatch.hsl[1] < 0.3) continue;
    if (!best || swatch.population > best.population) best = swatch;
  }
  if (!best) return null;
  return {
    hue: best.hsl[0] * 360,
    saturation: best.hsl[1],
    lightness: best.hsl[2],
  };
}
