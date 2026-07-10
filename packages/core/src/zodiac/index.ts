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
  isCompleteSanhe,
  ZODIACS,
  EARTHLY_BRANCHES,
} from '../ganzhi';

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
  const out: TaiSuiConflict[] = [];
  if (zodiacBranch === yearBranch) {
    out.push({ type: '值太岁', with: yearBranch, desc: '本命年，值太岁当头，宜静不宜动。' });
  }
  if (isLiuchong(zodiacBranch, yearBranch)) {
    out.push({ type: '冲太岁', with: yearBranch, desc: '岁冲，变动大，防冲克。' });
  }
  if (isSanxing(zodiacBranch, yearBranch)) {
    out.push({ type: '刑太岁', with: yearBranch, desc: '相刑，口舌官非，谨防小人。' });
  }
  if (isLiuhai(zodiacBranch, yearBranch)) {
    out.push({ type: '害太岁', with: yearBranch, desc: '相害，暗中受损，防陷害。' });
  }
  if (isLiupo(zodiacBranch, yearBranch)) {
    out.push({ type: '破太岁', with: yearBranch, desc: '相破，破败损耗，防破财。' });
  }
  return out;
}

/** 流年值年太岁 */
export function getYearTaiSui(yearGanZhi: string): { yearBranch: string; star: string } {
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
  prompt: string;
}

function relationText(yearStemWuxing: string, zodiacWuxing: string): string {
  if (isSheng(yearStemWuxing, zodiacWuxing)) return '年干生扶生肖（印星得助）';
  if (isSheng(zodiacWuxing, yearStemWuxing)) return '生肖生年干（泄气耗神）';
  if (isKe(yearStemWuxing, zodiacWuxing)) return '年干克生肖（官杀压力）';
  if (isKe(zodiacWuxing, yearStemWuxing)) return '生肖克年干（财星可得）';
  return '比劫同气（帮扶竞争）';
}

function judgeLevel(conflicts: TaiSuiConflict[], relation: string): FortuneLevel {
  const severe = conflicts.some((c) => c.type === '值太岁' || c.type === '冲太岁');
  const mild = conflicts.length > 0;
  if (severe) return '大凶';
  if (mild) return '凶';
  if (relation.includes('印星') || relation.includes('财星')) return '吉';
  if (relation.includes('比劫')) return '平';
  return '平';
}

/** 生肖流年运程 */
export function getZodiacYearFortune(zodiacBranch: string, yearGanZhi: string): ZodiacYearFortune {
  const yearBranch = yearGanZhi[1];
  const zodiacIdx = EARTHLY_BRANCHES.indexOf(zodiacBranch as (typeof EARTHLY_BRANCHES)[number]);
  if (zodiacIdx < 0) throw new Error(`生肖地支无效：${zodiacBranch}`);
  const zodiac = ZODIACS[zodiacIdx];
  const conflicts = getTaiSuiConflicts(zodiacBranch, yearBranch);
  const relation = relationText(getStemWuxing(yearGanZhi[0]), getBranchWuxing(zodiacBranch));
  let noble: string | null = null;
  if (isLiuhe(zodiacBranch, yearBranch)) noble = '六合贵人';
  else {
    const group = isCompleteSanhe([zodiacBranch, yearBranch]);
    if (group) noble = `三合贵人（${group}）`;
  }
  const level = judgeLevel(conflicts, relation);
  const prompt = [
    `【生肖流年运程】`,
    `${zodiac}（${zodiacBranch}）遇${yearGanZhi}年（${TAI_SUI_STARS[yearGanZhi] ?? ''}太岁）。`,
    `干支关系：${relation}。`,
    noble ? `贵人：${noble}。` : '贵人：无明显三合六合贵人。',
    conflicts.length ? `犯太岁：${conflicts.map((c) => c.type).join('、')}。` : '本年不犯太岁。',
    `综合定级：${level}。`,
    '',
    '请结合生肖五行与流年干支，给出事业、财运、感情、健康的趋势提示与化解建议。',
  ].join('\n');

  return {
    zodiacBranch,
    zodiac,
    yearGanZhi,
    yearBranch,
    relation,
    noble,
    conflicts,
    level,
    prompt,
  };
}

export const zodiac = {
  TAI_SUI_STARS,
  getTaiSuiConflicts,
  getYearTaiSui,
  getZodiacYearFortune,
};
