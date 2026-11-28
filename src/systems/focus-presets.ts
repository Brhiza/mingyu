import type { Method } from '../schema';

export type SynastryRelationship =
  | 'marriage'
  | 'career'
  | 'friendship'
  | 'children'
  | 'parents'
  | 'siblings';

export interface SynastryRelationshipOption {
  value: SynastryRelationship;
  label: string;
  tagLabel: string;
  stageOptions: ReadonlyArray<{ value: string; label: string }>;
}

export const SYNASTRY_RELATIONSHIP_OPTIONS: ReadonlyArray<SynastryRelationshipOption> = [
  {
    value: 'marriage',
    label: '恋爱合婚',
    tagLabel: '恋爱合婚·夫妻伴侣',
    stageOptions: [
      { value: '', label: '不限' },
      { value: '热恋交往中', label: '热恋交往中' },
      { value: '谈婚论嫁/筹备合婚', label: '谈婚论嫁' },
      { value: '已婚夫妻磨合', label: '已婚磨合' },
      { value: '异地/冷战中', label: '异地/冷战' },
      { value: '分手考虑复合', label: '考虑复合' },
    ],
  },
  {
    value: 'career',
    label: '事业合伙',
    tagLabel: '事业合伙·职场共事',
    stageOptions: [
      { value: '', label: '不限' },
      { value: '筹备合伙创业', label: '筹备合伙' },
      { value: '合作分工磨合', label: '分工磨合' },
      { value: '权责与利益谈判', label: '权责利益' },
      { value: '上下级/同事协作', label: '上下级共事' },
      { value: '遇瓶颈考虑拆伙', label: '遇瓶颈调整' },
    ],
  },
  {
    value: 'friendship',
    label: '友人搭档',
    tagLabel: '友人搭档·社交相处',
    stageOptions: [
      { value: '', label: '不限' },
      { value: '初识加深了解', label: '初识了解' },
      { value: '挚友长期相处', label: '挚友深交' },
      { value: '产生误会分歧', label: '产生分歧' },
      { value: '共同共事/合住', label: '合住共事' },
    ],
  },
  {
    value: 'children',
    label: '亲子育儿',
    tagLabel: '亲子育儿·子女教养',
    stageOptions: [
      { value: '', label: '不限' },
      { value: '幼童习惯培养', label: '幼童习惯' },
      { value: '升学与兴趣引导', label: '升学引导' },
      { value: '青春期沟通冲突', label: '青春期磨合' },
      { value: '成年子女相处', label: '成年相处' },
    ],
  },
  {
    value: 'parents',
    label: '父母长辈',
    tagLabel: '父母长辈·孝养沟通',
    stageOptions: [
      { value: '', label: '不限' },
      { value: '同住照护沟通', label: '同住照护' },
      { value: '重大决定观念分歧', label: '观念分歧' },
      { value: '远距互动联系', label: '远距关怀' },
    ],
  },
  {
    value: 'siblings',
    label: '同胞手足',
    tagLabel: '同胞手足·家事分工',
    stageOptions: [
      { value: '', label: '不限' },
      { value: '日常家事与孝养分工', label: '家事分工' },
      { value: '财产或决策协商', label: '决策协商' },
      { value: '共同创业/互助', label: '共同互助' },
    ],
  },
];

export function isSynastryRelationship(value: string): value is SynastryRelationship {
  return SYNASTRY_RELATIONSHIP_OPTIONS.some((item) => item.value === value);
}

export function getSynastryRelationshipOption(value?: string): SynastryRelationshipOption {
  return (
    SYNASTRY_RELATIONSHIP_OPTIONS.find((item) => item.value === value)
    ?? SYNASTRY_RELATIONSHIP_OPTIONS[0]
  );
}

export interface QuickFocusPreset {
  label: string;
  prompt: string;
  relationship?: SynastryRelationship;
}

