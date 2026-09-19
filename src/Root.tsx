import type { FC } from "react";
import "./index.css";
import "@applemusic-like-lyrics/core/style.css";
import { Composition, staticFile } from "remotion";
import { calculatePlayerMetadata } from "./helpers/calculate-metadata";
import { playerCompositionSchema } from "./helpers/schema";
import { Player } from "./Player/Main";

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="AMLLPlayer"
        component={Player}
        width={1920}
        height={1080}
        fps={30}
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
