# 第二轮维护复杂度审计报告

日期：2026-10-26。基线为已合并 PR #437 的 `main`：`afcafecf59a5de3d7178458420e4f40112f7bece`。审查工作区 HEAD 为 `ecca9eb70f607b3cb7748656414b54af5e636124`，两者树哈希均为 `a761f5b4c7665a952be235744656fbad9c393429`，因此本报告针对已合并后的实现。源码链接行号固定于该基线。

系统仍有值得简化的设计。本轮收敛为 **12 项：11 项 P2、1 项 P3**，其中 9 项有可复核的行为或输入输出分叉，2 项主要体现为依赖和重复验证成本，1 项为响应式表单业务规则重复。优先级表示维护顺序，不是安全漏洞等级；行为分叉也不一律等于已经发生用户可见故障。

主要负担依然来自**同一事实、同一结果或同一生命周期有多个实现者**。本轮最值得处理的是住宅盘结果的父子所有权、合参消费者从中文反推状态、AI 请求和资源的身份，以及接口声明与实际适配之间的分离。证据不支持整体重写算法、引入新的通用框架，或仅按大文件长度拆目录。

本报告保留审计阶段的诊断；该阶段只完成审查、限定探针和报告。用户随后要求“继续优化”和“继续深入并优化”，实现与验证分别见 [第一批修复记录](2026-10-26-round2-remediation.md)、[第二批修复记录](2026-10-26-round2-batch2-remediation.md) 和后续 [提交前深入复核](2026-10-26-round2-followup-remediation.md)。第二批 R2-06 统一行为契约，仍保留双执行器，结构收敛为部分完成。以下源码行号和问题描述以修复前基线为准，重构后可能移动，不应当作当前未修清单。配套文件为 [审计计划](2026-10-26-round2-plan.md)。上一轮 [诊断](2026-10-26-maintainability-review.md) 与 [13 项修复记录](2026-10-26-remediation.md) 用于排重，不能把其中修复前的描述当作当前行为。

## 1. 审计方法与证据边界

### 1.1 什么被计为问题

本报告要求同时说明实际消费者、责任重复或事实多源、具体维护成本、必要复杂度的反证，以及可以独立验收的最小简化范围。文件大小、分支数量、测试数量和公开导出数量只用于选样。

五个分区分别检查前端状态与展示、AI 生命周期与历史恢复、REST/MCP 公开契约、核心抽象与依赖、工程验证；主审另核对 Node、Pages、Vite 与 Android 边界。主审独立复核重点源码，并重复验证核心加载和合参状态探针。不是全仓逐行审计，也不是新一轮 GUI 验收。

证据在正文中明确分为三种：

- **行为证据**：调用真实 handler、工作流、计算函数或原生解析方法；模型返回、网络响应和时钟可由内存替身提供。
- **结构/加载证据**：静态职责及消费者检查，或新进程记录实际加载模块；不据此推算性能收益。
- **观察项**：有维护疑点，但当前功能偏差、收益或产品契约不足以支持正式问题。

### 1.2 验证背景与本轮新增验证

合并前同树代码已通过 GitHub Node 22 CI：核心源码测试 2131/2131、完整回归 4131/4131、提示词事实审计、类型检查和构建；Android debug 构建通过。它们说明当前基线可构建且既有回归通过，不能证明下面的组合边界不存在问题。

本轮没有再次安装依赖、做全量构建、运行全部算法测试或穷举。新增证据包括：

- 前端真实源码回调与真实计算对照：住宅年度/完整日期两个样例，以及同一结构化时间层的两种展示文本。
- 核心当前源码探针：独立进程加载计数、仅八字合盘实调、三种旺衰附注文案变异。
- AI 当前工作流内存探针：重复动作身份、跨年阶段重试、动态解读 v1/v2 追问；另完成历史序列化、规范化、恢复、重放与下一页续读正向对照。
- 接口本地探针：目录与实际注册对照、梅花起法、6 个经典开关、15 次 REST 模式请求与 9 次 MCP 注册回调。
- 同一组 5 个 SSE fixture 对照当前 Web 代理和未改动的 Java 原生解析方法。
- 有界既有回归：`tests/ai-proxy-stream.test.ts`、`tests/android-custom-ai.test.ts`、`tests/api/node-request-body.test.ts`，合计 **16/16 通过**。
- 工程 runner `--list` 与根 glob 集合对照，以及 TypeScript 值导入传递闭包分析；只列文件和解析依赖，不运行这些测试。

没有请求真实模型、使用真实密钥或联网验证服务商，没有修改用户历史。原生探针不是 Android 真机/Capacitor 生命周期测试；前端回调探针不是 React 调度或浏览器复现。测试通过、静态问题与限定行为分叉可以同时成立。

### 1.3 规模仅作为背景

以下为 `git ls-files` 选出的受控文件原始物理行，包含空行、注释和相应目录内的数据；不是有效逻辑行，不能与上一轮排除数据后的 ELOC 直接比较。

| 范围 | 受控文件 | 原始物理行 |
| --- | ---: | ---: |
| `src` | 268 | 100090 |
| `packages/core/src` | 590 | 206218 |
| `mcp/src` | 42 | 8441 |
| `scripts` | 25 | 9393 |
| `tests` | 498 | 167295 |
| `server` | 1 | 450 |
| `functions` | 5 | 210 |
| Android 主 Java 源码 | 6 | 1117 |

`src` 中四份主要 CSS 共 21489 行；核心最大文件是易林索引数据，25354 行。这些体量不构成删除依据。核心文献、字库、规则条目与 vendor 的正确性也不以“行数多”为缺陷。本轮据调用边而非体量选取问题。

## 2. 问题总表

