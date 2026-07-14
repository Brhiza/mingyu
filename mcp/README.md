# 命语 MCP Server

让 AI 直接调用命语的排盘引擎和一站式提示词工具，无需手动复制排盘 JSON。

## 支持的 Tool

| Tool 名称                    | 功能         | 说明                                                                           |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `calendar_true_solar_time`   | 真太阳时换算 | 返回校正时间、经度修正、均时差、跨日状态和对应时辰，可选校正中国历史夏令时     |
| `foundation_capabilities`    | 地基能力目录 | 返回天干地支、六十甲子、六旬旬首、十二时辰、五行、八卦、二十四山与通用神煞     |
| `foundation_ganzhi`          | 干支资料     | 返回单个六十甲子的纳音、藏干、五行与合冲刑害破                                 |
| `foundation_wuxing`          | 五行分析     | 统计天干地支五行分布，可选计入藏干权重                                         |
| `bazi_calculate`             | 八字排盘     | 输入出生信息，返回四柱、十神、藏干、大运、神煞、旺衰分析                       |
| `bazi_prompt`                | 八字提示词   | 八字排盘并返回可直接用于 AI 解读的结构化提示词                                 |
| `bazi_compatibility`         | 八字双盘     | 返回双方命盘、四柱交叉关系、双向十神、喜忌覆盖与证据包                         |
| `bazi_compatibility_prompt`  | 双盘提示词   | 八字双盘计算并返回可直接用于 AI 解读的完整证据任务书                           |
| `ziwei_calculate`            | 紫微斗数排盘 | 输入出生信息，返回星盘、宫位、大限、流年数据                                   |
| `ziwei_prompt`               | 紫微提示词   | 紫微斗数排盘并返回可直接用于 AI 解读的结构化提示词                             |
| `ziwei_compatibility`        | 紫微双盘     | 返回双方本命盘、关键宫位叠盘、生年四化跨盘落宫与证据包                         |
| `ziwei_compatibility_prompt` | 双盘提示词   | 紫微双盘计算并返回可直接用于 AI 解读的完整证据任务书                           |
| `bazi_ziwei_prompt`          | 八字紫微合参 | 同一出生信息同时返回八字、紫微数据和合参解读提示词                             |
| `divine_liuyao`              | 六爻起卦     | 基于当前时间或自定义时间生成完整六爻卦象                                       |
| `liuyao_prompt`              | 六爻提示词   | 六爻起卦并返回用神作用链、逐爻证据及可直接用于 AI 解读的结构化提示词           |
| `divine_meihua`              | 梅花易数起卦 | 支持时间/数字/随机三种起卦方式，兼容旧 timeTrigram 参数                        |
| `meihua_prompt`              | 梅花提示词   | 梅花起卦并返回主互变体用推进证据及可直接用于 AI 解读的结构化提示词             |
| `divine_xiaoliuren`          | 小六壬起课   | 支持时间/数字/随机三种起课方式，返回三段宫位与行动倾向                         |
| `xiaoliuren_prompt`          | 小六壬提示词 | 小六壬起课并返回可直接用于 AI 解读的结构化提示词                               |
| `divine_qimen`               | 奇门遁甲排盘 | 返回九宫盘及值符值使、日时干候选宫、宫间作用、反证与触发条件                   |
| `qimen_prompt`               | 奇门提示词   | 返回不含数字评分的用神宫证据及可直接用于 AI 解读的结构化提示词                 |
| `divine_liuren`              | 大六壬排盘   | 基于当前时间或自定义时间排大六壬课盘                                           |
| `liuren_prompt`              | 大六壬提示词 | 大六壬排盘并返回四课取传、三传推进证据及可直接解读的结构化提示词               |
| `divine_tarot`               | 塔罗抽牌     | 78 张塔罗，支持单牌/时间流/爱情/事业/选择牌阵                                  |
| `tarot_prompt`               | 塔罗提示词   | 塔罗抽牌并返回可直接用于 AI 解读的结构化提示词                                 |
| `divine_ssgw`                | 灵签求签     | 模拟传统摇签、掷筊流程，圣杯确认后方出签；三连阴杯则拒绝起卦，返回 ritual 记录 |
| `ssgw_prompt`                | 灵签提示词   | 三山国王灵签求签（含传统掷筊流程）并返回可直接用于 AI 解读的结构化提示词       |
| `divine_almanac`             | 黄历择日     | 按事项、参与人冲突、时辰和现实限制返回可用、条件与慎用候选                     |
| `almanac_prompt`             | 择日提示词   | 返回不含数字评分的透明约束证据及可直接用于 AI 解读的结构化提示词               |
| `divine_lenormand`           | 雷诺曼抽牌   | 支持单牌、三牌、五牌十字、关系、选择、九宫、元素和大桌牌阵                     |
| `lenormand_prompt`           | 雷诺曼提示词 | 雷诺曼抽牌并返回可直接用于 AI 解读的结构化提示词                               |
| `divine_astrolabe`           | 星盘生成     | 根据出生时间、经纬度和时区生成星体、宫位与相位数据                             |
| `astrolabe_prompt`           | 星盘提示词   | 星盘生成并返回可直接用于 AI 解读的结构化提示词                                 |
| `astrolabe_synastry`         | 西占双盘     | 返回双方本命盘、跨盘相位、精确角距、容许度、跨盘落宫与证据包                   |
| `astrolabe_synastry_prompt`  | 双盘提示词   | 西占双盘计算并返回可直接用于 AI 解读的证据任务书                               |
| `metaphysics_bazhai`         | 八宅排盘     | 返回命卦、宅卦、大游年方位、磁北/真北换算、测量误差与候选坐向                  |
| `bazhai_prompt`              | 八宅提示词   | 八宅排盘并返回含测量稳定性和证据边界的 AI 解读提示词                           |
| `metaphysics_zodiac`         | 生肖流年     | 返回犯太岁、贵人、五行关系和运程等级                                           |
| `zodiac_prompt`              | 生肖提示词   | 生肖流年排盘并返回可直接用于 AI 解读的提示词                                   |
| `metaphysics_taiyi`          | 太乙五计     | 按年、月、日、时、分五计的积数和阴阳遁返回七十二局式盘                         |
| `taiyi_prompt`               | 太乙提示词   | 太乙排盘并返回可直接用于 AI 解读的提示词                                       |
| `metaphysics_qizheng`        | 七政四余     | 返回逐星来源、UTC上下文、坐标换算、宿度、紫炁模型、十二宫和精度分层            |
| `qizheng_prompt`             | 七政提示词   | 返回含主证、辅证、模型差异和输入缺省限制的七政四余提示词                       |

