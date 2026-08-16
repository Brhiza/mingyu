---
name: aov-mingyu-api
description: 通过 aov.cc 公开 API 调用真太阳时换算、命理、占卜和一站式提示词能力。用于需要真太阳时、八字排盘、紫微斗数排盘、六爻、梅花易数、奇门遁甲、大六壬、塔罗、三山国王灵签、黄历择日、星盘、西占双盘、八宅、太乙神数、五运六气、皇极经世、七政四余，或直接返回可交给 AI 解读的完整提示词的任务。
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
3. 需要 AI 解读提示词时，优先调用对应 `/prompt` 一站式接口并传 `responseMode: "prompt-only"`，只读取 `data.prompt`。只有确实需要向用户展示结构化盘面时才改用 `summary`，需要完整原始排盘时才改用 `full`。
4. 同一人需要“先八字定主线、再紫微校验”的深度解读时，优先调用 `/bazi-ziwei/prompt`，不要分别调用八字和紫微后自行拼接提示词。
5. 向用户展示结果时，说明这是排盘和提示词数据，不替代医疗、法律、投资等专业建议。

`/prompt` 默认采用 `prompt-only`，只返回可直接交给 AI 的完整提示词，避免响应和下游 AI 消息过大。需要轻量结构化展示时传 `responseMode: "summary"`；需要完整排盘时才传 `responseMode: "full"`。八字、紫微、奇门和黄历排盘可传 `detailMode: "compact"` 获取轻量结构。黄历大范围或多参与人应使用 `page/pageSize` 拆成多次请求。

## 调用选择指南

优先调用一站式 `/prompt` 接口，直接使用返回的 `data.prompt`。不要把多个排盘结果手动拼成提示词，除非用户明确要求原始数据或你需要做结构化展示。

默认决策：

- 有完整出生信息，且用户问人生、事业、财运、婚恋、亲子、健康、迁居、学习、考试、合作、近期趋势、某年某阶段走势：优先调用 `POST /bazi-ziwei/prompt`。这是深度解读的首选方案，用八字定主线，用紫微校验宫位、四化和运限。
- 用户明确只要八字：调用 `POST /bazi/prompt`。长期或完整阶段分析用 `baziFortuneScope: "full"`；指定年份、月份、日期时用对应范围。
- 用户明确只要紫微：调用 `POST /ziwei/prompt`。长期或完整阶段分析用 `promptScope: "full"`；指定年份、月份、日期时用 `yearly`、`monthly`、`daily` 或 `hourly`。
- 用户要求紫微合盘或双方宫位、四化互动证据：调用 `POST /ziwei/compatibility/prompt`；只要结构化数据时调用 `POST /ziwei/compatibility`。
- 用户问一件事现在能不能成、要不要推进、对方态度、短期应期：优先用六爻 `POST /divination/liuyao/prompt`；涉及方位、项目路径、谈判、出行和时空窗口时优先用奇门 `POST /divination/qimen/prompt`。
- 用户要从日期范围里挑日子：调用 `POST /divination/almanac/prompt`，日期多或参与人多时分页。
- 用户提供一人的西方星盘资料：调用 `POST /divination/astrolabe/prompt`；提供双方完整资料并询问关系：调用 `POST /divination/astrolabe/synastry/prompt`。
- 用户没有出生信息，只想要轻量启发、牌阵或签文：调用塔罗、雷诺曼或三山国王灵签提示词接口。
- 用户明确要求八宅、生肖犯太岁、太乙、五运六气、皇极经世或七政四余：调用对应的 `POST /metaphysics/{method}/prompt`；只要结构化排盘时改用 `/calculate`。五运六气至少给公历年或年干支；皇极经世普通占断只需给公元年。

问题到接口速查：

