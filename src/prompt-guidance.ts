import type { Method } from './schema';
import { parseQuestionContext, type QuestionTopic } from './systems/question-context';

const GUIDANCE_HEADER = '【解读与交付契约】';
const TOP_ANCHOR_HEADER = '【顶部任务锚点】';
const LONG_PROMPT_ANCHOR_THRESHOLD = 1600;

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export function getYearGanZhi(year: number): string {
  const offset = ((year - 4) % 60 + 60) % 60;
  return `${STEMS[offset % 10]}${BRANCHES[offset % 12]}`;
}

export type PromptReplyStyle = 'standard' | 'concise' | 'deep';

export interface PromptGuidanceOptions {
  enableContract?: boolean;
  replyStyle?: PromptReplyStyle;
  topTaskAnchor?: boolean;
  customFramework?: string;
}

type PromptGuidanceProvider = () => PromptGuidanceOptions | undefined;
let defaultGuidanceProvider: PromptGuidanceProvider | null = null;

/** 供浏览器设置模块注册全局提示词偏好；Node/Worker 无状态环境默认不注册。 */
export function setDefaultPromptGuidanceProvider(provider: PromptGuidanceProvider | null): void {
  defaultGuidanceProvider = provider;
}

const BAZI_METHODS = new Set<Method>(['bazi', 'bazi-synastry']);
const ZIWEI_METHODS = new Set<Method>(['ziwei', 'ziwei-synastry']);
const MULTI_NATAL_METHODS = new Set<Method>(['bazi-ziwei', 'minglu', 'fortune']);
const ASTROLOGY_METHODS = new Set<Method>([
  'astrolabe',
  'astrolabe-synastry',
  'astrolabe-range',
  'qizheng',
  'qizheng-range',
]);
const SYNASTRY_METHODS = new Set<Method>([
  'bazi-synastry',
  'ziwei-synastry',
  'astrolabe-synastry',
]);
const TRADITIONAL_DIVINATION_METHODS = new Set<Method>([
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'jinkoujue',
  'xiaoliuren',
  'taiyi',
]);
const CARD_SIGN_METHODS = new Set<Method>(['tarot', 'lenormand', 'ssgw', 'zhuge']);
const FENGSHUI_METHODS = new Set<Method>(['bazhai', 'xuankong', 'residential']);
const NAMING_METHODS = new Set<Method>(['chinese-name', 'chinese-naming']);
const REFERENCE_LOOKUP_METHODS = new Set<Method>(['calendar', 'zhouyi', 'character-query']);
const RANGE_COMPARE_METHODS = new Set<Method>(['astrolabe-range', 'qizheng-range', 'bazi-reverse']);
const MACRO_LUCK_METHODS = new Set<Method>(['wuyun-liuqi', 'huangji-jingshi']);

function detectInstantKind(promptText: string): 'astro' | 'ziwei' | 'bazi' | 'mixed' {
  if (/西洋星盘|七政四余/.test(promptText)) return 'astro';
  if (/即时紫微/.test(promptText) && !/即时四柱/.test(promptText)) return 'ziwei';
  if (/即时四柱/.test(promptText) && !/即时紫微/.test(promptText)) return 'bazi';
  return 'mixed';
}

function detectRandomDivinationKind(promptText: string): 'card-sign' | 'traditional' {
  if (/【签面】|【签诗】|塔罗|雷诺曼|正逆位/.test(promptText)) return 'card-sign';
  return 'traditional';
}

