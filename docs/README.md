# 命语文档

根目录的 [README](../README.md) 只保留项目简介、常用能力和快速入口。完整资料按用途分开放在这里。

## 普通用户

- [在线体验](https://aov.cc)：直接使用排盘、合盘、占卜和择日。
- [新手教程](https://aov.cc/tutorial)：了解四种模式和提示词使用方法。
- [完整能力与算法边界](capabilities.md)：查看支持的术式、主要资料和适用范围。

## 开发者

- [公开 API](api.md)：接口、参数和请求示例。
- [MCP Server](../mcp/README.md)：让支持 MCP 的 AI 客户端调用命语。
- [Agent Skill](../public/skills/aov-mingyu-api/SKILL.md)：通用算命与周易玄学工作流 Skill，让 AI 代理准确选择术数并调用排盘。
- [`mingyu-core` 算法包](../packages/core/README.md)：在应用中复用核心算法。
- [开发与部署](development-and-deployment.md)：本地开发、项目结构、Cloudflare Pages、Docker 和内置 AI 配置。
- [模型评测](model-evaluation.md)：算命师大赛数据集和评测脚本。
- [算法依据索引](2026-07-10-算法依据索引.md)：传统依据、校勘状态和回归证据。

## 在线发现入口

- [API 能力清单](https://aov.cc/api/v1/manifest)
- [OpenAPI](https://aov.cc/api/v1/openapi.json)
- [llms.txt](https://aov.cc/llms.txt)
- [Agent Skill](https://aov.cc/skills/aov-mingyu-api/SKILL.md)
- [npm 核心包](https://www.npmjs.com/package/mingyu-core)

## Agent Skill 安装

推荐使用一条命令安装：

```bash
npx skills add Brhiza/mingyu --skill aov-mingyu-api -g -y
```

如果当前环境无法使用 `npx skills`，也可以手动保存在线 Skill。

Linux 或 macOS：

```bash
mkdir -p ~/.codex/skills/aov-mingyu-api
curl -L https://aov.cc/skills/aov-mingyu-api/SKILL.md \
  -o ~/.codex/skills/aov-mingyu-api/SKILL.md
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills\aov-mingyu-api"
Invoke-WebRequest "https://aov.cc/skills/aov-mingyu-api/SKILL.md" `
  -OutFile "$env:USERPROFILE\.codex\skills\aov-mingyu-api\SKILL.md"
```
