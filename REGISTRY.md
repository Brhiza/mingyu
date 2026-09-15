# 天机 REGISTRY

## 要去哪里
输入生日 → 八字命盘 → AI 直接解读的算命网站。先跑通、小范围发链接，再决定是否扩展术数或变现（变现需先评估 AGPL 限制）。

## 现在在哪里（2026-09-15）
- 已公开 fork 为 `zinan92/tianji`（上游 Brhiza/mingyu v0.4.0，AGPL-3.0-only）。
- v1 已上线：https://tianji-1gz.pages.dev ，内置 DeepSeek 解读已开启（Park 已填 `AI_API_KEY`）。
- 线上实测（1995-08-18 巳时 男，桌面端，清空存储后打开）：约 4.4 秒出第一段，约 35 秒写完，全文约 4000 字，无报错。
- 一次整体解读 = 串行 2 次模型调用（规划约 1 秒 + 流式作答约 19 秒），限流定为 12 次 / 10 分钟（每个 IP 约 6 次解读）。

## 下一步
- Park：小范围发链接试用，关注 DeepSeek 余额消耗。
- 待定：是否绑定自定义域名；手机端是否改为出盘后自动展开解读（目前要点"AI"按钮）。

## 部署
```bash
VITE_VISIBLE_FEATURES=bazi VITE_AI_AUTO_READING=true VITE_ENABLE_DONATION_BOX=false pnpm build
wrangler pages deploy dist --project-name tianji --branch main
```
运行时变量（Cloudflare 后台 Production）：`AI_BUILTIN_ENABLED=true`、`AI_DEFAULT_ENABLED=true`、`AI_BASE_URL=https://api.deepseek.com/v1`、`AI_MODEL=deepseek-chat`、`AI_PROVIDER_NAME=DeepSeek`、`AI_RATE_LIMIT_MAX_REQUESTS=12`、`AI_RATE_LIMIT_WINDOW_SECONDS=600`、`AI_API_KEY`（Park 填）。
