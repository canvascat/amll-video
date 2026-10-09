import { Audio } from "@remotion/media";
import { useWindowedAudioData } from "@remotion/media-utils";
import { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  Interactive,
  Sequence,
  getRemotionEnvironment,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolvePublicAsset } from "../helpers/public-asset";
import type { SpectraCompositionProps } from "../helpers/schema";
import {
  formatBitDepth,
  formatBitrate,
  formatChannels,
  formatFileSize,
  formatQuality,
  formatQualityHeadline,
  formatSampleRate,
  lyricEntries,
} from "./format";
import { DEFAULT_THEME } from "./palette";
import { LyricsPanel } from "./LyricsPanel";
import { ScopePanel } from "./Scope";
import { BAR_COUNT, SpectrumPanel } from "./Spectrum";
import { spectrumFrame } from "./analysis";
import { TimelinePanel } from "./Timeline";
import { ensureCjkSerif, FONT_SERIF } from "./fonts";
import { splitWorkTitle } from "./program";
import { lowBandTrace } from "./trace";
import {
  COLORS,
  FONT_MONO,
  FONT_SANS,
  PLOT,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  at,
  labelStyle,
  themeVars,
} from "./theme";

const COVER = { x: 42, y: 118, size: 278 } as const;
const COVER_CENTER = {
  x: COVER.x + COVER.size / 2,
  y: COVER.y + COVER.size / 2,
};
const SPEC_COLUMNS = [373, 474, 575, 676, 777, 878];
const DISC_R = 132;
const LABEL_R = 46;
const PLINTH = { x: 31, y: 107, width: 300, height: 300 } as const;
const VINYL_GROOVE_START = LABEL_R + 14;
const VINYL_GROOVE_END = DISC_R - 6;
const VINYL_GROOVES = Array.from({ length: 46 }, (_, index) => {
  return (
    VINYL_GROOVE_START + ((VINYL_GROOVE_END - VINYL_GROOVE_START) * index) / 45
  );
});
const RUNOUT = [LABEL_R + 4.5, LABEL_R + 8, LABEL_R + 11.5];

const discSector = (start: number, end: number): string => {
  const radius = DISC_R - 0.5;
  const x0 = DISC_R + radius * Math.cos(start);
  const y0 = DISC_R + radius * Math.sin(start);
  const x1 = DISC_R + radius * Math.cos(end);
  const y1 = DISC_R + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${DISC_R} ${DISC_R} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
};

const ARM_REST = 54;
const armEasing = Easing.bezier(0.55, 0.05, 0.25, 1);

/** 开头从搁架落入纹路，结束前再抬回去。中间保持播放角度。 */
const armAngle = (
  frame: number,
  fps: number,
  durationInFrames: number,
): number => {
  const drop = interpolate(frame, [0.45 * fps, 1.5 * fps], [ARM_REST, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: armEasing,
  });
  const lift = interpolate(
    frame,
    [durationInFrames - 1.5 * fps, durationInFrames - 0.45 * fps],
    [0, ARM_REST],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: armEasing,
    },
  );
  return Math.max(drop, lift);
};

/** 落下后匀加速到每 8 秒一圈，结束前再匀减速到停止。 */
const discAngle = (
  frame: number,
  fps: number,
  durationInFrames: number,
): number => {
  const spinStart = 1.15 * fps;
  const spinRamp = 0.55 * fps;
  const degreesPerFrame = 360 / (fps * 8);
  const cruise = (at: number) => {
    const spun = Math.max(0, at - spinStart);
    if (spun <= spinRamp) {
      return (degreesPerFrame * spun * spun) / (2 * spinRamp);
    }
    return degreesPerFrame * (spinRamp / 2 + (spun - spinRamp));
  };
  const spinStop = durationInFrames - 1.7 * fps;
  if (frame <= spinStop || spinStop <= spinStart + spinRamp) {
    return cruise(frame);
  }
  const intoStop = frame - spinStop;
  const base = cruise(spinStop);
  if (intoStop >= spinRamp) {
    return base + (degreesPerFrame * spinRamp) / 2;
  }
  return (
    base +
    degreesPerFrame * intoStop -
    (degreesPerFrame * intoStop * intoStop) / (2 * spinRamp)
  );
};

