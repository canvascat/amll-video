import { pickBestCandidate } from "../match";
import {
  decodeHtmlEntities,
  fetchJson,
  providerSignal,
} from "../http";
import { mergeLrcTranslation, validateLyric } from "../lyric-quality";
import type { LyricCandidate, ProviderLyric, TrackQuery } from "../types";

type SearchSong = {
  mid?: string;
  id?: number;
  title?: string;
  interval?: number;
  singer?: Array<{ name?: string }>;
  album?: { name?: string; title?: string; mid?: string; pmid?: string };
};

type SearchResponse = {
  code?: number;
  data?: {
    song?: { list?: SearchSong[] };
  };
};

type LyricResponse = {
  lyric?: string;
  trans?: string;
};

const QQ_HEADERS = {
  Referer: "https://y.qq.com/",
};

function singerNames(song: SearchSong): string {
  return (song.singer ?? [])
    .map((singer) => singer.name?.trim())
    .filter(Boolean)
    .join("/");
}

function albumMid(song: SearchSong): string {
  return song.album?.mid || song.album?.pmid || "";
}

function coverUrl(mid: string): string | undefined {
  if (!mid) {
    return undefined;
  }
  return `https://y.gtimg.cn/music/photo_new/T002R800x800M000${mid}.jpg`;
}

function toCandidate(song: SearchSong): LyricCandidate | null {
  if (!song.mid || !song.title) {
    return null;
  }
  return {
    name: song.title,
    artist: singerNames(song),
    album: song.album?.name || song.album?.title,
    duration: (song.interval ?? 0) * 1000 || undefined,
    extra: {
      mid: song.mid,
      id: song.id ? String(song.id) : "",
      albumMid: albumMid(song),
    },
  };
}

export async function lookupQqMusic(
  query: TrackQuery,
  keyword: string,
  parentSignal?: AbortSignal,
): Promise<ProviderLyric | null> {
  const signal = providerSignal(parentSignal);
  try {
    const params = new URLSearchParams({
      format: "json",
      new_json: "1",
      t: "0",
      aggr: "1",
      cr: "1",
      p: "1",
      n: "20",
      w: keyword,
    });
    const body = await fetchJson<SearchResponse>(
      `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?${params.toString()}`,
      { signal, headers: QQ_HEADERS },
    );
    const candidates = (body.data?.song?.list ?? [])
      .map(toCandidate)
      .filter((item): item is LyricCandidate => item !== null);
    const best = pickBestCandidate(candidates, query);
    const mid = best?.extra?.mid;
    if (!best || !mid) {
      return null;
    }

    const lyricParams = new URLSearchParams({
      format: "json",
      nobase64: "1",
      g_tk: "5381",
      songmid: mid,
    });
    const lyric = await fetchJson<LyricResponse>(
      `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${lyricParams.toString()}`,
      { signal, headers: QQ_HEADERS },
    );
    const lrc = decodeHtmlEntities(lyric.lyric?.trim() || "");
    const translation = decodeHtmlEntities(lyric.trans?.trim() || "");
    if (!lrc) {
      return null;
    }
    const merged = mergeLrcTranslation(lrc, translation || undefined);
    if (!validateLyric(merged, "lrc")) {
      return null;
    }
    return {
      source: "qqmusic",
      format: "lrc",
      content: merged,
      candidate: best,
      coverUrl: coverUrl(best.extra?.albumMid || ""),
    };
  } catch {
    return null;
  }
}
