/**
 * 浏览器端 39 项术数推荐决策小模型 — 零依赖纯 TypeScript 推理入口
 *
 * 特性：
 * - 纯 TypeScript、零 Node 专属依赖，可在浏览器 / Cloudflare Worker / Node 任意环境 1~3ms 运行
 * - 稀疏 TF-IDF (1/2/3-gram + 语义信号 + 前置选项交互特征) + int8 量化线性分类器 + 前置先验融合层 + 本机习惯偏好微调
 * - 同步输出 Top-3 术数推荐 + 细分主题领域与看盘侧重点 + 8 大提示词解读框架（可直接传给 customFramework）
 */

import weightsJson from './weights.json' with { type: 'json' };
import {
  CALIBRATION_NATAL_METHODS,
  CANONICAL_METHODS,
  DEEP_METHODS,
  DIVINATION_METHODS,
  FOLK_SIGNS_METHODS,
  METHOD_LABELS,
  QUICK_METHODS,
  WESTERN_CARDS_METHODS,
  detectExplicitChartIntent,
  detectExplicitDivinationIntent,
  detectExplicitMethod,
  detectLongTermNatalIntent,
  detectSecondaryIntentMethods,
  detectShortTermEventIntent,
  detectTwoPersonIntent,
  detectWildStructuredInput,
  extractFeatureTokens,
  normalizeQuery,
  type BirthTimeStatus,
  type DepthPref,
  type MethodId,
  type RouterInput,
  type TraditionPref,
} from './features';
import {
  DOMAIN_DEFINITIONS,
  PROMPT_FRAMEWORKS,
  detectDomain,
  selectPromptFramework,
  type DetectedDomainResult,
  type DomainId,
  type FrameworkId,
  type RecommendedFrameworkResult,
} from './frameworks';
import {
  inferFortuneScope,
  type FortuneScope,
  type FortuneScopeFocus,
} from './fortune-scope';
import {
  EXCLUDED_ROUTER_METHODS,
  getLocalRouterMethodBonus,
  loadLocalRouterDefaults,
  loadLocalRouterPreferences,
  loadLocalRouterSettings,
  recordLocalRouterMethodChoice,
  resetLocalRouterPreferences,
} from './local-preferences';

export {
  CANONICAL_METHODS,
  DOMAIN_DEFINITIONS,
  METHOD_LABELS,
  PROMPT_FRAMEWORKS,
  inferFortuneScope,
  loadLocalRouterPreferences,
  recordLocalRouterMethodChoice,
  resetLocalRouterPreferences,
  type BirthTimeStatus,
  type DepthPref,
  type DetectedDomainResult,
  type DomainId,
  type FortuneScope,
  type FortuneScopeFocus,
  type FrameworkId,
  type MethodId,
  type RecommendedFrameworkResult,
  type RouterInput,
  type TraditionPref,
};

export interface MethodRecommendation {
  method: MethodId;
  label: string;
  confidence: number;
  reason: string;
  missingInfoHint: string;
  calibrationSuggested: boolean;
}

export interface RouterResult {
  recommendations: MethodRecommendation[];
  detectedDomain: DetectedDomainResult;
  recommendedFramework: RecommendedFrameworkResult;
  calibrationSuggested: boolean;
  latencyMs: number;
}

interface WeightsArtifact {
  version: string;
  trainSamples: number;
  cvTop1: number;
  cvTop3: number;
  methods: readonly string[];
  vocab: readonly string[];
  idf: readonly number[];
  bias: readonly number[];
  weightScale: number;
  weightsInt8Base64?: string;
  weightsInt16Base64?: string;
}

interface DecodedModel {
  methods: MethodId[];
  methodToIdx: Map<MethodId, number>;
  vocabIndex: Map<string, number>;
  idf: Float32Array;
  bias: Float32Array;
  weights: Int8Array | Int16Array;
  invScale: number;
  numClasses: number;
}

let cachedModel: DecodedModel | null = null;

function decodeBase64ToInt8Array(b64: string): Int8Array {
  const binary = atob(b64);
  const len = binary.length;
  const out = new Int8Array(len);
  for (let i = 0; i < len; i++) {
    const u = binary.charCodeAt(i);
    out[i] = u >= 128 ? u - 256 : u;
  }
  return out;
}

