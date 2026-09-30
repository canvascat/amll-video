import type { LyricLine } from "@applemusic-like-lyrics/core";

export type TextMeasure = (text: string, font: string) => { width: number; height: number };

export type LyricRole = "previous" | "current" | "next";

export type LyricPiece = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: number;
  translation: boolean;
  role: LyricRole;
  lineKey: string;
  blockY: number;
  scale: number;
  opacity: number;
  blur: number;
  leaving: boolean;
  fontSize: number;
};

const MAIN_FONT = "600 32px sans-serif";
const MAIN_HEIGHT = 38;
const TRANSLATION_FONT = "500 16px sans-serif";
const TRANSLATION_HEIGHT = 22;

function fontPxOf(font: string): number {
  return Number(/(\d+)px/.exec(font)?.[1] ?? 32);
}

function resolvePlaylistType(width: number, height: number, measure: TextMeasure) {
  let fontPx = 24;
  for (let size = 64; size >= 24; size -= 1) {
    const lineHeight = Math.max(size * 1.18, measure("国Agyp", `600 ${size}px sans-serif`).height + 2);
    const translationLineHeight = Math.max(size * 0.5 * 1.35, measure("国Agyp", `500 ${size * 0.5}px sans-serif`).height + 2);
    const budget = lineHeight * (3 + 1.44) + size * 0.98 + size * 1.2 + translationLineHeight * 2 + size * 0.3;
    const sampleWidth = size * 3.2;
    if (budget <= height && sampleWidth * 3 <= Math.max(0, width - size * 1.2)) {
      fontPx = size;
      break;
    }
  }
  const lineHeight = Math.max(fontPx * 1.18, measure("国Agyp", `600 ${fontPx}px sans-serif`).height + 2);
  const translationPx = fontPx * 0.5;
  const translationLineHeight = Math.max(translationPx * 1.35, measure("国Agyp", `500 ${translationPx}px sans-serif`).height + 2);
  return {
    font: `600 ${fontPx}px sans-serif`,
    fontPx,
    lineHeight,
    translationFont: `500 ${translationPx}px sans-serif`,
    translationLineHeight,
    gap: Math.max(18, fontPx * 0.49),
  };
}

export function lyricLineAt(lines: readonly LyricLine[], timeMs: number): LyricLine | null {
  return lines.find((line) => timeMs >= line.startTime && timeMs < line.endTime) ?? null;
}

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};
type GraphemeSegmenterConstructor = new (
  locales?: string,
  options?: { granularity: "grapheme" },
) => GraphemeSegmenter;

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = (Intl as typeof Intl & { Segmenter: GraphemeSegmenterConstructor }).Segmenter;
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
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
      role: "current",
      lineKey: "line",
      blockY: 0,
      scale: 1,
      opacity: 1,
      blur: 0,
      leaving: false,
      fontSize: fontPxOf(font),
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

function withRole(pieces: LyricPiece[], role: LyricRole): LyricPiece[] {
  return pieces.map((piece) => ({ ...piece, role }));
}

function layoutLinePieces(
  line: LyricLine,
  timeMs: number,
  maxWidth: number,
  measure: TextMeasure,
  font: string,
  lineHeight: number,
  includeTranslation: boolean,
  translationFont = TRANSLATION_FONT,
  translationLineHeight = TRANSLATION_HEIGHT,
): LyricPiece[] {
  let x = 0;
  let y = 0;
  const pieces: LyricPiece[] = [];
  for (const word of line.words) {
    if (!word.word) continue;
    const fill = wordFill(line, word, timeMs);
    const size = measure(word.word, font);
    if (size.width <= maxWidth) {
      if (x > 0 && x + size.width > maxWidth) {
        x = 0;
        y += lineHeight;
      }
      pieces.push({
        text: word.word,
        x,
        y,
        width: size.width,
        height: lineHeight,
        fill,
        translation: false,
        role: "current",
        lineKey: "line",
        blockY: 0,
        scale: 1,
        opacity: 1,
        blur: 0,
        leaving: false,
        fontSize: fontPxOf(font),
      });
      x += size.width;
      continue;
    }
    if (x > 0) {
      x = 0;
      y += lineHeight;
    }
    const wordPieces = wrap(word.word, font, lineHeight, maxWidth, measure, fill, false, y);
    pieces.push(...wordPieces);
    const lastY = Math.max(...wordPieces.map((piece) => piece.y));
    x = wordPieces
      .filter((piece) => piece.y === lastY)
      .reduce((end, piece) => Math.max(end, piece.x + piece.width), 0);
    y = lastY;
  }
  if (!includeTranslation) return pieces;
  const translation = line.translatedLyric.trim();
  if (!translation) return pieces;
  if (pieces.length > 0) y += lineHeight;
  const translated = wrap(
    translation,
    translationFont,
    translationLineHeight,
    maxWidth,
    measure,
    1,
    true,
    y,
  );
  const rows = [...new Set(translated.map((piece) => piece.y))].slice(0, 2);
  return [...pieces, ...translated.filter((piece) => rows.includes(piece.y))];
}

