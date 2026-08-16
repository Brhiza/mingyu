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

| 术数     | 古籍依据                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| 八字     | 《渊海子平》《三命通会》《子平真诠》《滴天髓》《穷通宝鉴》                                                            |
| 六爻     | 《卜筮正宗》《增删卜易》                                                                                              |
| 梅花易数 | 《周易》《梅花易数》                                                                                                  |
| 奇门遁甲 | 《烟波钓叟歌》《遁甲演义》《奇门遁甲秘籍大全》《奇门遁甲统宗》《奇门旨归》《遁甲符应经》《太白阴经》                  |
| 大六壬   | 《大六壬大全》《御定六壬直指》《六壬指南》《六壬心镜》《六壬粹言》                                                    |
| 择日     | 《协纪辨方书》《象吉通书》                                                                                            |
| 紫微斗数 | 基础排盘委托 `iztro`，支持传统通行与中州派安星口径；固定版本传统目录登记 87 项，其中 55 条可复算、32 项只登记原典边界 |

---

## 安装

```bash
npm install mingyu-core
# 或
pnpm add mingyu-core
# 或
yarn add mingyu-core
```

依赖说明：

- `tyme4ts`、`astronomy-engine`、`celestine` 与 `@soul-atelier/xuankong` 是正式依赖，安装 `mingyu-core` 时会自动安装。
- `iztro` 是可选的 peer dependency；只有使用紫微斗数能力时才需要另行安装：`pnpm add iztro`。
- 中国省市区地点树和经度数据已内置，可直接用于出生地级联选择和真太阳时校正。

## 统一客户端

多数应用可从 `mingyu-core/client` 开始，不必自行拼接底层模块。普通方法沿用异常流程；`safe` 方法会把异常统一为可判别、可直接序列化的 `{ ok, data | error }`：

```ts
import { createMingyuClient } from 'mingyu-core/client';

const client = createMingyuClient();
const result = await client.safe.birth({
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 7,
});

if (result.ok) {
  console.log(result.data.bazi);
} else {
  console.error(result.error.code, result.error.message);
}
```

客户端直接提供以下高层能力：

- 综合能力：`birth()`、`compatibility()`、`divination()`。
- 出生与时间：`normalizeBirth()`、`trueSolarBirth()`、`astronomicalTime()`、`moonPhase()`、`solarTerm()`、`solarTerms()`、`solarIllumination()`。
- 传统与环境：`bazhai()`、`bazhaiByDoorDegree()`、`zodiac()`、`taiyi()`、`qizheng()`、`xuankong()`、`residentialFengshui()`。
- 基础设施：`capabilities()`、`capability()`、`serialize()`。

除异步的 `birth()`、`compatibility()` 及其 `safe` 版本外，其余方法都同步返回。默认出生盘只计算八字，不会因未安装 `iztro` 影响核心包或客户端导入；明确请求紫微时，`safe` 方法会返回 `IZTRO_DEPENDENCY_REQUIRED`。常见表单错误会区分为 `validation`、`boundary`、`unsupported` 或 `dependency`，调用方不必解析笼统的计算失败文本。`capability(id)` 接受带自动补全的 `SystemCapabilityId`；未知 ID 会抛出 `CAPABILITY_NOT_FOUND`，对应的 `safe.capability(id)` 返回结构化失败结果。

`mingyu-core/client` 会静态聚合全部高层能力，适合 Node.js、服务端或同一应用需要多种排盘的场景。浏览器页面只使用一两项能力时，优先从 `mingyu-core/zodiac`、`mingyu-core/calendar` 等具体子路径导入，可以显著减小前端产物；包已声明 `sideEffects: false`，并通过独立 Vite 消费构建验证子路径 tree-shaking。

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

`getCapabilities()` 返回可序列化副本，包含各系统支持的起法、真实输入、输出、随机种子、随机轨迹重放、真太阳时、是否要求完整出生时间、批量计算和可选依赖状态。塔罗和雷诺曼会声明手工录牌与交互抽牌输入，灵签会声明随机求签与指定签号；择日参与人可省略，不会错误标记为必须提供出生时刻。能力清单只描述核心包真实提供的能力，不把页面、本地报告或历史记录算作核心能力。

