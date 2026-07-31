/**
 * @file 奇门已校勘组合规则识别
 * @description 只识别已有固定文献条件可闭合的奇门组合规则。
 *
 * 这里只输出结构化计算结果，不生成应用层报告、评分报告或具体场景话术。
 */

import type { QimenJiuGongGe } from '../../../../types/divination';
import type { ClassicPattern } from './classic-patterns';
import {
  branchElements,
  diPanPalaces,
  doorElements,
  difficultGods,
  branches,
  isControlling,
  isGenerating,
  starElements,
  supportiveGods,
} from './_constants';
import { getXunHead, isValidGanZhi, LIUCHONG_MAP } from '../../../../ganzhi';
import { getTianPanStars, getTianPanStems, hasTianPanStar, hasTianPanStem } from './palace-utils';

export interface QimenPatternCombo {
  key: string;
  name: string;
  tone: 'super-good' | 'super-bad' | 'mixed';
  summary: string;
  palace?: number;
  sources: string[];
}

export interface PatternComboContext {
  classicPatterns?: ClassicPattern[];
  activeGanZhi?: string;
  zhiFu?: string;
  zhiShi?: string;
  dayGanZhi?: string;
  yearBranch?: string;
  dayStem?: string;
  dayBranch?: string;
  monthBranch?: string;
  monthGeneral?: string;
  solarTerm?: string;
  epoch?: string;
  hourGanZhi?: string;
  hourStem?: string;
  hourBranch?: string;
  jiuGongGe: QimenJiuGongGe[];
}

type MonthGeneralTargetLabels = {
  monthGeneral: string;
  labels: string[];
  targetBranches: string[];
};

type StarPalaceHostGuestEntry = {
  gong: number;
  palaceName: string;
  palaceElement: string;
  star: string;
  starElement: string;
  relation: '星克宫' | '宫克星' | '宫生星' | '星生宫' | '星宫比和';
  advice: '利客' | '利主' | '势均';
};

type DoorPalaceHostGuestEntry = {
  gong: number;
  palaceName: string;
  palaceElement: string;
  door: string;
  doorElement: string;
  relation: '门克宫' | '宫克门' | '宫生门' | '门生宫' | '门宫比和';
  advice: '利客' | '利主' | '势均';
};

type HostGuestRelation =
  StarPalaceHostGuestEntry['relation'] | DoorPalaceHostGuestEntry['relation'];

type DoorSeasonQiState = '旺' | '相' | '休' | '囚' | '废';

type StemPressureRule = {
  stemElement: string;
  palaceElement: string;
  palaces: number[];
  issue: string;
};

const stemPressureRules: Record<string, StemPressureRule> = {
  甲: { stemElement: '木', palaceElement: '金', palaces: [6, 7], issue: '木被金克' },
  乙: { stemElement: '木', palaceElement: '金', palaces: [6, 7], issue: '木被金克' },
  丙: { stemElement: '火', palaceElement: '水', palaces: [1], issue: '火被水克' },
  丁: { stemElement: '火', palaceElement: '水', palaces: [1], issue: '火被水克' },
  戊: { stemElement: '土', palaceElement: '木', palaces: [3, 4], issue: '土被木克' },
  己: { stemElement: '土', palaceElement: '木', palaces: [3, 4], issue: '土被木克' },
  庚: { stemElement: '金', palaceElement: '火', palaces: [9], issue: '金被火克' },
  辛: { stemElement: '金', palaceElement: '火', palaces: [9], issue: '金被火克' },
  壬: { stemElement: '水', palaceElement: '土', palaces: [2, 8], issue: '水被土克' },
  癸: { stemElement: '水', palaceElement: '土', palaces: [2, 8], issue: '水被土克' },
};

function getPalaceName(jiuGongGe: QimenJiuGongGe[], palace: number): string {
  return jiuGongGe.find((item) => item.gong === palace)?.name || `${palace}宫`;
}

function getPalace(jiuGongGe: QimenJiuGongGe[], palace?: number): QimenJiuGongGe | undefined {
  if (!palace) return undefined;
  return jiuGongGe.find((item) => item.gong === palace);
}

function findStarPalace(jiuGongGe: QimenJiuGongGe[], star?: string): QimenJiuGongGe | undefined {
  if (!star) return undefined;
  return jiuGongGe.find((item) => hasTianPanStar(item, star));
}

function findDoorPalace(jiuGongGe: QimenJiuGongGe[], door?: string): QimenJiuGongGe | undefined {
  if (!door) return undefined;
  return jiuGongGe.find((item) => item.renPan.door === door);
}

function findGodPalace(jiuGongGe: QimenJiuGongGe[], god: string): QimenJiuGongGe | undefined {
  return jiuGongGe.find((item) => item.shenPan.god === god);
}

function findTianStemPalace(
  jiuGongGe: QimenJiuGongGe[],
  stem?: string,
): QimenJiuGongGe | undefined {
  if (!stem) return undefined;
  return jiuGongGe.find((item) => hasTianPanStem(item, stem));
}

function getDoorSeasonQiState(
  doorElement: string,
  monthElement: string,
): DoorSeasonQiState | undefined {
  if (!doorElement || !monthElement) return undefined;
  if (doorElement === monthElement) return '旺';
  if (isGenerating(doorElement, monthElement)) return '相';
  if (isControlling(doorElement, monthElement)) return '休';
  if (isControlling(monthElement, doorElement)) return '囚';
  if (isGenerating(monthElement, doorElement)) return '废';
  return undefined;
}

const palaceOppositeMap: Record<number, number> = {
  1: 9,
  2: 8,
  3: 7,
  4: 6,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
};

const yangHourStems = new Set(['甲', '乙', '丙', '丁', '戊']);
const yinHourStems = new Set(['己', '庚', '辛', '壬', '癸']);
const mengBranches = new Set(['寅', '巳', '申', '亥']);
const zhongBranches = new Set(['子', '卯', '午', '酉']);
const jiBranches = new Set(['丑', '辰', '未', '戌']);
const eightGods = new Set([...supportiveGods, ...difficultGods]);
const yangStars = new Set(['天蓬', '天任', '天冲', '天辅', '天禽']);
const yinStars = new Set(['天英', '天芮', '天柱', '天心']);
const zhiFuOpenPalaces = new Set([1, 8, 3, 4]);
const zhiFuClosedPalaces = new Set([9, 2, 7, 6]);

const xingDeBySolarTerm: Record<
  string,
  { baseTerm: string; deBranch: string; xingBranch: string }
> = {
  冬至: { baseTerm: '冬至', deBranch: '卯', xingBranch: '酉' },
  小寒: { baseTerm: '冬至', deBranch: '卯', xingBranch: '酉' },
  大寒: { baseTerm: '冬至', deBranch: '卯', xingBranch: '酉' },
  立春: { baseTerm: '立春', deBranch: '辰', xingBranch: '戌' },
  雨水: { baseTerm: '立春', deBranch: '辰', xingBranch: '戌' },
  惊蛰: { baseTerm: '立春', deBranch: '辰', xingBranch: '戌' },
  春分: { baseTerm: '春分', deBranch: '午', xingBranch: '子' },
  清明: { baseTerm: '春分', deBranch: '午', xingBranch: '子' },
  谷雨: { baseTerm: '春分', deBranch: '午', xingBranch: '子' },
  立夏: { baseTerm: '立夏', deBranch: '未', xingBranch: '丑' },
  小满: { baseTerm: '立夏', deBranch: '未', xingBranch: '丑' },
  芒种: { baseTerm: '立夏', deBranch: '未', xingBranch: '丑' },
  夏至: { baseTerm: '夏至', deBranch: '酉', xingBranch: '卯' },
  小暑: { baseTerm: '夏至', deBranch: '酉', xingBranch: '卯' },
  大暑: { baseTerm: '夏至', deBranch: '酉', xingBranch: '卯' },
  立秋: { baseTerm: '立秋', deBranch: '戌', xingBranch: '辰' },
  处暑: { baseTerm: '立秋', deBranch: '戌', xingBranch: '辰' },
  白露: { baseTerm: '立秋', deBranch: '戌', xingBranch: '辰' },
  秋分: { baseTerm: '秋分', deBranch: '子', xingBranch: '午' },
  寒露: { baseTerm: '秋分', deBranch: '子', xingBranch: '午' },
  霜降: { baseTerm: '秋分', deBranch: '子', xingBranch: '午' },
  立冬: { baseTerm: '立冬', deBranch: '丑', xingBranch: '未' },
  小雪: { baseTerm: '立冬', deBranch: '丑', xingBranch: '未' },
  大雪: { baseTerm: '立冬', deBranch: '丑', xingBranch: '未' },
};

