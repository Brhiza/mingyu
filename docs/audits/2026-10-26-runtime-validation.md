# 第二阶段：安装、构建与真实运行验证

日期：2026-10-26。代码基线仍为 `6d0aaa10730ad156bb73a053a6e04b67b26d8c91`。

本文是修复前第二阶段证据快照。后续用户已要求并实施修复，当前验收见 [修复记录](2026-10-26-remediation.md)；不要把下面断言问题仍存在的探针作为修复后正确性测试。

用户要求继续深入，并明确允许安装、构建。本阶段已经实际安装锁定依赖，构建核心/Web/Node/MCP/Pages/Android，执行完整回归、独立发布包消费、真实协议探针及一个生产页面交互。主报告为 [维护复杂度系统排查报告](2026-10-26-maintainability-review.md)。

没有修改运行源码、依赖锁文件、配置或正式测试。新增探针和日志留在被忽略的 `.local/audits/2026-10-26-runtime/`，依赖及构建产物保留在各自忽略目录，文档留在 `docs/audits/`；没有提交、发布或访问线上模型。

## 1. 本阶段结论

上一阶段的主要判断得到运行证据支持：重复请求解释已经产生协议和提示词内部矛盾；主题多状态已在浏览器复现；错误映射丢失真实类型；输出模式的两层实现产生很大的默认差异；取消任务的所有权不一致；出生资料确实反复规范化。

新增两项 P2：

- F12：窄输入校验经 calendar 聚合入口加载星盘引擎与内嵌星历数据。
- F13：server/工程脚本/部分构建配置没有进入类型门禁，已有性能基准因旧字段静默测错路径。

另在 F10 的验证链发现真实工具兼容缺陷：包检查将 `npm_execpath` 一律作为 JavaScript 交给 Node，而当前 pnpm 11.9.0 是原生可执行文件。正常 `pnpm package:check` 因此失败；相同版本 JavaScript pnpm 入口下契约检查通过。它是验证工具的启动器耦合，不能解释成核心发布包坏了，也不能把替代运行成功写成正常命令已通过。

总问题清单由 11 项增至 **13 项，2 项 P1、11 项 P2**。没有增加“全面重写算法”的证据。独立真值、分页计算预算、时区和随机重放测试有实际价值；本阶段不支持按数量批量删测试。

## 2. 实际验证完成情况

主要环境：Node `v24.21.0`、pnpm `11.9.0`、macOS arm64。Pages 的 dlx 临时安装子过程另记录 `pnpm v12.11.2`；主要环境版本不代表每个下载子过程都使用 11.9.0。另安装 Node `v22.23.4`，以 CI 同系列运行时验证构建产物及隔离包消费；没有在 22 重构建项目各目标或重跑全量回归，也没有切换用户默认 Node。Android 使用现有 OpenJDK 21 和 SDK，下载了工程指定 Gradle。没有 Docker 命令，因此没有执行容器镜像构建。

| 验证 | 实际结果 | 说明 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 通过 | 3 个 workspace，437 个依赖包，锁文件未变 |
| `pnpm core:build` | 通过 | 生成必要数据、TypeScript、ESM 后处理；588 JS 文件 |
| app/node/MCP 类型检查 | 通过 | 按现有三个门禁执行；覆盖盲区另列 F13 |
| `pnpm lint` | 通过，0 error、3 warning | 两条 fast-refresh 导出警告，一条 useMemo 冗余依赖警告 |
| `pnpm format:check` | 通过 | 未自动格式化运行源码 |
| `pnpm test:ci:run` 最终重跑 | **4085/4085 通过** | 日常、集成、API、MCP；0 skip/cancel |
| `pnpm test:exhaustive:run` | **9/9 通过** | 含跨世纪与大量组合，9 为顶层 test 数，不是所有样本数 |
| `pnpm prompt:audit:run` | 通过 | 全部提示词及文字/数理事实审计 |
| Web、Node、MCP Vite 构建 | 全部通过 | 直接消费已经构建的核心，避免审计时并发清理 dist |
| Pages discovery + Functions 构建/体积 | 通过 | Wrangler 成功编译，体积结果见下表 |
| 构建后 Node 整站检查 | 通过 | Node 24、Node 22 均通过；不是 Docker 容器运行 |
| MCP tarball 隔离安装运行 | 通过 | Node 24、Node 22 均通过，initialize/list/call |
| Vite/Webpack 浏览器消费契约 | 通过 | 面向浏览器打包，随后在 Node 中导入执行；不是 GUI 测试 |
| 正常 `pnpm package:check` | **失败** | pnpm 原生入口被 Node 当 JS 解析，错误证据保留 |
| 同版本 JS pnpm 下核心包契约 | 通过 | Node 24、Node 22 均通过；未改 package.json 或检查脚本 |
| Android `cap sync` | 通过 | 两个受控 generated Gradle 文件内容未变 |
| Android JVM + debug APK | **8/8 JVM 用例、APK 构建通过** | 7 个自有插件用例、1 个模板；未跑设备仪器测试、未签名发布 |
| REST/MCP 实际协议探针 | 32 样本、68 观测断言通过 | 真实包、handler、InMemory SDK，无线上请求 |
| Worker 取消探针 | 3 个有限用例完成 | 真实 cache/工厂/handler，门控 fake Worker；不声称浏览器暂停点击 |
| 生产页面主题切换 | 已复现 | 实际 React 事件、URL 与渲染文本；详见第 4 节 |

