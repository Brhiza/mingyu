import {
  ALMANAC_TOPIC_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  XIAOLIUREN_METHOD_OPTIONS,
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
  description: '推荐使用统一 BirthProfile；出生小时和分钟必须完整提供。',
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
      'UTC与儒略日时间尺度证据',
      'ΔT与近似TT儒略日',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
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
      '大运',
      '流年',
      '大运流年流月流日逐层触发证据',
      '岁运并临与天克地冲',
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
      '双盘宫位叠盘',
      '双盘生年四化落点',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
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
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
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
      { id: 'date', label: '起局时间', type: 'datetime', required: false },
      questionInput,
    ],
    outputs: [
      '九宫',
      '值符值使',
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
    inputs: [
      {
        id: 'number',
        label: '起课数字',
        type: 'number',
        required: false,
        requiredWhen: { method: 'number' },
      },
      questionInput,
    ],
    outputs: [
      '起因宫',
      '过程宫',
      '结果宫',
      '五行关系',
      '旺衰',
      '相对应期节奏',
      '应期触发条件与限制',
      '方位',
      '结构化证据',
    ],
    supports: randomSupports,
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
      '参与人冲突',
      '候选时辰条件',
      '传统与现实约束',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: true,
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
      '三合六合关系',
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
    methods: options([
      { value: 'year', label: '年计' },
      { value: 'month', label: '月计' },
      { value: 'day', label: '日计' },
      { value: 'hour', label: '时计' },
      { value: 'minute', label: '分计' },
    ]),
    defaultMethod: 'year',
    inputs: [
      { id: 'date', label: '起局时间', type: 'datetime', required: false },
      {
        id: 'scope',
        label: '五计范围',
        type: 'select',
        required: false,
        options: options([
          { value: 'year', label: '年计' },
          { value: 'month', label: '月计' },
          { value: 'day', label: '日计' },
          { value: 'hour', label: '时计' },
          { value: 'minute', label: '分计' },
        ]),
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
  },
  {
    id: 'qizheng',
    name: '七政四余',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '七政',
      '四余',
      '逐星来源',
      '回归黄经',
      '项目恒星黄经',
      '宿度',
      '紫炁模型',
      '十二宫',
      '命身宫',
      '命主',
      '庙旺',
      '神煞',
      '相位容许度',
      '计算上下文',
      'IANA历史时区与夏令时诊断',
      '精度边界',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: true,
      batch: false,
    },
    optionalDependencies: ['celestine'],
    notes: ['现有七政四余输入尚未拆分天体计算时刻与传统真太阳时宫位口径，因此不宣称支持真太阳时。'],
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