| 问题类型                       | 首选接口                                     | 关键参数                                                                    |
| ------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| 整体人生、长期事业、财运、婚恋 | `POST /bazi-ziwei/prompt`                    | `baziPromptTopic`、`ziweiPromptTopic`、`promptScope: "full"` 或 `"origin"`  |
| 今年运势、当前阶段、某年趋势   | `POST /bazi-ziwei/prompt`                    | `promptScope: "yearly"`，主题按事业、财运、感情等选择                       |
| 换工作、创业、合伙、投资       | `POST /bazi-ziwei/prompt`                    | `job-change`、`startup-partnership`、`investment-partnership`               |
| 八字格局、用神、大运流年       | `POST /bazi/prompt`                          | `promptTopic`、`baziFortuneScope`                                           |
| 紫微宫位、四化、运限           | `POST /ziwei/prompt`                         | `promptTopic`、`promptScope`                                                |
| 一事一问、短期成败、应期       | `POST /divination/liuyao/prompt`             | `question`、可选 `customDate`                                               |
| 项目推进、方向、方位、谈判     | `POST /divination/qimen/prompt`              | `question`、可选 `qimenMethod`、`customDate`                                |
| 临时小事快速判断               | `POST /divination/xiaoliuren/prompt`         | `question`、可选 `xiaoliurenMethod`、`xiaoliurenSchool`、`xiaoliurenNumber` |
| 时间或数字象意判断             | `POST /divination/meihua/prompt`             | `question`、可选 `method`、`number`、`customDate`                           |
| 传统复杂事项推演               | `POST /divination/liuren/prompt`             | `question`、可选 `liurenTemplate`、`customDate`                             |
| 结婚、搬家、开业、签约、安葬   | `POST /divination/almanac/prompt`            | `topic`、`startDate`、`endDate`、可选 `participants`、`page`、`pageSize`    |
| 星盘本命和行运                 | `POST /divination/astrolabe/prompt`          | 出生时间地点、经纬度、`astrolabeTopic`、`astrolabeScope`                    |
| 西占双方关系、合作或婚恋互动   | `POST /divination/astrolabe/synastry/prompt` | `person1`、`person2` 分别提供完整出生时间、经纬度和时区                     |
| 牌阵启发                       | `POST /divination/tarot/prompt`              | `spreadType`、`question`                                                    |
| 雷诺曼关系或选择牌阵           | `POST /divination/lenormand/prompt`          | `spreadType`、`question`                                                    |
| 生肖犯太岁、流年贵人           | `POST /metaphysics/zodiac/prompt`            | `zodiac`、`year` 或 `yearGanZhi`                                            |
| 年度五运六气、符会与六步节令   | `POST /metaphysics/wuyun-liuqi/prompt`       | `year` 或 `yearGanZhi`，可选 `question`                                     |
| 皇极经世年度占断               | `POST /metaphysics/huangji-jingshi/prompt`   | 普通模式传公元 `year`；自定义纪元再传 `epochYear`                           |
| 求签                           | `POST /divination/ssgw/prompt`               | `question`                                                                  |

参数默认建议：

- `responseMode` 默认和推荐值都是 `prompt-only`；需要结构化展示时用 `summary`；需要完整排盘时才用 `full`。
- `promptMode` 通常保持 `framework`，这样提示词更完整；只有用户已写好完整自由问题时才用 `custom`。
- 八字神煞保持默认 `shenShaScope: "common"`，只返回 55 个常用神煞；用户明确要求全部神煞、研究或审计原始结果时才传 `shenShaScope: "all"`。
- 出生时辰未知时，不要自行补时辰。八字可以保守分析，紫微和八字紫微合参应先让用户补足时辰。

## 常用接口

