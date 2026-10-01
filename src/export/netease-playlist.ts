// 网易云歌单：解析链接、读取曲目，并通过本地 music-dl web 批量下载（内嵌封面和歌词）。
//
// 只跑在 Node，不进 Remotion 浏览器包。
// 曲目和音质取决于 music-dl web 当前登录的账号；个性化推荐歌单的曲目会随账号变化。

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { promisify } from "node:util";
import { UsageError } from "./parse-args";

const execFileAsync = promisify(execFile);

const SOURCE = "netease";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const AUDIO_EXTENSIONS = [".flac", ".mp3", ".m4a", ".wav", ".ogg"];

export const DEFAULT_MUSIC_DL_SERVER = "http://127.0.0.1:8080/music";

export type PlaylistTrack = {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  extra: string;
};

export type PlaylistMeta = {
  name: string;
  description: string;
  creator: string;
  cover: string;
  trackCount: number | null;
  playCount: number | null;
  tags: string[];
};

export type TrackStatus = "pending" | "done" | "skipped" | "failed";

export type PlaylistEntry = PlaylistTrack & {
  index: number;
  /** 不含扩展名的文件名，歌词、封面、配置都跟它同名。 */
  base: string;
  file: string | null;
  status: TrackStatus;
  error: string | null;
  hasCover: boolean | null;
  hasLyrics: boolean | null;
};

export type DownloadOptions = {
  server: string;
  dir: string;
  concurrency: number;
  retries: number;
  force: boolean;
};

function idFromUrl(value: string): string | null {
  const match = /[?&]id=(\d+)/.exec(value) ?? /playlist\/(\d+)/.exec(value);
  return match ? match[1] : null;
}

/** 从分享文本、短链、长链或纯数字里解析出歌单 ID。 */
export async function resolvePlaylistId(input: string): Promise<string> {
  const text = input.trim();
  if (/^\d+$/.test(text)) return text;

  const direct = idFromUrl(text);
  if (direct) return direct;

  // 分享文本里可能夹着 163cn.tv 短链，需要跟随重定向
  const urlMatch = /https?:\/\/\S+/.exec(text);
  if (urlMatch) {
    const res = await fetch(urlMatch[0], {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    const resolved = idFromUrl(res.url);
    if (resolved) return resolved;
  }
  throw new UsageError(`无法从「${input}」解析出网易云歌单 ID`);
}

export function defaultPlaylistDir(playlistId: string, cwd = process.cwd()): string {
  return path.resolve(cwd, "tmp", "mdl", playlistId);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseDataAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /\b(data-[a-z-]+)=(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag)) !== null) {
    attrs[match[1]] = decodeHtml(match[2] ?? match[3] ?? "");
  }
  return attrs;
}

/** 从 music-dl web 的歌单页解析曲目（它已登录，曲目才与账号一致）。 */
export async function fetchPlaylistTracks(
  server: string,
  playlistId: string,
): Promise<PlaylistTrack[]> {
  const url = `${server}/playlist?${new URLSearchParams({ id: playlistId, source: SOURCE })}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ECONNREFUSED") {
      throw new Error(`连不上 ${server}，请先启动 music-dl web 并登录网易云`);
    }
    throw error;
  }
  if (!res.ok) throw new Error(`music-dl 歌单页返回 ${res.status}：${url}`);
  const html = await res.text();

  const tags = html.match(/<li\b[^>]*\bclass="song-card"[^>]*>/g) ?? [];
  const tracks: PlaylistTrack[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const a = parseDataAttributes(tag);
    const id = a["data-id"];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    tracks.push({
      id,
      name: a["data-name"] ?? "",
      artist: a["data-artist"] ?? "",
      album: a["data-album"] ?? "",
      duration: Number(a["data-duration"] || 0),
      cover: a["data-cover"] ?? "",
      extra: a["data-extra"] ?? "",
    });
  }
  if (tracks.length === 0) {
    throw new Error(
      "歌单页里没有解析到任何歌曲，请确认 music-dl web 已登录且歌单 ID 正确",
    );
  }
  return tracks;
}

/** 歌单名称、创建者等信息。music-dl 页面不带这些，用网易云公开接口补充；失败不影响下载。 */
export async function fetchPlaylistMeta(
  playlistId: string,
): Promise<PlaylistMeta | null> {
  try {
    const res = await fetch(
      `https://music.163.com/api/v6/playlist/detail?id=${playlistId}`,
      {
        headers: { "User-Agent": USER_AGENT, Referer: "https://music.163.com/" },
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = (await res.json()) as {
      playlist?: {
        name?: string;
        description?: string | null;
        creator?: { nickname?: string };
        coverImgUrl?: string;
        trackCount?: number;
        playCount?: number;
        tags?: string[];
      };
    };
    const p = data.playlist;
    if (!p) return null;
    return {
      name: p.name ?? "",
      description: p.description ?? "",
      creator: p.creator?.nickname ?? "",
      cover: p.coverImgUrl ?? "",
      trackCount: p.trackCount ?? null,
      playCount: p.playCount ?? null,
      tags: p.tags ?? [],
    };
  } catch (error) {
    console.warn(`! 获取歌单名称失败（不影响下载）：${(error as Error).message}`);
    return null;
  }
}

