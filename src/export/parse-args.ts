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
  preview?: boolean;
};

export const USAGE = `用法: nub run export -- <配置.json> [选项]

读取备料生成的 json（单曲或专辑），相对配置文件所在目录解析音频 / 歌词 / 封面。

必填:
  --config  配置文件路径（也可直接作为位置参数）

可选:
  --out     输出 MKV 路径，默认 out/<歌名或专辑名>.mkv
  --fps     帧率，默认 30
  --frames  只渲染部分帧，例如 0-2（调试用）
  --preview 打开 Remotion Studio 预览，而不是直接导出
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
    preview?: boolean;
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
        preview: { type: "boolean" },
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
    preview: Boolean(values.preview),
  };
}