- `GET /health`：健康检查。
- `GET /manifest`：API 元数据、OpenAPI 地址和 skill 地址。
- `GET /openapi.json`：完整 OpenAPI JSON。
- `POST /calendar/true-solar-time`：把当地钟表时间换算为真太阳时，返回修正明细、跨日状态和对应时辰；可用 `applyChinaDst` 校正中国 1986–1991 历史夏令时。
- `GET /foundation/capabilities`：公共地基能力、常量与可复用模块目录。
- `POST /foundation/ganzhi`：查询六十甲子的纳音、藏干、五行和合冲刑害破。
- `POST /foundation/wuxing`：统计天干地支五行分布，可选计入藏干权重。
- `POST /foundation/direction`：把罗盘度数换算为二十四山坐向、后天八卦与分界状态。
- `POST /foundation/shensha`：严格核验完整四柱，返回空亡、驿马、桃花的起法、目标地支、命中柱位、来源声明与解释限制。
- `POST /bazi/calculate`：八字排盘。
- `POST /bazi/prompt`：八字排盘并生成结构化 AI 解读提示词。
- `POST /bazi/compatibility`：八字双盘日主、日支、四柱交叉关系、双向十神、喜忌覆盖与证据计算。
- `POST /bazi/compatibility/prompt`：八字双盘计算并生成完整结构化证据提示词。
- `POST /ziwei/calculate`：紫微斗数排盘。
- `POST /ziwei/prompt`：紫微斗数排盘并生成结构化 AI 解读提示词。
- `POST /ziwei/compatibility`：紫微双盘关键宫位叠盘、生年四化跨盘落宫与证据计算。
- `POST /ziwei/compatibility/prompt`：紫微双盘计算并生成完整结构化证据提示词。
- `POST /bazi-ziwei/prompt`：同一出生信息同时生成八字和紫微排盘摘要，并返回八字紫微合参 AI 解读提示词。
- `POST /divination/liuyao`：六爻起卦。
- `POST /divination/liuyao/prompt`：六爻起卦并生成结构化 AI 解读提示词。
- `POST /divination/meihua`：梅花易数起卦。
- `POST /divination/meihua/prompt`：梅花易数起卦并生成结构化 AI 解读提示词。
- `POST /divination/qimen`：奇门遁甲排盘。
- `POST /divination/qimen/prompt`：奇门遁甲排盘并生成结构化 AI 解读提示词。
- `POST /divination/liuren`：大六壬排盘。
- `POST /divination/liuren/prompt`：大六壬排盘并生成结构化 AI 解读提示词。
- `POST /divination/tarot`：塔罗抽牌。
- `POST /divination/tarot/prompt`：塔罗抽牌并生成结构化 AI 解读提示词。
- `POST /divination/ssgw`：三山国王灵签求签，返回签号、签题与签诗。
- `POST /divination/ssgw/prompt`：三山国王灵签求签并生成 AI 解读提示词。
- `POST /divination/almanac`：黄历择日。
- `POST /divination/almanac/prompt`：黄历择日并生成结构化 AI 解读提示词。
- `POST /divination/astrolabe`：星盘生成。
- `POST /divination/astrolabe/prompt`：星盘生成并生成结构化 AI 解读提示词。
- `POST /divination/astrolabe/synastry`：西占双盘相位、角距、容许度、落宫与证据计算。
- `POST /divination/astrolabe/synastry/prompt`：西占双盘计算并生成结构化证据提示词。
- `POST /metaphysics/bazhai/calculate`、`POST /metaphysics/bazhai/prompt`：八宅排盘与提示词。
- `POST /metaphysics/taiyi/calculate`、`POST /metaphysics/taiyi/prompt`：年家太乙七十二局排盘与提示词；当前不提供未完整复原的月、日、时家。
- `POST /metaphysics/wuyun-liuqi/calculate`、`POST /metaphysics/wuyun-liuqi/prompt`：岁运太过不及、司天在泉、气运相临、天符岁会等五类符会、六步节令主客气及完整提示词。
- `POST /metaphysics/huangji-jingshi/calculate`、`POST /metaphysics/huangji-jingshi/prompt`：按公元年返回元会运世、会内统卦、运卦、六十年统卦、十年卦、值年卦及互错综卦；仍支持自定义纪元坐标换算。
- `POST /metaphysics/qizheng/calculate`、`POST /metaphysics/qizheng/prompt`：七政四余十一星、真实距星二十八宿界、命身十二宫、庙旺吊照、分层天文证据与提示词。
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

