# rmv

用 Remotion 把一首歌做成 1920×1080 的 Apple Music-like 歌词视频：动态 Mesh 背景、左侧封面与曲目信息、右侧滚动歌词。

Studio 里预览；成片走导出 CLI：先渲染无声画面，再用 ffmpeg 把原音轨无损 mux 进 MKV。

## 准备

```console
nub install
```

项目钉在 Node 24 LTS（`.node-version`）。用 `nub` 跑脚本会自动用这个版本，避免 PATH 上的 Node 22 / 26 混用。

系统需要能调用 `ffmpeg`（没有的话会回退到 `nubx remotion ffmpeg`）。WebGL 背景建议本机装有 Chrome。

把音频和歌词放到 `public/`（Studio 默认用 `OneLastKiss.flac` + `OneLastKiss.ttml`）。歌词支持 `.lrc` / `.ttml` / `.yrc` / `.qrc` / `.lys`。

只有音频、缺歌词或封面时，可先备料。备料会先把音轨和同目录封面、歌词拷到项目根目录 `预处理/<源目录名>/`，再联网匹配并写出 json，说明见 [`src/prepare/README.md`](src/prepare/README.md)：

```console
nub run prepare -- --audio <音频或CUE>
```

预览和导出都只需要这份配置文件。

## 预览

```console
nub run export -- <配置.json> --preview
```

会建临时 `public` 目录，不改仓库里的 `public/`。不传配置时打开默认曲目：

```console
nub run dev
```

打开 Remotion Studio，Composition 为 `AMLLPlayer`。歌名、歌手、专辑、封面和时长都来自配置文件；缺时长时才从音频读取，用来决定成片长度。

## 导出

```console
nub run export -- <配置.json>
```

等价于：

```console
nub src/export/cli.ts --config <配置.json>
```

默认输出 `out/<歌名或专辑名>.mkv`。可选参数：

| 参数 | 说明 |
| --- | --- |
| `--config` | 配置文件；也可直接作为位置参数 |
| `--out` | 输出路径；若写成 `.mp4` 会改成 `.mkv` |
| `--fps` | 帧率，默认 30 |
| `--frames` | 只渲染部分帧，例如 `0-2`（调试） |
| `--concurrency` | 并行渲染路数，数字或 `50%`；默认 1 路。开太高歌词会闪 |
| `--preview` | 打开 Studio，不导出 |
| `--background` | AMLLPlayer 背景：`slow`（默认，一半速度）、`static`（静止）、`normal`（原来的速度） |
| `--album` | 用 `AlbumPlayer`：毛玻璃封面、整轨一条音频、按时间切歌名。直接传入 `.cue` 时自动开启，不需要歌词 |
| `-h` | 打印帮助 |

## 运行流程

```text
配置 json，或整轨 .cue
    → json 相对配置目录解析音频 / 歌词 / 封面；.cue 直接解析曲目时间，封面和音频各一份
    → 拷到临时 public 目录，生成 Composition props
    → Remotion 渲染无声 H.264（--muted，--gl=angle，默认 1 路并行）
    → ffmpeg -c:v copy -c:a copy -shortest
    → out/<歌名或专辑名>.mkv
```

画面由 Remotion 编码；**音轨始终是原文件 stream copy**（FLAC / WAV 不会被重编码）。整轨 CUE 多首歌共用同一文件时也只 mux 这一条原音轨。不要用 Studio 的 Render，那会经 Remotion 压缩音频；成片请用上面的导出命令。渲染临时文件写在项目根目录 `tmp/`（已 gitignore），结束后删除。

相关代码：

- `src/prepare/`：联网匹配歌词 / 封面 / 歌信并写出材料包（[文档](src/prepare/README.md)）
- `src/export/cli.ts`：入口
- `src/export/load-config.ts`：读备料 json 并解析相对路径
- `src/export/assets.ts`：准备素材和 props
- `src/export/render.ts`：Studio 预览 / Remotion 渲染
- `src/export/mux.ts`：ffmpeg 合成
- `src/Player/`：成片画面

## 其他命令

```console
nub run lint
nubx remotion upgrade
```

## Docs

Remotion：[The fundamentals](https://www.remotion.dev/docs/the-fundamentals)。问题可到 [Discord](https://discord.gg/6VzzNDwUwV) 或 [GitHub Issues](https://github.com/remotion-dev/remotion/issues/new)。

## License

部分主体需要公司许可，见 [Remotion LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。
