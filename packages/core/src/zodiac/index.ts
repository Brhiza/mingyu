/**
 * @file 生肖犯太岁 / 流年运程
 * @description 由年支推算值/冲/刑/害/破太岁，并逐项返回流年干支五行、三合六合与三会关系及解释边界。
 * @传统依据 十二地支同支、合冲刑害破与三合三会固定关系表，以及天干地支五行公共规则。
 * 复用 ganzhi 的干支关系函数。生肖按立春为年界（调用方传入立春校正后的年柱）。
 */
import {
  getStemWuxing,
  getBranchWuxing,
  isSheng,
  isKe,
  isLiuchong,
  isLiuhai,
  isLiupo,
  isSanxing,
  isLiuhe,
  isValidGanZhi,
  getBranchIndex,
  BRANCH_SANHE,
  SANHUI_GROUPS,
  ZODIACS,
  EARTHLY_BRANCHES,
  SIXTY_CYCLE,
  getGanZhiFromDate,
} from '../ganzhi';
import { analyzeZodiacEvidence } from './evidence';

export { analyzeZodiacEvidence } from './evidence';
export type {
  ZodiacCalculationStep,
  ZodiacCounterEvidenceFact,
  ZodiacCounterSummaryFact,
  ZodiacEvidenceAnalysis,
  ZodiacLimitationFact,
  ZodiacRelationEvidence,
} from './evidence';

/** 六十甲子值年太岁星君 */
export const TAI_SUI_STARS: Readonly<Record<string, string>> = Object.freeze({
  甲子: '金辨',
  乙丑: '陈材',
  丙寅: '耿章',
  丁卯: '沈悌',
  戊辰: '赵达',
  己巳: '郭灿',
  庚午: '王济',
  辛未: '李素',
  壬申: '刘旺',
  癸酉: '康志',
  甲戌: '施广',
  乙亥: '任保',
  丙子: '郭嘉',
  丁丑: '汪文',
  戊寅: '鲁先',
  己卯: '龙仲',
  庚辰: '董德',
  辛巳: '郑但',
  壬午: '陆明',
  癸未: '魏仁',
  甲申: '方杰',
  乙酉: '蒋崇',
  丙戌: '白敏',
  丁亥: '封济',
  戊子: '邹铛',
  己丑: '潘佐',
  庚寅: '邬桓',
  辛卯: '范宁',
  壬辰: '彭泰',
  癸巳: '徐斝',
  甲午: '章词',
  乙未: '杨仙',
  丙申: '管仲',
  丁酉: '唐杰',
  戊戌: '姜武',
  己亥: '谢焘',
  庚子: '卢秘',
  辛丑: '杨信',
  壬寅: '贺谔',
  癸卯: '皮时',
  甲辰: '李诚',
  乙巳: '吴遂',
  丙午: '文哲',
  丁未: '缪丙',
  戊申: '徐浩',
  己酉: '程宝',
  庚戌: '倪秘',
  辛亥: '叶坚',
  壬子: '丘德',
  癸丑: '朱得',
  甲寅: '张朝',
  乙卯: '万清',
  丙辰: '辛亚',
  丁巳: '杨彦',
  戊午: '黎卿',
  己未: '傅党',
  庚申: '毛梓',
  辛酉: '石政',
  壬戌: '洪充',
  癸亥: '虞程',
});

function assertTaiSuiStarTable() {
  const expected = new Set<string>(SIXTY_CYCLE);
  const keys = Object.keys(TAI_SUI_STARS);
  const missing = SIXTY_CYCLE.filter((ganZhi) => !TAI_SUI_STARS[ganZhi]?.trim());
  const unexpected = keys.filter((ganZhi) => !expected.has(ganZhi));
  const duplicateNames = [...new Set(Object.values(TAI_SUI_STARS))].filter(
    (name) => Object.values(TAI_SUI_STARS).filter((item) => item === name).length > 1,
  );
  if (missing.length || unexpected.length || duplicateNames.length || keys.length !== 60) {
    throw new Error(
      `六十甲子太岁星君资料不完整：缺失${missing.join('、') || '无'}；多余${unexpected.join('、') || '无'}；重名${duplicateNames.join('、') || '无'}；当前${keys.length}项`,
    );
  }
}

assertTaiSuiStarTable();

export interface TaiSuiConflict {
  type: '值太岁' | '冲太岁' | '刑太岁' | '害太岁' | '破太岁';
  with: string; // 流年地支
  desc: string;
}

