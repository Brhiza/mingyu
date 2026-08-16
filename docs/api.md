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

| 接口                                          | 说明                                                           |
| --------------------------------------------- | -------------------------------------------------------------- |
| `GET /health`                                 | 健康检查                                                       |
| `GET /manifest`                               | 获取 API 元数据                                                |
| `GET /openapi.json`                           | 获取 OpenAPI 文档                                              |
| `POST /bazi/calculate`                        | 八字排盘                                                       |
| `POST /bazi/prompt`                           | 八字排盘并生成 AI 解读提示词                                   |
| `POST /bazi/compatibility`                    | 八字双盘交叉关系、十神、喜忌覆盖与证据计算                     |
| `POST /bazi/compatibility/prompt`             | 八字双盘计算并生成结构化证据提示词                             |
| `POST /ziwei/calculate`                       | 紫微斗数排盘                                                   |
| `POST /ziwei/prompt`                          | 紫微斗数排盘并生成 AI 解读提示词                               |
| `POST /ziwei/compatibility`                   | 紫微双盘宫位叠盘、生年四化跨盘落宫与证据计算                   |
| `POST /ziwei/compatibility/prompt`            | 紫微双盘计算并生成结构化证据提示词                             |
| `POST /bazi-ziwei/prompt`                     | 八字紫微合参并生成 AI 解读提示词                               |
| `POST /divination/liuyao`                     | 六爻起卦                                                       |
| `POST /divination/liuyao/prompt`              | 六爻起卦并生成 AI 解读提示词                                   |
| `POST /divination/meihua`                     | 梅花易数起卦                                                   |
| `POST /divination/meihua/prompt`              | 梅花易数起卦并生成 AI 解读提示词                               |
| `POST /divination/qimen`                      | 奇门遁甲排盘                                                   |
| `POST /divination/qimen/prompt`               | 奇门遁甲排盘并生成 AI 解读提示词                               |
| `POST /divination/liuren`                     | 大六壬排盘                                                     |
| `POST /divination/liuren/prompt`              | 大六壬排盘并生成 AI 解读提示词                                 |
| `POST /divination/tarot`                      | 塔罗抽牌，返回牌位、正逆位、牌序与结构化证据                   |
| `POST /divination/tarot/prompt`               | 塔罗抽牌并生成含解释边界的 AI 解读提示词                       |
| `POST /divination/ssgw`                       | 三山国王灵签求签：随机取一签并返回签号、签题与签诗原文         |
| `POST /divination/ssgw/prompt`                | 三山国王灵签求签并生成 AI 解读提示词                           |
| `POST /divination/almanac`                    | 黄历择日                                                       |
| `POST /divination/almanac/prompt`             | 黄历择日并生成 AI 解读提示词                                   |
| `POST /divination/lenormand`                  | 雷诺曼抽牌，分层返回固定组合、相邻合读与布局证据               |
| `POST /divination/lenormand/prompt`           | 雷诺曼抽牌并生成含证据缺口和解释边界的 AI 解读提示词           |
| `POST /divination/astrolabe`                  | 星盘生成                                                       |
| `POST /divination/astrolabe/prompt`           | 星盘生成并生成 AI 解读提示词                                   |
| `POST /divination/astrolabe/synastry`         | 西占双盘相位、落宫与证据计算                                   |
| `POST /divination/astrolabe/synastry/prompt`  | 西占双盘计算并生成证据提示词                                   |
| `POST /metaphysics/bazhai/calculate`          | 八宅命卦、宅卦、测量候选及命宅逐方结构化证据                   |
| `POST /metaphysics/bazhai/prompt`             | 八宅排盘并生成含测量和现实边界的 AI 解读提示词                 |
| `POST /metaphysics/residential/calculate`     | 住宅风水：八宅与玄空飞星分层合参结果                           |
| `POST /metaphysics/residential/prompt`        | 住宅风水合参并生成 AI 解读提示词                               |
| `POST /metaphysics/zodiac/calculate`          | 生肖与流年值冲刑害破、三合六合及结构化关系证据                 |
| `POST /metaphysics/zodiac/prompt`             | 生肖流年关系排盘并生成含信息量限制的 AI 解读提示词             |
| `POST /metaphysics/taiyi/calculate`           | 太乙神数排盘                                                   |
| `POST /metaphysics/taiyi/prompt`              | 太乙神数排盘并生成 AI 解读提示词                               |
| `POST /metaphysics/wuyun-liuqi/calculate`     | 五运六气五步主客运、符会及六步主客气                           |
| `POST /metaphysics/wuyun-liuqi/prompt`        | 五运六气计算并生成自包含 AI 解读提示词                         |
| `POST /metaphysics/huangji-jingshi/calculate` | 皇极经世元会运世、统卦、运卦、十年卦和值年卦完整排盘           |
| `POST /metaphysics/huangji-jingshi/prompt`    | 皇极经世完整排盘并生成自包含 AI 解读提示词                     |
| `POST /metaphysics/qizheng/calculate`         | 七政四余十一星、真实距星宿界、命身十二宫、庙旺吊照与结构化证据 |
| `POST /metaphysics/qizheng/prompt`            | 七政四余排盘并生成含分层天文证据的 AI 解读提示词               |
| `POST /ai/analyze`                            | AI 解读，返回 SSE 流式响应                                     |
| `POST /ai/models`                             | 获取当前 AI 配置可用的模型列表                                 |

