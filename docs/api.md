# 命语公开 API

命语公开 API 运行在 `https://aov.cc/api/v1`，适合开发者、AI 代理、自动化工作流直接调用排盘、占卜和一站式提示词生成能力。

## 快速入口

- API 元数据：[https://aov.cc/api/v1/manifest](https://aov.cc/api/v1/manifest)
- OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)
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

| 接口                                 | 说明                                 |
| ------------------------------------ | ------------------------------------ |
| `GET /health`                        | 健康检查                             |
| `GET /manifest`                      | 获取 API 元数据                      |
| `GET /openapi.json`                  | 获取 OpenAPI 文档                    |
| `POST /bazi/calculate`               | 八字排盘                             |
| `POST /bazi/prompt`                  | 八字排盘并生成 AI 解读提示词         |
| `POST /ziwei/calculate`              | 紫微斗数排盘                         |
| `POST /ziwei/prompt`                 | 紫微斗数排盘并生成 AI 解读提示词     |
| `POST /divination/liuyao`            | 六爻起卦                             |
| `POST /divination/liuyao/prompt`     | 六爻起卦并生成 AI 解读提示词         |
| `POST /divination/meihua`            | 梅花易数起卦                         |
| `POST /divination/meihua/prompt`     | 梅花易数起卦并生成 AI 解读提示词     |
| `POST /divination/xiaoliuren`        | 小六壬起课                           |
| `POST /divination/xiaoliuren/prompt` | 小六壬起课并生成 AI 解读提示词       |
| `POST /divination/qimen`             | 奇门遁甲排盘                         |
| `POST /divination/qimen/prompt`      | 奇门遁甲排盘并生成 AI 解读提示词     |
| `POST /divination/liuren`            | 大六壬排盘                           |
| `POST /divination/liuren/prompt`     | 大六壬排盘并生成 AI 解读提示词       |
| `POST /divination/tarot`             | 塔罗抽牌                             |
| `POST /divination/tarot/prompt`      | 塔罗抽牌并生成 AI 解读提示词         |
| `POST /divination/ssgw`              | 三山国王灵签求签：模拟传统摇签、掷筊流程，圣杯确认后方出签；三连阴杯则拒绝起卦 |
| `POST /divination/ssgw/prompt`       | 三山国王灵签求签并生成 AI 解读提示词 |
| `POST /divination/almanac`           | 黄历择日                             |
| `POST /divination/almanac/prompt`    | 黄历择日并生成 AI 解读提示词         |
| `POST /divination/lenormand`         | 雷诺曼抽牌                           |
| `POST /divination/lenormand/prompt`  | 雷诺曼抽牌并生成 AI 解读提示词       |
| `POST /divination/astrolabe`         | 星盘生成                             |
| `POST /divination/astrolabe/prompt`  | 星盘生成并生成 AI 解读提示词         |

## 请求示例

`/calculate` 和 `/divination/{method}` 接口只返回排盘、卦盘、牌阵或灵签数据。需要可直接发送给 AI 的完整提示词时，使用对应的 `/prompt` 一站式接口，八字和紫微返回 `data.result`、`data.prompt`，占卜类还会额外返回 `data.summary`。

八字排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/bazi/prompt \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","question":"我适合创业还是上班？","promptTopic":"career"}'
```

八字神煞争议口径默认使用主流算法；如需兼容其他系统，可通过 `shenShaVariants` 指定：

```bash
curl -X POST https://aov.cc/api/v1/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":5,"day":15,"timeIndex":1,"dateType":"solar","shenShaVariants":{"kongWangBasis":"day-and-year","yangRenMode":"include-yin-ren","tongZiScope":"all-pillars"}}'
```

紫微斗数排盘并生成提示词：

```bash
curl -X POST https://aov.cc/api/v1/ziwei/prompt \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","gender":"female","dateType":"solar","year":"1992","month":"8","day":"21","timeIndex":4,"question":"我的感情关系要注意什么？","promptTopic":"relationship","promptScope":"origin"}'
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

黄历安葬择日：

```bash
curl -X POST https://aov.cc/api/v1/divination/almanac \
  -H "Content-Type: application/json" \
  -d '{"topic":"burial","startDate":"2026-07-01","endDate":"2026-07-15"}'
```

## 参数约定

