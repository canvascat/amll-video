import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import type { PlayerCompositionProps } from "../helpers/schema";
import { trackDurationInFrames } from "../helpers/track-duration";
import { SongPlayer } from "./Song";

export const Player: React.FC<PlayerCompositionProps> = ({ tracks = [] }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill className="bg-[#111]">
      <Series>
        {tracks.map((track, index) => (
          <Series.Sequence
            key={`${track.audioFileUrl}-${index}`}
            durationInFrames={trackDurationInFrames(
              track.durationInSeconds ?? 0,
              track.audioOffsetInSeconds,
              fps,
              track.audioEndInSeconds,
            )}
            name={track.songName || `Track ${index + 1}`}
          >
            <SongPlayer {...track} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
