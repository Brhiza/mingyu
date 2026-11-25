import type { QimenData, QimenJiuGongGe } from './types';
import { isKe, isSheng } from '../calendar';
import { doorPalaces, getDoorElement, getOppositePalace, getTianPanStemForStar, getTianPanStems, hasTianPanStar, hasTianPanStem, palaceStars, stemTombs } from './palace';

const qiNames: Record<string, string> = { 乙: '乙奇（日奇）', 丙: '丙奇（月奇）', 丁: '丁奇（星奇）' };
const qiInstruments: Record<string, { stems: string; heads: string }> = {
  乙: { stems: '己辛', heads: '甲戌/甲午' }, 丙: { stems: '戊庚', heads: '甲子/甲申' }, 丁: { stems: '壬癸', heads: '甲辰/甲寅' },
};
const qiRoaming: Record<string, Record<string, [string, string, string]>> = {
  乙: { 己: ['甲戌', '甲午', '辛'], 辛: ['甲午', '甲戌', '己'] },
  丙: { 戊: ['甲子', '甲申', '庚'], 庚: ['甲申', '甲子', '戊'] },
  丁: { 壬: ['甲辰', '甲寅', '癸'], 癸: ['甲寅', '甲辰', '壬'] },
};
const punishments: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
const goodDoors = new Set(['开门', '休门', '生门']);
const badDoors = new Set(['伤门', '死门', '惊门']);
const goodGods = new Set(['值符', '六合', '九天', '太阴']);
const badGods = new Set(['白虎', '玄武', '螣蛇']);

interface PatternParams {
  zhiFu: string; zhiShi: string; zhiFuLandingPalace: number; zhiShiLandingPalace: number;
  jiuGongGe: QimenJiuGongGe[]; activeGanForFind: string; activeGanLabel: string;
  horsePalace?: number; horsePalaceName?: string;
}

/** 只根据当前九宫已出现的门、星、干与马星生成基础格局。 */
export function getQimenPatternTags({ zhiFu, zhiShi, zhiShiLandingPalace, jiuGongGe, activeGanForFind: activeStem, activeGanLabel: label, horsePalace, horsePalaceName }: PatternParams): string[] {
  const tags: string[] = [];
  if (!palaceStars.includes(zhiFu)) throw new Error(`值符星 "${zhiFu}" 无法识别。`);
  const placements = palaceStars.map((star, index) => {
    const palace = jiuGongGe.find((item) => hasTianPanStar(item, star));
    const companionHostHome =
      star === '天禽' && palace?.tianPan.companionStar === star
        ? palaceStars.indexOf(palace.tianPan.star) + 1
        : 0;
    return { home: companionHostHome > 0 ? companionHostHome : index + 1, landing: palace?.gong };
  });
  if (placements.every((item) => item.landing === item.home)) tags.push('星伏吟');
  else if (placements.every((item) => item.landing === (getOppositePalace(item.home) ?? item.home))) tags.push('星反吟');
  const doorHome = doorPalaces[zhiShi];
  if (!doorHome) throw new Error(`值使门 "${zhiShi}" 无法识别。`);
  if (zhiShiLandingPalace === doorHome) tags.push('门伏吟');
  else if (zhiShiLandingPalace === getOppositePalace(doorHome)) tags.push('门反吟');
  for (const palace of jiuGongGe) if (palace.renPan.door && isKe(getDoorElement(palace.renPan.door), palace.element)) tags.push(`门迫（${palace.name}${palace.renPan.door}）`);
  for (const palace of jiuGongGe.filter((item) => hasTianPanStem(item, activeStem))) {
    if (punishments[activeStem] === palace.gong) tags.push(`击刑（${label}${activeStem}落${palace.name}）`);
    if (stemTombs[activeStem]?.palace === palace.gong) tags.push(`入墓（${label}${activeStem}落${palace.name}）`);
  }
  for (const palace of jiuGongGe.filter((item) => goodDoors.has(item.renPan.door))) {
    for (const stem of getTianPanStems(palace).filter((item) => qiNames[item])) tags.push(`三奇得（${qiNames[stem]}合${palace.renPan.door}于${palace.name}）`);
  }
  if (goodDoors.has(zhiShi)) {
    const palace = jiuGongGe.find((item) => item.renPan.door === zhiShi && qiNames[item.diPan.stem]);
    if (palace) tags.push(`宝鉴三奇得使（值使${zhiShi}加地盘${qiNames[palace.diPan.stem]}于${palace.name}）`);
  }
  const fu = jiuGongGe.find((item) => hasTianPanStar(item, zhiFu));
  const shi = jiuGongGe.find((item) => item.renPan.door === zhiShi);
  if (fu && shi && fu.gong === shi.gong) tags.push(`符使同宫（值符${zhiFu}与值使${zhiShi}同落${fu.name}）`);
  for (const palace of jiuGongGe) for (const stem of getTianPanStems(palace)) {
    const config = qiInstruments[stem];
    if (config && config.stems.includes(palace.diPan.stem)) tags.push(`三奇得使（${qiNames[stem]}加${config.heads}所遁${palace.diPan.stem}于${palace.name}）`);
  }
  if (fu) {
    const qi = fu.diPan.stem, stem = getTianPanStemForStar(fu, zhiFu) || '';
    const config = qiRoaming[qi]?.[stem];
    if (config) tags.push(`三奇游六仪（${config[0]}${stem}值符加${qiNames[qi] || `${qi}奇`}于${fu.name}，游${config[1]}${config[2]}）`);
  }
  if (horsePalace !== undefined) {
    const palace = jiuGongGe.find((item) => item.gong === horsePalace);
    if (palace) tags.push(`马星（驿马落${horsePalaceName || palace.name}）`);
  }
  return tags;
}