七政四余相位保留实际夹角、精确角、偏差、容许度位置、紧密等级与精度分层，不返回由容许度位置重复换算的百分制强度。

## 工具选择指南

需要 AI 继续解读时，优先调用 `*_prompt` 工具；只需要结构化数据、表格展示或二次计算时，才调用 `*_calculate` 或 `divine_*` 工具。提示词工具返回结构统一为 `result` 和 `prompt`，通常直接把 `prompt` 交给当前 AI 继续作答即可。

默认优先级：

1. 用户提供完整出生信息，并询问人生、事业、财运、婚恋、亲子、健康、迁居、学习、考试、合作、近期趋势或某一年某阶段走势时，优先调用 `bazi_ziwei_prompt`。这是深度解读首选工具，用八字定主线，用紫微校验宫位、四化、三方四正和运限。
2. 用户明确只看单人八字时调用 `bazi_prompt`；询问两人婚恋、合作或亲属互动时调用 `bazi_compatibility_prompt`；长期或完整阶段分析优先传 `baziFortuneScope: "full"`。出生时间由输入约束保证符合排盘要求，不基于模糊时间范围继续排盘。
3. 用户明确只看紫微时，调用 `ziwei_prompt`；长期或完整阶段分析优先传 `promptScope: "full"`。
4. 用户问单件事情当前能否推进、对方态度、短期成败或应期，优先调用 `liuyao_prompt`；涉及项目路径、方位、谈判、出行和时空窗口时，优先调用 `qimen_prompt`。
5. 用户要从日期范围里选日子，调用 `almanac_prompt`；日期范围或参与人较多时使用分页参数。
6. 用户提供一人的西方占星资料时调用 `astrolabe_prompt`；提供双方完整资料并询问关系时调用 `astrolabe_synastry_prompt`。
7. 用户没有出生信息，只想要轻量启发、牌阵或签文时，用 `tarot_prompt`、`lenormand_prompt` 或 `ssgw_prompt`。
8. 用户明确要求八宅、生肖犯太岁、太乙或七政四余时，使用对应的 `*_prompt` 工具；只要原始排盘则使用 `metaphysics_*`。

