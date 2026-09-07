# 数据提供方适配层规范（Provider Architecture）

本 Skill 不与任何专属排盘实现硬绑定，而是通过一套统一的 **Provider 适配协议** 桥接各种数据源：
无论是远程公开 API、本地独立部署的 MCP Server、桌面端内嵌命令行工具，还是用户手动输入的卦象盘面，均适配为五层标准事实。

---

## 1. 为什么必须建立适配层？

1. **环境隔离**：不同的 Agent 运行环境差异巨大（有的能发网络请求，有的只能调本地工具，有的只能在沙盒中处理自然语言）。
2. **多源容灾**：当主数据源（如远程 API）超时或网络不可用时，系统必须能平滑降级到备用源或人工盘面补录流程，绝不能报错崩溃。
3. **接口解耦**：底层排盘接口增减字段、调整格式时，只需更新 Provider 适配层，核心推演方法论与交付规范保持稳定。

---

## 2. 官方推荐 Provider：AOV 公开 API 与 Mingyu MCP

目前官方维护的标准 Provider 包括：
1. **AOV 云端 API**：通过 RESTful 端点提供高精度真太阳时换算、全门类古典排盘与自包含提示词服务。
2. **Mingyu MCP Server**：本地/自托管的模型上下文协议服务，适合本地离线 Agent 或 Cursor / Claude Code 直连。

具体端点映射、契约参数与调用实践详见：[`references/providers/aov-mingyu.md`](references/providers/aov-mingyu.md)。
