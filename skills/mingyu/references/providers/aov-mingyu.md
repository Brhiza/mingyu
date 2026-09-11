# AOV / Mingyu 数据提供方适配实现指南（AOV & Mingyu Provider Reference）

本文档为 AOV 命理公开 API 与 Mingyu MCP Server 的具体端点、工具与参数映射参考。上层算命通用 Skill 通过本文档与具体服务对接。当更换为人工录入盘面或未来其他排盘器时，上层工作流不受影响。

---

## 一、基础服务地址与响应格式

- **官方公开 API**：`https://aov.cc/api/v1`
- **AOV REST 响应封装**：成功响应使用 `{ "ok": true, "data": {}, "meta": {} }`；接口结果在 `data` 中读取。
- **OpenAPI 发现**：`GET /openapi.json` 返回的 JSON 也使用 `data` 包装层，端点正文位于 `spec["data"]["paths"]`；不要从顶层 `spec["paths"]` 读取。
- **实际出生接口**：八字排盘使用 `POST /bazi/calculate`，出生真太阳时换算使用 `POST /calendar/true-solar-birth`；`/calendar/true-solar-time` 仅用于一般当地钟表时间换算。
- **Remote MCP 服务地址（支持 CORS）**：
  - **Streamable HTTP 端点**：`https://aov.cc/mcp`（或本地 `http://localhost:3000/mcp`）
  - **自部署 CLI 的 SSE 端点**：`http://localhost:3000/sse`（消息投递：`/message`）；线上 `/sse` 返回迁移说明，线上连接使用 `/mcp`。
  - **本地 STDIO 启动**：`npx mingyu-mcp` 或 `pnpm mcp`
- **MCP 成功响应与 Envelope 契约**：
  ```json
  {
    "result": {},
    "meta": { "tool": "bazi_calculate", "durationMs": 12, "system": "mingyu-mcp" },
    "warnings": ["缺时辰已安全启用三柱降级分析"]
  }
  ```
- **MCP 结构化业务错误响应**：
  ```json
  {
    "error": "缺少必要出生时辰",
    "code": "MISSING_BIRTH_TIME",
    "missingFields": ["timeIndex"],
    "retryable": true,
    "fallback": "可选择三柱降级模式仅排年月日三柱"
  }
  ```

---

## 二、API 与 MCP 工具全量映射速查表