export function buildPatternDetails(tags: string[]) {
  const exact: Record<string, string> = { 星伏吟: '九星回原位，事情多原地盘旋、推进偏慢。', 星反吟: '九星临对冲宫，局势波动较大，易反复。', 门伏吟: '八门回原位，事项推进迟滞，宜耐心等待。', 门反吟: '八门落反吟位，节奏多突变，计划易临时调整。' };
  return tags.map((tag) => {
    const label = tag.match(/^[击刑入墓]+（(年干|月干|日干|时干)/u)?.[1] ?? '主动干';
    const summary = exact[tag] ?? (tag.startsWith('门迫') ? '门克宫，该宫事项易受压制，行动阻力偏大。'
      : tag.startsWith('击刑') ? `${label}落击刑位，主压力、掣肘或规章束缚，宜谨慎行事。`
      : tag.startsWith('入墓') ? `${label}入墓宫，主能量被困、事情停滞或难以施展，宜等待时机或寻求突破。`
      : tag.startsWith('三奇得（') ? '三奇与开休生吉门同宫，主该宫方位得奇门会合之助，可借助该方位推进事项。'
      : tag.startsWith('符使同宫') ? '值符与值使同宫，力量高度集中，专注之事易出成果，但也需注意过于偏执。'
      : tag.startsWith('宝鉴三奇得使') ? '值使吉门加临三奇，关键入口与关键资源重合，谋事更有利。'
      : tag.startsWith('三奇得使') ? '三奇加特定六甲旬首所遁六仪，得使相助，所谋之事有贵人暗助，宜主动把握。'
      : tag.startsWith('三奇游六仪') ? '当旬值符所带六仪加到地盘三奇，主资源转换成助力，适合请托、协商和争取机会。'
      : tag.startsWith('马星') ? '驿马所在宫提示移动、变动或远行线索，是否加速需结合值符、值使和用事宫位。'
      : '需结合全局继续参看。');
    return { tag, summary };
  });
}