type LyricStatus = "passed" | "active" | "waiting";

type LyricSlot = {
  index: number;
  line: LyricLine;
  role: LyricRole;
  offset: number;
  status: LyricStatus;
};

const SCROLL_SPRING = { stiffness: 142, damping: 28, mass: 0.82 };
const SCALE_SPRING = { stiffness: 150, damping: 30, mass: 0.78 };

function lyricTone(status: LyricStatus, offset: number) {
  if (status === "active") return { alpha: 1, scale: 1, blur: 0 };
  const distance = Math.max(Math.abs(offset), 1);
  const waiting = status === "waiting";
  return {
    alpha: waiting ? Math.max(0.36, 0.72 - (distance - 1) * 0.18) : Math.max(0.28, 0.52 - (distance - 1) * 0.12),
    scale: Math.max(0.68, 0.72 * 0.9 ** (distance - 1)),
    blur: waiting ? (distance === 1 ? 0.7 : 1.8 + (distance - 2) * 0.8) : 1.1 + (distance - 1) * 0.7,
  };
}

function bezierComponent(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

function fadeEase(amount: number): number {
  const x = Math.min(1, Math.max(0, amount));
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step += 1) {
    const mid = (low + high) / 2;
    if (bezierComponent(mid, 0.32, 0) < x) low = mid;
    else high = mid;
  }
  return bezierComponent((low + high) / 2, 0.72, 1);
}

function stepSpring(
  value: number,
  velocity: number,
  target: number,
  delta: number,
  spring: { stiffness: number; damping: number; mass: number },
): number {
  if (delta <= 0) return value;
  const steps = Math.max(1, Math.ceil(delta * 120));
  const dt = delta / steps;
  for (let step = 0; step < steps; step += 1) {
    velocity += ((target - value) * spring.stiffness - velocity * spring.damping) / spring.mass * dt;
    value += velocity * dt;
  }
  return Math.abs(value - target) < 0.01 && Math.abs(velocity) < 0.01 ? target : value;
}

function lyricSlots(lines: readonly LyricLine[], timeMs: number): LyricSlot[] {
  if (lines.length === 0) return [];
  const active = lines.findIndex((line) => timeMs >= line.startTime && timeMs < line.endTime);
  const anchor = active >= 0
    ? active
    : lines.findIndex((line) => line.startTime > timeMs);
  const center = anchor >= 0 ? anchor : lines.length - 1;
  if (center < 0) return [];
  const slots: LyricSlot[] = [];
  if (center > 0) {
    slots.push({
      index: center - 1,
      line: lines[center - 1],
      role: "previous",
      offset: -1,
      status: "passed",
    });
  }
  const current = active === center;
  slots.push({
    index: center,
    line: lines[center],
    role: current ? "current" : center === anchor ? "next" : "previous",
    offset: 0,
    status: current ? "active" : "waiting",
  });
  if (!current && anchor < 0) {
    slots[slots.length - 1].status = "passed";
    slots[slots.length - 1].role = "previous";
  }
  if (center + 1 < lines.length) {
    slots.push({
      index: center + 1,
      line: lines[center + 1],
      role: "next",
      offset: 1,
      status: "waiting",
    });
  }
  return slots;
}

