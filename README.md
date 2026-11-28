<p align="center">
  <img src="public/pwa-192x192.png" alt="命语 Logo" width="84" height="84" />
</p>

<h1 align="center">命语 V2 · Mingyu V2</h1>

<p align="center">
  <strong>观四时之命，译数术之语</strong>
</p>

<p align="center">
  开源、纯本地可运行、全链路可核验的 <strong>39 项术数排盘引擎</strong>与 <strong>AI 提示词工作台</strong>。<br>
  八字 · 紫微 · 西洋星盘 · 七政四余 · 奇门 · 六壬 · 六爻 · 梅花 · 塔罗 · 择日风水 · 起名典籍
</p>

<p align="center">
  <a href="https://linux.do"><img alt="LINUX DO" src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?style=flat-square" /></a>
  <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"><img alt="MCP" src="https://img.shields.io/badge/MCP-Streamable_HTTP_%26_stdio-0891B2?style=flat-square" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" /></a>
  <a href="https://sydf.cc"><img alt="Online" src="https://img.shields.io/badge/在线工作台-sydf.cc-6D5ACF?style=flat-square" /></a>
</p>

<p align="center">
  <strong>简体中文</strong> ·
  <a href="docs/README.zh-TW.md">繁體中文</a> ·
  <a href="docs/README.en.md">English</a> ·
  <a href="docs/README.ja.md">日本語</a> ·
  <a href="docs/README.ko.md">한국어</a> ·
  <a href="docs/README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="https://sydf.cc"><strong>🌐 在线使用 (sydf.cc)</strong></a> ·
  <a href="https://sydf.cc/api-docs">🔌 API 文档</a> ·
  <a href="https://sydf.cc/api-docs.md">🤖 AI 专用文档 (.md)</a> ·
  <a href="https://sydf.cc/llms.txt">📄 llms.txt</a> ·
  <a href="skills/mingyu/SKILL.md">⚡ Agent Skill</a> ·
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu"><strong>☁️ 一键部署 Cloudflare</strong></a>
</p>

> [!TIP]
> **不要让大模型“心算”你的命盘，也不用折腾复杂的接口配置。**  
> 命语 V2 把 **39 项东方与西洋术数**、独立天文历法引擎、古籍规则证据层，直接打造成**开箱即用的高质量预设 AI 任务提示词**。所有核心排盘均在浏览器本地或无状态服务中确定性计算——普通用户打开网页排完盘，**一键复制提示词或直唤豆包 / DeepSeek 等外部 AI**，就能得到有古籍依据、有考时边界、不胡编乱造的专业级解读；同时也为进阶用户和开发者提供站内双模式 AI 对话、远程 MCP、HTTP REST API 与可离线运行的单文件 Skill 包。

---

## ⚡ 30 秒上手

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>🌿 普通用户 · 网页排盘 + 复制提示词</strong><br>
      <sub>零注册、零配置、浏览器纯本地计算，生辰不入库</sub><br><br>
      • 打开 <a href="https://sydf.cc"><strong>sydf.cc</strong></a> 输入生辰或所问之事<br>
      • 一键复制提示词或移动端直唤豆包 / DeepSeek / 系统分享<br>
      • 站内支持自配多配置档（含 Ollama）及免填 Key 内置 AI 代理
    </td>
    <td width="50%" valign="top">
      <strong>🤖 AI 助手 / 开发者 · Skill 与远程 MCP</strong><br>
      <sub>一行命令安装，精简路由节省约 97% 上下文</sub><br><br>
      • 安装 Skill：<code>npx skills add Brhiza/mingyu</code><br>
      • 远程 MCP：<code>https://sydf.cc/mcp?mode=router</code><br>
      • 离线单文件包：<a href="https://sydf.cc/downloads/mingyu-skill.zip"><code>mingyu-skill.zip</code></a>
    </td>
  </tr>
</table>

### 方式 1：网页排盘 + 一键复制预设提示词（推荐 · 零配置免费用）

