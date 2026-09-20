import type { FC } from "react";
import "./index.css";
import "@applemusic-like-lyrics/core/style.css";
import { Composition } from "remotion";
import { calculatePlayerMetadata } from "./helpers/calculate-metadata";
import { defaultPlayerProps } from "./helpers/default-props";
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
        defaultProps={defaultPlayerProps}
        calculateMetadata={calculatePlayerMetadata}
      />
    </>
  );
};
