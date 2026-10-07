import { Vibrant } from "node-vibrant/browser";
import { pickAccent, themeFromAccent, type SpectraTheme } from "./palette";

const cache = new Map<string, Promise<SpectraTheme | null>>();

async function readTheme(url: string): Promise<SpectraTheme | null> {
  // 取色用 node-vibrant（MMCQ 量化）；跨域封面读不了像素会抛错，调用方回到默认配色
  const palette = await Vibrant.from(url)
    .maxColorCount(64)
    .quality(3)
    .getPalette();
  const accent = pickAccent([
    palette.Vibrant,
    palette.LightVibrant,
    palette.DarkVibrant,
  ]);
  return accent ? themeFromAccent(accent) : null;
}

/** 读取封面并推出配色。仅在浏览器里使用；取不到主色就返回 null，调用方回到默认配色。 */
export function loadCoverTheme(url: string): Promise<SpectraTheme | null> {
  if (!url) return Promise.resolve(null);
  const cached = cache.get(url);
  if (cached) return cached;
  const task = readTheme(url).catch(() => null);
  cache.set(url, task);
  return task;
}
