import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOCK_COLS,
  BLOCK_ROWS,
  EXPANSION_SPAN,
  SLOTS_PER_BLOCK,
  getBlockReflow,
  getBlockTemplate,
  type BlockSlot,
} from "./blockTemplates";

function coversBlock(slots: readonly BlockSlot[]): boolean {
  const cells = Array.from({ length: BLOCK_ROWS }, () => Array(BLOCK_COLS).fill(0));
  for (const slot of slots) {
    for (let y = slot.y; y < slot.y + slot.rows; y += 1) {
      for (let x = slot.x; x < slot.x + slot.cols; x += 1) {
        if (y < 0 || x < 0 || y >= BLOCK_ROWS || x >= BLOCK_COLS) return false;
        cells[y][x] += 1;
      }
    }
  }
  return cells.every((row) => row.every((count) => count === 1));
}

test("每块版式铺满 12×8 且槽位数固定", () => {
  for (const [column, row] of [[0, 0], [1, 0], [0, 1], [3, 5]]) {
    const slots = getBlockTemplate(column, row);
    assert.equal(slots.length, SLOTS_PER_BLOCK);
    assert.equal(coversBlock(slots), true);
  }
});

test("任一槽展开成 6×6 后整块仍然铺满", () => {
  for (const [column, row] of [[0, 0], [1, 2], [4, 1]]) {
    for (let slot = 0; slot < SLOTS_PER_BLOCK; slot += 1) {
      const reflow = getBlockReflow(column, row, slot);
      assert.ok(reflow);
      assert.equal(reflow.length, SLOTS_PER_BLOCK);
      assert.equal(reflow[slot]?.cols, EXPANSION_SPAN.cols);
      assert.equal(reflow[slot]?.rows, EXPANSION_SPAN.rows);
      assert.equal(coversBlock(reflow), true);
    }
  }
});
