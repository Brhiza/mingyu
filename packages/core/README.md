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

| 术数     | 古籍依据                                                                                |
| -------- | --------------------------------------------------------------------------------------- |
| 八字     | 《渊海子平》《三命通会》《子平真诠》《穷通宝鉴》                                        |
| 六爻     | 《卜筮正宗》《增删卜易》                                                                |
| 梅花易数 | 《梅花易数》                                                                            |
| 奇门遁甲 | 《烟波钓叟歌》《遁甲演义》《奇门遁甲秘籍大全》                                          |
| 大六壬   | 《六壬粹言》《大六壬大全》《六壬指南》                                                  |
| 择日     | 《协纪辨方书》《象吉通书》                                                              |
| 紫微斗数 | 基础排盘委托 `iztro`；固定版本传统目录登记 87 项，其中 55 条可复算、32 项只登记原典边界 |

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
- 七政四余距星坐标换算内置与 Astronomy Engine 2.1.19 同口径的 IAU 2006/2000B 变换，不依赖特定运行时的模块兼容行为

---

## 统一出生档案与能力发现

应用可以只维护一份 `BirthProfile`，再按需要转换为八字、星盘或择日的既有输入。八字、紫微等时辰级算法可直接提供明确的 `timeIndex`；需要真太阳时、星盘或七政四余时，必须提供完整 `hour`、`minute` 和所需地点资料：

```ts
import { normalizeBirthProfile, getCapabilities } from 'mingyu-core';

const profile = {
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 7,
} as const;

const normalized = normalizeBirthProfile(profile);
// 明确未时可直接用于八字、紫微等时辰级排盘，并返回时间口径证据
console.log(normalized.timeIndex, normalized.timeEvidence.promptText);

const capabilities = getCapabilities();
// 可用于生成算法入口、输入项和依赖提示
```

也可按子路径引入：

```ts
import { normalizeBirthProfile } from 'mingyu-core/profile';
import { getCapabilities } from 'mingyu-core/capabilities';
```

`getCapabilities()` 返回可序列化副本，包含各系统支持的起法、输入、输出、随机种子、随机轨迹重放、真太阳时、是否要求完整出生时间、批量计算和可选依赖状态。能力清单只描述核心包真实提供的能力，不把页面、本地报告或历史记录算作核心能力。

八字、紫微若不启用真太阳时，可以直接使用明确的时辰索引排盘；这属于有效的确定输入，不属于出生时间缺失。统一档案会明确记录输入精度、代表时刻边界、时辰映射、真太阳时状态、证据汇总和解释限制。启用真太阳时，或转换为星盘等分钟级算法输入时，才需要具体小时、分钟和出生地资料；时辰代表值不会被冒充为精确分钟。

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

