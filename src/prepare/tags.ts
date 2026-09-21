import { parseFile, TimestampFormat } from "music-metadata";
import { titleFromAudioPath } from "../export/timing";
import { parseLyricText } from "../helpers/lyrics";
import { isUsableParsedLyric } from "./lyric-quality";
import type { LocalTags } from "./types";

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === "";
}

function msToLrcTag(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}]`;
}

function looksTimedLrc(text: string): boolean {
  return (text.match(/\[\d{1,2}:\d{2}(?:[.:]\d+)?\]/g) ?? []).length >= 3;
}

function syncTextToLrc(
  syncText: Array<{ text: string; timestamp?: number }>,
  timeStampFormat: number,
): string | undefined {
  const timed = syncText.filter(
    (item) => item.timestamp !== undefined && item.text.trim(),
  );
  if (timed.length < 3) {
    return undefined;
  }
  const toMs =
    timeStampFormat === TimestampFormat.milliseconds
      ? (value: number) => value
      : (value: number) => value * 1000;
  return timed
    .map((item) => `${msToLrcTag(toMs(item.timestamp as number))}${item.text}`)
    .join("\n");
}

function pickEmbeddedLyric(
  lyrics:
    | Array<{
        text?: string;
        syncText?: Array<{ text: string; timestamp?: number }>;
        timeStampFormat?: number;
      }>
    | undefined,
): LocalTags["embeddedLyric"] {
  if (!lyrics?.length) {
    return undefined;
  }
  for (const entry of lyrics) {
    if (entry.syncText?.length) {
      const lrc = syncTextToLrc(
        entry.syncText,
        entry.timeStampFormat ?? TimestampFormat.milliseconds,
      );
      if (lrc && isUsableLrc(lrc)) {
        return { format: "lrc", content: lrc };
      }
    }
    const text = entry.text?.trim();
    if (text && looksTimedLrc(text) && isUsableLrc(text)) {
      return { format: "lrc", content: text };
    }
  }
  return undefined;
}

function isUsableLrc(content: string): boolean {
  try {
    const lines = parseLyricText(content, "lrc");
    return isUsableParsedLyric(lines);
  } catch {
    return false;
  }
}

export async function readLocalTags(audioPath: string): Promise<LocalTags> {
  const metadata = await parseFile(audioPath);
  const duration = metadata.format.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`无法读取音频时长: ${audioPath}`);
  }

  const picture = metadata.common.picture?.[0];
  return {
    title: metadata.common.title?.trim() || "",
    artist:
      metadata.common.artist?.trim() ||
      metadata.common.artists?.map((name) => name.trim()).filter(Boolean).join(" / ") ||
      "",
    album: metadata.common.album?.trim() || "",
    durationInSeconds: duration,
    cover: picture
      ? {
          data: picture.data,
          mimeType: picture.format || "image/jpeg",
        }
      : undefined,
    embeddedLyric: pickEmbeddedLyric(metadata.common.lyrics),
  };
}

export function resolveQueryTitle(
  tags: LocalTags,
  audioPath: string,
  override?: string,
): string {
  if (override && !isBlank(override)) {
    return override.trim();
  }
  if (!isBlank(tags.title)) {
    return tags.title;
  }
  return titleFromAudioPath(audioPath);
}

export function firstNonBlank(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
}