八字、紫微若不启用真太阳时，可以直接使用明确的时辰索引排盘；这属于有效的确定输入，不属于出生时间缺失。仅有时辰精度时，统一采用各时段中点作为完成历法日期换算的代表时刻（如午时按 12:00、早子时按 00:30）。统一档案会明确记录输入精度、代表时刻边界、时辰映射、真太阳时状态、证据汇总和解释限制。启用真太阳时，或转换为星盘等分钟级算法输入时，才需要具体小时、分钟和出生地资料；时辰代表值不会被冒充为精确分钟。

统一档案也提供传统盘便捷入口：`calculateBaziFromBirthProfile(profile)` 直接生成八字结果，`birthProfileToZiweiChartInput(profile)` 生成可交给 `mingyu-core/ziwei` 的紫微输入。农历真太阳时会先转换为公历钟表时间，再由八字引擎统一校正一次；出生地可用 `timezone` 提供固定偏移，或用 `timeZoneId` 按出生日期解析 IANA 历史时区，两者都未提供时默认 UTC+8。

如果应用需要一次取得多种盘面，可使用 `mingyu-core/birth` 的 `calculateBirthChartBundle`。默认只计算八字；需要紫微时请安装可选的 `iztro`，并通过 `systems` 明确选择系统：

```ts
import { calculateBirthChartBundle } from 'mingyu-core/birth';

const bundle = await calculateBirthChartBundle(profile, {
  systems: ['bazi', 'ziwei', 'astrolabe', 'qizheng'],
  ziwei: {
    scopes: ['origin', 'yearly'],
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 5 },
  },
});

console.log(bundle.bazi);
console.log(bundle.ziwei?.payloadByScope.origin);
console.log(bundle.astrolabe);
console.log(bundle.qizheng);
```

七政四余适配器会把原始民用时间交给七政四余自身校正；八字、紫微和星盘则分别采用各自明确的时间口径，不会把同一份真太阳时重复校正。

### 中国地点与真太阳时经度

中国省、市、区级联和真太阳时所需经度随 `mingyu-core` 一同安装，无需额外地点包：

```ts
import {
  findBirthPlaceByRegionId,
  resolveBirthPlaceLongitude,
  searchBirthPlaces,
} from 'mingyu-core/location';

const place = findBirthPlaceByRegionId('110101');
const longitude = resolveBirthPlaceLongitude('北京市 东城区');
const gulouDistricts = searchBirthPlaces('鼓楼区', { levels: ['district'] });
```

核心包内置 34 个省级、392 个市级和 3210 个区县级节点，其中 3255 个节点附有来源可追溯的行政中心纬度，其余 381 个节点会明确标记为省级近似纬度。行政中心坐标不等于实际出生地点；精度敏感的星盘应优先传入真实经纬度。自定义地点树缺少纬度时不会套用无依据的通用纬度。同名简称不会静默选中任意地点，应先搜索，再使用行政区代码或完整路径解析。

双人合盘也可直接使用两份 `BirthProfile`：

```ts
import { calculateCompatibilityBundle } from 'mingyu-core/compatibility';

const compatibility = await calculateCompatibilityBundle(primaryProfile, partnerProfile, {
  systems: ['bazi', 'ziwei', 'astrolabe'],
});

console.log(compatibility.bazi);
console.log(compatibility.ziwei);
console.log(compatibility.astrolabe);
```

```ts
import { birthProfileToZiweiChartInput, calculateBaziFromBirthProfile } from 'mingyu-core/profile';
import { buildAstrolabeFromInput } from 'mingyu-core/ziwei';

const profile = {
  name: '示例',
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30,
  location: { longitude: 116.4, latitude: 39.9, timezone: 8 },
  useTrueSolarTime: true,
} as const;

const bazi = calculateBaziFromBirthProfile(profile);
const ziweiInput = birthProfileToZiweiChartInput(profile);
const ziwei = await buildAstrolabeFromInput(ziweiInput);
```