首次全量回归为 4084 pass / 1 fail。唯一失败是本次新增审计文档的正则示例被现有 Markdown 链接正则误识别。已调整自己的文档示例，单文件复核通过，并**完整重跑 4085 全过**。这不是基线业务回归。

首次直接 `node scripts/test-package-tarballs.mjs` 被脚本要求 pnpm 环境的前置检查拒绝，是审计命令选择问题；随后走正式 pnpm 入口才暴露原生启动器兼容问题。两次失败没有删除或混入成功统计。

## 3. 构建成本、体积和基准

耗时为本机单次运行，部分独立门禁并发，包含冷缓存和下载影响。RSS 为每个测量包装器的 Darwin `RUSAGE_CHILDREN` 最大值，不是并发总内存，也不是容器配额建议。不能据这些数直接推算重构收益。

| 工作 | 耗时 | 最大子进程 RSS |
| --- | ---: | ---: |
| 核心构建 | 8.96 秒 | 853 MiB |
| Web 构建 | 20.75 秒 | 3730 MiB |
| Node 构建 | 4.98 秒 | 1318 MiB |
| MCP 构建 | 5.30 秒 | 1299 MiB |
| 现有三组类型检查 | 16.67 秒 | 1047 MiB |
| lint | 43.51 秒 | 3499 MiB |
| 最终完整回归 | 275.27 秒 | 467 MiB |
| 穷举 | 98.65 秒 | 454 MiB |
| Android debug 测试/构建 | 211.72 秒 | 1444 MiB |

核心构建是清理、生成、`tsc --force`、后处理完整路径；Dockerfile 的重复调用成本已有实测参照，但没有执行容器构建，不能声称 Docker 实测节省了 9 秒。

| 产物或预算 | 实测 | 意义 |
| --- | ---: | --- |
| 核心 tarball | 4,824,752 / 5,000,000 字节 | 总预算 96.5%，余量 175,248 字节 |
| 核心代码压缩分项 | 2,470,150 / 2,650,000 字节 | 93.2%；分项压缩值不能直接相加等同总包 |
| 完整客户端独立消费示例 JS | 4,519,077 / 4,600,000 字节 | 98.2%，余量 80,923 字节 |
| 完整客户端示例 gzip JS | 1,658,731 字节 | 独立 consumer，不是网站首屏 |
| 生肖子路径示例 JS | 265,472 / 300,000 字节 | 按需路径仍明显小于完整客户端 |
| Pages Functions 未压缩 JS | 22,732,877 / 26,214,400 字节 | 约 86.7%，25 MiB 门禁通过 |
| Web 全部 JS | 31,940,654 字节 | 包含多个 Worker，不代表首次访问下载量 |
| Node 全部 JS | 14,583,728 字节 | SSR entry 约 10.16 MB，另有分块 |
| MCP 全部 JS | 14,549,856 字节 | bundled entry 约 10.13 MB，不能和核心 npm 压缩预算混比 |
| Android debug APK | 19,553,403 字节 | 调试产物；未构建并签名正式 release，不代表设备内存 |

