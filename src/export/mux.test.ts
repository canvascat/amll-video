import assert from "node:assert/strict";
import { test } from "node:test";
import {
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