const sanJiaByXun: Record<string, '孟甲' | '仲甲' | '季甲'> = {
  甲寅: '孟甲',
  甲申: '孟甲',
  甲子: '仲甲',
  甲午: '仲甲',
  甲辰: '季甲',
  甲戌: '季甲',
};

const youDuBranchByDayStem: Record<string, string> = {
  甲: '丑',
  己: '丑',
  乙: '子',
  庚: '子',
  丙: '寅',
  辛: '寅',
  丁: '巳',
  壬: '巳',
  戊: '申',
  癸: '申',
};

const attackAvoidanceByDayStem: Record<string, { direction: string; palaces: number[] }> = {
  甲: { direction: '正西', palaces: [7] },
  乙: { direction: '正西', palaces: [7] },
  丙: { direction: '正北', palaces: [1] },
  丁: { direction: '正北', palaces: [1] },
  戊: { direction: '正东', palaces: [3] },
  己: { direction: '正东', palaces: [3] },
  庚: { direction: '正南', palaces: [9] },
  辛: { direction: '正南', palaces: [9] },
  壬: { direction: '四维', palaces: [8, 4, 2, 6] },
  癸: { direction: '四维', palaces: [8, 4, 2, 6] },
};

const xiongBranchByMonthBranch: Record<string, string> = {
  寅: '寅',
  卯: '寅',
  辰: '寅',
  巳: '巳',
  午: '巳',
  未: '巳',
  申: '申',
  酉: '申',
  戌: '申',
  亥: '亥',
  子: '亥',
  丑: '亥',
};

const wuJiangDirectionByDayBranch: Record<string, { direction: string; palace: number }> = {
  寅: { direction: '东方', palace: 3 },
  午: { direction: '东方', palace: 3 },
  戌: { direction: '东方', palace: 3 },
  亥: { direction: '南方', palace: 9 },
  卯: { direction: '南方', palace: 9 },
  未: { direction: '南方', palace: 9 },
  申: { direction: '西方', palace: 7 },
  子: { direction: '西方', palace: 7 },
  辰: { direction: '西方', palace: 7 },
  巳: { direction: '北方', palace: 1 },
  酉: { direction: '北方', palace: 1 },
  丑: { direction: '北方', palace: 1 },
};

const daJiangJunBranchByYearBranch: Record<string, string> = {
  寅: '巳',
  卯: '巳',
  辰: '巳',
  巳: '卯',
  午: '卯',
  未: '卯',
  申: '午',
  酉: '午',
  戌: '午',
  亥: '酉',
  子: '酉',
  丑: '酉',
};

const shiZhongJiangXingHourByDayBranch: Record<string, string> = {
  申: '卯',
  子: '卯',
  辰: '卯',
  巳: '子',
  酉: '子',
  丑: '子',
  亥: '午',
  卯: '午',
  未: '午',
  寅: '酉',
  午: '酉',
  戌: '酉',
};

const tianMuDiErByXun: Record<
  string,
  { tianMu: { ganZhi: string; branch: string }; diEr: { ganZhi: string; branch: string } }
> = {
  甲子: { tianMu: { ganZhi: '庚午', branch: '午' }, diEr: { ganZhi: '戊辰', branch: '辰' } },
  甲戌: { tianMu: { ganZhi: '庚辰', branch: '辰' }, diEr: { ganZhi: '戊寅', branch: '寅' } },
  甲申: { tianMu: { ganZhi: '庚寅', branch: '寅' }, diEr: { ganZhi: '戊子', branch: '子' } },
  甲午: { tianMu: { ganZhi: '庚子', branch: '子' }, diEr: { ganZhi: '戊戌', branch: '戌' } },
  甲辰: { tianMu: { ganZhi: '庚戌', branch: '戌' }, diEr: { ganZhi: '戊申', branch: '申' } },
  甲寅: { tianMu: { ganZhi: '庚申', branch: '申' }, diEr: { ganZhi: '戊午', branch: '午' } },
};

const dunJiaStemByXun: Record<string, string> = {
  甲子: '戊',
  甲戌: '己',
  甲申: '庚',
  甲午: '辛',
  甲辰: '壬',
  甲寅: '癸',
};

const guXuByXun: Record<string, { gu: string[]; xu: string[] }> = {
  甲子: { gu: ['戌', '亥'], xu: ['辰', '巳'] },
  甲戌: { gu: ['申', '酉'], xu: ['寅', '卯'] },
  甲申: { gu: ['午', '未'], xu: ['子', '丑'] },
  甲午: { gu: ['辰', '巳'], xu: ['戌', '亥'] },
  甲辰: { gu: ['寅', '卯'], xu: ['申', '酉'] },
  甲寅: { gu: ['子', '丑'], xu: ['午', '未'] },
};

const tianSanMenTargets = [
  { name: '太冲', branch: '卯' },
  { name: '小吉', branch: '未' },
  { name: '从魁', branch: '酉' },
];

const tianMaTargets = [{ name: '太冲天马', branch: '卯' }];

const tianGangTargets = [{ name: '斗星天罡', branch: '辰' }];

const diSiHuOffsets = [
  { name: '除', offset: 1 },
  { name: '定', offset: 4 },
  { name: '危', offset: 7 },
  { name: '开', offset: 10 },
];

const xunZhongDiBingDay: Record<string, { xun: string; branch: string }> = {
  丙寅: { xun: '甲子旬', branch: '寅' },
  丙子: { xun: '甲戌旬', branch: '子' },
  丙戌: { xun: '甲申旬', branch: '戌' },
  丙申: { xun: '甲午旬', branch: '申' },
  丙午: { xun: '甲辰旬', branch: '午' },
  丙辰: { xun: '甲寅旬', branch: '辰' },
};

function getPalaceByBranch(
  jiuGongGe: QimenJiuGongGe[],
  branch: string,
): QimenJiuGongGe | undefined {
  return getPalace(jiuGongGe, diPanPalaces[branch]);
}

function getBranchPalaceLabels(
  jiuGongGe: QimenJiuGongGe[],
  branchList: string[],
): string[] | undefined {
  const labels = branchList.map((branch) => {
    const palace = getPalaceByBranch(jiuGongGe, branch);
    return palace ? `${branch}支${palace.name}` : undefined;
  });
  if (labels.some((label) => !label)) return undefined;
  return labels as string[];
}

function getNamedBranchPalaceLabels(
  jiuGongGe: QimenJiuGongGe[],
  branchList: Array<{ name: string; branch: string }>,
): string[] | undefined {
  const labels = branchList.map((item) => {
    const palace = getPalaceByBranch(jiuGongGe, item.branch);
    return palace ? `${item.name}在${item.branch}支${palace.name}` : undefined;
  });
  if (labels.some((label) => !label)) return undefined;
  return labels as string[];
}

function getXunShouGanZhi(ganZhi?: string): string | undefined {
  return ganZhi && isValidGanZhi(ganZhi) ? getXunHead(ganZhi) : undefined;
}

function getStarPolarity(star?: string): '阳星' | '阴星' | undefined {
  if (!star) return undefined;
  if (yangStars.has(star)) return '阳星';
  if (yinStars.has(star)) return '阴星';
  return undefined;
}

