# Changelog

## 0.1.9 (2026-07-04)

### 新增与修复

- **中国夏令时校正**：八字真太阳时排盘支持 1986-1991 年中国夏令时自动回拨，并通过 `applyChinaDst: false` 兼容已折算为标准时间的出生记录。
- **排盘边界预警**：八字结果新增 `warnings`，提示节气交接、时辰边界、23:00 换日线、夏令时跳变/重复时段等可能翻柱的情形。
- **基础参考补齐**：八字结果稳定输出命卦、命宫、身宫等基础参考，提示词资料包同步保留对应信息。
- **古籍神煞补齐与校正**：按《三命通会》《五行精纪》《神峰通考》等补充可由四柱稳定判断的神煞旁证，包括马财库、官星学堂、食神学堂、魁星、文星、生成禄、名位禄、食神带禄、生成马、名位马、金神大杀等；同步收敛误判表、重复占位和过强断语。
- **传统理法回归收敛**：保留能覆盖古籍修复错误的关键回归和原文依据，删除重复、过细或只锁内部实现的断言，改为少量关键回归加一次完整验证。

### 验证

- 补充中国夏令时、节气/时辰边界、命卦立春年界与八字结果页展示回归验证。
- 神煞关键回归 `102 pass / 0 fail`，完整验证 `963 pass / 0 fail`，并通过 lint、build 与 `git diff --check`。

## 0.1.8 (2026-07-02)

### 🚀 新增功能

- **八字合化程度评分** — 新增 `assessAllHarmonyTransforms`、`assessStemHarmonyTransform`、`assessBranchHarmonyTransform`，按月令、透干、根气、冲破、清杂、争合评估天干五合与地支六合的成化程度。
- **奇门节令背景** — `generateQimen()` 新增 `seasonality`，输出当前节气、节气三元、节气五行、日干与节令关系、月相、建除十二神和四柱干支互动。
- **奇门复合格局** — `generateQimen()` 新增 `patternCombos`，识别同宫吉凶叠加、吉格逢空、三奇齐升/齐困、伏吟反吟叠驿马等结构化组合。

### 📚 文档改进

- README、API 文档、公开 API/skill/MCP 文档同步补充八字合化评分与奇门新增字段说明。

## 0.1.6 (2026-07-01)

### 🎯 优化

- **日家奇门补充日干入墓检查** — `scope: 'day'` 时检测日干是否落入墓支

### 🔧 修复

- 修复 CI 构建顺序问题（build 脚本改为先构建 mingyu-core 再 vite build）

## 0.1.5 (2026-07-01)

### 🚀 新增功能

- **奇门支持年家/月家/日家/时家四级别** — `generateQimen(customDate?, method?, scope?` 新增 `scope: 'hour' | 'day' | 'month' | 'year'` 参数。默认 `'hour'` 保持向后兼容。时家/日家使用拆补法定局，月家使用月支循环定局，年家使用年干分组 + 三元甲子周期定局。
- **`drawRandomSign(customDate?)`** — 灵签现在支持传入自定义时间参数，与其他占卜算法保持一致
- **`configure({ timezoneOffset })`** — 新增统一全局配置入口，取代手动调用 `TimeManager.setTimezoneOffsetMinutesOverride()`

### 📚 文档改进

- 所有占卜主入口函数补全了 JSDoc（`@param`、`@returns`、`@example`）
- 核心类型接口（`QimenData`、`MeihuaData`、`LiuyaoData`、`LiurenData`、`BaziChartResult`）所有字段添加了 JSDoc 注释
- API.md 修正 `calculateTrueSolarTime` 错误列在 calendar 命名空间下的问题
- README 补充了所有子路径导出清单

### 🧹 清理与修复

- **SSGW 统一**：从 `package.json exports` 中移除 `./divination/ssgw-data`
- **删除 17,893 行重复代码**：移除 `src/` 下与 `mingyu-core` 重复的算法副本
- **类型统一**：`src/types/divination.ts` 改为 re-export `mingyu-core/types`
- 排除死代码（`config.ts`、`share-text.ts`、`engine/*` 不再编译）

### 🐛 修复

- 修复 `pnpm --filter mingyu-core test` 测试脚本路径问题

### 📦 打包

- 修复 package.json 元数据：补充 `author`、`bugs`、`homepage` 字段，修正 `repository.url`

## 0.1.3 (2026-07-01)

---

## 0.1.2 (2026-06-30)

- 修复 CI lint 错误（移除未使用变量、prettier 格式化）
- 补全择日与灵签的结构化输出
- 补全剩余占卜方法的提示词结构化增强
- 系统化增强所有占卜提示词结构化内容

## 0.1.1 (2026-06-30)

- 补全李虚中三柱命理的分析接口和提示词指令
- 完善起名与三柱复合分析，补完紫微大限分拆输出

## 0.1.0 (2026-06-30)

- 首次发布
- 从 mingyu monorepo 中抽取核心算法包
- 覆盖八字、六爻、梅花易数、奇门遁甲、大六壬、小六壬、紫微斗数、西洋星盘、择日、灵签、塔罗、雷诺曼