export function sanitizeFileName(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .slice(0, 120) || "untitled"
  );
}

/** 给每首歌分配不重名的文件名。 */
export function buildEntries(tracks: PlaylistTrack[]): PlaylistEntry[] {
  const used = new Set<string>();
  return tracks.map((track, index) => {
    const label = track.artist ? `${track.artist} - ${track.name}` : track.name;
    let base = sanitizeFileName(label);
    if (used.has(base.toLowerCase())) base = `${base} (${track.id})`;
    used.add(base.toLowerCase());
    return {
      ...track,
      index: index + 1,
      base,
      file: null,
      status: "pending" as const,
      error: null,
      hasCover: null,
      hasLyrics: null,
    };
  });
}

function buildDownloadUrl(server: string, track: PlaylistTrack): string {
  const params = new URLSearchParams({
    id: track.id,
    source: SOURCE,
    name: track.name,
    artist: track.artist,
    embed: "1",
  });
  if (track.album) params.set("album", track.album);
  if (track.cover) params.set("cover", track.cover);
  if (track.extra && track.extra !== "{}" && track.extra !== "null") {
    params.set("extra", track.extra);
  }
  return `${server}/download?${params}`;
}

function extensionFromResponse(res: Response): string {
  const disposition = res.headers.get("content-disposition") ?? "";
  let fileName = "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try {
      fileName = decodeURIComponent(star[1]);
    } catch {
      fileName = star[1];
    }
  } else {
    fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "";
  }
  const ext = path.extname(fileName).toLowerCase();
  if (ext) return ext;

  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("flac")) return ".flac";
  if (type.includes("mpeg") || type.includes("mp3")) return ".mp3";
  if (type.includes("mp4") || type.includes("m4a")) return ".m4a";
  if (type.includes("wav")) return ".wav";
  return ".mp3";
}

let ffprobeAvailable: boolean | null = null;