| 功能领域           | REST API 端点（相对 `/api/v1`）               | MCP Tool 名称                  | 核心功能与关键参数建议                                                                                                                 |
| :----------------- | :-------------------------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| 公共地基能力目录   | `GET /foundation/capabilities`                | `foundation_capabilities`      | 获取公共地基能力目录，返回历法、干支、五行、方位与通用神煞的稳定能力事实                                                               |
| 六十甲子干支属性   | `POST /foundation/ganzhi`                     | `foundation_ganzhi`            | 查询单个六十甲子的序号、纳音、五行、阴阳、藏干与合冲刑害破                                                                             |
| 五行力量与生克     | `POST /foundation/wuxing`                     | `foundation_wuxing`            | 分析干支列表的五行统计、藏干权重与主导五行生克                                                                                         |
| 二十四山与罗盘方位 | `POST /foundation/direction`                  | `foundation_direction`         | 按罗盘角度查询所属八卦、二十四山、天心十道对冲山与四正四隅属性                                                                         |
| 通用传统神煞       | `POST /foundation/shensha`                    | `foundation_shensha`           | 按八字默认口径核验四柱干支的空亡、驿马与桃花传统神煞                                                                                   |
| 真太阳时校正       | `POST /calendar/true-solar-time`              | `calendar_true_solar_time`     | 根据地理经度与平太阳时换算真太阳时与均时差                                                                                             |
| 统一出生真太阳时   | `POST /calendar/true-solar-birth`             | `calendar_true_solar_birth`    | 根据出生公历或农历及经度时区计算校正后的公历与农历时间                                                                                 |
| 太阳光照与出没     | `POST /calendar/solar-illumination`           | `calendar_solar_illumination`  | 计算指定日期的日出日落时刻、地平高度与曙暮光证据                                                                                       |
| 天文时间尺度       | `POST /calendar/astronomical-time`            | `calendar_astronomical_time`   | 计算儒略日、近似 UT1、ΔT 与近似 TT 证据                                                                                                |
| 月相证据           | `POST /calendar/moon-phase`                   | `calendar_moon_phase`          | 计算月相角、照明比例与朔弦望事件                                                                                                       |
| 二十四节气         | `POST /calendar/solar-term`                   | `calendar_solar_term`          | 计算节气历表时刻、太阳黄经度数与独立求根核验                                                                                           |
| 即时排盘           | `POST /instant/calculate`                     | `instant_chart`                | 按当前时刻即时排八字、紫微、合参、星盘或七政盘，无需性别与个人字段                                                                     |
| 中文起名           | `POST /name/generate`                         | `name_generate`                | 结合出生资料、偏好字、忌用字与辈分字生成姓名候选                                                                                       |
| 姓名解析           | `POST /name/analyze`                          | `name_analyze`                 | 解析姓名康熙笔画、五格数理、三才配置与五行分布                                                                                         |
| 中文起名提示词     | `POST /name/generate/prompt`                  | `name_generate_prompt`         | 结合出生资料、用字条件、适配字池和候选样本生成完整起名提示词；支持统一主题、主题细项和分析范围选择                                     |
| 姓名解析提示词     | `POST /name/analyze/prompt`                   | `name_analyze_prompt`          | 结合出生资料和姓名底稿生成完整姓名解析提示词；支持统一主题、主题细项和分析范围选择                                                     |
| 汉字解析           | `POST /character/analyze`                     | `character_analyze`            | 查询汉字康熙笔画、现代笔画、五行、部首、拼音与繁简对应                                                                                 |
| 起名选字           | `POST /character/select`                      | `character_select`             | 按康熙笔画、五行、拼音和常用字条件筛选汉字                                                                                             |
| 数字能量           | `POST /number/analyze`                        | `number_analyze`               | 解析数字与字母编号的八星磁场、相邻组合以及0和5的作用                                                                                   |
| 数字能量提示词     | `POST /number/analyze/prompt`                 | `number_energy_prompt`         | 解析八星数字能量并生成可直接交给 AI 的完整提示词；支持统一主题、主题细项和分析范围选择                                                 |
| 诸葛神数           | `POST /divination/zhuge`                      | `divine_zhuge`                 | 按三个汉字康熙笔画尾数计算诸葛神数384签                                                                                                |
| 孔明神卦           | `POST /divination/kongming`                   | `divine_kongming`              | 按五枚硬币的阴阳结果生成三十二种孔明神卦之一                                                                                           |
| 八字排盘           | `POST /bazi/calculate`                        | `bazi_calculate`               | 计算四柱干支、十神、藏干、大运、流年、胎元命宫身宫与神煞（支持缺时辰三柱降级）                                                         |
| 八字解读提示词     | `POST /bazi/prompt`                           | `bazi_prompt`                  | 未指定范围时默认当前大运；指定流年会同时带所属大运、全年流月与节气边界，指定流月会带流日，`full` 返回全部大运流年                      |
| 八字双盘合婚       | `POST /bazi/compatibility`                    | `bazi_compatibility`           | 计算两人八字日主五行喜忌互补、四柱干支合冲与夫妻宫德合刑冲                                                                             |
| 八字合盘提示词     | `POST /bazi/compatibility/prompt`             | `bazi_compatibility_prompt`    | 生成八字双盘合婚与合伙关系的自包含深度提示词；支持统一主题、主题细项和分析范围选择                                                     |
| 紫微斗数排盘       | `POST /ziwei/calculate`                       | `ziwei_calculate`              | 计算紫微斗数十二宫星曜、生年四化、大限流年与三方四正格局                                                                               |
| 紫微解读提示词     | `POST /ziwei/prompt`                          | `ziwei_prompt`                 | 未指定范围时默认当前大限；可按流年、流月、流日、流时或 `full` 返回对应上下层运限资料                                                   |
| 紫微合盘           | `POST /ziwei/compatibility`                   | `ziwei_compatibility`          | 计算双方关键宫位叠盘、生年四化跨盘落宫与星曜交感                                                                                       |
| 紫微合盘提示词     | `POST /ziwei/compatibility/prompt`            | `ziwei_compatibility_prompt`   | 生成紫微合盘结构化证据与关系推演提示词；支持统一主题、主题细项和分析范围选择                                                           |
| 八字紫微合参提示词 | `POST /bazi-ziwei/prompt`                     | `bazi_ziwei_prompt`            | 默认按当前阶段对齐八字大运与紫微大限；流年及以下层级同步携带八字所属上层岁运与紫微运限，`full` 返回两套完整时间资料                    |
| 大类主题咨询提示词 | `POST /consultation/thematic/prompt`          | `thematic_consultation_prompt` | 按通用、感情、事业、财运、健康、家庭、学业、时机等大类自动提取八字与紫微核心要素生成自包含任务书；支持统一主题、主题细项和分析范围选择 |
| 六爻排盘           | `POST /divination/liuyao`                     | `divine_liuyao`                | 六爻纳甲起卦、世应动变、六亲六神与生克冲合                                                                                             |
| 六爻提示词         | `POST /divination/liuyao/prompt`              | `liuyao_prompt`                | 生成六爻卦象用神旺衰与动态演变的自包含提示词；支持统一主题、主题细项和分析范围选择                                                     |
| 梅花易数排盘       | `POST /divination/meihua`                     | `divine_meihua`                | 梅花易数体用互变卦象与五行生克                                                                                                         |
| 梅花易数提示词     | `POST /divination/meihua/prompt`              | `meihua_prompt`                | 生成梅花易数主互变卦象推进与体用生克的自包含提示词；支持统一主题、主题细项和分析范围选择                                               |