八字紫微合参提示词：

```bash
curl -X POST https://aov.cc/api/v1/bazi-ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":1992,"month":8,"day":21,"timeIndex":4,"question":"我现在适合换工作还是继续等待？","baziPromptTopic":"job-change","ziweiPromptTopic":"job-change","promptScope":"yearly"}'
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

奇门排盘结果包含 `seasonality`（节气三元、节气五行、月相、建除十二神、四柱干支互动）和 `patternCombos`（吉凶叠加、吉格逢空、伏吟反吟叠马星等复合格局）。使用 `/prompt` 时，这些字段会进入提示词证据区；直接排盘可传 `detailMode: "compact"` 获取轻量结构。轻量结构只保留核心盘面、方位和少量高权重组合，并返回完整数量，适合上游 AI 代理按需拆成多次请求。

如果调用方确实需要完整排盘和提示词同时返回，显式传 `responseMode: "full"`：

```bash
curl -X POST https://aov.cc/api/v1/divination/qimen/prompt \
  -H "Content-Type: application/json" \
  -d '{"qimenMethod":"feipan","question":"项目现在能推进吗？","responseMode":"full"}'
```

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

黄历分页轻量返回：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac \
  -H "Content-Type: application/json" \
  -d '{"topic":"move","startDate":"2026-06-01","endDate":"2026-06-30","page":1,"pageSize":5,"detailMode":"compact"}'
```

黄历提示词也可分页，大范围或多参与人时按页多次请求：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac/prompt \
  -H "Content-Type: application/json" \
  -d '{"topic":"move","startDate":"2026-06-01","endDate":"2026-06-30","page":1,"pageSize":5}'
```

星盘生成：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe \
  -H "Content-Type: application/json" \
  -d '{"name":"本人","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8,"locationName":"北京"}'
```

西占双盘提示词：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe/synastry/prompt \
  -H "Content-Type: application/json" \
  -d '{"person1":{"name":"甲","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8},"person2":{"name":"乙","gender":"男","year":1992,"month":8,"day":21,"hour":8,"minute":15,"latitude":31.2304,"longitude":121.4737,"timezone":8},"question":"我们长期合作时最需要注意什么？","responseMode":"prompt-only"}'
```

五运六气提示词：

```bash
curl -X POST https://aov.cc/api/v1/metaphysics/wuyun-liuqi/prompt \
  -H "Content-Type: application/json" \
  -d '{"year":2026,"question":"请解释本年的运气结构和气候节律。","responseMode":"prompt-only"}'
```

皇极经世完整值年卦提示词：

```bash
curl -X POST https://aov.cc/api/v1/metaphysics/huangji-jingshi/prompt \
  -H "Content-Type: application/json" \
  -d '{"year":2026,"question":"请解释这一年的事业环境与主要变化。","responseMode":"prompt-only"}'
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
- `useTrueSolarTime`：布尔值。八字和紫微开启后需提供 `birthHour`、`birthMinute`、`birthLongitude`，此时 `timeIndex` 由程序自动换算；星盘开启后只附带真太阳时参考证据，现代星历仍采用民用出生时间对应的真实 UTC 瞬间。
- `responseMode`：`/prompt` 可用。`prompt-only` 为默认值，只返回提示词；`summary` 返回提示词和轻量摘要；`full` 返回完整排盘和提示词。
- `detailMode`：八字、紫微、奇门和黄历排盘可用。`full` 返回完整结构；`compact` 返回轻量结构。
- `question` 和 `astrolabeScopeText` 最多 5000 个字符。
- 五运六气使用 `year` 或 `yearGanZhi`；同时提供时会校验两者一致。`year` 按该公历年年中所属年柱换算，避免把元旦当作干支年界。结果会逐项给出同气、顺化、天刑、小逆、不和，天符、岁会、太乙天符、同天符、同岁会，以及六步节令和主客气五行关系。
- 吴谦《运气要诀》的五类符会逐年名单去重为 26 年，与原文“二十八年”汇总不一致；返回值保留 `sourceReconciliation`，并按逐项定义计算。
- 皇极经世普通模式只需公元 `year`，默认采用公元前 67017 年为本元起点、1984 年鼎卦为甲子值年锚点的通行排法；返回会内统卦、运卦、六十年统卦、十年卦、值年卦及互卦、错卦、综卦。
- 自定义纪元模式提供 `epochYear`，并从 `year` 与 `elapsedYears` 中选择一项；该模式只做元会运世坐标换算。
- `progress` 会列出当前元、会、运、世内已过年数、当前年之后剩余的完整年数和下一层开始年；所有层级序号从 1 开始。