function getEvidenceFocus(method: Method, promptText: string): string {
  if (method === 'bazi-reverse') return '四柱结构与反推得到的候选出生范围';
  if (method === 'qimen-lifetime') return '九宫门星神、盘面格局、候选宫间关系与反证条件';
  if (method === 'instant') {
    const kind = detectInstantKind(promptText);
    if (kind === 'astro') return '即时星体落宫与相位/吊照（区分即时盘与出生盘）';
    if (kind === 'ziwei') return '即时紫微命身宫位与起盘四化（不虚构个人岁限）';
    if (kind === 'bazi') return '即时四柱干支强弱与刑冲合害（不虚构个人大运）';
    return '即时四柱干支与紫微命身宫四化（区分即时盘与个人出生盘）';
  }
  if (method === 'random-divination') {
    return detectRandomDivinationKind(promptText) === 'card-sign'
      ? '实际牌序、牌位、正逆位或签诗原文'
      : '世应/用神、动变、门星神、证据层与应期条件';
  }
  if (BAZI_METHODS.has(method)) return '四柱、月令旺衰、格局成败、调候、神煞与岁运';
  if (ZIWEI_METHODS.has(method)) return '命财官迁及主题宫星曜、本命格局、四化与运限';
  if (MULTI_NATAL_METHODS.has(method)) return '多体系盘面事实、规则证据与跨盘互证项';
  if (ASTROLOGY_METHODS.has(method)) return '星体落座落宫、相位/吊照、格局与推运/流曜';
  if (method === 'meihua') return '体用生克、主互变卦象与动爻辞';
  if (method === 'xiaoliuren') return '月日时三宫落点与体用生克';
  if (method === 'taiyi') return '主客定算、三门五将与十六神职司';
  if (TRADITIONAL_DIVINATION_METHODS.has(method)) return '世应/用神、动变、门星神、四课三传/四位与证据层';
  if (method === 'tarot') return '实际牌序、牌位、正逆位与牌面核心意象';
  if (method === 'lenormand') return '实际牌面与生活化日常线索（单牌不强行脑补邻牌）';
  if (CARD_SIGN_METHODS.has(method)) return '签诗原文意象与对应事项提示';
  if (method === 'number-energy') return '八星组合走势、0/5 位置与数理特征';
  if (method === 'almanac') return '优选日与可用吉时、忌用时辰及冲煞避忌';
  if (method === 'bazhai') return '命卦与宅向对照、坐山误差安全交集方位';
  if (method === 'xuankong') return '原盘山向旺衰、组合煞气与流年飞星吉凶';
  if (method === 'residential') return '八宅命宅与玄空飞星交集吉位及重煞避忌';
  if (NAMING_METHODS.has(method)) return '字义、音律、字形笔画、重名谐音与五行参考';
  return '上方引擎返回的精确历法、经文、字库或周期事实';
}

function hasUncertainTimeSignal(method: Method, promptText: string): boolean {
  if (method === 'astrolabe-range' || method === 'qizheng-range') return true;
  if (method === 'bazi-reverse') return /候选\s*2|候选范围[^\n]*[2-9]/.test(promptText);
  return /(?:【区间分支\s*1】|【分支\s*1】|【稳定与候选】|【候选时段)/.test(promptText);
}

function getScenarioRule(method: Method, promptText: string): string {
  if (SYNASTRY_METHODS.has(method)) {
    return '双盘对照：先简述双方底色再析跨盘互动；若含多候选，分别说明差异，不私自选盘。';
  }
  if (
    BAZI_METHODS.has(method)
    || ZIWEI_METHODS.has(method)
    || MULTI_NATAL_METHODS.has(method)
    || ASTROLOGY_METHODS.has(method)
    || method === 'bazi-reverse'
    || method === 'qimen-lifetime'
  ) {
    if (hasUncertainTimeSignal(method, promptText)) {
      return '多候选考时：严禁私自选盘；须明确分出「各候选共同稳定特征」与「因时辰而异的差异点」，再引导用户提供 2–3 件过往大事年份定盘（宝宝/青少年跳过考时）。';
    }
    return '';
  }
  if (TRADITIONAL_DIVINATION_METHODS.has(method) || method === 'random-divination') {
    return '一事一占：紧扣所问主体与当前盘面；应期只按已列条件判断，缺依据时改为提示关键观察节点；追问沿用原盘不重起。';
  }
  if (CARD_SIGN_METHODS.has(method) || method === 'number-energy') {
    return '温和直白：用生活化语言解读当下处境与心理盲区，不堆砌学术审查腔或版本免责话术；追问沿用原盘不重抽。';
  }
  if (method === 'almanac') {
    return '择日取舍：不忽略同日宜忌冲突；无完美日期时直接给出折中优选与取舍理由。';
  }
  if (FENGSHUI_METHODS.has(method)) {
    return '方位落地：若存在坐向误差或八宅/玄空方位冲突，优先提取共同安全吉位并避开二五/五二重煞直接给布置建议，再点出需复测或留意的争议方位。';
  }
  if (NAMING_METHODS.has(method)) {
    return '起名实用：不要用单姓天格吉凶吓唬家长；务必评估字义气质、简体书写难度、重名度风险，并提醒用普通话/方言连读排查谐音及长辈避讳。';
  }
  return '';
}