梅花 `method` 支持 `time`、`number`、`sound`、`character`、`direction`、`random`、`timeTrigram`；声音使用 `soundCount`，字数按分段规则传参：单字传左右分笔数，2—3 字传 `characterStrokeCounts` 逐字笔画数，4—10 字必须传 `characterTones` 的传统平、上、去、入声类 1—4 数（不等同于普通话一至四声），11—100 字只传文字或字符数，方位取象使用 `objectType` 与 `direction`。
| 小六壬排盘         | `POST /divination/xiaoliuren`                 | `divine_xiaoliuren`            | 小六壬月日时顺数初宫二宫三宫流转与时宫定局                                                                                             |
| 小六壬提示词       | `POST /divination/xiaoliuren/prompt`          | `xiaoliuren_prompt`            | 生成小六壬三宫推移与速断决策自包含提示词；支持统一主题、主题细项和分析范围选择                                                         |
| 金口诀排盘         | `POST /divination/jinkoujue`                  | `divine_jinkoujue`             | 大六壬金口诀人元、贵神、将神、地分四位课盘                                                                                             |
| 金口诀提示词       | `POST /divination/jinkoujue/prompt`           | `jinkoujue_prompt`             | 生成金口诀四位发用与生克主客提示词；支持统一主题、主题细项和分析范围选择                                                               |
| 奇门遁甲时局排盘   | `POST /divination/qimen`                      | `divine_qimen`                 | 时家奇门九星、九宫、八门、八神与三奇六仪盘面                                                                                           |
| 奇门遁甲提示词     | `POST /divination/qimen/prompt`               | `qimen_prompt`                 | 生成奇门时空方位与动静主客策略自包含提示词；支持统一主题、主题细项和分析范围选择                                                       |
| 奇门终身局排盘     | `POST /divination/qimen/lifetime`             | `divine_qimen_lifetime`        | 根据出生时刻与时区排布终身本命盘，提取阶段卡和目标区间动态事件                                                                         |
| 奇门终身局提示词   | `POST /divination/qimen/lifetime/prompt`      | `qimen_lifetime_prompt`        | 生成奇门终身局长远运势与阶段动态提示词；支持最多31年 `periodRange` 与 `topics`                                      |
| 大六壬排盘         | `POST /divination/liuren`                     | `divine_liuren`                | 大六壬天地盘、四课、三传九宗门与十二天将                                                                                               |
| 大六壬提示词       | `POST /divination/liuren/prompt`              | `liuren_prompt`                | 生成大六壬课体演化与人事博弈自包含提示词；支持统一主题、主题细项和分析范围选择                                                         |
| 塔罗抽牌排阵       | `POST /divination/tarot`                      | `divine_tarot`                 | 78张塔罗牌多牌阵抽取、正逆位与牌位结构化证据                                                                                           |
| 塔罗提示词         | `POST /divination/tarot/prompt`               | `tarot_prompt`                 | 生成塔罗牌阵位置脉络与象征启发的自包含提示词；支持统一主题、主题细项和分析范围选择                                                     |
| 雷诺曼抽牌排阵     | `POST /divination/lenormand`                  | `divine_lenormand`             | 36张雷诺曼牌阵抽取、核心十字与相邻组合合读                                                                                             |
| 雷诺曼提示词       | `POST /divination/lenormand/prompt`           | `lenormand_prompt`             | 生成雷诺曼牌位关系与日常符码解读提示词；支持统一主题、主题细项和分析范围选择                                                           |
| 三山国王灵签抽签   | `POST /divination/ssgw`                       | `divine_ssgw`                  | 纯正民间签谱抽取，返回签号、签题、签诗与历史典故                                                                                       |
| 三山国王灵签提示词 | `POST /divination/ssgw/prompt`                | `ssgw_prompt`                  | 生成只含签诗典故与修身启迪的纯净自包含提示词                                                                                           |
| 黄历择日排盘       | `POST /divination/almanac`                    | `divine_almanac`               | 建除十二神、丛辰神煞与多参与人四柱冲煞择吉                                                                                             |
| 黄历择日提示词     | `POST /divination/almanac/prompt`             | `almanac_prompt`               | 生成候选日期优选分析与自包含择日决策提示词；支持统一主题、主题细项和分析范围选择                                                       |
| 西洋星盘排盘       | `POST /divination/astrolabe`                  | `divine_astrolabe`             | 本命星体黄道位置、宫位分界与相位交角                                                                                                   |
| 西洋星盘提示词     | `POST /divination/astrolabe/prompt`           | `astrolabe_prompt`             | 生成本命与行运过境解读自包含提示词；支持统一主题、主题细项和分析范围选择                                                               |
| 西占双盘比较盘     | `POST /divination/astrolabe/synastry`         | `astrolabe_synastry`           | 计算双人星盘跨盘相位、角距、落宫与互溶接纳                                                                                             |
| 西占双盘提示词     | `POST /divination/astrolabe/synastry/prompt`  | `astrolabe_synastry_prompt`    | 生成西占双人关系比较盘自包含提示词；支持统一主题、主题细项和分析范围选择                                                               |
| 八宅风水排盘       | `POST /metaphysics/bazhai/calculate`          | `metaphysics_bazhai`           | 居者生年命卦、宅卦大游年与门主灶九星相配                                                                                               |
| 八宅风水提示词     | `POST /metaphysics/bazhai/prompt`             | `bazhai_prompt`                | 生成八宅方位吉凶与布局调谐自包含提示词；支持统一主题、主题细项和分析范围选择                                                           |
| 玄空飞星排盘       | `POST /metaphysics/xuankong/calculate`        | `metaphysics_xuankong`         | 三元九运山向运星排盘、下卦或兼向替卦、反伏吟与城门诀计算；可按目标流年、流月日期叠加飞星                                                                                               |
| 玄空飞星提示词     | `POST /metaphysics/xuankong/prompt`           | `xuankong_prompt`              | 生成玄空飞星下卦或兼向替卦山向旺衰与城门气口自包含提示词；可按目标流年、流月日期携带飞星资料，支持统一主题、主题细项和分析范围选择                                                       |
| 住宅风水合参排盘   | `POST /metaphysics/residential/calculate`     | `metaphysics_residential`      | 综合八宅生年命卦与玄空飞星九运（下卦或兼向替卦）的住宅风水合参；可按目标流年、流月日期叠加飞星                                                                                           |
| 住宅风水合参提示词 | `POST /metaphysics/residential/prompt`        | `residential_prompt`           | 生成住宅风水八宅玄空（下卦或兼向替卦）综合评估自包含提示词；可按目标流年、流月日期携带飞星资料，支持统一主题、主题细项和分析范围选择                                                         |
| 生肖流年关系       | `POST /metaphysics/zodiac/calculate`          | `metaphysics_zodiac`           | 分析生肖与流年太岁刑冲克害破、三合六合关系                                                                                             |
| 生肖流年提示词     | `POST /metaphysics/zodiac/prompt`             | `zodiac_prompt`                | 生成生肖与岁星作用自包含提示词；支持统一主题、主题细项和分析范围选择                                                                   |
| 太乙神数式盘       | `POST /metaphysics/taiyi/calculate`           | `metaphysics_taiyi`            | 太乙神数年月日时四计七十二局式盘与主客和数算分析                                                                                       |
| 太乙神数提示词     | `POST /metaphysics/taiyi/prompt`              | `taiyi_prompt`                 | 生成太乙主客胜负定性与宏观时势自包含提示词；支持统一主题、主题细项和分析范围选择                                                       |
| 五运六气排盘       | `POST /metaphysics/wuyun-liuqi/calculate`     | `metaphysics_wuyun_liuqi`      | 年度五步主客运、司天在泉与天符岁会五类符会病机                                                                                         |
| 五运六气提示词     | `POST /metaphysics/wuyun-liuqi/prompt`        | `wuyun_liuqi_prompt`           | 生成年度气候节律与病机平气自包含提示词；支持统一主题、主题细项和分析范围选择                                                           |
| 皇极经世宏观周期   | `POST /metaphysics/huangji-jingshi/calculate` | `metaphysics_huangji_jingshi`  | 邵雍皇极经世元会运世、值年卦与运世消息推进                                                                                             |
| 皇极经世提示词     | `POST /metaphysics/huangji-jingshi/prompt`    | `huangji_jingshi_prompt`       | 生成皇极经世时代坐标与值年卦演变自包含提示词；支持统一主题、主题细项和分析范围选择                                                     |
| 焦氏易林固定索引   | `POST /classics/yilin`                        | `classics_yilin_query`         | 按固定 W20.03 版本查询 64×64 卦对原文，返回 Wikisource 四库全书本、Kanripo KR3g0029 WYG、来源定位和未决字形/校勘状态 |
| 皇极经世扩展资料表 | `POST /metaphysics/huangji-jingshi/references` | `huangji_reference_tables` | 查询声音律吕、动植物数与经辰历史纪年原表；历史表需传 `shiIndex` 2149-2208                                          |
| 七政四余排盘       | `POST /metaphysics/qizheng/calculate`         | `metaphysics_qizheng`          | 果老星宗七政十一星、二十八宿界、昼夜分金恩难与行限流曜                                                                                 |
| 七政四余提示词     | `POST /metaphysics/qizheng/prompt`            | `qizheng_prompt`               | 生成七政四余天星恩难自包含解读任务书；支持统一主题、主题细项和分析范围选择                                                             |