Web 构建报告三类“动态导入但已有静态消费者”警告：大六壬、小六壬、classics。不把警告本身计为新问题；它说明这些动态路径不会独立形成预期分块，应沿真实首屏请求与 Worker 成本判断，不能仅凭 `import()` 宣称已按需加载。

### 性能基准的实际边界

现有 benchmark 命令成功退出，但黄历 30 天样本为 WARN：首轮平均 885 ms / P95 1353 ms，预算 350 ms。其他批量工作结束后，以相同输入、3 次预热/10 次取样有限复测，平均 **649 ms / P95 740 ms**，仍高于预算。它是本机预算偏差，不是前后版本性能退化证据；现有脚本把超预算标为 WARN，仍 exit 0。

现有“奇门终身局全流水线/太岁扫描”的 P95 9.81 ms 不能当作动态扫描性能，因为样本没有进入扫描。真实包对照：旧输入无事件簇；补正确单年 periodRange 后有 6 簇和 6 条动态事实。此项支撑 F13，后续应先修工作量有效性再重定预算。

## 4. 原问题的运行证据升级

### F01：范围优先级与提示词内部矛盾

使用固定出生资料、`scopeDate=2026-10-26`、`scopeHourIndex=4`，通过 REST 真实 handler 和 MCP SDK InMemoryTransport 分别执行冲突、scope-only、promptScope-only。

同传 `scope: yearly`、`promptScope: origin`：

- REST HTTP 200，`scopeNames=[origin]`，分析背景/对象是本命。
- MCP 成功，`scopeNames=[origin,yearly]`，背景/对象是流年，目标时点正确。
- REST 同一提示词内部同时写“分析范围：本命”和“解读选择 → 分析范围：流年/年计”。这使单个输出本身也不自洽。
- 只传一个字段时两入口结果对齐，6 个样本均保留原问题，排除输入错误造成的假差异。

### F02：真实生产页面复现

通过真实 `buildChartRecordPath` 生成出生样本，打开生产 Node 的 `/result/assistant`，源为八字紫微合参、旧快捷方式为事业、范围为本命。

1. 在实际“解读主题”控件选择事业。页面显示事业，URL 同时有 `btid=career` 和 `ztid=career`。
2. 在实际“输入问题”文本框填写“审计自定义问题：请重点看家庭沟通。”。
3. 快捷方式变为自定义，八字主题/preset 被清理；URL 仍保留 `ztid=career`。
4. 页面主题仍显示事业，生成的 `【解读选择】` 仍为事业，任务继续“围绕事业展开”，最后问题则已变成家庭沟通。

这是实际事件、地址和渲染文本证据，不再只是 patch 对象推演。浏览器工具曾有 locator/快照与视口不一致，正常点击超时后使用截图定位、随后对已观察控件执行原生 DOM click；问题输入使用正常 fill。没有直接修改 React 状态或查询参数模拟动作。部分 screenshot 与 DOM 状态出现不一致，因此正式结论依据稳定的一轮事件、URL 和 DOM 文本观测，未把失配图片当作故障证据。Worker 暂停没有在浏览器中点击复现。

### F03：真实 safe 客户端与实际工具调用

- `client.safe` 的两条真实八宅输入错误依旧是 `CORE_EXECUTION_FAILED / calculation / recoverable=false`；缺出生资料对照正确为 validation。
- 单牌 `replay:[0.5]` 核心抛 `RANDOM_REPLAY_EXHAUSTED / validation / field=replay`；实际 `divine_tarot`、`tarot_prompt` 经 SDK 调用变为 `MCP_TOOL_ERROR` 并丢失类型/字段。
- 实际 `bazi_prompt fortuneBatch.startIndex=10000` 返回 `RESOURCE_LIMIT / retryable=true`，仍建议缩短日期范围，未准确指导游标修正。

### F04：两层 compact 的实测矩阵

下表只计 JSON 盘面 UTF-8 字节，排除 HTTP/MCP 封装、计时元数据和提示词。

| 系统 | REST 省略 | REST 显式 compact | MCP 省略/显式 compact | 两端 full |
| --- | ---: | ---: | ---: | ---: |
| 八字 | 69,338 | 5,259 | 69,338 | 129,824 |
| 紫微 | 354,969 | 6,755 | 354,969 | 422,059 |
| 奇门 | 32,475 | 14,403 | 32,475 | 260,229 |