| 编号 | 优先级 | 维护问题 | 最强证据 |
| --- | --- | --- | --- |
| R2-01 | P2 | 住宅结果由父子组件分别生产并相互回写 | 年度 URL 在两链得到不同计算输入和结果 |
| R2-02 | P2 | 合参任务从展示摘要反推时间层 | 只加“流年”前缀就改变对齐判断 |
| R2-03 | P2 | 合参丢掉事实状态后再从说明文案推断完整性 | 结构事实不变，附注措辞产生 7 项缺口 |
| R2-04 | P2 | AI 阶段生命周期平行实现，重试时间身份不同 | 跨年重试汇总混用旧阶段与新相对时间 |
| R2-05 | P2 | AI 成功去重与失败关联采用不同输入身份 | 相同动作字段重排后执行、保存、入上下文各两次 |
| R2-06 | P2 | 动态解读 v1/v2 都承担新会话执行 | 逐页阶段本轮追问只进入 v1；契约需明确 |
| R2-07 | P2 | Web 与 Android 各自判断 AI 流完成 | 相同坏帧/EOF/限长事件产生不同终态 |
| R2-08 | P2 | OpenAPI 通用字段包与路径推断掩盖实际能力 | 梅花漏报 3 起法/9 字段，6 路径漏报经典开关 |
| R2-09 | P2 | 三个文化提示词路由绕过已有模式适配 | REST 静默忽略模式，MCP 同能力正常切换 |
| R2-10 | P2 | 核心窄消费者经聚合入口加载无关体系 | 紫微焦点加载 227 个八字模块；合盘另增 174 模块 |
| R2-11 | P2 | CI 新增源码分轨后，完整回归仍重复包含其全体文件 | 231/231 文件重合，其中 176 个静态闭包仍指同源码 |
| R2-12 | P3 | 桌面/手机占问表单复制字段业务规则 | 同一 draft 的清洗、字数分派在两棵控件树重复 |

R2-01 至 R2-09 均有行为或输入输出差异；其中 R2-06 的分叉已证实，但允许怎样的逐页追问仍需形成一致契约。R2-10、R2-11 的成本有直接证据，未测量耗时收益。R2-12 说明变更触点重复，未证实当前两端算法结果错误。

## 3. 逐项证据、最小范围与验收

### R2-01：住宅结果的父子所有权重复