API 独立入口：`GET /health`、`GET /manifest`、`GET /openapi.json`；AI 问答使用 `POST /ai/analyze`，模型列表使用 `POST /ai/models`，通过 `aiConfig` 指定模型配置。完整参数以 OpenAPI 为准。AI 问答返回 `text/event-stream`。

焦氏易林固定索引只接受本卦 `baseHexagram`、之卦 `targetHexagram` 与可选 `source`（`wikisource`、`kanripo`、`both`）。它是固定文献查询，不承担起卦或随机取卦；返回结果会保留两个底本的原始标签、来源定位、原文标记和已核出的字形/校勘状态。缺字标记和未确认字形不以其他版本静默替换。

神煞口径：空亡取日柱与年柱旬空；驿马、桃花同时按年支与日支查，返回逐柱命中。

---

## 三、命理提示词的时限资料策略

命理类默认服务于“当前处境”，不要只返回孤立的本命盘。未指定范围时，八字取当前大运，紫微取当前大限；如果当前日期无法落入有效运段，才退回本命并明确说明原因。

太乙、皇极经世和五运六气属于目标时点或目标年度的占时资料，AI 补算时必须沿用本次会话的计式并明确传入目标年份或时刻；它们不作为出生本命资料处理。

- **西洋星盘单盘**：`astrolabe_prompt` 未指定 `astrolabeScope` 时默认当前年度 `yearly` 行运，并按当前参考日生成真实行运相位、周期事件及流年太阳返照、次限、太阳弧资料；显式传 `natal` 时只保留本命盘。`full` 需要传入 `astrolabeScopeDate`（YYYY-MM-DD），返回同一参考日的本命、流年、流月和流日四层资料，不表示全生命周期。
- **大运/大限**：返回实际起运或起限时间、交接边界，以及该阶段包含的流年列表。
- **流年**：八字返回所属大运、全年节气月及交节边界；紫微返回所属大限、流年四化与宫位、十二个常规流月及目标日所在流月。紫微流月按实际农历或节令分界生成，闰月归属沿用排盘结果。
- **流月**：八字携带所属大运、流年、节气月边界及当月流日窗口；紫微携带所属大限、流年与全年流月，明确标出目标日期所在流月。
- **流日/流时**：保留上层运限背景，并附目标日期或目标时辰的实际盘面。紫微通过 `scopeDate`（YYYY-MM-DD）与 `scopeHourIndex`（0=早子、1=丑、…、12=晚子）选择目标；省略时使用当前日期和时辰。出生 `timeIndex` 始终用于本命盘。
- **全部**：只有用户需要全景或比较多个阶段时使用，展开全部大运、流年及已计算的下层时间资料；普通问题优先使用当前阶段以保持提示词紧凑。

