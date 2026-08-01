<p align="center">
    <a href="https://linux.do" alt="LINUX DO">
        <img
            src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?logo=data:image/svg%2bxml;base64,DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik00Ni44Mi0uMDU1aDYuMjVxMjMuOTY5IDIuMDYyIDM4IDIxLjQyNmM1LjI1OCA3LjY3NiA4LjIxNSAxNi4xNTYgOC44NzUgMjUuNDV2Ni4yNXEtMi4wNjQgMjMuOTY4LTIxLjQzIDM4LTExLjUxMiA3Ljg4NS0yNS40NDUgOC44NzRoLTYuMjVxLTIzLjk3LTIuMDY0LTM4LjAwNC0yMS40M1EuOTcxIDY3LjA1Ni0uMDU0IDUzLjE4di02LjQ3M0MxLjM2MiAzMC43ODEgOC41MDMgMTguMTQ4IDIxLjM3IDguODE3IDI5LjA0NyAzLjU2MiAzNy41MjcuNjA0IDQ2LjgyMS0uMDU2IiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZWNlY2VjO2ZpbGwtb3BhY2l0eToxIi8+PHBhdGggZD0iTTQ3LjI2NiAyLjk1N3EyMi41My0uNjUgMzcuNzc3IDE1LjczOGE0OS43IDQ5LjcgMCAwIDEgNi44NjcgMTAuMTU3cS00MS45NjQuMjIyLTgzLjkzIDAgOS43NS0xOC42MTYgMzAuMDI0LTI0LjM4N2E2MSA2MSAwIDAgMSA5LjI2Mi0xLjUwOCIgc3R5bGU9InN0cm9rZTpub25lO2ZpbGwtcnVsZTpldmVub2RkO2ZpbGw6IzE5MTkxOTtmaWxsLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Ik03Ljk4IDcwLjkyNmMyNy45NzctLjAzNSA1NS45NTQgMCA4My45My4xMTNRODMuNDI2IDg3LjQ3MyA2Ni4xMyA5NC4wODZxLTE4LjgxIDYuNTQ0LTM2LjgzMi0xLjg5OC0xNC4yMDMtNy4wOS0yMS4zMTctMjEuMjYyIiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5kZDtmaWxsOiNmOWFmMDA7ZmlsbC1vcGFjaXR5OjEiLz48L3N2Zz4=" /></a>
</p>

# 命语

命语是一个算命、占卜、择日的提示词生成项目，目标是把排盘、起卦、抽牌、结构化数据和 AI 提示词连接成一条清晰可复用的流程。让所有人都可以快速的生成专业可靠的排盘信息，而不是依靠模糊的关键词和无脑堆叠专业词汇，让AI占卜相对更加可靠，享受术数的神秘智慧。

你可以在网页端快速完成排盘或占卜，时间类占卜支持使用当前时间或自定北京时间，并复制提示词给你常用的所有 AI 工具继续解读；对于移动端用户还可以使用分享功能快速跳转；也可以通过公开 API、MCP Server 或 skill，把命语的排盘与提示词能力接入自己的应用、工作流和智能体系统。

项目网页目前按“排盘、合盘、占卜、择日”组织：排盘包含八字、紫微、星盘、七政四余和住宅风水，占卜包含六爻、梅花易数、奇门遁甲、大六壬、金口诀、小六壬、太乙神数、塔罗牌、雷诺曼和三山国王灵签。住宅风水为产品统一入口，后台分层保留八宅与玄空飞星盘面；底层八宅、玄空仍可通过 API / MCP 单独调用。生肖流年继续作为底层算法与 API / MCP 能力供其他系统复用，不再提供独立网页入口。

