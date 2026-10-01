import path from "node:path";
import {
  buildEntries,
  DEFAULT_MUSIC_DL_SERVER,
  defaultPlaylistDir,
  downloadPlaylistEntries,
  fetchPlaylistMeta,
  fetchPlaylistTracks,
  resolvePlaylistId,
  writePlaylistInfo,
} from "./netease-playlist";
import {
  preparePlaylistMaterials,
  writePlaylistExportConfig,
} from "./playlist-materials";
import { looksLikePlaylistRef, type ExportArgs } from "./parse-args";

const DOWNLOAD_CONCURRENCY = 2;
const DOWNLOAD_RETRIES = 3;

/**
 * 网易云歌单 → export.json：
 * 下载到 tmp/mdl/<歌单ID>（已有的跳过）→ 取网易云歌词、整理封面 → 写出 export.json。
 * 传入的已经是配置文件时原样返回。
 */
export async function prepareNeteasePlaylist(args: ExportArgs): Promise<string> {
  const input = args.config;
  if (!input) {
    throw new Error("需要歌单链接、歌单 ID 或 export.json");
  }
  if (!looksLikePlaylistRef(input)) {
    return path.resolve(input);
  }

  const playlistId = await resolvePlaylistId(input);
  const server = (
    args.server ??
    process.env.MUSIC_DL_URL ??
    DEFAULT_MUSIC_DL_SERVER
  ).replace(/\/+$/, "");
  const dir = defaultPlaylistDir(playlistId);
  const force = Boolean(args.refresh);

  console.log(`网易云歌单 ${playlistId}，素材目录：${dir}`);
  const [tracks, meta] = await Promise.all([
    fetchPlaylistTracks(server, playlistId),
    fetchPlaylistMeta(playlistId),
  ]);
  console.log(`《${meta?.name || playlistId}》共 ${tracks.length} 首`);

  const entries = buildEntries(tracks);
  const saveInfo = () => writePlaylistInfo(dir, playlistId, meta, entries);
  await downloadPlaylistEntries(
    {
      server,
      dir,
      concurrency: DOWNLOAD_CONCURRENCY,
      retries: DOWNLOAD_RETRIES,
      force,
    },
    entries,
    async () => {
      await saveInfo();
    },
  );
  await saveInfo();

  const failed = entries.filter((entry) => entry.status === "failed");
  if (failed.length > 0) {
    console.warn(
      `! ${failed.length} 首下载失败，已从成片中跳过（重跑同一条命令会补下载）：`,
    );
    for (const entry of failed) {
      console.warn(`  - ${entry.artist} - ${entry.name}：${entry.error}`);
    }
  }

  const prepared = await preparePlaylistMaterials(dir, entries, force);
  const configPath = await writePlaylistExportConfig({
    dir,
    playlistId,
    meta,
    prepared,
  });

  const instrumental = prepared.filter((item) => item.lyric.kind !== "lyric");
  if (instrumental.length > 0) {
    console.log(`其中 ${instrumental.length} 首没有歌词，画面里只显示封面和歌名：`);
    for (const item of instrumental) {
      console.log(`  - ${item.entry.artist} - ${item.entry.name}`);
    }
  }
  console.log(`已写出 ${configPath}（${prepared.length} 首）`);
  return configPath;
}
