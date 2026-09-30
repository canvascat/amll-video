import type { FC } from "react";
import "@applemusic-like-lyrics/core/style.css";
import { Composition } from "remotion";
import { AlbumPlayer } from "./Album/Main";
import { PlaylistPlayer } from "./Playlist/Main";
import {
  calculateAlbumMetadata,
  calculatePlayerMetadata,
  calculatePlaylistMetadata,
} from "./helpers/calculate-metadata";
import { defaultAlbumProps, defaultPlayerProps, defaultPlaylistProps } from "./helpers/default-props";
import {
  albumCompositionSchema,
  playerCompositionSchema,
  playlistCompositionSchema,
} from "./helpers/schema";
import { Player } from "./Player/Main";
import {
  ALBUM_COMPOSITION_ID,
  COMPOSITION_ID,
  PLAYLIST_COMPOSITION_ID,
  DEFAULT_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./remotion/constants";

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={Player}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={DEFAULT_FPS}
        durationInFrames={300}
        schema={playerCompositionSchema}
        defaultProps={defaultPlayerProps}
        calculateMetadata={calculatePlayerMetadata}
      />
      <Composition
        id={ALBUM_COMPOSITION_ID}
        component={AlbumPlayer}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={DEFAULT_FPS}
        durationInFrames={300}
        schema={albumCompositionSchema}
        defaultProps={defaultAlbumProps}
        calculateMetadata={calculateAlbumMetadata}
      />
      <Composition
        id={PLAYLIST_COMPOSITION_ID}
        component={PlaylistPlayer}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={DEFAULT_FPS}
        durationInFrames={300}
        schema={playlistCompositionSchema}
        defaultProps={defaultPlaylistProps}
        calculateMetadata={calculatePlaylistMetadata}
      />
    </>
  );
};