常见问题到工具：

| 用户问题类型                     | 首选工具                    | 推荐参数                                                                 |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| 整体人生、长期事业、财运、婚恋   | `bazi_ziwei_prompt`         | `baziPromptTopic`、`ziweiPromptTopic`、`promptScope: "full"` 或 `origin` |
| 今年运势、当前阶段、某年趋势     | `bazi_ziwei_prompt`         | `promptScope: "yearly"`，主题按事业、财运、感情等选择                    |
| 换工作、创业、合伙、投资         | `bazi_ziwei_prompt`         | `job-change`、`startup-partnership`、`investment-partnership`            |
| 八字格局、用神、大运流年         | `bazi_prompt`               | `promptTopic`、`baziFortuneScope`                                        |
| 紫微宫位、四化、运限             | `ziwei_prompt`              | `promptTopic`、`promptScope`                                             |
| 一事一问、短期成败、应期         | `liuyao_prompt`             | `question`、可选 `customDate`                                            |
| 项目推进、方向、方位、谈判       | `qimen_prompt`              | `question`、可选 `qimenMethod`、`customDate`                             |
| 临时小事快速判断                 | `xiaoliuren_prompt`         | `question`、可选 `xiaoliurenMethod`、`xiaoliurenNumber`                  |
| 时间或数字象意判断               | `meihua_prompt`             | `question`、可选 `method`、`number`、`customDate`                        |
| 传统复杂事项推演                 | `liuren_prompt`             | `question`、可选 `liurenTemplate`、`customDate`                          |
| 结婚、搬家、开业、签约、安葬择日 | `almanac_prompt`            | `topic`、`startDate`、`endDate`、可选 `participants`、`page`、`pageSize` |
| 星盘本命和行运                   | `astrolabe_prompt`          | 出生时间地点、经纬度、`astrolabeTopic`、`astrolabeScope`                 |
| 西占双方关系、合作或婚恋互动     | `astrolabe_synastry_prompt` | `person1`、`person2` 分别提供完整出生时间、经纬度和时区                  |
| 牌阵启发                         | `tarot_prompt`              | `spreadType`、`question`                                                 |
| 雷诺曼关系或选择牌阵             | `lenormand_prompt`          | `spreadType`、`question`                                                 |
| 求签                             | `ssgw_prompt`               | `question`                                                               |

出生时辰未知时，不要自行补时辰。八字可以保守分析；紫微和八字紫微合参需要时辰，优先请用户补足后再调用。

## 快速开始

### 1. 安装项目

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
npm install
```

### 2. 本地启动测试

```bash
npm run mcp
```

### 3. 在 Claude Desktop 中配置

打开 Claude Desktop 设置 -> Developer -> Edit Config，编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "mingyu": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "C:\\Users\\Administrator\\Documents\\GitHub\\mingyu"
    }
  }
}
```

> 请将 `cwd` 替换为你本地项目的实际路径。

### 4. 重启 Claude Desktop

