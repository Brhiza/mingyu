# 维护复杂度系统排查报告

日期：2026-10-26。代码基线：`6d0aaa10730ad156bb73a053a6e04b67b26d8c91`。

本文保留修复前的诊断与证据；用户随后要求修复，当前实现和最终验收见 [修复记录](2026-10-26-remediation.md)。源码链接行号以审计基线为准，重构后可能移动；已删除文件使用基线路径文字记录。

本轮已完成结构摸底、历史风险抽样、分区审查、重点交叉复核，以及安装后的真实构建、回归、协议和页面验证。仅新增审计文档；依赖、探针和构建产物在被忽略目录，没有修改运行时代码、配置、锁文件或公开接口。

配套资料：[排查计划](2026-10-26-plan.md)、[系统地图与覆盖记录](2026-10-26-coverage.md)、[复现方法](2026-10-26-reproduction.md)、[第二阶段运行验证与测量](2026-10-26-runtime-validation.md)。

## 结论

系统确有可以收敛的底层复杂度，主要来源是**同一职责在不同入口、不同表示和不同生命周期中反复实现**：请求规则分别编排、主题状态多份保存、类型化事实降为文本后重新推断、任务取消只覆盖部分计算，以及构建产物和源码双轨验证。

本轮确认 **13 项维护问题：2 项 P1、11 项 P2**。P1/P2 是维护优先级，不是安全漏洞等级。第二阶段已复现范围优先级、主题残留、错误映射、输出模式、重复规范化和取消所有权问题，并新增依赖聚合与工程类型门禁两项。没有证据支持对整个算法层重写，或直接删除规则引擎、公共客户端、兼容入口、Cloudflare 支持。

**完整回归 4085/4085、穷举 9/9、Android JVM 8/8 均通过，各运行面构建成功；这些通过与组合缺陷同时成立。** 正常核心包检查另有 pnpm 原生启动器兼容失败，同版本 JS 启动器下的隔离消费通过。结论不是测试无价值，而是跨入口、状态转换和工程验证仍有盲区。

建议先补工程类型/基准有效性和窄依赖这两个有限试点，再统一一项业务的实际配置与请求计划，整理错误、事实模型与异步所有权，最后拆分大文件。先按文件长度拆目录，会保留甚至扩大这些耦合。

## 1. 基线与证据强度

第一方运行源码约 **776 个文件、217,574 近似有效行**，其中核心约 137,098 行、Web 与共享应用层约 70,587 行、MCP 约 8,206 行。生成字库、古籍正文、独立数据表、vendor、CSS 和测试另计。有效行是去空行、纯注释后的近似值，不代表圈复杂度，也不是删减目标。

历史抽样固定最近 200 个非 merge 提交，范围为 2026-09-11 至 2026-10-09。最高触达热点是公开 API handler（30 次）、AI 资源模块（25 次）、占卜应用引擎（18 次）。提交图中存在 squash 与原分支重复出现，故频次只用于选样，不能解释成独立回归次数。

一个普通变更样本：`fc5392e5` 的 `includeClassics` 首次实现触及 23 个非资料源码文件，另有 1 个资料与逻辑混合文件，**排盘算法改动为 0**。随后又补 URL/历史恢复与住宅实际体系识别。这说明选项传播和实际方法识别值得收敛；多端接入本身也需要改动，23 这个数字不单独构成问题。

本轮使用四类证据：

- 实现、真实消费者和测试/公开契约相互对照。
- 主代理独立复读高影响源码和历史落点，候选问题保留反证。
- 第一阶段零依赖真实模块探针与 8 项构建定向测试。
- 第二阶段按锁安装后的完整回归/构建、32 个真实 REST/MCP 样本（68 条观测断言）、生产页面主题转换、有限 Worker/effect 取消宿主，以及新进程模块加载/调用计数。

主要验证环境为 Node 24.21.0、pnpm 11.9.0、macOS arm64；另以 Node 22.23.4 验证构建产物和隔离包运行。核心、Web、Node、MCP、Pages、Android debug 均实际构建，包/Pages 体积门禁通过。核心 tarball 已占 5 MB 预算的 96.5%，完整客户端独立消费示例占 JS 预算的 98.2%，可作为后续基线，不等同网站首屏大小。

没有调用真实模型、发布 npm 或上线。Docker CLI 不可用，未构建或运行容器；Android 未跑设备仪器测试。浏览器证据限于一条主题转换，取消证据是有限宿主而非页面点击。各项命令、成功/失败、测量条件与限制见 [运行验证](2026-10-26-runtime-validation.md)。

## 2. 问题总表