八字 `promptTopic` 支持以下主题：
`general`（综合）、`recent`（近期）、`career`（事业）、`job-change`（跳槽）、`startup-partnership`（创业合作）、`investment-partnership`（投资合作）、`wealth`（财运）、`marriage`（婚恋）、`relationship-push`（感情推进）、`relationship-decision`（关系去留）、`reconciliation-decision`（复合判断）、`children`（子女）、`family`（家庭）、`home-move`（搬家置业）、`settle-relocate`（定居换城）、`social`（人际合作）、`emotion`（情绪心理）、`health`（健康）、`parents`（父母）、`study`（学业）、`study-advance`（考证进修）、`exam-landing`（考试上岸）、`growth`（成长方向）、`talent`（天赋特质）。

八字 `/bazi/prompt` 可传 `baziFortuneScope` 指定命限范围：`natal`（本命）、`full`（完整输出版）、`dayun`（大运）、`year`（流年）、`month`（流月）、`day`（流日）。`full` 会写入完整大运与逐年流年，不需要再传具体年限参数。选择 `dayun` 时必须传 `baziFortuneCycleIndex`；选择 `year`、`month`、`day` 时必须依次传入对应层级的 `baziFortuneYear`、`baziFortuneMonth`、`baziFortuneDay`，交运年份可同时传 `baziFortuneCycleIndex` 消除重叠歧义。工具不会自动选择当前时间或第一项。

紫微 `promptTopic` 支持以下主题：
`destiny`（命局）、`relationship`（感情）、`relationship-push`（感情推进）、`relationship-decision`（关系去留）、`career-wealth`（事业财运）、`job-change`（工作变动）、`startup-partnership`（创业合作）、`investment-partnership`（投资合作）、`recent`（近期趋势）、`family`（六亲家庭）、`home-move`（搬家置业）、`settle-relocate`（定居换城）、`social`（人际合作）、`emotion`（情绪心理）、`health`（健康养护）、`study`（学业成长）、`study-advance`（考证进修）、`exam-landing`（考试上岸）、`growth`（成长方向）、`talent`（天赋特质）、`reconciliation-decision`（复合判断）、`life`（人生解析）、`chat`（自由聊天）。

紫微 `promptScope` 支持：`origin`（本命）、`full`（完整输出版）、`decadal`（大限）、`yearly`（流年）、`monthly`（流月）、`daily`（流日）、`hourly`（流时）、`age`（年龄）。公开 API 默认只返回 `origin`；请求传入 `promptScope` 时，会返回 `origin` 加指定范围，包含分析对象、落宫与四化信息；`full` 会返回并写入本命、大限、流年、流月、流日、流时资料。

紫微排盘结果以 `payloadByScope.origin.palaces` 为主结构；接口同时提供 `四化`、`fourMutagens`、`birthMutagens` 和 `gongList`，方便 agent 直接读取生年四化和十二宫星曜。

