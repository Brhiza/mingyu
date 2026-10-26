# 维护复杂度修复记录

日期：2026-10-26。审计基线为 `6d0aaa10730ad156bb73a053a6e04b67b26d8c91`。用户在诊断完成后要求“继续深入并修复”，本阶段开始修改实现；之前的 [主报告](2026-10-26-maintainability-review.md) 和 [运行验证](2026-10-26-runtime-validation.md) 保留修复前证据，不应把其中的问题观测当作当前实现的正确契约。

## 修复目标与边界

以现有 13 项问题为范围，按行为和文件职责分组推进：工程验证与依赖、请求和主题配置、错误与异步所有权、规则/事实与请求内复用。保持公开 ESM/子路径、旧输入兼容、时间边界、随机重放、在线预算与完整输出。不会因减少维护点而移除安全限制、算法能力或独立真值测试。

只在当前工作区实现与验证，不提交、推送或发布。AI 使用合成问题和 mock 上游，无真实密钥或模型调用。原始修复验证日志存于被忽略的 `.local/audits/2026-10-26-fixes/`；修复前日志仍在 `2026-10-26-runtime/`，不覆盖。

## 完成情况

13 项问题均已按最小边界实施并集中验证。完整回归 **4131/4131**、穷举 **9/9**、隔离源码测试 **2131/2131**、Android JVM **8/8** 通过。core/Web/Node/MCP/Pages/debug APK 构建成功，正常原生 pnpm 的完整 `package:check` 通过。功能兼容保留；默认 calculate compact 的有意收敛及迁移方式已写入正式 API 文档。

| 问题 | 实施边界 | 验收 |
| --- | --- | --- |
| F01 | 八字共用请求计划/执行，紫微共用范围、时点和分页计划；身份与任务书消费同一计划 | 新旧 scope 冲突、历史年份、未知时辰、分页跨 REST/MCP 一致 |
| F02 | 旧 URL 在读取边界转为规范 selection，合参动作完整同步；双人主题进入任务书 | URL 往返、全部旧快捷、单紫微流时及生产页面自定义转换通过 |
| F03 | 源头提供稳定错误类型；MCP 优先保留 code/category/field，旧文本仅兜底 | replay、八宅、游标与 contextKey 真实调用；RangeError instanceof 保持 |
| F04 | calculate 有效 detailMode 一次解析，三体系共享领域投影 | 两端省略=compact、full 完整；分页和随机轨迹保留 |
| F05 | Bundle/区间复用校验后的上下文 | 新包单点规范化 1/1 次，3 秒区间 4 次／范围验证 1 次 |
| F06 | 紫微标准事实共用；旺衰私有显式来源，公开旧形状兼容 | 前后精确等价与文案/事实变异测试通过 |
| F07 | 荐干含显式空数组共置规则，删除 ID 旁表 | 362 条规则逐项 deepEqual |
| F08 | 共享任务按消费者取消，完整/custom/命限纳入 signal/loading | 正式取消、立即重启、第二人失败/超时和重试回归通过 |
| F09 | SSE 循环/flush 同一事件处理，坏帧失败，取消无成功终态 | 真实 proxy/client mock 网络串联及历史/工作流通过 |
| F10 | 高层单次准备/消费分离，pnpm 原生/JS 启动区分 | 正常 package:check、隔离包、JS 无执行位行为回归通过 |
| F11 | 源码领域职责选择与事实审计共用源码解析，包契约独立 | 无 dist 副本独立运行源码测试/事实审计，应用 cases 全量仍执行 |
| F12 | 基础消费者直接引用 calendar 叶实现，公开聚合保留 | 新进程 profile/input 从 78 个加载 URL 降为 3，星盘依赖为 0 |
| F13 | 工程 TS 纳入严格门禁；基准输入正式类型并验证工作量 | 15 入口闭包与 typecheck 通过，三年扫描 18 簇/18 动态事实 |

F01 没有推广成全术式通用框架；F04 不改 prompt summary 的独立语义；F11 不机械替换所有测试导入。这些范围是本轮有意保留的边界，不宣称全仓所有重复已经消失。

### F09：AI 流事件与取消

- 代理按完整 SSE 事件读取，循环和 decoder flush 共用同一个处理函数；支持多行 data、跨 UTF-8 分片和末尾无换行的 DONE。
- 损坏 JSON、null/数组事件明确返回 `AI_UPSTREAM_MALFORMED`，停止转发；后续 DONE 不能覆盖失败。上游显式错误和 EOF 仍保留原有错误类别。
- 客户端在收到正文后取消会关闭 reader；即使 DONE 已在当前 buffer，也不会产生成功或错误回调，finally 移除 signal listener。
- 新增真实 proxy/client 串联测试，网络仅 mock。流/配置/客户端定向 39 项通过，工作流 44 项通过；合并证据 `ai-stream.log` 为 83/83。

