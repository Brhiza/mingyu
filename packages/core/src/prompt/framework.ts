/**
 * 统一提示词选择框架。
 *
 * 方法决定采用哪一种盘面或占法，主题决定从资料中回答什么，细项和范围
 * 进一步收窄任务。这里仅登记可用能力与任务组织规则，不替代任何排盘算法。
 */

export const PROMPT_TOPIC_IDS = [
  'general',
  'relationship',
  'career',
  'wealth',
  'health',
  'family',
  'academic',
  'timing',
] as const;

export type PromptTopicId = (typeof PROMPT_TOPIC_IDS)[number];
export type PromptSubtopicId = string;

export const PROMPT_SCOPE_IDS = [
  'natal',
  'full',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'event',
  'date-range',
  'cycle',
  'custom',
] as const;

export type PromptScopeId = (typeof PROMPT_SCOPE_IDS)[number];

export type PromptMethodCategoryId =
  'chart' | 'divination' | 'cards-signs' | 'timing-calendar' | 'fengshui' | 'name-number';

export const PROMPT_METHOD_IDS = [
  'calendar.trueSolarBirth',
  'calendar.astronomicalTime',
  'calendar.moonPhase',
  'calendar.solarIllumination',
  'calendar.solarTerm',
  'bazi',
  'ziwei',
  'bazi-ziwei',
  'astrolabe',
  'astrolabe-synastry',
  'qimen-lifetime',
  'qizheng',
  'zodiac',
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'qimen',
  'liuren',
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'kongming',
  'almanac',
  'taiyi',
  'wuyun-liuqi',
  'huangji-jingshi',
  'bazhai',
  'xuankong',
  'residential',
  'name.generation',
  'name.chineseAnalysis',
  'name.characterQuery',
  'name.numberEnergy',
  'name.zhugeDivination',
  'name.kongmingDivination',
] as const;

export type PromptMethodId = (typeof PROMPT_METHOD_IDS)[number];

export interface PromptOption {
  id: string;
  label: string;
}

export interface PromptMethodCapability {
  methodId: PromptMethodId;
  capabilityId?: string;
  categoryId: PromptMethodCategoryId;
  categoryLabel: string;
  methodLabel: string;
  topicIds: readonly PromptTopicId[];
  subtopics: Partial<Record<PromptTopicId, readonly PromptOption[]>>;
  scopeIds: readonly PromptScopeId[];
  defaultScope: PromptScopeId;
  requiredFacts: readonly string[];
  evidenceFields: readonly string[];
  taskFields: readonly string[];
}

export interface PromptSelection {
  methodId: PromptMethodId;
  categoryId: PromptMethodCategoryId;
  categoryLabel: string;
  methodLabel: string;
  topicId: PromptTopicId;
  topicLabel: string;
  subtopicId?: string;
  subtopicLabel?: string;
  scope: PromptScopeId;
  scopeLabel: string;
  source: 'default' | 'user' | 'legacy';
}

export type PromptSelectionErrorCode =
  | 'INVALID_METHOD'
  | 'INVALID_TOPIC'
  | 'UNSUPPORTED_TOPIC'
  | 'INVALID_SUBTOPIC'
  | 'UNSUPPORTED_SUBTOPIC'
  | 'INVALID_SCOPE'
  | 'UNSUPPORTED_SCOPE';

export interface PromptSelectionError {
  ok: false;
  code: PromptSelectionErrorCode;
  field: 'methodId' | 'topicId' | 'subtopicId' | 'scope';
  value?: string;
  message: string;
}

export interface PromptSelectionSuccess {
  ok: true;
  selection: PromptSelection;
}

export type PromptSelectionResolution = PromptSelectionSuccess | PromptSelectionError;

const TOPIC_LABELS: Record<PromptTopicId, string> = {
  general: '通用',
  relationship: '感情',
  career: '事业',
  wealth: '财运',
  health: '身心',
  family: '家庭',
  academic: '学业',
  timing: '时机',
};

const SCOPE_LABELS: Record<PromptScopeId, string> = {
  natal: '本命',
  full: '完整资料',
  decadal: '大限/大运',
  yearly: '流年/年计',
  monthly: '流月/月计',
  daily: '流日/日计',
  hourly: '流时/时计',
  event: '当前事项',
  'date-range': '日期范围',
  cycle: '周期层级',
  custom: '自定义范围',
};

