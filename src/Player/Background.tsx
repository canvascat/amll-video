import {
  BackgroundRender,
  MeshGradientRenderer,
} from "@applemusic-like-lyrics/react";
import type { FC } from "react";
import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import { useCurrentFrame, useVideoConfig } from "remotion";

export const PlayerBackground: FC<{
  audioSrc: string;
  coverUrl: string;
  hasLyric: boolean;
}> = ({ audioSrc, coverUrl, hasLyric }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src: audioSrc,
    frame,
    fps,
    windowInSeconds: 30,
  });

  let lowFreqVolume = 1;
  if (audioData) {
    const bins = visualizeAudio({
      fps,
      frame,
      audioData,
      numberOfSamples: 32,
      optimizeFor: "speed",
      dataOffsetInSeconds,
    });
    const bass = bins.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4;
    lowFreqVolume = Math.min(1, bass * 3);
  }

  return (
    <BackgroundRender
      album={coverUrl || undefined}
      lowFreqVolume={lowFreqVolume}
      renderScale={1}
      fps={fps}
      renderer={MeshGradientRenderer}
      staticMode={false}
      playing
      hasLyric={hasLyric}
      className="size-full"
    />
  );
};
