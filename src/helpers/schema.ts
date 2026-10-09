import type { LyricLine } from "@applemusic-like-lyrics/core";
import { z } from "zod";

export const trackSchema = z.object({
  audioFileUrl: z.string(),
  lyricsFileUrl: z.string(),
  audioOffsetInSeconds: z.number().min(0),
  audioEndInSeconds: z.number().positive().optional(),
  coverImageUrl: z.string().optional(),
  songName: z.string().optional(),
  artistName: z.string().optional(),
  albumName: z.string().optional(),
  durationInSeconds: z.number().optional(),
  lyricOffsetMs: z.number().optional(),
  lyricLines: z.array(z.any()).optional(),
  backgroundMotion: z.enum(["slow", "static", "normal"]).optional(),
});

export const playerCompositionSchema = trackSchema;

export const spectraAudioInfoSchema = z.object({
  sampleRate: z.number().optional(),
  bitDepth: z.number().optional(),
  channels: z.number().optional(),
  format: z.string().optional(),
  bitrateKbps: z.number().optional(),
  fileSizeBytes: z.number().optional(),
  peaks: z.array(z.number()).optional(),
});

export const spectraThemeSchema = z.object({
  paper: z.string(),
  ink: z.string(),
  inkSoft: z.string(),
  accent: z.string(),
  bar: z.string(),
  trace: z.string(),
  translation: z.string(),
  unplayed: z.string(),
});

/** SpectraPlayer：单曲，外加界面上展示的年份 / 曲序 / 流派 / BPM 和音频技术参数。 */
export const spectraCompositionSchema = trackSchema.extend({
  year: z.number().optional(),
  trackNumber: z.number().optional(),
  genre: z.string().optional(),
  bpm: z.number().optional(),
  composer: z.string().optional(),
  audioInfo: spectraAudioInfoSchema.optional(),
  /** 界面配色。不填时按封面自动生成；填了就用填的。 */
  theme: spectraThemeSchema.optional(),
  /** 设为 false 时不从封面取色，固定用默认的米色 + 橙色。 */
  themeFromCover: z.boolean().optional(),
});

export const albumTrackSchema = z.object({
  songName: z.string().optional(),
  audioOffsetInSeconds: z.number().min(0),
  audioEndInSeconds: z.number().positive().optional(),
});

export const albumCompositionSchema = z.object({
  audioFileUrl: z.string(),
  coverImageUrl: z.string().optional(),
  artistName: z.string().optional(),
  albumName: z.string().optional(),
  tracks: z.array(albumTrackSchema).min(1),
  cueStills: z.boolean().optional(),
});

export type TrackProps = Omit<z.infer<typeof trackSchema>, "lyricLines"> & {
  lyricLines?: LyricLine[];
};

export type PlayerCompositionProps = TrackProps;

export type SpectraCompositionProps = Omit<
  z.infer<typeof spectraCompositionSchema>,
  "lyricLines"
> & {
  lyricLines?: LyricLine[];
};

export type AlbumTrackProps = z.infer<typeof albumTrackSchema>;

export type AlbumCompositionProps = {
  audioFileUrl: string;
  coverImageUrl?: string;
  artistName?: string;
  albumName?: string;
  tracks: AlbumTrackProps[];
  cueStills?: boolean;
};

export const playlistCompositionSchema = z.object({
  tracks: z.array(trackSchema).min(1),
});

export type PlaylistCompositionProps = {
  tracks: TrackProps[];
};
