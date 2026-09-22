import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolvePublicAsset } from "../helpers/public-asset";
import type { PlayerCompositionProps } from "../helpers/schema";
import { trackIndexAtAudioSeconds } from "../helpers/track-duration";
import { Cover } from "../Player/Cover";
import { MusicInfo } from "../Player/MusicInfo";
import { BlurredCoverBackground } from "./BlurredCoverBackground";

export const AlbumPlayer: React.FC<PlayerCompositionProps> = ({
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
    <AbsoluteFill className="bg-[#111] font-bold">
      <div className="absolute inset-0 z-0">
        <BlurredCoverBackground coverUrl={coverSrc} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-60% to-black/10" />
      </div>
      <div className="relative z-[1] flex size-full flex-col items-center justify-center font-player text-white">
        <div className="relative size-[min(56vh,42vw)]">
          <Cover coverUrl={coverSrc} />
        </div>
        <MusicInfo
          className="mt-[1.75em] w-[min(56vh,42vw)] text-center"
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
