import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
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

const USAGE = `用法: nub run prepare -- --audio <音频> --out <目录> [选项]

根据音频标签联网匹配歌词、封面和歌名/歌手/专辑，写出自包含材料包：
  audio<原扩展名>  lyric.<格式>  cover.<图>  track.json

必填:
  --audio   音频文件路径
  --out     输出目录

可选:
  --title   覆盖音频标签中的歌名后再搜索
  --artist  覆盖艺术家
  --album   覆盖专辑名
  -h, --help
`;

type PrepareArgs = {
  audio: string;
  out: string;
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
  if (!values.audio || !values.out) {
    throw new UsageError(`需要 --audio 与 --out\n\n${USAGE}`);
  }

  return {
    audio: values.audio,
    out: values.out,
    title: values.title,
    artist: values.artist,
    album: values.album,
  };
}

async function main() {
  try {
    const args = parsePrepareArgs(process.argv.slice(2));
    const audioPath = path.resolve(args.audio);
    if (!existsSync(audioPath)) {
      throw new UsageError(`找不到音频文件: ${audioPath}`);
    }

    const result = await lookupTrack({
      audioPath,
      title: args.title,
      artist: args.artist,
      album: args.album,
    });
    const { jsonPath, prepared, hasLyrics } = await writeMaterials({
      audioPath,
      outDir: path.resolve(args.out),
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

    if (!hasLyrics) {
      throw new UsageError("未匹配到可用歌词，已写出 track.json，可手动补 lyric 后再生成视频");
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