function getTopicFocusRule(method: Method, topic: QuestionTopic): string {
  if (
    topic === 'general'
    || NAMING_METHODS.has(method)
    || FENGSHUI_METHODS.has(method)
    || REFERENCE_LOOKUP_METHODS.has(method)
    || MACRO_LUCK_METHODS.has(method)
    || RANGE_COMPARE_METHODS.has(method)
    || method === 'almanac'
  ) {
    return '';
  }

  const isNatalOrAstro =
    BAZI_METHODS.has(method)
    || ZIWEI_METHODS.has(method)
    || MULTI_NATAL_METHODS.has(method)
    || ASTROLOGY_METHODS.has(method)
    || method === 'qimen-lifetime'
    || method === 'instant';
  const isCardOrNumber = CARD_SIGN_METHODS.has(method) || method === 'number-energy';

  if (isCardOrNumber) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：落到具体工作方向、合作沟通与近期推进节奏上，直接给可执行建议。';
      case 'caifu':
        return '财运焦点：落到收支管理、投入风险与守成发力点上，给出务实提醒。';
      case 'ganqing':
        return '感情焦点：聚焦双方真实沟通状态、情感需求与关系卡点，给温和可行的破冰或相处建议。';
      case 'academic':
        return '学业考试焦点：聚焦备考状态、心态调节与临场发挥关键。';
      default:
        return '';
    }
  }

  if (isNatalOrAstro) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣官杀/印食伤、官禄宫、星盘十宫或事业用神，明确指出适配方向、关键发力窗口与主要阻力。';
      case 'caifu':
        return '财运焦点：紧扣财星根气、财帛/田宅/福德、星盘二八宫，明确区分稳健积累、阶段机会与破耗风险。';
      case 'ganqing':
        return '感情焦点：紧扣夫妻宫、配偶星、星盘七宫或跨盘互动，直指相处模式、核心矛盾与改善关键，避免宿命恐吓。';
      case 'academic':
        return '学业考试焦点：紧扣印星/文昌或学业宫位与岁运引动，直指备考节奏与发挥关键。';
      case 'guaishen':
        return '身心焦点：聚焦五行偏枯或疾厄宫象意，给出作息与生活节律调养提醒。';
      case 'travel':
        return '出行焦点：结合驿马、迁移宫与方位象意，提示行程顺逆与注意事项。';
      default:
        return '';
    }
  }

  // 三式与传统占卜（不混入八字/星盘宫位词）
  switch (topic) {
    case 'shiye':
      return '事业焦点：紧扣用神、开门/官鬼/行年或动变趋势，说明推进顺逆、合作阻力与发力重点。';
    case 'caifu':
      return '财运焦点：紧扣财爻/生门/甲子戊或生克趋势，区分真实收益与虚高画饼、垫资风险。';
    case 'ganqing':
      return '感情焦点：紧扣世应/六合/用神动变，直指双方态度、沟通卡点与改善契机。';
    case 'academic':
      return '学业考试焦点：紧扣父母爻/文书景门/天辅星，直指备考状态与临场关键。';
    case 'travel':
      return '出行焦点：结合驿马、门星神或体用动静，提示行程顺逆与需留意的节点。';
    case 'lost':
      return '失物/寻人焦点：紧扣用神落宫、方位、藏伏与动静线索，给出最具体的排查方向。';
    case 'litigation':
      return '诉讼纠纷焦点：紧扣世应/主客与生克强弱，直指双方优劣势与胜算关键点。';
    default:
      return '';
  }
}

