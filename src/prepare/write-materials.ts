import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LookupResult, PreparedTrack } from "./types";

function coverExtension(mimeType: string | undefined): string {
  if (mimeType?.includes("png")) {
    return ".png";
  }
  if (mimeType?.includes("webp")) {
    return ".webp";
  }
  if (mimeType?.includes("gif")) {
    return ".gif";
  }
  return ".jpg";
}

export async function writeMaterials(options: {
  audioPath: string;
  outDir: string;
  result: LookupResult;
}): Promise<{
  jsonPath: string;
  prepared: PreparedTrack;
  hasLyrics: boolean;
}> {
  const { audioPath, outDir, result } = options;
  await mkdir(outDir, { recursive: true });

  const audioFileUrl = `audio${path.extname(audioPath) || ".bin"}`;
  await copyFile(audioPath, path.join(outDir, audioFileUrl));

  let lyricsFileUrl = "";
  if (result.lyric) {
    lyricsFileUrl = `lyric.${result.lyric.format}`;
    await writeFile(path.join(outDir, lyricsFileUrl), result.lyric.content, "utf8");
  }

  let coverImageUrl = "";
  if (result.cover) {
    coverImageUrl = `cover${coverExtension(result.cover.mimeType)}`;
    await writeFile(path.join(outDir, coverImageUrl), result.cover.data);
  }

  const prepared: PreparedTrack = {
    audioFileUrl,
    lyricsFileUrl,
    coverImageUrl,
    audioOffsetInSeconds: 0,
    songName: result.songName,
    artistName: result.artistName,
    albumName: result.albumName,
    durationInSeconds: result.durationInSeconds,
    match: {
      lyricSource: result.lyric?.source,
      lyricFormat: result.lyric?.format,
      coverSource: result.cover?.source,
    },
  };

  const jsonPath = path.join(outDir, "track.json");
  await writeFile(jsonPath, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");

  return {
    jsonPath,
    prepared,
    hasLyrics: Boolean(result.lyric),
  };
}