配置完成后重启 Claude Desktop，在对话中即可看到命语的工具图标。你可以直接让 Claude 调用排盘工具。

## 使用示例

在 Claude Desktop 中直接说：

- "帮我排一下 1990 年 5 月 15 日丑时出生的八字"
- "用八字提示词工具，问我适合创业还是上班"
- "用八字盲派流派解读 1990 年 5 月 15 日丑时八字的事业运"
- "用紫微飞星派解读 1992 年 8 月 21 日辰时女性的 2025 年事业财运"
- "用八字紫微合参看 1992 年 8 月 21 日辰时女性现在适不适合换工作"
- "用紫微斗数排盘看 1992 年 8 月 21 日辰时女性的命盘"
- "用六爻提示词工具起一卦，问今年事业运势如何"
- "用小六壬数字起课，数字 18，问这件事能不能推进"
- "抽一张塔罗牌并生成提示词，看看我近期的感情走向"
- "用奇门遁甲提示词工具排个盘，问这次投资能不能成"
- "用奇门飞盘法排盘，问这个项目的方向"
- "用 2025-01-01 08:30 北京时间排奇门盘，问这个项目现在适不适合推进"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合签约"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合安葬"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合修造动土"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合修造动土"
- "用雷诺曼关系牌阵看看这段关系下一步怎么走"
- "用星盘提示词工具，按北京出生经纬度看我的事业发展"

只需要结构化数据时调用 `*_calculate` 或 `divine_*` 工具；需要完整 AI 解读提示词时调用 `*_prompt` 工具。

### 出生时间参数

八字和紫微工具默认使用 `timeIndex` 表示出生时辰，范围为 `0` 到 `12`，其中 `0` 为早子时，`12` 为晚子时。

需要启用真太阳时校正时，传入 `useTrueSolarTime: true`，并提供 `birthHour`、`birthMinute`、`birthLongitude`；此时可以不传 `timeIndex`，工具会按校正后的真太阳时自动换算时辰。八字工具的精准时间和经度使用数字，紫微工具与公开 API 保持一致，使用字符串。

### 八字命限提示词参数

`bazi_prompt` 可通过 `baziFortuneScope` 指定命限范围：`natal`（本命）、`full`（完整输出版）、`dayun`（大运）、`year`（流年）、`month`（流月）、`day`（流日）。`full` 会写入完整大运与逐年流年，不需要再传具体年限参数。

选择 `dayun`、`year`、`month`、`day` 时，可配套传入 `baziFortuneCycleIndex`、`baziFortuneYear`、`baziFortuneMonth`、`baziFortuneDay`。

### 起卦与排盘时间参数

六爻、梅花易数、小六壬、奇门遁甲、大六壬工具默认使用当前时间。需要复盘历史时刻、按用户指定时间起卦，或让本地 MCP 与网页端自定时间保持一致时，传入 `customDate`。

