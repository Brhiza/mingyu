# 常见故障与排障自救手册 (FAQ)

> 当调用本地脚本 `scripts/mingyu.mjs`、远程 MCP 或 HTTP API 出现连接异常、参数校验失败或结果不完整时，先按本表排查。

## 1. 本地脚本 vs 远程 MCP 选择异常

- **报错找不到 `scripts/mingyu.mjs` 或 `node` 不可用**：
  - 正常现象（例如通过 `npx skills add` 安装的纯远程 Skill 不含离线 JS）。自动回退使用 `.mcp.json` 自举的远程 MCP（`https://aov.cc/mcp?mode=router`）或用户指定的 HTTP 服务。
- **本地执行报错语法或 API 不支持**：
  - 本地独立脚本需要 Node.js 20+（推荐 22.12+）；若本机 Node 版本过低，改用远程 MCP 端点。
- **远程 MCP 连接超时或鉴权失败 (401/403)**：
  - 检查是否连向私有部署且需要 `Authorization: Bearer <ACCESS_TOKEN>`；若公共端点 `https://aov.cc/mcp?mode=router` 临时不可达，提醒用户稍后重试或切换离线包 `mingyu-skill.zip`，**不要用模型心算冒充排盘结果**。

## 2. 参数校验失败 (400 / Schema Error)

- **处理原则**：先调用 `get_method_schema` / `node scripts/mingyu.mjs schema <方法名>` 核对精确字段名与枚举值，对照报错修正参数。
- **幂等方法可修正后重试**：八字、紫微、星盘、历法、择日、风水、查典等确定性计算方法，修正参数后直接重试即可。
- **随机事件方法严禁盲目重试**：`liuyao`、`meihua`、`tarot`、`lenormand`、`ssgw`、`zhuge`、`random-divination` 若已成功返回一次结果，**绝对不要重试或重新起卦**；仅在明确参数报错未生成盘面时修正参数重发。

## 3. 追问失败或 `repromptToken` 无效

- 若使用 `repromptToken` 报格式错误或损坏，改用上次保存的完整 `result.json`（本地 `--result-file` 或 HTTP/MCP 传入完整 `result` 对象）调用 `reprompt`。
- 若上下文中既没有 `repromptToken` 也没有完整结果，如实告知用户原盘数据已丢失，**不要偷偷重新抽牌或起卦**，请用户确认是否重新起盘或提供原盘记录（如六爻爻值、牌面）。

## 4. 分页与出生范围不完整

- `almanac`、`bazi-synastry`、`ziwei-synastry`、`zhouyi`（检索）、`character-query`（筛选）返回 `nextOffset` 时，须按游标续页；未续完时必须明确注明“仅覆盖当前页”。
- `astrolabe` 周期事件与 `astrolabe-range`、`qizheng-range` 须按 `nextCursor` 续取；长时段范围扫描建议提醒用户在网页工作台（Web Worker）或本地 CLI 中执行，避免远程超时。

## 5. 严禁心算兜底

- 任何工具调用失败或目标方法未开放时，必须如实说明“当前工具不可用 / 方法未开放”，**严禁由大模型自行推算干支、节气、紫微星曜或随机编造卦象来兜底**。
