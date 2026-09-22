import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import type { CalculateMetadataFunction } from "remotion";
import { DEFAULT_FPS } from "../remotion/constants";
import { loadLyricLines, shiftLyricLines } from "./lyrics";
import type {
  AlbumCompositionProps,
  PlayerCompositionProps,
  TrackProps,
} from "./schema";
import { albumSpanInFrames, trackDurationInFrames } from "./track-duration";

const isBlank = (value: string | undefined): boolean =>
  !value || value.trim() === "";

const hasPositiveDuration = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

async function resolveTrack(
  track: TrackProps,
  abortSignal: AbortSignal | undefined,
  options?: { lyrics?: boolean },
): Promise<TrackProps> {
  if (isBlank(track.audioFileUrl)) {
    throw new Error("曲目缺少 audioFileUrl");
  }

  const loadLyrics = options?.lyrics !== false;
  let lyricLines = loadLyrics ? (track.lyricLines ?? []) : [];
  if (loadLyrics && lyricLines.length === 0 && !isBlank(track.lyricsFileUrl)) {
    lyricLines = await loadLyricLines(track.lyricsFileUrl, abortSignal).catch(
      () => [],
    );
  }
  if (loadLyrics) {
    lyricLines = shiftLyricLines(lyricLines, track.lyricOffsetMs ?? 0);
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
    lyricOffsetMs: loadLyrics ? 0 : track.lyricOffsetMs,
    durationInSeconds,
    lyricLines,
  };
}

export const calculatePlayerMetadata: CalculateMetadataFunction<
  PlayerCompositionProps
> = async ({ props, abortSignal }) => {
  const track = await resolveTrack(props, abortSignal, { lyrics: true });
  const durationInFrames = trackDurationInFrames(
    track.durationInSeconds as number,
    track.audioOffsetInSeconds,
    DEFAULT_FPS,
    track.audioEndInSeconds,
  );

  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(1, durationInFrames),
    props: track,
  };
};

export const calculateAlbumMetadata: CalculateMetadataFunction<
  AlbumCompositionProps
> = async ({ props, abortSignal }) => {
  if (!props.tracks.length) {
    throw new Error("至少需要一首歌曲");
  }

  const tracks = await Promise.all(
    props.tracks.map((track) =>
      resolveTrack(track, abortSignal, { lyrics: false }),
    ),
  );

  const durationInFrames = props.cueStills
    ? tracks.length
    : albumSpanInFrames(tracks, DEFAULT_FPS);

  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(1, durationInFrames),
    props: {
      ...props,
      tracks,
    },
  };
};
