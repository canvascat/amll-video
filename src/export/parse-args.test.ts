import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UsageError,
  defaultRenderConcurrency,
  parseExportArgs,
} from "./parse-args";

test("WebGL 导出默认最多 4 路，约为 CPU 一半", () => {
  assert.equal(defaultRenderConcurrency(10), 4);
  assert.equal(defaultRenderConcurrency(8), 4);
  assert.equal(defaultRenderConcurrency(4), 2);
  assert.equal(defaultRenderConcurrency(2), 1);
  assert.equal(defaultRenderConcurrency(1), 1);
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
