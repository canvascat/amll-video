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

export type TimedTrack = {
  durationInSeconds?: number;
  audioOffsetInSeconds: number;
  audioEndInSeconds?: number;
};

function cueEndSeconds(track: TimedTrack): number {
  return track.audioEndInSeconds ?? track.durationInSeconds ?? track.audioOffsetInSeconds;
}

export function trackIndexAtAudioSeconds(
  tracks: readonly TimedTrack[],
  timeSeconds: number,
): number {
  if (tracks.length === 0) {
    return 0;
  }

  for (let index = 0; index < tracks.length; index++) {
    const track = tracks[index];
    if (!track) {
      continue;
    }
    if (timeSeconds < cueEndSeconds(track)) {
      return index;
    }
  }

  return tracks.length - 1;
}

export function albumSpanInFrames(
  tracks: readonly TimedTrack[],
  fps: number,
): number {
  const first = tracks[0];
  const last = tracks[tracks.length - 1];
  if (!first || !last) {
    return 1;
  }
  const start = first.audioOffsetInSeconds;
  const end = cueEndSeconds(last);
  return Math.max(1, Math.floor(Math.max(0, end - start) * fps));
}
