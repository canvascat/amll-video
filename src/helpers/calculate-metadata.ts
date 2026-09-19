import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import type { CalculateMetadataFunction } from "remotion";
import { loadLyricLines } from "./lyrics";
import { tagsFromMediabunny, titleFromAudioUrl } from "./metadata";
import type { PlayerCompositionProps } from "./schema";

const FPS = 30;

const isBlank = (value: string | undefined): boolean =>
  !value || value.trim() === "";

export const calculatePlayerMetadata: CalculateMetadataFunction<
  PlayerCompositionProps
> = async ({ props, abortSignal }) => {
  const input = new Input({
    source: new UrlSource(props.audioFileUrl),
    formats: ALL_FORMATS,
  });

  const [durationInSeconds, metadataTags, lyricLines] = await Promise.all([
    input.computeDuration(),
    input.getMetadataTags().catch(() => ({})),
    isBlank(props.lyricsFileUrl)
      ? Promise.resolve([])
      : loadLyricLines(props.lyricsFileUrl, abortSignal).catch(() => []),
  ]);

  const tags = tagsFromMediabunny(metadataTags);

  if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) {
    throw new Error(`无法读取音频时长: ${props.audioFileUrl}`);
  }

  const resolved: PlayerCompositionProps = {
    ...props,
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
    fps: FPS,
    durationInFrames: Math.max(
      1,
      Math.floor((durationInSeconds - props.audioOffsetInSeconds) * FPS),
    ),
    props: resolved,
  };
};
