import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolvePublicAsset } from "../helpers/public-asset";
import type { AlbumCompositionProps } from "../helpers/schema";
import { trackIndexAtAudioSeconds } from "../helpers/track-duration";
import { Cover } from "../Player/Cover";
import { playerFontFamily } from "../Player/font";
import { MusicInfo } from "../Player/MusicInfo";
import { BlurredCoverBackground } from "./BlurredCoverBackground";

export const AlbumPlayer: React.FC<AlbumCompositionProps> = ({
  tracks = [],
  cueStills = false,
}) => {
  const { fps } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const frame = useCurrentFrame();
  const album = tracks[0];
  const audioOffsetInSeconds = album?.audioOffsetInSeconds ?? 0;
  const cueIndex = cueStills
    ? Math.min(Math.max(frame, 0), Math.max(tracks.length - 1, 0))
    : trackIndexAtAudioSeconds(
        tracks,
        audioOffsetInSeconds + frame / fps,
      );
  const current = tracks[cueIndex] ?? album;
  const coverSrc = resolvePublicAsset(album?.coverImageUrl);
  const audioSrc = resolvePublicAsset(album?.audioFileUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: "#111", fontWeight: "bold" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <BlurredCoverBackground coverUrl={coverSrc} />
        <div
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to bottom, transparent 60%, rgb(0 0 0 / 0.1))",
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          width: "100%",
          height: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: playerFontFamily,
          color: "white",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(56vh, 42vw)",
            height: "min(56vh, 42vw)",
          }}
        >
          <Cover coverUrl={coverSrc} />
        </div>
        <MusicInfo
          style={{
            marginTop: "1.75em",
            width: "min(56vh, 42vw)",
            textAlign: "center",
          }}
          songName={current?.songName ?? ""}
          artistName={album?.artistName ?? ""}
          albumName={album?.albumName ?? ""}
        />
      </div>
      {audioSrc && !isRendering && !cueStills ? (
        <Audio
          src={audioSrc}
          trimBefore={Math.round(audioOffsetInSeconds * fps)}
        />
      ) : null}
    </AbsoluteFill>
  );
};
