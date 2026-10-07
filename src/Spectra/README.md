# SpectraPlayer（`src/Spectra`）

一首歌的“频谱仪面板”画面：米色底，封面、正在播放、实时频谱、低频波形、曲目时间轴、当前句歌词和翻译，底部是音频技术参数。组合 ID 是 `SpectraPlayer`，1920×1080、30 fps。

界面按 1024×576 的坐标摆放，渲染时整体放大到视频尺寸（`Main.tsx` 里的 `scale`）。

## 预览与导出

```console
# Studio 里选 SpectraPlayer，默认曲目是《半岛铁盒》
nub run dev

# 指定一首歌预览（不会自动跳到该画面，需要在左侧选 SpectraPlayer，或访问 /SpectraPlayer）
nub run export -- <配置.json> --spectra --preview

# 导出（先出无声画面，再无损 mux 原音轨）
nub run export -- <配置.json> --spectra
```

`--spectra` 只用于单曲，不能和 `--album`、`--playlist`、`.cue` 一起用。配置 json 和 `AMLLPlayer` 用的是同一份。

## 面板

| 区域                  | 内容                                                 | 数据来源                  |
| --------------------- | ---------------------------------------------------- | ------------------------- |
| 顶栏                  | `SPECTRA`、副标题、右上角 `96.0 kHz / 24 BIT`        | 音频文件                  |
| 01 Record Sleeve      | 封面，橙色角标，缓慢转动的虚线圆环                   | `coverImageUrl`           |
| Album / Release       | 专辑名、歌手；专辑名缺失时用歌名                     | `albumName`、`artistName` |
| Year / Track / BPM    | 年份、曲序、BPM，缺项显示 `—`                        | props，或音频标签         |
| Now Playing           | 歌名、歌手、音质、流派、时长                         | props、音频文件           |
| 02 Frequency Spectrum | 100 根对数频率柱 + 橙色峰值保持                      | 当前时刻的 FFT            |
| 低频波形              | 当前位置前后各 0.5 秒的低频波形                      | 采样平均                  |
| 03 Track Timeline     | 整首歌的响度包络，已播放部分着色，带播放头和时间刻度 | 整首解码                  |
| 04 Lyrics             | 三行：上一句、当前句、下一句，前后两句渐隐，换句时整体上滚；每句带翻译                      | `lyricLines`              |
| 技术参数              | 采样率、位深、声道、格式、码率、文件大小             | 音频文件                  |

缺少的信息（例如 BPM、没有标签的流派）一律显示 `—`，不会编造。

## 频谱怎么算

