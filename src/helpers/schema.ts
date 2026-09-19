import type { LyricLine } from "@applemusic-like-lyrics/core";
import { z } from "zod";

export const playerCompositionSchema = z.object({
  audioFileUrl: z.string(),
  lyricsFileUrl: z.string(),
  audioOffsetInSeconds: z.number().min(0),
  coverImageUrl: z.string().optional(),
  songName: z.string().optional(),
  artistName: z.string().optional(),
  albumName: z.string().optional(),
  lyricLines: z.array(z.any()).optional(),
});

export type PlayerCompositionProps = Omit<
  z.infer<typeof playerCompositionSchema>,
  "lyricLines"
> & {
  lyricLines?: LyricLine[];
};