## Agent 调用选择指南

面向自动化代理时，优先使用 `/prompt` 一站式接口，让接口直接返回可交给 AI 解读的 `data.prompt`，不要先取完整排盘再自行拼装提示词。只有需要做表格展示、二次计算或缓存结构化数据时，才调用 `/calculate` 或 `/divination/{method}`。

默认优先级：

1. 用户提供了完整出生信息，并询问人生、事业、财运、婚恋、亲子、健康、迁居、学习、考试、合作、近期趋势或某一年某阶段走势时，优先用 `POST /bazi-ziwei/prompt`。八字负责定命局主线、喜忌和岁运，紫微负责校验宫位、四化、三方四正和运限，通常比单独八字或单独紫微更稳。
2. 用户只提供出生年月日时，但问题只要求单一体系，或明确要求“只看八字”“只看紫微”时，再分别用 `POST /bazi/prompt` 或 `POST /ziwei/prompt`。
3. 用户问“这件事现在能不能做、要不要推进、对方态度、短期成败、近期应期”这类即时问题，优先用时间类占卜提示词：六爻、奇门、梅花、大六壬。
4. 用户要从一段日期里挑日子，优先用 `POST /divination/almanac/prompt`；日期超过 31 天或参与人很多时分页调用。
5. 用户提供一人的西方占星出生资料时，用 `POST /divination/astrolabe/prompt`；提供双方完整出生资料并询问关系时，用 `POST /divination/astrolabe/synastry/prompt`。
6. 用户只想要轻量灵感、心理牌面或不提供出生信息时，可用塔罗、灵签等提示词接口。
7. 用户问住宅、搬家、坐向、命宅或风水时，优先用 `POST /metaphysics/residential/prompt`（产品统一入口）；明确只要八宅或只要玄空时再用对应底层接口；太乙、五运六气、皇极经世和七政四余仍用各自 `/metaphysics/{method}/prompt`。皇极经世普通占断只需提供公元年，研究其他纪元时再额外提供 `epochYear`。

常见问题到推荐接口：

