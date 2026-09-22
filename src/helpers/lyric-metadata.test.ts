import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripLyricMetadata } from "./lyric-metadata";

function line(text: string, startMs = 0): LyricLine {
  return {
    words: [{ word: text, startTime: startMs, endTime: startMs + 500, obscene: false }],
    startTime: startMs,
    endTime: startMs + 500,
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  };
}

function texts(lines: readonly LyricLine[]): string[] {
  return lines.map((item) => item.words.map((word) => word.word).join(""));
}

test("去掉开头的歌名歌手和词曲信息，以及结尾的制作人", () => {
  const cleaned = stripLyricMetadata(
    [
      line("IRIS OUT - 米津玄師 （よねづ けんし）"),
      line("词：米津玄師"),
      line("曲：米津玄師"),
      line("编曲：米津玄師"),
      line("制作人：米津玄師"),
      line("駄目駄目駄目", 18_000),
      line("制作人：米津玄師", 140_000),
    ],
    { title: "IRIS OUT", artists: "米津玄師" },
  );
  assert.deepEqual(texts(cleaned), ["駄目駄目駄目"]);
});

test("正文里的冒号句保留", () => {
  const cleaned = stripLyricMetadata(
    [line("君：好きだ"), line("駄目駄目駄目"), line("曲终")],
    { title: "IRIS OUT", artists: "米津玄師" },
  );
  assert.deepEqual(texts(cleaned), ["君：好きだ", "駄目駄目駄目", "曲终"]);
});