### F02：主题配置与 URL

主题读取边界与页面生成使用规范选择；合参自定义动作完整清理两体系的旧主题。定向测试覆盖旧状态应用 patch、URL 往返、有效 selection 与最终任务书，避免只检查局部 patch；双人八字显式主题进入任务书，同时保留旧 preset 的关系范围。作者最终 103 项主题/URL/取消联合定向通过。生产构建页面已实际选择事业，再输入家庭沟通自定义问题：两侧主题和旧 preset/shortcut 参数清除，页面回到“随快捷主题”，任务书选择为通用，旧事业任务消失，新问题完整保留。

### F05/F12：请求内复用与基础叶依赖

公开适配器仍独立规范化输入，内部 Bundle 复用已经规范化的数据；范围上下文验证一次后逐秒取样。源码新进程计数为单八字 1 次、四体系 1 次、3 秒区间 4 次规范化／1 次范围验证。内部基础消费者改引既有叶模块，保留 calendar 公开聚合。集中构建后在新的真实包上再次通过计数：公开 profile/input 加载由 78 个模块 URL 降为 3 个，无 astrology/Caelus；公开 calendar 聚合仍加载 77 个，保持其原有能力。最终 23 个相关领域文件以统一源码解析执行，201/201 通过。

### F07：调候荐干共置

349 条无 policy 规则的 recommendationStems（含 199 条显式空数组）直接放回原规则；删除 ID 旁表和拼装覆盖。362 条最终 CLIMATE_RULES 在迁移前后逐项 deepEqual，递归排序对象键且保留数组顺序后的 SHA-256 同为 `b592931ca2d4756ac8cdd65af54577bc606c768b2faae8d4bd395f510ca2150e`。29 项调候、破格和取用定向检查通过，不保留第二份长期规则镜像。

### F08：共享任务与消费者取消

每个消费者有自己的取消语义；仍有消费者等待时继续底层计算，全部退出才终止。无 signal 的调用持续拥有请求到任务结束。完整阅读、自选范围和命限加入页面 signal 与 loading，cleanup 阻止写缓存和启动下游任务。15 项正式取消回归通过，包含预取消、无 signal 先后加入、立即重启、跨角色身份及第二人 response/error/timeout 后结算与重试。第二人错误按请求 key 独立记录，第一人晚成功不覆盖它。轻量主线程计算不具备物理中断能力，取消后丢弃输出而不是声称停止 CPU。

生产页面已验证完整阅读的 7,200 秒区间首项能完成并显示正常导航；任务在观察前已完成，未在 GUI 捕获取消时机。浏览器按钮定位有间歇超时，没有把它算作取消成功；复杂共享/失败时序的证据来自真实 cache/工厂加有限 effect 宿主及 SSR 回归，不扩大成完整浏览器取消验收。

### F06：标准事实与内部来源

紫微标准四化的构建与覆盖判定放在一个私有模块共用，额外条件、独立正文、截断和错星宫仍按原契约保留。3 盘×本命/流年/流月的 9 份完整 payload 迁移前后 JSON deepEqual，稳定 SHA-256 为 `23524cb57a569c3374def9519db11cdd6799fb4a6f013ffe3c8e4e312cf4c388`。

旺衰内部记录显式保存 visible-stem/branch-main-qi/hidden-qi 来源，公开旧函数在边界投影为原结构；旧字符串只在兼容输入入口转换。没有用 Symbol、隐藏元数据或额外全局状态替换原文案协议。120 个固定合成四柱结构的完整旺衰、格局、取用和公开 root/support/constraint JSON 前后 deepEqual，稳定 SHA-256 为 `934d99dc60bae2b1ce65a2e1cc787c48980cc1f5c5ae272cb6f061324e963bff`。最后通过统一源码解析运行 23 个相关领域文件，201/201 通过；其中来源文案与紫微覆盖/合参变异组合 85/85，包含全角/ASCII 括号变化和缺项、截断、错星、错宫、附加条件及独立正文。核心集中构建、完整回归与穷举均通过。

### F10/F11/F13：工程门禁与验证职责

工程类型入口包含 server、工程 TS 脚本及全部 Vite 配置；修正旧基准输入后，在计时前验证 18 个动态簇/18 条动态事实确已产生。JS pnpm 入口用当前 Node 启动，原生入口直接执行，保留独立命令与高层准备/消费分离。

源码领域验证与事实审计共用薄 runner，从既有 exports 派生源码路径，每进程使用独立临时配置；tarball 消费不使用 alias。核心测试以职责选择 231 个领域文件；旧文本选中的 363 文件中保留 229，134 个应用/工程/跨入口文件仍由根 CI glob 完整执行，另补 2 个通过 fixture 间接依赖核心的领域文件。应用 cases 和 Qimen 消费者的迁移保持原断言与注册。