| 模块                   | 子路径                                                                                                                                        | 说明                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **八字 Bazi**          | `mingyu-core/bazi`                                                                                                                            | 四柱排盘、神煞、月令司权、旺衰条件、普通月令格局依据、大运与五行结构；整体身强身弱、专旺、从格及未校勘的自动用神、调候与病药规则失败关闭                 |
| **紫微斗数 Ziwei**     | `mingyu-core/ziwei/iztro`                                                                                                                     | 十二宫、星曜、四化、运限、证据池，以及双盘宫位叠盘与生年四化跨盘落点                                                                                     |
| **六爻 Liuyao**        | `mingyu-core/divination/liuyao`                                                                                                               | 京房八宫法、纳甲、世应、六亲六神、月破日破、化进退神、合起合绊化扶、三合成立条件、分层用神作用链、原忌效力条件与病药应期证据，以及公开证据的统一审核重建 |
| **梅花易数 Meihua**    | `mingyu-core/divination/meihua`                                                                                                               | 时间/数字/随机起卦，timeTrigram 兼容、体用生克、主互变阶段推进证据，以及公开证据与辅助分析的统一审核重建                                                 |
| **奇门遁甲 Qimen**     | `mingyu-core/divination/qimen`                                                                                                                | 转盘法、拆补定局、经典格局、节令背景、节气黄经核验、已校勘组合规则、方位与条件触发式应期证据                                                             |
| **大六壬 Liuren**      | `mingyu-core/divination/liuren`                                                                                                               | 月将、贵人、四课与九宗门版本边界、逐传日干六亲、有方向生克、天将、神煞及取传推进证据                                                                     |
| **金口诀 Jinkoujue**   | `mingyu-core/divination/jinkoujue`                                                                                                            | 地分、将神、贵神、人元、五子元遁、阴阳发用与五动三动；证据从时间、数字或可重放随机轨迹重新计算                                                           |
| **小六壬 Xiaoliuren**  | `mingyu-core/divination/xiaoliuren`                                                                                                           | 通行时间课的月、日、时逐宫顺数；只以时宫为占得宫，不采用华山派完整课、宫间五行或月令旺衰扩展                                                             |
| **择日 Almanac**       | `mingyu-core/divination/almanac`                                                                                                              | 黄历宜忌、参与人冲突、候选时辰、二十八宿与彭祖百忌；公开结果只凭原始事项、日期和出生输入审核重建                                                         |
| **灵签 SSGW**          | `mingyu-core/divination/ssgw`                                                                                                                 | 三山国王 92 签、掷筊确认、随机重放与文本证据分层                                                                                                         |
| **雷诺曼 Lenormand**   | `mingyu-core/divination/lenormand`                                                                                                            | 36 张牌、8 种牌阵、牌义组合                                                                                                                              |
| **西洋占星 Astrolabe** | `mingyu-core/divination/astrolabe`                                                                                                            | 本命盘、Placidus 宫位、24 点相位完整穷举、实际角距与采用容许度、完整行运与高级时限、太阳返照求根证据；公开入口从原始出生来源审核重建                     |
| **西占双盘 Synastry**  | `mingyu-core/divination/astrolabe-synastry`                                                                                                   | 穷举双方所选点对，完整返回主要跨盘相位的实际夹角、精确角、偏差、可配置容许度、全部双向跨盘落宫与结构化证据；公开入口从双方出生来源和完整参数审核重建     |
| **太乙神数 Taiyi**     | `mingyu-core/taiyi`                                                                                                                           | 已校勘年计七十二局；公开证据从原始公历年份统一审核重建，月、日、时计失败关闭                                                                             |
| **历法 Calendar**      | `mingyu-core/calendar`                                                                                                                        | 农历、干支、节气黄经核验、朔弦望月相、太阳高度与曙暮光、真太阳时及 UTC/UT/TT 时间尺度证据                                                                |
| **出生档案 Profile**   | `mingyu-core/profile`                                                                                                                         | 统一公农历、闰月、时辰、地点与真太阳时输入，并提供既有算法适配器                                                                                         |
| **能力发现**           | `mingyu-core/capabilities`                                                                                                                    | 查询算法输入、输出、起法、依赖、随机复现和出生时间要求                                                                                                   |
| **结果协议 Result**    | `mingyu-core/result`                                                                                                                          | 稳定序列化、结果身份、结构版本与统一诊断                                                                                                                 |
| **随机能力 Random**    | `mingyu-core/random`                                                                                                                          | 种子、自定义随机源、原始样本记录与完整重放                                                                                                               |
| **类型 Types**         | `mingyu-core/types`                                                                                                                           | 所有共享类型定义                                                                                                                                         |
| **占法配置 Config**    | `mingyu-core/divination/config`                                                                                                               | 占法列表、起盘方式和前端共享配置                                                                                                                         |
| **占法提示文本**       | `mingyu-core/divination/engine/method-text`、`mingyu-core/divination/engine/liuyao-template`、`mingyu-core/divination/engine/liuren-template` | 占法方法说明与六爻、大六壬问题范围提示                                                                                                                   |
| **原始数据 Data**      | `mingyu-core/divination/divination-data`                                                                                                      | 五行、六亲、纳甲、星曜等配置数据                                                                                                                         |
| **六十四卦数据**       | `mingyu-core/divination/hexagram-data`                                                                                                        | 六爻卦象数据、梅花八卦索引                                                                                                                               |
| **塔罗 Tarot**         | `mingyu-core/divination/tarot`                                                                                                                | 塔罗抽牌、牌阵、关键字                                                                                                                                   |
| **塔罗牌数据**         | `mingyu-core/divination/tarot-data`                                                                                                           | 塔罗牌定义与牌阵配置                                                                                                                                     |
| **占卜辅助工具**       | `mingyu-core/divination/divination-helpers`                                                                                                   | 占卜通用格式与计算工具                                                                                                                                   |
| **紫微斗数 Ziwei**     | `mingyu-core/ziwei/iztro`                                                                                                                     | iztro 十二宫、星曜、四化、证据池与大限时间线；评估 55 条可复算格局并登记 32 项原典边界                                                                   |
| **七政四余 Qizheng**   | `mingyu-core/qizheng`                                                                                                                         | 十一星、真实距星二十八宿界、命身十二宫、55组星对实际夹角、8项已校勘生年神煞起例、可信来源重建、传统规则审计边界与分层精度证据                            |

