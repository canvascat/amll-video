# Playlist Lattice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `PlaylistPlayer` composition that plays an ordered list of tracks as a Folia-style poster wall, with the current track expanded and the camera flying to the next track.

**Architecture:** Copy Folia's block templates, reflow tables, and lattice layout from commit `6fe68d89abb7031eb266d71fda01b36a0fa0573e`. Drive the camera, spring, and lyric fill from the Remotion frame. Do not mount Folia's React, Pixi, or framer-motion code.

**Tech Stack:** Remotion 4.0.527, React 19, TypeScript, Node's built-in test runner, existing `LyricLine` / `trackSchema` / `trackDurationInFrames`.

## Global Constraints

- Composition id is `PlaylistPlayer`, 1920×1080, 30fps. Leave `AMLLPlayer` and `AlbumPlayer` unchanged.
- Do not add prepare or export CLI in this plan.
- Do not call Folia Stage or lyric HTTP APIs.
- Cell size 128, gap 8, scale 0.76. Scale never changes.
- Camera flight is 0.42s with cubic bezier `[0.22, 1, 0.36, 1]`.
- Poster spring is mass 1, stiffness 300, damping 34, starting from rest.
- Lyrics appear when the active poster's width and height are each within 1px of the target, or 1s after the cut, whichever comes first. Frame 0 is already settled.
- Overscan 500px. At most 400 posters in one frame.
- Vignette: radial gradient, transparent through 78%, edge `rgba(0, 0, 0, 0.52)`.
- Queue identity is the track index. The same title twice is two posters.
- No playback controls, no entrance wave, no daylight mode, no romanization.
- Badge text is `正在播放 · 01` on every poster of the current index, otherwise a two-digit index starting at `01`.
- Collapsed posters, and the expanding poster before the spring settles, show title and artist. After settle, the active instance also shows the current lyric line.
- Font is `playerFontFamily`, white.
- Word times that are not staggered with the line: the whole line appears at `startTime`. Do not synthesize word times.
- `translatedLyric` draws at most two rows under the main line. Empty translation draws nothing.
- When every track already has `durationInSeconds` and `lyricLines`, do not read audio or lyric files.
- Audio in the composition is for Studio preview only (`!isRendering`), matching `SongPlayer`. Render stays silent.
- Tests use `node --experimental-strip-types --import ./scripts/register-ts.mjs --test <file>`.
- Folia source commit for copied files: `6fe68d89abb7031eb266d71fda01b36a0fa0573e`.

---

### Task 1: Block templates and reflow tables

