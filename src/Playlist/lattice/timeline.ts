import { trackDurationInFrames } from "../../helpers/track-duration";

export type TrackSpan = {
  index: number;
  startFrame: number;
  durationInFrames: number;
};

type TimedTrack = {
  durationInSeconds?: number;
  audioOffsetInSeconds: number;
  audioEndInSeconds?: number;
};

export function playlistTrackSpans(tracks: readonly TimedTrack[], fps: number): TrackSpan[] {
  let startFrame = 0;
  return tracks.map((track, index) => {
    const durationInFrames = trackDurationInFrames(
      track.durationInSeconds ?? 0,
      track.audioOffsetInSeconds,
      fps,
      track.audioEndInSeconds,
    );
    const span = { index, startFrame, durationInFrames };
    startFrame += durationInFrames;
    return span;
  });
}

export function playlistTimeAtFrame(
  spans: readonly TrackSpan[],
  frame: number,
  fps: number,
): { index: number; localSeconds: number } {
  const last = spans[spans.length - 1];
  if (!last) {
    return { index: 0, localSeconds: 0 };
  }
  const span = spans.find((item, index) => {
    const next = spans[index + 1];
    return frame < item.startFrame + item.durationInFrames || !next;
  }) ?? last;
  const localFrame = Math.min(
    Math.max(0, frame - span.startFrame),
    Math.max(0, span.durationInFrames - 1),
  );
  return { index: span.index, localSeconds: localFrame / fps };
}