| 用户问题类型                       | 首选接口                                     | 推荐参数                                                                                                                                                    | 说明                                                               |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 换算真太阳时                       | `POST /calendar/true-solar-time`             | `localDateTime`、`longitude`，可选 `timezone`、`timeZoneId`、`applyChinaDst`                                                                                | 支持固定偏移或 IANA 历史时区，返回修正明细、跨日状态和对应时辰     |
| 计算太阳光照证据                   | `POST /calendar/solar-illumination`          | `year`、`month`、`day`、`latitude`、`longitude`，并提供 `timezone` 或 `timeZoneId`；可选参考时分秒                                                          | 返回太阳高度、方位、视太阳正午、日出日落与三类曙暮光               |
| 查六十甲子、纳音、藏干和合冲       | `POST /foundation/ganzhi`                    | `ganZhi`，如“甲子”                                                                                                                                          | 返回统一公共地基资料，不需重复实现                                 |
| 统计天干地支五行分布               | `POST /foundation/wuxing`                    | `items`、可选 `weightHidden`                                                                                                                                | 默认计入地支藏干权重                                               |
| 核验通用神煞命中                   | `POST /foundation/shensha`                   | 完整年、月、日、时四柱干支；可选 `ids`                                                                                                                      | 返回空亡、驿马、桃花的固定起法、目标地支、命中柱位、来源与限制     |
| 整体人生、长期事业、财运、婚恋     | `POST /bazi-ziwei/prompt`                    | `baziPromptTopic`、`ziweiPromptTopic` 按主题填写，`promptScope: "full"` 或 `"origin"`                                                                       | 有完整出生信息时优先合参；想看完整阶段时用 `full`                  |
| 今年、某一年、当前阶段运势         | `POST /bazi-ziwei/prompt`                    | `promptScope: "yearly"`，主题填事业、财运、感情等                                                                                                           | 八字看岁运触发，紫微看流年落宫与四化                               |
| 换工作、创业、合伙、投资合作       | `POST /bazi-ziwei/prompt`                    | `job-change`、`startup-partnership`、`investment-partnership`，按问题选择主题                                                                               | 这类问题兼具长期结构和当前触发，优先合参                           |
| 只看八字格局、用神、流年流月       | `POST /bazi/prompt`                          | `promptTopic`，`baziFortuneScope: "full"`、`"year"`、`"month"` 或 `"day"`                                                                                   | 明确要求八字时使用                                                 |
| 只看紫微宫位、四化、某年某月运限   | `POST /ziwei/prompt`                         | `promptTopic`，`promptScope: "full"`、`"yearly"`、`"monthly"`、`"daily"` 或 `"hourly"`                                                                      | 明确要求紫微时使用                                                 |
| 当前事项能否推进、短期成败         | `POST /divination/liuyao/prompt`             | `question`，必要时传 `customDate`                                                                                                                           | 六爻适合一事一问、取用和应期                                       |
| 项目推进、方向选择、谈判出行、方位 | `POST /divination/qimen/prompt`              | `question`，可选 `qimenMethod: "zhuanpan"` 或 `"feipan"`，必要时传 `customDate`                                                                             | 奇门适合时空局势、路径、方位和行动窗口                             |
| 临时小事、快速判断                 | `POST /divination/xiaoliuren/prompt`         | `question`，可选 `xiaoliurenMethod`、`xiaoliurenSchool` 和 `xiaoliurenNumber`                                                                               | 返回三宫推进、五行、旺衰、触发条件与反证限制；不用于长期命运       |
| 以数字或时间起卦的象意判断         | `POST /divination/meihua/prompt`             | `question`，可选 `method`、`number` 或 `customDate`                                                                                                         | 梅花适合象意、触发点和过程结果                                     |
| 更传统复杂的一事一课               | `POST /divination/liuren/prompt`             | `question`，可选 `liurenTemplate` 和 `customDate`                                                                                                           | 大六壬适合较严肃的事项推演                                         |
| 结婚、搬家、开业、签约、出行、安葬 | `POST /divination/almanac/prompt`            | `topic`、`startDate`、`endDate`、可选 `participants`、`page`、`pageSize`                                                                                    | 只在候选日期范围内择优，不应让 AI 推荐范围外日期                   |
| 星盘本命、行运、流年流月           | `POST /divination/astrolabe/prompt`          | 出生时间地点、经纬度、时区、`astrolabeTopic`、`astrolabeScope`；行运范围同时传 `astrolabeScopeDate`                                                         | 需要明确行运日期；不会自动套用服务器当前日期                       |
| 西占双方关系、合作或婚恋互动       | `POST /divination/astrolabe/synastry/prompt` | `person1`、`person2` 分别提供完整出生时间、经纬度和时区                                                                                                     | 返回跨盘相位、容许度、落宫和解释边界，不给虚假匹配分               |
| 牌面灵感、关系牌阵、选择牌阵       | `POST /divination/tarot/prompt`              | `spreadType`、`question`                                                                                                                                    | 适合轻量启发，不作为长期命盘判断                                   |
| 雷诺曼关系或选择牌阵               | `POST /divination/lenormand/prompt`          | `spreadType`、`question`                                                                                                                                    | 适合轻量启发，不作为长期命盘判断                                   |
| 求签                               | `POST /divination/ssgw/prompt`               | `question`                                                                                                                                                  | 有拒签情况时如实返回，不强行解释                                   |
| 住宅风水（八宅+玄空）              | `POST /metaphysics/residential/prompt`       | 山向或居住人至少一项：`birthYear`+`gender`/`mingGua`，`sitMountain`/`facingDegree`/`doorToInteriorDegree`，可选 `year` 建造/起运年                          | 统一入口；可只做人宅、只做宅运或两者合参；不给综合吉凶总分         |
| 仅八宅命卦、坐山吉凶               | `POST /metaphysics/bazhai/prompt`            | `birthYear`、`gender`、可选 `sitMountain`；实测可传 `doorToInteriorDegree`、`northReference`、`magneticDeclinationDegrees`、`measurementUncertaintyDegrees` | 返回磁北/真北换算、候选坐向与边界稳定性                            |
| 生肖犯太岁、流年贵人               | `POST /metaphysics/zodiac/prompt`            | `zodiac`、`year` 或 `yearGanZhi`                                                                                                                            | 生肖可传“鼠”或“子”                                                 |
| 太乙神数                           | `POST /metaphysics/taiyi/prompt`             | 当前只接受 `scope: "year"` 与 `year`                                                                                                                        | 年计按积年与阳遁七十二局立成；结果含 `evidenceAnalysis` 结构化证据 |
| 五运六气年度结构                   | `POST /metaphysics/wuyun-liuqi/prompt`       | `year` 或 `yearGanZhi`；同时提供时会校验一致性，可选 `question`                                                                                             | 返回五步主客运、五类符会与六步主客气；不替代实际气象或医疗资料     |
| 皇极经世年度占断                   | `POST /metaphysics/huangji-jingshi/prompt`   | 普通模式只传公元 `year`；自定义纪元传 `epochYear`，再从 `year` 与 `elapsedYears` 中选一个                                                                   | 返回元会运世、统卦、运卦、六十年统卦、十年卦、值年卦及互错综卦     |
| 七政四余                           | `POST /metaphysics/qizheng/prompt`           | 精准出生年月日时、经纬度，并提供 `timezone` 或 `timeZoneId`；可选 `useTrueSolarTime`                                                                        | 返回十一星、真实距星宿界、命身十二宫、庙旺吊照和分层天文证据       |
| 玄空飞星                           | `POST /metaphysics/xuankong/prompt`          | `year`、`sitMountain`/`facingMountain` 或度数；可选测量误差                                                                                                 | 返回下卦的三元九运、三盘飞星、局型、到山到向与结构化证据           |

