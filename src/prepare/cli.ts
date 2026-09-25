import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { prepareCueAlbum } from "./album";
import { isCuePath } from "./cue";
import { lookupTrack } from "./lookup";
import { stagePrepareInput } from "./stage";
import { writeVideoBlurb } from "./video-blurb";
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

根据音频标签联网匹配歌词、封面和歌名/歌手/专辑。
整轨 CUE 只解析曲目时间，不匹配歌词；封面和音频整张专辑共用。

先把目标文件和同目录的封面、歌词拷到项目根目录的「预处理/<源目录名>/」，再在副本上写出材料。
可用 --out 改写出位置。配置与音频同名。

单曲写出:
  <歌曲>.json  <歌曲>.<歌词格式>  <歌曲>.<图>

整轨 CUE 写出（同一音频、同一封面，曲目只有起止时间）:
  <专辑音频>.json

必填:
  --audio   音频或 .cue 路径

可选:
  --out     输出目录（默认是预处理副本所在目录）
  --title   覆盖歌名后再搜索（单曲）
  --artist  覆盖艺术家
  --album   覆盖专辑名
  --lyric-offset  核对后确认的歌词偏移（毫秒）。不传则只报告疑似值，不写入
  -h, --help
`;

type PrepareArgs = {
  audio: string;
  out?: string;
  title?: string;
  artist?: string;
  album?: string;
  lyricOffset?: number;
};

function parsePrepareArgs(argv: string[]): PrepareArgs {
  const args = argv.filter((arg) => arg !== "--");
  let values: {
    audio?: string;
    out?: string;
    title?: string;
    artist?: string;
    album?: string;
    "lyric-offset"?: string;
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
        "lyric-offset": { type: "string" },
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

  let lyricOffset: number | undefined;
  if (values["lyric-offset"] !== undefined) {
    lyricOffset = Number(values["lyric-offset"]);
    if (!Number.isFinite(lyricOffset)) {
      throw new UsageError(`--lyric-offset 需要毫秒数\n\n${USAGE}`);
    }
  }

  return {
    audio: values.audio,
    out: values.out,
    title: values.title,
    artist: values.artist,
    album: values.album,
    lyricOffset,
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
    const staged = await stagePrepareInput(inputPath);
    console.log(`已拷贝到 ${staged.dir}`);
    const outDir = path.resolve(args.out ?? staged.dir);

    if (isCuePath(inputPath)) {
      const { jsonPath, trackCount } = await prepareCueAlbum({
        cuePath: staged.inputPath,
        outDir,
        album: args.album,
        artist: args.artist,
      });
      console.log(`已写出 ${jsonPath}（${trackCount} 首，共用同一音频和封面）`);
      return;
    }

    const result = await lookupTrack({
      audioPath: staged.inputPath,
      title: args.title,
      artist: args.artist,
      album: args.album,
    });
    const { jsonPath, prepared, hasLyrics } = await writeMaterials({
      audioPath: staged.inputPath,
      outDir,
      result,
      lyricOffsetMs: args.lyricOffset,
    });

    console.log(`已写出 ${jsonPath}`);
    console.log(
      `${prepared.songName} / ${prepared.artistName} / ${prepared.albumName}`,
    );
    console.log(
      `歌词: ${prepared.match.lyricSource ?? "无"} ${prepared.match.lyricFormat ?? ""}`.trim(),
    );
    console.log(`封面: ${prepared.match.coverSource ?? "无"}`);
    if (args.lyricOffset !== undefined) {
      console.log(`已写入歌词偏移: ${args.lyricOffset}ms（仅对这次的歌词）`);
    } else if (result.suspectedLyricOffsetMs) {
      console.log(
        `疑似歌词偏移 ${result.suspectedLyricOffsetMs}ms，未写入。核对后：nub run _prepare -- --audio <音频> --lyric-offset ${result.suspectedLyricOffsetMs}`,
      );
    }

    const blurb = await writeVideoBlurb({
      audioPath: staged.inputPath,
      lyricPath: prepared.lyricsFileUrl
        ? path.join(outDir, prepared.lyricsFileUrl)
        : undefined,
      outDir,
    });
    console.log(`已写出 ${blurb.textPath}`);
    console.log(`标题: ${blurb.blurb.title}`);
    console.log(blurb.blurb.description);

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
