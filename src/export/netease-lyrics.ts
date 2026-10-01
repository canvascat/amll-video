import { fetchJson, providerSignal, stripNeteaseEscapes } from "../prepare/http";
import { mergeLrcTranslation, validateLyric } from "../prepare/lyric-quality";
import type { ResolvedLyric } from "../prepare/types";

type LyricBundle = {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
  yrc?: { lyric?: string };
  ytlrc?: { lyric?: string };
  pureMusic?: boolean;
  nolyric?: boolean;
};

export type NeteaseLyricTrack = {
  id: string;
  name: string;
  artist: string;
  album: string;
  durationInSeconds: number;
};

export type NeteaseLyricResult =
  | { kind: "lyric"; lyric: ResolvedLyric }
  /** 纯音乐，或网易云没有这首歌的歌词。 */
  | { kind: "none"; instrumental: boolean };

const NETEASE_HEADERS = { Referer: "https://music.163.com/" };

/**
 * 按网易云歌曲 ID 取歌词：优先逐字 YRC，没有再用整行 LRC（带翻译）。
 * 下载的音频就是这个 ID 的版本，所以不用按歌名搜索，也不会匹配到别的版本。
 */
export async function fetchNeteaseLyric(
  track: NeteaseLyricTrack,
  parentSignal?: AbortSignal,
): Promise<NeteaseLyricResult> {
  const signal = providerSignal(parentSignal);
  const candidate = {
    name: track.name,
    artist: track.artist,
    album: track.album,
    duration: Math.round(track.durationInSeconds * 1000),
    extra: { id: track.id },
  };

  const [bundle, yrcBody] = await Promise.all([
    fetchJson<LyricBundle>(
      `https://music.163.com/api/song/lyric?id=${track.id}&lv=-1&kv=-1&tv=-1&rv=-1`,
      { signal, headers: NETEASE_HEADERS },
    ).catch(() => null),
    fetchJson<LyricBundle>(
      `https://music.163.com/api/song/lyric/v1?id=${track.id}&yv=-1`,
      { signal, headers: NETEASE_HEADERS },
    ).catch(() => null),
  ]);

  if (bundle?.pureMusic || bundle?.nolyric) {
    return { kind: "none", instrumental: true };
  }

  const yrc = stripNeteaseEscapes(yrcBody?.yrc?.lyric?.trim() || "");
  if (yrc && validateLyric(yrc, "yrc")) {
    return {
      kind: "lyric",
      lyric: { source: "netease", format: "yrc", content: yrc, candidate },
    };
  }

  const lrc = stripNeteaseEscapes(bundle?.lrc?.lyric?.trim() || "");
  if (lrc) {
    const translation = stripNeteaseEscapes(
      yrcBody?.ytlrc?.lyric?.trim() || bundle?.tlyric?.lyric?.trim() || "",
    );
    const merged = mergeLrcTranslation(lrc, translation || undefined);
    if (validateLyric(merged, "lrc")) {
      return {
        kind: "lyric",
        lyric: { source: "netease", format: "lrc", content: merged, candidate },
      };
    }
  }

  return { kind: "none", instrumental: false };
}