const Corner: React.FC<{
  x: number;
  y: number;
  flipX?: boolean;
  flipY?: boolean;
}> = ({ x, y, flipX, flipY }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 11,
      height: 11,
      borderColor: COLORS.accent,
      borderStyle: "solid",
      borderWidth: 0,
      borderTopWidth: flipY ? 0 : 1.5,
      borderBottomWidth: flipY ? 1.5 : 0,
      borderLeftWidth: flipX ? 0 : 1.5,
      borderRightWidth: flipX ? 1.5 : 0,
    }}
  />
);

const Stat: React.FC<{
  x: number;
  y: number;
  label: string;
  value: string;
  mono?: boolean;
  width?: number;
}> = ({ x, y, label, value, mono = true, width }) => (
  <>
    <div style={at(x, y, labelStyle)}>{label}</div>
    <div
      style={at(x, y + 10, {
        fontFamily: mono ? FONT_MONO : FONT_SANS,
        width,
        fontSize: mono ? 9 : 10,
        lineHeight: "12px",
        color: COLORS.ink,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      })}
    >
      {value}
    </div>
  </>
);

export const SpectraPlayer: React.FC<SpectraCompositionProps> = ({
  audioFileUrl,
  coverImageUrl = "",
  songName = "",
  artistName = "",
  albumName = "",
  lyricLines = [],
  audioOffsetInSeconds,
  audioEndInSeconds,
  durationInSeconds = 0,
  year,
  trackNumber,
  genre,
  bpm,
  composer,
  audioInfo,
  theme,
  turntable = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const audioSrc = resolvePublicAsset(audioFileUrl);
  const coverSrc = resolvePublicAsset(coverImageUrl);
  const audioOffsetInFrames = Math.round(audioOffsetInSeconds * fps);
  const audioFrame = frame + audioOffsetInFrames;
  const audioSeconds = audioFrame / fps;
  const totalSeconds = durationInFrames / fps;
  const trackSeconds =
    (audioEndInSeconds ?? durationInSeconds) - audioOffsetInSeconds;

  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src: audioSrc,
    frame: audioFrame,
    fps,
    windowInSeconds: 30,
  });
  const sampleRate = audioData?.sampleRate ?? audioInfo?.sampleRate ?? 48000;
  const centerSample = Math.round(
    (audioSeconds - dataOffsetInSeconds) * sampleRate,
  );
  const samples = audioData?.channelWaveforms[0] ?? null;

  const live = samples
    ? spectrumFrame({
        samples,
        sampleRate,
        centerSample,
        samplesPerFrame: sampleRate / fps,
        bandCount: BAR_COUNT,
      })
    : null;
  const trace = samples
    ? lowBandTrace({
        samples,
        centerSample,
        windowSamples: sampleRate,
        points: 220,
      })
    : null;
  const entries = useMemo(() => lyricEntries(lyricLines), [lyricLines]);
  // 没有歌词时不画歌词区，标题区延伸到频谱图的右缘。
  const hasLyrics = entries.length > 0;
  const nowWidth = hasLyrics ? 312 : PLOT.x + PLOT.width - 373;

  const program = splitWorkTitle(songName);
  if (program) ensureCjkSerif(`${program.work} ${program.movement}`);
  const tempo = bpm ? "" : (program?.tempo ?? "");
  const artistLine = artistName.trim();
  const albumLine = albumName.trim() || songName.trim();
  const sampleRateText =
    audioInfo?.sampleRate ?? (audioData ? sampleRate : undefined);
  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        ...themeVars(theme ?? DEFAULT_THEME),
        backgroundColor: COLORS.paper,
        overflow: "hidden",
      }}
    >
      <Sequence from={-audioOffsetInFrames}>
        {isRendering ? null : <Audio src={audioSrc} />}
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transformOrigin: "0 0",
          scale: width / STAGE_WIDTH,
          opacity: fadeIn,
          fontFamily: FONT_SANS,
          color: COLORS.ink,
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--sp-ink) 3.5%, transparent) 0.5px, transparent 0.5px), linear-gradient(90deg, color-mix(in srgb, var(--sp-ink) 3.5%, transparent) 0.5px, transparent 0.5px)",
          backgroundSize: "64px 64px",
          backgroundPosition: "10px 16px",
        }}
      >
        {/* 顶栏 */}
        <div
          style={at(42, 22, {
            fontSize: 13,
            lineHeight: "16px",
            fontWeight: 500,
            letterSpacing: "0.34em",
          })}
        >
          SPECTRA
        </div>
        <div style={at(150, 26, labelStyle)}>Measured listening</div>
        <div
          style={at(780, 25, {
            ...labelStyle,
            width: 200,
            textAlign: "right",
            fontSize: 6.8,
            textTransform: "none",
          })}
        >
          {formatQualityHeadline(sampleRateText, audioInfo?.bitDepth)}
        </div>
        <div
          style={at(42, 48, {
            width: 938,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />

        {turntable ? (
          <>
            {/* 01 唱盘：浅色木纹托盘退后，黑胶和嵌在中心的封面一起转，唱臂搁在纹路上 */}
            <div style={at(42, 87, labelStyle)}>01 / Turntable</div>
            <div
              style={at(42, 99, {
                width: 20,
                height: 1.5,
                backgroundColor: COLORS.accent,
              })}
            />
            <div
              style={at(PLINTH.x, PLINTH.y, {
                width: PLINTH.width,
                height: PLINTH.height,
                borderRadius: 18,
                backgroundColor:
                  "color-mix(in srgb, #8a6848 14%, var(--sp-paper))",
                backgroundImage:
                  "repeating-linear-gradient(96deg, rgba(92,60,34,0.05) 0 1px, transparent 1px 8px), repeating-linear-gradient(180deg, rgba(70,44,24,0.045) 0 1px, transparent 1px 10px)",
                boxShadow:
                  "0 8px 14px color-mix(in srgb, var(--sp-ink) 8%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--sp-ink) 7%, transparent)",
              })}
            />
            <div
              style={at(
                COVER_CENTER.x - DISC_R - 4,
                COVER_CENTER.y - DISC_R - 4,
                {
                  width: (DISC_R + 4) * 2,
                  height: (DISC_R + 4) * 2,
                  borderRadius: "50%",
                  backgroundColor: "#3e4348",
                  boxShadow:
                    "0 10px 16px color-mix(in srgb, var(--sp-ink) 16%, transparent), inset 0 0 0 1px rgba(255,255,255,0.16)",
                },
              )}
            />
            <div
              style={at(COVER_CENTER.x - DISC_R, COVER_CENTER.y - DISC_R, {
                width: DISC_R * 2,
                height: DISC_R * 2,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: "#070809",
                backgroundImage:
                  "radial-gradient(circle at 50% 44%, #121418 0%, #070809 42%, #040506 100%)",
                boxShadow: "inset 0 0 10px rgba(0,0,0,0.55)",
                rotate: `${discAngle(frame, fps, durationInFrames)}deg`,
              })}
            >
              <div
                style={{
                  position: "absolute",
                  left: DISC_R - LABEL_R,
                  top: DISC_R - LABEL_R,
                  width: LABEL_R * 2,
                  height: LABEL_R * 2,
                  borderRadius: "50%",
                  overflow: "hidden",
                  backgroundColor:
                    "color-mix(in srgb, var(--sp-ink) 12%, var(--sp-paper))",
                  boxShadow:
                    "0 0 0 0.6px rgba(0,0,0,0.55), inset 0 0 0 0.6px rgba(255,255,255,0.28)",
                }}
              >
                {coverSrc ? (
                  <Img
                    name="Cover"
                    src={coverSrc}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : null}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: DISC_R - 4,
                  top: DISC_R - 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "#050607",
                  boxShadow:
                    "inset 0 1px 1px rgba(0,0,0,0.8), 0 0 0 0.7px #b7a48a, 0 0 0 1.6px rgba(0,0,0,0.55)",
                }}
              />
            </div>
            <svg
              width={DISC_R * 2}
              height={DISC_R * 2}
              style={at(COVER_CENTER.x - DISC_R, COVER_CENTER.y - DISC_R, {
                pointerEvents: "none",
              })}
            >
              <defs>
                <mask id="spectra-vinyl-grooves">
                  <rect width={DISC_R * 2} height={DISC_R * 2} fill="black" />
                  {VINYL_GROOVES.map((radius, index) => (
                    <circle
                      key={index}
                      cx={DISC_R}
                      cy={DISC_R}
                      r={radius}
                      fill="none"
                      stroke="white"
                      strokeWidth={0.45}
                    />
                  ))}
                  {RUNOUT.map((radius) => (
                    <circle
                      key={radius}
                      cx={DISC_R}
                      cy={DISC_R}
                      r={radius}
                      fill="none"
                      stroke="white"
                      strokeWidth={0.6}
                    />
                  ))}
                </mask>
                <filter
                  id="spectra-vinyl-falloff"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="7" />
                </filter>
              </defs>
              {VINYL_GROOVES.map((radius, index) => (
                <circle
                  key={index}
                  cx={DISC_R}
                  cy={DISC_R}
                  r={radius}
                  fill="none"
                  stroke={`rgba(210,214,220,${(0.1 + 0.1 * (0.5 + 0.5 * Math.sin(index * 0.7))).toFixed(3)})`}
                  strokeWidth={0.5}
                />
              ))}
              {RUNOUT.map((radius) => (
                <circle
                  key={radius}
                  cx={DISC_R}
                  cy={DISC_R}
                  r={radius}
                  fill="none"
                  stroke="rgba(214,218,224,0.22)"
                  strokeWidth={0.55}
                />
              ))}
              <g
                filter="url(#spectra-vinyl-falloff)"
                mask="url(#spectra-vinyl-grooves)"
              >
                <path
                  d={discSector(-2.25, -1.42)}
                  fill="rgba(255,255,255,0.28)"
                />
                <path
                  d={discSector(-2.05, -1.62)}
                  fill="rgba(255,255,255,0.55)"
                />
                <path d={discSector(-1.92, -1.74)} fill="white" />
                <path
                  d={discSector(0.95, 1.45)}
                  fill="rgba(255,255,255,0.34)"
                />
              </g>
              <circle
                cx={DISC_R}
                cy={DISC_R}
                r={DISC_R - 3.2}
                fill="none"
                stroke="#070809"
                strokeWidth={4.6}
              />
            </svg>
            <svg
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
              }}
            >
              <line
                x1={318}
                y1={120}
                x2={306}
                y2={134}
                stroke="#1c1e20"
                strokeWidth={6}
                strokeLinecap="round"
              />
              <circle cx={306} cy={134} r={7} fill="#2c2e31" />
              <circle cx={306} cy={134} r={2.6} fill="#8d9094" />
              <g
                transform={`rotate(${armAngle(frame, fps, durationInFrames)} 306 134)`}
              >
                <path
                  d="M 306 134 C 328 162, 296 168, 262 186"
                  fill="none"
                  stroke="#242628"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
                <path
                  d="M 276 172 L 260 188"
                  fill="none"
                  stroke="#141618"
                  strokeWidth={6.5}
                  strokeLinecap="round"
                />
                <circle cx={258} cy={190} r={2.2} fill="#e4ddd0" />
              </g>
            </svg>
          </>
        ) : (
          <>
            <svg
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
              }}
            >
              <g
                style={{
                  transformOrigin: `${COVER_CENTER.x}px ${COVER_CENTER.y}px`,
                  rotate: `${interpolate(frame, [0, 900], [0, 12])}deg`,
                }}
              >
                <circle
                  cx={COVER_CENTER.x}
                  cy={COVER_CENTER.y}
                  r={196}
                  fill="none"
                  stroke="color-mix(in srgb, var(--sp-ink) 34%, transparent)"
                  strokeWidth={0.8}
                  strokeDasharray="0.6 6.4"
                  strokeLinecap="round"
                />
              </g>
              <circle
                cx={COVER_CENTER.x}
                cy={COVER_CENTER.y}
                r={222}
                fill="none"
                stroke="color-mix(in srgb, var(--sp-ink) 7%, transparent)"
                strokeWidth={0.6}
              />
              <circle
                cx={COVER_CENTER.x}
                cy={COVER_CENTER.y}
                r={168}
                fill="none"
                stroke="color-mix(in srgb, var(--sp-ink) 7%, transparent)"
                strokeWidth={0.6}
              />
            </svg>
            <div style={at(42, 87, labelStyle)}>01 / Record Sleeve</div>
            <div
              style={at(42, 99, {
                width: 20,
                height: 1.5,
                backgroundColor: COLORS.accent,
              })}
            />
            <div
              style={at(COVER.x, COVER.y, {
                width: COVER.size,
                height: COVER.size,
                backgroundColor:
                  "color-mix(in srgb, var(--sp-ink) 12%, var(--sp-paper))",
                boxShadow:
                  "0 10px 26px color-mix(in srgb, var(--sp-ink) 22%, transparent), 0 2px 5px color-mix(in srgb, var(--sp-ink) 18%, transparent)",
              })}
            >
              {coverSrc ? (
                <Img
                  name="Cover"
                  src={coverSrc}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : null}
            </div>
            <Corner x={COVER.x - 3} y={COVER.y - 3} />
            <Corner x={COVER.x + COVER.size - 8} y={COVER.y - 3} flipX />
            <Corner x={COVER.x - 3} y={COVER.y + COVER.size - 8} flipY />
            <Corner
              x={COVER.x + COVER.size - 8}
              y={COVER.y + COVER.size - 8}
              flipX
              flipY
            />
          </>
        )}

        <div style={at(42, 414, labelStyle)}>Album / Release</div>
        <Interactive.Div
          name="Album"
          style={{
            position: "absolute",
            left: 42,
            top: 425,
            width: 280,
            fontSize: 15,
            lineHeight: "20px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {albumLine}
        </Interactive.Div>
        <div
          style={at(42, 449, {
            width: 280,
            fontSize: 11.5,
            lineHeight: "15px",
            color: COLORS.inkSoft,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          {artistLine}
        </div>
        <div
          style={at(42, 479, {
            width: 280,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />
        <Stat x={42} y={492} label="Year" value={year ? String(year) : "—"} />
        <Stat
          x={154}
          y={492}
          label="Track"
          value={trackNumber ? String(trackNumber) : "—"}
        />
        <Stat
          x={tempo ? 188 : 249}
          y={492}
          label={tempo ? "Tempo" : "BPM"}
          value={bpm ? String(bpm) : tempo || "—"}
          width={tempo ? 134 : undefined}
        />
        <div
          style={at(42, 523, {
            width: 280,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />

        {/* 正在播放 */}
        <div
          style={at(373, 68, {
            width: 4,
            height: 4,
            backgroundColor: COLORS.accent,
            opacity: interpolate(frame % 60, [0, 30, 60], [1, 0.3, 1]),
          })}
        />
        <div style={at(383, 67, labelStyle)}>Now playing / Source master</div>
        {program && composer?.trim() ? (
          <div
            style={at(373, 80, {
              ...labelStyle,
              width: nowWidth,
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
            {composer.trim()}
          </div>
        ) : null}
        {program ? (
          <Interactive.Div
            name="Work"
            style={{
              position: "absolute",
              left: 373,
              top: composer?.trim() ? 92 : 82,
              width: nowWidth,
              fontFamily: FONT_SERIF,
              fontSize: 17,
              lineHeight: "21px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {program.work}
          </Interactive.Div>
        ) : (
          <Interactive.Div
            name="Song name"
            style={{
              position: "absolute",
              left: 373,
              top: 86,
              width: nowWidth,
              fontSize: 20,
              lineHeight: "26px",
              fontWeight: 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {songName}
          </Interactive.Div>
        )}
        {program ? (
          <Interactive.Div
            name="Movement"
            style={{
              position: "absolute",
              left: 373,
              top: composer?.trim() ? 114 : 104,
              width: nowWidth,
              fontFamily: FONT_SERIF,
              fontSize: 13,
              lineHeight: "17px",
              fontStyle: "italic",
              fontWeight: 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {program.movement}
          </Interactive.Div>
        ) : null}
        <Interactive.Div
          name="Artist"
          style={{
            position: "absolute",
            left: 373,
            top: program ? (composer?.trim() ? 132 : 122) : 121,
            width: nowWidth,
            fontSize: 12,
            lineHeight: "18px",
            color: "var(--sp-ink-soft)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {artistLine}
        </Interactive.Div>
        <div
          style={at(373, program ? (composer?.trim() ? 152 : 142) : 146, {
            width: nowWidth,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />
        <Stat
          x={373}
          y={program ? (composer?.trim() ? 162 : 152) : 156}
          mono={false}
          label="Quality"
          value={formatQuality(audioInfo?.sampleRate, audioInfo?.bitDepth)}
        />
        <Stat
          x={hasLyrics ? 517 : 575}
          y={program ? (composer?.trim() ? 162 : 152) : 156}
          mono={false}
          label="Genre"
          value={genre?.trim() || "—"}
        />
        <Stat
          x={hasLyrics ? 629 : 777}
          y={program ? (composer?.trim() ? 162 : 152) : 156}
          mono={false}
          label="Duration"
          value={`${String(Math.floor(trackSeconds / 60)).padStart(2, "0")}:${String(Math.floor(trackSeconds % 60)).padStart(2, "0")}`}
        />
        {hasLyrics ? (
          <div
            style={at(698, 64, {
              width: 0.5,
              height: 118,
              backgroundColor: COLORS.rule,
            })}
          />
        ) : null}

        {hasLyrics ? (
          <LyricsPanel
            entries={entries}
            timeMs={audioSeconds * 1000}
            frame={frame}
          />
        ) : null}
        <SpectrumPanel live={live} maxHz={sampleRate / 2} />
        <ScopePanel trace={trace} />
        <TimelinePanel
          peaks={audioInfo?.peaks}
          elapsedSeconds={frame / fps}
          totalSeconds={totalSeconds}
        />

        {/* 技术参数 */}
        <div
          style={at(373, 500, {
            width: 606,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />
        <div
          style={at(373, 531, {
            width: 606,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />
        {SPEC_COLUMNS.slice(1).map((x) => (
          <div
            key={x}
            style={at(x - 8, 500, {
              width: 0.5,
              height: 31,
              backgroundColor: COLORS.ruleSoft,
            })}
          />
        ))}
        <Stat
          x={SPEC_COLUMNS[0] as number}
          y={505}
          label="Sample rate"
          value={formatSampleRate(audioInfo?.sampleRate)}
        />
        <Stat
          x={SPEC_COLUMNS[1] as number}
          y={505}
          label="Bit depth"
          value={formatBitDepth(audioInfo?.bitDepth)}
        />
        <Stat
          x={SPEC_COLUMNS[2] as number}
          y={505}
          label="Channels"
          value={formatChannels(audioInfo?.channels)}
        />
        <Stat
          x={SPEC_COLUMNS[3] as number}
          y={505}
          label="Format"
          value={audioInfo?.format ?? "—"}
        />
        <Stat
          x={SPEC_COLUMNS[4] as number}
          y={505}
          label="Bitrate"
          value={formatBitrate(audioInfo?.bitrateKbps)}
        />
        <Stat
          x={SPEC_COLUMNS[5] as number}
          y={505}
          label="File size"
          value={formatFileSize(audioInfo?.fileSizeBytes)}
        />

        {/* 页脚 */}
        <div
          style={at(42, 541, {
            width: 938,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />
        <div style={at(42, 549, labelStyle)}>Sound, in perspective.</div>
        <div
          style={at(680, 549, {
            ...labelStyle,
            width: 300,
            textAlign: "right",
          })}
        >
          {`${width} × ${height}  /  ${fps} FPS`}
        </div>
      </div>
    </AbsoluteFill>
  );
};
