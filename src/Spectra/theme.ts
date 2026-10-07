import type { CSSProperties } from "react";

/** 界面按 1024×576 的坐标摆放，成片时整体放大到视频尺寸。 */
export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 576;

export const COLORS = {
  paper: "#ebe8e0",
  ink: "#23292c",
  inkSoft: "#8b8b86",
  inkFaint: "#b3b2ac",
  rule: "rgba(35, 41, 44, 0.12)",
  ruleSoft: "rgba(35, 41, 44, 0.055)",
  accent: "#e5683f",
  bar: "#3b5357",
  trace: "#4f8f7d",
  translation: "#4d8f8c",
  unplayed: "#d9dad4",
} as const;

export const FONT_MONO =
  '"SF Mono", "JetBrains Mono", ui-monospace, Menlo, "PingFang SC", monospace';
export const FONT_SANS =
  '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "PingFang SC", system-ui, sans-serif';

/** 小号等宽标签：01 / RECORD SLEEVE 这一类。 */
export const labelStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 6.5,
  lineHeight: "8px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: COLORS.inkSoft,
  whiteSpace: "nowrap",
};

export const axisStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 5.6,
  lineHeight: "7px",
  color: COLORS.inkSoft,
  whiteSpace: "nowrap",
};

/** 在舞台上绝对定位一个盒子。 */
export function at(
  left: number,
  top: number,
  extra: CSSProperties = {},
): CSSProperties {
  return { position: "absolute", left, top, ...extra };
}

/** 频谱图的绘图区：0 dBFS 在顶，-180 dBFS 在底。 */
export const PLOT = { x: 374, y: 220, width: 605, height: 162 } as const;