---

## 快速开始

### 八字排盘

除单盘排盘与分析外，`mingyu-core/bazi` 提供 `analyzeBaziCompatibility(chart1, chart2)`，用于生成可复核的八字双盘交叉证据，包括双方日主五行与十神、日支关系、四柱天干地支关系、跨盘三合三会组合、双向十神映射和喜忌资料覆盖；命盘没有可靠喜忌资料时明确记录缺口。结果同时提供通用证据包与可直接嵌入任务书的 `promptText`，不生成匹配总分，也不把五合、三合或三会候选直接视为成化。

`analyzeFortuneTriggers(chart, activeLayers)` 提供统一岁运触发证据：逐层比较原局四柱、大运、流年、流月、流日或流时的同干、五合、相冲、同支、六合、六冲、刑、害、破，并单列岁运并临与天克地冲。返回值保留双方层级、时间范围、规则来源、解释限制和 `promptText`，不从单条关系直接推断吉凶事件。

八字排盘只接受满足精度要求的出生时间。真太阳时、历史夏令时和节气边界校正属于确定性计算链；输入不满足要求时应在进入排盘前拒绝，不基于模糊范围继续计算。

每份结果的 `generation` 保存规范化公农历出生输入、精确时分与地点资料（如启用）、完整神煞口径、中国夏令时开关和生成时间。`rebuildAuditedBaziData` 只凭该来源完整重算；公开格式化、本命证据、合盘、岁运触发与岁运上下文均先审核重建，不采信调用方传入的四柱、日主、格局、神煞、大运、旧证据或合盘结果。可信来源缺失、夹带未知字段、时间戳非法、口径不完整或真太阳时时辰矛盾时明确拒绝。

岁运公开入口只接受 `scope`、`cycleIndex`、`year`、`month`、`day` 组成的原始选择，派生的干支、十神、日期范围、触发关系和提示词内容全部重新计算；把旧 `FortuneSelectionContext` 当作选择传入会失败关闭。

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
console.log(result.analysis); // 旺衰条件、格局及待复核的取用结构
console.log(result.luckInfo); // 大运
console.log(result.mingGua); // 命卦（八宅，按立春年界计算）
console.log(result.warnings); // 排盘预警；无预警时为空数组
console.log(result.generation); // 可供审核重建的规范化出生来源与生成时间
```

神煞争议口径默认采用主流算法：空亡按日柱旬空、羊刃只取阳干帝旺。需要兼容其他系统时，可显式传入 `shenShaVariants`：

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
  },
});
```