function getReplyStructureRule(method: Method, style: PromptReplyStyle, promptText: string): string {
  if (method === 'calendar') {
    return '输出格式：直接给出准确的北京时间结论（精确到分/秒），无需粘贴英文调试参数或求根误差；如数据确有缺失则简短说明。';
  }
  if (method === 'zhouyi') {
    return '输出格式：先忠实完整列出所查卦辞与爻辞原文，随后附 2–3 句大白话导读帮普通读者理解核心意思，文末一行附注版本口径即可。';
  }
  if (method === 'character-query') {
    return '输出格式：仅针对用户所问汉字作答；① 一句话总结康熙笔画、五行与造字本义 → ② 节选《说文》或最核心释义 1–2 句并用大白话讲清（严禁整段粘贴冷僻反切）→ ③ 常用引申义与起名/使用参考。';
  }
  if (RANGE_COMPARE_METHODS.has(method)) {
    return '输出格式：① 一句话差异/范围结论 → ② 共同稳定特征 → ③ 各分支差异与边界核对点 → ④ 考时或下一步使用建议。';
  }
  if (NAMING_METHODS.has(method)) {
    return '输出格式：① 综合印象或精选方案对比 → ② 字义、音律与重名/谐音排查 → ③ 传统数理与五行参考（白话简述）→ ④ 实用取舍建议。';
  }
  if (FENGSHUI_METHODS.has(method) || method === 'almanac') {
    return '输出格式：① 一句话明确推荐（优选日期吉时 / 优先安全吉位）→ ② 关键依据（大白话拆解）→ ③ 必须避开的冲煞或争议位提醒 → ④ 可直接落地的布置或行动建议。';
  }
  if (MACRO_LUCK_METHODS.has(method)) {
    return '输出格式：① 一句话年度大势总断 → ② 核心气候/趋势依据（必须翻译为现代体感到冷暖干湿或行业趋势，严禁堆砌古文病症/凶辞吓人）→ ③ 顺风点与防备点 → ④ 务实生活或处事建议。';
  }
  if (CARD_SIGN_METHODS.has(method) || method === 'number-energy') {
    return style === 'concise'
      ? '输出格式（精简直白）：① 一句话直给结论 → ② 2–3 条生活化依据 → ③ 一条当下最该做的具体动作。'
      : '输出格式：① 核心直断 → ② 关键依据（生活化大白话，不念学术审查腔）→ ③ 留意信号与盲区 → ④ 接地气的行动建议。';
  }
  if (method === 'fortune' && promptText.includes('【AI 报告输出规范】')) {
    return '输出格式：严格按上方【AI 报告输出规范】分节输出，保持简洁直白、不重复抄录加减分日志。';
  }
  if (style === 'concise') {
    return '输出格式（精简直白）：① 一句话直给结论 → ② 2–3 条最核心依据（用大白话讲清）→ ③ 一条当下最该做的具体动作。';
  }
  if (style === 'deep') {
    return '输出格式（专业详尽）：① 核心总断 → ② 分层拆解关键盘面事实、格局/规则与古籍原文 → ③ 冲突因子与反证条件 → ④ 阶段时间窗口（无推运数据时不编月份）与务实策略。';
  }
  return '输出格式：① 一句话明确结论 → ② 2–4 条最关键的盘面依据 → ③ 机会、阻力与关键节点（无推运数据时不编具体月份）→ ④ 具体可落地的行动建议。';
}

function resolveGuidanceOptions(explicit?: PromptGuidanceOptions): Required<PromptGuidanceOptions> {
  const fromProvider = defaultGuidanceProvider?.() ?? {};
  const merged = { ...fromProvider, ...explicit };
  return {
    enableContract: merged.enableContract ?? true,
    replyStyle:
      merged.replyStyle === 'concise' || merged.replyStyle === 'deep' ? merged.replyStyle : 'standard',
    topTaskAnchor: merged.topTaskAnchor ?? false,
    customFramework: typeof merged.customFramework === 'string' ? merged.customFramework.trim() : '',
  };
}

