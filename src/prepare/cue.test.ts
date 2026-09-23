import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { cueIndexToSeconds, parseCueSheet } from "./cue";

test("CUE INDEX 以 75 帧为一秒", () => {
  assert.equal(cueIndexToSeconds("03:48:32"), 3 * 60 + 48 + 32 / 75);
});

test("整轨 CUE 解析出共用文件名和每首的开始时间", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "rmv-cue-"));
  const cuePath = path.join(dir, "album.cue");
  await writeFile(
    cuePath,
    [
      'PERFORMER "王菲"',
      'TITLE "菲卖品"',
      'FILE "album.flac" WAVE',
      "  TRACK 01 AUDIO",
      '    TITLE "不得了"',
      "    INDEX 01 00:00:00",
      "  TRACK 02 AUDIO",
      '    TITLE "我愿意"',
      "    INDEX 01 03:48:32",
      "",
    ].join("\n"),
    "utf8",
  );

  const sheet = await parseCueSheet(cuePath);
  assert.equal(sheet.albumTitle, "菲卖品");
  assert.equal(sheet.albumPerformer, "王菲");
  assert.equal(sheet.tracks.length, 2);
  assert.equal(sheet.tracks[0]?.title, "不得了");
  assert.equal(sheet.tracks[0]?.file, "album.flac");
  assert.equal(sheet.tracks[0]?.startSeconds, 0);
  assert.equal(sheet.tracks[1]?.title, "我愿意");
  assert.equal(sheet.tracks[1]?.file, "album.flac");
  assert.equal(sheet.tracks[1]?.startSeconds, 3 * 60 + 48 + 32 / 75);
});