神煞结果只记录传统规则名称与命中柱位，不自动分类吉凶或现实事项。童子煞、十灵日、六秀日因当前规则未取得可逐条复核的古籍依据，正式入口不再生成。

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
// 六爻（默认以当前时间戳固定种子模拟三钱；time 是兼容方法名，并非传统历数起卦）
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
const liuyao = generateLiuyao();
// 也可指定模拟种子时间: generateLiuyao(new Date('2025-01-01T10:00:00'))
const coinLiuyao = generateLiuyao(undefined, { method: 'coins', seed: '本次投掷' });
console.log(coinLiuyao.generation.coinThrows); // 六爻逐爻、每爻三枚铜钱的完整轨迹
console.log(coinLiuyao.sanheFormations); // 卦内成局、月日补局、虚一待用及空破墓条件

// 梅花易数（数字起卦）
import { generateMeihua } from 'mingyu-core/divination/meihua';
const meihua = generateMeihua(undefined, { method: 'number', number: 123 });

// 奇门遁甲
import { generateQimen } from 'mingyu-core/divination/qimen';
const qimen = generateQimen(); // 当前时间，默认转盘法
const qimenFeipan = generateQimen(undefined, 'feipan'); // 可选飞盘法
const qimenMonth = generateQimen(new Date('2026-07-02T08:00:00+08:00'), 'zhuanpan', 'month'); // 月家按行年五年段三元定局
const qimenYear = generateQimen(new Date('2026-07-02T08:00:00+08:00'), 'zhuanpan', 'year'); // 年家奇门
console.log(qimen.seasonality); // 节令背景、月相、建除、四柱互动
console.log(qimen.patternCombos); // 固定文献条件已闭合的组合规则
console.log(qimen.evidenceAnalysis?.positionIndexes); // 值符、值使、日干、时干及已校勘格局的位置索引
console.log(qimen.evidenceAnalysis?.palaceRelations); // 九宫全部 36 组无序宫对五行关系
// 日家古法存在多套冲突版本，旧实现曾误用时家算法，当前明确拒绝生成。

// 大六壬
import { generateLiuren } from 'mingyu-core/divination/liuren';
const liuren = generateLiuren();

