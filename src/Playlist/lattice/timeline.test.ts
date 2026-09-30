import assert from "node:assert/strict";
import { test } from "node:test";
import { playlistTimeAtFrame, playlistTrackSpans } from "./timeline";

const fps = 30;

test("三首帧段首尾相接，内部秒数从该首起点重计", () => {
  const spans = playlistTrackSpans(
    [
      { durationInSeconds: 2, audioOffsetInSeconds: 0 },
      { durationInSeconds: 10, audioOffsetInSeconds: 1, audioEndInSeconds: 4 },
      { durationInSeconds: 5, audioOffsetInSeconds: 0 },
    ],
    fps,
  );
  assert.deepEqual(
    spans.map((span) => [span.index, span.startFrame, span.durationInFrames]),
    [
      [0, 0, 60],
      [1, 60, 90],
      [2, 150, 150],
    ],
  );
  assert.equal(spans.reduce((sum, span) => sum + span.durationInFrames, 0), 300);
  assert.deepEqual(playlistTimeAtFrame(spans, 0, fps), { index: 0, localSeconds: 0 });
  assert.deepEqual(playlistTimeAtFrame(spans, 59, fps), { index: 0, localSeconds: 59 / fps });
  assert.deepEqual(playlistTimeAtFrame(spans, 60, fps), { index: 1, localSeconds: 0 });
  assert.deepEqual(playlistTimeAtFrame(spans, 299, fps), { index: 2, localSeconds: 149 / fps });
});
