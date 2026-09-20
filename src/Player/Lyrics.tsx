import type { LyricLine } from "@applemusic-like-lyrics/core";
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import type { FC } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { cn } from "../lib/utils";

export const Lyrics: FC<{
  lyricLines: LyricLine[];
  alignPosition: number;
  className?: string;
}> = ({ lyricLines, alignPosition, className }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = Math.floor((frame / fps) * 1000);

  return (
    <LyricPlayer
      className={cn(
        "size-full [--amll-lp-font-size:max(max(5vh,2.5vw),14px)]",
        className,
      )}
      playing
      disabled={false}
      alignPosition={alignPosition}
      alignAnchor="center"
      currentTime={currentTimeMs}
      isSeeking
      lyricLines={lyricLines}
      enableBlur
      enableScale
      enableSpring
    />
  );
};