function decodeBase64ToInt16Array(b64: string): Int16Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Ensure little-endian safe decoding across all platforms
  const count = len >> 1;
  const out = new Int16Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true);
  }
  return out;
}

function getModel(): DecodedModel {
  if (cachedModel) return cachedModel;
  const raw = weightsJson as unknown as WeightsArtifact;
  const methods = raw.methods as MethodId[];
  const methodToIdx = new Map<MethodId, number>();
  methods.forEach((m, i) => methodToIdx.set(m, i));

  const vocabIndex = new Map<string, number>();
  raw.vocab.forEach((tok, i) => vocabIndex.set(tok, i));

  const idf = Float32Array.from(raw.idf);
  const bias = Float32Array.from(raw.bias);
  const weights = raw.weightsInt8Base64
    ? decodeBase64ToInt8Array(raw.weightsInt8Base64)
    : decodeBase64ToInt16Array(raw.weightsInt16Base64 ?? '');

  cachedModel = {
    methods,
    methodToIdx,
    vocabIndex,
    idf,
    bias,
    weights,
    invScale: 1 / raw.weightScale,
    numClasses: methods.length,
  };
  return cachedModel;
}

const METHOD_BASE_REASONS: Record<MethodId, string> = {
  instant: '按事件发生的当下时刻起盘看气象与走势，与个人出生盘区分清晰，非常适合记录关键节点。',
  'random-divination': '由系统自动从免生辰占卜中随机选定一门术数并一步起盘，省心直接。',
  calendar: '专门处理二十四节气精确交节、真太阳时换算、日出日落、月相朔望与历法对照。',
  zhouyi: '直接检索与查阅《周易》六十四卦标准卦辞、爻辞、彖传与象传原文，无需起卦。',
  'number-energy': '专门解析手机号、车牌号、门牌号等数字组合的八星磁场与民俗取象。',
  'character-query': '支持查询单个汉字的康熙笔画、五行归属、部首与本义，也支持按条件批量筛字。',
  'chinese-name': '针对已有姓名或候选名从音形义美感、五行搭配、谐音避讳与数理做全面评测。',
  'chinese-naming': '按姓氏、性别、字数、辈分字与五行审美偏好，从零生成多组高品质中文起名方案。',
  'bazi-reverse': '根据已知的四柱干支倒推对应的公历出生年份、日期与两小时时段，方便后续衔接排盘。',
  tarot: '免生辰即可抽牌或录入线下牌面，擅长洞察对方心理、情绪卡点与温和的行动指引。',
  lenormand: '免生辰且风格直白落地，擅长用邻牌组合追踪具体现实事件、消息反馈与推进链条。',
  xiaoliuren: '掐指一算、几秒出结论，最适合出门顺逆、找小物件、日常小决定等轻量速断。',
  ssgw: '传统民俗百签体系，零门槛、签诗温和有典故，适合祈福求平安与日常心安指引。',
  zhuge: '支持报三个汉字、三个数字或五枚铜钱三十二课取签，古风签诗简练犀利、富有启发。',
  'wuyun-liuqi': '基于《黄帝内经》年度岁运太过不及与司天在泉，解读大环境气候节律与顺时养生。',
  'huangji-jingshi': '基于邵雍《皇极经世》元会运世体系，查看时代值运卦、值年卦与长周期演变。',
  jinkoujue: '脱胎于大六壬而化繁为简，四位生克直断吉凶成败，风格干脆利落、快准狠。',
  liuren: '号称“人事之王”，通过四课三传十二天将把复杂人际纠葛、背后隐情与演变抽丝剥茧。',
  meihua: '支持时间、数字、汉字或外应物象灵动起卦，免生辰、节奏轻快，适合快速看单事成败。',
  liuyao: '经典事件占卜法，以世应与用神精准判断具体事务的成败结果、阻力与应期时间窗。',
  taiyi: '古代三式之首，专主天时与宏观定局，适合观察年度大环境气运与主客大势。',
  qimen: '擅长多方案二选一对比、商业谈判博弈、方位利弊权衡与攻守策略布局。',
  'qimen-lifetime': '以出生时刻起奇门终身盘，结合九宫方位与分运模型看一生事业方向与阶段起伏。',
  bazi: '通过生辰四柱五行强弱、十神格局与十年大运流年，系统梳理事业、财官与姻缘走势。',
  'bazi-synastry': '对比双方八字五行互补、日支夫妻宫合冲与流年同步性，适合婚恋、合伙与亲子合盘。',
  bazhai: '按居住者东四/西四命卦与宅卦标出四吉四凶方位，适合租房选向与卧室书桌布局。',
  xuankong: '结合房屋建造元运与精确罗盘坐向排九宫飞星盘，精准定位当运财位与流年五黄病符。',
  residential: '把居住者八宅命卦与房屋玄空飞星合二为一，适合新房装修与全屋深度住宅风水评估。',
  almanac: '结合建除黄黑道、神煞宜忌与参与人生肖冲克，为搬家、婚嫁、开业、动土挑选吉日。',
  qizheng: '中国传统真天文星盘（果老星宗），结合二十八宿命度、恩难仇用与洞微行限深看命局。',
  'qizheng-range': '在出生分钟不确定时按时间区间逐段排查七政四余命宫宿度变化，避免定盘偏差。',
  ziwei: '以十二宫主星与四化飞星细腻刻画性格、夫妻、财帛、官禄与田宅细节，并支持未知时辰考时。',
  'ziwei-synastry': '通过双盘同支叠宫与生年四化跨盘飞入，细腻还原两人的情感投射、付出感与合作默契。',
  'bazi-ziwei': '共用同一份生辰同时排出八字与紫微双盘交叉印证，也是未知时辰交集考时的稳妥入口。',
  astrolabe: '通过西洋本命盘行星落座落宫、相位及行运/太阳返照，深度解析性格天赋与周期主题。',
  'astrolabe-synastry': '分析双方比较盘跨盘相位、双向落宫与行星接纳互溶，看透情感吸引力与沟通模式。',
  'astrolabe-range': '当出生分钟不精确时按时间段逐段比对上升星座与宫位切换，辅助严谨生时校正。',
  minglu: '一站式聚合你的八字、紫微、西洋星盘与八宅命卦，生成最全的个人命理总档案。',
  fortune: '支持日运、月运、年运快速总览，填生辰可定制个人流运，不填也能直接看通用节律提醒。',
};

