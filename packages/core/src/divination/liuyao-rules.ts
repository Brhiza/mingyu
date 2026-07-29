import {
  BRANCH_ORDER,
  BRANCH_WUXING,
  CHANGSHENG_ORDER,
  getSeasonState,
  isKe,
  isLiuchong,
  isSheng,
} from '../ganzhi';
import type {
  LiuyaoFlyingHiddenRelation,
  LiuyaoHiddenSpirit,
  LiuyaoHiddenSpiritConditionAnalysis,
  LiuyaoYaoDetail,
} from '../types/divination';

const LIUYAO_ELEMENTS = new Set(['木', '火', '土', '金', '水']);

/** 《卜筮正宗·墓库章》《增删卜易·入墓》所用五行墓支。 */
export const LIUYAO_ELEMENT_TOMB_BRANCH: Record<string, string> = {
  金: '丑',
  木: '未',
  火: '戌',
  水: '辰',
  土: '辰',
};

const LIUYAO_CHANGSHENG_START: Record<string, string> = {
  金: '巳',
  木: '亥',
  火: '寅',
  水: '申',
  土: '申',
};

function assertElement(element: string, label: string) {
  if (!LIUYAO_ELEMENTS.has(element)) {
    throw new Error(`${label}五行无效：${element || '空'}`);
  }
}

function getBranchElement(branch: string, label: string) {
  const element = BRANCH_WUXING[branch];
  if (!element) {
    throw new Error(`${label}地支无效：${branch || '空'}`);
  }
  return element;
}

export function getLiuyaoTwelveStage(element: string, branch: string): string {
  assertElement(element, '六爻十二长生');
  getBranchElement(branch, '六爻十二长生');
  const startBranch = LIUYAO_CHANGSHENG_START[element];
  const startIndex = BRANCH_ORDER.indexOf(startBranch);
  const branchIndex = BRANCH_ORDER.indexOf(branch);
  const offset = (((branchIndex - startIndex) % 12) + 12) % 12;
  const stage = CHANGSHENG_ORDER[offset];
  if (!stage) {
    throw new Error(`六爻十二长生无法定位 ${element} 在 ${branch} 支的状态。`);
  }
  return stage;
}

export function isLiuyaoElementInTomb(element: string, branch: string): boolean {
  assertElement(element, '六爻入墓');
  getBranchElement(branch, '六爻入墓');
  return LIUYAO_ELEMENT_TOMB_BRANCH[element] === branch;
}

/**
 * 《增删卜易·飞伏神章》以“飞来生伏”“飞来克伏”说明飞伏关系。
 * 其余方向按同一五行生克主客完整登记，但不由关系名称直接推出吉凶。
 */