交叉审阅期间发现并修正了主题旧链接、单紫微流时、历史年份默认定位、请求身份重复解析、包管理器 JS 权限和 fresh checkout 生成数据等边界问题；这些不是以降低断言来消除。

## 集中验证结果

主环境为 Node 24.21.0 / pnpm 11.9.0 / macOS arm64。下面均为本轮实际执行，日志在 `.local/audits/2026-10-26-fixes/`。命令带 `:run` 表示消费前面已构建/准备的同一快照。

| 检查 | 最终结果 | 日志 |
| --- | --- | --- |
| `pnpm build:prepare`、最终 `pnpm core:build` | 通过 | build-prepare / core-final |
| `pnpm typecheck:run` | 通过，含 app/工程/MCP | typecheck-final |
| `pnpm lint`、`pnpm format:check` | 通过；lint 0 error、3 条原有 warning | lint-final / format-final |
| `pnpm test:ci:run` 完整重跑 | **4131/4131**，0 fail/skip/cancel | regression-final |
| `pnpm test:exhaustive:run` | **9/9** | exhaustive |
| 六文件真实协议/分页/客户端/未知时辰组合 | **60/60** | protocol-final |
| 主题/URL/取消/应用父注册组合 | **98/98**，另作者最终组合 103/103 | ui-control |
| 隔离副本独立 `test:core` | **2131/2131**，231 个领域文件 | fresh-source-installed |
| 同副本独立 `prompt:audit` | 通过，结束仍没有核心 dist | fresh-source-installed |
| Web、Node、MCP 构建 | 全部通过 | web-build / server-build / mcp-build |
| Pages Functions 编译及 25 MiB 门禁 | 通过，22,736,972 / 26,214,400 字节 | pages |
| 正常原生 `pnpm package:check` 完整入口 | **通过**，不再依赖替代 JS 绕行 | package-standalone |
| MCP tarball 隔离消费、Node 整站运行 | 通过 | mcp-package / node-runtime |
| Vite/Webpack 打包消费 | 通过，面向浏览器打包后在 Node 执行 | browser-contract |
| Node 22 服务/MCP/核心包三项 | 通过，不含项目完整回归 | node22-runtime / node22-mcp / node22-core |
| Android sync、JVM、debug APK | **8/8 JVM**；APK 21,802,315 字节 | android-sync / android |
| 基准 `--validate-only` | 通过，18 簇/18 动态事实 | benchmark-valid |

无产物隔离副本复制当前受控与未忽略的新文件，排除 dist 和生成源码数据，再独立 frozen-lockfile 安装。源码入口自行生成所需数据并完成测试/事实审计，结束时仍无 dist；没有删除或改动原工作区数据。第一版夹具链接 node_modules 被 pnpm 布局检查拒绝，改为独立安装后通过，未将该夹具失败归为产品缺陷。

完整回归首轮 4131 项有两失败：一个范围/点输入完整事实对照遗漏显式 full，另一个审计链接仍指向已删除旁表。仅补对照调用的 detailMode=full 并更新历史引用，原强 deepEqual 保留；最终完整重跑 4131 全过。首轮 lint/format 只暴露尚在收尾的 API/MCP 格式错误，规范化后正式门禁通过，没有关闭规则。

### 输出与维护点的可核对变化

| 项目 | 修复前 | 修复后 |
| --- | --- | --- |
| 八字默认盘面 JSON | 69,338 字节，REST 显式 compact 为 5,259 | REST/MCP 省略及 compact 均 5,259 |
| 紫微默认盘面 JSON | 354,969 字节，REST 显式 compact 为 6,755 | REST/MCP 省略及 compact 均 6,755 |
| 奇门默认盘面 JSON | 32,475 字节，REST 显式 compact 为 14,403 | REST/MCP 省略及 compact 均 14,443，补保留 method/juMethod |
| 四体系单点规范化 | 5 次 | 1 次 |
| 三秒区间规范化／范围验证 | 10／4 次 | 4／1 次 |
| 窄输入入口模块加载 | 78 个 URL，含星盘引擎/数据 | 3 个 URL，无星盘运行依赖 |
| 核心 tarball | 4,824,752 字节 | 4,823,194 字节，75 个 exports 保持 |
| 完整客户端消费示例 JS | 4,519,077 字节 | 4,515,727 字节，仍接近 4.6 MB 预算 |

full 三体系新样本为 129,739 / 422,059 / 260,229 字节，并与核心完整结果逐项深等。字节只计当前固定输入盘面，不计协议封装/计时，不是首屏下载量；八字当前日期相关输出不能简单当作静态前后压缩收益。内部重复维护点减少与算法正确性分别验收，不把调用次数或包差值换算成速度收益。

