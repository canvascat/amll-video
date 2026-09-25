import { parseFile } from "music-metadata";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchJson, fetchText } from "./http";
import { fileStem } from "./write-materials";

export type VideoBlurb = {
  title: string;
  description: string;
};

type Credit = {
  role: string;
  name: string;
};

const CREDIT_ROLES = ["词", "曲", "编曲", "制作人"] as const;

export function formatClock(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function buildVideoBlurb(input: {
  songName: string;
  artists: string[];
  albumName: string;
  releaseDate?: string;
  genre?: string;
  credits?: Credit[];
  sampleRate?: number;
  bitsPerSample?: number;
  channels?: number;
  durationSeconds?: number;
}): VideoBlurb {
  const song = input.songName.trim() || "未知歌曲";
  const artists = unique(input.artists.map((name) => name.trim()).filter(Boolean));
  const artistLabel = artists.join("、") || "未知歌手";
  const album = input.albumName.trim();
  const title = album
    ? `${artistLabel}《${song}》｜${album}`
    : `${artistLabel}《${song}》`;

  const lines: string[] = [];
  const release = formatReleaseDate(input.releaseDate);
  const lead = [
    `${artistLabel}演唱的《${song}》`,
    album ? `收录于专辑《${album}》` : "",
    release ? `${release}发行` : "",
  ]
    .filter(Boolean)
    .join("，");
  lines.push(`${lead}。`);

  if (input.genre?.trim()) {
    lines.push(`流派：${input.genre.trim()}`);
  }
  for (const credit of input.credits ?? []) {
    if (credit.role && credit.name) {
      lines.push(`${credit.role}：${credit.name}`);
    }
  }

  const spec = audioSpec(input);
  if (spec) {
    lines.push(`音源：${spec}`);
  }
  if (input.durationSeconds && input.durationSeconds > 0) {
    lines.push(`时长：${formatClock(input.durationSeconds)}`);
  }
  lines.push("画面为歌词视频，音轨使用原文件无损封装。");

  return { title, description: lines.join("\n") };
}

export async function writeVideoBlurb(options: {
  audioPath: string;
  lyricPath?: string;
  outDir: string;
}): Promise<{ blurb: VideoBlurb; textPath: string }> {
  const facts = await collectFacts(options.audioPath, options.lyricPath);
  const blurb = buildVideoBlurb(facts);
  const textPath = path.join(options.outDir, `${fileStem(options.audioPath)}.txt`);
  const body = `标题\n${blurb.title}\n\n简介\n${blurb.description}\n`;
  await writeFile(textPath, body, "utf8");
  return { blurb, textPath };
}

async function collectFacts(audioPath: string, lyricPath?: string) {
  const metadata = await parseFile(audioPath);
  const common = metadata.common;
  const lyricText = lyricPath ? await readFile(lyricPath, "utf8").catch(() => "") : "";
  const ttmlArtists = readTtmlValues(lyricText, "artists");
  const artists = unique([
    ...(common.artists ?? []),
    common.artist ?? "",
    ...ttmlArtists,
  ]);
  const appleId = readTtmlValues(lyricText, "appleMusicId")[0];
  const qqId = readTtmlValues(lyricText, "qqMusicId")[0];
  const [apple, credits] = await Promise.all([
    appleId ? lookupApple(appleId) : Promise.resolve(undefined),
    qqId ? lookupQqCredits(qqId) : Promise.resolve([]),
  ]);

  return {
    songName: common.title?.trim() || readTtmlValues(lyricText, "musicName")[0] || fileStem(audioPath),
    artists,
    albumName: common.album?.trim() || readTtmlValues(lyricText, "album")[0] || "",
    releaseDate: common.date?.trim() || apple?.releaseDate,
    genre: common.genre?.filter(Boolean).join("、") || apple?.genre,
    credits: credits.length ? credits : tagCredits(common.composer),
    sampleRate: metadata.format.sampleRate,
    bitsPerSample: metadata.format.bitsPerSample,
    channels: metadata.format.numberOfChannels,
    durationSeconds: metadata.format.duration,
  };
}

function tagCredits(composer: string[] | undefined): Credit[] {
  const name = composer?.map((item) => item.trim()).filter(Boolean).join("、");
  return name ? [{ role: "曲", name }] : [];
}

function readTtmlValues(text: string, key: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(
    `<amll:meta\\s+key="${key}"\\s+value="([^"]*)"`,
    "g",
  );
  for (const match of text.matchAll(pattern)) {
    const value = decodeXml(match[1] ?? "");
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function lookupApple(
  id: string,
): Promise<{ releaseDate?: string; genre?: string } | undefined> {
  try {
    const body = await fetchJson<{
      results?: Array<{ releaseDate?: string; primaryGenreName?: string }>;
    }>(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=tw`);
    const hit = body.results?.[0];
    if (!hit) {
      return undefined;
    }
    return {
      releaseDate: hit.releaseDate?.slice(0, 10),
      genre: hit.primaryGenreName,
    };
  } catch {
    return undefined;
  }
}

async function lookupQqCredits(mid: string): Promise<Credit[]> {
  try {
    const params = new URLSearchParams({
      format: "json",
      nobase64: "1",
      g_tk: "5381",
      songmid: mid,
    });
    const text = await fetchText(
      `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${params.toString()}`,
      { headers: { Referer: "https://y.qq.com/" } },
    );
    const body = JSON.parse(text) as { lyric?: string };
    return parseCreditLines(body.lyric ?? "");
  } catch {
    return [];
  }
}

export function parseCreditLines(lyric: string): Credit[] {
  const credits: Credit[] = [];
  for (const raw of lyric.split(/\r?\n/)) {
    const line = raw.replace(/^\[[^\]]+\]/, "").trim();
    const match = line.match(/^(词|曲|编曲|制作人)\s*[:：]\s*(.+)$/);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    if (!CREDIT_ROLES.includes(match[1] as (typeof CREDIT_ROLES)[number])) {
      continue;
    }
    credits.push({ role: match[1], name: match[2].replace(/\//g, "、").trim() });
  }
  return credits;
}

function audioSpec(input: {
  sampleRate?: number;
  bitsPerSample?: number;
  channels?: number;
}): string {
  const parts: string[] = ["FLAC"];
  if (input.sampleRate) {
    parts.push(`${input.sampleRate / 1000} kHz`);
  }
  if (input.bitsPerSample) {
    parts.push(`${input.bitsPerSample} bit`);
  }
  if (input.channels === 2) {
    parts.push("立体声");
  } else if (input.channels === 1) {
    parts.push("单声道");
  }
  return parts.length > 1 ? parts.join(" / ") : "";
}

function formatReleaseDate(value: string | undefined): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return "";
  }
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
