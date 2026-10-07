# 开发与部署

命语使用 pnpm workspace 同时维护 React 应用和 `mingyu-core` 算法包。官方站点 `https://aov.cc` 通过 RNG 上的 Docker/Node 服务整站部署，统一提供网页、公开 API、MCP 和内置 AI；Cloudflare Pages 保留为可选自部署方式。

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

## Cloudflare Pages（可选自部署）

Pages 构建会将静态页面以及 API 发现目录写入部署产物。`/api/v1/health`、`/api/v1/manifest`、`/api/v1/openapi.json`、`/api/v1/foundation/capabilities` 和 `/.well-known/aov-mingyu-api.json` 由 Pages 直接返回静态文件，不调用 Pages Function。manifest 中的 URL 按所选站点 origin 解析；`.well-known` 返回直接 manifest，API manifest 与 OpenAPI 使用 `{ok,data,meta}` 封装。`pnpm build` 还会通过 MCP SDK 生成 `dist/mcp-tools.json`；Pages `/mcp` 首次处理 `tools/list` 时直接读取该静态工具目录，减少冷启动时的 schema 转换。`tools/list` 请求仍经 Pages Function 并计入用量。`public/_routes.json` 限定需要 Function 的动态路径；静态页面和资源不计 Functions 请求。路由规则见 [Cloudflare 官方文档](https://developers.cloudflare.com/pages/functions/routing/)。

Workers Free 的每日 100,000 次请求额度与同账户 Workers 共用，并在 UTC 午夜重置。每个实际执行的 Pages Function 请求计一次；因此在线 `/mcp` 的每条 JSON-RPC 消息各有一次 `POST`，初始化、工具列表和工具调用会分开计数。普通 REST 计算与旧 `/sse` 路由也会调用 Function。不要定时轮询 `/mcp` 或重复探活；频繁、批量或需要完整结构化结果时，用本地 `npx -y mingyu-mcp` stdio 或自部署服务。静态发现地址只需按需读取，在线 Pages health 的 `timestampKind` 为 `build`，时间戳是构建时间，不是实时计算探测；Docker health 仍实时。

Workers Free 每次请求 CPU 上限为 10ms，较重计算可能超过平台限制；完整在线排盘不保证在 Free 配额内完成，正式部署使用 Node/Docker。在线 MCP 提示词通常默认 `summary`，非幂等的一次性起卦、抽牌、求签默认 `full`，显式 `responseMode` 优先；`summary` 不缩小算法计算范围。星盘默认本命（`natal`）；显式 `yearly`、`full` 或较大范围也不保证低于 CPU 上限。在线请求返回 `RESOURCE_LIMIT` 时先修改范围或分段，不能原样自动重试。在线四柱反推最多 10 年，黄历最多 7 天，奇门终身动态最多 10 年；官方 MCP 拒绝 JSON-RPC batch。Pages `/mcp` 固定使用 `online` 预设。Node/Docker 的 HTTP MCP 读取 `MINGYU_MCP_PRESET`，REST 读取 `MINGYU_API_PRESET`，两者默认 `full`，不影响本地 stdio。公开 API 成功响应 1 MiB 上限由应用执行，与 Cloudflare 平台限制无关。平台额度与限制见 [Workers 官方文档](https://developers.cloudflare.com/workers/platform/limits/) 和 [Pages Functions 定价说明](https://developers.cloudflare.com/pages/functions/pricing/)。

Pages `/api/v1` 入口也在计算前限制高成本范围：四柱反推须显式指定不超过 10 年，黄历单次最多 7 天，奇门终身动态最多 10 年，单点紫微选择 `full` 时须提供 `scopeBatch` 或 `fortuneBatch`（`/prompt` 的 `scope: "full"` 同样适用）。超限返回 `HTTP 400 / RESOURCE_LIMIT`；默认紫微当前大限结果不变。Docker 的 `full` 预设保留原有范围，`online` 预设执行同样的范围限制。在线 MCP 的 `POST` 请求体上限为 512 KiB，超过时在解析和创建工具服务前拒绝；Node HTTP 入口也限制为 512 KiB；本地 stdio 不采用此 HTTP 限制。

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

部署后可各检查一次以下地址，域名替换成自己的站点；不要将它们配置为高频轮询：

```text
https://你的域名/api/v1/health
https://你的域名/api/v1/manifest
https://你的域名/api/v1/openapi.json
https://你的域名/api/v1/foundation/capabilities
https://你的域名/.well-known/aov-mingyu-api.json
https://你的域名/mingyu-runtime-config.js
```

环境变量在 Cloudflare Dashboard 的 Settings → Environment variables 中配置。密钥不要写入代码仓库。如果同时使用 Preview 部署，需要在 Preview 环境单独配置并重新部署。

## Docker

Docker 镜像会构建网页，并启动同时提供静态资源、前端路由、公开 API、Streamable HTTP MCP、流式 AI 解读和模型列表的 Node 服务。官方 `aov.cc` 的整站请求由 RNG 上的该服务处理，排盘与 MCP 不受 Pages Function 的 CPU 配额约束。

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

官方站点在 Node 环境中设置：

```text
MINGYU_API_PRESET=online
MINGYU_MCP_PRESET=online
MINGYU_PUBLIC_ORIGIN=https://aov.cc
```

`MINGYU_PUBLIC_ORIGIN` 让 API 元数据和发现 URL 使用公共站点地址，不采信客户端的 forwarded URL。其他自部署站点可以替换为自己的域名；留空时使用请求 origin。两个 preset 独立控制 REST 与 HTTP MCP，默认均为 `full`。官方 online 预设保留四柱反推、黄历、奇门终身和紫微分页范围限制，以及 MCP JSON-RPC batch 拒绝与通知空 `202` 响应。`/sse` 返回现代 `/mcp` 入口提示。

正式整站配置位于 `deploy/rng/`。容器仅绑定宿主机回环端口，Nginx 为 `aov.cc` 提供 HTTPS 并转发全部路径；代理须保留响应状态、响应头和 SSE 流。按模板配置已验证的镜像、证书及本地环境文件后启动：

```bash
docker compose -f deploy/rng/docker-compose.yml up -d
```

内置 AI 的密钥、模型、限流与页面运行时配置由同一 Node 服务读取。真实密钥保存在部署主机的受限环境文件中，不进入镜像、仓库或日志。

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

Node/Docker 的部署环境可使用以下 AI 配置；可选 Pages 自部署在 Production 环境中配置相同变量：

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

服务端会按客户端地址限制内置 AI 调用频率，并对内置 AI 上游的网络异常、408、429 和 5xx 临时错误自动重试 2 次；鉴权失败和模型名错误不会重试。这只适用于内置 AI 上游调用，不会重试 REST/MCP 排盘请求。Cloudflare Pages 会自动使用平台提供的客户端地址；Docker 直接暴露端口时使用连接地址，只有位于可信反向代理后才设置 `AI_TRUST_PROXY=true`。

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