const TOPIC_SUBTOPIC_OPTIONS: Record<PromptTopicId, readonly PromptOption[]> = {
  general: [],
  relationship: [
    { id: 'partner', label: '对象与匹配' },
    { id: 'reconciliation', label: '复合与修复' },
    { id: 'marriage', label: '长期关系' },
  ],
  career: [
    { id: 'job-change', label: '工作变动' },
    { id: 'startup', label: '创业与合作' },
    { id: 'workplace', label: '职场发展' },
  ],
  wealth: [
    { id: 'income', label: '收入与积累' },
    { id: 'investment', label: '投资与风险' },
    { id: 'partnership', label: '合伙求财' },
  ],
  health: [
    { id: 'body', label: '身体状态' },
    { id: 'emotion', label: '情绪与压力' },
    { id: 'routine', label: '作息调护' },
  ],
  family: [
    { id: 'parents', label: '父母长辈' },
    { id: 'children', label: '子女亲缘' },
    { id: 'home', label: '家宅与居住' },
  ],
  academic: [
    { id: 'exam', label: '考试与申请' },
    { id: 'advanced-study', label: '进修与考证' },
    { id: 'talent', label: '学习优势' },
  ],
  timing: [
    { id: 'recent', label: '近期节奏' },
    { id: 'yearly', label: '年度节点' },
    { id: 'decision', label: '决策时机' },
  ],
};

const METHOD_LABELS: Record<PromptMethodId, string> = {
  'calendar.trueSolarBirth': '出生真太阳时',
  'calendar.astronomicalTime': '天文时间尺度',
  'calendar.moonPhase': '月相与朔弦望',
  'calendar.solarIllumination': '太阳高度与曙暮光',
  'calendar.solarTerm': '二十四节气',
  bazi: '八字',
  ziwei: '紫微斗数',
  'bazi-ziwei': '八字紫微合参',
  astrolabe: '西洋星盘',
  'astrolabe-synastry': '西占双盘合盘',
  'qimen-lifetime': '奇门终身局',
  qizheng: '七政四余',
  zodiac: '生肖流年',
  liuyao: '六爻',
  meihua: '梅花易数',
  xiaoliuren: '小六壬',
  jinkoujue: '金口诀',
  qimen: '时家奇门',
  liuren: '大六壬',
  tarot: '塔罗',
  lenormand: '雷诺曼',
  ssgw: '三山国王灵签',
  zhuge: '诸葛神数',
  kongming: '孔明神卦',
  almanac: '黄历择日',
  taiyi: '太乙神数',
  'wuyun-liuqi': '五运六气',
  'huangji-jingshi': '皇极经世',
  bazhai: '八宅',
  xuankong: '玄空飞星',
  residential: '住宅风水',
  'name.generation': '中文起名',
  'name.chineseAnalysis': '姓名解析',
  'name.characterQuery': '汉字查询',
  'name.numberEnergy': '数字能量',
  'name.zhugeDivination': '诸葛取数',
  'name.kongmingDivination': '孔明神卦',
};

const CATEGORY_LABELS: Record<PromptMethodCategoryId, string> = {
  chart: '命盘',
  divination: '占问',
  'cards-signs': '牌卡与签卦',
  'timing-calendar': '择时与历法',
  fengshui: '环境风水',
  'name-number': '姓名与数理',
};

const CHART_METHODS = new Set<PromptMethodId>([
  'bazi',
  'ziwei',
  'bazi-ziwei',
  'astrolabe',
  'astrolabe-synastry',
  'qimen-lifetime',
  'qizheng',
  'zodiac',
]);
const DIVINATION_METHODS = new Set<PromptMethodId>([
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'qimen',
  'liuren',
]);
const CARD_SIGN_METHODS = new Set<PromptMethodId>([
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'kongming',
]);
const TIMING_METHODS = new Set<PromptMethodId>([
  'calendar.trueSolarBirth',
  'calendar.astronomicalTime',
  'calendar.moonPhase',
  'calendar.solarIllumination',
  'calendar.solarTerm',
  'almanac',
  'taiyi',
  'wuyun-liuqi',
  'huangji-jingshi',
]);
const FENGSHUI_METHODS = new Set<PromptMethodId>(['bazhai', 'xuankong', 'residential']);
const NAME_NUMBER_METHODS = new Set<PromptMethodId>([
  'name.generation',
  'name.chineseAnalysis',
  'name.characterQuery',
  'name.numberEnergy',
  'name.zhugeDivination',
  'name.kongmingDivination',
]);

