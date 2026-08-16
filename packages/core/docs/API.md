# mingyu-core API 参考文档

本文档列出 `mingyu-core` 所有公开模块的函数签名与主要类型字段。

> ⚠️ **免责声明**：本库仅提供算法实现，结果仅供参考与娱乐，不构成任何命理预测或专业建议。

---

## 目录

- [八字 Bazi](#八字-bazi)
- [六爻 Liuyao](#六爻-liuyao)
- [梅花易数 Meihua](#梅花易数-meihua)
- [奇门遁甲 Qimen](#奇门遁甲-qimen)
- [大六壬 Liuren](#大六壬-liuren)
- [择日 Almanac](#择日-almanac)
- [灵签 SSGW](#灵签-ssgw)
- [塔罗 Tarot](#塔罗-tarot)
- [西洋占星 Astrolabe](#西洋占星-astrolabe)
- [紫微斗数 Ziwei](#紫微斗数-ziwei)
- [统一客户端 Client](#统一客户端-client)
- [历法 Calendar](#历法-calendar)
- [统一出生档案 Profile](#统一出生档案-profile)
- [出生盘 Bundle](#出生盘-bundle)
- [双人合盘 Bundle](#双人合盘-bundle)
- [提示词与摘要 Prompt](#提示词与摘要-prompt)
- [地点索引 Location](#地点索引-location)

---

## 八字 Bazi

导入：`import { ... } from 'mingyu-core/bazi'`

### `baziCalculator.calculateBazi(person)`

主排盘函数，返回完整的八字命盘。

**参数 `person`：**

| 字段               | 类型                            | 必填 | 说明                                                                           |
| ------------------ | ------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `year`             | `number`                        | ✅   | 公历或农历年（1900-2100）                                                      |
| `month`            | `number`                        | ✅   | 月（1-12）                                                                     |
| `day`              | `number`                        | ✅   | 日                                                                             |
| `timeIndex`        | `number`                        | ✅*  | 时辰索引 0-12（0=早子，1=丑...11=亥，12=晚子）                                 |
| `gender`           | `'male' \| 'female'`            | ✅   | 性别                                                                           |
| `isLunar`          | `boolean`                       |      | 输入是否农历，默认公历                                                         |
| `isLeapMonth`      | `boolean`                       |      | 农历是否闰月                                                                   |
| `useTrueSolarTime` | `boolean`                       |      | 启用真太阳时                                                                   |
| `birthHour`        | `number`                        | *    | 真太阳时模式下的小时（0-23）                                                   |
| `birthMinute`      | `number`                        | *    | 真太阳时模式下的分钟（0-59）                                                   |
| `birthLongitude`   | `number`                        | *    | 出生地经度（-180~180）                                                         |
| `timezone`         | `number`                        |      | 当地标准时区（UTC-12~UTC+14），默认 UTC+8；影响标准经线                        |
| `timeZoneId`       | `string`                        |      | IANA 历史时区；按出生日期解析当时的法定 UTC 偏移                               |
| `applyChinaDst`    | `boolean`                       |      | 旧固定偏移调用是否校正中国夏令时（1986-1991），默认关闭；推荐改用 `timeZoneId` |
| `shenShaScope`     | `'common' \| 'all'`             |      | 神煞输出范围；默认 `common` 返回 55 个常用神煞，`all` 返回全部已计算神煞       |
| `shenShaVariants`  | `Partial<ShenShaVariantConfig>` |      | 神煞争议口径配置；不传时使用默认主流口径                                       |

\* `timeIndex` 与真太阳时三参数二选一。

**神煞争议口径 `shenShaVariants`：**

神煞默认使用 `shenShaScope: 'common'`，并将简称统一为完整名称；需要研究、审计或兼容旧调用时显式传入 `shenShaScope: 'all'` 获取未裁剪的全部计算结果。

| 字段            | 默认值            | 可选值                                | 说明                                                     |
| --------------- | ----------------- | ------------------------------------- | -------------------------------------------------------- |
| `kongWangBasis` | `day`             | `day` / `day-and-year`                | 空亡默认只按日柱旬空；兼容口径可同时参考年柱旬空         |
| `yangRenMode`   | `yang-stems-only` | `yang-stems-only` / `include-yin-ren` | 羊刃默认只取阳干帝旺；兼容口径可把阴干帝旺位作为阴刃并入 |
| `tongZiScope`   | `day-hour`        | `day-hour` / `all-pillars`            | 童子煞默认只查日柱、时柱；兼容口径可四柱同查             |

**返回 `BaziChartResult`：**

| 字段                 | 类型                                       | 说明                                                                                       |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `pillars`            | `Pillars`                                  | 四柱（year/month/day/hour，每柱含 gan/zhi/ganZhi）                                         |
| `dayMaster`          | `{ gan, element, yinYang }`                | 日主（天干/五行/阴阳）                                                                     |
| `tenGods`            | `Record<string,string>`                    | 各柱天干十神                                                                               |
| `hiddenStems`        | `HiddenStems`                              | 各柱地支藏干                                                                               |
| `hiddenTenGods`      | `Record<string,string[]>`                  | 藏干十神                                                                                   |
| `wuxingStrength`     | `WuxingStrengthDetails`                    | 五行强度（分数/百分比/缺失）                                                               |
| `shensha`            | `ShenShaResult`                            | 各柱神煞                                                                                   |
| `nayin`              | `Nayin`                                    | 各柱纳音                                                                                   |
| `kongWang`           | `KongWangResult`                           | 各柱空亡                                                                                   |
| `luckInfo`           | `LuckInfo`                                 | 大运信息（起运/交运/各步大运+流年）                                                        |
| `mingGua`            | `MingGuaProfile`                           | 命卦（八宅，按立春年界计算）                                                               |
| `mingGong`           | `string`                                   | 命宫                                                                                       |
| `shenGong`           | `string`                                   | 身宫                                                                                       |
| `taiYuan`            | `string`                                   | 胎元                                                                                       |
| `taiXi`              | `string`                                   | 胎息                                                                                       |
| `lifeStages`         | `Record<string,string>`                    | 各柱十二长生                                                                               |
| `wuxingSeasonStatus` | `Record<string,string>`                    | 月令五行旺相休囚死                                                                         |
| `monthCommander`     | `string`                                   | 月令司权天干                                                                               |
| `seasonInfo`         | `SeasonInfo`                               | 节气信息（当前/下一节气、距节气天数）                                                      |
| `analysis`           | `BaziAnalysisResult`                       | 分析结果（见下）                                                                           |
| `zodiac`             | `string`                                   | 生肖                                                                                       |
| `constellation`      | `string`                                   | 星座                                                                                       |
| `solarDate`          | `{ year, month, day }`                     | 公历日期                                                                                   |
| `lunarDate`          | `{ year, month, day, monthName, dayName }` | 农历日期                                                                                   |
| `timing`             | `TimingInfo?`                              | 真太阳时校正明细（启用时）                                                                 |
| `warnings`           | `string[]`                                 | 排盘预警；出生时刻贴近节气交接、时辰边界、23:00 换日线或落于中国夏令时期间等可能翻柱时输出 |

**`analysis`（`BaziAnalysisResult`）：**

| 字段                | 类型                                         | 说明                                      |
| ------------------- | -------------------------------------------- | ----------------------------------------- |
| `dayMasterStrength` | `{ score, status, details }`                 | 日主强度（极弱/身弱/中和/偏强/身强/极强） |
| `mingGe`            | `{ pattern, isSpecial, basis?, isKuiGang? }` | 格局（普通格局名/特殊格局/魁罡）          |
| `usefulGod`         | `UsefulGodAnalysis`                          | 用神（喜用/忌神十神与五行）               |

### 八字增强分析函数

| 函数                                                                                                | 参数                                     | 返回                        | 说明                                                |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------- | --------------------------------------------------- |
| `analyzeTenGodStructure(pillars, dayMaster, getTenGod)`                                             | 四柱、日干、十神函数                     | `TenGodStructureProfile`    | 十神分布与五大家族聚合                              |
| `analyzeStemRootProfile(pillars, dayMaster, getWuxing, getTenGod)`                                  | 四柱、日干、五行函数、十神函数           | `StemRootProfile`           | 透干通根分析（本根/同气根/无根）                    |
| `analyzeExposedStemProfile(pillars, dayMaster, getWuxing, getTenGod, commanderStem?, monthBranch?)` | 同上 + 司令、月支                        | `ExposedStemProfile`        | 透干月令地位与力量                                  |
| `analyzeRelationStructure(pillars)`                                                                 | 四柱                                     | `RelationStructureProfile`  | 地支关系（三合/三会/半合/六合/六冲/六害/三刑/相破） |
| `assessAllHarmonyTransforms(pillars, monthBranch?)`                                                 | 四柱、可选月支                           | `HarmonyTransformProfile[]` | 自动扫描天干五合、地支六合并核验条件                |
| `assessStemHarmonyTransform(stem1, pillar1, stem2, pillar2, monthBranch, allPillars)`               | 天干、柱位、月支、四柱                   | `HarmonyTransformProfile`   | 按日干、紧贴、规定月令、克破与争合核验天干成化      |
| `assessBranchHarmonyTransform(branch1, pillar1, branch2, pillar2, monthBranch, allPillars)`         | 地支、柱位、月支、四柱                   | `HarmonyTransformProfile`   | 评估地支六合及冲破；地支不直接按化神五行成化        |
| `analyzeKongWangProfile(pillars, dayMasterStem)`                                                    | 四柱、日干                               | `KongWangProfile`           | 空亡全分析                                          |
| `analyzeTombStorage(pillars, dayMaster, getWuxing, getTenGod)`                                      | 四柱、日干、五行函数、十神函数           | `TombStorageProfile`        | 辰戌丑未墓库分析                                    |
| `analyzeLifeStageProfile(pillars)`                                                                  | 四柱                                     | `LifeStageItem[]`           | 各柱十二长生                                        |
| `analyzeTenGodLifeStageProfile(pillars, dayMaster, getTenGod)`                                      | 四柱、日干、十神函数                     | `TenGodLifeStageProfile`    | 十神在十二长生的旺弱分布                            |
| `analyzeUsefulGodPlacement(pillars, dayMaster, getTenGod, favorableWuxing, unfavorableWuxing)`      | 四柱、日干、十神函数、喜用五行、忌神五行 | `UsefulGodPlacementProfile` | 用神落点（喜神得力/受制/忌神等）                    |
| `analyzeNayinProfile(pillars)`                                                                      | 四柱                                     | `NayinProfile`              | 各柱纳音五行                                        |
| `analyzeMonthQiProfile(monthBranch, commanderStem?)`                                                | 月支、司令                               | `MonthQiProfile`            | 月令气数（五行旺相休囚死）                          |
| `calculateMingGua(birthYear, gender)`                                                               | 出生年、性别                             | `MingGuaProfile`            | 命卦（东四命/西四命）                               |
| `calculateXiaoYunProfile(solarTime, gender, dayMasterGan, getTenGod)`                               | 太阳时、性别、日干、十神函数             | `XiaoYunProfile`            | 小运（童限逐年干支）                                |
| `buildLuckDirectionProfile(gender, yearStem)`                                                       | 性别、年干                               | `LuckDirectionProfile`      | 大运顺逆方向                                        |

---

## 六爻 Liuyao

导入：`import { generateLiuyao } from 'mingyu-core/divination/liuyao'`

### `generateLiuyao(customDate?)`

**参数：** `customDate?: Date` — 起卦时间，默认当前时间

**返回 `LiuyaoData`：**

| 字段                | 类型                                                          | 说明                                                                                                                                               |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `originalName`      | `string`                                                      | 主卦名（如"乾为天"）                                                                                                                               |
| `changedName`       | `string`                                                      | 变卦名                                                                                                                                             |
| `interName`         | `string`                                                      | 互卦名                                                                                                                                             |
| `yaoArray`          | `number[]`                                                    | 六爻数值（6/7/8/9，老阴老阳少阴少阳）                                                                                                              |
| `changingYaos`      | `Array<{position,isChanging,type}>`                           | 动爻                                                                                                                                               |
| `sixGods`           | `string[]`                                                    | 六神（青龙/朱雀/勾陈/螣蛇/白虎/玄武）                                                                                                              |
| `sixRelatives`      | `string[]`                                                    | 六亲（父母/兄弟/子孙/妻财/官鬼）                                                                                                                   |
| `najiaDizhi`        | `string[]`                                                    | 纳甲地支                                                                                                                                           |
| `wuxing`            | `string[]`                                                    | 各爻五行                                                                                                                                           |
| `worldAndResponse`  | `string[]`                                                    | 世应标记（'世'/'应'/''）                                                                                                                           |
| `voidBranches`      | `string[]`                                                    | 旬空地支                                                                                                                                           |
| `palace`            | `{ name, wuxing }`                                            | 所属宫位                                                                                                                                           |
| `palaceStage`       | `LiuyaoPalaceStage?`                                          | 八宫卦序位置（首卦、一世至五世、游魂、归魂）                                                                                                       |
| `yaosDetail`        | `LiuyaoYaoDetail[]`                                           | 每爻详细；`changeRelations` 分别保存可并见的回头冲、五行生克/比泄耗与化空，`changeRelation` 仅为旧版单值兼容字段；另含月破、日破、暗动、化进退神等 |
| `hiddenSpirits`     | `LiuyaoHiddenSpirit[]?`                                       | 伏神（本宫首卦补未现六亲）                                                                                                                         |
| `hexagramRelations` | `LiuyaoHexagramRelations?`                                    | 整卦六合/六冲及六冲变六合、六合变六冲等卦变关系                                                                                                    |
| `fanfuRelations`    | `LiuyaoFanFuRelations?`                                       | 卦变反吟/伏吟结构，含卦反吟、爻反吟、内外伏吟等标签                                                                                                |
| `specialPattern`    | `'静卦' \| '独静卦' \| '全动卦' \| '乾卦用九' \| '坤卦用六'?` | 特殊卦型                                                                                                                                           |
| `sanheWithDay`      | `{group,members,description}?`                                | 日辰引动三合局                                                                                                                                     |
| `sanxingInYaos`     | `Array<{branches,type}>?`                                     | 三刑检测                                                                                                                                           |
| `ganzhi`            | `BaseGanZhi`                                                  | 起卦时间干支                                                                                                                                       |
| `timestamp`         | `number`                                                      | 时间戳                                                                                                                                             |

---

## 梅花易数 Meihua

导入：`import { generateMeihua } from 'mingyu-core/divination/meihua'`

### `generateMeihua(customDate?, settings?)`

**参数 `settings`：**

| 字段     | 类型                                              | 说明                                                       |
| -------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `method` | `'time' \| 'number' \| 'random' \| 'timeTrigram'` | 起卦法；`timeTrigram` 为历史兼容入口，按年月日时起卦法计算 |
| `number` | `number`                                          | 数字起卦的正整数                                           |
| `seed`   | `string \| number`                                | 随机起卦时可选；同一 seed 可复现同一组随机卦数             |
| `rng`    | `() => number`                                    | 随机起卦时可选；自定义随机源，返回 0 到 1 之间的数         |

**返回 `MeihuaData`：** 含主卦/互卦/变卦、体用关系（`tiGua`/`yongGua`）、按原体方位确定的体互与用互（`interTiGua`/`interYongGua`）、四时旺衰、应期触发条件，以及体用生克分析（`tiYongRelation`、体互/用互对原体关系、`changedRelation`、`yingQi`）。

---

## 奇门遁甲 Qimen

导入：`import { generateQimen, createQimenPriorityPalaces } from 'mingyu-core/divination/qimen'`

### `generateQimen(customDate?, method?, scope?)`

**参数：**

- `customDate?: Date` — 排盘时间
- `method?: QimenMethod` — 排盘方法，`zhuanpan` 为转盘法（默认主流口径），`feipan` 为飞盘法
- `scope?: QimenScope` — 排盘级别，`hour`（默认）、`day`、`month`、`year`

**返回 `QimenData`：** 含完整排盘：定局数（拆补法）、值符值使、九宫格（天地人神四盘）、基础格局标签、经典格局（九遁/三奇得使等）、节令背景、复合格局、宫位洞察、方位吉凶、应期估算（庚格法）、马星落宫、旬空。

新增结构化字段：

| 字段            | 类型                    | 说明                                                                         |
| --------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `seasonality`   | `QimenSeasonalityInfo?` | 当前节气、节气三元、节气五行、日干与节令关系、月相、建除十二神、四柱干支互动 |
| `patternCombos` | `QimenPatternCombo[]?`  | 复合格局，如同宫吉凶叠加、吉格逢空、三奇齐升/齐困、伏吟反吟叠驿马            |

### `createQimenPriorityPalaces(data)`

根据 `QimenData` 里的宫位洞察、经典格局、干关系和方位数据生成重点宫位候选，不再依赖前端解析格局文字标签，也不把不同证据折算成总分。返回项中的旧版 `score` 兼容字段固定为 `0`，已弃用，不代表宫位强弱。

---

## 大六壬 Liuren

导入：`import { generateLiuren } from 'mingyu-core/divination/liuren'`

### `generateLiuren(customDate?)`

**返回 `LiurenData`：** 含月将（中气换将）、昼夜贵人、天地盘、四课、三传（初传/中传/末传，含九宗门取传法）、神煞（驿马/劫煞/亡神/桃花/破碎/天德/月德/天马/日德/禄神/天罗地网）、天将属性（十二天将的五行阴阳颜色五味等）、课体规则、旬空。

---

## 择日 Almanac

导入：`import { generateAlmanacSelection } from 'mingyu-core/divination/almanac'`

### `generateAlmanacSelection(params)`

**参数：** 事项类型（move/marriage/opening/contract/travel/medical/study/burial/renovation/custom）、日期范围、参与人信息（含八字）。

**返回 `AlmanacData`：** 含每日候选评分（基准 60 分，黄历宜忌+建除十二神+神煞+参与人冲克调整）、二十八宿、九星、彭祖百忌、逐日宜忌详情。

---

## 灵签 SSGW

导入：`import { drawRandomSign } from 'mingyu-core/divination/ssgw'`

### `drawRandomSign(customDate?, options?)`

**参数：**

- `customDate?: Date`
- `options?: { seed?: string | number; rng?: () => number }`

**返回 `SsgwData`：** 随机抽取三山国王 92 签之一，返回签号、签题、签诗原文、求签时间与干支。

---

## 塔罗 Tarot

导入：`import { drawSingleCard, drawSpreadCards } from 'mingyu-core/divination/tarot'`

### `drawSingleCard(options?)`

### `drawSpreadCards(spreadType, options?)`

**参数：**

- `spreadType`: `tarotSpreads` 中的牌阵键名；单牌可直接使用 `drawSingleCard`
- `options?: { seed?: string | number; rng?: () => number }`

**返回：** 抽取的牌、牌位、正逆位和时间戳。`tarotSpreads` 只保留牌阵结构，不再附带默认问题。

---

## 西洋占星 Astrolabe

导入：`import { generateAstrolabe } from 'mingyu-core/divination/astrolabe'`

### `generateAstrolabe(input)`

**参数 `input`：** 出生年月日时分、经纬度、时区、可选真太阳时。

**返回 `AstrolabeData`：** 十大行星、四轴（上升/天顶/下降/天底）、Placidus 十二宫、凯龙、四小行星、南北交、莉莉丝、福点/精神点、Top 12 相位（合/六合/刑/拱/冲/半六合/半刑/五分相等）、四元素三形态总结、逆行星。依赖 `celestine`。

### `analyzeAstrolabeSynastry(chart1, chart2, options?)`

导入：`import { analyzeAstrolabeSynastry } from 'mingyu-core/divination/astrolabe-synastry'`

接收两份 `AstrolabeData`，返回双方主要跨盘相位、实际夹角、可配置容许度、相对强度、双方星体落入对方宫位、结构化证据包与明确计算口径。静态本命双盘不推断入相或出相，也不生成缺乏统一依据的关系匹配总分。

---

## 紫微斗数 Ziwei

导入：`import { ... } from 'mingyu-core/ziwei/iztro'`

### 主要导出

| 函数                                                               | 说明                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `buildAstrolabeFromInput(input)`                                   | 由 ChartInput 构建 iztro 盘                                                    |
| `buildHoroscope(astrolabe, dateStr, hourIndex)`                    | 构建运限盘                                                                     |
| `buildAnalysisPayloadV1({astrolabe, horoscope, currentScope})`     | 构建分析数据载荷                                                               |
| `detectPatterns({palaces})`                                        | 评估当前 55 条可复算格局；每项返回固定古籍版本、卷次、原文、命中条件与解释边界 |
| `buildEvidencePool({astrolabe, horoscope, currentScope, palaces})` | 构建证据池                                                                     |

运行时便捷入口：`import { ... } from 'mingyu-core/ziwei/runtime'`

| 函数                                                               | 说明                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `buildZiweiChartInput(draft)`                                      | 将数字或文本表单输入校验并转换为严格的 `ChartInput`；可统一接入真太阳时 |
| `calculateZiweiChart(input, options?)`                             | 一次生成本命盘、指定范围 payload、大限时间线和真太阳时证据              |
| `calculateZiweiChartForScopes(input, scopes?, skipAnalysis?)`      | 兼容旧调用方式，按范围生成紫微运行结果                                  |
| `calculateZiweiPayloadByScope(input, options?)`                    | 只返回指定范围的结构化分析 payload                                      |
| `calculateZiweiDisplayPayload({input, dateStr, hourIndex, scope})` | 按明确日期和时辰生成单个显示范围 payload                                |

`calculateZiweiChart` 默认使用当前时间生成运限资料；需要可复现结果时应显式传入 `horoscopeContext`。`skipAnalysis` 只跳过证据与格局分析，不影响盘面计算。

运限选择便捷入口：`import { buildZiweiFortuneOptions } from 'mingyu-core/ziwei/fortune'`。传入一个童限或大限年龄范围后，可一次得到流年、流月、流日选项及各自干支。八字对应提供 `getCurrentBaziLuckCycle()`、`buildCurrentBaziFortuneSelection()` 和 `buildRecentBaziFortuneSelection()`，可直接生成 `buildFortuneSelectionContext()` 所需选择值；定位与各层列表均按精确交运时刻裁剪，时间范围同时返回结构化本地时间与时间戳。流时默认使用十二时辰，第三个参数传 `{ hourMode: 'splitZi' }` 可兼容旧版早晚子时拆分。目标时间不在命盘已计算的童限或大运范围内时，这三个入口返回 `null`，不会回退到第一步大运。

依赖 `iztro`。十二宫、星曜、亮度、三方四正、运限宫位、运限星曜、四化、自化与宫干飞化均直接读取 `iztro` 原生对象；公开链路与内部完整盘共用同一载荷构建器。原 84 条自定义格局因缺少逐条版本、卷页、原文和独立例盘已整体退役；当前固定版本传统目录登记 87 项，其中 55 条具备卷次、原文和可复算条件，32 项因原文含糊或依赖运限只登记边界、不伪造命中。空列表只表示当前可复算规则未命中，不表示命盘没有其他传统格局。返回类型见 `mingyu-core/types` 的 `analysis.ts`。

---

## 统一客户端 Client

导入：`import { createMingyuClient } from 'mingyu-core/client'`

| 方法                                        | 说明                                                      |
| ------------------------------------------- | --------------------------------------------------------- |
| `birth(profile, options?)`                  | 从统一出生档案生成所选出生盘；默认只计算八字              |
| `compatibility(primary, partner, options?)` | 生成八字、紫微或西占双人合盘资料                          |
| `divination(request)`                       | 生成统一占法会话                                          |
| `normalizeBirth(profile)`                   | 校验并标准化公历/农历、传统时辰、精准时分和真太阳时输入   |
| `trueSolarBirth(input)`                     | 换算出生真太阳时、跨日日期和传统时辰索引                  |
| `astronomicalTime(input)`                   | 换算历史时区、UTC、JD、近似 UT1、ΔT 与 TT                 |
| `moonPhase(utcDateTime)`                    | 计算月相、照明比例及前后朔弦望事件                        |
| `solarTerm(year, index)`                    | 返回单个节气历表时刻与太阳视黄经独立核验                  |
| `solarTerms(year)`                          | 按公历年份返回从小寒至冬至的 24 个节气证据                |
| `solarIllumination(input)`                  | 返回太阳高度、方位、视太阳正午、日出日落和曙暮光          |
| `bazhai(input)`                             | 按出生年与性别或直接命卦生成八宅盘                        |
| `bazhaiByDoorDegree(input)`                 | 从大门面向屋内读数换算山向并生成八宅盘                    |
| `zodiac(input)`                             | 按生肖/年支与公历年或指定干支生成生肖流年关系             |
| `taiyi(input)` / `qizheng(input)`           | 生成太乙年计或七政四余盘                                  |
| `xuankong(input)`                           | 生成玄空下卦三盘                                          |
| `residentialFengshui(input)`                | 按实际资料组合八宅与玄空住宅结果                          |
| `capabilities()` / `capability(id)`         | 查询全部或单项能力声明；未知 ID 明确失败                  |
| `serialize(value)`                          | 输出键顺序稳定的 JSON                                     |
| `safe.*`                                    | 使用相同参数，失败时返回 `{ ok: false, error }`，不抛异常 |

`birth()`、`compatibility()` 及对应 `safe` 方法异步返回，其余方法同步返回。`safe` 错误包含 `code`、`category`、`message`、`recoverable`、`diagnostics` 和可选 `context`；普通表单异常会归入 `validation`，不支持的能力归入 `unsupported`，山向分界等歧义归入 `boundary`，依赖缺失归入 `dependency`。紫微是按调用加载的可选能力：未安装 `iztro` 时仍可正常导入根模块和客户端、计算八字；请求紫微会返回 `IZTRO_DEPENDENCY_REQUIRED`。

---

## 统一出生档案 Profile

导入：`import { ... } from 'mingyu-core/profile'`

统一出生档案同时支持公历、农历、闰月、传统时辰、精确时分、地点和真太阳时。它只负责客观输入与时间口径，不包含页面状态或报告内容。

| 函数                                        | 说明                                                           |
| ------------------------------------------- | -------------------------------------------------------------- |
| `normalizeBirthProfile(profile)`            | 校验并统一出生时间，返回时辰索引、精度、真太阳时证据和诊断     |
| `calculateBaziFromBirthProfile(profile)`    | 直接生成八字传统盘；农历真太阳时只做一次历法换算               |
| `birthProfileToZiweiChartInput(profile)`    | 生成 `mingyu-core/ziwei` 可直接使用的 `ChartInput`             |
| `birthProfileToAstrolabeInput(profile)`     | 生成星盘输入；星盘仍需纬度与精确到分钟的时间                   |
| `birthProfileToQizhengInput(profile)`       | 生成七政四余输入；真太阳时保留原始民用时间交给七政四余引擎校正 |
| `birthProfileToAlmanacParticipant(profile)` | 生成择日参与人输入                                             |

真太阳时模式下必须提供 `hour`、`minute` 和 `location.longitude`；地点可用 `location.timezone` 提供固定偏移，也可用 `location.timeZoneId` 按出生日期解析 IANA 历史时区，两者都不提供时按 UTC+8 处理。秋季回拨的重复当地时间必须同时提供固定偏移消歧；固定偏移冲突、春季不存在时间及 `timeZoneId` 与 `applyChinaDst` 同时启用会被拒绝。八字结果的 `timing` 会返回解析后的 `timezone`、`standardMeridian`、经度修正、均时差、跨日结果和完整证据链。

---

## 出生盘 Bundle

导入：`import { calculateBirthChartBundle } from 'mingyu-core/birth'`

### `calculateBirthChartBundle(profile, options?)`

按 `options.systems` 生成一份出生档案的多种盘面，支持 `bazi`、`ziwei`、`astrolabe` 和 `qizheng`。默认只计算八字，避免未使用紫微时强制加载可选 `iztro`。返回 `profile`、标准化时间资料、各系统实际输入和对应的 `bazi`、`ziwei`、`astrolabe`、`qizheng` 字段；缺少某系统所需的精准时分、经纬度或性别时直接抛出结构化输入错误。

```ts
const bundle = await calculateBirthChartBundle(profile, {
  systems: ['bazi', 'ziwei'],
  ziwei: { scopes: ['origin'], horoscopeContext: { dateStr: '2026-08-06', hourIndex: 5 } },
});
```

---

## 八字紫微合参 Synthesis

导入：`import { calculateBaziZiweiCombinedReading } from 'mingyu-core/synthesis'`

### `calculateBaziZiweiCombinedReading(profile, options)`

从一份 `BirthProfile` 生成八字、紫微、十个主题的并列证据及可独立交给 AI 的完整任务书。调用时必须在 `options.ziwei.horoscopeContext` 中提供明确日期与时辰索引，或在 `options.ziwei.now` 中提供明确日期对象；合参不会隐式采用运行机器的当前时间。

返回值包含 `bundle`、`synthesis` 和 `promptText`。`synthesis.timingReference` 记录本次实际采用的 `dateStr`、`year`、`hourIndex` 与 `shichen`；八字只选择该日期所在的大运或童限及同一公历年的流年，紫微运限也使用同一个日期快照。

```ts
const reading = await calculateBaziZiweiCombinedReading(profile, {
  ziwei: { horoscopeContext: { dateStr: '2026-08-06', hourIndex: 5 } },
  prompt: { question: '未来十年的事业重点是什么？' },
});

console.log(reading.synthesis.timingReference);
console.log(reading.promptText);
```

---

## 双人合盘 Bundle

导入：`import { calculateCompatibilityBundle } from 'mingyu-core/compatibility'`

### `calculateCompatibilityBundle(primary, partner, options?)`

从两份 `BirthProfile` 生成所选系统的盘面和合盘证据。支持 `bazi`、`ziwei` 和 `astrolabe`；返回双方标准化出生盘及 `bazi` 八字合盘、`ziwei` 紫微双盘证据、`astrolabe` 西占双盘相位。默认只计算八字，紫微仍需安装可选 `iztro`。

---

## 历法 Calendar

导入：`import { ... } from 'mingyu-core/calendar'`

| 函数                                        | 说明                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `getDivinationTime(customDate?)`            | 获取占卜时间（干支+农历+节气+时间戳）                               |
| `getVoidBranches(dayGanZhi)`                | 由日柱干支查旬空地支                                                |
| `getSixAnimals(dayGan)`                     | 由日干起六神                                                        |
| `getTimeIndexFromClock(hour, minute)`       | 由时钟转时辰索引                                                    |
| `daysInSolarMonth(year, month)`             | 公历月天数                                                          |
| `getBirthDateValidationMessage(...)`        | 出生日期校验                                                        |
| `resolveCivilTime(input, options?)`         | 将当地钟表时间、固定偏移或 IANA 历史时区解析为唯一 UTC 时刻         |
| `resolveBirthCalendarClockTime(input)`      | 只校验公历/农历出生输入并换算为公历钟表时间，不执行时区或太阳时校正 |
| `convertTrueSolarTime(input)`               | 按当地钟表时间、固定偏移或 IANA 历史时区、经度和均时差换算真太阳时  |
| `resolveTrueSolarBirthTime(input)`          | 统一处理公历/农历、闰月、历史时区、夏令时、跨日和时辰索引           |
| `buildAstronomicalTimeEvidence(input)`      | 由当地时间与固定偏移或 IANA 时区生成 UTC、JD、近似 UT1、ΔT 和 TT    |
| `queryAstronomicalFacts(input)`             | 按统一民用时间口径计算可复算的现代天文位置事实                      |
| `calculateMoonPhaseEvidence(utcTimestamp)`  | 由 UTC Unix 毫秒生成月相、照明比例和前后朔弦望事件                  |
| `calculateSolarTermEvidence(year, index)`   | 生成单个节气的历表时刻、目标黄经、独立求根及差值核验                |
| `calculateSolarTermsForYear(year)`          | 按公历年份生成从小寒至冬至的 24 个节气证据                          |
| `findSolarTermEvidence(name, year)`         | 按节气名称和节气周期年份查询单项证据                                |
| `calculateSolarIlluminationEvidence(input)` | 由当地日期时间、经纬度和时区生成太阳位置、日出日落及三类曙暮光证据  |

`resolveCivilTime()`、`queryAstronomicalFacts()`、`buildAstronomicalTimeEvidence()` 与 `calculateSolarIlluminationEvidence()` 的年月日时分秒都按输入地点的当地民用时间解释，必须提供 `timezone` 或 `timeZoneId`。IANA 时区优先；同时提供时，固定偏移只用于秋季回拨消歧和一致性核验。未消歧回拨、春季跳时缺口和固定偏移冲突都会拒绝计算。固定偏移范围统一为 UTC-12 至 UTC+14。`calculateMoonPhaseEvidence()` 直接接受 UTC Unix 毫秒。单项节气底层索引以冬至为 `0`、大雪为 `23`；若目标是普通公历年列表，应使用 `calculateSolarTermsForYear(year)` 或客户端 `solarTerms(year)`，返回该年小寒至冬至的时间顺序。

---

## 统一占法会话 Session

导入：`import { ... } from 'mingyu-core/divination/session'`

统一会话入口将前端原本的占法选择、输入校验、算法分发、结果摘要和提示词组装收敛为框架无关的纯数据接口。它不负责 HTTP、分页、存储或界面状态。

| 导出                                      | 说明                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `generateDivinationSession(request)`      | 完成一次占法计算；新增互不混杂的 `displaySummary`、`aiPrompt`、`auditEvidence` 和统一 `view`，旧字段继续保留 |
| `validateDivinationRequest(request)`      | 只校验请求，不执行排盘；适合表单或 API 提交前调用                                                            |
| `generateDivination(request)`             | `generateDivinationSession` 的兼容别名                                                                       |
| `summarizeDivinationResult(method, data)` | 返回标题、标签和明细行                                                                                       |
| `formatDivinationResult(method, data)`    | 返回统一的占法资料文本                                                                                       |
| `serializeDivinationResult(data)`         | 输出键顺序稳定的 JSON，适合缓存、历史记录和跨端传输                                                          |

请求的 `method` 支持 `liuyao`、`meihua`、`xiaoliuren`、`jinkoujue`、`qimen`、`liuren`、`taiyi`、`tarot`、`ssgw`、`almanac`、`lenormand`、`astrolabe` 和 `random`。各占法的手工输入、牌阵、日期范围、出生资料等放在同名字段下；随机能力统一使用顶层 `random`，支持 `seed`、`replay` 和自定义随机源。

```typescript
const result = generateDivinationSession({
  method: 'tarot',
  question: '这段关系接下来如何发展？',
  tarot: { spread: 'three' },
  random: { seed: 'example' },
});
```

新接入应直接展示 `displaySummary`、复制 `aiPrompt`，只有审计页面才读取 `auditEvidence`。`view` 固定提供 `kind`、`schemaVersion`、`input`、`calendar`、`chart`、`timing`、`summary`、`evidence`、`warnings` 和 `raw`；底层专业数据继续保留在 `raw`。任意核心结果也可从 `mingyu-core/consumption` 使用 `createConsumptionView()` 建立同一顶层协议。

---

## 提示词与摘要 Prompt

导入：`import { ... } from 'mingyu-core/prompt'`

所有 `build*Prompt` 函数返回可直接复制给在线 AI 的完整任务书；对应的 `build*PromptDocument` 同时返回 `system`、`user` 和合并后的 `text`。提示词构建器不发起网络请求，也不依赖 React。

| 导出                                                           | 说明                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `buildBaziPrompt(options)`                                     | 生成八字单盘任务书，支持主题、单派或多派合参、问题和岁运范围                                   |
| `formatBaziFortuneSelection(context)`                          | 将岁运选择结果统一整理为可用于“分析对象”和“岁运重点”的文本                                     |
| `buildBaziCompatibilityPrompt(options)`                        | 生成八字双盘任务书，支持多派合参并附带双盘关系证据                                             |
| `buildZiweiPrompt(options)`                                    | 生成紫微本命或指定运限任务书，支持完整范围和真太阳时证据                                       |
| `buildZiweiTaskBookPrompt(options)`                            | 生成按主题和重点宫位组织的紫微任务书                                                           |
| `buildZiweiCompatibilityPrompt(options)`                       | 生成紫微双盘任务书，支持多派合参并附带宫位叠盘与跨盘四化资料                                   |
| `buildCombinedZiweiPrompt(payload, topic, question, options?)` | 生成与现有完整紫微盘面链路一致的结构化任务书                                                   |
| `buildCombinedZiweiCompatibilityPrompt(options)`               | 生成双方完整紫微快照、宫位叠盘、跨盘四化和各自时间校正任务书                                   |
| `buildBaziZiweiPrompt(options)`                                | 将八字和紫微盘面放入同一份联合任务书                                                           |
| `buildAstrolabePrompt(options)`                                | 生成星盘本命任务书，包含星体、宫位、相位和证据                                                 |
| `buildAstrolabeSynastryPrompt(options)`                        | 生成星盘合盘任务书，包含跨盘相位和落宫                                                         |
| `buildDivinationPrompt(options)`                               | 将六爻、梅花、奇门、六壬、小六壬、金口诀、塔罗、灵签、择日、雷诺曼、星盘和太乙结果组装为任务书 |
| `buildMetaphysicsPrompt(basePrompt, question, options)`        | 将八宅、住宅综合、生肖、七政四余或玄空排盘包装为完整任务书                                     |
| `getPromptSchoolIds(method)`                                  | 返回指定术数允许的一组派系、断法或解读侧重                                                     |
| `formatPromptSchoolGuidance(method, schools)`                 | 生成单派或最多三派的解读任务、传统依据和合参要求                                               |
| `getDivinationSummaryBlocks(method, data)`                     | 返回标题、标签和明细行，适合自定义 UI 展示                                                     |
| `formatDivinationInfo(method, data)`                           | 返回统一的增强占法资料文本；包含前端原有的用神、应期、宫位、节令、参与人和牌面证据             |
| `formatEnhancedDivinationInfo(method, data)`                   | 增强格式化的明确入口；`formatDivinationInfo` 已兼容转发到此入口                                |
| `formatDetailedDivinationInfo(method, data)`                   | 返回包含爻位、体用互变、九宫、四课三传、候选日等结构明细的占法资料                             |
| `formatDivinationTime(data?)`                                  | 按占课结果时间戳格式化公历、农历、干支和节气                                                   |
| `formatDivinationSolarTime(data?)`                             | 只格式化占课结果的公历时间                                                                     |
| `formatSupplementaryInfo(info?)`                               | 格式化现实背景和梅花起卦设置；奇门出生年份由年命资料格式器处理                                 |
| `formatPromptCurrentTime(date?)`                               | 格式化公历、农历、干支历和当前节气                                                             |
| `buildPromptGuidanceSections(method)`                          | 返回与前端一致的传统依据段落                                                                   |
| `insertPromptSectionBeforeHeading(prompt, heading, section)`   | 在指定标题前稳定插入提示词分段                                                                 |

示例：

```typescript
import { buildBaziPrompt } from 'mingyu-core/prompt';

const text = buildBaziPrompt({
  result: chart,
  topic: 'career',
  question: '今年是否适合换工作？',
  fortuneScope: 'year',
});
```

公开 HTTP 接口和旧调用方需要保持既有紧凑输出时，可使用 `mingyu-core/prompt/public-api`。新的通用集成应优先使用 `mingyu-core/prompt`；紫微完整快照链路也可从 `mingyu-core/ziwei/prompt` 导入。两者都只负责生成任务书，不发起 AI 请求。

提示词只包含任务、盘面资料、当前时间和传统依据；页面状态、路由、请求过程和内部工程信息不属于该公共入口。

紫微结构化提示词也可从 `mingyu-core/ziwei/prompt` 单独导入：`buildPortablePromptPack`、`buildZiweiReadableSnapshot`、`buildZiweiTaskBookSnapshot`、`buildPromptContextSnapshot`、`buildFocusTaskBundle`、`buildEvidenceSummary` 和宫位格式化工具。它们接受 `ZiweiPromptContext`，适合在非 React 应用中按专题、宫位和运限组织紫微盘面资料。

---

## 地点索引 Location

`mingyu-core/location` 内置中国省市区数据、真太阳时所需经度及行政中心纬度，同时提供 `createBirthPlaceIndex(tree)`，可对调用方自己的地点树执行级联查询、搜索、反查和坐标解析。

| 导出                                                  | 说明                                                |
| ----------------------------------------------------- | --------------------------------------------------- |
| `chinaBirthPlaceTree`                                 | 34 个省级、392 个市级、3210 个区县级节点            |
| `getBirthPlaceProvinceOptions()`                      | 获取省级选项                                        |
| `getBirthPlaceCityOptions(provinceId)`                | 获取指定省的市级选项                                |
| `getBirthPlaceDistrictOptions(cityId)`                | 获取指定市的区县选项                                |
| `findBirthPlaceByRegionId(id)`                        | 按行政区代码返回完整路径                            |
| `findBirthPlaceByDisplayName(name)`                   | 按完整显示名或唯一简称返回路径；重名简称返回 `null` |
| `searchBirthPlaces(query, options?)`                  | 按名称、完整路径、拼音或代码搜索，分别保留重名地点  |
| `resolveBirthPlace(idOrName)`                         | 返回地点路径、经纬度、时区及 `coordinateAccuracy`   |
| `resolveBirthPlaceLongitude(idOrName)`                | 解析真太阳时所需经度；重名简称返回 `null`           |
| `resolveBirthPlaceApproximateLatitude(id, fallback?)` | 返回明确标注为近似值的省级纬度兼容回退              |

内置地点树共 3636 个节点，其中 3255 个附有行政中心纬度，其余 381 个使用省级近似纬度。行政中心不等于实际出生地点，精度敏感的星盘仍应优先使用真实出生地坐标；自定义地点树没有可用纬度来源时不会自动套用通用纬度。简称存在重名时应先调用 `searchBirthPlaces()`，再使用完整路径或行政区代码解析。

---

## 类型定义

所有类型从 `mingyu-core/types` 导出，包括：

- 八字：`Person`、`Pillar`、`Pillars`、`BaziChartResult`、`BaziAnalysisResult`、`UsefulGodAnalysis`、`LuckInfo`、`ShenShaResult` 等
- 占卜：`LiuyaoData`、`MeihuaData`、`QimenData`、`QimenSeasonalityInfo`、`QimenPatternCombo`、`LiurenData`、`XiaoliurenData`、`AlmanacData`、`LenormandData`、`AstrolabeData`、`SsgwData`、`TarotData`
- 紫微分析：`AnalysisPayloadV1`、`PalaceFact`、`PatternFact`、`EvidenceFact`、`ScopeType`
- 增强分析：`TenGodStructureProfile`、`StemRootProfile`、`RelationStructureProfile`、`KongWangProfile`、`TombStorageProfile`、`MingGuaProfile`、`XiaoYunProfile` 等

### 使用方式

```typescript
import type {
  QimenData,
  MeihuaData,
  LiuyaoData,
  LiurenData,
  BaziChartResult,
} from 'mingyu-core/types';
```

各类型的字段说明可在 IDE 中直接查看（.d.ts 文件已附带 JSDoc 注释）。
