import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { PREPARE_DIRNAME, listRelatedFiles, stagePrepareInput } from "./stage";

test("相关文件包含同名词和目录封面", async () => {
  const album = await mkdtemp(path.join(tmpdir(), "rmv-stage-src-"));
  const audio = path.join(album, "01. song.flac");
  await writeFile(audio, "audio");
  await writeFile(path.join(album, "cover.jpg"), "cover");
  await writeFile(path.join(album, "01. song.lrc"), "lyric");
  await writeFile(path.join(album, "02. other.flac"), "other");

  const related = listRelatedFiles(audio).map((file) => path.basename(file));
  assert.deepEqual(related.sort(), ["01. song.lrc", "cover.jpg"]);
});

test("拷贝目标文件和相关文件到项目根下的预处理目录", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "rmv-stage-root-"));
  const album = await mkdtemp(path.join(tmpdir(), "rmv-stage-album-"));
  const audio = path.join(album, "01. song.flac");
  await writeFile(audio, "audio-bytes");
  await writeFile(path.join(album, "cover.jpg"), "cover-bytes");

  const staged = await stagePrepareInput(audio, root);
  const folder = path.basename(album);
  assert.equal(staged.dir, path.join(root, PREPARE_DIRNAME, folder));
  assert.equal(staged.inputPath, path.join(staged.dir, "01. song.flac"));
  assert.equal(await readFile(staged.inputPath, "utf8"), "audio-bytes");
  assert.equal(
    await readFile(path.join(staged.dir, "cover.jpg"), "utf8"),
    "cover-bytes",
  );
});
