<p align="center">
    <a href="https://linux.do" alt="LINUX DO">
        <img
            src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?logo=data:image/svg%2bxml;base64,DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik00Ni44Mi0uMDU1aDYuMjVxMjMuOTY5IDIuMDYyIDM4IDIxLjQyNmM1LjI1OCA3LjY3NiA4LjIxNSAxNi4xNTYgOC44NzUgMjUuNDV2Ni4yNXEtMi4wNjQgMjMuOTY4LTIxLjQzIDM4LTExLjUxMiA3Ljg4NS0yNS40NDUgOC44NzRoLTYuMjVxLTIzLjk3LTIuMDY0LTM4LjAwNC0yMS40M1EuOTcxIDY3LjA1Ni0uMDU0IDUzLjE4di02LjQ3M0MxLjM2MiAzMC43ODEgOC41MDMgMTguMTQ4IDIxLjM3IDguODE3IDI5LjA0NyAzLjU2MiAzNy41MjcuNjA0IDQ2LjgyMS0uMDU2IiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZWNlY2VjO2ZpbGwtb3BhY2l0eToxIi8+PHBhdGggZD0iTTQ3LjI2NiAyLjk1N3EyMi41My0uNjUgMzcuNzc3IDE1LjczOGE0OS43IDQ5LjcgMCAwIDEgNi44NjcgMTAuMTU3cS00MS45NjQuMjIyLTgzLjkzIDAgOS43NS0xOC42MTYgMzAuMDI0LTI0LjM4N2E2MSA2MSAwIDAgMSA5LjI2Mi0xLjUwOCIgc3R5bGU9InN0cm9rZTpub25lO2ZpbGwtcnVsZTpldmVub2RkO2ZpbGw6IzE5MTkxOTtmaWxsLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Ik03Ljk4IDcwLjkyNmMyNy45NzctLjAzNSA1NS45NTQgMCA4My45My4xMTNRODMuNDI2IDg3LjQ3MyA2Ni4xMyA5NC4wODZxLTE4LjgxIDYuNTQ0LTM2LjgzMi0xLjg5OC0xNC4yMDMtNy4wOS0yMS4zMTctMjEuMjYyIiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5kZDtmaWxsOiNmOWFmMDA7ZmlsbC1vcGFjaXR5OjEiLz48L3N2Zz4=" /></a>
</p>

# 命语

命语是一个算命、占卜、择日的提示词生成项目，目标是把排盘、起卦、抽牌、结构化数据和 AI 提示词连接成一条清晰可复用的流程。让所有人都可以快速的生成专业可靠的排盘信息，而不是依靠模糊的关键词和无脑堆叠专业词汇，让AI占卜相对更加可靠，享受术数的神秘智慧。

你可以在网页端快速完成排盘或占卜，时间类占卜支持使用当前时间或自定北京时间，并复制提示词给你常用的所有 AI 工具继续解读；对于移动端用户还可以使用分享功能快速跳转；也可以通过公开 API、MCP Server 或 skill，把命语的排盘与提示词能力接入自己的应用、工作流和智能体系统。

项目目前覆盖八字排盘、紫微斗数、星盘、六爻、梅花易数、奇门遁甲、大六壬、小六壬、塔罗牌、雷诺曼、三山国王灵签、择日等场景，并尽量将结果拆分为机器可读的数据、用户可理解的摘要和适合大模型继续分析的提示词。