- **玄空起法**：玄空与住宅接口均接受 `guaType: 下卦 | 替卦`，默认下卦；实测坐向稳定落在每山中央九度之外、两侧各三度兼向范围时可选替卦。补算时保留同一起法，再叠加目标流年和流月。
- **住宅风水流运**：`residential_prompt` 锁定建造或起运年、出生资料、山向和测量口径；可传 `flowYear` 叠加流年飞星，再用 `flowMonth`、`flowDay` 按目标日期所属节气月生成流月飞星。未传流运字段时返回宅盘与八宅资料。

占卜类本身没有出生运限时，完整保留起卦时间、时区/真太阳时、月建日辰、旬空、动变、牌阵顺序或候选日期等实际时间证据，不用本命资料替代占问时点。

---

## 四、出生时间、时区与真太阳时参数

- `timezone` 表示固定 UTC 偏移，单位为小时，范围为 `-12` 到 `14`，支持 `5.5` 等小数；`timezone: 8` 表示 UTC+8，不是分钟偏移 `480`。
- `timeZoneId` 使用 IANA 时区标识（例如 `Asia/Shanghai` 或 `America/New_York`），优先用于需要按出生日期解析历史时区或夏令时的场景。
- `useTrueSolarTime: true` 用于八字或紫微真太阳时排盘。提供 `birthHour`、`birthMinute`、`birthLongitude` 后可省略 `timeIndex`，接口会自动推导真太阳时对应的时辰。
- `POST /calendar/true-solar-birth` 是出生资料专用的真太阳时换算接口；一般当地钟表时间换算使用 `POST /calendar/true-solar-time`。两个接口的结果都从 AOV REST 响应的 `data` 字段读取。
- `detailMode: "compact"` 适合常规调用和前端展示；八字排盘会保留逐柱神煞命中，省略神煞解释、完整证据链与计算过程。`detailMode: "full"` 返回神煞解释、完整证据链与计算过程，适合深度解读、核验或研究。

