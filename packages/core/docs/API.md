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

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | `number` | ✅ | 公历或农历年（1900-2100） |
| `month` | `number` | ✅ | 月（1-12） |
| `day` | `number` | ✅ | 日 |
| `timeIndex` | `number` | ✅* | 时辰索引 0-12（0=早子，1=丑...11=亥，12=晚子） |
| `gender` | `'male' \| 'female'` | ✅ | 性别 |
| `isLunar` | `boolean` | | 输入是否农历，默认公历 |
| `isLeapMonth` | `boolean` | | 农历是否闰月 |
| `useTrueSolarTime` | `boolean` | | 启用真太阳时 |
| `birthHour` | `number` | * | 真太阳时模式下的小时（0-23） |
| `birthMinute` | `number` | * | 真太阳时模式下的分钟（0-59） |
| `birthLongitude` | `number` | * | 出生地经度（-180~180） |
| `shenShaVariants` | `Partial<ShenShaVariantConfig>` | | 神煞争议口径配置；不传时使用默认主流口径 |

\* `timeIndex` 与真太阳时三参数二选一。

**神煞争议口径 `shenShaVariants`：**

| 字段 | 默认值 | 可选值 | 说明 |
|------|--------|--------|------|
| `kongWangBasis` | `day` | `day` / `day-and-year` | 空亡默认只按日柱旬空；兼容口径可同时参考年柱旬空 |
| `yangRenMode` | `yang-stems-only` | `yang-stems-only` / `include-yin-ren` | 羊刃默认只取阳干帝旺；兼容口径可把阴干帝旺位作为阴刃并入 |
| `tongZiScope` | `day-hour` | `day-hour` / `all-pillars` | 童子煞默认只查日柱、时柱；兼容口径可四柱同查 |