export function buildPalaceInsights({ jiuGongGe, zhiFu, zhiShi, patternTags }: { jiuGongGe: QimenJiuGongGe[]; zhiFu: string; zhiShi: string; patternTags: string[] }) {
  const riskTags = patternTags.filter((tag) => ['门迫', '击刑', '入墓'].some((prefix) => tag.startsWith(prefix)));
  const result: Array<{ gong: number; name: string; level: '有利' | '风险' | '关注'; summary: string }> = [];
  for (const palace of jiuGongGe) {
    const { gong, name, renPan, shenPan } = palace;
    const related = riskTags.filter((tag) => tag.includes(`（${name}`) || tag.includes(`落${name}`));
    if (related.length) result.push({ gong, name, level: '风险', summary: `该宫带有${related.join('、')}，行事阻滞和牵制较明显。` });
    const bad = [badDoors.has(renPan.door) ? renPan.door : '', badGods.has(shenPan.god) ? shenPan.god : ''].filter(Boolean);
    if (bad.length) result.push({ gong, name, level: '风险', summary: `${bad.join('、')}同宫，宜防阻力、口舌或反复。` });
    if (hasTianPanStar(palace, zhiFu)) result.push({ gong, name, level: '关注', summary: `值符落${name}，是当前局的核心观察位。` });
    if (renPan.door === zhiShi) result.push({ gong, name, level: '关注', summary: `值使（${zhiShi}）在${name}，是本局主事门，需结合宫内条件判断。` });
    const good = [goodDoors.has(renPan.door) ? renPan.door : '', goodGods.has(shenPan.god) ? shenPan.god : ''].filter(Boolean);
    if (good.length) result.push({ gong, name, level: '有利', summary: `${good.join('、')}同宫，可作为推进、求助或争取资源的优先方位。` });
  }
  return result;
}

export interface QimenDamagedGoodPalace {
  gong: number;
  palaceName: string;
  goodPatterns: string[];
  negativeFactors: string[];
  verdict: '吉格逢空（待填实/冲空）' | '吉格折损' | '吉格折损/反凶';
}

export interface QimenBadRescuePalace {
  gong: number;
  palaceName: string;
  badPatterns: string[];
  rescueFactors: string[];
  hasRescue: boolean;
}

export interface QimenPatternRelations {
  damagedGoodPalaces: QimenDamagedGoodPalace[];
  badRescuePalaces: QimenBadRescuePalace[];
  globalConstraints: string[];
}

const QIMEN_HARM_DOORS = new Set(['死门', '惊门', '伤门', '杜门']);
const QIMEN_TOP_GOOD_PATTERNS = new Set(['青龙返首', '飞鸟跌穴']);
const QIMEN_PASSIVE_GOOD_NAMES = new Set(['宫生门', '门生宫']);
const QIMEN_SAN_QI = new Set(['乙', '丙', '丁']);

