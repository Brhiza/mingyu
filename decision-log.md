# 天机 decision-log

## 2026-09-15 · 走 A 线：fork 命语，而不是自建

- **决定**：Park 选择 A 线，公开 fork `Brhiza/mingyu`（aov.cc 的源码）为 `zinan92/tianji`，改名“天机”，只开放八字，网页直接显示 AI 解读。
- **理由**：一天内上线；排盘引擎与解读提示词成熟，自带测试。
- **代价**：AGPL-3.0-only。对外提供服务就必须公开全部修改后的源码；以后要闭源收费，只能换 B 线（tyme4ts + 自建解读层）重写。
- **做法**：只用构建开关隐藏其他术数，不删代码，保持上游测试全绿、可以合并上游更新。
- Spec：https://claude.ai/artifact/7CWHd5GBLzuE2sq1RgvnEp · Issue：#1

## 2026-09-15 · 部署与模型

- Cloudflare Pages（项目 `tianji`，域名 `tianji-1gz.pages.dev`），DeepSeek `deepseek-chat`。
- `AI_API_KEY` 由 Park 本人在 Cloudflare 后台填写；DeepSeek 使用独立账号、限额充值。
- 先只发链接，不公开宣传。

## 2026-09-15 · 出盘后自动解读 + 限流放宽到 30 次

- 上游的八字结果页要用户输入问题才会调用 AI。Park 要求"网页直接显示解读"，所以新增构建变量 `VITE_AI_AUTO_READING=true`：默认 AI 模式下，命盘从未解读过就自动发送"请先做整体解读。"；已有历史只恢复历史，不重复调用。手机端的解读在"AI"按钮后面，点开即自动开始。
- 上游解读是多轮工作流（规划 → 最多 4 次补充资料 → 作答 → 核验），一次整体解读会调用模型多次。按 spec 定的 6 次 / 10 分钟，用户看一次就可能被限流，所以放宽到 30 次；兜底花费仍靠 DeepSeek 余额。真实调用次数要等填入 Key 后实测，再回调阈值。

## 2026-09-15 · 真实 DeepSeek 实测后，限流定为 12 次

- 实测一次整体解读 = 串行 2 次调用（规划 → 流式作答），不是 spec 担心的多轮放大，所以把限流从 30 收紧到上游默认的 12 次 / 10 分钟。
- 浏览器网络面板显示两个请求"同一毫秒"发出，是记录工具的时间戳问题；以 `performance.getEntriesByType('resource')` 的 startTime 为准（2106ms 发出耗时 920ms → 3028ms 发出耗时 19s）。

## Gotchas

- **限流不是全局上限**：`src/lib/ai/rate-limit.ts` 把计数存在单个进程的内存 Map 里。Cloudflare Pages Functions 多实例各算各的，`AI_RATE_LIMIT_MAX_REQUESTS` 只能挡住单实例内的连续刷，挡不住分布式刷。真正的花费上限是 DeepSeek 账户余额。
- **内置 AI 需要两个开关**：只设 `AI_API_KEY` 不会显示内置 AI，必须 `AI_BUILTIN_ENABLED=true`；`AI_DEFAULT_ENABLED=true` 才会默认进入解读。这些是运行时变量，由 `functions/_middleware.ts` 注入 `/mingyu-runtime-config.js`，不需要重新构建。
- **`VITE_VISIBLE_FEATURES`、`VITE_AI_AUTO_READING` 是构建变量**：本地 `pnpm build` 时就要传入，改了必须重新构建、重新部署。
- **品牌替换的边界**：Android 更新地址（`src/lib/android-app-update.ts` 等）和 `public/skills/` 仍指向上游，因为 Android 与 Skill 不在 v1 范围内；Web 可见文字已全部换掉。