- `gender` 使用 `male` 或 `female`。
- `dateType` 使用 `solar` 或 `lunar`。
- `timeIndex` 范围为 `0` 到 `12`，其中 `0` 为早子时，`12` 为晚子时。
- `question` 是所有 `/prompt` 接口的必填字段，黄历择日 `/prompt` 可不填。
- 八字 `promptTopic` 支持 `general`、`career`、`wealth`、`marriage`、`children`、`health`、`relationship-push`、`relationship-decision`、`job-change`、`startup-partnership`、`investment-partnership`、`recent`、`home-move`、`settle-relocate`、`study-advance`、`exam-landing`、`reconciliation-decision`、`emotion`、`talent`、`growth`、`social`。
- 紫微 `promptTopic` 支持 `destiny`、`relationship`、`relationship-push`、`relationship-decision`、`children`、`career-wealth`、`job-change`、`startup-partnership`、`investment-partnership`、`recent`、`family`、`home-move`、`settle-relocate`、`social`、`emotion`、`health`、`study`、`study-advance`、`exam-landing`、`reconciliation-decision`、`growth`、`talent`、`life`、`chat`。
- 紫微 `promptScope` 支持 `origin`、`decadal`、`yearly`、`monthly`、`daily`、`hourly`、`age`。
- 紫微公开 API 为保证线上稳定，返回轻量排盘资料，默认只返回 `origin`（本命）范围；如果请求传入 `promptScope`，接口会返回 `origin` 加指定范围，包含分析对象、落宫与四化信息，供流年、流月、流日等分析使用。
- 紫微排盘结果以 `payloadByScope.origin.palaces` 为主结构；同时提供 `四化`、`fourMutagens`、`birthMutagens` 和 `gongList`，方便 agent 直接读取生年四化和十二宫星曜。
- `promptMode` 支持 `framework`（内置完整框架，默认）和 `custom`（只围绕用户问题自由作答）。
- 八字 `school` 支持 `traditional`（传统派子平正法）、`mangpai`（盲派十神象法）、`xinpai`（新派调候流通）。不传则不附加流派指引。
- 八字 `shenShaVariants` 用于请求神煞争议口径；不传时使用默认主流口径：空亡只按日柱旬空、羊刃只取阳干帝旺、童子煞只查日柱和时柱。可选值：`kongWangBasis` 为 `day` 或 `day-and-year`；`yangRenMode` 为 `yang-stems-only` 或 `include-yin-ren`；`tongZiScope` 为 `day-hour` 或 `all-pillars`。
- 紫微 `school` 支持 `sanhe`（三合派三方四正）、`feixing`（飞星派四化飞星链路）、`sihua`（四化派生年四化主线）。不传则不附加流派指引。
- `customDate` 用于指定时间类占卜的起卦或排盘时间，支持六爻、梅花易数、小六壬、奇门遁甲、大六壬；不传时使用服务器当前时间。该字段必须使用带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:00:00+08:00` 或 `2025-01-01T00:00:00Z`。
- Python `urllib` 默认 `User-Agent` 可能被 Cloudflare 拦截；Python 调用时请显式设置正常 `User-Agent`，例如 `curl/8.0.0` 或业务自己的客户端名称。
- 梅花易数 `method` 支持 `time`、`number`、`random`、`external`、`timeTrigram`。数字起卦使用 `number`；外应起卦使用 `externalOmens`，至少提供两项可映射外应，并提供 `count` 作为动爻数量，例如 `{"direction":"南","object":"火电文书","count":3}`；时辰纳卦法使用 `timeTrigram`，按时辰地支方位取上下卦（先天八卦方位，非传统端法后天，属简化启发法）。
- 小六壬 `xiaoliurenMethod` 支持 `time`、`number`、`random`，数字起课时使用 `xiaoliurenNumber`。
- 塔罗 `spreadType` 支持 `single`、`three`、`love`、`career`、`decision`。
- 六爻 `liuyaoTemplate` 支持 `general`、`ganqing`、`shiye`、`caifu`、`guaishen`。
- 大六壬 `liurenTemplate` 支持 `general`、`ganqing`、`shiye`、`caifu`。
- 奇门遁甲 `qimenMethod` 支持 `zhuanpan`（转盘法，默认）、`feipan`（飞盘法）。
- 黄历择日 `topic` 支持 `marriage`、`move`、`opening`、`contract`、`travel`、`medical`、`study`、`burial`、`renovation`、`custom`，并使用 `startDate`、`endDate` 和可选 `participants`。
- 雷诺曼 `spreadType` 支持 `single`、`three`、`five`、`relationship`、`decision`、`nine`、`element`、`grandTableau`。
- 星盘需要 `year`、`month`、`day`、`hour`、`minute`、`latitude`、`longitude`、`timezone`，可传 `useTrueSolarTime` 启用真太阳时校正，提示词接口可使用 `astrolabeTopic` 和 `astrolabeScopeText`。

更完整的字段结构以 [OpenAPI](https://aov.cc/api/v1/openapi.json) 为准。
