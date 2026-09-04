/**
 * @file 八字与紫微斗数跨体系合参互证算法
 * @传统依据 《滴天髓》《紫微斗数全书》《星平会海》：
 * 1. 羊刃与擎羊火星等煞曜同参（刚烈权柄与刑伤防范）；
 * 2. 天乙贵人与左辅右弼、天魁天钺吉曜同参（外力提携与顺遂福力）；
 * 3. 财官印绶与三方四正化禄化权同参（事业成就与资源承载）。
 */
import type { BaziChartResult } from '../bazi/baziTypes';
import type { ZiweiRuntime } from '../ziwei/runtime';

export interface ShaYaoCorroborationResult {
  hasBaziYangRen: boolean;
  baziDayMasterStrength: string;
  ziweiShaStars: string[];
  isHarmonized: boolean; // 是否成权柄相济
  judgment: string;
}

export interface GuiRenCorroborationResult {
  hasBaziTianYi: boolean;
  ziweiGuiStars: string[];
  isDoubleBlessed: boolean;
  judgment: string;
}

export interface BaziZiweiCorroborationResult {
  shaYao: ShaYaoCorroborationResult;
  guiRen: GuiRenCorroborationResult;
  corroborationPoints: string[];
  summary: string;
}

const YANG_REN_MAP: Record<string, string> = {
  甲: '卯',
  乙: '辰',
  丙: '午',
  丁: '未',
  戊: '午',
  己: '未',
  庚: '酉',
  辛: '戌',
  壬: '子',
  癸: '丑',
};

const TIAN_YI_MAP: Record<string, string[]> = {
  甲: ['丑', '未'],
  戊: ['丑', '未'],
  庚: ['丑', '未'],
  乙: ['子', '申'],
  己: ['子', '申'],
  丙: ['亥', '酉'],
  丁: ['亥', '酉'],
  壬: ['巳', '卯'],
  癸: ['巳', '卯'],
  辛: ['午', '寅'],
};

/**
 * 评估煞曜同参
 */
export function evaluateShaYaoCorroboration(
  bazi: BaziChartResult,
  ziwei: ZiweiRuntime,
): ShaYaoCorroborationResult {
  const dayGan = bazi.dayMaster.gan;
  const yangRenBranch = YANG_REN_MAP[dayGan];
  const branches = [
    bazi.pillars.year.zhi,
    bazi.pillars.month.zhi,
    bazi.pillars.day.zhi,
    bazi.pillars.hour.zhi,
  ];
  const hasBaziYangRen = branches.includes(yangRenBranch);

  const origin = ziwei.payloadByScope.origin;
  const ziweiShaStars: string[] = [];
  const SHA_STAR_SET = new Set(['擎羊', '陀罗', '火星', '铃星']);

  if (origin) {
    const keyPalaces = origin.palaces.filter((p) =>
      ['命宫', '身宫', '官禄宫', '迁移宫'].includes(p.name),
    );
    for (const palace of keyPalaces) {
      for (const star of [...palace.major_stars, ...palace.minor_stars]) {
        if (SHA_STAR_SET.has(star.name) && !ziweiShaStars.includes(star.name)) {
          ziweiShaStars.push(`${star.name}(${palace.name})`);
        }
      }
    }
  }

  const isWang = bazi.analysis.dayMasterStrength.status.includes('旺');
  const isHarmonized = hasBaziYangRen && isWang && ziweiShaStars.length > 0;

  let judgment: string;
  if (hasBaziYangRen && ziweiShaStars.length > 0) {
    if (isHarmonized) {
      judgment = '八字见羊刃且日主旺健，紫微关键宫位逢煞星入照，煞为我用，威权独揽，多具决断破格之力';
    } else {
      judgment = '八字羊刃与紫微煞曜同现，刚气太重，行事宜沉潜蓄势，化刚戾为坚韧';
    }
  } else if (hasBaziYangRen) {
    judgment = '八字见羊刃主张力与行动力，紫微煞曜未聚命身，性情刚中有制';
  } else if (ziweiShaStars.length > 0) {
    judgment = `紫微命身见${ziweiShaStars.join('、')}，八字无羊刃冲激，多见暗劲求变`;
  } else {
    judgment = '双盘煞曜不显，气机平和清润，行事稳健中和';
  }

  return {
    hasBaziYangRen,
    baziDayMasterStrength: bazi.analysis.dayMasterStrength.status,
    ziweiShaStars,
    isHarmonized,
    judgment,
  };
}

/**
 * 评估贵人吉曜同参
 */
export function evaluateGuiRenCorroboration(
  bazi: BaziChartResult,
  ziwei: ZiweiRuntime,
): GuiRenCorroborationResult {
  const dayGan = bazi.dayMaster.gan;
  const tianYiBranches = TIAN_YI_MAP[dayGan] || [];
  const branches = [
    bazi.pillars.year.zhi,
    bazi.pillars.month.zhi,
    bazi.pillars.day.zhi,
    bazi.pillars.hour.zhi,
  ];
  const hasBaziTianYi = branches.some((b) => tianYiBranches.includes(b));

  const origin = ziwei.payloadByScope.origin;
  const ziweiGuiStars: string[] = [];
  const GUI_STAR_SET = new Set(['左辅', '右弼', '天魁', '天钺']);

  if (origin) {
    const keyPalaces = origin.palaces.filter((p) =>
      ['命宫', '身宫', '官禄宫', '财帛宫', '迁移宫'].includes(p.name),
    );
    for (const palace of keyPalaces) {
      for (const star of [...palace.major_stars, ...palace.minor_stars]) {
        if (GUI_STAR_SET.has(star.name) && !ziweiGuiStars.includes(star.name)) {
          ziweiGuiStars.push(`${star.name}(${palace.name})`);
        }
      }
    }
  }

  const isDoubleBlessed = hasBaziTianYi && ziweiGuiStars.length > 0;
  let judgment: string;

  if (isDoubleBlessed) {
    judgment = `双盘天乙与魁钺辅弼交相会聚（紫微逢${ziweiGuiStars.slice(0, 3).join('、')}），得长辈提携与外援襄助，生平逢凶化吉`;
  } else if (hasBaziTianYi) {
    judgment = '八字坐实天乙贵人，天资敏悟，遇险自见转机';
  } else if (ziweiGuiStars.length > 0) {
    judgment = `紫微三方得${ziweiGuiStars.slice(0, 3).join('、')}拱照，群策群力，长于借助团队助力`;
  } else {
    judgment = '双盘贵曜未呈叠合之势，多凭自身实干立业，基石坚固';
  }

  return {
    hasBaziTianYi,
    ziweiGuiStars,
    isDoubleBlessed,
    judgment,
  };
}

/**
 * 跨体系合参综合互证
 */
export function evaluateBaziZiweiCorroboration(
  bazi: BaziChartResult,
  ziwei: ZiweiRuntime,
): BaziZiweiCorroborationResult {
  const shaYao = evaluateShaYaoCorroboration(bazi, ziwei);
  const guiRen = evaluateGuiRenCorroboration(bazi, ziwei);

  const corroborationPoints: string[] = [shaYao.judgment, guiRen.judgment];
  const summary = `八字紫微互证：${shaYao.judgment}；${guiRen.judgment}`;

  return {
    shaYao,
    guiRen,
    corroborationPoints,
    summary,
  };
}
