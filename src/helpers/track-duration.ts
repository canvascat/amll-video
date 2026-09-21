export function trackPlayableSeconds(
  durationInSeconds: number,
  audioOffsetInSeconds: number,
  audioEndInSeconds?: number,
): number {
  const end = audioEndInSeconds ?? durationInSeconds;
  return Math.max(0, end - audioOffsetInSeconds);
}

export function trackDurationInFrames(
  durationInSeconds: number,
  audioOffsetInSeconds: number,
  fps: number,
  audioEndInSeconds?: number,
): number {
  return Math.max(
    1,
    Math.floor(
      trackPlayableSeconds(
        durationInSeconds,
        audioOffsetInSeconds,
        audioEndInSeconds,
      ) * fps,
    ),
  );
}
