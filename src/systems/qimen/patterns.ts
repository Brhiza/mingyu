import type { QimenJiuGongGe } from './types';
import { isKe } from '../calendar';
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
    return { home: star === '天禽' && palace?.tianPan.companionStar === star ? 2 : index + 1, landing: palace?.gong };
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
