import { titleFromAudioPath } from "../export/timing";
import { LOOKUP_TIMEOUT_MS, fetchBytes, mergeSignals } from "./http";
import { lyricFormatRank } from "./lyric-quality";
import { buildSearchKeyword, scoreCandidate } from "./match";
import { overlayAmlTtml } from "./providers/amll-ttml";
import { lookupItunes } from "./providers/itunes";
import { lookupKugou } from "./providers/kugou";
import { lookupLrclib } from "./providers/lrclib";
import { lookupNetease } from "./providers/netease";
import { lookupQqMusic } from "./providers/qqmusic";
import { firstNonBlank, readLocalTags, resolveQueryTitle } from "./tags";
import type {
  CoverSource,
  LookupResult,
  ProviderLyric,
  ResolvedCover,
  TrackQuery,
} from "./types";

function pickBestLyric(
  hits: ProviderLyric[],
  query: TrackQuery,
): ProviderLyric | null {
  let best: ProviderLyric | null = null;
  let bestRank = -1;
  let bestScore = -1;
  for (const hit of hits) {
    const rank = lyricFormatRank(hit.format);
    const score = Math.max(0, scoreCandidate(hit.candidate, query));
    if (rank > bestRank || (rank === bestRank && score > bestScore)) {
      best = hit;
      bestRank = rank;
      bestScore = score;
    }
  }
  return best;
}

function coverSourceFor(hit: ProviderLyric): CoverSource {
  if (hit.source === "kugou") {
    return "kugou";
  }
  if (hit.source === "qqmusic" || hit.candidate.extra?.mid) {
    return "qqmusic";
  }
  if (
    hit.source === "netease" ||
    hit.source === "amll-ttml" ||
    hit.candidate.extra?.id
  ) {
    return "netease";
  }
  return "itunes";
}

async function downloadCover(
  url: string,
  source: CoverSource,
  signal?: AbortSignal,
): Promise<ResolvedCover | undefined> {
  try {
    const { data, mimeType } = await fetchBytes(url, { signal });
    if (data.byteLength < 32) {
      return undefined;
    }
    return { source, data, mimeType };
  } catch {
    return undefined;
  }
}

export async function lookupTrack(options: {
  audioPath: string;
  title?: string;
  artist?: string;
  album?: string;
  signal?: AbortSignal;
}): Promise<LookupResult> {
  const tags = await readLocalTags(options.audioPath);
  const titleLocked = Boolean(options.title?.trim() || tags.title);
  const artistLocked = Boolean(options.artist?.trim() || tags.artist);
  const albumLocked = Boolean(options.album?.trim() || tags.album);

  const query: TrackQuery = {
    title: resolveQueryTitle(tags, options.audioPath, options.title),
    artist: firstNonBlank(options.artist, tags.artist),
    album: firstNonBlank(options.album, tags.album),
    durationMs: Math.round(tags.durationInSeconds * 1000),
  };
  const keyword = buildSearchKeyword(query);
  const needsLyric = !tags.embeddedLyric;
  const needsCover = !tags.cover;
  const needsIdentity = !titleLocked || !artistLocked || !albumLocked;
  const signal = mergeSignals(
    options.signal,
    AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  );

  const [netease, qqmusic, kugou, lrclib, itunes] = await Promise.all([
    needsLyric ? lookupNetease(query, keyword, signal) : Promise.resolve(null),
    needsLyric ? lookupQqMusic(query, keyword, signal) : Promise.resolve(null),
    needsLyric ? lookupKugou(query, keyword, signal) : Promise.resolve(null),
    needsLyric ? lookupLrclib(query, keyword, signal) : Promise.resolve(null),
    needsCover || needsIdentity
      ? lookupItunes(query, keyword, signal)
      : Promise.resolve(null),
  ]);

  const platformHits = [netease, qqmusic, kugou, lrclib].filter(
    (hit): hit is ProviderLyric => hit !== null,
  );
  const ttmlHits = (
    await Promise.all(
      platformHits
        .filter((hit) => hit.source === "netease" || hit.source === "qqmusic")
        .map((hit) => overlayAmlTtml(hit, signal)),
    )
  ).filter((hit): hit is ProviderLyric => hit !== null);

  const embeddedLyric: ProviderLyric | null = tags.embeddedLyric
    ? {
        source: "embedded",
        format: tags.embeddedLyric.format,
        content: tags.embeddedLyric.content,
        candidate: {
          name: query.title,
          artist: query.artist,
          album: query.album,
          duration: query.durationMs,
        },
      }
    : null;

  const lyric = embeddedLyric
    ? embeddedLyric
    : pickBestLyric([...ttmlHits, ...platformHits], query);

  let cover: ResolvedCover | undefined = tags.cover
    ? {
        source: "embedded",
        data: tags.cover.data,
        mimeType: tags.cover.mimeType,
      }
    : undefined;
  if (!cover && lyric?.coverUrl) {
    cover = await downloadCover(lyric.coverUrl, coverSourceFor(lyric), signal);
  }
  if (!cover && itunes?.coverUrl) {
    cover = await downloadCover(itunes.coverUrl, "itunes", signal);
  }

  const filenameTitle = titleFromAudioPath(options.audioPath);
  return {
    query,
    durationInSeconds: tags.durationInSeconds,
    songName: titleLocked
      ? query.title
      : firstNonBlank(
          lyric?.candidate.name,
          itunes?.candidate.name,
          query.title,
          filenameTitle,
        ),
    artistName: artistLocked
      ? query.artist
      : firstNonBlank(
          lyric?.candidate.artist,
          itunes?.candidate.artist,
          query.artist,
        ) || "未知创作者",
    albumName: albumLocked
      ? query.album
      : firstNonBlank(
          lyric?.candidate.album,
          itunes?.candidate.album,
          query.album,
        ) || "未知专辑",
    lyric: lyric
      ? {
          source: lyric.source,
          format: lyric.format,
          content: lyric.content,
          candidate: lyric.candidate,
        }
      : undefined,
    cover,
  };
}