紫微 `patterns` 当前评估 55 条已按《紫微斗数全书》固定版本登记且可复算的规则，每项包含卷次、原文、命中条件和解释边界；另有 32 项原典边界不伪造命中，`pattern_analysis` 汇总 87 项固定目录的登记数、评估数与命中数。原 84 条未校勘项目规则继续停用；空列表只表示当前可复算规则未命中，不表示命盘没有其他传统格局，也不要自行补造目录外格局。

八字紫微合参 `/bazi-ziwei/prompt` 使用同一份出生信息，支持 `baziPromptTopic`、`ziweiPromptTopic`、`promptScope`、`promptMode`、`baziSchool`、`ziweiSchool`、`baziSchools`、`ziweiSchools`、`responseMode`。默认只返回 `data.prompt`；需要轻量双盘摘要时传 `responseMode: "summary"`，需要完整双盘时传 `responseMode: "full"`。

`promptMode` 支持：`framework`（内置完整框架，默认）、`custom`（只围绕用户问题自由作答，不塞框架）。

八字 `school` 支持：`traditional`（传统兼容名，等同子平派）、`ziping`（子平派月令格局、调候行运）、`mangpai`（盲派宫位十神、主宾体用、通根墓库、组合取象与分柱年限）、`xinpai`（新派旺衰判定、十神流通、喜忌落位与动态岁运）。选择盲派或新派后，提示词会写入对应的逐项盘面资料；不传则不附加流派段落。

紫微 `school` 支持：`sanhe`（三合派三方四正）、`feixing`（飞星派四化飞星链路）、`sihua`（四化派生年四化主线）。不传则不附加流派指引。

只对规划内确有合理差异的提示词接口提供 `schools` 数组，一次选择一至三个流派、断法或解读侧重。传一个值时按该口径解读；传两个或三个值时，提示词会要求各口径分别判断，再归纳共同结论、分歧及各自盘面依据，最后形成综合判断。同属流派时称“多派合参”，同属断法时称“多法合参”，混合类型时称“多口径合参”。八字、紫微、住宅风水属于真实流派选择；塔罗、黄历择日、星盘和七政四余同时包含流派与断法；其余登记项属于不同断法，不称作不同派系。八字、紫微原有 `school` 为单派兼容参数，同时传入时以 `schools` 为准；八字紫微合参分别使用 `baziSchools`、`ziweiSchools`。

各术数允许值：八字 `ziping/mangpai/xinpai`；紫微 `sanhe/feixing/sihua`；六爻 `huozhulin/bushizhengzong/zengshanbuyi`；梅花 `tiyong/xiangshu/yaoci`；小六壬 `shunshu/gongjue`；金口诀 `siwei/fayong/wudong`；奇门 `gongwei/geju/zhuke`；大六壬 `keti/bifafu/leishen`；塔罗 `rws/yuansu/narrative`；雷诺曼 `combination/eventline/significator`；黄历择日 `xieji/jianchu/comprehensive`；星盘及西占双盘 `modern/traditional/timing`；太乙 `zhuke/gongwei`；八宅 `dayounian/mingzhai`；住宅风水 `bazhai/xuankong`；玄空 `sanYuan/shanxiang`；七政四余 `guolao/wuxingjingyi`；生肖 `ganzhi/sanhe`；五运六气 `yunqi/sitian/kezhu`；皇极经世 `yuanhui/guaqi`。

奇门的转盘/飞盘、拆补/置闰和时家/日家等参数决定实际排盘，`schools` 只改变解读方法；紫微 `algorithm` 同理属于排盘口径。三山国王灵签提示词只列本次签谱资料，不附加派系段落，也不接受 `schools`。

Python `urllib` 默认 `User-Agent` 可能被 Cloudflare 拦截；Python 调用时请显式设置正常 `User-Agent`，例如 `curl/8.0.0` 或业务自己的客户端名称。

占卜时间参数：

