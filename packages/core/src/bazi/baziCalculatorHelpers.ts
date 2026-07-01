import { HIDDEN_STEMS, NAYIN_MAP, TWELVE_STAGES_MAP } from './baziDefinitions';
export { calculateKongWang } from './kongWang';
import { getTenGod } from './baziUtils';
import type {
  HiddenStems,
  Nayin,
  PillarLifeStages,
  Pillars,
  ZiZuoResult,
} from './baziTypes';

export function calculatePillarLifeStages(pillars: Pillars): PillarLifeStages {
  const result = {} as PillarLifeStages;
  (Object.keys(pillars) as Array<keyof Pillars>).forEach((key) => {
    const pillar = pillars[key];
    const stageMapForGan = TWELVE_STAGES_MAP[pillar.gan] || {};
    result[key] = stageMapForGan[pillar.zhi] || '未知';
  });
  return result;
}

export function calculateTenGods(pillars: Pillars, dayMaster: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(pillars).map(([pillar, { gan }]) => {
      if (pillar === 'day') {
        return [pillar, '日主'];
      }
      return [pillar, getTenGod(gan, dayMaster)];
    }),
  );
}

export function calculateHiddenStems(pillars: Pillars): HiddenStems {
  const result = {} as HiddenStems;
  (Object.keys(pillars) as Array<keyof Pillars>).forEach((key) => {
    result[key] = HIDDEN_STEMS[pillars[key].zhi] || [];
  });
  return result;
}

export function calculateHiddenTenGods(
  hiddenStems: HiddenStems,
  dayMaster: string,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(hiddenStems).map(([pillar, stems]) => [
      pillar,
      stems.map((stem: string) => getTenGod(stem, dayMaster)),
    ]),
  );
}

export function calculateLifeStages(pillars: Pillars, dayMaster: string): Record<string, string> {
  const stageMap = TWELVE_STAGES_MAP[dayMaster] || {};
  return Object.fromEntries(
    Object.entries(pillars).map(([pillar, { zhi }]) => [pillar, stageMap[zhi] || '未知']),
  );
}

export function calculateNayin(pillars: Pillars): Nayin {
  const result = {} as Nayin;
  (Object.keys(pillars) as Array<keyof Pillars>).forEach((key) => {
    const pillar = pillars[key];
    result[key] = NAYIN_MAP[pillar.gan + pillar.zhi] || '未知';
  });
  return result;
}

/**
 * 计算自坐（十二长生在四柱的表现）
 * 与 calculatePillarLifeStages 逻辑相同，保留为兼容命名。
 * @deprecated 请使用 calculatePillarLifeStages
 */
export function calculateZiZuo(pillars: Pillars): ZiZuoResult {
  return calculatePillarLifeStages(pillars);
}