function uniqueStrings(items: readonly string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

/**
 * 逐宫及全局计算奇门格局叠加与吉凶制衡关系（吉格折损/反凶、凶格救应/通关、全局约束）。
 */
export function analyzeQimenPatternRelations(data: QimenData): QimenPatternRelations {
  const voidGongSet = new Set((data.voidPalaces ?? []).map((item) => item.palace));
  const classicPatterns = data.classicPatterns ?? [];
  const patternTags = data.patternTags ?? [];

  const damagedGoodPalaces: QimenDamagedGoodPalace[] = [];
  const badRescuePalaces: QimenBadRescuePalace[] = [];

  for (const palace of data.jiuGongGe) {
    if (palace.gong === 5) continue;
    const { gong, name, renPan, shenPan } = palace;
    const door = renPan.door;
    const doorEl = door ? getDoorElement(door) : '';
    const palaceClassic = classicPatterns.filter((item) => item.palaces.includes(gong));

    // 1. 收集本宫吉格（排除单纯的宫生门/门生宫，后者作为救应因子）
    const goodNames: string[] = [];
    for (const item of palaceClassic) {
      if (item.type === 'good' && !QIMEN_PASSIVE_GOOD_NAMES.has(item.name)) {
        goodNames.push(item.name);
      }
    }
    for (const tag of patternTags) {
      if (
        (tag.startsWith('三奇得（') ||
          tag.startsWith('三奇得使（') ||
          tag.startsWith('宝鉴三奇得使（') ||
          tag.startsWith('三奇游六仪（')) &&
        tag.includes(`于${name}`)
      ) {
        const prefix = tag.split('（')[0];
        if (!goodNames.some((n) => n.includes(prefix) || prefix.includes(n))) {
          goodNames.push(prefix);
        }
      }
    }
    const goodPatterns = uniqueStrings(goodNames);

    // 2. 收集本宫负面因子
    const negativeFactors: string[] = [];
    const jixingItems = palaceClassic.filter((item) => item.type === 'bad' && item.name.endsWith('击刑'));
    for (const item of jixingItems) negativeFactors.push(item.name);
    for (const tag of patternTags) {
      if (tag.startsWith('击刑（') && tag.includes(`落${name}`) && jixingItems.length === 0) {
        negativeFactors.push('击刑');
      }
    }
    const isMenPo = Boolean(door && doorEl && isKe(doorEl, palace.element));
    if (isMenPo) negativeFactors.push(`门迫（${door}克${name}）`);

    const rumuItems = palaceClassic.filter((item) => item.type === 'bad' && item.name.endsWith('入墓'));
    for (const item of rumuItems) negativeFactors.push(item.name);
    for (const tag of patternTags) {
      if (tag.startsWith('入墓（') && tag.includes(`落${name}`) && rumuItems.length === 0) {
        negativeFactors.push('入墓');
      }
    }
    const isVoid = voidGongSet.has(gong);
    if (isVoid) negativeFactors.push('空亡（待冲空/填实）');
    if (door && QIMEN_HARM_DOORS.has(door)) negativeFactors.push(`凶门${door}`);

    const otherBadClassics = palaceClassic.filter(
      (item) =>
        item.type === 'bad' &&
        item.name !== '门迫' &&
        !item.name.endsWith('击刑') &&
        !item.name.endsWith('入墓'),
    );
    for (const item of otherBadClassics) negativeFactors.push(item.name);
    const uniqueNegatives = uniqueStrings(negativeFactors);

    if (goodPatterns.length > 0 && uniqueNegatives.length > 0) {
      const onlyVoid = uniqueNegatives.length === 1 && isVoid;
      const hasSevereConflict =
        jixingItems.length > 0 ||
        isMenPo ||
        rumuItems.length > 0 ||
        (door && QIMEN_HARM_DOORS.has(door)) ||
        otherBadClassics.length > 0;
      const hasTopGood = goodPatterns.some((n) => QIMEN_TOP_GOOD_PATTERNS.has(n));
      const verdict: QimenDamagedGoodPalace['verdict'] = onlyVoid
        ? '吉格逢空（待填实/冲空）'
        : hasTopGood && hasSevereConflict
          ? '吉格折损/反凶'
          : '吉格折损';
      damagedGoodPalaces.push({
        gong,
        palaceName: name,
        goodPatterns,
        negativeFactors: uniqueNegatives,
        verdict,
      });
    }

    // 3. 收集本宫凶象并检查救应/通关因子
    const badNames: string[] = [];
    for (const item of palaceClassic) {
      if (item.type === 'bad') badNames.push(item.name);
    }
    if (isMenPo && !badNames.includes('门迫')) badNames.push('门迫');
    const badPatterns = uniqueStrings(badNames);

    if (badPatterns.length > 0) {
      const rescueFactors: string[] = [];
      if (door && goodDoors.has(door)) rescueFactors.push(`吉门${door}`);
      const sanQiInPalace = getTianPanStems(palace).filter((stem) => QIMEN_SAN_QI.has(stem));
      for (const qi of sanQiInPalace) rescueFactors.push(`天盘${qi}奇`);
      if (door && doorEl && isSheng(palace.element, doorEl)) rescueFactors.push(`宫生门（${name}生${door}）`);
      if (shenPan.god === '值符' || hasTianPanStar(palace, data.zhiFu)) {
        rescueFactors.push(shenPan.god === '值符' ? '值符神护持' : `值符星${data.zhiFu}护持`);
      }
      const uniqueRescues = uniqueStrings(rescueFactors);
      badRescuePalaces.push({
        gong,
        palaceName: name,
        badPatterns,
        rescueFactors: uniqueRescues,
        hasRescue: uniqueRescues.length > 0,
      });
    }
  }

  // 4. 全局约束检查
  const globalConstraints: string[] = [];
  if (data.specialConditions?.isWuBuYuShi) {
    globalConstraints.push('五不遇时：时干克日干，全盘吉格均受全局压制，谋事易阻滞反复');
  }
  const fuyinTags = patternTags.filter((tag) => tag === '星伏吟' || tag === '门伏吟');
  if (fuyinTags.length > 0) {
    globalConstraints.push(`${fuyinTags.join('、')}：全盘吉格发动迟缓、停滞难进，利守不利急攻`);
  }
  const fanyinTags = patternTags.filter((tag) => tag === '星反吟' || tag === '门反吟');
  if (fanyinTags.length > 0) {
    globalConstraints.push(`${fanyinTags.join('、')}：全盘吉格易成败反复、多变难稳`);
  }
  if (data.specialConditions?.isShiGanRuMu) {
    globalConstraints.push('时干入墓：时局整体气机收敛受困，全盘吉格力量打折');
  }
  if (data.specialConditions?.isRiGanRuMu) {
    globalConstraints.push('日干入墓：日局整体气机受困，全盘吉格力量打折');
  }

  return {
    damagedGoodPalaces,
    badRescuePalaces,
    globalConstraints,
  };
}

/**
 * 将奇门格局叠加与吉凶制衡关系格式化为客观结构化提示词文本。
 */
export function formatQimenPatternRelations(data: QimenData): string {
  const relations = analyzeQimenPatternRelations(data);
  const lines: string[] = [];

  if (relations.damagedGoodPalaces.length > 0) {
    const items = relations.damagedGoodPalaces.map(
      (item) =>
        `${item.palaceName}［${item.verdict}：吉格(${item.goodPatterns.join('、')})同宫遇(${item.negativeFactors.join('、')})］`,
    );
    lines.push(`吉格折损/反凶检查：${items.join('；')}。`);
  } else {
    lines.push('吉格折损/反凶检查：当前各宫吉格未检出同宫击刑、门迫、入墓、空亡或凶门冲突。');
  }

  if (relations.badRescuePalaces.length > 0) {
    const rescued = relations.badRescuePalaces
      .filter((item) => item.hasRescue)
      .map(
        (item) =>
          `${item.palaceName}［凶象(${item.badPatterns.join('、')})得(${item.rescueFactors.join('、')})救应/通关］`,
      );
    const unrescued = relations.badRescuePalaces
      .filter((item) => !item.hasRescue)
      .map(
        (item) =>
          `${item.palaceName}［凶象(${item.badPatterns.join('、')})无吉门/三奇/宫生门/值符明救］`,
      );
    lines.push(`凶格救应/通关检查：${[...rescued, ...unrescued].join('；')}。`);
  } else {
    lines.push('凶格救应/通关检查：当前九宫未检出同宫凶格或门迫。');
  }

  if (relations.globalConstraints.length > 0) {
    lines.push(`全局约束：${relations.globalConstraints.join('；')}。`);
  } else {
    lines.push('全局约束：未命中五不遇时、伏吟、反吟或干支入墓全局制约。');
  }

  return lines.join('\n');
}