FFT 用开源库 [fft.js](https://github.com/indutny/fft.js)，加窗、校准和分频的部分在 `analysis.ts` 里。没用 Remotion 的 `visualizeAudio`，因为它会把采样压成 16 位，-96 dB 以下全是底噪，画不出 -180 dBFS 的量程。

- 取左声道，当前帧前后 8192 个采样，加 Hann 窗。幅度按满刻度正弦 = 1.0 校准，所以 `20·log10(幅度)` 就是 dBFS。
- 横轴从 20 Hz 到奈奎斯特频率，按对数等比分成 100 根柱子。柱子比一个 FFT bin 还窄的低频段在相邻 bin 间插值，其余取频带内的均方根。奈奎斯特跟着音频的真实采样率走（96 kHz 的歌画到 48k，44.1 kHz 的画到 22.1k）。
- 纵轴 -180 ~ 0 dBFS，每 20 dB 一格，右侧对应线性幅度 `1 ~ 1e-9`。
- 柱子取最近 4 帧的加权平均（每过一帧权重 ×0.6）。峰值保持看最近 12 帧，每过一帧下落 1.6 dB。
- 每一帧只依赖这一帧附近的采样，所以并行渲染多路也不会闪。

音频用 `useWindowedAudioData` 按 30 秒一段解码，不会一次把整首读进内存。

## 响度包络和技术参数

`calculateSpectraMetadata`（`src/helpers/calculate-metadata.ts`）在渲染前调用 `loadSpectraAudioInfo`（`audio-info.ts`），一次读出：

- 采样率、位深、声道、格式、年份、曲序、流派、BPM：[music-metadata](https://github.com/Borewit/music-metadata) 流式读文件头，解析完就停，不会下载整首。位深只有无损格式才有，有损格式显示 `—`。
- 文件大小：响应头的 `Content-Length`；码率 = 大小 × 8 / 时长。
- 响度包络：用 [mediabunny](https://mediabunny.dev/)（Remotion 自己也用它）解码播放区间（`audioOffsetInSeconds` 到 `audioEndInSeconds`），分成 300 桶，每桶取左右声道平均后的 RMS，按最大值归一并略微压缩。music-metadata 读不出采样率 / 声道时用解码器的值兜底。

结果写进 props，同一首歌在同一次会话里只算一次。读取失败时对应字段留空，界面显示 `—`，时间轴退回一条低矮的平线。

## 配色

默认从封面自动取色（`cover-theme.ts` + `palette.ts`）：

- 取色用 [node-vibrant](https://github.com/Vibrant-Colors/node-vibrant)（MMCQ 量化）。在 Vibrant / LightVibrant / DarkVibrant 三个色板里挑占比最大且够鲜的一个当强调色；都不够鲜（黑白灰封面）就回到默认的米色 + 橙色。
- 颜色换算和对比度检查用 [chroma-js](https://github.com/gka/chroma.js)。
- 配色规则在 `palette.ts`：纸色、墨色、灰字取强调色的色相，饱和度很低；柱子、低频波形、翻译取互补色；黄绿色会压暗一点，保证在浅底上读得清。
- 颜色通过 CSS 变量 `--sp-*` 挂在舞台根节点上（`themeVars`），组件里只引用 `COLORS`，换封面只换一组变量。

props 可以覆盖：

| 属性             | 说明                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `theme`          | 手动指定整套颜色（`paper`、`ink`、`inkSoft`、`accent`、`bar`、`trace`、`translation`、`unplayed`），填了就不再取色 |
| `themeFromCover` | 设为 `false` 时固定用默认配色                                                                                      |

跨域的网络封面读不了像素，会自动用默认配色。

## 组合的 props

在 `trackSchema`（歌名、歌手、专辑、音频、歌词、封面、偏移等，和 `AMLLPlayer` 相同）之外，多了：

| 属性                                     | 说明                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| `year` / `trackNumber` / `genre` / `bpm` | 界面里展示；不填时读音频标签 |
| `audioInfo`                              | 技术参数和响度包络。通常不用填，会自动读取                 |
| `theme` / `themeFromCover`               | 见上                                                       |

## 文件

| 文件              | 作用                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `Main.tsx`        | 组合入口：布局、音频、各面板拼装                                     |
| `Spectrum.tsx`    | 频谱图：网格、坐标轴、柱子、峰值                                     |
| `Scope.tsx`       | 低频波形                                                             |
| `Timeline.tsx`    | 曲目时间轴                                                           |
| `LyricsPanel.tsx` | 歌词和翻译的滚动、渐隐                                               |
| `theme.ts`        | 舞台尺寸、颜色变量、字体、公用样式                                   |
| `analysis.ts`     | FFT、对数频带、dBFS 换算、峰值保持（纯计算）                         |
| `trace.ts`        | 低频波形的计算（纯计算）                                             |
| `format.ts`       | 时间 / 采样率 / 码率等格式化、频率刻度、歌词条目、字号适配（纯计算） |
| `audio-info.ts`   | 读取技术参数、标签、响度包络（仅浏览器）                             |
| `palette.ts`      | 从像素推配色、对比度（纯计算）                                       |
| `cover-theme.ts`  | 读取封面像素并调用 `palette`（仅浏览器）                             |

标注“纯计算”的模块不依赖 React 和浏览器，都带单测：

```console
node --import ./scripts/register-ts.mjs --test src/Spectra/*.test.ts
```

## 用到的开源库

| 库 | 用在 |
| --- | --- |
| [fft.js](https://github.com/indutny/fft.js) | 频谱的 FFT |
| [music-metadata](https://github.com/Borewit/music-metadata) | 采样率、位深、格式和标签 |
| [mediabunny](https://mediabunny.dev/) | 解码音频算响度包络 |
| [node-vibrant](https://github.com/Vibrant-Colors/node-vibrant) | 封面取主色 |
| [chroma-js](https://github.com/gka/chroma.js) | 颜色空间换算、对比度 |

Hann 窗、对数频带、dB 换算、响度分桶、低频波形的平均都是几行公式，没有为它们单独引依赖。

## 已知限制

- 字体用系统字体（SF Mono、PingFang 等），不依赖网络；换一台机器字形会略有差别。
- 频谱和波形只用左声道。
- BPM 只有标签里写了才有。
- 通过 `--props` 手工传 TTML 歌词路径时，要传浏览器能访问的 URL；走导出 CLI 或 Studio 默认参数没有这个问题。
- 计算模块叫 `analysis.ts` 而不是 `spectrum.ts`：macOS 默认不区分大小写，会和 `Spectrum.tsx` 的导入互相串。