八字真太阳时排盘示例：

```bash
curl -X POST https://aov.cc/api/v1/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","year":1990,"month":6,"day":15,"dateType":"solar","useTrueSolarTime":true,"birthHour":14,"birthMinute":30,"birthPlace":"上海","birthLongitude":121.47,"timeZoneId":"Asia/Shanghai","shenShaScope":"all","detailMode":"full"}'
```

出生真太阳时换算示例：

```bash
curl -X POST https://aov.cc/api/v1/calendar/true-solar-birth \
  -H "Content-Type: application/json" \
  -d '{"dateType":"solar","year":1990,"month":6,"day":15,"hour":14,"minute":30,"longitude":121.47,"timeZoneId":"Asia/Shanghai"}'
```

---

## 五、牌阵与参数完整契约

- **塔罗牌阵 `spreadType` 支持全部 18 种**：
  `single`（单牌）、`three`（时间流）、`love`（爱情）、`career`（事业）、`decision`（选择）、`celtic`（凯尔特十字）、`chakra`（七脉轮）、`year`（年运）、`mindBodySpirit`（身心灵）、`horseshoe`（马蹄铁）、`holyTriangle`（圣三角）、`universal`（万能）、`fourElements`（四元素）、`hexagram`（六芒星）、`relationship`（关系）、`wealth`（财富）、`problemSolving`（问题解决）、`twelveHouses`（十二宫）。