function blockHeight(pieces: readonly LyricPiece[]): number {
  if (pieces.length === 0) return 0;
  return Math.max(...pieces.map((piece) => piece.y + piece.height));
}

function slotKey(slot: LyricSlot): string {
  return `${slot.index}:${slot.line.startTime}`;
}

function laySlot(
  slot: LyricSlot,
  timeMs: number,
  maxWidth: number,
  measure: TextMeasure,
  type: ReturnType<typeof resolvePlaylistType>,
) {
  const active = slot.status === "active";
  const pieces = layoutLinePieces(
    slot.line,
    timeMs,
    maxWidth,
    measure,
    type.font,
    type.lineHeight,
    active,
    type.translationFont,
    type.translationLineHeight,
  ).filter((piece) => active || (!piece.translation && piece.y < type.lineHeight * 2));
  const textHeight = blockHeight(pieces.filter((piece) => !piece.translation));
  return { ...slot, pieces, height: blockHeight(pieces), textHeight };
}

function anchorTop(height: number, activeHeight: number): number {
  return Math.max(0, height * 0.46 - activeHeight / 2);
}

function slotTop(
  slot: { offset: number; status: LyricStatus; textHeight: number },
  anchorY: number,
  activeHeight: number,
  lineHeight: number,
  gap: number,
): number {
  const tone = lyricTone(slot.status, slot.offset);
  if (slot.offset < 0) {
    return anchorY - Math.min(slot.textHeight, lineHeight * 2) * tone.scale - gap;
  }
  if (slot.offset > 0) return anchorY + activeHeight + gap;
  return anchorY;
}

function windowGeometry(
  lines: readonly LyricLine[],
  timeMs: number,
  width: number,
  height: number,
  measure: TextMeasure,
) {
  const maxWidth = Math.max(1, width - 48);
  const type = resolvePlaylistType(maxWidth, height, measure);
  const laid = lyricSlots(lines, timeMs)
    .map((slot) => laySlot(slot, timeMs, maxWidth, measure, type))
    .filter((slot) => slot.pieces.length > 0);
  const anchor = laid.find((slot) => slot.offset === 0);
  const anchorTone = anchor ? lyricTone(anchor.status, 0) : lyricTone("active", 0);
  const activeHeight = anchor
    ? anchor.status === "active"
      ? anchor.height
      : Math.min(anchor.textHeight, type.lineHeight * 2) * anchorTone.scale
    : 0;
  const anchorY = anchorTop(height, activeHeight);
  return { laid, anchorY, activeHeight, type };
}

function transitionStart(lines: readonly LyricLine[], timeMs: number): number {
  const times = [...new Set(lines.flatMap((line) => [line.startTime, line.endTime]))]
    .filter((time) => time > 0 && time <= timeMs)
    .sort((left, right) => left - right);
  let start = 0;
  let previous = lyricSlots(lines, 0).map(slotKey).join("|");
  for (const time of times) {
    const next = lyricSlots(lines, time).map(slotKey).join("|");
    if (next !== previous) start = time;
    previous = next;
  }
  return start;
}

function paintPieces(
  slot: LyricSlot,
  source: readonly LyricPiece[],
  blockY: number,
  scale: number,
  opacity: number,
  blur: number,
  leaving: boolean,
  keySuffix = "",
): LyricPiece[] {
  return source.map((piece) => ({
    ...piece,
    role: slot.role,
    lineKey: `${slotKey(slot)}${keySuffix}${leaving ? ":leaving" : ""}`,
    blockY,
    scale,
    opacity,
    blur,
    leaving,
  }));
}