需要把同一命主的八字与紫微资料放在统一主题下核对时，可直接使用合参入口。它保留两套体系各自的证据，不把结果压成综合分数。合参必须在 `ziwei.horoscopeContext` 中显式传入运限日期与时辰，或通过 `ziwei.now` 传入明确日期对象，避免运行时间改变结果：

```ts
import { calculateBaziZiweiCombinedReading } from 'mingyu-core/synthesis';

const reading = await calculateBaziZiweiCombinedReading(profile, {
  ziwei: {
    horoscopeContext: {
      dateStr: '2026-08-06',
      hourIndex: 7,
    },
  },
  prompt: { question: '未来十年的事业与迁移重点是什么？' },
});

console.log(reading.synthesis.themes);
console.log(reading.synthesis.timingReference);
console.log(reading.promptText);
```

合参的八字大运、童限和流年与紫微运限使用同一个日期快照；八字侧只纳入基准日期所在运限和同一公历年的流年，不会把无关年份整批写入任务书。

### 可直接复用的提示词与摘要

前端之外的应用也可以直接使用 `mingyu-core/prompt` 生成完整、可复制给在线 AI 的任务书。该模块只依赖核心算法和纯 TypeScript，不依赖 React、路由、浏览器存储或 AI 请求：

`mingyu-core/prompt/public-api` 是公开 HTTP 接口与旧调用方使用的紧凑兼容层；新集成优先使用 `mingyu-core/prompt`。紫微结构化快照以及现有前端、公开接口和 MCP 共用的 `buildCombinedZiweiPrompt()`、`buildCombinedZiweiCompatibilityPrompt()` 也可从 `mingyu-core/ziwei/prompt` 直接导入。

```ts
import { baziCalculator } from 'mingyu-core/bazi';
import { buildBaziPrompt, buildBaziCompatibilityPrompt } from 'mingyu-core/prompt';

const chart = baziCalculator.calculateBazi({
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 5,
  gender: 'female',
});

const prompt = buildBaziPrompt({
  result: chart,
  topic: 'career',
  question: '今年是否适合换工作？',
  fortuneScope: 'year',
});
console.log(prompt);
```

公共入口还包括 `buildBaziCompatibilityPrompt`、`buildZiweiPrompt`、`buildZiweiCompatibilityPrompt`、`buildBaziZiweiPrompt`、`buildAstrolabePrompt`、`buildAstrolabeSynastryPrompt`、`buildDivinationPrompt`，以及 `buildMetaphysicsPrompt`（八宅、住宅综合、生肖、七政四余、玄空）、`getDivinationSummaryBlocks`、`formatDivinationInfo`、`formatEnhancedDivinationInfo` 和 `formatDetailedDivinationInfo`。占法格式化已包含前端原有的用神、应期、宫位、节令、候选日与牌面证据。需要 system/user 分层时使用对应的 `build*PromptDocument`，需要单段便携文本时使用 `build*Prompt`。

需要自行组织紫微报告时，可从 `mingyu-core/ziwei/prompt` 使用 `buildPortablePromptPack`、`buildZiweiReadableSnapshot`、`buildZiweiTaskBookSnapshot`、`buildFocusTaskBundle` 和 `buildEvidenceSummary`。这些入口只接收结构化紫微资料和驼峰命名的 `ZiweiPromptContext`，不依赖页面状态。`mingyu-core/prompt` 同时公开 `PROMPT_GUIDANCE_TEXT`、`buildPromptGuidanceSections` 和 `insertPromptSectionBeforeHeading`，便于其他应用复用同一套传统依据与分段规则。

占法结果还可单独使用 `formatDivinationTime`、`formatDivinationSolarTime` 和 `formatSupplementaryInfo`，避免应用层重复维护时间与补充资料格式：