线上体验：[https://aov.cc](https://aov.cc)

公开 API：[https://aov.cc/api/v1/manifest](https://aov.cc/api/v1/manifest)

OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)

公开 skill：[https://aov.cc/skills/aov-mingyu-api/SKILL.md](https://aov.cc/skills/aov-mingyu-api/SKILL.md)

以上 `aov.cc` 是本项目的官方线上实例；如果你 fork 后部署到自己的 Cloudflare Pages 或其他域名，公开 API 会按实际访问域名生成元数据和 OpenAPI 地址。

功德箱：[https://lk.sydf.cc/](https://lk.sydf.cc/)

## 快速导航

- [核心能力](#核心能力)
- [集成方式](#集成方式)
- [核心算法包](#核心算法包-mingyu-core)
- [运行与部署方式](#运行与部署方式)
- [模型评测](#模型评测)

## 核心能力

<details>
<summary>命理排盘</summary>

- 八字排盘：输出四柱、十神、藏干、纳音、神煞、大运、流年、月令司权、旺衰条件与普通月令格局依据；出生时间必须通过输入约束后才进入排盘，不生成模糊时间候选盘。底层只登记月令、司令、根气、藏透、成局及生克制化事实，不自动裁定整体身强身弱；专旺与从格在全局条件和来源闭合前失败关闭。未完成逐条来源、版本与适用边界校勘的自动用神、调候和病药规则同样失败关闭，明确返回取用待定，由 AI 结合完整盘面与问题继续复核。年限提示词可输出原局—大运—流年—流月—流日逐层合冲刑害破、伏吟、岁运并临与天克地冲证据；双盘可计算日主、日支、四柱交叉关系、双向十神及喜忌资料缺口，支持传统派、盲派、新派流派指引。
- 紫微斗数：以 `iztro` 原生能力输出十二宫、星曜、亮度、四化、三方四正及本命、大限、流年、流月、流日、流时，并随结果披露实际安星、闰月、分年、运限月份、小限年龄和晚子时口径；三合派、飞星派、四化派选项只改变解读侧重点，不改底层安星。固定版本传统目录现登记 87 项，其中 55 条具备原文与可复算条件，32 项因原文含糊或依赖运限只登记边界、不伪造命中；原 84 条未校勘项目规则继续停用，目录外格局不作判断。
- 星盘排盘：西方占星完整排盘，包含太阳、月亮、上升星座与宫位、行星及扩展点、逆行提示与相位资料。本命对 24 个点位的 276 组无序点对逐一核验 10 种相位，行运对 10 个行运星体与全部 24 个本命点逐一核验五种主要相位；本命、行运、次限、太阳弧、太阳返照和双盘均完整返回当前定义与容许度内的命中项及实际几何量，不按派生强度筛选，不分级、不按强度或偏差排名删减、不截断，也不把盘面事实包装成事件概率、匹配率或吉凶百分比。行运取样采用目标地点当日历史时区；太阳返照采用粗定位加二分细化，并返回黄经残差、搜索过程和精度边界。
- 奇门遁甲：输出值符、值使、日干、时干及已校勘格局所在宫的位置索引，逐宫保留门星神干、空亡、马星、宫间关系与反证，不用数字评分替代判断，也不自动指定用神、吉方、避方或应期。三奇六仪 81 种天地盘组合全部保留结构事实，仅 11 项经《遁甲演义》逐条校勘的固定格自动进入传统格局。
- 住宅风水：产品统一入口，分层保留八宅命卦宅卦、东四西四分组、八宫传统标签，以及玄空飞星宅运盘；不自动生成方向宜避、命宅效果、布局建议或综合总分。只需普通出生年月日+性别，或只填大门向屋内度数/山向，即可使用；玄空层须提供建造/起运年。测量接近二十四山或宅卦边界时并列全部候选盘，不把中心读数当作唯一坐向。底层仍可单独调用八宅与玄空。
- 七政四余：输出七政四余十一星、命身十二宫、宿度、全部 55 组星对实际夹角、月相与出生时刻光照。七政、罗睺、计都和月孛采用现代天文位置，二十八宿用 28 颗真实距星在目标日期的黄经划界；紫炁保留《七政算内篇》古法均速模型，并明确区分位置精度层级。另按《张果星宗》分开提供天乙昼贵、玉堂夜贵及驿马、华盖、劫煞、咸池、孤辰、寡宿共 8 项生年起例目标支；春节与立春年界不一致时停止生成，目标支不代表盘面命中或吉凶。固定容许度吊照与简化庙旺表因缺少闭合原典依据而不自动判定。
- 时间型占卜不机械换算固定天数、周数或百分比：奇门只输出盘内相对节奏、触发条件与限制；小六壬只保留月、日、时顺数和时宫歌诀，不另造固定应期。
- 合盘与关系分析：支持双方盘面结构化提示词，适配婚恋、合作、友情、亲子、父母、兄弟等场景。

</details>

<details>
<summary>公共地基工具</summary>

- 干支：十天干、十二地支、六十甲子、六旬旬首、纳音、藏干、阴阳五行、合冲刑害破、三合三会统一真相源。
- 五行：统一生克、月令旺相休囚死和天干地支结构出现统计，可选计入藏干。
- 八字、六爻、奇门、六壬等旧模块统一复用公共地基，旧导入路径仅保留兼容转发。
- 核心包提供 `mingyu-core/foundation`，线上提供 `/foundation/capabilities`、`/foundation/ganzhi`、`/foundation/wuxing`、`/foundation/direction`、`/foundation/shensha`；通用神煞入口会严格核验完整四柱，逐项返回空亡、驿马、桃花的起法、目标地支、命中柱位、来源声明和解释限制，能力目录本身也返回稳定事实、来源、证据汇总与解释限制。
- 真太阳时统一提升到 `mingyu-core/calendar`，线上提供 `/calendar/true-solar-time` 便捷换算接口。
- `mingyu-core/calendar` 还提供统一天文时间尺度证据，可把当地钟表时间换算为 UTC、`JD(UTC)`、近似 `JD(UT)` 与 `JD(TT)`，同时返回 ΔT 模型、估算等级和精度限制；支持用 IANA 时区解析历史夏令时、回拨歧义和跳时缺口，太阳返照已接入该证据。
- 历法层可由日月地心黄经差输出月相角、最小距角、照明近似、盈亏、八相、近似月龄及前后朔弦望时刻；奇门和黄历候选日已接入，并明确不把月相自动解释为吉凶或观测级精度。
- 历法层还可按日期、经纬度和历史时区输出太阳高度、真北方位角、视太阳正午、日出日落及民用/航海/天文曙暮光；西占已接入，并保留极昼极夜、地平遮挡和大气折射限制。
- 二十四节气边界继续采用 `tyme4ts` 历表，同时按节气每隔 15° 太阳视黄经的定义，用 Meeus/NOAA 低阶公式独立求根核验；输出采用时刻、模型求根时刻、黄经残差、两者差值和精度限制。八字节令月与奇门节令提示词已接入该证据，临界时间不因显示到秒而宣称观测级精度。
- 十二时辰目录、月份天数和中国 1986–1991 历史夏令时也统一由公共日历层提供。

</details>

<details>
<summary>占卜术数</summary>

- 六爻：京房八宫法排盘，包含纳甲、六亲、六神、世应、动变、空亡、日破、月破、化进神、化退神、六亲持世等信息；回头冲、动变五行关系、化空、化破与化扶可同时保留，变爻只回头作用本位动爻。三合按三爻齐动、两动一静、初三/四六爻动变、月日补局与虚一待用分别记录参与爻、空破墓和待值条件，同一爻的本支、变支不能冒充月日补局所需的两个活动爻；静爻逢月日合记合起，明动或暗动逢合记合绊，两活动爻相合记合好。输出分层用神候选、原神忌神仇神作用链，并逐引用记录用神有气/无根、原神忌神有力/无力及真实活动状态；另按月日、明暗动、旺相静爻、本位动变和飞伏事实返回直接生克、忌原接续相生及原忌受制得助的可追踪路径。公开证据、提示词和摘要只保留时间戳，以及时间种子法、六个手工爻值、六组实投三钱记录或恰好 18 个可重放随机样本之一作为原始输入；卦名、纳甲、世应、旺衰、伏神、组合关系与旧证据全部重算，来源缺失、夹带或矛盾时失败关闭。主互变及审核重建已按 64 卦 × 6 动爻逐案验证；路径允许并见，不按数量裁定最终有效性，也不生成吉凶总分或固定日期。
- 梅花易数：支持时间起卦、数字起卦、随机起卦，包含体用生克、四时旺衰、64卦完整爻辞，以及主卦、互卦、变卦逐阶段体用推进与支持、限制证据。公开证据、提示词、摘要和辅助分析只保留起卦时间、方法、用户数字或可重放随机轨迹作为原始输入，主互变、动爻、体用、旺衰和旧证据全部重新计算；随机轨迹缺失、矛盾、样本数不符或种子无法复算时失败关闭。
- 奇门遁甲：公开 API 与网页使用时家奇门，默认转盘和拆补法，可请求飞盘或置闰法；核心包另开放已校勘的月家、年家，分别按行年五年段和一百八十年三元周期使用阴遁一、四、七局。日家古法存在多版本冲突，旧实现又曾错误复用时家算法，因此生成、旧盘重建和提示词入口均失败关闭。已开放盘式包含天地人神四盘、值符值使、位置标签、节令背景、已校勘组合、位置索引与全部九宫宫对；通用入口不自动套用缺少专项情境或存在版本冲突的规则。
- 大六壬：天盘、四课、三传、月将、贵人、旬空、课体与问题范围选择；输出起盘及四课九宗门主版本与异说边界，并逐传给出相对日干的六亲、有方向生克、相邻关系、月令旺衰及条件化旬空资料。
- 小六壬：只保留可复核的通行时间课，按“正月起大安、月上起初一、日上起子时”顺数大安、留连、速喜、赤口、小吉、空亡，以时宫为占得宫；月宫、日宫仅为计算轨迹，并明确闰月、换日、歌诀解释和版本学边界。
- 太乙神数：当前开放完成积年与阳遁七十二局立成校勘的年计，输出太乙、文昌、始击、计神、主客定算、将参与十六神盘，并提供计算链、主证、辅证、反证和方法限制组成的结构化证据。月、日、时计须补齐节气时刻、章月、月法、日法、气应与小余等古籍历法链后再开放；Kintaiyi 的简式与分计不作为古籍真值。
- 自定起卦时间：六爻、梅花易数、奇门遁甲、大六壬、小六壬可在网页端选择当前时间或自定北京时间；公开 API、MCP Server 和 skill 使用 `customDate` 传入带时区的 ISO 8601 时间。
- 塔罗牌：78 张塔罗牌，支持单牌、时间流、爱情、事业、选择等牌阵；逐牌保留牌位、正逆位、关键词、元素、牌阶、牌序和解释限制，不输出能量分数或成功率。
- 雷诺曼：36 张雷诺曼牌，支持单牌、时间流、爱情、事业、选择、九宫和大桌等牌阵；固定组合、普通相邻合读与布局事实分层保存，未命中固定组合时明确证据缺口。
- 生肖流年：按生肖年支与流年干支逐项计算值、冲、刑、害、破、三合、六合、三会和年干五行辅助关系；三合、三会只记录两支同属固定组，不表示完整成局。结果输出计算链、主证、辅证、反证与信息量限制，不把五行生克改写成利弊，不把三合六合改写成现实贵人，也不生成综合吉凶等级或行动建议。
- 三山国王灵签：92 签灵签，源自广东潮汕三山国王祖庙；包含签题、签诗、典故故事、分类解签、可重放抽签与掷筊轨迹，并按签诗主证、典故辅证、仪式反证和现实限制生成结构化证据。

</details>

<details>
<summary>择吉择日</summary>

- 黄历择日：支持搬家入宅、订婚结婚、开业启动、签约合作、出行赴任、就医手术、考试学习、安葬修坟、修造动土等事项；按 `tyme4ts` 原始宜忌、参与人刑冲破害、时辰与现实限制分成可用、条件和慎用候选，不设置或包装吉凶总分。

</details>

<details>
<summary>模型评测</summary>

- 内置 `2025年第十六届全球算命师比赛` 评测资料，包含原题、8 份提示词和 40 题正确答案。
- 提示词已补入题目涉及年份、年龄段对应的大运、流年、年龄、十神和小运信息，方便直接评测不同模型的命理选择题表现。
- 提供快速评测脚本，支持 OpenAI Chat Completions、OpenAI Responses、Claude Messages、Gemini generateContent 四种接口格式。
- 评测结果按 100 分制输出，并同时给出准确率和逐题明细。

</details>

## 集成方式

命语提供三种集成方式：公开 API、MCP Server、公开 skill。API 和 MCP 都支持一站式返回 `result` 与 `prompt`；六爻、梅花易数、奇门遁甲、大六壬、小六壬还支持通过 `customDate` 指定起卦或排盘时间。README 只保留快速入口和安装方式，接口参数、客户端配置和调用示例请跳转到对应文档。

<details>
<summary>公开 API</summary>

无需安装，直接调用线上接口：

```text
https://aov.cc/api/v1
```

详细文档：[docs/api.md](docs/api.md)

OpenAPI：[https://aov.cc/api/v1/openapi.json](https://aov.cc/api/v1/openapi.json)

</details>

<details>
<summary>MCP Server</summary>

命语内置 MCP Server，让支持 MCP 的 AI 客户端直接调用本地排盘引擎，不需要用户手动复制 JSON 或提示词。

快速安装：

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
npm install
```

启动命令：

```bash
npm run mcp
```

详细文档：[mcp/README.md](mcp/README.md)

</details>

<details>
<summary>公开 skill</summary>

这个 skill 面向 AI 代理和开发者，说明如何通过 `aov.cc` 公开 API 完成排盘、占卜和提示词生成。

快速安装：

```bash
npx skills add Brhiza/mingyu --skill aov-mingyu-api -g -y
```

快速读取：

```text
让你的 AI 代理读取这个 skill：
https://aov.cc/skills/aov-mingyu-api/SKILL.md
```

如果当前环境无法使用 `npx skills`，也可以手动创建目录后保存：

```bash
mkdir -p ~/.codex/skills/aov-mingyu-api
curl -L https://aov.cc/skills/aov-mingyu-api/SKILL.md \
  -o ~/.codex/skills/aov-mingyu-api/SKILL.md
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills\aov-mingyu-api"
Invoke-WebRequest "https://aov.cc/skills/aov-mingyu-api/SKILL.md" `
  -OutFile "$env:USERPROFILE\.codex\skills\aov-mingyu-api\SKILL.md"
```

详细文档：[public/skills/aov-mingyu-api/SKILL.md](public/skills/aov-mingyu-api/SKILL.md)

元数据发现：[https://aov.cc/.well-known/aov-mingyu-api.json](https://aov.cc/.well-known/aov-mingyu-api.json)

</details>

## 核心算法包 `mingyu-core`

命语的所有命理排盘与占卜算法已抽取为独立 npm 包 [`mingyu-core`](https://www.npmjs.com/package/mingyu-core)，本仓库以 pnpm workspace 形式同时维护应用与算法包。

<details>
<summary>安装和使用示例</summary>

```text
mingyu/
├── packages/
│   └── core/                  # mingyu-core 算法包（独立发布到 npm）
└── src/                       # 应用层（React + Vite + MCP）
```

安装：

```bash
npm install mingyu-core
```

使用示例：

```ts
// 八字排盘
import { baziCalculator } from 'mingyu-core/bazi';

const result = baziCalculator.calculateBazi({
  year: 1990,
  month: 1,
  day: 1,
  timeIndex: 5,
  gender: 'male',
});

// 占卜算法
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';

// 历法工具
import { getDivinationTime, getVoidBranches } from 'mingyu-core/calendar';

// 类型
import type { BaziChartResult, QimenData, LiurenData } from 'mingyu-core/types';
```

包覆盖能力：八字（含四柱、月令司权、旺衰条件、普通月令格局依据、神煞、大运、命卦、小运、排盘边界预警、中国夏令时校正及透干根气、十神结构、合化评估等增强分析；不自动裁定整体身强身弱，专旺、从格及未校勘的自动用神、调候与病药规则失败关闭）、奇门遁甲（含节令背景、九宫原始事实、位置索引、全部宫对五行关系及已校勘固定格，不自动指定用神或生成方位应期）、六爻、大六壬、梅花易数、小六壬、紫微斗数、西洋占星、七政四余、择日、雷诺曼、塔罗、三山国王灵签，以及住宅风水（八宅与玄空分层资料）、八宅、玄空飞星、生肖流年、太乙和干支、五行、方位、神煞公共模块。

**⚠️ 免责：** 该包仅提供算法实现，所有结果仅供参考与学习娱乐，不构成任何命理预测或专业建议。

算法包详细文档：[packages/core/README.md](packages/core/README.md)

</details>

## 技术栈

| 类别       | 技术                                            |
| ---------- | ----------------------------------------------- |
| 前端       | React 19、TypeScript 5.9                        |
| 构建       | Vite 7                                          |
| 路由       | React Router 7                                  |
| 包管理     | pnpm workspace（应用层 + `mingyu-core` 算法包） |
| 部署       | Cloudflare Pages、Pages Functions、Docker       |
| 历法与星盘 | `tyme4ts`、`iztro`、`celestine`                 |
| 数据校验   | `zod`                                           |
| 测试       | Node.js 原生测试运行器                          |
| AI 集成    | MCP Server、OpenAPI、skill 文档                 |

## 项目结构

<details>
<summary>展开目录结构</summary>

```text
mingyu/
├── functions/                 # Cloudflare Pages Functions 公开 API 和公开发现元数据
├── mcp/                       # MCP Server
├── packages/
│   └── core/                  # mingyu-core 独立算法包（发布到 npm）
│       ├── src/bazi/          # 八字引擎与增强分析
│       ├── src/divination/    # 占卜算法（六爻/奇门/六壬/梅花等）
│       ├── src/calendar/      # 历法工具
│       └── src/types/         # 共享类型
├── public/
│   └── skills/                # 公开 skill 文档
├── server/                    # Docker 自部署服务入口
├── src/
│   ├── components/            # 页面组件与通用 UI
│   ├── lib/
│   │   ├── divination/        # 占卜引擎与提示词拼装
│   │   ├── full-chart-engine/ # 八字、紫微完整排盘入口
│   │   ├── iztro/             # 紫微运行时适配
│   │   ├── public-api/        # 公开 API handler
│   │   └── ziwei-prompts/     # 紫微提示词模块
│   ├── pages/                 # 输入页、结果页、历史页、教程页
│   ├── types/                 # 领域类型定义
│   ├── utils/                 # 页面层工具，核心算法统一来自 mingyu-core
│   └── workers/               # 紫微相关 Web Worker
└── tests/                     # 单元测试与集成测试
```

</details>

## 运行与部署方式

本项目支持本地开发、Cloudflare Pages 和 Docker 三种常用运行方式。AI 相关变量也放在这里，部署时可以一起配置。

<details>
<summary>本地开发</summary>

本项目使用 pnpm workspace 管理应用层与 `mingyu-core` 算法包，需先安装 [pnpm](https://pnpm.io)：

```bash
npm install -g pnpm
```

安装依赖：

```bash
pnpm install
```

启动网页开发服务：

```bash
pnpm dev
```

启动 MCP Server：

```bash
pnpm mcp
```

构建生产版本：

```bash
pnpm build
```

运行测试：

```bash
pnpm test
```

单独构建 `mingyu-core` 算法包：

```bash
pnpm --filter mingyu-core build
```

类型检查 MCP 与共享源码：

```bash
npx tsc --project mcp/tsconfig.json --noEmit
```

</details>

<details>
<summary>Cloudflare Pages 部署</summary>

推荐部署到 Cloudflare Pages，静态页面由 Pages 托管，`/api/v1/*` 由 Pages Functions 处理。

Pages 构建设置：

| 配置项                 | 值           |
| ---------------------- | ------------ |
| Build command          | `pnpm build` |
| Build output directory | `dist`       |
| Root directory         | 仓库根目录   |
| Node.js version        | 建议 `22`    |

如果 Cloudflare 没有自动启用 pnpm，可在环境变量中添加：

```text
PNPM_VERSION=11
```

公开 API 路由来自 `functions/api/v1/[[path]].ts`，部署后可访问：

```text
https://你的域名/api/v1/manifest
https://你的域名/api/v1/openapi.json
https://你的域名/.well-known/aov-mingyu-api.json
```

如果绑定的域名是 `aov.cc`，上线后检查：

```text
https://aov.cc/api/v1/manifest
https://aov.cc/api/v1/openapi.json
https://aov.cc/.well-known/aov-mingyu-api.json
https://aov.cc/mingyu-runtime-config.js
```

Cloudflare Pages 的环境变量在 Dashboard → Settings → Environment variables 中配置。密钥不要写进代码仓库。

启用内置 AI 时，Production 环境至少配置：

```text
AI_BUILTIN_ENABLED=true
AI_DEFAULT_ENABLED=false
AI_API_KEY=你的模型密钥
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
```

如果同时启用了 Preview 部署，也需要在 Preview 环境配置同一组变量。保存环境变量后重新部署一次，`/mingyu-runtime-config.js` 会从 Pages Functions 读取当前环境变量，并返回 `Cache-Control: no-store`，避免旧配置被缓存。

</details>

<details>
<summary>Docker 部署</summary>

Docker 镜像会构建前端页面，并在容器内启动一个 Node 服务，同时提供：

- 网页访问
- `/api/v1/*` 公开 API
- `/api/v1/ai/analyze` 流式 AI 解读
- `/api/v1/ai/models` 模型列表获取

构建镜像：

```bash
docker build -t mingyu .
```

启动基础服务：

```bash
docker run --rm -p 3000:3000 mingyu
```

访问：

```text
http://localhost:3000
```

带服务端 AI 启动：

```bash
docker run --rm -p 3000:3000 \
  -e AI_API_KEY=your-api-key \
  -e AI_BASE_URL=https://api.deepseek.com/v1 \
  -e AI_MODEL=deepseek-chat \
  -e AI_PROVIDER_NAME=DeepSeek \
  -e AI_BUILTIN_ENABLED=true \
  -e AI_DEFAULT_ENABLED=false \
  mingyu
```

也可以使用 Docker Compose：

```bash
docker compose up --build
```

Compose 会读取本地 `.env`。可以在本地 `.env` 中填写下面内容，但不要提交这个文件：

```text
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_PROVIDER_NAME=DeepSeek
AI_BUILTIN_ENABLED=true
AI_DEFAULT_ENABLED=false
VITE_ENABLE_DONATION_BOX=false
```

默认端口是 `3000`。如需修改容器内端口，可设置 `PORT`；如需修改宿主机端口，调整 compose 或 `docker run` 的 `-p` 左侧端口。

`VITE_ENABLE_DONATION_BOX=true` 时，首页上方会显示功德箱按钮；不设置或设为 `false` 时默认不显示。这个变量只影响前端构建，Cloudflare Pages 需要配置在构建环境变量中，Docker 部署需要在构建时传入。

</details>

<details>
<summary>服务端 AI（内置 AI）配置</summary>

命语支持两种 AI 使用方式：

- 用户在首页顶部齿轮中自行填写 OpenAI 兼容接口，API Key 只保存在用户自己的浏览器。
- 站点部署者在服务端配置 AI，前端会显示一个可选服务商。这个能力也可以理解为“内置 AI”。

服务端 AI 环境变量：

| 变量                 | 说明                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `AI_API_KEY`         | 服务端调用模型的密钥                                                    |
| `AI_BASE_URL`        | OpenAI 兼容接口地址，例如 `https://api.deepseek.com/v1`                 |
| `AI_MODEL`           | 默认模型名称                                                            |
| `AI_PROVIDER_NAME`   | 前端显示的服务商名称，可自行命名                                        |
| `AI_BUILTIN_ENABLED` | 设为 `true` 时，前端显示并允许使用服务端 AI                             |
| `AI_DEFAULT_ENABLED` | 设为 `true` 时，页面默认进入 AI 解读；设为 `false` 时默认仍是提示词模式 |

只配置 `AI_API_KEY` 不会自动显示服务端 AI；必须同时设置 `AI_BUILTIN_ENABLED=true`。如果想提供公益内置 AI，但默认仍让用户复制提示词，可设置 `AI_BUILTIN_ENABLED=true`、`AI_DEFAULT_ENABLED=false`。用户仍可通过齿轮自行填写自己的接口。

AI 代理会对上游临时错误自动重试 2 次。只重试网络异常、408、429 和 5xx；鉴权失败、模型名错误等确定性问题不会重试。常见错误码：

| 错误码                       | 含义                                       |
| ---------------------------- | ------------------------------------------ |
| `AI_UPSTREAM_UNSTABLE`       | 上游 AI 服务返回 5xx，通常是服务临时不稳定 |
| `AI_UPSTREAM_RATE_LIMIT`     | 上游限流或额度受限                         |
| `AI_UPSTREAM_TIMEOUT`        | 上游响应超时                               |
| `AI_UPSTREAM_AUTH_ERROR`     | API Key 无效、过期或额度账号异常           |
| `AI_UPSTREAM_CONFIG_ERROR`   | 接口地址或模型名称可能不被上游支持         |
| `AI_UPSTREAM_NETWORK_ERROR`  | 服务器无法连接上游 AI 服务                 |
| `AI_UPSTREAM_EMPTY_RESPONSE` | 上游返回成功状态但没有可读取内容           |
| `AI_UPSTREAM_STREAM_ERROR`   | 上游流式响应中途断开                       |

`.dev.vars.example` 提供了本地和 Cloudflare 可参考的变量模板。公开站点启用服务端 AI 会产生调用成本，也可能受上游模型稳定性影响，建议先确认额度、限流和可用性。

</details>

## 模型评测

比赛资料位于：[docs/2025第十六届全球算命师比赛](docs/2025第十六届全球算命师比赛)

<details>
<summary>展开评测命令和参数</summary>

交互式运行：

```bash
npm run contest:evaluate
```

脚本会依次询问接口 URL、API Key 和模型名称，自动读取 8 份提示词与 `正确答案.md`。每个命例只要求模型输出 5 个 A/B/C/D 答案字母，减少长理由导致的截断和解析错误；调用完成后输出 100 分制总分、准确率、分命例得分和逐题明细。

也可以直接传参：

```bash
npm run contest:evaluate -- --format chat --url https://api.openai.com/v1 --key your-api-key --model gpt-4.1-mini
```

批量并发评测：

```bash
npm run contest:evaluate -- --format chat --url https://openrouter.ai/api/v1 --key your-api-key --concurrency 3 --models "GPT-5.4=openai/gpt-5.4,Claude Sonnet 4.6=anthropic/claude-sonnet-4.6"
```

`--concurrency` 控制同时评测的模型数量，默认批量为 3；`--caseConcurrency` 控制同一模型内命例并发数量，默认 1。批量模式会合并更新比赛目录下的 `模型评测排名报告.md` 和 `评测结果/本次排名原始结果.json`。

使用 OpenRouter 测 reasoning 模型时，可以加 `--reasoningEffort none --excludeReasoning --maxTokens 256`，让模型尽量只返回最终答案。若某个命例没有解析满 5 个答案，脚本会把该模型标为失败，不会把 `?????` 当作 0 分答案计入排名。

支持的 `--format`：

| 格式        | 说明                               | URL 示例                                           |
| ----------- | ---------------------------------- | -------------------------------------------------- |
| `chat`      | OpenAI Chat Completions 或兼容接口 | `https://api.openai.com/v1`                        |
| `responses` | OpenAI Responses                   | `https://api.openai.com/v1`                        |
| `claude`    | Claude Messages                    | `https://api.anthropic.com/v1`                     |
| `gemini`    | Gemini generateContent             | `https://generativelanguage.googleapis.com/v1beta` |

不传 `--format` 时会自动识别；评测报告会保存到比赛资料目录下的 `评测结果/`。

</details>

## 适合贡献的方向

- 补充更多命理、占卜与提示词测试样例。
- 优化公开 API 的字段文档和返回示例。
- 增加更多 AI 客户端的 MCP 配置示例。
- 扩展 skill，使更多代理能自动发现并调用命语。
- 增强移动端体验、可访问性和教程说明。

## 关于三山国王

三山国王是粤东潮汕与客家地区极具影响力的民间信仰，祖庙位于**广东揭西县河婆街道**。这座有着千年历史的庙宇供奉着巾山、明山、独山三位山神，自隋代至今香火不断，影响远播东南亚。

项目作者来自揭西，自幼祭拜三山国王。这套**92 签灵签体系**正是以祖庙传承的签诗为本，结合正史典故与民间传说整理而成：

- 39 支上签、30 支中签、21 支下签、2 支无事签，签序暗合"始于进取，终于守成"的人生智慧
- 每签配有签题、签诗、典故故事与多领域解签
- 第 91、92 签为独有的"无事签"——其他签诗体系几乎没有，体现了三山文化"无事即福"的朴素智慧

我们希望这套签文能成为一本"人生操作手册"——迷茫时翻开，总有一支签、一句诗，能让人豁然开朗。

## 免责声明

命语提供的是命理、占卜与 AI 提示词辅助工具，结果仅供参考和娱乐学习使用，不应替代医疗、法律、投资、心理咨询等专业建议。

## 项目关键词

算命、AI 算命、在线算命、免费算命、智能算命、八字算命、八字排盘、紫微斗数、紫微排盘、星盘、占星排盘、六爻起卦、梅花易数、奇门遁甲、大六壬、小六壬、塔罗占卜、塔罗抽牌、雷诺曼、抽签、灵签、三山国王灵签、择日、黄道吉日、命理工具、占卜工具、运势分析、婚姻算命、事业运势、财运分析。