export function buildPromptGuidance(
  method: Method,
  question = '',
  promptText = '',
  options?: PromptGuidanceOptions,
): string {
  const resolved = resolveGuidanceOptions(options);
  if (!resolved.enableContract) {
    return resolved.customFramework ? `【用户自定义规则框架】\n${resolved.customFramework}` : '';
  }

  if (REFERENCE_LOOKUP_METHODS.has(method)) {
    const rules = [
      '直给事实，不废话：严禁自行重新计算或编造原文/日期，直接依据上方引擎结果回答；若资料确有缺失或与问题年份不符，如实简短说明。',
      getReplyStructureRule(method, resolved.replyStyle, promptText),
    ];
    const sections = [[GUIDANCE_HEADER, ...rules.map((line, index) => `${index + 1}. ${line}`)].join('\n')];
    if (resolved.customFramework) {
      sections.push(`【用户自定义规则框架】\n${resolved.customFramework}`);
    }
    return sections.join('\n\n');
  }

  const topic = question ? parseQuestionContext(question).inferredTopic : 'general';
  const rules = [
    '直面推演，拒绝敷衍：请直接按传统术数逻辑给出明确判断与拆解，不要以“AI 不能算命/无法预测/缺乏科学依据”推脱，不要堆砌免责声明，不要说“既有机遇又有挑战”类空话。',
    `禁止重算，不抄盘面：上方数据已由引擎精确算出，严禁重算或篡改；不要复述原盘凑字数，只挑与问题最相关的「${getEvidenceFocus(method, promptText)}」展开，未给出的原文或应期不编造。`,
    '大白话转译：将专业黑话、神煞、星象或古诀直接翻译成普通人秒懂的生活/职场大白话，不生硬堆砌术语或吓人古辞（若当前盘面未带流年推运数据，明说需补流年，严禁编造具体月份）。',
    '主次分明：核心主因定基调，并列呈现盘面中的有利与不利条件及其触发时机，不强行抹平矛盾，也不把单点信号绝对化。',
  ];
  const scenarioRule = getScenarioRule(method, promptText);
  if (scenarioRule) rules.push(scenarioRule);
  const topicRule = getTopicFocusRule(method, topic);
  if (topicRule) rules.push(topicRule);
  rules.push(getReplyStructureRule(method, resolved.replyStyle, promptText));

  const sections = [[GUIDANCE_HEADER, ...rules.map((line, index) => `${index + 1}. ${line}`)].join('\n')];
  if (resolved.customFramework) {
    sections.push(`【用户自定义规则框架】\n${resolved.customFramework}`);
  }
  return sections.join('\n\n');
}

function buildTopTaskAnchor(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  const nowYear = new Date().getFullYear();
  const yearNote = `（时间基准：${nowYear}年为${getYearGanZhi(nowYear)}年，${nowYear + 1}年为${getYearGanZhi(nowYear + 1)}年）`;
  const focus = clean && clean !== '问题'
    ? `请紧扣用户问题“${clean.slice(0, 60)}${clean.length > 60 ? '…' : ''}”直接推演作答；`
    : '请紧扣文末用户问题直接推演作答；';
  return `${TOP_ANCHOR_HEADER}\n${focus}${yearNote}下方盘面与规则指标已由引擎精确算出，严禁自行重新排盘或篡改数据，也不要推脱敷衍。`;
}

export function applyPromptGuidance<T extends { text?: string } | undefined>(
  method: Method,
  prompt: T,
  question = '',
  options?: PromptGuidanceOptions,
): T {
  if (!prompt || typeof prompt.text !== 'string' || !prompt.text.trim()) return prompt;
  const resolved = resolveGuidanceOptions(options);
  let text = prompt.text;

  if (
    resolved.topTaskAnchor
    && text.length >= LONG_PROMPT_ANCHOR_THRESHOLD
    && !text.includes(TOP_ANCHOR_HEADER)
  ) {
    text = `${buildTopTaskAnchor(question)}\n\n${text}`;
  }

  if (!text.includes(GUIDANCE_HEADER)) {
    const guidance = buildPromptGuidance(method, question, prompt.text, resolved);
    if (guidance) {
      text = `${text}\n\n${guidance}`;
    }
  }

  return text === prompt.text ? prompt : { ...prompt, text };
}
