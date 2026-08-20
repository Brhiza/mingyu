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
| 历法与星盘 | `tyme4ts`、`iztro`、`celestine`           |
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

静态页面由 Pages 托管，`/api/v1/*` 由 Pages Functions 处理。

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