**Files:**
- Create: `scripts/register-ts.mjs`
- Create: `scripts/resolve-ts.mjs`
- Create: `src/Playlist/lattice/blockTemplates.ts`
- Create: `src/Playlist/lattice/blockReflows.ts`
- Test: `src/Playlist/lattice/blockTemplates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `BlockSlot = { x: number; y: number; cols: number; rows: number }`
  - `BLOCK_COLS = 12`, `BLOCK_ROWS = 8`, `SLOTS_PER_BLOCK = 12`
  - `EXPANSION_SPAN = { cols: 6, rows: 6 }`
  - `getBlockTemplate(blockColumn: number, blockRow: number): BlockSlot[]`
  - `getBlockReflow(blockColumn: number, blockRow: number, expandedSlot: number): BlockSlot[] | null`

- [ ] **Step 1: Add the TypeScript test resolver**

`scripts/resolve-ts.mjs`:

```js
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith(".");
  const hasExtension = /\.(ts|js|json|mjs|cjs)$/.test(specifier);
  if (isRelative && !hasExtension && context.parentURL) {
    const parent = dirname(fileURLToPath(context.parentURL));
    const candidate = join(parent, `${specifier}.ts`);
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
```

`scripts/register-ts.mjs`:

```js
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
```

- [ ] **Step 2: Write the failing test**

`src/Playlist/lattice/blockTemplates.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/blockTemplates.test.ts`

Expected: FAIL because `./blockTemplates` cannot be found.

- [ ] **Step 4: Copy the Folia sources**

```bash
mkdir -p src/Playlist/lattice
gh api "repos/chthollyphile/folia-major/contents/src/components/app/lattice/blockTemplates.ts?ref=6fe68d89abb7031eb266d71fda01b36a0fa0573e" --jq .content | base64 -d > src/Playlist/lattice/blockTemplates.ts
gh api "repos/chthollyphile/folia-major/contents/src/components/app/lattice/blockReflows.ts?ref=6fe68d89abb7031eb266d71fda01b36a0fa0573e" --jq .content | base64 -d > src/Playlist/lattice/blockReflows.ts
```

Do not edit the slot arrays. The two files already import each other from the same directory.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/blockTemplates.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/register-ts.mjs scripts/resolve-ts.mjs src/Playlist/lattice/blockTemplates.ts src/Playlist/lattice/blockReflows.ts src/Playlist/lattice/blockTemplates.test.ts
git commit -m "$(cat <<'EOF'
Add Folia's lattice block templates for the playlist wall.

EOF
)"
```

### Task 2: Lattice layout and playlist tiles

**Files:**
- Create: `src/Playlist/lattice/layout.ts`
- Create: `src/Playlist/lattice/tiles.ts`
- Test: `src/Playlist/lattice/layout.test.ts`

**Interfaces:**
- Consumes: `getBlockTemplate`, `getBlockReflow`, `SLOTS_PER_BLOCK` from Task 1
- Produces:
  - `WallMetrics = { cellSize: number; gap: number }`
  - `QueueInstance` with `instanceId`, `queueIndex`, `cellSlot`, `repeatX`, `repeatY`, `x`, `y`, `width`, `height`
  - `getLatticeGeometry(totalEntries: number, metrics: WallMetrics)`
  - `locateInstanceAt(geometry, totalEntries, absoluteColumn, absoluteRow, slotIndex, metrics): QueueInstance | null`
  - `locateNearestInstance(geometry, totalEntries, queueIndex, point: { x: number; y: number }, metrics): QueueInstance | null`
  - `layoutLattice(geometry, totalEntries, bounds, overscan, metrics): QueueInstance[]`
  - `layoutExpandedBlock(geometry, totalEntries, active: QueueInstance, metrics): Map<string, { x: number; y: number; width: number; height: number }>`
  - `PlaylistTile = { queueIndex: number; title: string; artist: string; coverUrl?: string }`
  - `buildPlaylistTiles(tracks: readonly { songName?: string; artistName?: string; coverImageUrl?: string }[]): PlaylistTile[]`

- [ ] **Step 1: Write the failing test**

`src/Playlist/lattice/layout.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/layout.test.ts`

Expected: FAIL because `./layout` cannot be found.

- [ ] **Step 3: Copy layout and add tiles**

```bash
gh api "repos/chthollyphile/folia-major/contents/src/components/app/lattice/layout.ts?ref=6fe68d89abb7031eb266d71fda01b36a0fa0573e" --jq .content | base64 -d > src/Playlist/lattice/layout.ts
```

Do not edit `layout.ts`. Its imports already point at `./blockTemplates`.

`src/Playlist/lattice/tiles.ts`:

```ts
export type PlaylistTile = {
  queueIndex: number;
  title: string;
  artist: string;
  coverUrl?: string;
};

export function buildPlaylistTiles(
  tracks: readonly {
    songName?: string;
    artistName?: string;
    coverImageUrl?: string;
  }[],
): PlaylistTile[] {
  return tracks.map((track, queueIndex) => ({
    queueIndex,
    title: track.songName?.trim() || "未知歌曲",
    artist: track.artistName?.trim() || "未知创作者",
    coverUrl: track.coverImageUrl,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/layout.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Playlist/lattice/layout.ts src/Playlist/lattice/tiles.ts src/Playlist/lattice/layout.test.ts
git commit -m "$(cat <<'EOF'
Add lattice layout and playlist tiles keyed by queue index.

EOF
)"
```

### Task 3: Playlist timeline

**Files:**
- Create: `src/Playlist/lattice/timeline.ts`
- Test: `src/Playlist/lattice/timeline.test.ts`

**Interfaces:**
- Consumes: `trackDurationInFrames` from `src/helpers/track-duration.ts`
- Produces:
  - `TrackSpan = { index: number; startFrame: number; durationInFrames: number }`
  - `playlistTrackSpans(tracks: readonly { durationInSeconds?: number; audioOffsetInSeconds: number; audioEndInSeconds?: number }[], fps: number): TrackSpan[]`
  - `playlistTimeAtFrame(spans: readonly TrackSpan[], frame: number, fps: number): { index: number; localSeconds: number }`

- [ ] **Step 1: Write the failing test**

`src/Playlist/lattice/timeline.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/timeline.test.ts`

Expected: FAIL because `./timeline` cannot be found.

- [ ] **Step 3: Write the timeline**

`src/Playlist/lattice/timeline.ts`:

```ts
import { trackDurationInFrames } from "../../helpers/track-duration";

export type TrackSpan = {
  index: number;
  startFrame: number;
  durationInFrames: number;
};

type TimedTrack = {
  durationInSeconds?: number;
  audioOffsetInSeconds: number;
  audioEndInSeconds?: number;
};

export function playlistTrackSpans(tracks: readonly TimedTrack[], fps: number): TrackSpan[] {
  let startFrame = 0;
  return tracks.map((track, index) => {
    const durationInFrames = trackDurationInFrames(
      track.durationInSeconds ?? 0,
      track.audioOffsetInSeconds,
      fps,
      track.audioEndInSeconds,
    );
    const span = { index, startFrame, durationInFrames };
    startFrame += durationInFrames;
    return span;
  });
}

export function playlistTimeAtFrame(
  spans: readonly TrackSpan[],
  frame: number,
  fps: number,
): { index: number; localSeconds: number } {
  const last = spans[spans.length - 1];
  if (!last) {
    return { index: 0, localSeconds: 0 };
  }
  const span = spans.find((item, index) => {
    const next = spans[index + 1];
    return frame < item.startFrame + item.durationInFrames || !next;
  }) ?? last;
  const localFrame = Math.min(
    Math.max(0, frame - span.startFrame),
    Math.max(0, span.durationInFrames - 1),
  );
  return { index: span.index, localSeconds: localFrame / fps };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/timeline.test.ts`

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/Playlist/lattice/timeline.ts src/Playlist/lattice/timeline.test.ts
git commit -m "$(cat <<'EOF'
Add a playlist timeline that abuts each track's frames.

EOF
)"
```

### Task 4: Camera and expansion spring

**Files:**
- Create: `src/Playlist/lattice/motion.ts`
- Test: `src/Playlist/lattice/motion.test.ts`

**Interfaces:**
- Consumes: `getLatticeGeometry`, `locateInstanceAt`, `locateNearestInstance`, `layoutLattice`, `layoutExpandedBlock`, `QueueInstance` from Task 2; `TrackSpan`, `playlistTimeAtFrame` from Task 3
- Produces:
  - `WALL_METRICS = { cellSize: 128, gap: 8 }`
  - `WALL_SCALE = 0.76`
  - `VIEWPORT = { width: 1920, height: 1080 }`
  - `cameraFlightProgress(elapsedSeconds: number): number`
  - `springProgress(elapsedSeconds: number): number`
  - `PosterFrame = { instanceId: string; queueIndex: number; x: number; y: number; width: number; height: number; active: boolean }`
  - `PlaylistMotion = { camera: { x: number; y: number; scale: number }; posters: PosterFrame[]; activeQueueIndex: number; activeInstanceId: string; lyricsVisible: boolean; localSeconds: number }`
  - `playlistMotionAt(frame: number, fps: number, spans: readonly TrackSpan[]): PlaylistMotion`

- [ ] **Step 1: Write the failing test**

`src/Playlist/lattice/motion.test.ts`:

```ts
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
  assert.notEqual(arrived.camera.x, atCut.camera.x);
  assert.equal(arrived.lyricsVisible, true);

  const mid = playlistMotionAt(60 + Math.round(0.2 * fps), fps, spans);
  const active = mid.posters.find((poster) => poster.instanceId === mid.activeInstanceId);
  const activeAtCut = atCut.posters.find((poster) => poster.instanceId === atCut.activeInstanceId);
  const activeArrived = arrived.posters.find((poster) => poster.instanceId === arrived.activeInstanceId);
  assert.ok(active && activeAtCut && activeArrived);
  assert.ok(between(active.width, activeAtCut.width, activeArrived.width));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/motion.test.ts`

Expected: FAIL because `./motion` cannot be found.

- [ ] **Step 3: Write the motion module**

`src/Playlist/lattice/motion.ts`:

```ts
import {
  getLatticeGeometry,
  layoutExpandedBlock,
  layoutLattice,
  locateInstanceAt,
  locateNearestInstance,
  type QueueInstance,
} from "./layout";
import { playlistTimeAtFrame, type TrackSpan } from "./timeline";