线上体验：[https://aov.cc](https://aov.cc)

公开 API：[https://aov.cc/api/v1/manifest](https://aov.cc/api/v1/manifest)

OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)

公开 skill：[https://aov.cc/skills/aov-mingyu-api/SKILL.md](https://aov.cc/skills/aov-mingyu-api/SKILL.md)

## 快速导航

- [核心能力](#核心能力)
- [集成方式](#集成方式)
- [核心算法包](#核心算法包-mingyu-core)
- [运行与部署方式](#运行与部署方式)
- [模型评测](#模型评测)

## 核心能力

<details>
<summary>命理排盘</summary>

- 八字排盘：四柱、十神、藏干、纳音、神煞、大运、流年、旺衰、格局、用神与调候分析，支持传统派、盲派、新派流派指引。
- 紫微斗数：基于 `iztro` 的完整命盘，支持本命、大限、流年、流月、流日、流时等数据范围，支持三合派、飞星派、四化派流派指引。
- 星盘排盘：西方占星完整排盘，包含太阳、月亮、上升星座与宫位、十大行星、逆行提示与主要相位分析。
- 合盘与关系分析：支持双方盘面结构化提示词，适配婚恋、合作、友情、亲子、父母、兄弟等场景。
- 时辰反推：在用户不确定出生时辰时，生成保守的三柱分析与互动式反推提示词。

</details>

<details>
<summary>占卜术数</summary>

- 六爻：京房八宫法排盘，包含纳甲、六亲、六神、世应、动变、空亡、日破、月破、化进神、化退神、六亲持世等信息。
- 梅花易数：支持时间起卦、数字起卦、随机起卦、外应起卦，包含体用生克、四时旺衰与64卦完整爻辞。
- 奇门遁甲：时家奇门默认转盘法，可通过 API 参数请求飞盘法，包含天地人神四盘、值符值使、格局标签（含入墓、击刑、伏吟反吟、门迫等）与宫位洞察。
- 大六壬：天盘、四课、三传、月将、贵人、旬空、课体与断课模板。
- 小六壬：大安、留连、速喜、赤口、小吉、空亡六宫起课，支持时间起课、数字起课与随机起课，输出起因、过程、结果三宫提示词。
- 自定起卦时间：六爻、梅花易数、奇门遁甲、大六壬、小六壬可在网页端选择当前时间或自定北京时间；公开 API、MCP Server 和 skill 使用 `customDate` 传入带时区的 ISO 8601 时间。
- 塔罗牌：78 张塔罗牌，支持单牌、时间流、爱情、事业、选择等牌阵。
- 雷诺曼：36 张雷诺曼牌，支持单牌、时间流、爱情、事业、选择等牌阵。
- 三山国王灵签：92 签灵签，源自广东潮汕三山国王祖庙，包含签题、签诗、典故故事与分类解签，体系完备。

</details>

<details>
<summary>择吉择日</summary>

- 黄历择日：支持搬家入宅、订婚结婚、开业启动、签约合作、出行赴任、就医手术、考试学习、安葬修坟、修造动土等事项，按参与人生辰与事项类型推荐最佳日期并给出评分。

</details>

<details>
<summary>模型评测</summary>

- 内置 `2025年第十六届全球算命师比赛` 评测资料，包含原题、8 份提示词和 40 题正确答案。
- 提示词已补入题目涉及年份、年龄段对应的大运、流年、年龄、十神和小运信息，方便直接评测不同模型的命理选择题表现。
- 提供快速评测脚本，支持 OpenAI Chat Completions、OpenAI Responses、Claude Messages、Gemini generateContent 四种接口格式。
- 评测结果按 100 分制输出，并同时给出准确率和逐题明细。

</details>

## 集成方式

命语提供三种集成方式：公开 API、MCP Server、公开 skill。API 和 MCP 都支持一站式返回 `result` 与 `prompt`；六爻、梅花易数、奇门遁甲、大六壬、小六壬还支持通过 `customDate` 指定起卦或排盘时间。README 只保留快速入口和安装方式，接口参数、客户端配置和调用示例请跳转到对应文档。

<details>
<summary>公开 API</summary>

无需安装，直接调用线上接口：

```text
https://aov.cc/api/v1
```

详细文档：[docs/api.md](docs/api.md)

OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)

</details>

<details>
<summary>MCP Server</summary>

命语内置 MCP Server，让支持 MCP 的 AI 客户端直接调用本地排盘引擎，不需要用户手动复制 JSON 或提示词。

快速安装：

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
npm install
```

启动命令：

```bash
npm run mcp
```

详细文档：[mcp/README.md](mcp/README.md)

</details>

<details>
<summary>公开 skill</summary>

这个 skill 面向 AI 代理和开发者，说明如何通过 `aov.cc` 公开 API 完成排盘、占卜和提示词生成。

快速安装：

```bash
npx skills add Brhiza/mingyu --skill aov-mingyu-api -g -y
```

快速读取：

```text
让你的 AI 代理读取这个 skill：
https://aov.cc/skills/aov-mingyu-api/SKILL.md
```

如果当前环境无法使用 `npx skills`，也可以手动创建目录后保存：

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

详细文档：[public/skills/aov-mingyu-api/SKILL.md](public/skills/aov-mingyu-api/SKILL.md)

元数据发现：[https://aov.cc/.well-known/aov-mingyu-api.json](https://aov.cc/.well-known/aov-mingyu-api.json)

</details>

## 核心算法包 `mingyu-core`

命语的所有命理排盘与占卜算法已抽取为独立 npm 包 [`mingyu-core`](https://www.npmjs.com/package/mingyu-core)，本仓库以 pnpm workspace 形式同时维护应用与算法包。

<details>
<summary>安装和使用示例</summary>

```text
mingyu/
├── packages/
│   └── core/                  # mingyu-core 算法包（独立发布到 npm）
└── src/                       # 应用层（React + Vite + MCP）
```

安装：

```bash
npm install mingyu-core
```

使用示例：

```ts
// 八字排盘
import { baziCalculator } from 'mingyu-core/bazi';

const result = baziCalculator.calculateBazi({
  year: 1990, month: 1, day: 1, timeIndex: 5, gender: 'male',
});

// 占卜算法
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';

// 历法工具
import { getDivinationTime, getVoidBranches } from 'mingyu-core/calendar';

// 类型
import type { BaziChartResult, QimenData, LiurenData } from 'mingyu-core/types';
```

包覆盖能力：八字（含调候用神、格局、神煞、大运及透干根气、十神结构、合化评估、命卦、小运等增强分析）、奇门遁甲、六爻、大六壬、梅花易数、小六壬、紫微斗数、西洋占星、择日、雷诺曼、塔罗、三山国王灵签。

**⚠️ 免责：** 该包仅提供算法实现，所有结果仅供参考与学习娱乐，不构成任何命理预测或专业建议。

算法包详细文档：[packages/core/README.md](packages/core/README.md)

</details>

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript 5.9 |
| 构建 | Vite 7 |
| 路由 | React Router 7 |
| 包管理 | pnpm workspace（应用层 + `mingyu-core` 算法包） |
| 部署 | Cloudflare Pages、Pages Functions、Docker |
| 历法与星盘 | `tyme4ts`、`iztro`、`celestine` |
| 数据校验 | `zod` |
| 测试 | Node.js 原生测试运行器 |
| AI 集成 | MCP Server、OpenAPI、skill 文档 |

## 项目结构

<details>
<summary>展开目录结构</summary>

```text
mingyu/
├── functions/                 # Cloudflare Pages Functions 公开 API
├── mcp/                       # MCP Server
├── packages/
│   └── core/                  # mingyu-core 独立算法包（发布到 npm）
│       ├── src/bazi/          # 八字引擎与增强分析
│       ├── src/divination/    # 占卜算法（六爻/奇门/六壬/梅花等）
│       ├── src/calendar/      # 历法工具
│       └── src/types/         # 共享类型
├── public/
│   ├── .well-known/           # 公开发现元数据
│   └── skills/                # 公开 skill 文档
├── server/                    # Docker 自部署服务入口
├── src/
│   ├── components/            # 页面组件与通用 UI
│   ├── lib/
│   │   ├── divination/        # 占卜引擎与提示词拼装
│   │   ├── full-chart-engine/ # 八字、紫微完整排盘入口
│   │   ├── iztro/             # 紫微运行时适配
│   │   ├── public-api/        # 公开 API handler
│   │   └── ziwei-prompts/     # 紫微提示词模块
│   ├── pages/                 # 输入页、结果页、历史页、教程页
│   ├── types/                 # 领域类型定义
│   ├── utils/                 # 八字、塔罗、历法、灵签等工具
│   └── workers/               # 紫微相关 Web Worker
└── tests/                     # 单元测试与集成测试
```

</details>

## 运行与部署方式

本项目支持本地开发、Cloudflare Pages 和 Docker 三种常用运行方式。AI 相关变量也放在这里，部署时可以一起配置。

<details>
<summary>本地开发</summary>

本项目使用 pnpm workspace 管理应用层与 `mingyu-core` 算法包，需先安装 [pnpm](https://pnpm.io)：

```bash
npm install -g pnpm
```

安装依赖：

```bash
pnpm install
```

启动网页开发服务：

```bash
pnpm dev
```

启动 MCP Server：

```bash
pnpm mcp
```

构建生产版本：

```bash
pnpm build
```

运行测试：

```bash
pnpm test
```

单独构建 `mingyu-core` 算法包：

```bash
pnpm --filter mingyu-core build
```

类型检查 MCP 与共享源码：

```bash
npx tsc --project mcp/tsconfig.json --noEmit
```

</details>

<details>
<summary>Cloudflare Pages 部署</summary>

推荐部署到 Cloudflare Pages，静态页面由 Pages 托管，`/api/v1/*` 由 Pages Functions 处理。

Pages 构建设置：

| 配置项 | 值 |
| --- | --- |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | 仓库根目录 |
| Node.js version | 建议 `22` |

如果 Cloudflare 没有自动启用 pnpm，可在环境变量中添加：

```text
PNPM_VERSION=10
```

公开 API 路由来自 `functions/api/v1/[[path]].ts`，部署后可访问：

```text
https://你的域名/api/v1/manifest
https://你的域名/api/v1/openapi.json
```

Cloudflare Pages 的环境变量在 Dashboard → Settings → Environment variables 中配置。密钥不要写进代码仓库。

</details>

<details>
<summary>Docker 部署</summary>

Docker 镜像会构建前端页面，并在容器内启动一个 Node 服务，同时提供：

- 网页访问
- `/api/v1/*` 公开 API
- `/api/v1/ai/analyze` 流式 AI 解读
- `/api/v1/ai/models` 模型列表获取

构建镜像：

```bash
docker build -t mingyu .
```

启动基础服务：

```bash
docker run --rm -p 3000:3000 mingyu
```

访问：

```text
http://localhost:3000
```

带服务端 AI 启动：

```bash
docker run --rm -p 3000:3000 \
  -e AI_API_KEY=sk-xxx \
  -e AI_BASE_URL=https://api.deepseek.com/v1 \
  -e AI_MODEL=deepseek-chat \
  -e AI_PROVIDER_NAME=DeepSeek \
  -e AI_DEFAULT_ENABLED=true \
  mingyu
```

也可以使用 Docker Compose：

```bash
docker compose up --build
```

Compose 会读取本地 `.env`。可以在本地 `.env` 中填写下面内容，但不要提交这个文件：

```text
AI_API_KEY=sk-xxx
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
AI_DEFAULT_ENABLED=true
```

默认端口是 `3000`。如需修改容器内端口，可设置 `PORT`；如需修改宿主机端口，调整 compose 或 `docker run` 的 `-p` 左侧端口。

</details>

<details>
<summary>服务端 AI（内置 AI）配置</summary>

命语支持两种 AI 使用方式：

- 用户在首页顶部齿轮中自行填写 OpenAI 兼容接口，API Key 只保存在用户自己的浏览器。
- 站点部署者在服务端配置 AI，前端会显示一个可选服务商。这个能力也可以理解为“内置 AI”。

服务端 AI 环境变量：

| 变量 | 说明 |
| --- | --- |
| `AI_API_KEY` | 服务端调用模型的密钥 |
| `AI_BASE_URL` | OpenAI 兼容接口地址，例如 `https://api.deepseek.com/v1` |
| `AI_MODEL` | 默认模型名称 |
| `AI_PROVIDER_NAME` | 前端显示的服务商名称，可自行命名 |
| `AI_DEFAULT_ENABLED` | 设为 `true` 时，才默认显示并启用服务端 AI |

只配置 `AI_API_KEY` 不会自动打开服务端 AI；必须同时设置 `AI_DEFAULT_ENABLED=true`。如果不启用，前端不会提示服务端 AI，用户仍可通过齿轮自行填写自己的接口。

`.dev.vars.example` 提供了本地和 Cloudflare 可参考的变量模板。公开站点启用服务端 AI 会产生调用成本，也可能受上游模型稳定性影响，建议先确认额度、限流和可用性。

</details>

## 模型评测

比赛资料位于：[docs/2025第十六届全球算命师比赛](docs/2025第十六届全球算命师比赛)

<details>
<summary>展开评测命令和参数</summary>

交互式运行：

```bash
npm run contest:evaluate
```

脚本会依次询问接口 URL、API Key 和模型名称，自动读取 8 份提示词与 `正确答案.md`。每个命例只要求模型输出 5 个 A/B/C/D 答案字母，减少长理由导致的截断和解析错误；调用完成后输出 100 分制总分、准确率、分命例得分和逐题明细。

也可以直接传参：

```bash
npm run contest:evaluate -- --format chat --url https://api.openai.com/v1 --key sk-xxx --model gpt-4.1-mini
```

批量并发评测：

```bash
npm run contest:evaluate -- --format chat --url https://openrouter.ai/api/v1 --key sk-xxx --concurrency 3 --models "GPT-5.4=openai/gpt-5.4,Claude Sonnet 4.6=anthropic/claude-sonnet-4.6"
```

`--concurrency` 控制同时评测的模型数量，默认批量为 3；`--caseConcurrency` 控制同一模型内命例并发数量，默认 1。批量模式会合并更新比赛目录下的 `模型评测排名报告.md` 和 `评测结果/本次排名原始结果.json`。

使用 OpenRouter 测 reasoning 模型时，可以加 `--reasoningEffort none --excludeReasoning --maxTokens 256`，让模型尽量只返回最终答案。若某个命例没有解析满 5 个答案，脚本会把该模型标为失败，不会把 `?????` 当作 0 分答案计入排名。

支持的 `--format`：

| 格式 | 说明 | URL 示例 |
| --- | --- | --- |
| `chat` | OpenAI Chat Completions 或兼容接口 | `https://api.openai.com/v1` |
| `responses` | OpenAI Responses | `https://api.openai.com/v1` |
| `claude` | Claude Messages | `https://api.anthropic.com/v1` |
| `gemini` | Gemini generateContent | `https://generativelanguage.googleapis.com/v1beta` |

不传 `--format` 时会自动识别；评测报告会保存到比赛资料目录下的 `评测结果/`。

</details>

## 适合贡献的方向

- 补充更多命理、占卜与提示词测试样例。
- 优化公开 API 的字段文档和返回示例。
- 增加更多 AI 客户端的 MCP 配置示例。
- 扩展 skill，使更多代理能自动发现并调用命语。
- 增强移动端体验、可访问性和教程说明。

## 关于三山国王

三山国王是粤东潮汕与客家地区极具影响力的民间信仰，祖庙位于**广东揭西县河婆街道**。这座有着千年历史的庙宇供奉着巾山、明山、独山三位山神，自隋代至今香火不断，影响远播东南亚。

项目作者来自揭西，自幼祭拜三山国王。这套**92 签灵签体系**正是以祖庙传承的签诗为本，结合正史典故与民间传说整理而成：

- 39 支上签、30 支中签、21 支下签、2 支无事签，签序暗合"始于进取，终于守成"的人生智慧
- 每签配有签题、签诗、典故故事与多领域解签
- 第 91、92 签为独有的"无事签"——其他签诗体系几乎没有，体现了三山文化"无事即福"的朴素智慧

我们希望这套签文能成为一本"人生操作手册"——迷茫时翻开，总有一支签、一句诗，能让人豁然开朗。

## 免责声明

命语提供的是命理、占卜与 AI 提示词辅助工具，结果仅供参考和娱乐学习使用，不应替代医疗、法律、投资、心理咨询等专业建议。

## 项目关键词

算命、AI 算命、在线算命、免费算命、智能算命、八字算命、八字排盘、紫微斗数、紫微排盘、星盘、占星排盘、六爻起卦、梅花易数、奇门遁甲、大六壬、小六壬、塔罗占卜、塔罗抽牌、雷诺曼、抽签、灵签、三山国王灵签、择日、黄道吉日、命理工具、占卜工具、运势分析、婚姻算命、事业运势、财运分析。
