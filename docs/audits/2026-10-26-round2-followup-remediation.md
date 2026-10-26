# 第二轮维护优化：提交前深入复核与补修

日期：2026-10-26。用户在两批修复后要求“继续深入并修复，然后提交到pr，不合并”。本次沿 [第二批记录](2026-10-26-round2-batch2-remediation.md) 保留的动态阅读、聊天请求和住宅消费者继续纵向核对；第一批和第二批实现一起进入 `codex/maintainability-round2`，不覆盖此前改动。分支直接基于已 squash 合并的 `origin/main`（`afcafecf59a5de3d7178458420e4f40112f7bece`），与原实施基线 tree 相同，避免重新带入上一 PR 的提交历史。

## 1. 取消后晚到的补算资料不得进入会话缓存

`reading-workflow.ts` 中自动读取 schema 的路径，在 `execute` 返回后先写入 memory 再检查取消；普通执行路径只对带 `dispose` 的结果先检查取消。没有回收方法的 schema、计算结果或经典资料可能在用户停止后仍进入缓存。带回收方法的自动 schema 还可能失去回收所有权。

修复在两条执行路径的提交之前统一检查取消；晚到资源按实际 dispose 身份回收一次，仍由已缓存资源持有的回收方法保持。未取消时从返回到提交不额外等待，不增加新的异步窗口。取消前已经成功提交的资料仍保留，重试只补未取得部分。

新增有界 deferred execute 回归，覆盖自动 schema、显式 schema、calculate、classic 四条路径与有/无 dispose 两种结果；先等待真实执行开始，再 abort，再让 Promise 返回。取消不得写入 resources/schemas、不得继续正文或发送完成通知，晚到自有资源只回收一次。旧测试中把“先 abort 再 return”误称为取消前取得的场景已改为真实先提交成功、再取消后续待执行资源，保留其原缓存契约。

## 2. 住宅阅读资源必须到达聊天消费者

住宅 owner 已生成统一结果及阅读资源，但页面把 `readingResourceSeed` 绑定在 `workflowPrompt.trim()` 上；住宅没有对应 workflowPrompt 分支，因此实际聊天消费者收不到刚构造的资源。此前对象身份测试只覆盖 builder，未覆盖页面交接和面板就绪条件。

本次给住宅增加专用短 workflowPrompt，沿用已有 seed 交接条件，并明确要求住宅结构化资源齐备；有效结果由同一 owner 的资源供给，无效草稿没有 prompt/seed，不能开始 AI。没有向其他普通排盘无条件透传紫微资源。新增入口回归执行页面真实 workflow、seed 和 JSX 条件，并渲染实际 AiChatPanel 的就绪状态，覆盖年度、静态、无效及其他来源；原六项 owner 与新增入口共 **7/7 通过**。生产 workflow、required、readiness、经典开关和历史按 subjectId/key 恢复的完整交接经另一审查者复核，无剩余范围内阻断。

## 3. 进一步核对的边界

- 动态 v1/v2 继续保留：多来源 identity 包含各来源 target、主体、范围和问题，补充资料内容也进入 identity。真实 replay 的默认 scope/date 已与 source key 使用的有效值一致，未找到默认值导致的恢复漂移；没有把该候选当作新缺陷。
- 动态 answer 和 synopsis 成功后才返回检查点，工作流提交前另查取消；未找到该路径取消后推进页码的具体缺口。
- 住宅同值 replace 不形成持续提交循环，出生对象引用变化本身不写 URL。自提交 transition 与下一次输入的竞争尚未得到真实运行证据，保留为观察，不扩大实现。
- 聊天请求时间锚补测实际 `useAiChat` 的回调与 refs，新增三项覆盖 analyze/ask 新锚、跨年 retry 复用、restore/reset 清锚，以及取消后旧 SSE 返回不污染新会话。含旧契约共 **13/13 通过**，另在与 CI 一致的 Node **22.23.4** 上 **13/13 通过**；使用内存 fetch/SSE 和假时钟，不连接模型。局部有界宿主只验证真实 callbacks/refs，未挂载 DOM、不模拟 React 调度或 StrictMode，不引入生产测试注入或新的测试框架。

## 4. 验证与提交记录

本次只重新运行有新增代码、入口回归或构建依赖的门禁。核心实现自第二批验证后未改，2133 项源码回归及 75 exports 的真实包检查作为已完成证据继续有效；前批 Android JVM、流 token fixture 和离线 debug 结果保留，不冒充新的真机测试。

取消边界定向 `ai-reading-workflow` 与 `ai-reading-resource-lifecycle` 共 **66/66 通过**，0 fail/skip/cancel；冻结后只读交叉审查无剩余范围内阻断。新增八种 deferred 路径全部通过，已缓存资源只在显式结束时回收，晚到资源即时回收且不再次进入 memory。修前红测已证实自动 schema（有/无 dispose）、显式 schema/calculate/classic（无 dispose）会违规提交；未删除取消前成功缓存的真值断言。

最终冻结后的集成结果：

| 检查 | 结果 |
| --- | --- |
| 应用与编译后契约分区 | **2796/2796 通过**，0 fail/skip/cancel，约 205.1 秒 |
| 应用、工程与 MCP 类型 | 通过 |
| lint / 全库格式 / 新 runner 与 CSS 格式 | 通过；lint 为 0 error、3 条既有 warning |
| Web 与 Pages 静态发现构建 | 通过 |
| Node server 构建与独立运行时 | 通过；静态资源、SPA 回退、请求方法、MCP 及代表领域 API 实调 |
| 核心源码与包验证 | 沿用此前未再改动的 2133/2133 源码回归及真实 tarball、声明/75 exports、可选依赖缺省、浏览器消费结果 |
| 文件分区覆盖 | 核心 231、应用 306、交集 55、省略 176、并集 482，完整覆盖旧全量文件集合 |
| 交叉审查 | 本轮取消提交与住宅 consumer 两项均无剩余范围内阻断 |

上述定向与分区有重叠，不相加为独立测试总数。未重跑完整算法穷举，未将历史构建数字冒充本次执行。本次浏览器仍受到空值输入/滚动工具限制，未宣称关闭第二批记录的键盘清空 GUI 待验项；住宅 consumer 补修由真实页面表达式和 AiChatPanel SSR 验证，未调用真实模型。

限定证据放在 `.local/audits/2026-10-26-round2-followup/`，包含 `ai-cancel-late-red.log`、`ai-cancel-late-green.log`、`residential-consumer-tests.log`、`chat-hook-target-tests.log`、`chat-hook-node22-tests.log`、`final-application-partition.log`、`final-typecheck.log`、`final-style-gates.log` 和 `production-builds.log`。不使用真实密钥、不修改用户历史；保留 4174、4176 预览及用户旧页面。用户本次明确授权提交和 PR，未授权合并，PR 保持打开。
