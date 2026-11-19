import { getTenStar } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';
import type { buildTransformation } from './transformation';
import type { buildQuzhi } from './quzhi';
import type { buildCongEr } from './conger';
import type { buildExtremePattern } from './extreme';

type Pillars = Record<PillarName, BaziPillar>;
const lu: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const blade: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const exposedOrder = ['month', 'hour', 'year'] as const;

/** 普通月令取格只生成候选，不抢先排除特殊格、合化或格局成败。 */
export function buildOrdinaryPattern(pillars: Pillars, commanderStem: string) {
  const day = pillars.day.gan, branch = pillars.month.zhi, hidden = pillars.month.hiddenStems;
  const tenGod = (stem: string) => getTenStar(day, stem);
  const exposures = (stem: string) => exposedOrder.filter((position) => pillars[position].gan === stem);
  const principal = hidden[0];
  if (!principal) throw new Error('月支缺少本气藏干。');
  const commanderGod = tenGod(commanderStem);
  const patternFor = (god: string) => god === '比肩' && lu[day] === branch ? '建禄格' : god === '劫财' && blade[day] === branch ? '月刃格' : `${god}格`;
  const exposedHidden = hidden.map((item, index) => ({ ...item, hiddenIndex: index, positions: exposures(item.stem) }));
  const prioritized = exposedHidden.find((item) => item.positions.length && item.tenGod !== '比肩' && item.tenGod !== '劫财');
  const isStorage = '辰戌丑未'.includes(branch);
  let pattern: string, source: string, selectedStem: string;
  if (lu[day] === branch) { pattern = '建禄格'; source = '月支禄位'; selectedStem = principal.stem; }
  else if (blade[day] === branch) { pattern = '月刃格'; source = '月支刃位'; selectedStem = principal.stem; }
  else if (principal.tenGod === '劫财') { pattern = '劫财格'; source = '月支本气'; selectedStem = principal.stem; }
  else if (exposures(commanderStem).length) { pattern = patternFor(commanderGod); source = '司权透干'; selectedStem = commanderStem; }
  else if (commanderGod === '比肩' || commanderGod === '劫财') { pattern = `${commanderGod}格`; source = '司权'; selectedStem = commanderStem; }
  else if (prioritized) { pattern = `${isStorage && prioritized.stem !== commanderStem ? '杂气' : ''}${prioritized.tenGod}格`; source = '月支藏干透干'; selectedStem = prioritized.stem; }
  else { pattern = patternFor(commanderGod); source = '司权'; selectedStem = commanderStem; }
  return { candidate: pattern, source, selectedStem, dayMaster: day, monthBranch: branch,
    monthPrincipal: { stem: principal.stem, tenGod: principal.tenGod, pattern: patternFor(principal.tenGod) },
    commander: { stem: commanderStem, tenGod: commanderGod, isMonthHidden: hidden.some((item) => item.stem === commanderStem), positions: exposures(commanderStem), pattern: patternFor(commanderGod) },
    monthHiddenStems: exposedHidden,
    limitation: '仅为普通月令取格候选；特殊格另按所列条件模型核验，也未判断成败、调候或用神。' };
}

export type BaziPatternMode = 'standard' | 'main-qi-first' | 'special-first';

/** 当前已迁移路线按化气、曲直、从财、从儿和普通取格排序；支持按口径切换月令本气优先或外格优先。 */
export function summarizePattern(ordinary: ReturnType<typeof buildOrdinaryPattern>, transformation: ReturnType<typeof buildTransformation>, quzhi: ReturnType<typeof buildQuzhi>, conger?: ReturnType<typeof buildCongEr>, extreme?: ReturnType<typeof buildExtremePattern>, patternMode: BaziPatternMode = 'standard') {
  const specialChoice = transformation?.status === '成化' ? { pattern: transformation.pattern, source: '五合化气条件模型' }
    : quzhi?.status === '条件成立' ? { pattern: quzhi.pattern, source: '曲直条件模型' }
      : conger?.competingWealth ? { pattern: '从财格', source: '从财优先条件模型' }
        : conger?.route && conger.status === '条件成立' ? { pattern: '从儿格', source: '从儿条件模型' }
          : extreme?.status === '条件成立' ? { pattern: extreme.candidate, source: '专旺或通用从格条件模型' }
            : null;
  const choice = patternMode === 'main-qi-first'
    ? { pattern: ordinary.monthPrincipal.pattern, source: '普通月令取格候选' }
    : (specialChoice ?? { pattern: ordinary.candidate, source: '普通月令取格候选' });
  return { ...choice, ...(patternMode !== 'standard' ? { mode: patternMode } : {}), limitation: '仅按已实现的化气、曲直、从儿、从财、专旺与通用从格和普通月令路线排序；格局成败、调候、用神与其他传统口径仍待核验。' };
}
