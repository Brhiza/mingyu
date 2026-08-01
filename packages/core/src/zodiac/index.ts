/**
 * @file 生肖与流年固定关系
 * @description 由年支逐项核验值/冲/刑/害/破、流年干支五行、三合六合与三会关系及解释边界。
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
} from '../ganzhi';
import { analyzeZodiacEvidence as buildZodiacEvidence } from './evidence';
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
  /** 只描述固定关系表如何命中，不生成现实事件或行动建议。 */
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
      desc: '生肖年支与流年年支相同。',
    });
  }
  if (isLiuchong(zodiacBranch, yearBranch)) {
    out.push({
      type: '冲太岁',
      with: yearBranch,
      desc: '生肖年支与流年年支命中十二地支六冲表。',
    });
  }
  if (isSanxing(zodiacBranch, yearBranch)) {
    out.push({
      type: '刑太岁',
      with: yearBranch,
      desc: '生肖年支与流年年支命中十二地支相刑表。',
    });
  }
  if (isLiuhai(zodiacBranch, yearBranch)) {
    out.push({
      type: '害太岁',
      with: yearBranch,
      desc: '生肖年支与流年年支命中十二地支六害表。',
    });
  }
  if (isLiupo(zodiacBranch, yearBranch)) {
    out.push({
      type: '破太岁',
      with: yearBranch,
      desc: '生肖年支与流年年支命中十二地支六破表。',
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
  /** 审核重建所需的唯一可信来源；其余字段均为派生结果。 */
  generation: ZodiacGenerationSource;
  zodiacBranch: string;
  zodiac: string;
  yearGanZhi: string;
  yearBranch: string;
  /** 年干与生肖五行关系 */
  relation: string;
  elementRelation: ZodiacElementRelation;
  /** 两支命中的六合或三合组成员关系；不改写为现实“贵人”。 */
  harmony: string | null;
  /** 两支同属固定三会组；只记录关系，不表示完整三会成局 */
  meeting: string | null;
  conflicts: TaiSuiConflict[];
  evidenceGrade: '轻量';
  interpretationBoundary: '仅限生肖与流年关系';
  evidenceAnalysis: import('./evidence').ZodiacEvidenceAnalysis;
  prompt: string;
}

export interface ZodiacGenerationSource {
  zodiacBranch: string;
  yearGanZhi: string;
}

export interface ZodiacElementRelation {
  kind: '年干生生肖' | '生肖生年干' | '年干克生肖' | '生肖克年干' | '同类';
  label: string;
  yearStemWuxing: string;
  zodiacWuxing: string;
}

function getElementRelation(yearStemWuxing: string, zodiacWuxing: string): ZodiacElementRelation {
  if (isSheng(yearStemWuxing, zodiacWuxing)) {
    return {
      kind: '年干生生肖',
      label: '年干五行生生肖地支本气',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  if (isSheng(zodiacWuxing, yearStemWuxing)) {
    return {
      kind: '生肖生年干',
      label: '生肖地支本气生年干五行',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  if (isKe(yearStemWuxing, zodiacWuxing)) {
    return {
      kind: '年干克生肖',
      label: '年干五行克生肖地支本气',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  if (isKe(zodiacWuxing, yearStemWuxing)) {
    return {
      kind: '生肖克年干',
      label: '生肖地支本气克年干五行',
      yearStemWuxing,
      zodiacWuxing,
    };
  }
  return {
    kind: '同类',
    label: '年干五行与生肖地支本气同类',
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

const ZODIAC_GENERATION_KEYS = new Set(['zodiacBranch', 'yearGanZhi']);

function normalizeZodiacGenerationSource(source: unknown): ZodiacGenerationSource {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('生肖流年审核重建必须提供可信生成来源。');
  }
  const sourceRecord = source as Record<string, unknown>;
  const unexpectedKeys = Object.keys(sourceRecord).filter(
    (key) => !ZODIAC_GENERATION_KEYS.has(key),
  );
  if (unexpectedKeys.length) {
    throw new Error(`生肖流年可信生成来源包含不受支持的字段：${unexpectedKeys.join('、')}`);
  }
  if (!Object.prototype.hasOwnProperty.call(sourceRecord, 'zodiacBranch')) {
    throw new Error('生肖流年可信生成来源缺少生肖年支。');
  }
  if (!Object.prototype.hasOwnProperty.call(sourceRecord, 'yearGanZhi')) {
    throw new Error('生肖流年可信生成来源缺少流年干支。');
  }
  if (typeof sourceRecord.zodiacBranch !== 'string') {
    throw new Error('生肖流年可信生成来源的生肖年支必须是字符串。');
  }
  if (!(EARTHLY_BRANCHES as readonly string[]).includes(sourceRecord.zodiacBranch)) {
    throw new Error(`生肖地支无效：${sourceRecord.zodiacBranch}`);
  }
  if (typeof sourceRecord.yearGanZhi !== 'string') {
    throw new Error('生肖流年可信生成来源的流年干支必须是字符串。');
  }
  if (!isValidGanZhi(sourceRecord.yearGanZhi)) {
    throw new Error(`流年干支无效：${sourceRecord.yearGanZhi}`);
  }
  return {
    zodiacBranch: sourceRecord.zodiacBranch,
    yearGanZhi: sourceRecord.yearGanZhi,
  };
}

function buildZodiacYearFortune(source: ZodiacGenerationSource): ZodiacYearFortune {
  const { zodiacBranch, yearGanZhi } = source;
  const generation = normalizeZodiacGenerationSource(source);
  const taiSui = getYearTaiSui(yearGanZhi);
  const yearBranch = taiSui.yearBranch;
  const zodiacIdx = EARTHLY_BRANCHES.indexOf(zodiacBranch as (typeof EARTHLY_BRANCHES)[number]);
  const zodiac = ZODIACS[zodiacIdx];
  const conflicts = getTaiSuiConflicts(zodiacBranch, yearBranch);
  const yearStemWuxing = getStemWuxing(yearGanZhi[0]);
  const yearBranchWuxing = getBranchWuxing(yearBranch);
  const zodiacWuxing = getBranchWuxing(zodiacBranch);
  const elementRelation = getElementRelation(yearStemWuxing, zodiacWuxing);
  const relation = elementRelation.label;
  let harmony: string | null = null;
  if (isLiuhe(zodiacBranch, yearBranch)) harmony = '六合关系';
  else {
    const sanhe = BRANCH_SANHE[zodiacBranch];
    if (sanhe?.partners.includes(yearBranch)) harmony = `三合组成员关系（${sanhe.group}）`;
  }
  const meeting = getSanhuiRelation(zodiacBranch, yearBranch);
  const resultBase: Omit<ZodiacYearFortune, 'evidenceAnalysis' | 'prompt'> = {
    generation,
    zodiacBranch,
    zodiac,
    yearGanZhi,
    yearBranch,
    relation,
    elementRelation,
    harmony,
    meeting,
    conflicts,
    evidenceGrade: '轻量',
    interpretationBoundary: '仅限生肖与流年关系',
  };
  const evidenceAnalysis = buildZodiacEvidence(resultBase);
  const prompt = [
    `【生肖与流年关系简析】`,
    `${zodiac}（${zodiacBranch}）遇${yearGanZhi}年（${taiSui.star}太岁）。`,
    `五行来源：流年年干${yearGanZhi[0]}属${yearStemWuxing}，流年地支${yearBranch}属${yearBranchWuxing}；生肖地支${zodiacBranch}属${zodiacWuxing}；年干与生肖五行据此得到“${relation}”，年支则用于值、冲、刑、害、破、三合、六合及三会判断。`,
    `干支关系：${relation}。`,
    harmony ? `六合或三合资料：${harmony}；只表示两支命中固定关系表。` : '',
    meeting ? `三会：${meeting}；仅表示两支同属三会组，不表示完整三会成局。` : '',
    conflicts.length
      ? `犯太岁明细：${conflicts.map((conflict) => `${conflict.type}（${conflict.desc}）`).join('；')}`
      : '',
    `资料边界：以上只保留生肖年支、流年干支、固定地支关系与五行生克方向，不生成现实吉凶、贵人判断、行动建议或化解结论。`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ...resultBase,
    evidenceAnalysis,
    prompt,
  };
}

/** 生肖与流年固定关系。函数名为兼容既有调用保留，不生成运程结论。 */
export function getZodiacYearFortune(zodiacBranch: string, yearGanZhi: string): ZodiacYearFortune {
  return buildZodiacYearFortune({ zodiacBranch, yearGanZhi });
}

/** 只凭生肖年支与合法六十甲子重建全部关系、证据和提示词。 */
export function rebuildAuditedZodiacData(
  input: Pick<ZodiacYearFortune, 'generation'>,
): ZodiacYearFortune {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('生肖流年审核重建必须提供结果对象。');
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'generation')) {
    throw new Error('生肖流年旧结果缺少可信原始输入，无法审核重建。');
  }
  return buildZodiacYearFortune(normalizeZodiacGenerationSource(input.generation));
}

/** 先审核重建生肖流年结果，再返回结构化证据。 */
export function analyzeZodiacEvidence(
  input: Pick<ZodiacYearFortune, 'generation'>,
): ZodiacYearFortune['evidenceAnalysis'] {
  return rebuildAuditedZodiacData(input).evidenceAnalysis;
}

export const zodiac = {
  TAI_SUI_STARS,
  getTaiSuiConflicts,
  getYearTaiSui,
  getZodiacYearFortune,
  rebuildAuditedZodiacData,
  analyzeZodiacEvidence,
};
