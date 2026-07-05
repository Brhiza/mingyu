---
name: aov-mingyu-api
description: 通过 aov.cc 公开 API 调用命理、占卜和一站式提示词能力。用于需要八字排盘、紫微斗数排盘、六爻、梅花易数、奇门遁甲、大六壬、小六壬、塔罗、三山国王灵签、黄历择日、雷诺曼、星盘，或直接返回可交给 AI 解读的完整提示词的任务。
---

# AOV 命理与占卜 API

使用 `https://aov.cc/api/v1` 作为基础地址。所有接口返回统一 JSON：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "service": "aov.cc",
    "version": "v1"
  }
}
```

错误响应：

```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "错误说明"
  },
  "meta": {
    "service": "aov.cc",
    "version": "v1"
  }
}
```

## 工作流

1. 先读取 `GET /manifest` 或 `GET /openapi.json` 确认接口能力。
2. 只需要结构化数据时，调用 `/calculate` 或 `/divination/{method}` 排盘接口。
3. 需要 AI 解读提示词时，优先调用对应 `/prompt` 一站式接口，直接读取 `data.result` 和 `data.prompt`；占卜类接口还会返回 `data.summary`。
4. 向用户展示结果时，说明这是排盘和提示词数据，不替代医疗、法律、投资等专业建议。

## 常用接口

- `GET /health`：健康检查。
- `GET /manifest`：API 元数据、OpenAPI 地址和 skill 地址。
- `GET /openapi.json`：完整 OpenAPI JSON。
- `POST /bazi/calculate`：八字排盘。
- `POST /bazi/prompt`：八字排盘并生成结构化 AI 解读提示词。
- `POST /ziwei/calculate`：紫微斗数排盘。
- `POST /ziwei/prompt`：紫微斗数排盘并生成结构化 AI 解读提示词。
- `POST /divination/liuyao`：六爻起卦。
- `POST /divination/liuyao/prompt`：六爻起卦并生成结构化 AI 解读提示词。
- `POST /divination/meihua`：梅花易数起卦。
- `POST /divination/meihua/prompt`：梅花易数起卦并生成结构化 AI 解读提示词。
- `POST /divination/xiaoliuren`：小六壬起课。
- `POST /divination/xiaoliuren/prompt`：小六壬起课并生成结构化 AI 解读提示词。
- `POST /divination/qimen`：奇门遁甲排盘。
- `POST /divination/qimen/prompt`：奇门遁甲排盘并生成结构化 AI 解读提示词。
- `POST /divination/liuren`：大六壬排盘。
- `POST /divination/liuren/prompt`：大六壬排盘并生成结构化 AI 解读提示词。
- `POST /divination/tarot`：塔罗抽牌。
- `POST /divination/tarot/prompt`：塔罗抽牌并生成结构化 AI 解读提示词。
- `POST /divination/ssgw`：三山国王灵签求签。模拟传统摇签、掷筊流程，圣杯确认后出签；三连阴杯则拒绝起卦并返回拒绝原因。
- `POST /divination/ssgw/prompt`：三山国王灵签求签并生成结构化 AI 解读提示词。
- `POST /divination/almanac`：黄历择日。
- `POST /divination/almanac/prompt`：黄历择日并生成结构化 AI 解读提示词。
- `POST /divination/lenormand`：雷诺曼抽牌。
- `POST /divination/lenormand/prompt`：雷诺曼抽牌并生成结构化 AI 解读提示词。
- `POST /divination/astrolabe`：星盘生成。
- `POST /divination/astrolabe/prompt`：星盘生成并生成结构化 AI 解读提示词。
- `POST /ai/analyze`：AI 解读，返回 SSE 流式响应。
- `POST /ai/models`：获取当前 AI 配置可用的模型列表。

## 请求示例

八字排盘：

```bash
curl -X POST https://aov.cc/api/v1/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar"}'
```

紫微斗数排盘：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/calculate \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4}'
```

八字排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/bazi/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","question":"我适合创业还是上班？","promptTopic":"career"}'
```

紫微斗数排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4,"question":"我的感情关系要注意什么？","promptTopic":"relationship","promptScope":"origin"}'
```

塔罗抽牌：

```bash
curl -X POST https://aov.cc/api/v1/divination/tarot \
  -H "Content-Type: application/json" \
  -d '{"spreadType":"single"}'
```

塔罗抽牌并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/divination/tarot/prompt \
  -H "Content-Type: application/json" \
  -d '{"spreadType":"single","question":"我近期事业应该注意什么？"}'