参数选择建议：

- `responseMode` 默认用 `summary`；只转交提示词给 AI 时用 `prompt-only`；确实需要完整结构化排盘时再用 `full`。
- 八字紫微合参、八字、紫微、星盘要做完整长期分析时，优先选择完整输出版：八字用 `baziFortuneScope: "full"`，紫微和合参用 `promptScope: "full"`，星盘用 `astrolabeScope: "full"` 并以 `astrolabeScopeDate: "YYYY-MM-DD"` 明确行运基准日。
- 只问某一年、某月、某日时，优先选择对应范围，避免把短期问题做成泛泛终身解读。
- `promptMode` 默认用 `framework`，这样返回的提示词结构更完整；只有用户明确要自由问答或自己已经写好完整问题时，才用 `custom`。
- 出生时辰未知时，不要自行补时辰；八字只能保守使用已知信息，紫微和八字紫微合参应等用户补足时辰后再调用。

## 请求示例

`/calculate` 和 `/divination/{method}` 接口只返回排盘、卦盘、牌阵或灵签数据。需要可直接发送给 AI 的提示词时，使用对应的 `/prompt` 一站式接口。

为降低大排盘、长提示词和代理转发失败风险，`/prompt` 默认使用 `responseMode: "prompt-only"`，只返回 `data.prompt`。需要结构化展示时显式传 `responseMode: "summary"` 获取轻量摘要；确实需要同一次响应带完整排盘时才传 `responseMode: "full"`。所有命理、占卜和风水计算接口默认使用 `detailMode: "compact"`，保留盘面与解读所需字段，省略提示词、证据链和重复计算过程；审计或研究场景可显式传 `detailMode: "full"`。

真太阳时换算：

```bash
curl -X POST https://aov.cc/api/v1/calendar/true-solar-time \
  -H "Content-Type: application/json" \
  -d '{"localDateTime":"1988-07-15T12:00:00","longitude":116.4074,"timezone":8,"applyChinaDst":true}'
```

`localDateTime` 是当地钟表时间，不要附带 `Z` 或 `+08:00`。未传 `timeZoneId` 时，`timezone` 默认是 `8`；历史日期或实行夏令时的地区可传 IANA 时区（如 `America/New_York`），系统会解析当时的法定偏移。秋季回拨的重复当地时间必须再传与原始记录一致的 `timezone` 消歧，固定偏移与 IANA 规则冲突时会拒绝计算。`timeZoneId` 已包含历史夏令时规则，不能同时启用 `applyChinaDst`；中国 1986–1991 年记录也可只用固定 `timezone: 8` 配合 `applyChinaDst: true` 走兼容口径。

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

通用神煞资料：

```bash
curl -X POST https://aov.cc/api/v1/foundation/shensha \
  -H "Content-Type: application/json" \
  -d '{"yearGanZhi":"甲子","monthGanZhi":"丙寅","dayGanZhi":"戊辰","hourGanZhi":"丁巳"}'
```

该入口要求四柱全部明确且合法；不会生成候选时辰、缺时柱命盘、吉凶总分或事件概率。

八字排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/bazi/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","question":"我适合创业还是上班？","promptTopic":"career"}'
```

八字双盘接口使用 `person1`、`person2` 包裹两份八字出生资料。结果会逐项返回双方日主五行与十神、日支关系、四柱交叉合冲刑害破、跨盘三合三会候选、双向十神映射和喜忌五行覆盖。五合、三合、三会只记录候选关系，不直接判定成化，也不生成匹配总分。

八字神煞默认返回 55 个常用项目，并采用问真整理口径；需要全部已计算神煞时传 `shenShaScope: "all"`。如需兼容 0.1.27 及更早版本的原有查法，可传 `shenShaVariants.referenceProfile: "classical"`；空亡、羊刃、童子等单项争议口径仍可分别指定：

```bash
curl -X POST https://aov.cc/api/v1/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","shenShaScope":"all","shenShaVariants":{"referenceProfile":"classical","kongWangBasis":"day-and-year","yangRenMode":"include-yin-ren","tongZiScope":"all-pillars"}}'
```

八字提示词可指定命限范围。`baziFortuneScope` 支持 `natal`（本命）、`full`（完整输出版）、`dayun`（大运）、`year`（流年）、`month`（流月）、`day`（流日）。`dayun` 必须传 `baziFortuneCycleIndex`；`year`、`month`、`day` 必须依次传入对应层级的 `baziFortuneYear`、`baziFortuneMonth`、`baziFortuneDay`，交运年份可同时传 `baziFortuneCycleIndex` 消除重叠歧义。`full` 会写入完整大运与逐年流年，不需要再传具体年限参数。

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

紫微双盘结构化证据提示词：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/compatibility/prompt \
  -H "Content-Type: application/json" \
  -d '{"person1":{"name":"甲方","gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4},"person2":{"name":"乙方","gender":"male","dateType":"solar","year":"1990","month":"5","day":"15","timeIndex":1},"question":"双方长期合作关系应注意什么？","promptTopic":"career-wealth"}'
```