function getXingDeOpenCloseState(
  hourBranch: string,
  xingDe: { deBranch: string; xingBranch: string },
  polarity: '阳星' | '阴星',
): { gateState: string; openClose: string; advice: string } {
  const isYangStar = polarity === '阳星';
  if (hourBranch === xingDe.deBranch) {
    return {
      gateState: '德在门',
      openClose: isYangStar ? '尽开' : '半开',
      advice: '宜动宜战',
    };
  }
  if (hourBranch === xingDe.xingBranch) {
    return {
      gateState: '刑在门',
      openClose: isYangStar ? '半阖' : '尽阖',
      advice: '宜静宜守',
    };
  }
  return {
    gateState: '不当刑德',
    openClose: isYangStar ? '开' : '阖',
    advice: isYangStar ? '偏客动、宜主动取势' : '偏主守、宜静守审势',
  };
}

function getMonthGeneralTargetLabels(
  jiuGongGe: QimenJiuGongGe[],
  targets: Array<{ name: string; branch: string }>,
  monthGeneral?: string,
  hourBranch?: string,
): MonthGeneralTargetLabels | undefined {
  if (!monthGeneral || !hourBranch) return undefined;
  const monthGeneralIndex = branches.indexOf(monthGeneral);
  const hourIndex = branches.indexOf(hourBranch);
  if (!monthGeneral || monthGeneralIndex === -1 || hourIndex === -1) return undefined;

  const targetBranches = targets.map((target) => {
    const targetIndex = branches.indexOf(target.branch);
    return {
      name: target.name,
      branch: branches[(hourIndex + targetIndex - monthGeneralIndex + 12) % 12],
    };
  });
  const labels = getNamedBranchPalaceLabels(jiuGongGe, targetBranches);
  return labels
    ? { monthGeneral, labels, targetBranches: targetBranches.map((item) => item.branch) }
    : undefined;
}

function getTianSanMenLabels(
  jiuGongGe: QimenJiuGongGe[],
  monthGeneral?: string,
  hourBranch?: string,
): MonthGeneralTargetLabels | undefined {
  return getMonthGeneralTargetLabels(jiuGongGe, tianSanMenTargets, monthGeneral, hourBranch);
}

function getTianMaLabels(
  jiuGongGe: QimenJiuGongGe[],
  monthGeneral?: string,
  hourBranch?: string,
): MonthGeneralTargetLabels | undefined {
  return getMonthGeneralTargetLabels(jiuGongGe, tianMaTargets, monthGeneral, hourBranch);
}

function getTianGangLabels(
  jiuGongGe: QimenJiuGongGe[],
  monthGeneral?: string,
  hourBranch?: string,
): MonthGeneralTargetLabels | undefined {
  return getMonthGeneralTargetLabels(jiuGongGe, tianGangTargets, monthGeneral, hourBranch);
}

function getMengZhongJiRoute(
  branch: string,
): { position: '孟' | '仲' | '季'; route: string } | undefined {
  if (mengBranches.has(branch)) return { position: '孟', route: '左路通' };
  if (zhongBranches.has(branch)) return { position: '仲', route: '中道通' };
  if (jiBranches.has(branch)) return { position: '季', route: '右路通' };
  return undefined;
}

function getDiSiHuLabels(jiuGongGe: QimenJiuGongGe[], hourBranch?: string): string[] | undefined {
  if (!hourBranch) return undefined;
  const hourIndex = branches.indexOf(hourBranch);
  if (hourIndex === -1) return undefined;
  return getNamedBranchPalaceLabels(
    jiuGongGe,
    diSiHuOffsets.map((item) => ({
      name: item.name,
      branch: branches[(hourIndex + item.offset) % 12],
    })),
  );
}

function pushNamedCombos(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const patterns = ctx.classicPatterns || [];

  const baihuPatterns = patterns.filter((pattern) => pattern.name === '白虎猖狂' && pattern.palace);
  for (const pattern of baihuPatterns) {
    const palace = getPalace(ctx.jiuGongGe, pattern.palace);
    const door = palace?.renPan.door;
    if (!palace || !door) continue;

    if (door === '开门' || door === '惊门') {
      out.push({
        key: `combo:baihuKaiJing:${palace.gong}`,
        name: '白虎会开惊',
        tone: 'mixed',
        summary: `${palace.name}白虎猖狂同宫${door}，合“会开惊动神位”，辛金得门气助，客势更锐；偏兵事强攻参考，不替代通用吉凶评分。`,
        palace: palace.gong,
        sources: ['白虎猖狂', `${palace.name}${door}`],
      });
      continue;
    }

    if (door === '休门') {
      out.push({
        key: `combo:baihuXiuMen:${palace.gong}`,
        name: '白虎逢休门',
        tone: 'mixed',
        summary: `${palace.name}白虎猖狂同宫休门，乙奇得水助而辛金泄气，主客交锋胜败趋平；偏兵事缓和参考，不替代通用吉凶评分。`,
        palace: palace.gong,
        sources: ['白虎猖狂', `${palace.name}休门`],
      });
    }
  }

  const qingLongReturningPatterns = patterns.filter(
    (pattern) => pattern.name === '青龙返首' && pattern.palace,
  );
  for (const pattern of qingLongReturningPatterns) {
    const palace = getPalace(ctx.jiuGongGe, pattern.palace);
    if (!palace) continue;

    out.push({
      key: `combo:qinglongReturningHost:${palace.gong}`,
      name: '青龙返首利主',
      tone: 'mixed',
      summary: `${palace.name}青龙返首，合“甲加丙利为主”，宜后应、伏藏、暗渡；偏兵事主客参考，不替代通用吉格评分。`,
      palace: palace.gong,
      sources: ['青龙返首', `${palace.name}`],
    });
  }

  const flyingBirdPatterns = patterns.filter(
    (pattern) => pattern.name === '飞鸟跌穴' && pattern.palace,
  );
  for (const pattern of flyingBirdPatterns) {
    const palace = getPalace(ctx.jiuGongGe, pattern.palace);
    if (!palace) continue;

    out.push({
      key: `combo:flyingBirdGuest:${palace.gong}`,
      name: '飞鸟跌穴利客',
      tone: 'mixed',
      summary: `${palace.name}飞鸟跌穴，合“丙加甲利为客”，宜主动前征、扬势而进；偏兵事主客参考，不替代通用吉格评分。`,
      palace: palace.gong,
      sources: ['飞鸟跌穴', `${palace.name}`],
    });

    if (palace.renPan.door === '生门') {
      out.push({
        key: `combo:flyingBirdShengMen:${palace.gong}`,
        name: '飞鸟会生门',
        tone: 'mixed',
        summary: `${palace.name}飞鸟跌穴同宫生门，合“会合生门相助，则坐生击死，一战百胜”；偏兵事助胜参考，不重复加算通用吉格评分。`,
        palace: palace.gong,
        sources: ['飞鸟跌穴', `${palace.name}生门`],
      });
    }
  }

  const zhuqueToujiangPatterns = patterns.filter(
    (pattern) => pattern.name === '朱雀投江' && pattern.palace,
  );
  for (const pattern of zhuqueToujiangPatterns) {
    const palace = getPalace(ctx.jiuGongGe, pattern.palace);
    if (!palace) continue;

    out.push({
      key: `combo:zhuqueToujiangHost:${palace.gong}`,
      name: '朱雀投江利主',
      tone: 'mixed',
      summary: `${palace.name}朱雀投江，合“遇交战，主胜客败”；若先发攻人而转为客，则防强行取败、将士刑伤。偏兵事主客参考，不替代通用凶格评分。`,
      palace: palace.gong,
      sources: ['朱雀投江', `${palace.name}`],
    });
  }

  const tengsheYaoyaoPatterns = patterns.filter(
    (pattern) => pattern.name === '螣蛇跃蹻' && pattern.palace,
  );
  const wuPalace = findTianStemPalace(ctx.jiuGongGe, '戊');
  const jiPalace = findTianStemPalace(ctx.jiuGongGe, '己');
  for (const pattern of tengsheYaoyaoPatterns) {
    const palace = getPalace(ctx.jiuGongGe, pattern.palace);
    if (!palace) continue;

    out.push({
      key: `combo:tengsheYaoyaoHold:${palace.gong}`,
      name: '螣蛇跃蹻宜守',
      tone: 'mixed',
      summary: `${palace.name}螣蛇跃蹻，合“主军宜固守”；遇敌勿轻战，亦合“蛇矫为客者不害”的活诀，偏兵事主客与守避参考，不替代通用凶格评分。`,
      palace: palace.gong,
      sources: ['螣蛇跃蹻', `${palace.name}`],
    });

    if (wuPalace && jiPalace) {
      out.push({
        key: `combo:tengsheMoveWuJi:${palace.gong}:${wuPalace.gong}:${jiPalace.gong}`,
        name: '螣蛇迁戊己',
        tone: 'mixed',
        summary: `${palace.name}螣蛇跃蹻，古法急迁甲子戊、甲戌己两土宫；本盘取天盘戊所在${wuPalace.name}、天盘己所在${jiPalace.name}，以土制癸水，偏避兵迁营参考，不作通用吉凶评分。`,
        palace: palace.gong,
        sources: ['螣蛇跃蹻', `甲子戊：天盘戊${wuPalace.name}`, `甲戌己：天盘己${jiPalace.name}`],
      });
    }
  }
}

function pushXingDeKaiHeCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const xingDe = ctx.solarTerm ? xingDeBySolarTerm[ctx.solarTerm] : undefined;
  const polarity = getStarPolarity(ctx.zhiFu);
  if (!ctx.solarTerm || !ctx.hourBranch || !ctx.zhiFu || !xingDe || !polarity) return;

  const dePalace = getPalaceByBranch(ctx.jiuGongGe, xingDe.deBranch);
  const xingPalace = getPalaceByBranch(ctx.jiuGongGe, xingDe.xingBranch);
  if (!dePalace || !xingPalace) return;

  const hourGanZhi =
    ctx.hourGanZhi || (ctx.hourStem && ctx.hourBranch ? `${ctx.hourStem}${ctx.hourBranch}` : '');
  const xunShouGanZhi = getXunShouGanZhi(hourGanZhi);
  const sanJia = xunShouGanZhi ? sanJiaByXun[xunShouGanZhi] : undefined;
  const hourLabel = hourGanZhi ? `${hourGanZhi}时` : `${ctx.hourBranch}时`;
  const state = getXingDeOpenCloseState(ctx.hourBranch, xingDe, polarity);
  const sanJiaText =
    hourGanZhi && xunShouGanZhi && sanJia ? `${hourGanZhi}属${xunShouGanZhi}旬（${sanJia}），` : '';

  out.push({
    key: `combo:xingDeKaiHe:${ctx.solarTerm}:${ctx.hourBranch}:${ctx.zhiFu}`,
    name: '刑德开阖',
    tone: 'mixed',
    summary: `${ctx.solarTerm}属${xingDe.baseTerm}三气，德在${xingDe.deBranch}、刑在${xingDe.xingBranch}；${sanJiaText}${hourLabel}支${ctx.hourBranch}为${state.gateState}，值符${ctx.zhiFu}为${polarity}，判为${state.openClose}，${state.advice}。坐阳德取${xingDe.deBranch}支${dePalace.name}，击阴刑取${xingDe.xingBranch}支${xingPalace.name}；偏三甲兵事、主客与动静参考，不作通用吉凶评分。`,
    sources: [
      `${ctx.solarTerm}属${xingDe.baseTerm}三气：德在${xingDe.deBranch}、刑在${xingDe.xingBranch}`,
      `${hourLabel}：${state.gateState}，${state.openClose}`,
      `值符${ctx.zhiFu}为${polarity}`,
      `坐阳德：${xingDe.deBranch}支${dePalace.name}`,
      `击阴刑：${xingDe.xingBranch}支${xingPalace.name}`,
      ...(hourGanZhi && xunShouGanZhi && sanJia
        ? [`${hourGanZhi}属${xunShouGanZhi}旬：${sanJia}`]
        : []),
    ],
  });
}

function getStarPalaceHostGuestEntries(jiuGongGe: QimenJiuGongGe[]): StarPalaceHostGuestEntry[] {
  const entries: StarPalaceHostGuestEntry[] = [];

  for (const palace of jiuGongGe) {
    for (const star of getTianPanStars(palace)) {
      const starElement = starElements[star];
      const palaceElement = palace.element;
      if (!starElement || !palaceElement) continue;

      if (starElement === palaceElement) {
        entries.push({
          gong: palace.gong,
          palaceName: palace.name,
          palaceElement,
          star,
          starElement,
          relation: '星宫比和',
          advice: '势均',
        });
        continue;
      }

      if (isGenerating(palaceElement, starElement)) {
        entries.push({
          gong: palace.gong,
          palaceName: palace.name,
          palaceElement,
          star,
          starElement,
          relation: '宫生星',
          advice: '利客',
        });
        continue;
      }

      if (isGenerating(starElement, palaceElement)) {
        entries.push({
          gong: palace.gong,
          palaceName: palace.name,
          palaceElement,
          star,
          starElement,
          relation: '星生宫',
          advice: '利主',
        });
        continue;
      }

      if (isControlling(starElement, palaceElement)) {
        entries.push({
          gong: palace.gong,
          palaceName: palace.name,
          palaceElement,
          star,
          starElement,
          relation: '星克宫',
          advice: '利客',
        });
        continue;
      }

      if (isControlling(palaceElement, starElement)) {
        entries.push({
          gong: palace.gong,
          palaceName: palace.name,
          palaceElement,
          star,
          starElement,
          relation: '宫克星',
          advice: '利主',
        });
      }
    }
  }

  return entries;
}

function pushStarPalaceHostGuestCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const entries = getStarPalaceHostGuestEntries(ctx.jiuGongGe);
  if (!entries.length) return;

  const entryTexts = entries.map(
    (entry) =>
      `${entry.star}${entry.starElement}落${entry.palaceName}（${entry.palaceElement}），${entry.relation}，${entry.advice}`,
  );

  out.push({
    key: `combo:starPalaceHostGuest:${entries
      .map((entry) => `${entry.gong}${entry.relation}`)
      .join(':')}`,
    name: '星宫主客',
    tone: 'mixed',
    summary: `九星与落宫形成主客取向：${entryTexts.join('；')}。宫为主，星为客；此为兵事主客强弱参考，不作通用吉凶评分。`,
    palace: entries.length === 1 ? entries[0].gong : undefined,
    sources: entryTexts,
  });
}

function getDoorPalaceHostGuestEntries(jiuGongGe: QimenJiuGongGe[]): DoorPalaceHostGuestEntry[] {
  const entries: DoorPalaceHostGuestEntry[] = [];

  for (const palace of jiuGongGe) {
    const door = palace.renPan.door;
    const doorElement = doorElements[door];
    const palaceElement = palace.element;
    if (!door || !doorElement || !palaceElement) continue;

    if (doorElement === palaceElement) {
      entries.push({
        gong: palace.gong,
        palaceName: palace.name,
        palaceElement,
        door,
        doorElement,
        relation: '门宫比和',
        advice: '势均',
      });
      continue;
    }

    if (isGenerating(palaceElement, doorElement)) {
      entries.push({
        gong: palace.gong,
        palaceName: palace.name,
        palaceElement,
        door,
        doorElement,
        relation: '宫生门',
        advice: '利客',
      });
      continue;
    }

    if (isGenerating(doorElement, palaceElement)) {
      entries.push({
        gong: palace.gong,
        palaceName: palace.name,
        palaceElement,
        door,
        doorElement,
        relation: '门生宫',
        advice: '利主',
      });
      continue;
    }

    if (isControlling(doorElement, palaceElement)) {
      entries.push({
        gong: palace.gong,
        palaceName: palace.name,
        palaceElement,
        door,
        doorElement,
        relation: '门克宫',
        advice: '利客',
      });
      continue;
    }

    if (isControlling(palaceElement, doorElement)) {
      entries.push({
        gong: palace.gong,
        palaceName: palace.name,
        palaceElement,
        door,
        doorElement,
        relation: '宫克门',
        advice: '利主',
      });
    }
  }

  return entries;
}

function pushDoorPalaceHostGuestCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const entries = getDoorPalaceHostGuestEntries(ctx.jiuGongGe);
  if (!entries.length) return;

  const entryTexts = entries.map(
    (entry) =>
      `${entry.door}${entry.doorElement}落${entry.palaceName}（${entry.palaceElement}），${entry.relation}，${entry.advice}`,
  );

  out.push({
    key: `combo:doorPalaceHostGuest:${entries
      .map((entry) => `${entry.gong}${entry.relation}`)
      .join(':')}`,
    name: '门宫主客',
    tone: 'mixed',
    summary: `八门与落宫形成主客取向：${entryTexts.join('；')}。宫为主，门为客；此为兵事主客强弱参考，不作通用吉凶评分。`,
    palace: entries.length === 1 ? entries[0].gong : undefined,
    sources: entryTexts,
  });
}

function isHostGuestControlRelation(relation: HostGuestRelation): boolean {
  return relation.includes('克');
}

function isHostGuestGeneratingRelation(relation: HostGuestRelation): boolean {
  return relation.includes('生');
}

function pushStarDoorHostGuestInjuryCombo(
  ctx: PatternComboContext,
  out: QimenPatternCombo[],
): void {
  const starEntries = getStarPalaceHostGuestEntries(ctx.jiuGongGe);
  const doorEntriesByGong = new Map(
    getDoorPalaceHostGuestEntries(ctx.jiuGongGe).map((entry) => [entry.gong, entry]),
  );

  const injuryEntries = starEntries.flatMap((starEntry) => {
    const doorEntry = doorEntriesByGong.get(starEntry.gong);
    if (!doorEntry) return [];

    const starIsControl = isHostGuestControlRelation(starEntry.relation);
    const doorIsControl = isHostGuestControlRelation(doorEntry.relation);
    const starIsGenerating = isHostGuestGeneratingRelation(starEntry.relation);
    const doorIsGenerating = isHostGuestGeneratingRelation(doorEntry.relation);
    if (!((starIsControl && doorIsGenerating) || (starIsGenerating && doorIsControl))) {
      return [];
    }

    return [
      {
        gong: starEntry.gong,
        palaceName: starEntry.palaceName,
        starText: `${starEntry.star}${starEntry.starElement}${starEntry.relation}${starEntry.advice}`,
        doorText: `${doorEntry.door}${doorEntry.doorElement}${doorEntry.relation}${doorEntry.advice}`,
      },
    ];
  });

  if (!injuryEntries.length) return;

  const entryTexts = injuryEntries.map(
    (entry) => `${entry.palaceName}：${entry.starText}，${entry.doorText}`,
  );

  out.push({
    key: `combo:starDoorHostGuestInjury:${injuryEntries.map((entry) => entry.gong).join(':')}`,
    name: '星门主客互伤',
    tone: 'mixed',
    summary: `同宫星门与宫形成一克一生：${entryTexts.join('；')}。宫为主，星门为客；合“一克一生，主客互伤”，偏兵事主客冲突参考，不作通用吉凶评分。`,
    palace: injuryEntries.length === 1 ? injuryEntries[0].gong : undefined,
    sources: entryTexts,
  });
}

function pushDoorSeasonQiCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const monthElement = ctx.monthBranch ? branchElements[ctx.monthBranch] : undefined;
  if (!ctx.monthBranch || !monthElement) return;

  const entries = ctx.jiuGongGe
    .map((palace) => {
      const door = palace.renPan.door;
      const doorElement = doorElements[door];
      const state = doorElement ? getDoorSeasonQiState(doorElement, monthElement) : undefined;
      if (!door || !doorElement || !state) return undefined;
      return {
        gong: palace.gong,
        text: `${palace.name}${door}属${doorElement}为${state}`,
      };
    })
    .filter((entry): entry is { gong: number; text: string } => Boolean(entry));

  if (!entries.length) return;

  out.push({
    key: `combo:doorSeasonQi:${ctx.monthBranch}:${entries.map((entry) => entry.gong).join(':')}`,
    name: '八门余气',
    tone: 'mixed',
    summary: `${ctx.monthBranch}月属${monthElement}，八门余气为：${entries
      .map((entry) => entry.text)
      .join(
        '；',
      )}。合“当时者为旺，我生者为相，我克者为休，克我者为囚，生我者为废”；偏用门旺衰和兵事进退参考，不作通用吉凶评分。`,
    sources: [`${ctx.monthBranch}月属${monthElement}`, ...entries.map((entry) => entry.text)],
  });
}

function pushStemPressureCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const entries = ctx.jiuGongGe
    .flatMap((palace) =>
      getTianPanStems(palace).map((stem) => {
        const rule = stemPressureRules[stem];
        if (!rule || !rule.palaces.includes(palace.gong)) return undefined;

        return {
          gong: palace.gong,
          text: `${palace.name}天盘${stem}属${rule.stemElement}临${rule.palaceElement}宫，${rule.issue}`,
        };
      }),
    )
    .filter((entry): entry is { gong: number; text: string } => Boolean(entry));

  if (!entries.length) return;

  out.push({
    key: `combo:stemPressure:${entries.map((entry) => entry.gong).join(':')}`,
    name: '十干迫制',
    tone: 'mixed',
    summary: `奇仪临受克之宫：${entries
      .map((entry) => entry.text)
      .join(
        '；',
      )}。合“甲乙金宫、丙丁坎内、戊己惧杜伤、庚辛离上、壬癸生死方”的十干迫制口径；需再合旺衰强弱判断，只作命宫、奇仪受制证据参考，不作通用吉凶评分。`,
    palace: entries.length === 1 ? entries[0].gong : undefined,
    sources: entries.map((entry) => entry.text),
  });
}

