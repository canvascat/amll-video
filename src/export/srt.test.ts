import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  albumSrtCuesFromTracks,
  buildSrt,
  formatSrtTimestamp,
} from "./srt";

function line(startMs: number, endMs: number, text: string): LyricLine {
  return {
    words: [{ word: text, startTime: startMs, endTime: endMs, obscene: false }],
    startTime: startMs,
    endTime: endMs,
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  };
}

test("SRT 时间码用逗号分隔毫秒", () => {
  assert.equal(formatSrtTimestamp(207_827), "00:03:27,827");
  assert.equal(formatSrtTimestamp(0), "00:00:00,000");
});

test("专辑第二首歌的歌词要叠到整轨时间轴上", () => {
  const cues = albumSrtCuesFromTracks([
    {
      songName: "雪中莲",
      audioOffsetInSeconds: 0,
      audioEndInSeconds: 207.827,
      lyricLines: [line(46_480, 48_070, "雪花飘")],
    },
    {
      songName: "你在我心中",
      audioOffsetInSeconds: 207.827,
      audioEndInSeconds: 471.813,
      lyricOffsetMs: 0,
      lyricLines: [line(27_370, 29_040, "你说过你一定")],
    },
  ]);
  assert.equal(cues[0]?.startMs, 46_480);
  assert.equal(cues[0]?.text, "雪花飘");
  assert.equal(cues[1]?.startMs, 207_827 + 27_370);
  assert.equal(cues[1]?.text, "你说过你一定");
});

test("lyricOffsetMs 和成片零点对齐后一起生效", () => {
  const cues = albumSrtCuesFromTracks([
    {
      audioOffsetInSeconds: 10,
      audioEndInSeconds: 30,
      lyricOffsetMs: 1550,
      lyricLines: [line(1000, 2000, "莲花")],
    },
  ]);
  assert.equal(cues[0]?.startMs, 1550 + 1000);
  assert.equal(cues[0]?.endMs, 1550 + 2000);
});

test("跳过作词作曲，并裁到本曲结束", () => {
  const cues = albumSrtCuesFromTracks([
    {
      audioOffsetInSeconds: 0,
      audioEndInSeconds: 5,
      lyricLines: [
        line(0, 1000, "作词: 黄东昆"),
        line(4000, 8000, "雪花飘"),
      ],
    },
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0]?.text, "雪花飘");
  assert.equal(cues[0]?.endMs, 5000);
});

test("跳过繁体署名和歌手-歌名行", () => {
  const cues = albumSrtCuesFromTracks([
    {
      songName: "但愿人长久",
      audioOffsetInSeconds: 0,
      audioEndInSeconds: 20,
      lyricLines: [
        line(0, 500, "作詞 : 蘇軾"),
        line(500, 1000, "王菲 - 但愿人长久"),
        line(11640, 16570, "明月几时有"),
      ],
    },
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0]?.text, "明月几时有");
});

test("跳过原唱与英文制作名单", () => {
  const cues = albumSrtCuesFromTracks([
    {
      audioOffsetInSeconds: 0,
      audioEndInSeconds: 20,
      lyricLines: [
        line(0, 700, "原唱 : 邓丽君"),
        line(1340, 2200, "Produced by Alvin Leong 梁荣骏"),
        line(11340, 14790, "明月几时有"),
      ],
    },
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0]?.text, "明月几时有");
});

test("buildSrt 输出 B 站可上传的编号块", () => {
  const text = buildSrt([
    { startMs: 0, endMs: 1500, text: "雪花飘" },
    { startMs: 1500, endMs: 3000, text: "雪花飞" },
  ]);
  assert.equal(
    text,
    [
      "1",
      "00:00:00,000 --> 00:00:01,500",
      "雪花飘",
      "",
      "2",
      "00:00:01,500 --> 00:00:03,000",
      "雪花飞",
      "",
    ].join("\n"),
  );
});
