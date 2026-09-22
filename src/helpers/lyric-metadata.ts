import type { LyricLine } from "@applemusic-like-lyrics/core";

const CREDIT_KEYWORDS = [
  "词",
  "詞",
  "曲",
  "词曲",
  "詞曲",
  "作词",
  "作詞",
  "作曲",
  "编曲",
  "編曲",
  "制作",
  "製作",
  "制作人",
  "製作人",
  "原唱",
  "原曲",
  "监制",
  "監製",
  "混音",
  "录音",
  "錄音",
  "母带",
  "母帶",
  "出品",
  "发行",
  "發行",
  "翻唱",
  "lyricist",
  "composer",
  "arranger",
  "producer",
  "lyrics",
  "arrangedby",
  "producedby",
  "composedby",
  "lyricsby",
  "writtenby",
] as const;

const CREDIT_REGEXES = [
  /^纯音乐，请欣赏$/,
  /^此歌曲为没有填词的纯音乐，请您欣赏$/,
  /未经(?:授权|许可)/,
] as const;

const NO_COLON_SEPARATORS = new Set([
  ":",
  ",",
  ".",
  "!",
  "-",
  "_",
  "(",
  "[",
  "{",
  "【",
  "『",
  "「",
  "。",
  "·",
]);

const KEYWORD_SET = new Set(CREDIT_KEYWORDS.map(normalizeCredit));

function normalizeCredit(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function unwrapBrackets(text: string): string {
  let processed = text.trim();
  const pairs = [
    ["(", ")"],
    ["（", "）"],
    ["【", "】"],
    ["[", "]"],
    ["{", "}"],
    ["『", "』"],
    ["「", "」"],
  ] as const;
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const [open, close] of pairs) {
      if (!processed.startsWith(open)) {
        continue;
      }
      if (processed.endsWith(close)) {
        processed = processed.slice(open.length, -close.length).trim();
        changed = true;
        break;
      }
    }
    if (!changed) {
      break;
    }
  }
  return processed;
}

export function lineLyricText(line: LyricLine): string {
  return line.words.map((word) => word.word).join("").trim();
}

export function isLyricMetadataLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (CREDIT_REGEXES.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  const cleaned = unwrapBrackets(trimmed);
  const colon = /[:：]/.exec(cleaned);
  if (colon) {
    const key = normalizeCredit(unwrapBrackets(cleaned.slice(0, colon.index)));
    if (!key) {
      return false;
    }
    if (KEYWORD_SET.has(key)) {
      return true;
    }
    for (const keyword of KEYWORD_SET) {
      if (!key.startsWith(keyword)) {
        continue;
      }
      const next = key[keyword.length];
      if (
        next === "/" ||
        next === "&" ||
        next === "、" ||
        next === "+" ||
        (next !== undefined && next >= "a" && next <= "z")
      ) {
        return true;
      }
    }
    return false;
  }

  const normalized = normalizeCredit(cleaned);
  if (normalized.length >= 2 && KEYWORD_SET.has(normalized)) {
    return true;
  }
  for (const keyword of KEYWORD_SET) {
    if (keyword.length < 2 || !normalized.startsWith(keyword)) {
      continue;
    }
    const next = normalized[keyword.length];
    if (next && NO_COLON_SEPARATORS.has(next)) {
      return true;
    }
  }
  return false;
}

function splitArtists(artists: string | readonly string[]): string[] {
  const values = typeof artists === "string" ? [artists] : artists;
  return values
    .flatMap((artist) => artist.split(/[、&;，,/|·・]+/g))
    .map((artist) => artist.trim())
    .filter((artist) => artist.length >= 1);
}

export function stripLyricMetadata(
  lines: readonly LyricLine[],
  meta?: { title?: string; artists?: string | readonly string[] },
): LyricLine[] {
  if (lines.length === 0) {
    return [];
  }
  const texts = lines.map(lineLyricText);
  const excluded = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    const text = texts[index] ?? "";
    if (text && isLyricMetadataLine(text)) {
      excluded.add(index);
    }
  }

  const title = meta?.title?.trim().toLowerCase();
  const artists = splitArtists(meta?.artists ?? [])
    .map((artist) => artist.toLowerCase())
    .filter((artist) => artist.length >= 1);
  if (title && artists.length > 0) {
    let scanned = 0;
    for (let index = 0; index < lines.length && scanned < 5; index++) {
      if (excluded.has(index)) {
        continue;
      }
      const text = (texts[index] ?? "").toLowerCase();
      if (!text) {
        continue;
      }
      scanned += 1;
      if (
        text.includes(title) &&
        artists.some((artist) => text.includes(artist))
      ) {
        excluded.add(index);
      }
    }
  }

  let first = -1;
  for (let index = 0; index < lines.length; index++) {
    if (excluded.has(index) || !(texts[index] ?? "")) {
      continue;
    }
    first = index;
    break;
  }
  if (first === -1) {
    return [];
  }
  let last = first;
  for (let index = lines.length - 1; index >= first; index--) {
    if (excluded.has(index) || !(texts[index] ?? "")) {
      continue;
    }
    last = index;
    break;
  }
  return lines.filter((_, index) => index >= first && index <= last && !excluded.has(index));
}
