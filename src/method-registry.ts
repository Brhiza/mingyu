import type { Method } from './schema';

export type MethodCategoryId =
  | 'mingli'
  | 'ziwei-astro'
  | 'qimen-liuren'
  | 'divination'
  | 'fengshui'
  | 'name-classics';

export interface MethodCategoryGroup {
  id: MethodCategoryId;
  label: string;
  methods: readonly Method[];
}

/**
 * 39 种术数方法的唯一分类与能力注册表（SSOT）。
 * MCP Router、Web Agent、提示词契约、全局设置与框架路由统一从此处派生，避免多处硬编码漂移。
 */
export const METHOD_CATEGORY_GROUPS: readonly MethodCategoryGroup[] = [
  {
    id: 'mingli',
    label: '命理合参',
    methods: ['bazi', 'bazi-synastry', 'bazi-ziwei', 'bazi-reverse', 'minglu', 'fortune', 'instant'],
  },
  {
    id: 'ziwei-astro',
    label: '紫微星象',
    methods: ['ziwei', 'ziwei-synastry', 'qizheng', 'qizheng-range', 'astrolabe', 'astrolabe-range', 'astrolabe-synastry'],
  },
  {
    id: 'qimen-liuren',
    label: '奇门六壬',
    methods: ['qimen', 'qimen-lifetime', 'liuren', 'jinkoujue', 'xiaoliuren', 'taiyi'],
  },
  {
    id: 'divination',
    label: '占卜灵签',
    methods: ['liuyao', 'meihua', 'tarot', 'lenormand', 'random-divination', 'ssgw', 'zhuge', 'number-energy'],
  },
  {
    id: 'fengshui',
    label: '风水择日',
    methods: ['bazhai', 'xuankong', 'residential', 'almanac', 'calendar'],
  },
  {
    id: 'name-classics',
    label: '姓名典籍',
    methods: ['chinese-name', 'chinese-naming', 'zhouyi', 'character-query', 'wuyun-liuqi', 'huangji-jingshi'],
  },
];

export const METHOD_CATEGORY_IDS: readonly MethodCategoryId[] = METHOD_CATEGORY_GROUPS.map((g) => g.id);

/** 明确不支持古籍经典片段附带（includeClassics）的方法集合 */
export const NON_CLASSICS_METHODS: ReadonlySet<Method> = new Set<Method>([
  'random-divination',
  'chinese-name',
  'chinese-naming',
  'number-energy',
  'instant',
  'calendar',
  'character-query',
  'bazi-reverse',
  'zhouyi',
]);

/** 已有专属交付格式、不自动叠套通用算命框架的方法集合 */
export const AUTO_SKIP_FRAMEWORK_METHODS: ReadonlySet<Method> = new Set<Method>([
  'zhouyi',
  'calendar',
  'character-query',
  'bazi-reverse',
  'astrolabe-range',
  'qizheng-range',
]);

/** 术数体系族分类（供提示词契约、术语隔离与证据重点路由使用） */
export const BAZI_METHODS: ReadonlySet<Method> = new Set<Method>(['bazi', 'bazi-synastry']);
export const ZIWEI_METHODS: ReadonlySet<Method> = new Set<Method>(['ziwei', 'ziwei-synastry']);
export const MULTI_NATAL_METHODS: ReadonlySet<Method> = new Set<Method>(['bazi-ziwei', 'minglu', 'fortune']);
export const WESTERN_ASTRO_METHODS: ReadonlySet<Method> = new Set<Method>([
  'astrolabe',
  'astrolabe-synastry',
  'astrolabe-range',
]);
export const QIZHENG_METHODS: ReadonlySet<Method> = new Set<Method>(['qizheng', 'qizheng-range']);
export const ASTROLOGY_METHODS: ReadonlySet<Method> = new Set<Method>([
  ...WESTERN_ASTRO_METHODS,
  ...QIZHENG_METHODS,
]);
export const SYNASTRY_METHODS: ReadonlySet<Method> = new Set<Method>([
  'bazi-synastry',
  'ziwei-synastry',
  'astrolabe-synastry',
]);
export const TRADITIONAL_DIVINATION_METHODS: ReadonlySet<Method> = new Set<Method>([
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'jinkoujue',
  'xiaoliuren',
  'taiyi',
]);
export const CARD_SIGN_METHODS: ReadonlySet<Method> = new Set<Method>(['tarot', 'lenormand', 'ssgw', 'zhuge']);
export const FENGSHUI_METHODS: ReadonlySet<Method> = new Set<Method>(['bazhai', 'xuankong', 'residential']);
export const NAMING_METHODS: ReadonlySet<Method> = new Set<Method>(['chinese-name', 'chinese-naming']);
export const REFERENCE_LOOKUP_METHODS: ReadonlySet<Method> = new Set<Method>(['calendar', 'zhouyi', 'character-query']);
export const RANGE_COMPARE_METHODS: ReadonlySet<Method> = new Set<Method>(['astrolabe-range', 'qizheng-range', 'bazi-reverse']);
export const MACRO_LUCK_METHODS: ReadonlySet<Method> = new Set<Method>(['wuyun-liuqi', 'huangji-jingshi']);