打开 **[sydf.cc](https://sydf.cc)**，无需注册登录、无需配置任何 API Key，所有核心排盘直接在你自己的浏览器本地完成：
1. 输入出生资料或所问之事，即刻得到结构化盘面与分节报告（支持**八字、紫微、西洋星盘、七政四余、奇门终身局、八宅命卦** 6 体系自由勾选同屏合参）；
2. 点击**一键复制提示词**（已内置精准盘面、引擎规则证据、可选古籍原文、按问题自动匹配的看盘焦点与《解读与交付契约》），直接粘贴给任意在线 AI（DeepSeek、豆包、通义千问、Kimi、ChatGPT 等），或在移动端直接唤起豆包 / DeepSeek App 即可开始专业解读；
3. 也可在页面内直接配置本地保存的多套 OpenAI 兼容接口配置档（含本地 Ollama），或使用自部署站点开启的免填 Key 内置流式 AI 代理连续推演。

### 方式 2：给 AI 助手安装命语 Skill / 接入远程 MCP（进阶与开发者）

- **一行命令安装 Agent Skill（支持 Claude Code、Codex、Cursor 等）**：
  ```bash
  npx skills add Brhiza/mingyu
  ```
  内置 `.mcp.json` 自动接入免费远程精简路由 MCP（`https://sydf.cc/mcp?mode=router`），并自带分场景方法论卡与考时校准流程。
- **离线单文件 Skill 包（断网本地运行）**：在页面「接入 AI」页或 `/downloads/mingyu-skill.zip` 下载，内置独立 `scripts/mingyu.mjs`，不消耗服务器额度。
- **远程 MCP 与 REST API**：精简路由 MCP `https://sydf.cc/mcp?mode=router` · 网页文档 `/api-docs` · 纯文本 AI 文档 `/api-docs.md` · AI 站点摘要 `/llms.txt` · OpenAPI 3.1 `/openapi.json`。

### 方式 3：一键私有化部署到自己的 Cloudflare Workers（免费额度可用）

点击下方按钮，登录你的 Cloudflare 账号并关联 GitHub，即可自动克隆构建并拥有独立网页、HTTP API 与远程 MCP 端点：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu)

> 提示：若使用自建或镜像仓库地址，替换上面链接中的 `url=` 参数即可；大跨度范围扫描（如长时段逐秒星盘/七政扫描）推荐在浏览器工作台（Web Worker 本地算力）或本地 CLI 中执行。

<details>
<summary>展开查看 Workers 运行时与品牌定制环境变量</summary>

- **运行时变量（[wrangler.jsonc](wrangler.jsonc) / Cloudflare Secret）**：
  - `ENABLED_METHODS`：逗号分隔限制开放的术数方法
  - `ACCESS_TOKEN`：通过 `pnpm exec wrangler secret put ACCESS_TOKEN` 为 `/api` 与 `/mcp` 启用 Bearer 令牌保护
  - `MINGYU_MCP_MODE`：设置默认 MCP 模式（`full` 或 `router`）
  - `CORS_ORIGIN`：自定义跨域来源白名单（默认 `*`）
  - `AI_BUILTIN_ENABLED`、`AI_API_KEY`、`AI_BASE_URL`、`AI_API_TYPE`、`AI_MODEL`、`AI_TRUSTED_ORIGINS`：可选开启站内内置流式 AI 代理
- **构建期品牌定制变量（`VITE_*`）**：
  - `VITE_APP_NAME`、`VITE_APP_SLOGAN`、`VITE_APP_ORIGIN`、`VITE_ASSET_ORIGIN`、`VITE_DEFAULT_THEME`、`VITE_MERIT_BOX_URL`、`VITE_BUILTIN_AI_ENABLED`

</details>

---

## 📿 功德箱与交流群

命语与时月东方均为个人业余维护的免费开源项目。

**为什么叫“功德箱”？**  
本项目收到的全部赞助款项目前均定期**全额捐赠给社会正规慈善与公益事业**（用于爱心助学、困境老人救助与乡村公益等）。感谢每一位支持者的善意！

