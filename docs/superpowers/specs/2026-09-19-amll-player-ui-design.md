# AMLL 播放界面接入 mlvf

日期：2026-09-19  
状态：待实现  
来源：把 `/Volumes/M1T/workspace/amll` 的播放界面接到本仓库 Remotion Studio。

## 目标

mlvf 的成片画面改成 Apple Music-like 歌词播放页：动态 Mesh 背景、左侧封面与曲目信息、右侧滚动歌词。画幅 1920×1080 横屏。在 Remotion Studio 里预览，并用 Remotion 自带流程渲染。

频谱 / 波形可视化整页替换，不再保留。合成、导出 CLI（ffmpeg mux、MKV、原音频拷贝）不在本次范围。

## 非目标

- 不搬 amll 的 `src/export/` CLI、mux、临时 public 目录工作流
- 不搬 jotai 状态机、`PrebuiltLyricPlayer` 全套控件
- 不要进度条、播放/暂停、上一首/下一首、音量、随机、循环、AirPlay、播放列表、歌词开关、顶栏 ControlThumb
- 不支持竖屏 / 方图 Composition
- 不从音频标签读取内嵌歌词（歌词只来自独立歌词文件 props）

## 架构

只保留一个 Composition，id 为 `AMLLPlayer`（替换现有 `Visualizer`）。

根组件是一层薄的 Remotion 包装，数据全部走 Composition props，不引入 jotai。

四层画面：

1. 全屏 Mesh 动态背景（封面驱动配色，低频音量跟拍）
2. 左侧封面（squircle）+ 歌名 / 歌手
3. 右侧 `LyricPlayer` 滚动歌词
4. `<Audio>` 用于 Studio 预览

依赖官方包，不重写歌词引擎和背景渲染器：

- `@applemusic-like-lyrics/core`
- `@applemusic-like-lyrics/react`
- `@applemusic-like-lyrics/lyric`
- `@applemusic-like-lyrics/ttml`
- `music-metadata`（`calculateMetadata` 读标签）
- `@xmldom/xmldom`（Node 侧解析 TTML）
- `corner-smoothing`（封面 squircle）
- `classnames`（封面组件样式拼接）

从 amll **有选择地拷贝**，不整仓搬迁：

- 封面组件与样式（`Cover` + CSS）
- 横屏布局的视觉参数（分栏比例、封面尺寸、歌词 mask、`plus-lighter`）
- 歌词解析工具（`parseLyricText` / `detectLyricFormat`），供 `calculateMetadata` 使用
- Pixi webpack stub，避免把 Pixi 打进包

不拷贝：`PrebuiltLyricPlayer`、控制类组件、`states/`、竖屏/自动布局、导出 CLI。

## 组件边界

| 单元 | 职责 | 依赖 |
| --- | --- | --- |
| `src/Root.tsx` | 注册唯一 Composition，schema、defaultProps、`calculateMetadata` | Player、metadata/lyrics helpers |
| `src/Player/Main.tsx` | 1920×1080 根画面：Audio、背景、左右分栏、delayRender | Cover、MusicInfo、Lyrics、Background |
| `src/Player/Background.tsx` | `BackgroundRender` + `MeshGradientRenderer`；接收封面 URL 与 `lowFreqVolume` | `@applemusic-like-lyrics/react` |
| `src/Player/Cover.tsx` | 专辑图 squircle + 阴影；渲染期始终视为播放中（不缩小） | `corner-smoothing` |
| `src/Player/MusicInfo.tsx` | 只显示歌名、歌手；专辑只进 props 不渲染；无菜单按钮 | 无 |
| `src/Player/Lyrics.tsx` | `LyricPlayer`；`currentTime` 由 frame 换算；对齐封面中心 | `@applemusic-like-lyrics/react` |
| `src/Player/layout.module.css` | 横屏 grid：左 45% / 右 55%；无 thumb、无控制条、无底栏 | 无 |
| `src/helpers/metadata.ts` | 从音频 URL 解析标签和内嵌封面（时长仍用 mediabunny） | `music-metadata` |
| `src/helpers/lyrics.ts` | 按扩展名解析歌词文本为 `LyricLine[]` | AMLL lyric/ttml 包 |
| `src/helpers/schema.ts` | Composition props 的 zod schema | zod |
| `src/remotion/pixi-stub.ts` | 空 Pixi 类，给 bundler alias | 无 |

删除现有可视化实现，包括但不限于：

- `src/Visualizer/Main.tsx`
- `src/Visualizer/Spectrum.tsx`
- `src/Visualizer/Waveform.tsx`
- `src/Visualizer/BassOverlay.tsx`
- `src/Visualizer/SongInfo.tsx`
- `src/helpers/process-frequency-data.ts`

