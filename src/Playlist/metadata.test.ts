import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { playlistCompositionSchema } from "../helpers/schema";
import { PLAYLIST_COMPOSITION_ID } from "../remotion/constants";
import { resolvePlaylistMetadata } from "./metadata";

const lyric: LyricLine = {
  words: [{ word: "甲", startTime: 0, endTime: 1000, obscene: false }],
  startTime: 0,
  endTime: 1000,
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
};

function track(durationInSeconds: number) {
  return {
    audioFileUrl: "missing-on-purpose.flac",
    lyricsFileUrl: "missing-on-purpose.ttml",
    audioOffsetInSeconds: 0,
    coverImageUrl: "cover.jpg",
    songName: "甲",
    artistName: "乙",
    durationInSeconds,
    lyricLines: [lyric],
  };
}

test("已有时长和歌词时不读文件，总帧数相加", async () => {
  let reads = 0;
  const result = await resolvePlaylistMetadata(
    { tracks: [track(2), track(3)] },
    async () => {
      reads += 1;
      throw new Error("不应读取文件");
    },
  );
  assert.equal(reads, 0);
  assert.equal(result.fps, 30);
  assert.equal(result.durationInFrames, 150);
  assert.equal(result.props.tracks[1]?.durationInSeconds, 3);
});

test("缺歌词时才把曲目交给解析函数", async () => {
  const unresolved = { ...track(2), lyricLines: [] as LyricLine[] };
  let reads = 0;
  await resolvePlaylistMetadata({ tracks: [unresolved] }, async (item) => {
    reads += 1;
    return { ...item, lyricLines: [lyric] };
  });
  assert.equal(reads, 1);
});

test("已齐的曲目在别人缺歌词时保持原样", async () => {
  const readyTrack = { ...track(2), lyricOffsetMs: 120, songName: "已齐" };
  const unresolved = { ...track(3), lyricLines: [] as LyricLine[], songName: "未齐" };
  let reads = 0;
  const result = await resolvePlaylistMetadata(
    { tracks: [readyTrack, unresolved] },
    async (item) => {
      reads += 1;
      return { ...item, lyricLines: [lyric], lyricOffsetMs: 0, durationInSeconds: 9 };
    },
  );
  assert.equal(reads, 1);
  assert.equal(result.props.tracks[0]?.songName, "已齐");
  assert.equal(result.props.tracks[0]?.lyricOffsetMs, 120);
  assert.equal(result.props.tracks[0]?.lyricLines[0]?.startTime, 0);
  assert.equal(result.props.tracks[0]?.durationInSeconds, 2);
  assert.equal(result.props.tracks[1]?.durationInSeconds, 9);
});

test("schema 至少一首，默认歌单把同一首放两遍", () => {
  assert.equal(PLAYLIST_COMPOSITION_ID, "PlaylistPlayer");
  assert.equal(playlistCompositionSchema.safeParse({ tracks: [track(2)] }).success, true);
  assert.equal(playlistCompositionSchema.safeParse({ tracks: [] }).success, false);
  const source = readFileSync(new URL("../helpers/default-props.ts", import.meta.url), "utf8");
  assert.match(source, /tracks:\s*\[defaultTrack,\s*defaultTrack\]/);
});
