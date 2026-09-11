# 命语 MCP Server

让 AI 直接调用命语的排盘引擎和一站式提示词工具，无需手动复制排盘 JSON。用户可以直接说“帮我算命”“看看今年运势”“占卜这件事能不能成”“用玄学分析”“帮我们合婚”或“选个好日子”，再由 AI 选择合适的工具。

## 支持的 Tool

| Tool 名称 | 功能 | 说明 |
| --- | --- | --- |
| `foundation_capabilities` | 公共地基能力目录 | 获取公共地基能力目录，返回历法、干支、五行、方位与通用神煞的稳定能力事实 |
| `foundation_ganzhi` | 六十甲子干支属性 | 查询单个六十甲子的序号、纳音、五行、阴阳、藏干与合冲刑害破 |
| `foundation_wuxing` | 五行力量与生克 | 分析干支列表的五行统计、藏干权重与主导五行生克 |
| `foundation_direction` | 二十四山与罗盘方位 | 按罗盘角度查询所属八卦、二十四山、天心十道对冲山与四正四隅属性 |
| `foundation_shensha` | 通用传统神煞 | 按八字默认口径核验四柱干支的空亡、驿马与桃花传统神煞 |
| `classics_yilin_query` | 焦氏易林固定索引查询 | 查询固定4096条卦对原文、双底本来源定位与未决字形/校勘状态 |
| `calendar_true_solar_time` | 真太阳时校正 | 根据地理经度与平太阳时换算真太阳时与均时差 |
| `calendar_true_solar_birth` | 统一出生真太阳时 | 根据出生公历或农历及经度时区计算校正后的公历与农历时间 |
| `calendar_solar_illumination` | 太阳光照与出没 | 计算指定日期的日出日落时刻、地平高度与曙暮光证据 |
| `calendar_astronomical_time` | 天文时间尺度 | 计算儒略日、近似 UT1、ΔT 与近似 TT 证据 |
| `calendar_moon_phase` | 月相证据 | 计算月相角、照明比例与朔弦望事件 |
| `calendar_solar_term` | 二十四节气 | 计算节气历表时刻、太阳黄经度数与独立求根核验 |
| `instant_chart` | 即时排盘 | 按当前时刻即时排八字、紫微、合参、星盘或七政盘，无需性别与个人字段 |
| `name_generate` | 中文起名 | 结合出生资料、偏好字、忌用字与辈分字生成姓名候选 |
| `name_analyze` | 姓名解析 | 解析姓名康熙笔画、五格数理、三才配置与五行分布 |
| `name_generate_prompt` | 中文起名提示词 | 结合出生资料、用字条件、适配字池和候选样本生成完整起名提示词；支持统一主题、主题细项和分析范围选择 |
| `name_analyze_prompt` | 姓名解析提示词 | 结合出生资料和姓名底稿生成完整姓名解析提示词；支持统一主题、主题细项和分析范围选择 |
| `character_analyze` | 汉字解析 | 查询汉字康熙笔画、现代笔画、五行、部首、拼音与繁简对应 |
| `character_select` | 起名选字 | 按康熙笔画、五行、拼音和常用字条件筛选汉字 |
| `number_analyze` | 数字能量 | 解析数字与字母编号的八星磁场、相邻组合以及0和5的作用 |
| `number_energy_prompt` | 数字能量提示词 | 解析八星数字能量并生成可直接交给 AI 的完整提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_zhuge` | 诸葛神数 | 按三个汉字康熙笔画尾数计算诸葛神数384签 |
| `divine_kongming` | 孔明神卦 | 按五枚硬币的阴阳结果生成三十二种孔明神卦之一 |
| `bazi_calculate` | 八字排盘 | 计算四柱干支、十神、藏干、大运、流年、胎元命宫身宫与神煞（支持缺时辰三柱降级） |
| `bazi_prompt` | 八字解读提示词 | 生成供在线大模型直接解读的自包含八字任务书提示词；支持统一主题、主题细项和分析范围选择 |
| `bazi_compatibility` | 八字双盘合婚 | 计算两人八字日主五行喜忌互补、四柱干支合冲与夫妻宫德合刑冲 |
| `bazi_compatibility_prompt` | 八字合盘提示词 | 生成八字双盘合婚与合伙关系的自包含深度提示词；支持统一主题、主题细项和分析范围选择 |
| `ziwei_calculate` | 紫微斗数排盘 | 计算紫微斗数十二宫星曜、生年四化、大限流年与三方四正格局 |
| `ziwei_prompt` | 紫微解读提示词 | 生成包含本命十二宫全要素、飞化自化与重点宫位的紫微解读任务书；支持统一主题、主题细项和分析范围选择 |
| `ziwei_compatibility` | 紫微合盘 | 计算双方关键宫位叠盘、生年四化跨盘落宫与星曜交感 |
| `ziwei_compatibility_prompt` | 紫微合盘提示词 | 生成紫微合盘结构化证据与关系推演提示词；支持统一主题、主题细项和分析范围选择 |
| `bazi_ziwei_prompt` | 八字紫微合参提示词 | 以同一出生时间联动八字与紫微，生成双体系交叉互证的自包含任务书；支持统一主题、主题细项和分析范围选择 |
| `thematic_consultation_prompt` | 大类主题咨询提示词 | 按通用、感情、事业、财运、健康、家庭、学业、时机等大类自动提取八字与紫微核心要素生成自包含任务书；支持统一主题、主题细项和分析范围选择 |
| `divine_liuyao` | 六爻排盘 | 六爻纳甲起卦、世应动变、六亲六神与生克冲合 |
| `liuyao_prompt` | 六爻提示词 | 生成六爻卦象用神旺衰与动态演变的自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_meihua` | 梅花易数排盘 | 梅花易数体用互变卦象与五行生克 |
| `meihua_prompt` | 梅花易数提示词 | 生成梅花易数主互变卦象推进与体用生克的自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_xiaoliuren` | 小六壬排盘 | 小六壬月日时顺数初宫二宫三宫流转与时宫定局 |
| `xiaoliuren_prompt` | 小六壬提示词 | 生成小六壬三宫推移与速断决策自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_jinkoujue` | 金口诀排盘 | 大六壬金口诀人元、贵神、将神、地分四位课盘 |
| `jinkoujue_prompt` | 金口诀提示词 | 生成金口诀四位发用与生克主客提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_qimen` | 奇门遁甲时局排盘 | 时家奇门九星、九宫、八门、八神与三奇六仪盘面 |
| `qimen_prompt` | 奇门遁甲提示词 | 生成奇门时空方位与动静主客策略自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_qimen_lifetime` | 奇门终身局排盘 | 根据出生时刻与时区排布终身本命盘，提取阶段卡和目标区间动态事件 |
| `qimen_lifetime_prompt` | 奇门终身局提示词 | 生成奇门终身局长远运势与阶段动态提示词；支持 `periodRange` 与 `topics` |
| `divine_liuren` | 大六壬排盘 | 大六壬天地盘、四课、三传九宗门与十二天将 |
| `liuren_prompt` | 大六壬提示词 | 生成大六壬课体演化与人事博弈自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_tarot` | 塔罗抽牌排阵 | 78张塔罗牌多牌阵抽取、正逆位与牌位结构化证据 |
| `tarot_prompt` | 塔罗提示词 | 生成塔罗牌阵位置脉络与象征启发的自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_lenormand` | 雷诺曼抽牌排阵 | 36张雷诺曼牌阵抽取、核心十字与相邻组合合读 |
| `lenormand_prompt` | 雷诺曼提示词 | 生成雷诺曼牌位关系与日常符码解读提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_ssgw` | 三山国王灵签抽签 | 纯正民间签谱抽取，返回签号、签题、签诗与历史典故 |
| `ssgw_prompt` | 三山国王灵签提示词 | 生成只含签诗典故与修身启迪的纯净自包含提示词 |
| `divine_almanac` | 黄历择日排盘 | 建除十二神、丛辰神煞与多参与人四柱冲煞择吉 |
| `almanac_prompt` | 黄历择日提示词 | 生成候选日期优选分析与自包含择日决策提示词；支持统一主题、主题细项和分析范围选择 |
| `divine_astrolabe` | 西洋星盘排盘 | 本命星体黄道位置、宫位分界与相位交角 |
| `astrolabe_prompt` | 西洋星盘提示词 | 生成本命与行运过境解读自包含提示词；未指定范围时默认当前年度行运，支持统一主题、主题细项和分析范围选择 |
| `astrolabe_synastry` | 西占双盘比较盘 | 计算双人星盘跨盘相位、角距、落宫与互溶接纳 |
| `astrolabe_synastry_prompt` | 西占双盘提示词 | 生成西占双人关系比较盘自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `metaphysics_bazhai` | 八宅风水排盘 | 居者生年命卦、宅卦大游年与门主灶九星相配 |
| `bazhai_prompt` | 八宅风水提示词 | 生成八宅方位吉凶与布局调谐自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `metaphysics_xuankong` | 玄空飞星排盘 | 三元九运山向运星排盘、下卦或兼向替卦、反伏吟与城门诀计算；可按目标流年、流月日期叠加飞星 |
| `xuankong_prompt` | 玄空飞星提示词 | 生成玄空飞星下卦或兼向替卦山向旺衰与城门气口自包含提示词；可按目标流年、流月日期携带飞星资料，支持统一主题、主题细项和分析范围选择 |
| `metaphysics_residential` | 住宅风水合参排盘 | 综合八宅生年命卦与玄空飞星九运（下卦或兼向替卦）的住宅风水合参；可按目标流年、流月日期叠加飞星 |
| `residential_prompt` | 住宅风水合参提示词 | 生成住宅风水八宅玄空（下卦或兼向替卦）综合评估自包含提示词；可按目标流年、流月日期携带飞星资料，支持统一主题、主题细项和分析范围选择 |
| `metaphysics_zodiac` | 生肖流年关系 | 分析生肖与流年太岁刑冲克害破、三合六合关系 |
| `zodiac_prompt` | 生肖流年提示词 | 生成生肖与岁星作用自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `metaphysics_taiyi` | 太乙神数式盘 | 太乙神数年月日时四计七十二局式盘与主客和数算分析 |
| `taiyi_prompt` | 太乙神数提示词 | 生成太乙主客胜负定性与宏观时势自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `metaphysics_wuyun_liuqi` | 五运六气排盘 | 年度五步主客运、司天在泉与天符岁会五类符会病机 |
| `wuyun_liuqi_prompt` | 五运六气提示词 | 生成年度气候节律与病机平气自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `metaphysics_huangji_jingshi` | 皇极经世宏观周期 | 邵雍皇极经世元会运世、值年卦与运世消息推进 |
| `huangji_jingshi_prompt` | 皇极经世提示词 | 生成皇极经世时代坐标与值年卦演变自包含提示词；支持统一主题、主题细项和分析范围选择 |
| `huangji_reference_tables` | 皇极经世扩展资料表 | 查询固定版本的声音律吕、动植物数与经辰历史纪年原表；历史表按经辰序号查询 |
| `metaphysics_qizheng` | 七政四余排盘 | 果老星宗七政十一星、二十八宿界、昼夜分金恩难与行限流曜 |
| `qizheng_prompt` | 七政四余提示词 | 生成七政四余天星恩难自包含解读任务书；支持统一主题、主题细项和分析范围选择 |

七政四余的七政、罗睺、计都和月孛采用现代天文位置，二十八宿按 28 颗真实距星在目标日期的黄经划界；紫炁采用《七政算内篇》古法均速模型。结果逐星标明来源和精度层级，真太阳时只校正传统命身十二宫，不改变现代天体计算时刻。

## 工具选择指南

需要 AI 继续解读时，优先调用 `*_prompt` 工具；只需要结构化数据、表格展示或二次计算时，才调用 `*_calculate`、`divine_*` 或 `metaphysics_*` 工具。提示词工具只返回 `prompt`。排盘工具默认使用 `detailMode: "compact"`，保留盘面与解读所需字段，省略提示词、证据链和重复计算过程；只有审计或研究时才显式传 `detailMode: "full"`。历法、天文和公共地基工具保持原有完整事实返回。

默认优先级：

1. 用户明确要“现在起盘”“即时盘”或“紫占”时，调用 `instant_chart`；即时盘不需要性别，也不混入占卜工具。未指定时间口径时用北京时间，明确要求真太阳时时必须提供观测地点。
2. 用户提供完整出生信息，并询问人生、事业、财运、婚恋、亲子、健康、迁居、学习、考试、合作、近期趋势或某一年某阶段走势时，优先调用 `bazi_ziwei_prompt`。这是深度解读首选工具，用八字定主线，用紫微校验宫位、四化、三方四正和运限。
3. 用户明确只看单人八字时调用 `bazi_prompt`；询问两人婚恋、合作或亲属互动时调用 `bazi_compatibility_prompt`；长期或完整阶段分析优先传 `baziFortuneScope: "full"`。出生时间由输入约束保证符合排盘要求，不基于模糊时间范围继续排盘。
4. 用户明确只看紫微时，调用 `ziwei_prompt`；长期或完整阶段分析优先传 `promptScope: "full"`。
5. 用户问单件事情当前能否推进、对方态度、短期成败或应期，优先调用 `liuyao_prompt`；涉及项目路径、方位、谈判、出行和时空窗口时，优先调用 `qimen_prompt`。用户提供出生时刻并询问人生阶段、终身格局或指定年份动态时，调用 `qimen_lifetime_prompt`，不要用普通时局工具代替。
6. 用户要从日期范围里选日子，调用 `almanac_prompt`；日期范围或参与人较多时使用分页参数。
7. 用户提供一人的西方占星资料时调用 `astrolabe_prompt`；提供双方完整资料并询问关系时调用 `astrolabe_synastry_prompt`。
8. 用户没有出生信息，只想要轻量启发、牌阵或签文时，用 `tarot_prompt`、`lenormand_prompt` 或 `ssgw_prompt`。
9. 用户明确要求八宅、生肖犯太岁、太乙、五运六气、皇极经世或七政四余时，使用对应的 `*_prompt` 工具；只要原始排盘则使用 `metaphysics_*`。
10. 用户明确给出本卦和之卦、要求查《焦氏易林》原文时，调用 `classics_yilin_query`；这是固定文献索引查询，不承担起卦、随机取卦或替用户判断卦象。

常见问题到工具：

| 用户问题类型                     | 首选工具                       | 推荐参数                                                                 |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| 现在起盘、即时盘、紫占           | `instant_chart`                | `type`、`timeStandard`、真太阳时或星盘类再传 `observer`                  |
| 整体人生、长期事业、财运、婚恋   | `bazi_ziwei_prompt`            | `baziPromptTopic`、`ziweiPromptTopic`、`promptScope: "full"` 或 `origin` |
| 大类主题咨询（感情/事业/财运等） | `thematic_consultation_prompt` | `topic`（默认 general）、`system`（默认 bazi_ziwei）、`question`         |
| 今年运势、当前阶段、某年趋势     | `bazi_ziwei_prompt`            | `promptScope: "yearly"`，主题按事业、财运、感情等选择                    |
| 换工作、创业、合伙、投资         | `bazi_ziwei_prompt`            | `job-change`、`startup-partnership`、`investment-partnership`            |
| 八字格局、用神、大运流年         | `bazi_prompt`                  | `promptTopic`、`baziFortuneScope`                                        |
| 紫微宫位、四化、运限             | `ziwei_prompt`                 | `promptTopic`、`promptScope`                                             |
| 一事一问、短期成败、应期         | `liuyao_prompt`                | `question`、可选 `customDate`                                            |
| 项目推进、方向、方位、谈判       | `qimen_prompt`                 | `question`、可选 `qimenMethod`、`customDate`                             |
| 奇门终身格局、阶段运限、指定年份   | `qimen_lifetime_prompt`        | `birthDateTime`、`timeZoneId`，可选 `timeStandard`、`location`、`periodRange`、`topics`、`question` |
| 临时小事快速判断                 | `xiaoliuren_prompt`            | `question`、可选 `customDate`                                            |
| 金口诀四位课                     | `jinkoujue_prompt`             | `question`、可选 `jinkoujueMethod`、`jinkoujueBranch`、`customDate`      |
| 生肖犯太岁、流年贵人             | `zodiac_prompt`                | `zodiac`、`year` 或 `yearGanZhi`                                         |
| 时间、数字、声音、字数或方位象意判断 | `meihua_prompt`             | `question`、可选 `method`、`number`、`soundCount`、`characterText`、`characterStrokeCounts`、`characterTones`、`direction`、`objectType`、`customDate` |
| 传统复杂事项推演                 | `liuren_prompt`                | `question`、可选 `liurenTemplate`、`customDate`                          |
| 结婚、搬家、开业、签约、安葬择日 | `almanac_prompt`               | `topic`、`startDate`、`endDate`、可选 `participants`、`page`、`pageSize` |
| 星盘本命和行运                   | `astrolabe_prompt`             | 出生时间地点、经纬度、`astrolabeTopic`、`astrolabeScope`                 |
| 西占双方关系、合作或婚恋互动     | `astrolabe_synastry_prompt`    | `person1`、`person2` 分别提供完整出生时间、经纬度和时区                  |
| 牌阵启发                         | `tarot_prompt`                 | `spreadType`、`question`                                                 |
| 雷诺曼关系或选择牌阵             | `lenormand_prompt`             | `spreadType`、`question`                                                 |
| 求签                             | `ssgw_prompt`                  | `question`                                                               |
| 年度气候节律、司天在泉           | `wuyun_liuqi_prompt`           | `year` 或 `yearGanZhi`、`question`                                      |
| 皇极经世宏观周期、值年卦          | `huangji_jingshi_prompt`       | `customDate` 或 `year` / `epochYear` / `elapsedYears`、`question`        |

出生时辰未知时，不要自行补时辰。八字可以保守分析；紫微和八字紫微合参需要时辰，优先请用户补足后再调用。

## 快速开始

### 方式一：连接在线 Remote MCP（最简单，免安装直接接入）

命语官方在 `aov.cc` 部署了全球 CDN 边缘加速的在线 MCP 服务，支持 **Streamable HTTP** 规范：

- **远程端点 URL**：`https://aov.cc/mcp`