```ts
import { buildMetaphysicsPrompt, formatDetailedDivinationInfo } from 'mingyu-core/prompt';

const detail = formatDetailedDivinationInfo('liuyao', divinationData);
const residentialPrompt = buildMetaphysicsPrompt(
  residentialResult.prompt,
  '这个住宅的布局重点是什么？',
  { method: 'residential' },
);
```

如果应用需要复用前端原本的“选择占法→校验输入→生成结果→生成提示词”流程，可使用统一占法会话入口。它只接受纯数据，不依赖 React、路由或浏览器存储：

```ts
import { generateDivinationSession } from 'mingyu-core/divination/session';

const session = generateDivinationSession({
  method: 'liuyao',
  question: '这件事接下来如何推进？',
  divinationTime: '2026-08-06T12:30:00+08:00',
  liuyao: { method: 'manual', yaos: [7, 8, 9, 6, 7, 8] },
});

console.log(session.data); // 结构化排盘结果
console.log(session.displaySummary); // 简短展示摘要，不含审计证据
console.log(session.aiPrompt); // 只含问题和有效盘面资料，可直接交给在线 AI
console.log(session.auditEvidence); // 来源、规则、计算过程和限制，仅按需审计
console.log(session.view); // kind/input/chart/timing/summary/evidence/warnings/raw 统一视图
console.log(session.serializedResult); // 稳定 JSON，可用于缓存或历史记录
```

`generateDivinationSession` 覆盖六爻、梅花、小六壬、金口诀、奇门、大六壬、太乙、塔罗、灵签、黄历、雷诺曼和星盘；`validateDivinationRequest` 可单独用于提交前校验。旧版 `summary`、`prompt`、`data` 字段继续保留，新接入优先使用严格分层后的三个字段。手工牌面、三钱记录、逐张随机样本、灵签选号、种子和 replay 均保留在对应请求字段中。

如果需要一次得到本命盘、运限盘、结构化分析资料和大限时间线，可以直接使用紫微运行时入口。它支持数字或文本表单输入；服务端、缓存和测试建议显式传入 `horoscopeContext`，让同一出生盘在不同运行时保持相同快照：

```ts
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei/runtime';

const input = buildZiweiChartInput({
  name: '示例',
  gender: 'female',
  dateType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 4,
  isLeapMonth: false,
});

const runtime = await calculateZiweiChart(input, {
  scopes: ['origin', 'yearly'],
  horoscopeContext: {
    dateStr: '2026-08-06',
    hourIndex: 4,
  },
});

console.log(runtime.payloadByScope.origin);
console.log(runtime.decadalTimeline);
```

八字和紫微还提供可直接驱动运限选择器的便捷入口：

```ts
import {
  buildCurrentBaziFortuneSelection,
  buildRecentBaziFortuneSelection,
  getCurrentBaziLuckCycle,
} from 'mingyu-core/bazi';
import { buildZiweiFortuneOptions } from 'mingyu-core/ziwei/fortune';

const currentCycle = getCurrentBaziLuckCycle(baziResult, new Date('2026-08-06T12:00:00+08:00'));
const currentDay = buildCurrentBaziFortuneSelection(baziResult, new Date('2026-08-06'));
const recentMonth = buildRecentBaziFortuneSelection(baziResult, new Date('2026-08-06'));

const ziweiOptions = await buildZiweiFortuneOptions(ziweiInput, selectedDecadal, {
  selectedYearDateStr: '2026-05-15',
  selectedMonthDateStr: '2026-08-15',
});
```

当目标年份不在命盘已计算的童限或大运范围内时，三个八字当前运限入口都会返回 `null`，不会静默套用第一步大运。

`buildFortuneSelectionContext()` 会按精确交运时刻裁剪流年、流月、流日和流时，并在各级 `timeRange` 返回结构化本地时间与毫秒时间戳。流日默认返回标准十二时辰；需要兼容旧版早、晚子时拆分时，传入第三个参数 `{ hourMode: 'splitZi' }`。