<p align="center">
  <a href="https://lk.sydf.cc/"><strong>👉 前往功德箱（赞助与爱心支持）</strong></a> · QQ 技术交流群：<code>1080947018</code>
</p>

---

## ⚖️ 为什么不直接问大模型算命？

同一张八字问三遍，通用大模型可能给你算出三套完全不同的干支、节气和用神。术数最怕“差之毫厘，谬以千里”——交节错几分钟、真太阳时没换算、追问时偷偷重新起卦，后面的所有推演就全盘皆错。

| 维度 | 直接问通用大模型 | 命语 V2 (Mingyu V2) |
| :--- | :--- | :--- |
| **排盘准确性** | 靠记忆心算，节气、真太阳时、夏令时、宫位极易算错 | **独立天文历法引擎确定性计算**，相同输入永远得到同一盘面 |
| **规则与典籍依据** | 临场发挥，经常编造不存在的古籍原文或格局 | **内置规则证据层与古籍原典**，每条盘面事实、格局、调候、神煞可核验 |
| **普通人使用门槛** | 需反复调教提示词，或被迫购买付费 API / 折腾插件 | **核心能力沉淀进预设提示词**，网页一键复制或直唤 AI App 即可受益 |
| **时辰不明 / 交界处** | 拿钟表时间硬算，或静默替你猜一个时辰 | **原生展开全部候选分支**，提示词内置考时核对引导，证据不足明说 |
| **连续追问** | 问第二句时易忘掉原盘，或偷偷重新起卦 / 抽牌 | **`repromptToken` 原盘免重排追问**，随机占卜只抽一次，绝不重摇 |
| **开源、离线与隐私** | 依赖闭源云端服务，生辰数据上传第三方 | **MIT 全栈开源**，支持浏览器纯本地算、离线单文件 CLI、私有化部署，出生资料不入库 |

---

## 🔬 准确度与高质量提示词的四大支柱

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>1. 独立无状态天文与历法引擎（零黑盒）</strong><br><br>
      • 基于开源天文引擎 <code>astronomy-engine</code>、<code>caelus</code>、<code>tyme4ts</code>，覆盖公农历转换、24 节气精确瞬时、真太阳时、历史夏令时、晚子时换日口径及 5 项天文时间尺度。<br>
      • 内置<strong>离线中国省市区县三级经纬度坐标表</strong>，计算真太阳时与出生地宫位不发起任何外部地理编码请求。<br>
      • 针对西洋星盘与七政四余的秒级敏感特性，提供 <strong>Web Worker 后台逐秒范围扫描</strong>与命令行全量复核工具，不卡顿界面、不丢失边界。
    </td>
    <td width="50%" valign="top">
      <strong>2. 结构化规则证据层 + 经典原典</strong><br><br>
      • <strong>八字证据层</strong>：内置 <strong>362 条《穷通宝鉴》调候规则</strong>、普通/特殊格局成败与制化路径、病药通关与用神基础方向、<strong>57 项本命神煞 + 50 项岁运神煞</strong>、立春年流月时间线。<br>
      • <strong>紫微与双系统互证</strong>：内置 <strong>55 条紫微格局</strong>、六层运限四化定位、飞星离心自化与对宫集禄集忌脉络，以及<strong>八字紫微双系统交叉互证</strong>引擎。<br>
      • <strong>三式与经典字库</strong>：内置六爻用神/反证/应期证据层、奇门古籍格局/组合象意与应期推算、完整《周易》64 卦及《十翼》经文、<strong>4096 条《焦氏易林》</strong>与 <strong>32 分片康熙字库</strong>。
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>3. 预设提示词内置「焦点 + 考时 + 契约」</strong><br><br>
      • <strong>自动识别提问主题</strong>：根据你的问题（事业、财运、感情婚姻、学业考试、出行、失物、健康、诉讼等）自动注入对应看盘焦点与用神锁位提示。<br>
      • <strong>显式考时与多候选边界</strong>：遇到未知时辰、时间范围或交节/晚子时争议时，展开全部分支并引导用 2–3 件过往人生大事交叉核对，证据不足明确标注。<br>
      • <strong>《解读与交付契约》</strong>：约束模型首句先答核心问题、优先引用引擎已算事实与古籍原文、冲突因子并列不宿命化，并对医疗/法律/投资等现实决策给出安全关怀边界。
    </td>
    <td width="50%" valign="top">
      <strong>4. 现代工作台与 AI Agent 工程底座</strong><br><br>
      • <strong>现代工作台与迁移备份</strong>：支持 <strong>6 体系自由多术数合参</strong>、八宅坐山与流年即时切换、5 套东方配色与明暗模式、手绘塔罗/雷诺曼牌组、PWA 安装、一键 JSON 备份导出/导入（自动排除密钥），以及旧版 V1 与旧版 <code>sydf.cc</code> 档案无损迁移。<br>
      • <strong>站内 AI 与快捷分享</strong>：支持多配置档 OpenAI 兼容接口（含 Ollama）及服务端内置流式代理（<code>/api/ai/chat</code>），移动端支持一键复制并直唤豆包 / DeepSeek App。<br>
      • <strong>精简路由与 785+ 测试守门</strong>：<code>/mcp?mode=router</code> 仅暴露 4 个核心工具（描述体积减少约 97%），配合 <code>compact</code> 与 <code>repromptToken</code> 无损追问；全仓 <strong>193 个测试文件、785+ 自动化测试</strong>与无头 Chrome 端到端回归守门。
    </td>
  </tr>
