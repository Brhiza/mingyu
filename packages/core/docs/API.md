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
- [小六壬 Xiaoliuren](#小六壬-xiaoliuren)
- [择日 Almanac](#择日-almanac)
- [灵签 SSGW](#灵签-ssgw)
- [塔罗 Tarot](#塔罗-tarot)
- [雷诺曼 Lenormand](#雷诺曼-lenormand)
- [西洋占星 Astrolabe](#西洋占星-astrolabe)
- [紫微斗数 Ziwei](#紫微斗数-ziwei)
- [历法 Calendar](#历法-calendar)

---

## 八字 Bazi

导入：`import { ... } from 'mingyu-core/bazi'`

### `baziCalculator.calculateBazi(person)`

主排盘函数，返回完整的八字命盘。

**参数 `person`：**

| 字段               | 类型                            | 必填 | 说明                                                                                      |
| ------------------ | ------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `year`             | `number`                        | ✅   | 公历或农历年（1900-2100）                                                                 |
| `month`            | `number`                        | ✅   | 月（1-12）                                                                                |
| `day`              | `number`                        | ✅   | 日                                                                                        |
| `timeIndex`        | `number`                        | ✅*  | 时辰索引 0-12（0=早子，1=丑...11=亥，12=晚子）                                            |
| `gender`           | `'male' \| 'female'`            | ✅   | 性别                                                                                      |
| `isLunar`          | `boolean`                       |      | 输入是否农历，默认公历                                                                    |
| `isLeapMonth`      | `boolean`                       |      | 农历是否闰月                                                                              |
| `useTrueSolarTime` | `boolean`                       |      | 启用真太阳时                                                                              |
| `birthHour`        | `number`                        | *    | 真太阳时模式下的小时（0-23）                                                              |
| `birthMinute`      | `number`                        | *    | 真太阳时模式下的分钟（0-59）                                                              |
| `birthLongitude`   | `number`                        | *    | 出生地经度（-180~180）                                                                    |
| `applyChinaDst`    | `boolean`                       |      | 是否自动校正中国夏令时（1986-1991），默认开启；若出生记录已折算为标准时间，可设为 `false` |
| `shenShaVariants`  | `Partial<ShenShaVariantConfig>` |      | 神煞争议口径配置；不传时使用默认主流口径                                                  |

\* `timeIndex` 与真太阳时三参数二选一。

**神煞争议口径 `shenShaVariants`：**

| 字段            | 默认值            | 可选值                                | 说明                                                     |
| --------------- | ----------------- | ------------------------------------- | -------------------------------------------------------- |
| `kongWangBasis` | `day`             | `day` / `day-and-year`                | 空亡默认只按日柱旬空；兼容口径可同时参考年柱旬空         |
| `yangRenMode`   | `yang-stems-only` | `yang-stems-only` / `include-yin-ren` | 羊刃默认只取阳干帝旺；兼容口径可把阴干帝旺位作为阴刃并入 |

神煞结果只记录传统规则名称与命中柱位，不自动分类吉凶或现实事项。童子煞、十灵日、六秀日因当前规则未取得可逐条复核的古籍依据，正式入口不再生成。

**返回 `BaziChartResult`：**

| 字段                 | 类型                                       | 说明                                                                                       |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `generation`         | `BaziGenerationSource`                     | 规范化出生输入、完整神煞口径、夏令时开关与生成时间；公开审核重建的唯一可信来源             |
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

`rebuildAuditedBaziData(result)` 会忽略结果中的全部派生命盘字段，只凭 `generation` 重算完整结果。`formatBaziForPrompt`、`analyzeBaziNatalEvidence`、`analyzeBaziCompatibility`、`analyzeFortuneTriggers`、`normalizeFortuneSelection` 与 `buildFortuneSelectionContext` 均为审核入口；来源缺失、夹带未知字段、时间戳非法、神煞口径不完整或真太阳时时辰矛盾时失败关闭。岁运选择只允许 `scope`、`cycleIndex`、`year`、`month`、`day`，不接受调用方预先生成的干支、十神、日期范围或提示词证据。

**`analysis`（`BaziAnalysisResult`）：**

| 字段                | 类型                                         | 说明                                                                   |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `dayMasterStrength` | `{ score, status, details }`                 | 日主强度（极弱/身弱/中和/偏强/身强/极强）                              |
| `mingGe`            | `{ pattern, isSpecial, basis?, isKuiGang? }` | 格局（普通格局名/特殊格局/魁罡）                                       |
| `usefulGod`         | `UsefulGodAnalysis`                          | 取用结构；自动用神、调候与病药规则完成逐条校勘前返回“取用待定”和空喜忌 |

### 八字增强分析函数

| 函数                                                                                                | 参数                                     | 返回                        | 说明                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------- | -------------------------------------------------------- |
| `analyzeTenGodStructure(pillars, dayMaster, getTenGod)`                                             | 四柱、日干、十神函数                     | `TenGodStructureProfile`    | 十神分布与五大家族聚合                                   |
| `analyzeTenGodFlow(structure)`                                                                      | 已校验的十神结构                         | `TenGodFlowProfile`         | 五类十神固定的五生五克事实，不裁定实际流通               |
| `analyzeStemRootProfile(pillars, dayMaster, getWuxing, getTenGod)`                                  | 四柱、日干、五行函数、十神函数           | `StemRootProfile`           | 透干通根分析（本根/同气根/无根）                         |
| `analyzeExposedStemProfile(pillars, dayMaster, getWuxing, getTenGod, commanderStem, monthBranch)`   | 同上 + 可空司令、必填月支                | `ExposedStemProfile`        | 透干月令、司令和四支通根事实，不合成力量                 |
| `analyzeRelationStructure(pillars)`                                                                 | 四柱                                     | `RelationStructureProfile`  | 地支关系（三合/三会/半合/拱局/六合/六冲/六害/三刑/相破） |
| `assessAllHarmonyTransforms(pillars, monthBranch?)`                                                 | 四柱、可选月支                           | `HarmonyTransformProfile[]` | 自动扫描天干五合、地支六合并核验条件                     |
| `assessStemHarmonyTransform(stem1, pillar1, stem2, pillar2, monthBranch, allPillars)`               | 天干、柱位、月支、四柱                   | `HarmonyTransformProfile`   | 按日干、紧贴、规定月令、克破与争合核验天干成化           |
| `assessBranchHarmonyTransform(branch1, pillar1, branch2, pillar2, monthBranch, allPillars)`         | 地支、柱位、月支、四柱                   | `HarmonyTransformProfile`   | 评估地支六合及冲破；地支不直接按化神五行成化             |
| `analyzeKongWangProfile(pillars, dayMasterStem)`                                                    | 四柱、日干                               | `KongWangProfile`           | 空亡全分析                                               |
| `analyzeTombStorage(pillars, dayMaster, getWuxing, getTenGod)`                                      | 四柱、日干、五行函数、十神函数           | `TombStorageProfile`        | 辰戌丑未墓库分析                                         |
| `analyzeLifeStageProfile(pillars)`                                                                  | 四柱                                     | `LifeStageItem[]`           | 各柱十二长生                                             |
| `analyzeTenGodLifeStageProfile(pillars, dayMaster, getTenGod)`                                      | 四柱、日干、十神函数                     | `TenGodLifeStageProfile`    | 实际天干去重后逐干逐支列出十二长生，不做旺弱加权         |
| `analyzeUsefulGodPlacement(pillars, dayMaster, getTenGod, favorableWuxing, unfavorableWuxing)`      | 旧兼容参数                               | `UsefulGodPlacementProfile` | 自动用神落点规则固定关闭，不返回喜忌落点结论             |
| `analyzeNayinProfile(pillars)`                                                                      | 四柱                                     | `NayinProfile`              | 各柱纳音五行                                             |
| `analyzeMonthQiProfile(monthBranch, commanderStem?)`                                                | 月支、司令                               | `MonthQiProfile`            | 月令气数（五行旺相休囚死）                               |
| `calculateMingGua(birthYear, gender)`                                                               | 出生年、性别                             | `MingGuaProfile`            | 命卦（东四命/西四命）                                    |
| `calculateXiaoYunProfile(solarTime, gender, dayMasterGan, getTenGod)`                               | 太阳时、性别、日干、十神函数             | `XiaoYunProfile`            | 小运（童限逐年干支）                                     |
| `buildLuckDirectionProfile(gender, yearStem)`                                                       | 性别、年干                               | `LuckDirectionProfile`      | 大运顺逆方向                                             |

---

## 六爻 Liuyao

导入：`import { generateLiuyao } from 'mingyu-core/divination/liuyao'`

### `generateLiuyao(customDate?, options?)`

**参数：**

- `customDate?: Date`：起卦记录时间；`time` 方法会把该时间戳作为固定三钱模拟的种子，默认当前时间。
- `options.method?: 'time' | 'manual' | 'coins'`：`time` 是历史兼容名，实际为时间种子模拟三钱；`manual` 读取六个爻值；`coins` 读取三钱记录或执行随机模拟。
- `options.yaos?: number[]`：按初爻至上爻传入六个 6、7、8、9。
- `options.coinThrows?: Array<{ coins: [2 | 3, 2 | 3, 2 | 3]; total: 6 | 7 | 8 | 9 }>`：按初爻至上爻传入六组三钱记录，字面记 2、背面记 3。
- `options.seed` / `options.replay`：仅 `coins` 随机模拟使用，可保存并重放投掷轨迹。

未指定 `method` 时，传入 `yaos` 自动采用 `manual`，传入 `coinThrows` 自动采用 `coins`，两者都未传则采用兼容的 `time` 方法。传统三钱法的六次记录顺序为初爻至上爻。

**返回 `LiuyaoData`：**

| 字段                | 类型                                                                       | 说明                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `originalName`      | `string`                                                                   | 主卦名（如"乾为天"）                                                                                                                                     |
| `changedName`       | `string`                                                                   | 变卦名                                                                                                                                                   |
| `interName`         | `string`                                                                   | 互卦名                                                                                                                                                   |
| `yaoArray`          | `number[]`                                                                 | 六爻数值（6/7/8/9，老阴老阳少阴少阳）                                                                                                                    |
| `generation`        | `object`                                                                   | 兼容方法名、实际生成来源与逐爻三钱记录；可区分时间种子模拟、随机模拟、外部记录和手工爻值                                                                 |
| `changingYaos`      | `Array<{position,isChanging,type}>`                                        | 动爻                                                                                                                                                     |
| `sixGods`           | `string[]`                                                                 | 六神（按起卦日干起例，从初爻至上爻排列青龙/朱雀/勾陈/螣蛇/白虎/玄武）                                                                                    |
| `sixRelatives`      | `string[]`                                                                 | 六亲（父母/兄弟/子孙/妻财/官鬼）                                                                                                                         |
| `najiaDizhi`        | `string[]`                                                                 | 纳甲地支                                                                                                                                                 |
| `wuxing`            | `string[]`                                                                 | 各爻五行                                                                                                                                                 |
| `worldAndResponse`  | `string[]`                                                                 | 世应标记（'世'/'应'/''）                                                                                                                                 |
| `voidBranches`      | `string[]`                                                                 | 旬空地支                                                                                                                                                 |
| `palace`            | `{ name, wuxing }`                                                         | 所属宫位                                                                                                                                                 |
| `palaceStage`       | `LiuyaoPalaceStage?`                                                       | 八宫卦序位置（首卦、一世至五世、游魂、归魂）                                                                                                             |
| `yaosDetail`        | `LiuyaoYaoDetail[]`                                                        | 每爻详细；`changeRelations` 分别保存可并见的回头冲、五行生克/比泄耗、化扶与化空，`changeRelation` 仅为旧版单值兼容字段；另含月破、日破、暗动、化进退神等 |
| `hiddenSpirits`     | `LiuyaoHiddenSpirit[]?`                                                    | 伏神（本宫首卦补未现六亲）                                                                                                                               |
| `hexagramRelations` | `LiuyaoHexagramRelations?`                                                 | 整卦六合/六冲及六冲变六合、六合变六冲等卦变关系                                                                                                          |
| `fanfuRelations`    | `LiuyaoFanFuRelations?`                                                    | 卦变反吟/伏吟兼容字段，含卦反吟、爻反吟、内外伏吟等标签；证据与展示会从原始盘面重算，不采信传入值                                                        |
| `activityPattern`   | `LiuyaoActivityPattern?`                                                   | 从 `yaoArray` 计算的动静结构，含明动数量、动静爻位及乾坤全动经文参考                                                                                     |
| `specialPattern`    | `'静卦' \| '独发卦' \| '独静卦' \| '全动卦' \| '乾卦用九' \| '坤卦用六'?`  | 旧版兼容字段；新代码使用 `activityPattern`                                                                                                               |
| `sanheWithDay`      | `{group,members,description,formationKey?,status?,participants?,issues?}?` | 由完整三合结构派生的日辰补局兼容字段                                                                                                                     |
| `sanheWithMonth`    | `{group,members,description,formationKey?,status?,participants?,issues?}?` | 由完整三合结构派生的月建补局兼容字段                                                                                                                     |
| `sanheFormations`   | `LiuyaoSanheFormation[]?`                                                  | 三爻齐动、两动一静、初三/四六爻动变、日月补局及虚一待用；保存参与爻、缺支和空破墓待值状态                                                                |
| `sanxingInYaos`     | `LiuyaoSanxingFormation[]?`                                                | 满足完整支组与发动条件的卦内三刑结构，含类型、参与爻、活动状态、世应标记与活动爻位                                                                       |
| `guaShen`           | `LiuyaoMonthGuaShenAnalysis?`                                              | 月卦身地支、入卦状态与全部同支爻位；不入卦时仍保留地支，同支两现时不只取第一爻                                                                           |
| `evidenceAnalysis`  | `LiuyaoEvidenceAnalysis?`                                                  | 分层用神、作用链、逐引用有力/无力条件、活动状态、反证与病药应期证据                                                                                      |
| `ganzhi`            | `BaseGanZhi`                                                               | 起卦时间干支                                                                                                                                             |
| `timestamp`         | `number`                                                                   | 时间戳                                                                                                                                                   |

`analyzeLiuyaoSanheFormations(yaosDetail, monthBranch, dayBranch)` 可从完整六爻重算上述三合结构。日辰或月建补局时，另两支必须来自两个不同的明动或暗动爻位，同一爻的本支与变支不能冒充两个活动爻；初三、四六爻动变成局仍允许各活动爻的本支与变支共同提供成员。空亡、月破、日破、入墓和静爻待值只形成 `status`、`issues` 条件，不直接裁成吉凶或固定日期。静爻逢月日六合记合起，明动或暗动逢合记合绊，两活动爻相合记合好，本位动化六合另记化扶；整卦六合六冲与三合均须结合事项、用忌、世爻和旺衰辨向。

`analyzeLiuyaoSanxingFormations(yaosDetail, monthBranch, dayBranch)` 从本卦六爻重算三刑。寅巳申、丑戌未须三支齐备且至少两个不同爻位明动或暗动；子卯相刑须两支齐备且至少一爻发动；辰午酉亥自刑须同支出现两次且至少一爻发动。变爻不跨位加入三刑，静爻同盘、三支不全或发动不足均不登记为成立事实；结果只保存结构及参与爻，不直接裁成纠纷或吉凶。

`analyzeLiuyaoActivityPattern(yaoArray, originalName?)` 从六个原始爻值重算动静结构：0 动为静卦、1 动为独发、5 动为独静、6 动为全动，2 至 4 动只登记多爻发动，不硬设“乱动”阈值。乾坤全动时分别保留用九、用六为《周易》经文参考，但不得替代纳甲体系中的用神、月日、世应与动变生克分析。`specialPattern`、`specialAdvice`、`isChaotic`、`chaoticReason` 仅为旧版兼容字段，证据分析不采信这些派生值。

`analyzeLiuyaoFanFuRelations({ originalName, changedName, yaoArray })` 从主卦、变卦与原始爻值重算反吟伏吟。卦反吟按乾巽、坎离、震兑、坤艮相变，爻反吟按对应纳甲地支逐位六冲，伏吟按经卦已经动变但三爻纳甲地支逐位不变；可分别登记内卦、外卦或内外，也允许内外出现不同类型。静卦不登记，是否存在动爻以 `yaoArray` 为准，不采信 `changingYaos`；`fanfuRelations` 只作兼容字段，反伏证据、页面资料和摘要均从原始盘面重算。结构只提示反复、往返或停滞，仍须结合用神旺衰与动变生克辨向。

`analyzeLiuyaoMonthGuaShen(yaosDetail)` 按“阳世从子、阴世从午，自初爻数至世爻”重算月卦身。月卦身先定地支，再核对是否落入本卦；`status='不入卦'` 时仍保留 `branch`，同支两现时 `matches` 保存全部爻位。`position`、`sixRelative` 只作为旧版首个命中的兼容字段，证据分析不采信传入的 `guaShen` 派生值。

`analyzeLiuyaoEvidence(data, options?)` 的 `godChain[].effectFacts` 按每个用神、原神、忌神引用返回 `activity`、`supportingConditions`、`blockingConditions` 与条件并见状态。静爻旺相只表示得时，不等于已经生用或克用；原忌同动、忌仇同动只按重算后的明动或暗动成立，条件数量不能换算最终有效性、吉凶或概率。

`godInteractionFacts` 返回以 `referenceKeys` 和 `path` 闭合的生克制化路径，包括直接生扶或克制用神、忌原接续相生、原神受制或得助、忌神受制或得助。路径只从月日、真实明暗动、共享旺衰规则允许的旺相静爻、本位动变及飞伏关系重算；变爻不跨位接受其他爻作用，路径数量不用于计票、打分或裁定最终用神有效性。

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

`evidenceAnalysis` 中，主卦与变卦阶段保存各自体用关系；互卦过程保存原体及两项 `responses`，顶层 `interResponseFacts` 同步列出体互、用互分别对原体的关系，不把二者在互卦内部重新分成体用。证据层会根据主卦、互卦、变卦和动爻重新计算这些关系，旧结果的 `interTiGua`、`interYongGua`、`changedTiGua`、`changedYongGua` 与 `analysis.inter*Relation` 仅作兼容数据，不作为证据来源。

---

## 奇门遁甲 Qimen

导入：`import { generateQimen, analyzeQimenEvidence } from 'mingyu-core/divination/qimen'`

### `generateQimen(customDate?, method?, scope?)`

**参数：**

- `customDate?: Date` — 排盘时间
- `method?: QimenMethod` — 排盘方法，`zhuanpan` 为转盘法（默认主流口径），`feipan` 为飞盘法
- `scope?: QimenScope` — 排盘级别，`hour`（默认）、`day`、`month`、`year`

**返回 `QimenData`：** 含当前口径的定局法与排布法、值符值使、九宫天地人神四盘、旬空、马星、节令背景、十一项《遁甲演义》已校勘固定格及结构化证据。通用入口不自动指定用神，不生成吉方、避方或应期结论。

新增结构化字段：

| 字段                                     | 类型                            | 说明                                                                         |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `seasonality`                            | `QimenSeasonalityInfo?`         | 当前节气、节气三元、节气五行、日干与节令关系、月相、建除十二神、四柱干支互动 |
| `patternCombos`                          | `QimenPatternCombo[]?`          | 固定文献条件已闭合的组合规则；不二次拼接基础事实或现实吉凶                   |
| `evidenceAnalysis.positionIndexes`       | `QimenPalaceIndexFact[]`        | 值符、值使、日干、时干及已校勘格局所在宫的位置索引；不等于用神候选           |
| `evidenceAnalysis.palaceRelations`       | `QimenPalaceRelationEvidence[]` | 九宫全部 36 组无序宫对的五行比和、生克关系                                   |
| `evidenceAnalysis.timingSummaryFact`     | `QimenTimingSummaryFact`        | 声明用神与期限资料尚缺，不生成自动应期                                       |
| `evidenceAnalysis.directionBoundaryFact` | `QimenDirectionBoundaryFact`    | 声明九宫方向只是空间事实，不生成吉方、避方或路线建议                         |

### `analyzeQimenEvidence(data)`

从九宫、干支和值符值使重新计算所有派生字段，拒绝旧缓存或外部输入中的格局摘要、宫位评级、方位、应期与现实断语。值符、值使、日干、时干和固定格所在宫只作为位置索引，由后续 AI 结合具体问题另行选择用神。

---

## 大六壬 Liuren

导入：`import { generateLiuren } from 'mingyu-core/divination/liuren'`

### `generateLiuren(customDate?)`

**返回 `LiurenData`：** 含月将（中气换将）、昼夜贵人、天地盘、四课、三传（初传/中传/末传，含九宗门取传法）、神煞（驿马/劫煞/亡神/桃花/破碎/天德/月德/天马/日德/禄神/天罗地网）、天将属性（十二天将的五行阴阳颜色五味等）、课体规则、旬空。

---

## 小六壬 Xiaoliuren

导入：`import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren'`

### `generateXiaoliuren(params?)`

**参数：**

- `method?: 'time' \| 'number' \| 'random'`
- `number?: number`
- `customDate?: Date`

**返回 `XiaoliurenData`：** 含月宫、日宫、时宫顺数轨迹（大安/留连/速喜/赤口/小吉/空亡）、时宫主证、通行歌诀、逐步计算参数及来源、历法和解释限制。

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

**返回 `SsgwData`：** 随机抽取三山国王 92 签之一，含签号、签题、签诗、典故故事、分类解签。

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

## 雷诺曼 Lenormand

导入：`import { drawLenormandSpread } from 'mingyu-core/divination/lenormand'`

### `drawLenormandSpread(spreadType?, options?)`

**参数：**

- `spreadType?: 'single' | 'three' | 'five' | 'relationship' | 'decision' | 'nine' | 'element' | 'grandTableau'`，不传时使用 `single`
- `options?: { seed?: string | number; rng?: () => number }`

**返回 `LenormandData`：** 36 张雷诺曼牌、Fisher-Yates 洗牌、各位置牌义、相邻两牌组合含义。

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

依赖 `iztro`。十二宫、星曜、亮度、三方四正、运限宫位、运限星曜、四化、自化与宫干飞化均直接读取 `iztro` 原生对象；公开链路与内部完整盘共用同一载荷构建器。原 84 条自定义格局因缺少逐条版本、卷页、原文和独立例盘已整体退役；当前固定版本传统目录登记 87 项，其中 55 条具备卷次、原文和可复算条件，32 项因原文含糊或依赖运限只登记边界、不伪造命中。空列表只表示当前可复算规则未命中，不表示命盘没有其他传统格局。返回类型见 `mingyu-core/types` 的 `analysis.ts`。

---

## 历法 Calendar

导入：`import { ... } from 'mingyu-core/calendar'`

| 函数                                  | 说明                                  |
| ------------------------------------- | ------------------------------------- |
| `getDivinationTime(customDate?)`      | 获取占卜时间（干支+农历+节气+时间戳） |
| `getVoidBranches(dayGanZhi)`          | 由日柱干支查旬空地支                  |
| `getSixAnimals(dayGan)`               | 由日干起六神                          |
| `getTimeIndexFromClock(hour, minute)` | 由时钟转时辰索引                      |
| `daysInSolarMonth(year, month)`       | 公历月天数                            |
| `getBirthDateValidationMessage(...)`  | 出生日期校验                          |

---

## 八宅与住宅风水资料边界

`bazhai.analyzeBaZhai(input)` 与 `bazhai.analyzeBaZhaiByDoorDegree(input)` 返回命卦、宅卦、东四西四分组、命卦和宅卦各自的八宫传统标签，以及可复算的坐向测量证据。`groupRelation` 只取 `同组`、`异组` 或 `未比较`，表示两份分组资料是否相同；它不代表住宅效果。

八宫项只含 `gua`、`direction`、`degree` 与 `label`。旧的 `luck`、`luckyDirections`、`unluckyDirections`、`match` 和 `matchAdvice` 已删除，避免底层把传统名称自动转换成方向宜避或布置建议。测量误差跨越二十四山或宅卦边界时，`candidateDirections` 完整保留全部候选盘。

`residentialFengshui.generateResidentialFengshui(input)` 通过 `reviewNotes` 记录资料完整度、分层关系和边界缺口；八宅与玄空结果分开保存，不自动合成布局建议、现实结果或综合总分。

---

## 生肖与流年固定关系

`zodiac.getZodiacYearFortune(zodiacBranch, yearGanZhi)` 保留既有函数名以兼容调用，实际返回的是生肖年支与流年干支的固定关系事实，不是运程等级。`yearGanZhi` 必须是有效六十甲子；调用方负责按适用年界传入流年年柱。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `zodiacBranch` / `zodiac` | `string` | 生肖年支及对应生肖 |
| `yearGanZhi` / `yearBranch` | `string` | 流年干支及年支 |
| `conflicts` | `TaiSuiConflict[]` | 值、冲、刑、害、破固定关系的逐项命中事实 |
| `harmony` | `string \| null` | 六合或两支同属三合组；不表示完整三合成局或现实贵人 |
| `meeting` | `string \| null` | 两支同属三会组；不表示三支齐全或成局 |
| `elementRelation` | `ZodiacElementRelation` | 流年年干五行与生肖地支本气五行的生克方向，不含利弊分类 |
| `evidenceAnalysis` | `ZodiacEvidenceAnalysis` | 计算链、逐项关系证据、未命中事实与解释限制 |
| `prompt` | `string` | 可交给 AI 结合问题继续推算的基础资料 |

旧字段 `noble`、`favorableRelations`、`riskRelations`、`actionSignals` 及 `elementRelation.classification` 已删除。底层不把三合、六合改写成现实人物，不根据五行方向生成有利或风险分类，也不生成行动建议、化解结论、现实吉凶、概率或固定应期。

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
