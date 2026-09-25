import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseLyricText } from "../helpers/lyrics";
import { loadCueAlbum } from "../prepare/album";
import { lookupTrack } from "../prepare/lookup";
import { albumSrtCuesFromTracks, buildSrt } from "./srt";

export type SuspectedLyricOffset = {
  songName: string;
  offsetMs: number;
  source?: string;
  format?: string;
};

export function formatSuspectedOffsets(
  items: readonly SuspectedLyricOffset[],
): string {
  if (!items.length) {
    return "没有疑似偏移的曲目";
  }
  const lines = ["疑似偏移（未写入字幕）："];
  for (const item of items) {
    const source = [item.source, item.format].filter(Boolean).join(" ");
    lines.push(
      source
        ? `${item.songName}  ${item.offsetMs}ms  ${source}`
        : `${item.songName}  ${item.offsetMs}ms`,
    );
  }
  return lines.join("\n");
}

function srtOutputPath(cuePath: string, outPath?: string): string {
  if (!outPath) {
    return cuePath.replace(/\.cue$/i, ".srt");
  }
  if (outPath.toLowerCase().endsWith(".srt")) {
    return outPath;
  }
  return `${outPath.replace(/\.[^.]+$/, "")}.srt`;
}

export async function writeAlbumSrt(options: {
  cuePath: string;
  outPath?: string;
}): Promise<{
  srtPath: string;
  cueCount: number;
  suspected: SuspectedLyricOffset[];
}> {
  const cuePath = path.resolve(options.cuePath);
  const album = await loadCueAlbum({ cuePath });
  const suspected: SuspectedLyricOffset[] = [];
  const tracks = [];

  for (const [index, track] of album.tracks.entries()) {
    const duration = Math.max(
      0.001,
      track.audioEndInSeconds - track.audioOffsetInSeconds,
    );
    console.log(
      `[${index + 1}/${album.tracks.length}] ${track.songName}  ${duration.toFixed(1)}s`,
    );
    const result = await lookupTrack({
      audioPath: album.audioPath,
      title: track.songName,
      artist: album.artistName,
      album: album.albumName,
      durationInSeconds: duration,
      audioStartSeconds: track.audioOffsetInSeconds,
      cover: album.cover,
      ignoreEmbeddedLyric: true,
    });
    if (!result.lyric) {
      console.log("  未匹配到歌词");
      tracks.push({
        songName: track.songName,
        audioOffsetInSeconds: track.audioOffsetInSeconds,
        audioEndInSeconds: track.audioEndInSeconds,
        lyricLines: [],
      });
      continue;
    }
    console.log(`  ${result.lyric.source} ${result.lyric.format}`);
    if (result.lyricOffsetMs) {
      suspected.push({
        songName: track.songName,
        offsetMs: result.lyricOffsetMs,
        source: result.lyric.source,
        format: result.lyric.format,
      });
    }
    tracks.push({
      songName: track.songName,
      audioOffsetInSeconds: track.audioOffsetInSeconds,
      audioEndInSeconds: track.audioEndInSeconds,
      lyricLines: parseLyricText(result.lyric.content, result.lyric.format),
    });
  }

  const cues = albumSrtCuesFromTracks(tracks);
  const srtPath = srtOutputPath(cuePath, options.outPath);
  await writeFile(srtPath, buildSrt(cues), "utf8");
  return { srtPath, cueCount: cues.length, suspected };
}
