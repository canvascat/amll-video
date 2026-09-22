import assert from "node:assert/strict";
import { test } from "node:test";
import {
  albumSpanInFrames,
  trackIndexAtAudioSeconds,
  trackDurationInFrames,
  trackIndexAtFrame,
} from "./track-duration";

const fps = 30;

test("trackDurationInFrames 按可播时长取整，至少 1 帧", () => {
  assert.equal(trackDurationInFrames(1, 0, fps), 30);
  assert.equal(trackDurationInFrames(10, 2, fps, 5), 90);
  assert.equal(trackDurationInFrames(0, 0, fps), 1);
});

test("专辑切歌按帧落到当前曲目，封面层可以一直挂着只换歌名", () => {
  const tracks = [
    { durationInSeconds: 1, audioOffsetInSeconds: 0 },
    { durationInSeconds: 2, audioOffsetInSeconds: 1, audioEndInSeconds: 3 },
    { durationInSeconds: 4, audioOffsetInSeconds: 3, audioEndInSeconds: 4 },
  ];

  assert.equal(trackIndexAtFrame(tracks, 0, fps), 0);
  assert.equal(trackIndexAtFrame(tracks, 29, fps), 0);
  assert.equal(trackIndexAtFrame(tracks, 30, fps), 1);
  assert.equal(trackIndexAtFrame(tracks, 89, fps), 1);
  assert.equal(trackIndexAtFrame(tracks, 90, fps), 2);
  assert.equal(trackIndexAtFrame(tracks, 999, fps), 2);
});

test("空列表时 trackIndexAtFrame 返回 0", () => {
  assert.equal(trackIndexAtFrame([], 10, fps), 0);
});

test("专辑按整轨音频时间切歌名，结束点归下一首", () => {
  const tracks = [
    { audioOffsetInSeconds: 0, audioEndInSeconds: 207.827 },
    { audioOffsetInSeconds: 207.827, audioEndInSeconds: 471.813 },
    { audioOffsetInSeconds: 471.813, audioEndInSeconds: 732 },
  ];

  assert.equal(trackIndexAtAudioSeconds(tracks, 0), 0);
  assert.equal(trackIndexAtAudioSeconds(tracks, 207.826), 0);
  assert.equal(trackIndexAtAudioSeconds(tracks, 207.827), 1);
  assert.equal(trackIndexAtAudioSeconds(tracks, 731.9), 2);
  assert.equal(trackIndexAtAudioSeconds(tracks, 9999), 2);
  assert.equal(trackIndexAtAudioSeconds([], 10), 0);
});

test("整轨专辑时长取最后结束点减开头偏移", () => {
  const tracks = [
    { audioOffsetInSeconds: 2, audioEndInSeconds: 100 },
    { audioOffsetInSeconds: 100, audioEndInSeconds: 250 },
  ];
  assert.equal(albumSpanInFrames(tracks, fps), 248 * fps);
});
