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

## 2026-09-15 · 挂到 park-ai-intel.com 子域名

- Park 选子域名 `tianji.park-ai-intel.com`，不用路径 `park-ai-intel.com/tianji`：个人站在 Vercel，走路径要改天机的路由、资源和接口前缀，还要让 Vercel 反向代理，而代理后所有用户会被限流算成同一个 IP。
- DNS 在 Park 的 Cloudflare 账号（zone `park-ai-intel.com`）；Pages 自定义域名已通过 API 添加，但 wrangler 授权没有 DNS 写权限，CNAME `tianji → tianji-1gz.pages.dev`（Proxied）已于 2026-09-15 由 Claude 在 Park 登录后的浏览器里添加，Pages 域名状态 Active、SSL 已启用，线上 AI 解读验证通过。

## 2026-09-15 · v2：开放全部术数、SSE 透传、全套成本实测

- Park 要求开放全部术数，并实测单人全套成本。线上构建不再设 `VITE_VISIBLE_FEATURES`；自动解读覆盖全部命盘类型。
- 发现 Cloudflare Pages 免费档 10ms CPU 会掐断长解读（`exceededCpu`，星盘、思考模式均复现）。Park 在外无法开付费档，改为 `AI_STREAM_PASSTHROUGH=true`：服务端直接透传上游 SSE，由前端解析内容与 usage。之后 23 种方法实测全部完整生成。
- 模型保持 `deepseek-chat`（上游返回 `deepseek-flash`，非思考）。**不要改成 `deepseek-flash`**：它默认开思考模式，思考 token 按输出计费，而且会大幅拉长流。
- 实测单人全部 23 种 ≈ ¥0.87（高峰），见 docs/tianji-cost-benchmark.md。限流定为 30 次 / 10 分钟。

## Gotchas

- **透传模式下服务端看不到用量**：token 用量只在浏览器里（`globalThis.__TIANJI_AI_USAGE__`）；服务端 `ai_usage` 日志只在非透传模式有效。
- **限流不是全局上限**：`src/lib/ai/rate-limit.ts` 把计数存在单个进程的内存 Map 里。Cloudflare Pages Functions 多实例各算各的，`AI_RATE_LIMIT_MAX_REQUESTS` 只能挡住单实例内的连续刷，挡不住分布式刷。真正的花费上限是 DeepSeek 账户余额。
- **内置 AI 需要两个开关**：只设 `AI_API_KEY` 不会显示内置 AI，必须 `AI_BUILTIN_ENABLED=true`；`AI_DEFAULT_ENABLED=true` 才会默认进入解读。这些是运行时变量，由 `functions/_middleware.ts` 注入 `/mingyu-runtime-config.js`，不需要重新构建。
- **`VITE_VISIBLE_FEATURES`、`VITE_AI_AUTO_READING` 是构建变量**：本地 `pnpm build` 时就要传入，改了必须重新构建、重新部署。
- **品牌替换的边界**：Android 更新地址（`src/lib/android-app-update.ts` 等）和 `public/skills/` 仍指向上游，因为 Android 与 Skill 不在 v1 范围内；Web 可见文字已全部换掉。

## 2026-09-15 首页默认进八字
- **决定**：新增构建变量 `VITE_DEFAULT_ENTRY_FEATURE`，设为 bazi 时 `/` 直接进八字输入页，原首页挪到 `/home`，侧边栏「首页」跟着指向 /home。
- **理由**：Park 认为先要生日比先让人提问更可信、门槛更低。
- **Gotcha**：构建必须带这个变量，否则首页回到提问框。
