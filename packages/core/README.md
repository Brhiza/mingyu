# mingyu-core · 命理核心算法库

> 中国传统命理与占卜算法的 TypeScript 实现，覆盖八字、紫微斗数、奇门遁甲、六爻、六壬、梅花易数等主流术数。

[![npm version](https://img.shields.io/npm/v/mingyu-core.svg)](https://www.npmjs.com/package/mingyu-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ⚠️ 重要免责声明

**本库仅提供算法实现，所有结果仅供参考、学习与娱乐使用，不构成任何命理预测、专业建议或决策依据。** 命理术数存在流派差异，本库按主流公认理法实现，不代表唯一正确解释。使用者应对基于本库输出的任何判断与决策自行承担责任，作者不承担任何因使用本库而产生的后果。

命理仅供参考，**请勿用于重大人生决策**（医疗、法律、投资、婚姻等），遇专业问题请咨询相关领域专业人士。

---

## 简介

`mingyu-core` 是开源命理项目 [mingyu](https://github.com/Brhiza/mingyu) 抽取的核心算法包，将排盘、起卦、抽牌、结构化数据计算等纯算法逻辑独立封装，供其他项目以 npm 依赖形式复用，避免各项目各自维护一份命理代码。

所有算法均对照传统古籍实现，并在源码中标注法理依据：

| 术数     | 古籍依据                                         |
| -------- | ------------------------------------------------ |
| 八字     | 《渊海子平》《三命通会》《子平真诠》《穷通宝鉴》 |
| 六爻     | 《卜筮正宗》《增删卜易》                         |
| 梅花易数 | 《梅花易数》                                     |
| 奇门遁甲 | 《烟波钓叟歌》《遁甲演义》《奇门遁甲秘籍大全》   |
| 大六壬   | 《大六壬大全》《大六壬指南》                     |
| 择日     | 《协纪辨方书》《象吉通书》                       |
| 紫微斗数 | 《紫微斗数全书》                                 |

---

## 安装

```bash
npm install mingyu-core
# 或
pnpm add mingyu-core
# 或
yarn add mingyu-core
```

外部依赖：

- `tyme4ts`（历法计算，作为依赖自动安装）
- `iztro`（紫微斗数，可选，使用紫微模块时需要）
- `celestine`（西洋占星，可选，使用星盘模块时需要）

---

## 统一出生档案与能力发现

应用可以只维护一份 `BirthProfile`，再按需要转换为八字、星盘或择日的既有输入。未知时辰会被明确标记，不会静默代入中午、子时等占位值：

```ts
import { normalizeBirthProfile, getCapabilities } from 'mingyu-core';

const profile = {
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  unknownTime: true,
} as const;

const normalized = normalizeBirthProfile(profile);
// normalized.hasKnownTime === false
// normalized.diagnostics[0].code === 'UNKNOWN_BIRTH_TIME'

const capabilities = getCapabilities();
// 可用于生成算法入口、输入项和依赖提示
```

也可按子路径引入：

```ts
import { normalizeBirthProfile } from 'mingyu-core/profile';
import { getCapabilities } from 'mingyu-core/capabilities';
```

`getCapabilities()` 返回可序列化副本，包含各系统支持的起法、输入、输出、随机种子、随机轨迹重放、真太阳时、未知时辰、批量计算和可选依赖状态。能力清单只描述核心包真实提供的能力，不把页面、本地报告或历史记录算作核心能力。

## 可选结果元数据与随机重放

随机类算法会额外返回可选 `meta`，旧字段保持不变。`meta` 用于历史记录、缓存和复现，不参与传统排盘判断：

```ts
import { drawSpreadCards } from 'mingyu-core/divination/tarot';

const first = drawSpreadCards('three', { seed: '用户记录号' });
const replay = drawSpreadCards('three', {
  replay: first.meta.random?.samples,
});

console.log(first.meta.resultId === replay.meta.resultId); // true
console.log(first.meta.engineVersion); // 计算代码版本
console.log(first.meta.schemaVersion); // 公共结果结构版本
```

`mingyu-core/result` 还提供协议版本常量、`stableStringify`、`hashStableValue`、`createResultMeta`、`serializeCoreResult` 和结构化 `MingyuCoreError`。稳定序列化只接受普通对象、数组、日期和 JSON 基础类型，避免 `Map`、类实例等被静默转换成错误缓存键。结果协议当前是可选增强，不要求旧调用方立刻迁移。

---

## 模块总览

| 模块                   | 子路径                                                                                                                                        | 说明                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **八字 Bazi**          | `mingyu-core/bazi`                                                                                                                            | 四柱排盘、神煞、调候用神、格局、大运、五行强度，含透干根气、十神结构、合化评估、命卦、小运等增强分析   |
| **紫微斗数 Ziwei**     | `mingyu-core/ziwei/iztro`                                                                                                                     | 十二宫、星曜、四化、运限、证据池，以及双盘宫位叠盘与生年四化跨盘落点                                   |
| **六爻 Liuyao**        | `mingyu-core/divination/liuyao`                                                                                                               | 京房八宫法、纳甲、世应、六亲六神、月破日破、化进退神、用神作用链与逐爻证据                             |
| **梅花易数 Meihua**    | `mingyu-core/divination/meihua`                                                                                                               | 时间/数字/随机起卦，timeTrigram 兼容、体用生克与主互变阶段推进证据                                     |
| **奇门遁甲 Qimen**     | `mingyu-core/divination/qimen`                                                                                                                | 转盘法、拆补定局、经典格局、节令背景、复合格局、方位与条件触发式应期证据                               |
| **大六壬 Liuren**      | `mingyu-core/divination/liuren`                                                                                                               | 月将、贵人、九宗门取传、三传、天将、神煞及四课取传与三传推进证据                                       |
| **小六壬 Xiaoliuren**  | `mingyu-core/divination/xiaoliuren`                                                                                                           | 六宫掌诀、五行生克、月令旺衰                                                                           |
| **择日 Almanac**       | `mingyu-core/divination/almanac`                                                                                                              | 黄历宜忌、参与人冲突、候选时辰、透明约束证据、二十八宿与彭祖百忌                                       |
| **灵签 SSGW**          | `mingyu-core/divination/ssgw`                                                                                                                 | 三山国王 92 签随机抽签                                                                                 |
| **雷诺曼 Lenormand**   | `mingyu-core/divination/lenormand`                                                                                                            | 36 张牌、8 种牌阵、牌义组合                                                                            |
| **西洋占星 Astrolabe** | `mingyu-core/divination/astrolabe`                                                                                                            | 本命盘、Placidus 宫位、行星、扩展点、相位偏差、容许度分层、行运与太阳返照求根证据                      |
| **西占双盘 Synastry**  | `mingyu-core/divination/astrolabe-synastry`                                                                                                   | 双方主要跨盘相位、实际夹角、精确角、可配置容许度、紧密等级、跨盘落宫与结构化证据                       |
| **历法 Calendar**      | `mingyu-core/calendar`                                                                                                                        | 农历、干支、节气、空亡、真太阳时、UTC/UT/TT 儒略日与 ΔT 时间尺度证据                                   |
| **出生档案 Profile**   | `mingyu-core/profile`                                                                                                                         | 统一公农历、闰月、时辰、地点与真太阳时输入，并提供既有算法适配器                                       |
| **能力发现**           | `mingyu-core/capabilities`                                                                                                                    | 查询算法输入、输出、起法、依赖、随机复现和未知时辰支持状态                                             |
| **结果协议 Result**    | `mingyu-core/result`                                                                                                                          | 稳定序列化、结果身份、结构版本与统一诊断                                                               |
| **随机能力 Random**    | `mingyu-core/random`                                                                                                                          | 种子、自定义随机源、原始样本记录与完整重放                                                             |
| **类型 Types**         | `mingyu-core/types`                                                                                                                           | 所有共享类型定义                                                                                       |
| **占法配置 Config**    | `mingyu-core/divination/config`                                                                                                               | 占法列表、起盘方式和前端共享配置                                                                       |
| **占法提示文本**       | `mingyu-core/divination/engine/method-text`、`mingyu-core/divination/engine/liuyao-template`、`mingyu-core/divination/engine/liuren-template` | 占法方法说明与六爻、大六壬问题范围提示                                                                 |
| **原始数据 Data**      | `mingyu-core/divination/divination-data`                                                                                                      | 五行、六亲、纳甲、星曜等配置数据                                                                       |
| **六十四卦数据**       | `mingyu-core/divination/hexagram-data`                                                                                                        | 六爻卦象数据、梅花八卦索引                                                                             |
| **塔罗 Tarot**         | `mingyu-core/divination/tarot`                                                                                                                | 塔罗抽牌、牌阵、关键字                                                                                 |
| **塔罗牌数据**         | `mingyu-core/divination/tarot-data`                                                                                                           | 塔罗牌定义与牌阵配置                                                                                   |
| **占卜辅助工具**       | `mingyu-core/divination/divination-helpers`                                                                                                   | 占卜通用格式与计算工具                                                                                 |
| **反推未知时辰**       | `mingyu-core/birth-time-reverse`                                                                                                              | 根据命盘特征反推时辰                                                                                   |
| **紫微斗数 Ziwei**     | `mingyu-core/ziwei/iztro`                                                                                                                     | iztro 封装、35 格局检测、证据池、大限时间线                                                            |
| **七政四余 Qizheng**   | `mingyu-core/qizheng`                                                                                                                         | 七政、四余、二十八宿与十二宫；逐星保留来源、坐标链路和精度等级，紫炁采用《七政算内篇》单一古法均速模型 |

---

## 快速开始

### 八字排盘

除单盘排盘与分析外，`mingyu-core/bazi` 提供 `analyzeBaziCompatibility(chart1, chart2)`，用于生成可复核的八字双盘交叉证据，包括双方日主五行与十神、日支关系、四柱天干地支关系、跨盘三合三会组合、双向十神映射和喜忌五行覆盖。结果同时提供通用证据包与可直接嵌入任务书的 `promptText`，不生成匹配总分，也不把五合、三合或三会候选直接视为成化。

`analyzeFortuneTriggers(chart, activeLayers)` 提供统一岁运触发证据：逐层比较原局四柱、大运、流年、流月、流日或流时的同干、五合、相冲、同支、六合、六冲、刑、害、破，并单列岁运并临与天克地冲。返回值保留双方层级、时间范围、规则来源、解释限制和 `promptText`，不从单条关系直接推断吉凶事件。

`analyzeBirthTimeSensitivity(person, { uncertaintyMinutes })` 会以精准出生钟表时间为基准，在误差范围前后分别执行夏令时、经度、均时差校正并重排候选盘，返回稳定柱位、变化柱位、候选四柱和 `promptText`。它只描述输入误差造成的排盘敏感性，不选择“更好”的命盘，也不生成稳定度总分。

```typescript
import { baziCalculator } from 'mingyu-core/bazi';
import type { BaziChartResult } from 'mingyu-core/types';

// timeIndex: 0=早子时, 1=丑时, ..., 11=亥时, 12=晚子时
const result: BaziChartResult = baziCalculator.calculateBazi({
  year: 1990,
  month: 1, // 1-12
  day: 1,
  timeIndex: 5, // 巳时
  gender: 'male', // 'male' | 'female'
});

console.log(result.pillars);
// { year: {gan:'庚', zhi:'午', ganZhi:'庚午'},
//   month: {gan:'丁', zhi:'丑', ganZhi:'丁丑'},
//   day:   {gan:'乙', zhi:'未', ganZhi:'乙未'},
//   hour:  {gan:'丁', zhi:'亥', ganZhi:'丁亥'} }

console.log(result.dayMaster); // { gan:'乙', element:'木', yinYang:'阴' }
console.log(result.shensha); // 各柱神煞
console.log(result.analysis); // 强度、格局、用神
console.log(result.luckInfo); // 大运
console.log(result.mingGua); // 命卦（八宅，按立春年界计算）
console.log(result.warnings); // 排盘预警；无预警时为空数组
```

神煞争议口径默认采用主流算法：空亡按日柱旬空、羊刃只取阳干帝旺、童子煞只查日柱和时柱。需要兼容其他系统时，可显式传入 `shenShaVariants`：

```typescript
const result = baziCalculator.calculateBazi({
  year: 1990,
  month: 1,
  day: 1,
  timeIndex: 5,
  gender: 'male',
  shenShaVariants: {
    kongWangBasis: 'day-and-year',
    yangRenMode: 'include-yin-ren',
    tongZiScope: 'all-pillars',
  },
});
```

### 农历输入与真太阳时

```typescript
const result = baziCalculator.calculateBazi({
  year: 1990,
  month: 12,
  day: 5, // 农历
  timeIndex: 5,
  gender: 'male',
  isLunar: true, // 农历输入
  isLeapMonth: false, // 是否闰月
});

// 真太阳时（按出生地经度校正）
const result2 = baziCalculator.calculateBazi({
  year: 1990,
  month: 1,
  day: 1,
  timeIndex: 0,
  gender: 'male',
  useTrueSolarTime: true,
  birthHour: 0,
  birthMinute: 30,
  birthLongitude: 116.4, // 北京经度
});
```

1986-1991 年中国夏令时期间，真太阳时模式会默认把钟表时间自动回拨 60 分钟，并在 `warnings` 中提示校正依据。若你的出生记录已经折算为北京标准时间，可关闭自动校正：

```typescript
const result = baziCalculator.calculateBazi({
  year: 1988,
  month: 7,
  day: 15,
  gender: 'male',
  useTrueSolarTime: true,
  birthHour: 12,
  birthMinute: 0,
  birthLongitude: 116.4,
  applyChinaDst: false,
});
```

### 占卜算法

```typescript
// 六爻（默认当前时间起卦）
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
const liuyao = generateLiuyao();
// 也可指定时间: generateLiuyao(new Date('2025-01-01T10:00:00'))
const coinLiuyao = generateLiuyao(undefined, { method: 'coins', seed: '本次投掷' });
console.log(coinLiuyao.generation.coinThrows); // 六爻逐爻、每爻三枚铜钱的完整轨迹

// 梅花易数（数字起卦）
import { generateMeihua } from 'mingyu-core/divination/meihua';
const meihua = generateMeihua(undefined, { method: 'number', number: 123 });

// 奇门遁甲
import { generateQimen, createQimenPriorityPalaces } from 'mingyu-core/divination/qimen';
const qimen = generateQimen(); // 当前时间，默认转盘法
const qimenFeipan = generateQimen(undefined, 'feipan'); // 可选飞盘法
const qimenYear = generateQimen(new Date('2026-07-02T08:00:00+08:00'), 'zhuanpan', 'year'); // 年家奇门
console.log(qimen.seasonality); // 节令背景、月相、建除、四柱互动
console.log(qimen.patternCombos); // 复合格局，如吉格逢空、伏吟叠驿马
console.log(createQimenPriorityPalaces(qimen)); // 结构化重点宫位候选

// 大六壬
import { generateLiuren } from 'mingyu-core/divination/liuren';
const liuren = generateLiuren();

// 小六壬
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
const xiaoliuren = generateXiaoliuren({ method: 'time' });
```

### 公共地基与新增术数

```typescript
import {
  calendar,
  foundation,
  ganzhi,
  wuxing,
  direction,
  shensha,
  bazhai,
  zodiac,
  taiyi,
  qizheng,
} from 'mingyu-core';

const house = bazhai.analyzeBaZhai({ birthYear: 1990, gender: 'male', sitMountain: '子' });
const houseByDoorDegree = bazhai.analyzeBaZhaiByDoorDegree({
  birthYear: 1990,
  birthMonth: 6,
  birthDay: 15,
  gender: 'male',
  // 站在大门处面向屋内时的指南针读数；无需自行反转 180° 或换算二十四山
  doorToInteriorDegree: 0,
  northReference: 'magnetic',
  magneticDeclinationDegrees: -2.5,
  measurementUncertaintyDegrees: 3,
});
console.log(houseByDoorDegree.directionMeasurement.stability); // 稳定 / 山向边界敏感 / 宅卦不稳定
console.log(houseByDoorDegree.directionMeasurement); // 子山午向、坐向度数与测量说明
import { resolveZiweiTrueSolarBirth } from 'mingyu-core/ziwei/true-solar-input';
const ziweiTrueSolarBirth = resolveZiweiTrueSolarBirth({
  dateType: 'solar',
  year: '1990',
  month: '6',
  day: '15',
  isLeapMonth: false,
  birthHour: '0',
  birthMinute: '10',
  birthLongitude: '116.4074',
});
console.log(ziweiTrueSolarBirth); // 校正后的公历日期与紫微时辰索引
const sharedTrueSolarBirth = calendar.resolveTrueSolarBirthTime({
  dateType: 'lunar',
  year: 1990,
  month: 5,
  day: 23,
  hour: 12,
  minute: 0,
  longitude: 116.4074,
  timezone: 8,
  applyChinaDst: true,
});
console.log(sharedTrueSolarBirth.correctedDateTime, sharedTrueSolarBirth.timeIndex);
import { buildAstrolabeScopeContext } from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
const natalAstrolabe = generateAstrolabe({
  name: '本人',
  gender: '男',
  year: '1990',
  month: '6',
  day: '15',
  hour: '12',
  minute: '0',
  latitude: '39.9',
  longitude: '116.4',
  timezone: '8',
});
const yearlyAstrolabe = buildAstrolabeScopeContext(natalAstrolabe, 'yearly', '2028');
console.log(yearlyAstrolabe.displayText, yearlyAstrolabe.promptText);
const zodiacYear = zodiac.getZodiacYearFortune('午', '甲辰');
const taiyiChart = taiyi.generateTaiyi({ year: 2004, scope: 'year' });
const taiyiHourChart = taiyi.generateTaiyi({
  scope: 'hour',
  date: new Date('2026-07-11T14:35:00+08:00'),
});
const qizhengChart = qizheng.generateQizheng({
  year: 2024,
  month: 6,
  day: 15,
  hour: 12,
  latitude: 39.9,
  longitude: 116.4,
  timezone: 8,
});

console.log(ganzhi.getNayin('甲子'));
console.log(wuxing.tallyWuxing(['甲', '子', '丙', '午']));
console.log(
  calendar.convertTrueSolarTime({
    localDateTime: '1988-07-15T12:00:00',
    longitude: 116.4074,
    timezone: 8,
    applyChinaDst: true,
  }),
);
console.log(foundation.describeGanZhi('甲子'));
console.log(ganzhi.getXunHead('乙丑')); // 甲子
console.log(foundation.analyzeWuxing(['甲', '子', '丙', '午']));
console.log(direction.getEightMansion('坎'));
console.log(shensha.getHuangliShensha(2026, 7, 10));
console.log(qizhengChart.ziqi); // 紫炁回归/恒星黄经、顺行速度与周天进度
console.log(qizhengChart.ziqiModel.sources); // 古籍、开源复原及未采用对照来源
```

### 八字增强分析（从 vibebazi 整合）

```typescript
import {
  analyzeTenGodStructure, // 十神结构分布
  analyzeStemRootProfile, // 透干通根
  analyzeRelationStructure, // 地支关系（三合/三会/六合/六冲/六害/三刑/相破）
  assessAllHarmonyTransforms, // 天干五合、地支六合的合化程度评分
  calculateMingGua, // 命卦（东四命/西四命）
  buildLuckDirectionProfile, // 大运顺逆方向
} from 'mingyu-core/bazi';

const pillars = [/* 四柱 */];
const tenGod = analyzeTenGodStructure(pillars, '乙', getTenGod);
const harmony = assessAllHarmonyTransforms(pillars);
const mingGua = calculateMingGua(1990, 'male'); // { number:1, gua:'坎', eastWest:'东四命' }
const luckDir = buildLuckDirectionProfile('male', '庚'); // { direction:'顺行' }
```

### 历法工具

```typescript
import { getDivinationTime, getVoidBranches } from 'mingyu-core/calendar';

const { ganzhi, timeInfo } = getDivinationTime(); // 当前时间干支
const voidBranches = getVoidBranches('甲子'); // ['戌','亥'] 旬空
```

---

## 主要 API 一览

### 八字（`mingyu-core/bazi`）

| 导出                            | 类型 | 说明                                     |
| ------------------------------- | ---- | ---------------------------------------- |
| `baziCalculator`                | 实例 | 调用 `calculateBazi(person)`             |
| `BaziCalculator`                | 类   | 同上的类形式                             |
| `analyzeTenGodStructure`        | 函数 | 十神分布与家族聚合                       |
| `analyzeStemRootProfile`        | 函数 | 透干通根分析                             |
| `analyzeExposedStemProfile`     | 函数 | 透干综合画像                             |
| `analyzeRelationStructure`      | 函数 | 地支关系完整评估                         |
| `assessAllHarmonyTransforms`    | 函数 | 自动扫描天干五合、地支六合并评估合化程度 |
| `assessStemHarmonyTransform`    | 函数 | 评估单组天干五合的成化程度               |
| `assessBranchHarmonyTransform`  | 函数 | 评估单组地支六合的成化程度               |
| `analyzeKongWangProfile`        | 函数 | 空亡全分析                               |
| `analyzeTombStorage`            | 函数 | 辰戌丑未墓库分析                         |
| `analyzeLifeStageProfile`       | 函数 | 十二长生分布                             |
| `analyzeTenGodLifeStageProfile` | 函数 | 十神十二长生分析                         |
| `analyzeUsefulGodPlacement`     | 函数 | 用神落点分析                             |
| `analyzeNayinProfile`           | 函数 | 纳音五行分析                             |
| `analyzeMonthQiProfile`         | 函数 | 月令气数（旺相休囚死）                   |
| `calculateMingGua`              | 函数 | 命卦计算                                 |
| `calculateXiaoYunProfile`       | 函数 | 小运（童限逐年）                         |
| `buildLuckDirectionProfile`     | 函数 | 大运顺逆方向                             |

### 占卜（`mingyu-core/divination/*`）

| 导出                                                                 | 说明                                                |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| `generateLiuyao(date?, options?)`                                    | 六爻时间、手工或模拟三钱起卦，并保留投掷轨迹        |
| `analyzeLiuyaoEvidence(data, options?)`                              | 六爻用神候选、原神忌神仇神和逐爻支持/反证结构化证据 |
| `generateMeihua(date?, settings?)`                                   | 梅花易数起卦                                        |
| `analyzeMeihuaEvidence(data)`                                        | 主卦、互卦、变卦逐阶段体用、旺衰与支持/限制证据     |
| `generateQimen(date?, method?, scope?)`                              | 奇门遁甲排盘，并内置用神宫与宫间作用结构化证据      |
| `analyzeQimenEvidence(data)`                                         | 值符值使、日时干候选宫及门星神干、反证和触发条件    |
| `createQimenPriorityPalaces(data)`                                   | 兼容旧版内部排序的奇门重点宫位候选                  |
| `generateLiuren(date?)`                                              | 大六壬排盘                                          |
| `analyzeLiurenEvidence(data)`                                        | 四课取传、初传发用、三传旺衰空亡及反证限制          |
| `generateXiaoliuren(params?)`                                        | 小六壬起课                                          |
| `generateAlmanacSelection(params)`                                   | 黄历择日，并内置透明约束与候选证据                  |
| `analyzeAlmanacEvidence(data)`                                       | 日期分组、事项宜忌、参与人冲突、时辰与现实约束证据  |
| `drawSingleCard(options?)` / `drawSpreadCards(spreadType, options?)` | 塔罗抽牌；支持 `seed` 和 `replay` 完整复现          |
| `drawRandomSign(date?, options?)`                                    | 三山国王灵签；支持 `seed` 和 `replay` 完整复现      |
| `drawLenormandSpread(spreadType?, options?)`                         | 雷诺曼牌阵；支持 `seed` 和 `replay` 完整复现        |
| `generateAstrolabe(input)`                                           | 西洋星盘                                            |
| `buildAstrolabeScopeContext(data, scope, date?)`                     | 星盘本命、流年、流月、流日行运与证据资料            |

### 历法与术数便捷入口

| 导出                                              | 说明                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `calendar.resolveTrueSolarBirthTime(input)`       | 公历/农历出生真太阳时、夏令时、跨日和时辰索引统一换算            |
| `bazhai.analyzeBaZhaiByDoorDegree(input)`         | 按入户实测度数、北向基准、磁偏角和测量误差生成八宅结果与候选坐向 |
| `bazhai.getBaZhaiSitFacingFromDoorDegree(degree)` | 将入户实测度数换算成传统坐山、朝向与二十四山                     |
| `resolveZiweiTrueSolarBirth(input)`               | 紫微出生资料真太阳时日期与时辰索引适配                           |

### 类型（`mingyu-core/types`）

所有返回值类型均从 `mingyu-core/types` 导出，包括 `BaziChartResult`、`LiuyaoData`、`QimenData`、`LiurenData`、`MeihuaData` 等。详细字段说明见 [docs/API.md](docs/API.md)。

---

## 完整 API 文档

各模块的详细参数、返回值字段、数据结构说明，请参阅：

- 📖 **[API 参考文档](docs/API.md)** — 所有函数签名与主要类型字段

---

## 开发

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
npm install -g pnpm
pnpm install

# 构建 core 包
pnpm --filter mingyu-core build

# 运行测试
pnpm test

# 仅运行 core 包测试
pnpm --filter mingyu-core test
```

项目以 pnpm workspace 形式维护，`packages/core/` 为本包源码，`src/` 为应用层。

---

## 相关项目

- **[mingyu](https://github.com/Brhiza/mingyu)** — 本包的宿主项目，含 React 前端、MCP Server、公开 API
- **[vibebazi](https://github.com/Brhiza/vibebazi)** — 八字增强分析模块的来源

---

## License

[MIT](LICENSE)

## 免责

命理术数仅供参考娱乐，本库不对任何基于输出做出的决策负责。
