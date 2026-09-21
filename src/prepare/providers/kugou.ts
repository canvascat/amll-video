import { pickBestCandidate } from "../match";
import { fetchJson, providerSignal } from "../http";
import { validateLyric } from "../lyric-quality";
import type { LyricCandidate, ProviderLyric, TrackQuery } from "../types";

type SearchSong = {
  hash?: string;
  songname?: string;
  singername?: string;
  album_name?: string;
  album_id?: string;
  duration?: number;
};

type SearchResponse = {
  data?: { info?: SearchSong[] };
};

type LyricSearch = {
  candidates?: Array<{ id?: string; accesskey?: string }>;
};

type LyricDownload = {
  content?: string;
};

type AlbumInfo = {
  data?: { imgurl?: string };
};

function toCandidate(song: SearchSong): LyricCandidate | null {
  if (!song.hash || !song.songname) {
    return null;
  }
  return {
    name: song.songname,
    artist: song.singername ?? "",
    album: song.album_name,
    duration: song.duration ? song.duration * 1000 : undefined,
    extra: { hash: song.hash, albumId: song.album_id ?? "" },
  };
}

async function albumCover(
  albumId: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!albumId) {
    return undefined;
  }
  try {
    const body = await fetchJson<AlbumInfo>(
      `http://mobilecdn.kugou.com/api/v3/album/info?albumid=${encodeURIComponent(albumId)}`,
      { signal },
    );
    const template = body.data?.imgurl;
    if (!template) {
      return undefined;
    }
    return template.replace("{size}", "480").replace("http://", "https://");
  } catch {
    return undefined;
  }
}

export async function lookupKugou(
  query: TrackQuery,
  keyword: string,
  parentSignal?: AbortSignal,
): Promise<ProviderLyric | null> {
  const signal = providerSignal(parentSignal);
  try {
    const body = await fetchJson<SearchResponse>(
      `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=20&showtype=1`,
      { signal },
    );
    const candidates = (body.data?.info ?? [])
      .map(toCandidate)
      .filter((item): item is LyricCandidate => item !== null);
    const best = pickBestCandidate(candidates, query);
    const hash = best?.extra?.hash;
    if (!best || !hash) {
      return null;
    }

    const durationMs =
      best.duration && best.duration > 0
        ? Math.round(best.duration)
        : Math.round(query.durationMs ?? 0);
    const krcSearch = await fetchJson<LyricSearch>(
      `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=${encodeURIComponent(`${query.artist} - ${query.title}`)}&duration=${durationMs}&hash=${encodeURIComponent(hash)}`,
      { signal },
    );
    const hit = krcSearch.candidates?.[0];
    if (!hit?.id || !hit.accesskey) {
      return null;
    }

    const download = await fetchJson<LyricDownload>(
      `http://lyrics.kugou.com/download?ver=1&client=pc&id=${encodeURIComponent(hit.id)}&accesskey=${encodeURIComponent(hit.accesskey)}&fmt=lrc&charset=utf8`,
      { signal },
    );
    if (!download.content) {
      return null;
    }
    const lrc = Buffer.from(download.content, "base64").toString("utf8");
    if (!validateLyric(lrc, "lrc")) {
      return null;
    }
    return {
      source: "kugou",
      format: "lrc",
      content: lrc,
      candidate: best,
      coverUrl: await albumCover(best.extra?.albumId ?? "", signal),
    };
  } catch {
    return null;
  }
}