MCP 自己的省略与 compact 一致，并且等于 REST 的省略路径；不能描述为所有协议都默认失效。REST 显式 compact 才执行额外领域投影。full 的两端 JSON payload 完全相同，共有四柱、宫位/四化、九宫等事实跨模式保持一致；没有发现基础排盘算法分叉。

### F05：真实 Bundle 调用计数

在新进程里仅对 dist 模块加载结果注入计数器，没有改磁盘源码/产物，也没有用该探针计时。

| 请求 | `normalizeBirthProfile` | `validateBirthProfileTimeRange` |
| --- | ---: | ---: |
| 单点八字 | 2 | 0 |
| 单点四体系 | 5 | 0 |
| 3 秒区间、八字、同批 3 样本 | 10 | 4 |

区间计数是起点一次加每样本重复校验/适配累计。不能把次数直接换算为等比例性能收益；它确认同次请求内部存在重复前置工作。

### F08：真实 cache/工厂/handler 的有限取消验证

探针只门控 Worker 调度，计算调用现有 handler 和 core；另用有限 React primitive dispatcher 执行真实 hook/effect，不模拟完整 React 调度和 DOM。

- 同 key A/B 共用 Promise。A 注册一个 abort listener，B 注册零个。B 取消后 Worker 不终止，B 最终仍 fulfilled。
- A 取消后未取消的 B 也收到 AbortError。首请求决定任务所有权，与独立消费者取消预期不一致。
- 实际完整阅读/custom effect 在 `rangePaused=true` 仍启动。`cancelZiwei` 和 effect cleanup 不终止它们；完整资料最终生成 14,617 字符并缓存；custom cleanup 后还继续启动下一层 yearly Worker。
- 反证：清理后的局部状态回写为 0；旧 finally 没有删除立即重启的新 pending，跨角色 key/title 也正确。不能称已发现缓存污染。
- 6 个 Worker 最终全部终止，所有 globals/timers/listeners 清理，未测浏览器 CPU。

### F09：真实代理和客户端串联

正常 tsx、真实已安装 Capacitor、真实 proxy 和 `streamAiChat` 串联；只 mock 网络传输，不用上轮内存 TS loader。

上游“有效正文 + 损坏 JSON + DONE”，最终观察为正文“半段正文”、done=1、errors=[]、上游调用一次。证明代理丢失损坏事件后，真实客户端把剩余流视为成功。本轮未触发真实模型请求或浏览器历史保存。

### F11：测试深入后的必要复杂度

四份辅助 `.cases.ts` 均被父测试副作用 import，真实参与注册；不能判漏跑。问题在于应用状态/布局 case 被归进核心入口，且单独 patch/SSR helper 测试不能覆盖合参状态组合。

奇门 formatter 审计局部共用生产格式化器，但另有固定字面盘面、删条件/换宫的负例。八字分页也有精确交运时间真值、禁止读取批外年份的 getter 和确保不偷算全量的计数探针。它们分别保护不同契约，不支持因为“看起来重复”就批量删除。

## 5. 新增问题与最小收敛

### F12：窄输入校验经 calendar 加载星盘引擎与内嵌星历，P2

链路：`profile/input.ts:1` → `calendar/index.ts` 聚合月相/天文事实 → `astrology/engine.ts` 静态星历/四小行星数据 → 顶层 `new Engine`。真实内部基础消费者只需要日期校验、常量或民用时间，却穿越整个聚合入口。

新进程记录实际 load URL：calendar 只调用 clock validator 为 77 个，公开 profile/input 校验日期为 78 个；同一 date-validation 叶模块为 2 个。前两者均加载星盘引擎、Caelus、embedded data、4 小行星包。计数包括加载模块 URL，不是文件大小或故障数量。

最小改动为内部直接引用既有叶模块，保留公开 calendar 聚合；外部窄入口如有需要再增加合法 exports。退出条件为公开 profile/input 新进程不加载星盘运行模块，输入校验/foundation/皇极及公开 calendar 输出不变。`sideEffects:false` 允许浏览器 tree-shaking，不能用 Node 结果声称 Web 一定多下载相同数据。

### F13：工程类型门禁遗漏使基准静默失效，P2

四个实际 `tsc --listFilesOnly` 闭包都没有 server/docker-server.ts、scripts/benchmark-core.ts、discovery/prompt-audit 脚本、vite.server/vite.mcp 配置。node 项只显式包含 vite.config.ts 及其 import；配置中的 SSR 入口字符串不会把对应 TS 纳入类型检查。

