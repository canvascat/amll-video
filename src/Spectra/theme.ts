import type { CSSProperties } from "react";
import type { SpectraTheme } from "./palette";

/** 界面按 1024×576 的坐标摆放，成片时整体放大到视频尺寸。 */
export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 576;

/** 配色走 CSS 变量，换封面只需要换一组变量。变量由 themeVars() 挂在舞台根节点上。 */
export const COLORS = {
  paper: "var(--sp-paper)",
  ink: "var(--sp-ink)",
  inkSoft: "var(--sp-ink-soft)",
  rule: "color-mix(in srgb, var(--sp-ink) 12%, transparent)",
  ruleSoft: "color-mix(in srgb, var(--sp-ink) 5.5%, transparent)",
  accent: "var(--sp-accent)",
  bar: "var(--sp-bar)",
  trace: "var(--sp-trace)",
  translation: "var(--sp-translation)",
  unplayed: "var(--sp-unplayed)",
} as const;

export function themeVars(theme: SpectraTheme): Record<string, string> {
  return {
    "--sp-paper": theme.paper,
    "--sp-ink": theme.ink,
    "--sp-ink-soft": theme.inkSoft,
    "--sp-accent": theme.accent,
    "--sp-bar": theme.bar,
    "--sp-trace": theme.trace,
    "--sp-translation": theme.translation,
    "--sp-unplayed": theme.unplayed,
  };
}

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