**生产链与重复职责。** [结果页 effect](../../src/pages/ResultPage/index.tsx#L912) 从 URL 拼接住宅输入并计算，保存 `residentialResult`；[回调](../../src/pages/ResultPage/index.tsx#L959) 又接受子组件计算结果并覆盖同一 state。[MetaphysicsPanel](../../src/components/MetaphysicsPanel/index.tsx#L248) 保存四个本地编辑值、用四个 effect 同步 props；[初始化](../../src/components/MetaphysicsPanel/index.tsx#L269) 计算一次，[延时 effect](../../src/components/MetaphysicsPanel/index.tsx#L328) 再在 250ms 后计算并回传。角度、房年、卦型和日期控件同时更新本地值与父回调，URL 又回流为 `initial*` props。

盘面消费子结果，提示词消费父结果。算法函数本身已共享，重复的是输入投影、计算触发、结果/错误所有权。新增一个参数或改变日期粒度，需要同时理解父 effect、子初始化、子延时计算和往返 props。

**已验证分叉。** 用固定合成出生资料分别执行当前源码中的父 effect 与子初始化回调：

| URL 的住宅参数 | 父输入/结果 | 子输入/结果 |
| --- | --- | --- |
| `bhd=0&rhy=2024&rfy=2020` | 保留 `flowYear:2020`，结果有 2020 年流星 | 日期投影为空，无 `flowYear`，结果无流星 |
| 再加 `rfm=2&rfd=10` | 完整日期 | 完整日期；完整结果 JSON 与父链一致 |

原因是父链独立接纳年/月/日，而 [传给子的日期](../../src/pages/ResultPage/index.tsx#L978) 缺任一部分就返回空字符串。仅年度链接由 [query-state 测试](../../tests/query-state-defaults.test.ts#L673) 明确保留。探针证明输入与结果分叉，没有模拟完整 React 时序，不能确定最终哪次回写生效，也不据此声称用户已看到错盘或性能下降。

**必要复杂度。** 数值编辑草稿、边界角度提示、防抖和首屏可渲染性都有用途；消除双计算不等于删除这些能力。

**最小简化。** 让上层持有一份规范住宅输入及对应结果、测量信息和错误；盘面与提示词共同消费。保留临时编辑草稿，但只有一个地方把草稿提交为计算输入。日期投影保留静态、年、年月、完整日期的粒度，不通过完整日期字符串往返丢信息。不引入全应用状态库。

**风险与验收。** 中等风险。核对静态、仅年度、年月、完整日期、URL 恢复、非法角度、下卦/替卦、出生年界；盘面与提示词必须对应相同结果身份。测试应覆盖实际共享结果链，而不只是分别证明两边可以渲染。

### R2-02：合参任务把中文摘要当作时间协议

**生产链与重复职责。** [合参 helper](../../src/pages/ResultPage/ResultPage.helpers.ts#L260) 用“大运/流年/流月/流日”等正则判断是否存在时间层，并凭相同词判为对齐。[真实页面调用](../../src/pages/ResultPage/index.tsx#L2109) 已持有 `baziPromptFortuneContext.scope` 和紫微 scope，却向 helper 传入 `displayText`、范围标签等展示摘要。任务规则因此依赖另一处 formatter 的措辞。

**已验证分叉。** 固定真实合成命盘，以 `buildFortuneSelectionContext` 生成 `scope:'year'`：

| 同一八字 scope 的摘要 | 搭配紫微流年摘要后的任务 |
| --- | --- |
| `2028年 戊申（39岁）` | 时间层未对齐，分开陈述 |
| `流年 · 2028年 戊申（39岁）` | 已对齐至同一时间层 |

除显示前缀外数据未变。改变文案即可改变模型任务要求，构成隐藏协议。[已有集成测试](../../tests/integration/result-page-prompts.test.ts#L36) 保护手写不同时间层摘要的分述，没有覆盖真实 formatter 到任务分派的组合。

**必要复杂度。** 八字节气月、紫微运限和实际日期窗口不同，同级 scope 不保证同一时间；资料不足时保守分述有必要。

**最小简化。** 只为该合参 helper 传入双方结构化时间层和实际日期/区间；摘要继续展示。分派比较已列资料的时间范围，不凭两个 `year` 就直接认定对齐，也不建立通用事实引擎。

**风险与验收。** 中等风险。修改展示标签不改变任务；同层不同日期不误判；月界、运限边界、缺资料、full 多层资料均有明确结果。旧主题 selection 的修复继续保留。

### R2-03：合参事实状态先丢失，再从文案重猜

**生产链与重复职责。** 核心 [SynthesisEvidenceFact](../../packages/core/src/synthesis/index.ts#L59) 保留 `detail/sourceKeys`，没有所需事实的可用性状态。[构造八字事实](../../packages/core/src/synthesis/index.ts#L288) 已取得带 `status` 的本命事实，旺衰却只把 `result/basis` 拼成 [展示内容](../../packages/core/src/synthesis/index.ts#L350)。随后 [缺口检查](../../packages/core/src/synthesis/index.ts#L595) 通过 `detail` 是否含“未记录/未登记”等判断整个主题资料是否缺失，影响公开 `status/missingFacts` 及合参任务书。[client 合参入口](../../packages/core/src/client/index.ts#L267) 是实际消费者。

**已验证分叉。** 同步调用正式 `baziCalculator.calculateBazi`，固定 1990-05-15、时辰索引 4；紫微固定 `2026-08-07` 申时为运限基准。只向旺衰 `ruleBasis` 追加附注：

| 附注 | 重建后的本命旺衰事实 | 合参状态 |
| --- | --- | --- |
| `局部细节未知` | 偏强/已记录 | 资料完整 |
| `局部细节未记录` | 偏强/已记录 | 资料有缺口，7 项 strength 主题缺口 |
| `局部细节未登记` | 偏强/已记录 | 同上 |

这是文案变异的真实函数探针，证明状态依赖措辞；不是说当前默认规则已产生该错误。[既有测试](../../tests/integration/core-bazi-ziwei-synthesis.test.ts#L502) 恰好保护“局部细节未知”，没有覆盖另两种措辞。

**必要复杂度。** 合参“资料齐全”不等于规则“完成判定”。[现有契约](../../tests/integration/core-bazi-ziwei-synthesis.test.ts#L625) 明确允许用神部分判定或待判时仍拥有完整合参资料；不能直接照搬全部 natal `status`，也不能把缺资料、核查为空、规则未决压成同一布尔值。

**最小简化。** 在合参私有事实映射中保留各类必需资料是否提供的结构状态，由原始字段和事实判断；`detail` 只展示。可保持公开输出形状，不需要新的公开事实框架或全库迁移。

**风险与验收。** 中等风险。保留真正未知、已核查为空、用神待判和交节/交运歧义的现有断言；说明文字的等义变异不改变 `status/missingFacts`。先定义每类必需资料的可用性，再移除文本判断。

### R2-04：平行阶段生命周期导致重试时间基准漂移

**生产链与重复职责。** [reading-workflow](../../src/lib/ai/reading-workflow.ts#L727)、[另一阶段归并](../../src/lib/ai/reading-workflow.ts#L1899) 和 [紫微阶段归并](../../src/lib/ai/reading-workflow.ts#L2723) 分别维护成功阶段复用、失败/取消、阶段收集与汇总。七政/西占缓存比较包含 `guide/currentTimeContext`；[奇门](../../src/lib/ai/reading-workflow.ts#L2083) 和 [紫微](../../src/lib/ai/reading-workflow.ts#L2881) 不包含。增加一种失效规则必须跨多套生命周期同步。

[hook retry](../../src/hooks/useAiChat.ts#L478) 保留 memory 并重发 `lastRequest`，但 [工作流](../../src/lib/ai/reading-workflow.ts#L3106) 对相对时间追问重新读取当前时间。

**已验证分叉。** 内存时钟与 stream 替身驱动真实工作流：已有回答后追问“今年事业如何？”，2026-12-31 23:59 的第二阶段失败，2027-01-01 00:01 重试。两阶段总调用三次，首阶段的 `CACHED_2026_PHASE_ANSWER` 被复用，最终汇总同时收到它、新阶段回答及 2027 年时间上下文。证据是输入时间基准混用，不是对真实模型答案的推断。

**必要复杂度。** [失败补阶段](../../tests/ai-reading-workflow.test.ts#L1400) 降低重试成本；[非相对问题跨分钟复用](../../tests/ai-reading-qimen-phases.test.ts#L361) 是既有契约。主体切换会 reset，本轮没有跨主体泄漏证据。

**最小简化。** 新分析或新追问建立一次逻辑请求时间锚，retry 沿用；需要重新换算时作为新逻辑请求。随后共用阶段终态与缓存身份的基础处理，保留术式事实切片、覆盖键和提示词。不能每过一分钟就把全部成功阶段清空。

**风险与验收。** 中等风险。相对问题跨日/月/年重试使用统一基准，新追问取得新基准；固定时段跨分钟复用、失败只补未完成、取消不误完成、日期覆盖完整继续成立。先修时间锚，再考虑合并生命周期代码。

### R2-05：AI 动作的成功身份与失败身份使用两种表示

**生产链与重复职责。** [失败关联](../../src/lib/ai/reading-workflow.ts#L3148) 按 schema 投影并排序输入，然后生成 `retryFailureKey`；[成功去重](../../src/lib/ai/reading-workflow.ts#L3284) 却直接 `JSON.stringify(action)`，保留原字段顺序。该 key 又用于 [资源保存](../../src/lib/ai/reading-workflow.ts#L3344)、上下文复用和恢复重放。[真实执行器](../../src/lib/ai/reading-resources.ts#L2132) 按字段名读输入，字段顺序没有业务含义。

**已验证分叉。** 同轮两个 calculate 动作分别使用：

```json
{"baziFortuneScope":"year","baziFortuneYear":2028}
```

```json
{"baziFortuneYear":2028,"baziFortuneScope":"year"}
```

真实工作流执行替身两次，保存两份资源，最终上下文包含两份相同事实标记。结果为 `executionCount=2/resourceCount=2/contextCopies=2`，并占用四项动作预算中的两次。未调用模型或真实补算 HTTP。现有复用测试只覆盖相同表示，未覆盖成功补算重排。

**必要复杂度。** 失败纠错需要关联目标参数，成功身份需要完整有效输入，二者未必应完全相同。主体、目标、时段、口径和有序数组也不能被过度归一化。

**最小简化。** 共用稳定对象序列化基础；成功资源使用经校验的规范输入，失败关联保留有意采用的字段投影。不要直接把现有失败 key 变成全部资源身份，不增加全局缓存。

**风险与验收。** 低到中等风险，涉及历史 replay key。字段重排同轮和跨追问只执行一次、上下文只有一份；不同主体/时段不合并；数组顺序和不可变参数拒绝规则保持。旧 key 在历史读取边界兼容，不能让恢复重新执行已完成工作。

### R2-06：动态解读的两个版本都仍承担新会话执行

**生产链与重复职责。** [工作流分派](../../src/lib/ai/reading-workflow.ts#L3021) 对页面单源种子创建 v1，对 replay、多源或补充资料创建 v2；并非只为旧历史保留 v1 读取。两引擎分别管理页解读、摘要、游标推进与最终归纳。[面板](../../src/components/AiChatPanel.tsx#L427) 在页间允许普通 `ask(text)`，另有继续下一批按钮。

**已验证分叉。** 真实工作流处理同一秒的合成星盘资料，首轮后均处于 pages。第二轮发送同一追问：v1 的页解读提示词包含本轮追问；v2 发出的两份提示词均不包含，只含 checkpoint 原问题。探针记录的是本轮追问是否出现在任一提示词中，未证明 v1 的归纳提示词也直接包含追问。[v2 页阶段](../../src/lib/ai/astrolabe-dynamic-collection.ts#L557) 和 [补充阶段](../../src/lib/ai/astrolabe-dynamic-collection.ts#L488) 固定使用原问题，直到 [最终归纳](../../src/lib/ai/astrolabe-dynamic-collection.ts#L521) 才消费本轮问题。[v1 测试](../../tests/ai-reading-astrolabe-dynamic.test.ts#L140) 则要求保留原问题和本轮问题。

行为分叉已证实；“逐页期间允许改变关注问题，还是只续做固定计划”的产品契约尚未一致。固定原计划本身可以合理，但界面和两引擎需要表达相同含义，不能仅由 seed 是否带 replay 决定追问是否进入提示词。

**必要复杂度与反证。** 多源、分批、身份检查、checkpoint 原子推进和历史恢复有真实用途。正向探针经过工作流、JSON 序列化、`normalizeAiChatHistory`、checkpoint/replay 读取与真实续读：保存 1 页，恢复后 2 页，资源只重放 1 次，状态为 `continuable`。这支持保留恢复机制。

**最小简化。** 先统一原问题、本轮问题和 continue/ask 的输入契约，保留原问题及摘要含义；然后让新会话逐步使用一个执行器，旧 v1 格式在读取边界适配。单次修复不要求完成全部合并。

**风险与验收。** 中等风险。不能直接丢掉 v1 identity 或重置页位置。v1/v2 的 pages、supplemental 对同类追问行为一致；若只允许续原计划，UI 明示该限制。失败不推进 checkpoint、双主体顺序、旧历史续读及已读页不重读继续成立。

### R2-07：Web 与 Android 平行实现流完成语义

**生产链与重复职责。** [streamAiChat](../../src/lib/ai/stream-client.ts#L55) 将 Android 自定义 AI 送入原生插件，其余走 Web 代理。[Java 解析](../../android/app/src/main/java/cc/aov/mingyu/AndroidDirectAiPlugin.java#L210) 按单行 `data:` 解 JSON，坏 JSON 在提取函数中变为空字符串；只要收到过正文就 [emitDone](../../android/app/src/main/java/cc/aov/mingyu/AndroidDirectAiPlugin.java#L269)，未记录是否收到 `[DONE]`。同一帧先提取正文，只有无正文才检查限长/错误。JS 包装层将此终态传给工作流。

[Web 代理](../../src/lib/ai/proxy.ts#L240) 按完整 SSE 事件拼接 data 行，先查错误，再转发正文，缺 `[DONE]` 时拒绝正常完成。上轮 F09 修复了这条 Web 链，本轮独立审查另一条生产入口。

**同 fixture 对照。** 逐字复制当前 Java 源码，使用已安装的 `org.json`、最小 Capacitor 事件接收替身、内存 `HttpsURLConnection` 与反射调用真实私有解析方法；与 Web `handleAiAnalyze` 的内存 Response 对照：

| fixture | Android Java | Web |
| --- | --- | --- |
| 正文后坏 JSON，再 DONE | 正文 + done | `AI_UPSTREAM_MALFORMED`，无 DONE |
| 正文后直接 EOF | 正文 + done | `AI_UPSTREAM_INCOMPLETE`，无 DONE |
| 同帧正文与 `finish_reason:length` | 正文 + done | `AI_OUTPUT_LIMIT`，无 DONE |
| 合法多行 data 事件 | “AI 未返回任何内容”错误 | 完整正文 + DONE |
| 正常正文及 DONE | 正常完成 | 正常完成 |

未改动 Java 拷贝的 SHA256 为 `a78979b84c02b0e1e6d769587cbd4a2b04684e99d5aa94ed5a4e26e16ee51670`。这是当前解析方法的语义证据，不是设备网络或真机回归。

**必要复杂度。** 原生直连有绕过 Web CORS 和服务转发的实际用途；设备 HTTPS、requestId、取消、超时和原生配置验证不能删除。Java 与 TS 无法简单共享同一运行时代码。

**最小简化。** 明确统一的流事件与终态契约，用相同 fixture 同时约束两实现；让原生按完整事件解析、先判断错误、明确完成标记。若保留非流 JSON 兼容，按响应类型显式处理，不通过“收到过正文”代替流完成。系统提示词的机械文本同步可另作小范围派生，避免普通文案变更跨语言手抄。

**风险与验收。** 中等风险，涉及服务商兼容。上述五类输入终态一致，保留取消不完成、错误只结算一次及非流兼容；再做 Android 构建和设备侧有界验证。当前 16 项回归通过没有覆盖真实 Java 解析差异。

### R2-08：OpenAPI 通用字段包与路径反推隐藏了实际能力

**生产链与重复职责。** [通用 method 枚举](../../src/lib/public-api/handler.ts#L425)、[共用请求 schema](../../src/lib/public-api/handler.ts#L3163)、实际读取器、MCP schema 分开维护。[OpenAPI 后处理](../../src/lib/public-api/handler.ts#L3404) 又从 URL 拼写反推经典方法。通用字段包和模板降低了显式登记量，却没有覆盖所有体系差异。

**已验证分叉一：梅花能力漏报。** OpenAPI 的 method 只有 `time/number/random/timeTrigram`，实际 [读取器](../../src/lib/public-api/handler.ts#L7207) 和 [MCP schema](../../mcp/src/tools/meihua.ts#L15) 另支持 `sound/character/direction`。九个实际顶层字段未在对应顶层声明：`soundCount`、`characterText`、`characterCount`、`characterTones`、`characterStrokeCounts`、`characterLeftStrokes`、`characterRightStrokes`、`direction`、`objectType`。部分出现在另一层 `supplementaryInfo.meihuaSettings`，不能替代真实顶层契约。固定 `method:sound/soundCount:3` 请求返回 200 且 `methodKey=sound`；正式文档和独立行为测试也支持该能力。

**已验证分叉二：六个经典开关漏报。** 六爻、梅花、小六壬、奇门、大六壬、黄历共用 [路径模板](../../src/lib/public-api/handler.ts#L1230) `/divination/{method}/prompt`；`{method}` 无法命中经典目录，所以模板没有 `includeClassics`。六个具体请求均返回正确经典条目，MCP 同样暴露开关。[文档](../api.md#L225) 却要求以 OpenAPI 是否有开关判断能力。

[静态发现生成器](../../scripts/generate-pages-discovery.ts#L53) 实际消费此 OpenAPI，使不完整声明进入正式发现文件，会影响依赖它的 SDK、表单和 Agent 参数发现。本轮未复现某个下游 SDK 或表单故障；已证实的偏差是公开声明缺失，超出内部注释不全的范围。[一致性测试](../../tests/api/contract-consistency.test.ts#L18) 跳过模板、反向只要求模板存在；[经典测试](../../tests/api/classical-prompt-options.test.ts#L114) 未展开具体方法，因此通过结果不足以反证漏报。

**维护成本与反证。** 同一入口身份还要分别登记 REST manifest、OpenAPI、执行 switch、MCP catalog、实际工具和类别装载，并同步文档表。不同协议需要各自 schema 和错误包装，不能强行共用所有声明。实测 catalog 与注册 77/77 双向一致，REST 81 POST = 79 switch + 2 AI 专用分支，没有工具缺项或悬空路由。

**最小简化。** 补全梅花窄输入，明确六个具体路径的能力映射；经典业务方法使用小型显式映射，避免靠模板字符串猜测。只派生机械身份信息，不引入全能 schema/codegen 框架。保持旧 URL、别名和结果不变。

**风险与验收。** 低到中等风险，主要是发现契约兼容。展开实际路径核对 method 枚举、字段位置、经典开关，再用独立输入调用运行时。不能只比较两个共同漏字段的生成结果。反证条件是存在已发布补充 schema 能向正式发现链提供上述信息；当前生成链未见该补偿。

### R2-09：文化提示词路由绕过已有模式边界

**生产链与重复职责。** [三个路由](../../src/lib/public-api/handler.ts#L3605) 直接返回 [起名](../../src/lib/public-api/handler.ts#L3833)、[姓名分析](../../src/lib/public-api/handler.ts#L3871)、[数字能量](../../src/lib/public-api/handler.ts#L3979) 的结果，没有经过已有 [模式校验与整形](../../src/lib/public-api/handler.ts#L8007)。因此一般提示词路由和文化路由分别承担返回协议。

**已验证分叉。** 三个 REST 入口分别传省略、`prompt-only`、`summary`、`full`、`invalid`，15 次均返回 200，字段不随模式改变：起名始终 `candidates + prompt`，另两个始终 `analysis + prompt`。对应 MCP 三工具经统一包装，9 次调用分别得到 `prompt`、`prompt + resultSummary`、`result + prompt`，输出 schema 全通过。

[公开文档](../api.md#L207) 及 [默认约定](../api.md#L219) 宣称 `/prompt` 的三种模式；但 [姓名事实测试](../../tests/api/name-fact-consistency.test.ts#L56) 和 [数字能量测试](../../tests/api/public-api.test.ts#L7737) 已消费省略模式的具名字段，说明不能直接改变默认并删除旧字段。

**必要复杂度。** 起名候选、姓名/数字分析的领域结果不同，已有省略模式消费者是现实兼容成本。REST 与 MCP 外层协议也继续保留。

**最小简化。** 将三个分支接入既有显式模式校验和整形，不重写计算；先规范显式模式，保留省略时旧行为及 full 的具名兼容字段，记录例外。若长期保留三入口例外，则必须同步文档/schema 并明确处理不支持的模式，结束静默忽略。删除旧默认或别名需要明确迁移/版本化退出条件。

**风险与验收。** 中等兼容风险。覆盖三入口×三模式、非法模式拒绝、任务书一致、full 事实与原具名结果 deepEqual，以及省略模式兼容。模式修复不应改变领域事实。

### R2-10：窄消费者依赖宽聚合，扩大非目标初始化边界

本项包含两条独立调用边，归为同一维护根因。

**实例 A：紫微焦点选择。** [focus.ts](../../packages/core/src/ziwei/prompt/focus.ts#L2) 只为主题规范化导入 `prompt/thematic`，后者回到提示词组装与公开 API；[紫微 formatter](../../packages/core/src/prompt/ziwei.ts#L9) 又从 iztro 聚合取合盘能力，[iztro 聚合](../../packages/core/src/ziwei/iztro/index.ts#L88) 回导提示词。静态确认 thematic、public-api、prompt/ziwei、iztro/index、prompt/index、combined、snapshot、focus 构成八模块值环。

独立进程仅导入 `ziwei/prompt/focus.ts`，记录 **286 个 core TS 模块，其中 227 个 bazi 模块**，包含 calculator、analysis pipeline、useful-god strategy 和调候规则。生产链为 [结果页](../../src/pages/ResultPage/index.tsx#L1890) → [combined](../../packages/core/src/ziwei/prompt/combined.ts#L249) → snapshot → focus。焦点函数本身只消费紫微 payload 和主题。

**实例 B：八字合盘。** [compatibility 聚合](../../packages/core/src/compatibility/index.ts#L1) 从 bazi、divination、iztro 三个宽入口取得少数关系函数。独立进程先加载 birth 再加载 compatibility，core 模块从 **262 增至 436，新增 174**。新增包括 divination 83、prompt 24、name-number 5、taiyi 4、huangji-jingshi 6，其余分布于其他目录。随后 `await calculateCompatibilityBundle(...,{systems:['bazi']})` 成功，只产生八字关系；非目标加载已经发生。[范围合盘](../../src/lib/full-chart-engine/bazi-range.ts#L196) 是实际消费者。

**具体成本与限制。** 非目标规则和资料成为窄功能初始化的前置条件，扩大隔离调试与依赖变更范围。加载数是实测，两组数字不能相加；birth 原有四体系成本未算作新增。没有测启动时间，没有证明值环引起 TDZ/初始化失败；浏览器 tree-shaking 也是反证，不能把 Node 模块数解释成下载体积或算法执行次数。

**最小简化。** 纯主题配置和 normalize 函数移到叶模块；内部直引已有关系实现，公开聚合、re-export 和 75 exports 保持。不要增加新的依赖注入容器，也不把所有 API 子路径统一到一个大入口。

**风险与验收。** 低到中等风险，主要是 ESM 初始化顺序与旧导出形状。焦点、任务书、单点/范围合盘输出等价，包契约保持；窄焦点入口不再加载八字规则，合盘入口不再额外牵入无关占法和姓名数据。值环是否全部消失不是唯一验收，实际依赖范围才是关键。

### R2-11：源码分轨落地后 CI 仍完整重复执行其文件集

**生产执行链。** [CI](../../.github/workflows/ci.yml#L48) 先 `build:prepare`，再 `test:core:run`、`test:ci:run`，最后提示词事实审计。[核心职责 runner](../../packages/core/scripts/run-core-tests.mjs#L95) 明确选文件，[根命令](../../package.json#L56) 仍用原全量 glob。

**本项由上一轮改动引入。** `ecca9eb7` 新增核心源码步骤以解决 F11，根 glob 没有排除核心集合。源码 runner 的独立可运行性已经修好，CI 调度仍需收尾；不能把新成本归咎于更早版本。

**集合与表示证据。** 运行 `--list`、枚举根命令，再解析 TypeScript 运行时导入闭包：

| 集合/分类 | 文件数 |
| --- | ---: |
| 核心源码 runner | 231，全唯一 |
| 根顶层测试 | 426 |
| 根 integration/api/mcp | 54 |
| 根回归合计 | 480 |
| 两阶段交集 | 231，包含核心集合全体 |
| 根阶段其余文件 | 249 |
| 核心集合中传递闭包含 runtime `mingyu-core` 边 | 55 |
| 核心集合中未见该包名运行时边 | 176 |

[source runner](../../scripts/run-core-source.mjs#L13) 把包 exports 映射到当前源码；根 tsconfig 只给 `@/@core` 源码 alias，包名继续走 dist。AST 分析 807 个规范化路径文件、0 个未解析本地目标；46 个测试直接有包名值导入，传递后为 55。其余 176 个静态闭包在两阶段仍指相同源码。分析排除显式 type-only 边，但不推断普通导入是否最终只作类型使用，55 表示存在潜在表示差异，不保证每条语法值边都会运行。[出生 bundle](../../tests/core-birth-bundle.test.ts#L62)、[capabilities](../../tests/core-profile-capabilities.test.ts#L35) 和 [时区子进程 fixture](../../tests/fixtures/qimen-lifetime-timezone-probe.ts#L2) 是抽查例子。

**成本与限制。** 同一 CI job 额外启动/加载 231 个测试文件，领域断言与子进程探针重复执行、同一故障可能重复报告。176 是静态闭包口径，不是逐测试运行等价证明；动态环境和非字面加载不能完全由该分析排除。55 个包名解析不同文件可能承担真实 dist 契约，不能一起删除。合并前 Node 22 test job 为 14m35s，源码阶段约 10:25:30–10:30:04，根阶段约 10:30:04–10:39:20；这些时间不等于可节省时间。

**最小简化。** 将 176 个无包名值边文件作为优先复核集合，确认解析表示、子进程环境及注册断言等价后，逐项取消重复调度；176 不是预先确定的去重验收数量。其余 55 保留第二表示验证并逐项确认用途。最终可形成源码领域、应用/跨层、真实包消费三个目的清楚的阶段。保持文件集合并集和断言，不通过删负例或快照获得绿色。

**风险与验收。** 低到中等风险。核对前后文件并集、交集、实际注册测试名和 `.cases` 父注册；249 个其他文件不能遗漏。真实 tarball 安装、75 exports/声明、无可选 iztro 行为和浏览器包契约继续独立运行。不能把 2131+4131 直接解释成可以删除 2131 条断言；实施后才能测量 CI 收益。

### R2-12：响应式布局复制了占问字段业务规则

**生产链与重复职责。** `DivinationPage → DivinationPanel → DivinationForm → 同一 draft → generateDivinationSession`。表单分别渲染桌面和手机控件树，以 CSS 选择显示。梅花 [桌面数字字段](../../src/components/DivinationPanel/DivinationForm.tsx#L768) 与 [手机数字字段](../../src/components/DivinationPanel/DivinationForm.tsx#L1322) 重复清洗；[桌面文字分派](../../src/components/DivinationPanel/DivinationForm.tsx#L805) 与 [手机文字分派](../../src/components/DivinationPanel/DivinationForm.tsx#L1360) 重复 1 字、2–3 字、4–10 字的条件及声数/笔画处理。AST 核对至少六组字段更新处理重复。

**具体成本。** 修改字段条件、清洗或辅助输入，需要改两处布局。现有引擎、时间边界、盘面 SSR 测试验证领域行为，不能替代两套实际控件交互。本轮未证实两端当前计算不同，也未做新 GUI 检查。

**必要复杂度。** 桌面内联与手机换行布局有用途，选项常量和部分更新函数已共享。不同占法输入也不应强制使用统一表单模型。

**最小简化。** 提取少量术式字段组件和清洗/条件函数，允许布局参数或 CSS 排列差异；优先梅花重复块。不引入表单 DSL、通用 schema 渲染器或新状态框架。

**风险与验收。** 低到中等风险。两种布局相同输入产生同一 draft，字数切换的清理、牌阵切换重置、标签和焦点身份保持。收益在触点减少，优先级低于前述语义和边界问题。

## 4. 本轮没有升级为正式问题的候选

以下有证据基础，但收益、当前偏差或验证覆盖不足；不与 12 项混计。

| 观察项 | 已知事实 | 处理建议 |
| --- | --- | --- |
| 旧快捷面板 | [PromptShortcutPanel](../../src/pages/ResultPage/components/PromptShortcutPanel.tsx#L31) 经 1454 个 TS/JS/JSON 静态入口检查，仅测试引用；旧分组样式仍在 | 可局部退役组件及专属样式；保留生产弹窗仍消费的分组数据 |
| CSS 所有权 | [traditional-charts.css](../../src/traditional-charts.css#L5015) 用全局工作区选择器及 `!important` 覆盖手机间距 | 有布局定位成本；本轮无渲染证据，不报视觉故障 |
| Vite/Node 桥接 | [Vite](../../vite.config.ts#L168) 先全量收 body 再进代理；[生产 Node](../../server/docker-server.ts#L108) 先用限额 reader；开发写流循环缺 drain 反馈 | 可复用已有有限 body reader 和薄写桥；未启动 Vite、未压测，不推断内存积压或漏洞 |
| 工具身份文档镜像 | catalog、manifest、两张表和公开 Skill 需同步，目前映射一致 | 只考虑派生机械 ID/路径/方法列，保留人工说明和 REST 特有项；不另建通用生成框架 |
| 包版本来源 | MCP 握手取根版本，发布流程允许单包版本；当前均为 0.4.2 | 当前无错报；单包演进时应从自身发布 manifest 取版本并做隔离包验证 |
| 主题别名映射 | emotion 在部分主题规范化和 formatter 的映射不同；真实 thematic 主路径可正确识别，全盘仍有相关宫位 | 不认定资料丢失或 F02 复发；定义别名契约时再统一叶配置 |

已知“手机历史返回来源”和“AI 关闭仍显示 AI 标签”属于前一轮视觉检查的未修问题，未当成本轮过度设计新项；弹层背景位置变化仍待有效 GUI 复核。本轮也没有把尚待确定的合盘历史来源行为升级成架构缺陷。

## 5. 明确保留的必要复杂度

审查不能以减少文件或状态字段为目标。以下均有实际消费者、反例或独立验证，应保留：

1. **时间表示和边界。** 原始钟表时间、北京时间、IANA/DST、真太阳时、农历闰月、秒级交节、出生区间半开边界各有含义。合参跨交节或交运不能假设唯一时间；不得为统一模型重复校正或丢精度。
2. **请求与协议边界。** 公开 adapter 独立自校验；REST 的 HTTP/封套、MCP 的 structuredContent/content/isError、core client 的异常/safe 结果不同。在线预算、本地完整预设和旧参数读取继续保留，请求内部才复用规范结果。
3. **规则三态与来源。** 缺资料、已核查为空、条件不成立/待判不能合并。八字 pipeline 是固定单轮依赖链，节气、藏干、柱位和来源传播有测试用途；没有证据支持删除它或重写规则引擎。
4. **异步所有权。** Worker 共享 pending 的消费者取消与底层取消不同，完成缓存和 pending 去重不同；页面借用资源与补算自有资源的 dispose 责任不同。不能为了一个统一 cancel 函数破坏旧修复。
5. **区间、分批和历史恢复。** 逐秒分页、主体/样本身份、双人组合、容量限制、随机 seed/replay/trace、checkpoint 原子推进及旧历史格式都有用途。正向恢复探针已证明链路接通。
6. **公开包与构建契约。** 75 exports、声明、ESM 扩展名处理、可选依赖缺失行为、真实 tarball 安装、浏览器消费和体积检查各验证不同风险。源码 alias 测试无法替代它们。
7. **多运行时的薄适配。** Node、Pages、Vite、Android 传输 API 不同，MCP CLI 有状态会话与在线无状态 handler 也不同。应统一业务语义和 fixture，不要求一个传输实现覆盖所有平台。
8. **数据和公开资料。** 文献正文、固定表、生成笔画和星历数据、Skill 下载镜像有真实消费者，体积本身不说明过度实现。独立真值测试也不能因为与实现断言主题相同就删除。

## 6. 与上一轮 F01–F13 的关系

本轮不重报已经修复的具体调用边，也审视上一轮新增结构造成的新成本。

| 本轮问题 | 与旧项的区别 |
| --- | --- |
| R2-01 | 住宅页面结果所有权，不是 F05 请求内出生规范化次数 |
| R2-02 | selection 之后的合参任务分派，F02 主题/旧 URL 规范化继续成立 |
| R2-03 | synthesis 消费者丢失可用性状态，不是 F06 已修的紫微事实去重或旺衰来源标签 |
| R2-04–R2-06 | AI 阶段/资源/动态解读身份，不是 F08 Worker 共享任务取消 |
| R2-07 | 独立 Android 原生入口；F09 Web SSE 修复未回退 |
| R2-08 | 发现 schema 与实际支持漂移，不是 F01 业务请求计划或 F03 错误映射 |
| R2-09 | `/prompt` 协议适配漏接，不是 F04 三体系 calculate 投影 |
| R2-10 | focus 与 compatibility 两条剩余依赖边；F12 profile/input 叶依赖已修。旧报告值环观察因新增加载和消费者证据升级 |
| R2-11 | F11 源码分轨后的 CI 调度重复，明确由上一轮新增步骤产生 |
| R2-12 | 同一 draft 的响应式字段业务重复，不是已修字体/布局问题 |

F07 调候荐干共置、F10 准备/消费拆分与启动器兼容、F13 工程类型与基准有效性未发现足够证据支持重开。保留其既有验证。

## 7. 建议实施顺序与结束条件

### 第一批：先修有界语义和边界，建立小样本

建议顺序为 **R2-03 → R2-02 → R2-08 → R2-05 → R2-07**。它们可独立交付，有文案变异、实际路径、字段重排和流 fixture 作为明确验收，不需要先做大规模搬迁。

每项先保留当前事实/输出对照，再移除对应的文本反推、漏接或重复身份处理。R2-08 声明补全可以先做增量；R2-05 先稳定成功身份，保留失败纠错投影；R2-07 先统一协议样本，再改原生解析。不要把五项合成一个大型公共框架。

### 第二批：收敛页面和 AI 的生命周期所有权

执行 **R2-01、R2-04、R2-06、R2-09**。先明确单一结果与逻辑请求身份，再减少平行生命周期代码。

R2-04 可以先冻结逻辑请求时间锚，随后才提取共用阶段执行；R2-06 先确定 ask/continue 一致行为，后迁移引擎，保留旧 checkpoint。R2-09 先规范显式模式，默认兼容作为单独迁移条件。每项都有中等回归风险，适合独立提交和独立回退。

### 第三批：降低非目标加载和重复验证成本

执行 **R2-10、R2-11**，再处理 **R2-12** 和低优先退役。

R2-10 只改内部导入方向，不改公开出口；R2-11 保持断言和测试文件并集，先去掉可确认的同表示重复，再评估包表示验证。修改后测量同环境的加载与 CI 耗时，届时才给出收益数字。响应式表单只先提取最重复的梅花字段，不扩大为所有术式迁移。

### 每批共同的完成标准

- 对该批真实消费者有一条贯通验收，不仅测试新 helper。
- 文案不再决定机器状态，规范输入不因字段排列形成新身份。
- 旧 URL、历史恢复、输出兼容和公开 exports 保持或有明确迁移契约。
- 删除重复职责时一起删除其独占旁路；不保留“新统一层 + 两套旧执行器”作为长期终态。
- 按影响运行定向回归、类型和相应包/平台契约；最后在合并点运行现有完整门禁。独立真值、负例和边界断言不削弱。

本报告不承诺删减比例或工期。上述问题的收益在事实来源减少、普通变更触点减少、隔离验证更明确；性能和工程时长需要实施后同环境比较。

## 8. 复核材料与覆盖限制

本轮最小探针及 JSON 位于忽略目录 `.local/audits/2026-10-26-round2/`。它们是当前工作区的辅助证据，不是已提交或发布的文件；正文已记录关键输入、结果、方法和边界，不依赖这些文件才能理解结论。

| 材料 | 作用 |
| --- | --- |
| `frontend-probes.mjs` / `frontend-probes.results.json` | AST 提取真实回调、住宅日期粒度对照、合参时间文案变异 |
| `core-probes.mjs` / `core-probes.json` | 当前源码内存转译、独立进程模块加载、合盘及事实状态对照 |
| `ai-probes.mjs` / `ai-probes.json` | 三个真实工作流探针和历史恢复正向对照 |
| `api-probes.mjs` / `api-probes.json` | 禁网络的真实 REST/MCP、schema 与目录对照 |
| `native-stream-probe.py` / `native-stream/result.json` | 未改 Java 源码及内存流的 JVM 调用 |
| `web-stream-probe.ts` / `web-stream-result.json` | 同 fixture 的 Web 代理对照 |
| `engineering-probes.mjs` / `engineering-probes.json` | runner 集合及值导入传递闭包 |
| `tracked-size.json` | 受控文件物理行/字节背景统计 |

在当前已准备依赖和核心产物的工作区，可分别执行以下命令；不是 fresh clone 的安装说明：

```bash
TSX_DISABLE_CACHE=1 TSX_TSCONFIG_PATH="$PWD/tsconfig.app.json" node --import ./node_modules/tsx/dist/loader.mjs .local/audits/2026-10-26-round2/frontend-probes.mjs
node .local/audits/2026-10-26-round2/core-probes.mjs focus
node .local/audits/2026-10-26-round2/core-probes.mjs compatibility
node .local/audits/2026-10-26-round2/core-probes.mjs status
TSX_DISABLE_CACHE=1 TSX_TSCONFIG_PATH="$PWD/tsconfig.app.json" node --import ./node_modules/tsx/dist/loader.mjs .local/audits/2026-10-26-round2/ai-probes.mjs
TSX_DISABLE_CACHE=1 node --import ./node_modules/tsx/dist/loader.mjs .local/audits/2026-10-26-round2/api-probes.mjs
python3 .local/audits/2026-10-26-round2/native-stream-probe.py
pnpm exec tsx --tsconfig tsconfig.app.json .local/audits/2026-10-26-round2/web-stream-probe.ts
node .local/audits/2026-10-26-round2/engineering-probes.mjs
```

三个 core mode 必须分别在新进程执行，避免缓存污染加载计数；模块 hook 将当前 TS 在内存转译，不写源码或 dist。AI/前端探针部分消费当前已构建 core，Java 探针使用本机 Java 21 和已有 Gradle 缓存的 `org.json`。它们均有环境前提，不能当跨机器通用测试命令。

本轮覆盖了五分区及跨运行时代表链，没有逐行审查全部算法、规则、文献、样式、第三方库或所有公开路径。没有做新 GUI 轮、真机操作、真实 TLS/服务商调用、存储配额故障或并发压测；没有重新运行全部回归。React 最终回写、真实模型回答质量、浏览器打包体积和确切加速比例均不由这些探针证明。

审计阶段在上述证据与限制内完成；当时交付为本报告和计划。随后两批实施验收分别记于 [第一批](2026-10-26-round2-remediation.md) 和 [第二批](2026-10-26-round2-batch2-remediation.md)。行为修复与结构简化按各记录的验证口径评估；R2-06 双执行器仍是保留的后续结构边界。
