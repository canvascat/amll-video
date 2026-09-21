import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UsageError } from "./parse-args";

export type ConfigTrack = {
  audioPath: string;
  lyricPath: string;
  coverPath?: string;
  offsetInSeconds: number;
  audioEndInSeconds?: number;
  durationInSeconds?: number;
  title?: string;
  artist?: string;
  album?: string;
};

export type LoadedConfig = {
  title: string;
  tracks: ConfigTrack[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolveMediaPath(
  configDir: string,
  fileUrl: string,
  kind: string,
): string {
  const trimmed = fileUrl.trim();
  if (!trimmed) {
    throw new UsageError(`配置缺少${kind}路径`);
  }
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    throw new UsageError(`${kind}需要本地文件，不能是 URL: ${trimmed}`);
  }
  const resolved = path.resolve(configDir, trimmed);
  if (!existsSync(resolved)) {
    throw new UsageError(`找不到${kind}: ${resolved}`);
  }
  return resolved;
}

function resolveOptionalMediaPath(
  configDir: string,
  fileUrl: string,
  kind: string,
): string | undefined {
  if (!fileUrl.trim()) {
    return undefined;
  }
  return resolveMediaPath(configDir, fileUrl, kind);
}

function readTrack(
  raw: Record<string, unknown>,
  configDir: string,
  defaults?: {
    audioFileUrl?: string;
    coverImageUrl?: string;
    artistName?: string;
    albumName?: string;
  },
): ConfigTrack {
  const audioFileUrl = asString(raw.audioFileUrl) || defaults?.audioFileUrl || "";
  const lyricsFileUrl = asString(raw.lyricsFileUrl);
  const coverImageUrl =
    asString(raw.coverImageUrl) || defaults?.coverImageUrl || "";
  const offset = asFiniteNumber(raw.audioOffsetInSeconds) ?? 0;
  const end = asFiniteNumber(raw.audioEndInSeconds);
  const duration = asFiniteNumber(raw.durationInSeconds);

  if (offset < 0) {
    throw new UsageError("audioOffsetInSeconds 不能为负数");
  }

  return {
    audioPath: resolveMediaPath(configDir, audioFileUrl, "音频"),
    lyricPath: lyricsFileUrl.trim()
      ? resolveMediaPath(configDir, lyricsFileUrl, "歌词")
      : "",
    coverPath: resolveOptionalMediaPath(configDir, coverImageUrl, "封面"),
    offsetInSeconds: offset,
    audioEndInSeconds: end && end > 0 ? end : undefined,
    durationInSeconds: duration && duration > 0 ? duration : undefined,
    title: asString(raw.songName) || undefined,
    artist: asString(raw.artistName) || defaults?.artistName || undefined,
    album: asString(raw.albumName) || defaults?.albumName || undefined,
  };
}

function parseConfigData(data: unknown, configDir: string): LoadedConfig {
  if (!isRecord(data)) {
    throw new UsageError("配置文件必须是 JSON 对象");
  }

  if (Array.isArray(data.tracks)) {
    if (data.tracks.length === 0) {
      throw new UsageError("配置里至少需要一首歌");
    }
    const defaults =
      typeof data.audioFileUrl === "string"
        ? {
            audioFileUrl: data.audioFileUrl,
            coverImageUrl: asString(data.coverImageUrl),
            artistName: asString(data.artistName),
            albumName: asString(data.albumName),
          }
        : undefined;
    const tracks = data.tracks.map((item, index) => {
      if (!isRecord(item)) {
        throw new UsageError(`tracks[${index}] 不是对象`);
      }
      return readTrack(item, configDir, defaults);
    });
    const title =
      asString(data.albumName) ||
      tracks[0]?.title ||
      tracks[0]?.album ||
      "untitled";
    return { title, tracks };
  }

  if (asString(data.audioFileUrl)) {
    const track = readTrack(data, configDir);
    return {
      title: track.title || path.basename(track.audioPath, path.extname(track.audioPath)),
      tracks: [track],
    };
  }

  throw new UsageError(
    "无法识别配置文件：需要单曲字段（audioFileUrl）或专辑/列表（tracks）",
  );
}

export async function loadPreparedConfig(configPath: string): Promise<LoadedConfig> {
  const resolved = path.resolve(configPath);
  if (!existsSync(resolved)) {
    throw new UsageError(`找不到配置文件: ${resolved}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(await readFile(resolved, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`配置文件不是合法 JSON: ${resolved}\n${message}`);
  }

  return parseConfigData(data, path.dirname(resolved));
}