在支持 Remote MCP 的客户端中直接配置（如 Cursor、Windsurf、Claude Desktop 等）：

```json
{
  "mcpServers": {
    "mingyu": {
      "url": "https://aov.cc/mcp"
    }
  }
}
```

---

### 方式二：使用 npx 开箱即用（推荐本地运行，无需克隆仓库）

无需克隆代码、无需配置任何工程依赖，在终端中直接运行：

```bash
npx -y mingyu-mcp
```

在 Claude Desktop 的配置文件（`claude_desktop_config.json`）中直接添加：

```json
{
  "mcpServers": {
    "mingyu": {
      "command": "npx",
      "args": ["-y", "mingyu-mcp"]
    }
  }
}
```

> **Windows 提示**：若某些系统环境无法直接解析 `npx`，可将 `"command"` 设为 `"npx.cmd"`。

---

### 方式三：从源码仓库运行（面向开发者与贡献者）

如果你克隆了源码仓库进行二次开发或调试：

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
corepack enable
pnpm install --frozen-lockfile
pnpm --filter mingyu-core build
pnpm mcp
```

在 Claude Desktop 中配置源码运行：

```json
{
  "mcpServers": {
    "mingyu": {
      "command": "pnpm.cmd",
      "args": ["mcp"],
      "cwd": "C:\\path\\to\\mingyu"
    }
  }
}
```

> **说明**：macOS / Linux 用户请将 `"command"` 设为 `"pnpm"`；`cwd` 填入你本地克隆目录的绝对路径。

### 重启 Claude Desktop

配置完成后重启客户端，在对话中即可看到命语提供的 25+ 门命理排盘与提示词工具图标。

## 使用示例

在 Claude Desktop 中直接说：

- "帮我排一下 1990 年 5 月 15 日丑时出生的八字"
- "用八字提示词工具，问我适合创业还是上班"
- "用八字盲派流派解读 1990 年 5 月 15 日丑时八字的事业运"
- "用紫微飞星派解读 1992 年 8 月 21 日辰时女性的 2025 年事业财运"
- "用八字紫微合参看 1992 年 8 月 21 日辰时女性现在适不适合换工作"
- "用紫微斗数排盘看 1992 年 8 月 21 日辰时女性的命盘"
- "用六爻提示词工具起一卦，问今年事业运势如何"
- "抽一张塔罗牌并生成提示词，看看我近期的感情走向"
- "用奇门遁甲提示词工具排个盘，问这次投资能不能成"
- "用奇门飞盘法排盘，问这个项目的方向"
- "用 2025-01-01 08:30 北京时间排奇门盘，问这个项目现在适不适合推进"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合签约"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合安葬"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合修造动土"
- "用黄历择日工具看看 2026-06-01 到 2026-06-05 哪天适合修造动土"
- "用星盘提示词工具，按北京出生经纬度看我的事业发展"

只需要结构化数据时调用 `*_calculate` 或 `divine_*` 工具；需要完整 AI 解读提示词时调用 `*_prompt` 工具。

### 出生时间参数

八字和紫微工具默认使用 `timeIndex` 表示出生时辰，范围为 `0` 到 `12`，其中 `0` 为早子时，`12` 为晚子时。

需要启用真太阳时校正时，传入 `useTrueSolarTime: true`，并提供 `birthHour`、`birthMinute`、`birthLongitude`；此时可以不传 `timeIndex`，工具会按校正后的真太阳时自动换算唯一时辰，并返回结构化计算步骤、校正事实、证据汇总和限制。关闭真太阳时时仍可直接传入明确的 `timeIndex`，按传统时辰生成完整时柱。八字工具的精准时间和经度使用数字，紫微工具与公开 API 保持一致，使用字符串。

### 八字命限提示词参数

`bazi_prompt` 未指定 `baziFortuneScope` 时默认定位当前大运，并写入该阶段的交运边界与流年列表；如果当前日期无法落入有效运段，才退回本命。也可通过 `baziFortuneScope` 指定 `natal`（本命）、`full`（全部大运流年）、`dayun`（大运）、`year`（流年，含全年流月）、`month`（流月，含流日）、`day`（流日）。显式选择具体层级时仍需传对应的年限参数；`full` 不需要再传具体年限参数。

显式选择 `dayun` 时必须传 `baziFortuneCycleIndex`。显式选择 `year`、`month`、`day` 时必须依次传入对应层级的 `baziFortuneYear`、`baziFortuneMonth`、`baziFortuneDay`；交运年份可同时传 `baziFortuneCycleIndex` 消除前后两步大运重叠歧义。工具不会静默套用第一项。

### 星盘行运提示词参数

`astrolabe_prompt` 未指定 `astrolabeScope` 时默认使用当前年度 `yearly` 行运，并按项目统一时区生成当前年份；需要固定回归日期时传入 `astrolabeScope: "yearly"` 和 `astrolabeScopeDate: "YYYY"`。显式指定 `yearly`、`monthly`、`daily` 范围时分别要求 `YYYY`、`YYYY-MM`、`YYYY-MM-DD` 格式的 `astrolabeScopeDate`。`full` 也必须传 `YYYY-MM-DD` 基准日，用于生成同一基准下的本命、流年、流月和流日资料；它覆盖一个参考日的四层资料，不表示全生命周期。

玄空与住宅工具支持 `guaType: 下卦 | 替卦`，默认下卦。实测坐向稳定落在每山中央九度之外、两侧各三度兼向范围时可选替卦；后续流运补算保留同一起法。

### 住宅风水流运提示词参数

`residential_prompt` 与 `metaphysics_residential` 先锁定住宅主体资料：`year` 为建造或起运年，出生资料、命卦、山向、实测度数、北向基准、磁偏角和测量误差用于形成同一住宅盘。可选 `flowYear` 叠加目标流年飞星；再传 `flowMonth` 和 `flowDay` 时按目标日期所属节气月生成流月飞星。未传目标流运字段时只返回宅盘与八宅人宅资料，不把静态宅盘称作流运。

### 起卦与排盘时间参数

六爻、梅花易数、小六壬、金口诀、奇门遁甲、大六壬以及太乙月、日、时计默认使用当前时间。需要复盘历史时刻、按用户指定时间起卦，或让本地 MCP 与网页端自定时间保持一致时，传入 `customDate`。皇极经世可用 `customDate` 固定年月日时，五运六气应明确目标 `year` 或 `yearGanZhi`；这些资料按目标时点或年度解读，不作为出生本命。金口诀还可用 `jinkoujueMethod: "branch"` 与 `jinkoujueBranch` 直接指定地分。

`customDate` 必须是带时区的 ISO 8601 时间字符串，例如 `2025-01-01T08:30:00+08:00`。适用工具包括 `divine_liuyao`、`liuyao_prompt`、`divine_meihua`、`meihua_prompt`、`divine_xiaoliuren`、`xiaoliuren_prompt`、`divine_jinkoujue`、`jinkoujue_prompt`、`divine_qimen`、`qimen_prompt`、`divine_liuren`、`liuren_prompt`、`metaphysics_taiyi`、`taiyi_prompt`、`metaphysics_huangji_jingshi` 和 `huangji_jingshi_prompt`。

### 黄历择日参数

黄历择日工具需要提供 `startDate`、`endDate`。日期使用 `YYYY-MM-DD` 格式，一次最多比较 31 天。`topic` 可选，支持 `marriage`（订婚结婚）、`move`（搬家入宅）、`opening`（开业启动）、`contract`（签约合作）、`travel`（出行赴任）、`medical`（就医手术）、`study`（考试学习）、`burial`（安葬修坟）、`renovation`（修造动土）、`custom`（自定义），不传时使用 `custom`。`participants` 可选，每个参与人包含 `id`、`name`、`gender`、`year`、`month`、`day`、`timeIndex`、`dateType`、`isLeapMonth`。

### 奇门遁甲排盘方法

奇门遁甲工具支持 `qimenMethod` 参数：`zhuanpan`（转盘法，默认）或 `feipan`（飞盘法）；`qimenScope` 可选 `hour`（时家，默认）、`day`、`month`、`year`；`qimenJuMethod` 可选 `chaibu`（拆补，默认）或 `zhirun`（置闰），后者只对时家、日家生效。
返回结果会包含 `timeInfo`（正式定局节气与三元）、`seasonality`（实际节气、节气五行、月相、建除十二神、四柱干支互动）和 `patternCombos`（吉凶叠加、吉格逢空、伏吟反吟叠马星等复合格局），提示词工具会把这些字段作为解读证据。

奇门终身局工具必须提供 `birthDateTime`；出生时间按 `timeZoneId` 或固定 `timezone` 解析，`timeStandard: "trueSolar"` 时还必须提供 `location.longitude`。`periodRange` 使用有效的 `startDate`、`endDate`（`YYYY-MM-DD`）指定动态流年区间，最多连续31个年份；`topics` 可限定事业、财运、婚姻、健康、学业、迁居、家庭、子女或合作主题；终身局工具返回出生主体、阶段卡和该区间实际生成的动态事件簇。

### 解读口径与合参

只对规划内确有合理差异的提示词工具提供 `schools`，可传一至三个值。传一个值时按该流派、断法或侧重解读；传两个或三个值时，提示词会要求分别判断，再归纳共同结论、分歧及各自盘面依据，最后形成综合判断。同属流派时称“多派合参”，同属断法时称“多法合参”，混合类型时称“多口径合参”。八字、紫微、住宅风水属于真实流派选择；塔罗、黄历择日、星盘和七政四余同时包含流派与断法；其余登记项属于不同断法，不称作不同派系。八字和紫微原有 `school` 参数继续兼容；同时传入时以 `schools` 为准。八字紫微合参分别使用 `baziSchools`、`ziweiSchools`。

| 术数           | `schools` 可选值                                            |
| -------------- | ----------------------------------------------------------- |
| 八字           | `ziping`、`mangpai`、`xinpai`；单派兼容值另有 `traditional` |
| 紫微           | `sanhe`、`feixing`、`sihua`                                 |
| 六爻           | `huozhulin`、`bushizhengzong`、`zengshanbuyi`               |
| 梅花           | `tiyong`、`xiangshu`、`yaoci`                               |
| 小六壬         | `shunshu`、`gongjue`                                        |
| 金口诀         | `siwei`、`fayong`、`wudong`                                 |
| 奇门           | `gongwei`、`geju`、`zhuke`                                  |
| 大六壬         | `keti`、`bifafu`、`leishen`                                 |
| 塔罗           | `rws`、`yuansu`、`narrative`                                |
| 雷诺曼         | `combination`、`eventline`、`significator`                  |
| 黄历择日       | `xieji`、`jianchu`、`comprehensive`                         |
| 星盘及西占双盘 | `modern`、`traditional`、`timing`                           |
| 太乙           | `zhuke`、`gongwei`                                          |
| 八宅           | `dayounian`、`mingzhai`                                     |
| 住宅风水       | `bazhai`、`xuankong`                                        |
| 玄空           | `sanYuan`、`shanxiang`                                      |
| 七政四余       | `guolao`、`wuxingjingyi`                                    |
| 生肖           | `ganzhi`、`sanhe`                                           |
| 五运六气       | `yunqi`、`sitian`、`kezhu`                                  |
| 皇极经世       | `yuanhui`、`guaqi`                                          |

奇门的 `qimenMethod`、`qimenJuMethod` 和范围参数决定实际排盘，`schools` 只决定如何解读既有盘面。紫微 `algorithm` 同理决定底层安星口径。三山国王灵签提示词只保留本次签谱资料，不附加派系段落，也不接受 `schools`。

紫微格局当前评估 55 条可复算规则的命中结果，每条包含《紫微斗数全书》固定版本、卷次、原文、盘面条件与解释边界；另登记 32 项因原文含糊或依赖运限而不能唯一复算的边界。原 84 条未校勘项目规则继续停用；空列表只表示当前可复算规则未命中，不表示命盘没有其他传统格局。十二宫、星曜、四化、三方四正和运限继续正常返回。

### 紫微 promptScope 参数

`ziwei_calculate` 和 `ziwei_prompt` 未指定范围时默认返回当前大限，并携带本命范围作为基础资料。传入 `promptScope` 时会返回 `origin` 加指定范围。支持的值：`origin`、`full`、`decadal`、`yearly`、`monthly`、`daily`、`hourly`、`age`。`scopeDate` 可固定运限目标日期，保证当前阶段、指定流年和下层层级在不同入口使用同一时点。`full` 会沿已验证的童限与大限时间线返回实际覆盖的全部流年；当前阶段返回所属大限的完整流年，并为目标流年附带十二个真实流月边界；`yearly`、`monthly`、`daily`、`hourly` 返回目标流年的父级大限、对应流年及目标日期可用的下层资料。

`ziwei_compatibility` 和 `ziwei_compatibility_prompt` 只计算双方静态本命盘的宫位叠盘与生年四化跨盘落点。它们不会伪造具体年份应期，也不会输出缺乏统一依据的匹配总分。

### 星盘参数

星盘工具需要提供 `year`、`month`、`day`、`hour`、`minute`、`latitude`、`longitude`，并至少提供 `timezone` 或 `timeZoneId`。国际地点及历史日期推荐传 IANA 时区（如 `Asia/Shanghai`、`America/New_York`），以识别历史夏令时、回拨歧义和跳时缺口；同时传固定偏移时，它只用于回拨消歧和一致性核验。未消歧回拨、跳时缺口和固定偏移冲突都会拒绝计算。`gender` 使用 `男`、`女` 或空字符串，`locationName` 可选；可传 `useTrueSolarTime` 附带真太阳时参考证据，但现代星历仍采用民用出生时间对应的真实 UTC 瞬间。

西占双盘工具使用 `person1`、`person2` 分别传入上述星盘参数。结果中的跨盘相位、实际夹角、精确角、偏差、允许容许度、紧密等级和落宫属于可复核盘面事实；结果不返回百分制相位强度，避免被误读为关系概率、匹配率或吉凶百分比，也禁止把单一相位写成必然结果。

## 在其他 MCP 客户端中使用

任何支持 MCP 协议的客户端都可以使用，如 Cursor、Cline、Windsurf 等。

- **推荐方式（npx）**：指定命令为 `npx`，参数为 `["-y", "mingyu-mcp"]` 即可，无需指定工作目录。
- **源码开发方式**：Windows 指定 `pnpm.cmd`，macOS/Linux 指定 `pnpm`，参数为 `["mcp"]`，工作目录填入仓库根目录。

## 工作原理

MCP Server 通过 stdio transport 与 AI 客户端通信：

1. AI 客户端启动 `npx -y mingyu-mcp`（或本地 `pnpm mcp`）
2. MCP Server 注册排盘 tool 和一站式提示词 tool
3. AI 根据对话内容决定调用哪个 tool
4. MCP Server 执行排盘引擎，返回结构化 JSON 数据
5. 使用提示词 tool 时，MCP Server 同时返回排盘结果和结构化 AI 提示词

无需网络端口、无需额外配置，开箱即用。
