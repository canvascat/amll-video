import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cameraFlightProgress,
  playlistMotionAt,
  springProgress,
  WALL_SCALE,
} from "./motion";
import { playlistTrackSpans } from "./timeline";

const fps = 30;

function between(value: number, start: number, end: number): boolean {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  return value > low && value < high;
}

test("镜头缓出，弹簧在 0.2 秒时还在中途", () => {
  assert.equal(cameraFlightProgress(0), 0);
  assert.equal(cameraFlightProgress(0.42), 1);
  assert.ok(cameraFlightProgress(0.21) > 0.5);
  const sprung = springProgress(0.2);
  assert.ok(sprung > 0 && sprung < 1);
});

test("开场已对准第一首，切歌从原位飞到下一首", () => {
  const spans = playlistTrackSpans(
    [
      { durationInSeconds: 2, audioOffsetInSeconds: 0 },
      { durationInSeconds: 2, audioOffsetInSeconds: 0 },
    ],
    fps,
  );
  const opening = playlistMotionAt(0, fps, spans);
  assert.equal(opening.activeQueueIndex, 0);
  assert.equal(opening.lyricsVisible, true);
  assert.equal(opening.camera.scale, WALL_SCALE);
  assert.equal(opening.localSeconds, 0);
  const openingPoster = opening.posters.find((poster) => poster.active);
  assert.ok(openingPoster);
  const centerX = opening.camera.x + (openingPoster.x + openingPoster.width / 2) * WALL_SCALE;
  const centerY = opening.camera.y + (openingPoster.y + openingPoster.height / 2) * WALL_SCALE;
  assert.ok(Math.abs(centerX - 960) < 1);
  assert.ok(Math.abs(centerY - 540) < 1);

  const beforeCut = playlistMotionAt(59, fps, spans);
  const atCut = playlistMotionAt(60, fps, spans);
  assert.equal(atCut.activeQueueIndex, 1);
  assert.equal(atCut.localSeconds, 0);
  assert.equal(atCut.lyricsVisible, false);
  assert.equal(atCut.camera.x, beforeCut.camera.x);
  assert.equal(atCut.camera.y, beforeCut.camera.y);

  const arrived = playlistMotionAt(60 + Math.round(0.42 * fps), fps, spans);
  assert.notEqual(arrived.camera.y, atCut.camera.y);
  assert.equal(arrived.lyricsVisible, true);

  const mid = playlistMotionAt(60 + Math.round(0.2 * fps), fps, spans);
  const active = mid.posters.find((poster) => poster.instanceId === mid.activeInstanceId);
  const activeAtCut = atCut.posters.find((poster) => poster.instanceId === atCut.activeInstanceId);
  const activeArrived = arrived.posters.find((poster) => poster.instanceId === arrived.activeInstanceId);
  assert.ok(active && activeAtCut && activeArrived);
  assert.ok(between(active.width, activeAtCut.width, activeArrived.width));
});
