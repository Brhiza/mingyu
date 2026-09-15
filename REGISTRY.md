# 天机 REGISTRY

## 要去哪里
输入生日 → 八字命盘 → AI 直接解读的算命网站。先跑通、小范围发链接，再决定是否扩展术数或变现（变现需先评估 AGPL 限制）。

## 现在在哪里（2026-09-15）
- 已公开 fork 为 `zinan92/tianji`（上游 Brhiza/mingyu v0.4.0，AGPL-3.0-only）。
- #1 v1 已合并（#2）并上线：https://tianji-1gz.pages.dev （Cloudflare Pages 项目 `tianji`，commit cd201b61）。
- 线上已验证：首页直达八字、侧栏只有八字、品牌为天机、源码链接、无功德箱。
- 运行时 AI 变量已配置，只差 `AI_API_KEY`：缺 Key 时服务端自动关闭内置 AI，页面退回"复制提示词"模式，不会报错。

## 下一步
- **Park**：注册 DeepSeek 独立账号并限额充值 → Cloudflare Pages → tianji → Settings → Variables and Secrets → Production 添加加密变量 `AI_API_KEY` → 通知 Claude 重新部署（新变量只对之后的部署生效）。
- Claude：填好 Key 后重新部署，实测 30 秒内出首段、一次整体解读实际调用几次模型，据此回调 `AI_RATE_LIMIT_MAX_REQUESTS`。

## 部署
```bash
VITE_VISIBLE_FEATURES=bazi VITE_AI_AUTO_READING=true VITE_ENABLE_DONATION_BOX=false pnpm build
wrangler pages deploy dist --project-name tianji --branch main
```
运行时变量（Cloudflare 后台 Production）：`AI_BUILTIN_ENABLED=true`、`AI_DEFAULT_ENABLED=true`、`AI_BASE_URL=https://api.deepseek.com/v1`、`AI_MODEL=deepseek-chat`、`AI_PROVIDER_NAME=DeepSeek`、`AI_RATE_LIMIT_MAX_REQUESTS=30`、`AI_RATE_LIMIT_WINDOW_SECONDS=600`、`AI_API_KEY`（Park 填）。
