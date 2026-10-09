import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import type { CalculateMetadataFunction } from "remotion";
import { DEFAULT_FPS } from "../remotion/constants";
import { stripLyricMetadata } from "./lyric-metadata";
import { loadLyricLines, shiftLyricLines } from "./lyrics";
import { resolvePlaylistMetadata } from "../Playlist/metadata";
import type {
  AlbumCompositionProps,
  PlayerCompositionProps,
  PlaylistCompositionProps,
  SpectraCompositionProps,
  TrackProps,
} from "./schema";
import { loadSpectraAudioInfo } from "../Spectra/audio-info";
import { loadCoverTheme } from "../Spectra/cover-theme";
import { resolvePublicAsset } from "./public-asset";
import { albumSpanInFrames, trackDurationInFrames } from "./track-duration";

const isBlank = (value: string | undefined): boolean =>
  !value || value.trim() === "";

const hasPositiveDuration = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

export async function resolveTrack(
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
    lyricLines = stripLyricMetadata(
      shiftLyricLines(lyricLines, track.lyricOffsetMs ?? 0),
      { title: track.songName, artists: track.artistName },
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
> = async ({ props }) => {
  if (!props.tracks.length) {
    throw new Error("至少需要一首歌曲");
  }
  if (isBlank(props.audioFileUrl)) {
    throw new Error("专辑缺少音频");
  }

  let tracks = props.tracks;
  const missingEnd = tracks.some(
    (track) => !hasPositiveDuration(track.audioEndInSeconds),
  );
  if (missingEnd) {
    const input = new Input({
      source: new UrlSource(props.audioFileUrl),
      formats: ALL_FORMATS,
    });
    const durationInSeconds = await input.computeDuration();
    if (!hasPositiveDuration(durationInSeconds)) {
      throw new Error(`无法读取音频时长: ${props.audioFileUrl}`);
    }
    tracks = tracks.map((track) => ({
      ...track,
      audioEndInSeconds: hasPositiveDuration(track.audioEndInSeconds)
        ? track.audioEndInSeconds
        : durationInSeconds,
    }));
  }

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

export const calculatePlaylistMetadata: CalculateMetadataFunction<
  PlaylistCompositionProps
> = async ({ props, abortSignal }) => {
  return resolvePlaylistMetadata(props, (track) =>
    resolveTrack(track, abortSignal, { lyrics: true }),
  );
};

export const calculateSpectraMetadata: CalculateMetadataFunction<
  SpectraCompositionProps
> = async ({ props, abortSignal }) => {
  const track = await resolveTrack(props, abortSignal, { lyrics: true });
  const durationInSeconds = track.durationInSeconds as number;
  const durationInFrames = trackDurationInFrames(
    durationInSeconds,
    track.audioOffsetInSeconds,
    DEFAULT_FPS,
    track.audioEndInSeconds,
  );

  let { audioInfo, year, trackNumber, genre, bpm, composer } = props;
  // 技术参数缺项（或还没有包络）时，从音频文件本身读取；读不到就留空，界面显示 “—”
  if (!audioInfo?.peaks?.length) {
    const loaded = await loadSpectraAudioInfo(
      resolvePublicAsset(track.audioFileUrl),
      durationInSeconds,
      {
        startInSeconds: track.audioOffsetInSeconds,
        endInSeconds: track.audioEndInSeconds ?? durationInSeconds,
      },
    ).catch(() => null);
    if (loaded) {
      audioInfo = { ...loaded.info, ...audioInfo };
      year = year ?? loaded.tags.year;
      trackNumber = trackNumber ?? loaded.tags.trackNumber;
      genre = genre ?? loaded.tags.genre;
      bpm = bpm ?? loaded.tags.bpm;
      composer = composer ?? loaded.tags.composer;
    }
  }

  let theme = props.theme;
  if (!theme && props.themeFromCover !== false) {
    theme =
      (await loadCoverTheme(resolvePublicAsset(track.coverImageUrl))) ??
      undefined;
  }

  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(1, durationInFrames),
    props: {
      ...props,
      ...track,
      audioInfo,
      year,
      trackNumber,
      genre,
      bpm,
      composer,
      theme,
    },
  };
};