function buildMissingInfoHint(
  method: MethodId,
  rawQuery: string,
  birthTimeStatus: BirthTimeStatus,
  hasHouseFacing: boolean,
): string {
  const q = normalizeQuery(rawQuery);
  const hasFullDateTime =
    (/(19\d\d|20\d\d)年\d{1,2}月\d{1,2}[日号]/.test(q) ||
      /(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.test(q)) &&
    /(\d{1,2}\s*[点时:]|\b(早上|上午|中午|下午|晚上|凌晨|半夜))/.test(q);
  const hasCity = /(北京|上海|广州|深圳|成都|杭州|南京|武汉|西安|重庆|长沙|青岛|拉萨|乌鲁木齐|哈尔滨|城市)/.test(q);
  const hasGender = /(男|女|老公|老婆|男友|女友|男孩|女孩|男宝|女宝|先生|女士)/.test(q);
  const hasPhoneOrPlate = /(1[3-9]\d{9}|尾号\s*\d{3,4}|[京沪粤浙苏川渝鲁豫湘鄂皖闽辽吉黑晋陕甘青琼桂宁新藏云贵蒙][a-z])/.test(q);
  const hasYearAndAngle = /(19\d\d|20\d\d)年/.test(q) && /(\d{1,3}\s*度|坐[子丑寅卯辰巳午未申酉戌亥乾坤艮巽壬丙甲庚乙辛癸丁东西南北])/.test(q);

  switch (method) {
    case 'bazi':
    case 'ziwei':
    case 'bazi-ziwei':
    case 'qimen-lifetime':
      if (birthTimeStatus === 'unknown') {
        return '请提供你的出生年月日、性别，以及过往 1～2 件记忆深刻的大事年份（如毕业、换工作、婚恋），方便系统帮你做候选时辰考时定盘。';
      }
      if (birthTimeStatus === 'range') {
        return '请提供你的出生年月日、大致出生时间范围（如上午 9～11 点）与性别。';
      }
      if (hasFullDateTime && hasGender) return '';
      return '请补充你的出生年月日、出生时辰（或两小时内范围）与性别。';

    case 'astrolabe':
    case 'qizheng':
      if (hasFullDateTime && hasCity) return '';
      return '请提供精确到分钟的出生年月日时，以及出生城市（用于计算经纬度与真太阳时/上升宫位）。';

    case 'astrolabe-range':
    case 'qizheng-range':
      return '请提供出生年月日、出生城市，以及尽量缩小后的可能出生时间段（如上午 8:00～10:00）。';

    case 'minglu':
      if (hasFullDateTime && hasCity && hasGender) return '';
      return '请提供精确出生年月日时、性别与出生城市，以便一次性聚合八字、紫微、星盘与八宅。';

    case 'bazi-synastry':
    case 'ziwei-synastry':
      if (birthTimeStatus === 'unknown') {
        return '请提供双方的出生年月日、性别及已知的大致时段（系统会自动对比未知时辰候选组合）。';
      }
      return '请提供你和对方两人的出生年月日时与性别。';

    case 'astrolabe-synastry':
      return '请提供双方的精确出生年月日时以及各自的出生城市。';

    case 'bazi-reverse':
      return '请提供完整的年月日时四柱干支，以及大致的出生年代区间（如 1980～2000 年）。';

    case 'bazhai':
      if (/(19\d\d|20\d\d)年/.test(q) && hasGender) return '';
      return '请提供主要居住者的出生年份、性别，以及房屋/房间的大致坐向（如坐北朝南）。';

    case 'xuankong':
      if (hasYearAndAngle || (hasHouseFacing && /(19\d\d|20\d\d)年/.test(q))) return '';
      return '请提供房屋建造（或大修入住）年份，以及精确坐山朝向或罗盘测量度数。';

    case 'residential':
      return '请提供主要居住者的出生年份与性别、房屋建造年份，以及尽量精确的房屋坐向角度。';

    case 'almanac':
      return '请提供你想筛选的大致日期范围，以及主要参与人的出生年份（用于自动避开生肖冲克）。';

    case 'number-energy':
      return hasPhoneOrPlate ? '' : '请提供完整的手机号码、车牌号或门牌号数字组合。';

    case 'chinese-naming':
      return '请告知姓氏、性别、倾向一字还是二字名，以及是否有辈分字、忌用字或希望结合生辰。';

    case 'fortune':
      return birthTimeStatus === 'exact'
        ? '如已填生辰将自动生成个人专属流运；不填也可直接看通用运势节律。'
        : '';

    default:
      return '';
  }
}

function buildDynamicReason(
  method: MethodId,
  input: RouterInput,
  isCalibration: boolean,
  explicitMatch: boolean,
): string {
  const base = METHOD_BASE_REASONS[method];
  const bt = input.birthTimeStatus ?? 'not_provided';

  if (explicitMatch) {
    return `你明确指定了【${METHOD_LABELS[method]}】，${base}`;
  }
  if (bt === 'unknown' && isCalibration) {
    return `你问的是长期命局/合盘且暂不知精确时辰，建议先走【${METHOD_LABELS[method]}】的未知时辰考时定盘路径：${base}`;
  }
  if (bt === 'unknown' && DIVINATION_METHODS.has(method)) {
    return `你问的是具体事件的当下结果，无生辰时直接用免生辰占卜【${METHOD_LABELS[method]}】最合适：${base}`;
  }
  return base;
}

function softmax(logits: Float64Array): Float64Array {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i];
  }
  const exps = new Float64Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    exps[i] = e;
    sum += e;
  }
  for (let i = 0; i < logits.length; i++) {
    exps[i] /= sum;
  }
  return exps;
}

