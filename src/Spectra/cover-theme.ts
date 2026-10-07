import { deriveTheme, type SpectraTheme } from "./palette";

const SAMPLE_SIZE = 64;
const cache = new Map<string, Promise<SpectraTheme | null>>();

async function readTheme(url: string): Promise<SpectraTheme | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  // 跨域封面会让画布被污染，读像素会抛错，这时放弃取色
  return deriveTheme(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
}

/** 读取封面并推出配色。仅在浏览器里使用；封面读不了就返回 null，调用方回到默认配色。 */
export function loadCoverTheme(url: string): Promise<SpectraTheme | null> {
  if (!url) return Promise.resolve(null);
  const cached = cache.get(url);
  if (cached) return cached;
  const task = readTheme(url).catch(() => null);
  cache.set(url, task);
  return task;
}
