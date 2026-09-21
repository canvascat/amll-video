import type { LyricFormat } from "../helpers/lyrics";

export type LyricSource =
  | "netease"
  | "qqmusic"
  | "kugou"
  | "lrclib"
  | "embedded"
  | "amll-ttml";

export type CoverSource =
  | "embedded"
  | "netease"
  | "qqmusic"
  | "kugou"
  | "itunes";

export type TrackQuery = {
  title: string;
  artist: string;
  album: string;
  durationMs?: number;
};

export type LyricCandidate = {
  name: string;
  artist: string;
  album?: string;
  /** 毫秒 */
  duration?: number;
  extra?: Record<string, string>;
};

export type ProviderLyric = {
  source: LyricSource;
  format: LyricFormat;
  content: string;
  candidate: LyricCandidate;
  coverUrl?: string;
};

export type ItunesHit = {
  candidate: LyricCandidate;
  coverUrl?: string;
};

export type LocalTags = {
  title: string;
  artist: string;
  album: string;
  durationInSeconds: number;
  cover?: {
    data: Uint8Array;
    mimeType: string;
  };
  embeddedLyric?: {
    format: Extract<LyricFormat, "lrc">;
    content: string;
  };
};

export type ResolvedLyric = {
  source: LyricSource;
  format: LyricFormat;
  content: string;
  candidate: LyricCandidate;
};

export type ResolvedCover = {
  source: CoverSource;
  data: Uint8Array;
  mimeType: string;
};

export type LookupResult = {
  query: TrackQuery;
  durationInSeconds: number;
  songName: string;
  artistName: string;
  albumName: string;
  lyric?: ResolvedLyric;
  cover?: ResolvedCover;
};

export type PreparedTrack = {
  audioFileUrl: string;
  lyricsFileUrl: string;
  coverImageUrl: string;
  audioOffsetInSeconds: number;
  audioEndInSeconds?: number;
  songName: string;
  artistName: string;
  albumName: string;
  durationInSeconds: number;
  match: {
    lyricSource?: LyricSource;
    lyricFormat?: LyricFormat;
    coverSource?: CoverSource;
  };
};

export type PreparedAlbum = {
  albumName: string;
  artistName: string;
  audioFileUrl: string;
  coverImageUrl: string;
  tracks: PreparedTrack[];
};