该接口只使用双方本命盘，输出关键宫位地支叠盘和“来源方生年四化星曜 → 对方同名星曜落宫”的可复核链路；不生成匹配总分，也不把静态双盘写成具体年份应期。

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

星盘提示词可用 `astrolabeScope` 指定范围。`yearly`、`monthly`、`daily` 分别要求 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 格式的 `astrolabeScopeDate`；`full` 要求 `YYYY-MM-DD` 基准日，并写入该日所属流年、流月和流日资料。服务端不会用当前日期补齐缺参：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"本人","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8,"locationName":"北京","question":"整体人生和近期重点怎么看？","astrolabeTopic":"life","astrolabeScope":"full","astrolabeScopeDate":"2028-06-12"}'
```

西占双盘接口要求 `person1`、`person2` 分别提供一份完整星盘出生资料，提示词会写入双方本命盘、跨盘相位的实际夹角与容许度、双方落宫和证据边界：

```bash
curl -X POST https://aov.cc/api/v1/divination/astrolabe/synastry/prompt \
  -H "Content-Type: application/json" \
  -d '{"person1":{"name":"甲","gender":"女","year":1995,"month":5,"day":20,"hour":12,"minute":30,"latitude":39.9042,"longitude":116.4074,"timezone":8},"person2":{"name":"乙","gender":"男","year":1992,"month":8,"day":21,"hour":8,"minute":15,"latitude":31.2304,"longitude":121.4737,"timezone":8},"question":"我们长期合作时最需要注意什么？","responseMode":"prompt-only"}'
```

新增术数系统使用统一的 `/metaphysics/{method}/calculate` 与 `/prompt` 路径。八宅示例：

```bash
curl -X POST https://aov.cc/api/v1/metaphysics/bazhai/prompt \
  -H "Content-Type: application/json" \
  -d '{"birthYear":1990,"gender":"male","sitMountain":"子","question":"住宅办公方位怎么安排？"}'

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

奇门排盘结果会包含 `seasonality` 和 `patternCombos`：前者给出节气三元、节气五行、历法八相、日月黄经月相证据、建除十二神和四柱干支互动，并保留历法八相与天文八分法是否一致；后者给出吉凶叠加、吉格逢空、伏吟反吟叠马星等复合格局。提示词接口会把这些字段写入证据区，方便 AI 解读时引用。直接排盘接口可传 `detailMode: "compact"` 获取轻量结构；轻量结构只保留核心盘面、方位和少量高权重组合，并返回完整数量，适合上游 AI 代理按需拆成多次请求。

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

- 五运六气使用 `year` 或 `yearGanZhi`；同时提供时会校验两者一致。`year` 按该公历年年中所属年柱换算。结果包含固定木火土金水的五步主运、从中运起按相生轮转的五步客运、五音太少、传统交司日期、司天与中运的同气、顺化、天刑、小逆、不和关系，天符、岁会、太乙天符、同天符、同岁会逐项核验，以及从大寒起每四个节气一组的六步主客气。交司日期保留《运气要诀》的“节气后第几日”口径，不包装成精确到时分秒的现代时刻。
- 吴谦《运气要诀》列出的五类符会逐年名单按六十甲子去重为 26 年，与原文“二十八年”汇总不一致；接口保留 `sourceReconciliation` 校勘说明，并以逐项定义和逐年名单为计算依据。
- 皇极经世普通模式只需提供公元 `year`，默认采用公元前 67017 年为本元起点、1984 年鼎卦为甲子值年锚点的通行排法，返回会内统卦、运卦、六十年统卦、十年卦、值年卦及互卦、错卦、综卦。
- 研究自定义纪元时提供 `epochYear`，并从 `year` 与 `elapsedYears` 中选择一项；该模式保留纯元会运世坐标换算，不附通行值年卦。
- `progress` 分别给出当前元、会、运、世内已过年数、当前年之后剩余的完整年数，以及下一元、会、运、世开始年；所有层级序号均从 1 开始。

