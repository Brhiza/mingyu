/**
 * @file 生肖犯太岁 / 流年运程
 * @description 由年支推算值/冲/刑/害/破太岁，并结合流年干支五行、三合六合贵人给出运程等级。
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
  ZODIACS,
  EARTHLY_BRANCHES,
} from '../ganzhi';
import { analyzeZodiacEvidence } from './evidence';

export { analyzeZodiacEvidence } from './evidence';
export type { ZodiacEvidenceAnalysis, ZodiacRelationEvidence } from './evidence';

/** 六十甲子值年太岁星君 */
export const TAI_SUI_STARS: Record<string, string> = {
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
};

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

export type FortuneLevel = '大吉' | '吉' | '平' | '凶' | '大凶';

export interface ZodiacYearFortune {
  zodiacBranch: string;
  zodiac: string;
  yearGanZhi: string;
  yearBranch: string;
  /** 年干与生肖五行关系 */
  relation: string;
  /** 三合/六合贵人 */
  noble: string | null;
  conflicts: TaiSuiConflict[];
  level: FortuneLevel;
  evidenceGrade: '轻量';
  confidence: '低';
  favorableRelations: string[];
  riskRelations: string[];
  actionSignals: string[];
  evidenceAnalysis: import('./evidence').ZodiacEvidenceAnalysis;
  prompt: string;
}

function relationText(yearStemWuxing: string, zodiacWuxing: string): string {
  if (isSheng(yearStemWuxing, zodiacWuxing)) return '年干五行生生肖地支本气';
  if (isSheng(zodiacWuxing, yearStemWuxing)) return '生肖地支本气生年干五行';
  if (isKe(yearStemWuxing, zodiacWuxing)) return '年干五行克生肖地支本气';
  if (isKe(zodiacWuxing, yearStemWuxing)) return '生肖地支本气克年干五行';
  return '年干五行与生肖地支本气同类';
}

function judgeLevel(conflicts: TaiSuiConflict[], relation: string): FortuneLevel {
  const severe = conflicts.some((c) => c.type === '值太岁' || c.type === '冲太岁');
  const mild = conflicts.length > 0;
  if (severe) return '凶';
  if (mild) return '平';
  if (relation.includes('年干五行生生肖')) return '吉';
  return '平';
}

/** 生肖流年运程 */
export function getZodiacYearFortune(zodiacBranch: string, yearGanZhi: string): ZodiacYearFortune {
  if (!isValidGanZhi(yearGanZhi)) {
    throw new Error(`流年干支无效：${yearGanZhi}`);
  }
  const yearBranch = yearGanZhi[1];
  const zodiacIdx = EARTHLY_BRANCHES.indexOf(zodiacBranch as (typeof EARTHLY_BRANCHES)[number]);
  if (zodiacIdx < 0) throw new Error(`生肖地支无效：${zodiacBranch}`);
  const zodiac = ZODIACS[zodiacIdx];
  const conflicts = getTaiSuiConflicts(zodiacBranch, yearBranch);
  const relation = relationText(getStemWuxing(yearGanZhi[0]), getBranchWuxing(zodiacBranch));
  let noble: string | null = null;
  if (isLiuhe(zodiacBranch, yearBranch)) noble = '六合贵人';
  else {
    const sanhe = BRANCH_SANHE[zodiacBranch];
    if (sanhe?.partners.includes(yearBranch)) noble = `三合贵人（${sanhe.group}）`;
  }
  const level = judgeLevel(conflicts, relation);
  const favorableRelations = [
    noble ? noble : '',
    relation.includes('年干五行生生肖') ? relation : '',
  ].filter(Boolean);
  const riskRelations = [
    ...conflicts.map((conflict) => `${conflict.type}：${conflict.desc}`),
    relation.includes('克生肖') || relation.includes('生肖地支本气生年干') ? relation : '',
  ].filter(Boolean);
  const actionSignals = [
    conflicts.some((item) => item.type === '冲太岁') ? '重大变动前预留备选方案' : '',
    conflicts.some((item) => item.type === '值太岁') ? '重要决定多做一轮现实复核' : '',
    conflicts.some((item) => item.type === '刑太岁') ? '合同、规则和沟通内容尽量留痕' : '',
    noble ? '有合作或求助机会时，优先看对方是否真正可靠' : '',
  ].filter(Boolean);
  const yearStemWuxing = getStemWuxing(yearGanZhi[0]);
  const yearBranchWuxing = getBranchWuxing(yearBranch);
  const zodiacWuxing = getBranchWuxing(zodiacBranch);
  const resultBase = {
    zodiacBranch,
    zodiac,
    yearGanZhi,
    yearBranch,
    relation,
    noble,
    conflicts,
    level,
    evidenceGrade: '轻量' as const,
    confidence: '低' as const,
    favorableRelations,
    riskRelations,
    actionSignals,
  };
  const evidenceAnalysis = analyzeZodiacEvidence(resultBase);
  const prompt = [
    `【生肖与流年关系简析】`,
    `${zodiac}（${zodiacBranch}）遇${yearGanZhi}年（${TAI_SUI_STARS[yearGanZhi] ?? ''}太岁）。`,
    `五行来源：流年年干${yearGanZhi[0]}属${yearStemWuxing}，流年地支${yearBranch}属${yearBranchWuxing}；生肖地支${zodiacBranch}属${zodiacWuxing}；年干与生肖五行据此得到“${relation}”，年支则用于值、冲、刑、害、破及三合六合判断。`,
    `干支关系：${relation}。`,
    noble ? `贵人：${noble}。` : '贵人：无明显三合六合贵人。',
    conflicts.length
      ? `犯太岁明细：${conflicts.map((conflict) => `${conflict.type}（${conflict.desc}）`).join('；')}`
      : '犯太岁明细：本年未命中值、冲、刑、害、破太岁。',
    `有利关系：${favorableRelations.join('；') || '未见三合六合或年干明显生扶'}。`,
    `风险关系：${riskRelations.join('；') || '未见值、冲、刑、害、破关系'}。`,
    `行动信号：${actionSignals.join('；') || '按实际计划稳步推进，不因生肖关系额外制造焦虑'}。`,
    evidenceAnalysis.promptText,
    '证据边界：本次只作生肖与流年关系层的趋势参考；不得仅凭犯太岁名称断定必然事件，也不得把化解建议写成保证结果。',
    '',
    '请围绕上述生肖与流年地支关系，依次说明有利关系、风险关系、可观察的现实信号和稳妥行动建议。',
  ].join('\n');

  return {
    ...resultBase,
    evidenceAnalysis,
    prompt,
  };
}

export const zodiac = {
  TAI_SUI_STARS,
  getTaiSuiConflicts,
  getYearTaiSui,
  getZodiacYearFortune,
};
