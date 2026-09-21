import { pickBestCandidate } from "../match";
import {
  fetchJson,
  LRCLIB_USER_AGENT,
  providerSignal,
} from "../http";
import { validateLyric } from "../lyric-quality";
import type { LyricCandidate, ProviderLyric, TrackQuery } from "../types";

type LrcLibItem = {
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  syncedLyrics?: string;
};

const LRCLIB_HEADERS = {
  "User-Agent": LRCLIB_USER_AGENT,
};

function toCandidate(item: LrcLibItem): LyricCandidate {
  return {
    name: item.trackName ?? "",
    artist: item.artistName ?? "",
    album: item.albumName,
    duration: item.duration ? item.duration * 1000 : undefined,
  };
}

function usable(item: LrcLibItem): ProviderLyric | null {
  if (item.instrumental) {
    return null;
  }
  const synced = item.syncedLyrics?.trim();
  if (!synced || !validateLyric(synced, "lrc")) {
    return null;
  }
  return {
    source: "lrclib",
    format: "lrc",
    content: synced,
    candidate: toCandidate(item),
  };
}

async function getExact(
  query: TrackQuery,
  includeAlbum: boolean,
  signal?: AbortSignal,
): Promise<ProviderLyric | null> {
  try {
    const params = new URLSearchParams({
      artist_name: query.artist,
      track_name: query.title,
    });
    if (includeAlbum && query.album) {
      params.set("album_name", query.album);
    }
    const item = await fetchJson<LrcLibItem>(
      `https://lrclib.net/api/get?${params.toString()}`,
      { signal, headers: LRCLIB_HEADERS },
    );
    return usable(item);
  } catch {
    return null;
  }
}

async function searchFuzzy(
  query: TrackQuery,
  signal?: AbortSignal,
): Promise<ProviderLyric | null> {
  let items: LrcLibItem[];
  try {
    const params = new URLSearchParams({
      artist_name: query.artist,
      track_name: query.title,
    });
    items = await fetchJson<LrcLibItem[]>(
      `https://lrclib.net/api/search?${params.toString()}`,
      { signal, headers: LRCLIB_HEADERS, array: true },
    );
  } catch {
    return null;
  }
  if (!Array.isArray(items)) {
    return null;
  }
  const candidates = items
    .filter((item) => item.syncedLyrics?.trim() && !item.instrumental)
    .map(toCandidate);
  const best = pickBestCandidate(candidates, query);
  if (!best) {
    return null;
  }
  const matched = items.find((item) => {
    const candidate = toCandidate(item);
    return (
      candidate.name === best.name &&
      candidate.artist === best.artist &&
      candidate.album === best.album &&
      candidate.duration === best.duration
    );
  });
  return matched ? usable(matched) : null;
}

export async function lookupLrclib(
  query: TrackQuery,
  _keyword: string,
  parentSignal?: AbortSignal,
): Promise<ProviderLyric | null> {
  const signal = providerSignal(parentSignal);
  try {
    const exact = await getExact(query, true, signal);
    if (exact) {
      return exact;
    }
    if (query.album) {
      const withoutAlbum = await getExact(query, false, signal);
      if (withoutAlbum) {
        return withoutAlbum;
      }
    }
    return await searchFuzzy(query, signal);
  } catch {
    return null;
  }
}
