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

| 术数 | 古籍依据 |
|------|----------|
| 八字 | 《渊海子平》《三命通会》《子平真诠》《穷通宝鉴》 |
| 六爻 | 《卜筮正宗》《增删卜易》 |
| 梅花易数 | 《梅花易数》 |
| 奇门遁甲 | 《烟波钓叟歌》《遁甲演义》《奇门遁甲秘籍大全》 |
| 大六壬 | 《大六壬大全》《大六壬指南》 |
| 择日 | 《协纪辨方书》《象吉通书》 |
| 紫微斗数 | 《紫微斗数全书》 |

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

## 模块总览

| 模块 | 子路径 | 说明 |
|------|--------|------|
| **八字 Bazi** | `mingyu-core/bazi` | 四柱排盘、神煞、调候用神、格局、大运、五行强度，含透干根气、十神结构、合化评估、命卦、小运等增强分析 |
| **六爻 Liuyao** | `mingyu-core/divination/liuyao` | 京房八宫法、纳甲、世应、六亲六神、月破日破、化进退神 |
| **梅花易数 Meihua** | `mingyu-core/divination/meihua` | 时间/数字/随机/外应/时辰纳卦五种起卦法、体用生克 |
| **奇门遁甲 Qimen** | `mingyu-core/divination/qimen` | 转盘法、拆补定局、九九八十一格、经典格局、方位应期 |
| **大六壬 Liuren** | `mingyu-core/divination/liuren` | 月将、贵人、九宗门取传、三传、天将、神煞 |
| **小六壬 Xiaoliuren** | `mingyu-core/divination/xiaoliuren` | 六宫掌诀、五行生克、月令旺衰 |
| **择日 Almanac** | `mingyu-core/divination/almanac` | 黄历择日、神煞评分、二十八宿、彭祖百忌 |
| **灵签 SSGW** | `mingyu-core/divination/ssgw` | 三山国王 92 签随机抽签 |
| **雷诺曼 Lenormand** | `mingyu-core/divination/lenormand` | 36 张牌、8 种牌阵、牌义组合 |
| **西洋占星 Astrolabe** | `mingyu-core/divination/astrolabe` | 本命盘、Placidus 宫位、十大相位、行运 |
| **历法 Calendar** | `mingyu-core/calendar` | 农历、干支、节气、空亡、真太阳时 |
| **类型 Types** | `mingyu-core/types` | 所有共享类型定义 |
| **原始数据 Data** | `mingyu-core/divination/divination-data` | 五行、六亲、纳甲、星曜等配置数据 |
| **梅花外应配置** | `mingyu-core/divination/meihua-omens` | 梅花易数外应物象映射 |
| **六十四卦数据** | `mingyu-core/divination/hexagram-data` | 六爻卦象数据、梅花八卦索引 |
| **塔罗 Tarot** | `mingyu-core/divination/tarot` | 塔罗抽牌、牌阵、关键字 |
| **塔罗牌数据** | `mingyu-core/divination/tarot-data` | 塔罗牌定义与牌阵配置 |
| **占卜辅助工具** | `mingyu-core/divination/divination-helpers` | 占卜通用格式与计算工具 |
| **反推未知时辰** | `mingyu-core/birth-time-reverse` | 根据命盘特征反推时辰 |
| **紫微斗数 Ziwei** | `mingyu-core/ziwei/iztro` | iztro 封装、35 格局检测、证据池、大限时间线 |

---

## 快速开始

### 八字排盘

```typescript
import { baziCalculator } from 'mingyu-core/bazi';
import type { BaziChartResult } from 'mingyu-core/types';

// timeIndex: 0=早子时, 1=丑时, ..., 11=亥时, 12=晚子时
const result: BaziChartResult = baziCalculator.calculateBazi({
  year: 1990,
  month: 1,        // 1-12
  day: 1,
  timeIndex: 5,    // 巳时
  gender: 'male',  // 'male' | 'female'
});

console.log(result.pillars);
// { year: {gan:'庚', zhi:'午', ganZhi:'庚午'},
//   month: {gan:'丁', zhi:'丑', ganZhi:'丁丑'},
//   day:   {gan:'乙', zhi:'未', ganZhi:'乙未'},
//   hour:  {gan:'丁', zhi:'亥', ganZhi:'丁亥'} }

console.log(result.dayMaster);     // { gan:'乙', element:'木', yinYang:'阴' }
console.log(result.shensha);       // 各柱神煞
console.log(result.analysis);      // 强度、格局、用神
console.log(result.luckInfo);      // 大运
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
  year: 1990, month: 12, day: 5,    // 农历
  timeIndex: 5,
  gender: 'male',
  isLunar: true,        // 农历输入
  isLeapMonth: false,   // 是否闰月
});

// 真太阳时（按出生地经度校正）
const result2 = baziCalculator.calculateBazi({
  year: 1990, month: 1, day: 1,
  timeIndex: 0,
  gender: 'male',
  useTrueSolarTime: true,
  birthHour: 0, birthMinute: 30,
  birthLongitude: 116.4,  // 北京经度
});
```

