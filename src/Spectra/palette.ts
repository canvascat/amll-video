/** 从封面像素推出界面配色。纯计算，不依赖浏览器，方便单测。 */

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
  translation: "#4d8f8c",
  unplayed: "#d9dad4",
};

const HUE_BINS = 18;
/** 有色像素至少占多少比例，才认为封面有“主色”。 */
const MIN_VIVID_SHARE = 0.015;

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * 在封面里找最“鲜”的一类颜色当强调色，再围绕它的色相配出其余几色：
 * 纸色、墨色是同一色相的低饱和浅色 / 深色，柱子和波形取互补色。
 * 几乎没有彩色的封面（黑白、灰）返回默认配色。
 */
export function deriveTheme(rgba: ArrayLike<number>): SpectraTheme {
  const score = Array.from({ length: HUE_BINS }, () => 0);
  const sine = Array.from({ length: HUE_BINS }, () => 0);
  const cosine = Array.from({ length: HUE_BINS }, () => 0);
  const satSum = Array.from({ length: HUE_BINS }, () => 0);
  const lightSum = Array.from({ length: HUE_BINS }, () => 0);
  const count = Array.from({ length: HUE_BINS }, () => 0);
  let pixels = 0;
  let vivid = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if ((rgba[i + 3] as number) < 128) continue;
    pixels += 1;
    const { h, s, l } = rgbToHsl(
      rgba[i] as number,
      rgba[i + 1] as number,
      rgba[i + 2] as number,
    );
    if (s < 0.28 || l < 0.18 || l > 0.88) continue;
    vivid += 1;
    const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS;
    // 越鲜、明度越居中的像素权重越大
    const weight = s * (1 - Math.abs(l - 0.5));
    score[bin] = (score[bin] as number) + weight;
    sine[bin] = (sine[bin] as number) + Math.sin((h * Math.PI) / 180) * weight;
    cosine[bin] =
      (cosine[bin] as number) + Math.cos((h * Math.PI) / 180) * weight;
    satSum[bin] = (satSum[bin] as number) + s * weight;
    lightSum[bin] = (lightSum[bin] as number) + l * weight;
    count[bin] = (count[bin] as number) + 1;
  }

  if (pixels === 0 || vivid / pixels < MIN_VIVID_SHARE) return DEFAULT_THEME;

  // 相邻两格合起来比，避免一种颜色正好被切在两格中间而得分被腰斩
  let best = 0;
  let bestScore = -1;
  for (let bin = 0; bin < HUE_BINS; bin += 1) {
    const joined =
      (score[bin] as number) +
      ((score[(bin + 1) % HUE_BINS] as number) +
        (score[(bin + HUE_BINS - 1) % HUE_BINS] as number)) *
        0.5;
    if (joined > bestScore) {
      bestScore = joined;
      best = bin;
    }
  }
  const weight = score[best] as number;
  if (weight <= 0) return DEFAULT_THEME;

  const hue =
    ((Math.atan2(sine[best] as number, cosine[best] as number) * 180) /
      Math.PI +
      360) %
    360;
  const sat = (satSum[best] as number) / weight;
  const light = (lightSum[best] as number) / weight;
  const complement = (hue + 180) % 360;

  return {
    paper: hslToHex(hue, 0.18, 0.91),
    ink: hslToHex(hue, 0.14, 0.15),
    inkSoft: hslToHex(hue, 0.06, 0.47),
    // 黄绿色在同样明度下看起来更亮，压低一点才不会在米色底上发虚
    accent: hslToHex(
      hue,
      clamp(sat, 0.55, 0.82),
      clamp(light, 0.46, 0.57) - (hue >= 45 && hue <= 180 ? 0.15 : 0),
    ),
    bar: hslToHex(complement, 0.24, 0.27),
    trace: hslToHex(complement, 0.38, 0.44),
    translation: hslToHex(complement, 0.34, 0.37),
    unplayed: hslToHex(hue, 0.06, 0.845),
  };
}

/** WCAG 对比度，测试里用来确认文字读得清。 */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((at) => {
      const value = parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return (
      0.2126 * (channels[0] as number) +
      0.7152 * (channels[1] as number) +
      0.0722 * (channels[2] as number)
    );
  };
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