- **雷诺曼牌阵 `spreadType` 支持全部 8 种**：
  `single`（单牌）、`three`（三牌）、`five`（五牌十字）、`relationship`（关系）、`decision`（选择）、`nine`（九宫）、`element`（元素牌阵）、`grandTableau`（大桌牌阵）。
- **金口诀取地分参数**：
  `jinkoujueMethod` 支持 `time`（时间）、`branch`（直接指定地分）、`number`（数字）、`random`（随机）。采用 `branch` 方式必须传 `jinkoujueBranch`，取子至亥之一；指定地分后仍按起课时间计算月将与日干。
- **五运六气与皇极经世输入口径规范**：
  - 五运六气使用 `year` 或 `yearGanZhi`；同时提供时会校验两者一致。`year` 按该公历年年中所属年柱换算。结果包含天符、岁会、太乙天符、同天符、同岁会逐项核验；吴谦《运气要诀》列出的五类符会逐年名单按六十甲子去重为 26 年，与原文“二十八年”汇总不一致；接口保留 `sourceReconciliation` 校勘说明，并以逐项定义为准。
  - 皇极经世提供 `customDate` 时，以北京时间和冬至换年定位皇极年，并在元会运世和值年卦之下继续推演月经卦、旬纬卦、日卦及时经卦，即 `customDate` 对应年月日时完整排盘。六日逐爻公历入口支持两种模型：`calendarModel=six-day-seven-part` 只需 `sixDayDateTime`，以现代冬至起点和实际岁周长度的比例定位六日七分；`calendarModel=six-day-explicit-epoch` 则必须另传经校定的 `sixDayEpochDateTime`（当地子半），按显式历元至目标当地日期的整数日差适配三百六十日正数。两种模型均须由时间字符串自带固定 UTC 偏移，或在未带偏移时提供 `timezone`/`timeZoneId`；响应保留模型来源、适用边界和传统六日七分依据，不能把现代比例定位解释为原典指定的唯一公历历元。
  - 年度研究提供公元 `year`，默认采用公元前 67017 年为本元起点、1984 年鼎卦为甲子值年锚点的通行排法，包含值年卦及互卦错卦综卦。
  - 研究自定义纪元时提供 `epochYear`，并从公元 `year` 与 `elapsedYears` 中选择一项；该模式保留纯元会运世坐标换算。

---

## 六、统一多流派合参参数 `schools` 边界

