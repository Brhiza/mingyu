# 天机 REGISTRY

## 要去哪里
输入生日 → 八字命盘 → AI 直接解读的算命网站。先跑通、小范围发链接，再决定是否扩展术数或变现（变现需先评估 AGPL 限制）。

## 现在在哪里（2026-09-15）
- 已公开 fork 为 `zinan92/tianji`（上游 Brhiza/mingyu v0.4.0，AGPL-3.0-only）。
- #1 v1 开发中：品牌改为天机、只露八字、首页直达八字、侧栏源码链接、内置 AI 默认开启。
- Cloudflare Pages 项目 `tianji` 已建，域名 https://tianji-1gz.pages.dev

## 下一步
- Park：注册 DeepSeek 独立账号，限额充值，在 Cloudflare Pages → tianji → Settings → Variables 填 `AI_API_KEY`（加密），然后重新部署。
- 填好 Key 后复验 #1 验收第 3 条（30 秒内出现解读），并实测一次整体解读实际调用模型几次，据此回调限流阈值。

## 部署
```bash
VITE_VISIBLE_FEATURES=bazi VITE_AI_AUTO_READING=true VITE_ENABLE_DONATION_BOX=false pnpm build
wrangler pages deploy dist --project-name tianji --branch main
```
运行时变量（Cloudflare 后台 Production）：`AI_BUILTIN_ENABLED=true`、`AI_DEFAULT_ENABLED=true`、`AI_BASE_URL=https://api.deepseek.com/v1`、`AI_MODEL=deepseek-chat`、`AI_PROVIDER_NAME=DeepSeek`、`AI_RATE_LIMIT_MAX_REQUESTS=30`、`AI_RATE_LIMIT_WINDOW_SECONDS=600`、`AI_API_KEY`（Park 填）。