- `customDate`：六爻、梅花易数、奇门遁甲、大六壬可用该字段指定起卦或排盘时间；不提供则使用当前时间。必须传带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:00:00+08:00`。

占卜通用参数：

- `question`：所有 `/prompt` 接口的必填字段，黄历择日 `/prompt` 中可不填。
- `supplementaryInfo`：对象类型，占卜补充信息。

各占卜方法特有参数：

- 梅花易数 `method`：`time`（时间起卦）、`number`（数字起卦）、`random`（随机起卦）、`timeTrigram`（兼容旧参数，按年月日时起卦法计算）。`method` 为 `number` 时需提供 `number`（正整数）。
- 塔罗 `spreadType`：`single`（单牌指引）、`three`（时间流）、`love`（爱情）、`career`（事业）、`decision`（选择）、`celtic`（凯尔特十字）、`chakra`（七脉轮）、`year`（年运）、`mindBodySpirit`（身心灵）、`horseshoe`（马蹄铁）。
- 六爻 `liuyaoTemplate`：`general`（通用）、`ganqing`（感情）、`shiye`（事业）、`caifu`（财运）、`guaishen`（鬼神怪异）。
- 大六壬 `liurenTemplate`：`general`（通用）、`ganqing`（感情）、`shiye`（事业）、`caifu`（财富）。
- 奇门遁甲 `qimenMethod`：`zhuanpan`（转盘法，默认）、`feipan`（飞盘法）。返回中可读取 `seasonality` 和 `patternCombos` 作为时令与复合格局证据。
- 黄历择日 `topic`：`marriage`（嫁娶）、`move`（搬家）、`opening`（开业）、`contract`（签约）、`travel`（出行）、`medical`（求医）、`study`（求学）、`burial`（安葬修坟）、`renovation`（修造动土）、`custom`（自定义）。
- 黄历择日 `startDate`、`endDate`：日期范围字符串，一次最多 31 天。`participants`：参与者数组，每人包含 `id`、`name`、`gender`、`year`、`month`、`day`、`timeIndex`、`dateType`、`isLeapMonth`，一次最多 30 位；更多日期或参与人请拆成多次请求。
- 黄历择日 `page`、`pageSize`：分页参数，`pageSize` 最大 31。不传分页时返回全部日期；传分页后只返回当前页并带 `pagination`。`page` 超过总页数会返回 400，请按 `pagination.totalPages` 继续请求。
- 雷诺曼 `spreadType`：`single`（单牌）、`three`（三牌）、`five`（五牌十字阵）、`relationship`（关系）、`decision`（选择）、`nine`（九宫）、`element`（元素牌阵）、`grandTableau`（大桌牌阵）。
- 星盘 `year`、`month`、`day`、`hour`、`minute`：出生时间。`latitude`、`longitude`：经纬度。`timezone`：时区偏移。`locationName`：地点名称。可传 `useTrueSolarTime` 启用真太阳时校正；提示词接口可传 `astrolabeTopic`、`astrolabeScope`、`astrolabeScopeDate` 和 `astrolabeScopeText`。`astrolabeScope` 支持 `natal`、`full`、`yearly`、`monthly`、`daily`；`yearly`、`monthly`、`daily` 分别要求 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 格式的 `astrolabeScopeDate`，`full` 也必须提供 `YYYY-MM-DD` 基准日并写入该日所属的本命、流年、流月、流日资料；传入 `astrolabeScopeText` 时以自定义文本为准。

AI 接口参数：

- `/ai/analyze` 请求体支持 `{ "prompt": "..." }` 单轮解析，或 `{ "messages": [{ "role": "user", "content": "..." }] }` 多轮追问；可选 `aiConfig` 指定 `builtin` 或 `custom` 模式。成功时返回 `text/event-stream`，每条增量以 `data: {"content":"..."}` 形式输出。当前接口会拒绝过大的请求体，单次解析消息总内容最多 50000 字符，多轮消息最多 30 条；超限会直接返回 400，调用方应拆分请求。
- `/ai/models` 请求体支持 `{ "aiConfig": { "mode": "builtin" } }` 或自定义 OpenAI 兼容配置，返回 `{ "ok": true, "models": ["模型 ID"] }`。