function pushStrategicDirectionCombos(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const tianYiPalace = findStarPalace(ctx.jiuGongGe, ctx.zhiFu);
  const jiuTianPalace = findGodPalace(ctx.jiuGongGe, '九天');
  const shengMenPalace = findDoorPalace(ctx.jiuGongGe, '生门');

  if (tianYiPalace) {
    const openCloseState = zhiFuOpenPalaces.has(tianYiPalace.gong)
      ? {
          name: '开通',
          advice: '逢开利以有为，宜主动推进',
        }
      : zhiFuClosedPalaces.has(tianYiPalace.gong)
        ? {
            name: '闭塞',
            advice: '值闭尤宜静默，宜守势等待',
          }
        : undefined;

    if (openCloseState) {
      out.push({
        key: `combo:zhiFuOpenClose:${tianYiPalace.gong}`,
        name: '值符开通闭塞',
        tone: 'mixed',
        summary: `值符星${ctx.zhiFu}落${tianYiPalace.name}，符临${tianYiPalace.gong}宫为${openCloseState.name}；${openCloseState.advice}。此为《奇门宝鉴御定》开合时机参考，不作通用吉凶评分。`,
        palace: tianYiPalace.gong,
        sources: [
          `值符星${ctx.zhiFu}落${tianYiPalace.name}`,
          `${tianYiPalace.gong}宫：${openCloseState.name}`,
        ],
      });
    }
  }

  if (tianYiPalace && jiuTianPalace && shengMenPalace) {
    out.push({
      key: 'combo:sanShengDi',
      name: '三胜地',
      tone: 'mixed',
      summary: `值符星落${tianYiPalace.name}、九天在${jiuTianPalace.name}、生门在${shengMenPalace.name}，为三胜所取之地，可作为争取主动与择方参考。`,
      sources: [
        `值符星${ctx.zhiFu}落${tianYiPalace.name}`,
        `九天在${jiuTianPalace.name}`,
        `生门在${shengMenPalace.name}`,
      ],
    });
  }

  const tianYiOppositePalace = tianYiPalace
    ? getPalace(ctx.jiuGongGe, palaceOppositeMap[tianYiPalace.gong])
    : undefined;
  if (tianYiPalace && tianYiOppositePalace) {
    out.push({
      key: 'combo:tianYiJiChong',
      name: '天乙击冲',
      tone: 'mixed',
      summary: `值符星${ctx.zhiFu}落${tianYiPalace.name}为天乙宫，兵事宜居其方、击其对冲${tianYiOppositePalace.name}；此为坐击取向参考，不作通用吉凶评分。`,
      palace: tianYiPalace.gong,
      sources: [`天乙宫：${tianYiPalace.name}`, `对冲：${tianYiOppositePalace.name}`],
    });
  }

  const jiuDiPalace = findGodPalace(ctx.jiuGongGe, '九地');
  const zhiShiPalace = findDoorPalace(ctx.jiuGongGe, ctx.zhiShi);

  if (tianYiPalace && jiuTianPalace && shengMenPalace && jiuDiPalace && zhiShiPalace) {
    out.push({
      key: 'combo:wuBuJi',
      name: '五不击',
      tone: 'mixed',
      summary:
        '值符星、九天、生门、九地和值使所在宫为五不击，偏兵事攻守禁忌；宜据守借势，不宜把这些方位作为攻击对象。',
      sources: [
        `天乙宫：${tianYiPalace.name}`,
        `九天：${jiuTianPalace.name}`,
        `生门：${shengMenPalace.name}`,
        `九地：${jiuDiPalace.name}`,
        `值使${ctx.zhiShi}：${zhiShiPalace.name}`,
      ],
    });
  }

  if (zhiShiPalace?.gong === 3) {
    out.push({
      key: 'combo:quSan',
      name: '趋三',
      tone: 'mixed',
      summary: `值使${ctx.zhiShi}到${zhiShiPalace.name}，合“值使到震宜向之”之法，可作为取向与出行择方参考。`,
      palace: zhiShiPalace.gong,
      sources: [`值使${ctx.zhiShi}落${zhiShiPalace.name}`],
    });
  }

  if (zhiShiPalace?.gong === 4) {
    out.push({
      key: 'combo:biWu',
      name: '避五',
      tone: 'mixed',
      summary: `值使${ctx.zhiShi}到${zhiShiPalace.name}，合“值使到巽宫宜去之”之法，偏择方避让参考，不作通用凶方扣分。`,
      palace: zhiShiPalace.gong,
      sources: [`值使${ctx.zhiShi}落${zhiShiPalace.name}`],
    });
  }

  if (ctx.zhiShi && zhiShiPalace?.shenPan.god && eightGods.has(zhiShiPalace.shenPan.god)) {
    out.push({
      key: `combo:baJiangHuiMen:${zhiShiPalace.gong}`,
      name: '八将会门',
      tone: 'mixed',
      summary: `值使${ctx.zhiShi}落${zhiShiPalace.name}，上临${zhiShiPalace.shenPan.god}，为${zhiShiPalace.shenPan.god}会${ctx.zhiShi}；古法收用天盘不用地盘，偏天时、行兵、捕捉等场景参考，不作通用吉凶评分。`,
      palace: zhiShiPalace.gong,
      sources: [
        `值使${ctx.zhiShi}：${zhiShiPalace.name}`,
        `${zhiShiPalace.shenPan.god}会${ctx.zhiShi}`,
      ],
    });
  }

  const youDuBranch = ctx.dayStem ? youDuBranchByDayStem[ctx.dayStem] : undefined;
  const luDuBranch = youDuBranch ? LIUCHONG_MAP[youDuBranch] : undefined;
  const youDuPalace = youDuBranch ? getPalaceByBranch(ctx.jiuGongGe, youDuBranch) : undefined;
  const luDuPalace = luDuBranch ? getPalaceByBranch(ctx.jiuGongGe, luDuBranch) : undefined;

  if (youDuBranch && luDuBranch && youDuPalace && luDuPalace) {
    out.push({
      key: 'combo:youDuLuDu',
      name: '游都鲁都',
      tone: 'mixed',
      summary: `${ctx.dayStem}日游都在${youDuBranch}支${youDuPalace.name}，对冲鲁都在${luDuBranch}支${luDuPalace.name}，偏兵事背击与择方参考，不作通用吉凶评分。`,
      sources: [
        `${ctx.dayStem}日游都：${youDuBranch}支${youDuPalace.name}`,
        `鲁都：${luDuBranch}支${luDuPalace.name}`,
      ],
    });
  }

  const xunShouGanZhi = getXunShouGanZhi(ctx.activeGanZhi);
  const tianMuDiEr = xunShouGanZhi ? tianMuDiErByXun[xunShouGanZhi] : undefined;
  const tianMuPalace = tianMuDiEr
    ? getPalaceByBranch(ctx.jiuGongGe, tianMuDiEr.tianMu.branch)
    : undefined;
  const diErPalace = tianMuDiEr
    ? getPalaceByBranch(ctx.jiuGongGe, tianMuDiEr.diEr.branch)
    : undefined;
  if (ctx.activeGanZhi && xunShouGanZhi && tianMuDiEr && tianMuPalace && diErPalace) {
    out.push({
      key: 'combo:tianMuDiEr',
      name: '天目地耳',
      tone: 'mixed',
      summary: `${ctx.activeGanZhi}属${xunShouGanZhi}旬，天目为${tianMuDiEr.tianMu.ganZhi}（${tianMuPalace.name}），地耳为${tianMuDiEr.diEr.ganZhi}（${diErPalace.name}），偏兵事“背天目击地耳”参考，不作通用吉凶评分。`,
      sources: [
        `${xunShouGanZhi}旬天目：${tianMuDiEr.tianMu.ganZhi}${tianMuPalace.name}`,
        `${xunShouGanZhi}旬地耳：${tianMuDiEr.diEr.ganZhi}${diErPalace.name}`,
      ],
    });
  }

  const guXu = xunShouGanZhi ? guXuByXun[xunShouGanZhi] : undefined;
  const guLabels = guXu ? getBranchPalaceLabels(ctx.jiuGongGe, guXu.gu) : undefined;
  const xuLabels = guXu ? getBranchPalaceLabels(ctx.jiuGongGe, guXu.xu) : undefined;
  if (ctx.activeGanZhi && xunShouGanZhi && guXu && guLabels && xuLabels) {
    out.push({
      key: 'combo:xunGuXu',
      name: '孤虚',
      tone: 'mixed',
      summary: `${ctx.activeGanZhi}属${xunShouGanZhi}旬，孤在${guLabels.join('、')}，虚在${xuLabels.join('、')}；偏兵事“背孤击虚”、博弈坐向与远行避忌参考，不作通用吉凶评分。`,
      sources: [
        `${xunShouGanZhi}旬孤：${guLabels.join('、')}`,
        `${xunShouGanZhi}旬虚：${xuLabels.join('、')}`,
      ],
    });
  }

  const tianMa = getTianMaLabels(ctx.jiuGongGe, ctx.monthGeneral, ctx.hourBranch);
  if (ctx.monthGeneral && ctx.hourBranch && tianMa) {
    out.push({
      key: 'combo:tianMaDirection',
      name: '天马方',
      tone: 'mixed',
      summary: `按已交中气取月将${tianMa.monthGeneral}，加${ctx.hourBranch}时，顺数至卯为太冲天马方：${tianMa.labels.join('、')}；偏急难逃避与出行择方参考，不作通用吉凶评分。`,
      sources: [`天马方：${tianMa.labels.join('、')}`],
    });
  }

  const tianGang = getTianGangLabels(ctx.jiuGongGe, ctx.monthGeneral, ctx.hourBranch);
  if (ctx.monthGeneral && ctx.hourBranch && tianGang) {
    out.push({
      key: 'combo:tianGangTime',
      name: '天罡时',
      tone: 'mixed',
      summary: `按已交中气取月将${tianGang.monthGeneral}，加${ctx.hourBranch}时，上盘天罡所临为斗星方：${tianGang.labels.join('、')}；偏行兵破阵与择方参考，不作通用吉凶评分。`,
      sources: [`斗星方：${tianGang.labels.join('、')}`],
    });
  }

  const tianGangBranch = tianGang?.targetBranches[0];
  const tianGangPalace = tianGangBranch
    ? getPalaceByBranch(ctx.jiuGongGe, tianGangBranch)
    : undefined;
  const lostRoute = tianGangBranch ? getMengZhongJiRoute(tianGangBranch) : undefined;
  if (
    ctx.monthGeneral &&
    ctx.hourBranch &&
    tianGang &&
    tianGangBranch &&
    tianGangPalace &&
    lostRoute
  ) {
    out.push({
      key: 'combo:lostRoute',
      name: '迷路法',
      tone: 'mixed',
      summary: `按已交中气取月将${tianGang.monthGeneral}，加${ctx.hourBranch}时，天罡临${tianGangBranch}支${tianGangPalace.name}，属${lostRoute.position}位，${lostRoute.route}；偏行军迷路、择道参考，不作通用吉凶评分。`,
      palace: tianGangPalace.gong,
      sources: [
        `天罡：${tianGangBranch}支${tianGangPalace.name}`,
        `天罡加${lostRoute.position}：${lostRoute.route}`,
      ],
    });
  }

  const tianSanMen = getTianSanMenLabels(ctx.jiuGongGe, ctx.monthGeneral, ctx.hourBranch);
  const diSiHuLabels =
    ctx.monthBranch && ctx.hourBranch ? getDiSiHuLabels(ctx.jiuGongGe, ctx.hourBranch) : undefined;
  if (ctx.monthBranch && ctx.monthGeneral && ctx.hourBranch && tianSanMen && diSiHuLabels) {
    out.push({
      key: 'combo:tianSanMenDiSiHu',
      name: '天三门地四户',
      tone: 'mixed',
      summary: `按已交中气取月将${tianSanMen.monthGeneral}，加${ctx.hourBranch}时，天三门为${tianSanMen.labels.join('、')}；以月建${ctx.monthBranch}加时支，地四户为${diSiHuLabels.join('、')}；偏出行、避难与择方参考，遇三奇吉门更佳，不作通用吉凶评分。`,
      sources: [`天三门：${tianSanMen.labels.join('、')}`, `地四户：${diSiHuLabels.join('、')}`],
    });
  }

  const qingLongStem = xunShouGanZhi ? dunJiaStemByXun[xunShouGanZhi] : undefined;
  const tianMenPalace = findTianStemPalace(ctx.jiuGongGe, '戊');
  const diHuPalace = findTianStemPalace(ctx.jiuGongGe, '己');
  const guoTaiYinPalace = findTianStemPalace(ctx.jiuGongGe, '丁');
  const qingLongPalace = findTianStemPalace(ctx.jiuGongGe, qingLongStem);
  if (
    ctx.activeGanZhi &&
    xunShouGanZhi &&
    qingLongStem &&
    tianMenPalace &&
    diHuPalace &&
    guoTaiYinPalace &&
    qingLongPalace
  ) {
    out.push({
      key: 'combo:tianMenDiHuTaiYinQingLong',
      name: '天门地户太阴青龙',
      tone: 'mixed',
      summary: `${ctx.activeGanZhi}属${xunShouGanZhi}旬，出天门取天盘戊所在${tianMenPalace.name}，入地户取天盘己所在${diHuPalace.name}，过太阴取天盘丁所在${guoTaiYinPalace.name}，居青龙取本旬六甲遁${qingLongStem}所在${qingLongPalace.name}；偏出行避难与兵事用方参考，不作通用吉凶评分。`,
      sources: [
        `天门：天盘戊${tianMenPalace.name}`,
        `地户：天盘己${diHuPalace.name}`,
        `太阴：天盘丁${guoTaiYinPalace.name}`,
        `青龙：${xunShouGanZhi}旬六甲遁${qingLongStem}${qingLongPalace.name}`,
      ],
    });
  }

  const campRolePalaces = qingLongStem
    ? [
        { role: '大将', label: `本旬六甲遁${qingLongStem}`, palace: qingLongPalace },
        { role: '旗鼓', label: '天盘乙', palace: findTianStemPalace(ctx.jiuGongGe, '乙') },
        { role: '士卒', label: '天盘丙', palace: findTianStemPalace(ctx.jiuGongGe, '丙') },
        { role: '伏兵', label: '天盘丁', palace: guoTaiYinPalace },
        { role: '判断', label: '天盘辛', palace: findTianStemPalace(ctx.jiuGongGe, '辛') },
        { role: '囚系粮储', label: '天盘壬', palace: findTianStemPalace(ctx.jiuGongGe, '壬') },
        { role: '所藏', label: '天盘癸', palace: findTianStemPalace(ctx.jiuGongGe, '癸') },
      ]
    : [];
  if (
    ctx.activeGanZhi &&
    xunShouGanZhi &&
    qingLongStem &&
    campRolePalaces.length > 0 &&
    campRolePalaces.every((item) => item.palace)
  ) {
    const roleLabels = campRolePalaces.map(
      (item) => `${item.role}取${item.label}所在${item.palace?.name}`,
    );
    out.push({
      key: 'combo:campLayout',
      name: '下营法',
      tone: 'mixed',
      summary: `${ctx.activeGanZhi}属${xunShouGanZhi}旬，${roleLabels.join('，')}；偏行军下营分工参考，不作通用吉凶评分。`,
      sources: roleLabels,
    });
  }

  if (ctx.hourStem && (yangHourStems.has(ctx.hourStem) || yinHourStems.has(ctx.hourStem))) {
    const isYangHour = yangHourStems.has(ctx.hourStem);
    out.push({
      key: 'combo:yangYinHourHostGuest',
      name: '五阳五阴主客',
      tone: 'mixed',
      summary: isYangHour
        ? `${ctx.hourStem}时属五阳时，兵事利客、宜先举；用局重看天盘奇仪星门是否强盛，不作通用吉凶评分。`
        : `${ctx.hourStem}时属五阴时，兵事利主、宜后应；用局重看地盘奇仪星门是否强盛，不作通用吉凶评分。`,
      sources: [
        isYangHour ? `${ctx.hourStem}时为五阳时：利客先举` : `${ctx.hourStem}时为五阴时：利主后应`,
      ],
    });
  }

  const dayGanZhi =
    ctx.dayGanZhi || (ctx.dayStem && ctx.dayBranch ? `${ctx.dayStem}${ctx.dayBranch}` : undefined);
  const diBing = dayGanZhi ? xunZhongDiBingDay[dayGanZhi] : undefined;
  if (dayGanZhi && diBing) {
    out.push({
      key: 'combo:xunZhongDiBingDay',
      name: '旬中地丙日',
      tone: 'mixed',
      summary: `${dayGanZhi}为${diBing.xun}${diBing.branch}日，合“旬中地丙日”，偏兵事用日避忌；将兵者不宜用，不作通用吉凶评分。`,
      sources: [`${diBing.xun}${diBing.branch}日：旬中地丙日`],
    });
  }

  const daJiangJunBranch = ctx.yearBranch
    ? daJiangJunBranchByYearBranch[ctx.yearBranch]
    : undefined;
  const daJiangJunPalace = daJiangJunBranch
    ? getPalaceByBranch(ctx.jiuGongGe, daJiangJunBranch)
    : undefined;
  if (ctx.yearBranch && daJiangJunBranch && daJiangJunPalace) {
    out.push({
      key: 'combo:daJiangJunDirection',
      name: '大将军方',
      tone: 'mixed',
      summary: `${ctx.yearBranch}年大将军在${daJiangJunBranch}支${daJiangJunPalace.name}，偏兵事背击与避犯参考，不作通用吉凶评分。`,
      palace: daJiangJunPalace.gong,
      sources: [`${ctx.yearBranch}年大将军：${daJiangJunBranch}支${daJiangJunPalace.name}`],
    });
  }

  const taiSuiPalace = ctx.yearBranch
    ? getPalaceByBranch(ctx.jiuGongGe, ctx.yearBranch)
    : undefined;
  if (ctx.yearBranch && taiSuiPalace) {
    out.push({
      key: 'combo:taiSuiDirection',
      name: '太岁方',
      tone: 'mixed',
      summary: `${ctx.yearBranch}年太岁在地盘${ctx.yearBranch}支${taiSuiPalace.name}，偏兵事背击与避犯参考，不作通用吉凶评分。`,
      palace: taiSuiPalace.gong,
      sources: [`太岁：地盘${ctx.yearBranch}支${taiSuiPalace.name}`],
    });
  }

  const yueJianPalace = ctx.monthBranch
    ? getPalaceByBranch(ctx.jiuGongGe, ctx.monthBranch)
    : undefined;
  if (ctx.monthBranch && yueJianPalace) {
    out.push({
      key: 'combo:yueJianDirection',
      name: '月建方',
      tone: 'mixed',
      summary: `${ctx.monthBranch}月月建在地盘${ctx.monthBranch}支${yueJianPalace.name}，偏兵事背击与避犯参考，不作通用吉凶评分。`,
      palace: yueJianPalace.gong,
      sources: [`月建：地盘${ctx.monthBranch}支${yueJianPalace.name}`],
    });
  }

  const taiYinPalace = findGodPalace(ctx.jiuGongGe, '太阴');
  if (taiYinPalace) {
    out.push({
      key: 'combo:taiYinDirection',
      name: '太阴方',
      tone: 'mixed',
      summary: `八神太阴在${taiYinPalace.name}，偏兵事背击、伏藏与避犯参考，不作通用吉凶评分。`,
      palace: taiYinPalace.gong,
      sources: [`太阴：八神太阴宫${taiYinPalace.name}`],
    });
  }

  const liuHePalace = findGodPalace(ctx.jiuGongGe, '六合');
  if (jiuTianPalace && jiuDiPalace && taiYinPalace && liuHePalace) {
    out.push({
      key: 'combo:fourGodDirections',
      name: '四神用方',
      tone: 'mixed',
      summary: `九天在${jiuTianPalace.name}宜扬兵，九地在${jiuDiPalace.name}宜潜藏立营，太阴在${taiYinPalace.name}宜伏兵，六合在${liuHePalace.name}宜逃形谋议；偏兵事与隐遁取向参考，不作通用吉凶评分。`,
      sources: [
        `九天：${jiuTianPalace.name}扬兵`,
        `九地：${jiuDiPalace.name}潜藏立营`,
        `太阴：${taiYinPalace.name}伏兵`,
        `六合：${liuHePalace.name}逃形谋议`,
      ],
    });
  }

  const heKuiPalace = getPalaceByBranch(ctx.jiuGongGe, '戌');
  if (heKuiPalace) {
    out.push({
      key: 'combo:heKuiDirection',
      name: '河魁方',
      tone: 'mixed',
      summary: `河魁为戌支，落地盘戌支${heKuiPalace.name}，偏兵事背击与避犯参考，不作通用吉凶评分。`,
      palace: heKuiPalace.gong,
      sources: [`河魁：戌支${heKuiPalace.name}`],
    });
  }

  const wuJiang = ctx.dayBranch ? wuJiangDirectionByDayBranch[ctx.dayBranch] : undefined;
  if (ctx.dayBranch && wuJiang) {
    const palaceName = getPalaceName(ctx.jiuGongGe, wuJiang.palace);
    out.push({
      key: 'combo:wuJiangDirection',
      name: '五将方',
      tone: 'mixed',
      summary: `${ctx.dayBranch}日五将方在${wuJiang.direction}（${palaceName}），偏兵事遇敌避犯与择利反击参考，不作通用吉凶评分。`,
      palace: wuJiang.palace,
      sources: [`${ctx.dayBranch}日五将方：${wuJiang.direction}${palaceName}`],
    });
  }

  const shiZhongHour = ctx.dayBranch ? shiZhongJiangXingHourByDayBranch[ctx.dayBranch] : undefined;
  if (ctx.dayBranch && ctx.hourBranch && shiZhongHour === ctx.hourBranch) {
    out.push({
      key: 'combo:shiZhongJiangXing',
      name: '时中将星',
      tone: 'mixed',
      summary: `${ctx.dayBranch}日逢${ctx.hourBranch}时，为时中将星，偏兵事择时参考，不作通用吉凶评分。`,
      sources: [`${ctx.dayBranch}日${ctx.hourBranch}时：时中将星`],
    });
  }

  const xiongBranch = ctx.monthBranch ? xiongBranchByMonthBranch[ctx.monthBranch] : undefined;
  const ciBranch = xiongBranch ? LIUCHONG_MAP[xiongBranch] : undefined;
  const xiongPalace = xiongBranch ? getPalaceByBranch(ctx.jiuGongGe, xiongBranch) : undefined;
  const ciPalace = ciBranch ? getPalaceByBranch(ctx.jiuGongGe, ciBranch) : undefined;

  if (ctx.monthBranch && xiongBranch && ciBranch && xiongPalace && ciPalace) {
    out.push({
      key: 'combo:xiongCiDirection',
      name: '雄雌方',
      tone: 'mixed',
      summary: `${ctx.monthBranch}月以${xiongBranch}支${xiongPalace.name}为雄，对冲${ciBranch}支${ciPalace.name}为雌，偏兵事“背雄击雌”参考，不作通用吉凶评分。`,
      sources: [
        `${ctx.monthBranch}月雄方：${xiongBranch}支${xiongPalace.name}`,
        `雌方：${ciBranch}支${ciPalace.name}`,
      ],
    });
  }

  const attackAvoidance = ctx.dayStem ? attackAvoidanceByDayStem[ctx.dayStem] : undefined;
  if (attackAvoidance) {
    const palaceNames = attackAvoidance.palaces.map((palace) =>
      getPalaceName(ctx.jiuGongGe, palace),
    );
    out.push({
      key: 'combo:dayStemAttackAvoidance',
      name: '日干攻方避忌',
      tone: 'mixed',
      summary: `${ctx.dayStem}日不宜攻${attackAvoidance.direction}（${palaceNames.join('、')}），偏兵事攻方避忌；只作攻守参考，不作通用吉凶评分。`,
      sources: [
        `${ctx.dayStem}日不宜攻${attackAvoidance.direction}`,
        `避攻宫位：${palaceNames.join('、')}`,
      ],
    });
  }
}

export function detectQimenPatternCombos(ctx: PatternComboContext): QimenPatternCombo[] {
  const out: QimenPatternCombo[] = [];
  pushNamedCombos(ctx, out);
  pushXingDeKaiHeCombo(ctx, out);
  pushStarPalaceHostGuestCombo(ctx, out);
  pushDoorPalaceHostGuestCombo(ctx, out);
  pushStarDoorHostGuestInjuryCombo(ctx, out);
  pushDoorSeasonQiCombo(ctx, out);
  pushStemPressureCombo(ctx, out);
  pushStrategicDirectionCombos(ctx, out);

  const seen = new Set<string>();
  return out.filter((combo) => {
    if (seen.has(combo.key)) return false;
    seen.add(combo.key);
    return true;
  });
}
