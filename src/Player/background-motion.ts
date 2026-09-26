export const SLOW_BACKGROUND_FLOW_SPEED = 0.5;
export const NORMAL_BACKGROUND_FLOW_SPEED = 1;

export type BackgroundMotion = "slow" | "static" | "normal";

const MOTIONS = ["slow", "static", "normal"] as const;

export function parseBackgroundMotion(value: string): BackgroundMotion {
  const normalized = value.trim().toLowerCase();
  if ((MOTIONS as readonly string[]).includes(normalized)) {
    return normalized as BackgroundMotion;
  }
  throw new Error(`不支持的背景动效: ${value}`);
}

export function resolveBackgroundMotion(motion: BackgroundMotion | undefined): {
  staticMode: boolean;
  flowSpeed: number;
} {
  if (motion === "static") {
    return { staticMode: true, flowSpeed: SLOW_BACKGROUND_FLOW_SPEED };
  }
  if (motion === "normal") {
    return { staticMode: false, flowSpeed: NORMAL_BACKGROUND_FLOW_SPEED };
  }
  return { staticMode: false, flowSpeed: SLOW_BACKGROUND_FLOW_SPEED };
}
