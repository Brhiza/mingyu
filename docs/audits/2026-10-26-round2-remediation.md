# 第二轮维护复杂度修复记录：第一批

日期：2026-10-26。实现基线为 `ecca9eb70f607b3cb7748656414b54af5e636124`，与已合并 `main` 的 `afcafecf59a5de3d7178458420e4f40112f7bece` 同树。用户在 [第二轮审计报告](2026-10-26-round2-maintainability-review.md) 后要求“继续优化”，本批按报告第一批顺序实施 **R2-03、R2-02、R2-08、R2-05、R2-07**。

本记录描述第一批验收时尚未提交的工作区改动。其余七项不计为本批已修；用户随后要求“继续深入并优化”，后续实施与验收另见 [第二批修复记录](2026-10-26-round2-batch2-remediation.md)；继续深入修复及提交 PR 的最终记录见 [提交前复核](2026-10-26-round2-followup-remediation.md)。没有修改算法规则、锁文件、npm 版本或公开 exports；新增 Android JVM 测试依赖属于测试配置。

## 1. 本批修复

### R2-03：用结构化资料可用性替换合参文案反推

[核心 synthesis](../../packages/core/src/synthesis/index.ts) 内部保存八类事实的 `available / checked-empty / missing` 状态，主题缺口据此判断；不再扫描 `detail` 是否含“未记录/未登记”。这些状态为私有实现，公开合参结果没有新增字段。

旺衰和格局使用重建后的本命事实状态；用神直接检查结构化结果及正式裁决状态，保留“部分判定/待判仍可提供完整合参资料”的既有语义。交叉审阅补充了只有 `decisionEvidence.balanceAdjustment` 说明、没有取用结果的反例，避免间接沿用格式化正文的 truthiness。柱间关系为空只有在覆盖事实明确核查后才视为可用，缺核查仍登记缺口。交运、交节和流年唯一性判断继续沿用。

[新增回归](../../tests/integration/core-bazi-ziwei-synthesis.test.ts) 对“局部细节未知/未记录/未登记”逐一验证：本命事实仍已记录，合参完整结果仅允许展示附注变化。另覆盖已核查空关系、缺少覆盖记录、缺基础字段及只有说明没有取用结果。

### R2-02：合参任务消费实际范围、日期和时辰

[页面 helper](../../src/pages/ResultPage/ResultPage.helpers.ts) 不再从中文摘要识别“大运/流年/流月”。[生产调用](../../src/pages/ResultPage/index.tsx) 直接传入八字规范 scope、真实 `FortuneSelectionContext`、紫微选中 payload 的 scope/日期，以及 [计算 hook](../../src/pages/ResultPage/hooks/useZiweiCalculations.ts) 实际使用的固定 hourIndex。

共同参考判断要求同级范围且紫微参考时辰完整落入八字已列的真实半开区间。年/月/日使用已按交运、交节裁剪的区间，早子和晚子分别保留一小时。参考时辰跨界、日期不符、资料不足和 full 多层不能直接判为共同窗口，继续分述。

任务措辞明确“共同参考日期、保留各自起止边界、只在重叠时段交叉印证”。[共享 guidance](../../packages/core/src/prompt/guidance.ts) 同样保留边界，避免把节气月和紫微月当作同一期间。摘要与年龄标签继续展示，不参与分派。

[helper 回归](../../tests/result-page-helpers.test.ts) 使用真实流年/月/日上下文，验证改标签不改任务、同级异日期、节气月中点、交节时辰、早晚子时与资料缺失；[集成测试](../../tests/integration/result-page-prompts.test.ts) 明确传入不同结构层级，继续保护保守分述。

### R2-08：补全公开发现契约，保留旧模板

[API handler](../../src/lib/public-api/handler.ts) 为梅花提供窄 `MeihuaRequest / MeihuaPromptRequest`，覆盖七种既有起法及九个漏报的顶层字段，并排除其他体系专用字段。运行时输入读取和计算没有改动。

六爻、梅花、小六壬、奇门、大六壬、黄历各增加具体提示词路径声明，用显式路径能力映射暴露 `includeClassics`；原 `/divination/{method}/prompt` 模板、枚举和旧 URL 保留。没有向不支持经典的模板方法宣称新能力，也没有改 R2-09 的文化 `responseMode` 行为。