- `gender` 使用 `male` 或 `female`。
- `dateType` 使用 `solar` 或 `lunar`。
- `timeIndex` 范围为 `0` 到 `12`，其中 `0` 为早子时，`12` 为晚子时。
- `question` 是所有 `/prompt` 接口的必填字段，黄历择日 `/prompt` 可不填；`question` 和 `astrolabeScopeText` 最多 5000 个字符。
- `/prompt` 支持 `responseMode`：`prompt-only` 为默认值，只返回提示词；`summary` 返回提示词和轻量摘要；`full` 返回完整排盘和提示词。
- 所有命理、占卜和风水排盘接口支持 `detailMode`：默认 `compact`，保留核心盘面并省略证据链、提示词与重复计算过程；显式传 `full` 才返回完整结构。基础历法、天文和五行等公共地基接口不受此参数影响。
- 八字 `promptTopic` 支持 `general`、`career`、`wealth`、`marriage`、`children`、`health`、`relationship-push`、`relationship-decision`、`job-change`、`startup-partnership`、`investment-partnership`、`recent`、`home-move`、`settle-relocate`、`study-advance`、`exam-landing`、`reconciliation-decision`、`emotion`、`talent`、`growth`、`social`。
- 八字 `/bazi/prompt` 可传 `baziFortuneScope` 指定命限范围，支持 `natal`、`full`、`dayun`、`year`、`month`、`day`；除 `natal`、`full` 外必须提供所选层级需要的明确年限参数，工具不会自动选择当前时间或第一项。
- 紫微 `promptTopic` 支持 `destiny`、`relationship`、`relationship-push`、`relationship-decision`、`children`、`career-wealth`、`job-change`、`startup-partnership`、`investment-partnership`、`recent`、`family`、`home-move`、`settle-relocate`、`social`、`emotion`、`health`、`study`、`study-advance`、`exam-landing`、`reconciliation-decision`、`growth`、`talent`、`life`、`chat`。
- 紫微 `promptScope` 支持 `origin`、`full`、`decadal`、`yearly`、`monthly`、`daily`、`hourly`、`age`；`full` 会返回并写入本命、大限、流年、流月、流日、流时资料。
- 紫微公开 API 默认只返回 `origin`（本命）范围；如果请求传入 `promptScope`，接口会返回 `origin` 加指定范围。各范围统一读取 `iztro` 原生宫位对象与运限对象，包含落宫、动态宫名、运限星曜、四化、自化、宫干飞化和三方四正，不再另建一份简化盘面。
- 紫微 `algorithm` 支持 `default`（传统通行安星法，默认）和 `zhongzhou`（中州派安星法）。它改变底层安星结果；`school` 仍只改变提示词的解读侧重点，不能替代 `algorithm`。
- 紫微排盘结果以 `payloadByScope.origin.palaces` 为主结构；同时提供 `四化`、`fourMutagens`、`birthMutagens` 和 `gongList`，方便 agent 直接读取生年四化和十二宫星曜。本命 `active_scope.palace_index` / `palace_name` 明确指向 `iztro` 的命宫，不使用宫位数组首项代替。
- 紫微 `patterns` 当前评估 55 条可复算规则，每条附《紫微斗数全书》固定版本、卷次、原文、命中条件与解释边界；另有 32 项因原文含糊或依赖运限只登记为不可唯一复算边界。`pattern_analysis` 汇总 87 项固定目录的登记数、评估数、命中数和未命中边界。原 84 条未校勘项目规则继续停用；空列表只表示当前可复算规则未命中，不表示命盘没有其他传统格局。十二宫、星曜、四化、三方四正和运限不受影响。
- 八字提示词选择 `baziFortuneScope` 后，逐层岁运关系会写入可直接解读的 `data.prompt`，不会再把内部计算步骤和证据对象复制到轻量摘要；需要原始结构化证据时使用八字排盘接口。
- 八字出生时间必须满足接口输入约束后才会进入排盘；接口不接受模糊时间误差范围，也不会基于误差范围继续排盘。
- 八字紫微合参接口为 `POST /bazi-ziwei/prompt`，使用同一份出生信息，同时计算八字和紫微，默认只返回 `data.prompt`；传 `responseMode: "summary"` 可返回轻量双盘摘要，传 `responseMode: "full"` 才返回完整双盘。该接口使用 `baziPromptTopic`、`ziweiPromptTopic`、`promptScope` 区分两套体系的分析范围。
- `promptMode` 支持 `framework`（完整任务书，默认）和 `custom`（只围绕用户问题自由作答）。
- 八字 `school` 支持 `traditional`（传统兼容名，等同子平派）、`ziping`（子平派月令格局、调候行运）、`mangpai`（盲派宫位十神、主宾体用、通根墓库、组合取象与分柱年限）、`xinpai`（新派旺衰判定、十神流通、喜忌落位与动态岁运）。选择盲派或新派后，提示词会写入对应的逐项盘面资料；不传则不附加流派段落。
- 八字 `shenShaScope` 默认 `common`，返回 55 个常用神煞；传 `all` 返回全部已计算神煞。`shenShaVariants` 用于请求争议口径；`referenceProfile` 默认为 `wenzhen`（问真整理口径），传 `classical` 可兼容 0.1.27 及更早版本的原有查法。单项可选值：`kongWangBasis` 为 `day` 或 `day-and-year`；`yangRenMode` 为 `yang-stems-only` 或 `include-yin-ren`；`tongZiScope` 为 `day-hour` 或 `all-pillars`。
- 紫微 `school` 支持 `sanhe`（三合派三方四正）、`feixing`（飞星派四化飞星链路）、`sihua`（四化派生年四化主线）。它只改变提示词的解读侧重点，不改变底层安星算法；本次实际采用的 `iztro` 算法、闰月、分年、运限月份、小限年龄和晚子时口径以 `calculationConfig` / `payloadByScope.*.calculation_config` 为准。
- 只对规划内确有合理差异的提示词接口提供 `schools` 数组，一次选择一至三个流派、断法或解读侧重；两个或三个值会生成“分别判断—共识—分歧与盘面依据—综合判断”的合参任务。同属流派时称“多派合参”，同属断法时称“多法合参”，混合类型时称“多口径合参”。八字、紫微、住宅风水属于真实流派选择；塔罗、黄历择日、星盘和七政四余同时包含流派与断法；其余登记项属于不同断法，不称作不同派系。八字、紫微的 `school` 为单派兼容参数，同时传入时以 `schools` 为准；八字紫微合参分别使用 `baziSchools`、`ziweiSchools`。
- 各术数允许值：八字 `ziping/mangpai/xinpai`；紫微 `sanhe/feixing/sihua`；六爻 `huozhulin/bushizhengzong/zengshanbuyi`；梅花 `tiyong/xiangshu/yaoci`；小六壬 `shunshu/gongjue`；金口诀 `siwei/fayong/wudong`；奇门 `gongwei/geju/zhuke`；大六壬 `keti/bifafu/leishen`；塔罗 `rws/yuansu/narrative`；雷诺曼 `combination/eventline/significator`；黄历择日 `xieji/jianchu/comprehensive`；星盘及西占双盘 `modern/traditional/timing`；太乙 `zhuke/gongwei`；八宅 `dayounian/mingzhai`；住宅风水 `bazhai/xuankong`；玄空 `sanYuan/shanxiang`；七政四余 `guolao/wuxingjingyi`；生肖 `ganzhi/sanhe`；五运六气 `yunqi/sitian/kezhu`；皇极经世 `yuanhui/guaqi`。
- 奇门的转盘/飞盘、拆补/置闰以及时家/日家等参数改变实际盘面，不属于 `schools`；紫微 `algorithm` 也属于排盘口径。三山国王灵签提示词只列本次签谱资料，不附加派系段落，也不接受 `schools`。
- `customDate` 用于指定时间类占卜的起卦或排盘时间，支持六爻、梅花易数、奇门遁甲、大六壬；不传时使用服务器当前时间。该字段必须使用带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:00:00+08:00` 或 `2025-01-01T00:00:00Z`。
- Python `urllib` 默认 `User-Agent` 可能被 Cloudflare 拦截；Python 调用时请显式设置正常 `User-Agent`，例如 `curl/8.0.0` 或业务自己的客户端名称。
- 梅花易数 `method` 支持 `time`、`number`、`random`、`timeTrigram`。数字起卦使用 `number`；`timeTrigram` 为历史兼容入口，按《梅花易数》年月日时起卦法计算，不再使用时辰地支方位自定义映射。
- 梅花排盘结果的 `evidenceAnalysis` 返回主卦起因、互卦过程、变卦结果三阶段体用关系、月建旺衰、推进变化、支持项、限制项和触发条件。动爻与卦数只保留为层位和取数旁证，不机械换算绝对日期，也不输出吉凶总分或成功率。
- 塔罗 `spreadType` 支持 `single`、`three`、`love`、`career`、`decision`、`celtic`、`chakra`、`year`、`mindBodySpirit`、`horseshoe`。
- 六爻 `liuyaoTemplate` 支持 `general`、`ganqing`、`shiye`、`caifu`、`guaishen`。
- 六爻排盘结果的 `evidenceAnalysis` 返回用神候选、本卦与伏神爻位、原神忌神仇神作用链、月日和动变支持、空破墓退反证及触发条件。提示词会按 `liuyaoTemplate` 重新选择对应主题候选；候选不等于已定用神，也不输出吉凶总分或成功率。
- 大六壬 `liurenTemplate` 支持 `general`、`ganqing`、`shiye`、`caifu`。
- 大六壬排盘结果的 `evidenceAnalysis` 返回四课上下关系、九宗门取传规则、初传来源、初中末三传推进、天将、月令旺衰、旬空、日支关系、反证与触发条件。未按问题选择类神时会明确保留限制，不把日支或神煞固定当作用神，也不输出数字权重、吉凶总分或成功率。
- 奇门排盘结果的 `evidenceAnalysis` 返回值符、值使、日干、时干对应的用神宫候选，以及逐宫门、星、神、天地盘干、空亡、马星、格局、宫间生克、反证、方位条件和时间触发条件。候选不等于已经按具体问题选定用神；核心结果、公开 API、MCP 与提示词均不返回内部宫位、格局或方位排序分数，也不机械换算绝对日期。
- 奇门遁甲 `qimenMethod` 支持 `zhuanpan`（转盘法，默认）、`feipan`（飞盘法）；`qimenJuMethod` 支持 `chaibu`（拆补法，默认）、`zhirun`（置闰法，仅时家/日家）。排盘结果包含 `seasonality`（节令背景）和 `patternCombos`（复合格局）。
- 黄历择日 `topic` 支持 `marriage`、`move`、`opening`、`contract`、`travel`、`medical`、`study`、`burial`、`renovation`、`custom`，不传时使用 `custom`，并使用 `startDate`、`endDate` 和可选 `participants`。日期范围一次最多 31 天，`participants` 一次最多 30 位；更大范围或更多参与人请拆成多次请求。
- 黄历择日支持 `page` 和 `pageSize` 分页，`pageSize` 最大 31。不传分页时保持旧行为返回全部日期；传分页后只返回当前页日期，并带 `pagination`。`page` 超过总页数会返回 400，请调用方按 `pagination.totalPages` 继续请求。
- 黄历择日结果的 `evidenceAnalysis` 会把当前返回范围内的日期分成可用、条件和慎用候选，逐日列出事项宜忌、建除神煞、参与人刑冲破害、方向限制、可用时辰与现实约束。分页时证据会按当前页重新计算；核心结果、公开 API、MCP 与提示词均不返回内部日期或时辰排序分数，也不把排序解释成成功率。
- 星盘需要 `year`、`month`、`day`、`hour`、`minute`、`latitude`、`longitude`，并至少提供 `timezone` 或 `timeZoneId`。历史日期及实行夏令时的地区推荐使用 IANA 时区；秋季回拨的一时两刻必须再传与原始记录一致的 `timezone` 消歧，春季跳时中不存在的当地时刻以及固定偏移冲突都会被拒绝。可传 `useTrueSolarTime` 附带真太阳时参考证据，但现代星历始终采用民用出生时间对应的真实 UTC 瞬间。
- 星盘本命与行运相位会输出距精确角偏差、紧密等级和归一化容许度位置；归一化位置只用于相位分层，不代表事件概率或吉凶比例。
- 流年星盘中的太阳返照先在出生日期附近按 2 小时步长寻找太阳黄经过零区间，再用二分法细化至 1 分钟范围；提示词会同时写出当地钟表时刻、固定时区、黄经残差、迭代次数、星历来源和精度边界，不以显示到分钟宣称观测级精度。
- 太阳返照的计算上下文会附带统一天文时间尺度证据，包括 UTC、`JD(UTC)`、`UT1≈UTC` 假设、Espenak-Meeus 分段多项式 ΔT、近似 `JD(TT)`、模型等级和限制。只传 `timezone` 时视为调用方已确认的法定偏移；传 `timeZoneId` 时按运行环境 IANA 数据解析目标日期的历史偏移，不能沿用出生日期的固定偏移。两者同时提供时，固定偏移只用于回拨消歧和一致性核验，冲突会拒绝计算。
- 黄历候选日统一附带中国标准时间正午的月相背景；该背景不参与传统候选排序，其他时区或临近相位交接时应按实际地点时间另算。
- 西占会根据真实经纬度附带太阳光照证据，包括参考时刻太阳高度、真北方位角、视太阳正午、日出日落和三类曙暮光。该数据只描述天文光照背景，不改变星体位置或占星判断；实际地形、建筑、海拔和气象折射仍需现场资料。
- 八字节令月和奇门节令背景会附带节气交接证据：排盘边界采用 `tyme4ts` 历表，另以 Meeus/NOAA 太阳视黄经公式独立求根，并返回历表与模型差值、黄经残差及精度限制；模型核验不会静默覆盖现有排盘边界。
- 西占双盘使用 `person1`、`person2` 包裹双方星盘参数。排盘结果包含主要跨盘相位、实际夹角、精确角、偏差、允许容许度、容许度位置、紧密等级和跨盘落宫；核心结果、公开 API、MCP 与提示词均不返回百分制相位强度，避免被误读为关系概率、匹配率或吉凶比例。
- `/ai/analyze` 请求体支持 `{ "prompt": "..." }` 单轮解析，或 `{ "messages": [{ "role": "user", "content": "..." }] }` 多轮追问；可选 `aiConfig` 指定 `builtin` 或 `custom` 模式。成功时返回 `text/event-stream`，每条增量以 `data: {"content":"..."}` 形式输出。当前接口会拒绝过大的请求体，单次解析消息总内容最多 50000 字符，多轮消息最多 30 条；超限会直接返回 400，调用方应拆分请求。
- `/ai/models` 请求体支持 `{ "aiConfig": { "mode": "builtin" } }` 或自定义 OpenAI 兼容配置，返回 `{ "ok": true, "models": ["模型 ID"] }`。

更完整的字段结构以 [OpenAPI](https://aov.cc/api/v1/openapi.json) 为准。
