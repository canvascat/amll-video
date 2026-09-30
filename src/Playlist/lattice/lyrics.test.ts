import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPlaylistLyric, lyricLineAt } from "./lyrics";

function line(words: Array<[string, number, number]>, translatedLyric = ""): LyricLine {
  return {
    words: words.map(([word, startTime, endTime]) => ({ word, startTime, endTime, obscene: false })),
    startTime: words[0]?.[1] ?? 0,
    endTime: words[words.length - 1]?.[2] ?? 0,
    translatedLyric,
    romanLyric: "不要画罗马音",
    isBG: false,
    isDuet: false,
  };
}

const measure = (text: string) => ({ width: text.length * 10, height: 20 });

test("逐字时间错开时按比例填充", () => {
  const current = line([
    ["你", 0, 1000],
    ["好", 1000, 2000],
  ]);
  const pieces = layoutPlaylistLyric({
    line: current,
    timeMs: 1500,
    width: 400,
    height: 200,
    measure,
  });
  const main = pieces.filter((piece) => !piece.translation);
  assert.equal(main[0]?.text, "你");
  assert.equal(main[0]?.fill, 1);
  assert.equal(main[1]?.text, "好");
  assert.equal(main[1]?.fill, 0.5);
  assert.equal(main[0]?.y, main[1]?.y);
  assert.equal(main[1]?.x, (main[0]?.x ?? 0) + (main[0]?.width ?? 0));
});

test("一行放不下时换到下一行，超宽的词按字素切开", () => {
  const current = line([
    ["你", 0, 1000],
    ["好", 1000, 2000],
    ["很长的一个词", 2000, 3000],
  ]);
  const pieces = layoutPlaylistLyric({
    line: current,
    timeMs: 0,
    width: 67,
    height: 200,
    measure,
  }).filter((piece) => !piece.translation);
  assert.equal(pieces[0]?.text, "你");
  assert.equal(pieces[1]?.y, (pieces[0]?.y ?? 0) + 38);
  assert.equal(pieces[1]?.x, 0);
  assert.ok(pieces.some((piece) => piece.text.length > 0 && piece.text.length < "很长的一个词".length));
});

test("词的起止等于整行时，行一开始就整句出现", () => {
  const current = line([["整句", 1000, 3000]]);
  const before = layoutPlaylistLyric({
    line: current,
    timeMs: 999,
    width: 400,
    height: 200,
    measure,
  });
  const atStart = layoutPlaylistLyric({
    line: current,
    timeMs: 1000,
    width: 400,
    height: 200,
    measure,
  });
  assert.equal(before.every((piece) => piece.fill === 0), true);
  assert.equal(atStart.every((piece) => piece.fill === 1), true);
});

test("没有译文不产生译文行，有译文最多两行", () => {
  const plain = layoutPlaylistLyric({
    line: line([["主", 0, 1000]]),
    timeMs: 0,
    width: 400,
    height: 200,
    measure,
  });
  assert.equal(plain.some((piece) => piece.translation), false);

  const translated = layoutPlaylistLyric({
    line: line([["主", 0, 1000]], "一二三四五六七八九十甲乙丙丁"),
    timeMs: 0,
    width: 50,
    height: 400,
    measure,
  });
  const rows = new Set(translated.filter((piece) => piece.translation).map((piece) => piece.y));
  assert.ok(rows.size > 0);
  assert.ok(rows.size <= 2);
  assert.equal(translated.some((piece) => piece.text.includes("罗马")), false);
});

test("当前句取包含该毫秒的一行", () => {
  const lines = [line([["甲", 0, 1000]]), line([["乙", 1000, 2000]])];
  assert.equal(lyricLineAt(lines, 1000)?.words[0]?.word, "乙");
  assert.equal(lyricLineAt(lines, 2500), null);
});