```

按自定时间起卦并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/divination/liuyao/prompt \
  -H "Content-Type: application/json" \
  -d '{"customDate":"2025-01-01T08:30:00+08:00","question":"这个项目现在适合推进吗？"}'
```

八字盲派流派解读：

```bash
curl -X POST https://aov.cc/api/v1/bazi/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","question":"近期工作发展如何？","promptTopic":"career","school":"mangpai"}'
```

紫微飞星派流派解读：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4,"question":"2025年事业财运如何？","promptTopic":"career-wealth","promptScope":"yearly","school":"feixing"}'
```

奇门飞盘法排盘：

```bash
curl -X POST https://aov.cc/api/v1/divination/qimen/prompt \
  -H "Content-Type: application/json" \
  -d '{"qimenMethod":"feipan","question":"项目现在能推进吗？"}'
```

奇门排盘结果包含 `seasonality`（节气三元、节气五行、月相、建除十二神、四柱干支互动）和 `patternCombos`（吉凶叠加、吉格逢空、伏吟反吟叠马星等复合格局）。使用 `/prompt` 时，这些字段会进入提示词证据区。

黄历安葬择日：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac \
  -H "Content-Type: application/json" \
  -d '{"topic":"burial","startDate":"2026-07-01","endDate":"2026-07-15"}'
```

黄历择日：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac \
  -H "Content-Type: application/json" \
  -d '{"topic":"move","startDate":"2026-06-01","endDate":"2026-06-05","participants":[{"id":"self","name":"本人","gender":"男","year":1990,"month":1,"day":1,"timeIndex":12,"dateType":"solar"}]}'
```

星盘生成：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe \
  -H "Content-Type: application/json" \
  -d '{"name":"本人","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8,"locationName":"北京"}'
```

AI 流式解读：

```bash
curl -N -X POST https://aov.cc/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt":"请基于这段排盘资料做简明解读。"}'
```

获取可用模型列表：

```bash
curl -X POST https://aov.cc/api/v1/ai/models \
  -H "Content-Type: application/json" \
  -d '{"aiConfig":{"mode":"builtin"}}'
```

## 参数约定

通用参数：

- `gender`：八字和紫微使用 `male` 或 `female`；黄历择日和星盘使用 `男`、`女` 或空字符串。
- `dateType`：使用 `solar`（阳历）或 `lunar`（农历）。
- `timeIndex`：范围为 `0` 到 `12`，其中 `0` 为早子时，`1` 为丑时，...，`11` 为亥时，`12` 为晚子时。
- `isLeapMonth`：布尔值，仅农历有效。
- `useTrueSolarTime`：布尔值，启用真太阳时校正。八字和紫微开启后需提供 `birthHour`、`birthMinute`、`birthLongitude`，此时 `timeIndex` 由程序自动换算；星盘开启后使用 `hour`、`minute` 和 `longitude` 校正。

八字 `promptTopic` 支持以下主题：
`general`（综合）、`recent`（近期）、`career`（事业）、`job-change`（跳槽）、`startup-partnership`（创业合作）、`investment-partnership`（投资合作）、`wealth`（财运）、`marriage`（婚恋）、`relationship-push`（感情推进）、`relationship-decision`（关系去留）、`reconciliation-decision`（复合判断）、`children`（子女）、`family`（家庭）、`home-move`（搬家置业）、`settle-relocate`（定居换城）、`social`（人际合作）、`emotion`（情绪心理）、`health`（健康）、`parents`（父母）、`study`（学业）、`study-advance`（考证进修）、`exam-landing`（考试上岸）、`growth`（成长方向）、`talent`（天赋特质）。

紫微 `promptTopic` 支持以下主题：
`destiny`（命局）、`relationship`（感情）、`relationship-push`（感情推进）、`relationship-decision`（关系去留）、`career-wealth`（事业财运）、`job-change`（工作变动）、`startup-partnership`（创业合作）、`investment-partnership`（投资合作）、`recent`（近期趋势）、`family`（六亲家庭）、`home-move`（搬家置业）、`settle-relocate`（定居换城）、`social`（人际合作）、`emotion`（情绪心理）、`health`（健康养护）、`study`（学业成长）、`study-advance`（考证进修）、`exam-landing`（考试上岸）、`growth`（成长方向）、`talent`（天赋特质）、`reconciliation-decision`（复合判断）、`life`（人生解析）、`chat`（自由聊天）。

紫微 `promptScope` 支持：`origin`（本命）、`decadal`（大限）、`yearly`（流年）、`monthly`（流月）、`daily`（流日）、`hourly`（流时）、`age`（年龄）。公开 API 返回轻量排盘资料，默认只返回 `origin`；请求传入 `promptScope` 时，会返回 `origin` 加指定范围，包含分析对象、落宫与四化信息。

