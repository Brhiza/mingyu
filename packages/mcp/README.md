# 命语 MCP Server (mingyu-mcp)

> 命语 (Mingyu) 官方 Model Context Protocol (MCP) 服务端 CLI，让你的 AI 助手（Claude Desktop、Cursor、Cline、Zed 等）直接具备正统、专业的中华传统术数排盘与解读能力。

无需克隆仓库，无需编译，通过主流的 `npx` 或 `npm` 即可开箱即用。

---

## 快速使用 (npx 零门槛)

无需安装任何依赖，只需在终端中运行：

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

保存后重启客户端，即可看到 25+ 门专业命理排盘与占卜工具已就绪。

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