const COMPAT_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '合婚配对',
    relationship: 'marriage',
    prompt: '请按传统合婚思路，重点分析双方命盘的先天契合度、婚姻宫位互动与长久相处底色。',
  },
  {
    label: '相处与磨合',
    relationship: 'marriage',
    prompt: '请分析双方性格脾气差异、日常沟通雷区、彼此最容易卡住的摩擦点与化解建议。',
  },
  {
    label: '前任复合',
    relationship: 'marriage',
    prompt: '目前双方存在隔阂或分开，请重点研判彼此余情羁绊、未来半年复合契机与关键卡点。',
  },
  {
    label: '合伙创业',
    relationship: 'career',
    prompt: '我们计划合伙共事或共同投资，请重点评估能力互补性、角色分工、利益边界与合作隐忧。',
  },
  {
    label: '职场协作',
    relationship: 'career',
    prompt: '作为上下级或同事搭档，请分析彼此工作节奏、信任建立与最省力的协作方式。',
  },
  {
    label: '亲子家庭',
    relationship: 'children',
    prompt: '请分析两代人或家人之间的性格互动模式、沟通卡点以及日常陪伴支持建议。',
  },
];

const CHINESE_NATAL_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '综合详批',
    prompt: '请综合分析此盘的核心格局、优势短板、关键用忌方向与阶段运势重点。',
  },
  {
    label: '事业升迁',
    prompt: '请重点分析此盘适合的行业定位、岗位晋升节奏、贵人助力与职场潜在阻力。',
  },
  {
    label: '正偏财库',
    prompt: '请重点研判正财与偏财结构、守财破财节点、投资风控与求财时机把握。',
  },
  {
    label: '婚恋正缘',
    prompt: '请重点分析命主的感情观、配偶特征与宫位引动，研判正缘契机与婚姻稳定性。',
  },
  {
    label: '近期流年',
    prompt: '请结合当前与未来一年流年岁运变化，提示事业、财务与人际感情的进退节奏。',
  },
  {
    label: '调候开运',
    prompt: '请从寒暖燥湿调候与核心用神出发，给出接地气的工作生活环境与行为调理建议。',
  },
];

const MULTI_HECAN_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '综合合参',
    prompt: '请综合本次已选术数，提炼跨体系共振主线、核心格局优劣与关键应对方向。',
  },
  {
    label: '事业路径',
    prompt: '请跨盘对照事业定位、发力优势、职场/创业适配路径与潜在阻力。',
  },
  {
    label: '财富守攻',
    prompt: '请跨盘对照生财方式、资源积累节奏、守财短板与投资风控边界。',
  },
  {
    label: '感情关系',
    prompt: '请跨盘对照亲密关系模式、择偶/相处重点、情感磨合卡点与改善建议。',
  },
  {
    label: '流年节奏',
    prompt: '请结合当前与未来一年的岁运/行运节奏，指出关键机会窗口与防守节点。',
  },
  {
    label: '共振与分歧',
    prompt: '请重点对比本次已选术数之间的强共振共识与矛盾分歧，说明现实中该如何核验取舍。',
  },
];

const WESTERN_ASTRO_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '综合详批',
    prompt: '请综合分析本命盘的核心行星格局、上升与太阳月亮配置及整体生命课题。',
  },
  {
    label: '事业财务',
    prompt: '请重点解读中天与十宫、二宫、八宫及相关行星相位，分析事业方向与财富潜力。',
  },
  {
    label: '感情关系',
    prompt: '请重点解读金星、火星、月亮与七宫五宫互动，分析亲密关系偏好与磨合重点。',
  },
  {
    label: '近期行运',
    prompt: '请结合当前行运与推进相位对本命盘的触发，提示近半年的关键变化窗口。',
  },
  {
    label: '情绪成长',
    prompt: '请分析月亮、土星与内行星挑战相位，给出心理疏导、减压与习惯改善建议。',
  },
];

const TRADITIONAL_DIVINATION_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '综合断事',
    prompt: '请结合主客用神旺衰、生克制化与动静走势，全面判断这件事目前的利弊与结果趋势。',
  },
  {
    label: '求职创业',
    prompt: '这件事关乎换工作、求职或事业创业，请研判当下机会成色、阻力所在与应对之策。',
  },
  {
    label: '求财合作',
    prompt: '这件事涉及求财、投资或商业合作，请重点分析资金流向、合作方诚意与风险卡点。',
  },
  {
    label: '感情复合',
    prompt: '我想了解这段感情目前的状态、对方真实态度与心态变化，以及后续推进或复合机会。',
  },
  {
    label: '居家出行',
    prompt: '这件事涉及家宅居住、搬迁出行或身体平安，请重点查看相关征兆、避忌与妥善安排。',
  },
  {
    label: '应期与行动',
    prompt: '请重点推演这件事关键节点可能出现的时间窗口，并给出眼下最稳妥的行动次序。',
  },
];

