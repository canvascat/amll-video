import { AbsoluteFill } from "remotion";
import type { PlayerCompositionProps } from "../helpers/schema";
import { SongPlayer } from "./Song";

export const Player: React.FC<PlayerCompositionProps> = (track) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "black",
        fontWeight: "bold",
      }}
    >
      <SongPlayer {...track} />
    </AbsoluteFill>
  );
};
