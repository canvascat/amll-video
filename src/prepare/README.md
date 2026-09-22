# 备料（`src/prepare`）

给生成视频准备材料：读本地音频标签，缺歌词 / 封面 / 歌名歌手专辑时再联网匹配，默认写在音频同目录。

整轨 CD（`.cue` + 一张 flac）不切片：所有曲目指向同一音频文件，用 `audioOffsetInSeconds` / `audioEndInSeconds` 标注开始和结束。

本模块只跑在 Node（CLI / 库函数），不进 Remotion 浏览器包。

## 命令

```console
nub run prepare -- --audio <音频或CUE>
```

等价于 `nub src/prepare/cli.ts --audio <音频>`。

| 参数 | 说明 |
| --- | --- |
| `--audio` | 音频或 `.cue` 路径（必填） |
| `--out` | 输出目录（可选，默认与源文件相同） |
| `--title` / `--artist` / `--album` | 覆盖标签后再搜索 |
| `-h` | 帮助 |

没有歌词时仍写出 json，并以非 0 退出，方便手动补歌词后再生成视频。封面缺失不算失败。

预览 / 导出只需要这份 json：

```console
nub run export -- <配置.json> --preview
nub run export -- <配置.json>
```


## 输出

配置、歌词、封面默认写在音频同目录，文件名与音频同名。`--out` 指向别处时才会把音频拷过去。

### 单曲

例如 `半岛铁盒.flac`：

```text
半岛铁盒.flac
半岛铁盒.ttml|yrc|lrc   # 匹配到歌词时
半岛铁盒.jpg|png|...    # 有封面时；已有同名图则直接引用
半岛铁盒.json
```

json 字段对齐 [`TrackProps`](../helpers/schema.ts)，另带 `match` 说明来源：

```json
{
  "audioFileUrl": "半岛铁盒.flac",
  "lyricsFileUrl": "半岛铁盒.ttml",
  "coverImageUrl": "半岛铁盒.jpg",
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

### 整轨 CUE

```console
nub run prepare -- --audio "王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.cue"
```

不切片、不复制整轨。json 与音频同名；每首歌的歌词文件用歌名。曲目列表里每首歌指向同一音频，并标开始 / 结束时间（CUE `INDEX 01`，单位秒；最后一首的结束为整轨时长）：

```text
王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.flac
王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.jpg
王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.json
不得了.yrc
我愿意.ttml
…
```

```json
{
  "albumName": "菲卖品 王菲精选",
  "artistName": "王菲",
  "audioFileUrl": "王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.flac",
  "coverImageUrl": "王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.jpg",
  "tracks": [
    {
      "audioFileUrl": "王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.flac",
      "lyricsFileUrl": "不得了.yrc",
      "coverImageUrl": "王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.jpg",
      "audioOffsetInSeconds": 0,
      "audioEndInSeconds": 228.4267,
      "durationInSeconds": 228.4267,
      "songName": "不得了",
      "artistName": "王菲",
      "albumName": "菲卖品 王菲精选"
    },
    {
      "audioFileUrl": "王菲.-.1997-03-01.-.菲卖品 王菲精选.-.新艺宝.flac",
      "lyricsFileUrl": "我愿意.ttml",
      "audioOffsetInSeconds": 228.4267,
      "audioEndInSeconds": 502.52,
      "durationInSeconds": 502.52,
      "songName": "我愿意"
    }
  ]
}
```

播放长度是 `audioEndInSeconds - audioOffsetInSeconds`（没有 end 时退回 `durationInSeconds - offset`，与原先单曲行为一致）。CUE 里的 TITLE / PERFORMER 当作锁定的歌名歌手；专辑名来自 CUE 专辑 TITLE，没有则从 `艺人.-.日期.-.专辑.-.厂牌` 这种文件名解析。同名 `.jpg` 封面优先于音频内嵌图。

## 本地优先

用 `music-metadata` 读文件，不把网络结果覆盖已有标签。

| 字段 | 规则 |
| --- | --- |
| 歌名 / 歌手 / 专辑 | 标签或 CLI 覆盖有则锁定；否则用最佳候选或 iTunes 补。无歌名时用文件名搜索 |
| 封面 | 同名图已有则引用；否则写出内嵌图，不再下载 |
| 时长 | 单曲用音频文件时长；CUE 曲目用 INDEX 起止，匹配时用该曲长度 |
| 歌词 | 标签里已有 **TTML** 才跳过搜索；内嵌 LRC/YRC 仍会联网，时长接近时 **TTML > YRC/QRC > LRC**。无时间戳的纯文本不用 |

身份、封面齐全且歌词已是 TTML 时，不再为这三项发网络请求。

## 联网匹配

缺什么补什么。歌词源并发搜索，总超时约 20s，单源失败不影响其它源。只取歌词、封面 URL、元数据，不下载音轨、不登录。

搜索词：`歌名 + 歌手`。候选用 `pickBestCandidate` / `pickBestLyric`（见 `match.ts`）：

- 硬条件：曲名全等或足够长的双向包含；双方都有时长则差距不超过 20s；有歌手时必须命中至少一个歌手
- 打分：曲名全等 +10 / 子串 +4；歌手全等 +5 / 包含 +2；专辑全等 +2；时长 ±5s +3
- 跨源：先比时长（差 2s 以上视为不同版本），再比格式 **TTML > YRC/QRC > 带时间戳 LRC**，最后比分数。时长差过大的候选直接丢掉，不会因为 YRC 压过更贴合的 LRC。

时长仍可能和这张碟对不齐（精选/不同前奏）。选出版本后会用 200–4000 Hz 人声频段的能量做成「唱没唱」包络，和歌词起唱点滑动对齐；只有明显好过零偏移、且置信足够才写入 `lyricOffsetMs`。结构完全不同的版本不会硬套偏移。

| 源 | 做什么 | 备注 |
| --- | --- | --- |
| 网易云 | 搜索 + lyric（优先 yrc，否则 lrc+翻译） | 命中后再试 AMLL TTML |
| QQ 音乐 | 搜索 + 明文 lrc | 命中后再试 AMLL TTML；不解密 QRC |
| 酷狗 | 搜索；逐字候选解密 KRC 并写成 YRC，否则用明文 lrc | KRC 头 4 字节后异或再 inflate |
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
  result,
});
```

`lookupTrack` 返回内存中的歌信、歌词文本、封面字节；`writeMaterials` 负责落盘。

## 文件

| 文件 | 职责 |
| --- | --- |
| `cli.ts` | 参数解析与退出码 |
| `album.ts` | 整轨 CUE 备料编排 |
| `cue.ts` | 解析 CUE、定位音频和封面 |
| `lookup.ts` | 本地 + 多源编排、合并 |
| `write-materials.ts` | 写出与音频同名的 json / 歌词 / 封面 |
| `tags.ts` | 读标签 / 内嵌封面 / 带时间戳歌词 |
| `match.ts` | 归一化、时长优先选版本 |
| `lyric-offset.ts` | 歌词常量偏移估算 |
| `audio-envelope.ts` | 用 ffmpeg 读人声频段能量包络 |
| `krc.ts` | 解密酷狗 KRC，并转成 YRC |
| `lyric-quality.ts` | 格式优先级、翻译合并、解析校验 |
| `http.ts` | 超时、UA、JSON/JSONP |
| `providers/*` | 各源搜索与取词 |
| `index.ts` | 对外导出 |

## 非目标

- 不把整轨切成每首歌一个音频文件
- 不拉播放地址、Cookie、登录
- 不解密 QQ 音乐的加密 QRC
- 不做持久缓存（只有进程内超时与失败隔离）
