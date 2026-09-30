import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOCK_COLS, BLOCK_ROWS } from "./blockTemplates";
import {
  getLatticeGeometry,
  layoutExpandedBlock,
  locateInstanceAt,
  locateNearestInstance,
} from "./layout";
import { buildPlaylistTiles } from "./tiles";

const metrics = { cellSize: 128, gap: 8 };
const pitch = metrics.cellSize + metrics.gap;

test("同一歌名出现两次仍是两个序号", () => {
  const tiles = buildPlaylistTiles([
    { songName: "甲", artistName: "一", coverImageUrl: "a.jpg" },
    { songName: "甲", artistName: "一", coverImageUrl: "a.jpg" },
  ]);
  assert.deepEqual(
    tiles.map((tile) => tile.queueIndex),
    [0, 1],
  );
  assert.equal(tiles[0]?.title, "甲");
  assert.equal(tiles[1]?.artist, "一");
  assert.equal(tiles[0]?.coverUrl, "a.jpg");
});

test("序号 0 的第一张在主格，展开后仍盖住整块", () => {
  const geometry = getLatticeGeometry(2, metrics);
  const active = locateInstanceAt(geometry, 2, 0, 0, 0, metrics);
  assert.ok(active);
  assert.equal(active.queueIndex, 0);
  assert.equal(active.cellSlot, 0);
  assert.equal(active.repeatX, 0);
  assert.equal(active.repeatY, 0);
  assert.equal((active.width + metrics.gap) % pitch, 0);

  const expanded = layoutExpandedBlock(geometry, 2, active, metrics);
  const activeRect = expanded.get(active.instanceId);
  assert.ok(activeRect);
  assert.equal(activeRect.width, 6 * pitch - metrics.gap);
  assert.equal(activeRect.height, 6 * pitch - metrics.gap);

  let area = 0;
  for (const rect of expanded.values()) {
    area += (rect.width + metrics.gap) * (rect.height + metrics.gap);
  }
  assert.equal(area, BLOCK_COLS * BLOCK_ROWS * pitch * pitch);
});

test("镜头中心落在某张海报上时最近的就是它", () => {
  const geometry = getLatticeGeometry(3, metrics);
  const origin = locateInstanceAt(geometry, 3, 0, 0, 0, metrics);
  assert.ok(origin);
  const nearest = locateNearestInstance(
    geometry,
    3,
    0,
    { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 },
    metrics,
  );
  assert.equal(nearest?.instanceId, origin.instanceId);
});
