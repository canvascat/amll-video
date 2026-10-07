import { formatClock } from "./format";
import { COLORS, at, axisStyle, labelStyle } from "./theme";

const X = 374;
const WIDTH = 605;
const TOP = 457;
const HEIGHT = 15;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

export const TimelinePanel: React.FC<{
  peaks: readonly number[] | undefined;
  elapsedSeconds: number;
  totalSeconds: number;
}> = ({ peaks, elapsedSeconds, totalSeconds }) => {
  const progress =
    totalSeconds > 0
      ? Math.max(0, Math.min(1, elapsedSeconds / totalSeconds))
      : 0;
  const playheadX = X + progress * WIDTH;
  const levels =
    peaks && peaks.length > 0 ? peaks : Array.from({ length: 300 }, () => 0.08);
  const pitch = WIDTH / levels.length;

  return (
    <>
      <div style={at(373, 444, labelStyle)}>03 / Track Timeline</div>
      <div
        style={at(373, 452, {
          ...labelStyle,
          width: WIDTH + 1,
          textAlign: "right",
          color: COLORS.ink,
        })}
      >
        {formatClock(elapsedSeconds)} / {formatClock(totalSeconds)}
      </div>
      <svg
        width={1024}
        height={500}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <defs>
          <clipPath id="spectra-timeline-played">
            <rect
              x={X}
              y={TOP - 4}
              width={Math.max(0, playheadX - X)}
              height={HEIGHT + 8}
            />
          </clipPath>
        </defs>
        {levels.map((level, index) => {
          const height = Math.max(1, level * HEIGHT);
          return (
            <rect
              key={index}
              x={X + index * pitch}
              y={TOP + HEIGHT - height}
              width={Math.max(0.8, pitch * 0.62)}
              height={height}
              fill={COLORS.unplayed}
            />
          );
        })}
        <g clipPath="url(#spectra-timeline-played)">
          {levels.map((level, index) => {
            const height = Math.max(1, level * HEIGHT);
            return (
              <rect
                key={index}
                x={X + index * pitch}
                y={TOP + HEIGHT - height}
                width={Math.max(0.8, pitch * 0.62)}
                height={height}
                fill={COLORS.accent}
              />
            );
          })}
        </g>
        <rect
          x={playheadX - 0.5}
          y={TOP - 2}
          width={1}
          height={HEIGHT + 4}
          fill={COLORS.accent}
        />
      </svg>
      {TICKS.map((tick) => (
        <div
          key={tick}
          style={at(X + tick * WIDTH - 20, TOP + HEIGHT + 8, {
            ...axisStyle,
            width: 40,
            textAlign: tick === 0 ? "left" : tick === 1 ? "right" : "center",
            marginLeft: tick === 0 ? 20 : tick === 1 ? -20 : 0,
          })}
        >
          {formatClock(tick * totalSeconds)}
        </div>
      ))}
    </>
  );
};
