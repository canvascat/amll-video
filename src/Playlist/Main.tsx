import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { resolvePublicAsset } from "../helpers/public-asset";
import type { PlaylistCompositionProps } from "../helpers/schema";
import { layoutPlaylistLyric, lyricLineAt } from "./lattice/lyrics";
import { playlistMotionAt } from "./lattice/motion";
import { playlistTrackSpans } from "./lattice/timeline";
import { buildPlaylistTiles } from "./lattice/tiles";
import { PlaylistPoster } from "./Poster";

const measure = (text: string, font: string) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 32);
  return { width: text.length * size, height: size };
};

export const PlaylistPlayer: React.FC<PlaylistCompositionProps> = ({ tracks }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const spans = playlistTrackSpans(tracks, fps);
  const motion = playlistMotionAt(frame, fps, spans);
  const tiles = buildPlaylistTiles(tracks);
  return (
    <AbsoluteFill style={{ backgroundColor: "#070707", overflow: "hidden" }}>
      {spans.map((span) => {
        const track = tracks[span.index];
        if (!track) return null;
        const audioOffsetInFrames = Math.round(track.audioOffsetInSeconds * fps);
        return (
          <Sequence key={span.index} from={span.startFrame} durationInFrames={span.durationInFrames} showPosterWhenEnded={false}>
            {isRendering ? null : (
              <Sequence from={-audioOffsetInFrames}>
                <Audio src={resolvePublicAsset(track.audioFileUrl)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: motion.camera.x,
          top: motion.camera.y,
          transform: `scale(${motion.camera.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {motion.posters.map((poster) => {
          const tile = tiles[poster.queueIndex];
          const track = tracks[poster.queueIndex];
          const showLyrics = poster.active && motion.lyricsVisible;
          const timeMs = motion.localSeconds * 1000;
          const line = showLyrics ? lyricLineAt(track?.lyricLines ?? [], timeMs) : null;
          const lyrics = showLyrics
            ? layoutPlaylistLyric({
                line,
                timeMs,
                width: poster.width,
                height: poster.height,
                measure,
              })
            : [];
          return (
            <div
              key={poster.instanceId}
              style={{
                position: "absolute",
                left: poster.x,
                top: poster.y,
                width: poster.width,
                height: poster.height,
                zIndex: poster.active ? 2 : 1,
              }}
            >
              <PlaylistPoster
                coverUrl={resolvePublicAsset(tile?.coverUrl)}
                title={tile?.title ?? ""}
                artist={tile?.artist ?? ""}
                queueIndex={poster.queueIndex}
                current={poster.queueIndex === motion.activeQueueIndex}
                expanded={poster.active}
                lyrics={lyrics}
                showLyrics={showLyrics}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 78%, rgba(0, 0, 0, 0.52) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
