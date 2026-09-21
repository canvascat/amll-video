import { pickBestCandidate } from "../match";
import { fetchJson, providerSignal } from "../http";
import type { ItunesHit, LyricCandidate, TrackQuery } from "../types";

type ItunesSong = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
};

type ItunesResponse = {
  results?: ItunesSong[];
};

function artworkUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace(/100x100/g, "600x600");
}

function toCandidate(song: ItunesSong): LyricCandidate | null {
  if (!song.trackName) {
    return null;
  }
  return {
    name: song.trackName,
    artist: song.artistName ?? "",
    album: song.collectionName,
    duration: song.trackTimeMillis,
    extra: { cover: artworkUrl(song.artworkUrl100) ?? "" },
  };
}

async function searchStore(
  keyword: string,
  country: string | undefined,
  signal?: AbortSignal,
): Promise<LyricCandidate[]> {
  try {
    const params = new URLSearchParams({
      term: keyword,
      entity: "song",
      limit: "10",
    });
    if (country) {
      params.set("country", country);
    }
    const body = await fetchJson<ItunesResponse>(
      `https://itunes.apple.com/search?${params.toString()}`,
      { signal },
    );
    return (body.results ?? [])
      .map(toCandidate)
      .filter((item): item is LyricCandidate => item !== null);
  } catch {
    return [];
  }
}

function dedupe(candidates: LyricCandidate[]): LyricCandidate[] {
  const seen = new Set<string>();
  const out: LyricCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.name}\0${candidate.artist}\0${candidate.album ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

export async function lookupItunes(
  query: TrackQuery,
  keyword: string,
  parentSignal?: AbortSignal,
): Promise<ItunesHit | null> {
  const signal = providerSignal(parentSignal);
  try {
    const lists = await Promise.all([
      searchStore(keyword, undefined, signal),
      searchStore(keyword, "hk", signal),
      searchStore(keyword, "jp", signal),
    ]);
    const candidates = dedupe(lists.flat());
    const best =
      pickBestCandidate(candidates, query) ??
      pickBestCandidate(candidates, { ...query, artist: "" });
    if (!best) {
      return null;
    }
    return {
      candidate: best,
      coverUrl: best.extra?.cover || undefined,
    };
  } catch {
    return null;
  }
}
