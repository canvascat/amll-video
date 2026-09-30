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
