import { SixtyCycle } from 'tyme4ts';
import { assertGanZhiPair, assertPillars } from './baziUtils';
import type { KongWangResult, Pillars } from './baziTypes';

type NamedTymeValue = { getName(): string };

export function calculateKongWangBranches(gan: string, zhi: string): string[] {
  assertGanZhiPair(gan, zhi, '空亡干支');
  return SixtyCycle.fromName(`${gan}${zhi}`)
    .getExtraEarthBranches()
    .map((branch: NamedTymeValue) => branch.getName());
}

export function calculateKongWang(pillars: Pillars): KongWangResult {
  assertPillars(pillars);
  const result = {} as KongWangResult;

  (Object.keys(pillars) as Array<keyof Pillars>).forEach((key) => {
    const pillar = pillars[key];
    result[key] = calculateKongWangBranches(pillar.gan, pillar.zhi);
  });

  return result;
}
