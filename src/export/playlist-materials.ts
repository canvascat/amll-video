// 给下载好的网易云歌单整理导出素材：每首歌的歌词、封面、单曲配置，以及整份歌单的 export.json。
//
// 歌词只用网易云，按歌曲 ID 取：逐字 YRC 优先，没有再用整行 LRC。
// 纯音乐（或没有歌词）的歌 export.json 里歌词留空，歌单画面照常显示封面和歌名。

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readLocalTags } from "../prepare/tags";
import type { LookupResult, PreparedTrack } from "../prepare/types";
import { fileStem, writeMaterials } from "../prepare/write-materials";
import { fetchNeteaseLyric } from "./netease-lyrics";
import {
  runPool,
  type PlaylistEntry,
  type PlaylistMeta,
} from "./netease-playlist";

export type LyricState =
  | { kind: "lyric"; source: string; format: string }
  | { kind: "instrumental" }
  | { kind: "missing" };

export type PreparedEntry = {
  entry: PlaylistEntry;
  prepared: PreparedTrack;
  lyric: LyricState;
};

const PREPARE_CONCURRENCY = 4;

function lyricStateOf(
  prepared: PreparedTrack,
  instrumental: boolean,
): LyricState {
  if (prepared.lyricsFileUrl) {
    return {
      kind: "lyric",
      source: prepared.match.lyricSource ?? "unknown",
      format: prepared.match.lyricFormat ?? path.extname(prepared.lyricsFileUrl).slice(1),
    };
  }
  return instrumental ? { kind: "instrumental" } : { kind: "missing" };
}

export function describeLyricState(state: LyricState): string {
  if (state.kind === "lyric") {
    const wordByWord = state.format !== "lrc";
    return `${state.source} ${state.format}${wordByWord ? "（逐字）" : "（整行）"}`;
  }
  return state.kind === "instrumental" ? "纯音乐，无歌词" : "未找到歌词";
}

async function buildLookupResult(
  audioPath: string,
  entry: PlaylistEntry,
): Promise<{ result: LookupResult; instrumental: boolean }> {
  const tags = await readLocalTags(audioPath);
  const durationInSeconds = tags.durationInSeconds;
  const identity = {
    songName: entry.name || tags.title,
    artistName: entry.artist || tags.artist,
    albumName: entry.album || tags.album,
  };
  const base: LookupResult = {
    query: {
      title: identity.songName,
      artist: identity.artistName,
      album: identity.albumName,
      durationMs: Math.round(durationInSeconds * 1000),
    },
    durationInSeconds,
    ...identity,
    cover: tags.cover
      ? { source: "embedded", data: tags.cover.data, mimeType: tags.cover.mimeType }
      : undefined,
  };

  const lyric = await fetchNeteaseLyric({
    id: entry.id,
    name: identity.songName,
    artist: identity.artistName,
    album: identity.albumName,
    durationInSeconds,
  });
  if (lyric.kind === "lyric") {
    return { result: { ...base, lyric: lyric.lyric }, instrumental: false };
  }
  return { result: base, instrumental: lyric.instrumental };
}

async function prepareEntry(
  dir: string,
  entry: PlaylistEntry,
  force: boolean,
): Promise<PreparedEntry | null> {
  if (!entry.file) return null;
  const audioPath = entry.file;
  const jsonPath = path.join(dir, `${fileStem(audioPath)}.json`);

  if (!force && existsSync(jsonPath)) {
    const prepared = JSON.parse(await readFile(jsonPath, "utf8")) as PreparedTrack;
    return { entry, prepared, lyric: lyricStateOf(prepared, false) };
  }

  const { result, instrumental } = await buildLookupResult(audioPath, entry);
  const { prepared } = await writeMaterials({ audioPath, outDir: dir, result });
  return { entry, prepared, lyric: lyricStateOf(prepared, instrumental) };
}

/** 给所有已下载的曲目整理素材，返回按歌单顺序排好的结果。 */
export async function preparePlaylistMaterials(
  dir: string,
  entries: PlaylistEntry[],
  force: boolean,
): Promise<PreparedEntry[]> {
  const results = new Map<number, PreparedEntry>();
  const ready = entries.filter((entry) => entry.file);
  const total = ready.length;
  await runPool(ready, PREPARE_CONCURRENCY, async (entry) => {
    const title = `${entry.artist} - ${entry.name}`;
    try {
      const prepared = await prepareEntry(dir, entry, force);
      if (!prepared) return;
      results.set(entry.index, prepared);
      console.log(
        `[歌词 ${results.size}/${total}] ${title}：${describeLyricState(prepared.lyric)}`,
      );
    } catch (error) {
      console.error(`[歌词] 整理失败：${title} —— ${(error as Error).message}`);
    }
  });
  return entries
    .map((entry) => results.get(entry.index))
    .filter((item): item is PreparedEntry => item !== undefined);
}

/**
 * 写出 export.json，格式与备料配置的 tracks 列表一致，可直接交给 export。
 * 想调某首歌的歌词偏移，直接改这份文件里对应曲目的 lyricOffsetMs。
 */
export async function writePlaylistExportConfig(options: {
  dir: string;
  playlistId: string;
  meta: PlaylistMeta | null;
  prepared: PreparedEntry[];
}): Promise<string> {
  const { dir, playlistId, meta, prepared } = options;
  if (prepared.length === 0) {
    throw new Error("没有可导出的曲目：全部下载或整理失败");
  }
  const configPath = path.join(dir, "export.json");
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        albumName: meta?.name || `歌单-${playlistId}`,
        neteasePlaylistId: playlistId,
        tracks: prepared.map(({ entry, prepared: track, lyric }) => ({
          audioFileUrl: track.audioFileUrl,
          lyricsFileUrl: track.lyricsFileUrl,
          coverImageUrl: track.coverImageUrl,
          audioOffsetInSeconds: track.audioOffsetInSeconds,
          songName: track.songName,
          artistName: track.artistName,
          albumName: track.albumName,
          durationInSeconds: track.durationInSeconds,
          ...(track.lyricOffsetMs !== undefined
            ? { lyricOffsetMs: track.lyricOffsetMs }
            : {}),
          neteaseSongId: entry.id,
          lyric:
            lyric.kind === "lyric"
              ? `${lyric.source} ${lyric.format}`
              : lyric.kind,
        })),
      },
      null,
      2,
    )}\n`,
  );
  return configPath;
}
