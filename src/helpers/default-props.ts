import { staticFile } from "remotion";
import prepared from "../../public/OneLastKiss.json";
import type { PlayerCompositionProps } from "./schema";

export const defaultPlayerProps: PlayerCompositionProps = {
  tracks: [
    {
      audioOffsetInSeconds: prepared.audioOffsetInSeconds,
      audioFileUrl: staticFile(prepared.audioFileUrl),
      lyricsFileUrl: staticFile(prepared.lyricsFileUrl),
      coverImageUrl: prepared.coverImageUrl
        ? staticFile(prepared.coverImageUrl)
        : undefined,
      songName: prepared.songName,
      artistName: prepared.artistName,
      albumName: prepared.albumName,
      durationInSeconds: prepared.durationInSeconds,
    },
  ],
};
