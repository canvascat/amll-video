import { fetchText, providerSignal } from "../http";
import { validateLyric } from "../lyric-quality";
import type { ProviderLyric } from "../types";

const AMLL_TEMPLATE = "https://amlldb.bikonoo.com/%p/%s.ttml";

async function fetchOne(
  platformPath: string,
  id: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!id) {
    return null;
  }
  const url = AMLL_TEMPLATE.replace("%p", platformPath).replace(
    "%s",
    encodeURIComponent(id),
  );
  try {
    const content = await fetchText(url, { signal });
    if (!content.trim()) {
      return null;
    }
    return validateLyric(content, "ttml") ? content : null;
  } catch {
    return null;
  }
}

export async function overlayAmlTtml(
  hit: ProviderLyric,
  parentSignal?: AbortSignal,
): Promise<ProviderLyric | null> {
  const signal = providerSignal(parentSignal);
  const ids: Array<{ path: string; id: string }> = [];
  if (hit.source === "netease" && hit.candidate.extra?.id) {
    ids.push({ path: "ncm-lyrics", id: hit.candidate.extra.id });
  }
  if (hit.source === "qqmusic") {
    const mid = hit.candidate.extra?.mid;
    const id = hit.candidate.extra?.id;
    if (mid) {
      ids.push({ path: "qq-lyrics", id: mid });
    }
    if (id && id !== mid) {
      ids.push({ path: "qq-lyrics", id });
    }
  }
  for (const item of ids) {
    const content = await fetchOne(item.path, item.id, signal);
    if (content) {
      return {
        ...hit,
        source: "amll-ttml",
        format: "ttml",
        content,
      };
    }
  }
  return null;
}
