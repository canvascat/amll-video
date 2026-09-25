import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSuspectedOffsets } from "./album-srt";

test("疑似偏移只列曲目，不表示已经写入", () => {
  const text = formatSuspectedOffsets([
    { songName: "城里的月光", offsetMs: -14400, source: "lrclib", format: "lrc" },
  ]);
  assert.match(text, /未写入字幕/);
  assert.match(text, /城里的月光  -14400ms  lrclib lrc/);
});

test("没有疑似偏移时直接说明", () => {
  assert.equal(formatSuspectedOffsets([]), "没有疑似偏移的曲目");
});
