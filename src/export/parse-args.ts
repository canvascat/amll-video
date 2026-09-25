import path from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_FPS } from "../remotion/constants";

export class UsageError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "UsageError";
    this.exitCode = exitCode;
  }
}

export type ExportArgs = {
  config?: string;
  out?: string;
  fps: number;
  frames?: string;
  concurrency: string;
  preview?: boolean;
  album?: boolean;
  srt?: boolean;
};

export const USAGE = `用法: nub run export -- <配置.json> [选项]

读取备料生成的 json，或直接读取整轨 .cue。
json 相对配置文件所在目录解析音频 / 歌词 / 封面。
.cue 自动走专辑模式：同一音频、同一封面，曲目只有起止时间，不需要歌词。
不带 --album 时，json 只接受单曲；多首整轨请加 --album，或直接传入 .cue。

必填:
  --config  配置文件路径（也可直接作为位置参数）

可选:
  --out     输出 MKV 路径，默认 out/<歌名或专辑名>.mkv
  --fps          帧率，默认 30
  --frames       只渲染部分帧，例如 0-2（调试用）
  --concurrency  并行渲染路数，数字或 50%；默认 1 路
  --preview      打开 Remotion Studio 预览，而不是直接导出
  --album        用 AlbumPlayer：毛玻璃封面、整轨一条音频、按时间切歌名。传入 .cue 时自动开启
  --srt          只为整轨 .cue 写出字幕：按曲目起点拼接，不写入偏移，并列出疑似偏移
  -h, --help

不传配置并加上 --preview 时，打开 Studio 预览默认曲目。
`;

export function parseExportArgs(argv: string[]): ExportArgs {
  const args = argv.filter((arg) => arg !== "--");
  let values: {
    config?: string;
    out?: string;
    fps?: string;
    frames?: string;
    concurrency?: string;
    preview?: boolean;
    album?: boolean;
    srt?: boolean;
    help?: boolean;
  };
  let positionals: string[];

  try {
    ({ values, positionals } = parseArgs({
      args,
      options: {
        config: { type: "string" },
        out: { type: "string" },
        fps: { type: "string" },
        frames: { type: "string" },
        concurrency: { type: "string" },
        preview: { type: "boolean" },
        album: { type: "boolean" },
        srt: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`${message}\n\n${USAGE}`);
  }

  if (values.help) {
    throw new UsageError(USAGE, 0);
  }

  if (positionals.length > 1) {
    throw new UsageError(`多余的参数: ${positionals.slice(1).join(" ")}\n\n${USAGE}`);
  }

  const config = values.config ?? positionals[0];
  if (values.config && positionals[0] && values.config !== positionals[0]) {
    throw new UsageError(`同时传了 --config 和位置参数，只需要一份配置\n\n${USAGE}`);
  }

  if (!config && !values.preview) {
    throw new UsageError(`需要配置文件\n\n${USAGE}`);
  }

  const fps = values.fps === undefined ? DEFAULT_FPS : Number(values.fps);
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new UsageError(`无效的 --fps: ${values.fps}`);
  }

  return {
    config,
    out: values.out,
    fps,
    frames: values.frames,
    concurrency: parseConcurrency(values.concurrency),
    preview: Boolean(values.preview),
    srt: Boolean(values.srt),
    album: Boolean(values.album) || (config ? path.extname(config).toLowerCase() === ".cue" : false),
  };
}

export function defaultRenderConcurrency(): number {
  return 1;
}

function parseConcurrency(value?: string): string {
  if (value === undefined) {
    return String(defaultRenderConcurrency());
  }

  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number(trimmed.slice(0, -1));
    if (!Number.isFinite(percent) || percent <= 0) {
      throw new UsageError(`无效的 --concurrency: ${value}`);
    }
    return trimmed;
  }

  const count = Number(trimmed);
  if (!Number.isInteger(count) || count <= 0) {
    throw new UsageError(`无效的 --concurrency: ${value}`);
  }
  return String(count);
}
