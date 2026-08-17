<p align="center">
    <a href="https://linux.do" alt="LINUX DO">
        <img
            src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?logo=data:image/svg%2bxml;base64,DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik00Ni44Mi0uMDU1aDYuMjVxMjMuOTY5IDIuMDYyIDM4IDIxLjQyNmM1LjI1OCA3LjY3NiA4LjIxNSAxNi4xNTYgOC44NzUgMjUuNDV2Ni4yNXEtMi4wNjQgMjMuOTY4LTIxLjQzIDM4LTExLjUxMiA3Ljg4NS0yNS40NDUgOC44NzRoLTYuMjVxLTIzLjk3LTIuMDY0LTM4LjAwNC0yMS40M1EuOTcxIDY3LjA1Ni0uMDU0IDUzLjE4di02LjQ3M0MxLjM2MiAzMC43ODEgOC41MDMgMTguMTQ4IDIxLjM3IDguODE3IDI5LjA0NyAzLjU2MiAzNy41MjcuNjA0IDQ2LjgyMS0uMDU2IiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZWNlY2VjO2ZpbGwtb3BhY2l0eToxIi8+PHBhdGggZD0iTTQ3LjI2NiAyLjk1N3EyMi41My0uNjUgMzcuNzc3IDE1LjczOGE0OS43IDQ5LjcgMCAwIDEgNi44NjcgMTAuMTU3cS00MS45NjQuMjIyLTgzLjkzIDAgOS43NS0xOC42MTYgMzAuMDI0LTI0LjM4N2E2MSA2MSAwIDAgMSA5LjI2Mi0xLjUwOCIgc3R5bGU9InN0cm9rZTpub25lO2ZpbGwtcnVsZTpldmVub2RkO2ZpbGw6IzE5MTkxOTtmaWxsLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Ik03Ljk4IDcwLjkyNmMyNy45NzctLjAzNSA1NS45NTQgMCA4My45My4xMTNRODMuNDI2IDg3LjQ3MyA2Ni4xMyA5NC4wODZxLTE4LjgxIDYuNTQ0LTM2LjgzMi0xLjg5OC0xNC4yMDMtNy4wOS0yMS4zMTctMjEuMjYyIiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5kZDtmaWxsOiNmOWFmMDA7ZmlsbC1vcGFjaXR5OjEiLz48L3N2Zz4=" /></a>
    <a href="https://www.npmjs.com/package/mingyu-core" alt="mingyu-core on npm">
        <img src="https://img.shields.io/npm/v/mingyu-core?label=mingyu-core&color=CB3837" /></a>
    <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml" alt="CI">
        <img src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
</p>

# 命语

命语是一套面向用户和开发者的命理、占卜与择日工具。它把排盘、起卦、抽牌、结构化结果和 AI 提示词连接成清晰流程，让用户得到可核对的盘面资料，也让开发者能够直接复用同一套核心算法。

网页端适合快速排盘、调整并复制提示词；公开 API、MCP Server、skill 和独立 npm 包 `mingyu-core` 适合接入应用、工作流与智能体。默认输出只保留盘面和有效解读资料，来源、规则与计算过程按需提供，避免把冗长证据链混入用户界面和 AI 任务书。

项目网页按“排盘、合盘、占卜、择日”组织，覆盖八字、紫微斗数、星盘、七政四余、住宅风水、六爻、梅花易数、奇门遁甲、大六壬、太乙神数、皇极经世、五运六气、塔罗牌、灵签与黄历择日等能力。

<p align="center">
    <a href="https://aov.cc">在线体验</a> ·
    <a href="https://aov.cc/api/v1/manifest">公开 API</a> ·
    <a href="https://aov.cc/api/v1/openapi.json">OpenAPI</a> ·
    <a href="https://aov.cc/llms.txt">llms.txt</a> ·
    <a href="https://www.npmjs.com/package/mingyu-core">mingyu-core</a> ·
    <a href="https://aov.cc/skills/aov-mingyu-api/SKILL.md">公开 skill</a>
