import { Audio } from "@remotion/media";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Sequence, useDelayRender, useVideoConfig } from "remotion";
import { resolvePublicAsset } from "../helpers/public-asset";
import type { TrackProps } from "../helpers/schema";
import { PlayerBackground } from "./Background";
import { Cover } from "./Cover";
import { Lyrics } from "./Lyrics";
import { MusicInfo } from "./MusicInfo";

export const SongPlayer: React.FC<TrackProps> = ({
  audioFileUrl,
  coverImageUrl = "",
  songName = "",
  artistName = "",
  albumName = "",
  lyricLines = [],
  audioOffsetInSeconds,
}) => {
  const { fps } = useVideoConfig();
  const audioSrc = resolvePublicAsset(audioFileUrl);
  const coverSrc = resolvePublicAsset(coverImageUrl);
  const audioOffsetInFrames = Math.round(audioOffsetInSeconds * fps);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("amll-player-ready"));
  const coverRef = useRef<HTMLDivElement>(null);
  const lyricRef = useRef<HTMLDivElement>(null);
  const [alignPosition, setAlignPosition] = useState(0.5);

  useLayoutEffect(() => {
    const coverEl = coverRef.current;
    const lyricEl = lyricRef.current;
    if (!coverEl || !lyricEl) {
      return;
    }

    const update = () => {
      const coverBox = coverEl.getBoundingClientRect();
      const lyricBox = lyricEl.getBoundingClientRect();
      if (lyricBox.height === 0) {
        return;
      }
      setAlignPosition(
        (coverBox.top + coverBox.height / 2 - lyricBox.top) / lyricBox.height,
      );
    };

    const observer = new ResizeObserver(update);
    observer.observe(coverEl);
    observer.observe(lyricEl);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => {
        if (!cancelled) {
          continueRender(handle);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerId);
      cancelAnimationFrame(innerId);
    };
  }, [continueRender, handle]);

  return (
    <AbsoluteFill className="bg-[#111]">
      <Sequence from={-audioOffsetInFrames}>
        <div className="relative size-full font-player text-white">
          <div className="absolute inset-0 z-0">
            <PlayerBackground
              audioSrc={audioSrc}
              coverUrl={coverSrc}
              hasLyric={lyricLines.length > 0}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-60% to-black/10" />
          </div>
          <div className="relative z-[1] grid size-full grid-cols-[0.45fr_0.55fr] gap-2">
            <div className="flex min-w-0 flex-col items-center justify-center mix-blend-plus-lighter">
              <div ref={coverRef} className="relative size-[min(50vh,38vw)]">
                <Cover coverUrl={coverSrc} />
              </div>
              <MusicInfo
                className="mt-[1.75em] w-[min(50vh,38vw)]"
                songName={songName}
                artistName={artistName}
                albumName={albumName}
              />
            </div>
            <div
              ref={lyricRef}
              className="box-border size-full contain-paint pr-[15%] mix-blend-plus-lighter [mask-image:linear-gradient(transparent,black_10%,black_90%,transparent)]"
            >
              <Lyrics lyricLines={lyricLines} alignPosition={alignPosition} />
            </div>
          </div>
        </div>
        <Audio src={audioSrc} />
      </Sequence>
    </AbsoluteFill>
  );
};
