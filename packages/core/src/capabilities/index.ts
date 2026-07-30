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

export { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from '../shared/version';

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
  id: string;
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
    inputs: [birthProfileInput],
    outputs: [
      '标准时间',
      '真太阳时',
      '经度修正',
      '均时差',
      '跨日状态',
      '时辰索引',
      '真太阳时结构化计算链与校正事实',
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
  },
  {
    id: 'calendar.astronomicalTime',
    name: '天文时间尺度',
    category: 'calendar',
    inputs: [
      { id: 'localDateTime', label: '当地钟表时间', type: 'datetime', required: true },
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
    notes: ['timezone 与 timeZoneId 至少提供一项；同时提供时会保留历史偏移冲突诊断。'],
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
    optionalDependencies: ['celestine'],
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
      batch: false,
    },
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
      '岁运天干、地支与藏干分层喜忌候选',
      '岁运藏干透出对应候选',
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
    optionalDependencies: ['celestine'],
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
      { value: 'time', label: '时间种子模拟三钱（兼容方法名）' },
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
        id: 'coinThrows',
        label: '逐爻三钱记录',
        type: 'array',
        required: false,
        description: '按初爻至上爻传入六组三枚铜钱及合计，字面记 2、背面记 3。',
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
    notes: [
      '`time` 是兼容方法名，实际为时间戳固定种子的三钱模拟，并非传统历数起卦。',
      '现实投掷可传入六次爻值或逐爻三钱记录。',
    ],
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
      '现场坐端应兆资料边界',
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
    methods: options(LIUREN_TEMPLATE_OPTIONS),
    defaultMethod: 'general',
    inputs: [{ id: 'date', label: '起课时间', type: 'datetime', required: false }, questionInput],
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
    methods: options(TAROT_SPREAD_OPTIONS),
    defaultMethod: 'single',
    inputs: [
      {
        id: 'spread',
        label: '牌阵',
        type: 'select',
        required: false,
        options: options(TAROT_SPREAD_OPTIONS),
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
    methods: options(LENORMAND_SPREAD_OPTIONS),
    defaultMethod: 'single',
    inputs: [
      {
        id: 'spread',
        label: '牌阵',
        type: 'select',
        required: false,
        options: options(LENORMAND_SPREAD_OPTIONS),
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
    inputs: [questionInput],
    outputs: ['签号', '签诗原文', '典故辅证', '分类解读', '掷筊记录', '随机轨迹', '结构化证据'],
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
    methods: options(ALMANAC_TOPIC_OPTIONS),
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
      '参与人关系参考',
      '候选时辰条件',
      '传统与现实约束',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: true,
    },
  },
  {
    id: 'bazhai',
    name: '八宅',
    category: 'environment',
    inputs: [
      birthProfileInput,
      {
        id: 'doorToInteriorDegree',
        label: '大门朝屋内角度',
        type: 'number',
        required: true,
        description: '站在大门处面向屋内测量，范围 0° 至小于 360°。',
      },
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
  },
  {
    id: 'zodiac',
    name: '生肖流年',
    category: 'chart',
    inputs: [
      { id: 'zodiac', label: '生肖或年支', type: 'text', required: true },
      { id: 'year', label: '流年年份', type: 'number', required: false },
      { id: 'yearGanZhi', label: '流年干支', type: 'text', required: false },
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
    notes: ['生肖流年是只使用出生年支的轻量关系模型，不替代完整八字或现实资料。'],
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
      {
        id: 'guaType',
        label: '卦型',
        type: 'select',
        required: false,
        options: options([
          { value: '下卦', label: '下卦' },
          { value: '替卦', label: '替卦' },
        ]),
      },
      questionInput,
    ],
    outputs: [
      '三元九运',
      '山向',
      '下卦与替卦',
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
      '玄空飞星输出可复现的下卦或兼向替卦三盘、局型、组合与证据，不覆盖形峦、玄空大卦或其他门派替卦口诀。',
      '可明确指定下卦或替卦；未指定时，坐山度数落在每山中央9°外会自动采用兼向替卦。',
    ],
  },
  {
    id: 'residential',
    name: '住宅风水',
    category: 'environment',
    inputs: [
      birthProfileInput,
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
      {
        id: 'guaType',
        label: '玄空卦型',
        type: 'select',
        required: false,
        options: options([
          { value: '下卦', label: '下卦' },
          { value: '替卦', label: '替卦' },
        ]),
      },
      questionInput,
    ],
    outputs: [
      '宅运结构',
      '人宅适配',
      '八宅命卦宅卦',
      '玄空下卦或替卦运盘山盘向盘',
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
