import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import type { CalculateMetadataFunction } from "remotion";
import { DEFAULT_FPS } from "../remotion/constants";
import { loadLyricLines } from "./lyrics";
import type { PlayerCompositionProps, TrackProps } from "./schema";
import { trackDurationInFrames } from "./track-duration";

type LegacyPlayerProps = PlayerCompositionProps & Partial<TrackProps>;

function inputTracks(props: PlayerCompositionProps): TrackProps[] {
  if (Array.isArray(props.tracks)) {
    return props.tracks;
  }
  const legacy = props as LegacyPlayerProps;
  if (legacy.audioFileUrl) {
    return [
      {
        audioFileUrl: legacy.audioFileUrl,
        lyricsFileUrl: legacy.lyricsFileUrl ?? "",
        audioOffsetInSeconds: legacy.audioOffsetInSeconds ?? 0,
        audioEndInSeconds: legacy.audioEndInSeconds,
        coverImageUrl: legacy.coverImageUrl,
        songName: legacy.songName,
        artistName: legacy.artistName,
        albumName: legacy.albumName,
        durationInSeconds: legacy.durationInSeconds,
        lyricLines: legacy.lyricLines,
      },
    ];
  }
  return [];
}

const isBlank = (value: string | undefined): boolean =>
  !value || value.trim() === "";

const hasPositiveDuration = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

async function resolveTrack(
  track: TrackProps,
  abortSignal: AbortSignal | undefined,
): Promise<TrackProps> {
  if (isBlank(track.audioFileUrl)) {
    throw new Error("曲目缺少 audioFileUrl");
  }

  let lyricLines = track.lyricLines ?? [];
  if (lyricLines.length === 0 && !isBlank(track.lyricsFileUrl)) {
    lyricLines = await loadLyricLines(track.lyricsFileUrl, abortSignal).catch(
      () => [],
    );
  }

  let durationInSeconds = track.durationInSeconds;
  if (!hasPositiveDuration(durationInSeconds)) {
    const input = new Input({
      source: new UrlSource(track.audioFileUrl),
      formats: ALL_FORMATS,
    });
    durationInSeconds = await input.computeDuration();
  }

  if (!hasPositiveDuration(durationInSeconds)) {
    throw new Error(`无法读取音频时长: ${track.audioFileUrl}`);
  }

  return {
    ...track,
    durationInSeconds,
    lyricLines,
  };
}

export const calculatePlayerMetadata: CalculateMetadataFunction<
  PlayerCompositionProps
> = async ({ props, abortSignal }) => {
  const input = inputTracks(props);
  if (!input.length) {
    throw new Error("至少需要一首歌曲");
  }

  const tracks = await Promise.all(
    input.map((track) => resolveTrack(track, abortSignal)),
  );

  const durationInFrames = tracks.reduce(
    (sum, track) =>
      sum +
      trackDurationInFrames(
        track.durationInSeconds as number,
        track.audioOffsetInSeconds,
        DEFAULT_FPS,
        track.audioEndInSeconds,
      ),
    0,
  );

  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(1, durationInFrames),
    props: {
      ...props,
      tracks,
    },
  };
};
