# 备料（`src/prepare`）

给生成视频准备材料：读本地音频标签，缺歌词 / 封面 / 歌名歌手专辑时再联网匹配，写出自包含目录。

本模块只跑在 Node（CLI / 库函数），不进 Remotion 浏览器包，也不改 Studio 和 `src/export/`。

## 命令

```console
nub run prepare -- --audio <音频> --out <目录>
```

等价于 `nub src/prepare/cli.ts --audio <音频> --out <目录>`。

| 参数 | 说明 |
| --- | --- |
| `--audio` | 音频路径（必填） |
| `--out` | 输出目录（必填） |
| `--title` / `--artist` / `--album` | 覆盖标签后再搜索 |
| `-h` | 帮助 |

没有歌词时仍写出 `track.json`，并以非 0 退出，方便手动补 `lyric.*` 后再生成视频。封面缺失不算失败。

## 输出

`--out` 是一份自包含材料包，音频会复制进去：

```text
<audio 原扩展名>     # 如 audio.flac
lyric.ttml|yrc|lrc   # 匹配到歌词时
cover.jpg|png|...    # 有封面时
track.json
```

`track.json` 字段对齐 [`TrackProps`](../helpers/schema.ts)，另带 `match` 说明来源：

```json
{
  "audioFileUrl": "audio.flac",
  "lyricsFileUrl": "lyric.ttml",
  "coverImageUrl": "cover.jpg",
  "audioOffsetInSeconds": 0,
  "songName": "半岛铁盒",
  "artistName": "周杰伦",
  "albumName": "八度空间",
  "durationInSeconds": 319.4,
  "match": {
    "lyricSource": "amll-ttml",
    "lyricFormat": "ttml",
    "coverSource": "embedded"
  }
}
```

`lyricSource`：`embedded` | `amll-ttml` | `netease` | `qqmusic` | `kugou` | `lrclib`  
`coverSource`：`embedded` | `netease` | `qqmusic` | `kugou` | `itunes`

## 本地优先

用 `music-metadata` 读文件，不把网络结果覆盖已有标签。

| 字段 | 规则 |
| --- | --- |
| 歌名 / 歌手 / 专辑 | 标签或 CLI 覆盖有则锁定；否则用最佳候选或 iTunes 补。无歌名时用文件名搜索 |
| 封面 | 内嵌图有则写出，不再下载 |
| 时长 | 永远用音频文件 |
| 歌词 | 标签里已有带时间戳的词（USLT/SYLT 或 LRC 文本）则用它；无时间戳的纯文本不用 |

三项身份、封面、歌词都齐全时不发起网络请求。

## 联网匹配

缺什么补什么。歌词源并发搜索，总超时约 20s，单源失败不影响其它源。只取歌词、封面 URL、元数据，不下载音轨、不登录。

搜索词：`歌名 + 歌手`。候选用 SPlayer 同款 `pickBestCandidate`（见 `match.ts`）：

- 硬条件：曲名全等或足够长的双向包含；双方都有时长则差距不超过 20s；有歌手时必须命中至少一个歌手
- 打分：曲名全等 +10 / 子串 +4；歌手全等 +5 / 包含 +2；专辑全等 +2；时长 ±5s +3

各源先在自己的结果里挑 1 条，再跨源比质量：**TTML > YRC/QRC > 带时间戳 LRC**，同等格式再比分数。写出前用 [`parseLyricText`](../helpers/lyrics.ts) 校验播放器能解析，署名/作曲行不算可用歌词。

| 源 | 做什么 | 备注 |
| --- | --- | --- |
| 网易云 | 搜索 + lyric（优先 yrc，否则 lrc+翻译） | 命中后再试 AMLL TTML |
| QQ 音乐 | 搜索 + 明文 lrc | 命中后再试 AMLL TTML；不解密 QRC |
| 酷狗 | 搜索 + 明文 lrc | 不解密 KRC |
| LRCLIB | `/api/get`（先带专辑再去掉）→ `/api/search` | 只要 synced LRC |
| AMLL TTML | `amlldb.bikonoo.com/ncm-lyrics\|qq-lyrics/{id}.ttml` | 有平台 ID 才拉 |
| iTunes Search | 补封面（600×600）和仍空的身份字段 | 并行查默认店 + hk + jp；罗马音歌手名放宽匹配 |

## 库函数

CLI 只是薄封装。之后把备料从命令行提出来时：

```ts
import { lookupTrack, writeMaterials } from "../prepare";

const result = await lookupTrack({
  audioPath,
  title, // 可选，覆盖标签
  artist,
  album,
});
const { jsonPath, hasLyrics } = await writeMaterials({
  audioPath,
  outDir,
  result,
});
```

`lookupTrack` 返回内存中的歌信、歌词文本、封面字节；`writeMaterials` 负责落盘。

## 文件

| 文件 | 职责 |
| --- | --- |
| `cli.ts` | 参数解析与退出码 |
| `lookup.ts` | 本地 + 多源编排、合并 |
| `write-materials.ts` | 写出材料包 |
| `tags.ts` | 读标签 / 内嵌封面 / 带时间戳歌词 |
| `match.ts` | 归一化与 `pickBestCandidate` |
| `lyric-quality.ts` | 格式优先级、翻译合并、解析校验 |
| `http.ts` | 超时、UA、JSON/JSONP |
| `providers/*` | 各源搜索与取词 |
| `index.ts` | 对外导出 |

## 非目标

- 不改 export / `calculateMetadata` / Studio
- 不拉播放地址、Cookie、登录
- 不做 KRC / 加密 QRC 解密
- 不做持久缓存（只有进程内超时与失败隔离）