</table>

---

## 🎯 常见使用场景

| 想看什么 | 可以这样问（在网页排盘复制提示词，或直接问 AI 助手） | 自动调用的引擎能力 |
| :--- | :--- | :--- |
| **八字与紫微合参** | `帮我看看事业和明年运势，1990-05-20 12:00 北京出生，男` | `bazi` / `ziwei` / `bazi-ziwei` 双系统互证 |
| **时辰不确定考时** | `只记得大概早上 5 点到 7 点出生，2015 结婚、2018 买房，帮我定一下时辰` | 候选分支展开 + 考时交叉比对 |
| **双人合盘** | `合盘看看我们适不适合长期走下去：男 1990-05-20 12:00 北京，女 1992-03-15 14:30 广州` | `bazi-synastry` / `ziwei-synastry` / `astrolabe-synastry` |
| **事件占问与应期** | `这个合作项目能成吗？大概什么时候有结果？` | `liuyao` / `qimen` / `liuren` / `meihua` / `tarot`（原盘免重排追问） |
| **黄历择日** | `下个月哪几天适合搬家？避开我 1990 年属马的冲日` | `almanac`（支持 180 天分页与参与人避冲） |
| **住宅风水** | `房子 2008 年建、坐北朝南，帮我看看八宅和玄空飞星` | `bazhai` / `xuankong` / `residential` |
| **宝宝起名** | `2024-06-10 广州出生男宝，姓陈，想取个大气温和的双字名` | `chinese-naming` + 32 分片康熙字库 |
| **西洋星盘与七政** | `看看我今年的太阳返照和行运重点` | `astrolabe` / `qizheng`（含 Web Worker 秒级出生范围扫描） |

---

## 🔮 完整支持目录（39 项能力入口）

> 与工具注册表及 `list_methods` 返回的 6 大分组严格一致。