- **只对规划内确有合理差异的提示词接口提供 `schools` 数组**，一次选择一至三个流派、断法或解读侧重；两个或三个值会生成“分别判断—共同结论（共识）—分歧与盘面依据—综合判断”的任务。
- 各术数 `schools` 允许值：
  - 八字：`ziping`（子平派）、`mangpai`（盲派）、`xinpai`（新派），即 `ziping/mangpai/xinpai`；
  - 紫微：`sanhe`（三合派）、`feixing`（飞星派）、`sihua`（四化派），即 `sanhe/feixing/sihua`；
  - 六爻：`huozhulin`（火珠林）、`bushizhengzong`（卜筮正宗）、`zengshanbuyi`（增删卜易），即 `huozhulin/bushizhengzong/zengshanbuyi`；
  - 梅花易数：`tiyong`（体用）、`xiangshu`（象数）、`yaoci`（爻辞），即 `tiyong/xiangshu/yaoci`；
  - 小六壬：`shunshu`、`gongjue`，即 `shunshu/gongjue`；
  - 金口诀：`siwei`、`fayong`、`wudong`，即 `siwei/fayong/wudong`；
  - 奇门：`gongwei`、`geju`、`zhuke`，以及古籍流派 `baojian`、`tongzong`、`mingfa`、`yubo`；
  - 大六壬：`keti`、`bifafu`、`leishen`，即 `keti/bifafu/leishen`；
  - 塔罗：`rws`、`yuansu`、`narrative`，即 `rws/yuansu/narrative`；
  - 雷诺曼：`combination`、`eventline`、`significator`，即 `combination/eventline/significator`；
  - 黄历择日：`xieji`、`jianchu`、`comprehensive`，即 `xieji/jianchu/comprehensive`；
  - 星盘及西占双盘：`modern`、`traditional`、`timing`，即 `modern/traditional/timing`；
  - 太乙神数：`zhuke`、`gongwei`，即 `zhuke/gongwei`；
  - 八宅：`dayounian`、`mingzhai`，即 `dayounian/mingzhai`；
  - 住宅风水：`bazhai`、`xuankong`，即 `bazhai/xuankong`；
  - 玄空飞星：`sanYuan`、`shanxiang`，即 `sanYuan/shanxiang`；
  - 七政四余：`guolao`、`wuxingjingyi`，即 `guolao/wuxingjingyi`；
  - 生肖流年：`ganzhi`、`sanhe`，即 `ganzhi/sanhe`；
  - 五运六气：`yunqi`、`sitian`、`kezhu`，即 `yunqi/sitian/kezhu`；
  - 皇极经世：`yuanhui`、`guaqi`，即 `yuanhui/guaqi`。
  - 皇极经世资料表：`table` 取 `sound-rhythm`、`animal-plant` 或 `historical-era`；后者另传 `shiIndex`，结果保留固定卷页版本与原表标记。
- **流派与排盘口径界限**：
  - 奇门的转盘法与飞盘法属于实际排盘，`schools` 属于解读取向；紫微 `algorithm` 同理属于排盘口径。
  - **三山国王灵签提示词只列本次签谱资料，不附加派系段落，也不接受 `schools`**。

---

## 七、高效调用实践与轻量参数

1. **响应模式 `responseMode`**：
   - `prompt-only`：返回可直接交给 AI 的自包含完整任务书（`data.prompt`），适合直接解读；
   - 轻量摘要：`summary`。返回提示词及核心盘面摘要；
   - 完整原始数据：`full`。适合需要进一步核验盘面、补充证据、交互展示或导出原始数据的任务。
2. **排盘明细 `detailMode`**：
   - `compact`：在八字、紫微、奇门和黄历排盘中，过滤冗长计算步骤，仅保留核心盘面；八字仍保留逐柱神煞命中；
   - `full`：返回全量证据节点。
3. **服务异常与降级**：
   - HTTP成功响应上限为1MiB；`413 / RESPONSE_TOO_LARGE` 时，纯解读任务可使用 `responseMode: "prompt-only"`，需要完整结构化时限资料时可切换独立MCP。Pages的1102属于运行资源限制。保留原主体、主题与目标范围，分段获取后核对完整覆盖；
   - 当 API 返回 5xx、超时或网络中断时，保留用户输入并转由上层 Skill 执行人工盘面核验或基于已知柱位做保守分析；
   - 严禁将 HTTP 错误代码解释为命理吉凶。
