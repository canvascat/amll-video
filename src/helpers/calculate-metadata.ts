import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import type { CalculateMetadataFunction } from "remotion";
import { DEFAULT_FPS } from "../remotion/constants";
import { loadLyricLines } from "./lyrics";
import { tagsFromMediabunny, titleFromAudioUrl } from "./metadata";
import type { PlayerCompositionProps } from "./schema";

const isBlank = (value: string | undefined): boolean =>
  !value || value.trim() === "";

const hasPositiveDuration = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

export const calculatePlayerMetadata: CalculateMetadataFunction<
  PlayerCompositionProps
> = async ({ props, abortSignal }) => {
  const hasLyrics = (props.lyricLines?.length ?? 0) > 0;
  const hasDuration = hasPositiveDuration(props.durationInSeconds);
  const hasIdentity =
    !isBlank(props.songName) &&
    !isBlank(props.artistName) &&
    !isBlank(props.albumName) &&
    props.coverImageUrl !== undefined;

  let durationInSeconds = hasDuration ? props.durationInSeconds : undefined;
  let tags = tagsFromMediabunny({});
  let lyricLines = hasLyrics ? (props.lyricLines ?? []) : [];

  if (!hasDuration || !hasIdentity) {
    const input = new Input({
      source: new UrlSource(props.audioFileUrl),
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

  if (!hasLyrics && !isBlank(props.lyricsFileUrl)) {
    lyricLines = await loadLyricLines(props.lyricsFileUrl, abortSignal).catch(
      () => [],
    );
  }

  if (!hasPositiveDuration(durationInSeconds)) {
    throw new Error(`无法读取音频时长: ${props.audioFileUrl}`);
  }

  const resolved: PlayerCompositionProps = {
    ...props,
    durationInSeconds,
    songName: isBlank(props.songName)
      ? tags.title || titleFromAudioUrl(props.audioFileUrl)
      : props.songName,
    artistName: isBlank(props.artistName)
      ? tags.artist || "未知创作者"
      : props.artistName,
    albumName: isBlank(props.albumName)
      ? tags.album || "未知专辑"
      : props.albumName,
    coverImageUrl: isBlank(props.coverImageUrl)
      ? tags.coverDataUrl || ""
      : props.coverImageUrl,
    lyricLines,
  };

  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(
      1,
      Math.floor((durationInSeconds - props.audioOffsetInSeconds) * DEFAULT_FPS),
    ),
    props: resolved,
  };
};