| 分类 | 能力名称与接口标识 | 核心能力说明 |
| :--- | :--- | :--- |
| **命理合参 (7 项)** | 八字排盘 (`bazi`)、八字双人合盘 (`bazi-synastry`)、八字紫微合参 (`bazi-ziwei`)、四柱反推 (`bazi-reverse`)、个人命录 (`minglu`)、周期运势 (`fortune`)、即时起盘 (`instant`) | 公/农历与真太阳时换算、未知时辰/时间范围候选分支、362 条调候规则与格局制化路径、57+50 项神煞、八字紫微双系统互证、多体系命录/周期运势与即时起盘 |
| **紫微星象 (7 项)** | 紫微斗数 (`ziwei`)、紫微合盘 (`ziwei-synastry`)、七政四余 (`qizheng`)、七政四余出生范围 (`qizheng-range`)、西洋星盘 (`astrolabe`)、西洋星盘出生范围 (`astrolabe-range`)、西洋星盘合盘 (`astrolabe-synastry`) | 紫微 55 格局与飞星离心自化、七政流曜与洞微行限、12 种星盘宫位制、按需加载 4 颗小行星星历、行运/太阳返照异地计算/次限/太阳弧与逐秒出生范围分页扫描 |
| **奇门六壬 (6 项)** | 奇门遁甲 (`qimen`)、奇门终身局 (`qimen-lifetime`)、大六壬 (`liuren`)、金口诀 (`jinkoujue`)、小六壬 (`xiaoliuren`)、太乙神数 (`taiyi`) | 转盘/飞盘奇门与经典格局/应期、奇门终身局、大六壬三传四课与行年、金口诀阴阳五用、小六壬与太乙年计推演 |
| **占卜灵签 (8 项)** | 六爻 (`liuyao`)、梅花易数 (`meihua`)、塔罗 (`tarot`)、雷诺曼 (`lenormand`)、随机起卦 (`random-divination`)、三山国王灵签 (`ssgw`)、诸葛神数 (`zhuge`)、数字能量 (`number-energy`) | 六爻时间/三钱/蓍草/手工起卦及原盘免重排追问、梅花体用生克、塔罗/雷诺曼正逆位与大牌阵、揭西祖庙 92 签、诸葛神数 384 签与五枚铜钱 32 课、号码八星磁场解析 |
| **风水择日 (5 项)** | 八宅 (`bazhai`)、玄空飞星 (`xuankong`)、阳宅风水 (`residential`)、黄历择日 (`almanac`)、历法与天文 (`calendar`) | 二十四山坐山与测量误差候选、下卦/兼向替卦、阳宅综合研判、180 天择吉分页与民俗神煞避冲、24 节气/月相/真太阳时/儒略日时间尺度与日出日落 |
| **姓名典籍 (6 项)** | 姓名分析 (`chinese-name`)、中文起名 (`chinese-naming`)、周易经文 (`zhouyi`)、汉字查询 (`character-query`)、五运六气 (`wuyun-liuqi`)、皇极经世 (`huangji-jingshi`) | 五格三才与避讳字排查、《周易》64 卦及《十翼》全篇检索、4096 条《焦氏易林》、32 分片康熙字库按需查询、五运六气年度气候模型、皇极元会运世推步 |

---

## 🛠️ 开发者与 AI 接入

> 官方 `https://sydf.cc` 的 `/mcp` 与 `/api/*` 端点供轻度试用；高频自动化调用或大范围出生扫描，请优先使用网页端本地算力、离线单文件 Skill 包，或通过上方按钮一键部署到自己的 Cloudflare Workers。

### 1. 远程 MCP 服务（Streamable HTTP）

在 Cursor、Windsurf、Cherry Studio、Claude Code 或 Claude Desktop 等支持 Streamable HTTP MCP 的客户端中添加端点：

- **精简路由模式（推荐 AI Agent 使用）**：`https://sydf.cc/mcp?mode=router`
  - 仅注册 4 个核心工具（`list_methods` / `get_method_schema` / `calculate` / `reprompt`），工具清单体积相比全量模式减少约 97%，默认启用 `compact` 省 Token 返回与 `repromptToken` 无损追问。
- **全量工具模式（默认兼容）**：`https://sydf.cc/mcp`
  - 直接按开放列表注册全部术数工具，并提供 `reprompt` 与 `prompt_catalog`。
- 若自部署开启了 `ACCESS_TOKEN`，请求头须附加 `Authorization: Bearer <令牌>`；所有 `/api` 与 `/mcp` 端点默认支持浏览器跨域（CORS）。

### 2. HTTP REST API 接口