// 小六壬
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
const xiaoliuren = generateXiaoliuren({ method: 'time' });
const huashan = generateXiaoliuren({ method: 'time', school: 'huashan' });
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
const auditedHouse = bazhai.rebuildAuditedBaZhaiData(house); // 只凭 generation 重建全部派生盘面
console.log(house.mingPalace, house.housePalace); // 命卦、宅卦各自的八宫传统标签
console.log(house.groupRelation); // 同组 / 异组 / 未比较；只记录分组事实
const foundationCapabilities = foundation.getFoundationCapabilities();
console.log(foundationCapabilities.capabilityFacts); // 历法、干支、五行、方位与神煞目录能力事实
console.log(foundationCapabilities.promptText); // 来源、证据汇总与解释限制
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
const auditedZodiacYear = zodiac.rebuildAuditedZodiacData(zodiacYear);
console.log(auditedZodiacYear.generation, auditedZodiacYear.conflicts, auditedZodiacYear.harmony);
// 只返回生肖年支与流年干支命中的固定关系及五行生克方向；不生成利弊、现实贵人或行动建议
const taiyiChart = taiyi.generateTaiyi({ year: 2004, scope: 'year' });
const auditedTaiyiChart = taiyi.rebuildAuditedTaiyiData(taiyiChart);
const qizhengChart = qizheng.generateQizheng({
  year: 2024,
  month: 6,
  day: 15,
  hour: 12,
  minute: 0,
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
console.log(qizhengChart.stars.length, qizhengChart.mansionBoundaries.length); // 11 星、28 宿界
console.log(qizhengChart.positionSources); // 现代天文与传统均速来源分层
console.log(qizhengChart.shenshaFacts); // 8 项生年干/年支起例目标支；不是盘面命中或吉凶
```

星盘结果的 `generation` 保存规范化出生输入与生成时间。证据、摘要、行运、次限、太阳弧和太阳返照会先从该来源重建完整本命盘，不采信调用方传入的星体、宫位、相位、光照、摘要、时区诊断或顶层时间；缺少合法 `generation` 的旧结果会明确拒绝。西占双盘另保存双方本命 `generation`、完整点位选择、五种相位容许度、落宫开关和生成时间，双盘重建不会沿用旧跨盘相位或落宫结果。

七政四余的天乙昼贵与玉堂夜贵分开按生年干起例，驿马、华盖、劫煞、咸池、孤辰、寡宿按生年支起例。农历年干支与立春年柱不一致时，`shenshaFacts` 为空并保留完整规则目录与分歧证据。启用真太阳时时，固定 `timezone` 被视为已确认的标准时偏移；若使用 IANA 历史时区，必须另给 `standardMeridian`，系统不会把法定钟表偏移猜成标准经线。结果中的 `generation` 保存规范化出生输入与生成时间；`rebuildAuditedQizhengData` 和 `analyzeQizhengEvidence` 只凭该来源完整重算，旧盘派生字段不会进入公开证据或提示词，来源缺失或非法时直接拒绝。

### 八字事实分析

```typescript
import {
  analyzeTenGodStructure, // 十神结构分布
  analyzeTenGodFlow, // 十神家族固定生克事实
  analyzeStemRootProfile, // 透干通根
  analyzeRelationStructure, // 地支关系（三合/三会/六合/六冲/六害/三刑/相破）
  assessAllHarmonyTransforms, // 天干成化条件与地支六合关系
  calculateMingGua, // 命卦（东四命/西四命）
  buildLuckDirectionProfile, // 大运顺逆方向
} from 'mingyu-core/bazi';

const pillars = [/* 四柱 */];
const tenGod = analyzeTenGodStructure(pillars, '乙', getTenGod);
const tenGodRelations = analyzeTenGodFlow(tenGod);
const harmony = assessAllHarmonyTransforms(pillars);
const mingGua = calculateMingGua(1990, 'male'); // { number:1, gua:'坎', eastWest:'东四命' }
const luckDir = buildLuckDirectionProfile('male', '庚'); // { direction:'顺行' }
```

`analyzeTenGodStructure` 分别返回透干、藏支和合计次数；状态只标记“缺位、仅藏、透出、透藏并见”，不再用隐藏权重推断“有力”或“偏重”。输入必须是有效四柱，藏干须与固定地支藏干表一致，日主须与日柱天干一致，传入的十神函数也须与核心标准映射一致。

`analyzeTenGodFlow` 穷举五类十神之间固定的五条相生、五条相克关系，只在两个家族同时出现时登记方向，不把同时出现解释成实际流通、力量、喜忌、吉凶或现实事件。`analyzeTenGodLifeStageProfile` 对实际出现的天干去重，逐干列出其在年、月、日、时四支所临十二长生，不设置旺弱权重。

### 历法工具

```typescript
import { getDivinationTime, getVoidBranches } from 'mingyu-core/calendar';

const { ganzhi, timeInfo } = getDivinationTime(); // 当前时间干支
const voidBranches = getVoidBranches('甲子'); // ['戌','亥'] 旬空
```

---

## 主要 API 一览

### 八字（`mingyu-core/bazi`）

| 导出                            | 类型 | 说明                                   |
| ------------------------------- | ---- | -------------------------------------- |
| `baziCalculator`                | 实例 | 调用 `calculateBazi(person)`           |
| `BaziCalculator`                | 类   | 同上的类形式                           |
| `rebuildAuditedBaziData`        | 函数 | 只凭可信出生来源重建完整命盘           |
| `formatBaziForPrompt`           | 函数 | 审核重建后格式化可交给 AI 的盘面资料   |
| `analyzeBaziNatalEvidence`      | 函数 | 审核重建后返回本命证据                 |
| `analyzeBaziCompatibility`      | 函数 | 双方均审核重建后计算合盘证据           |
| `analyzeFortuneTriggers`        | 函数 | 审核原局后核验明确岁运层级             |
| `normalizeFortuneSelection`     | 函数 | 审核原局并规范化原始岁运选择           |
| `buildFortuneSelectionContext`  | 函数 | 从审核原局和原始选择重建岁运上下文     |
| `analyzeTenGodStructure`        | 函数 | 十神分布与家族聚合                     |
| `analyzeTenGodFlow`             | 函数 | 十神家族固定生克事实                   |
| `analyzeStemRootProfile`        | 函数 | 透干通根分析                           |
| `analyzeExposedStemProfile`     | 函数 | 透干月令、司令与通根事实               |
| `analyzeRelationStructure`      | 函数 | 地支关系完整评估                       |
| `assessAllHarmonyTransforms`    | 函数 | 自动扫描天干五合、地支六合并核验条件   |
| `assessStemHarmonyTransform`    | 函数 | 核验单组天干五合是否符合成化条件       |
| `assessBranchHarmonyTransform`  | 函数 | 评估单组地支六合及冲破，不直接裁定成化 |
| `analyzeKongWangProfile`        | 函数 | 空亡全分析                             |
| `analyzeTombStorage`            | 函数 | 辰戌丑未墓库分析                       |
| `analyzeLifeStageProfile`       | 函数 | 十二长生分布                           |
| `analyzeTenGodLifeStageProfile` | 函数 | 逐干逐支十二长生事实                   |
| `analyzeUsefulGodPlacement`     | 函数 | 旧兼容入口，自动规则固定关闭           |
| `analyzeNayinProfile`           | 函数 | 纳音五行分析                           |
| `analyzeMonthQiProfile`         | 函数 | 月令气数（旺相休囚死）                 |
| `calculateMingGua`              | 函数 | 命卦计算                               |
| `calculateXiaoYunProfile`       | 函数 | 小运（童限逐年）                       |
| `buildLuckDirectionProfile`     | 函数 | 大运顺逆方向                           |

### 占卜（`mingyu-core/divination/*`）

| 导出                                                                 | 说明                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `generateLiuyao(date?, options?)`                                    | 六爻时间种子模拟、手工爻值或三钱记录/模拟，并保留来源轨迹                    |
| `rebuildAuditedLiuyaoData(data)`                                     | 只凭时间戳与时间种子、手工爻值、实投三钱或 18 个可重放样本重建完整六爻卦盘   |
| `analyzeLiuyaoSanheFormations(yaosDetail, monthBranch, dayBranch)`   | 重算三合参与爻、成立模式、月日补局、虚一待用及空破墓状态                     |
| `analyzeLiuyaoEvidence(data, options?)`                              | 先审核重建，再返回分层用神、作用链、逐爻支持/反证及病药应期证据              |
| `generateMeihua(date?, settings?)`                                   | 梅花易数起卦                                                                 |
| `rebuildAuditedMeihuaData(data)`                                     | 只凭时间、方法、用户数字或可重放随机轨迹重建完整梅花卦盘                     |
| `analyzeMeihuaEvidence(data)`                                        | 先审核重建，再返回主互变逐阶段体用、旺衰与支持/限制证据                      |
| `generateQimen(date?, method?, scope?)`                              | 奇门遁甲排盘，并内置九宫原始事实、位置索引与全部宫对关系                     |
| `analyzeQimenEvidence(data)`                                         | 重建经审核的九宫、旬空马星、固定格、位置索引及应期方位边界                   |
| `generateLiuren(date?)`                                              | 大六壬排盘                                                                   |
| `analyzeLiurenEvidence(data)`                                        | 起盘与取传版本、逐传日干六亲、有方向关系、旺衰及条件化旬空证据               |
| `generateXiaoliuren(params?)`                                        | 小六壬起课                                                                   |
| `generateAlmanacSelection(params)`                                   | 黄历择日，并内置透明约束与候选证据                                           |
| `rebuildAuditedAlmanacData(data)`                                    | 只凭原始事项、日期范围、参与人出生输入和生成时间重建完整或分页结果           |
| `selectAuditedAlmanacData(data, view)`                               | 完整重算并排序后截取可复算分页视图                                           |
| `analyzeAlmanacEvidence(data)`                                       | 先审核重建，再返回日期分组、事项宜忌、参与人冲突、时辰与现实约束证据         |
| `drawSingleCard(options?)` / `drawSpreadCards(spreadType, options?)` | 塔罗抽牌；支持 `seed` 和 `replay` 完整复现                                   |
| `drawRandomSign(date?, options?)`                                    | 三山国王灵签；抽签后模拟掷筊确认，支持 `seed`、`replay` 和结构化证据完整复现 |
| `drawLenormandSpread(spreadType?, options?)`                         | 雷诺曼牌阵；支持 `seed` 和 `replay` 完整复现                                 |
| `generateAstrolabe(input)`                                           | 西洋星盘                                                                     |
| `rebuildAuditedAstrolabeData(data)`                                  | 只凭规范化出生输入和生成时间重建完整本命盘                                   |
| `analyzeAstrolabeEvidence(data)`                                     | 先审核重建，再返回星体、宫位、相位、光照与限制证据                           |
| `buildAstrolabeScopeContext(data, scope, date?)`                     | 星盘本命、流年、流月、流日行运与证据资料                                     |
| `analyzeAstrolabeSynastry(chart1, chart2, options?)`                 | 从双方可信本命来源计算完整双盘几何事实                                       |
| `rebuildAuditedAstrolabeSynastryData(data)`                          | 只凭双方出生来源、完整双盘参数和生成时间重建双盘                             |

### 历法与术数便捷入口

| 导出                                              | 说明                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `calendar.resolveTrueSolarBirthTime(input)`       | 公历/农历出生真太阳时、夏令时、跨日和时辰索引统一换算                |
| `bazhai.analyzeBaZhaiByDoorDegree(input)`         | 按入户实测度数、北向基准、磁偏角和测量误差生成八宫传统标签与候选坐向 |
| `bazhai.rebuildAuditedBaZhaiData(data)`           | 只凭出生/命卦与坐山/门向可信来源重建全部八宅派生盘面                 |
| `bazhai.analyzeBaZhaiEvidence(data)`              | 先审核重建八宅结果，再返回命宅、逐方、测量候选与限制证据             |
| `bazhai.getBaZhaiSitFacingFromDoorDegree(degree)` | 将入户实测度数换算成传统坐山、朝向与二十四山                         |
| `resolveZiweiTrueSolarBirth(input)`               | 紫微出生资料真太阳时日期与时辰索引适配                               |
| `zodiac.getZodiacYearFortune(branch, ganZhi)`     | 从生肖年支与合法六十甲子生成固定关系资料                             |
| `zodiac.rebuildAuditedZodiacData(data)`           | 只凭可信来源重建全部生肖流年关系、证据和提示词                       |
| `zodiac.analyzeZodiacEvidence(data)`              | 先审核重建生肖流年结果，再返回结构化证据                             |
| `taiyi.generateTaiyi({ year, scope: 'year' })`    | 生成已校勘的太乙年计七十二局                                         |
| `taiyi.rebuildAuditedTaiyiData(data)`             | 只凭原始公历年份重建太乙年计，忽略全部旧派生盘面与旧证据             |
| `taiyi.analyzeTaiyiEvidence(data)`                | 先审核重建太乙年计，再返回结构化证据                                 |
| `xuankong.generateXuanKong(input)`                | 从建造/起运年与单一山向来源生成玄空三盘和边界资料                    |
| `xuankong.rebuildAuditedXuanKongData(data)`       | 只凭可信年份、山向与卦型口径重建全部玄空派生盘面                     |
| `xuankong.analyzeXuanKongEvidence(data)`          | 先审核重建玄空结果，再返回三盘、替星、局型与限制证据                 |

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
