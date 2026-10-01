import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  buildEntries,
  defaultPlaylistDir,
  resolvePlaylistId,
  sanitizeFileName,
  type PlaylistTrack,
} from "./netease-playlist";

const track = (id: string, name: string, artist: string): PlaylistTrack => ({
  id,
  name,
  artist,
  album: "",
  duration: 0,
  cover: "",
  extra: "",
});

test("歌单 ID 可从纯数字和各种链接里解析", async () => {
  assert.equal(await resolvePlaylistId("8408326201"), "8408326201");
  assert.equal(
    await resolvePlaylistId(
      "https://music.163.com/playlist?app_version=9.6.05&id=8408326201&userid=1",
    ),
    "8408326201",
  );
  assert.equal(
    await resolvePlaylistId("https://music.163.com/#/playlist?id=8408326201"),
    "8408326201",
  );
  assert.equal(
    await resolvePlaylistId("https://y.music.163.com/m/playlist/8408326201"),
    "8408326201",
  );
});

test("默认素材目录是项目根目录的 tmp/mdl/<歌单ID>", () => {
  assert.equal(
    defaultPlaylistDir("8408326201", "/project"),
    path.join("/project", "tmp", "mdl", "8408326201"),
  );
});

test("文件名去掉不能用的字符", () => {
  assert.equal(sanitizeFileName('AC/DC: "Back"?'), "AC_DC_ _Back__");
  assert.equal(sanitizeFileName("  ..  "), "untitled");
});

test("同名歌曲追加歌曲 ID，文件名不冲突", () => {
  const entries = buildEntries([
    track("1", "Imagine", "John Lennon"),
    track("2", "imagine", "john lennon"),
    track("3", "晴天", ""),
  ]);
  assert.equal(entries[0]?.base, "John Lennon - Imagine");
  assert.equal(entries[1]?.base, "john lennon - imagine (2)");
  assert.equal(entries[2]?.base, "晴天");
  assert.deepEqual(
    entries.map((entry) => entry.index),
    [1, 2, 3],
  );
});
