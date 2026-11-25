/**
 * 生产级「本地硬代码护栏 + 自动纠错重试引擎」
 *
 * 1 毫秒内使用本地排盘真值与 60 甲子历法公式校验小模型输出：
 * - 支持校验模型基于当日四层锚点自主顺推的流年、流月、流日（60 甲子 +1/-1 精确验算）
 * - 一旦发现任意幻觉/逻辑反转/格式残缺，自动生成精准纠错指令并触发重试（默认最多 2 次）
 */
import { SIXTY_CYCLE, getSixtyCycleName, getYearSixtyCycle } from '../systems/ganzhi-foundation';
import { getMutagensByStem, type HeavenlyStem } from '../systems/ziwei/index';
import {
  STYLE_A_SECTIONS,
  computeTenGod,
  type GuardrailFacts,
  type StyleATopic,
} from './compact-card';
import { checkSanhePhysics, checkWuxingPhysics } from './extra-systems';

export interface GuardrailCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface GuardrailReport {
  passed: boolean;
  score: number;
  charCount: number;
  checks: GuardrailCheck[];
  failures: string[];
  correctionPrompt: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const BANNED_FLUFF_WORDS = [
  '亲爱的', '放宽心', '别太担心', '不用太担心', '一切都会好起来',
  '保持积极心态', '加油', '祝你', '希望你能', '愿你',
  '人生没有过不去的坎', '顺其自然就好', '放平心态', '开心最重要',
];

const TOPIC_KEYWORDS: Record<StyleATopic, string[]> = {
  career: ['官', '杀', '印', '禄', '权', '事业', '职场', '职权', '仕途', '变动', '晋升', '官禄', '迁移'],
  wealth: ['财', '禄', '食', '伤', '比', '劫', '财帛', '田宅', '求财', '进财', '破耗', '收支', '资金'],
  relationship: ['妻', '夫', '婚', '感', '桃花', '合', '冲', '日支', '夫妻', '伴侣', '情感', '红鸾', '贪狼'],
  health: ['疾', '病', '寒', '燥', '湿', '泄', '克', '冲', '疾厄', '耗损', '体质', '气血', '调候', '土', '水', '火', '金', '木'],
  timing: ['大运', '大限', '流年', '流月', '流日', '引动', '冲', '合', '叠', '应期', '202', '203'],
  overall: ['格', '局', '命', '身', '旺', '弱', '用', '忌', '主星', '三方', '大运', '大限'],
};

const SIXTY_GZ_RE = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;
const MAJOR_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
  '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

function extractSection(text: string, header: string): string {
  const idx = text.indexOf(header);
  if (idx < 0) return '';
  const start = idx + header.length;
  let end = text.length;
  for (const other of STYLE_A_SECTIONS) {
    if (other === header) continue;
    const oIdx = text.indexOf(other, start);
    if (oIdx >= 0 && oIdx < end) end = oIdx;
  }
  return text.slice(start, end).trim();
}

/** 根据当日四层锚点，生成合法顺推的 60 甲子白名单（流月未来12月 + 流日未来14天 + 大运前后2步） */
function buildAnchorExtrapolatedWhitelist(facts: GuardrailFacts): Set<string> {
  const set = new Set<string>(facts.allAllowedGanZhi);
  const addWindow = (anchorGz: string | null | undefined, back: number, forward: number) => {
    if (!anchorGz) return;
    const idx = SIXTY_CYCLE.indexOf(anchorGz as (typeof SIXTY_CYCLE)[number]);
    if (idx < 0) return;
    for (let d = -back; d <= forward; d++) {
      set.add(getSixtyCycleName(idx + d));
    }
  };
  addWindow(facts.anchor.monthGanZhi, 1, 12);
  addWindow(facts.anchor.dayGanZhi, 2, 14);
  addWindow(facts.anchor.dayun, 1, 2);
  return set;
}

export function verifyStyleAOutput(
  output: string,
  facts: GuardrailFacts,
  topic: StyleATopic,
): GuardrailReport {
  const text = output.trim();
  const charCount = text.replace(/\s+/g, '').length;
  const checks: GuardrailCheck[] = [];

  // 1. 5 段格式完整性
  const missing: string[] = [];
  const empty: string[] = [];
  let prevIdx = -1;
  let orderOk = true;
  for (const sec of STYLE_A_SECTIONS) {
    const idx = text.indexOf(sec);
    if (idx < 0) missing.push(sec);
    else {
      if (idx < prevIdx) orderOk = false;
      prevIdx = idx;
      if (extractSection(text, sec).length < 8) empty.push(sec);
    }
  }
  checks.push({
    name: 'format_sections',
    passed: missing.length === 0 && empty.length === 0 && orderOk,
    detail: missing.length
      ? `缺少分段：${missing.join('、')}`
      : empty.length
        ? `分段内容过短：${empty.join('、')}`
        : !orderOk
          ? '5段顺序错乱'
          : '5段结构完整有序',
  });

  // 2. 字数红线
  const lengthOk = charCount >= 130 && charCount <= 420;
  checks.push({
    name: 'length_bounds',
    passed: lengthOk,
    detail: lengthOk ? `字数合规（${charCount}字）` : `字数越界（${charCount}字，要求130–420字）`,
  });

  // 3. 零鸡汤过滤
  const hitFluff = BANNED_FLUFF_WORDS.filter((w) => text.includes(w));
  checks.push({
    name: 'no_fluff',
    passed: hitFluff.length === 0,
    detail: hitFluff.length ? `包含禁用通俗安抚词：${hitFluff.join('、')}` : '无通俗鸡汤废话',
  });

  // 4. 盘面真值 + 60 甲子顺推验算
  const verifiedYearGzs = new Set<string>();
  const yearGzErrors: string[] = [];
  for (const m of text.matchAll(/(19\d{2}|20\d{2})年?([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?!\s*(?:运|大运|顺行|逆行|大限|月|流月|日|流日))/g)) {
    const yr = Number(m[1]);
    const gz = m[2];
    const realGz = getYearSixtyCycle(yr);
    if (realGz === gz) verifiedYearGzs.add(gz);
    else yearGzErrors.push(`${yr}年真实干支应为${realGz}（模型误写为${gz}）`);
  }

  const allowedGz = buildAnchorExtrapolatedWhitelist(facts);
  for (const gz of verifiedYearGzs) allowedGz.add(gz);

  if (facts.system === 'bazi') {
    const hallucinations: string[] = [...yearGzErrors];
    const dmMatch = text.match(/日主([甲乙丙丁戊己庚辛壬癸])/);
    if (dmMatch && dmMatch[1] !== facts.dayMaster) {
      hallucinations.push(`日主应为${facts.dayMaster}（模型误写为${dmMatch[1]}）`);
    }
    const unknownGzs = [...new Set(text.match(SIXTY_GZ_RE) ?? [])].filter((gz) => !allowedGz.has(gz));
    if (unknownGzs.length > 0) {
      hallucinations.push(`出现盘外及顺推窗口外的干支：${unknownGzs.join('、')}`);
    }
    checks.push({
      name: 'fact_grounding',
      passed: hallucinations.length === 0,
      detail: hallucinations.length ? hallucinations.join('；') : '干支/日主/顺推甲子100%忠实真值',
    });
  } else {
    const hallucinations: string[] = [...yearGzErrors];
    const unknownGzs = [...new Set(text.match(SIXTY_GZ_RE) ?? [])].filter((gz) => !allowedGz.has(gz));
    if (unknownGzs.length > 0) {
      hallucinations.push(`出现盘外及顺推窗口外的干支：${unknownGzs.join('、')}`);
    }
    const mingSec = extractSection(text, '【定格与强弱】');
    const mingClause = mingSec.match(/命宫[坐守居有]([^，。；\n]+)/);
    if (mingClause && facts.mingMajorStars.length > 0) {
      const wrongStars = MAJOR_STARS.filter((s) => mingClause[1].includes(s) && !facts.mingMajorStars.includes(s));
      if (wrongStars.length > 0) {
        hallucinations.push(`命宫主星应为${facts.mingMajorStars.join('、')}（模型误写为${wrongStars.join('、')}）`);
      }
    }
    checks.push({
      name: 'fact_grounding',
      passed: hallucinations.length === 0,
      detail: hallucinations.length ? hallucinations.join('；') : '星曜与顺推甲子100%忠实真值',
    });
  }

  // 5. 喜忌/逻辑一致性
  const bingYaoSec = extractSection(text, '【病药与喜忌】');
  if (facts.system === 'bazi') {
    const favMatch = bingYaoSec.match(/喜用[：:]?([^；。\n]+)/);
    const avoidMatch = bingYaoSec.match(/忌[：:神]?([^；。\n]+)/);
    let consistent = true;
    let detail = '喜忌与引擎裁定一致';
    if (facts.favorableWuxing.length > 0 && favMatch) {
      const primaryFav = facts.favorableWuxing[0];
      if (avoidMatch && avoidMatch[1].includes(primaryFav) && !favMatch[1].includes(primaryFav)) {
        consistent = false;
        detail = `主喜五行(${primaryFav})被错写成忌神，实际喜[${facts.favorableWuxing.join('、')}]忌[${facts.unfavorableWuxing.join('、')}]`;
      }
    }
    checks.push({ name: 'logic_consistency', passed: consistent, detail });
  } else {
    const hasCore = /化禄|化忌|化权|化科|救应|制衡|煞|吉格|空宫|自化|禄|忌/.test(bingYaoSec);
    checks.push({
      name: 'logic_consistency',
      passed: hasCore,
      detail: hasCore ? '四化与煞星制衡逻辑清晰' : '【病药与喜忌】缺少四化/制衡抓手',
    });
  }

  // 6. 岁运锚定核验
  const suiYunSec = extractSection(text, '【岁运引动】');
  const hasFortune =
    (facts.anchor.dayun && suiYunSec.includes(facts.anchor.dayun)) ||
    suiYunSec.includes(facts.anchor.yearGanZhi) ||
    facts.targetYears.some((y) => suiYunSec.includes(String(y.year)) || suiYunSec.includes(y.ganZhi)) ||
    /(202\d|203\d)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(suiYunSec);
  checks.push({
    name: 'fortune_grounding',
    passed: Boolean(hasFortune),
    detail: hasFortune ? '岁运段准确锚定大运/大限或流年' : '【岁运引动】未具体锚定当前大运/大限或流年干支',
  });

  // 7. 主题切中核验
  const xiangYiSec = extractSection(text, '【核心象义】');
  const topicHits = TOPIC_KEYWORDS[topic].filter((kw) => xiangYiSec.includes(kw));
  checks.push({
    name: 'topic_relevance',
    passed: topicHits.length > 0,
    detail: topicHits.length > 0 ? `切中主题（${topicHits.slice(0, 3).join('、')}）` : `【核心象义】未切中提问主题(${topic})`,
  });

  // 8. 通用五行生克 + 三合局 + 地支常识铁律
  const physicsErrors = [...checkWuxingPhysics(text), ...checkSanhePhysics(text)];
  if (/申酉相?刑|酉申相?刑/.test(text)) physicsErrors.push('地支相刑错：申酉不相刑');
  if (/([子丑寅卯辰巳午未申酉戌亥])冲\1/.test(text)) physicsErrors.push('地支六冲错：同支相见为伏吟而非相冲');
  checks.push({
    name: 'wuxing_physics',
    passed: physicsErrors.length === 0,
    detail: physicsErrors.length ? [...new Set(physicsErrors)].join('；') : '五行生克与地支三合六冲铁律无误',
  });

  // 9. 基础题专项硬核验（八字：天干十神称谓实时数学验算；紫微：大限+流年十干四化星实时查表验算）
  if (facts.system === 'bazi') {
    const tenGodErrors: string[] = [];
    const tenGodRe = /([甲乙丙丁戊己庚辛壬癸])[木火土金水]?(比肩|劫财|食神|伤官|正财|偏财|正官|七杀|正印|偏印)(?!格)/g;
    for (const m of text.matchAll(tenGodRe)) {
      const idx = m.index ?? 0;
      const prefix = text.slice(Math.max(0, idx - 3), idx);
      // 跳过“日主辛金七杀透干”这类主谓句（避免把日主本身误当十神主语）
      if (prefix.includes('日主') || (m[1] === facts.dayMaster && /[木火土金水]/.test(m[0]))) continue;
      const stem = m[1];
      const claimed = m[2];
      const actual = computeTenGod(facts.dayMaster, stem);
      if (actual && actual !== claimed) {
        tenGodErrors.push(`日主${facts.dayMaster}见${stem}应为${actual}（模型误写为${m[0]}）`);
      }
    }
    const dedup = [...new Set(tenGodErrors)].slice(0, 4);
    checks.push({
      name: 'ten_god_math',
      passed: dedup.length === 0,
      detail: dedup.length ? dedup.join('；') : '天干十神称谓100%准确',
    });
  } else {
    const sihuaErrors: string[] = [];
    const school = facts.mutagenSchool ?? 'default';
    const mutIdx: Record<string, number> = { 禄: 0, 权: 1, 科: 2, 忌: 3 };
    const starPat = '(紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军|文昌|文曲|左辅|右弼)';
    // A. 流年四化校验
    const yearClauseRe = /(19\d{2}|20\d{2})([甲乙丙丁戊己庚辛壬癸])[子丑寅卯辰巳午未申酉戌亥]((?:(?!19\d{2}|20\d{2})[^。；\n]){0,45})/g;
    for (const ym of text.matchAll(yearClauseRe)) {
      const yr = ym[1];
      const stem = ym[2] as HeavenlyStem;
      const clause = ym[3];
      const realMutagens = getMutagensByStem(stem, school);
      for (const sm of clause.matchAll(new RegExp(`流(禄|权|科|忌)${starPat}`, 'g'))) {
        const mut = sm[1];
        const star = sm[2];
        const expected = realMutagens[mutIdx[mut]];
        if (expected && expected !== star) {
          sihuaErrors.push(`${yr}${stem}干化${mut}应为${expected}（模型误写为流${mut}${star}）`);
        }
      }
      const direct = clause.match(new RegExp(`^[年，、]?${starPat}化?(禄|权|科|忌)`));
      if (direct) {
        const star = direct[1];
        const mut = direct[2];
        const expected = realMutagens[mutIdx[mut]];
        if (expected && expected !== star) {
          sihuaErrors.push(`${yr}${stem}干化${mut}应为${expected}（模型误写为${star}化${mut}）`);
        }
      }
    }
    // B. 大限十干四化校验（如“大限兄弟乙卯…大限天机忌”“癸未大限…大限天机忌”“甲午大限天机禄”）
    const decadalRe = /([甲乙丙丁戊己庚辛壬癸])[子丑寅卯辰巳午未申酉戌亥]大?限(?:[^。；\n]{0,20})大限?${starPat}化?(禄|权|科|忌)|([甲乙丙丁戊己庚辛壬癸])[子丑寅卯辰巳午未申酉戌亥]大限${starPat}化?(禄|权|科|忌)/g;
    const decadalReBuilt = new RegExp(
      `([甲乙丙丁戊己庚辛壬癸])[子丑寅卯辰巳午未申酉戌亥]大?限[^。；\\n]{0,18}?大限${starPat}化?(禄|权|科|忌)|([甲乙丙丁戊己庚辛壬癸])[子丑寅卯辰巳午未申酉戌亥]大限${starPat}化?(禄|权|科|忌)`,
      'g',
    );
    void decadalRe;
    for (const dm of text.matchAll(decadalReBuilt)) {
      const stem = (dm[1] ?? dm[4]) as HeavenlyStem;
      const star = dm[2] ?? dm[5];
      const mut = dm[3] ?? dm[6];
      const realMutagens = getMutagensByStem(stem, school);
      const expected = realMutagens[mutIdx[mut]];
      if (expected && expected !== star) {
        sihuaErrors.push(`大限${stem}干化${mut}应为${expected}（模型误写为${star}化${mut}）`);
      }
    }
    const dedup = [...new Set(sihuaErrors)].slice(0, 4);
    checks.push({
      name: 'ziwei_sihua_math',
      passed: dedup.length === 0,
      detail: dedup.length ? dedup.join('；') : '大限与流年十干四化100%准确',
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const failures = checks.filter((c) => !c.passed).map((c) => `[${c.name}] ${c.detail}`);
  const correctionPrompt = failures.length
    ? `上一版输出未通过本地排盘真值校验，请严格按原盘事实修正以下错误后重新输出完整 5 段风格 A 断语：\n${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
    : '';

  return {
    passed: failures.length === 0,
    score: Math.round((passedCount / checks.length) * 100),
    charCount,
    checks,
    failures,
    correctionPrompt,
  };
}

/**
 * 带本地排盘护栏的自动纠错重试执行器
 * 任意接入本地/云端小模型的调用都可直接包一层，一旦校验不通过立即带精准纠错提示重试。
 */
export async function runWithStyleAGuardrail(options: {
  systemPrompt: string;
  userPrompt: string;
  facts: GuardrailFacts;
  topic: StyleATopic;
  maxRetries?: number;
  generate: (messages: ChatMessage[], attempt: number) => Promise<string>;
}) {
  const maxRetries = options.maxRetries ?? 2;
  const messages: ChatMessage[] = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.userPrompt },
  ];

  const history: Array<{ attempt: number; output: string; report: GuardrailReport }> = [];
  let lastOutput = '';
  let lastReport: GuardrailReport | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const output = (await options.generate(messages, attempt)).trim();
    const report = verifyStyleAOutput(output, options.facts, options.topic);
    history.push({ attempt, output, report });
    lastOutput = output;
    lastReport = report;
    if (report.passed) {
      return { ok: true, text: output, attempts: attempt, report, history };
    }
    if (attempt <= maxRetries) {
      messages.push({ role: 'assistant', content: output });
      messages.push({ role: 'user', content: report.correctionPrompt });
    }
  }

  return { ok: false, text: lastOutput, attempts: maxRetries + 1, report: lastReport!, history };
}