**返回 `BaziChartResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `pillars` | `Pillars` | 四柱（year/month/day/hour，每柱含 gan/zhi/ganZhi） |
| `dayMaster` | `{ gan, element, yinYang }` | 日主（天干/五行/阴阳） |
| `tenGods` | `Record<string,string>` | 各柱天干十神 |
| `hiddenStems` | `HiddenStems` | 各柱地支藏干 |
| `hiddenTenGods` | `Record<string,string[]>` | 藏干十神 |
| `wuxingStrength` | `WuxingStrengthDetails` | 五行强度（分数/百分比/缺失） |
| `shensha` | `ShenShaResult` | 各柱神煞 |
| `nayin` | `Nayin` | 各柱纳音 |
| `kongWang` | `KongWangResult` | 各柱空亡 |
| `luckInfo` | `LuckInfo` | 大运信息（起运/交运/各步大运+流年） |
| `mingGong` | `string` | 命宫 |
| `shenGong` | `string` | 身宫 |
| `taiYuan` | `string` | 胎元 |
| `taiXi` | `string` | 胎息 |
| `lifeStages` | `Record<string,string>` | 各柱十二长生 |
| `wuxingSeasonStatus` | `Record<string,string>` | 月令五行旺相休囚死 |
| `monthCommander` | `string` | 月令司权天干 |
| `seasonInfo` | `SeasonInfo` | 节气信息（当前/下一节气、距节气天数） |
| `analysis` | `BaziAnalysisResult` | 分析结果（见下） |
| `zodiac` | `string` | 生肖 |
| `constellation` | `string` | 星座 |
| `solarDate` | `{ year, month, day }` | 公历日期 |
| `lunarDate` | `{ year, month, day, monthName, dayName }` | 农历日期 |
| `timing` | `TimingInfo?` | 真太阳时校正明细（启用时） |

**`analysis`（`BaziAnalysisResult`）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `dayMasterStrength` | `{ score, status, details }` | 日主强度（极弱/身弱/中和/偏强/身强/极强） |
| `mingGe` | `{ pattern, isSpecial, basis?, isKuiGang? }` | 格局（普通格局名/特殊格局/魁罡） |
| `usefulGod` | `UsefulGodAnalysis` | 用神（喜用/忌神十神与五行） |

### 八字增强分析函数

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `analyzeTenGodStructure(pillars, dayMaster, getTenGod)` | 四柱、日干、十神函数 | `TenGodStructureProfile` | 十神分布与五大家族聚合 |
| `analyzeStemRootProfile(pillars, dayMaster, getWuxing, getTenGod)` | 四柱、日干、五行函数、十神函数 | `StemRootProfile` | 透干通根分析（本根/同气根/无根） |
| `analyzeExposedStemProfile(pillars, dayMaster, getWuxing, getTenGod, commanderStem?, monthBranch?)` | 同上 + 司令、月支 | `ExposedStemProfile` | 透干月令地位与力量 |
| `analyzeRelationStructure(pillars)` | 四柱 | `RelationStructureProfile` | 地支关系（三合/三会/半合/六合/六冲/六害/三刑/相破） |
| `analyzeKongWangProfile(pillars, dayMasterStem)` | 四柱、日干 | `KongWangProfile` | 空亡全分析 |
| `analyzeTombStorage(pillars, dayMaster, getWuxing, getTenGod)` | 四柱、日干、五行函数、十神函数 | `TombStorageProfile` | 辰戌丑未墓库分析 |
| `analyzeLifeStageProfile(pillars)` | 四柱 | `LifeStageItem[]` | 各柱十二长生 |
| `analyzeTenGodLifeStageProfile(pillars, dayMaster, getTenGod)` | 四柱、日干、十神函数 | `TenGodLifeStageProfile` | 十神在十二长生的旺弱分布 |
| `analyzeUsefulGodPlacement(pillars, dayMaster, getTenGod, favorableWuxing, unfavorableWuxing)` | 四柱、日干、十神函数、喜用五行、忌神五行 | `UsefulGodPlacementProfile` | 用神落点（喜神得力/受制/忌神等） |
| `analyzeNayinProfile(pillars)` | 四柱 | `NayinProfile` | 各柱纳音五行 |
| `analyzeMonthQiProfile(monthBranch, commanderStem?)` | 月支、司令 | `MonthQiProfile` | 月令气数（五行旺相休囚死） |
| `analyzeMatterFocusProfile(gender, favorableWuxing)` | 性别、喜用五行 | `MatterFocusProfile` | 事项宫位（事业/财运/感情等） |
| `calculateMingGua(birthYear, gender)` | 出生年、性别 | `MingGuaProfile` | 命卦（东四命/西四命） |
| `calculateXiaoYunProfile(solarTime, gender, dayMasterGan, getTenGod)` | 太阳时、性别、日干、十神函数 | `XiaoYunProfile` | 小运（童限逐年干支） |
| `buildLuckDirectionProfile(gender, yearStem)` | 性别、年干 | `LuckDirectionProfile` | 大运顺逆方向 |

---

## 六爻 Liuyao

导入：`import { generateLiuyao } from 'mingyu-core/divination/liuyao'`

### `generateLiuyao(customDate?)`

**参数：** `customDate?: Date` — 起卦时间，默认当前时间

**返回 `LiuyaoData`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `originalName` | `string` | 主卦名（如"乾为天"） |
| `changedName` | `string` | 变卦名 |
| `interName` | `string` | 互卦名 |
| `yaoArray` | `number[]` | 六爻数值（6/7/8/9，老阴老阳少阴少阳） |
| `changingYaos` | `Array<{position,isChanging,type}>` | 动爻 |
| `sixGods` | `string[]` | 六神（青龙/朱雀/勾陈/腾蛇/白虎/玄武） |
| `sixRelatives` | `string[]` | 六亲（父母/兄弟/子孙/妻财/官鬼） |
| `najiaDizhi` | `string[]` | 纳甲地支 |
| `wuxing` | `string[]` | 各爻五行 |
| `worldAndResponse` | `string[]` | 世应标记（'世'/'应'/''） |
| `voidBranches` | `string[]` | 旬空地支 |
| `palace` | `{ name, wuxing }` | 所属宫位 |
| `yaosDetail` | `LiuyaoYaoDetail[]` | 每爻详细（含月破/日破/暗动/回头生克/化进退神等） |
| `hiddenSpirits` | `LiuyaoHiddenSpirit[]?` | 伏神（本宫首卦补未现六亲） |
| `specialPattern` | `'静卦' \| '独静卦' \| '全动卦' \| '乾卦用九' \| '坤卦用六'?` | 特殊卦型 |
| `sanheWithDay` | `{group,members,description}?` | 日辰引动三合局 |
| `sanxingInYaos` | `Array<{branches,type}>?` | 三刑检测 |
| `ganzhi` | `BaseGanZhi` | 起卦时间干支 |
| `timestamp` | `number` | 时间戳 |

---

## 梅花易数 Meihua

导入：`import { generateMeihua } from 'mingyu-core/divination/meihua'`

### `generateMeihua(customDate?, settings?)`

**参数 `settings`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `method` | `'time' \| 'number' \| 'random' \| 'external' \| 'timeTrigram'` | 起卦法 |
| `number` | `number` | 数字起卦的正整数 |
| `externalOmens` | `MeihuaExternalOmens` | 外应（方向/人物/动物/物品/声音/颜色/数量） |

**返回 `MeihuaData`：** 含主卦/互卦/变卦、体用关系（tiGua/yongGua）、四时旺衰、应期估算、体用生克分析（tiYongRelation/inter1Relation/changedRelation/yingQi）。

---

## 奇门遁甲 Qimen

导入：`import { generateQimen } from 'mingyu-core/divination/qimen'`

### `generateQimen(customDate?, method?, scope?)`

**参数：**
- `customDate?: Date` — 排盘时间
- `method?: QimenMethod` — 排盘方法，`zhuanpan` 为转盘法（默认主流口径），`feipan` 为飞盘法
- `scope?: QimenScope` — 排盘级别，`hour`（默认）、`day`、`month`、`year`

**返回 `QimenData`：** 含 13 步完整排盘：定局数（拆补法）、值符值使、九宫格（天地人神四盘）、基础格局标签、经典格局（九遁/三奇得使等）、宫位洞察、方位吉凶、应期估算（庚格法）、马星落宫、旬空。

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

**返回 `XiaoliurenData`：** 含三宫（起因 start/过程 process/结果 result，各为大安/留连/速喜/赤口/小吉/空亡）、五行生克分析、月令旺衰、应期估算。

---

## 择日 Almanac

导入：`import { generateAlmanacSelection } from 'mingyu-core/divination/almanac'`

### `generateAlmanacSelection(params)`

**参数：** 事项类型（move/marriage/opening/contract/travel/medical/study/burial/renovation/custom）、日期范围、参与人信息（含八字）。

**返回 `AlmanacData`：** 含每日候选评分（基准 60 分，黄历宜忌+建除十二神+神煞+参与人冲克调整）、二十八宿、九星、彭祖百忌、逐日宜忌详情。

---

## 灵签 SSGW

导入：`import { drawRandomSign } from 'mingyu-core/divination/ssgw'`

### `drawRandomSign()`

**返回 `SsgwData`：** 随机抽取三山国王 92 签之一，含签号、签题、签诗、典故故事、分类解签。

---

## 雷诺曼 Lenormand

导入：`import { drawLenormandSpread } from 'mingyu-core/divination/lenormand'`

### `drawLenormandSpread(spreadType?)`

**参数：** `spreadType?: 'single' | 'three' | 'five' | 'relationship' | 'decision' | 'nine' | 'element' | 'grandTableau'`

**返回 `LenormandData`：** 36 张雷诺曼牌、Fisher-Yates 洗牌、各位置牌义、相邻两牌组合含义。

---

## 西洋占星 Astrolabe

导入：`import { generateAstrolabe } from 'mingyu-core/divination/astrolabe'`

### `generateAstrolabe(input)`

**参数 `input`：** 出生年月日时分、经纬度、时区、可选真太阳时。

**返回 `AstrolabeData`：** 十大行星、四轴（上升/天顶/下降/天底）、Placidus 十二宫、Top 12 相位（合/六合/刑/拱/冲/半六合/半刑/五分相等）、四元素三形态总结、逆行星。依赖 `celestine`。

---

## 紫微斗数 Ziwei

导入：`import { ... } from 'mingyu-core/ziwei/iztro'`

### 主要导出

| 函数 | 说明 |
|------|------|
| `buildAstrolabeFromInput(input)` | 由 ChartInput 构建 iztro 盘 |
| `buildHoroscope(astrolabe, dateStr, hourIndex)` | 构建运限盘 |
| `buildAnalysisPayloadV1({astrolabe, horoscope, currentScope})` | 构建分析数据载荷 |
| `detectPatterns({palaces})` | 检测 35 种传统紫微格局 |
| `buildEvidencePool({astrolabe, horoscope, currentScope, palaces})` | 构建证据池 |

依赖 `iztro`。返回类型见 `mingyu-core/types` 的 `analysis.ts`。

---

## 历法 Calendar

导入：`import { ... } from 'mingyu-core/calendar'`

| 函数 | 说明 |
|------|------|
| `getDivinationTime(customDate?)` | 获取占卜时间（干支+农历+节气+时间戳） |
| `getVoidBranches(dayGanZhi)` | 由日柱干支查旬空地支 |
| `getSixAnimals(dayGan)` | 由日干起六神 |
| `getTimeIndexFromClock(hour, minute)` | 由时钟转时辰索引 |
| `daysInSolarMonth(year, month)` | 公历月天数 |
| `getBirthDateValidationMessage(...)` | 出生日期校验 |

---

## 类型定义

所有类型从 `mingyu-core/types` 导出，包括：

- 八字：`Person`、`Pillar`、`Pillars`、`BaziChartResult`、`BaziAnalysisResult`、`UsefulGodAnalysis`、`LuckInfo`、`ShenShaResult` 等
- 占卜：`LiuyaoData`、`MeihuaData`、`QimenData`、`LiurenData`、`XiaoliurenData`、`AlmanacData`、`LenormandData`、`AstrolabeData`、`SsgwData`、`TarotData`
- 紫微分析：`AnalysisPayloadV1`、`PalaceFact`、`PatternFact`、`EvidenceFact`、`ScopeType`
- 增强分析：`TenGodStructureProfile`、`StemRootProfile`、`RelationStructureProfile`、`KongWangProfile`、`TombStorageProfile`、`MingGuaProfile`、`XiaoYunProfile` 等

### 使用方式

```typescript
import type { QimenData, MeihuaData, LiuyaoData, LiurenData, BaziChartResult } from 'mingyu-core/types';
```

各类型的字段说明可在 IDE 中直接查看（.d.ts 文件已附带 JSDoc 注释）。