[目录契约测试](../../tests/api/contract-consistency.test.ts) 展开实际模板方法后双向比较 manifest，并从实际 OpenAPI 响应和 Pages 静态发现产物核验输入位置、枚举与六个开关。[经典回归](../../tests/api/classical-prompt-options.test.ts) 使用具体方法执行真实请求，核对经典目录；黄历比较冻结时间，避免把两次生成的 timestamp 差异当作领域分叉。

### R2-05：稳定 AI 资源身份并兼容旧重放 key

[reading-workflow](../../src/lib/ai/reading-workflow.ts) 对成功 calculate 动作按完整输入递归稳定序列化：对象字段排序，数组顺序和所有值、target 保留。失败关联继续使用其原有 schema 投影，只共享序列化基础；没有把失败纠错身份误用为成功缓存身份。

已有资源的外部 key 不改写。从可恢复的 JSON action key 及 `resource.replay` 补充规范 seen 身份，恢复动作也能命中已可用的等价资源。旧 v2 checkpoint 可能引用字段重排后形成的两个普通补算 key；恢复时保留这些被引用的补充资料 key 和顺序，同时只执行一次等价补算，别名不持有 dispose。动态资源不做这类别名，避免重复来源或所有权。只有 opaque key 且没有任何可恢复 action 的旧资源，无法安全凭正文反推身份，仍保留原 key 行为。

[新增工作流回归](../../tests/ai-reading-workflow.test.ts) 覆盖同轮及追问字段重排、嵌套对象、数组顺序、日期/问题/目标区别、锁定输入和未声明字段拒绝，以及旧 JSON/opaque+replay key。主体锁定、资源所有权和 R2-04/R2-06 的生命周期未在本批扩改。

### R2-07：对齐原生与 Web 的流终态

[Android 插件](../../android/app/src/main/java/cc/aov/mingyu/AndroidDirectAiPlugin.java) 按完整 SSE 事件聚合多行 data，严格解析 JSON，先处理上游错误和 length，再转发正文；流只有明确 `[DONE]` 才正常完成，EOF 或坏 JSON 保留失败终态。交叉审阅发现 Android `JsonReader` 的非 lenient 模式仍接受部分非法 literal/数字，因此增加最小 token 词法约束，结构继续由 JSON reader 校验，并以非法/合法 token 的共享样本约束两种响应类型。

非流 JSON 兼容按 `application/json` 或 `application/*+json` 明确分支，不以“曾收到正文”猜测流已成功。HTTPS、requestId、取消、连接/读取/总超时保留。

[共享流 fixture](../../android/app/src/test/resources/ai-stream-fixtures.json) 和 [token fixture](../../android/app/src/test/resources/ai-json-token-fixtures.json) 被 [真实 Java reader 测试](../../android/app/src/test/java/cc/aov/mingyu/AndroidDirectAiPluginTest.java) 与 [TS 对照测试](../../tests/android-custom-ai.test.ts) 共同消费。五个审计流样本覆盖坏 JSON、缺 DONE、同帧 content+length、多行 data 和正常完成；JVM 另覆盖非流兼容、错误优先、取消和超时。`android-all` 仅为 testImplementation，供 JVM 使用真实 Android JSON 实现，不进入生产 APK。

## 2. 验证记录

各项定向验证完成后，使用一次 `pnpm build:prepare` 更新核心产物，再进行集成门禁。没有在主门禁中重复跑核心 231 文件全集来凑测试数。

