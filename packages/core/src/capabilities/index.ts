import {
  ALMANAC_TOPIC_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  XIAOLIUREN_METHOD_OPTIONS,
  JINKOUJUE_METHOD_OPTIONS,
} from '../divination/config';
import { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from '../shared/version';
import { MingyuCoreError } from '../shared/result';

export { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from '../shared/version';

export const SYSTEM_CAPABILITY_IDS = [
  'calendar.trueSolarBirth',
  'calendar.astronomicalTime',
  'calendar.moonPhase',
  'calendar.solarIllumination',
  'calendar.solarTerm',
  'bazi',
  'ziwei',
  'bazi-ziwei-synthesis',
  'astrolabe',
  'qimen',
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'liuren',
  'tarot',
  'lenormand',
  'ssgw',
  'almanac',
  'bazhai',
  'zodiac',
  'taiyi',
  'wuyun-liuqi',
  'huangji-jingshi',
  'qizheng',
  'xuankong',
  'residential',
] as const;

export type SystemCapabilityId = (typeof SYSTEM_CAPABILITY_IDS)[number];

export type CapabilityInputType =
  'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'array' | 'object';

export interface CapabilityOption {
  value: string;
  label: string;
}

export interface CapabilityInput {
  id: string;
  label: string;
  type: CapabilityInputType;
  required: boolean;
  description?: string;
  options?: CapabilityOption[];
  requiredWhen?: Record<string, string | boolean>;
}

export interface SystemCapability {
  id: SystemCapabilityId;
  name: string;
  category: 'chart' | 'divination' | 'calendar' | 'environment';
  /** 省略或为 true 表示可计算；false 表示只保留兼容入口并明确失败关闭。 */
  available?: boolean;
  methods?: CapabilityOption[];
  defaultMethod?: string;
  inputs: CapabilityInput[];
  outputs: string[];
  supports: {
    seed: boolean;
    customRandomSource: boolean;
    replay?: boolean;
    trueSolarTime: boolean;
    birthTimeRequired: boolean;
    birthTimeModes?: Array<'traditional-shichen' | 'precise-clock-time'>;
    batch: boolean;
  };
  optionalDependencies?: string[];
  notes?: string[];
}

export interface MingyuCapabilities {
  package: 'mingyu-core';
  version: string;
  schemaVersion: string;
  systems: SystemCapability[];
}

const birthProfileInput: CapabilityInput = {
  id: 'profile',
  label: '出生档案',
  type: 'object',
  required: true,
  description:
    '推荐使用统一 BirthProfile；时辰级算法可提供明确传统时辰，真太阳时、星盘和七政四余必须提供精准时分及所需地点资料。',
};

const questionInput: CapabilityInput = {
  id: 'question',
  label: '问题',
  type: 'text',
  required: false,
};

const randomSupports = {
  seed: true,
  customRandomSource: true,
  replay: true,
  trueSolarTime: false,
  birthTimeRequired: false,
  batch: false,
};

function options(items: ReadonlyArray<{ value: string; label: string }>): CapabilityOption[] {
  return items.map(({ value, label }) => ({ value, label }));
}

const systems: SystemCapability[] = [
  {
    id: 'calendar.trueSolarBirth',
    name: '出生真太阳时',
    category: 'calendar',
    inputs: [
      {
        id: 'dateType',
        label: '历法类型',
        type: 'select',
        required: true,
        options: options([
          { value: 'solar', label: '公历' },
          { value: 'lunar', label: '农历' },
        ]),
      },
      { id: 'year', label: '出生年', type: 'number', required: true },
      { id: 'month', label: '出生月', type: 'number', required: true },
      { id: 'day', label: '出生日', type: 'number', required: true },
      { id: 'hour', label: '出生小时', type: 'number', required: true },
      { id: 'minute', label: '出生分钟', type: 'number', required: true },
      { id: 'second', label: '出生秒', type: 'number', required: false },
      {
        id: 'isLeapMonth',
        label: '是否闰月',
        type: 'boolean',
        required: false,
        requiredWhen: { dateType: 'lunar' },
      },
      { id: 'longitude', label: '出生地经度', type: 'number', required: true },
      { id: 'timezone', label: '固定时区偏移', type: 'number', required: false },
      { id: 'timeZoneId', label: 'IANA历史时区', type: 'text', required: false },
      {
        id: 'applyChinaDst',
        label: '应用中国历史夏令时',
        type: 'boolean',
        required: false,
      },
    ],
    outputs: [
      '标准时间',
      '真太阳时',
      '经度修正',
      '均时差',
      '跨日状态',
      '时辰索引',
      '真太阳时结构化计算链与校正事实',
      'IANA历史时区映射与消歧证据',
      '真太阳时证据汇总、来源与限制',
      'UTC与儒略日时间尺度证据',
      'ΔT与近似TT儒略日',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['precise-clock-time'],
      batch: false,
    },
    notes: [
      '未提供 timeZoneId 时 timezone 默认 UTC+8；回拨重复时刻使用 IANA 时区时需同时提供 timezone 消歧。',
      'timeZoneId 已包含历史夏令时规则，不能同时启用 applyChinaDst。',
    ],
  },
  {
    id: 'calendar.astronomicalTime',
    name: '天文时间尺度',
    category: 'calendar',
    inputs: [
      { id: 'year', label: '当地年份', type: 'number', required: true },
      { id: 'month', label: '当地月份', type: 'number', required: true },
      { id: 'day', label: '当地日期', type: 'number', required: true },
      { id: 'hour', label: '当地小时', type: 'number', required: false },
      { id: 'minute', label: '当地分钟', type: 'number', required: false },
      { id: 'second', label: '当地秒', type: 'number', required: false },
      { id: 'timezone', label: '固定时区偏移', type: 'number', required: false },
      { id: 'timeZoneId', label: 'IANA历史时区', type: 'text', required: false },
    ],
    outputs: [
      '历史时区诊断',
      'UTC时间与Unix毫秒',
      'JD(UTC)与近似JD(UT1)',
      'ΔT与近似JD(TT)',
      '结构化计算链与假设',
      '近似反证、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      'timezone 与 timeZoneId 至少提供一项；IANA 时区优先，timezone 仅用于回拨消歧和一致性核验，冲突时拒绝计算。',
    ],
  },
  {
    id: 'calendar.moonPhase',
    name: '月相与朔弦望',
    category: 'calendar',
    inputs: [{ id: 'utcDateTime', label: 'UTC时刻', type: 'datetime', required: true }],
    outputs: [
      '日月地心黄经',
      '月相角与最小距角',
      '八分月相与盈亏',
      '几何照明比例与近似月龄',
      '前后朔弦望求根事件',
      '结构化计算链、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'calendar.solarIllumination',
    name: '太阳高度与曙暮光',
    category: 'calendar',
    inputs: [
      { id: 'year', label: '当地年份', type: 'number', required: true },
      { id: 'month', label: '当地月份', type: 'number', required: true },
      { id: 'day', label: '当地日期', type: 'number', required: true },
      { id: 'hour', label: '当地小时', type: 'number', required: false },
      { id: 'minute', label: '当地分钟', type: 'number', required: false },
      { id: 'second', label: '当地秒', type: 'number', required: false },
      { id: 'latitude', label: '纬度', type: 'number', required: true },
      { id: 'longitude', label: '经度', type: 'number', required: true },
      { id: 'timezone', label: '固定时区偏移', type: 'number', required: false },
      { id: 'timeZoneId', label: 'IANA历史时区', type: 'text', required: false },
    ],
    outputs: [
      '参考时刻太阳高度与方位',
      '太阳赤纬与时间方程',
      '视太阳正午',
      '日出日落',
      '民用、航海与天文曙暮光',
      '极昼极夜等全天状态',
      '结构化计算链、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      'timezone 与 timeZoneId 至少提供一项；结果为理想地平线下的低阶天文模型，不代表天气、遮挡或建筑采光。',
    ],
  },
  {
    id: 'calendar.solarTerm',
    name: '二十四节气交接证据',
    category: 'calendar',
    inputs: [
      { id: 'year', label: '年份', type: 'number', required: true },
      { id: 'index', label: '节气索引', type: 'number', required: true },
    ],
    outputs: [
      '采用历表交接时刻',
      '目标太阳回归黄经',
      '低阶视黄经独立求根',
      '历表与模型差值核验',
      '结构化计算链、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: true,
    },
    notes: ['solarTerm(year, index) 查询单个节气；solarTerms(year) 按公历年份返回 24 个节气。'],
  },
  {
    id: 'bazi',
    name: '八字',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '四柱',
      '十神',
      '藏干',
      '五行强度',
      '格局',
      '用神',
      '本命四柱与核心判断结构化证据',
      '真太阳时结构化计算链、校正事实与限制',
      '大运',
      '流年',
      '大运流年流月流日逐层触发证据',
      '岁运并临与天克地冲',
      '岁运补全三合三会成局证据',
      '节气历表边界与太阳视黄经独立核验',
      '神煞',
      '刑冲合害',
      '双盘日主与十神映射',
      '双盘合冲刑害破',
      '双盘喜忌覆盖',
      '双盘结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: false,
    },
    notes: [
      '未启用真太阳时时可直接使用明确的时辰索引；启用真太阳时时需提供完整小时、分钟和出生地。输入为空或非法时会在计算前拒绝。',
    ],
  },
  {
    id: 'ziwei',
    name: '紫微斗数',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '十二宫',
      '星曜',
      '四化',
      '大限',
      '流年',
      '结构化证据',
      '真太阳时结构化计算链、校正事实与限制',
      '双盘宫位叠盘',
      '双盘生年四化落点',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: false,
    },
    optionalDependencies: ['iztro'],
  },
  {
    id: 'bazi-ziwei-synthesis',
    name: '八字紫微合参',
    category: 'chart',
    inputs: [
      birthProfileInput,
      {
        id: 'ziweiTiming',
        label: '紫微运限基准时间',
        type: 'object',
        required: true,
        description:
          '在 ziwei.horoscopeContext 中提供日期与时辰索引，或在 ziwei.now 中提供明确日期对象。',
      },
      questionInput,
      {
        id: 'detailLevel',
        label: '解读层级',
        type: 'select',
        required: false,
        options: options([
          { value: 'concise', label: '简明' },
          { value: 'standard', label: '标准' },
          { value: 'professional', label: '专业' },
        ]),
      },
    ],
    outputs: [
      '统一出生资料生成的八字与紫微双盘',
      '十项人生主题的双系统并列证据',
      '八字与紫微资料缺口清单',
      '可独立交给 AI 的合参任务书',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: false,
    },
    optionalDependencies: ['iztro'],
    notes: [
      '合参只按主题并列两套盘面的事实链，不把不同体系压成分数，也不让一套规则改写另一套。',
      '必须显式提供紫微运限基准时间；缺少时拒绝计算，不用运行时当前时间补齐。',
    ],
  },
  {
    id: 'astrolabe',
    name: '西洋星盘',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '行星',
      '宫位',
      '相位',
      '相位角度偏差与容许度分层',
      '本命与行运作用域',
      '返照',
      '太阳返照求根过程与黄经残差',
      'IANA历史时区与夏令时诊断',
      '次限',
      '太阳弧',
      '双盘相位',
      '双盘相位实际夹角与紧密等级',
      '跨盘落宫',
      '双盘结构化证据',
      '真太阳时结构化计算链、校正事实与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['precise-clock-time'],
      batch: false,
    },
  },
  {
    id: 'qimen',
    name: '奇门遁甲',
    category: 'divination',
    methods: options([
      { value: 'zhuanpan', label: '转盘' },
      { value: 'feipan', label: '飞盘' },
    ]),
    defaultMethod: 'zhuanpan',
    inputs: [
      {
        id: 'scope',
        label: '盘式周期',
        type: 'select',
        required: false,
        options: options([
          { value: 'hour', label: '时家' },
          { value: 'day', label: '日家' },
          { value: 'month', label: '月家' },
          { value: 'year', label: '年家' },
        ]),
      },
      {
        id: 'juMethod',
        label: '定局方法',
        type: 'select',
        required: false,
        options: options([
          { value: 'chaibu', label: '拆补法' },
          { value: 'zhirun', label: '置闰法' },
        ]),
        description: '默认拆补法；置闰法仅对时家与日家生效。',
      },
      { id: 'date', label: '起局时间', type: 'datetime', required: false },
      questionInput,
    ],
    outputs: [
      '九宫',
      '值符值使',
      '定局方法',
      '符头与超神接气',
      '用神宫候选',
      '门星神干证据',
      '空亡与格局反证',
      '宫位关系',
      '方位条件',
      '时间触发条件',
      '节气历表边界与太阳视黄经独立核验',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'liuyao',
    name: '六爻',
    category: 'divination',
    methods: options([
      { value: 'time', label: '时间起卦' },
      { value: 'manual', label: '手工六爻' },
      { value: 'coins', label: '模拟三钱投掷' },
    ]),
    defaultMethod: 'time',
    inputs: [
      {
        id: 'yaos',
        label: '六次爻值',
        type: 'array',
        required: false,
        description: '按初爻至上爻传入 6、7、8、9。',
      },
      {
        id: 'template',
        label: '断卦模板',
        type: 'select',
        required: false,
        options: options(LIUYAO_TEMPLATE_OPTIONS),
      },
      questionInput,
    ],
    outputs: [
      '主卦',
      '变卦',
      '互卦',
      '动爻',
      '纳甲',
      '六亲',
      '六神',
      '旬空',
      '反吟伏吟',
      '用神候选与原神忌神仇神作用链',
      '逐爻支持证据与反证限制',
    ],
    supports: {
      seed: true,
      customRandomSource: true,
      replay: true,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: ['现实投掷建议直接传入六次爻值，可完整复现。'],
  },
  {
    id: 'meihua',
    name: '梅花易数',
    category: 'divination',
    methods: options(MEIHUA_METHOD_OPTIONS),
    defaultMethod: 'time',
    inputs: [
      {
        id: 'number',
        label: '起卦数字',
        type: 'number',
        required: false,
        requiredWhen: { method: 'number' },
      },
      questionInput,
    ],
    outputs: [
      '主卦',
      '互卦',
      '变卦',
      '体用',
      '动爻',
      '五行关系',
      '主互变体用推进链',
      '逐阶段月令支持与限制',
    ],
    supports: randomSupports,
  },
  {
    id: 'xiaoliuren',
    name: '小六壬',
    category: 'divination',
    methods: options(XIAOLIUREN_METHOD_OPTIONS),
    defaultMethod: 'time',
    inputs: [{ id: 'date', label: '起课时间', type: 'datetime', required: false }, questionInput],
    outputs: [
      '月宫顺数轨迹',
      '日宫顺数轨迹',
      '时宫主证',
      '通行六宫歌诀',
      '历法边界说明',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      replay: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '仅保留可复核的通行时间课：正月起大安，月上起日，日上起时，以时宫为占得宫。作者及李淳风署名暂无可靠版本学证据。',
    ],
  },
  {
    id: 'jinkoujue',
    name: '金口诀',
    category: 'divination',
    methods: options(JINKOUJUE_METHOD_OPTIONS),
    defaultMethod: 'time',
    inputs: [
      {
        id: 'number',
        label: '起课数字',
        type: 'number',
        required: false,
        requiredWhen: { method: 'number' },
      },
      { id: 'date', label: '起课时间', type: 'datetime', required: false },
      questionInput,
    ],
    outputs: [
      '地分',
      '将神与将干',
      '贵神与神干',
      '人元',
      '阴阳发用',
      '五动三动',
      '四位生克',
      '月令与旬空',
      '结构化证据',
    ],
    supports: randomSupports,
    notes: [
      '金口诀采用《六壬神课金口诀古本》的四位、贵神本属、阴阳发用与五动三动口径，不与大六壬天将表或小六壬六宫混用。',
    ],
  },
  {
    id: 'liuren',
    name: '大六壬',
    category: 'divination',
    inputs: [
      { id: 'date', label: '起课时间', type: 'datetime', required: false },
      {
        id: 'template',
        label: '问题范围',
        type: 'select',
        required: false,
        options: options(LIUREN_TEMPLATE_OPTIONS),
        description: '仅用于组织提示词中的断课范围，不改变排盘算法。',
      },
      questionInput,
    ],
    outputs: [
      '天地盘',
      '四课',
      '三传',
      '天将',
      '课体',
      '神煞',
      '四课取传依据与初传发用',
      '三传推进支持与反证限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'tarot',
    name: '塔罗',
    category: 'divination',
    inputs: [
      {
        id: 'spread',
        label: '牌阵',
        type: 'select',
        required: false,
        options: options(TAROT_SPREAD_OPTIONS),
      },
      {
        id: 'manualCards',
        label: '手工牌面与正逆位',
        type: 'array',
        required: false,
        description: '按牌位顺序传入牌号和正逆位；与交互抽牌、随机设置互斥。',
      },
      {
        id: 'interactiveSamples',
        label: '逐张交互抽牌样本',
        type: 'array',
        required: false,
        description: '每张牌依次提供牌面和正逆位样本；与手工牌面、随机设置互斥。',
      },
      questionInput,
    ],
    outputs: ['抽牌顺序', '牌位', '正逆位', '关键词', '结构化证据'],
    supports: randomSupports,
  },
  {
    id: 'lenormand',
    name: '雷诺曼',
    category: 'divination',
    inputs: [
      {
        id: 'spread',
        label: '牌阵',
        type: 'select',
        required: false,
        options: options(LENORMAND_SPREAD_OPTIONS),
      },
      {
        id: 'manualCardIds',
        label: '手工牌号',
        type: 'array',
        required: false,
        description: '按牌位顺序传入牌号；与交互抽牌、随机设置互斥。',
      },
      {
        id: 'interactiveSamples',
        label: '逐张交互抽牌样本',
        type: 'array',
        required: false,
        description: '每张牌提供一个抽牌样本；与手工牌号、随机设置互斥。',
      },
      questionInput,
    ],
    outputs: ['抽牌顺序', '牌位', '固定组合与相邻合读分层', '布局证据', '结构化证据'],
    supports: randomSupports,
  },
  {
    id: 'ssgw',
    name: '三山国王灵签',
    category: 'divination',
    methods: options([
      { value: 'random', label: '随机求签' },
      { value: 'manual', label: '指定签号' },
    ]),
    defaultMethod: 'random',
    inputs: [
      {
        id: 'number',
        label: '签号',
        type: 'number',
        required: false,
        requiredWhen: { method: 'manual' },
      },
      questionInput,
    ],
    outputs: ['签号', '签诗原文', '典故辅证', '分类解读', '随机轨迹', '结构化证据'],
    supports: randomSupports,
    notes: [
      '签文数据治理独立于通用接口，本能力清单不改变权威签文内容。',
      '签诗为文本主证，典故为辅证；seed或replay只证明过程可重放，不证明预测有效性。',
    ],
  },
  {
    id: 'almanac',
    name: '黄历择日',
    category: 'calendar',
    inputs: [
      {
        id: 'topic',
        label: '事项',
        type: 'select',
        required: true,
        options: options(ALMANAC_TOPIC_OPTIONS),
      },
      { id: 'startDate', label: '开始日期', type: 'date', required: true },
      { id: 'endDate', label: '结束日期', type: 'date', required: true },
      { id: 'participants', label: '参与人', type: 'array', required: false },
    ],
    outputs: [
      '可用候选',
      '条件候选',
      '慎用候选',
      '事项宜忌证据',
      '参与人冲突',
      '候选时辰条件',
      '传统与现实约束',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: true,
    },
  },
  {
    id: 'bazhai',
    name: '八宅',
    category: 'environment',
    inputs: [
      {
        id: 'birthYear',
        label: '出生公历年',
        type: 'number',
        required: false,
        description: '与 gender 同时提供可计算命卦；也可直接提供 mingGua。',
      },
      { id: 'birthMonth', label: '出生月', type: 'number', required: false },
      { id: 'birthDay', label: '出生日', type: 'number', required: false },
      {
        id: 'gender',
        label: '性别',
        type: 'select',
        required: false,
        options: options([
          { value: 'male', label: '男' },
          { value: 'female', label: '女' },
        ]),
      },
      { id: 'mingGua', label: '直接指定命卦', type: 'text', required: false },
      { id: 'sitMountain', label: '坐山', type: 'text', required: false },
      {
        id: 'doorToInteriorDegree',
        label: '大门朝屋内角度',
        type: 'number',
        required: false,
        description: '使用门向便捷入口时必填；站在大门处面向屋内测量，范围 0° 至 360°。',
      },
      {
        id: 'northReference',
        label: '北向基准',
        type: 'select',
        required: false,
        options: options([
          { value: 'unspecified', label: '未指定' },
          { value: 'magnetic', label: '磁北' },
          { value: 'true', label: '真北' },
        ]),
      },
      { id: 'magneticDeclinationDegrees', label: '磁偏角', type: 'number', required: false },
      { id: 'measurementUncertaintyDegrees', label: '测量误差', type: 'number', required: false },
    ],
    outputs: [
      '二十四山',
      '坐向',
      '宅卦',
      '命卦',
      '命宅关系',
      '八宫',
      '磁北真北换算',
      '测量误差',
      '候选坐向',
      '边界稳定性',
      '命宅逐方重合与异判',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '命卦资料至少提供 birthYear+gender 或 mingGua；sitMountain 和门向测量均为可选住宅资料。',
      'doorToInteriorDegree 由 analyzeBaZhaiByDoorDegree 使用；普通 analyzeBaZhai 直接接收 sitMountain。',
    ],
  },
  {
    id: 'zodiac',
    name: '生肖流年',
    category: 'chart',
    inputs: [
      { id: 'zodiac', label: '生肖或年支', type: 'text', required: true },
      {
        id: 'year',
        label: '流年年份',
        type: 'number',
        required: false,
        description: '与流年干支至少提供一项。',
      },
      {
        id: 'yearGanZhi',
        label: '流年干支',
        type: 'text',
        required: false,
        description: '与流年年份至少提供一项；同时提供会校验一致性。',
      },
    ],
    outputs: [
      '值冲刑害破关系',
      '三合六合三会关系',
      '年干五行辅助关系',
      '计算链',
      '主证辅证反证',
      '信息量限制',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '生肖流年必须明确提供 year 或 yearGanZhi，不根据运行日期静默选择流年。',
      '生肖流年是只使用出生年支的轻量关系模型，不替代完整八字或现实资料。',
    ],
  },
  {
    id: 'taiyi',
    name: '太乙神数',
    category: 'divination',
    methods: options([{ value: 'year', label: '年计' }]),
    defaultMethod: 'year',
    inputs: [
      {
        id: 'year',
        label: '公历年份',
        type: 'number',
        required: true,
        description: '年计必须提供。',
      },
      {
        id: 'scope',
        label: '计式范围',
        type: 'select',
        required: false,
        options: options([{ value: 'year', label: '年计' }]),
      },
    ],
    outputs: ['七十二局', '阴阳遁', '太乙', '文昌', '始击', '主客定算', '十六神', '结构化证据'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: ['当前只开放完成积年与七十二局立成校勘的年计；月、日、时计等待完整古籍历法链校勘。'],
  },
  {
    id: 'wuyun-liuqi',
    name: '五运六气',
    category: 'calendar',
    inputs: [
      {
        id: 'year',
        label: '公历年',
        type: 'number',
        required: false,
        description: '与年干支至少提供一项；按该公历年年中所属年柱换算。',
      },
      {
        id: 'yearGanZhi',
        label: '年干支',
        type: 'text',
        required: false,
        description: '明确提供时以此为准；与公历年同时提供会校验一致性。',
      },
      questionInput,
    ],
    outputs: [
      '岁运五行',
      '太过不及',
      '五音太少',
      '五步主运',
      '五步客运',
      '五步交司日期',
      '逐步主客运五行关系',
      '司天',
      '在泉',
      '气运相临',
      '天符岁会等五类符会',
      '六步节令',
      '六步主气',
      '六步客气',
      '逐步主客五行关系',
      '结构化计算链',
      '传统依据与适用边界',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '当前实现岁运、五步主客运、传统交司日期、气运相临、五类符会和六步节令关系；交司日期不伪装成精确到时分秒的现代时刻，也不替代气象资料或医疗诊断。',
      '吴谦《运气要诀》逐项符会名单去重为26年，与原文“二十八年”汇总不一致；结果采用逐项定义并显式保留校勘说明。',
    ],
  },
  {
    id: 'huangji-jingshi',
    name: '皇极经世',
    category: 'calendar',
    inputs: [
      {
        id: 'epochYear',
        label: '纪元年坐标',
        type: 'number',
        required: false,
        description: '研究自定义纪元时提供；普通公元值年卦无需填写。',
      },
      {
        id: 'year',
        label: '目标公元年',
        type: 'number',
        required: false,
        description: '普通用户直接填写公元年；自定义纪元时也可作为目标坐标。',
      },
      {
        id: 'elapsedYears',
        label: '距纪元已过年数',
        type: 'number',
        required: false,
        description: '仅用于自定义纪元，0 表示纪元第一年。',
      },
      questionInput,
    ],
    outputs: [
      '元会运世位置',
      '各层一基序号',
      '各层起止年坐标',
      '各层已过与剩余年数',
      '下一世运会元边界',
      '会内统卦与运卦',
      '六十年统卦与十年卦',
      '值年卦与干支',
      '值年卦互卦、错卦、综卦',
      '面向普通用户的分层解读资料',
      '周期换算规则',
      '结构化计算链',
      '传统依据与纪元依赖',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '普通用户只需提供公元年，默认采用公元前67017年为本元起点、1984年鼎卦为甲子值年锚点的通行排法；自定义纪元模式仍保留为研究入口。',
    ],
  },
  {
    id: 'qizheng',
    name: '七政四余',
    category: 'chart',
    available: true,
    inputs: [birthProfileInput],
    outputs: [
      '七政四余十一星',
      '二十八宿真实距星边界',
      '命身十二宫',
      '宿度与庙旺',
      '吊照相位',
      '位置来源与精度分层',
      '月相与出生时刻光照',
      '结构化证据',
      '真太阳时宫位校正证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['precise-clock-time'],
      batch: false,
    },
    notes: [
      '七政、罗睺、计都与月孛采用现代天文位置；紫炁采用《七政算内篇》古法均速模型，结果明确区分精度层级。',
      '二十八宿以SIMBAD距星J2000坐标、自行和目标日期黄道转换形成真实宿界；真太阳时只校正传统命身十二宫，不改变现代天体计算时刻。',
    ],
  },
  {
    id: 'xuankong',
    name: '玄空飞星',
    category: 'environment',
    inputs: [
      {
        id: 'year',
        label: '建造或起运年',
        type: 'number',
        required: true,
        description: '独立玄空飞星排盘必须提供。',
      },
      {
        id: 'sitMountain',
        label: '坐山',
        type: 'text',
        required: false,
        description: '二十四山；可与朝向或度数二选一。',
      },
      {
        id: 'facingMountain',
        label: '朝向',
        type: 'text',
        required: false,
      },
      {
        id: 'facingDegree',
        label: '朝向度数',
        type: 'number',
        required: false,
        description: '正北 0°，顺时针；可与二十四山二选一。',
      },
      {
        id: 'sitDegree',
        label: '坐山度数',
        type: 'number',
        required: false,
      },
      {
        id: 'measurementUncertaintyDegrees',
        label: '测量误差',
        type: 'number',
        required: false,
      },
      questionInput,
    ],
    outputs: [
      '三元九运',
      '山向',
      '下卦',
      '运盘',
      '山盘',
      '向盘',
      '局型',
      '组合互参',
      '到山到向',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '玄空飞星输出可复现的下卦三盘、局型、组合与证据，不覆盖形峦、玄空大卦或替卦口诀。',
      '度数落在二十四山边界附近时会返回候选山向与测量警告，但仍按下卦分别计算。',
    ],
  },
  {
    id: 'residential',
    name: '住宅风水',
    category: 'environment',
    inputs: [
      {
        id: 'birthYear',
        label: '出生公历年',
        type: 'number',
        required: false,
        description: '与 gender 同时提供可计算八宅命卦；也可直接提供 mingGua。',
      },
      { id: 'birthMonth', label: '出生月', type: 'number', required: false },
      { id: 'birthDay', label: '出生日', type: 'number', required: false },
      {
        id: 'gender',
        label: '性别',
        type: 'select',
        required: false,
        options: options([
          { value: 'male', label: '男' },
          { value: 'female', label: '女' },
        ]),
      },
      { id: 'mingGua', label: '直接指定命卦', type: 'text', required: false },
      { id: 'year', label: '建造或起运年', type: 'number', required: false },
      {
        id: 'sitMountain',
        label: '坐山',
        type: 'text',
        required: false,
        description: '二十四山；可与朝向或度数二选一。',
      },
      { id: 'facingMountain', label: '朝向', type: 'text', required: false },
      {
        id: 'facingDegree',
        label: '朝向度数',
        type: 'number',
        required: false,
        description: '正北 0°，顺时针；可与二十四山二选一。',
      },
      { id: 'sitDegree', label: '坐山度数', type: 'number', required: false },
      {
        id: 'doorToInteriorDegree',
        label: '大门朝屋内角度',
        type: 'number',
        required: false,
        description: '站在大门处面向屋内测量，范围 0° 至小于 360°。',
      },
      {
        id: 'northReference',
        label: '北向基准',
        type: 'select',
        required: false,
        options: options([
          { value: 'unspecified', label: '未指定' },
          { value: 'magnetic', label: '磁北' },
          { value: 'true', label: '真北' },
        ]),
      },
      {
        id: 'magneticDeclinationDegrees',
        label: '磁偏角',
        type: 'number',
        required: false,
      },
      {
        id: 'measurementUncertaintyDegrees',
        label: '测量误差',
        type: 'number',
        required: false,
      },
    ],
    outputs: [
      '宅运结构',
      '人宅适配',
      '八宅命卦宅卦',
      '玄空下卦运盘山盘向盘',
      '合参要点',
      '行动建议',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '住宅风水为产品统一入口：后台分别计算八宅与玄空飞星后合参，不生成综合吉凶总分，也不互相改写两套规则。',
      '至少提供山向/门向度数，或居住人出生年与性别/命卦之一；玄空宅运层还必须提供住宅建造年或起运年，缺年时不得用当前年份代替。底层 bazhai 与 xuankong 能力仍保留。',
    ],
  },
];

/** 返回可安全序列化的能力清单，供网站、App、API 或 MCP 自动生成入口。 */
export function getCapabilities(): MingyuCapabilities {
  return {
    package: 'mingyu-core',
    version: MINGYU_CORE_VERSION,
    schemaVersion: MINGYU_SCHEMA_VERSION,
    systems: structuredClone(systems),
  };
}

export function getSystemCapability(id: string): SystemCapability | undefined {
  const capability = systems.find((item) => item.id === id);
  return capability ? structuredClone(capability) : undefined;
}

/** 查询必须存在的能力；适合客户端、API 和表单把未知 ID 转成明确错误。 */
export function requireSystemCapability(id: SystemCapabilityId | string): SystemCapability {
  const capability = getSystemCapability(id);
  if (capability) return capability;
  throw new MingyuCoreError({
    code: 'CAPABILITY_NOT_FOUND',
    category: 'validation',
    message: `不存在能力 ${id || '（空）'}。`,
    field: 'id',
    recoverable: true,
    context: { id, availableIds: [...SYSTEM_CAPABILITY_IDS] },
  });
}
