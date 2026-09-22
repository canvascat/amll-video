import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHoldStillsArgs,
  buildImageConcatList,
  buildMuxArgs,
  collapseSharedSourceAudios,
  type ConcatAudioInput,
} from "./mux";

test("合成参数始终拷贝原音轨，不重编码", () => {
  const args = buildMuxArgs("video.mp4", "album.flac", "out.mkv");
  assert.equal(args[args.indexOf("-c:a") + 1], "copy");
  assert.equal(args[args.indexOf("-c:v") + 1], "copy");
  assert.ok(args.includes("album.flac"));
});

test("同一整轨文件的多首歌合成时仍用这一条原音轨", () => {
  const inputs: ConcatAudioInput[] = [
    { path: "/cd/album.flac", offsetInSeconds: 0, durationInSeconds: 228 },
    { path: "/cd/album.flac", offsetInSeconds: 228, durationInSeconds: 502 },
    { path: "/cd/album.flac", offsetInSeconds: 502, durationInSeconds: 824 },
  ];
  const collapsed = collapseSharedSourceAudios(inputs);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0]?.path, "/cd/album.flac");
  assert.equal(collapsed[0]?.offsetInSeconds, 0);
  assert.equal(collapsed[0]?.durationInSeconds, 824);
});

test("整轨不是从 0 开始时，也只保留一条原音轨而不是重编码拼接", () => {
  const collapsed = collapseSharedSourceAudios([
    { path: "album.flac", offsetInSeconds: 2, durationInSeconds: 120 },
    { path: "album.flac", offsetInSeconds: 120, durationInSeconds: 240 },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0]?.offsetInSeconds, 2);
  assert.equal(collapsed[0]?.durationInSeconds, 240);
});

test("不同文件才需要拼接", () => {
  const collapsed = collapseSharedSourceAudios([
    { path: "a.flac", offsetInSeconds: 0, durationInSeconds: 100 },
    { path: "b.flac", offsetInSeconds: 0, durationInSeconds: 80 },
  ]);
  assert.equal(collapsed.length, 2);
});

test("专辑静帧 concat 列表按曲目时长铺开，并重复最后一帧", () => {
  const list = buildImageConcatList([
    { path: "/tmp/cue-01.png", durationSeconds: 207.827 },
    { path: "/tmp/cue-02.png", durationSeconds: 263.986 },
  ]);
  assert.match(list, /^ffconcat version 1\.0\n/);
  assert.match(list, /file '\/tmp\/cue-01\.png'\nduration 207\.827/);
  assert.match(list, /file '\/tmp\/cue-02\.png'\nduration 263\.986\nfile '\/tmp\/cue-02\.png'\n$/);
});

test("铺开静帧用 fps 滤镜，不混用 fps_mode 和 -r", () => {
  const args = buildHoldStillsArgs("album-stills.txt", "video-only.mp4", 30);
  assert.equal(args[args.indexOf("-vf") + 1], "fps=30");
  assert.ok(!args.includes("-vsync"));
  assert.ok(!args.includes("-fps_mode"));
});