| 编号 | 优先级 | 问题 | 直接后果 |
| --- | --- | --- | --- |
| F01 | P1 | REST 与 MCP 重复编排同一请求业务 | 新旧范围参数优先级已经不同 |
| F02 | P1 | 快捷模式、显式主题与合参主题存在多份状态 | 自定义仍残留旧主题，部分合盘控件值未被消费 |
| F03 | P2 | 错误先转为文案，再由正则重猜语义 | 输入错误被归为计算失败，MCP 丢失已有错误代码与字段 |
| F04 | P2 | 输出裁剪分层重复，原始模式与有效模式并存 | REST 省略与显式 compact 不同，MCP compact 与 REST 显式值也不同 |
| F05 | P2 | 出生 Bundle 与区间逐点重复规范化 | 同次请求多次执行同一前置转换与起点核验 |
| F06 | P2 | 展示字符串承担事实身份和算法来源协议 | 改文案需要同步去重器，改标签可能影响算法分层 |
| F07 | P2 | 调候荐干通过规则 ID 在旁表二次登记 | 一条规则必须跨文件维护同一语义 |
| F08 | P2 | 紫微任务取消分散于多套请求与缓存 | 取消仅覆盖部分任务，共享 pending 受首请求 signal 控制 |
| F09 | P2 | AI 事件解析与完成判定缺少一致契约 | 上游坏 JSON 被代理忽略后仍可正常完成 |
| F10 | P2 | 构建入口嵌套强制清理重建，验证器绑定启动器表示 | Docker 脚本至少两次核心重建；正常包检查不能运行于原生 pnpm |
| F11 | P2 | 测试混用核心源码/产物，核心测试靠文本选取 | 验证依赖新鲜产物和隐式测试分类 |
| F12 | P2 | 窄校验经 calendar 聚合牵入星盘运行依赖 | profile/input 校验在 Node 新进程加载 78 个模块 URL |
| F13 | P2 | 工程 TS 没进类型门禁，基准输入已经漂移 | “动态扫描”基准成功退出，却没有产生扫描结果 |

## 3. 逐项证据与最小简化边界

### F01：REST 与 MCP 重复承担请求业务编排

**证据与影响。** 算法已经共享，但“如何解释请求”仍有两套实现。

