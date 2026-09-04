/**
 * @file 统一工具契约目录 (Tool Catalog)
 * @description 集中维护 Mingyu MCP 与 AOV API 工具元数据、分类、调用契约及注解
 */

export interface ToolMetadataAnnotations {
  readOnlyHint: boolean;
  idempotentHint: boolean;
}

export interface ToolCatalogItem {
  id: string;
  title: string;
  category:
    | 'foundation'
    | 'calendar'
    | 'instant'
    | 'consultation'
    | 'bazi'
    | 'ziwei'
    | 'liuyao'
    | 'meihua'
    | 'xiaoliuren'
    | 'jinkoujue'
    | 'qimen'
    | 'liuren'
    | 'tarot'
    | 'lenormand'
    | 'ssgw'
    | 'almanac'
    | 'astrolabe'
    | 'fengshui'
    | 'zodiac'
    | 'taiyi'
    | 'wuyun-liuqi'
    | 'huangji-jingshi'
    | 'qizheng';
  type: 'calculate' | 'prompt' | 'utility';
  description: string;
  annotations: ToolMetadataAnnotations;
  endpoint?: string;
}

const READONLY_IDEMPOTENT: ToolMetadataAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
};

const READONLY_NON_IDEMPOTENT: ToolMetadataAnnotations = {
  readOnlyHint: true,
  idempotentHint: false,
};