</p>

`aov.cc` 是本项目的官方线上实例；fork 后部署到自己的 Cloudflare Pages 或其他域名时，公开 API 会按实际访问域名生成元数据和 OpenAPI 地址。

功德箱：[https://lk.sydf.cc/](https://lk.sydf.cc/)

## 基于命语构建

### 时月东方

时月东方是一款基于命语核心能力构建的东方术数工具，使用 Vue 3 与 Vite 实现，也可以作为 `mingyu-core` 在独立产品中接入和消费的实际参考。

- 在线体验：[https://sydf.cc](https://sydf.cc)
- 项目源码：[https://github.com/Brhiza/sydf](https://github.com/Brhiza/sydf)

## 快速导航

- [基于命语构建](#基于命语构建)
- [核心能力](#核心能力)
- [集成方式](#集成方式)
- [核心算法包](#核心算法包-mingyu-core)
- [运行与部署方式](#运行与部署方式)
- [模型评测](#模型评测)

## 核心能力

以下条目描述核心计算可提供的完整资料。网页、提示词、公开 API 和 MCP 默认采用精简输出；只有审计、研究或二次计算时才显式请求完整证据。

<details>
<summary>面向产品的统一消费层</summary>

- 排盘结果按 `input`、`calendar`、`chart`、`timing`、`summary`、`evidence` 和 `warnings` 提供统一视图，底层各术式仍保留自己的专业结构。
- 公开 API 与排盘类 MCP 默认使用 `detailMode: "compact"`，保留核心盘面并省略提示词、完整证据链和重复计算过程；显式传 `detailMode: "full"` 才返回完整结构。
- 提示词接口默认只返回可直接交给 AI 的自包含任务书，不再要求调用方用正则表达式清理工程字段和审计资料。
- 八字岁运按精确交运时刻裁剪可选范围，时间边界提供结构化资料；标准十二时辰模式不会额外补造“晚子时”。
- 紫微入口已纳入 Vite 与 Webpack 浏览器契约测试，应用无需绕过核心包直接调用 `iztro`。

</details>

<details>
<summary>命理排盘</summary>

- 八字排盘：四柱、十神、藏干、纳音、神煞、大运、流年、旺衰、格局、用神与调候分析；神煞默认采用问真整理口径并返回常用范围，也可显式切换传统兼容口径或请求全部项目；岁运按精确交运边界筛选，提示词只保留所选层级的有效触发资料；双盘可计算日主、日支、四柱交叉关系、双向十神、喜忌覆盖与结构化证据。
- 紫微斗数：以 `iztro` 原生能力输出十二宫、星曜、亮度、四化、三方四正及本命、大限、流年、流月、流日、流时，并随结果披露实际安星、闰月、分年、运限月份、小限年龄和晚子时口径；三合派、飞星派、四化派选项只改变解读侧重点，不改底层安星。固定版本传统目录现登记 87 项，其中 55 条具备原文与可复算条件，32 项因原文含糊或依赖运限只登记边界、不伪造命中；原 84 条未校勘项目规则继续停用，目录外格局不作判断。
- 星盘排盘：西方占星完整排盘，包含太阳、月亮、上升星座与宫位、十大行星、逆行提示与主要相位分析；本命、行运和双盘相位输出角度偏差、容许度位置与紧密等级，不把归一化值包装成事件概率、匹配率或吉凶百分比；太阳返照采用粗定位加二分细化，并返回黄经残差、搜索过程和精度边界。
- 奇门遁甲：输出值符、值使、日干、时干对应的用神宫候选，逐宫保留门星神干、空亡、马星、格局、宫间作用、反证及方位与时间触发条件，不用数字评分替代判断。
- 住宅风水：产品统一入口，分层计算八宅人宅适配与玄空飞星宅运结构，再输出合参要点与建议；不生成综合吉凶总分。只需普通出生年月日+性别，或只填大门向屋内度数/山向，即可使用；可填建造/起运年。八宅负责命卦宅卦与四吉四凶，玄空负责下卦的运盘/山盘/向盘与到山到向，并在边界敏感时保留候选山向。底层仍可单独调用八宅与玄空。
- 七政四余：输出七政四余十一星、命身十二宫、宿度庙旺、吊照、月相与出生时刻光照。七政、罗睺、计都和月孛采用现代天文位置，二十八宿用 28 颗真实距星在目标日期的黄经划界；紫炁保留《七政算内篇》古法均速模型，并明确区分位置精度层级。
- 时间型术式不机械换算固定天数、周数或百分比，只输出盘内相对节奏、触发条件与适用边界。
- 合盘与关系分析：支持双方盘面结构化提示词，适配婚恋、合作、友情、亲子、父母、兄弟等场景。

</details>

<details>
<summary>公共地基工具</summary>

- 干支：十天干、十二地支、六十甲子、六旬旬首、纳音、藏干、阴阳五行、合冲刑害破、三合三会统一真相源。
- 五行：统一生克、月令旺相休囚死和天干地支结构出现统计，可选计入藏干。
- 八字、六爻、奇门、六壬等旧模块统一复用公共地基，旧导入路径仅保留兼容转发。
- 核心包提供 `mingyu-core/foundation`，线上提供 `/foundation/capabilities`、`/foundation/ganzhi`、`/foundation/wuxing`、`/foundation/direction`、`/foundation/shensha`；通用神煞入口会严格核验完整四柱，逐项返回空亡、驿马、桃花的起法、目标地支、命中柱位、来源声明和解释限制，能力目录本身也返回稳定事实、来源、证据汇总与解释限制。
- 真太阳时统一提升到 `mingyu-core/calendar`，线上提供 `/calendar/true-solar-time` 便捷换算接口。
- `mingyu-core/calendar` 还提供统一天文时间尺度证据，可把当地钟表时间换算为 UTC、`JD(UTC)`、近似 `JD(UT)` 与 `JD(TT)`，同时返回 ΔT 模型、估算等级和精度限制；支持用 IANA 时区解析历史夏令时、回拨歧义和跳时缺口，太阳返照已接入该证据。
- 历法层可由日月地心黄经差输出月相角、最小距角、照明近似、盈亏、八相、近似月龄及前后朔弦望时刻；奇门和黄历候选日已接入，并明确不把月相自动解释为吉凶或观测级精度。
- 历法层还可按日期、经纬度和历史时区输出太阳高度、真北方位角、视太阳正午、日出日落及民用/航海/天文曙暮光；西占已接入，并保留极昼极夜、地平遮挡和大气折射限制。
- 二十四节气边界继续采用 `tyme4ts` 历表，同时按节气每隔 15° 太阳视黄经的定义，用 Meeus/NOAA 低阶公式独立求根核验；输出采用时刻、模型求根时刻、黄经残差、两者差值和精度限制。八字节令月与奇门节令提示词已接入该证据，临界时间不因显示到秒而宣称观测级精度。
- 十二时辰目录、月份天数和中国 1986–1991 历史夏令时也统一由公共日历层提供。

</details>

<details>
<summary>占卜术数</summary>

- 六爻：京房八宫法排盘，包含纳甲、六亲、六神、世应、动变、空亡、日破、月破、化进神、化退神、六亲持世等信息；回头冲、动变五行关系与化空可同时保留；输出用神候选、原神忌神仇神作用链，以及逐爻月日、空破墓、动变支持与反证，不生成吉凶总分。
- 梅花易数：支持时间起卦、数字起卦、随机起卦，包含体用生克、四时旺衰、64卦完整爻辞，以及主卦、互卦、变卦逐阶段体用推进与支持、限制证据。
- 奇门遁甲：时家奇门默认转盘法，可通过 API 参数请求飞盘法；定局默认拆补法，也可请求置闰法。包含天地人神四盘、值符值使、格局标签（含入墓、击刑、伏吟反吟、门迫等）、节令背景、复合格局与宫位洞察。
- 大六壬：天盘、四课、三传、月将、贵人、旬空、课体与问题范围选择；输出四课取传依据、初传发用、三传推进及逐传旺衰空亡支持与限制。
- 太乙神数：当前开放完成积年与阳遁七十二局立成校勘的年计，输出太乙、文昌、始击、计神、主客定算、将参与十六神盘，并提供计算链、主证、辅证、反证和方法限制组成的结构化证据。月、日、时计须补齐节气时刻、章月、月法、日法、气应与小余等古籍历法链后再开放；Kintaiyi 的简式与分计不作为古籍真值。
- 皇极经世：支持通行公元值年卦排盘，返回会内统卦、运卦、六十年统卦、十年卦、值年卦及互卦、错卦、综卦；研究场景仍可使用指定纪元的元会运世周期换算。
- 五运六气：按公历年输出中运太过不及、司天在泉、五步主客运、六步主客气、五音太少、气运相临和符会结构，并保留交司日期的古籍口径边界。
- 自定起卦时间：六爻、梅花易数、奇门遁甲、大六壬可在网页端选择当前时间或自定北京时间；公开 API、MCP Server 和 skill 使用 `customDate` 传入带时区的 ISO 8601 时间。
- 塔罗牌：78 张塔罗牌，支持单牌、时间流、爱情、事业、选择等牌阵；逐牌保留牌位、正逆位、关键词、元素、牌阶、牌序和解释限制，不输出能量分数或成功率。
- 三山国王灵签：92 签灵签，源自广东潮汕三山国王祖庙；保留签号、签题与签诗原文，直接围绕问题解读。

</details>

<details>
<summary>择吉择日</summary>

- 黄历择日：支持搬家入宅、订婚结婚、开业启动、签约合作、出行赴任、就医手术、考试学习、安葬修坟、修造动土等事项；按 `tyme4ts` 原始宜忌、参与人刑冲破害、时辰与现实限制分成可用、条件和慎用候选，不设置或包装吉凶总分。

</details>

<details>
<summary>模型评测</summary>

- 内置 2022—2026 年全球算命师大赛评测资料，共 5 届、40 个命例、200 道四选一题。
- 支持按年份和题目类别筛选；试题与选项保持固定顺序，同一筛选条件始终使用唯一试卷。
- 提供快速评测脚本，支持 OpenAI Chat Completions、OpenAI Responses、Claude Messages、Gemini generateContent 四种接口格式。
- 评测结果按 100 分制输出，并同时给出准确率和逐题明细。

</details>

## 集成方式

命语提供公开 API、MCP Server、公开 skill 和 `mingyu-core` npm 包四种集成方式。提示词接口默认只返回 `prompt`；排盘接口默认返回精简结构，需要审计资料时再请求完整结果。六爻、梅花易数、奇门遁甲和大六壬还支持通过 `customDate` 指定起卦时间。README 只保留快速入口，完整参数和调用示例请查看对应文档。

<details>
<summary>公开 API</summary>

无需安装，直接调用线上接口：

```text
https://aov.cc/api/v1
```

详细文档：[docs/api.md](docs/api.md)

OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)

AI 发现文件：[https://aov.cc/llms.txt](https://aov.cc/llms.txt)

</details>

<details>
<summary>MCP Server</summary>

命语内置 MCP Server，让支持 MCP 的 AI 客户端直接调用本地排盘引擎，不需要用户手动复制 JSON 或提示词。

快速安装：

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
pnpm install
```

启动命令：

```bash
pnpm mcp
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
  year: 1990,
  month: 1,
  day: 1,
  timeIndex: 5,
  gender: 'male',
});

// 占卜算法
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';

// 历法工具
import { getDivinationTime, getVoidBranches } from 'mingyu-core/calendar';

// 将专业结果拆成盘面视图与审计资料
import { createConsumptionView } from 'mingyu-core/consumption';

// 类型
import type { BaziChartResult, QimenData, LiurenData } from 'mingyu-core/types';
```

包覆盖能力：八字（含调候用神、格局、神煞、精确岁运边界、中国夏令时校正及增强分析）、紫微斗数、西洋占星、七政四余、六爻、梅花易数、奇门遁甲、大六壬、太乙神数、皇极经世、五运六气、择日、塔罗、三山国王灵签，以及住宅风水（八宅与玄空合参）、八宅、玄空飞星和干支、五行、方位、神煞等公共模块。

真太阳时及其所需的中国省市区、经度数据随 `mingyu-core` 一同提供，可直接从 `mingyu-core/location` 查询，无需安装额外地点包。

**⚠️ 免责：** 该包仅提供算法实现，所有结果仅供参考与学习娱乐，不构成任何命理预测或专业建议。

算法包详细文档：[packages/core/README.md](packages/core/README.md)

</details>

## 技术栈

| 类别       | 技术                                            |
| ---------- | ----------------------------------------------- |
| 前端       | React 19、TypeScript 5.9                        |
| 构建       | Vite 7                                          |
| 路由       | React Router 7                                  |
| 包管理     | pnpm workspace（应用层 + `mingyu-core` 算法包） |
| 部署       | Cloudflare Pages、Pages Functions、Docker       |
| 历法与星盘 | `tyme4ts`、`iztro`、`celestine`                 |
| 数据校验   | `zod`                                           |
| 测试       | Node.js 原生测试运行器                          |
| AI 集成    | MCP Server、OpenAPI、skill 文档                 |

## 项目结构

<details>
<summary>展开目录结构</summary>

```text
mingyu/
├── functions/                 # Cloudflare Pages Functions 公开 API 和公开发现元数据
├── mcp/                       # MCP Server
├── packages/
│   └── core/                  # mingyu-core 独立算法包（发布到 npm）
│       ├── src/bazi/          # 八字引擎与增强分析
│       ├── src/divination/    # 占卜算法（六爻/奇门/六壬/梅花等）
│       ├── src/calendar/      # 历法工具
│       └── src/types/         # 共享类型
├── public/
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
│   ├── utils/                 # 页面层工具，核心算法统一来自 mingyu-core
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

| 配置项                 | 值           |
| ---------------------- | ------------ |
| Build command          | `pnpm build` |
| Build output directory | `dist`       |
| Root directory         | 仓库根目录   |
| Node.js version        | 建议 `22`    |

如果 Cloudflare 没有自动启用 pnpm，可在环境变量中添加：

```text
PNPM_VERSION=11
```

公开 API 路由来自 `functions/api/v1/[[path]].ts`，部署后可访问：

```text
https://你的域名/api/v1/manifest
https://你的域名/api/v1/openapi.json
https://你的域名/.well-known/aov-mingyu-api.json
```

如果绑定的域名是 `aov.cc`，上线后检查：

```text
https://aov.cc/api/v1/manifest
https://aov.cc/api/v1/openapi.json
https://aov.cc/.well-known/aov-mingyu-api.json
https://aov.cc/mingyu-runtime-config.js
```

Cloudflare Pages 的环境变量在 Dashboard → Settings → Environment variables 中配置。密钥不要写进代码仓库。

启用内置 AI 时，Production 环境至少配置：

```text
AI_BUILTIN_ENABLED=true
AI_DEFAULT_ENABLED=false
AI_API_KEY=你的模型密钥
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
```

如果同时启用了 Preview 部署，也需要在 Preview 环境配置同一组变量。保存环境变量后重新部署一次，`/mingyu-runtime-config.js` 会从 Pages Functions 读取当前环境变量，并返回 `Cache-Control: no-store`，避免旧配置被缓存。

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
  -e AI_API_KEY=your-api-key \
  -e AI_BASE_URL=https://api.deepseek.com/v1 \
  -e AI_MODEL=deepseek-chat \
  -e AI_PROVIDER_NAME=DeepSeek \
  -e AI_BUILTIN_ENABLED=true \
  -e AI_DEFAULT_ENABLED=false \
  mingyu
```

也可以使用 Docker Compose：

```bash
docker compose up --build
```

Compose 会读取本地 `.env`。可以在本地 `.env` 中填写下面内容，但不要提交这个文件：

```text
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
AI_BUILTIN_ENABLED=true
AI_DEFAULT_ENABLED=false
VITE_ENABLE_DONATION_BOX=false
```

默认端口是 `3000`。如需修改容器内端口，可设置 `PORT`；如需修改宿主机端口，调整 compose 或 `docker run` 的 `-p` 左侧端口。

`VITE_ENABLE_DONATION_BOX=true` 时，首页上方会显示功德箱按钮；不设置或设为 `false` 时默认不显示。这个变量只影响前端构建，Cloudflare Pages 需要配置在构建环境变量中，Docker 部署需要在构建时传入。

</details>

<details>
<summary>服务端 AI（内置 AI）配置</summary>

命语支持两种 AI 使用方式：

- 用户在首页顶部齿轮中自行填写 OpenAI 兼容接口，API Key 只保存在用户自己的浏览器。
- 站点部署者在服务端配置 AI，前端会显示一个可选服务商。这个能力也可以理解为“内置 AI”。

服务端 AI 环境变量：

| 变量                 | 说明                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `AI_API_KEY`         | 服务端调用模型的密钥                                                    |
| `AI_BASE_URL`        | OpenAI 兼容接口地址，例如 `https://api.deepseek.com/v1`                 |
| `AI_MODEL`           | 默认模型名称                                                            |
| `AI_PROVIDER_NAME`   | 前端显示的服务商名称，可自行命名                                        |
| `AI_BUILTIN_ENABLED` | 设为 `true` 时，前端显示并允许使用服务端 AI                             |
| `AI_DEFAULT_ENABLED` | 设为 `true` 时，页面默认进入 AI 解读；设为 `false` 时默认仍是提示词模式 |

只配置 `AI_API_KEY` 不会自动显示服务端 AI；必须同时设置 `AI_BUILTIN_ENABLED=true`。如果想提供公益内置 AI，但默认仍让用户复制提示词，可设置 `AI_BUILTIN_ENABLED=true`、`AI_DEFAULT_ENABLED=false`。用户仍可通过齿轮自行填写自己的接口。

AI 代理会对上游临时错误自动重试 2 次。只重试网络异常、408、429 和 5xx；鉴权失败、模型名错误等确定性问题不会重试。常见错误码：

| 错误码                       | 含义                                       |
| ---------------------------- | ------------------------------------------ |
| `AI_UPSTREAM_UNSTABLE`       | 上游 AI 服务返回 5xx，通常是服务临时不稳定 |
| `AI_UPSTREAM_RATE_LIMIT`     | 上游限流或额度受限                         |
| `AI_UPSTREAM_TIMEOUT`        | 上游响应超时                               |
| `AI_UPSTREAM_AUTH_ERROR`     | API Key 无效、过期或额度账号异常           |
| `AI_UPSTREAM_CONFIG_ERROR`   | 接口地址或模型名称可能不被上游支持         |
| `AI_UPSTREAM_NETWORK_ERROR`  | 服务器无法连接上游 AI 服务                 |
| `AI_UPSTREAM_EMPTY_RESPONSE` | 上游返回成功状态但没有可读取内容           |
| `AI_UPSTREAM_STREAM_ERROR`   | 上游流式响应中途断开                       |

`.dev.vars.example` 提供了本地和 Cloudflare 可参考的变量模板。公开站点启用服务端 AI 会产生调用成本，也可能受上游模型稳定性影响，建议先确认额度、限流和可用性。

</details>

## 模型评测

比赛资料位于：[benchmarks/fortune-contest](benchmarks/fortune-contest)

<details>
<summary>展开评测命令和参数</summary>

交互式运行：

```bash
pnpm contest:evaluate
```

脚本会依次询问接口 URL、API Key 和模型名称，默认读取最新的 2026 年 40 题。每个命例只要求模型按题目顺序输出 A/B/C/D 答案字母，减少长理由导致的截断和解析错误；调用完成后输出 100 分制总分、准确率、分命例得分和逐题明细。

通过 `--year 2025` 指定单年，使用 `--years 2022,2026` 组合年份，或用 `--years all` 评测完整 200 题；`--categories 婚姻,事业` 可进一步按类别筛选。

也可以直接传参：

```bash
pnpm contest:evaluate -- --format chat --url https://api.openai.com/v1 --key your-api-key --model gpt-4.1-mini
```

批量并发评测：

```bash
pnpm contest:evaluate -- --format chat --url https://openrouter.ai/api/v1 --key your-api-key --concurrency 3 --models "GPT-5.4=openai/gpt-5.4,Claude Sonnet 4.6=anthropic/claude-sonnet-4.6"
```

`--concurrency` 控制同时评测的模型数量，默认批量为 3；`--caseConcurrency` 控制同一模型内命例并发数量，默认 1。批量模式会合并更新被忽略的 `benchmarks/fortune-contest/results/` 本地评测结果。

使用 OpenRouter 测 reasoning 模型时，可以加 `--reasoningEffort none --excludeReasoning --maxTokens 256`，让模型尽量只返回最终答案。若某个命例没有解析满 5 个答案，脚本会把该模型标为失败，不会把 `?????` 当作 0 分答案计入排名。

支持的 `--format`：

| 格式        | 说明                               | URL 示例                                           |
| ----------- | ---------------------------------- | -------------------------------------------------- |
| `chat`      | OpenAI Chat Completions 或兼容接口 | `https://api.openai.com/v1`                        |
| `responses` | OpenAI Responses                   | `https://api.openai.com/v1`                        |
| `claude`    | Claude Messages                    | `https://api.anthropic.com/v1`                     |
| `gemini`    | Gemini generateContent             | `https://generativelanguage.googleapis.com/v1beta` |

不传 `--format` 时会自动识别；评测报告会保存到被 Git 忽略的本地结果目录。

</details>

## 适合贡献的方向

- 补充更多命理、占卜与提示词测试样例。
- 优化公开 API 的字段文档和返回示例。
- 增加更多 AI 客户端的 MCP 配置示例。
- 扩展 skill，使更多代理能自动发现并调用命语。
- 增强移动端体验、可访问性和教程说明。

## 关于三山国王

三山国王是粤东潮汕与客家地区极具影响力的民间信仰，祖庙位于**广东揭西县河婆街道**。这座有着千年历史的庙宇供奉着巾山、明山、独山三位山神，自隋代至今香火不断，影响远播东南亚。

项目作者来自揭西，自幼祭拜三山国王。这套**92 签灵签体系**以祖庙传承的签诗为本：

- 每签保留签号、签题与签诗原文
- 不同庙本可能存在签序、题名和字句差异，解读以本次签文为准

我们希望这套签文能成为一本"人生操作手册"——迷茫时翻开，总有一支签、一句诗，能让人豁然开朗。

## 免责声明

命语提供的是命理、占卜与 AI 提示词辅助工具，结果仅供参考和娱乐学习使用，不应替代医疗、法律、投资、心理咨询等专业建议。

## 项目关键词

算命、AI 算命、在线算命、免费算命、智能算命、八字算命、八字排盘、紫微斗数、紫微排盘、星盘、占星排盘、六爻起卦、梅花易数、奇门遁甲、大六壬、塔罗占卜、塔罗抽牌、抽签、灵签、三山国王灵签、择日、黄道吉日、命理工具、占卜工具、运势分析、婚姻算命、事业运势、财运分析。
