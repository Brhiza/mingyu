# 2025年第十六届全球算命师比赛

本文件夹只保留最终可用于评测的资料：

- `00_原题目.md`：2025年第十六届全球算命师比赛 8 个命例原题。
- `01_命例一_提示词.md` 至 `08_命例八_提示词.md`：基于项目排盘、比赛岁运信息与紫微宫位语义校验框架生成的 8 份增强版提示词。
- `正确答案.md`：用户提供的 40 题正确答案，已按命例和逐题两种格式整理。

提示词内已加入题目涉及年份、年份范围、年龄段对应的大运、流年、年龄、十神和小运信息，并统一补入“八字主线 + 紫微宫位语义校验”结构，方便不同大模型直接作答并做排名评测。

## 快速评测脚本

运行：

```bash
npm run contest:evaluate
```

脚本会依次询问接口 URL、API Key、模型名称，然后自动读取本文件夹内 8 份提示词和 `正确答案.md`。每个命例只要求模型输出 5 个 A/B/C/D 答案字母，减少长理由导致的截断和解析错误，最终输出 100 分制总分与准确率。

也可以直接传参：

```bash
npm run contest:evaluate -- --url https://api.openai.com/v1 --key your-api-key --model gpt-4.1-mini
```

批量并发评测：

```bash
npm run contest:evaluate -- --format chat --url https://openrouter.ai/api/v1 --key your-api-key --concurrency 3 --models "GPT-5.4=openai/gpt-5.4,Claude Sonnet 4.6=anthropic/claude-sonnet-4.6"
```

`--concurrency` 控制同时评测的模型数量，默认批量为 3；`--caseConcurrency` 可控制同一模型内 8 个命例的并发数量，默认 1。批量模式会合并更新 `模型评测排名报告.md` 和 `评测结果/本次排名原始结果.json`。

使用 OpenRouter 测 reasoning 模型时，可以加 `--reasoningEffort none --excludeReasoning --maxTokens 256`，让模型尽量只返回最终答案。若某个命例没有解析满 5 个答案，脚本会把该模型标为失败，不会把 `?????` 当作 0 分答案计入排名。

脚本兼容四种接口格式，默认会自动识别；需要指定时可加 `--format`：

```bash
# OpenAI Chat Completions 或兼容接口
npm run contest:evaluate -- --format chat --url https://api.openai.com/v1 --key your-api-key --model gpt-4.1-mini

# OpenAI Responses
npm run contest:evaluate -- --format responses --url https://api.openai.com/v1 --key your-api-key --model gpt-5.1

# Claude Messages
npm run contest:evaluate -- --format claude --url https://api.anthropic.com/v1 --key your-api-key --model claude-sonnet-4-5

# Gemini generateContent
npm run contest:evaluate -- --format gemini --url https://generativelanguage.googleapis.com/v1beta --key your-api-key --model gemini-2.5-pro
```

评测报告会保存到本文件夹下的 `评测结果/` 目录。
