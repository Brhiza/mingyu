# 天机 REGISTRY

## 要去哪里
输入生日 → 八字命盘 → AI 直接解读的算命网站。先跑通、小范围发链接，再决定是否扩展术数或变现（变现需先评估 AGPL 限制）。

## 现在在哪里（2026-09-15）
- v2 已上线：https://tianji.park-ai-intel.com （Cloudflare Pages 自定义域名 Active、SSL 已启用；备用 https://tianji-1gz.pages.dev）。开放命语全部 23 种术数，命盘类出盘自动解读。
- 内置 DeepSeek V4.1 Flash，`AI_STREAM_PASSTHROUGH=true`：服务端透传 SSE，解决 Cloudflare 免费档长解读 `exceededCpu` 被掐断的问题。
- 成本实测：单人全部 23 种各解读一次 ≈ ¥0.87（高峰）/ ¥0.44（非高峰）；单次 ¥0.01–0.09。详见 docs/tianji-cost-benchmark.md。
- 限流 30 次 / 10 分钟 / IP（约 15 次解读）。

## 下一步
- 可选：开通 Workers 付费档（$5/月）作为长期稳定性兜底；透传模式下目前 23 种方法实测均未超限。
- 待定：手机端是否出盘直接展开解读（目前点"AI"按钮后自动开始）。

## 部署
```bash
VITE_AI_AUTO_READING=true VITE_ENABLE_DONATION_BOX=false VITE_DEFAULT_ENTRY_FEATURE=bazi pnpm build
wrangler pages deploy dist --project-name tianji --branch main
```
运行时变量（Cloudflare 后台 Production）：`AI_BUILTIN_ENABLED=true`、`AI_DEFAULT_ENABLED=true`、`AI_BASE_URL=https://api.deepseek.com/v1`、`AI_MODEL=deepseek-chat`、`AI_PROVIDER_NAME=DeepSeek`、`AI_RATE_LIMIT_MAX_REQUESTS=30`、`AI_STREAM_PASSTHROUGH=true`、`AI_RATE_LIMIT_WINDOW_SECONDS=600`、`AI_API_KEY`（Park 填）。
