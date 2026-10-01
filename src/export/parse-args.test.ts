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

test("背景动效默认放慢，也可改成静止", () => {
  assert.equal(parseExportArgs(["song.json"]).background, undefined);
  assert.equal(
    parseExportArgs(["song.json", "--background", "static"]).background,
    "static",
  );
});

test("无效背景动效会报错", () => {
  assert.throws(
    () => parseExportArgs(["song.json", "--background", "fast"]),
    UsageError,
  );
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

test("传入网易云歌单链接或 ID 时自动走歌单模式", () => {
  const byLink = parseExportArgs(["https://163cn.tv/bhAEMyxc"]);
  assert.equal(byLink.playlist, true);
  assert.equal(byLink.album, false);
  assert.equal(parseExportArgs(["8408326201"]).playlist, true);
  assert.equal(parseExportArgs(["song.json"]).playlist, false);
});

test("export.json 需要 --playlist 才走歌单画面", () => {
  const args = parseExportArgs(["tmp/mdl/8408326201/export.json", "--playlist"]);
  assert.equal(args.playlist, true);
  assert.equal(args.album, false);
});

test("歌单模式不能和 --album、.cue 混用", () => {
  assert.throws(
    () => parseExportArgs(["8408326201", "--album"]),
    UsageError,
  );
  assert.throws(
    () => parseExportArgs(["a.cue", "--playlist"]),
    UsageError,
  );
});

test("--server / --refresh / --prepare-only 只用于歌单", () => {
  assert.throws(
    () => parseExportArgs(["song.json", "--prepare-only"]),
    UsageError,
  );
  const args = parseExportArgs([
    "8408326201",
    "--server",
    "http://127.0.0.1:9000/music",
    "--refresh",
    "--prepare-only",
  ]);
  assert.equal(args.server, "http://127.0.0.1:9000/music");
  assert.equal(args.refresh, true);
  assert.equal(args.prepareOnly, true);
});
