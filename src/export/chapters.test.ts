import assert from "node:assert/strict";
import { test } from "node:test";
import {
  albumChaptersFromTracks,
  buildChapterSidecar,
  buildFfmetadata,
  buildMuxChapterArgs,
  formatChapterClock,
} from "./chapters";

test("专辑章节从整轨偏移对齐到成片 0 点", () => {
  const chapters = albumChaptersFromTracks([
    {
      songName: "雪中莲",
      audioOffsetInSeconds: 0,
      audioEndInSeconds: 207.827,
    },
    {
      songName: "你在我心中",
      audioOffsetInSeconds: 207.827,
      audioEndInSeconds: 471.813,
    },
  ]);
  assert.equal(chapters[0]?.startSeconds, 0);
  assert.equal(chapters[1]?.startSeconds, 207.827);
  assert.equal(chapters[1]?.title, "你在我心中");
});

test("ffmetadata 用下一章起点作为本章结束，避免取整缝隙", () => {
  const text = buildFfmetadata({
    title: "菲靡靡之音",
    chapters: [
      { title: "雪中莲", startSeconds: 0, endSeconds: 207.827 },
      { title: "你在我心中", startSeconds: 207.827, endSeconds: 471.813 },
    ],
  });
  assert.match(text, /^;FFMETADATA1\ntitle=菲靡靡之音\n/);
  assert.match(text, /START=0\nEND=207827\ntitle=雪中莲/);
  assert.match(text, /START=207827\nEND=471813\ntitle=你在我心中/);
});

test("章节旁路文本方便对照时间", () => {
  assert.equal(formatChapterClock(207.827), "00:03:27");
  assert.equal(
    buildChapterSidecar([
      { title: "雪中莲", startSeconds: 0, endSeconds: 207.827 },
    ]),
    "00:00:00 雪中莲\n",
  );
});

test("写入章节只拷贝流，不重编码", () => {
  const args = buildMuxChapterArgs("in.mkv", "chapters.ffmeta", "out.mkv");
  assert.equal(args[args.indexOf("-c") + 1], "copy");
  assert.equal(args[args.indexOf("-map_metadata") + 1], "1");
  assert.equal(args[args.indexOf("-map_chapters") + 1], "1");
});