/** 用 ffprobe 检查封面和歌词是否真的写进了文件。没有 ffprobe 时跳过。 */
async function inspectEmbedded(
  file: string,
): Promise<{ hasCover: boolean; hasLyrics: boolean } | null> {
  if (ffprobeAvailable === false) return null;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type:stream_tags:format_tags",
        "-of",
        "json",
        file,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    ffprobeAvailable = true;
    const data = JSON.parse(stdout) as {
      streams?: { codec_type?: string; tags?: Record<string, string> }[];
      format?: { tags?: Record<string, string> };
    };
    const tagKeys = [
      ...Object.keys(data.format?.tags ?? {}),
      ...(data.streams ?? []).flatMap((s) => Object.keys(s.tags ?? {})),
    ].map((key) => key.toLowerCase());
    return {
      hasCover: (data.streams ?? []).some((s) => s.codec_type === "video"),
      hasLyrics: tagKeys.some((key) => key.includes("lyrics") || key === "uslt"),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      ffprobeAvailable = false;
    }
    return null;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function findExistingFile(
  dir: string,
  base: string,
): Promise<string | null> {
  for (const ext of AUDIO_EXTENSIONS) {
    const file = path.join(dir, base + ext);
    if (await exists(file)) return file;
  }
  return null;
}

async function downloadOnce(
  server: string,
  track: PlaylistTrack,
  dir: string,
  base: string,
): Promise<string> {
  const res = await fetch(buildDownloadUrl(server, track));
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`.trim());
  }
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/html") || type.includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(`服务返回的不是音频：${body.slice(0, 120)}`);
  }

  const file = path.join(dir, base + extensionFromResponse(res));
  const partFile = `${file}.part`;
  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as NodeReadableStream),
      createWriteStream(partFile),
    );
    const { size } = await stat(partFile);
    if (size < 10 * 1024) {
      throw new Error(`文件过小（${size} 字节），可能下载失败`);
    }
    await rename(partFile, file);
  } catch (error) {
    await rm(partFile, { force: true });
    throw error;
  }
  return file;
}

async function downloadTrack(
  options: DownloadOptions,
  track: PlaylistTrack,
  base: string,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await downloadOnce(options.server, track, options.dir, base);
    } catch (error) {
      lastError = error;
      if (attempt < options.retries) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        await worker(items[next++]);
      }
    },
  );
  await Promise.all(runners);
}

/** 保存歌单信息（playlist.json）。随下载进度反复调用，记录每首歌的状态。 */
export async function writePlaylistInfo(
  dir: string,
  playlistId: string,
  meta: PlaylistMeta | null,
  entries: PlaylistEntry[],
): Promise<string> {
  const infoFile = path.join(dir, "playlist.json");
  await writeFile(
    infoFile,
    JSON.stringify(
      {
        id: playlistId,
        source: SOURCE,
        url: `https://music.163.com/#/playlist?id=${playlistId}`,
        fetchedAt: new Date().toISOString(),
        ...meta,
        tracks: entries.map((entry) => ({
          index: entry.index,
          id: entry.id,
          name: entry.name,
          artist: entry.artist,
          album: entry.album,
          duration: entry.duration,
          cover: entry.cover,
          extra: entry.extra,
          file: entry.file ? path.basename(entry.file) : null,
          status: entry.status,
          error: entry.error,
          hasCover: entry.hasCover,
          hasLyrics: entry.hasLyrics,
        })),
      },
      null,
      2,
    ) + "\n",
  );
  return infoFile;
}

/** 下载（或跳过已有的）全部曲目，原地更新 entries 的状态。失败的歌只记录，不抛错。 */
export async function downloadPlaylistEntries(
  options: DownloadOptions,
  entries: PlaylistEntry[],
  onProgress: () => Promise<void>,
): Promise<void> {
  await mkdir(options.dir, { recursive: true });
  const total = entries.length;
  const width = String(total).length;
  await runPool(entries, options.concurrency, async (entry) => {
    const prefix = `[${String(entry.index).padStart(width)}/${total}]`;
    const title = `${entry.artist} - ${entry.name}`;

    if (!options.force) {
      const existing = await findExistingFile(options.dir, entry.base);
      if (existing) {
        entry.file = existing;
        entry.status = "skipped";
        console.log(`${prefix} 已存在，跳过：${title}`);
        return;
      }
    }

    try {
      const file = await downloadTrack(options, entry, entry.base);
      const embedded = await inspectEmbedded(file);
      entry.file = file;
      entry.status = "done";
      entry.hasCover = embedded?.hasCover ?? null;
      entry.hasLyrics = embedded?.hasLyrics ?? null;
      console.log(`${prefix} 已下载：${title}`);
    } catch (error) {
      entry.status = "failed";
      entry.error = (error as Error).message;
      console.error(`${prefix} 下载失败：${title} —— ${entry.error}`);
    }
    await onProgress();
  });
}
