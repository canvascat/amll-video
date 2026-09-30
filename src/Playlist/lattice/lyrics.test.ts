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

test("译文不跟随逐字填充", () => {
  const translated = layoutPlaylistLyric({
    lines: [
      line([["甲", 0, 1000]]),
      line([["你", 1000, 2000], ["好", 2000, 3000]], "译文"),
      line([["丙", 3000, 4000]]),
    ],
    timeMs: 1500,
    width: 400,
    height: 600,
    measure,
  }).filter((piece) => piece.translation);
  assert.ok(translated.length > 0);
  assert.equal(translated.every((piece) => piece.fill === 1), true);
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

test("当前句带上一句和下一句，译文只留在当前句", () => {
  const lines = [
    line([["甲", 0, 1000]]),
    line([["乙", 1000, 2000]], "译文"),
    line([["丙", 2000, 3000]], "下一句译文"),
  ];
  const pieces = layoutPlaylistLyric({
    lines,
    timeMs: 1500,
    width: 400,
    height: 600,
    measure,
  });
  const previous = pieces.find((piece) => piece.text === "甲");
  const current = pieces.find((piece) => piece.text === "乙");
  const next = pieces.find((piece) => piece.text === "丙");
  const translation = pieces.find((piece) => piece.translation);
  assert.equal(previous?.role, "previous");
  assert.equal(current?.role, "current");
  assert.equal(next?.role, "next");
  assert.ok(previous && current && next && translation);
  assert.ok(previous.blockY < current.blockY);
  assert.ok(next.blockY > current.blockY);
  assert.ok(translation.y > current.y);
  assert.equal(translation.blockY, current.blockY);
  assert.equal(translation.scale, current.scale);
  assert.equal(translation.blur, current.blur);
  assert.equal(translation.opacity, current.opacity);
  assert.equal(translation.lineKey, current.lineKey);
  assert.equal(pieces.some((piece) => piece.text.includes("下一句译文")), false);
});

test("切句时从原来的位置弹簧过去，新的一句淡入，离开的一句淡出", () => {
  const lines = [
    line([["甲", 0, 1000]]),
    line([["乙", 1000, 2000]], "译文"),
    line([["丙", 2000, 3000]]),
  ];
  const placed = (timeMs: number) => layoutPlaylistLyric({
    lines,
    timeMs,
    width: 400,
    height: 600,
    measure,
  });
  const atCut = placed(1000);
  const later = placed(1400);
  const yiCut = atCut.find((piece) => piece.text === "乙");
  const yiLater = later.find((piece) => piece.text === "乙");
  const bingCut = atCut.find((piece) => piece.text === "丙");
  const bingLater = later.find((piece) => piece.text === "丙");
  assert.ok(yiCut && yiLater && bingCut && bingLater);
  const translation = atCut.find((piece) => piece.translation);
  assert.equal(translation?.scale, yiCut.scale);
  assert.equal(translation?.blur, yiCut.blur);
  assert.equal(translation?.opacity, yiCut.opacity);
  assert.equal(translation?.fill, 1);
  const leavingTranslation = placed(2050).find((piece) => piece.translation);
  assert.equal(leavingTranslation?.leaving, true);
  assert.ok(leavingTranslation && leavingTranslation.opacity < 1);
  assert.ok(yiCut.scale < 0.8);
  assert.ok(yiLater.scale > yiCut.scale);
  assert.ok(bingCut.opacity < 0.2);
  assert.ok(bingLater.opacity > bingCut.opacity);
  const leaving = placed(2050).find((piece) => piece.text === "甲");
  assert.equal(leaving?.leaving, true);
  assert.ok(leaving && leaving.opacity < 0.52);
});

test("第一句没有上一句，句间只留刚唱完和即将到来的", () => {
  const lines = [
    line([["甲", 0, 1000]]),
    line([["乙", 1500, 2500]]),
  ];
  const opening = layoutPlaylistLyric({
    lines,
    timeMs: 100,
    width: 400,
    height: 600,
    measure,
  });
  assert.equal(opening.some((piece) => piece.role === "previous"), false);
  assert.equal(opening.some((piece) => piece.text === "乙" && piece.role === "next"), true);

  const gap = layoutPlaylistLyric({
    lines,
    timeMs: 1200,
    width: 400,
    height: 600,
    measure,
  });
  assert.deepEqual(
    gap.map((piece) => piece.role),
    ["previous", "next"],
  );
});

test("当前句取包含该毫秒的一行", () => {
  const lines = [line([["甲", 0, 1000]]), line([["乙", 1000, 2000]])];
  assert.equal(lyricLineAt(lines, 1000)?.words[0]?.word, "乙");
  assert.equal(lyricLineAt(lines, 2500), null);
});
