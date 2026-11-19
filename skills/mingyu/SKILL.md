---
name: mingyu
license: MIT
description: 使用命语 V2（本地离线引擎、远程 MCP 或 HTTP 服务）进行 39 项术数排盘、天文历法推算、典籍查询、考时校准与可溯源解读；支持原盘免重排追问。传统文化视角，不构成专业建议。
metadata:
  author: Brhiza
  homepage: https://aov.cc
  repository: https://github.com/Brhiza/mingyu
---

# 命语 V2

用户要求使用命语排盘、查典或解读时，按以下优先级接入：
1. **本地离线脚本优先**：检查技能目录下是否存在 `scripts/mingyu.mjs` 且环境支持 Node.js；若存在，优先通过命令行本地执行 `node scripts/mingyu.mjs`（完全离线、不消耗远程额度）。
2. **远程 MCP / HTTP 服务**：若无本地脚本，使用本技能包自带 `.mcp.json` 自举的远程 MCP（默认精简路由模式 `https://aov.cc/mcp?mode=router`），或用户已配置/指定的 V2 MCP / HTTP 服务。

开始前先确认实际开放的方法与入参：
- 本地脚本：`node scripts/mingyu.mjs methods`、`node scripts/mingyu.mjs schema <方法名>`、`node scripts/mingyu.mjs prompts [方法名]`
- 远程 MCP / HTTP API：先查看自省工具目录（精简路由模式下调用 `list_methods` / `get_method_schema`）或 `GET /api/methods`、`GET /api/schema?method=方法名`、`GET /api/prompts?method=方法名`。

只使用当前实际开放的能力，不猜测服务地址、工具名或未声明字段。工具调用失败、连接异常、参数报错或追问令牌失效时，先读取 [常见故障与排障自救手册](references/FAQ.md) 处理，严禁由模型自行心算排盘兜底。

## 交互停顿与参数收集规则

- **⛔ 阻塞确认**：缺少会改变计算的必要信息（如出生日期、性别、必要经纬度/时区、待合盘双方资料、线下摇卦/抽牌记录，或考时多候选定案）时，**必须停下来向用户确认**，严禁自行猜测、静默选盘或抢跑推演。
- **💬 默认可跳过**：非关键偏好参数（如是否附带古籍原文、流派口径、默认牌阵、关注年份等），列出默认值并明确告知用户可回复“都用默认”。
- **单步推进**：每次交互只完成当前必要步骤；前置信息未齐或未确认时，不提前展开后续推断。

## 领域与场景按需路由

尊重用户指定的术数；未指定时按 [方法路由](references/routing.md) 选择与主体、问题和时间范围相符的入口。根据实际任务**按需读取**对应参考，无关参考无需加载：

- **技术与参数边界参考**：
  - [出生盘、双盘与出生范围](references/birth-and-astrology.md)：八字、紫微、合参、西洋星盘、七政及范围分页。
  - [事件占问与起局范围](references/event-divination.md)：六爻、梅花、奇门、大六壬、金口诀、太乙、皇极、经文与随机占法。
  - [即时盘、历法与资料查询](references/reference-tools.md)：即时起盘、历法、姓名、汉字与数字能量。
- **高频场景与方法论卡**：
  - [考时与出生时间校准](references/time-calibration.md)：未知时辰、时间范围、交节/晚子时/夏令时争议，或距时辰交界 ≤ 30 分钟时读取。
  - [命理高频场景解读指南](references/scenario-natal.md)：事业、财运、感情婚姻、双人合盘、流年流月与综合命录。
  - [占卜问事、择日与风水场景指南](references/scenario-divination.md)：事件占问与应期、黄历择日、八宅/玄空/阳宅风水。
  - [姓名分析与起名场景指南](references/scenario-naming.md)：现有姓名评估、宝宝起名/改名与康熙字库筛字。
- **通用解读与证据规范**：
  - 用户要求解读、多方法合参或时间判断时，读取 [解读与证据](references/interpretation.md)。

## 计算、追问与交付

首次计算：
- 本地脚本：`node scripts/mingyu.mjs calculate <方法名> --input '<JSON>' --output result.json --compact`（保存完整盘面到 `result.json`，同时控制台只输出精简摘要与 `prompt.text`，节省上下文；复杂 JSON 可写入文件后传 `--input-file <路径>`）。
- 远程 MCP / HTTP API：优先使用精简路由模式 `/mcp?mode=router` 或在 `POST /api/calculate` 传入 `{ "method": "方法名", "input": { ... }, "responseMode": "compact" }`，获取 `prompt.text` 与 `repromptToken`。

完整保存返回结果（或 `repromptToken`）；**随机抽牌、起卦或求签只进行一次**，事件类工具不自动重试。围绕同一盘面的新问题追问不要重新抽取：
- 本地脚本：`node scripts/mingyu.mjs reprompt <方法名> --result-file result.json --question "新问题"`（或使用 `--token "<repromptToken>"`）。
- 远程 MCP / HTTP API：调用 MCP `reprompt` 或 `POST /api/prompt`，传入 `{ "repromptToken": "...", "question": "新问题" }` 或 `{ "method": "方法名", "result": 上次完整结果, "question": "新问题" }`。

追问默认以本次调用时间作为提示词参考；需要其他参考时间时显式传带时区的 `currentTime`，原盘时间不会改变。结果保存了首次计算的提示词选项；省略 `prompt` 时沿用，传新对象整体替换，传 `{}` 恢复默认。结果及选项由调用方提供，来源无法由服务证明。

按返回游标（`nextCursor` / `nextOffset`）续取用户需要的全部页面；单页追问只覆盖保存页。七政及西洋出生范围的完整命令行收集结果使用相应范围参考中的专用复核方式，不作为 HTTP/MCP 单页结果提交。

## 输出契约与硬边界

- **禁止重算盘面**：工具返回的四柱、宫位、星体、爻位与规则指标即唯一事实来源，严禁在推理中重新排盘或篡改引擎输出。
- **只交付事实**：用户只要提示词时直接交付返回的 `prompt.text`；用户要求解读时，所有命理事实一律来自工具返回，缺失必要事实明确标注「缺口 / 未计算」，绝不把未实现规则或预览功能称作已完成。
- **结论先行、依据可查**：首句先回应用户核心问题（或明确说明资料/证据不足），随后优先引用引擎已算出的结构化证据（四柱/宫位/爻位/格局/调候/神煞/飞星/古籍原文/双系统互证等），严格区分盘面事实、传统取义、条件推断与资料缺口。
- **不宿命化与安全边界**：冲突因子并列呈现，不强行合并；冲击性判断须附条件前提与可行动建议；涉及医疗、心理、法律、投资、安全等现实决策时，遵循关怀优先原则，明确标注为传统文化视角参考并建议咨询相关专业人士。
- **隐私与语言**：出生资料与提问仅用于当前会话，不额外索取真实姓名等无关信息；最终输出语言跟随用户，工具名、参数名与专业字段保留原文。
