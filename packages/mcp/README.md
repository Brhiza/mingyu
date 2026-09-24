# 命语 MCP Server (mingyu-mcp)

> 命语 (Mingyu) 官方 Model Context Protocol (MCP) 服务端 CLI，让你的 AI 助手（Claude Desktop、Cursor、Cline、Zed 等）直接具备正统、专业的中华传统术数排盘与解读能力。

无需克隆仓库，无需编译，通过主流的 `npx` 或 `npm` 即可开箱即用。

---

## 快速使用 (推荐本地 stdio)

MCP 客户端能够启动本地进程时，优先使用本地 stdio。请求由本机处理，不占用 Cloudflare Pages Functions 请求额度；默认采用 `full` 预设。Agent Skill 的安装不会自动注册 MCP 服务，两者需分别配置。

```bash
npx -y mingyu-mcp
```

或全局安装：

```bash
npm install -g mingyu-mcp
mingyu-mcp
```

---

## 远程服务（免安装）

如果你不想在本地运行进程，也可以在支持 Remote MCP 的客户端中直接配置官方提供的远程 Streamable HTTP 节点：

- **URL**: `https://aov.cc/mcp`

> **预设模式说明（Online 与 Full）**：
> - **本地 CLI (`npx -y mingyu-mcp`) / 自部署**：默认采用 `full` 预设，提示词工具默认返回完整结构化结果，星盘默认包含当前年度行运。`MINGYU_MCP_PRESET` 只由 Docker 自部署 HTTP handler 读取，不适用于本地 CLI 的 stdio 运行，也不会切换官方在线端点。
> - **在线端点 (`https://aov.cc/mcp`)**：无法启动本地进程或需要远程免安装时使用；线上采用 `online` 预设，提示词工具默认 `responseMode: "summary"`，星盘默认本命（`astrolabeScope: "natal"`）。也可显式传入 `responseMode: "full"` 或推运范围，但在线资源范围保护与边缘运行限制仍然生效。

在线端点使用 Streamable HTTP：每条 JSON-RPC 消息单独通过一次 `POST` 发送；初始化、工具列表和工具调用会产生多次请求。普通浏览器 `GET` 返回端点元数据；`Accept: text/event-stream` 的 `GET` 返回 `405`，因为在线端点不提供独立 SSE 流。旧路径 `/sse` 只返回 `USE_STREAMABLE_HTTP` 提示，访问它也会运行 Pages Function。`/mcp` 请求会计入 Workers Free 每日请求额度；避免轮询、频繁重连和紧密重试。频繁或批量调用可用本地 stdio，以免消耗线上请求额度。

---

## 客户端配置

### 1. Claude Desktop

在 Claude Desktop 的配置文件中添加：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mingyu": {
      "command": "npx",
      "args": ["-y", "mingyu-mcp"]
    }
  }
}
```

> **Windows 提示**：若某些环境未能直接识别 `npx`，可将 `command` 改为 `npx.cmd`。

---

### 2. Cursor / Windsurf / Cline

在对应客户端的 MCP 设置中添加命令：

- **Command**: `npx`
- **Args**: `-y mingyu-mcp`

保存后重启客户端，即可看到 70+ 个专业命理排盘、提示词与占卜工具已就绪。

## 稳定调用方式

1. 需要 AI 直接解读时，优先选择名称以 `_prompt` 结尾的工具。它会完成本次计算并返回顶层 `prompt`，可用时还会在 `result` 返回结构化盘面，不要先调用一次同类排盘工具。
2. 只需展示盘面、导出表格或继续程序计算时，使用 `*_calculate`、`divine_*` 或基础查询工具，并按 `outputSchema` 读取结构化字段与 `warnings`；多数工具使用 `result`，部分专用工具使用具名字段。
3. 只传用户已经提供的资料。出生时辰、日期、地点、经纬度和时区缺失时，根据工具错误中的 `missingFields` 补问，不自行推定。
4. 随机起卦、抽牌和求签，同一问题只调用一次；继续解读时复用返回的重放参数或固定结果。
5. 解读时以计算结果为事实，以提示词中的传统取义完成分析；遇到 `warnings` 时相应收窄结论。
6. 响应模式选择：提示词工具支持 `responseMode: "summary"`（提示词与轻量摘要，在线端点默认）、`"full"`（完整结构化结果，本地 CLI 默认）与 `"prompt-only"`（仅纯提示词）。
7. 重型计算拆分：在在线端点使用时，西洋星盘优先使用默认本命盘（`natal`），有推运需求再显式传 `astrolabeScope: "yearly"`；奇门终身局使用 `periodRange` 限制关注年份；黄历择日按段请求。需要批量大运流年与全生命周期推演时，推荐直接使用本地 CLI。

---

## 支持的术数与工具

- **命理体系**：八字排盘与合婚、紫微斗数、八字紫微合参、皇极经世、五运六气；
- **易卦与三式**：六爻纳甲、梅花易数、小六壬、奇门遁甲、大六壬、金口诀、太乙神数；
- **天星与择日**：西洋星盘（本命/天象）、七政四余、黄历择日、生肖流年；
- **环境堪舆**：玄空飞星、八宅风水、住宅风水；
- **牌卡与签谱**：韦特塔罗、雷诺曼、三山国王灵签；
- **基础工具**：真太阳时换算、万年历干支节气换算、一键即时起盘。

---

## 开源协议

[AGPL-3.0-only](LICENSE) License
