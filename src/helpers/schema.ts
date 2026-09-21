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
});

export const playerCompositionSchema = z.object({
  tracks: z.array(trackSchema).min(1),
});

export type TrackProps = Omit<z.infer<typeof trackSchema>, "lyricLines"> & {
  lyricLines?: LyricLine[];
};

export type PlayerCompositionProps = {
  tracks: TrackProps[];
};
