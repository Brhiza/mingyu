# 开发与部署

命语使用 pnpm workspace 同时维护 React 应用和 `mingyu-core` 算法包，支持本地开发、Cloudflare Pages 和 Docker 部署。

## 技术栈

| 类别       | 技术                                      |
| ---------- | ----------------------------------------- |
| 前端       | React 19、TypeScript 5.9                  |
| 构建       | Vite 7                                    |
| 路由       | React Router 7                            |
| 包管理     | pnpm workspace                            |
| 部署       | Cloudflare Pages、Pages Functions、Docker |
| 历法与星盘 | `tyme4ts`、`iztro`、`Caelus`              |
| 数据校验   | `zod`                                     |
| 测试       | Node.js 原生测试运行器                    |
| AI 集成    | MCP Server、OpenAPI、Agent Skill          |

## 项目结构

```text
mingyu/
├── functions/                 # Cloudflare Pages Functions 与发现元数据
├── mcp/                       # MCP Server
├── packages/
│   └── core/                  # mingyu-core 独立算法包
│       ├── src/bazi/          # 八字引擎与增强分析
│       ├── src/divination/    # 占卜算法
│       ├── src/calendar/      # 历法工具
│       └── src/types/         # 共享类型
├── public/
│   └── skills/                # 公开 Agent Skill
├── server/                    # Docker 自部署服务入口
├── src/
│   ├── components/            # 页面组件与通用 UI
│   ├── lib/                   # 应用层、提示词和公开 API 适配
│   ├── pages/                 # 输入、结果、历史与教程页面
│   ├── types/                 # 应用领域类型
│   ├── utils/                 # 页面层工具
│   └── workers/               # Web Worker
└── tests/                     # 单元测试与集成测试
```

## 本地开发

安装 pnpm：

```bash
npm install -g pnpm
```

安装依赖并启动网页：

```bash
pnpm install
pnpm dev
```

启动 MCP Server：

```bash
pnpm mcp
```

常用验证命令：

```bash
pnpm test
pnpm build
pnpm lint
pnpm format:check
```

单独构建 `mingyu-core`：

```bash
pnpm --filter mingyu-core build
```

类型检查 MCP 与共享源码：

```bash
npx tsc --project mcp/tsconfig.json --noEmit
```

## Cloudflare Pages

