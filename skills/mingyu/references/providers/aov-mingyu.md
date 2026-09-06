# AOV 公开 API 与 Mingyu MCP 适配手册

## 1. 架构总览

本提供方适配层将所有术数推演请求映射到 **AOV 公开 API (`https://aov.cc/api/v1`)** 或本地 **Mingyu MCP Server**。

---

## 2. 核心端点与能力全览

| 术数分类 | 功能名称 | REST API 路径 (POST) | 核心入参参数 |
| :--- | :--- | :--- | :--- |
| **基础授时** | 真太阳时换算 | `/calendar/true-solar-time` | `localDateTime`, `longitude`, `timezone`, `timeZoneId` |
| **先天命理** | 八字四柱排盘 | `/bazi/chart` | `gender`, `year`, `month`, `day`, `timeIndex`, `useTrueSolarTime` |
| **先天命理** | 八字提示词生成 | `/bazi/prompt` | 同上 + `question`, `topic` |
| **先天命理** | 紫微斗数排盘 | `/ziwei/chart` | 同上 |
| **先天命理** | 紫微提示词生成 | `/ziwei/prompt` | 同上 |
| **综合合参** | 八字紫微合参提示词 | `/bazi-ziwei/prompt` | 同上 + `synthesisOptions` |
| **事态占问** | 六爻排盘/提示词 | `/divination/liuyao/prompt` | `question`, `coins` 或 `autoCast: true` |
| **事态占问** | 时家奇门遁甲 | `/divination/qimen/prompt` | `question`, `date`, `method` (拆补/置闰) |
| **人事气象** | 大六壬排盘 | `/divination/liuren/prompt` | `question`, `date`, `monthGeneral` |
| **象意推演** | 梅花易数 | `/divination/meihua/prompt` | `question`, `method`, `numbers` |
| **时空择吉** | 黄历择日 | `/divination/almanac/prompt` | `topic`, `startDate`, `endDate`, `person1` |
| **环境风水** | 住宅风水合参 | `/residential/prompt` | `sitMountain`, `facingDegree`, `periodYear` |
| **姓名数理** | 姓名五格三才分析 | `/name/analyze/prompt` | `surname`, `givenName`, `gender` |
| **神示启迪** | 三山国王灵签 | `/divination/sanshan/prompt` | `question` |

---

## 3. 轻量化调用最佳实践

1. 若仅需直接交付在线大模型解读，优先使用各端点的 `/prompt` 版本，设置 `responseMode: "prompt-only"`，直接获取自包含任务书。
2. 若需前端渲染图表或深入交互，使用 `/chart` 端点，设置 `detailMode: "compact"` 获取精简结构化 JSON。