const FULL_TOPIC_IDS = PROMPT_TOPIC_IDS;
const CHART_TOPIC_IDS: readonly PromptTopicId[] = FULL_TOPIC_IDS;
const DIVINATION_TOPIC_IDS: readonly PromptTopicId[] = [
  'general',
  'relationship',
  'career',
  'wealth',
  'family',
  'academic',
  'timing',
];
const CARD_SIGN_TOPIC_IDS: readonly PromptTopicId[] = [
  'general',
  'relationship',
  'career',
  'wealth',
  'health',
  'family',
  'academic',
  'timing',
];
const ALMANAC_TOPIC_IDS: readonly PromptTopicId[] = [
  'general',
  'relationship',
  'career',
  'wealth',
  'family',
  'academic',
  'timing',
];
const FENGSHUI_TOPIC_IDS: readonly PromptTopicId[] = [
  'general',
  'relationship',
  'career',
  'wealth',
  'family',
  'timing',
];
const NAME_NUMBER_TOPIC_IDS: readonly PromptTopicId[] = ['general'];

const DEFAULT_SCOPE_BY_METHOD: Partial<Record<PromptMethodId, PromptScopeId>> = {
  'calendar.trueSolarBirth': 'custom',
  'calendar.astronomicalTime': 'custom',
  'calendar.moonPhase': 'custom',
  'calendar.solarIllumination': 'custom',
  'calendar.solarTerm': 'custom',
  bazi: 'decadal',
  ziwei: 'decadal',
  'bazi-ziwei': 'decadal',
  astrolabe: 'yearly',
  'astrolabe-synastry': 'natal',
  'qimen-lifetime': 'natal',
  qizheng: 'natal',
  zodiac: 'yearly',
  liuyao: 'event',
  meihua: 'event',
  xiaoliuren: 'event',
  jinkoujue: 'event',
  qimen: 'hourly',
  liuren: 'event',
  tarot: 'event',
  lenormand: 'event',
  ssgw: 'event',
  zhuge: 'event',
  kongming: 'event',
  almanac: 'date-range',
  taiyi: 'yearly',
  'wuyun-liuqi': 'yearly',
  'huangji-jingshi': 'cycle',
  bazhai: 'natal',
  xuankong: 'natal',
  residential: 'natal',
  'name.generation': 'natal',
  'name.chineseAnalysis': 'natal',
  'name.characterQuery': 'custom',
  'name.numberEnergy': 'custom',
  'name.zhugeDivination': 'event',
  'name.kongmingDivination': 'event',
};

const SCOPE_IDS_BY_CATEGORY: Record<PromptMethodCategoryId, readonly PromptScopeId[]> = {
  chart: ['natal', 'full', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'custom'],
  divination: ['event', 'hourly', 'daily', 'monthly', 'yearly', 'custom'],
  'cards-signs': ['event', 'custom'],
  'timing-calendar': ['custom', 'date-range', 'cycle', 'yearly', 'monthly', 'daily', 'hourly'],
  fengshui: ['natal', 'full', 'yearly', 'monthly', 'custom'],
  'name-number': ['natal', 'event', 'custom'],
};