## 复现与交付边界

先准备一次，后续各门禁消费该快照：

```bash
pnpm build:prepare
pnpm typecheck:run
pnpm test:ci:run
pnpm test:exhaustive:run
pnpm test:core:run
pnpm prompt:audit:run
pnpm build:run
pnpm build:server:run
pnpm build:mcp:run
pnpm package:check:run
pnpm package:check:mcp:run
pnpm lint
pnpm format:check
```

独立入口 `pnpm test:core`、`pnpm prompt:audit` 自行准备源码数据；`pnpm package:check`、`pnpm build`、`pnpm build:server`、`pnpm build:mcp` 自行准备构建产物。`core:data:prepare` 仅生成源码数据，不写 dist。新的 runner 只供源码领域/审计，发布包检查继续从 tarball 隔离安装。

公开兼容说明见 [API 文档](../api.md) 和 [核心变更记录](../../packages/core/CHANGELOG.md)。消费完整 calculate 事实需显式 `detailMode: full`；scope 优先于旧范围字段，旧字段独立使用保留；原生 RangeError 身份继续成立，附加稳定机器字段。MCP 重放耗尽保留 RANDOM_REPLAY_EXHAUSTED，游标越界改为 INVALID_ARGUMENTS、retryable=false，并附 category/field/recoverable；公开文档已明确这些代码迁移。补充迁移说明后，核心与 MCP 两项真实包契约再次通过，预算值保持不变。未修改锁文件、公开 exports 或依赖版本，未提交、推送、上线或调用真实模型。

没有 Docker CLI，未执行镜像/容器；Android 只验证 JVM 和 debug，未跑真机/仪器或签名 release；Node 22 只验证三项运行/包消费，完整回归主要 Node 24，Node 18 未实测。浏览器只证明已执行的主题转换和区间完成状态，取消/error/timeout 等时序由正式控制层/有限宿主回归覆盖，未声称全页面 GUI 验收。该批完成时停止了本地服务，原始日志、依赖及构建产物保留供复核。后续用户要求继续运行并排查样式，当前预览按下节保持运行。

## 后续：默认字体与提示词布局

用户反馈字体和部分界面样式异常后，已重新运行并实际复现。先前基础字体、CSS 导入及结果页渲染结构与审计基线相同，没有找到维护修复有意切换字体的证据；当前环境缺少声明中优先的 Noto Sans SC/微软雅黑，通用 sans-serif 与 serif 的实测回退相同，导致界面中文呈衬线效果。

- `src/styles.css`：默认字体改用 system-ui、平台系统字体及苹方/冬青黑体等明确回退，表单与导航继承一致。
- `src/workspace-ui.css`：修复工作区 56:44 固定分行使操作区向上溢出；操作区按内容占高，预览保留最低可用空间并独立滚动，额外导航挤占窗口时外层可滚动。正文使用 `contain: size` 阻断长文本撑大父级内在尺寸。

最终生产构建通过，两份 CSS 的 Prettier 与 diff 检查通过。实际验收首页、八字表单、普通合参及完整区间提示词：1280×720、1280×600、390×844 均无预览/操作区重叠或页面横向溢出。16,195 字完整资料保持在可滚动预览中，操作区约 274px（桌面）／223px（手机），不再被压成 136px 或被全文拉到数千像素。截图与计算尺寸证据留在 `.local/audits/2026-10-26-fixes/ui-style-validation.json` 及浏览器 artifacts。

该轮只补两份 CSS，没有重跑算法全量；此前 4131 项结果属于上一批实现验证。之后用户指出桌面“返回盘面”应在左侧，已在 `src/workspace.css` 为页头设置完整宽度并移除左右 auto margin。生产构建与 CSS 格式检查通过，截图及几何检查确认按钮左边缘与内容区一致，手机左上返回入口保留。

第二轮视觉检查覆盖首页、八字表单、即时盘、提示词、历史及设置，并检查 1280×720、1280×600、390×844、320×640。没有发现上述字体、初始布局重叠或桌面返回居中复发；仍有手机提示词入口固定显示“AI”、历史入口缺少返回当前盘面路径两项界面/导航问题尚未修复。首页排盘要求先填问题属于显式流程差异；弹层开关后的滚动位置变化受浏览器执行异常影响，原因待复核。案例、帮助和部分滚动路径未完成有效验收，不能宣称整站视觉通过。完整截图与逐项记录保存在被忽略的 `.local/audits/2026-10-26-visual-round2/`。

以上未提交、推送或发布的说明记录各验证阶段结束时的状态；用户随后另行授权将当前修复提交、推送到 GitHub 并合并已有 PR。生产预览保持在 http://127.0.0.1:4174/，内置 AI 关闭。
