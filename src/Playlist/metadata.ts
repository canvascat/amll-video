import { DEFAULT_FPS } from "../remotion/constants";
import type { PlaylistCompositionProps, TrackProps } from "../helpers/schema";
import { playlistTrackSpans } from "./lattice/timeline";

function ready(track: TrackProps): boolean {
  return (
    typeof track.durationInSeconds === "number"
    && track.durationInSeconds > 0
    && Array.isArray(track.lyricLines)
    && track.lyricLines.length > 0
  );
}

export async function resolvePlaylistMetadata(
  props: PlaylistCompositionProps,
  resolveTrack: (track: TrackProps) => Promise<TrackProps>,
): Promise<{ fps: number; durationInFrames: number; props: PlaylistCompositionProps }> {
  const tracks = await Promise.all(
    props.tracks.map((track) => (ready(track) ? track : resolveTrack(track))),
  );
  const durationInFrames = playlistTrackSpans(tracks, DEFAULT_FPS)
    .reduce((sum, span) => sum + span.durationInFrames, 0);
  return {
    fps: DEFAULT_FPS,
    durationInFrames: Math.max(1, durationInFrames),
    props: { tracks },
  };
}