const METHOD_SCOPE_OVERRIDES: Partial<Record<PromptMethodId, readonly PromptScopeId[]>> = {
  'calendar.trueSolarBirth': ['custom'],
  'calendar.astronomicalTime': ['custom'],
  'calendar.moonPhase': ['custom'],
  'calendar.solarIllumination': ['custom', 'date-range'],
  'calendar.solarTerm': ['custom', 'date-range'],
  bazi: ['natal', 'full', 'decadal', 'yearly', 'monthly', 'daily'],
  ziwei: ['natal', 'full', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'],
  'bazi-ziwei': ['natal', 'full', 'decadal', 'yearly', 'monthly', 'daily'],
  astrolabe: ['natal', 'full', 'yearly', 'monthly', 'daily'],
  'astrolabe-synastry': ['natal'],
  'qimen-lifetime': ['natal', 'full'],
  qizheng: ['natal', 'full', 'yearly', 'monthly', 'daily'],
  zodiac: ['yearly'],
  almanac: ['date-range'],
  taiyi: ['yearly', 'monthly', 'daily', 'hourly'],
  'wuyun-liuqi': ['yearly'],
  'huangji-jingshi': ['cycle'],
  bazhai: ['natal'],
  xuankong: ['natal', 'yearly', 'monthly'],
  residential: ['natal', 'yearly', 'monthly'],
  'name.characterQuery': ['custom'],
  'name.numberEnergy': ['custom'],
  'name.zhugeDivination': ['event'],
  'name.kongmingDivination': ['event'],
};

const METHOD_TOPIC_OVERRIDES: Partial<Record<PromptMethodId, readonly PromptTopicId[]>> = {
  'huangji-jingshi': ['general', 'timing'],
  'wuyun-liuqi': ['general', 'health', 'timing'],
  'calendar.trueSolarBirth': ['general', 'timing'],
  'calendar.astronomicalTime': ['general', 'timing'],
  'calendar.moonPhase': ['general', 'timing'],
  'calendar.solarIllumination': ['general', 'timing'],
  'calendar.solarTerm': ['general', 'timing'],
  'name.characterQuery': ['general'],
  'name.numberEnergy': ['general'],
  'name.zhugeDivination': ['general'],
  'name.kongmingDivination': ['general'],
};

const METHOD_SUBTOPIC_OVERRIDES: Partial<
  Record<PromptMethodId, Partial<Record<PromptTopicId, readonly PromptOption[]>>>
> = {
  'name.generation': { general: [{ id: 'naming', label: '起名方案' }] },
  'name.chineseAnalysis': { general: [{ id: 'name-analysis', label: '姓名解析' }] },
  'name.characterQuery': { general: [{ id: 'character-query', label: '汉字查询' }] },
  'name.numberEnergy': { general: [{ id: 'number-energy', label: '号码能量' }] },
  'name.zhugeDivination': { general: [{ id: 'zhuge-divination', label: '诸葛取数' }] },
  'name.kongmingDivination': { general: [{ id: 'kongming-divination', label: '孔明神卦' }] },
};

const METHOD_CAPABILITY_IDS: Partial<Record<PromptMethodId, string>> = {
  'bazi-ziwei': 'bazi-ziwei-synthesis',
  'astrolabe-synastry': 'astrolabe',
  'qimen-lifetime': 'qimen',
  'name.zhugeDivination': 'name.zhugeDivination',
  'name.kongmingDivination': 'name.kongmingDivination',
};

function resolveCategory(methodId: PromptMethodId): PromptMethodCategoryId {
  if (CHART_METHODS.has(methodId)) return 'chart';
  if (DIVINATION_METHODS.has(methodId)) return 'divination';
  if (CARD_SIGN_METHODS.has(methodId)) return 'cards-signs';
  if (TIMING_METHODS.has(methodId)) return 'timing-calendar';
  if (FENGSHUI_METHODS.has(methodId)) return 'fengshui';
  if (NAME_NUMBER_METHODS.has(methodId)) return 'name-number';
  return 'divination';
}

function resolveTopicIds(methodId: PromptMethodId, categoryId: PromptMethodCategoryId) {
  if (METHOD_TOPIC_OVERRIDES[methodId]) return METHOD_TOPIC_OVERRIDES[methodId]!;
  if (categoryId === 'chart') return CHART_TOPIC_IDS;
  if (categoryId === 'divination') return DIVINATION_TOPIC_IDS;
  if (categoryId === 'cards-signs') return CARD_SIGN_TOPIC_IDS;
  if (categoryId === 'timing-calendar') return ALMANAC_TOPIC_IDS;
  if (categoryId === 'fengshui') return FENGSHUI_TOPIC_IDS;
  return NAME_NUMBER_TOPIC_IDS;
}

function getEvidenceFields(methodId: PromptMethodId, categoryId: PromptMethodCategoryId) {
  if (methodId === 'bazi') {
    return ['四柱干支', '月令与日主旺衰', '十神格局', '调候喜忌', '已提供的岁运'];
  }
  if (methodId === 'ziwei' || methodId === 'bazi-ziwei') {
    return ['命宫与身宫', '目标主题相关宫位', '三方四正', '生年四化与已提供运限四化'];
  }
  if (methodId === 'liuyao') {
    return ['世应', '用神与六亲', '动爻变爻', '月日旺衰、空破与伏神'];
  }
  if (methodId === 'liuren') {
    return ['四课', '三传', '月将与天将', '课体与类神'];
  }
  if (methodId === 'tarot' || methodId === 'lenormand') {
    return ['牌阵与牌位', '原始抽牌顺序', '正逆位或牌面组合'];
  }
  if (categoryId === 'fengshui') return ['已提供的坐向、宅卦与运盘资料'];
  if (categoryId === 'timing-calendar') return ['已提供的日期、时间或周期层级资料'];
  return ['原始排盘、起卦、抽签或输入资料'];
}

function getRequiredFacts(methodId: PromptMethodId, categoryId: PromptMethodCategoryId) {
  if (methodId === 'bazi') return ['出生日期与时辰', '四柱计算结果'];
  if (methodId === 'ziwei' || methodId === 'bazi-ziwei') return ['出生日期与时辰', '对应命盘资料'];
  if (categoryId === 'fengshui') return ['住宅坐向或已提供的风水盘资料'];
  if (categoryId === 'timing-calendar') return ['目标日期、时间或周期'];
  return ['本次方法的原始结果'];
}

function getTaskFields(methodId: PromptMethodId, categoryId: PromptMethodCategoryId) {
  if (methodId === 'bazi' || methodId === 'ziwei' || methodId === 'bazi-ziwei') {
    return ['主题相关证据', '本命与已提供范围的分层判断', '问题对应的结论'];
  }
  if (categoryId === 'cards-signs')
    return ['原始牌签或卦象', '主题对应的牌位/签意', '问题对应的结论'];
  return ['原始结果', '主题对应的证据', '问题对应的结论'];
}

function buildMethodCapability(methodId: PromptMethodId): PromptMethodCapability {
  const categoryId = resolveCategory(methodId);
  const topicIds = resolveTopicIds(methodId, categoryId);
  const scopeIds = METHOD_SCOPE_OVERRIDES[methodId] ?? SCOPE_IDS_BY_CATEGORY[categoryId];
  const defaultScope = DEFAULT_SCOPE_BY_METHOD[methodId] ?? scopeIds[0]!;
  const subtopics = Object.fromEntries(
    topicIds
      .filter((topicId) => TOPIC_SUBTOPIC_OPTIONS[topicId].length > 0)
      .map((topicId) => [topicId, TOPIC_SUBTOPIC_OPTIONS[topicId]]),
  ) as Partial<Record<PromptTopicId, readonly PromptOption[]>>;
  Object.assign(subtopics, METHOD_SUBTOPIC_OVERRIDES[methodId] ?? {});
  return {
    methodId,
    capabilityId: METHOD_CAPABILITY_IDS[methodId] ?? methodId,
    categoryId,
    categoryLabel: CATEGORY_LABELS[categoryId],
    methodLabel: METHOD_LABELS[methodId],
    topicIds,
    subtopics,
    scopeIds,
    defaultScope,
    requiredFacts: getRequiredFacts(methodId, categoryId),
    evidenceFields: getEvidenceFields(methodId, categoryId),
    taskFields: getTaskFields(methodId, categoryId),
  };
}

export const PROMPT_METHOD_CAPABILITIES = Object.fromEntries(
  PROMPT_METHOD_IDS.map((methodId) => [methodId, buildMethodCapability(methodId)]),
) as Record<PromptMethodId, PromptMethodCapability>;

const LEGACY_METHOD_ID_MAP: Record<string, PromptMethodId> = {
  bazi_ziwei: 'bazi-ziwei',
  'bazi-ziwei-synthesis': 'bazi-ziwei',
  astrology: 'astrolabe',
  'astrolabe-synastry': 'astrolabe-synastry',
  qimenLifetime: 'qimen-lifetime',
};

const LEGACY_TOPIC_ID_MAP: Record<string, PromptTopicId> = {
  marriage: 'relationship',
  love: 'relationship',
  'relationship-push': 'relationship',
  'relationship-decision': 'relationship',
  'reconciliation-decision': 'relationship',
  job: 'career',
  work: 'career',
  'job-change': 'career',
  'startup-partnership': 'career',
  'investment-partnership': 'wealth',
  money: 'wealth',
  finance: 'wealth',
  body: 'health',
  emotion: 'health',
  parents: 'family',
  children: 'family',
  home: 'family',
  'home-move': 'family',
  'settle-relocate': 'family',
  study: 'academic',
  exam: 'academic',
  'study-advance': 'academic',
  'exam-landing': 'academic',
  recent: 'timing',
  fortune: 'timing',
  cycle: 'timing',
};

const LEGACY_SUBTOPIC_ID_MAP: Record<string, string> = {
  'relationship-push': 'partner',
  'relationship-decision': 'reconciliation',
  'reconciliation-decision': 'reconciliation',
  marriage: 'marriage',
  'job-change': 'job-change',
  'startup-partnership': 'startup',
  'investment-partnership': 'investment',
  'study-advance': 'advanced-study',
  'exam-landing': 'exam',
  'home-move': 'home',
  'settle-relocate': 'home',
  recent: 'recent',
};

const LEGACY_SCOPE_ID_MAP: Record<string, PromptScopeId> = {
  origin: 'natal',
  dayun: 'decadal',
  year: 'yearly',
  month: 'monthly',
  day: 'daily',
  hour: 'hourly',
};

function normalizeMethodId(raw: string | null | undefined): PromptMethodId | undefined {
  if (!raw) return undefined;
  const clean = raw.trim();
  if ((PROMPT_METHOD_IDS as readonly string[]).includes(clean)) return clean as PromptMethodId;
  return LEGACY_METHOD_ID_MAP[clean];
}

function resolveTopicId(raw: string | null | undefined) {
  if (raw === undefined || raw === null) {
    return { topicId: 'general' as const, source: 'default' as const };
  }
  if (!raw.trim()) return { topicId: undefined, source: 'user' as const };
  const clean = raw.trim().toLowerCase();
  if ((PROMPT_TOPIC_IDS as readonly string[]).includes(clean)) {
    return { topicId: clean as PromptTopicId, source: 'user' as const };
  }
  const legacy = LEGACY_TOPIC_ID_MAP[clean];
  return legacy
    ? { topicId: legacy, source: 'legacy' as const }
    : { topicId: undefined, source: 'user' as const };
}

function normalizeScopeId(raw: string | null | undefined) {
  if (!raw || !raw.trim()) return undefined;
  const clean = raw.trim().toLowerCase();
  if ((PROMPT_SCOPE_IDS as readonly string[]).includes(clean)) return clean as PromptScopeId;
  return LEGACY_SCOPE_ID_MAP[clean];
}

export function getPromptMethodCapability(methodId: string): PromptMethodCapability | undefined {
  const normalized = normalizeMethodId(methodId);
  return normalized ? PROMPT_METHOD_CAPABILITIES[normalized] : undefined;
}

export function getPromptMethodCapabilities() {
  return PROMPT_METHOD_IDS.map((methodId) => structuredClone(PROMPT_METHOD_CAPABILITIES[methodId]));
}

export function getPromptTopicOptions(methodId?: string): PromptOption[] {
  const capability = methodId ? getPromptMethodCapability(methodId) : undefined;
  const topicIds = capability?.topicIds ?? PROMPT_TOPIC_IDS;
  return topicIds.map((id) => ({ id, label: TOPIC_LABELS[id] }));
}

export function getPromptSubtopicOptions(topicId: string, methodId?: string): PromptOption[] {
  const topic = (PROMPT_TOPIC_IDS as readonly string[]).includes(topicId)
    ? (topicId as PromptTopicId)
    : undefined;
  if (!topic) return [];
  const capability = methodId ? getPromptMethodCapability(methodId) : undefined;
  if (capability && !capability.topicIds.includes(topic)) return [];
  return [...(capability?.subtopics[topic] ?? TOPIC_SUBTOPIC_OPTIONS[topic])];
}

export function resolvePromptSelection(input: {
  methodId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  scope?: string | null;
}): PromptSelectionResolution {
  const methodId =
    input.methodId === undefined || input.methodId === null
      ? ('bazi-ziwei' as PromptMethodId)
      : normalizeMethodId(input.methodId);
  if (!methodId) {
    return {
      ok: false,
      code: 'INVALID_METHOD',
      field: 'methodId',
      value: input.methodId ?? undefined,
      message: `不存在解读方法 ${input.methodId || '（空）'}。`,
    };
  }
  const capability = PROMPT_METHOD_CAPABILITIES[methodId];
  if (!capability) {
    return {
      ok: false,
      code: 'INVALID_METHOD',
      field: 'methodId',
      value: input.methodId ?? undefined,
      message: `不存在解读方法 ${input.methodId || '（空）'}。`,
    };
  }

  const topicResult = resolveTopicId(input.topicId);
  if (!topicResult.topicId) {
    return {
      ok: false,
      code: 'INVALID_TOPIC',
      field: 'topicId',
      value: input.topicId ?? undefined,
      message: `不存在解读主题 ${input.topicId || '（空）'}。`,
    };
  }
  if (!capability.topicIds.includes(topicResult.topicId)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_TOPIC',
      field: 'topicId',
      value: topicResult.topicId,
      message: `${capability.methodLabel}不支持解读主题“${TOPIC_LABELS[topicResult.topicId]}”。`,
    };
  }

  let subtopicId: string | undefined;
  let subtopicLabel: string | undefined;
  if (input.subtopicId?.trim()) {
    const cleanSubtopic = input.subtopicId.trim().toLowerCase();
    subtopicId = LEGACY_SUBTOPIC_ID_MAP[cleanSubtopic] ?? cleanSubtopic;
    const options =
      capability.subtopics[topicResult.topicId] ?? TOPIC_SUBTOPIC_OPTIONS[topicResult.topicId];
    const option = options.find((item) => item.id === subtopicId);
    if (!option) {
      const isKnownTopicSubtopic =
        Object.values(capability.subtopics).some((items) =>
          items.some((item) => item.id === subtopicId),
        ) ||
        Object.values(TOPIC_SUBTOPIC_OPTIONS).some((items) =>
          items.some((item) => item.id === subtopicId),
        );
      return {
        ok: false,
        code: isKnownTopicSubtopic ? 'UNSUPPORTED_SUBTOPIC' : 'INVALID_SUBTOPIC',
        field: 'subtopicId',
        value: input.subtopicId,
        message: isKnownTopicSubtopic
          ? `主题“${TOPIC_LABELS[topicResult.topicId]}”不支持细项“${input.subtopicId}”。`
          : `不存在解读细项 ${input.subtopicId}。`,
      };
    }
    subtopicLabel = option.label;
  }

  const scope =
    input.scope === undefined || input.scope === null
      ? capability.defaultScope
      : normalizeScopeId(input.scope);
  if (!scope || !(PROMPT_SCOPE_IDS as readonly string[]).includes(scope)) {
    return {
      ok: false,
      code: 'INVALID_SCOPE',
      field: 'scope',
      value: input.scope ?? undefined,
      message: `不存在解读范围 ${input.scope || '（空）'}。`,
    };
  }
  if (!capability.scopeIds.includes(scope)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_SCOPE',
      field: 'scope',
      value: scope,
      message: `${capability.methodLabel}不支持解读范围“${SCOPE_LABELS[scope]}”。`,
    };
  }

  return {
    ok: true,
    selection: {
      methodId,
      categoryId: capability.categoryId,
      categoryLabel: capability.categoryLabel,
      methodLabel: capability.methodLabel,
      topicId: topicResult.topicId,
      topicLabel: TOPIC_LABELS[topicResult.topicId],
      ...(subtopicId ? { subtopicId, subtopicLabel } : {}),
      scope,
      scopeLabel: SCOPE_LABELS[scope],
      source: topicResult.source,
    },
  };
}

