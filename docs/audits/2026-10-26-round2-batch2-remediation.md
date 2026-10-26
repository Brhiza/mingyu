# 第二轮维护复杂度修复记录：第二批

日期：2026-10-26。用户在 [第一批修复](2026-10-26-round2-remediation.md) 完成后要求“继续深入并优化”。本批继续处理 [审计报告](2026-10-26-round2-maintainability-review.md) 剩余的 R2-01、R2-04、R2-06、R2-09、R2-10、R2-11、R2-12；基于 HEAD `ecca9eb70f607b3cb7748656414b54af5e636124` 及第一批尚未提交的实现，不覆盖前批修复。

本批七项范围的实现、交叉复核与集成验证已完成；R2-06 的行为契约已统一，双执行器结构保留，按部分结构收敛记录。第二批验收时改动尚未提交；用户随后授权继续修复并提交 PR，新增生产消费者与取消边界补修及最终验证见 [提交前深入复核记录](2026-10-26-round2-followup-remediation.md)。保留公开 URL、历史重放、75 个核心 exports、npm 版本和锁文件。根 `package.json` 仅增加测试命令，CI 调度作相应调整。

## 1. 本批实施范围

### R2-01：住宅盘改为页面单一结果来源

页面 owner 持有住宅草稿和规范输入，盘面、提示词及阅读资源共同消费对应结果；`MetaphysicsPanel` 只渲染受控输入与盘面。删除父子两条计算链及结果回写，不再把年/年月参数先变成完整日期字符串后丢失粒度。

保留编辑停顿 250ms 后提交、SSR 首屏计算、非法输入错误、八宅/玄空边界、下卦/替卦及出生年界。新增页面 hook，以 `location.key` 和 `location.search` 识别导航；住宅参数相同但出生资料或其他 URL 参数变化也立即丢弃草稿，清理旧计时器。同步替换编辑来源，防止前进/后退回到旧 location key 时复活废弃草稿。

合法编辑等待提交期间，盘面和提示词保持同一已提交输入及结果；非法草稿立即撤下结果、measurement 和阅读资源，不能把新 draft 输入标在旧结果上。六文件源码定向 **102/102 通过**，包含真实 hook/受控控件回调、SSR、URL 粒度、住宅边界和 AI 住宅消费；最后导航循环加固后 owner **6/6 再通过**。交叉只读审查确认原导航计时器问题关闭。hook 由有界计时器宿主验证，真实 React DOM 调度和布局另由浏览器验收。

浏览器另确认桌面分栏时住宅说明卡被挤窄的问题：旧规则只看 760px viewport，在 1280px 窗口、约 548px 的实际盘面列仍强制左右排列。`workspace.css` 将住宅加入已有 820px 容器查询；窄盘面列自动上下排列，宽列保留原布局，没有新增容器或改通用 metadata 样式。生产构建后复核字段卡恢复完整列宽。

### R2-04：AI 相对时间锚属于逻辑请求

`useAiChat` 的新 analyze/ask 捕获 `requestTime`，retry 沿用同一锚；reset/restore 清空旧锚。直接调用工作流时，相同主体、方法和消息默认视为重试，新的同文请求可显式传 `requestTime`。锚只在内存保存，恢复历史失败后首次重试建立新锚，没有为此扩展历史存储协议。

四路阶段共用缓存身份与终态 helper，仍保留各术式事实切片和覆盖规则。身份包括 guide；只有相对时间问题加入冻结的 `currentTimeContext`，不把原始时间戳直接加入身份，因此固定时段问题跨分钟仍复用。新增跨年阶段失败重试和同文新请求回归；最终交叉复核与回归结果见下。

### R2-06：统一原问题与本轮问题契约

v1/v2 页解读、补充资料、摘要和最终归纳均保留原问题及本轮追问，continue 依据已保存游标续读，不重置原计划或已读位置。两套历史执行器保留；本批修复行为契约，结构收敛为 **部分完成**，没有完成单引擎迁移。旧 v1/v2 checkpoint、R2-05 的稳定 key 和旧 supplemental key 恢复继续保留。

交叉审查发现初版 dispatcher 在首轮消息等于 `initialPrompt` 时以 seed 问题替换本轮输入，导致 v1 丢失聊天框输入的问题。最终改为始终传递真实 latest user message，seed 只提供原问题；workflow 入口回归对 v1/v2 分别验证“seed 学习问题 + 首轮事业追问”，页/补充资料及 synopsis 均含两者，checkpoint 仍保留原计划。

AI 最终六文件定向 **86/86 通过**，含跨年部分失败重试、同文新请求时间刷新、旧 JSON v1/v2 追问与继续、补充资料/归纳失败或取消不推进 checkpoint、R2-05 的旧 key、别名与单次 dispose。四个 AI 源码局部 ESLint 零 warning。入口修正后原交叉审查确认无剩余范围内阻断。测试以工作流和执行器入口为主，未引入新的 mounted hook 测试框架。

### R2-09：文化提示词显式模式接入既有协议边界

