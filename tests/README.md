# 测试分层

测试按发现问题的层次分开执行，避免每次修改都重复穿透所有适配器和全量组合。

- `pnpm test`：日常回归。运行 `tests/*.test.ts` 与 `tests/*.test.tsx`，覆盖核心业务分支、边界和已发生过的回归，最多同时执行两个文件。
- `pnpm test:core`：核心源码领域回归。由 `packages/core/scripts/run-core-tests.mjs` 按领域显式列出测试文件，不读取测试正文推断职责；新增领域测试需登记文件名。`mingyu-core` 导入从已有 exports 派生为源码路径，与相对路径和 `@core` 指向同一表示，无需构建 `dist`。`node packages/core/scripts/run-core-tests.mjs --list` 可查看范围。
- `pnpm package:check`、`pnpm package:check:mcp`：分别构建核心、MCP 后，在临时目录隔离安装真实 tarball 验证发布消费。浏览器打包契约另由 `pnpm test:browser-contract` 验证。
- `pnpm test:integration`：跨模块链路。覆盖需要真实组合多个计算模块或完整调用外部排盘引擎的场景。
- `pnpm test:api`：公开 API 和文档契约，测试位于 `tests/api/`。
- `pnpm test:mcp`：MCP 结构化输出契约，测试位于 `tests/mcp/`。
- `pnpm test:exhaustive`：跨世纪、全排列和大规模规则表，测试位于 `tests/exhaustive/`，算法或规则表改动时执行。
- `pnpm test:ci`：构建核心包并检查类型，然后统一执行日常、集成、API 和 MCP 测试；各文件保持进程隔离，最多同时执行两个文件。
- `pnpm test:all`：在 `test:ci` 基础上追加全部穷举测试。

CI 的 `type-check` 任务单独检查应用、MCP 和工程 TypeScript（服务端、全部 TS 脚本与 Vite 配置）；`test` 任务通过 `pnpm build:prepare` 构建一次核心包并准备源码数据，再运行 `pnpm test:core:run`、`pnpm test:ci:run` 与 `pnpm prompt:audit:run`。应用、HTTP/MCP、AI、布局与工程契约继续在根目录日常/全量命令中执行；`prompt-application-contract.test.ts` 承接原有应用 cases，`qimen-lifetime-consumers.test.ts` 承接原有 REST/MCP/导航契约，断言保持不变。

`test:unit:run`、`test:ci:run`、`package:check:run` 等产物消费命令要求核心包已与源码同步。`test:core` 与 `prompt:audit` 会先生成源码依赖的地点和星历数据，仅写源码数据，不清理或写入 `dist`；`test:core:run` 和 `prompt:audit:run` 要求先执行 `core:data:prepare` 或 `build:prepare`。两者共用源码解析启动器，每次创建独立临时配置并清理；一次事实审计使用同一核心源码表示，保留固定字面真值和变异负例。提示词事实审计仍在每次 CI 执行。

## 保留标准

一个测试至少应满足一项：保护真实业务契约；覆盖独立算法真值；复现曾经发生的缺陷；验证安全、输入边界或跨模块接口。相同规则只在最接近实现的一层详细验证，上层适配器只检查路由、参数转换和返回结构。

同一文件内对完全相同输入的只读重计算使用惰性夹具复用；MCP 业务用例复用同一测试服务连接。涉及全局配置、连接握手、进程生命周期或会修改返回对象的场景必须保持隔离，不能用共享状态换取表面提速。

同一规则族的表格测试集中在一个文件中，共享只读计算结果并保留各自的来源和失败定位；避免为每张小表重复启动进程、导入引擎和计算相同月日组合。已有文件能表达的业务回归直接加入该文件，不按修复批次创建新文件。

以下内容不单独保留为测试：与更完整用例完全重复的断言；只验证测试夹具本身的断言；仅搜索源码实现细节的断言；没有业务影响的内部排列或文案碎片。大量同构样本使用数据表循环，只有需要独立定位的业务分支才注册为独立测试。

## 穷举层准入

跨多年日期扫描、全排列、全部规则表和依赖外部排盘引擎的大样本校验放入 `tests/exhaustive/`。日常层必须保留至少一个代表性正常路径和直接相关的输入边界，确保基础回归不会因分层而消失。
