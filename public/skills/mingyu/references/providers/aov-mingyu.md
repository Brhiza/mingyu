# AOV / Mingyu 数据提供方适配实现指南（AOV & Mingyu Provider Reference）

本文档为 AOV 命理公开 API 与 Mingyu MCP Server 的具体端点、工具与参数映射参考。上层算命通用 Skill 通过本文档与具体服务对接。当更换为人工录入盘面或未来其他排盘器时，上层工作流不受影响。

---

## 一、基础服务地址与响应格式

- **官方公开 API**：`https://aov.cc/api/v1`
- **Remote MCP 服务地址（支持 CORS）**：
  - **Streamable HTTP 端点**：`https://aov.cc/mcp`（或本地 `http://localhost:3000/mcp`）
  - **SSE 通信端点**：`https://aov.cc/sse`（消息投递：`/message`）
  - **本地 STDIO 启动**：`npx mingyu-mcp` 或 `pnpm mcp`
- **统一成功响应与 Envelope 契约**：
  ```json
  {
    "result": {},
    "meta": { "tool": "bazi_calculate", "durationMs": 12, "system": "mingyu-mcp" },
    "warnings": ["缺时辰已安全启用三柱降级分析"]
  }
  ```
- **统一结构化业务错误响应**：
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

| 功能领域 | REST API 端点 (`POST /api/v1/...`) | MCP Tool 名称 | 核心功能与关键参数建议 |
| :--- | :--- | :--- | :--- |
| **基础与时间** | `/calendar/true-solar-time` | `calendar_true_solar_time` | 真太阳时校正，支持 `longitude`、`timeZoneId`、`applyChinaDst` |
| **统一出生时间**| `/calendar/true-solar-birth`| `calendar_true_solar_birth` | 统一处理公历/农历、时差与跨日时辰 |
| **天文时间尺度**| `/calendar/astronomical-time`| `calendar_astronomical_time` | 儒略日、近似 UT1、ΔT 与近似 TT 证据 |
| **月相证据** | `/calendar/moon-phase` | `calendar_moon_phase` | 月相角、照明比例、朔弦望事件 |
| **节气证据** | `/calendar/solar-term` | `calendar_solar_term` | 历表时刻、黄经度数与独立求根核验 |
| **地基能力** | `/foundation/capabilities` | `foundation_capabilities` | 历法干支五行方位常量目录 |
| **通用神煞** | `/foundation/shensha` | `foundation_shensha` | 严格核验四柱，返回空亡、驿马、桃花命中与来源 |
| **即时排盘** | `/instant/calculate` | `instant_chart` | 当刻排八字/紫微/合参/星盘/七政盘，无需性别 |
| **八字排盘** | `/bazi/calculate` | `bazi_calculate` | 四柱十神藏干大运神煞旺衰 |
| **八字提示词** | `/bazi/prompt` | `bazi_prompt` | `promptTopic`、`baziFortuneScope`、`schools` |
| **八字双盘** | `/bazi/compatibility` | `bazi_compatibility` | 双方日主十神交叉与喜忌互补 |
| **八字双盘提示词**| `/bazi/compatibility/prompt` | `bazi_compatibility_prompt`| 八字合盘自包含结构化证据提示词 |
| **紫微排盘** | `/ziwei/calculate` | `ziwei_calculate` | 十二宫星曜、生年四化、大限流年 |
| **紫微提示词** | `/ziwei/prompt` | `ziwei_prompt` | `promptTopic`、`promptScope`、`schools` |
| **紫微双盘** | `/ziwei/compatibility` | `ziwei_compatibility` | 关键宫位叠盘、生年四化跨盘落宫 |
| **紫微双盘提示词**| `/ziwei/compatibility/prompt` | `ziwei_compatibility_prompt`| 紫微双盘自包含结构化证据提示词 |
| **八字紫微合参** | `/bazi-ziwei/prompt` | `bazi_ziwei_prompt` | 同一出生资料，八字定主线，紫微校验运限 |
| **大类主题咨询** | `/consultation/thematic/prompt` | `thematic_consultation_prompt` | 8大类主题（感情、事业、财运等）自动提取盘面焦点要素生成自包含任务书 |
| **六爻起卦** | `/divination/liuyao` | `divine_liuyao` | 六爻排卦、世应动变、月日生克 |
| **六爻提示词** | `/divination/liuyao/prompt` | `liuyao_prompt` | 六爻自包含提示词，支持 `liuyaoTemplate` |
| **梅花易数** | `/divination/meihua` | `divine_meihua` | 体用互变卦象，支持时间/数字/随机起卦 |
| **梅花提示词** | `/divination/meihua/prompt` | `meihua_prompt` | 梅花易数体用生克推进提示词 |
| **小六壬** | `/divination/xiaoliuren` | `divine_xiaoliuren` | 月日时三宫顺数课，以时宫为主证 |
| **小六壬提示词** | `/divination/xiaoliuren/prompt` | `xiaoliuren_prompt` | 小六壬自包含提示词 |
| **金口诀** | `/divination/jinkoujue` | `divine_jinkoujue` | 人元贵神将神地分四位课盘 |
| **金口诀提示词** | `/divination/jinkoujue/prompt` | `jinkoujue_prompt` | 金口诀四位发用提示词，支持指定地分 |
| **奇门遁甲** | `/divination/qimen` | `divine_qimen` | 时/日/月/年家，转盘/飞盘，拆补/置闰 |
| **奇门提示词** | `/divination/qimen/prompt` | `qimen_prompt` | 奇门时空时局自包含提示词 |
| **奇门终身局** | `/divination/qimen/lifetime` | `qimen_lifetime` | 本命基础盘、个人标记、阶段卡与事件簇 |
| **奇门终身提示词**| `/divination/qimen/lifetime/prompt`| `qimen_lifetime_prompt`| 奇门终身局自包含解读提示词 |
| **大六壬** | `/divination/liuren` | `divine_liuren` | 四课三传、天地盘、十二天将 |
| **大六壬提示词** | `/divination/liuren/prompt` | `liuren_prompt` | 大六壬课体与三传推进提示词 |
| **塔罗抽牌** | `/divination/tarot` | `divine_tarot` | 78 张全牌，支持 18 种丰富牌阵 |
| **塔罗提示词** | `/divination/tarot/prompt` | `tarot_prompt` | 塔罗结构化牌位联动提示词 |
| **雷诺曼抽牌** | `/divination/lenormand` | `divine_lenormand` | 36 张日常符码，支持 8 种专业牌阵 |
| **雷诺曼提示词** | `/divination/lenormand/prompt` | `lenormand_prompt` | 雷诺曼相邻合读与指示牌提示词 |
| **三山国王灵签** | `/divination/ssgw` | `divine_ssgw` | 纯正民间签谱，签号、签题、签诗、典故 |
| **灵签提示词** | `/divination/ssgw/prompt` | `ssgw_prompt` | 纯净灵签任务书提示词，不加派系 |
| **黄历择日** | `/divination/almanac` | `divine_almanac` | 建除十二神、丛辰吉凶、多参与人冲煞 |
| **黄历提示词** | `/divination/almanac/prompt` | `almanac_prompt` | 黄历候选优选与自包含提示词，支持分页 |
| **西洋星盘** | `/divination/astrolabe` | `divine_astrolabe` | 本命星体、相位、分宫制，支持真太阳时 |
| **星盘提示词** | `/divination/astrolabe/prompt` | `astrolabe_prompt` | 本命与行运过境提示词，需指定行运日期 |
| **西占双盘** | `/divination/astrolabe/synastry`| `astrolabe_synastry` | 双方行星跨盘相位、角距、落宫 |
| **西占双盘提示词**| `/divination/astrolabe/synastry/prompt`| `astrolabe_synastry_prompt`| 西占关系合盘自包含提示词 |
| **八宅排盘** | `/metaphysics/bazhai/calculate`| `metaphysics_bazhai` | 命卦、宅卦、大游年、磁偏角与真北 |
| **八宅提示词** | `/metaphysics/bazhai/prompt` | `bazhai_prompt` | 八宅风水自包含解读提示词 |
| **住宅风水合参** | `/metaphysics/residential/calculate`| 住宅风水合参计算 | 八宅命宅相配与玄空飞星九运合参 |
| **住宅风水提示词**| `/metaphysics/residential/prompt`| 住宅风水合参提示词 | 住宅风水综合自包含提示词 |
| **生肖流年** | `/metaphysics/zodiac/calculate`| `metaphysics_zodiac` | 刑冲克害破、三合六合生肖关系 |
| **生肖提示词** | `/metaphysics/zodiac/prompt` | `zodiac_prompt` | 生肖流年运势自包含提示词 |
| **太乙神数** | `/metaphysics/taiyi/calculate` | `metaphysics_taiyi` | 年月日时四计七十二局式盘 |
| **太乙提示词** | `/metaphysics/taiyi/prompt` | `taiyi_prompt` | 太乙主客胜负时势提示词 |
| **五运六气** | `/metaphysics/wuyun-liuqi/calculate`| `metaphysics_wuyun-liuqi`| 五步主客运、司天在泉、天符岁会五类符会 |
| **五运六气提示词**| `/metaphysics/wuyun-liuqi/prompt`| `wuyun_liuqi_prompt` | 年度五运六气气候与节律自包含提示词 |
| **皇极经世** | `/metaphysics/huangji-jingshi/calculate`| `metaphysics_huangji-jingshi`| 元会运世、值年卦、月经卦、日经卦 |
| **皇极经世提示词**| `/metaphysics/huangji-jingshi/prompt`| `huangji_jingshi_prompt` | 皇极经世自包含宏观时势提示词 |
| **七政四余** | `/metaphysics/qizheng/calculate`| `metaphysics_qizheng` | 十一星、二十八宿界、度主命主、行限流曜 |
| **七政四余提示词**| `/metaphysics/qizheng/prompt` | `qizheng_prompt` | 七政四余天星自包含解读提示词 |
| **AI 运行流** | `/ai/analyze` | - | SSE 流式 AI 问答接口 |
| **AI 可用模型** | `/ai/models` | - | 查询内置或外部模型列表 |