export const WALL_METRICS = { cellSize: 128, gap: 8 };
export const WALL_SCALE = 0.76;
export const VIEWPORT = { width: 1920, height: 1080 };
export const OVERSCAN = 500;
const CAMERA_FLIGHT_SECONDS = 0.42;
const LYRIC_SETTLE_SECONDS = 1;
const LYRIC_SETTLE_PX = 1;
const MAX_POSTERS = 400;

const OMEGA = Math.sqrt(300);
const ZETA = 34 / (2 * OMEGA);
const WD = OMEGA * Math.sqrt(Math.max(0, 1 - ZETA * ZETA));

type Camera = { x: number; y: number; scale: number };
type Rect = { x: number; y: number; width: number; height: number };

export type PosterFrame = Rect & {
  instanceId: string;
  queueIndex: number;
  active: boolean;
};

export type PlaylistMotion = {
  camera: Camera;
  posters: PosterFrame[];
  activeQueueIndex: number;
  activeInstanceId: string;
  lyricsVisible: boolean;
  localSeconds: number;
};

function bezierComponent(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

function cubicBezierY(x: number, x1: number, y1: number, x2: number, y2: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    if (bezierComponent(mid, x1, x2) < x) low = mid;
    else high = mid;
  }
  return bezierComponent((low + high) / 2, y1, y2);
}

export function cameraFlightProgress(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  if (elapsedSeconds >= CAMERA_FLIGHT_SECONDS) return 1;
  return cubicBezierY(elapsedSeconds / CAMERA_FLIGHT_SECONDS, 0.22, 1, 0.36, 1);
}

export function springProgress(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const decay = Math.exp(-ZETA * OMEGA * elapsedSeconds);
  return 1 - decay * (Math.cos(WD * elapsedSeconds) + ((ZETA * OMEGA) / WD) * Math.sin(WD * elapsedSeconds));
}

function cameraForRect(rect: Rect): Camera {
  return {
    x: VIEWPORT.width / 2 - (rect.x + rect.width / 2) * WALL_SCALE,
    y: VIEWPORT.height / 2 - (rect.y + rect.height / 2) * WALL_SCALE,
    scale: WALL_SCALE,
  };
}

function lerpCamera(from: Camera, to: Camera, progress: number): Camera {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    scale: WALL_SCALE,
  };
}

