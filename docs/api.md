# 命语公开 API

命语官方公开 API 运行在 `https://aov.cc/api/v1`，适合开发者、AI 代理、自动化工作流直接调用排盘、占卜和一站式提示词生成能力。`aov.cc` 是官方实例域名；自部署或 fork 到自己的 Pages 域名后，接口元数据和 OpenAPI 地址会按实际访问域名生成。

## 快速入口

- API 元数据：[https://aov.cc/api/v1/manifest](https://aov.cc/api/v1/manifest)
- OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)
- 发现元数据：[https://aov.cc/.well-known/aov-mingyu-api.json](https://aov.cc/.well-known/aov-mingyu-api.json)
- Skill 文档：[https://aov.cc/skills/aov-mingyu-api/SKILL.md](https://aov.cc/skills/aov-mingyu-api/SKILL.md)

## 返回格式

成功响应：

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

自部署时，`meta.service` 会显示当前访问域名，例如 `你的域名` 或 Pages 预览域名。

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

## 接口列表

| 接口                                  | 说明                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /health`                         | 健康检查                                                                       |
| `GET /manifest`                       | 获取 API 元数据                                                                |
| `GET /openapi.json`                   | 获取 OpenAPI 文档                                                              |
| `POST /bazi/calculate`                | 八字排盘                                                                       |
| `POST /bazi/prompt`                   | 八字排盘并生成 AI 解读提示词                                                   |
| `POST /bazi/compatibility`            | 八字双盘交叉关系、十神、喜忌覆盖与证据计算                                     |
| `POST /bazi/compatibility/prompt`     | 八字双盘计算并生成结构化证据提示词                                             |
| `POST /ziwei/calculate`               | 紫微斗数排盘                                                                   |
| `POST /ziwei/prompt`                  | 紫微斗数排盘并生成 AI 解读提示词                                               |
| `POST /bazi-ziwei/prompt`             | 八字紫微合参并生成 AI 解读提示词                                               |
| `POST /divination/liuyao`             | 六爻起卦                                                                       |
| `POST /divination/liuyao/prompt`      | 六爻起卦并生成 AI 解读提示词                                                   |
| `POST /divination/meihua`             | 梅花易数起卦                                                                   |
| `POST /divination/meihua/prompt`      | 梅花易数起卦并生成 AI 解读提示词                                               |
| `POST /divination/xiaoliuren`         | 小六壬起课                                                                     |
| `POST /divination/xiaoliuren/prompt`  | 小六壬起课并生成 AI 解读提示词                                                 |
| `POST /divination/qimen`              | 奇门遁甲排盘                                                                   |
| `POST /divination/qimen/prompt`       | 奇门遁甲排盘并生成 AI 解读提示词                                               |
| `POST /divination/liuren`             | 大六壬排盘                                                                     |
| `POST /divination/liuren/prompt`      | 大六壬排盘并生成 AI 解读提示词                                                 |
| `POST /divination/tarot`              | 塔罗抽牌                                                                       |
| `POST /divination/tarot/prompt`       | 塔罗抽牌并生成 AI 解读提示词                                                   |
| `POST /divination/ssgw`               | 三山国王灵签求签：模拟传统摇签、掷筊流程，圣杯确认后方出签；三连阴杯则拒绝起卦 |
| `POST /divination/ssgw/prompt`        | 三山国王灵签求签并生成 AI 解读提示词                                           |
| `POST /divination/almanac`            | 黄历择日                                                                       |
| `POST /divination/almanac/prompt`     | 黄历择日并生成 AI 解读提示词                                                   |
| `POST /divination/lenormand`          | 雷诺曼抽牌                                                                     |
| `POST /divination/lenormand/prompt`   | 雷诺曼抽牌并生成 AI 解读提示词                                                 |
| `POST /divination/astrolabe`          | 星盘生成                                                                       |
| `POST /divination/astrolabe/prompt`   | 星盘生成并生成 AI 解读提示词                                                   |
| `POST /divination/astrolabe/synastry` | 西占双盘相位、落宫与证据计算                                                   |
| `POST /divination/astrolabe/synastry/prompt` | 西占双盘计算并生成证据提示词                                            |
| `POST /metaphysics/bazhai/calculate`  | 八宅命卦、宅卦与大游年方位                                                     |
| `POST /metaphysics/bazhai/prompt`     | 八宅排盘并生成 AI 解读提示词                                                   |
| `POST /metaphysics/zodiac/calculate`  | 生肖犯太岁与流年运程                                                           |
| `POST /metaphysics/zodiac/prompt`     | 生肖流年排盘并生成 AI 解读提示词                                               |
| `POST /metaphysics/taiyi/calculate`   | 太乙神数排盘                                                                   |
| `POST /metaphysics/taiyi/prompt`      | 太乙神数排盘并生成 AI 解读提示词                                               |
| `POST /metaphysics/qizheng/calculate` | 七政四余排盘                                                                   |
| `POST /metaphysics/qizheng/prompt`    | 七政四余排盘并生成 AI 解读提示词                                               |
| `POST /ai/analyze`                    | AI 解读，返回 SSE 流式响应                                                     |
| `POST /ai/models`                     | 获取当前 AI 配置可用的模型列表                                                 |

## Agent 调用选择指南

面向自动化代理时，优先使用 `/prompt` 一站式接口，让接口直接返回可交给 AI 解读的 `data.prompt`，不要先取完整排盘再自行拼装提示词。只有需要做表格展示、二次计算或缓存结构化数据时，才调用 `/calculate` 或 `/divination/{method}`。

默认优先级：

1. 用户提供了完整出生信息，并询问人生、事业、财运、婚恋、亲子、健康、迁居、学习、考试、合作、近期趋势或某一年某阶段走势时，优先用 `POST /bazi-ziwei/prompt`。八字负责定命局主线、喜忌和岁运，紫微负责校验宫位、四化、三方四正和运限，通常比单独八字或单独紫微更稳。
2. 用户只提供出生年月日时，但问题只要求单一体系，或明确要求“只看八字”“只看紫微”时，再分别用 `POST /bazi/prompt` 或 `POST /ziwei/prompt`。
3. 用户问“这件事现在能不能做、要不要推进、对方态度、短期成败、近期应期”这类即时问题，优先用时间类占卜提示词：六爻、奇门、梅花、小六壬、大六壬。
4. 用户要从一段日期里挑日子，优先用 `POST /divination/almanac/prompt`；日期超过 31 天或参与人很多时分页调用。
5. 用户提供一人的西方占星出生资料时，用 `POST /divination/astrolabe/prompt`；提供双方完整出生资料并询问关系时，用 `POST /divination/astrolabe/synastry/prompt`。
6. 用户只想要轻量灵感、心理牌面或不提供出生信息时，可用塔罗、雷诺曼、灵签等提示词接口。
7. 用户明确要求八宅、生肖犯太岁、太乙或七政四余时，使用对应的 `/metaphysics/{method}/prompt`；只需结构化排盘时改用 `/calculate`。

常见问题到推荐接口：

| 用户问题类型                       | 首选接口                                 | 推荐参数                                                                               | 说明                                              |
| ---------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 换算真太阳时                       | `POST /calendar/true-solar-time`         | `localDateTime`、`longitude`，可选 `timezone`、`applyChinaDst`                         | 默认 UTC+8，返回修正明细、跨日状态和对应时辰      |
| 查六十甲子、纳音、藏干和合冲       | `POST /foundation/ganzhi`                | `ganZhi`，如“甲子”                                                                     | 返回统一公共地基资料，不需重复实现                |
| 统计天干地支五行分布               | `POST /foundation/wuxing`                | `items`、可选 `weightHidden`                                                           | 默认计入地支藏干权重                              |
| 整体人生、长期事业、财运、婚恋     | `POST /bazi-ziwei/prompt`                | `baziPromptTopic`、`ziweiPromptTopic` 按主题填写，`promptScope: "full"` 或 `"origin"`  | 有完整出生信息时优先合参；想看完整阶段时用 `full` |
| 今年、某一年、当前阶段运势         | `POST /bazi-ziwei/prompt`                | `promptScope: "yearly"`，主题填事业、财运、感情等                                      | 八字看岁运触发，紫微看流年落宫与四化              |
| 换工作、创业、合伙、投资合作       | `POST /bazi-ziwei/prompt`                | `job-change`、`startup-partnership`、`investment-partnership`，按问题选择主题          | 这类问题兼具长期结构和当前触发，优先合参          |
| 只看八字格局、用神、流年流月       | `POST /bazi/prompt`                      | `promptTopic`，`baziFortuneScope: "full"`、`"year"`、`"month"` 或 `"day"`              | 明确要求八字时使用                                |
| 只看紫微宫位、四化、某年某月运限   | `POST /ziwei/prompt`                     | `promptTopic`，`promptScope: "full"`、`"yearly"`、`"monthly"`、`"daily"` 或 `"hourly"` | 明确要求紫微时使用                                |
| 当前事项能否推进、短期成败         | `POST /divination/liuyao/prompt`         | `question`，必要时传 `customDate`                                                      | 六爻适合一事一问、取用和应期                      |
| 项目推进、方向选择、谈判出行、方位 | `POST /divination/qimen/prompt`          | `question`，可选 `qimenMethod: "zhuanpan"` 或 `"feipan"`，必要时传 `customDate`        | 奇门适合时空局势、路径、方位和行动窗口            |
| 临时小事、快速判断                 | `POST /divination/xiaoliuren/prompt`     | `question`，可选 `xiaoliurenMethod` 和 `xiaoliurenNumber`                              | 小六壬适合短平快，不适合长期命运                  |
| 以数字或时间起卦的象意判断         | `POST /divination/meihua/prompt`         | `question`，可选 `method`、`number` 或 `customDate`                                    | 梅花适合象意、触发点和过程结果                    |
| 更传统复杂的一事一课               | `POST /divination/liuren/prompt`         | `question`，可选 `liurenTemplate` 和 `customDate`                                      | 大六壬适合较严肃的事项推演                        |
| 结婚、搬家、开业、签约、出行、安葬 | `POST /divination/almanac/prompt`        | `topic`、`startDate`、`endDate`、可选 `participants`、`page`、`pageSize`               | 只在候选日期范围内择优，不应让 AI 推荐范围外日期  |
| 星盘本命、行运、流年流月           | `POST /divination/astrolabe/prompt`      | 出生时间地点，经纬度，`astrolabeTopic`，`astrolabeScope: "full"` 或指定范围            | 需要经纬度和时区，资料不足时应先补齐              |
| 西占双方关系、合作或婚恋互动       | `POST /divination/astrolabe/synastry/prompt` | `person1`、`person2` 分别提供完整出生时间、经纬度和时区                             | 返回跨盘相位、容许度、落宫和解释边界，不给虚假匹配分 |
| 牌面灵感、关系牌阵、选择牌阵       | `POST /divination/tarot/prompt` 或雷诺曼 | `spreadType`、`question`                                                               | 适合轻量启发，不作为长期命盘判断                  |
| 求签                               | `POST /divination/ssgw/prompt`           | `question`                                                                             | 有三连阴杯等拒签情况时，应如实返回，不强行解释    |
| 住宅命卦、坐山吉凶                 | `POST /metaphysics/bazhai/prompt`        | `birthYear`、`gender`、可选 `sitMountain`                                              | 适合八宅命宅配合与方位参考                        |
| 生肖犯太岁、流年贵人               | `POST /metaphysics/zodiac/prompt`        | `zodiac`、`year` 或 `yearGanZhi`                                                       | 生肖可传“鼠”或“子”                                |
| 太乙神数                           | `POST /metaphysics/taiyi/prompt`         | `scope` 可选年、月、日、时、分；年计传 `year`，其余计式传完整年月日时分                | 五计各用独立积数，时计与分计按规则定阴阳遁        |
| 七政四余                           | `POST /metaphysics/qizheng/prompt`       | 出生年月日时分、经纬度、时区                                                           | 紫炁采用《七政算内篇》单一古法均速模型            |

参数选择建议：

- `responseMode` 默认用 `summary`；只转交提示词给 AI 时用 `prompt-only`；确实需要完整结构化排盘时再用 `full`。
- 八字紫微合参、八字、紫微、星盘要做完整长期分析时，优先选择完整输出版：八字用 `baziFortuneScope: "full"`，紫微和合参用 `promptScope: "full"`，星盘用 `astrolabeScope: "full"`。
- 只问某一年、某月、某日时，优先选择对应范围，避免把短期问题做成泛泛终身解读。
- `promptMode` 默认用 `framework`，这样返回的提示词结构更完整；只有用户明确要自由问答或自己已经写好完整问题时，才用 `custom`。
- 出生时辰未知时，不要自行补时辰；八字只能保守使用已知信息，紫微和八字紫微合参应等用户补足时辰后再调用。

## 请求示例

`/calculate` 和 `/divination/{method}` 接口只返回排盘、卦盘、牌阵或灵签数据。需要可直接发送给 AI 的提示词时，使用对应的 `/prompt` 一站式接口。

为降低大排盘、长提示词和代理转发失败风险，`/prompt` 默认只返回 `data.prompt` 加轻量摘要：八字、紫微使用 `data.resultSummary`，占卜类使用 `data.summary`。如确实需要同一次响应带完整排盘，传 `responseMode: "full"`；只要提示词时传 `responseMode: "prompt-only"`。大体量数据建议拆成多次请求，或先调用排盘接口用 `detailMode: "compact"` 按需取轻量字段。

真太阳时换算：

```bash
curl -X POST https://aov.cc/api/v1/calendar/true-solar-time \
  -H "Content-Type: application/json" \
  -d '{"localDateTime":"1988-07-15T12:00:00","longitude":116.4074,"timezone":8,"applyChinaDst":true}'
```

`localDateTime` 是当地钟表时间，不要附带 `Z` 或 `+08:00`。`timezone` 默认是 `8`；中国 1986–1991 年历史出生记录可传 `applyChinaDst: true` 自动还原夏令时，其他地区仍应按当地历史规则先还原为标准时间。

六十甲子基础资料：

```bash
curl -X POST https://aov.cc/api/v1/foundation/ganzhi \
  -H "Content-Type: application/json" \
  -d '{"ganZhi":"甲子"}'
```

五行分布：

```bash
curl -X POST https://aov.cc/api/v1/foundation/wuxing \
  -H "Content-Type: application/json" \
  -d '{"items":["甲","子","丙","午"],"weightHidden":true}'
```

八字排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/bazi/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","question":"我适合创业还是上班？","promptTopic":"career"}'
```

八字双盘接口使用 `person1`、`person2` 包裹两份八字出生资料。结果会逐项返回双方日主五行与十神、日支关系、四柱交叉合冲刑害破、跨盘三合三会候选、双向十神映射和喜忌五行覆盖。五合、三合、三会只记录候选关系，不直接判定成化，也不生成匹配总分。

八字神煞争议口径默认使用主流算法；如需兼容其他系统，可通过 `shenShaVariants` 指定：

```bash
curl -X POST https://aov.cc/api/v1/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","shenShaVariants":{"kongWangBasis":"day-and-year","yangRenMode":"include-yin-ren","tongZiScope":"all-pillars"}}'
```

八字提示词可指定命限范围。`baziFortuneScope` 支持 `natal`（本命）、`full`（完整输出版）、`dayun`（大运）、`year`（流年）、`month`（流月）、`day`（流日）；配套参数为 `baziFortuneCycleIndex`、`baziFortuneYear`、`baziFortuneMonth`、`baziFortuneDay`。`full` 会写入完整大运与逐年流年，不需要再传具体年限参数。

```bash
curl -X POST https://aov.cc/api/v1/bazi/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","question":"整体事业阶段怎么判断？","promptTopic":"career","baziFortuneScope":"full"}'
```

紫微斗数排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4,"question":"我的感情关系要注意什么？","promptTopic":"relationship","promptScope":"origin"}'
```

紫微 `promptScope` 可传 `full` 生成完整输出版，会写入本命、大限、流年、流月、流日、流时资料：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4,"question":"整体人生和近期重点怎么看？","promptTopic":"life","promptScope":"full"}'
```

八字紫微合参提示词适合“八字定主线、紫微校验宫位和运限”的深度问题，`promptScope` 同样支持 `full`：

```bash
curl -X POST https://aov.cc/api/v1/bazi-ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":1992,"month":8,"day":21,"timeIndex":4,"question":"我现在适合换工作还是继续等待？","baziPromptTopic":"job-change","ziweiPromptTopic":"job-change","promptScope":"yearly"}'
```

星盘提示词可用 `astrolabeScope` 指定范围，`full` 会写入本命、当前流年、当前流月、当前流日行运资料：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"本人","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8,"locationName":"北京","question":"整体人生和近期重点怎么看？","astrolabeTopic":"life","astrolabeScope":"full"}'
```

西占双盘接口要求 `person1`、`person2` 分别提供一份完整星盘出生资料，提示词会写入双方本命盘、跨盘相位的实际夹角与容许度、双方落宫和证据边界：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe/synastry/prompt \
  -H "Content-Type: application/json" \
  -d '{"person1":{"name":"甲","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8},"person2":{"name":"乙","gender":"男","year":1992,"month":8,"day":21,"hour":8,"minute":15,"latitude":31.2304,"longitude":121.4737,"timezone":8},"question":"我们长期合作时最需要注意什么？","responseMode":"prompt-only"}'
```

新增术数系统使用统一的 `/metaphysics/{method}/calculate` 与 `/prompt` 路径。例如八宅与七政四余：

```bash
curl -X POST https://aov.cc/api/v1/metaphysics/bazhai/prompt \
  -H "Content-Type: application/json" \
  -d '{"birthYear":1990,"gender":"male","sitMountain":"子","question":"住宅办公方位怎么安排？"}'

curl -X POST https://aov.cc/api/v1/metaphysics/qizheng/prompt \
  -H "Content-Type: application/json" \
  -d '{"year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8,"question":"请重点看事业与迁移。"}'
```

塔罗抽牌并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/divination/tarot/prompt \
  -H "Content-Type: application/json" \
  -d '{"spreadType":"single","question":"我近期事业应该注意什么？"}'
```

按自定时间生成奇门提示词：

```bash
curl -X POST https://aov.cc/api/v1/divination/qimen/prompt \
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

奇门排盘结果会包含 `seasonality` 和 `patternCombos`：前者给出节气三元、节气五行、月相、建除十二神和四柱干支互动，后者给出吉凶叠加、吉格逢空、伏吟反吟叠马星等复合格局。提示词接口会把这些字段写入证据区，方便 AI 解读时引用。直接排盘接口可传 `detailMode: "compact"` 获取轻量结构；轻量结构只保留核心盘面、方位和少量高权重组合，并返回完整数量，适合上游 AI 代理按需拆成多次请求。

需要完整排盘和提示词同时返回：

```bash
curl -X POST https://aov.cc/api/v1/divination/qimen/prompt \
  -H "Content-Type: application/json" \
  -d '{"customDate":"2025-01-01T08:30:00+08:00","question":"这个项目现在适合推进吗？","responseMode":"full"}'
```

黄历安葬择日：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac \
  -H "Content-Type: application/json" \
  -d '{"topic":"burial","startDate":"2026-07-01","endDate":"2026-07-15"}'
```

黄历择日分页轻量返回：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac \
  -H "Content-Type: application/json" \
  -d '{"topic":"contract","startDate":"2026-06-01","endDate":"2026-06-30","page":1,"pageSize":5,"detailMode":"compact"}'
```

黄历提示词也支持分页；大范围或多参与人时建议按页生成提示词，多次请求合并判断：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac/prompt \
  -H "Content-Type: application/json" \
  -d '{"topic":"contract","startDate":"2026-06-01","endDate":"2026-06-30","page":1,"pageSize":5}'
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

- `gender` 使用 `male` 或 `female`。
- `dateType` 使用 `solar` 或 `lunar`。
- `timeIndex` 范围为 `0` 到 `12`，其中 `0` 为早子时，`12` 为晚子时。
- `question` 是所有 `/prompt` 接口的必填字段，黄历择日 `/prompt` 可不填；`question` 和 `astrolabeScopeText` 最多 5000 个字符。
- `/prompt` 支持 `responseMode`：`summary` 默认只返回提示词和轻量摘要；`full` 返回完整排盘和提示词；`prompt-only` 只返回提示词。
- 八字、紫微、奇门和黄历择日排盘接口支持 `detailMode`：`full` 返回完整结构；`compact` 返回轻量结构，适合自动化或多次分页请求。
- 八字 `promptTopic` 支持 `general`、`career`、`wealth`、`marriage`、`children`、`health`、`relationship-push`、`relationship-decision`、`job-change`、`startup-partnership`、`investment-partnership`、`recent`、`home-move`、`settle-relocate`、`study-advance`、`exam-landing`、`reconciliation-decision`、`emotion`、`talent`、`growth`、`social`。
- 八字 `/bazi/prompt` 可传 `baziFortuneScope` 指定命限范围，支持 `natal`、`full`、`dayun`、`year`、`month`、`day`；选择 `dayun`、`year`、`month`、`day` 时可配合 `baziFortuneCycleIndex`、`baziFortuneYear`、`baziFortuneMonth`、`baziFortuneDay`。
- 紫微 `promptTopic` 支持 `destiny`、`relationship`、`relationship-push`、`relationship-decision`、`children`、`career-wealth`、`job-change`、`startup-partnership`、`investment-partnership`、`recent`、`family`、`home-move`、`settle-relocate`、`social`、`emotion`、`health`、`study`、`study-advance`、`exam-landing`、`reconciliation-decision`、`growth`、`talent`、`life`、`chat`。
- 紫微 `promptScope` 支持 `origin`、`full`、`decadal`、`yearly`、`monthly`、`daily`、`hourly`、`age`；`full` 会返回并写入本命、大限、流年、流月、流日、流时资料。
- 紫微公开 API 默认只返回 `origin`（本命）范围；如果请求传入 `promptScope`，接口会返回 `origin` 加指定范围，包含分析对象、落宫与四化信息，供流年、流月、流日等分析使用。
- 紫微排盘结果以 `payloadByScope.origin.palaces` 为主结构；同时提供 `四化`、`fourMutagens`、`birthMutagens` 和 `gongList`，方便 agent 直接读取生年四化和十二宫星曜。
- 八字紫微合参接口为 `POST /bazi-ziwei/prompt`，使用同一份出生信息，同时计算八字和紫微，默认返回 `data.resultSummary.bazi`、`data.resultSummary.ziwei` 和 `data.prompt`；传 `responseMode: "full"` 可返回完整双盘。该接口使用 `baziPromptTopic`、`ziweiPromptTopic`、`promptScope` 区分两套体系的分析范围。
- `promptMode` 支持 `framework`（完整任务书，默认）和 `custom`（只围绕用户问题自由作答）。
- 八字 `school` 支持 `traditional`（传统派子平正法）、`mangpai`（盲派十神象法）、`xinpai`（新派调候流通）。不传则不附加流派指引。
- 八字 `shenShaVariants` 用于请求神煞争议口径；不传时使用默认主流口径：空亡只按日柱旬空、羊刃只取阳干帝旺、童子煞只查日柱和时柱。可选值：`kongWangBasis` 为 `day` 或 `day-and-year`；`yangRenMode` 为 `yang-stems-only` 或 `include-yin-ren`；`tongZiScope` 为 `day-hour` 或 `all-pillars`。
- 紫微 `school` 支持 `sanhe`（三合派三方四正）、`feixing`（飞星派四化飞星链路）、`sihua`（四化派生年四化主线）。不传则不附加流派指引。
- `customDate` 用于指定时间类占卜的起卦或排盘时间，支持六爻、梅花易数、小六壬、奇门遁甲、大六壬；不传时使用服务器当前时间。该字段必须使用带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:00:00+08:00` 或 `2025-01-01T00:00:00Z`。
- Python `urllib` 默认 `User-Agent` 可能被 Cloudflare 拦截；Python 调用时请显式设置正常 `User-Agent`，例如 `curl/8.0.0` 或业务自己的客户端名称。
- 梅花易数 `method` 支持 `time`、`number`、`random`、`timeTrigram`。数字起卦使用 `number`；`timeTrigram` 为历史兼容入口，按《梅花易数》年月日时起卦法计算，不再使用时辰地支方位自定义映射。
- 小六壬 `xiaoliurenMethod` 支持 `time`、`number`、`random`，数字起课时使用 `xiaoliurenNumber`。
- 塔罗 `spreadType` 支持 `single`、`three`、`love`、`career`、`decision`、`celtic`、`chakra`、`year`、`mindBodySpirit`、`horseshoe`。
- 六爻 `liuyaoTemplate` 支持 `general`、`ganqing`、`shiye`、`caifu`、`guaishen`。
- 大六壬 `liurenTemplate` 支持 `general`、`ganqing`、`shiye`、`caifu`。
- 奇门遁甲 `qimenMethod` 支持 `zhuanpan`（转盘法，默认）、`feipan`（飞盘法）。排盘结果包含 `seasonality`（节令背景）和 `patternCombos`（复合格局）。
- 黄历择日 `topic` 支持 `marriage`、`move`、`opening`、`contract`、`travel`、`medical`、`study`、`burial`、`renovation`、`custom`，不传时使用 `custom`，并使用 `startDate`、`endDate` 和可选 `participants`。日期范围一次最多 31 天，`participants` 一次最多 30 位；更大范围或更多参与人请拆成多次请求。
- 黄历择日支持 `page` 和 `pageSize` 分页，`pageSize` 最大 31。不传分页时保持旧行为返回全部日期；传分页后只返回当前页日期，并带 `pagination`。`page` 超过总页数会返回 400，请调用方按 `pagination.totalPages` 继续请求。
- 雷诺曼 `spreadType` 支持 `single`、`three`、`five`、`relationship`、`decision`、`nine`、`element`、`grandTableau`，不传时使用 `single`。
- 星盘需要 `year`、`month`、`day`、`hour`、`minute`、`latitude`、`longitude`、`timezone`，可传 `useTrueSolarTime` 启用真太阳时校正。提示词接口可使用 `astrolabeTopic`、`astrolabeScope`、`astrolabeScopeDate` 和 `astrolabeScopeText`；`astrolabeScope` 支持 `natal`、`full`、`yearly`、`monthly`、`daily`，其中 `full` 会写入本命、当前流年、当前流月、当前流日行运资料；传入 `astrolabeScopeText` 时以自定义文本为准。
- 西占双盘使用 `person1`、`person2` 包裹双方星盘参数。排盘结果包含主要跨盘相位、实际夹角、容许度、相对强度和跨盘落宫；这些字段是盘面证据，不等于关系结果或匹配总分。
- `/ai/analyze` 请求体支持 `{ "prompt": "..." }` 单轮解析，或 `{ "messages": [{ "role": "user", "content": "..." }] }` 多轮追问；可选 `aiConfig` 指定 `builtin` 或 `custom` 模式。成功时返回 `text/event-stream`，每条增量以 `data: {"content":"..."}` 形式输出。当前接口会拒绝过大的请求体，单次解析消息总内容最多 50000 字符，多轮消息最多 30 条；超限会直接返回 400，调用方应拆分请求。
- `/ai/models` 请求体支持 `{ "aiConfig": { "mode": "builtin" } }` 或自定义 OpenAI 兼容配置，返回 `{ "ok": true, "models": ["模型 ID"] }`。

更完整的字段结构以 [OpenAPI](https://aov.cc/api/v1/openapi.json) 为准。
