export function trackDurationInFrames(
  durationInSeconds: number,
  audioOffsetInSeconds: number,
  fps: number,
): number {
  return Math.max(
    1,
    Math.floor((durationInSeconds - audioOffsetInSeconds) * fps),
  );
}