function layoutWindow(
  lines: readonly LyricLine[],
  timeMs: number,
  width: number,
  height: number,
  measure: TextMeasure,
): LyricPiece[] {
  const now = windowGeometry(lines, timeMs, width, height, measure);
  if (now.laid.length === 0) return [];
  const start = transitionStart(lines, timeMs);
  const elapsed = Math.max(0, (timeMs - start) / 1000);
  const before = start > 0
    ? windowGeometry(lines, start - 0.001, width, height, measure)
    : { laid: [], anchorY: anchorTop(height, 0), activeHeight: 0, type: now.type };
  const beforeByKey = new Map(before.laid.map((slot) => [slotKey(slot), slot]));
  const nowByKey = new Map(now.laid.map((slot) => [slotKey(slot), slot]));
  const pieces: LyricPiece[] = [];
  const place = (
    geometry: typeof now,
    slot: (typeof now.laid)[number],
  ) => slotTop(slot, geometry.anchorY, geometry.activeHeight, geometry.type.lineHeight, geometry.type.gap);

  for (const slot of now.laid) {
    const tone = lyricTone(slot.status, slot.offset);
    const targetY = place(now, slot);
    const previous = beforeByKey.get(slotKey(slot));
    const fromY = previous
      ? place(before, previous)
      : height * 0.46 + (slot.offset >= 0 ? 34 : -34);
    const fromScale = previous ? lyricTone(previous.status, previous.offset).scale : 0.7;
    const fromAlpha = previous ? lyricTone(previous.status, previous.offset).alpha : 0;
    const fromBlur = previous ? lyricTone(previous.status, previous.offset).blur : 5;
    const fade = fadeEase(Math.min(1, elapsed / 0.28));
    const blurFade = fadeEase(Math.min(1, elapsed / 0.32));
    pieces.push(...paintPieces(
      slot,
      slot.pieces,
      stepSpring(fromY, 0, targetY, elapsed, SCROLL_SPRING),
      stepSpring(fromScale, 0, tone.scale, elapsed, SCALE_SPRING),
      fromAlpha + (tone.alpha - fromAlpha) * fade,
      fromBlur + (tone.blur - fromBlur) * blurFade,
      false,
    ));
  }

  if (elapsed >= 0.28) return pieces;
  for (const slot of before.laid) {
    if (nowByKey.has(slotKey(slot))) continue;
    const tone = lyricTone(slot.status, slot.offset);
    const fromY = place(before, slot);
    const fade = fadeEase(Math.min(1, elapsed / 0.28));
    const blurFade = fadeEase(Math.min(1, elapsed / 0.32));
    pieces.push(...paintPieces(
      slot,
      slot.pieces,
      stepSpring(fromY, 0, fromY + (slot.offset < 0 || slot.status === "passed" ? -38 : 38), elapsed, SCROLL_SPRING),
      stepSpring(tone.scale, 0, tone.scale, elapsed, SCALE_SPRING),
      tone.alpha * (1 - fade),
      slot.offset < 0 || slot.status === "passed" ? tone.blur : tone.blur + (5 - tone.blur) * blurFade,
      true,
    ));
  }
  for (const slot of before.laid) {
    const current = nowByKey.get(slotKey(slot));
    const translation = slot.pieces.filter((piece) => piece.translation);
    if (!current || translation.length === 0 || current.pieces.some((piece) => piece.translation)) continue;
    const tone = lyricTone(slot.status, slot.offset);
    const nextTone = lyricTone(current.status, current.offset);
    const fade = fadeEase(Math.min(1, elapsed / 0.28));
    const blurFade = fadeEase(Math.min(1, elapsed / 0.32));
    pieces.push(...paintPieces(
      slot,
      translation,
      stepSpring(place(before, slot), 0, place(now, current), elapsed, SCROLL_SPRING),
      stepSpring(tone.scale, 0, nextTone.scale, elapsed, SCALE_SPRING),
      tone.alpha * (1 - fade),
      tone.blur + (nextTone.blur - tone.blur) * blurFade,
      true,
      ":translation",
    ));
  }
  return pieces;
}

export function layoutPlaylistLyric(input: {
  line?: LyricLine | null;
  lines?: readonly LyricLine[];
  timeMs: number;
  width: number;
  height: number;
  measure: TextMeasure;
}): LyricPiece[] {
  const { line, lines, timeMs, width, height, measure } = input;
  if (width <= 0) return [];
  if (lines) return layoutWindow(lines, timeMs, width, height, measure);
  if (!line) return [];
  const maxWidth = Math.max(1, width - 48);
  return withRole(layoutLinePieces(line, timeMs, maxWidth, measure, MAIN_FONT, MAIN_HEIGHT, true), "current");
}
