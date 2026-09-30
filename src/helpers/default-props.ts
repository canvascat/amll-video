import { staticFile } from "remotion";
import prepared from "../../public/OneLastKiss.json";
import type { AlbumCompositionProps, PlayerCompositionProps, PlaylistCompositionProps } from "./schema";

const defaultTrack: PlayerCompositionProps = {
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
  backgroundMotion: "slow",
};

export const defaultPlaylistProps: PlaylistCompositionProps = {
  tracks: [defaultTrack, defaultTrack],
};

export const defaultPlayerProps: PlayerCompositionProps = defaultTrack;

export const defaultAlbumProps: AlbumCompositionProps = {
  audioFileUrl: defaultTrack.audioFileUrl,
  coverImageUrl: defaultTrack.coverImageUrl,
  artistName: defaultTrack.artistName,
  albumName: defaultTrack.albumName,
  tracks: [
    {
      songName: defaultTrack.songName,
      audioOffsetInSeconds: defaultTrack.audioOffsetInSeconds,
      audioEndInSeconds: prepared.durationInSeconds,
    },
  ],
};