/** 生肖是否犯太岁（年支视角） */
export function getTaiSuiConflicts(zodiacBranch: string, yearBranch: string): TaiSuiConflict[] {
  try {
    getBranchIndex(zodiacBranch);
  } catch {
    throw new Error(`生肖地支无效：${zodiacBranch}`);
  }
  try {
    getBranchIndex(yearBranch);
  } catch {
    throw new Error(`流年地支无效：${yearBranch}`);
  }
  const out: TaiSuiConflict[] = [];
  if (zodiacBranch === yearBranch) {
    out.push({
      type: '值太岁',
      with: yearBranch,
      desc: '本命年，环境变化与自我要求容易放大，重要事项多做复核。',
    });
  }
  if (isLiuchong(zodiacBranch, yearBranch)) {
    out.push({
      type: '冲太岁',
      with: yearBranch,
      desc: '岁冲，变动和对立感容易增加，适合预留调整空间。',
    });
  }
  if (isSanxing(zodiacBranch, yearBranch)) {
    out.push({
      type: '刑太岁',
      with: yearBranch,
      desc: '相刑，规则、沟通和重复摩擦需要更仔细处理。',
    });
  }
  if (isLiuhai(zodiacBranch, yearBranch)) {
    out.push({
      type: '害太岁',
      with: yearBranch,
      desc: '相害，信息差、边界不清和间接影响值得留意。',
    });
  }
  if (isLiupo(zodiacBranch, yearBranch)) {
    out.push({
      type: '破太岁',
      with: yearBranch,
      desc: '相破，计划容易出现小缺口，需提前检查资源和约定。',
    });
  }
  return out;
}

/** 流年值年太岁 */
export function getYearTaiSui(yearGanZhi: string): { yearBranch: string; star: string } {
  if (!isValidGanZhi(yearGanZhi)) {
    throw new Error(`流年干支无效：${yearGanZhi}`);
  }
  const star = TAI_SUI_STARS[yearGanZhi];
  if (!star) throw new Error(`太岁星君数据缺失：${yearGanZhi}`);
  return { yearBranch: yearGanZhi[1], star };
}

export interface ZodiacYearFortune {
  zodiacBranch: string;
  zodiac: string;
  yearGanZhi: string;
  yearBranch: string;
  /** 年干与生肖五行关系 */
  relation: string;
  elementRelation: ZodiacElementRelation;
  /** 三合/六合贵人 */
  noble: string | null;
  /** 两支同属固定三会组；只记录关系，不表示完整三会成局 */
  meeting: string | null;
  conflicts: TaiSuiConflict[];
  evidenceGrade: '轻量';
  interpretationBoundary: '仅限生肖与流年关系';
  favorableRelations: string[];
  riskRelations: string[];
  actionSignals: string[];
  evidenceAnalysis: import('./evidence').ZodiacEvidenceAnalysis;
  prompt: string;
}

export interface ZodiacElementRelation {
  kind: '年干生生肖' | '生肖生年干' | '年干克生肖' | '生肖克年干' | '同类';
  label: string;
  classification: '有利关系' | '风险关系' | '中性关系';
  yearStemWuxing: string;
  zodiacWuxing: string;
}

/** 生肖流年便捷输入；可传生肖名称或年支，并明确提供公历年或流年干支。 */
export interface ZodiacYearFortuneInput {
  zodiac: string;
  /** 公历流年；与 yearGanZhi 至少提供一项。 */
  year?: number;
  /** 直接指定六十甲子；与 year 同时提供时会校验一致性。 */
  yearGanZhi?: string;
}

function resolveZodiacBranch(value: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('zodiac 必须是生肖名称或十二地支。');
  }
  const normalized = value.trim();
  if ((EARTHLY_BRANCHES as readonly string[]).includes(normalized)) return normalized;
  const index = ZODIACS.findIndex((name) => name === normalized);
  if (index >= 0) return EARTHLY_BRANCHES[index];
  throw new TypeError(`无法识别的生肖或地支：${normalized}。`);
}

function resolveYearGanZhi(input: ZodiacYearFortuneInput): string {
  const year = input.year;
  if (year !== undefined && (!Number.isSafeInteger(year) || year < 1900 || year > 2200)) {
    throw new RangeError('year 必须是 1900-2200 之间的整数。');
  }

  const derived =
    year === undefined
      ? undefined
      : // 2 月 10 日一定在立春之后，可稳定取得该公历流年的年柱。
        getGanZhiFromDate(new Date(year, 1, 10, 12, 0, 0)).year;
  if (input.yearGanZhi !== undefined) {
    const value = input.yearGanZhi.trim();
    if (!isValidGanZhi(value)) throw new TypeError(`yearGanZhi 不是有效的六十甲子：${value}。`);
    if (derived !== undefined && derived !== value) {
      throw new RangeError(`year 与 yearGanZhi 不一致：${year} 年为 ${derived}。`);
    }
    return value;
  }
  if (derived === undefined) {
    throw new TypeError('生肖流年必须提供 year 或 yearGanZhi。');
  }
  return derived;
}

