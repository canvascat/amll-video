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

只有音频、缺歌词或封面时，可先备料（联网匹配后写出 json + 文件），说明见 [`src/prepare/README.md`](src/prepare/README.md)：

```console
nub run prepare -- --audio <音频> --out <目录>
```

## 预览

```console
nub run dev
```

打开 Remotion Studio，Composition 为 `AMLLPlayer`。未填写的歌名、歌手、专辑、封面会从音频标签读取；时长由音频决定。

用指定文件预览（会建临时 `public` 目录，不改仓库里的 `public/`）：

```console
nub run export -- --audio <音频> --lyric <歌词> --preview
```

## 导出

```console
nub run export -- --audio <音频> --lyric <歌词>
```

等价于：

```console
nub src/export/cli.ts --audio <音频> --lyric <歌词>
```

默认输出 `out/<歌名>.mkv`。可选参数：

| 参数 | 说明 |
| --- | --- |
| `--cover` | 封面图；缺省时从音频标签读取 |
| `--title` / `--artist` / `--album` | 覆盖标签里的曲目信息 |
| `--out` | 输出路径；若写成 `.mp4` 会改成 `.mkv` |
| `--fps` | 帧率，默认 30 |
| `--frames` | 只渲染部分帧，例如 `0-2`（调试） |
| `--preview` | 打开 Studio，不导出 |
| `-h` | 打印帮助 |

## 运行流程

```text
音频 + 歌词
    → 读标签 / 时长 / 封面，解析歌词
    → 拷到临时 public 目录，生成 Composition props
    → Remotion 渲染无声 H.264（--muted，--gl=angle）
    → ffmpeg -c:v copy -c:a copy -shortest
    → out/<歌名>.mkv
```

画面由 Remotion 编码；音轨是原文件拷贝，FLAC / WAV 等不会被重编码。临时目录在结束后删除。

相关代码：

- `src/prepare/`：联网匹配歌词 / 封面 / 歌信并写出材料包（[文档](src/prepare/README.md)）
- `src/export/cli.ts`：入口
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
