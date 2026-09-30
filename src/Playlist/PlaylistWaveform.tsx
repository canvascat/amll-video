import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";
import { WAVEFORM_BAR_COUNT, WAVEFORM_TRACK_HEIGHT, smoothBins, waveformBar, waveformLevels } from "./waveform";

const SPECTRUM_HISTORY = 12;

export const PlaylistWaveform: React.FC<{ src: string; frame: number }> = ({ src, frame }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { fps } = useVideoConfig();
  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src,
    frame,
    fps,
    windowInSeconds: 30,
  });
  const history = audioData
    ? Array.from({ length: SPECTRUM_HISTORY }, (_, index) => {
        const age = SPECTRUM_HISTORY - 1 - index;
        return visualizeAudio({
          fps,
          frame: Math.max(0, frame - age),
          audioData,
          numberOfSamples: 128,
          optimizeFor: "speed",
          smoothing: false,
          dataOffsetInSeconds,
        });
      })
    : [];
  const levels = waveformLevels(smoothBins(history), WAVEFORM_BAR_COUNT);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(255, 255, 255, 0.55)";
    for (let index = 0; index < levels.length; index++) {
      const bar = waveformBar(index, levels[index] ?? 0, width, height);
      context.fillRect(bar.x, bar.y, bar.width, bar.height);
    }
  }, [levels]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        zIndex: 5,
        width: "min(450px, 55vw)",
        height: WAVEFORM_TRACK_HEIGHT,
        display: "block",
      }}
    />
  );
};
