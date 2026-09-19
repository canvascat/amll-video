import type { FC } from "react";
import "./index.css";
import "@applemusic-like-lyrics/core/style.css";
import { Composition, staticFile } from "remotion";
import { calculatePlayerMetadata } from "./helpers/calculate-metadata";
import { playerCompositionSchema } from "./helpers/schema";
import { Player } from "./Player/Main";
import {
  COMPOSITION_ID,
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
        defaultProps={{
          audioOffsetInSeconds: 0,
          audioFileUrl: staticFile("OneLastKiss.flac"),
          lyricsFileUrl: staticFile("OneLastKiss.ttml"),
        }}
        calculateMetadata={calculatePlayerMetadata}
      />
    </>
  );
};
