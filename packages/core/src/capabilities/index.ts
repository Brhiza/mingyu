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
    unknownBirthTime: 'full' | 'degraded' | 'unsupported';
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
  description: '推荐使用统一 BirthProfile；必须依赖时辰的算法不会用占位时辰替代未知时辰。',
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
  unknownBirthTime: 'full' as const,
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
    outputs: ['标准时间', '真太阳时', '经度修正', '均时差', '跨日状态', '时辰索引'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      unknownBirthTime: 'unsupported',
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
      unknownBirthTime: 'unsupported',
      batch: false,
    },
    notes: ['当前排盘需要时辰；统一档案会明确返回未知时辰诊断，不会自动代入占位时辰。'],
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
      unknownBirthTime: 'unsupported',
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
      '本命与行运作用域',
      '返照',
      '次限',
      '太阳弧',
      '双盘相位',
      '跨盘落宫',
      '双盘结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      unknownBirthTime: 'unsupported',
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
    outputs: ['九宫', '值符值使', '格局', '旺衰', '宫位关系', '方位', '应期'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'full',
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
    outputs: ['主卦', '变卦', '互卦', '动爻', '纳甲', '六亲', '六神', '旬空', '反吟伏吟'],
    supports: {
      seed: true,
      customRandomSource: true,
      replay: true,
      trueSolarTime: false,
      unknownBirthTime: 'full',
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
    outputs: ['主卦', '互卦', '变卦', '体用', '动爻', '五行关系'],
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
    outputs: ['起因宫', '过程宫', '结果宫', '五行关系', '旺衰', '应期', '方位'],
    supports: randomSupports,
  },
  {
    id: 'liuren',
    name: '大六壬',
    category: 'divination',
    methods: options(LIUREN_TEMPLATE_OPTIONS),
    defaultMethod: 'general',
    inputs: [{ id: 'date', label: '起课时间', type: 'datetime', required: false }, questionInput],
    outputs: ['天地盘', '四课', '三传', '天将', '课体', '神煞'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'full',
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
    outputs: ['抽牌顺序', '牌位', '正逆位', '关键词'],
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
    outputs: ['抽牌顺序', '牌位', '相邻组合', '布局证据'],
    supports: randomSupports,
  },
  {
    id: 'ssgw',
    name: '三山国王灵签',
    category: 'divination',
    inputs: [questionInput],
    outputs: ['签号', '签诗', '典故', '传统解读', '分类解读'],
    supports: randomSupports,
    notes: ['签文数据治理独立于通用接口，本能力清单不改变权威签文内容。'],
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
    outputs: ['候选日', '避开日', '候选时辰', '参与人关系', '评分依据'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'unsupported',
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
    outputs: ['二十四山', '坐向', '宅卦', '命卦', '命宅关系', '八宫', '边界提示'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'full',
      batch: false,
    },
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
    outputs: ['七十二局', '阴阳遁', '太乙', '文昌', '始击', '主客定算', '十六神'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'full',
      batch: false,
    },
  },
  {
    id: 'qizheng',
    name: '七政四余',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: ['七政', '四余', '紫炁', '十二宫', '命身宫', '命主', '庙旺', '神煞', '相位'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'unsupported',
      batch: false,
    },
    optionalDependencies: ['celestine'],
    notes: ['现有七政四余输入尚未拆分天体计算时刻与传统真太阳时宫位口径，因此不宣称支持真太阳时。'],
  },
  {
    id: 'birthTimeReverse',
    name: '出生时辰反推',
    category: 'chart',
    inputs: [
      {
        ...birthProfileInput,
        description: '只需出生年月日和性别，时辰应标记为未知。',
      },
      { id: 'evidence', label: '人生事实', type: 'object', required: false },
    ],
    outputs: ['年月日三柱', '十二时辰候选', '候选四柱差异', '时柱十神', '地支关系'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      unknownBirthTime: 'full',
      batch: true,
    },
    notes: ['核心负责生成十二时辰候选；基于人生事实的筛选与解释仍需调用方完成。'],
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
