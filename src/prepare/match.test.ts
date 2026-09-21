import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pickBestCandidate,
  pickBestLyric,
  needsLyricAlign,
  shouldSearchLyrics,
} from "./match";
import type { LyricCandidate, ProviderLyric, TrackQuery } from "./types";

const query: TrackQuery = {
  title: "我愿意",
  artist: "王菲",
  album: "菲卖品 王菲精选",
  durationMs: 274_000,
};

function candidate(partial: Partial<LyricCandidate>): LyricCandidate {
  return {
    name: "我愿意",
    artist: "王菲",
    ...partial,
  };
}

function hit(
  format: ProviderLyric["format"],
  partial: Partial<LyricCandidate>,
  source: ProviderLyric["source"] = "netease",
): ProviderLyric {
  return {
    source,
    format,
    content: "[00:00.00]test",
    candidate: candidate(partial),
  };
}

test("跨源选词时，时长更接近的版本压过更好的歌词格式", () => {
  const chosen = pickBestLyric(
    [
      hit("yrc", { album: "随便看看", duration: 320_000 }),
      hit("lrc", { album: "菲卖品 王菲精选", duration: 274_500 }, "lrclib"),
    ],
    query,
  );
  assert.equal(chosen?.format, "lrc");
  assert.equal(chosen?.candidate.duration, 274_500);
});

test("时长同样接近时，才用更好的歌词格式", () => {
  const chosen = pickBestLyric(
    [
      hit("lrc", { duration: 273_000 }, "lrclib"),
      hit("yrc", { duration: 274_200 }),
    ],
    query,
  );
  assert.equal(chosen?.format, "yrc");
});

test("同一源里也优先时长接近的候选", () => {
  const chosen = pickBestCandidate(
    [
      candidate({ album: "浮躁", duration: 321_000 }),
      candidate({ album: "菲卖品 王菲精选", duration: 275_000 }),
    ],
    query,
  );
  assert.equal(chosen?.duration, 275_000);
});

test("时长差超过 5 秒才需要自动偏移", () => {
  assert.equal(
    needsLyricAlign(candidate({ duration: 274_200 }), query),
    false,
  );
  assert.equal(
    needsLyricAlign(candidate({ duration: 290_000 }), query),
    true,
  );
});

test("内嵌 lrc 仍要联网找更高优先级格式", () => {
  assert.equal(shouldSearchLyrics({ format: "lrc" }), true);
  assert.equal(shouldSearchLyrics({ format: "yrc" }), true);
  assert.equal(shouldSearchLyrics(undefined), true);
});

test("已经有 ttml 才跳过歌词搜索", () => {
  assert.equal(shouldSearchLyrics({ format: "ttml" }), false);
});

test("时长接近时 ttml 压过内嵌 lrc", () => {
  const chosen = pickBestLyric(
    [
      hit("lrc", { duration: 274_000 }, "embedded"),
      hit("ttml", { duration: 273_500 }, "amll-ttml"),
    ],
    query,
  );
  assert.equal(chosen?.format, "ttml");
  assert.equal(chosen?.source, "amll-ttml");
});
