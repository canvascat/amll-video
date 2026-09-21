import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import type { CalculateMetadataFunction } from "remotion";
import { DEFAULT_FPS } from "../remotion/constants";
import { loadLyricLines } from "./lyrics";
import { tagsFromMediabunny, titleFromAudioUrl } from "./metadata";
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

  const hasLyrics = (track.lyricLines?.length ?? 0) > 0;
  const hasDuration = hasPositiveDuration(track.durationInSeconds);
  const hasIdentity =
    !isBlank(track.songName) &&
    !isBlank(track.artistName) &&
    !isBlank(track.albumName) &&
    track.coverImageUrl !== undefined;

  let durationInSeconds = hasDuration ? track.durationInSeconds : undefined;
  let tags = tagsFromMediabunny({});
  let lyricLines = hasLyrics ? (track.lyricLines ?? []) : [];

  if (!hasDuration || !hasIdentity) {
    const input = new Input({
      source: new UrlSource(track.audioFileUrl),
      formats: ALL_FORMATS,
    });
    const [computedDuration, metadataTags] = await Promise.all([
      hasDuration
        ? Promise.resolve(durationInSeconds as number)
        : input.computeDuration(),
      hasIdentity
        ? Promise.resolve({})
        : input.getMetadataTags().catch(() => ({})),
    ]);
    durationInSeconds = computedDuration;
    tags = tagsFromMediabunny(metadataTags);
  }

  if (!hasLyrics && !isBlank(track.lyricsFileUrl)) {
    lyricLines = await loadLyricLines(track.lyricsFileUrl, abortSignal).catch(
      () => [],
    );
  }

  if (!hasPositiveDuration(durationInSeconds)) {
    throw new Error(`无法读取音频时长: ${track.audioFileUrl}`);
  }

  return {
    ...track,
    durationInSeconds,
    songName: isBlank(track.songName)
      ? tags.title || titleFromAudioUrl(track.audioFileUrl)
      : track.songName,
    artistName: isBlank(track.artistName)
      ? tags.artist || "未知创作者"
      : track.artistName,
    albumName: isBlank(track.albumName)
      ? tags.album || "未知专辑"
      : track.albumName,
    coverImageUrl: isBlank(track.coverImageUrl)
      ? tags.coverDataUrl || ""
      : track.coverImageUrl,
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