## 可选结果元数据与随机重放

随机类算法会额外返回可选 `meta`，旧字段保持不变。`meta` 用于历史记录、缓存和复现，不参与传统排盘判断：

未传 `seed`、`replay` 或自定义随机源时，核心包使用运行环境的 Web Crypto；随机整数采用拒绝采样消除取模偏差。环境缺少安全随机能力时会明确报错，不会静默降级为时间戳或 `Math.random`。

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

| 模块                     | 子路径                                                                                                                                        | 说明                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **八字 Bazi**            | `mingyu-core/bazi`                                                                                                                            | 四柱排盘、神煞、调候用神、格局、大运、五行强度，含透干根气、十神结构、合化评估、命卦、小运等增强分析 |
| **紫微斗数 Ziwei**       | `mingyu-core/ziwei`（兼容 `mingyu-core/ziwei/iztro`）、`mingyu-core/ziwei/runtime`                                                            | 十二宫、星曜、四化、运限、证据池、固定快照运行时，以及双盘宫位叠盘与生年四化跨盘落点                 |
| **六爻 Liuyao**          | `mingyu-core/divination/liuyao`                                                                                                               | 京房八宫法、纳甲、世应、六亲六神、月破日破、化进退神、用神作用链与逐爻证据                           |
| **梅花易数 Meihua**      | `mingyu-core/divination/meihua`                                                                                                               | 时间/数字/随机起卦，timeTrigram 兼容、体用生克与主互变阶段推进证据                                   |
| **奇门遁甲 Qimen**       | `mingyu-core/divination/qimen`                                                                                                                | 转盘法、拆补定局、经典格局、节令背景、节气黄经核验、复合格局、方位与条件触发式应期证据               |
| **大六壬 Liuren**        | `mingyu-core/divination/liuren`                                                                                                               | 月将、贵人、九宗门取传、三传、天将、神煞及四课取传与三传推进证据                                     |
| **择日 Almanac**         | `mingyu-core/divination/almanac`                                                                                                              | 黄历宜忌、参与人冲突、候选时辰、透明约束证据、二十八宿与彭祖百忌                                     |
| **灵签 SSGW**            | `mingyu-core/divination/ssgw`                                                                                                                 | 三山国王 92 签，返回签号、签题与签诗原文，支持 `seed` 和 `replay`                                    |
| **西洋占星 Astrolabe**   | `mingyu-core/divination/astrolabe`                                                                                                            | 本命盘、Placidus 宫位、行星、扩展点、相位偏差、容许度分层、行运与太阳返照求根证据                    |
| **西占双盘 Synastry**    | `mingyu-core/divination/astrolabe-synastry`                                                                                                   | 双方主要跨盘相位、实际夹角、精确角、可配置容许度、紧密等级、跨盘落宫与结构化证据                     |
| **历法 Calendar**        | `mingyu-core/calendar`、`mingyu-core/calendar/true-solar-time`                                                                                | 农历、干支、节气黄经核验、朔弦望月相、太阳高度与曙暮光、真太阳时及 UTC/UT/TT 时间尺度证据            |
| **出生档案 Profile**     | `mingyu-core/profile`                                                                                                                         | 统一公农历、闰月、时辰、地点与真太阳时输入，直接生成八字传统盘并提供紫微、星盘、择日适配器           |
| **出生盘 Bundle**        | `mingyu-core/birth`                                                                                                                           | 从一份 `BirthProfile` 按需生成八字、紫微、星盘和七政四余结果                                         |
| **双人合盘 Bundle**      | `mingyu-core/compatibility`                                                                                                                   | 从两份 `BirthProfile` 生成八字合盘、紫微双盘证据和西占双盘相位                                       |
| **统一客户端 Client**    | `mingyu-core/client`                                                                                                                          | 高层出生盘、合盘、占法、能力发现、稳定序列化与安全返回协议                                           |
| **能力发现**             | `mingyu-core/capabilities`                                                                                                                    | 查询算法输入、输出、起法、依赖、随机复现和出生时间要求                                               |
| **提示词与摘要 Prompt**  | `mingyu-core/prompt`                                                                                                                          | 八字、紫微、星盘、元学和占法完整任务书；提供八字岁运、占法摘要、详细结果格式化与统一时间格式         |
| **统一占法会话 Session** | `mingyu-core/divination/session`                                                                                                              | 纯数据请求校验、占法分发、统一摘要、提示词和稳定序列化                                               |
| **结果协议 Result**      | `mingyu-core/result`                                                                                                                          | 稳定序列化、结果身份、结构版本与统一诊断                                                             |
| **随机能力 Random**      | `mingyu-core/random`                                                                                                                          | 系统级安全随机、无模偏差整数、种子、自定义随机源、原始样本记录与完整重放                             |
| **类型 Types**           | `mingyu-core/types`                                                                                                                           | 所有共享类型定义                                                                                     |
| **占法配置 Config**      | `mingyu-core/divination/config`                                                                                                               | 占法列表、起盘方式和前端共享配置                                                                     |
| **占法提示文本**         | `mingyu-core/divination/engine/method-text`、`mingyu-core/divination/engine/liuyao-template`、`mingyu-core/divination/engine/liuren-template` | 占法方法说明与六爻、大六壬问题范围提示                                                               |
| **原始数据 Data**        | `mingyu-core/divination/divination-data`                                                                                                      | 五行、六亲、纳甲、星曜等配置数据                                                                     |
| **六十四卦数据**         | `mingyu-core/divination/hexagram-data`                                                                                                        | 六爻卦象数据、梅花八卦索引                                                                           |
| **塔罗 Tarot**           | `mingyu-core/divination/tarot`                                                                                                                | 塔罗抽牌、牌阵、关键字                                                                               |
| **塔罗牌数据**           | `mingyu-core/divination/tarot-data`                                                                                                           | 塔罗牌定义与牌阵配置                                                                                 |
| **占卜辅助工具**         | `mingyu-core/divination/divination-helpers`                                                                                                   | 占卜通用格式与计算工具                                                                               |
| **七政四余 Qizheng**     | `mingyu-core/qizheng`                                                                                                                         | 十一星、真实距星二十八宿界、命身十二宫、庙旺吊照、天文事实与分层精度证据                             |

