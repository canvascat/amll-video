import type { LyricLine } from "@applemusic-like-lyrics/core";
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import type { CSSProperties, FC } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

const LYRIC_FONT_SIZE = "max(max(5vh, 2.5vw), 14px)";

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
      className={`size-full ${className ?? ""}`}
      style={
        {
          "--amll-lp-font-size": LYRIC_FONT_SIZE,
        } as CSSProperties
      }
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