旧 benchmark 顶层 `longitude/dynamicRange` 与正式 `QimenLifetimeInput` 的 `location.longitude/periodRange` 不符，当前门禁未检查该文件。四项目文件闭包枚举只确认纳入范围，不执行语义诊断。真实函数只在 periodRange 存在时扫描，所以命令成功、P95 显示 PASS 的路径实际上没有动态扫描。

最小收敛：明确 server、工程脚本及全部构建配置的类型项目；基准样本用正式类型，并在预热计时前检查工作量确实产生。退出条件是旧参数能被 typecheck 拒绝、正确动态场景存在事件簇后再测预算。不要把构建转译成功视为工程 TS 已类型检查，也不要新增一套通用测试框架。

## 6. 更新后的实施顺序

1. **先修验证可信度与窄依赖。** F13 的工程类型入口和基准工作量检查；F10 的 pnpm runner 兼容；F12 的内部叶模块引用。它们范围有限，能让后续衡量可靠，不要求重写算法。
2. **再收敛实际业务配置。** F01/F02/F04 单一请求计划与 selection/effective mode，明确旧字段冲突政策。真实协议和浏览器用例可作为验收。
3. **整理错误与异步所有权。** F03/F08/F09 的类型化错误、共享 pending 取消约定、流终态，保持外部协议。
4. **局部消除重复维护点。** F07 规则荐干共置、F05 规范化复用；F06 展示/来源分离按算法风险逐项迁移。
5. **最后调整构建和测试职责。** F10 同源码只编译一次、F11 源码与发布包验证边界，再做大文件拆分和纯配置叶模块。

此顺序将验证盲区前置；不因为 4085 全过就忽略已复现的组合问题，也不因少数问题否定有独立真值的算法测试。

## 7. 复现、产物与尚未验证的范围

本地主要命令和原始证据在 `.local/audits/2026-10-26-runtime/`：

- `run_check.py` 与每项同名 `.json/.log`：退出码、时间、内存；`run-summary.json` 汇总。
- `protocol-probes.ts/.json`：32 样本/68 观测断言。
- `worker-probes.ts/.json`：3 取消用例与可达范围输入。
- `dependency-and-count-probes.mjs/.json`：模块加载与重复规范化。
- `ai-stream-probe.ts/.json`：真实 proxy/client 串联。
- `browser-theme-evidence.json`、`ui-fixture.ts/.json`：页面步骤、渲染文本和样本生成。
- `type-coverage-evidence.json`、`benchmark-semantic-probe.mjs/.json`：实际类型闭包与有效工作量。

这些探针断言的是现有问题仍可观察到，不能把“观测断言全过”写成系统已经修复。迁移完成后应转为正确行为回归。

没有做：线上付费/模型调用、Docker 镜像构建、真实 Android 设备/仪器测试、签名 release、外部 npm 使用统计、全部算法逐行校勘、Node 18/其他操作系统兼容性。Node 22 执行了 verify-docker-runtime、verify-mcp-package-runtime 和 test-package-tarballs 三项，包含以该 Node 启动的被测子进程，以及核心包消费者的类型检查/Vite 示例构建；没有在 22 重构建项目各目标，也没有跑 4085/穷举/GUI/独立 Vite+Webpack 契约脚本。完整 4085 回归运行于 Node 24。

浏览器只验证一条具体主题转换，不声称所有界面均通过。取消用例是实际控制层加有限宿主，非真实页面暂停点击。所有体积、耗时和内存只作当前机器基线，不代表生产容量或已获得的重构收益。

不依赖本地忽略脚本的构建/门禁命令、F01/F13 自包含样例和 F02 页面步骤见 [复现方法第 7 节](2026-10-26-reproduction.md#7-第二阶段构建与重点问题复现)。本次启动的两个本地页面服务已经停止。

文档收尾再次执行了本文链接到的 F01/F12/F13 自包含片段，均退出 0，观测分别保持范围分叉、77/78/2 模块加载与无扫描/6 簇对照；日志为 document-f01/f12/f13-repro.log。五份文档的本地路径/行号/标题锚点与空白检查通过，skill-mirrors 定向检查 2/2 通过。
