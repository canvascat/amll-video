import { COLORS, at, labelStyle } from "./theme";

const X = 374;
const WIDTH = 605;
const MID = 427;
const SWING = 8;

/** 频谱下面那条平缓的线：当前位置前后各 0.5 秒的低频波形。 */
export const ScopePanel: React.FC<{ trace: readonly number[] | null }> = ({
  trace,
}) => {
  const points = trace && trace.length > 1 ? trace : [0, 0];
  const path = points
    .map((value, index) => {
      const x = X + (index / (points.length - 1)) * WIDTH;
      const y = MID - value * SWING;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <>
      <div style={at(373, 410, { ...labelStyle, textTransform: "none" })}>
        LOW-BAND WAVEFORM / ±0.5 s WINDOW
      </div>
      <div
        style={at(373, 410, {
          ...labelStyle,
          width: WIDTH + 1,
          textAlign: "right",
          textTransform: "none",
        })}
      >
        ≤ 150 Hz
      </div>
      <svg
        width={1024}
        height={460}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <line
          x1={X}
          x2={X + WIDTH}
          y1={MID}
          y2={MID}
          stroke={COLORS.ruleSoft}
          strokeWidth={0.5}
        />
        <path
          d={path}
          fill="none"
          stroke={COLORS.trace}
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
