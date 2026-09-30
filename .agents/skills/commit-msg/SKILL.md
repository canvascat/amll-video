---
name: commit-msg
description: 按本仓库钩子编写带 gitmoji 的简体中文 Conventional Commits。当用户要求 commit、撰写或修改 commit message 时使用。
---

# 提交说明

用户明确要求创建提交时才 `git commit`。不改 git config、不跳过 hook、不 force push 到 main/master、不随意 amend。

格式以仓库钩子 `.vite-hooks/commit-msg` 为准。

## 格式

```
:<gitmoji>: <type>(<scope>): <简体中文描述>
```

- 必须以 gitmoji shortcode 开头，例如 `:sparkles:`，后面有一个空格
- 用 shortcode，不要用 unicode 表情
- `type` 必填、小写
- `scope` 可选、小写；没有单一落点时省略
- 描述必须是简体中文（最高优先级），结尾不加句号
- 标题尽量不超过 72 个字符
- 允许 `type(scope)!:` 表示破坏性变更
- 1–2 句，写清**为什么**，不要堆砌改了哪些文件

钩子允许的 type：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert` `wip`

type 与默认 gitmoji：

| type       | gitmoji                 |
| ---------- | ----------------------- |
| `feat`     | `:sparkles:`            |
| `fix`      | `:bug:`                 |
| `docs`     | `:memo:`                |
| `style`    | `:lipstick:`            |
| `refactor` | `:recycle:`             |
| `perf`     | `:zap:`                 |
| `test`     | `:white_check_mark:`    |
| `build`    | `:package:`             |
| `ci`       | `:construction_worker:` |
| `chore`    | `:wrench:`              |
| `revert`   | `:rewind:`              |
| `wip`      | `:construction:`        |

默认用上表。只有语义明显更贴时才换其他 shortcode（例如删文件用 `:fire:`）。

本仓库常用 scope：

| scope      | 落点                |
| ---------- | ------------------- |
| `main`     | `packages/main`     |
| `renderer` | `packages/renderer` |
| `common`   | `packages/common`   |
| `core`     | `packages/core`     |

根配置、锁文件、或跨多处且无主落点 → 省略 scope。

## 写法

- `feat`：用户可感知的新能力
- `fix`：修 bug
- `docs`：文档、方案
- `refactor`：结构整理，预期行为不变
- `test`：测试
- `chore`：依赖、脚本、仓库杂项
- `build` / `ci`：构建或 CI
- `wip`：进行中，非正式完成时慎用

生成前先看暂存区和最近提交，不要只凭文件名猜测：

```bash
git status --short
git diff --cached
git log --oneline -10
```

暂存区为空就不要编造。默认只根据暂存区写；用户要求包含未暂存时再看 `git diff`。

提交用 HEREDOC，走钩子：

```bash
git commit -m "$(cat <<'EOF'
:sparkles: feat(desktop): 窗口改为加载 app:// 并固定 Vite HMR 主机

EOF
)"
```

不要提交密钥文件（`.env`、`credentials.json` 等）。

若只是写 message、不创建提交：最终只给一行标题，不要分析、列表或引号。

## 示例

```
:sparkles: feat(main): 窗口改为加载 app:// 并固定 Vite HMR 主机
:bug: fix(main): 转发 Vite 时去掉 app:// Origin，避免模块 502
:recycle: refactor(core): 将歌词解析收进 core 并移除 @bbplayer/splash
:memo: docs: 技术方案改为歌单库落在主进程
:wrench: chore: 移除未使用的 GitHub 模板、CI 与本地 MCP 配置
:white_check_mark: test: 断言改用 Vitest，与 vp test 对齐
```