| 验证 | 结果 |
| --- | --- |
| 合参页面 helper/集成/应用契约源码回归 | 最终 40/40 通过，补充自定义任务、真实交运裁剪和半开终点相等覆盖 |
| synthesis integration、range、natal evidence 源码回归 | 最终 33/33 通过，包含 decisionEvidence-only 反例及真实用神待判/部分判定对照 |
| OpenAPI/经典契约及限定 API 源码回归 | 28/28 通过 |
| AI workflow、dynamic replay、partner targets、dynamic collection、astrolabe dynamic | 最终 76/76 通过，含旧 v2 重复 supplemental key 的真实 JSON 历史恢复与页推进 |
| Web/Android 流对照 TS 目标回归 | 最终 57/57 通过，含 20 个非法和 17 个合法 token 对照 |
| 当前原生生产 Java reader JUnit | 最终 13/13 通过，0 skip；token fixture 在流/非流双路径合计 74 次样本 |
| 核心产物准备 | 通过；review 后核心已再次重建，73/73 受影响 dist 消费回归通过 |
| 应用/工程/MCP 类型检查 | 初轮与最终冻结后均通过 |
| 提示词事实审计 | 通过 |
| Web、Pages 静态发现和 Node server 构建 | 通过 |
| Android 离线 debug 构建 | 通过 |
| 仓库 lint / format | 通过；lint 有 3 条既有 warning |
| 完整 `test:ci:run` | 最终冻结后 4192/4192 通过，0 fail/skip/cancel，约 221.1 秒；已包含交叉审阅后的边界修正 |
| 新产物独立 Node HTTP 冒烟 | 通过：真实 OpenAPI、梅花声音起法经典提示词、assistant 路由及其哈希 JS |
| 五项交叉只读审查 | 全部闭环：发现并修正用神说明间接依赖、原生 JSON token 宽松、旧 v2 supplemental key 恢复三处边界，狭义复核均无阻断 |

定向计数和完整回归有重叠，不能相加为独立覆盖总数。一次并行编辑期间的类型检查读到旧 checkpoint helper 已声明但尚未接入的中间态，以 TS6133 退出；编辑冻结后应用/工程/MCP 类型检查通过。lint 的严格零 warning 局部试验先因旧 `useMemo` warning 退出；用 HEAD stdin 复核该条在改动前即存在，随后按项目正式门禁通过，没有关闭规则或抬高阈值。另两条为既有 Fast Refresh 导出 warning。

Web 构建仍报告部分聚合入口静态/动态导入重合及大 chunk 提示；本批未宣称解决 R2-10 或首屏体积。Android debug 复用现有 Capacitor Web assets，未执行 `cap sync`，因此是原生编译/打包验证，不代表 APK 已包含本次全部新 Web 页面产物。

## 3. 复现、证据和边界

主要门禁：

```bash
pnpm build:prepare
pnpm typecheck:run
pnpm test:ci:run
pnpm prompt:audit:run
pnpm build:run
pnpm build:server:run
pnpm lint
pnpm format:check
```

定向源码回归通过 `node scripts/run-core-source.mjs --test ...` 消费当前 core 源码，普通完整回归消费准备后的 dist；两者用途不同。Android 使用本机 Java 21 和已有 Gradle 缓存，离线执行目标 JUnit 与 `:app:assembleDebug`，无新下载/安装。

主审日志保存在忽略目录 `.local/audits/2026-10-26-round2-fixes/`：初轮 `full-regression.log`、最终冻结后的 `final-full-regression.log` 与 `final-gates.log`；另有 `prompt-timing-final-tests.log`、`synthesis-final-tests.log`、`final-synthesis-dist-tests.log`、`ai-identity-final-tests.log`、`native-final-jvm.log`、`native-final-ts.log`、`native-final-debug.log`、`final-prompt-fact-audit.log` 和 `final-server-smoke.log`。Java XML 位于 `android/app/build/test-results/testDebugUnitTest/`，最终副本 `native-stream-tests-final.xml` 保存在证据目录。分区定向结果另见本次会话输出，正文记录其命令口径与结果，不依赖本地日志才能理解修复。

没有新一轮 GUI、Android 真机、实际 TLS/服务商或真实模型调用；没有重跑算法穷举、发布包隔离安装或未涉及规则的专项全量。原 4174 预览进程保持运行；新服务端验证使用临时独立端口并只回收自身创建的进程，不把原预览后台误称为已热更新。

第一批完成时，R2-01、R2-04、R2-06、R2-09、R2-10、R2-11、R2-12 尚未实施；后续七项的实现和验证见 [第二批修复记录](2026-10-26-round2-batch2-remediation.md)。本记录的测试数字和边界仍对应第一批验收，不能代替第二批结果。
