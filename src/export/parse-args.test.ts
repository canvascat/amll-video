import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UsageError,
  defaultRenderConcurrency,
  parseExportArgs,
} from "./parse-args";

test("导出默认 1 路并行", () => {
  assert.equal(defaultRenderConcurrency(), 1);
});

test("可显式指定并行路数或百分比", () => {
  assert.equal(parseExportArgs(["album.json", "--concurrency", "8"]).concurrency, "8");
  assert.equal(
    parseExportArgs(["album.json", "--concurrency", "50%"]).concurrency,
    "50%",
  );
});

test("未指定时用默认并行路数", () => {
  const args = parseExportArgs(["album.json"]);
  assert.equal(args.concurrency, String(defaultRenderConcurrency()));
  assert.equal(args.album, false);
});

test("--album 走专辑播放器", () => {
  const args = parseExportArgs(["album.json", "--album"]);
  assert.equal(args.album, true);
});

test("--srt 只生成专辑字幕", () => {
  const args = parseExportArgs(["月光之城.cue", "--srt"]);
  assert.equal(args.srt, true);
  assert.equal(args.album, true);
});

test("传入 .cue 时自动走专辑模式", () => {
  const args = parseExportArgs(["菲卖品.cue"]);
  assert.equal(args.album, true);
  assert.equal(args.config, "菲卖品.cue");
});

test("无效并行路数会报错", () => {
  assert.throws(
    () => parseExportArgs(["album.json", "--concurrency", "0"]),
    UsageError,
  );
  assert.throws(
    () => parseExportArgs(["album.json", "--concurrency", "nope"]),
    UsageError,
  );
});
