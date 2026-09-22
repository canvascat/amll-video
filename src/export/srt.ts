import type { LyricLine } from "@applemusic-like-lyrics/core";
import { shiftLyricLines } from "../helpers/lyrics";
import { isLyricCreditLine } from "../prepare/lyric-quality";

export type SrtCue = {
  startMs: number;
  endMs: number;
  text: string;
};

export type AlbumSrtTrack = {
  songName?: string;
  audioOffsetInSeconds: number;
  audioEndInSeconds?: number;
  durationInSeconds?: number;
  lyricOffsetMs?: number;
  lyricLines: readonly LyricLine[];
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

export function formatSrtTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

export function lyricLineText(line: LyricLine): string {
  const text = line.words.map((word) => word.word).join("").trim();
  const translated = line.translatedLyric?.trim();
  return translated ? `${text}\n${translated}` : text;
}

const EXTRA_CREDIT =
  /^(作詞|編曲|製作人|詞|曲|词|原唱)\s*[:：]/;
const ENGLISH_CREDIT =
  /^(produced|arranged|mixed|recorded|additional|background vocals|production co|guitars|strings|op|sp)\b/i;

function shouldSkipLyricText(text: string, songName?: string): boolean {
  const first = text.split("\n")[0]?.trim() ?? "";
  if (
    !first ||
    isLyricCreditLine(first) ||
    EXTRA_CREDIT.test(first) ||
    ENGLISH_CREDIT.test(first)
  ) {
    return true;
  }
  if (!songName?.trim()) {
    return false;
  }
  const name = songName.trim();
  return first === name || first.endsWith(` - ${name}`) || first.endsWith(`-${name}`);
}

function trackEndSeconds(track: AlbumSrtTrack): number {
  return (
    track.audioEndInSeconds ??
    track.durationInSeconds ??
    track.audioOffsetInSeconds
  );
}

function lineEndMs(line: LyricLine, nextStartMs?: number, windowEndMs?: number): number {
  const candidates = [line.endTime, nextStartMs, windowEndMs].filter(
    (value): value is number => value !== undefined && Number.isFinite(value) && value > 0,
  );
  return Math.min(...candidates);
}

export function albumSrtCuesFromTracks(
  tracks: readonly AlbumSrtTrack[],
): SrtCue[] {
  const firstOffset = tracks[0]?.audioOffsetInSeconds ?? 0;
  const cues: SrtCue[] = [];

  for (const track of tracks) {
    const windowStartMs = Math.max(0, (track.audioOffsetInSeconds - firstOffset) * 1000);
    const windowEndMs = Math.max(0, (trackEndSeconds(track) - firstOffset) * 1000);
    const shifted = shiftLyricLines(track.lyricLines, track.lyricOffsetMs ?? 0);

    for (let index = 0; index < shifted.length; index++) {
      const line = shifted[index];
      if (!line) {
        continue;
      }
      const text = lyricLineText(line);
      if (!text || shouldSkipLyricText(text, track.songName) || line.isBG) {
        continue;
      }
      const next = shifted[index + 1];
      const startMs = windowStartMs + line.startTime;
      let endMs = windowStartMs + lineEndMs(
        line,
        next && Number.isFinite(next.startTime) ? next.startTime : undefined,
        windowEndMs - windowStartMs,
      );
      if (startMs >= windowEndMs) {
        continue;
      }
      endMs = Math.min(endMs, windowEndMs);
      if (endMs <= startMs) {
        continue;
      }
      cues.push({ startMs, endMs, text });
    }
  }

  return cues;
}

export function buildSrt(cues: readonly SrtCue[]): string {
  return cues
    .map((cue, index) =>
      [
        String(index + 1),
        `${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}`,
        cue.text,
        "",
      ].join("\n"),
    )
    .join("\n");
}