[API handler](../../src/lib/public-api/handler.ts) 的起名、姓名分析、数字能量三个 `/prompt` 路由共用小型适配器，先统一校验 `responseMode`，再使用既有返回整形。省略字段仍保留旧具名结果；显式模式返回如下：

| 模式 | 返回 data |
| --- | --- |
| 省略 | 原 `candidates` 或 `analysis`、`prompt`、可选 `selection` |
| `prompt-only` | 仅 `prompt` |
| `summary` | `prompt` 和既有 compact 投影的 `resultSummary` |
| `full` | `result`、`prompt`，另保留顶层具名事实/selection 兼容别名 |

`full.result` 与省略模式原对象深等，保留其中 `prompt`；非法值统一拒绝，REST/MCP 外层协议与 MCP 默认值不变。三个独立 OpenAPI prompt 请求声明无误导 default，响应和 [公开迁移说明](../api.md) 标明省略例外。没有重写领域计算。

新增真实 REST/MCP 模式矩阵、直接领域事实对照及省略兼容回归；限定旧消费者、经典发现和命名出生范围共 **37/37 通过**，局部格式与 whitespace 通过。交叉只读审查无阻断。

### R2-10：核心内部直接依赖窄实现

纯主题配置/规范化迁入 [thematic-topics](../../packages/core/src/prompt/thematic-topics.ts)，原 `thematic` 公开路径 re-export 同一绑定，默认值、别名顺序和副本语义保留。紫微 focus 只引叶模块；formatter 和 compatibility 内部直接引用已有关系实现，不经术式宽聚合。

独立进程对当前源码的加载结果：

| 调用边 | 修复前 | 修复后 |
| --- | --- | --- |
| focus：core / bazi 模块 | 286 / 227 | 5 / 0 |
| 先 birth 再 compatibility | 262 → 436，新增 174 | 262 → 268，新增 6 |

只请求八字的合盘正常成功。新增六模块均为合盘及关系实现，新增 prompt/name-number/taiyi/huangji 模块为 0；birth 原有加载不在此项节省口径内。这是实际源码模块加载范围，不是浏览器下载量、算法执行次数或耗时收益。

修前/修后对照保留 27 组主题、60 组 focus、60 组 snapshot、21 份 combined prompt、48 份 thematic prompt、3 份 formatter 及 4 个单点/范围合盘 Bundle，完整规范 JSON 深等，SHA256 同为 `e110ae5abce2cabbd745655e8cf04368f8989430a01d9bcd0fa27a6358594374`。75 个 exports 与跨路径共 1426 项 runtime namespace 名称/typeof 对照一致；类型和发布消费另由实际构建/包检查验证。

八文件源码定向 **118/118 通过**；最后主题身份测试调整后单文件 **15/15 通过**，不与前者相加。交叉只读审查无阻断。核心已重新构建，真实 tarball 隔离安装、声明/75 exports、未安装可选 iztro 和浏览器消费均通过；tarball 为 4,823,790 字节，完整客户端 fixture JS 为 4,517,112 字节，均在原预算内，不等于网站首屏大小。

### R2-11：CI 只取消已复核的同源码重复调度

[核心 runner](../../packages/core/scripts/run-core-tests.mjs) 导出纯文件选择函数，直接命令行为、独立数据准备和 `--list` 保留。新增 [应用 runner](../../scripts/run-ci-tests.mjs) 仅排除显式核对的 176 个同源码文件；55 个有包入口表示差异的领域文件继续跑编译后验证，新领域登记默认保留，不因自动分类静默省略。

CI 顺序为一次 `build:prepare`、`test:core:run`、`test:app:run`、事实审计。旧 `test:ci:run` 全量 glob 原样保留；真实包契约继续独立执行，没有删除测试或断言。

工程门禁核对原完整集合与分区并集、保留的 55 项、`.cases` 父注册以及任意 cwd 的 `--list`。两个入口支持符号链接，同时安全导入：传给 `node -e` 的非路径参数不会引发 realpath 异常或误运行测试。Node **22.23.4** 上工程回归 **5/5 通过**；交叉审查无阻断。

仅靠静态“没有包名 import”不足以消除调度，因此本批另做一次运行等价确认：

- 限定核查 176 中子进程、字符串 import 和环境例外；六个子进程测试均显式指向源码，未发现隐藏 dist 路径。
- 六文件在 source/root 两种解析方式各 **38/38 通过**，注册名和结果一致。
- 176 个省略入口在原 root 解析方式运行 **1442/1442 通过**，与源码分区中的同一文件集合逐项比较：file、name、nesting、skip、todo 和 pass/fail 均相同。
- 实际注册来源包含一个 `.cases` 文件，因此 176 个入口对应 177 个源码位置；这不是多出一个测试入口。
- 核心完整源码分区 **2133/2133 通过**；AI 首轮入口与住宅导航边界冻结后，应用/编译后契约分区最终 **2783/2783 通过**，均无 fail/skip/cancel。
- 最终为核心 231 文件、应用 306 文件、原完整集合 482 文件，交集 55，省略 176，并集恰为原完整集合。分区之间保留不同表示的 55 个领域文件，因此两分区测试数不能相加为独立用例总数。

