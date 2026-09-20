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
  audio?: string;
  lyric?: string;
  cover?: string;
  title?: string;
  artist?: string;
  album?: string;
  out?: string;
  fps: number;
  frames?: string;
  preview?: boolean;
};

export const USAGE = `用法: nub run export -- [选项]

默认:
  不传 --audio / --lyric 时，导出 Studio 默认曲目列表（public/ + defaultProps.tracks）

单曲:
  --audio   音频文件路径（mp3 / wav / flac / m4a 等）
  --lyric   歌词文件路径（.lrc / .ttml / .yrc / .qrc / .lys）

可选:
  --cover   封面图片；缺省时尝试从音频标签读取
  --title   歌曲名；缺省时尝试从音频标签或文件名读取
  --artist  艺术家
  --album   专辑名
  --out     输出 MKV 路径，默认 out/<歌名>.mkv
  --fps     帧率，默认 30
  --frames  只渲染部分帧，例如 0-2（调试用）
  --preview 打开 Remotion Studio 预览，而不是直接导出
  -h, --help
`;

export function parseExportArgs(argv: string[]): ExportArgs {
  const args = argv.filter((arg) => arg !== "--");
  let values: {
    audio?: string;
    lyric?: string;
    cover?: string;
    title?: string;
    artist?: string;
    album?: string;
    out?: string;
    fps?: string;
    frames?: string;
    preview?: boolean;
    help?: boolean;
  };

  try {
    ({ values } = parseArgs({
      args,
      options: {
        audio: { type: "string" },
        lyric: { type: "string" },
        cover: { type: "string" },
        title: { type: "string" },
        artist: { type: "string" },
        album: { type: "string" },
        out: { type: "string" },
        fps: { type: "string" },
        frames: { type: "string" },
        preview: { type: "boolean" },
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

  if (Boolean(values.audio) !== Boolean(values.lyric)) {
    throw new UsageError(`--audio 与 --lyric 需要同时提供\n\n${USAGE}`);
  }

  const fps = values.fps === undefined ? DEFAULT_FPS : Number(values.fps);
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new UsageError(`无效的 --fps: ${values.fps}`);
  }

  return {
    audio: values.audio,
    lyric: values.lyric,
    cover: values.cover,
    title: values.title,
    artist: values.artist,
    album: values.album,
    out: values.out,
    fps,
    frames: values.frames,
    preview: Boolean(values.preview),
  };
}