---

## 快速开始

### 八字排盘

除单盘排盘与分析外，`mingyu-core/bazi` 提供 `analyzeBaziCompatibility(chart1, chart2)`，用于生成可复核的八字双盘交叉证据，包括双方日主五行与十神、日支关系、四柱天干地支关系、跨盘三合三会组合、双向十神映射和喜忌五行覆盖。结果同时提供通用证据包与可直接嵌入任务书的 `promptText`，不生成匹配总分，也不把五合、三合或三会候选直接视为成化。

`analyzeFortuneTriggers(chart, activeLayers)` 提供统一岁运触发证据：逐层比较原局四柱、大运、流年、流月、流日或流时的同干、五合、相冲、同支、六合、六冲、刑、害、破，并单列岁运并临与天克地冲。返回值保留双方层级、时间范围、规则来源、解释限制和 `promptText`，不从单条关系直接推断吉凶事件。

`mingyu-core/prompt` 的八字任务书支持 `school`：盲派会组织四柱宫位十神、主宾体用、透干通根、墓库空亡、组合取象和分柱年限资料；新派会组织旺衰判定链、五行与十神流通、喜忌逐柱落位和动态岁运资料。只对规划内确有合理差异的术数提供通用 `schools` 参数，可选择一至三个流派、断法或解读侧重；多值时会要求分别判断、归纳共识与分歧并形成综合判断，并按实际类型使用“多派合参”“多法合参”或“多口径合参”。八字、紫微、住宅风水属于真实流派选择；塔罗、黄历择日、星盘和七政四余同时包含流派与断法；其余登记项属于不同断法，不称作不同派系。解读口径注册表、允许值和格式化能力由 `PROMPT_SCHOOL_PROFILES`、`getPromptSchoolIds()`、`formatPromptSchoolGuidance()` 提供，公开 API、MCP 与 npm 提示词入口共用同一生成口径。三山国王灵签提示词只列本次签谱资料，不附加派系段落，也不接受 `schools`。