export const TOOL_CATALOG: ToolCatalogItem[] = [
  // 基础地基
  {
    id: 'foundation_capabilities',
    title: '公共地基能力目录',
    category: 'foundation',
    type: 'utility',
    description: '获取公共地基能力目录，返回历法、干支、五行、方位与通用神煞的稳定能力事实',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/foundation/capabilities',
  },
  {
    id: 'foundation_ganzhi',
    title: '六十甲子干支属性',
    category: 'foundation',
    type: 'utility',
    description: '查询单个六十甲子的序号、纳音、五行、阴阳、藏干与合冲刑害破',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/foundation/ganzhi',
  },
  {
    id: 'foundation_wuxing',
    title: '五行力量与生克',
    category: 'foundation',
    type: 'utility',
    description: '分析干支列表的五行统计、藏干权重与主导五行生克',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/foundation/wuxing',
  },
  {
    id: 'foundation_direction',
    title: '二十四山与罗盘方位',
    category: 'foundation',
    type: 'utility',
    description: '按罗盘角度查询所属八卦、二十四山、天心十道对冲山与四正四隅属性',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/foundation/direction',
  },
  {
    id: 'foundation_shensha',
    title: '通用传统神煞',
    category: 'foundation',
    type: 'utility',
    description: '核验四柱干支的空亡、驿马与桃花传统神煞',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/foundation/shensha',
  },

  // 历法与天文
  {
    id: 'calendar_true_solar_time',
    title: '真太阳时校正',
    category: 'calendar',
    type: 'utility',
    description: '根据地理经度与平太阳时换算真太阳时与均时差',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/calendar/true-solar-time',
  },
  {
    id: 'calendar_true_solar_birth',
    title: '统一出生真太阳时',
    category: 'calendar',
    type: 'utility',
    description: '根据出生公历或农历及经度时区计算校正后的公历与农历时间',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/calendar/true-solar-birth',
  },
  {
    id: 'calendar_solar_illumination',
    title: '太阳光照与出没',
    category: 'calendar',
    type: 'utility',
    description: '计算指定日期的日出日落时刻、地平高度与曙暮光证据',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/calendar/solar-illumination',
  },
  {
    id: 'calendar_astronomical_time',
    title: '天文时间尺度',
    category: 'calendar',
    type: 'utility',
    description: '计算儒略日、近似 UT1、ΔT 与近似 TT 证据',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/calendar/astronomical-time',
  },
  {
    id: 'calendar_moon_phase',
    title: '月相证据',
    category: 'calendar',
    type: 'utility',
    description: '计算月相角、照明比例与朔弦望事件',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/calendar/moon-phase',
  },
  {
    id: 'calendar_solar_term',
    title: '二十四节气',
    category: 'calendar',
    type: 'utility',
    description: '计算节气历表时刻、太阳黄经度数与独立求根核验',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/calendar/solar-term',
  },

  // 即时排盘
  {
    id: 'instant_chart',
    title: '即时排盘',
    category: 'instant',
    type: 'calculate',
    description: '按当前时刻即时排八字、紫微、合参、星盘或七政盘，无需性别与个人字段',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/instant/calculate',
  },

  // 八字
  {
    id: 'bazi_calculate',
    title: '八字排盘',
    category: 'bazi',
    type: 'calculate',
    description: '计算四柱干支、十神、藏干、大运、流年、胎元命宫身宫与神煞（支持缺时辰三柱降级）',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/bazi/calculate',
  },
  {
    id: 'bazi_prompt',
    title: '八字解读提示词',
    category: 'bazi',
    type: 'prompt',
    description: '生成供在线大模型直接解读的自包含八字任务书提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/bazi/prompt',
  },
  {
    id: 'bazi_compatibility',
    title: '八字双盘合婚',
    category: 'bazi',
    type: 'calculate',
    description: '计算两人八字日主五行喜忌互补、四柱干支合冲与夫妻宫德合刑冲',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/bazi/compatibility',
  },
  {
    id: 'bazi_compatibility_prompt',
    title: '八字合盘提示词',
    category: 'bazi',
    type: 'prompt',
    description: '生成八字双盘合婚与合伙关系的自包含深度提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/bazi/compatibility/prompt',
  },
  {
    id: 'bazi_timeline_prompt',
    title: '八字岁运流年提示词',
    category: 'bazi',
    type: 'prompt',
    description: '聚焦特定大运、流年或流月的针对性八字运势分析提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/bazi/timeline/prompt',
  },

  // 紫微斗数
  {
    id: 'ziwei_calculate',
    title: '紫微斗数排盘',
    category: 'ziwei',
    type: 'calculate',
    description: '计算紫微斗数十二宫星曜、生年四化、大限流年与三方四正格局',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/ziwei/calculate',
  },
  {
    id: 'ziwei_prompt',
    title: '紫微解读提示词',
    category: 'ziwei',
    type: 'prompt',
    description: '生成包含本命十二宫全要素、飞化自化与重点宫位的紫微解读任务书',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/ziwei/prompt',
  },
  {
    id: 'ziwei_compatibility',
    title: '紫微合盘',
    category: 'ziwei',
    type: 'calculate',
    description: '计算双方关键宫位叠盘、生年四化跨盘落宫与星曜交感',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/ziwei/compatibility',
  },
  {
    id: 'ziwei_compatibility_prompt',
    title: '紫微合盘提示词',
    category: 'ziwei',
    type: 'prompt',
    description: '生成紫微合盘结构化证据与关系推演提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/ziwei/compatibility/prompt',
  },

  // 八字紫微合参
  {
    id: 'bazi_ziwei_prompt',
    title: '八字紫微合参提示词',
    category: 'bazi',
    type: 'prompt',
    description: '以同一出生时间联动八字与紫微，生成双体系交叉互证的自包含任务书',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/bazi-ziwei/prompt',
  },

  // 大类主题咨询
  {
    id: 'thematic_consultation_prompt',
    title: '大类主题咨询提示词',
    category: 'consultation',
    type: 'prompt',
    description:
      '按通用、感情、事业、财运、健康、家庭、学业、时机等大类自动提取八字与紫微核心要素生成自包含任务书',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/consultation/thematic/prompt',
  },

  // 占卜类
  {
    id: 'divine_liuyao',
    title: '六爻排盘',
    category: 'liuyao',
    type: 'calculate',
    description: '六爻纳甲起卦、世应动变、六亲六神与生克冲合',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/liuyao',
  },
  {
    id: 'liuyao_prompt',
    title: '六爻提示词',
    category: 'liuyao',
    type: 'prompt',
    description: '生成六爻卦象用神旺衰与动态演变的自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/liuyao/prompt',
  },
  {
    id: 'divine_meihua',
    title: '梅花易数排盘',
    category: 'meihua',
    type: 'calculate',
    description: '梅花易数体用互变卦象与五行生克',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/meihua',
  },
  {
    id: 'meihua_prompt',
    title: '梅花易数提示词',
    category: 'meihua',
    type: 'prompt',
    description: '生成梅花易数主互变卦象推进与体用生克的自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/meihua/prompt',
  },
  {
    id: 'divine_xiaoliuren',
    title: '小六壬排盘',
    category: 'xiaoliuren',
    type: 'calculate',
    description: '小六壬月日时顺数初宫二宫三宫流转与时宫定局',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/xiaoliuren',
  },
  {
    id: 'xiaoliuren_prompt',
    title: '小六壬提示词',
    category: 'xiaoliuren',
    type: 'prompt',
    description: '生成小六壬三宫推移与速断决策自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/xiaoliuren/prompt',
  },
  {
    id: 'divine_jinkoujue',
    title: '金口诀排盘',
    category: 'jinkoujue',
    type: 'calculate',
    description: '大六壬金口诀人元、贵神、将神、地分四位课盘',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/jinkoujue',
  },
  {
    id: 'jinkoujue_prompt',
    title: '金口诀提示词',
    category: 'jinkoujue',
    type: 'prompt',
    description: '生成金口诀四位发用与生克主客提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/jinkoujue/prompt',
  },
  {
    id: 'divine_qimen',
    title: '奇门遁甲时局排盘',
    category: 'qimen',
    type: 'calculate',
    description: '时家奇门九星、九宫、八门、八神与三奇六仪盘面',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/qimen',
  },
  {
    id: 'qimen_prompt',
    title: '奇门遁甲提示词',
    category: 'qimen',
    type: 'prompt',
    description: '生成奇门时空方位与动静主客策略自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/qimen/prompt',
  },
  {
    id: 'qimen_lifetime',
    title: '奇门终身局排盘',
    category: 'qimen',
    type: 'calculate',
    description: '根据出生四柱排布奇门命盘，提取终身格局与阶段卡',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/qimen/lifetime',
  },
  {
    id: 'qimen_lifetime_prompt',
    title: '奇门终身局提示词',
    category: 'qimen',
    type: 'prompt',
    description: '生成奇门终身局长远运势与格局自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/qimen/lifetime/prompt',
  },
  {
    id: 'divine_liuren',
    title: '大六壬排盘',
    category: 'liuren',
    type: 'calculate',
    description: '大六壬天地盘、四课、三传九宗门与十二天将',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/liuren',
  },
  {
    id: 'liuren_prompt',
    title: '大六壬提示词',
    category: 'liuren',
    type: 'prompt',
    description: '生成大六壬课体演化与人事博弈自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/liuren/prompt',
  },
  {
    id: 'divine_tarot',
    title: '塔罗抽牌排阵',
    category: 'tarot',
    type: 'calculate',
    description: '78张塔罗牌多牌阵抽取、正逆位与牌位结构化证据',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/tarot',
  },
  {
    id: 'tarot_prompt',
    title: '塔罗提示词',
    category: 'tarot',
    type: 'prompt',
    description: '生成塔罗牌阵位置脉络与象征启发的自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/tarot/prompt',
  },
  {
    id: 'divine_lenormand',
    title: '雷诺曼抽牌排阵',
    category: 'lenormand',
    type: 'calculate',
    description: '36张雷诺曼牌阵抽取、核心十字与相邻组合合读',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/lenormand',
  },
  {
    id: 'lenormand_prompt',
    title: '雷诺曼提示词',
    category: 'lenormand',
    type: 'prompt',
    description: '生成雷诺曼牌位关系与日常符码解读提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/lenormand/prompt',
  },
  {
    id: 'divine_ssgw',
    title: '三山国王灵签抽签',
    category: 'ssgw',
    type: 'calculate',
    description: '纯正民间签谱抽取，返回签号、签题、签诗与历史典故',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/ssgw',
  },
  {
    id: 'ssgw_prompt',
    title: '三山国王灵签提示词',
    category: 'ssgw',
    type: 'prompt',
    description: '生成只含签诗典故与修身启迪的纯净自包含提示词',
    annotations: READONLY_NON_IDEMPOTENT,
    endpoint: '/divination/ssgw/prompt',
  },
  {
    id: 'divine_almanac',
    title: '黄历择日排盘',
    category: 'almanac',
    type: 'calculate',
    description: '建除十二神、丛辰神煞与多参与人四柱冲煞择吉',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/almanac',
  },
  {
    id: 'almanac_prompt',
    title: '黄历择日提示词',
    category: 'almanac',
    type: 'prompt',
    description: '生成候选日期优选分析与自包含择日决策提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/almanac/prompt',
  },

  // 西洋星盘
  {
    id: 'divine_astrolabe',
    title: '西洋星盘排盘',
    category: 'astrolabe',
    type: 'calculate',
    description: '本命星体黄道位置、宫位分界与相位交角',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/astrolabe',
  },
  {
    id: 'astrolabe_prompt',
    title: '西洋星盘提示词',
    category: 'astrolabe',
    type: 'prompt',
    description: '生成本命与行运过境解读自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/astrolabe/prompt',
  },
  {
    id: 'astrolabe_synastry',
    title: '西占双盘比较盘',
    category: 'astrolabe',
    type: 'calculate',
    description: '计算双人星盘跨盘相位、角距、落宫与互溶接纳',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/astrolabe/synastry',
  },
  {
    id: 'astrolabe_synastry_prompt',
    title: '西占双盘提示词',
    category: 'astrolabe',
    type: 'prompt',
    description: '生成西占双人关系比较盘自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/divination/astrolabe/synastry/prompt',
  },

  // 堪舆与数术专科
  {
    id: 'metaphysics_bazhai',
    title: '八宅风水排盘',
    category: 'fengshui',
    type: 'calculate',
    description: '居者生年命卦、宅卦大游年与门主灶九星相配',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/bazhai/calculate',
  },
  {
    id: 'bazhai_prompt',
    title: '八宅风水提示词',
    category: 'fengshui',
    type: 'prompt',
    description: '生成八宅方位吉凶与布局调谐自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/bazhai/prompt',
  },
  {
    id: 'metaphysics_xuankong',
    title: '玄空飞星排盘',
    category: 'fengshui',
    type: 'calculate',
    description: '三元九运山向运星排盘、反伏吟与城门诀计算',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/xuankong/calculate',
  },
  {
    id: 'xuankong_prompt',
    title: '玄空飞星提示词',
    category: 'fengshui',
    type: 'prompt',
    description: '生成玄空飞星山向旺衰与城门气口自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/xuankong/prompt',
  },
  {
    id: 'metaphysics_residential',
    title: '住宅风水合参排盘',
    category: 'fengshui',
    type: 'calculate',
    description: '综合八宅生年命卦与玄空飞星九运的住宅风水合参',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/residential/calculate',
  },
  {
    id: 'residential_prompt',
    title: '住宅风水合参提示词',
    category: 'fengshui',
    type: 'prompt',
    description: '生成住宅风水八宅玄空综合评估自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/residential/prompt',
  },
  {
    id: 'metaphysics_zodiac',
    title: '生肖流年关系',
    category: 'zodiac',
    type: 'calculate',
    description: '分析生肖与流年太岁刑冲克害破、三合六合关系',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/zodiac/calculate',
  },
  {
    id: 'zodiac_prompt',
    title: '生肖流年提示词',
    category: 'zodiac',
    type: 'prompt',
    description: '生成生肖与岁星作用自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/zodiac/prompt',
  },
  {
    id: 'metaphysics_taiyi',
    title: '太乙神数式盘',
    category: 'taiyi',
    type: 'calculate',
    description: '太乙神数年月日时四计七十二局式盘与主客和数算分析',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/taiyi/calculate',
  },
  {
    id: 'taiyi_prompt',
    title: '太乙神数提示词',
    category: 'taiyi',
    type: 'prompt',
    description: '生成太乙主客胜负定性与宏观时势自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/taiyi/prompt',
  },
  {
    id: 'metaphysics_wuyun_liuqi',
    title: '五运六气排盘',
    category: 'wuyun-liuqi',
    type: 'calculate',
    description: '年度五步主客运、司天在泉与天符岁会五类符会病机',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/wuyun-liuqi/calculate',
  },
  {
    id: 'wuyun_liuqi_prompt',
    title: '五运六气提示词',
    category: 'wuyun-liuqi',
    type: 'prompt',
    description: '生成年度气候节律与病机平气自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/wuyun-liuqi/prompt',
  },
  {
    id: 'metaphysics_huangji_jingshi',
    title: '皇极经世宏观周期',
    category: 'huangji-jingshi',
    type: 'calculate',
    description: '邵雍皇极经世元会运世、值年卦与运世消息推进',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/huangji-jingshi/calculate',
  },
  {
    id: 'huangji_jingshi_prompt',
    title: '皇极经世提示词',
    category: 'huangji-jingshi',
    type: 'prompt',
    description: '生成皇极经世时代坐标与值年卦演变自包含提示词',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/huangji-jingshi/prompt',
  },
  {
    id: 'metaphysics_qizheng',
    title: '七政四余排盘',
    category: 'qizheng',
    type: 'calculate',
    description: '果老星宗七政十一星、二十八宿界、昼夜分金恩难与行限流曜',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/qizheng/calculate',
  },
  {
    id: 'qizheng_prompt',
    title: '七政四余提示词',
    category: 'qizheng',
    type: 'prompt',
    description: '生成七政四余天星恩难自包含解读任务书',
    annotations: READONLY_IDEMPOTENT,
    endpoint: '/metaphysics/qizheng/prompt',
  },
];

export function getToolCatalog(): readonly ToolCatalogItem[] {
  return TOOL_CATALOG;
}

export function findTool(id: string): ToolCatalogItem | undefined {
  return TOOL_CATALOG.find((tool) => tool.id === id);
}

export function getToolAnnotations(id: string): ToolMetadataAnnotations {
  return findTool(id)?.annotations ?? READONLY_IDEMPOTENT;
}

export function getToolsByCategory(category: ToolCatalogItem['category']): ToolCatalogItem[] {
  return TOOL_CATALOG.filter((tool) => tool.category === category);
}