删除 `src/helpers/font.ts` 与 `src/helpers/WaitForFonts.tsx`（改用系统字体栈）。

## Props 与元数据

必填：

- `audioFileUrl`：音频（`staticFile` 或远程 URL）

可选（空字符串 / 空数组表示「未传，走回退」）：

- `coverImageUrl`
- `songName`
- `artistName`
- `albumName`
- `lyricsFileUrl`（`.ttml` / `.lrc` / `.yrc` / `.qrc` / `.lys`）
- `audioOffsetInSeconds`（默认 0）

`calculateMetadata` 解析顺序：

1. 用现有 mediabunny 读时长；读不到时长则抛错，Composition 失败。
2. 用 `music-metadata` 读标签和内嵌封面（不用于时长）。
3. 字段回退：
   - `songName`：props → 标签 `title` → 音频文件名（去扩展名）
   - `artistName`：props → 标签 `artist` → `未知创作者`
   - `albumName`：props → 标签 `album` → `未知专辑`
   - `coverImageUrl`：props → 内嵌封面转 data URL → 空（画面用深色占位）
4. 若有 `lyricsFileUrl`：fetch 文本并解析为 `lyricLines`；失败则 `lyricLines = []`，不打断预览。
5. 返回 `fps: 30`、`durationInFrames`（时长减去 offset）、补齐后的 props（含 `lyricLines`）。

`lyricLines` 不是 Studio 里手填的字段，只由 `calculateMetadata` 写入。schema 里保留该字段并默认 `[]`，供组件消费。

不把内嵌 unsynced lyrics 当滚动歌词用。

## 数据流

```text
Studio props
    → calculateMetadata（时长 + 标签回退 + 歌词文件）
    → Player
         ├─ frame → currentTimeMs → LyricPlayer
         ├─ visualizeAudio 低频 → Background lowFreqVolume
         ├─ coverImageUrl → Cover + Background album
         └─ Audio(src = audioFileUrl)
```

首帧：`delayRender` 等到封面图 load（若有）以及两帧 rAF，再 `continueRender`，避免空封面闪一下。

歌词 `playing={true}`，且每帧 `isSeeking={true}`（与 amll 导出包装相同），保证逐帧渲染时歌词位置正确。

## 布局与视觉

- 画幅：1920×1080，30fps。
- 背景铺满；前景 `mix-blend-mode: plus-lighter`。
- 左栏约 45%：封面 + 歌名 + 歌手作为一组，在栏内垂直居中。
- 封面边长 `min(50vh, 38vw)`（1080p 约 540px）。
- 右栏约 55%：歌词区 `padding-right: 15%`，上下透明 mask；垂直对齐到封面中心（可用封面与布局容器的几何关系，不必保留完整 AutoLyricLayout）。
- 字体：`-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", system-ui, sans-serif`。
- 歌词默认效果：模糊、缩放、弹簧开启；字号用 AMLL Medium 预设。
- 无歌词时右栏留空，左栏仍显示封面和曲目信息。

## Bundler

在 `remotion.config.ts` 里，Tailwind override 与 alias 叠加：

- `@pixi/app`、`@pixi/core`、`@pixi/display`、`@pixi/filter-blur`、`@pixi/filter-bulge-pinch`、`@pixi/filter-color-matrix`、`@pixi/sprite` → Pixi stub
- 不强制加 `@/` alias；本仓库 Player 代码用相对路径导入

入口引入 `@applemusic-like-lyrics/core/style.css`。Radix Themes 本次不引入（没有用到它的控件）。

## 错误处理

| 情况 | 行为 |
| --- | --- |
| 无法读取音频时长 | `calculateMetadata` 抛错，Studio 显示失败 |
| 未传封面且无内嵌图 | 深色占位封面，背景仍可运行（无专辑图时 Mesh 用空 album） |
| 未传歌词或解析失败 | `lyricLines = []`，右栏空白，预览继续 |
| 封面图加载失败 | `img.onerror` 同样 `continueRender`，不永久卡住 |

## 验证

- `npm run lint`（eslint + tsc）必须通过。
- Studio 目视：
  - 有歌词文件：横屏左右分栏、歌词随进度滚动、背景跟拍
  - 无歌词文件：右栏空、左栏封面和曲目信息仍在
  - 不传封面/歌名/歌手：从音频标签回退
  - 传了封面/歌名：覆盖标签
- 不验证导出 CLI / MKV mux。

## 后续（明确不做）

合成与导出（原音频 ffmpeg mux、MKV、CLI）另开讨论，不在本 spec 实现范围内。
