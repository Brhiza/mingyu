# 模型评测

命语内置 2022—2026 年全球算命师大赛评测资料，共 5 届、40 个命例、200 道四选一题。比赛资料位于 [`benchmarks/fortune-contest`](../benchmarks/fortune-contest)。

评测支持按年份和题目类别筛选。试题与选项保持固定顺序，同一筛选条件始终使用唯一试卷。结果按 100 分制输出，并同时给出准确率和逐题明细。

## 交互式运行

```bash
pnpm contest:evaluate
```

脚本会依次询问接口 URL、API Key 和模型名称，默认读取最新的 2026 年 40 题。每个命例只要求模型按题目顺序输出 A、B、C、D 答案字母，减少长理由造成的截断和解析错误。

通过 `--year 2025` 指定单年，使用 `--years 2022,2026` 组合年份，或用 `--years all` 评测完整 200 题；`--categories 婚姻,事业` 可进一步按类别筛选。

## 直接传参

```bash
pnpm contest:evaluate -- --format chat --url https://api.openai.com/v1 --key your-api-key --model gpt-4.1-mini
```

批量并发评测：

```bash
pnpm contest:evaluate -- --format chat --url https://openrouter.ai/api/v1 --key your-api-key --concurrency 3 --models "GPT-5.4=openai/gpt-5.4,Claude Sonnet 4.6=anthropic/claude-sonnet-4.6"
```

`--concurrency` 控制同时评测的模型数量，批量模式默认为 3；`--caseConcurrency` 控制同一模型内命例的并发数量，默认为 1。批量模式会合并更新被忽略的 `benchmarks/fortune-contest/results/` 本地结果。

使用 OpenRouter 测 reasoning 模型时，可加 `--reasoningEffort none --excludeReasoning --maxTokens 256`，让模型尽量只返回最终答案。若某个命例没有解析满 5 个答案，脚本会把该模型标为失败，不会把 `?????` 当作 0 分答案计入排名。

## 接口格式

| 格式        | 说明                               | URL 示例                                           |
| ----------- | ---------------------------------- | -------------------------------------------------- |
| `chat`      | OpenAI Chat Completions 或兼容接口 | `https://api.openai.com/v1`                        |
| `responses` | OpenAI Responses                   | `https://api.openai.com/v1`                        |
| `claude`    | Claude Messages                    | `https://api.anthropic.com/v1`                     |
| `gemini`    | Gemini generateContent             | `https://generativelanguage.googleapis.com/v1beta` |

不传 `--format` 时会自动识别。评测报告保存在被 Git 忽略的本地结果目录，不会包含在提交中。
