import { staticFile } from "remotion";
import type { PlayerCompositionProps } from "./schema";

export const defaultPlayerProps: PlayerCompositionProps = {
  tracks: [
    {
      audioOffsetInSeconds: 0,
      audioFileUrl: staticFile("OneLastKiss.flac"),
      lyricsFileUrl: staticFile("OneLastKiss.ttml"),
    },
    {
      audioOffsetInSeconds: 0,
      audioFileUrl: staticFile("周杰伦 - 半岛铁盒.flac"),
      lyricsFileUrl: staticFile("周杰伦 - 半岛铁盒.ttml"),
    },
  ],
};