八字排盘只接受满足精度要求的出生时间。真太阳时、历史夏令时和节气边界校正属于确定性计算链；输入不满足要求时应在进入排盘前拒绝，不基于模糊范围继续计算。

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
  timezone: 8, // 当地标准时区；不传默认 UTC+8
});
```

中国 1986-1991 年夏令时优先通过 `timeZoneId: 'Asia/Shanghai'` 自动解析。`applyChinaDst` 默认关闭，只为没有 IANA 时区资料的旧固定偏移调用保留；明确启用后会把命中时段的钟表时间回拨 60 分钟，并在 `warnings` 中提示校正依据：

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
  applyChinaDst: true,
});
```

不要同时传 `timeZoneId` 和 `applyChinaDst: true`，否则会因重复应用历史夏令时规则而拒绝计算。

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
  taiyi,
  qizheng,
} from 'mingyu-core';

const house = bazhai.analyzeBaZhai({ birthYear: 1990, gender: 'male', sitMountain: '子' });
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
const taiyiChart = taiyi.generateTaiyi({ year: 2004, scope: 'year' });
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
```

### 八字增强分析（从 vibebazi 整合）

```typescript
import {
  analyzeTenGodStructure, // 十神结构分布
  analyzeStemRootProfile, // 透干通根
  analyzeRelationStructure, // 地支关系（三合/三会/六合/六冲/六害/三刑/相破）
  assessAllHarmonyTransforms, // 天干成化条件与地支六合关系
  calculateMingGua, // 命卦（东四命/西四命）
  buildLuckDirectionProfile, // 大运顺逆方向
} from 'mingyu-core/bazi';

