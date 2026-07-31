/**
 * @file 透干通根分析
 * @description 检查每个透出天干在地支藏干中是否有根：
 *   - 本根：藏干与透干为同一干
 *   - 同气根：藏干与透干同五行但不同干
 *   - 无根：地支藏干中既无同干也无同五行
 * @古籍依据 《子平真诠》"论根基"、《渊海子平》"论通根"
 *
 * 结果只公开本根、同气根或无根的逐项事实，不生成通根分值。
 */
import type {
  StemRootProfile,
  VisibleStemRootItem,
  ExposedStemItem,
  ExposedStemProfile,
} from '../types/analysis';
import { HIDDEN_STEMS } from './baziMappingsData';
import { SEASON_STATUS } from './baziElementData';
import {
  assertEarthlyBranch,
  assertHeavenlyStem,
  getTenGod as getStandardTenGod,
  getWuxing as getStandardWuxing,
} from './baziUtils';
import {
  assertDayMasterMatchesPillars,
  assertFourPillarInputs,
  assertTenGodResolver,
  assertWuxingResolver,
  FOUR_PILLAR_NAMES,
} from './tenGodFactValidation';

function assertPillarInputs(pillars: Array<{ gan: string; zhi: string }>): void {
  assertFourPillarInputs(pillars);
}

function resolveWuxing(value: string, label: string): string {
  const wuxing = getStandardWuxing(value);
  if (wuxing === '未知') {
    throw new Error(`${label}五行数据缺失：${value}`);
  }
  return wuxing;
}

function resolveRootStatus(
  pillars: Array<{ gan: string; zhi: string }>,
  stem: string,
): '有本根' | '有同气根' | '未见同气根' {
  const stemElement = resolveWuxing(stem, '透干');
  let hasSameElement = false;

  for (const pillar of pillars) {
    const hiddenStems = HIDDEN_STEMS[pillar.zhi];
    if (!hiddenStems) {
      throw new Error(`藏干数据缺失：${pillar.zhi}`);
    }
    if (hiddenStems.includes(stem)) {
      return '有本根';
    }
    if (hiddenStems.some((hiddenStem) => resolveWuxing(hiddenStem, '藏干') === stemElement)) {
      hasSameElement = true;
    }
  }

  return hasSameElement ? '有同气根' : '未见同气根';
}

function resolveSeasonStatus(
  monthBranch: string,
  element: string,
): ExposedStemItem['seasonStatus'] {
  const status = SEASON_STATUS[monthBranch]?.[element];
  if (!status || !['旺', '相', '休', '囚', '死'].includes(status)) {
    throw new Error(`月令五行状态数据缺失：${monthBranch}/${element}`);
  }
  return status as ExposedStemItem['seasonStatus'];
}

export function analyzeStemRootProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
): StemRootProfile {
  assertPillarInputs(pillars);
  assertDayMasterMatchesPillars(pillars, dayMaster);
  assertWuxingResolver(getWuxing);
  assertTenGodResolver(dayMaster, getTenGod);

  const items: VisibleStemRootItem[] = [];

  pillars.forEach((p, idx) => {
    const visibleStem = p.gan;
    const rootStatus = resolveRootStatus(pillars, visibleStem);
    const status: VisibleStemRootItem['status'] = rootStatus === '未见同气根' ? '无根' : rootStatus;

    items.push({
      pillar: FOUR_PILLAR_NAMES[idx],
      stem: visibleStem,
      tenGod: getStandardTenGod(visibleStem, dayMaster),
      status,
      summary:
        status === '有本根'
          ? '四柱藏干见同一透干'
          : status === '有同气根'
            ? '四柱藏干未见同一透干，但见同五行天干'
            : '四柱藏干未见同一透干或同五行天干',
    });
  });

  const rootedCount = items.filter((i) => i.status !== '无根').length;
  return {
    items,
    rootedCount,
    summary: `天干通根：本根${items.filter((i) => i.status === '有本根').length}柱，同气根${items.filter((i) => i.status === '有同气根').length}柱，无根${items.filter((i) => i.status === '无根').length}柱。`,
  };
}

/**
 * 逐项登记透干的月令五行状态、月令藏干/司令关系与四支通根事实。
 *
 * commandStatus:
 *   - 司令透出：透干与月令司令同干
 *   - 月令藏干透出：透干为月支藏干之一
 *   - 月支主气同五行：透干与月支主气同五行
 *   - 未见月令同干同气：以上都不是
 */
export function analyzeExposedStemProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
  commanderStem: string | undefined,
  monthBranch: string,
): ExposedStemProfile;
export function analyzeExposedStemProfile(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
  getWuxing: (s: string) => string,
  getTenGod: (g: string, d: string) => string,
  commanderStem?: string,
  monthBranch?: string,
): ExposedStemProfile {
  assertPillarInputs(pillars);
  assertDayMasterMatchesPillars(pillars, dayMaster);
  assertWuxingResolver(getWuxing);
  assertTenGodResolver(dayMaster, getTenGod);
  if (commanderStem) assertHeavenlyStem(commanderStem, '司令天干');
  if (!monthBranch) throw new Error('月支缺失');
  assertEarthlyBranch(monthBranch, '月支');
  if (monthBranch !== pillars[1].zhi) {
    throw new Error(`传入月支与月柱地支不一致：月支${monthBranch}，月柱${pillars[1].zhi}`);
  }

  const monthStems = HIDDEN_STEMS[monthBranch];
  if (!monthStems) throw new Error(`月支藏干数据缺失：${monthBranch}`);
  if (commanderStem && !monthStems.includes(commanderStem)) {
    throw new Error(`司令天干不属于月支藏干：${monthBranch}/${commanderStem}`);
  }
  const monthPrincipalElement = resolveWuxing(monthStems[0], '月支主气');
  const items: ExposedStemItem[] = [];

  pillars.forEach((p, idx) => {
    const stemElement = resolveWuxing(p.gan, '透干');
    let commandStatus: ExposedStemItem['commandStatus'] = '未见月令同干同气';
    if (commanderStem && p.gan === commanderStem) {
      commandStatus = '司令透出';
    } else if (monthStems.includes(p.gan)) {
      commandStatus = '月令藏干透出';
    } else if (monthPrincipalElement === stemElement) {
      commandStatus = '月支主气同五行';
    }
    const seasonStatus = resolveSeasonStatus(monthBranch, stemElement);
    const rootStatus = resolveRootStatus(pillars, p.gan);

    items.push({
      pillar: FOUR_PILLAR_NAMES[idx],
      stem: p.gan,
      tenGod: getStandardTenGod(p.gan, dayMaster),
      seasonStatus,
      commandStatus,
      rootStatus,
      summary: `${p.gan}透于${FOUR_PILLAR_NAMES[idx]}；月令五行状态为${seasonStatus}；${commandStatus}；${rootStatus}`,
      sources: ['旺相休囚死月令固定表', '十二地支藏干固定表'],
      limitation:
        '这里只登记月令五行状态、司令或藏干透出关系及四支是否见同干同气，不合成为力量分数，也不判断格局、喜忌、吉凶或现实事件',
    });
  });

  return {
    items,
    summary: '透干月令、司令与通根事实',
    sources: ['旺相休囚死月令固定表', '十二地支藏干固定表'],
    limitation: '本结果是逐项结构事实，不表示各透干的综合力量、格局成败、喜忌、吉凶或现实事件',
  };
}