function lerpRect(from: Rect, to: Rect, progress: number): Rect {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

function worldBounds(camera: Camera) {
  return {
    left: -camera.x / camera.scale,
    top: -camera.y / camera.scale,
    right: (VIEWPORT.width - camera.x) / camera.scale,
    bottom: (VIEWPORT.height - camera.y) / camera.scale,
  };
}

function viewportCenter(camera: Camera): { x: number; y: number } {
  const bounds = worldBounds(camera);
  return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
}

function rectOf(instance: QueueInstance): Rect {
  return { x: instance.x, y: instance.y, width: instance.width, height: instance.height };
}

function expandedRect(total: number, instance: QueueInstance): Rect {
  const geometry = getLatticeGeometry(total, WALL_METRICS);
  const map = layoutExpandedBlock(geometry, total, instance, WALL_METRICS);
  return map.get(instance.instanceId) ?? rectOf(instance);
}

type Segment = {
  index: number;
  startFrame: number;
  durationInFrames: number;
  fromCamera: Camera;
  toCamera: Camera;
  fromInstance: QueueInstance | null;
  toInstance: QueueInstance;
};

function segmentsFor(spans: readonly TrackSpan[], fps: number): Segment[] {
  const total = spans.length;
  const geometry = getLatticeGeometry(total, WALL_METRICS);
  const opening = locateInstanceAt(geometry, total, 0, 0, 0, WALL_METRICS);
  if (!opening) {
    throw new Error("歌单没有可摆放的海报");
  }
  let camera = cameraForRect(expandedRect(total, opening));
  let previous: QueueInstance | null = null;
  return spans.map((span) => {
    const instance = span.index === 0
      ? opening
      : locateNearestInstance(geometry, total, span.index, viewportCenter(camera), WALL_METRICS) ?? opening;
    const nextCamera = cameraForRect(expandedRect(total, instance));
    const segment = {
      index: span.index,
      startFrame: span.startFrame,
      durationInFrames: span.durationInFrames,
      fromCamera: camera,
      toCamera: nextCamera,
      fromInstance: previous,
      toInstance: instance,
    };
    const elapsed = span.durationInFrames / fps;
    camera = lerpCamera(camera, nextCamera, cameraFlightProgress(elapsed));
    previous = instance;
    return segment;
  });
}

export function playlistMotionAt(frame: number, fps: number, spans: readonly TrackSpan[]): PlaylistMotion {
  const time = playlistTimeAtFrame(spans, frame, fps);
  const built = segmentsFor(spans, fps);
  const segment = built[time.index] ?? built[0];
  if (!segment) {
    throw new Error("歌单没有曲目");
  }
  const elapsed = time.localSeconds;
  const flight = segment.index === 0 ? 1 : cameraFlightProgress(elapsed);
  const sprung = segment.index === 0 ? 1 : springProgress(elapsed);
  const camera = lerpCamera(segment.fromCamera, segment.toCamera, flight);
  const total = spans.length;
  const geometry = getLatticeGeometry(total, WALL_METRICS);
  const fromMap = segment.fromInstance
    ? layoutExpandedBlock(geometry, total, segment.fromInstance, WALL_METRICS)
    : new Map<string, Rect>();
  const toMap = layoutExpandedBlock(geometry, total, segment.toInstance, WALL_METRICS);
  const seen = new Map<string, QueueInstance>();
  seen.set(segment.toInstance.instanceId, segment.toInstance);
  if (segment.fromInstance) seen.set(segment.fromInstance.instanceId, segment.fromInstance);
  for (const bounds of [worldBounds(segment.fromCamera), worldBounds(camera), worldBounds(segment.toCamera)]) {
    for (const instance of layoutLattice(geometry, total, bounds, OVERSCAN, WALL_METRICS)) {
      seen.set(instance.instanceId, instance);
      if (seen.size >= MAX_POSTERS) break;
    }
  }
  const posters = [...seen.values()].slice(0, MAX_POSTERS).map((instance) => {
    const rest = rectOf(instance);
    const from = fromMap.get(instance.instanceId) ?? rest;
    const to = toMap.get(instance.instanceId) ?? rest;
    return {
      ...lerpRect(from, to, sprung),
      instanceId: instance.instanceId,
      queueIndex: instance.queueIndex,
      active: instance.instanceId === segment.toInstance.instanceId,
    };
  });
  const activeRect = posters.find((poster) => poster.active);
  const target = expandedRect(total, segment.toInstance);
  const settled = activeRect
    ? Math.abs(activeRect.width - target.width) <= LYRIC_SETTLE_PX
      && Math.abs(activeRect.height - target.height) <= LYRIC_SETTLE_PX
    : false;
  return {
    camera,
    posters,
    activeQueueIndex: time.index,
    activeInstanceId: segment.toInstance.instanceId,
    lyricsVisible: segment.index === 0 || settled || elapsed >= LYRIC_SETTLE_SECONDS,
    localSeconds: time.localSeconds,
  };
}
```

Always insert `segment.toInstance` and `segment.fromInstance` into `seen` before culling, so the active poster exists at the cut frame. The code above already does that.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/motion.test.ts`

Expected: PASS, 2 tests. If the mid-width assertion fails because the active poster is not in `atCut.posters`, include `segment.toInstance` in `seen` before slicing to 400.

- [ ] **Step 5: Commit**

```bash
git add src/Playlist/lattice/motion.ts src/Playlist/lattice/motion.test.ts
git commit -m "$(cat <<'EOF'
Fly the playlist camera and spring posters open on each track change.

EOF
)"
```

### Task 5: Current-line lyric fill

**Files:**
- Create: `src/Playlist/lattice/lyrics.ts`
- Test: `src/Playlist/lattice/lyrics.test.ts`

**Interfaces:**
- Consumes: `LyricLine` from `@applemusic-like-lyrics/core`. Times are milliseconds.
- Produces:
  - `TextMeasure = (text: string, font: string) => { width: number; height: number }`
  - `LyricPiece = { text: string; x: number; y: number; width: number; height: number; fill: number; translation: boolean }`
  - `lyricLineAt(lines: readonly LyricLine[], timeMs: number): LyricLine | null`
  - `layoutPlaylistLyric(input: { line: LyricLine | null; timeMs: number; width: number; height: number; measure: TextMeasure }): LyricPiece[]`

- [ ] **Step 1: Write the failing test**

`src/Playlist/lattice/lyrics.test.ts`:

```ts
import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPlaylistLyric, lyricLineAt } from "./lyrics";

function line(words: Array<[string, number, number]>, translatedLyric = ""): LyricLine {
  return {
    words: words.map(([word, startTime, endTime]) => ({ word, startTime, endTime, obscene: false })),
    startTime: words[0]?.[1] ?? 0,
    endTime: words[words.length - 1]?.[2] ?? 0,
    translatedLyric,
    romanLyric: "不要画罗马音",
    isBG: false,
    isDuet: false,
  };
}

const measure = (text: string) => ({ width: text.length * 10, height: 20 });

test("逐字时间错开时按比例填充", () => {
  const current = line([
    ["你", 0, 1000],
    ["好", 1000, 2000],
  ]);
  const pieces = layoutPlaylistLyric({
    line: current,
    timeMs: 1500,
    width: 400,
    height: 200,
    measure,
  });
  const main = pieces.filter((piece) => !piece.translation);
  assert.equal(main[0]?.text, "你");
  assert.equal(main[0]?.fill, 1);
  assert.equal(main[1]?.text, "好");
  assert.equal(main[1]?.fill, 0.5);
});

test("词的起止等于整行时，行一开始就整句出现", () => {
  const current = line([["整句", 1000, 3000]]);
  const before = layoutPlaylistLyric({
    line: current,
    timeMs: 999,
    width: 400,
    height: 200,
    measure,
  });
  const atStart = layoutPlaylistLyric({
    line: current,
    timeMs: 1000,
    width: 400,
    height: 200,
    measure,
  });
  assert.equal(before.every((piece) => piece.fill === 0), true);
  assert.equal(atStart.every((piece) => piece.fill === 1), true);
});

test("没有译文不产生译文行，有译文最多两行", () => {
  const plain = layoutPlaylistLyric({
    line: line([["主", 0, 1000]]),
    timeMs: 0,
    width: 400,
    height: 200,
    measure,
  });
  assert.equal(plain.some((piece) => piece.translation), false);

  const translated = layoutPlaylistLyric({
    line: line([["主", 0, 1000]], "一二三四五六七八九十甲乙丙丁"),
    timeMs: 0,
    width: 50,
    height: 400,
    measure,
  });
  const rows = new Set(translated.filter((piece) => piece.translation).map((piece) => piece.y));
  assert.ok(rows.size > 0);
  assert.ok(rows.size <= 2);
  assert.equal(translated.some((piece) => piece.text.includes("罗马")), false);
});

test("当前句取包含该毫秒的一行", () => {
  const lines = [line([["甲", 0, 1000]]), line([["乙", 1000, 2000]])];
  assert.equal(lyricLineAt(lines, 1000)?.words[0]?.word, "乙");
  assert.equal(lyricLineAt(lines, 2500), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/lyrics.test.ts`

Expected: FAIL because `./lyrics` cannot be found.

- [ ] **Step 3: Write the lyric layout**

`src/Playlist/lattice/lyrics.ts`:

```ts
import type { LyricLine } from "@applemusic-like-lyrics/core";

export type TextMeasure = (text: string, font: string) => { width: number; height: number };

export type LyricPiece = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: number;
  translation: boolean;
};

const MAIN_FONT = "600 32px sans-serif";
const TRANSLATION_FONT = "500 16px sans-serif";

export function lyricLineAt(lines: readonly LyricLine[], timeMs: number): LyricLine | null {
  return lines.find((line) => timeMs >= line.startTime && timeMs < line.endTime) ?? null;
}

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
  }
  return [...text];
}

function staggered(line: LyricLine): boolean {
  return line.words.some((word) => word.startTime !== line.startTime || word.endTime !== line.endTime);
}

function wordFill(line: LyricLine, word: LyricLine["words"][number], timeMs: number): number {
  if (!staggered(line)) {
    return timeMs >= line.startTime ? 1 : 0;
  }
  if (timeMs >= word.endTime) return 1;
  if (timeMs <= word.startTime) return 0;
  const span = word.endTime - word.startTime;
  return span <= 0 ? 1 : (timeMs - word.startTime) / span;
}

function wrap(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
  measure: TextMeasure,
  fill: number,
  translation: boolean,
  y: number,
): LyricPiece[] {
  const pieces: LyricPiece[] = [];
  let x = 0;
  let row = 0;
  const units = translation ? graphemes(text) : [text];
  const push = (unit: string) => {
    const size = measure(unit, font);
    if (x > 0 && x + size.width > maxWidth) {
      row += 1;
      x = 0;
    }
    pieces.push({
      text: unit,
      x,
      y: y + row * lineHeight,
      width: size.width,
      height: lineHeight,
      fill,
      translation,
    });
    x += size.width;
  };
  if (!translation) {
    let current = "";
    for (const unit of graphemes(text)) {
      const next = current + unit;
      if (current && measure(next, font).width > maxWidth) {
        push(current);
        current = unit;
      } else {
        current = next;
      }
    }
    if (current) push(current);
    return pieces;
  }
  for (const unit of units) push(unit);
  return pieces;
}

export function layoutPlaylistLyric(input: {
  line: LyricLine | null;
  timeMs: number;
  width: number;
  height: number;
  measure: TextMeasure;
}): LyricPiece[] {
  const { line, timeMs, width, measure } = input;
  if (!line || width <= 0) return [];
  const padding = 24;
  const maxWidth = Math.max(1, width - padding * 2);
  const mainHeight = 38;
  let y = padding;
  const pieces: LyricPiece[] = [];
  for (const word of line.words) {
    const wordPieces = wrap(word.word, MAIN_FONT, mainHeight, maxWidth, measure, wordFill(line, word, timeMs), false, y);
    pieces.push(...wordPieces);
    const rows = new Set(wordPieces.map((piece) => piece.y));
    y += Math.max(1, rows.size) * mainHeight;
  }
  const translation = line.translatedLyric.trim();
  if (!translation) return pieces;
  const translated = wrap(translation, TRANSLATION_FONT, 22, maxWidth, measure, wordFill(line, line.words[0] ?? { word: "", startTime: line.startTime, endTime: line.endTime, obscene: false }, timeMs), true, y);
  const rows = [...new Set(translated.map((piece) => piece.y))].slice(0, 2);
  return [...pieces, ...translated.filter((piece) => rows.includes(piece.y))];
}
```

Main-line wrapping splits a word into graphemes only when the whole word is wider than the poster. Translation rows keep the first two y positions.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/lattice/lyrics.test.ts`

Expected: PASS, 4 tests. If the translation row count is 0, the measure width of one grapheme is 10 and `maxWidth` is 26, so several graphemes wrap; `rows.size` must be 2 because the slice keeps the first two y values.

- [ ] **Step 5: Commit**

```bash
git add src/Playlist/lattice/lyrics.ts src/Playlist/lattice/lyrics.test.ts
git commit -m "$(cat <<'EOF'
Fill the expanded poster's current lyric line from LyricLine times.

EOF
)"
```

### Task 6: Metadata, composition, and Studio default

**Files:**
- Create: `src/Playlist/metadata.ts`
- Create: `src/Playlist/Poster.tsx`
- Create: `src/Playlist/Main.tsx`
- Modify: `src/helpers/schema.ts`
- Modify: `src/helpers/calculate-metadata.ts`
- Modify: `src/helpers/default-props.ts`
- Modify: `src/remotion/constants.ts`
- Modify: `src/Root.tsx`
- Test: `src/Playlist/metadata.test.ts`

**Interfaces:**
- Consumes: `playlistTrackSpans` from Task 3; `playlistMotionAt`, `VIEWPORT`, `WALL_SCALE` from Task 4; `buildPlaylistTiles` from Task 2; `layoutPlaylistLyric`, `lyricLineAt` from Task 5; `TrackProps` and `resolveTrack` behavior already in `calculate-metadata.ts`
- Produces:
  - `playlistCompositionSchema`
  - `PlaylistCompositionProps = { tracks: TrackProps[] }`
  - `resolvePlaylistMetadata(props: PlaylistCompositionProps, resolveTrack: (track: TrackProps) => Promise<TrackProps>): Promise<{ fps: number; durationInFrames: number; props: PlaylistCompositionProps }>`
  - `calculatePlaylistMetadata`
  - `PLAYLIST_COMPOSITION_ID = "PlaylistPlayer"`
  - `defaultPlaylistProps` with `OneLastKiss` twice
  - `PlaylistPlayer` component

- [ ] **Step 1: Write the failing test**

`src/Playlist/metadata.test.ts`:

```ts
import type { LyricLine } from "@applemusic-like-lyrics/core";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { playlistCompositionSchema } from "../helpers/schema";
import { PLAYLIST_COMPOSITION_ID } from "../remotion/constants";
import { resolvePlaylistMetadata } from "./metadata";