const pillars = [/* 四柱 */];
const tenGod = analyzeTenGodStructure(pillars, '乙', getTenGod);
const harmony = assessAllHarmonyTransforms(pillars);
const mingGua = calculateMingGua(1990, 'male'); // { number:1, gua:'坎', eastWest:'东四命' }
const luckDir = buildLuckDirectionProfile('male', '庚'); // { direction:'顺行' }
```

`analyzeTenGodStructure` 分别返回透干、藏支和合计次数；状态只标记“缺位、仅藏、透出、透藏并见”，不再用隐藏权重推断“有力”或“偏重”。

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
| `analyzeTenGodStructure`        | 函数 | 十神分布与家族聚合                     |
| `analyzeStemRootProfile`        | 函数 | 透干通根分析                           |
| `analyzeExposedStemProfile`     | 函数 | 透干综合画像                           |
| `analyzeRelationStructure`      | 函数 | 地支关系完整评估                       |
| `assessAllHarmonyTransforms`    | 函数 | 自动扫描天干五合、地支六合并核验条件   |
| `assessStemHarmonyTransform`    | 函数 | 核验单组天干五合是否符合成化条件       |
| `assessBranchHarmonyTransform`  | 函数 | 评估单组地支六合及冲破，不直接裁定成化 |
| `analyzeKongWangProfile`        | 函数 | 空亡全分析                             |
| `analyzeTombStorage`            | 函数 | 辰戌丑未墓库分析                       |
| `analyzeLifeStageProfile`       | 函数 | 十二长生分布                           |
| `analyzeTenGodLifeStageProfile` | 函数 | 十神十二长生分析                       |
| `analyzeUsefulGodPlacement`     | 函数 | 用神落点分析                           |
| `analyzeNayinProfile`           | 函数 | 纳音五行分析                           |
| `analyzeMonthQiProfile`         | 函数 | 月令气数（旺相休囚死）                 |
| `calculateMingGua`              | 函数 | 命卦计算                               |
| `calculateXiaoYunProfile`       | 函数 | 小运（童限逐年）                       |
| `buildLuckDirectionProfile`     | 函数 | 大运顺逆方向                           |

### 占卜（`mingyu-core/divination/*`）

| 导出                                                                 | 说明                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `generateLiuyao(date?, options?)`                                    | 六爻时间、手工或模拟三钱起卦，并保留投掷轨迹                            |
| `analyzeLiuyaoEvidence(data, options?)`                              | 六爻用神候选、原神忌神仇神和逐爻支持/反证结构化证据                     |
| `generateMeihua(date?, settings?)`                                   | 梅花易数起卦                                                            |
| `analyzeMeihuaEvidence(data)`                                        | 主卦、互卦、变卦逐阶段体用、旺衰与支持/限制证据                         |
| `generateQimen(date?, method?, scope?)`                              | 奇门遁甲排盘，并内置用神宫与宫间作用结构化证据                          |
| `analyzeQimenEvidence(data)`                                         | 值符值使、日时干候选宫及门星神干、反证和触发条件                        |
| `createQimenPriorityPalaces(data)`                                   | 按值符、宫位洞察、格局等证据来源归集奇门重点宫位候选                    |
| `generateLiuren(date?)`                                              | 大六壬排盘                                                              |
| `analyzeLiurenEvidence(data)`                                        | 四课取传、初传发用、三传旺衰空亡及反证限制                              |
| `generateAlmanacSelection(params)`                                   | 黄历择日，并内置透明约束与候选证据                                      |
| `analyzeAlmanacEvidence(data)`                                       | 日期分组、事项宜忌、参与人冲突、时辰与现实约束证据                      |
| `drawSingleCard(options?)` / `drawSpreadCards(spreadType, options?)` | 塔罗抽牌；支持 `seed` 和 `replay` 完整复现                              |
| `drawRandomSign(date?, options?)`                                    | 三山国王灵签；随机取一签并返回签号、签题与签诗，支持 `seed` 和 `replay` |
| `generateAstrolabe(input)`                                           | 西洋星盘                                                                |
| `buildAstrolabeScopeContext(data, scope, date?)`                     | 星盘本命、流年、流月、流日行运与证据资料                                |

### 历法与术数便捷入口

| 导出                                              | 说明                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `calendar.resolveTrueSolarBirthTime(input)`       | 公历/农历出生真太阳时、历史时区、夏令时、跨日和时辰索引统一换算  |
| `calendar.convertTrueSolarTime(input)`            | 当地钟表时间按固定偏移或 IANA 历史时区、经度和均时差换算真太阳时 |
| `profile.calculateBaziFromBirthProfile(profile)`  | 从统一出生档案直接生成八字传统盘结果                             |
| `profile.birthProfileToZiweiChartInput(profile)`  | 将统一出生档案转换为紫微传统盘输入                               |
| `bazhai.analyzeBaZhaiByDoorDegree(input)`         | 按入户实测度数、北向基准、磁偏角和测量误差生成八宅结果与候选坐向 |
| `bazhai.getBaZhaiSitFacingFromDoorDegree(degree)` | 将入户实测度数换算成传统坐山、朝向与二十四山                     |
| `resolveZiweiTrueSolarBirth(input)`               | 紫微出生资料真太阳时日期与时辰索引适配                           |

### 类型（`mingyu-core/types`）

所有返回值类型均从 `mingyu-core/types` 导出，包括 `BaziChartResult`、`LiuyaoData`、`QimenData`、`LiurenData`、`MeihuaData` 等。详细字段说明见 [API 参考文档](https://github.com/Brhiza/mingyu/blob/main/packages/core/docs/API.md)。

---

## 完整 API 文档

各模块的详细参数、返回值字段、数据结构说明，请参阅：

- 📖 **[API 参考文档](https://github.com/Brhiza/mingyu/blob/main/packages/core/docs/API.md)** — 所有函数签名与主要类型字段

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