const CARD_LOT_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '整体启示',
    prompt: '请结合当前抽出的牌面或签文意象，点明这件事最核心的现状启示与关键提醒。',
  },
  {
    label: '对方心意',
    prompt: '请重点解读对方当前真实想法、内在顾虑、以及短期内对这段关系可能的行动倾向。',
  },
  {
    label: '选择与转机',
    prompt: '我现在面临抉择或卡顿，请分析不同选择的后续走向，以及破局转机在哪里。',
  },
  {
    label: '工作财运',
    prompt: '请聚焦工作进展、合作机会与财务收益，提醒需要把握或谨慎留心的细节。',
  },
  {
    label: '近期建议',
    prompt: '请给出未来 1–3 个月内最实用、可直接落地的心态调整与行动建议。',
  },
];

const ALMANAC_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '每日宜忌',
    prompt: '请结合本日干支、值日神煞与宜忌事项，整理日常办事顺遂点与需要注意的冲煞避忌。',
  },
  {
    label: '嫁娶合婚',
    prompt: '请评估所选日期是否适宜订婚、领证、嫁娶纳采，并对照参与人生肖提示合日注意事项。',
  },
  {
    label: '开业签约',
    prompt: '请重点分析这段时间开市营业、合同签署或新项目启动的吉日筛选与避开破日建议。',
  },
  {
    label: '搬家入宅',
    prompt: '请评估搬家入宅、安床修造与远行起程的日期宜忌及避煞方位。',
  },
];

const FENGSHUI_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '纳气总评',
    prompt: '请结合坐向宅卦与星盘飞布，先总结这套住宅整体纳气特点与吉凶分区。',
  },
  {
    label: '财位与办公',
    prompt: '请重点定位适合书房、工位或居家招财纳气的吉方，以及应当避开压制的方位。',
  },
  {
    label: '卧房与感情',
    prompt: '请重点评估主卧、次卧安床方位的吉凶气息，以及对睡眠健康、家人情绪与感情和谐的影响。',
  },
  {
    label: '搬迁修造',
    prompt: '如计划装修动土或近期入住，请指出今年各流年方位禁忌与稳妥稳气调整方案。',
  },
];

const NAME_NUMBER_FOCUS_PRESETS: ReadonlyArray<QuickFocusPreset> = [
  {
    label: '整体气质',
    prompt: '请从音形义、数理配置与核心能量结构，全面分析展现出的性格底色与外在气场。',
  },
  {
    label: '事业财运',
    prompt: '请重点分析这套组合在职场发展、人脉拓展与财务稳健度上的助力与短板。',
  },
  {
    label: '人际感情',
    prompt: '请重点研判其对沟通风格、合作信赖与感情互动氛围的潜在影响及平衡建议。',
  },
];

const CARD_LOT_METHODS = new Set<Method>([
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'random-divination',
]);

const WESTERN_METHODS = new Set<Method>(['astrolabe', 'qizheng', 'astrolabe-range', 'qizheng-range']);
const FENGSHUI_METHODS = new Set<Method>(['bazhai', 'xuankong', 'residential']);
const NAME_NUMBER_METHODS = new Set<Method>(['chinese-name', 'chinese-naming', 'number-energy']);

export function resolveFocusPresetsForContext(
  mode: 'personal' | 'compatibility' | 'divination',
  method: Method,
): ReadonlyArray<QuickFocusPreset> {
  if (mode === 'compatibility' || method === 'bazi-synastry' || method === 'ziwei-synastry' || method === 'astrolabe-synastry') {
    return COMPAT_FOCUS_PRESETS;
  }
  if (method === 'almanac') return ALMANAC_FOCUS_PRESETS;
  if (FENGSHUI_METHODS.has(method)) return FENGSHUI_FOCUS_PRESETS;
  if (NAME_NUMBER_METHODS.has(method)) return NAME_NUMBER_FOCUS_PRESETS;
  if (CARD_LOT_METHODS.has(method)) return CARD_LOT_FOCUS_PRESETS;
  if (WESTERN_METHODS.has(method)) return WESTERN_ASTRO_FOCUS_PRESETS;
  if (method === 'bazi-ziwei') return MULTI_HECAN_FOCUS_PRESETS;
  if (mode === 'divination') return TRADITIONAL_DIVINATION_FOCUS_PRESETS;
  return CHINESE_NATAL_FOCUS_PRESETS;
}