- 完整网页文档：`/api-docs`（支持关键词检索与在线域名自动替换）
- 纯文本 Markdown 文档：`/api-docs.md`（可直接发给任意 AI Agent 自动读取接入）
- AI 站点摘要：`/llms.txt` · OpenAPI 3.1 规范：`/openapi.json`（可直接导入 Dify、Coze、FastGPT、n8n、Swagger）
- 核心端点：
  - `GET /api/health`：健康检查与开放方法数
  - `GET /api/methods`：列出当前已开放的术数方法
  - `GET /api/schema` / `GET /api/prompts`：查询入参 JSON Schema 与提示词选项（支持 `?method=bazi`）
  - `POST /api/calculate`：执行计算并返回结构化 `data` 与 `prompt.text`（传入 `"responseMode": "compact"` 仅返回摘要、`prompt.text` 与 `repromptToken`；可选 `"outputLanguage": "zh-TW" | "en" | "ja" | "ko" | "vi"` 等任意语言标签让 AI 按对应语言与主流术语解读）
  - `POST /api/prompt`：传入 `repromptToken` 或完整 `result` 与新 `question` 进行原盘追问（不重新起卦或抽牌；自动沿用上次 `outputLanguage`，也可随时覆盖）
  - `GET /api/ai/status` / `POST /api/ai/chat`：查询及代理调用服务端可选内置流式 AI（仅在部署开启 `AI_BUILTIN_ENABLED=true` 时激活）
  - 旧版 `/api/v1/*` 与 `/sse` 端点已统一返回 `410 Gone` 及 V2 迁移指引。
- 无依赖调用示例见 [Node.js 示例](examples/http-client.mjs) 与 [Python 示例](examples/http_client.py)。

### 3. 离线 Agent Skill 包与独立单文件 CLI（`mingyu.mjs`）

从「接入 AI」页面下载 `/downloads/mingyu-skill.zip`，或在本仓库自行打包：

```bash
# 生成独立单文件可执行 JS（dist-cli/mingyu.mjs）
pnpm build:cli

# 按场景分组裁剪生成精简版单文件 CLI（预设：bazi / ziwei / bazi-ziwei / divination / fengshui / astrology）
pnpm build:cli-variant -- --preset bazi-ziwei

# 生成包含 SKILL.md、.mcp.json、全套场景 references 与 mingyu.mjs 的完整压缩包（dist-cli/mingyu-skill.zip）
pnpm build:skill
```

解压后仅需本机安装 Node.js 20+（推荐 22.12+），即可完全脱离源码目录和网络执行：

```bash
node scripts/mingyu.mjs methods
node scripts/mingyu.mjs schema bazi
node scripts/mingyu.mjs prompts bazi
node scripts/mingyu.mjs calculate bazi --input '{"question":"事业如何？","birth":{"year":1990,"month":5,"day":15,"clock":{"kind":"exact","hour":14,"minute":30,"second":0},"timezone":8},"gender":"male"}' --output result.json --compact
node scripts/mingyu.mjs reprompt --result-file result.json --question '流年需注意什么？'
```

### 4. 本地源码运行 stdio MCP（可选）

```bash
pnpm build:mcp
node dist-mcp/server.mjs
```

---

## 💻 本地开发与全量验证

环境要求：**Node.js >= 22.12.0**、**pnpm 11.25.0**。

```bash
# 1. 安装依赖
pnpm install --frozen-lockfile

# 2. 启动本地开发服务器（计算与 AI 直连全在浏览器端执行，同时提供 /api-docs、/api-docs.md、/openapi.json 与 /downloads/mingyu-skill.zip）
pnpm dev

# 3. 一条命令全量验收（类型检查、785+ 单元测试、打包隔离校验与无头 Chrome 端到端回归）
pnpm check:all
```

<details>
<summary>展开查看分步测试、构建与端到端验证命令</summary>

```bash
# 运行类型检查与 785+ 单元测试（193 个测试文件）
pnpm typecheck
pnpm test

# 构建前端与 Worker 资产（输出至 dist-independent/）并校验打包隔离
pnpm build
pnpm check:worker-profile

# 构建与校验独立 MCP 包（脱离 node_modules 运行）
pnpm build:mcp
pnpm check:mcp-profile

# 校验干净目录构建与按需字库/小行星数据路由
pnpm check:clean-build

# 启动本地 preview 后运行无头 Chrome 真实工作台端到端回归
MINGYU_BROWSER_TEST_URL=http://127.0.0.1:18788/ pnpm check:browser-form
MINGYU_BROWSER_TEST_URL=http://127.0.0.1:18788/ pnpm check:browser-ai
```

