import { amplitudeLabel, frequencyTicks } from "./format";
import { DB_FLOOR, dbToRatio, type SpectrumFrame } from "./analysis";
import { COLORS, PLOT, at, axisStyle, labelStyle } from "./theme";

export const BAR_COUNT = 100;
const DB_STEP = 20;
const ROWS = Array.from({ length: 10 }, (_, index) => -index * DB_STEP);

/**
 * 只收算好的柱子和峰值（各 100 个数），不收原始采样：
 * React 开发版会逐项遍历变化的 props 来记录性能轨迹，几百万个采样的数组会让 Studio 卡住数秒。
 */
export const SpectrumPanel: React.FC<{
  live: SpectrumFrame | null;
  maxHz: number;
}> = ({ live, maxHz }) => {
  const bars = live?.bars ?? Array.from({ length: BAR_COUNT }, () => DB_FLOOR);
  const peaks = live?.peaks ?? bars;
  const pitch = PLOT.width / BAR_COUNT;
  const ticks = frequencyTicks(maxHz);

  return (
    <>
      <div style={at(373, 198, labelStyle)}>02 / Frequency Spectrum</div>
      <div
        style={at(373, 198, {
          ...labelStyle,
          width: 530,
          textAlign: "right",
          textTransform: "none",
        })}
      >
        LOG AMPLITUDE / 20 dB = 10×
      </div>
      <div style={at(345, 204, axisStyle)}>dBFS</div>
      <div
        style={at(960, 204, { ...axisStyle, width: 26, textAlign: "right" })}
      >
        A / FS
      </div>
      <svg
        width={1024}
        height={420}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {ROWS.map((db) => {
          const y = PLOT.y + (1 - dbToRatio(db)) * PLOT.height;
          return (
            <line
              key={db}
              x1={PLOT.x}
              x2={PLOT.x + PLOT.width}
              y1={y}
              y2={y}
              stroke={COLORS.rule}
              strokeWidth={0.5}
              strokeDasharray={db === 0 ? undefined : "1.5 2.5"}
            />
          );
        })}
        <line
          x1={PLOT.x}
          x2={PLOT.x + PLOT.width}
          y1={PLOT.y + PLOT.height}
          y2={PLOT.y + PLOT.height}
          stroke={COLORS.rule}
          strokeWidth={0.5}
        />
        {ticks.map((tick) => (
          <line
            key={tick.label}
            x1={PLOT.x + tick.position * PLOT.width}
            x2={PLOT.x + tick.position * PLOT.width}
            y1={PLOT.y}
            y2={PLOT.y + PLOT.height}
            stroke={COLORS.ruleSoft}
            strokeWidth={0.5}
          />
        ))}
        {bars.map((db, index) => {
          const height = dbToRatio(db) * PLOT.height;
          return (
            <rect
              key={index}
              x={PLOT.x + index * pitch + pitch * 0.14}
              y={PLOT.y + PLOT.height - height}
              width={pitch * 0.72}
              height={height}
              fill={COLORS.bar}
            />
          );
        })}
        {peaks.map((db, index) => {
          if (db <= (bars[index] ?? DB_FLOOR) + 0.8 || db <= DB_FLOOR + 1)
            return null;
          return (
            <rect
              key={index}
              x={PLOT.x + index * pitch + pitch * 0.1}
              y={PLOT.y + (1 - dbToRatio(db)) * PLOT.height - 1.6}
              width={pitch * 0.8}
              height={0.9}
              fill={COLORS.accent}
            />
          );
        })}
      </svg>
      {ROWS.map((db) => {
        const y = PLOT.y + (1 - dbToRatio(db)) * PLOT.height;
        return (
          <div key={db}>
            <div
              style={at(330, y - 3.5, {
                ...axisStyle,
                width: 36,
                textAlign: "right",
              })}
            >
              {db}
            </div>
            <div style={at(986, y - 3.5, axisStyle)}>{amplitudeLabel(db)}</div>
          </div>
        );
      })}
      {ticks.map((tick) => (
        <div
          key={tick.label}
          style={at(
            PLOT.x + tick.position * PLOT.width - 20,
            PLOT.y + PLOT.height + 9,
            {
              ...axisStyle,
              width: 40,
              textAlign:
                tick.position === 0
                  ? "left"
                  : tick.position === 1
                    ? "right"
                    : "center",
              marginLeft:
                tick.position === 0 ? 20 : tick.position === 1 ? -20 : 0,
            },
          )}
        >
          {tick.label}
        </div>
      ))}
    </>
  );
};