function getElementRelation(yearStemWuxing: string, zodiacWuxing: string): ZodiacElementRelation {
  if (isSheng(yearStemWuxing, zodiacWuxing)) {
    return {
      kind: '年干生生肖',
      label: '年干五行生生肖地支本气',
      classification: '有利关系',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  if (isSheng(zodiacWuxing, yearStemWuxing)) {
    return {
      kind: '生肖生年干',
      label: '生肖地支本气生年干五行',
      classification: '风险关系',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  if (isKe(yearStemWuxing, zodiacWuxing)) {
    return {
      kind: '年干克生肖',
      label: '年干五行克生肖地支本气',
      classification: '风险关系',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  if (isKe(zodiacWuxing, yearStemWuxing)) {
    return {
      kind: '生肖克年干',
      label: '生肖地支本气克年干五行',
      classification: '中性关系',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  return {
    kind: '同类',
    label: '年干五行与生肖地支本气同类',
    classification: '中性关系',
    yearStemWuxing,
    zodiacWuxing,
  };
}

function getSanhuiRelation(zodiacBranch: string, yearBranch: string): string | null {
  if (zodiacBranch === yearBranch) return null;
  const group = Object.entries(SANHUI_GROUPS).find(
    ([, members]) => members.includes(zodiacBranch) && members.includes(yearBranch),
  );
  return group ? `三会关系（${group[0]}）` : null;
}

/** 生肖流年运程 */
export function getZodiacYearFortune(zodiacBranch: string, yearGanZhi: string): ZodiacYearFortune {
  const taiSui = getYearTaiSui(yearGanZhi);
  const yearBranch = taiSui.yearBranch;
  const zodiacIdx = EARTHLY_BRANCHES.indexOf(zodiacBranch as (typeof EARTHLY_BRANCHES)[number]);
  if (zodiacIdx < 0) throw new Error(`生肖地支无效：${zodiacBranch}`);
  const zodiac = ZODIACS[zodiacIdx];
  const conflicts = getTaiSuiConflicts(zodiacBranch, yearBranch);
  const yearStemWuxing = getStemWuxing(yearGanZhi[0]);
  const zodiacWuxing = getBranchWuxing(zodiacBranch);
  const elementRelation = getElementRelation(yearStemWuxing, zodiacWuxing);
  const relation = elementRelation.label;
  let noble: string | null = null;
  if (isLiuhe(zodiacBranch, yearBranch)) noble = '六合贵人';
  else {
    const sanhe = BRANCH_SANHE[zodiacBranch];
    if (sanhe?.partners.includes(yearBranch)) noble = `三合贵人（${sanhe.group}）`;
  }
  const meeting = getSanhuiRelation(zodiacBranch, yearBranch);
  const favorableRelations = [
    noble ? noble : '',
    elementRelation.classification === '有利关系' ? relation : '',
  ].filter(Boolean);
  const riskRelations = [
    ...conflicts.map((conflict) => `${conflict.type}：${conflict.desc}`),
    elementRelation.classification === '风险关系' ? relation : '',
  ].filter(Boolean);
  const actionSignals = [
    conflicts.some((item) => item.type === '冲太岁') ? '重大变动前预留备选方案' : '',
    conflicts.some((item) => item.type === '值太岁') ? '重要决定多做一轮现实复核' : '',
    conflicts.some((item) => item.type === '刑太岁') ? '合同、规则和沟通内容尽量留痕' : '',
    noble ? '有合作或求助机会时，优先看对方是否真正可靠' : '',
  ].filter(Boolean);
  const resultBase = {
    zodiacBranch,
    zodiac,
    yearGanZhi,
    yearBranch,
    relation,
    elementRelation,
    noble,
    meeting,
    conflicts,
    evidenceGrade: '轻量' as const,
    interpretationBoundary: '仅限生肖与流年关系' as const,
    favorableRelations,
    riskRelations,
    actionSignals,
  };
  const evidenceAnalysis = analyzeZodiacEvidence(resultBase);
  const prompt = [
    `【生肖与流年关系简析】`,
    `${zodiac}（${zodiacBranch}）遇${yearGanZhi}年（${taiSui.star}太岁）。`,
    `五行关系：流年年干${yearGanZhi[0]}属${yearStemWuxing}，生肖地支${zodiacBranch}属${zodiacWuxing}，${relation}。`,
    noble ? `贵人：${noble}。` : '',
    meeting ? `三会关系：${meeting}` : '',
    conflicts.length ? `太岁关系：${conflicts.map((conflict) => conflict.type).join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ...resultBase,
    evidenceAnalysis,
    prompt,
  };
}

/** 从前端常用的“生肖/年支 + 公历年”输入直接生成生肖流年结果。 */
export function calculateZodiacYearFortune(input: ZodiacYearFortuneInput): ZodiacYearFortune {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('生肖流年参数必须是对象。');
  }
  return getZodiacYearFortune(resolveZodiacBranch(input.zodiac), resolveYearGanZhi(input));
}

export const zodiac = {
  TAI_SUI_STARS,
  getTaiSuiConflicts,
  getYearTaiSui,
  getZodiacYearFortune,
  calculateZodiacYearFortune,
};
