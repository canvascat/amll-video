import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { prepareCueAlbum } from "./album";
import { isCuePath } from "./cue";
import { lookupTrack } from "./lookup";
import { writeMaterials } from "./write-materials";

class UsageError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "UsageError";
    this.exitCode = exitCode;
  }
}

const USAGE = `用法: nub run prepare -- --audio <音频或CUE> [--out <目录>] [选项]

根据音频标签或 CUE 曲目表联网匹配歌词、封面和歌名/歌手/专辑。

默认写在音频 / CUE 同目录，配置与音频同名。

单曲写出:
  <歌曲>.json  <歌曲>.<歌词格式>  <歌曲>.<图>

整轨 CUE 写出（同一音频 + 每首歌的开始/结束时间）:
  <专辑音频>.json  <歌名>.<歌词格式> …

必填:
  --audio   音频或 .cue 路径

可选:
  --out     输出目录（默认与源文件相同）
  --title   覆盖歌名后再搜索（单曲）
  --artist  覆盖艺术家
  --album   覆盖专辑名
  -h, --help
`;

type PrepareArgs = {
  audio: string;
  out?: string;
  title?: string;
  artist?: string;
  album?: string;
};

function parsePrepareArgs(argv: string[]): PrepareArgs {
  const args = argv.filter((arg) => arg !== "--");
  let values: {
    audio?: string;
    out?: string;
    title?: string;
    artist?: string;
    album?: string;
    help?: boolean;
  };

  try {
    ({ values } = parseArgs({
      args,
      options: {
        audio: { type: "string" },
        out: { type: "string" },
        title: { type: "string" },
        artist: { type: "string" },
        album: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: false,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`${message}\n\n${USAGE}`);
  }

  if (values.help) {
    throw new UsageError(USAGE, 0);
  }
  if (!values.audio) {
    throw new UsageError(`需要 --audio\n\n${USAGE}`);
  }

  return {
    audio: values.audio,
    out: values.out,
    title: values.title,
    artist: values.artist,
    album: values.album,
  };
}

function resolveInput(audio: string): string {
  const resolved = path.resolve(audio);
  if (!existsSync(resolved)) {
    throw new UsageError(`找不到文件: ${resolved}`);
  }
  if (statSync(resolved).isDirectory()) {
    throw new UsageError(`请传入 .cue 或音频文件，而不是目录: ${resolved}`);
  }
  return resolved;
}

async function main() {
  try {
    const args = parsePrepareArgs(process.argv.slice(2));
    const inputPath = resolveInput(args.audio);
    const outDir = path.resolve(args.out ?? path.dirname(inputPath));

    if (isCuePath(inputPath)) {
      const { jsonPath, missingLyrics, trackCount } = await prepareCueAlbum({
        cuePath: inputPath,
        outDir,
        album: args.album,
        artist: args.artist,
      });
      console.log(`已写出 ${jsonPath}（${trackCount} 首，共用同一音频）`);
      if (missingLyrics > 0) {
        throw new UsageError(
          `${missingLyrics} 首未匹配到歌词，已写出配置，可按歌名补歌词后再生成视频`,
        );
      }
      return;
    }

    const result = await lookupTrack({
      audioPath: inputPath,
      title: args.title,
      artist: args.artist,
      album: args.album,
    });
    const { jsonPath, prepared, hasLyrics } = await writeMaterials({
      audioPath: inputPath,
      outDir,
      result,
    });

    console.log(`已写出 ${jsonPath}`);
    console.log(
      `${prepared.songName} / ${prepared.artistName} / ${prepared.albumName}`,
    );
    console.log(
      `歌词: ${prepared.match.lyricSource ?? "无"} ${prepared.match.lyricFormat ?? ""}`.trim(),
    );
    console.log(`封面: ${prepared.match.coverSource ?? "无"}`);
    if (prepared.lyricOffsetMs) {
      console.log(`歌词偏移: ${prepared.lyricOffsetMs}ms`);
    }

    if (!hasLyrics) {
      throw new UsageError(
        "未匹配到可用歌词，已写出配置，可手动补同名歌词后再生成视频",
      );
    }
  } catch (error) {
    if (error instanceof UsageError) {
      const stream = error.exitCode === 0 ? console.log : console.error;
      stream(error.message);
      process.exit(error.exitCode);
    }
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(1);
  }
}

void main();