export function getLiuyaoFlyingHiddenRelation(
  hiddenElement: string,
  flyingElement: string,
): LiuyaoFlyingHiddenRelation {
  assertElement(hiddenElement, '六爻伏神');
  assertElement(flyingElement, '六爻飞神');
  if (isSheng(flyingElement, hiddenElement)) return '飞来生伏';
  if (isKe(flyingElement, hiddenElement)) return '飞来克伏';
  if (isSheng(hiddenElement, flyingElement)) return '伏去生飞';
  if (isKe(hiddenElement, flyingElement)) return '伏克飞神';
  return '飞伏比和';
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function isWeakSeason(state: string) {
  return state === '休' || state === '囚' || state === '死';
}

/**
 * 逐项登记《增删卜易·飞伏神章》所列伏神得助、飞神松动与伏神受制条件。
 * 支持与限制可以并见；本函数不把条件数量压成“有用/无用”、吉凶或应期结论。
 */
export function analyzeLiuyaoHiddenSpiritConditions(
  spirit: LiuyaoHiddenSpirit,
  monthBranch: string,
  dayBranch: string,
  yaosDetail: LiuyaoYaoDetail[],
): LiuyaoHiddenSpiritConditionAnalysis {
  const monthElement = getBranchElement(monthBranch, '六爻月建');
  const dayElement = getBranchElement(dayBranch, '六爻日辰');
  assertElement(spirit.wuxing, '六爻伏神');
  assertElement(spirit.underYao.wuxing, '六爻飞神');

  const flyingLine = yaosDetail.find((item) => item.position === spirit.position);
  if (!flyingLine) {
    throw new Error(`六爻伏神第${spirit.position}爻缺少对应飞神。`);
  }
  const flyingRelation = getLiuyaoFlyingHiddenRelation(spirit.wuxing, spirit.underYao.wuxing);
  const hiddenSeasonState = getSeasonState(spirit.wuxing, monthBranch);
  const flyingSeasonState = getSeasonState(spirit.underYao.wuxing, monthBranch);
  const hiddenMonthStage = getLiuyaoTwelveStage(spirit.wuxing, monthBranch);
  const hiddenDayStage = getLiuyaoTwelveStage(spirit.wuxing, dayBranch);
  const hiddenFlyingStage = getLiuyaoTwelveStage(spirit.wuxing, spirit.underYao.najiaDizhi);
  const flyingMonthStage = getLiuyaoTwelveStage(spirit.underYao.wuxing, monthBranch);
  const flyingDayStage = getLiuyaoTwelveStage(spirit.underYao.wuxing, dayBranch);
  const support: string[] = [];
  const constraints: string[] = [];

  if (hiddenSeasonState === '旺' || hiddenSeasonState === '相') {
    support.push(`伏神月令${hiddenSeasonState}`);
  } else if (isWeakSeason(hiddenSeasonState)) {
    constraints.push(`伏神月令${hiddenSeasonState}`);
  }
  if (flyingRelation === '飞来生伏') support.push('飞来生伏');
  if (flyingRelation === '飞来克伏') {
    constraints.push(
      flyingSeasonState === '旺' || flyingSeasonState === '相'
        ? `旺相飞神克伏（月令${flyingSeasonState}）`
        : `飞来克伏（月令${flyingSeasonState}）`,
    );
  }

  const addCalendarRelations = (label: '月建' | '日辰', branch: string, element: string) => {
    if (isSheng(element, spirit.wuxing)) support.push(`${label}生伏神`);
    if (isLiuchong(branch, spirit.najiaDizhi)) constraints.push(`${label}冲伏神`);
    if (isKe(element, spirit.wuxing)) constraints.push(`${label}克伏神`);
    if (isLiuchong(branch, spirit.underYao.najiaDizhi)) support.push(`${label}冲飞神`);
    if (isKe(element, spirit.underYao.wuxing)) support.push(`${label}克飞神`);
  };
  addCalendarRelations('月建', monthBranch, monthElement);
  addCalendarRelations('日辰', dayBranch, dayElement);

  for (const yao of yaosDetail) {
    if (!yao.isChanging && !yao.isHiddenMove) continue;
    const label = `第${yao.position}爻${yao.isChanging ? '明动' : '暗动'}`;
    if (isSheng(yao.wuxing, spirit.wuxing)) support.push(`${label}生伏神`);
    if (isLiuchong(yao.najiaDizhi, spirit.underYao.najiaDizhi)) {
      support.push(`${label}冲飞神`);
    }
    if (isKe(yao.wuxing, spirit.underYao.wuxing)) support.push(`${label}克飞神`);
  }

  const flyingIsMonthBreak = isLiuchong(spirit.underYao.najiaDizhi, monthBranch);
  const flyingIsMonthTomb = isLiuyaoElementInTomb(spirit.underYao.wuxing, monthBranch);
  const flyingIsDayTomb = isLiuyaoElementInTomb(spirit.underYao.wuxing, dayBranch);
  if (flyingLine.isVoid) support.push('飞神旬空');
  if (flyingIsMonthBreak) support.push('飞神月破');
  if (isWeakSeason(flyingSeasonState)) support.push(`飞神月令${flyingSeasonState}`);
  if (flyingIsMonthTomb) support.push('飞神入月墓');
  if (flyingIsDayTomb) support.push('飞神入日墓');
  if (flyingMonthStage === '绝') support.push('飞神绝于月建');
  if (flyingDayStage === '绝') support.push('飞神绝于日辰');

  const hiddenIsMonthBreak = isLiuchong(spirit.najiaDizhi, monthBranch);
  const hiddenIsMonthTomb = isLiuyaoElementInTomb(spirit.wuxing, monthBranch);
  const hiddenIsDayTomb = isLiuyaoElementInTomb(spirit.wuxing, dayBranch);
  const hiddenIsFlyingTomb = isLiuyaoElementInTomb(spirit.wuxing, spirit.underYao.najiaDizhi);
  if (spirit.isVoid) constraints.push('伏神旬空');
  if (hiddenIsMonthBreak) constraints.push('伏神月破');
  if (hiddenIsMonthTomb) constraints.push('伏神入月墓');
  if (hiddenIsDayTomb) constraints.push('伏神入日墓');
  if (hiddenIsFlyingTomb) constraints.push('伏神墓于飞神');
  if (hiddenMonthStage === '绝') constraints.push('伏神绝于月建');
  if (hiddenDayStage === '绝') constraints.push('伏神绝于日辰');
  if (hiddenFlyingStage === '绝') constraints.push('伏神绝于飞神');

  return {
    flyingRelation,
    hiddenSeasonState,
    hiddenMonthStage,
    hiddenDayStage,
    hiddenFlyingStage,
    flyingSeasonState,
    flyingMonthStage,
    flyingDayStage,
    support: unique(support),
    constraints: unique(constraints),
  };
}
