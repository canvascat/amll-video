import { Audio } from "@remotion/media";
import { useWindowedAudioData } from "@remotion/media-utils";
import { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  Interactive,
  Sequence,
  getRemotionEnvironment,
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
import { SpectrumPanel, type SpectrumSource } from "./Spectrum";
import { TimelinePanel } from "./Timeline";
import { lowBandTrace } from "./trace";
import {
  COLORS,
  FONT_MONO,
  FONT_SANS,
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
}> = ({ x, y, label, value, mono = true }) => (
  <>
    <div style={at(x, y, labelStyle)}>{label}</div>
    <div
      style={at(x, y + 10, {
        fontFamily: mono ? FONT_MONO : FONT_SANS,
        fontSize: mono ? 9 : 10,
        lineHeight: "12px",
        color: COLORS.ink,
        whiteSpace: "nowrap",
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
  audioInfo,
  theme,
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

  const source: SpectrumSource | null = samples
    ? { samples, sampleRate, centerSample, samplesPerFrame: sampleRate / fps }
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
        <div style={at(150, 26, labelStyle)}>A personal listening room</div>
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

        {/* 01 唱片封面 */}
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
        <Stat x={249} y={492} label="BPM" value={bpm ? String(bpm) : "—"} />
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
        <Interactive.Div
          name="Song name"
          style={{
            position: "absolute",
            left: 373,
            top: 86,
            width: 312,
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
        <Interactive.Div
          name="Artist"
          style={{
            position: "absolute",
            left: 373,
            top: 121,
            width: 312,
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
          style={at(373, 146, {
            width: 312,
            height: 0.5,
            backgroundColor: COLORS.rule,
          })}
        />
        <Stat
          x={373}
          y={156}
          mono={false}
          label="Quality"
          value={formatQuality(audioInfo?.sampleRate, audioInfo?.bitDepth)}
        />
        <Stat
          x={517}
          y={156}
          mono={false}
          label="Genre"
          value={genre?.trim() || "—"}
        />
        <Stat
          x={629}
          y={156}
          mono={false}
          label="Duration"
          value={`${String(Math.floor(trackSeconds / 60)).padStart(2, "0")}:${String(Math.floor(trackSeconds % 60)).padStart(2, "0")}`}
        />
        <div
          style={at(698, 64, {
            width: 0.5,
            height: 118,
            backgroundColor: COLORS.rule,
          })}
        />

        <LyricsPanel
          entries={entries}
          timeMs={audioSeconds * 1000}
          frame={frame}
        />
        <SpectrumPanel source={source} maxHz={sampleRate / 2} />
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
          {`${width} × ${height}  /  ${fps} FPS  /  SPECTRA`}
        </div>
      </div>
    </AbsoluteFill>
  );
};