</details>

---

## ❓ 常见问题 (FAQ)

<details open>
<summary><strong>不会配置 API 或插件，普通人怎么用最方便？</strong></summary>

直接打开 **[sydf.cc](https://sydf.cc)** 排盘，点一下**“复制提示词”**，粘给你平时用的免费在线 AI（DeepSeek、豆包、Kimi、千问、ChatGPT 等）就行（移动端也可一键直唤豆包 / DeepSeek App）。所有精准盘面、古籍依据和解读规矩都已经打包在提示词里，零折腾、完全免费。

</details>

<details>
<summary><strong>不知道准确出生时辰怎么办？</strong></summary>

排盘时选择「未知时辰」或填写大致时间段即可。命语会展开所有可能候选分支并标出共同点与差异，绝不默默替你猜；生成的提示词也会引导 AI 结合你提供的 2–3 件过往人生大事与年份交叉考时，证据不足时如实说明。

</details>

<details>
<summary><strong>收费吗？有额度限制吗？</strong></summary>

完全免费开源（MIT 协议）。在线网页版在你的浏览器本地算，离线 Skill 包在你的电脑本地算，没有任何付费墙或次数限制；你也可以一键免费部署到自己的 Cloudflare Workers 账号。

</details>

<details>
<summary><strong>我的生辰八字和提问会被保存吗？</strong></summary>

不会上传到任何服务端数据库。网页版排盘、档案、对话与规则设置仅保存在你自己浏览器的本地存储中（支持随时一键导出 JSON 备份，且自动排除 API Key 等敏感凭据），无账号体系；远程 API / MCP 为完全无状态服务，不留存用户生辰。

</details>

---

## ⛩️ 文化传承与文档索引

### 关于三山国王灵签
三山国王是潮汕与客家地区重要的民间信仰，祖庙位于广东省揭西县河婆街道。作者整理并保留了祖庙传承的 92 签灵签体系，每签保留签号、签题、签诗原文与典故。

### 📚 文档与基线目录
- [Agent Skill 入口说明](skills/mingyu/SKILL.md)
- [术数路由映射表](skills/mingyu/references/routing.md)
- [考时与出生时间校准流程](skills/mingyu/references/time-calibration.md)
- [解读与证据规范](skills/mingyu/references/interpretation.md)
- [高频场景卡：命理 / 占卜风水 / 起名](skills/mingyu/references/scenario-natal.md) · [占卜择日风水](skills/mingyu/references/scenario-divination.md) · [姓名起名](skills/mingyu/references/scenario-naming.md)
- [常见故障与排障手册 (FAQ)](skills/mingyu/references/FAQ.md)
- [AI 站点摘要 (llms.txt)](public/llms.txt)
- [V2 能力基线清单](docs/v2-capability-baseline.json)
- [Node.js 调用示例](examples/http-client.mjs) · [Python 调用示例](examples/http_client.py)

---

## ⚖️ 免责声明

本工具提供的排盘结果与 AI 解读提示词仅供传统文化研究与休闲娱乐参考，不构成且不可替代医疗、心理、法律、投资等专业建议。

## 📄 开源协议

本项目代码基于 [MIT](LICENSE) 协议开源（Copyright (c) 2026 Brhiza）。

项目内置的第三方数据与资料各自遵循其原有协议，不随代码变更为 MIT：
- 《周易》经文转录数据（[src/data/zhouyi](src/data/zhouyi/README.md)）：来源于维基文库，按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 提供（古典原文本身属公版）。
- Caelus 天文与占星固定数据（[src/systems/astronomy](src/systems/astronomy/README.md)、[src/systems/astrology/data](src/systems/astrology/data/README.md)）：按 MIT License 使用与分发。