`customDate` 必须是带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:30:00+08:00`。适用工具包括 `divine_liuyao`、`liuyao_prompt`、`divine_meihua`、`meihua_prompt`、`divine_xiaoliuren`、`xiaoliuren_prompt`、`divine_qimen`、`qimen_prompt`、`divine_liuren`、`liuren_prompt`。

### 小六壬数字起课参数

小六壬工具使用 `xiaoliurenMethod: "number"` 时，需要提供 `xiaoliurenNumber` 正整数。未提供时工具会返回参数错误；不传 `xiaoliurenMethod` 时默认按当前时间起课。

### 黄历择日参数

黄历择日工具需要提供 `startDate`、`endDate`。日期使用 `YYYY-MM-DD` 格式，一次最多比较 31 天。`topic` 可选，支持 `marriage`（订婚结婚）、`move`（搬家入宅）、`opening`（开业启动）、`contract`（签约合作）、`travel`（出行赴任）、`medical`（就医手术）、`study`（考试学习）、`burial`（安葬修坟）、`renovation`（修造动土）、`custom`（自定义），不传时使用 `custom`。`participants` 可选，每个参与人包含 `id`、`name`、`gender`、`year`、`month`、`day`、`timeIndex`、`dateType`、`isLeapMonth`。

### 奇门遁甲排盘方法

奇门遁甲工具支持 `qimenMethod` 参数：`zhuanpan`（转盘法，默认）或 `feipan`（飞盘法）。
返回结果会包含 `seasonality`（节气三元、节气五行、月相、建除十二神、四柱干支互动）和 `patternCombos`（吉凶叠加、吉格逢空、伏吟反吟叠马星等复合格局），提示词工具会把这些字段作为解读证据。

### 八字流派与紫微流派

`bazi_prompt` 工具支持 `school` 参数：`traditional`（传统派子平正法）、`mangpai`（盲派十神象法）、`xinpai`（新派调候流通）。不传则不附加流派指引。

`ziwei_prompt` 工具支持 `school` 参数：`sanhe`（三合派三方四正）、`feixing`（飞星派四化飞星链路）、`sihua`（四化派生年四化主线）。不传则不附加流派指引。

`bazi_ziwei_prompt` 工具使用同一份出生信息，同时计算八字和紫微斗数。它支持 `baziPromptTopic`、`ziweiPromptTopic`、`promptScope`、`promptMode`、`baziSchool`、`ziweiSchool`，适合需要先用八字判断命局主线，再用紫微校验宫位、四化和运限的深度问题。

### 紫微 promptScope 参数

`ziwei_calculate` 和 `ziwei_prompt` 默认只返回 `origin`（本命）范围。传入 `promptScope` 时会返回 `origin` 加指定范围。支持的值：`origin`、`full`、`decadal`、`yearly`、`monthly`、`daily`、`hourly`、`age`。`full` 会返回并写入本命、大限、流年、流月、流日、流时资料。

`ziwei_compatibility` 和 `ziwei_compatibility_prompt` 只计算双方静态本命盘的宫位叠盘与生年四化跨盘落点。它们不会伪造具体年份应期，也不会输出缺乏统一依据的匹配总分。

### 雷诺曼牌阵参数

雷诺曼工具的 `spreadType` 支持 `single`、`three`、`five`（五牌十字阵）、`relationship`、`decision`、`nine`、`element`（四元素牌阵）、`grandTableau`（大桌牌阵），不传时默认使用单牌线索。

### 星盘参数

星盘工具需要提供 `year`、`month`、`day`、`hour`、`minute`、`latitude`、`longitude`，并至少提供 `timezone` 或 `timeZoneId`。国际地点及历史日期推荐传 IANA 时区（如 `Asia/Shanghai`、`America/New_York`），以识别历史夏令时、回拨歧义和跳时缺口；同时传固定偏移时会保留冲突诊断。`gender` 使用 `男`、`女` 或空字符串，`locationName` 可选；可传 `useTrueSolarTime` 启用真太阳时校正。

西占双盘工具使用 `person1`、`person2` 分别传入上述星盘参数。结果中的跨盘相位、实际夹角、精确角、偏差、允许容许度、紧密等级和落宫属于可复核盘面事实；结果不返回百分制相位强度，避免被误读为关系概率、匹配率或吉凶百分比，也禁止把单一相位写成必然结果。

## 在其他 MCP 客户端中使用

任何支持 MCP 协议的客户端都可以使用，如 Cursor、Cline、Windsurf 等。

配置方式类似：指定启动命令为 `npm run mcp`，工作目录为项目根目录即可。

## 工作原理

MCP Server 通过 stdio transport 与 AI 客户端通信：

1. AI 客户端启动 `npm run mcp`
2. MCP Server 注册排盘 tool 和一站式提示词 tool
3. AI 根据对话内容决定调用哪个 tool
4. MCP Server 执行排盘引擎，返回结构化 JSON 数据
5. 使用提示词 tool 时，MCP Server 同时返回排盘结果和结构化 AI 提示词

无需网络端口、无需额外配置，开箱即用。