export function requirePromptSelection(input: Parameters<typeof resolvePromptSelection>[0]) {
  const result = resolvePromptSelection(input);
  if (result.ok) return result.selection;
  throw new Error(result.message);
}

export function getPromptSelectionSection(selection: PromptSelection) {
  return [
    `方法：${selection.categoryLabel} · ${selection.methodLabel}`,
    `解读主题：${selection.topicLabel}`,
    selection.subtopicLabel ? `主题细项：${selection.subtopicLabel}` : '',
    `分析范围：${selection.scopeLabel}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildPromptSelectionTask(task: string, selection: PromptSelection) {
  const focus =
    selection.topicId === 'general'
      ? '先组织全部已列资料，说明整体主线与相互制约。'
      : `围绕${selection.topicLabel}${selection.subtopicLabel ? `（${selection.subtopicLabel}）` : ''}展开，综合相关宫位、干支关系与前后阶段，说明主线、成因和转折。`;
  const scope = `以${selection.scopeLabel}为重点，结合所列本命与各层时间资料推演；区分盘面事实、传统取义和条件性判断。`;
  const normalizedTask = task.trim();
  return [normalizedTask, focus, scope].filter(Boolean).join(' ');
}

export function getPromptTopicLabel(topicId: string) {
  return (PROMPT_TOPIC_IDS as readonly string[]).includes(topicId)
    ? TOPIC_LABELS[topicId as PromptTopicId]
    : topicId;
}
