import { Easing, interpolate } from "remotion";
import { FONT_SANS, COLORS, at, labelStyle } from "./theme";
import {
  currentLyricIndex,
  fitFontSize,
  karaokeGradient,
  wordProgress,
  type LyricEntry,
  type LyricWord,
} from "./format";

const LEFT = 719;
const WIDTH = 246;
const VIEW_TOP = 82;
const VIEW_HEIGHT = 108;
/** 当前句顶边的位置（上一句在它上方，下一句在它下方），和相邻两句之间的行距。 */
const CURRENT_TOP = 119;
const PITCH = 37;
const SLIDE_MS = 480;

/** 没唱到的字保留多少浓度；换句的上滚动画里从 1 渐变到这个值，避免突然变淡。 */
const UNSUNG_ALPHA = 0.38;

/** 当前句逐字高亮：每个字按唱到的比例从淡色填成墨色。 */
const KaraokeLine: React.FC<{
  words: readonly LyricWord[];
  timeMs: number;
  unsungAlpha: number;
}> = ({ words, timeMs, unsungAlpha }) => {
  const unsung = `color-mix(in srgb, ${COLORS.ink} ${(unsungAlpha * 100).toFixed(1)}%, transparent)`;
  return (
    <>
      {words.map((word, index) => (
        <span
          key={index}
          style={{
            whiteSpace: "pre",
            color: "transparent",
            backgroundImage: karaokeGradient(
              wordProgress(word, timeMs),
              COLORS.ink,
              unsung,
            ),
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
          }}
        >
          {word.text}
        </span>
      ))}
    </>
  );
};

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
                {entry.words && line === index ? (
                  <KaraokeLine
                    words={entry.words}
                    timeMs={timeMs}
                    unsungAlpha={1 - slide * (1 - UNSUNG_ALPHA)}
                  />
                ) : (
                  entry.text
                )}
              </div>
              {entry.translation ? (
                <div
                  style={{
                    marginTop: 1,
                    fontSize: fitFontSize(entry.translation, 9.5, WIDTH),
                    lineHeight: "13px",
                    color: COLORS.translation,
                    opacity: 0.8,
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
