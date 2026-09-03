# AOV / Mingyu 数据提供方适配实现指南（AOV & Mingyu Provider Reference）

本文档为 AOV 命理公开 API 与 Mingyu MCP Server 的具体端点、工具与参数映射参考。上层算命通用 Skill 通过本文档与具体服务对接。当更换为人工录入盘面或未来其他排盘器时，上层工作流不受影响。

---

## 一、基础服务地址与响应格式

- **官方基础地址**：`https://aov.cc/api/v1`
- **统一成功响应**：
  ```json
  {
    "ok": true,
    "data": {},
    "meta": { "service": "aov.cc", "version": "v1" }
  }
  ```
- **统一错误响应**：
  ```json
  {
    "ok": false,
    "error": { "code": "BAD_REQUEST", "message": "错误说明" },
    "meta": { "service": "aov.cc", "version": "v1" }
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

---

## 三、常用排盘与计算接口清单

- `GET /health`：健康检查。
- `GET /manifest`：API 元数据与 OpenAPI 规范地址。
- `GET /openapi.json`：获取 OpenAPI 规范 JSON。
- `POST /calendar/true-solar-time`：换算真太阳时与历史夏令时。
- `POST /bazi/calculate`：八字排盘。
- `POST /bazi/prompt`：八字提示词生成。
- `POST /bazi/compatibility`：八字双盘计算。
- `POST /bazi/compatibility/prompt`：八字双盘提示词生成。
- `POST /ziwei/calculate`：紫微斗数排盘。
- `POST /ziwei/prompt`：紫微斗数提示词生成。
- `POST /ziwei/compatibility`：紫微双盘计算。
- `POST /ziwei/compatibility/prompt`：紫微双盘提示词生成。
- `POST /bazi-ziwei/prompt`：八字紫微合参提示词生成。
- `POST /divination/liuyao`：六爻起卦。
- `POST /divination/liuyao/prompt`：六爻提示词生成。
- `POST /divination/meihua`：梅花易数起卦。
- `POST /divination/meihua/prompt`：梅花易数提示词生成。
- `POST /divination/xiaoliuren`：小六壬起课。
- `POST /divination/xiaoliuren/prompt`：小六壬提示词生成。
- `POST /divination/jinkoujue`：金口诀起课。
- `POST /divination/jinkoujue/prompt`：金口诀提示词生成（支持 `jinkoujueMethod: "branch"` 配合 `jinkoujueBranch` 指定地分）。
- `POST /divination/qimen`：奇门遁甲排盘。
- `POST /divination/qimen/prompt`：奇门遁甲提示词生成。
- `POST /divination/qimen/lifetime`：奇门终身局排盘。
- `POST /divination/qimen/lifetime/prompt`：奇门终身局提示词生成。
- `POST /divination/liuren`：大六壬排盘。
- `POST /divination/liuren/prompt`：大六壬提示词生成。
- `POST /divination/tarot`：塔罗抽牌。
- `POST /divination/tarot/prompt`：塔罗提示词生成。
- `POST /divination/ssgw`：三山国王灵签求签。
- `POST /divination/ssgw/prompt`：三山国王灵签提示词生成。
- `POST /divination/almanac`：黄历择日排盘。
- `POST /divination/almanac/prompt`：黄历择日提示词生成。
- `POST /divination/lenormand`：雷诺曼抽牌。
- `POST /divination/lenormand/prompt`：雷诺曼提示词生成。
- `POST /divination/astrolabe`：西洋星盘排盘。
- `POST /divination/astrolabe/prompt`：西洋星盘提示词生成。
- `POST /divination/astrolabe/synastry`：西占双盘计算。
- `POST /divination/astrolabe/synastry/prompt`：西占双盘提示词生成。
- `POST /metaphysics/bazhai/calculate`：八宅风水排盘。
- `POST /metaphysics/bazhai/prompt`：八宅风水提示词生成。
- `POST /metaphysics/residential/calculate`：住宅风水合参排盘。
- `POST /metaphysics/residential/prompt`：住宅风水合参提示词生成。
- `POST /metaphysics/zodiac/calculate`：生肖流年关系计算。
- `POST /metaphysics/zodiac/prompt`：生肖流年提示词生成。
- `POST /metaphysics/taiyi/calculate`：太乙神数排盘。
- `POST /metaphysics/taiyi/prompt`：太乙神数提示词生成。
- `POST /metaphysics/wuyun-liuqi/calculate`：五运六气排盘。
- `POST /metaphysics/wuyun-liuqi/prompt`：五运六气提示词生成。
- `POST /metaphysics/huangji-jingshi/calculate`：皇极经世排盘。
- `POST /metaphysics/huangji-jingshi/prompt`：皇极经世提示词生成。
- `POST /metaphysics/qizheng/calculate`：七政四余排盘。
- `POST /metaphysics/qizheng/prompt`：七政四余提示词生成。
- `POST /ai/analyze`：AI 流式问答（返回 `text/event-stream`）。
- `POST /ai/models`：获取当前 `aiConfig` 可用模型列表。

---

## 四、牌阵与参数完整契约

- **塔罗牌阵 `spreadType` 支持全部 18 种**：
  `single`（单牌）、`three`（时间流）、`love`（爱情）、`career`（事业）、`decision`（选择）、`celtic`（凯尔特十字）、`chakra`（七脉轮）、`year`（年运）、`mindBodySpirit`（身心灵）、`horseshoe`（马蹄铁）、`holyTriangle`（圣三角）、`universal`（万能）、`fourElements`（四元素）、`hexagram`（六芒星）、`relationship`（关系）、`wealth`（财富）、`problemSolving`（问题解决）、`twelveHouses`（十二宫）。
- **雷诺曼牌阵 `spreadType` 支持全部 8 种**：
  `single`（单牌）、`three`（三牌）、`five`（五牌十字）、`relationship`（关系）、`decision`（选择）、`nine`（九宫）、`element`（元素牌阵）、`grandTableau`（大桌牌阵）。
- **金口诀取地分参数**：
  `jinkoujueMethod` 支持 `time`（时间）、`branch`（直接指定地分）、`number`（数字）、`random`（随机）。采用 `branch` 方式必须传 `jinkoujueBranch`，取子至亥之一；指定地分后仍按起课时间计算月将与日干。
- **五运六气与皇极经世输入口径规范**：
  - 五运六气使用 `year` 或 `yearGanZhi`；同时提供时会校验两者一致。`year` 按该公历年年中所属年柱换算。结果包含天符、岁会、太乙天符、同天符、同岁会逐项核验；吴谦《运气要诀》列出的五类符会逐年名单按六十甲子去重为 26 年，与原文“二十八年”汇总不一致；接口保留 `sourceReconciliation` 校勘说明，并以逐项定义为准。
  - 皇极经世提供 `customDate` 时，以北京时间和冬至换年定位皇极年，并在元会运世和值年卦之下继续推演月经卦、旬纬卦、日卦及时经卦，即 `customDate` 对应年月日时完整排盘。
  - 年度研究提供公元 `year`，默认采用公元前 67017 年为本元起点、1984 年鼎卦为甲子值年锚点的通行排法，包含值年卦及互卦错卦综卦。
  - 研究自定义纪元时提供 `epochYear`，并从公元 `year` 与 `elapsedYears` 中选择一项；该模式保留纯元会运世坐标换算。

---

## 五、统一多流派合参参数 `schools` 边界

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
- **流派与排盘口径界限**：
  - 奇门的转盘法与飞盘法属于实际排盘，`schools` 属于解读取向；紫微 `algorithm` 同理属于排盘口径。
  - **三山国王灵签提示词只列本次签谱资料，不附加派系段落，也不接受 `schools`**。

---

## 六、高效调用实践与轻量参数

1. **响应模式 `responseMode`**：
   - 默认推荐：`prompt-only`。仅返回可直接交给 AI 的纯文本自包含完整任务书（`data.prompt`），响应极快且 Token 占用最小；
   - 轻量摘要：`summary`。返回提示词及核心盘面摘要；
   - 完整原始数据：`full`。仅在需要前端渲染完整交互式排盘或导出原始 JSON 时使用。
2. **排盘明细 `detailMode`**：
   - `compact`：在八字、紫微、奇门和黄历排盘中，过滤冗长计算步骤，仅保留核心盘面；
   - `full`：返回全量证据节点。
3. **服务异常与降级**：
   - 当 API 返回 5xx、超时或网络中断时，保留用户输入并转由上层 Skill 执行人工盘面核验或基于已知柱位做保守分析；
   - 严禁将 HTTP 错误代码解释为命理吉凶。
