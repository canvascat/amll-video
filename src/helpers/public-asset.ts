import { staticFile } from "remotion";

export function resolvePublicAsset(src: string | undefined): string {
  if (!src || src.trim() === "") {
    return "";
  }
  if (/^(https?:|data:|blob:|\/)/i.test(src)) {
    return src;
  }
  return staticFile(src);
}
