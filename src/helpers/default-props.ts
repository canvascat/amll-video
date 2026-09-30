import { staticFile } from "remotion";
import oneLastKiss from "../../public/OneLastKiss.json";
import tiehe from "../../public/周杰伦 - 半岛铁盒.json";
import miaoxiao from "../../public/渺小-田馥甄.json";
import type { AlbumCompositionProps, PlayerCompositionProps, PlaylistCompositionProps } from "./schema";

type PreparedSong = {
  audioFileUrl: string;
  lyricsFileUrl: string;
  coverImageUrl?: string;
  audioOffsetInSeconds: number;
  songName: string;
  artistName: string;
  albumName: string;
  durationInSeconds: number;
  lyricOffsetMs?: number;
};

function trackFromPrepared(prepared: PreparedSong): PlayerCompositionProps {
  return {
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
    lyricOffsetMs: prepared.lyricOffsetMs,
  };
}

const defaultTrack: PlayerCompositionProps = {
  ...trackFromPrepared(oneLastKiss),
  backgroundMotion: "slow",
};

export const defaultPlaylistProps: PlaylistCompositionProps = {
  tracks: [
    trackFromPrepared(oneLastKiss),
    trackFromPrepared(miaoxiao),
    trackFromPrepared(tiehe),
  ],
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
      audioEndInSeconds: oneLastKiss.durationInSeconds,
    },
  ],
};