紫微排盘结果以 `payloadByScope.origin.palaces` 为主结构；接口同时提供 `四化`、`fourMutagens`、`birthMutagens` 和 `gongList`，方便 agent 直接读取生年四化和十二宫星曜。

`promptMode` 支持：`framework`（内置完整框架，默认）、`custom`（只围绕用户问题自由作答，不塞框架）。

八字 `school` 支持：`traditional`（传统派子平正法）、`mangpai`（盲派十神象法）、`xinpai`（新派调候流通）。不传则不附加流派指引。

紫微 `school` 支持：`sanhe`（三合派三方四正）、`feixing`（飞星派四化飞星链路）、`sihua`（四化派生年四化主线）。不传则不附加流派指引。

Python `urllib` 默认 `User-Agent` 可能被 Cloudflare 拦截；Python 调用时请显式设置正常 `User-Agent`，例如 `curl/8.0.0` 或业务自己的客户端名称。

占卜时间参数：

- `customDate`：六爻、梅花易数、小六壬、奇门遁甲、大六壬可用该字段指定起卦或排盘时间；不提供则使用当前时间。必须传带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:00:00+08:00`。

占卜通用参数：

- `question`：所有 `/prompt` 接口的必填字段，黄历择日 `/prompt` 中可不填。
- `supplementaryInfo`：对象类型，占卜补充信息。

各占卜方法特有参数：

- 梅花易数 `method`：`time`（时间起卦）、`number`（数字起卦）、`random`（随机起卦）、`timeTrigram`（兼容旧参数，按年月日时起卦法计算）。`method` 为 `number` 时需提供 `number`（正整数）。
- 小六壬 `xiaoliurenMethod`：`time`、`number`、`random`。`number` 时需提供 `xiaoliurenNumber`（正整数）。
- 塔罗 `spreadType`：`single`（单牌指引）、`three`（时间流）、`love`（爱情）、`career`（事业）、`decision`（选择）、`celtic`（凯尔特十字）、`chakra`（七脉轮）、`year`（年运）、`mindBodySpirit`（身心灵）、`horseshoe`（马蹄铁）。
- 六爻 `liuyaoTemplate`：`general`（通用）、`ganqing`（感情）、`shiye`（事业）、`caifu`（财运）、`guaishen`（鬼神怪异）。
- 大六壬 `liurenTemplate`：`general`（通用）、`ganqing`（感情）、`shiye`（事业）、`caifu`（财富）。
- 奇门遁甲 `qimenMethod`：`zhuanpan`（转盘法，默认）、`feipan`（飞盘法）。返回中可读取 `seasonality` 和 `patternCombos` 作为时令与复合格局证据。
- 黄历择日 `topic`：`marriage`（嫁娶）、`move`（搬家）、`opening`（开业）、`contract`（签约）、`travel`（出行）、`medical`（求医）、`study`（求学）、`burial`（安葬修坟）、`renovation`（修造动土）、`custom`（自定义）。
- 黄历择日 `startDate`、`endDate`：日期范围字符串。`participants`：参与者数组，每人包含 `id`、`name`、`gender`、`year`、`month`、`day`、`timeIndex`、`dateType`、`isLeapMonth`。
- 雷诺曼 `spreadType`：`single`（单牌）、`three`（三牌）、`five`（五牌十字阵）、`relationship`（关系）、`decision`（选择）、`nine`（九宫）、`element`（元素牌阵）、`grandTableau`（大桌牌阵）。
- 星盘 `year`、`month`、`day`、`hour`、`minute`：出生时间。`latitude`、`longitude`：经纬度。`timezone`：时区偏移。`locationName`：地点名称。可传 `useTrueSolarTime` 启用真太阳时校正；提示词接口可传 `astrolabeTopic` 和 `astrolabeScopeText`，用于写入本命、流年、流月或流日分析对象。

AI 接口参数：

- `/ai/analyze` 请求体支持 `{ "prompt": "..." }` 单轮解析，或 `{ "messages": [{ "role": "user", "content": "..." }] }` 多轮追问；可选 `aiConfig` 指定 `builtin` 或 `custom` 模式。成功时返回 `text/event-stream`，每条增量以 `data: {"content":"..."}` 形式输出。
- `/ai/models` 请求体支持 `{ "aiConfig": { "mode": "builtin" } }` 或自定义 OpenAI 兼容配置，返回 `{ "ok": true, "models": ["模型 ID"] }`。