静态页面由 Pages 托管，公开 API、MCP 等动态路由由 Pages Functions 处理。仓库中的 `public/_routes.json` 会随 `pnpm build` 复制为 `dist/_routes.json`，将 Function 调用限制在列出的动态路由；部署包含此文件的构建后，其他静态页面和资源不会调用 Function。Cloudflare Pages 的路由规则见 [官方文档](https://developers.cloudflare.com/pages/functions/routing/)。

Pages Functions 请求计入 Workers 计划用量。Workers Free 的每日请求限额为 100,000 次，与同账户 Workers 请求共享，并在 UTC 午夜重置；Pages Functions 每次请求计为一次 Workers 请求。因而，`/mcp` 上每条 JSON-RPC 消息对应一次独立 `POST` 和一次 Function 调用，初始化、工具列表、工具调用以及额外的元数据探测或预检请求都可能增加用量。避免客户端轮询和紧密重试；频繁或批量调用可使用本地 `npx -y mingyu-mcp` stdio，或本地运行 HTTP 服务（`pnpm mcp --http`）。静态资源请求不计 Functions 请求。

Workers Free 的 CPU 时间上限为每次请求 10 毫秒；较重的计算可能超过平台限制。在线 MCP 提示词通常默认 `summary`，非幂等的一次性起卦、抽牌、求签提示词默认 `full`，显式 `responseMode` 优先；`summary` 只精简返回体，不减少计算 CPU。星盘默认使用 `natal`；显式要求 `full` 或较大范围也不保证每次调用低于 CPU 限制。在线四柱反推必须提供 `startYear`、`endYear` 且最多 10 年，黄历最多 7 天，奇门终身动态最多 10 年；在线 MCP 拒绝 JSON-RPC batch。需要频繁调用或完整结构化结果时优先使用本地 stdio CLI；它默认 `full` 且不占 Pages Functions 请求额度。官方 Pages `/mcp` 路由在 `functions/mcp.ts` 中固定使用 `online` 预设；`MINGYU_MCP_PRESET` 仅适用于 Docker 自部署 HTTP handler，不会切换官方 Pages 或本地 stdio CLI 的预设。Docker 服务默认 `full`。公开 API 成功响应 1 MiB 上限由应用自身执行，与 Cloudflare 平台响应体限制无关。平台额度与限制见 [Cloudflare Workers 官方文档](https://developers.cloudflare.com/workers/platform/limits/) 和 [Pages Functions 定价说明](https://developers.cloudflare.com/pages/functions/pricing/)。

| 配置项                 | 值           |
| ---------------------- | ------------ |
| Build command          | `pnpm build` |
| Build output directory | `dist`       |
| Root directory         | 仓库根目录   |
| Node.js version        | 建议 `22`    |

如果 Cloudflare 没有自动启用 pnpm，在环境变量中添加：

```text
PNPM_VERSION=11
```

部署后检查以下地址，域名替换成自己的站点：

```text
https://你的域名/api/v1/manifest
https://你的域名/api/v1/openapi.json
https://你的域名/.well-known/aov-mingyu-api.json
https://你的域名/mingyu-runtime-config.js
```

环境变量在 Cloudflare Dashboard 的 Settings → Environment variables 中配置。密钥不要写入代码仓库。如果同时使用 Preview 部署，需要在 Preview 环境单独配置并重新部署。

## Docker

Docker 镜像会构建网页，并启动同时提供网页、公开 API、流式 AI 解读和模型列表的 Node 服务。

构建并启动基础服务：

```bash
docker build -t mingyu .
docker run --rm -p 3000:3000 mingyu
```

访问 `http://localhost:3000`。

也可以使用 Docker Compose：

```bash
docker compose up --build
```

Compose 会读取本地 `.env`。可以参考下面的配置，但不要提交包含真实密钥的 `.env`：

```text
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
AI_BUILTIN_ENABLED=true
AI_DEFAULT_ENABLED=false
AI_RATE_LIMIT_MAX_REQUESTS=12
AI_RATE_LIMIT_WINDOW_SECONDS=600
VITE_ENABLE_DONATION_BOX=false
```

默认端口为 `3000`。修改容器内端口时设置 `PORT`；修改宿主机端口时调整 Compose 或 `docker run -p` 左侧端口。

`VITE_ENABLE_DONATION_BOX=true` 会在首页显示功德箱按钮。这个变量只影响前端构建：Cloudflare Pages 需放在构建环境变量中，Docker 需在构建时传入。

## 内置 AI

命语支持两种 AI 使用方式：

- 用户在网页的 AI 设置中填写 OpenAI 兼容接口，API Key 只保存在用户自己的浏览器。
- 部署者在服务端配置可选的内置 AI。

服务端环境变量：

| 变量                           | 说明                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `AI_API_KEY`                   | 服务端调用模型的密钥                                              |
| `AI_BASE_URL`                  | OpenAI 兼容接口地址                                               |
| `AI_MODEL`                     | 默认模型名称                                                      |
| `AI_PROVIDER_NAME`             | 前端显示的服务商名称                                              |
| `AI_BUILTIN_ENABLED`           | `true` 时显示并允许使用内置 AI                                    |
| `AI_DEFAULT_ENABLED`           | `true` 时默认进入 AI 解读；`false` 时默认使用提示词模式           |
| `AI_RATE_LIMIT_MAX_REQUESTS`   | 单个客户端在窗口内最多调用内置 AI 的次数，默认 `12`               |
| `AI_RATE_LIMIT_WINDOW_SECONDS` | 内置 AI 限流窗口秒数，默认 `600`                                  |
| `AI_STREAM_IDLE_TIMEOUT_MS`    | 流式响应连续无新内容的超时，默认 `30000`                          |
| `AI_STREAM_TOTAL_TIMEOUT_MS`   | 单次流式响应总时长上限，默认 `95000`                              |
| `AI_TRUST_PROXY`               | 仅 Docker 位于可信反向代理后时设为 `true`，用于读取真实客户端地址 |

Cloudflare Pages 的 Production 环境可使用：

```text
AI_BUILTIN_ENABLED=true
AI_DEFAULT_ENABLED=false
AI_API_KEY=你的模型密钥
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
AI_RATE_LIMIT_MAX_REQUESTS=12
AI_RATE_LIMIT_WINDOW_SECONDS=600
```

只设置 `AI_API_KEY` 不会自动显示内置 AI，必须同时设置 `AI_BUILTIN_ENABLED=true`。如果想提供可选内置 AI，但仍让访客默认复制提示词，保持 `AI_DEFAULT_ENABLED=false`。

服务端会按客户端地址限制内置 AI 调用频率，并对网络异常、408、429 和 5xx 临时错误自动重试 2 次；鉴权失败和模型名错误不会重试。Cloudflare Pages 会自动使用平台提供的客户端地址；Docker 直接暴露端口时使用连接地址，只有位于可信反向代理后才设置 `AI_TRUST_PROXY=true`。

| 错误码                       | 含义                           |
| ---------------------------- | ------------------------------ |
| `AI_UPSTREAM_UNSTABLE`       | 上游 AI 服务返回 5xx           |
| `AI_UPSTREAM_RATE_LIMIT`     | 上游限流或额度受限             |
| `AI_RATE_LIMITED`            | 当前客户端调用内置 AI 过于频繁 |
| `AI_UPSTREAM_TIMEOUT`        | 上游响应超时                   |
| `AI_UPSTREAM_AUTH_ERROR`     | API Key 无效、过期或账号异常   |
| `AI_UPSTREAM_CONFIG_ERROR`   | 接口地址或模型名称不受支持     |
| `AI_UPSTREAM_NETWORK_ERROR`  | 服务器无法连接上游             |
| `AI_UPSTREAM_EMPTY_RESPONSE` | 上游成功但没有返回可读内容     |
| `AI_UPSTREAM_STREAM_ERROR`   | 上游流式响应中途断开           |

`.dev.vars.example` 提供本地和 Cloudflare 配置模板。公开站点启用内置 AI 会产生调用成本，也会受到上游模型额度、限流和稳定性的影响。

## 更多开发资料

- [公开 API](api.md)
- [MCP Server](../mcp/README.md)
- [`mingyu-core`](../packages/core/README.md)
- [模型评测](model-evaluation.md)