- REST：[`readBaziPerson`](../../src/lib/public-api/handler.ts#L5753)、`buildBaziFortuneContextFromInput`（5842）、`readBaziFortuneDateValue`（5896）、`buildBaziPrompt`（5984）。
- MCP：[`buildBaziPerson`](../../mcp/src/tools/bazi.ts#L264)、`readMcpBaziFortuneDateValue`（239）、`bazi_prompt` 回调（448），独立处理默认当前运、范围映射、日期/序号互斥与必填项。
- 双方最终调用相同的 `baziCalculator`、`buildFortuneSelectionContext` 和提示词构建器。MCP 的输入构建又被合参、主题咨询工具消费。
- [`bazi-fortune-pagination.test.ts:103`](../../tests/api/bazi-fortune-pagination.test.ts#L103) 专门跨 MCP/HTTP 比较游标和命限事实，说明同一业务语义需要一致。

同时传 `scope: "yearly"` 与 `promptScope: "origin"`，REST [`buildZiweiPrompt:6426`](../../src/lib/public-api/handler.ts#L6426) 优先旧 `promptScope`，MCP [`ziwei_prompt:466`](../../mcp/src/tools/ziwei.ts#L466) 优先统一 `scope`。两端都暴露两字段，未拒绝冲突。真实 handler/SDK 探针已确认 REST 只返回本命，MCP 返回本命与流年；只传单个字段时双方对齐。REST 同一提示词还同时出现“分析范围：本命”与“解读选择：流年/年计”。差异确已进入选盘和任务书，见 [运行验证第 4 节](2026-10-26-runtime-validation.md#4-原问题的运行证据升级)。

**必要约束。** REST/MCP 的外部输入形状不同，未知时辰还存在 `-1`、省略、三柱标记等兼容表示；在线预设与本地完整模式也有真实差别。不能为了共用代码改变这些旧输入，或让 MCP 绕路调用 REST HTTP。

**最小简化。** 先从八字/紫微做一个纵向样本：边界只负责协议解码和兼容字段转换；内部纯函数形成单一请求计划，确定主体、范围、日期快照、批次、主题与有效选项。默认和互斥规则只判定一次，REST 与 MCP 继续保留各自响应封装。无需新建插件框架、服务定位器或通用任务引擎。

**风险与退出条件。** 中等风险。对照两入口的默认输入、日期直传、旧序号、未知时辰、分页和冲突字段，定义一致的优先级或一致拒绝；已有跨入口契约通过。新增一条同类业务约束时，不再同时修改两套业务分支。可信度高，维护结构和分支差异已核实。

### F02：主题与快捷模式存在多个事实源

**证据与影响。** 结果页同时保存 preset、快捷模式、旧主题字段、新 `topicId/subtopicId`，合参又复制八字、紫微两份。

- [`PromptThemeFields.updateTopic/updateSubtopic`](../../src/pages/ResultPage/index.tsx#L334) 在合参时同时写两份主题。
- 输入自定义问题经 [`handlePromptQuestionDraftChange:3130`](../../src/pages/ResultPage/index.tsx#L3130) 调用八字快捷模式切换；[`buildBaziCustomPromptPatch`](../../src/lib/prompt-page-rules.ts#L1) 只清八字字段。
- 生成端 [`enhancedZiweiPromptPack:1938`](../../src/pages/ResultPage/index.tsx#L1938) 和 [`computeEnhancedPromptText:2126`](../../src/pages/ResultPage/index.tsx#L2126) 又用 `baziTopicId || ziweiTopicId` 取主题。

真实 patch 函数验证两份原为 `career/job-change`，切自定义后八字为空，紫微仍旧；[`prompt-page-rules.cases.ts:17`](../../tests/prompt-page-rules.cases.ts#L17) 只检查单独 patch，没有合参消费链。第二阶段又在生产构建页面完成实际主题选择和问题输入：选择事业后，URL 两份主题都是 career；输入“请重点看家庭沟通”后快捷模式变自定义、八字主题清空，紫微 `ztid=career` 残留，页面主题和任务书仍要求围绕事业展开。旧主题与新问题的冲突已浏览器复现。

另一个静态可达差异：结果页主题控件没有排除双人八字，而 [`computeBaziPromptText:1771`](../../src/pages/ResultPage/index.tsx#L1771) 的合盘分支只使用旧 `resolveCompatType(baziPresetId)`，绕过单盘分支对 `topicId/subtopicId` 的消费。因此可写回 URL 的主题值未进入这条生成路径。

**最小简化。** 每次解读只形成一份有效 selection；合参由这一份映射到两体系。旧 URL/preset 在读取边界转换为规范态，界面动作一次产生完整的新状态，不再靠多个局部 patch 和回退表达式拼出实际配置。不要扩大成全应用状态库迁移。

**风险与退出条件。** 中等风险。需要保护旧链接、单盘/合盘、自定义和问题灵感。检查“选主题→选细项→输入自定义→切换体系→复制/下载”的组合；界面、URL 恢复和最终任务书使用相同 selection。可信度高，合参主题残留已有生产页面证据；双人合盘绕过显式主题仍为静态调用链证据，未声称该分支也做过 GUI 复现。

### F03：错误信息经过文本化后被反向识别

**证据与影响。** 已有类型化错误体系，但部分路径仍依赖文案来决定机器语义。

- [`inferErrorCategory`](../../packages/core/src/shared/result.ts#L113) 用中文正则分类普通 `Error`。八宅 [`resolveDoorMeasurement:212`](../../packages/core/src/ba_zhai/index.ts#L212) 与出生时分校验（272）抛出的真实输入错误不匹配正则。真实模块探针得到 `category=calculation`、`code=CORE_EXECUTION_FAILED`、`recoverable=false`。这与核心 README 对 safe 输入分类的承诺不符。
- 核心 [`createRandomContext:248`](../../packages/core/src/shared/random.ts#L248) 已抛 `MingyuCoreError`，携带 `RANDOM_REPLAY_EXHAUSTED / validation / replay`。
- MCP 工具如 [`tarot.ts:82`](../../mcp/src/tools/tarot.ts#L82) 先 `getErrorMessage(error)`，再传 [`createErrorToolResult`](../../mcp/src/tool-results.ts#L112)。后者 `classifyError` 正则重新识别。真实组合探针确认上例变成 `MCP_TOOL_ERROR`，丢失 `replay` 字段。
- `startIndex 超出资料范围` 又先命中资源正则，变为 `RESOURCE_LIMIT/retryable=true`，其建议是缩短日期范围，无法准确指导修正游标。

**最小简化。** 源头为输入、边界、依赖错误提供类型或稳定 code；MCP mapper 接收 `unknown` 并优先保留已有 `code/category/field`，在边界显式映射为公开 MCP 代码。普通异常和第三方旧文本仍可走兼容兜底。保留用户可读消息、`isError` 和 `content` 协议。

**风险与退出条件。** 低到中等风险；外部客户端可能依赖现有代码，需明确兼容映射而非全部原样外露。对源头输入错误、随机重放、游标、范围限额、依赖缺失各验证一例；只改提示文案不改变类别、重试建议或缺失字段。可信度高，第二阶段已通过真实 safe 客户端和 SDK 工具调用重现上述分类及字段丢失；缺出生资料对照正确为 validation。

### F04：有效输出模式只解析了一半，裁剪又在多层进行

**证据与影响。** REST [`calculateApiResult:4058`](../../src/lib/public-api/handler.ts#L4058) 解析默认 `compact`，但将原始 input 交给领域函数。领域函数如八字（5668）、紫微（6365）、奇门（7154）仅在原始字段显式等于 `compact` 时做专门投影；外层再用 [`shapeCalculationResult`](../../src/lib/result-detail.ts#L45) 按键递归删除。

因此 REST 省略模式得到“完整领域结果减通用证据键”，显式 compact 得到“领域轻量结果再减通用键”。比如八字 `liunian/cycle.years` 不属于通用删除集。[API 文档 219 行](../api.md#L219) 及 541 行都宣称默认 compact。[`public-api.test.ts:4043`](../../tests/api/public-api.test.ts#L4043) 却把省略模式当作 `fullResult` 与显式 compact 比较，反映测试也固化了两种路径。

真实响应矩阵确认：紫微盘面 JSON 省略为 354,969 字节，REST 显式 compact 为 6,755 字节；八字为 69,338 对 5,259；奇门为 32,475 对 14,403。MCP 的省略和显式 compact 相同，都等于 REST 省略路径；full 两端相同。四柱、宫星四化、九宫等基础事实没有分叉。此处是模式解释/投影契约差异，不等同算法错误或等比例计算加速。

**最小简化。** 请求只解析一次有效模式，领域投影只选择一次；明确 calculate 的 compact、prompt 的 summary、原始 full 各自用途。共用通用删除器不能替代领域结果契约，也不能把“删掉输出”解释成“减少计算”。

**风险与退出条件。** 中等风险；当前默认响应的消费者可能已使用额外字段。需提供明确的迁移判断，核对省略模式和显式 compact 等价、full 完整、分页和随机重放元数据保留；补齐边界测试后再收敛。可信度高，真实 REST/MCP 响应已完成模式矩阵及基础事实比较。

### F05：同一出生资料在 Bundle 和区间中反复规范化

**证据与影响。** [`calculatePointBundle:118`](../../packages/core/src/birth/index.ts#L118) 先 `normalizeBirthProfile`，随后每个系统适配器又分别调用它：[`profile/index.ts:536`](../../packages/core/src/profile/index.ts#L536)、574、621、683。请求四体系时，仅这一层就会执行五次规范化，尚不计下游算法自己的校验。

区间入口先在 `birth/index.ts:184` 验证 source，但每秒调用 [`birthProfileAtRangeTimestamp:205`](../../packages/core/src/profile/time-range.ts#L205) 又重新验证同一起点，含 `assertProfileMatchesStart` 的规范化。真正消费者包含网页范围计算和双人组合，非死代码。

第二阶段以内存加载计数验证真实 Bundle：单点八字规范化 2 次；单点四体系 5 次；3 秒八字区间 10 次，并验证范围 4 次。未修改磁盘 dist。次数确认重复前置工作，不能换算成相同比例的性能收益。

**必要约束。** 公开适配器必须能独立处理未校验输入；八字、紫微、星盘、七政的时间语义不同，真太阳时不能重复校正，也不能让天文计算误用传统校正时刻。减少重复规范化不等于移除下游校验或强行统一所有时间算法。

**最小简化。** 保留公开入口自校验；在内部用已规范化结果调用私有 adapter，用已验证的范围上下文取样。只在一次请求内复用，不增加全局缓存或跨请求可变状态。

**风险与退出条件。** 中等风险，涉及时间边界。保持真太阳时、农历、DST、IANA 与逐秒分页结果一致；四体系 Bundle 的 profile 级规范化收敛到一次，范围起点验证不再随样本数线性重复。精确性能收益需实施后测量，本轮不声称加速比例。可信度高，调用次数已有真实模块计数。

### F06：展示字符串被用作事实身份及算法来源

这是同一建模问题的两个实例，应分开迁移，不能做成新的通用“事实引擎”。

**实例 A：紫微事实去重。** [`collectScopeEvidence:217`](../../packages/core/src/ziwei/iztro/build-evidence-pool.ts#L217) 生成标准四化事实，提示词 [`isShownInZiweiPalaces:391`](../../packages/core/src/prompt/ziwei.ts#L391) 与合参 [`createZiweiThemeFacts:500`](../../packages/core/src/synthesis/index.ts#L500) 重新拼同样整句标题和正文，再用精确字符串相等判断是否已覆盖。producer 改一个措辞就需要同步两处消费者。

去重的严格性有必要：[合参测试 229 行](../../tests/integration/core-bazi-ziwei-synthesis.test.ts#L229) 明确要求附加条件、独立正文、错星错宫、截断资料继续保留。不能仅按 `type` 或 stable key 粗暴删除事实。最小做法是紫微私有的标准事实构建/覆盖判定共用，完整正文与附加条件仍参与判断，公开 schema 不动。

**实例 B：旺衰来源。** [`analyzeRoot:211`](../../packages/core/src/bazi/baziStrengthAnalyzer.ts#L211)、`analyzeSupport:341`、`analyzeConstraint:458` 先把原有结构来源转成 `支(干)`；[`isDirectEvidence:138`](../../packages/core/src/bazi/baziStrengthAnalyzer.ts#L138) 再以是否包含 ASCII `(` 判定明干本气/藏气层级，实际进入旺衰和格局取用。原始 root facts 已有 `hiddenIndex/hiddenRole`，无需用显示符号恢复来源。

最小做法是内部保留来源类别，用结构字段参与算法；原字符串只在兼容输出边界生成。当前公开低层函数仍需兼容旧输入，不能直接删除字段或改标签。本轮没有证明现有内建输出算错。

**风险与退出条件。** 紫微中等风险，旺衰较高风险。标准事实只展示一次，附加正文/截断仍保留；展示标签变化不再影响内部层级，旺衰、格局、取用与既有序列化保持一致。可信度高，维护依赖已证实，数值故障未声称。

### F07：调候荐干通过 ID 旁表二次登记

**证据与影响。** [`climateRules/index.ts:31`](../../packages/core/src/bazi/baziTherapeuticRules/climateRules/index.ts#L31) 根据 ID 从 `recommendationStems.ts` 取字段，再覆盖回规则。`ClimateRule` 已直接支持该字段。

例如 [`geng/mao.ts:5`](../../packages/core/src/bazi/baziTherapeuticRules/climateRules/geng/mao.ts#L5) 的规则定义丁、甲、庚关系，却必须在 基线旁表 `recommendationStems.ts:140`（修复阶段已移除，见[修复记录](2026-10-26-remediation.md)） 再登记。该字段真正用于 [`determineUsefulGod:1022`](../../packages/core/src/bazi/baziUsefulGodStrategy.ts#L1022) 的破格限制；[测试 263 行](../../tests/bazi-pattern-useful-coordination.test.ts#L263) 强制核对两表 ID 完整性，证明双维护点不是假设。

**最小简化。** 荐干和显式空数组直接共置在原规则对象，取消 ID 旁表拼装；保留所有原荐干、policy 优先级、规则 ID 和破格约束。不从自然语言自动抽取荐干。

**风险与退出条件。** 低到中等风险，适合作为小批试点。迁移前后组装后的 `CLIMATE_RULES` 逐项等价，破格提示屏蔽、`matchedRules` 和 `strategyTrace` 不变。减少旁表与双表关联检查，保留语义回归和规则自身完整性验证。可信度高。

### F08：紫微任务的取消所有权分散

**证据与影响。** [`cancelZiwei:190`](../../src/pages/ResultPage/hooks/useZiweiCalculations.ts#L190) 只 abort 已登记 payload controllers。完整阅读资源 effect（618）和自选运限 effect（751、797）走不同请求链，未传 signal，只用 `active=false` 阻止回写局部组件状态。

缓存层 [`loadZiweiReadingContent:111`](../../src/pages/ResultPage/utils/ziweiCalculationCache.ts#L111) 与 [`loadZiweiDisplayPayload:271`](../../src/pages/ResultPage/utils/ziweiCalculationCache.ts#L271) 丢弃 worker 提供的 cancel，任务完成后仍写模块缓存；其请求门控也未统一检查暂停状态。真实页面范围操作“取消计算”在 [`ResultPage:1465`](../../src/pages/ResultPage/index.tsx#L1465) 调 `cancelZiwei`，普通单点页面没有这个范围取消入口。

有限 Worker/effect 探针使用真实 cache、工厂和 handler，确认暂停参数为 true 时完整/custom effect 仍启动，取消和 cleanup 后仍算并缓存；custom cleanup 后还继续启动下一层 Worker。同 key A/B 共享 Promise 却只有 A 注册 signal：B 取消不终止且仍 fulfilled，A 取消会让未取消的 B 也收到 AbortError。已有 [`ziwei-payload-cancellation.test.ts`](../../tests/ziwei-payload-cancellation.test.ts) 保护普通 payload；真实探针也确认旧 finally 没删除新 pending、cleanup 阻止局部回写，未发现缓存污染。

**最小简化。** 为一次页面请求明确任务所有者，沿完整计算链传取消信号，统一定义取消后是否可以填缓存；保留轻量盘面与完整阅读资源的职责区别。共享 pending 请求需明确消费者取消与底层任务取消的关系，不能让一个消费者误取消另一个仍需要的任务。

**风险与退出条件。** 中等风险。核验单人、双人、全量资料、自定范围、预热、同 key 请求取消后立即重启；旧任务不能删除新 pending 或回写新页面。实际控制层已有有限宿主证据，但不等于完整 React/浏览器调度；未在页面点击取消，也未测量取消后的 CPU 成本。

### F09：AI 代理重复解析上游事件，与客户端完成判定发生漂移

**证据与影响。** [`handleAiAnalyze:269`](../../src/lib/ai/proxy.ts#L269) 循环和残留 buffer（301）各有一份 JSON/错误/delta 处理；普通 JSON 失败被 catch 忽略。客户端 [`processEvent:183`](../../src/lib/ai/stream-client.ts#L183) 则明确判坏 JSON 为失败。

mock 网络串联真实 proxy 与 `streamAiChat`：上游依次给“有效正文、损坏 JSON、`[DONE]`”，代理返回 HTTP 200，仅保留正文和 `[DONE]`。真实客户端最终正文为“半段正文”、done=1、errors=[]；坏事件已无法传达。[`ai-stream-client.test.ts:115`](../../tests/ai-stream-client.test.ts#L115) 对直接到达客户端的坏事件却要求失败。这证明错误契约不一致；探针使用正常 tsx 和真实已安装依赖，没有调用模型。

**必要约束。** 上游 OpenAI SSE 与应用 SSE 格式不同，服务端转换和客户端接收都需要存在。不是把两层网络合并；问题在重复事件处理和不一致的失败规则。

**最小简化。** 代理循环/flush 共用一个上游事件解码器；以明确事件定义内容、错误、完成。完成必须满足一致的协议条件，坏帧、显式上游 error、EOF、超时和取消各有单一结果。保留已有请求体上限、超时、内置限流与受限重试。

**风险与退出条件。** 中等风险。全 mock 检查坏 JSON、多行/分片事件、最后无换行、空内容、EOF、error 后 DONE、取消；每请求只有一次终态回调，损坏内容不保存为完整回答。可信度高，代理真实代码已零外网复现，完整浏览器持久化未执行。

### F10：多个构建入口嵌套强制清理与重建

**证据与影响。** [`package.json:25`](../../package.json#L25) 的 build、build:mcp、build:server、typecheck、package:check 均自行构建核心。核心 [`build:327`](../../packages/core/package.json#L327) 每次执行 clean、生成源码/产物数据、`tsc --force`、全量 ESM 后处理与空白压缩。

- [`Dockerfile:18`](../../Dockerfile#L18) 连续 `pnpm build && pnpm build:server`，在同一源码快照至少做两次强制核心构建。
- [npm 发布流程](../../.github/workflows/npm-publish.yml#L75) 在双包发布时依次 build:mcp、build、package:check、test:ci，各自触发核心构建；若核心版本尚未发布，还会在 publish 的 `prepublishOnly` 再触发一次，形成五次。已发布/单包路径次数不同。

这些是脚本调用关系可证的重复工作；核心实际单次构建约 8.96 秒，Web 约 20.75 秒，但没有运行整个 Docker/发布链，不报告已获得的节省。CI 的不同 job 各有隔离环境，不能把跨 job 构建简单视为同一个重复问题。

第二阶段还发现启动器表示被写死：[`test-package-tarballs.mjs:26`](../../scripts/test-package-tarballs.mjs#L26) 取得 `npm_execpath`，46—47 行用 `node pnpmEntry` 执行，假定它是 JS。本机固定版本 pnpm 11.9.0 为原生可执行文件，正常 `pnpm package:check` 因解析 Mach-O 字节失败。同版本 JS 发行包入口下，核心 tarball 在 Node 24/22 隔离消费均通过。MCP 验证器也有同类分支，但直接运行时走 PATH 并已通过；未把所有入口都描述为失败。

**最小简化。** 高层组合流程构建一次，后续执行已具备的 `:run` 风格消费命令；每个可单独运行的用户入口仍负责保证产物就绪。验证器按可执行入口调用包管理器，不强制把所有入口交给 Node。先收敛 Docker 与同 job 发布，不先引入远程缓存系统。ESM 后处理有 Node 发布约束，空白压缩也有体积预算依据，不因流程重复直接删除。

**风险与退出条件。** 低到中等风险。干净 checkout、单独 core、Web、Node、MCP、Docker、打包检查仍可运行；JS 与原生 pnpm 入口均能启动契约检查；同一高层流程每个核心源码快照只有一次强制生成/编译。包体积、ESM 导入、运行时兼容和浏览器子路径契约保持。Node 22 已补运行验证，声明的 Node 18 未实测。可信度高。

### F11：源码/产物双轨测试与文本式测试分类

**证据与影响。** 生产 `src` 已统一包导入；静态 literal import/from 扫描得 151 个文件引用 `mingyu-core`，没有直接 core 源码导入。测试仍有 301 个文件引用源码、142 个引用包、50 个同时引用两种路径；这些不是互斥计数，类型导入也在内。提示词事实审计 [`generate-prompt-audit.ts:33`](../../scripts/generate-prompt-audit.ts#L33) 同样混合包导入与 `@core`。

源码单测与发布包契约分别测试有合理性；风险是同一日常业务/事实审计进程可能面对两份核心模块表示，包产物新鲜度成为前置条件。不能声称当前一定重复计算或全局状态已分叉；这里证实的是双入口依赖和验证难度。

此外 [`run-core-tests.mjs:33`](../../packages/core/scripts/run-core-tests.mjs#L33) 以文件内容出现 `packages/core/src|mingyu-core|@core/` 决定“核心测试”。复现会选中根目录 422 个日常文件中的 363 个，包括 AI 工作流与公开 API 跨层测试，例如 `metaphysics-audit-contract.test.ts`。它没有按职责隔离核心，只按导入文本决定范围。

深入反查了测试的必要性：辅助 `.cases.ts` 由父测试副作用 import，确实参与运行，不是漏跑；其中 prompt-page-rules 的应用 patch/布局测试挂在核心入口，职责分类仍可调整。奇门 formatter 有独立固定字面与变异负例，八字分页有精确交运真值、禁止访问批外数据的 getter 和限算计数。它们不应因看似相似而删除。最终完整 4085 回归和 9 项穷举通过，也没有覆盖 F02 的合参状态组合，说明需要按真实行为补边界。

**最小简化。** 明确两条验证路径：源码单元/领域测试使用一种核心解析方式；发布消费契约在隔离安装的 tarball 上验证。事实审计一次选择同一核心表示；核心测试集合按职责放置或显式选择，不扫描文本猜测。先做一个子系统，不全仓机械替换导入。

**风险与退出条件。** 中等风险。源码修改无需猜测是否在测试旧 dist；纯核心测试不隐式拉入页面/HTTP 链；包契约仍验证真实发布产物、可选依赖与 tree-shaking。保持测试保留标准，不批量删掉独立真值和跨入口契约。可信度高，静态计数、完整回归与有限测试职责抽查均完成。

### F12：窄输入校验经 calendar 聚合加载星盘引擎与星历

**证据与影响。** [`profile/input.ts:1`](../../packages/core/src/profile/input.ts#L1) 只需要日期/时分校验，却从 calendar 聚合导入；[`calendar/index.ts:14`](../../packages/core/src/calendar/index.ts#L14) 与 16 行又导出月相/天文事实，后两者 value-import 星盘 engine。[`engine.ts:21`](../../packages/core/src/astrology/engine.ts#L21) 静态导入 Caelus、内嵌星历与四小行星包，50 行在顶层构造 Engine。foundation、皇极的民用时间处理也有类似聚合引用，是真实基础消费者。

新进程记录实际模块 load URL：calendar 只调用时分校验为 77 个，公开 profile/input 校验为 78 个，现有 date-validation 叶模块为 2 个。前两者包含上述引擎和数据。此计数证明 Node 加载耦合，不代表这些 URL 都执行了排盘，也不推导启动延迟或浏览器下载量；浏览器已有 sideEffects/tree-shaking 是必要反证。

**最小简化。** 内部基础消费者直接引用既有叶模块，保留公开 calendar 聚合；需要外部窄入口时再补合法 exports。不要让外部绕过 exports 私导 dist，也不新增一套历法抽象。

**风险与退出条件。** 低到中等风险，适合作为局部试点。公开 profile/input 新进程不再加载星盘运行依赖；输入/foundation/皇极及公开 calendar 的既有输出和 ESM/浏览器消费保持。可信度高，模块加载已运行验证，尚无改动前后耗时/体积收益测量。

### F13：工程类型门禁遗漏使性能基准静默失效

**证据与影响。** 根 [`package.json:45`](../../package.json#L45) 的 app/node/MCP 门禁加核心构建未覆盖全部工程 TS。实际 `tsc --listFilesOnly` 四项目闭包均没有 server、benchmark/discovery/prompt-audit 脚本及 vite.server/vite.mcp 配置；[`tsconfig.node.json:14`](../../tsconfig.node.json#L14) 只显式包含 vite.config.ts 及其 import。Vite 中的 SSR 入口字符串不会形成 TypeScript 依赖。

[`benchmark-core.ts:136`](../../scripts/benchmark-core.ts#L136) 仍以顶层 longitude/dynamicRange 调终身奇门；正式 [`QimenLifetimeInput:806`](../../packages/core/src/types/divination.ts#L806) 使用 location.longitude 和 periodRange。[`lifetime.ts:88`](../../packages/core/src/divination/algorithms/qimen/lifetime.ts#L88) 只有 periodRange 存在才扫描。真实包探针确认旧样本无动态簇/事实，补单年 periodRange 后有 6 簇/6 事实。因此标为“全流水线/太岁扫描”的基准成功退出，却没有执行目标扫描。类型文件闭包枚举本身不作语义检查，不能把它说成该脚本类型通过。

另有黄历 30 天 P95 预算偏差：主要批量作业结束后复测约 740 ms，对照现有 350 ms 预算；脚本只 WARN 仍 exit 0。它是本机预算偏差，不是版本退化证据。先确定工作量和门禁含义，再调性能预算。

**最小简化。** 明确 server、工程脚本和所有构建配置的类型入口；基准 fixture 使用正式输入类型，在预热计时前验证目标工作确已产生。不需要新增通用测试框架，不把性能预算自动变成 CI 阻断作为本轮未经决定的产品政策。

**风险与退出条件。** 低到中等风险。旧输入可由工程类型门禁拒绝，动态场景确有事件簇；server/脚本/配置出现在明确的文件闭包中，保持现有运行行为。此处没有证明 server 当前存在具体类型错误。可信度高，覆盖缺口和基准空工作均已运行验证。

## 4. 次要问题与未证实假设

这些不计入 13 项，也不足以支持直接删除实现。

1. **提示词内部依赖方向可收紧。** `prompt/ziwei` 从 `ziwei/iztro/index` 引兼容分析，后者又 re-export 提示词；`ziwei/prompt/focus.ts:2` 为一个主题规范化函数反向引入负责合参组装的 `prompt/thematic`，形成 value 环。已核实不是纯类型环，但没有初始化故障证据。可以把纯主题配置移到叶模块、内部直引实际实现，保留公开 re-export。
2. **开发 Node 桥接另有一套实现。** `vite.config.ts:168` 先完整读 body 再交代理，生产 Node 则提前限制 512 KiB；开发手动写流，生产用 Web/Node stream 桥。开发最终也会返回 413，不代表校验完全缺失。先共用薄的 body/response 适配，保留必要 DNS pinning，收益低于主线。
3. **已有验证脚本没有进入相应门禁。** `scripts/verify-mcp-package-runtime.mjs` 在本轮检索范围没有调用方；npm 发布里的 `package:check` 只执行核心 tarball 检查。`test:browser-contract` 是独立命令，普通 CI 不调用。不能把这些未执行脚本算作已有自动覆盖。优先接通适合的已有检查，避免再新增平行验证器。
4. **合盘记录是否应恢复解读来源仍需产品契约。** InputPage 能选八字/紫微/合参，但 `CompatibilityHistoryRecord` 不存该来源，恢复固定八字。行为可证；记录究竟是复用出生档案还是重放解读方案尚不明确，所以没有直接判为缺陷。
5. **公开面较大，但缺少外部使用证据。** 核心 75 个公开子路径及 client/safe/兼容提示词有文档和契约。仓库内部少用不能证明 npm 外部无人使用。删除前应先约定稳定面和弃用期。
6. **遗留一次性脚本。** `fix-paths.mjs`、`extract-vibebazi.cjs`、`smoke-test.mjs` 未检索到现有调用；有些是手动迁移工具。可归档或标注用途，但不应把几份低频脚本作为首要复杂度根因。

## 5. 应明确保留的复杂度

- **时间与区间边界。** 秒级交节、立春、夏令时/IANA、标准北京时间半开区间有真实算法和测试依据。不能直接把秒改为分钟、把未知时辰补成固定午时，或把所有体系统一到同一种校正时间。
- **随机结果身份与重放。** 同一问题重用原卦/牌/签，seed/replay/trace 有真实消费者。删掉会改变结果含义。
- **不同输出和在线预算。** calculate/prompt 是不同任务；完整/轻量输出、分页与计算范围是不同维度。在线限制在官方迁到 Node 后仍明确配置，不能按旧平台动机认定已废弃。
- **薄的多运行时适配。** Node 整站与 Pages 已共享业务 handler；MCP CLI HTTP 的会话传输与无状态在线入口不同。不能仅凭多个入口判为重复业务。
- **规则匹配和固定分析管道。** 八字工厂实际是单轮固定依赖链，注入用于核验节气/柱位传播；三态条件区分缺资料与已检查为空。不是没有消费者的泛化框架。
- **完整阅读资料、分批覆盖与恢复。** 大输入、逐秒范围、双人组合和完整事件日期确实需要分批、取消和 checkpoint。需要收拢所有权，不是删除能力。
- **公开包和兼容性验证。** Node ESM、可选 iztro、浏览器子路径、打包体积和依赖补丁都有历史依据。大字库、古籍数据与规则数量不等于过度实现。

## 6. 分阶段简化路线

每批按实际语义闭环提交，不按“把大文件拆小”设目标。先让一条链路成为样本，再推广；各批可以回退，不要求跨版本一次性重构。

| 批次 | 工作范围 | 进入/退出条件 |
| --- | --- | --- |
| A：先让验证可信、入口够窄 | F13 工程类型/基准工作量；F10 pnpm 启动器兼容；F12 内部叶模块引用，分别提交 | 类型闭包明确；基准确实扫描；JS/原生 pnpm 能跑检查；profile/input 不再载入星盘依赖 |
| B：请求与界面唯一配置 | F01 先八字/紫微；F02 合参 selection；同时处理 F04 有效模式 | 旧输入、默认、冲突、分页策略显式；REST/MCP 一致；界面、URL、输出使用同一配置 |
| C：错误和异步边界 | F03 类型化错误映射；F08 任务取消；F09 事件终态 | 每类错误只分类一次；共享 pending 的取消语义明确；损坏流不能保存为完成；保留协议兼容 |
| D：规则/事实与计算复用 | F07 荐干共置；F05 请求内规范化；F06 紫微标准事实共用、旺衰来源结构化，分别提交 | 规则组装等价；时间/区间、事实完整性和正式算法结果一致；展示文案不再控制算法身份 |
| E：构建与测试职责 | F10 Docker/同 job 发布只构建一次；F11 源码/包契约分轨；接通已有检查；纯主题叶模块 | 高层流程同源码只编译一次；测试职责显式；发布包仍独立可消费；内部反向依赖减少 |

A 是第二阶段证据支持的有限试点，让后续验证和衡量可靠；B 是主要结构性收益。F07 仍是适合独立先行的小批改动，F06 的旺衰来源迁移风险高，不因代码行少就抢先改。全量领域回归在涉及算法判定/规则输出时执行；只改构建编排或界面配置时运行相应门禁，不每次重复跨世纪穷举。

不设置“删掉百分之多少代码”的指标。更合适的验收指标是：一条规则只有一个登记点；一个请求只解析一次有效配置；一次任务只有明确终态与取消所有者；一段业务测试明确测试源码还是发布包；一个高层构建流程同一源码只强制编译一次。性能和体积用修改前后实测，不以静态行数估算收益。

## 7. 本轮完成情况与限制

诊断计划 A—F 和第二阶段运行验证均已完成。高影响问题经交叉复核，其余候选单列；13 项正式问题均给出源码、消费者/契约、最小简化和退出条件。完整回归通过，真实协议/页面探针也保留了失败行为，二者不互相抵销。精确命令见 [复现方法](2026-10-26-reproduction.md)，矩阵、测量、失败与替代运行的区别见 [运行验证](2026-10-26-runtime-validation.md)。

本轮不是全部 21 万行算法逐行正确性审计，没有校勘每条古籍规则，没有验证线上性能、真实 Android 设备、容器或外部 npm 使用情况。浏览器只验证了合参主题转换，有限 Worker/effect 宿主不代表页面取消已点击验证。Node 22 做了产物/包兼容，完整回归主要在 Node 24；Node 18 未实测。

产物和本地证据保留用于复核；审计启动的开发/生产本地服务已停止。没有实施上述简化、修改业务代码、提交或发布。后续实施应以每批最小语义边界执行，沿现有契约验证，避免在治理复杂度时再建立一套覆盖全系统的新框架。