const lyric: LyricLine = {
  words: [{ word: "甲", startTime: 0, endTime: 1000, obscene: false }],
  startTime: 0,
  endTime: 1000,
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
};

function track(durationInSeconds: number) {
  return {
    audioFileUrl: "missing-on-purpose.flac",
    lyricsFileUrl: "missing-on-purpose.ttml",
    audioOffsetInSeconds: 0,
    coverImageUrl: "cover.jpg",
    songName: "甲",
    artistName: "乙",
    durationInSeconds,
    lyricLines: [lyric],
  };
}

test("已有时长和歌词时不读文件，总帧数相加", async () => {
  let reads = 0;
  const result = await resolvePlaylistMetadata(
    { tracks: [track(2), track(3)] },
    async () => {
      reads += 1;
      throw new Error("不应读取文件");
    },
  );
  assert.equal(reads, 0);
  assert.equal(result.fps, 30);
  assert.equal(result.durationInFrames, 150);
  assert.equal(result.props.tracks[1]?.durationInSeconds, 3);
});

test("缺歌词时才把曲目交给解析函数", async () => {
  const unresolved = { ...track(2), lyricLines: [] as LyricLine[] };
  let reads = 0;
  await resolvePlaylistMetadata({ tracks: [unresolved] }, async (item) => {
    reads += 1;
    return { ...item, lyricLines: [lyric] };
  });
  assert.equal(reads, 1);
});