### 占卜算法

```typescript
// 六爻（默认当前时间起卦）
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
const liuyao = generateLiuyao();
// 也可指定时间: generateLiuyao(new Date('2025-01-01T10:00:00'))

// 梅花易数（数字起卦）
import { generateMeihua } from 'mingyu-core/divination/meihua';
const meihua = generateMeihua({ method: 'number', number: 123 });

// 奇门遁甲
import { generateQimen } from 'mingyu-core/divination/qimen';
const qimen = generateQimen();                     // 当前时间，默认转盘法
const qimenFeipan = generateQimen(undefined, 'feipan');  // 可选飞盘法

// 大六壬
import { generateLiuren } from 'mingyu-core/divination/liuren';
const liuren = generateLiuren();

// 小六壬
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
const xiaoliuren = generateXiaoliuren({ method: 'time' });
```

### 八字增强分析（从 vibebazi 整合）

```typescript
import {
  analyzeTenGodStructure,    // 十神结构分布
  analyzeStemRootProfile,    // 透干通根
  analyzeRelationStructure, // 地支关系（三合/三会/六合/六冲/六害/三刑/相破）
  calculateMingGua,          // 命卦（东四命/西四命）
  buildLuckDirectionProfile, // 大运顺逆方向
} from 'mingyu-core/bazi';

const pillars = [/* 四柱 */];
const tenGod = analyzeTenGodStructure(pillars, '乙', getTenGod);
const mingGua = calculateMingGua(1990, 'male');  // { number:1, gua:'坎', eastWest:'东四命' }
const luckDir = buildLuckDirectionProfile('male', '庚');  // { direction:'顺行' }
```

### 历法工具

```typescript
import { getDivinationTime, getVoidBranches } from 'mingyu-core/calendar';

const { ganzhi, timeInfo } = getDivinationTime();  // 当前时间干支
const voidBranches = getVoidBranches('甲子');      // ['戌','亥'] 旬空
```

---

## 主要 API 一览

### 八字（`mingyu-core/bazi`）

| 导出 | 类型 | 说明 |
|------|------|------|
| `baziCalculator` | 实例 | 调用 `calculateBazi(person)` |
| `BaziCalculator` | 类 | 同上的类形式 |
| `analyzeTenGodStructure` | 函数 | 十神分布与家族聚合 |
| `analyzeStemRootProfile` | 函数 | 透干通根分析 |
| `analyzeExposedStemProfile` | 函数 | 透干综合画像 |
| `analyzeRelationStructure` | 函数 | 地支关系完整评估 |
| `analyzeKongWangProfile` | 函数 | 空亡全分析 |
| `analyzeTombStorage` | 函数 | 辰戌丑未墓库分析 |
| `analyzeLifeStageProfile` | 函数 | 十二长生分布 |
| `analyzeTenGodLifeStageProfile` | 函数 | 十神十二长生分析 |
| `analyzeUsefulGodPlacement` | 函数 | 用神落点分析 |
| `analyzeNayinProfile` | 函数 | 纳音五行分析 |
| `analyzeMonthQiProfile` | 函数 | 月令气数（旺相休囚死） |
| `analyzeMatterFocusProfile` | 函数 | 事项宫位分析 |
| `calculateMingGua` | 函数 | 命卦计算 |
| `calculateXiaoYunProfile` | 函数 | 小运（童限逐年） |
| `buildLuckDirectionProfile` | 函数 | 大运顺逆方向 |

### 占卜（`mingyu-core/divination/*`）

| 导出 | 说明 |
|------|------|
| `generateLiuyao(date?)` | 六爻起卦 |
| `generateMeihua(settings?)` | 梅花易数起卦 |
| `generateQimen(date?, method?)` | 奇门遁甲排盘 |
| `generateLiuren(date?)` | 大六壬排盘 |
| `generateXiaoliuren(params?)` | 小六壬起课 |
| `generateAlmanacSelection(params)` | 黄历择日 |
| `drawRandomSign()` | 三山国王灵签 |
| `drawLenormandSpread(spreadType?)` | 雷诺曼牌阵 |
| `generateAstrolabe(input)` | 西洋星盘 |

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

# 运行测试（692 个测试）
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
