import { BASIC_MAPPINGS, HIDDEN_STEMS } from './baziMappingsData';
import {
  assertGanZhiPair,
  assertHeavenlyStem,
  getTenGod as getStandardTenGod,
  getWuxing as getStandardWuxing,
} from './baziUtils';

export const FOUR_PILLAR_NAMES = ['year', 'month', 'day', 'hour'] as const;

export type TenGodFactPillar = {
  gan: string;
  zhi: string;
  hiddenStems: string[];
};

export function assertFourPillarInputs(pillars: Array<{ gan: string; zhi: string }>): void {
  if (pillars.length !== FOUR_PILLAR_NAMES.length) {
    throw new Error(`四柱数量无效：${pillars.length}`);
  }

  pillars.forEach((pillar, index) => {
    assertGanZhiPair(pillar.gan, pillar.zhi, `第${index + 1}柱`);
  });
}

export function assertDayMasterMatchesPillars(
  pillars: Array<{ gan: string; zhi: string }>,
  dayMaster: string,
): void {
  assertHeavenlyStem(dayMaster, '日主');
  const dayStem = pillars[2]?.gan;
  if (dayStem !== dayMaster) {
    throw new Error(`日主与日柱天干不一致：日主${dayMaster}，日柱${dayStem || '缺失'}`);
  }
}

export function assertTenGodResolver(
  dayMaster: string,
  getTenGod: (gan: string, dayMaster: string) => string,
): void {
  for (const stem of BASIC_MAPPINGS.HEAVENLY_STEMS) {
    const expected = getStandardTenGod(stem, dayMaster);
    const actual = getTenGod(stem, dayMaster);
    if (actual !== expected) {
      throw new Error(
        `十神函数与项目标准映射不一致：${dayMaster}/${stem}应为${expected}，实际为${actual || '空'}`,
      );
    }
  }
}

export function assertWuxingResolver(getWuxing: (value: string) => string): void {
  for (const value of [...BASIC_MAPPINGS.HEAVENLY_STEMS, ...BASIC_MAPPINGS.EARTHLY_BRANCHES]) {
    const expected = getStandardWuxing(value);
    const actual = getWuxing(value);
    if (actual !== expected) {
      throw new Error(
        `五行函数与项目标准映射不一致：${value}应为${expected}，实际为${actual || '空'}`,
      );
    }
  }
}

export function assertTenGodFactInputs(
  pillars: TenGodFactPillar[],
  dayMaster: string,
  getTenGod: (gan: string, dayMaster: string) => string,
): void {
  assertFourPillarInputs(pillars);
  assertDayMasterMatchesPillars(pillars, dayMaster);

  pillars.forEach((pillar, index) => {
    if (!Array.isArray(pillar.hiddenStems)) {
      throw new Error(`第${index + 1}柱藏干缺失`);
    }
    pillar.hiddenStems.forEach((stem) => assertHeavenlyStem(stem, `第${index + 1}柱藏干`));

    const expected = HIDDEN_STEMS[pillar.zhi];
    if (!expected) {
      throw new Error(`第${index + 1}柱藏干数据缺失：${pillar.zhi}`);
    }
    if (
      pillar.hiddenStems.length !== expected.length ||
      pillar.hiddenStems.some((stem, hiddenIndex) => stem !== expected[hiddenIndex])
    ) {
      throw new Error(
        `第${index + 1}柱藏干与地支${pillar.zhi}不一致：应为${expected.join('、')}，实际为${pillar.hiddenStems.join('、') || '空'}`,
      );
    }
  });

  assertTenGodResolver(dayMaster, getTenGod);
}