test("schema 至少一首，默认歌单把同一首放两遍", () => {
  assert.equal(PLAYLIST_COMPOSITION_ID, "PlaylistPlayer");
  assert.equal(playlistCompositionSchema.safeParse({ tracks: [track(2)] }).success, true);
  assert.equal(playlistCompositionSchema.safeParse({ tracks: [] }).success, false);
  const source = readFileSync(new URL("../helpers/default-props.ts", import.meta.url), "utf8");
  assert.match(source, /tracks:\s*\[defaultTrack,\s*defaultTrack\]/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/metadata.test.ts`

Expected: FAIL because `resolvePlaylistMetadata` cannot be found.

- [ ] **Step 3: Write metadata and schema**

`src/Playlist/metadata.ts`:

```ts
import { DEFAULT_FPS } from "../remotion/constants";
import type { PlaylistCompositionProps, TrackProps } from "../helpers/schema";
import { playlistTrackSpans } from "./lattice/timeline";

function ready(track: TrackProps): boolean {
  return (
    typeof track.durationInSeconds === "number"
    && track.durationInSeconds > 0
    && Array.isArray(track.lyricLines)
    && track.lyricLines.length > 0
  );
}

export async function resolvePlaylistMetadata(
  props: PlaylistCompositionProps,
  resolveTrack: (track: TrackProps) => Promise<TrackProps>,
): Promise<{ fps: number; durationInFrames: number; props: PlaylistCompositionProps }> {
  const tracks = props.tracks.every(ready)
    ? props.tracks
    : await Promise.all(props.tracks.map((track) => resolveTrack(track)));
  const durationInFrames = playlistTrackSpans(tracks, DEFAULT_FPS)
    .reduce((sum, span) => sum + span.durationInFrames, 0);
  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(1, durationInFrames),
    props: { tracks },
  };
}
```

Add to `src/helpers/schema.ts` after `AlbumCompositionProps`:

```ts
export const playlistCompositionSchema = z.object({
  tracks: z.array(trackSchema).min(1),
});

export type PlaylistCompositionProps = {
  tracks: TrackProps[];
};
```

In `src/helpers/calculate-metadata.ts`, import `PlaylistCompositionProps` from `./schema` and:

```ts
import { resolvePlaylistMetadata } from "../Playlist/metadata";
```

Export `resolveTrack` by changing `async function resolveTrack` to `export async function resolveTrack`.

Add:

```ts
export const calculatePlaylistMetadata: CalculateMetadataFunction<
  PlaylistCompositionProps
> = async ({ props, abortSignal }) => {
  return resolvePlaylistMetadata(props, (track) =>
    resolveTrack(track, abortSignal, { lyrics: true }),
  );
};
```

`src/remotion/constants.ts` add:

```ts
export const PLAYLIST_COMPOSITION_ID = "PlaylistPlayer";
```

`src/helpers/default-props.ts`:

```ts
import type { AlbumCompositionProps, PlayerCompositionProps, PlaylistCompositionProps } from "./schema";

export const defaultPlaylistProps: PlaylistCompositionProps = {
  tracks: [defaultTrack, defaultTrack],
};
```

Place that export after `defaultTrack` is defined.

- [ ] **Step 4: Run the metadata test**

Run: `node --experimental-strip-types --import ./scripts/register-ts.mjs --test src/Playlist/metadata.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Write Poster and Main**

`src/Playlist/Poster.tsx`:

```tsx
import { Img } from "remotion";
import { playerFontFamily } from "../Player/font";
import type { LyricPiece } from "./lattice/lyrics";

const collapsedShade =
  "linear-gradient(180deg, rgb(0 0 0 / 5%) 34%, rgb(0 0 0 / 24%) 56%, rgb(0 0 0 / 92%) 100%)";
const expandedShade =
  "linear-gradient(0deg, rgb(0 0 0 / 86%) 0%, rgb(0 0 0 / 62%) 14%, rgb(0 0 0 / 26%) 30%, rgb(0 0 0 / 0%) 46%), linear-gradient(90deg, rgb(0 0 0 / 88%), rgb(0 0 0 / 50%) 52%, rgb(0 0 0 / 8%))";

export const PlaylistPoster: React.FC<{
  coverUrl: string;
  title: string;
  artist: string;
  queueIndex: number;
  current: boolean;
  expanded: boolean;
  lyrics: LyricPiece[];
  showLyrics: boolean;
}> = ({ coverUrl, title, artist, queueIndex, current, expanded, lyrics, showLyrics }) => {
  const index = String(queueIndex + 1).padStart(2, "0");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "#111",
        color: "white",
        fontFamily: playerFontFamily,
      }}
    >
      {coverUrl ? (
        <Img
          src={coverUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: expanded ? expandedShade : collapsedShade,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          padding: "5px 8px",
          background: current ? "rgb(0 0 0 / 78%)" : "rgb(0 0 0 / 62%)",
          color: "white",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
        }}
      >
        {current ? `正在播放 · ${index}` : index}
      </div>
      <div style={{ position: "absolute", left: 17, right: 17, bottom: 17 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ opacity: 0.8 }}>{artist}</div>
      </div>
      {showLyrics ? (
        <div style={{ position: "absolute", inset: 0 }}>
          {lyrics.map((piece, pieceIndex) => (
            <div
              key={`${piece.y}-${piece.x}-${pieceIndex}`}
              style={{
                position: "absolute",
                left: 24 + piece.x,
                top: piece.y,
                width: piece.width,
                height: piece.height,
                overflow: "hidden",
                color: "white",
                fontWeight: piece.translation ? 500 : 600,
                fontSize: piece.translation ? 16 : 32,
                lineHeight: `${piece.height}px`,
                opacity: piece.translation ? 0.8 : 1,
              }}
            >
              <span style={{ color: "rgb(255 255 255 / 35%)" }}>{piece.text}</span>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${piece.fill * 100}%`,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  color: "white",
                }}
              >
                {piece.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
```

`src/Playlist/Main.tsx`:

```tsx
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { resolvePublicAsset } from "../helpers/public-asset";
import type { PlaylistCompositionProps } from "../helpers/schema";
import { layoutPlaylistLyric, lyricLineAt } from "./lattice/lyrics";
import { playlistMotionAt } from "./lattice/motion";
import { playlistTrackSpans } from "./lattice/timeline";
import { buildPlaylistTiles } from "./lattice/tiles";
import { PlaylistPoster } from "./Poster";

const measure = (text: string, font: string) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 32);
  return { width: text.length * size, height: size };
};