/**
 * 浏览器端纯本地毫秒级推荐主函数：
 * 输入一句大白话提问与可选前置偏好，返回 Top-3 推荐术数 + 主题领域看盘侧重点 + 提示词解读框架。
 */
export function recommendMethods(input: RouterInput): RouterResult {
  const t0 = performance.now();
  const model = getModel();

  const query = (input.query || '').trim();
  const storedSettings = loadLocalRouterSettings();
  const bt: BirthTimeStatus = input.birthTimeStatus ?? 'not_provided';
  const trad: TraditionPref = input.traditionPref ?? storedSettings.traditionPref;
  const depth: DepthPref = input.depthPref ?? 'standard';
  const hasManualCast = Boolean(input.hasManualCast);
  const hasHouseFacing = Boolean(input.hasHouseFacing);

  // 1. Feature extraction & TF-IDF L2-normalized sparse vector
  const tokens = extractFeatureTokens({
    query,
    birthTimeStatus: bt,
    traditionPref: trad,
    depthPref: depth,
    hasManualCast,
    hasHouseFacing,
  });

  const tfMap = new Map<number, number>();
  for (const tok of tokens) {
    const idx = model.vocabIndex.get(tok);
    if (idx !== undefined) {
      tfMap.set(idx, (tfMap.get(idx) ?? 0) + 1);
    }
  }

  const indices: number[] = [];
  const values: number[] = [];
  let normSq = 0;
  for (const [idx, count] of tfMap.entries()) {
    const w = (1 + Math.log(count)) * model.idf[idx];
    indices.push(idx);
    values.push(w);
    normSq += w * w;
  }
  const norm = Math.sqrt(normSq) || 1;
  for (let i = 0; i < values.length; i++) {
    values[i] /= norm;
  }

  // 2. Sparse linear forward pass
  const C = model.numClasses;
  const logits = new Float64Array(C);
  for (let c = 0; c < C; c++) {
    logits[c] = model.bias[c];
  }
  const invScale = model.invScale;
  const W = model.weights;
  for (let i = 0; i < indices.length; i++) {
    const base = indices[i] * C;
    const val = values[i] * invScale;
    for (let c = 0; c < C; c++) {
      logits[c] += W[base + c] * val;
    }
  }

  // 3. Prior fusion & guardrail layer
  const qNorm = normalizeQuery(query);
  const excludedSet = new Set<MethodId>(EXCLUDED_ROUTER_METHODS);
  const rawExplicitMethod = detectExplicitMethod(query);
  const explicitMethod =
    rawExplicitMethod && !excludedSet.has(rawExplicitMethod) ? rawExplicitMethod : null;
  const explicitDivination = explicitMethod ? null : detectExplicitDivinationIntent(query);
  const explicitChart = explicitMethod || explicitDivination ? false : detectExplicitChartIntent(query);
  const wildKind = detectWildStructuredInput(query);
  const isLongTerm = detectLongTermNatalIntent(qNorm);
  const isShortTerm = detectShortTermEventIntent(qNorm);
  const isTwoPerson = detectTwoPersonIntent(qNorm);
  const storedDefaults = loadLocalRouterDefaults();
  const prefWeightMode = storedSettings.preferenceWeight;
  const disabledSet = new Set<MethodId>([
    ...EXCLUDED_ROUTER_METHODS,
    ...(input.disabledMethods !== undefined
      ? input.disabledMethods
      : storedSettings.disabledMethods),
  ]);
  // 关闭只拦截“自动联想路由”；用户明确点名某个术数时仍允许路由到该术数
  if (explicitMethod) {
    disabledSet.delete(explicitMethod);
    if (explicitMethod === 'astrolabe' && (bt === 'range' || bt === 'unknown')) {
      disabledSet.delete('astrolabe-range');
    } else if (explicitMethod === 'qizheng' && (bt === 'range' || bt === 'unknown')) {
      disabledSet.delete('qizheng-range');
    }
  }
  const rawPreferredChart =
    input.preferredChart !== undefined
      ? input.preferredChart
      : prefWeightMode === 'off'
        ? null
        : storedDefaults.preferredChart;
  const rawPreferredDivination =
    input.preferredDivination !== undefined
      ? input.preferredDivination
      : prefWeightMode === 'off'
        ? null
        : storedDefaults.preferredDivination;
  const preferredChart =
    rawPreferredChart && !disabledSet.has(rawPreferredChart) ? rawPreferredChart : null;
  const preferredDivination =
    rawPreferredDivination && !disabledSet.has(rawPreferredDivination)
      ? rawPreferredDivination
      : null;

  const addBonus = (m: MethodId, delta: number) => {
    const idx = model.methodToIdx.get(m);
    if (idx !== undefined) logits[idx] += delta;
  };

  // 3a-0. Wild non-natural structured input fast-track prior
  if (wildKind && !explicitMethod) {
    switch (wildKind) {
      case 'pure_four_pillars':
        addBonus('bazi-reverse', 3.2);
        addBonus('bazi', 0.8);
        addBonus('bazi-ziwei', 0.4);
        break;
      case 'pure_phone_or_plate':
        addBonus('number-energy', 3.2);
        addBonus('meihua', 0.5);
        break;
      case 'pure_single_chars':
        addBonus('character-query', 3.2);
        addBonus('chinese-name', 0.6);
        addBonus('chinese-naming', 0.5);
        break;
      case 'pure_numbers_2':
        addBonus('meihua', 2.6);
        addBonus('xiaoliuren', 1.1);
        addBonus('zhuge', 0.8);
        break;
      case 'pure_numbers_3':
        addBonus('xiaoliuren', 2.4);
        addBonus('meihua', 1.8);
        addBonus('zhuge', 1.5);
        break;
      case 'pure_two_birthdates':
        if (trad === 'western_cards') {
          addBonus('astrolabe-synastry', 2.8);
          addBonus('bazi-synastry', 0.9);
          addBonus('ziwei-synastry', 0.8);
        } else {
          addBonus('bazi-synastry', 2.8);
          addBonus('ziwei-synastry', 1.2);
          addBonus('astrolabe-synastry', 0.7);
        }
        break;
      case 'pure_birthdate':
        if (preferredChart && trad === 'any') {
          const resolved =
            preferredChart === 'astrolabe' && (bt === 'range' || bt === 'unknown')
              ? 'astrolabe-range'
              : preferredChart === 'qizheng' && (bt === 'range' || bt === 'unknown')
                ? 'qizheng-range'
                : preferredChart;
          addBonus(resolved, 3.2);
        } else if (trad === 'western_cards') {
          addBonus(bt === 'range' || bt === 'unknown' ? 'astrolabe-range' : 'astrolabe', 2.6);
          addBonus('bazi', 0.8);
          addBonus('ziwei', 0.7);
        } else {
          addBonus('bazi', 2.6);
          addBonus('ziwei', 1.2);
          addBonus('bazi-ziwei', 1.0);
        }
        break;
    }
  }

  // 3a. Explicit user request always takes priority
  if (explicitMethod) {
    // Disambiguate range birth time when user explicitly says astrolabe/qizheng
    if (explicitMethod === 'astrolabe' && (bt === 'range' || bt === 'unknown')) {
      addBonus('astrolabe-range', 2.4);
      addBonus('astrolabe', 0.4);
    } else if (explicitMethod === 'qizheng' && (bt === 'range' || bt === 'unknown')) {
      addBonus('qizheng-range', 2.4);
      addBonus('qizheng', 0.4);
    } else {
      addBonus(explicitMethod, 2.2);
      if (DIVINATION_METHODS.has(explicitMethod) && explicitMethod !== 'fortune') {
        addBonus('fortune', -1.6);
      }
    }
  } else if (explicitDivination) {
    // User explicitly asked to cast a divination (e.g. 起一卦/起一课/摇一卦/抽一签/抽张牌/占卜)
    // Suppress birth-based fortune / natal charts even if the query mentions "今天运势/事业运"
    addBonus('fortune', -2.6);
    addBonus('bazi', -1.2);
    addBonus('ziwei', -1.2);
    addBonus('bazi-ziwei', -1.2);
    addBonus('astrolabe', -1.2);
    addBonus('qizheng', -1.2);
    addBonus('minglu', -1.2);
    addBonus('qimen-lifetime', -1.2);
    if (explicitDivination === 'hexagram') {
      const targetDiv = preferredDivination ?? 'liuyao';
      addBonus(targetDiv, preferredDivination ? 3.2 : 2.2);
      if (!preferredDivination) {
        addBonus('meihua', 1.3);
      }
    } else if (explicitDivination === 'lesson') {
      const targetLesson = preferredDivination ?? 'liuren';
      addBonus(targetLesson, preferredDivination ? 3.2 : 2.35);
      if (!preferredDivination) {
        addBonus('jinkoujue', 0.6);
      }
    } else if (explicitDivination === 'lots') {
      addBonus('ssgw', 2.2);
      addBonus('zhuge', 0.8);
    } else if (explicitDivination === 'cards') {
      const targetCard =
        preferredDivination === 'lenormand' ? 'lenormand' : 'tarot';
      addBonus(targetCard, 2.35);
      addBonus(targetCard === 'tarot' ? 'lenormand' : 'tarot', 0.8);
    } else {
      const targetGen = preferredDivination ?? 'liuyao';
      addBonus(targetGen, preferredDivination ? 2.8 : 1.6);
      if (!preferredDivination) {
        addBonus('meihua', 1.2);
        addBonus('qimen', 0.7);
      }
    }
  } else if (explicitChart) {
    const targetChart = preferredChart ?? 'bazi';
    const resolvedChart =
      targetChart === 'astrolabe' && (bt === 'range' || bt === 'unknown')
        ? 'astrolabe-range'
        : targetChart === 'qizheng' && (bt === 'range' || bt === 'unknown')
          ? 'qizheng-range'
          : targetChart;
    addBonus(resolvedChart, preferredChart ? 3.0 : 2.1);
    if (!preferredChart) {
      addBonus('ziwei', 0.8);
    }
  }

  // 3b. Tradition preference soft alignment (when not overridden by explicit mention)
  if (!explicitMethod && trad !== 'any') {
    for (const m of model.methods) {
      if (trad === 'western_cards') {
        if (WESTERN_CARDS_METHODS.has(m)) addBonus(m, 0.85);
        else if (FOLK_SIGNS_METHODS.has(m)) addBonus(m, -0.6);
      } else if (trad === 'folk_signs') {
        if (FOLK_SIGNS_METHODS.has(m)) addBonus(m, 1.1);
        else if (WESTERN_CARDS_METHODS.has(m)) addBonus(m, -0.6);
      } else if (trad === 'eastern') {
        if (WESTERN_CARDS_METHODS.has(m)) addBonus(m, -0.75);
      }
    }
  }

  // 3c. Depth preference soft alignment
  if (!explicitMethod && depth === 'quick') {
    for (const m of QUICK_METHODS) addBonus(m, 0.35);
    for (const m of DEEP_METHODS) addBonus(m, -0.2);
  } else if (!explicitMethod && depth === 'deep') {
    for (const m of DEEP_METHODS) addBonus(m, 0.35);
    for (const m of QUICK_METHODS) addBonus(m, -0.15);
  }

  // 3d. Unknown birth time dual-track safeguard
  if (bt === 'unknown') {
    if (isLongTerm && !isShortTerm) {
      // Track 2: Long-term fate / synastry -> calibration-friendly natal methods
      for (const m of CALIBRATION_NATAL_METHODS) addBonus(m, 0.7);
      addBonus('astrolabe', -0.9);
      addBonus('qizheng', -0.9);
      addBonus('minglu', -0.7);
      addBonus('qimen-lifetime', -0.9);
      if (isTwoPerson) {
        addBonus('bazi-synastry', 0.8);
        addBonus('ziwei-synastry', 0.6);
      }
    } else if (isShortTerm && !isLongTerm) {
      // Track 1: Specific event / short-term decision -> divination directly
      for (const m of DIVINATION_METHODS) addBonus(m, 0.55);
      for (const m of CALIBRATION_NATAL_METHODS) addBonus(m, -0.6);
      addBonus('astrolabe', -1.0);
      addBonus('qizheng', -1.0);
      addBonus('minglu', -1.0);
      addBonus('qimen-lifetime', -1.0);
    }
  }

  // 3e. Range birth time boost for range-aware methods
  if (bt === 'range' && !explicitMethod) {
    if (/(星盘|上升|西洋|占星)/.test(qNorm)) addBonus('astrolabe-range', 1.2);
    if (/(七政|果老|宿度)/.test(qNorm)) addBonus('qizheng-range', 1.2);
  }

  // 3f. Advanced optional toggles
  if (hasManualCast) {
    for (const m of ['liuyao', 'tarot', 'lenormand', 'ssgw', 'zhuge', 'meihua'] as MethodId[]) {
      addBonus(m, 0.45);
    }
  }
  if (hasHouseFacing) {
    addBonus('xuankong', 0.55);
    addBonus('residential', 0.55);
    addBonus('bazhai', 0.3);
  }

  // 3g. Explicit user default chart/divination weighting + gentle local usage affinity
  // (only when no explicit method, explicit action verb, or wild structured input was given)
  if (!explicitMethod && !explicitDivination && !explicitChart && !wildKind) {
    const NATAL_FAMILY = new Set<MethodId>([
      'bazi',
      'ziwei',
      'bazi-ziwei',
      'astrolabe',
      'qizheng',
      'minglu',
      'qimen-lifetime',
    ]);
    // Inspect current pre-preference leader to keep preference weighting strictly within family
    let topIdx = 0;
    for (let c = 1; c < C; c++) {
      if (logits[c] > logits[topIdx]) topIdx = c;
    }
    const preTopMethod = model.methods[topIdx];
    const familyBoost =
      prefWeightMode === 'strong' ? 1.15 : prefWeightMode === 'off' ? 0 : 0.42;

    if (
      familyBoost > 0 &&
      preferredDivination &&
      (DIVINATION_METHODS.has(preTopMethod) || (isShortTerm && !isLongTerm))
    ) {
      addBonus(preferredDivination, familyBoost);
    }
    if (
      familyBoost > 0 &&
      preferredChart &&
      (NATAL_FAMILY.has(preTopMethod) || (isLongTerm && !isShortTerm && !isTwoPerson))
    ) {
      addBonus(preferredChart, familyBoost);
    }

    if (storedSettings.learnFromHistory) {
      for (const m of model.methods) {
        const prefBonus = getLocalRouterMethodBonus(m);
        if (prefBonus > 0) addBonus(m, prefBonus);
      }
    }
  }

  // 3h. Hard-filter user-disabled router methods (e.g. fortune disabled by default in web UI)
  if (disabledSet.size > 0 && disabledSet.size < C) {
    for (const m of disabledSet) {
      const idx = model.methodToIdx.get(m);
      if (idx !== undefined) logits[idx] = -1e9;
    }
  }

  // 4. Softmax & Top-3 selection (with multi-intent secondary coverage)
  const probs = softmax(logits);
  const allRanked = Array.from({ length: C }, (_, idx) => ({
    method: model.methods[idx],
    prob: probs[idx],
  }));
  const filteredRanked =
    disabledSet.size > 0 && disabledSet.size < C
      ? allRanked.filter((item) => !disabledSet.has(item.method))
      : allRanked;
  const ranked = filteredRanked.length > 0 ? filteredRanked : allRanked;
  ranked.sort((a, b) => b.prob - a.prob);
  const top3 = ranked.slice(0, 3);

  const primaryMethod = top3[0].method;
  const secondaryIntentMethods = detectSecondaryIntentMethods(query, primaryMethod).filter(
    (m) => !disabledSet.has(m),
  );
  const injectedSecondary = new Set<MethodId>();
  if (secondaryIntentMethods.length > 0 && !wildKind) {
    const firstSec = secondaryIntentMethods[0];
    if (!top3.some((item) => item.method === firstSec)) {
      const secIdx = model.methodToIdx.get(firstSec);
      const rawSecProb = secIdx !== undefined ? probs[secIdx] : 0.01;
      const cappedProb = Math.min(top3[1].prob, Math.max(rawSecProb, top3[2].prob * 0.92, 0.01));
      top3[2] = { method: firstSec, prob: cappedProb };
      injectedSecondary.add(firstSec);
    }
  }

  const recommendations: MethodRecommendation[] = top3.map((item, rankIdx) => {
    const isCalib =
      bt === 'unknown' &&
      CALIBRATION_NATAL_METHODS.has(item.method) &&
      item.method !== 'bazi-reverse';
    const isExplicit = rankIdx === 0 && explicitMethod === item.method;
    const baseReason = buildDynamicReason(item.method, input, isCalib, isExplicit);
    const reason = injectedSecondary.has(item.method)
      ? `兼顾你提问中的次要诉求：${baseReason}`
      : baseReason;
    return {
      method: item.method,
      label: METHOD_LABELS[item.method],
      confidence: Number(item.prob.toFixed(4)),
      reason,
      missingInfoHint: buildMissingInfoHint(item.method, query, bt, hasHouseFacing),
      calibrationSuggested: isCalib,
    };
  });

  // 5. Domain detection & Prompt framework recommendation
  const detectedDomain = detectDomain(query, primaryMethod);
  const recommendedFramework = selectPromptFramework(input, primaryMethod, detectedDomain);

  const calibrationSuggested = recommendations[0].calibrationSuggested;
  const latencyMs = Number((performance.now() - t0).toFixed(3));

  return {
    recommendations,
    detectedDomain,
    recommendedFramework,
    calibrationSuggested,
    latencyMs,
  };
}
