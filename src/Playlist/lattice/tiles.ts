export type PlaylistTile = {
  queueIndex: number;
  title: string;
  artist: string;
  coverUrl?: string;
};

export function buildPlaylistTiles(
  tracks: readonly {
    songName?: string;
    artistName?: string;
    coverImageUrl?: string;
  }[],
): PlaylistTile[] {
  return tracks.map((track, queueIndex) => ({
    queueIndex,
    title: track.songName?.trim() || "未知歌曲",
    artist: track.artistName?.trim() || "未知创作者",
    coverUrl: track.coverImageUrl,
  }));
}