export const PlaylistPlayer: React.FC<PlaylistCompositionProps> = ({ tracks }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const spans = playlistTrackSpans(tracks, fps);
  const motion = playlistMotionAt(frame, fps, spans);
  const tiles = buildPlaylistTiles(tracks);
  return (
    <AbsoluteFill style={{ backgroundColor: "#070707", overflow: "hidden" }}>
      {spans.map((span) => {
        const track = tracks[span.index];
        if (!track) return null;
        const audioOffsetInFrames = Math.round(track.audioOffsetInSeconds * fps);
        return (
          <Sequence key={span.index} from={span.startFrame} durationInFrames={span.durationInFrames} showPosterWhenEnded={false}>
            {isRendering ? null : (
              <Sequence from={-audioOffsetInFrames}>
                <Audio src={resolvePublicAsset(track.audioFileUrl)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: motion.camera.x,
          top: motion.camera.y,
          transform: `scale(${motion.camera.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {motion.posters.map((poster) => {
          const tile = tiles[poster.queueIndex];
          const track = tracks[poster.queueIndex];
          const showLyrics = poster.active && motion.lyricsVisible;
          const timeMs = motion.localSeconds * 1000;
          const line = showLyrics ? lyricLineAt(track?.lyricLines ?? [], timeMs) : null;
          const lyrics = showLyrics
            ? layoutPlaylistLyric({
                line,
                timeMs,
                width: poster.width,
                height: poster.height,
                measure,
              })
            : [];
          return (
            <div
              key={poster.instanceId}
              style={{
                position: "absolute",
                left: poster.x,
                top: poster.y,
                width: poster.width,
                height: poster.height,
                zIndex: poster.active ? 2 : 1,
              }}
            >
              <PlaylistPoster
                coverUrl={resolvePublicAsset(tile?.coverUrl)}
                title={tile?.title ?? ""}
                artist={tile?.artist ?? ""}
                queueIndex={poster.queueIndex}
                current={poster.queueIndex === motion.activeQueueIndex}
                expanded={poster.active}
                lyrics={lyrics}
                showLyrics={showLyrics}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 78%, rgba(0, 0, 0, 0.52) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
```

Register it in `src/Root.tsx` next to the album composition:

```tsx
import { PlaylistPlayer } from "./Playlist/Main";
import { calculatePlaylistMetadata } from "./helpers/calculate-metadata";
import { defaultPlaylistProps } from "./helpers/default-props";
import { playlistCompositionSchema } from "./helpers/schema";
import { PLAYLIST_COMPOSITION_ID } from "./remotion/constants";
```

```tsx
      <Composition
        id={PLAYLIST_COMPOSITION_ID}
        component={PlaylistPlayer}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={DEFAULT_FPS}
        durationInFrames={300}
        schema={playlistCompositionSchema}
        defaultProps={defaultPlaylistProps}
        calculateMetadata={calculatePlaylistMetadata}
      />
```

- [ ] **Step 6: Typecheck**

Run: `nub run lint`

Expected: exit 0. Fix only errors introduced by these files. `noUnusedLocals` will fail if a helper parameter is unused; delete it.

- [ ] **Step 7: Commit**

```bash
git add src/Playlist/metadata.ts src/Playlist/metadata.test.ts src/Playlist/Poster.tsx src/Playlist/Main.tsx src/helpers/schema.ts src/helpers/calculate-metadata.ts src/helpers/default-props.ts src/remotion/constants.ts src/Root.tsx
git commit -m "$(cat <<'EOF'
Add the PlaylistPlayer composition for an ordered poster wall.

EOF
)"
```

`resolvePlaylistMetadata` uses `Math.max(1, durationInFrames)` only when the span sum is 0. The metadata test uses positive durations, so the sum stays 150.
