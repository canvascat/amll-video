import { Easing, interpolate } from "remotion";
import { FONT_SANS, COLORS, at, labelStyle } from "./theme";
import { currentLyricIndex, fitFontSize, type LyricEntry } from "./format";

const LEFT = 719;
const WIDTH = 246;
const VIEW_TOP = 82;
const VIEW_HEIGHT = 108;
/** 当前句顶边的位置（上一句在它上方，下一句在它下方），和相邻两句之间的行距。 */
const CURRENT_TOP = 119;
const PITCH = 37;
const SLIDE_MS = 480;

export const LyricsPanel: React.FC<{
  entries: readonly LyricEntry[];
  timeMs: number;
  frame: number;
}> = ({ entries, timeMs, frame }) => {
  const index = currentLyricIndex(entries, timeMs);
  const current = entries[index];
  const slide = current
    ? Easing.out(Easing.cubic)(
        interpolate(timeMs - current.startMs, [0, SLIDE_MS], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      )
    : 1;
  const visible = entries
    .map((entry, line) => ({ entry, line, rel: line - index + (1 - slide) }))
    .filter(({ line }) => line >= index - 2 && line <= index + 1);

  return (
    <>
      <div style={at(LEFT, 68, labelStyle)}>04 / Lyrics</div>
      <div
        style={at(965, 70, {
          width: 4,
          height: 4,
          backgroundColor: COLORS.accent,
          opacity: interpolate(frame % 60, [0, 30, 60], [1, 0.3, 1]),
        })}
      />
      <div
        style={at(LEFT, VIEW_TOP, {
          width: WIDTH,
          height: VIEW_HEIGHT,
          overflow: "hidden",
        })}
      >
        {visible.map(({ entry, line, rel }) => {
          const opacity = interpolate(
            rel,
            [-2, -1, 0, 1, 2],
            [0, 0.3, 1, 0.3, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          return (
            <div
              key={line}
              style={{
                position: "absolute",
                left: 0,
                width: WIDTH,
                top: CURRENT_TOP - VIEW_TOP + rel * PITCH,
                opacity,
                whiteSpace: "nowrap",
                fontFamily: FONT_SANS,
                fontWeight: 400,
              }}
            >
              <div
                style={{
                  fontSize: fitFontSize(entry.text, 14, WIDTH),
                  lineHeight: "18px",
                  color: COLORS.ink,
                }}
              >
                {entry.text}
              </div>
              {entry.translation ? (
                <div
                  style={{
                    marginTop: 1,
                    fontSize: fitFontSize(entry.translation, 10.5, WIDTH),
                    lineHeight: "14px",
                    color: COLORS.translation,
                  }}
                >
                  {entry.translation}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
};