该等价确认只作为本次迁移证据，不加入每次 CI 重复执行。收益为减少 176 个文件的第二次进程调度；不把旧 CI 阶段耗时直接当作节省量。

### R2-12：桌面/手机共用梅花字段业务

[DivinationForm](../../src/components/DivinationPanel/DivinationForm.tsx) 两种布局都使用顶层 [MeihuaFields](../../src/components/DivinationPanel/MeihuaFields.tsx)。数字清洗、文字字数分支、声数/笔画输入与辅助字段清理只维护一份，布局包装、类名、label、placeholder 和桌面/手机 ID 差异保留。

保持实际旧语义：按 trim 后 Unicode 字数变化清四类辅助值，同长替字或仅增删外围空白保留；切换起法不额外清空父 draft。组件定义在模块顶层，输入期间不因创建新组件类型而 remount。没有引入通用表单 DSL、schema 渲染器或状态框架。

新控件回调、完整 SSR 和真实引擎传参 **10/10**；既有梅花算法/范围消费定向 **36/36**；14 组前后表单 DOM 对照一致，仅规范化自动生成的 Dropdown useId。生产净减少约 116 行；行数不是正确性依据。局部 ESLint 零 warning、格式和 whitespace 通过，交叉只读审查无阻断。

生产页面在手机 390×844、桌面 1280×900 验证：单字左右笔画、两字各自笔画、四字传统声数和十一字无辅助分支正确；同长替字/外围空白保留笔画，改变字数后再回原分支值已清空。数字、声音和笔画均剔除非数字字符，笔画列表保留分隔符；实际输入保持焦点。桌面/手机切换保留同一草稿，起法下拉通过可见菜单完成切换。浏览器语义 click/press 部分超时或无页面变化，按新截图改用可见控件坐标操作；未把失败命令计为通过。未完整遍历所有起法、每种屏幕尺寸或最终起卦提交。

## 2. 集成验证与交付边界

下列命令分别对应一次准备、分轨、类型、生产构建和发布消费。定向与全量有重叠，测试计数不相加为独立覆盖总数。

```bash
pnpm build:prepare
pnpm test:core:run
pnpm test:app:run
pnpm typecheck:run
pnpm prompt:audit:run
pnpm build:run
pnpm build:server:run
pnpm lint
pnpm format:check
pnpm package:check:run
```

最终集成结果：

| 门禁 | 结果 |
| --- | --- |
| 核心源码分区 | 2133/2133，通过；后续核心实现未再改动 |
| 最终应用/编译后契约分区 | 2783/2783，通过，0 fail/skip/cancel，约 199.9 秒 |
| 最终应用、工程、MCP 类型 | 通过 |
| 提示词事实审计 | 通过 |
| Web、Pages 静态发现与 Node server | 通过；容器 CSS 修正后 Web 再构建通过 |
| 真实核心 tarball/75 exports/声明/optional 缺省/浏览器消费 | 通过 |
| lint / format | 通过；3 条既有 warning，新增 runner 与 CSS 另做格式检查 |
| 七项交叉审查 | 全部闭环；住宅导航 timer 和动态首轮问题丢失均修正并复核 |
| 新服务 HTTP 冒烟 | OpenAPI、住宅与梅花页面均 HTTP 200 |
| 页面验收 | 住宅年度/年月/完整日期、错误/恢复、静态 URL、桌面/手机布局；梅花真实字段输入、焦点、辅助值清理和菜单切换通过；覆盖限制如下 |

住宅清空年份的 GUI 命令未改变值；同一浏览器对独立梅花声音输入执行 `fill('')` 也未触发 `beforeinput/input`，而非空替换正常，因此该命令不能作为页面清空行为证据。静态 URL 的空年月日、无流年/月残留已实际确认，真实控件回调与 250ms 提交在 owner 回归通过，但未宣称完成真实键盘清空验收。滚动和部分语义点击出现超时，使用新画面/定位后完成能够验证的场景。没有把浏览器工具限制直接归因为产品故障，也没有宣称整站 GUI 全通过。

限定证据在忽略目录 `.local/audits/2026-10-26-round2-batch2/`，包括 `core-results.json`、修前/修后数据、`core-source-events.jsonl`、`omitted-root-events.jsonl`、`ci-omission-equivalence.json`、`ci-partition-counts.json`、`engineering-runner-node22-tests.log`、`core-package-contract.log`、`ai-final-targets.log`、`residential-focused-tests.log`、`residential-final-owner-tests.log`、`final-application-partition.log`、`final-typecheck.log`、`final-style-gates.log`、`web-server-build.log`、`final-web-css-build.log` 与 `browser-validation.md`。审计阶段环境例外在 `.local/audits/2026-10-26-round2/engineering-probes-exceptions.json`。

没有调用真实模型、改动用户历史或对外发布。原 4174 预览和用户原有三个页面均保留；新产物使用独立的 `http://127.0.0.1:4176/`，内置 AI 关闭，服务继续保留。没有新一轮 Android 真机/服务商 TLS 验证，也不因本批内部依赖调整重写算法或规则。
