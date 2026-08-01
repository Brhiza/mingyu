import test from 'node:test';
import assert from 'node:assert/strict';

import { ShenShaCalculator as CoreShenShaCalculator } from '../packages/core/src/bazi/baziShenSha';
import { calculateGlobalShenSha } from '../packages/core/src/bazi/baziShenSha/helpers/globalRules';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { EARTHLY_BRANCHES, NAYIN_MAP, SIXTY_CYCLE } from '@core/bazi/baziMappingsData';
import { calculateKongWangBranches } from '@core/bazi/kongWang';
import { ShenShaCalculator } from '@core/bazi/baziShenSha';
import type { ShenShaVariantConfig } from '@core/bazi/baziShenSha';
import { getShenShaCategory } from '@core/bazi/baziShenShaData';
import { getShenShaType } from '@core/bazi/baziUtils';

function createCalculators(options?: ConstructorParameters<typeof CoreShenShaCalculator>[0]) {
  return [new ShenShaCalculator(options), new CoreShenShaCalculator(options)];
}

test('切换神煞争议口径只能改变旁证，不得改写旺衰、格局、取用与核心证据', () => {
  const inputs = [
    {
      year: 1980,
      month: 1,
      day: 1,
      timeIndex: 0,
      gender: 'male' as const,
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
    },
    {
      year: 1980,
      month: 1,
      day: 1,
      timeIndex: 5,
      gender: 'male' as const,
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
    },
  ];
  const variantConfigs: Array<Partial<ShenShaVariantConfig>> = [];

  for (const kongWangBasis of ['day', 'day-and-year'] as const) {
    for (const yangRenMode of ['yang-stems-only', 'include-yin-ren'] as const) {
      variantConfigs.push({ kongWangBasis, yangRenMode });
    }
  }

  for (const input of inputs) {
    const baseline = baziCalculator.calculateBazi(input);

    for (const shenShaVariants of variantConfigs) {
      const result = baziCalculator.calculateBazi({ ...input, shenShaVariants });
      const label = `${JSON.stringify(input)} / ${JSON.stringify(shenShaVariants)}`;

      assert.deepEqual(result.analysis, baseline.analysis, label);
      assert.deepEqual(
        result.evidenceAnalysis?.analysisFacts,
        baseline.evidenceAnalysis?.analysisFacts,
        label,
      );
    }
  }

  const midnightBaseline = baziCalculator.calculateBazi(inputs[0]);
  const alternateKongWang = baziCalculator.calculateBazi({
    ...inputs[0],
    shenShaVariants: { kongWangBasis: 'day-and-year' },
  });
  const siHourBaseline = baziCalculator.calculateBazi(inputs[1]);
  const alternateYangRen = baziCalculator.calculateBazi({
    ...inputs[1],
    shenShaVariants: { yangRenMode: 'include-yin-ren' },
  });

  assert.notDeepEqual(alternateKongWang.shensha, midnightBaseline.shensha);
  assert.notDeepEqual(alternateYangRen.shensha, siHourBaseline.shensha);
});

test('神煞计算应先拒绝不完整四柱、非法干支和非法性别', () => {
  for (const calculator of createCalculators()) {
    assert.throws(
      () =>
        calculator.calculateAllShenSha(
          [
            ['甲', '子'],
            ['丙', '寅'],
            ['庚', '午'],
          ] as Parameters<typeof calculator.calculateAllShenSha>[0],
          'male',
        ),
      /完整四柱/,
    );
    assert.throws(
      () =>
        calculator.calculateAllShenSha(
          [
            ['甲', '子'],
            ['丙', '寅'],
            ['庚', '午'],
            ['丁', '猫'],
          ],
          'male',
        ),
      /第 4 柱地支无效/,
    );
    assert.throws(
      () =>
        calculator.calculateAllShenSha(
          [
            ['甲', '子'],
            ['丙', '寅'],
            ['庚', '午'],
            ['丁', '卯'],
          ],
          'unknown',
        ),
      /性别无效/,
    );
  }
});

test('天德、天德合、月德、月德合与月空应按原文月份、目标和日时柱位穷举', () => {
  const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [0, 2, 3];
  const tianDeTargets: Record<string, string> = {
    寅: '丁',
    辰: '壬',
    巳: '辛',
    午: '亥',
    未: '甲',
    申: '癸',
    戌: '丙',
    亥: '乙',
    子: '巳',
    丑: '庚',
  };
  const tianDeHeDayStems: Record<string, string> = {
    寅: '壬',
    辰: '丁',
    巳: '丙',
    未: '己',
    申: '戊',
    戌: '辛',
    亥: '庚',
    丑: '乙',
  };
  const yueDeStems: Record<string, string> = {
    寅: '丙',
    午: '丙',
    戌: '丙',
    亥: '甲',
    卯: '甲',
    未: '甲',
    申: '壬',
    子: '壬',
    辰: '壬',
    巳: '庚',
    酉: '庚',
    丑: '庚',
  };
  const yueDeHeStems: Record<string, string> = {
    寅: '辛',
    午: '辛',
    戌: '辛',
    亥: '己',
    卯: '己',
    未: '己',
    申: '丁',
    子: '丁',
    辰: '丁',
    巳: '乙',
    酉: '乙',
    丑: '乙',
  };
  const yueKongStems: Record<string, string> = {
    寅: '壬',
    午: '壬',
    戌: '壬',
    亥: '庚',
    卯: '庚',
    未: '庚',
    申: '丙',
    子: '丙',
    辰: '丙',
    巳: '甲',
    酉: '甲',
    丑: '甲',
  };

  for (const calculator of createCalculators()) {
    for (const monthBranch of monthBranches) {
      const monthPillar = SIXTY_CYCLE.find((item) => item.endsWith(monthBranch));
      assert.ok(monthPillar);

      for (const targetPillar of SIXTY_CYCLE) {
        for (const pillarIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            [monthPillar[0], monthPillar[1]],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[pillarIndex];
          const [targetStem, targetBranch] = targetPillar;

          assert.equal(
            result[pillarKey].includes('天德贵人'),
            pillarIndex >= 2 &&
              (tianDeTargets[monthBranch] === targetStem ||
                tianDeTargets[monthBranch] === targetBranch),
            `天德月份、目标或柱位错误：${monthBranch}月、${pillarKey}=${targetPillar}`,
          );
          assert.equal(
            result[pillarKey].includes('天德合'),
            pillarIndex === 2 && tianDeHeDayStems[monthBranch] === targetStem,
            `天德合月份、日干或柱位错误：${monthBranch}月、${pillarKey}=${targetPillar}`,
          );
          assert.equal(
            result[pillarKey].includes('月德贵人'),
            pillarIndex >= 2 && yueDeStems[monthBranch] === targetStem,
            `月德月份、目标干或柱位错误：${monthBranch}月、${pillarKey}=${targetPillar}`,
          );
          assert.equal(
            result[pillarKey].includes('月德合'),
            pillarIndex >= 2 && yueDeHeStems[monthBranch] === targetStem,
            `月德合月份、目标干或柱位错误：${monthBranch}月、${pillarKey}=${targetPillar}`,
          );
          assert.equal(
            result[pillarKey].includes('月空'),
            pillarIndex >= 2 && yueKongStems[monthBranch] === targetStem,
            `月空月份、目标干或柱位错误：${monthBranch}月、${pillarKey}=${targetPillar}`,
          );
          assert.ok(
            !result.month.some((name) =>
              ['天德贵人', '天德合', '月德贵人', '月德合', '月空'].includes(name),
            ),
          );
        }
      }
    }
  }
});

test('元辰对阳男阴女应取年支相冲之前一位，不应取后一位', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '巳'],
    ],
    'male',
  );

  assert.ok(result.hour.includes('元辰'));
  assert.ok(!result.month.includes('元辰'));
});

test('未取得可复核来源的童子煞应对旧口诀样例失败关闭', () => {
  const legacySamples = [
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '酉'],
    ],
    [
      ['甲', '申'],
      ['丙', '酉'],
      ['庚', '子'],
      ['丁', '丑'],
    ],
  ] as const;

  for (const calculator of createCalculators()) {
    for (const bazi of legacySamples) {
      const result = calculator.calculateAllShenSha(bazi, 'male');
      assert.ok(!Object.values(result).flat().includes('童子煞'));
    }
  }
});

test('红鸾与天喜应穷举十二年支、十二目标支和月日时，不得额外按日支推导', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const hongLuanByYearBranch: Record<string, string> = {
    子: '卯',
    丑: '寅',
    寅: '丑',
    卯: '子',
    辰: '亥',
    巳: '戌',
    午: '酉',
    未: '申',
    申: '未',
    酉: '午',
    戌: '巳',
    亥: '辰',
  };
  const tianXiByYearBranch: Record<string, string> = {
    子: '酉',
    丑: '申',
    寅: '未',
    卯: '午',
    辰: '巳',
    巳: '辰',
    午: '卯',
    未: '寅',
    申: '丑',
    酉: '子',
    戌: '亥',
    亥: '戌',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          assert.equal(
            pillarResult.includes('红鸾'),
            hongLuanByYearBranch[yearBranch] === targetBranch,
            `红鸾年支、目标支或柱位错误：${yearBranch}年、${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('天喜'),
            tianXiByYearBranch[yearBranch] === targetBranch,
            `天喜年支、目标支或柱位错误：${yearBranch}年、${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
          assert.ok(!result.year.some((name) => name === '红鸾' || name === '天喜'));
        }
      }
    }
  }
});

test('三命通会孤辰寡宿应穷举十二年支、十二目标支和月日时柱', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const guChenByYearBranch: Record<string, string> = {
    亥: '寅',
    子: '寅',
    丑: '寅',
    寅: '巳',
    卯: '巳',
    辰: '巳',
    巳: '申',
    午: '申',
    未: '申',
    申: '亥',
    酉: '亥',
    戌: '亥',
  };
  const guaSuByYearBranch: Record<string, string> = {
    亥: '戌',
    子: '戌',
    丑: '戌',
    寅: '丑',
    卯: '丑',
    辰: '丑',
    巳: '辰',
    午: '辰',
    未: '辰',
    申: '未',
    酉: '未',
    戌: '未',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          assert.equal(
            pillarResult.includes('孤辰'),
            guChenByYearBranch[yearBranch] === targetBranch,
            `孤辰年支、目标支或柱位错误：${yearBranch}年、${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('寡宿'),
            guaSuByYearBranch[yearBranch] === targetBranch,
            `寡宿年支、目标支或柱位错误：${yearBranch}年、${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
          assert.ok(!result.year.some((name) => name === '孤辰' || name === '寡宿'));
        }
      }
    }
  }
});

test('桃花、驿马、将星与华盖应采用命理探源日支口径，不得与年命异法混算', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [0, 1, 3];
  const rules: Array<{ name: string; map: Record<string, string> }> = [
    {
      name: '桃花',
      map: {
        寅: '卯',
        午: '卯',
        戌: '卯',
        亥: '子',
        卯: '子',
        未: '子',
        申: '酉',
        子: '酉',
        辰: '酉',
        巳: '午',
        酉: '午',
        丑: '午',
      },
    },
    {
      name: '驿马',
      map: {
        申: '寅',
        子: '寅',
        辰: '寅',
        寅: '申',
        午: '申',
        戌: '申',
        巳: '亥',
        酉: '亥',
        丑: '亥',
        亥: '巳',
        卯: '巳',
        未: '巳',
      },
    },
    {
      name: '将星',
      map: {
        申: '子',
        子: '子',
        辰: '子',
        亥: '卯',
        卯: '卯',
        未: '卯',
        寅: '午',
        午: '午',
        戌: '午',
        巳: '酉',
        酉: '酉',
        丑: '酉',
      },
    },
    {
      name: '华盖',
      map: {
        申: '辰',
        子: '辰',
        辰: '辰',
        亥: '未',
        卯: '未',
        未: '未',
        寅: '戌',
        午: '戌',
        戌: '戌',
        巳: '丑',
        酉: '丑',
        丑: '丑',
      },
    },
  ];

  for (const calculator of createCalculators()) {
    for (const dayBranch of branches) {
      const dayPillar = SIXTY_CYCLE.find((item) => item.endsWith(dayBranch));
      assert.ok(dayPillar);

      for (const targetPillarIndex of targetPillarIndexes) {
        for (const targetBranch of branches) {
          const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
          assert.ok(targetPillar);
          const bazi: [string, string][] = [
            ['甲', '子'],
            ['丙', '寅'],
            [dayPillar[0], dayPillar[1]],
            ['丁', '卯'],
          ];
          bazi[targetPillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
            const pillarKey = pillarKeys[pillarIndex];
            const pillarBranch = bazi[pillarIndex][1];

            for (const rule of rules) {
              assert.equal(
                result[pillarKey].includes(rule.name),
                rule.map[dayBranch] === pillarBranch,
                `${rule.name}不应混入年支起例：${dayBranch}日，${pillarKey}=${bazi[pillarIndex].join('')}`,
              );
            }
          }
        }
      }
    }
  }
});

test('勾绞煞应取年支前三辰后三辰，不应错算成四辰', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '卯'],
    ],
    'male',
  );

  assert.ok(result.hour.includes('勾绞煞'));
});

test('金神按经典口径取日柱或时柱，不应只取时柱', () => {
  const calculator1 = new ShenShaCalculator();
  const result1 = calculator1.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['乙', '丑'],
      ['丁', '卯'],
    ],
    'male',
  );
  assert.ok(result1.day.includes('金神'));

  const result2 = calculator1.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['乙', '丑'],
    ],
    'male',
  );
  assert.ok(result2.hour.includes('金神'));
});

test('德秀贵人在申子辰月应按三命通会取干表', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['辛', '酉'],
      ['戊', '申'],
      ['丙', '午'],
      ['辛', '卯'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['戊', '辰'],
      ['戊', '申'],
      ['乙', '卯'],
      ['癸', '亥'],
    ],
    'male',
  );

  assert.ok(hitResult.month.includes('德秀贵人'));
  assert.ok(hitResult.day.includes('德秀贵人'));
  assert.ok(!missResult.month.includes('德秀贵人'));
  assert.ok(!missResult.day.includes('德秀贵人'));
});

test('德秀贵人不得把原文德干的天干五合对象当作命中', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['辛', '寅'],
        ['戊', '辰'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(!Object.values(result).flat().includes('德秀贵人'));
  }
});

test('三奇贵人应穷举四柱天干顺序，并对互相矛盾的第三组失败关闭', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const supportedSequences = [
    ['甲', '戊', '庚'],
    ['乙', '丙', '丁'],
  ];
  const hasOrderedStems = (pillars: string[], sequence: string[]) => {
    let sequenceIndex = 0;
    for (const stem of pillars) {
      if (stem === sequence[sequenceIndex]) {
        sequenceIndex += 1;
      }
      if (sequenceIndex === sequence.length) {
        return true;
      }
    }
    return false;
  };
  const pillarByStem = Object.fromEntries(
    stems.map((stem) => {
      const pillar = SIXTY_CYCLE.find((item) => item.startsWith(stem));
      assert.ok(pillar);
      return [stem, [pillar[0], pillar[1]] as [string, string]];
    }),
  ) as Record<string, [string, string]>;

  for (const calculator of createCalculators()) {
    for (const yearStem of stems) {
      for (const monthStem of stems) {
        for (const dayStem of stems) {
          for (const hourStem of stems) {
            const pillarStems = [yearStem, monthStem, dayStem, hourStem];
            const result = calculator.calculateAllShenSha(
              pillarStems.map((stem) => [...pillarByStem[stem]]) as [string, string][],
              'male',
            );
            const shouldHit = supportedSequences.some((sequence) =>
              hasOrderedStems(pillarStems, sequence),
            );

            assert.equal(
              result.global?.includes('三奇贵人') ?? false,
              shouldHit,
              `三奇贵人顺序或异版边界错误：${pillarStems.join('、')}`,
            );
          }
        }
      }
    }
  }
});

test('亡神、劫煞与灾煞应只以日支起例并穷举十二支', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [0, 1, 3];
  const wangShenByDayBranch: Record<string, string> = {
    申: '亥',
    子: '亥',
    辰: '亥',
    亥: '寅',
    卯: '寅',
    未: '寅',
    寅: '巳',
    午: '巳',
    戌: '巳',
    巳: '申',
    酉: '申',
    丑: '申',
  };
  const jieShaByDayBranch: Record<string, string> = {
    申: '巳',
    子: '巳',
    辰: '巳',
    亥: '申',
    卯: '申',
    未: '申',
    寅: '亥',
    午: '亥',
    戌: '亥',
    巳: '寅',
    酉: '寅',
    丑: '寅',
  };
  const zaiShaByDayBranch: Record<string, string> = {
    申: '午',
    子: '午',
    辰: '午',
    亥: '酉',
    卯: '酉',
    未: '酉',
    寅: '子',
    午: '子',
    戌: '子',
    巳: '卯',
    酉: '卯',
    丑: '卯',
  };

  for (const calculator of createCalculators()) {
    for (const dayBranch of branches) {
      const dayPillar = SIXTY_CYCLE.find((item) => item.endsWith(dayBranch));
      assert.ok(dayPillar);

      for (const targetPillarIndex of targetPillarIndexes) {
        for (const targetBranch of branches) {
          const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
          assert.ok(targetPillar);
          const bazi: [string, string][] = [
            ['甲', '子'],
            ['丙', '寅'],
            [dayPillar[0], dayPillar[1]],
            ['丁', '卯'],
          ];
          bazi[targetPillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
            const pillarKey = pillarKeys[pillarIndex];
            const pillarBranch = bazi[pillarIndex][1];
            const label = `${dayBranch}日，${pillarKey}=${bazi[pillarIndex].join('')}`;

            assert.equal(
              result[pillarKey].includes('亡神'),
              wangShenByDayBranch[dayBranch] === pillarBranch,
              `亡神不应混入年支起例：${label}`,
            );
            assert.equal(
              result[pillarKey].includes('劫煞'),
              jieShaByDayBranch[dayBranch] === pillarBranch,
              `劫煞不应混入年支起例：${label}`,
            );
            assert.equal(
              result[pillarKey].includes('灾煞'),
              zaiShaByDayBranch[dayBranch] === pillarBranch,
              `灾煞不应混入年支起例：${label}`,
            );
          }
        }
      }
    }
  }
});

test('基准和成立条件不完整的血刃、流霞应穷举失败关闭', () => {
  const baseBazi: [string, string][] = [
    ['甲', '子'],
    ['丙', '寅'],
    ['戊', '辰'],
    ['庚', '午'],
  ];

  for (const calculator of createCalculators()) {
    for (const ganZhi of SIXTY_CYCLE) {
      for (let pillarIndex = 0; pillarIndex < baseBazi.length; pillarIndex += 1) {
        const bazi = baseBazi.map(([gan, zhi]) => [gan, zhi]) as [string, string][];
        bazi[pillarIndex] = [ganZhi[0], ganZhi[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');
        const names = Object.values(result).flat();

        assert.ok(!names.includes('血刃'), `血刃不应自动命中：${ganZhi}`);
        assert.ok(!names.includes('流霞'), `流霞不应自动命中：${ganZhi}`);
      }
    }
  }
});

test('披麻应取年支后三位，不应只退一位', () => {
  const calculator = new ShenShaCalculator();
  const result = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丙', '寅'],
      ['庚', '午'],
      ['丁', '酉'],
    ],
    'male',
  );

  assert.ok(result.hour.includes('披麻'));
  assert.ok(!result.month.includes('披麻'));
});

test('六厄应按五行精纪本命年支起例，不得再混入日支异法', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '卯'],
        ['乙', '亥'],
        ['壬', '午'],
      ],
      'male',
    );

    assert.ok(result.month.includes('六厄'));
    assert.ok(!result.hour.includes('六厄'));
    assert.ok(!result.year.includes('六厄'));
    assert.ok(!result.day.includes('六厄'));
  }
});

test('天杀应按五行精纪本命年支取劫杀前二辰', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '未'],
        ['庚', '寅'],
        ['辛', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '午'],
        ['庚', '寅'],
        ['辛', '子'],
      ],
      'male',
    );

    assert.ok(result.month.includes('天杀'));
    assert.ok(!result.hour.includes('天杀'));
    assert.ok(!missResult.month.includes('天杀'));
    assert.ok(!missResult.hour.includes('天杀'));
  }
});

test('五行精纪劫头杀与劫头鬼应按年干年支定例取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['己', '亥'],
        ['辛', '亥'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['己', '戌'],
        ['辛', '戌'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('劫头杀'));
    assert.ok(hitResult.day.includes('劫头鬼'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['劫头杀', '劫头鬼'].includes(name)),
    );
  }
});

test('地杀应按五行精纪本命年支取劫杀前五辰', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '戌'],
        ['庚', '寅'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '酉'],
        ['庚', '寅'],
        ['辛', '卯'],
      ],
      'male',
    );

    assert.ok(result.month.includes('地杀'));
    assert.ok(!result.hour.includes('地杀'));
    assert.ok(!missResult.month.includes('地杀'));
    assert.ok(!missResult.hour.includes('地杀'));
  }
});

test('天罗地网应穷举年命纳音与六十日柱，并只采用命理探源日柱口径', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      const yearNayinWuxing = NAYIN_MAP[yearPillar]?.slice(-1);
      assert.ok(yearNayinWuxing);

      for (const dayPillar of SIXTY_CYCLE) {
        const bazi: [string, string][] = [
          [yearPillar[0], yearPillar[1]],
          ['丙', '寅'],
          [dayPillar[0], dayPillar[1]],
          ['丁', '卯'],
        ];
        const result = calculator.calculateAllShenSha(bazi, 'male');
        const expectedTianLuo = yearNayinWuxing === '火' && ['戌', '亥'].includes(dayPillar[1]);
        const expectedDiWang =
          ['水', '土'].includes(yearNayinWuxing) && ['辰', '巳'].includes(dayPillar[1]);

        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const pillarKey = pillarKeys[pillarIndex];
          const label = `年柱${yearPillar}（${NAYIN_MAP[yearPillar]}），日柱${dayPillar}`;

          assert.equal(
            result[pillarKey].includes('天罗'),
            pillarIndex === 2 && expectedTianLuo,
            `天罗纳音、日支或柱位错误：${label}`,
          );
          assert.equal(
            result[pillarKey].includes('地网'),
            pillarIndex === 2 && expectedDiWang,
            `地网纳音、日支或柱位错误：${label}`,
          );
        }
      }
    }
  }
});

test('隔角应按日支顺行隔一字取时支，逆行与非时柱均不命中', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  for (const calculator of createCalculators()) {
    for (let dayIndex = 0; dayIndex < branches.length; dayIndex += 1) {
      for (let hourIndex = 0; hourIndex < branches.length; hourIndex += 1) {
        const dayPillar = SIXTY_CYCLE.find((item) => item.endsWith(branches[dayIndex]));
        const hourPillar = SIXTY_CYCLE.find((item) => item.endsWith(branches[hourIndex]));
        assert.ok(dayPillar && hourPillar);

        const result = calculator.calculateAllShenSha(
          [
            ['甲', '子'],
            ['丙', '寅'],
            [dayPillar[0], dayPillar[1]],
            [hourPillar[0], hourPillar[1]],
          ],
          'male',
        );
        const expected = (hourIndex - dayIndex + branches.length) % branches.length === 2;

        assert.equal(
          result.hour.includes('隔角'),
          expected,
          `隔角日时支错误：${branches[dayIndex]}日${branches[hourIndex]}时`,
        );
        assert.ok(!result.year.includes('隔角'));
        assert.ok(!result.month.includes('隔角'));
        assert.ok(!result.day.includes('隔角'));
      }
    }
  }
});

test('流年十二星耀不得以出生年支横取本命四柱，异表天医也应失败关闭', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const targetPillarIndexes = [1, 2, 3];
  const unsupportedNames = [
    '天医',
    '太岁',
    '剑锋',
    '伏尸',
    '太阳',
    '天空',
    '官符',
    '病符',
    '死符',
    '丧门',
    '地丧',
    '勾绞',
    '贯索',
    '吊客',
    '五鬼',
    '小耗',
    '栏杆',
    '大耗',
    '暴败',
    '天厄',
    '飞廉',
    '白虎',
    '卷舌',
    '福星',
    '天狗',
  ];

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (const targetIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[targetIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const resultNames = Object.values(result).flat();

          for (const name of unsupportedNames) {
            assert.ok(
              !resultNames.includes(name),
              `流年星耀不得进入本命四柱：${yearPillar}年、目标支${targetBranch}、${name}`,
            );
          }
        }
      }
    }
  }
});

test('金神大杀及同表名称应穷举十二年支、十二目标支和四柱，不得混称暗金杀', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [1, 2, 3];
  const targetByYearBranch: Record<string, string> = {
    子: '巳',
    午: '巳',
    卯: '巳',
    酉: '巳',
    寅: '酉',
    申: '酉',
    巳: '酉',
    亥: '酉',
    辰: '丑',
    戌: '丑',
    丑: '丑',
    未: '丑',
  };
  const specificNameByTarget: Record<string, string> = {
    巳: '吟呻煞',
    酉: '破碎煞',
    丑: '白衣煞',
  };
  const sharedNames = ['金神大杀', '太白星', '斧劈星'];
  const specificNames = ['吟呻煞', '破碎煞', '白衣煞'];

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (const targetIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[targetIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          for (let resultIndex = 0; resultIndex < pillarKeys.length; resultIndex += 1) {
            const resultBranch = bazi[resultIndex][1];
            const expectedHit = resultBranch === targetByYearBranch[yearBranch];
            const pillarResult = result[pillarKeys[resultIndex]];
            const label = `${yearBranch}年、${pillarKeys[resultIndex]}支${resultBranch}`;

            for (const name of sharedNames) {
              assert.equal(
                pillarResult.includes(name),
                expectedHit,
                `${name}年支或目标支错误：${label}`,
              );
            }
            for (const name of specificNames) {
              assert.equal(
                pillarResult.includes(name),
                expectedHit && specificNameByTarget[targetByYearBranch[yearBranch]] === name,
                `${name}年支、目标支或别名错误：${label}`,
              );
            }
          }
        }
      }
    }
  }
});

test('年命版亡神不得改名破军后与默认日支版亡神并列输出', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);
        const result = calculator.calculateAllShenSha(
          [
            [yearPillar[0], yearPillar[1]],
            [targetPillar[0], targetPillar[1]],
            ['戊', '辰'],
            ['庚', '午'],
          ],
          'male',
        );

        assert.ok(
          !Object.values(result).flat().includes('破军'),
          `${yearBranch}年见${targetBranch}不应命中破军`,
        );
      }
    }
  }
});

test('三公煞应穷举十二年支、六十目标柱和月日时完整干支', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarByYearBranch: Record<string, string> = {
    寅: '壬子',
    午: '壬子',
    戌: '壬子',
    巳: '丙午',
    酉: '丙午',
    丑: '丙午',
    申: '己卯',
    子: '己卯',
    辰: '己卯',
    亥: '辛酉',
    卯: '辛酉',
    未: '辛酉',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetPillar of SIXTY_CYCLE) {
        for (let targetIndex = 1; targetIndex < pillarKeys.length; targetIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['甲', '戌'],
          ];
          bazi[targetIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          for (let resultIndex = 0; resultIndex < pillarKeys.length; resultIndex += 1) {
            assert.equal(
              result[pillarKeys[resultIndex]].includes('三公煞'),
              resultIndex === targetIndex && targetPillarByYearBranch[yearBranch] === targetPillar,
              `三公煞年支、完整干支或柱位错误：${yearBranch}年、${pillarKeys[targetIndex]}柱${targetPillar}`,
            );
          }
        }
      }
    }
  }
});

test('截路空亡应只按日干取时支判断', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['甲', '子'],
        ['壬', '申'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['乙', '丑'],
        ['壬', '申'],
      ],
      'male',
    );

    assert.ok(result.hour.includes('截路空亡'));
    assert.ok(!result.month.includes('截路空亡'));
    assert.ok(!missResult.hour.includes('截路空亡'));
  }
});

test('三丘五墓应按月令四季取本支与对宫', () => {
  for (const calculator of createCalculators()) {
    const springResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['己', '未'],
      ],
      'male',
    );
    const summerResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['己', '巳'],
        ['庚', '辰'],
        ['辛', '戌'],
      ],
      'male',
    );
    const autumnResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['癸', '未'],
        ['乙', '丑'],
      ],
      'male',
    );
    const winterResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '亥'],
        ['丙', '戌'],
        ['丁', '辰'],
      ],
      'male',
    );

    assert.ok(springResult.day.includes('三丘'));
    assert.ok(springResult.hour.includes('五墓'));
    assert.ok(summerResult.day.includes('三丘'));
    assert.ok(autumnResult.day.includes('三丘'));
    assert.ok(winterResult.hour.includes('五墓'));
  }
});

test('三命通会天刑异版应穷举十二年支与十时干，并以版本名只标记时柱', () => {
  const hourStemByYearBranch: Record<string, string> = {
    子: '乙',
    丑: '乙',
    寅: '庚',
    卯: '辛',
    辰: '辛',
    巳: '壬',
    午: '癸',
    未: '癸',
    申: '丙',
    酉: '丁',
    戌: '丁',
    亥: '戊',
  };
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const name = '天刑（三命通会年命时干版）';

  for (const calculator of createCalculators()) {
    for (const yearBranch of EARTHLY_BRANCHES) {
      for (const hourStem of stems) {
        const result = calculator.calculateAllShenSha(
          [
            ['甲', yearBranch],
            [hourStem, '寅'],
            [hourStem, '辰'],
            [hourStem, '午'],
          ],
          'male',
        );
        const expected = hourStemByYearBranch[yearBranch] === hourStem;

        assert.equal(
          result.hour.includes(name),
          expected,
          `${yearBranch}年${hourStem}时的三命通会天刑命中错误`,
        );
        assert.ok(!result.year.includes(name));
        assert.ok(!result.month.includes(name));
        assert.ok(!result.day.includes(name));
        assert.ok(!Object.values(result).flat().includes('天刑'));
      }
    }
  }
});

test('五行精纪天刑天伤应穷举十二时支、十二目标支和年月至日柱，并以版本名成对输出', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const tianXingName = '天刑（五行精纪时支版）';
  const tianShangName = '天伤（五行精纪时支版）';

  for (const calculator of createCalculators()) {
    for (const hourBranch of EARTHLY_BRANCHES) {
      const hourIndex = EARTHLY_BRANCHES.indexOf(hourBranch);
      const tianXingBranch = EARTHLY_BRANCHES[(hourIndex + 1) % 12];
      const tianShangBranch = EARTHLY_BRANCHES[(hourIndex + 10) % 12];

      for (const targetBranch of EARTHLY_BRANCHES) {
        for (let targetIndex = 0; targetIndex < 3; targetIndex += 1) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', hourBranch],
          ];
          bazi[targetIndex] = [bazi[targetIndex][0], targetBranch];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          for (let resultIndex = 0; resultIndex < pillarKeys.length; resultIndex += 1) {
            const branch = bazi[resultIndex][1];
            assert.equal(
              result[pillarKeys[resultIndex]].includes(tianXingName),
              branch === tianXingBranch,
              `${hourBranch}时、${pillarKeys[targetIndex]}柱见${targetBranch}的五行精纪天刑错误`,
            );
            assert.equal(
              result[pillarKeys[resultIndex]].includes(tianShangName),
              branch === tianShangBranch,
              `${hourBranch}时、${pillarKeys[targetIndex]}柱见${targetBranch}的五行精纪天伤错误`,
            );
          }
          assert.ok(!Object.values(result).flat().includes('天伤'));
        }
      }
    }
  }
});

test('五行精纪鬼门关应按原文六组年支定例穷举，不得套用自缢煞十二支表', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['month', 'day', 'hour'] as const;
  const guiMenTargets: Record<string, string> = {
    子: '酉',
    丑: '午',
    寅: '未',
    申: '卯',
    亥: '辰',
    戌: '巳',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          const pillarIndex = targetIndex + 1;
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[targetIndex];

          assert.equal(
            result[pillarKey].includes('鬼门'),
            guiMenTargets[yearBranch] === targetBranch,
            `鬼门关年支、目标支或柱位错误：${yearBranch}年、${pillarKey}支${targetBranch}`,
          );
          assert.ok(!result.year.includes('鬼门'), `${yearPillar}年柱自身不应命中鬼门`);
        }
      }
    }
  }
});

test('冲天杀应按年支冲月支与日支冲时支判断', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '午'],
        ['庚', '寅'],
        ['辛', '申'],
      ],
      'male',
    );

    assert.ok(result.month.includes('冲天杀'));
    assert.ok(result.hour.includes('冲天杀'));
  }
});

test('攀鞍应取驿马后一辰，不应算到将星或驿马本位', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '申'],
        ['戊', '辰'],
        ['壬', '戌'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '申'],
        ['戊', '辰'],
        ['癸', '酉'],
      ],
      'male',
    );

    assert.ok(result.hour.includes('攀鞍'));
    assert.ok(!missResult.hour.includes('攀鞍'));
  }
});

test('五行精纪马天庭马九天马九地应按驿马前后定支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '子'],
        ['戊', '戌'],
        ['癸', '酉'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['丁', '丑'],
        ['甲', '亥'],
        ['戊', '巳'],
        ['癸', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('马天庭'));
    assert.ok(hitResult.day.includes('马九天'));
    assert.ok(hitResult.hour.includes('马九地'));
    assert.ok(
      !Object.values(missResult)
        .flat()
        .some((name) => ['马天庭', '马九天', '马九地'].includes(name)),
    );
  }
});

test('五行精纪年干禄类应穷举十年干、六十目标柱和月日时，不得混入日干', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targets: Record<string, Record<string, string[]>> = {
    生成禄: {
      甲: ['甲寅', '乙卯'],
      乙: ['甲寅', '乙卯'],
      丙: ['丁巳', '戊午'],
      丁: ['丁巳', '戊午'],
      戊: ['丁巳', '戊午'],
      己: ['丁巳', '戊午'],
      庚: ['庚申', '辛酉'],
      辛: ['庚申', '辛酉'],
      壬: ['癸亥', '壬子'],
      癸: ['癸亥', '壬子'],
    },
    名位禄: {
      甲: ['丙寅'],
      乙: ['丁卯'],
      丙: [],
      丁: [],
      戊: [],
      己: [],
      庚: ['壬申'],
      辛: ['癸酉'],
      壬: [],
      癸: [],
    },
    食神带禄: {
      甲: [],
      乙: [],
      丙: [],
      丁: [],
      戊: ['庚申'],
      己: ['辛酉'],
      庚: [],
      辛: [],
      壬: ['甲寅'],
      癸: ['乙卯'],
    },
    禄头财: {
      甲: ['戊寅'],
      乙: ['己卯'],
      丙: ['辛巳'],
      丁: ['庚午'],
      戊: ['癸巳'],
      己: ['壬午'],
      庚: ['甲申'],
      辛: ['乙酉'],
      壬: ['丁亥'],
      癸: ['丙子'],
    },
    禄头鬼: {
      甲: ['庚寅'],
      乙: ['辛卯'],
      丙: ['癸巳'],
      丁: ['壬午'],
      戊: ['乙巳'],
      己: ['甲午'],
      庚: ['丙申'],
      辛: ['丁酉'],
      壬: ['己亥'],
      癸: ['戊子'],
    },
    刃头财: {
      甲: ['己卯'],
      乙: ['戊辰'],
      丙: ['庚午'],
      丁: ['辛未'],
      戊: ['壬午'],
      己: ['癸亥'],
      庚: ['乙酉'],
      辛: ['甲戌'],
      壬: ['丙子'],
      癸: ['丁丑'],
    },
    刃头鬼: {
      甲: ['辛卯'],
      乙: ['庚辰'],
      丙: ['壬午'],
      丁: ['癸未'],
      戊: ['甲午'],
      己: ['乙未'],
      庚: ['丁酉'],
      辛: ['丙戌'],
      壬: ['戊子'],
      癸: ['己丑'],
    },
    库头财: {
      甲: ['己未'],
      乙: ['己未'],
      丙: ['庚戌'],
      丁: ['庚戌'],
      戊: ['壬辰'],
      己: ['壬辰'],
      庚: ['乙丑'],
      辛: ['乙丑'],
      壬: ['丙辰'],
      癸: ['丙辰'],
    },
    库头鬼: {
      甲: ['辛未'],
      乙: ['辛未'],
      丙: ['壬戌'],
      丁: ['壬戌'],
      戊: ['甲辰'],
      己: ['甲辰'],
      庚: ['丁丑'],
      辛: ['丁丑'],
      壬: ['戊辰'],
      癸: ['戊辰'],
    },
  };

  for (const calculator of createCalculators()) {
    for (const yearStem of stems) {
      for (const targetPillar of SIXTY_CYCLE) {
        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            [yearStem, '子'],
            ['丙', '寅'],
            ['庚', '辰'],
            ['壬', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          for (const [name, targetMap] of Object.entries(targets)) {
            assert.equal(
              pillarResult.includes(name),
              targetMap[yearStem].includes(targetPillar),
              `${name}年干、完整干支或柱位错误：${yearStem}年见${targetPillar}`,
            );
          }
        }
      }
    }

    for (const yearPillar of SIXTY_CYCLE) {
      const result = calculator.calculateAllShenSha(
        [
          [yearPillar[0], yearPillar[1]],
          ['丙', '寅'],
          ['庚', '辰'],
          ['壬', '午'],
        ],
        'male',
      );
      for (const name of Object.keys(targets)) {
        assert.ok(!result.year.includes(name), `${yearPillar}年柱自身不应命中${name}`);
      }
    }
  }
});

test('五行精纪年支马类应穷举六十年柱、六十目标柱和月日时，不得混入日支', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const foodGodByStem: Record<string, string> = {
    甲: '丙',
    乙: '丁',
    丙: '戊',
    丁: '己',
    戊: '庚',
    己: '辛',
    庚: '壬',
    辛: '癸',
    壬: '甲',
    癸: '乙',
  };
  const yiMaByBranch: Record<string, string> = {
    申: '寅',
    子: '寅',
    辰: '寅',
    亥: '巳',
    卯: '巳',
    未: '巳',
    寅: '申',
    午: '申',
    戌: '申',
    巳: '亥',
    酉: '亥',
    丑: '亥',
  };
  const generatedHorseByBranch: Record<string, string> = {
    寅: '庚申',
    午: '庚申',
    戌: '庚申',
    申: '甲寅',
    子: '甲寅',
    辰: '甲寅',
    巳: '癸亥',
    酉: '癸亥',
    丑: '癸亥',
    亥: '丁巳',
    卯: '丁巳',
    未: '丁巳',
  };
  const horseTreasuryByBranch: Record<string, string> = {
    寅: '辰',
    申: '未',
    巳: '丑',
    亥: '戌',
  };
  const shift = (branch: string, offset: number) => {
    const index = branches.indexOf(branch);
    return branches[(index + offset + branches.length) % branches.length];
  };

  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      const yearStem = yearPillar[0];
      const yearBranch = yearPillar[1];
      const horseBranch = yiMaByBranch[yearBranch];
      const mingWeiHorse = `${foodGodByStem[yearStem]}${horseBranch}`;

      for (const targetPillar of SIXTY_CYCLE) {
        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            [yearStem, yearBranch],
            ['丙', '寅'],
            ['庚', '辰'],
            ['壬', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];
          const targetBranch = targetPillar[1];

          assert.equal(
            pillarResult.includes('生成马'),
            generatedHorseByBranch[yearBranch] === targetPillar,
            `生成马年支或完整干支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('名位马'),
            SIXTY_CYCLE.includes(mingWeiHorse) && mingWeiHorse === targetPillar,
            `名位马年命或完整干支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('马财库'),
            horseTreasuryByBranch[horseBranch] === targetBranch,
            `马财库年支或目标支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('攀鞍'),
            shift(horseBranch, -1) === targetBranch,
            `攀鞍年支或目标支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('马天庭'),
            shift(horseBranch, 1) === targetBranch,
            `马天庭年支或目标支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('马九天'),
            shift(horseBranch, -1) === targetBranch,
            `马九天年支或目标支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('马九地'),
            shift(horseBranch, -2) === targetBranch,
            `马九地年支或目标支错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('命天庭'),
            shift(yearBranch, 1) === targetBranch,
            `命天庭年支或目标支错误：${yearPillar}年见${targetPillar}`,
          );
        }
      }

      const selfResult = calculator.calculateAllShenSha(
        [
          [yearStem, yearBranch],
          ['丙', '寅'],
          ['庚', '辰'],
          ['壬', '午'],
        ],
        'male',
      );
      for (const name of [
        '生成马',
        '名位马',
        '马财库',
        '攀鞍',
        '马天庭',
        '马九天',
        '马九地',
        '命天庭',
      ]) {
        assert.ok(!selfResult.year.includes(name), `${yearPillar}年柱自身不应命中${name}`);
      }
    }
  }
});

test('五行精纪年干禄支规则应穷举十年干、十二目标支和四柱，不得混入日干', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const luBranchByStem: Record<string, string> = {
    甲: '寅',
    乙: '卯',
    丙: '巳',
    丁: '午',
    戊: '巳',
    己: '午',
    庚: '申',
    辛: '酉',
    壬: '亥',
    癸: '子',
  };
  const gouChenByStem: Record<string, string[]> = {
    甲: ['巳', '亥'],
    乙: ['巳', '亥'],
    丙: ['戌', '辰'],
    丁: ['戌', '辰'],
    戊: ['寅', '申'],
    己: ['寅', '申'],
    庚: ['丑', '未'],
    辛: ['丑', '未'],
    壬: ['子', '午'],
    癸: ['子', '午'],
  };
  const zhenWuByStem: Record<string, string> = {
    甲: '未',
    乙: '未',
    丙: '午',
    丁: '午',
    戊: '辰',
    己: '辰',
    庚: '卯',
    辛: '卯',
    壬: '寅',
    癸: '寅',
  };
  const shift = (branch: string, offset: number) => {
    const index = branches.indexOf(branch);
    return branches[(index + offset + branches.length) % branches.length];
  };

  for (const calculator of createCalculators()) {
    for (const yearStem of stems) {
      for (const targetBranch of branches) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            [yearStem, '子'],
            ['丙', '寅'],
            ['庚', '辰'],
            ['壬', '午'],
          ];
          bazi[pillarIndex] = [pillarIndex === 0 ? yearStem : '乙', targetBranch];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];
          const isLaterPillar = pillarIndex >= 1;
          const luBranch = luBranchByStem[yearStem];

          assert.equal(
            pillarResult.includes('禄对神'),
            isLaterPillar && shift(luBranch, 6) === targetBranch,
            `禄对神年干、目标支或柱位错误：${yearStem}年见${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('勾陈'),
            isLaterPillar && gouChenByStem[yearStem].includes(targetBranch),
            `勾陈年干、目标支或柱位错误：${yearStem}年见${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('真武'),
            isLaterPillar && zhenWuByStem[yearStem] === targetBranch,
            `真武年干、目标支或柱位错误：${yearStem}年见${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('禄九天'),
            isLaterPillar && shift(luBranch, -1) === targetBranch,
            `禄九天年干、目标支或柱位错误：${yearStem}年见${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('禄九地'),
            isLaterPillar &&
              !['戊', '己'].includes(yearStem) &&
              shift(luBranch, -2) === targetBranch,
            `禄九地年干、目标支或柱位错误：${yearStem}年见${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('离祖杀'),
            pillarIndex === 3 && shift(luBranch, -1) === targetBranch,
            `离祖杀年干、目标支或柱位错误：${yearStem}年见${targetBranch}`,
          );
        }
      }
    }
  }
});

test('禄神应穷举十日干、六十目标柱和四柱，只采用日主临官归禄表', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const luBranchByDayStem: Record<string, string> = {
    甲: '寅',
    乙: '卯',
    丙: '巳',
    丁: '午',
    戊: '巳',
    己: '午',
    庚: '申',
    辛: '酉',
    壬: '亥',
    癸: '子',
  };

  for (const calculator of createCalculators()) {
    for (const dayStem of stems) {
      const validDayPillars = SIXTY_CYCLE.filter((item) => item.startsWith(dayStem));
      assert.equal(validDayPillars.length, 6);

      for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
        const targetPillars = pillarIndex === 2 ? validDayPillars : SIXTY_CYCLE;

        for (const targetPillar of targetPillars) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            ['丙', '寅'],
            [validDayPillars[0][0], validDayPillars[0][1]],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          assert.equal(
            result[pillarKeys[pillarIndex]].includes('禄神'),
            luBranchByDayStem[dayStem] === targetPillar[1],
            `禄神日干或目标支错误：${dayStem}日、${pillarKeys[pillarIndex]}=${targetPillar}`,
          );
        }
      }
    }
  }
});

test('天厨贵人对丙日应取巳，不应错判为子', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['戊', '子'],
      ['丁', '酉'],
      ['丙', '午'],
      ['己', '巳'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['戊', '子'],
      ['丁', '酉'],
      ['丙', '午'],
      ['己', '子'],
    ],
    'male',
  );

  assert.ok(hitResult.hour.includes('天厨贵人'));
  assert.ok(!missResult.hour.includes('天厨贵人'));
});

test('天厨贵人对己日应取酉，不应错判为未', () => {
  const calculator = new ShenShaCalculator();
  const hitResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['己', '午'],
      ['辛', '酉'],
    ],
    'male',
  );
  const missResult = calculator.calculateAllShenSha(
    [
      ['甲', '子'],
      ['丁', '酉'],
      ['己', '午'],
      ['辛', '未'],
    ],
    'male',
  );

  assert.ok(hitResult.hour.includes('天厨贵人'));
  assert.ok(!missResult.hour.includes('天厨贵人'));
});

test('天乙贵人应穷举十日干、十二目标支和四柱，且不得混入年干基准', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targets: Record<string, string[]> = {
    甲: ['丑', '未'],
    乙: ['子', '申'],
    丙: ['亥', '酉'],
    丁: ['亥', '酉'],
    戊: ['丑', '未'],
    己: ['子', '申'],
    庚: ['丑', '未'],
    辛: ['寅', '午'],
    壬: ['卯', '巳'],
    癸: ['卯', '巳'],
  };

  for (const calculator of createCalculators()) {
    for (const dayStem of stems) {
      for (const targetBranch of branches) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            ['戊', '子'],
            ['丙', '寅'],
            [dayStem, '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [pillarIndex === 2 ? dayStem : '辛', targetBranch];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          assert.equal(
            result[pillarKeys[pillarIndex]].includes('天乙贵人'),
            targets[dayStem].includes(targetBranch),
            `天乙贵人基准或目标支错误：${dayStem}日、${pillarKeys[pillarIndex]}柱${targetBranch}`,
          );
        }
      }
    }
  }
});

test('年命贵人旧法应穷举十年干、十二目标支和四柱，不得混入日干或年柱自身', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const rules: Record<string, Record<string, string[]>> = {
    太极贵人: {
      甲: ['子', '午'],
      乙: ['子', '午'],
      丙: ['卯', '酉'],
      丁: ['卯', '酉'],
      戊: ['辰', '戌', '丑', '未'],
      己: ['辰', '戌', '丑', '未'],
      庚: ['寅', '亥'],
      辛: ['寅', '亥'],
      壬: ['巳', '申'],
      癸: ['巳', '申'],
    },
    天官贵人: {
      甲: ['酉'],
      乙: ['申'],
      丙: ['子'],
      丁: ['亥'],
      戊: ['卯'],
      己: ['寅'],
      庚: ['午'],
      辛: ['巳'],
      壬: ['午'],
      癸: ['巳'],
    },
    文昌贵人: {
      甲: ['巳'],
      乙: ['亥'],
      丙: ['戌'],
      丁: ['辰'],
      戊: ['申'],
      己: ['午'],
      庚: ['寅'],
      辛: ['未'],
      壬: ['卯'],
      癸: ['丑'],
    },
    文星贵: {
      甲: ['午'],
      乙: ['巳'],
      丙: ['申'],
      丁: ['酉'],
      戊: ['申'],
      己: ['酉'],
      庚: ['戌'],
      辛: ['亥'],
      壬: ['寅'],
      癸: ['卯'],
    },
    天印贵人: {
      甲: [],
      乙: ['亥'],
      丙: ['戌'],
      丁: ['酉'],
      戊: ['申'],
      己: ['未'],
      庚: ['午'],
      辛: ['巳'],
      壬: ['辰'],
      癸: ['卯'],
    },
    官贵堂: {
      甲: ['未'],
      乙: ['辰'],
      丙: ['巳'],
      丁: ['寅'],
      戊: [],
      己: ['戌'],
      庚: ['亥'],
      辛: ['申'],
      壬: ['酉'],
      癸: ['午'],
    },
  };

  for (const calculator of createCalculators()) {
    for (const yearStem of stems) {
      for (const targetBranch of branches) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            [yearStem, '子'],
            ['丙', '寅'],
            ['庚', '辰'],
            ['壬', '午'],
          ];
          bazi[pillarIndex] = [pillarIndex === 0 ? yearStem : '乙', targetBranch];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          for (const [name, targetMap] of Object.entries(rules)) {
            assert.equal(
              result[pillarKeys[pillarIndex]].includes(name),
              pillarIndex >= 1 && targetMap[yearStem].includes(targetBranch),
              `${name}基准、目标支或柱位错误：${yearStem}年、${pillarKeys[pillarIndex]}柱${targetBranch}`,
            );
          }
        }
      }
    }
  }
});

test('神峰通考官贵学馆应穷举十日干、十二目标支和四柱，只采用日主版本', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targets: Record<string, string[]> = {
    甲: ['巳', '申'],
    乙: ['巳', '申'],
    丙: ['申', '亥'],
    丁: ['申', '亥'],
    戊: ['亥', '寅'],
    己: ['亥', '寅'],
    庚: ['寅', '巳'],
    辛: ['寅', '巳'],
    壬: ['申', '亥'],
    癸: ['申', '亥'],
  };

  for (const calculator of createCalculators()) {
    for (const dayStem of stems) {
      for (const targetBranch of branches) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            ['戊', '子'],
            ['丙', '寅'],
            [dayStem, '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [pillarIndex === 2 ? dayStem : '辛', targetBranch];
          const result = calculator.calculateAllShenSha(bazi, 'male');

          assert.equal(
            result[pillarKeys[pillarIndex]].includes('官贵学馆'),
            targets[dayStem].includes(targetBranch),
            `官贵学馆日主、目标支或柱位错误：${dayStem}日、${pillarKeys[pillarIndex]}柱${targetBranch}`,
          );
        }
      }
    }
  }
});

test('福星贵人与官星学堂应穷举年干、六十目标柱和月日时完整干支', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const fuXingTargets: Record<string, string[]> = {
    甲: ['甲寅', '甲子'],
    乙: ['乙丑'],
    丙: ['丙寅', '丙子'],
    丁: ['丁亥'],
    戊: ['戊申'],
    己: ['己未'],
    庚: ['庚午'],
    辛: ['辛巳'],
    壬: ['壬辰'],
    癸: ['癸丑'],
  };
  const officialScholarTargets: Record<string, string> = {
    甲: '辛亥',
    乙: '辛亥',
    丙: '壬寅',
    丁: '壬寅',
    戊: '甲申',
    己: '甲申',
    庚: '丁巳',
    辛: '丁巳',
    壬: '戊申',
    癸: '戊申',
  };

  for (const calculator of createCalculators()) {
    for (const yearStem of stems) {
      for (const targetPillar of SIXTY_CYCLE) {
        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            [yearStem, '子'],
            ['丙', '寅'],
            ['庚', '辰'],
            ['壬', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          assert.equal(
            pillarResult.includes('福星贵人'),
            fuXingTargets[yearStem].includes(targetPillar),
            `福星贵人完整干支错误：${yearStem}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('官星学堂'),
            officialScholarTargets[yearStem] === targetPillar,
            `官星学堂完整干支错误：${yearStem}年见${targetPillar}`,
          );
        }
      }
    }

    for (const yearPillar of SIXTY_CYCLE) {
      const result = calculator.calculateAllShenSha(
        [
          [yearPillar[0], yearPillar[1]],
          ['丙', '寅'],
          ['庚', '辰'],
          ['壬', '午'],
        ],
        'male',
      );
      assert.ok(!result.year.includes('福星贵人'), `${yearPillar}年柱自身不应命中福星贵人`);
      assert.ok(!result.year.includes('官星学堂'), `${yearPillar}年柱自身不应命中官星学堂`);
    }
  }
});

test('学堂与词馆应穷举六十年命、六十目标柱和月日时的纳音完整条件', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const scholarTargets: Record<string, string> = {
    金: '辛巳',
    木: '己亥',
    水: '甲申',
    火: '丙寅',
    土: '戊申',
  };
  const ciGuanTargets: Record<string, string> = {
    金: '壬申',
    木: '庚寅',
    水: '癸亥',
    火: '乙巳',
    土: '丁亥',
  };

  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      const yearNayinElement = NAYIN_MAP[yearPillar].slice(-1);

      for (const targetPillar of SIXTY_CYCLE) {
        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['庚', '辰'],
            ['壬', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          assert.equal(
            pillarResult.includes('学堂'),
            scholarTargets[yearNayinElement] === targetPillar,
            `学堂纳音、完整干支或柱位错误：${yearPillar}年见${targetPillar}`,
          );
          assert.equal(
            pillarResult.includes('词馆'),
            ciGuanTargets[yearNayinElement] === targetPillar,
            `词馆纳音、完整干支或柱位错误：${yearPillar}年见${targetPillar}`,
          );
        }
      }

      const selfResult = calculator.calculateAllShenSha(
        [
          [yearPillar[0], yearPillar[1]],
          ['丙', '寅'],
          ['庚', '辰'],
          ['壬', '午'],
        ],
        'male',
      );
      assert.ok(!selfResult.year.includes('学堂'), `${yearPillar}年柱自身不应命中学堂`);
      assert.ok(!selfResult.year.includes('词馆'), `${yearPillar}年柱自身不应命中词馆`);
    }
  }
});

test('依据或完整十干表不足的国印贵人与食神学堂应穷举六十甲子和四柱失败关闭', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const targetPillar of SIXTY_CYCLE) {
      for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
        const bazi = [
          ['甲', '子'],
          ['丙', '寅'],
          ['庚', '辰'],
          ['壬', '午'],
        ];
        bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');
        const allNames = Object.values(result).flat();

        assert.ok(!allNames.includes('国印贵人'), `${targetPillar}不得套用星命国印宫位表`);
        assert.ok(!allNames.includes('食神学堂'), `${targetPillar}不得套用残缺食神学堂表`);
      }
    }
  }
});

test('五行精纪天奇天宝应按十二生时、十二目标支与四柱位置穷举', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [0, 1, 2];
  const shift = (branch: string, offset: number) => {
    const index = branches.indexOf(branch);
    return branches[(index + offset + branches.length) % branches.length];
  };

  for (const calculator of createCalculators()) {
    for (const hourBranch of branches) {
      const hourPillar = SIXTY_CYCLE.find((item) => item.endsWith(hourBranch));
      assert.ok(hourPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (const pillarIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            ['丙', '寅'],
            ['戊', '辰'],
            [hourPillar[0], hourPillar[1]],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];
          const label = `${hourBranch}时、${pillarKeys[pillarIndex]}支${targetBranch}`;

          assert.equal(
            pillarResult.includes('天奇'),
            shift(hourBranch, 5) === targetBranch,
            `天奇生时基准、目标支或柱位错误：${label}`,
          );
          assert.equal(
            pillarResult.includes('天宝'),
            shift(hourBranch, -5) === targetBranch,
            `天宝生时基准、目标支或柱位错误：${label}`,
          );
          assert.ok(!result.hour.includes('天奇'), `${label}不应把生时自身回标为天奇`);
          assert.ok(!result.hour.includes('天宝'), `${label}不应把生时自身回标为天宝`);
        }
      }
    }
  }
});

test('科名贵应只取甲辰至癸丑一旬的日时干支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['乙', '巳'],
        ['丙', '午'],
        ['丁', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['乙', '巳'],
        ['丙', '申'],
        ['丁', '酉'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('科名贵'));
    assert.ok(!hitResult.month.includes('科名贵'));
    assert.ok(hitResult.day.includes('科名贵'));
    assert.ok(hitResult.hour.includes('科名贵'));
    assert.ok(!Object.values(missResult).flat().includes('科名贵'));
  }
});

test('五行精纪真魁星应只取日时四干支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['丁', '未'],
        ['庚', '戌'],
        ['癸', '丑'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['丁', '未'],
        ['辛', '亥'],
        ['壬', '子'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('真魁星'));
    assert.ok(!hitResult.month.includes('真魁星'));
    assert.ok(hitResult.day.includes('真魁星'));
    assert.ok(hitResult.hour.includes('真魁星'));
    assert.ok(!Object.values(missResult).flat().includes('真魁星'));
  }
});

test('五行精纪魁星与壶中子文星应只取日时固定干支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['丁', '巳'],
        ['辛', '卯'],
        ['丁', '亥'],
        ['乙', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '辰'],
        ['己', '未'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('文星'));
    assert.ok(!hitResult.month.includes('魁星'));
    assert.ok(hitResult.day.includes('魁星'));
    assert.ok(hitResult.hour.includes('文星'));
    assert.ok(!Object.values(missResult).flat().includes('魁星'));
    assert.ok(!Object.values(missResult).flat().includes('文星'));
  }
});

test('岁窠应只在年支与月支相同时标记月柱', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '子'],
        ['戊', '辰'],
        ['庚', '子'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '丑'],
        ['戊', '辰'],
        ['庚', '子'],
      ],
      'male',
    );

    assert.ok(!hitResult.year.includes('岁窠'));
    assert.ok(hitResult.month.includes('岁窠'));
    assert.ok(!hitResult.hour.includes('岁窠'));
    assert.ok(!Object.values(missResult).flat().includes('岁窠'));
  }
});

test('五行精纪名福应按年干所定生月取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['癸', '酉'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['壬', '申'],
        ['丙', '寅'],
        ['丁', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('名福'));
    assert.ok(!hitResult.year.includes('名福'));
    assert.ok(!Object.values(missResult).flat().includes('名福'));
  }
});

test('五行精纪命学堂与禄学堂应穷举十二年支、十二目标支和月日时柱', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const shift = (branch: string, offset: number) => {
    const index = branches.indexOf(branch);
    return branches[(index + offset + branches.length) % branches.length];
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (let pillarIndex = 1; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          assert.equal(
            pillarResult.includes('命学堂'),
            shift(yearBranch, -1) === targetBranch,
            `命学堂年支、目标支或柱位错误：${yearBranch}年、${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('禄学堂'),
            shift(yearBranch, -2) === targetBranch,
            `禄学堂年支、目标支或柱位错误：${yearBranch}年、${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
          assert.ok(!result.year.some((name) => name === '命学堂' || name === '禄学堂'));
        }
      }
    }
  }
});

test('未取得明确柱位依据的红艳煞应穷举失败关闭', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const dayPillar of SIXTY_CYCLE) {
      for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
        const targetBranches = pillarIndex === 2 ? [dayPillar[1]] : branches;

        for (const targetBranch of targetBranches) {
          const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
          assert.ok(targetPillar);
          const bazi: [string, string][] = [
            ['甲', '子'],
            ['丙', '寅'],
            [dayPillar[0], dayPillar[1]],
            ['丁', '卯'],
          ];
          if (pillarIndex !== 2) {
            bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          }
          const result = calculator.calculateAllShenSha(bazi, 'female');

          assert.ok(
            !Object.values(result).flat().includes('红艳煞'),
            `红艳煞不应自动命中：日柱${dayPillar}，${pillarKeys[pillarIndex]}支${targetBranch}`,
          );
        }
      }
    }
  }
});

test('阴阳煞应按男女、六十甲子与四柱位置穷举完整干支', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const expectedPillarByGender = { male: '丙子', female: '戊午' } as const;

  for (const calculator of createCalculators()) {
    for (const gender of ['male', 'female'] as const) {
      for (const targetPillar of SIXTY_CYCLE) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi: [string, string][] = [
            ['甲', '寅'],
            ['乙', '卯'],
            ['庚', '辰'],
            ['丁', '巳'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, gender);

          assert.equal(
            result[pillarKeys[pillarIndex]].includes('阴阳煞'),
            targetPillar === expectedPillarByGender[gender],
            `阴阳煞性别、完整干支或柱位错误：${gender}、${pillarKeys[pillarIndex]}柱${targetPillar}`,
          );
        }
      }
    }
  }
});

test('未取得可复核来源的十灵日和六秀日应对旧表样例失败关闭', () => {
  for (const calculator of createCalculators()) {
    const shiLingResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['庚', '寅'],
        ['戊', '辰'],
      ],
      'male',
    );
    const liuXiuResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丙', '午'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(!Object.values(shiLingResult).flat().includes('十灵日'));
    assert.ok(!Object.values(liuXiuResult).flat().includes('六秀日'));
  }
});

test('孤鸾只保留三命通会可复核的八个日柱', () => {
  for (const calculator of createCalculators()) {
    const calculate = (dayPillar: readonly [string, string]) =>
      calculator.calculateAllShenSha(
        [['甲', '子'], ['丙', '寅'], [...dayPillar], ['戊', '辰']],
        'male',
      );

    assert.ok(calculate(['壬', '子']).day.includes('孤鸾煞'));
    assert.ok(!calculate(['己', '未']).day.includes('孤鸾煞'));
    assert.ok(!calculate(['癸', '丑']).day.includes('孤鸾煞'));
  }
});

test('神煞名称不再自动分类吉凶或现实领域', () => {
  assert.equal(getShenShaType('天乙贵人'), '未分级');
  assert.equal(getShenShaType('十恶大败'), '未分级');
  assert.equal(getShenShaCategory('天乙贵人'), '传统神煞');
  assert.equal(getShenShaCategory('十恶大败'), '传统神煞');
  assert.equal(getShenShaCategory(''), '其他');

  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'male',
  });
  const categorized = baziCalculator.getCategorizedYearShenSha({ ganZhi: '丙午' }, chart);
  assert.ok(categorized.unclassified.length > 0);
  assert.deepEqual(Object.keys(categorized), ['unclassified']);
});

test('空亡默认只按日柱旬空判断，不应再把年柱旬空并入', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '戌'],
        ['庚', '辰'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(!result.month.includes('空亡'));
  }
});

test('孤虚默认应取日柱旬空对宫', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['辛', '酉'],
        ['丙', '辰'],
        ['甲', '子'],
        ['丁', '巳'],
      ],
      'male',
    );

    assert.ok(result.month.includes('孤虚'));
    assert.ok(result.hour.includes('孤虚'));
  }
});

test('羊刃默认只取阳干帝旺位，不把阴干帝旺位直接算作羊刃', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '巳'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(!result.month.includes('羊刃'));
  }
});

test('飞刃默认跟随阳干羊刃口径，不由阴干帝旺位推出', () => {
  for (const calculator of createCalculators()) {
    const result = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '申'],
        ['乙', '巳'],
        ['丁', '丑'],
      ],
      'male',
    );

    assert.ok(!result.month.includes('飞刃'));
  }
});

test('金舆与飞刃应穷举十日干、十二目标支和四柱，只采用日主版本', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const jinYuByDayStem: Record<string, string> = {
    甲: '辰',
    乙: '巳',
    丙: '未',
    丁: '申',
    戊: '未',
    己: '申',
    庚: '戌',
    辛: '亥',
    壬: '丑',
    癸: '寅',
  };
  const feiRenByDayStem: Record<string, string> = {
    甲: '酉',
    丙: '子',
    戊: '子',
    庚: '卯',
    壬: '午',
  };

  for (const calculator of createCalculators()) {
    for (const dayStem of stems) {
      for (const targetBranch of branches) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi = [
            ['戊', '子'],
            ['丙', '寅'],
            [dayStem, '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [pillarIndex === 2 ? dayStem : '辛', targetBranch];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarResult = result[pillarKeys[pillarIndex]];

          assert.equal(
            pillarResult.includes('金舆'),
            jinYuByDayStem[dayStem] === targetBranch,
            `金舆日干或目标支错误：${dayStem}日、${pillarKeys[pillarIndex]}柱${targetBranch}`,
          );
          assert.equal(
            pillarResult.includes('飞刃'),
            feiRenByDayStem[dayStem] === targetBranch,
            `飞刃日干、目标支或版本错误：${dayStem}日、${pillarKeys[pillarIndex]}柱${targetBranch}`,
          );
        }
      }
    }
  }
});

test('八专应取丁未日，不应误取丁巳日', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '未'],
        ['戊', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '巳'],
        ['戊', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('八专'));
    assert.ok(!missResult.day.includes('八专'));
  }
});

test('阴差阳错与八专应穷举六十甲子并严格限制原文柱位', () => {
  const yinYangMistakePillars = new Set([
    '丙子',
    '丁丑',
    '戊寅',
    '辛卯',
    '壬辰',
    '癸巳',
    '丙午',
    '丁未',
    '戊申',
    '辛酉',
    '壬戌',
    '癸亥',
  ]);
  const baZhuanPillars = new Set(['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑']);
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const baseBazi: [string, string][] = [
    ['甲', '辰'],
    ['乙', '巳'],
    ['庚', '午'],
    ['辛', '未'],
  ];

  for (const calculator of createCalculators()) {
    for (const ganZhi of SIXTY_CYCLE) {
      const [gan, zhi] = ganZhi;
      for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
        const bazi = baseBazi.map(([currentGan, currentZhi]) => [currentGan, currentZhi]) as [
          string,
          string,
        ][];
        bazi[pillarIndex] = [gan, zhi];
        const result = calculator.calculateAllShenSha(bazi, 'male');
        const pillarKey = pillarKeys[pillarIndex];

        assert.equal(
          result[pillarKey].includes('阴差阳错'),
          pillarIndex >= 1 && yinYangMistakePillars.has(ganZhi),
          `阴差阳错柱位或干支错误：${pillarKey}=${ganZhi}`,
        );
        assert.equal(
          result[pillarKey].includes('八专'),
          pillarIndex >= 2 && baZhuanPillars.has(ganZhi),
          `八专柱位或干支错误：${pillarKey}=${ganZhi}`,
        );
      }
    }
  }
});

test('版本数量与柱位均有冲突的九丑应穷举六十甲子和四柱失败关闭', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const baseBazi: [string, string][] = [
    ['甲', '子'],
    ['丙', '寅'],
    ['戊', '辰'],
    ['庚', '午'],
  ];

  for (const calculator of createCalculators()) {
    for (const ganZhi of SIXTY_CYCLE) {
      for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
        const bazi = baseBazi.map(([gan, zhi]) => [gan, zhi]) as [string, string][];
        bazi[pillarIndex] = [ganZhi[0], ganZhi[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');

        assert.ok(
          !Object.values(result).flat().includes('九丑'),
          `九丑不应自动命中：${pillarKeys[pillarIndex]}=${ganZhi}`,
        );
      }
    }
  }
});

test('四废日、天转与地转应穷举六十甲子、四季和四柱严格命中', () => {
  const seasonCases = [
    {
      season: '春',
      monthPillar: '丁卯',
      siFei: ['庚申', '辛酉'],
      tianZhuan: '乙卯',
      diZhuan: '辛卯',
    },
    {
      season: '夏',
      monthPillar: '乙巳',
      siFei: ['壬子', '癸亥'],
      tianZhuan: '丙午',
      diZhuan: '戊午',
    },
    {
      season: '秋',
      monthPillar: '丁酉',
      siFei: ['甲寅', '乙卯'],
      tianZhuan: '辛酉',
      diZhuan: '癸酉',
    },
    {
      season: '冬',
      monthPillar: '癸亥',
      siFei: ['丙午', '丁巳'],
      tianZhuan: '壬子',
      diZhuan: '丙子',
    },
  ];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const item of seasonCases) {
      for (const ganZhi of SIXTY_CYCLE) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            [item.monthPillar[0], item.monthPillar[1]],
            ['丙', '辰'],
            ['丁', '巳'],
          ];
          bazi[pillarIndex] = [ganZhi[0], ganZhi[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[pillarIndex];

          assert.equal(
            result[pillarKey].includes('四废日'),
            pillarIndex === 2 && item.siFei.includes(ganZhi),
            `${item.season}季四废日柱位或干支错误：${pillarKey}=${ganZhi}`,
          );
          assert.equal(
            result[pillarKey].includes('天转'),
            pillarIndex === 2 && item.tianZhuan === ganZhi,
            `${item.season}季天转柱位或干支错误：${pillarKey}=${ganZhi}`,
          );
          assert.equal(
            result[pillarKey].includes('地转'),
            pillarIndex === 2 && item.diZhuan === ganZhi,
            `${item.season}季地转柱位或干支错误：${pillarKey}=${ganZhi}`,
          );
        }
      }
    }
  }
});

test('天赦日与魁罡应穷举四季、六十甲子和四柱，只命中原文日柱', () => {
  const seasonCases = [
    { season: '春', monthPillar: '丁卯', tianSheDay: '戊寅' },
    { season: '夏', monthPillar: '乙巳', tianSheDay: '甲午' },
    { season: '秋', monthPillar: '丁酉', tianSheDay: '戊申' },
    { season: '冬', monthPillar: '癸亥', tianSheDay: '甲子' },
  ];
  const kuiGangDays = new Set(['庚辰', '壬辰', '戊戌', '庚戌']);
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const item of seasonCases) {
      for (const ganZhi of SIXTY_CYCLE) {
        for (let pillarIndex = 0; pillarIndex < pillarKeys.length; pillarIndex += 1) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            [item.monthPillar[0], item.monthPillar[1]],
            ['丙', '辰'],
            ['丁', '巳'],
          ];
          bazi[pillarIndex] = [ganZhi[0], ganZhi[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[pillarIndex];

          assert.equal(
            result[pillarKey].includes('天赦日'),
            pillarIndex === 2 && item.tianSheDay === ganZhi,
            `${item.season}季天赦日柱位或干支错误：${pillarKey}=${ganZhi}`,
          );
          assert.equal(
            result[pillarKey].includes('魁罡'),
            pillarIndex === 2 && kuiGangDays.has(ganZhi),
            `${item.season}季魁罡柱位或干支错误：${pillarKey}=${ganZhi}`,
          );
        }
      }
    }
  }
});

test('天屠煞按三命通会取日时配对，子日午时与午日子时不取', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['辛', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '子'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('天屠煞'));
    assert.ok(!missResult.hour.includes('天屠煞'));
  }
});

test('雷霆煞应按三命通会正七二八等月支口诀取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['辛', '卯'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['辛', '卯'],
      ],
      'male',
    );

    assert.ok(hitResult.year.includes('雷霆煞'));
    assert.ok(!missResult.year.includes('雷霆煞'));
  }
});

test('破煞应按三命通会只取子酉丑辰卯午未戌四组', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丁', '卯'],
        ['己', '酉'],
        ['庚', '午'],
      ],
      'male',
    );
    const excludedResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丁', '亥'],
        ['己', '丑'],
        ['庚', '申'],
      ],
      'male',
    );

    assert.ok(hitResult.year.includes('破煞'));
    assert.ok(hitResult.month.includes('破煞'));
    assert.ok(!excludedResult.year.includes('破煞'));
    assert.ok(!excludedResult.month.includes('破煞'));
  }
});

test('三命通会自缢煞应穷举十二年支、十二目标支和月日时柱', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['month', 'day', 'hour'] as const;
  const ziYiTargets: Record<string, string> = {
    子: '酉',
    酉: '子',
    丑: '午',
    午: '丑',
    寅: '未',
    未: '寅',
    卯: '申',
    申: '卯',
    辰: '亥',
    亥: '辰',
    巳: '戌',
    戌: '巳',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetBranch of branches) {
        const targetPillar = SIXTY_CYCLE.find((item) => item.endsWith(targetBranch));
        assert.ok(targetPillar);

        for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          const pillarIndex = targetIndex + 1;
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[targetIndex];

          assert.equal(
            result[pillarKey].includes('自缢煞'),
            ziYiTargets[yearBranch] === targetBranch,
            `自缢煞年支、目标支或柱位错误：${yearBranch}年、${pillarKey}支${targetBranch}`,
          );
          assert.ok(!result.year.includes('自缢煞'), `${yearPillar}年柱自身不应命中自缢煞`);
        }
      }
    }
  }
});

test('五行精纪官会财会青龙良会真亡应穷举六十年柱、六十目标柱和四柱位置', () => {
  const pillarKeys = ['month', 'day', 'hour'] as const;
  const guanHuiPillars: Record<string, string> = {
    甲: '辛丑',
    乙: '辛丑',
    丙: '壬辰',
    丁: '壬辰',
    戊: '乙未',
    己: '乙未',
    庚: '丙戌',
    辛: '丙戌',
    壬: '戊辰',
    癸: '戊辰',
  };
  const caiHuiPillars: Record<string, string> = {
    寅: '辛丑',
    午: '辛丑',
    戌: '辛丑',
    巳: '乙未',
    酉: '乙未',
    丑: '乙未',
    申: '丙戌',
    子: '丙戌',
    辰: '丙戌',
    亥: '戊辰',
    卯: '戊辰',
    未: '戊辰',
  };
  const qingLongPillars: Record<string, string> = {
    寅: '丙寅',
    午: '丙寅',
    戌: '丙寅',
    巳: '辛巳',
    酉: '辛巳',
    丑: '辛巳',
    申: '壬申',
    子: '壬申',
    辰: '壬申',
    亥: '乙亥',
    卯: '乙亥',
    未: '乙亥',
  };
  const liangHuiPillars: Record<string, string> = {
    寅: '丁卯',
    午: '丁卯',
    戌: '丁卯',
    巳: '庚辰',
    酉: '庚辰',
    丑: '庚辰',
    申: '癸酉',
    子: '癸酉',
    辰: '癸酉',
    亥: '甲子',
    卯: '甲子',
    未: '甲子',
  };
  const zhenWangPillars: Record<string, string[]> = {
    寅: ['癸巳', '癸亥'],
    午: ['癸巳', '癸亥'],
    戌: ['癸巳', '癸亥'],
    巳: ['丙申', '丙寅'],
    酉: ['丙申', '丙寅'],
    丑: ['丙申', '丙寅'],
    申: ['丁亥', '丁巳'],
    子: ['丁亥', '丁巳'],
    辰: ['丁亥', '丁巳'],
    亥: ['壬寅', '壬申'],
    卯: ['壬寅', '壬申'],
    未: ['壬寅', '壬申'],
  };

  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      const yearStem = yearPillar[0];
      const yearBranch = yearPillar[1];

      for (const targetPillar of SIXTY_CYCLE) {
        const result = calculator.calculateAllShenSha(
          [
            [yearStem, yearBranch],
            [targetPillar[0], targetPillar[1]],
            [targetPillar[0], targetPillar[1]],
            [targetPillar[0], targetPillar[1]],
          ],
          'male',
        );
        const expected: Record<string, boolean> = {
          官会杀: guanHuiPillars[yearStem] === targetPillar,
          财会杀: caiHuiPillars[yearBranch] === targetPillar,
          青龙杀: qingLongPillars[yearBranch] === targetPillar,
          良会杀: liangHuiPillars[yearBranch] === targetPillar,
          真亡杀: zhenWangPillars[yearBranch].includes(targetPillar),
        };

        for (const pillarKey of pillarKeys) {
          for (const [name, shouldHit] of Object.entries(expected)) {
            assert.equal(
              result[pillarKey].includes(name),
              shouldHit,
              `${name}基准或完整目标干支错误：${yearPillar}年、${pillarKey}柱${targetPillar}`,
            );
          }
        }
      }

      const yearResult = calculator.calculateAllShenSha(
        [
          [yearStem, yearBranch],
          ['丙', '寅'],
          ['戊', '辰'],
          ['庚', '午'],
        ],
        'male',
      );
      assert.equal(yearResult.year.includes('官会杀'), guanHuiPillars[yearStem] === yearPillar);
      assert.equal(yearResult.year.includes('财会杀'), caiHuiPillars[yearBranch] === yearPillar);
      assert.equal(yearResult.year.includes('青龙杀'), qingLongPillars[yearBranch] === yearPillar);
      assert.equal(yearResult.year.includes('良会杀'), liangHuiPillars[yearBranch] === yearPillar);
      assert.equal(
        yearResult.year.includes('真亡杀'),
        zhenWangPillars[yearBranch].includes(yearPillar),
      );
    }
  }
});

test('月煞应按三命通会月令三合组取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '丑'],
        ['庚', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '子'],
        ['庚', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('月煞'));
    assert.ok(!missResult.day.includes('月煞'));
  }
});

test('月厌应按月令逆行取地支', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '寅'],
        ['丙', '戌'],
        ['丁', '亥'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '寅'],
        ['丙', '酉'],
        ['丁', '亥'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('月厌'));
    assert.ok(!Object.values(missResult).flat().includes('月厌'));
  }
});

test('月令定位神煞应穷举十二月支、六十目标柱和四柱位置', () => {
  const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [0, 2, 3];
  const rules: Record<string, Record<string, string>> = {
    三丘: {
      寅: '丑',
      卯: '丑',
      辰: '丑',
      巳: '辰',
      午: '辰',
      未: '辰',
      申: '未',
      酉: '未',
      戌: '未',
      亥: '戌',
      子: '戌',
      丑: '戌',
    },
    五墓: {
      寅: '未',
      卯: '未',
      辰: '未',
      巳: '戌',
      午: '戌',
      未: '戌',
      申: '丑',
      酉: '丑',
      戌: '丑',
      亥: '辰',
      子: '辰',
      丑: '辰',
    },
    月煞: {
      寅: '丑',
      午: '丑',
      戌: '丑',
      亥: '戌',
      卯: '戌',
      未: '戌',
      申: '未',
      子: '未',
      辰: '未',
      巳: '辰',
      酉: '辰',
      丑: '辰',
    },
    月厌: {
      寅: '戌',
      卯: '酉',
      辰: '申',
      巳: '未',
      午: '午',
      未: '巳',
      申: '辰',
      酉: '卯',
      戌: '寅',
      亥: '丑',
      子: '子',
      丑: '亥',
    },
    天喜神: {
      寅: '戌',
      卯: '戌',
      辰: '戌',
      巳: '丑',
      午: '丑',
      未: '丑',
      申: '辰',
      酉: '辰',
      戌: '辰',
      亥: '未',
      子: '未',
      丑: '未',
    },
    天瞽杀: {
      寅: '申',
      卯: '未',
      辰: '午',
      巳: '巳',
      午: '辰',
      未: '卯',
      申: '寅',
      酉: '丑',
      戌: '子',
      亥: '亥',
      子: '戌',
      丑: '酉',
    },
    飞廉杀: {
      寅: '申',
      卯: '未',
      辰: '午',
      巳: '巳',
      午: '辰',
      未: '卯',
      申: '寅',
      酉: '丑',
      戌: '子',
      亥: '亥',
      子: '戌',
      丑: '酉',
    },
    雷霆煞: {
      寅: '子',
      申: '子',
      卯: '寅',
      酉: '寅',
      辰: '辰',
      戌: '辰',
      巳: '午',
      亥: '午',
      午: '申',
      子: '申',
      未: '戌',
      丑: '戌',
    },
  };

  for (const calculator of createCalculators()) {
    for (const monthBranch of monthBranches) {
      const monthPillar = SIXTY_CYCLE.find((item) => item.endsWith(monthBranch));
      assert.ok(monthPillar);
      const monthResult = calculator.calculateAllShenSha(
        [
          ['甲', '子'],
          [monthPillar[0], monthPillar[1]],
          ['戊', '辰'],
          ['庚', '午'],
        ],
        'male',
      );
      for (const [name, targets] of Object.entries(rules)) {
        assert.equal(
          monthResult.month.includes(name),
          targets[monthBranch] === monthBranch,
          `${name}月柱自身命中状态错误：${monthPillar}`,
        );
      }

      for (const targetPillar of SIXTY_CYCLE) {
        for (const pillarIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            [monthPillar[0], monthPillar[1]],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[pillarIndex];

          for (const [name, targets] of Object.entries(rules)) {
            assert.equal(
              result[pillarKey].includes(name),
              targets[monthBranch] === targetPillar[1],
              `${name}月令、目标支或柱位错误：${monthBranch}月、${pillarKey}柱${targetPillar}`,
            );
          }
        }
      }
    }
  }
});

test('头戴杀应按五行精纪只取生日生时', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '辰'],
        ['戊', '辰'],
        ['庚', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '辰'],
        ['戊', '丑'],
        ['庚', '未'],
      ],
      'male',
    );

    assert.ok(!hitResult.month.includes('头戴杀'));
    assert.ok(hitResult.day.includes('头戴杀'));
    assert.ok(hitResult.hour.includes('头戴杀'));
    assert.ok(!missResult.day.includes('头戴杀'));
    assert.ok(!missResult.hour.includes('头戴杀'));
  }
});

test('天火煞应穷举四柱地支，并取寅午戌全且四干不见壬癸', () => {
  const safeStems = ['甲', '戊', '庚', '辛'];

  for (const yearBranch of EARTHLY_BRANCHES) {
    for (const monthBranch of EARTHLY_BRANCHES) {
      for (const dayBranch of EARTHLY_BRANCHES) {
        for (const hourBranch of EARTHLY_BRANCHES) {
          const branches = [yearBranch, monthBranch, dayBranch, hourBranch];
          const expected = ['寅', '午', '戌'].every((branch) => branches.includes(branch));
          const safeResult = calculateGlobalShenSha(
            branches.map((branch, index) => [safeStems[index], branch]),
          );
          const label = branches.join('');

          assert.equal(safeResult.includes('天火煞'), expected, `${label}的寅午戌条件错误`);

          for (const waterStem of ['壬', '癸']) {
            for (let stemIndex = 0; stemIndex < 4; stemIndex += 1) {
              const stems = [...safeStems];
              stems[stemIndex] = waterStem;
              const waterResult = calculateGlobalShenSha(
                branches.map((branch, index) => [stems[index], branch]),
              );
              assert.ok(
                !waterResult.includes('天火煞'),
                `${label}第${stemIndex + 1}柱见${waterStem}时不得命中天火煞`,
              );
            }
          }
        }
      }
    }
  }

  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['戊', '午'],
        ['庚', '戌'],
        ['辛', '辰'],
      ],
      'male',
    );
    const waterResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['丙', '午'],
        ['壬', '戌'],
        ['庚', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.global?.includes('天火煞'));
    assert.ok(!waterResult.global?.includes('天火煞'));
  }
});

test('挂剑煞应穷举四柱地支，并兼容巳酉丑申纯全与巳酉丑重见', () => {
  for (const yearBranch of EARTHLY_BRANCHES) {
    for (const monthBranch of EARTHLY_BRANCHES) {
      for (const dayBranch of EARTHLY_BRANCHES) {
        for (const hourBranch of EARTHLY_BRANCHES) {
          const branches = [yearBranch, monthBranch, dayBranch, hourBranch];
          const hasFullSet = ['巳', '酉', '丑', '申'].every((branch) => branches.includes(branch));
          const hasRepeatedCore =
            ['巳', '酉', '丑'].every((branch) => branches.includes(branch)) &&
            branches.every((branch) => ['巳', '酉', '丑'].includes(branch));
          const result = calculateGlobalShenSha(
            branches.map((branch, index) => [SIXTY_CYCLE[index][0], branch]),
          );

          assert.equal(
            result.includes('挂剑煞'),
            hasFullSet || hasRepeatedCore,
            `${branches.join('')}的挂剑煞结构错误`,
          );
        }
      }
    }
  }

  for (const calculator of createCalculators()) {
    const fullSetResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丁', '酉'],
        ['己', '丑'],
        ['壬', '申'],
      ],
      'male',
    );
    const repeatedCoreResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丁', '酉'],
        ['己', '丑'],
        ['辛', '巳'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['丁', '酉'],
        ['己', '丑'],
        ['壬', '辰'],
      ],
      'male',
    );

    assert.ok(fullSetResult.global?.includes('挂剑煞'));
    assert.ok(repeatedCoreResult.global?.includes('挂剑煞'));
    assert.ok(!missResult.global?.includes('挂剑煞'));
  }
});

test('五行精纪杂犯字表不得用无出处的三字阈值生成全局神煞', () => {
  for (const calculator of createCalculators()) {
    const pingTouResult = calculator.calculateAllShenSha(
      [
        ['甲', '辰'],
        ['丙', '寅'],
        ['丁', '丑'],
        ['庚', '申'],
      ],
      'male',
    );
    const xuanZhenResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['辛', '卯'],
        ['乙', '午'],
        ['庚', '申'],
      ],
      'male',
    );
    const poZiResult = calculator.calculateAllShenSha(
      [
        ['甲', '申'],
        ['癸', '酉'],
        ['乙', '丑'],
        ['庚', '辰'],
      ],
      'male',
    );
    const zhangXingResult = calculator.calculateAllShenSha(
      [
        ['戊', '戌'],
        ['庚', '寅'],
        ['乙', '丑'],
        ['辛', '未'],
      ],
      'male',
    );
    const queZiResult = calculator.calculateAllShenSha(
      [
        ['乙', '巳'],
        ['己', '丑'],
        ['庚', '辰'],
        ['辛', '未'],
      ],
      'male',
    );
    const longYaResult = calculator.calculateAllShenSha(
      [
        ['丙', '寅'],
        ['壬', '酉'],
        ['乙', '丑'],
        ['庚', '辰'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['乙', '丑'],
        ['庚', '申'],
      ],
      'male',
    );

    const closedNames = ['平头杀', '悬针杀', '破字', '杖刑', '阙字', '聋哑字'];
    for (const result of [
      pingTouResult,
      xuanZhenResult,
      poZiResult,
      zhangXingResult,
      queZiResult,
      longYaResult,
      missResult,
    ]) {
      assert.ok(!result.global?.some((name) => closedNames.includes(name)));
    }
    assert.ok(queZiResult.global?.includes('曲脚杀'));
  }
});

test('戟锋煞应按五行精纪逐月旺干取日时两重', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const stemsByMonthBranch: Record<string, string[]> = {
    寅: ['甲'],
    卯: ['乙'],
    辰: ['戊', '甲'],
    巳: ['丙'],
    午: ['丁'],
    未: ['己'],
    申: ['庚'],
    酉: ['甲', '辛'],
    戌: ['戊', '甲'],
    亥: ['壬'],
    子: ['癸'],
    丑: ['己'],
  };

  for (const calculator of createCalculators()) {
    for (const monthBranch of EARTHLY_BRANCHES) {
      const allowedStems = stemsByMonthBranch[monthBranch];
      for (const dayStem of stems) {
        for (const hourStem of stems) {
          const result = calculator.calculateAllShenSha(
            [
              ['乙', '巳'],
              ['丙', monthBranch],
              [dayStem, '子'],
              [hourStem, '申'],
            ],
            'male',
          );
          const expected = allowedStems.includes(dayStem) && allowedStems.includes(hourStem);
          const label = `${monthBranch}月、${dayStem}日干、${hourStem}时干`;

          assert.equal(result.day.includes('戟锋煞'), expected, `${label}的日柱命中错误`);
          assert.equal(result.hour.includes('戟锋煞'), expected, `${label}的时柱命中错误`);
          assert.ok(!result.year.includes('戟锋煞'), `${label}不得回标年柱`);
          assert.ok(!result.month.includes('戟锋煞'), `${label}不得回标月柱`);
        }
      }
    }
  }
});

test('五行精纪年支定位凶杀应穷举十二年支、六十目标柱和四柱位置', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const targetPillarIndexes = [1, 2, 3];
  const shift = (branch: string, offset: number) => {
    const index = branches.indexOf(branch);
    return branches[(index + offset + branches.length) % branches.length];
  };
  const rules: Record<string, Record<string, string>> = {
    天杀: {
      申: '未',
      子: '未',
      辰: '未',
      亥: '辰',
      卯: '辰',
      未: '辰',
      寅: '丑',
      午: '丑',
      戌: '丑',
      巳: '戌',
      酉: '戌',
      丑: '戌',
    },
    地杀: {
      申: '戌',
      子: '戌',
      辰: '戌',
      亥: '未',
      卯: '未',
      未: '未',
      寅: '辰',
      午: '辰',
      戌: '辰',
      巳: '丑',
      酉: '丑',
      丑: '丑',
    },
    墓杀: {
      申: '辰',
      子: '辰',
      辰: '辰',
      亥: '未',
      卯: '未',
      未: '未',
      寅: '戌',
      午: '戌',
      戌: '戌',
      巳: '丑',
      酉: '丑',
      丑: '丑',
    },
    害气杀: {
      申: '亥',
      子: '亥',
      辰: '亥',
      亥: '寅',
      卯: '寅',
      未: '寅',
      寅: '巳',
      午: '巳',
      戌: '巳',
      巳: '申',
      酉: '申',
      丑: '申',
    },
    无成杀: {
      寅: '巳',
      午: '巳',
      戌: '巳',
      巳: '未',
      酉: '未',
      丑: '未',
      申: '卯',
      子: '卯',
      辰: '卯',
      亥: '子',
      卯: '子',
      未: '子',
    },
    暴败杀: {
      子: '未',
      丑: '午',
      寅: '巳',
      卯: '辰',
      辰: '卯',
      巳: '寅',
      午: '丑',
      未: '子',
      申: '亥',
      酉: '戌',
      戌: '酉',
      亥: '申',
    },
    天罡杀: Object.fromEntries(branches.map((branch) => [branch, shift(branch, 6)])),
    阴杀: {
      子: '午',
      午: '午',
      丑: '辰',
      未: '辰',
      寅: '寅',
      申: '寅',
      卯: '子',
      酉: '子',
      辰: '戌',
      戌: '戌',
      巳: '申',
      亥: '申',
    },
    阳杀: {
      寅: '戌',
      申: '戌',
      卯: '子',
      酉: '子',
      辰: '寅',
      戌: '寅',
      巳: '辰',
      亥: '辰',
      子: '午',
      午: '午',
      丑: '申',
      未: '申',
    },
    死气杀: Object.fromEntries(branches.map((branch) => [branch, shift(branch, 4)])),
    截命杀: Object.fromEntries(branches.map((branch) => [branch, shift(branch, 1)])),
    推命杀: Object.fromEntries(branches.map((branch) => [branch, shift(branch, -1)])),
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      const yearResult = calculator.calculateAllShenSha(
        [
          [yearPillar[0], yearPillar[1]],
          ['丙', '寅'],
          ['戊', '辰'],
          ['庚', '午'],
        ],
        'male',
      );
      for (const [name, targets] of Object.entries(rules)) {
        assert.equal(
          yearResult.year.includes(name),
          targets[yearBranch] === yearBranch,
          `${name}年柱自身命中状态错误：${yearPillar}`,
        );
      }

      for (const targetPillar of SIXTY_CYCLE) {
        for (const pillarIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[pillarIndex];

          for (const [name, targets] of Object.entries(rules)) {
            assert.equal(
              result[pillarKey].includes(name),
              targets[yearBranch] === targetPillar[1],
              `${name}年支、目标支或柱位错误：${yearBranch}年、${pillarKey}柱${targetPillar}`,
            );
          }
        }
      }
    }
  }
});

test('条件与柱位不完整的宅墓煞应穷举十二年支和十二目标支失败关闭', () => {
  for (const calculator of createCalculators()) {
    for (const yearBranch of EARTHLY_BRANCHES) {
      for (const targetBranch of EARTHLY_BRANCHES) {
        const result = calculator.calculateAllShenSha(
          [
            ['甲', yearBranch],
            ['乙', targetBranch],
            ['丙', targetBranch],
            ['丁', targetBranch],
          ],
          'male',
        );

        assert.ok(
          !Object.values(result).flat().includes('宅墓煞'),
          `${yearBranch}年见${targetBranch}不得以残缺条件输出宅墓煞`,
        );
      }
    }
  }
});

test('五行精纪年支凶杀应按原文固定地支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['壬', '戌'],
        ['甲', '亥'],
        ['乙', '卯'],
        ['丙', '申'],
      ],
      'male',
    );
    const pushResult = calculator.calculateAllShenSha(
      [
        ['壬', '戌'],
        ['甲', '酉'],
        ['乙', '午'],
        ['丙', '未'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['壬', '戌'],
        ['甲', '寅'],
        ['乙', '午'],
        ['丙', '未'],
      ],
      'male',
    );
    const fixedBranchResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '辰'],
        ['己', '未'],
        ['庚', '申'],
      ],
      'male',
    );
    const fixedBranchMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['戊', '巳'],
        ['己', '午'],
        ['庚', '申'],
      ],
      'male',
    );
    const xueGuangDayHourResult = calculator.calculateAllShenSha(
      [
        ['甲', '丑'],
        ['丙', '寅'],
        ['戊', '子'],
        ['壬', '戌'],
      ],
      'male',
    );
    const zhenGuiResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['壬', '辰'],
      ],
      'male',
    );

    assert.ok(hitResult.month.includes('截命杀'));
    assert.ok(hitResult.day.includes('破外杀'));
    assert.ok(hitResult.hour.includes('又血光杀'));
    assert.ok(xueGuangDayHourResult.hour.includes('血光杀'));
    assert.ok(zhenGuiResult.day.includes('真鬼刑疾'));
    assert.ok(zhenGuiResult.hour.includes('真鬼刑疾'));
    assert.ok(pushResult.month.includes('推命杀'));
    assert.ok(fixedBranchResult.month.includes('死气杀'));
    assert.ok(fixedBranchResult.day.includes('暴败杀'));
    assert.ok(
      !Object.values(fixedBranchMissResult)
        .flat()
        .some((name) => ['死气杀', '暴败杀'].includes(name)),
    );
    const missNames = Object.values(missResult).flat();
    assert.ok(
      !missNames.some((name) =>
        ['破外杀', '血光杀', '又血光杀', '截命杀', '推命杀'].includes(name),
      ),
    );
  }
});

test('建命杀应穷举六十年柱与六十目标柱，并只认同干支月柱', () => {
  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      for (const targetPillar of SIXTY_CYCLE) {
        const result = calculator.calculateAllShenSha(
          [
            [yearPillar[0], yearPillar[1]],
            [targetPillar[0], targetPillar[1]],
            [targetPillar[0], targetPillar[1]],
            [targetPillar[0], targetPillar[1]],
          ],
          'male',
        );
        const expected = targetPillar === yearPillar;
        const label = `${yearPillar}年见${targetPillar}`;

        assert.equal(result.month.includes('建命杀'), expected, `${label}的月柱命中错误`);
        assert.ok(!result.year.includes('建命杀'), `${label}不得回标年柱`);
        assert.ok(!result.day.includes('建命杀'), `${label}不得标记日柱`);
        assert.ok(!result.hour.includes('建命杀'), `${label}不得标记时柱`);
      }
    }
  }
});

test('妄语煞应穷举六十年命和十二目标支，并取日时官符落年命旬空', () => {
  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      const yearBranchIndex = EARTHLY_BRANCHES.indexOf(
        yearPillar[1] as (typeof EARTHLY_BRANCHES)[number],
      );
      const officerBranch = EARTHLY_BRANCHES[(yearBranchIndex + 4) % 12];
      const yearKongWang = calculateKongWangBranches(yearPillar[0], yearPillar[1]);

      for (const targetBranch of EARTHLY_BRANCHES) {
        const targetPillar = SIXTY_CYCLE.find((pillar) => pillar[1] === targetBranch)!;
        const result = calculator.calculateAllShenSha(
          [
            [yearPillar[0], yearPillar[1]],
            [targetPillar[0], targetPillar[1]],
            [targetPillar[0], targetPillar[1]],
            [targetPillar[0], targetPillar[1]],
          ],
          'male',
        );
        const expected = targetBranch === officerBranch && yearKongWang.includes(targetBranch);
        const label = `${yearPillar}年见${targetBranch}`;

        assert.ok(!result.year.includes('妄语煞'), `${label}不得回标年柱`);
        assert.ok(!result.month.includes('妄语煞'), `${label}不得标记月柱`);
        assert.equal(result.day.includes('妄语煞'), expected, `${label}的日柱命中错误`);
        assert.equal(result.hour.includes('妄语煞'), expected, `${label}的时柱命中错误`);
      }
    }
  }
});

test('五行精纪扶生日与旌德应穷举十二月、六十目标柱和四柱位置', () => {
  const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const targetPillarIndexes = [0, 2, 3];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const fuShengDayBranches: Record<string, string> = {
    寅: '酉',
    卯: '卯',
    辰: '戌',
    巳: '辰',
    午: '亥',
    未: '巳',
    申: '子',
    酉: '午',
    戌: '丑',
    亥: '未',
    子: '寅',
    丑: '申',
  };
  const jingDeStems: Record<string, string> = {
    寅: '丙',
    午: '丙',
    戌: '丙',
    巳: '庚',
    酉: '庚',
    丑: '庚',
    申: '壬',
    子: '壬',
    辰: '壬',
    亥: '甲',
    卯: '甲',
    未: '甲',
  };

  for (const calculator of createCalculators()) {
    for (const monthBranch of monthBranches) {
      const monthPillar = SIXTY_CYCLE.find((item) => item.endsWith(monthBranch));
      assert.ok(monthPillar);

      const monthResult = calculator.calculateAllShenSha(
        [
          ['甲', '子'],
          [monthPillar[0], monthPillar[1]],
          ['戊', '辰'],
          ['庚', '午'],
        ],
        'male',
      );
      assert.ok(!monthResult.month.includes('扶生日'));
      assert.ok(!monthResult.month.includes('旌德'));

      for (const targetPillar of SIXTY_CYCLE) {
        for (const pillarIndex of targetPillarIndexes) {
          const bazi: [string, string][] = [
            ['甲', '子'],
            [monthPillar[0], monthPillar[1]],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[pillarIndex];
          const label = `${monthBranch}月、${pillarKey}柱${targetPillar}`;

          assert.equal(
            result[pillarKey].includes('扶生日'),
            pillarIndex === 2 && fuShengDayBranches[monthBranch] === targetPillar[1],
            `扶生日月份、日支或柱位错误：${label}`,
          );
          assert.equal(
            result[pillarKey].includes('旌德'),
            pillarIndex >= 2 && jingDeStems[monthBranch] === targetPillar[0],
            `旌德月份、日时干或柱位错误：${label}`,
          );
        }
      }
    }
  }
});

test('五行精纪旌钺应穷举十二年支、六十目标柱并只取时支', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const targetBranches: Record<string, string> = {
    寅: '寅',
    午: '寅',
    戌: '寅',
    巳: '巳',
    酉: '巳',
    丑: '巳',
    申: '申',
    子: '申',
    辰: '申',
    亥: '亥',
    卯: '亥',
    未: '亥',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetPillar of SIXTY_CYCLE) {
        const result = calculator.calculateAllShenSha(
          [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            [targetPillar[0], targetPillar[1]],
          ],
          'male',
        );
        const label = `${yearBranch}年、时柱${targetPillar}`;

        assert.equal(
          result.hour.includes('旌钺'),
          targetBranches[yearBranch] === targetPillar[1],
          `旌钺年支或时支错误：${label}`,
        );
        assert.ok(!result.year.includes('旌钺'), `${label}不应回标年柱`);
        assert.ok(!result.month.includes('旌钺'), `${label}不应标记月柱`);
        assert.ok(!result.day.includes('旌钺'), `${label}不应标记日柱`);
      }
    }
  }
});

test('三命通会天喜神应按四季地支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['戊', '戌'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['丁', '卯'],
        ['己', '酉'],
      ],
      'male',
    );

    assert.ok(hitResult.hour.includes('天喜神'));
    assert.ok(!Object.values(missResult).flat().includes('天喜神'));
  }
});

test('五行精纪又旌德与又旌钺应按原文见字口径穷举年支、六十目标柱和月日时', () => {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const pillarKeys = ['month', 'day', 'hour'] as const;
  const jingDeStems: Record<string, string> = {
    寅: '辛',
    午: '辛',
    戌: '辛',
    巳: '乙',
    酉: '乙',
    丑: '乙',
    申: '丁',
    子: '丁',
    辰: '丁',
    亥: '己',
    卯: '己',
    未: '己',
  };
  const jingYuePillars: Record<string, string> = {
    寅: '癸酉',
    卯: '癸酉',
    辰: '癸酉',
    巳: '癸卯',
    午: '癸卯',
    未: '癸卯',
    申: '戊子',
    酉: '戊子',
    戌: '戊子',
    亥: '戊午',
    子: '戊午',
    丑: '戊午',
  };

  for (const calculator of createCalculators()) {
    for (const yearBranch of branches) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.endsWith(yearBranch));
      assert.ok(yearPillar);

      for (const targetPillar of SIXTY_CYCLE) {
        for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          const pillarIndex = targetIndex + 1;
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[targetIndex];
          const label = `${yearBranch}年、${pillarKey}柱${targetPillar}`;

          assert.equal(
            result[pillarKey].includes('又旌德'),
            jingDeStems[yearBranch] === targetPillar[0],
            `又旌德年支或目标干错误：${label}`,
          );
          assert.equal(
            result[pillarKey].includes('又旌钺'),
            jingYuePillars[yearBranch] === targetPillar,
            `又旌钺年支或完整目标干支错误：${label}`,
          );
        }
      }
    }
  }
});

test('点头杀应穷举六十年命、男女、六十目标柱，并同时满足日时柱与元辰', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const pointHeadPillars = ['戊寅', '戊申', '庚寅', '庚申', '辛巳', '辛亥'];

  for (const calculator of createCalculators()) {
    for (const yearPillar of SIXTY_CYCLE) {
      const yearStemIndex = stems.indexOf(yearPillar[0]);
      const yearBranchIndex = EARTHLY_BRANCHES.indexOf(
        yearPillar[1] as (typeof EARTHLY_BRANCHES)[number],
      );

      for (const gender of ['male', 'female'] as const) {
        const samePolarity =
          (yearStemIndex % 2 === 0 && gender === 'male') ||
          (yearStemIndex % 2 === 1 && gender === 'female');
        const yuanChenBranch = EARTHLY_BRANCHES[(yearBranchIndex + (samePolarity ? 5 : 7)) % 12];
        const nonYuanChenBranch = EARTHLY_BRANCHES.find((branch) => branch !== yuanChenBranch)!;

        for (const targetPillar of SIXTY_CYCLE) {
          const externalYuanChenResult = calculator.calculateAllShenSha(
            [
              [yearPillar[0], yearPillar[1]],
              ['乙', yuanChenBranch],
              [targetPillar[0], targetPillar[1]],
              [targetPillar[0], targetPillar[1]],
            ],
            gender,
          );
          const intrinsicYuanChenResult = calculator.calculateAllShenSha(
            [
              [yearPillar[0], yearPillar[1]],
              ['乙', nonYuanChenBranch],
              [targetPillar[0], targetPillar[1]],
              [targetPillar[0], targetPillar[1]],
            ],
            gender,
          );
          const isPointHeadPillar = pointHeadPillars.includes(targetPillar);
          const hasIntrinsicYuanChen = targetPillar[1] === yuanChenBranch;
          const label = `${yearPillar}${gender}见${targetPillar}`;

          for (const pillarKey of ['day', 'hour'] as const) {
            assert.equal(
              externalYuanChenResult[pillarKey].includes('点头杀'),
              isPointHeadPillar,
              `${label}外带元辰时${pillarKey}柱错误`,
            );
            assert.equal(
              intrinsicYuanChenResult[pillarKey].includes('点头杀'),
              isPointHeadPillar && hasIntrinsicYuanChen,
              `${label}仅目标柱可能兼带元辰时${pillarKey}柱错误`,
            );
          }
          assert.ok(!externalYuanChenResult.year.includes('点头杀'));
          assert.ok(!externalYuanChenResult.month.includes('点头杀'));
        }
      }
    }
  }
});

test('无形鬼应穷举六十目标柱及月日时重叠组合，并排除年柱参与重叠', () => {
  const ghostPillars = ['甲午', '丁酉', '己巳', '庚子', '辛亥', '壬申', '壬寅', '癸卯'];
  const pillarKeys = ['month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const targetPillar of SIXTY_CYCLE) {
      for (let mask = 0; mask < 8; mask += 1) {
        const laterPillars: [string, string][] = pillarKeys.map((_, index) =>
          mask & (1 << index) ? [targetPillar[0], targetPillar[1]] : ['乙', '丑'],
        );
        const result = calculator.calculateAllShenSha([['乙', '丑'], ...laterPillars], 'male');
        const repeatedCount = pillarKeys.filter((_, index) => mask & (1 << index)).length;
        const isGhostPillar = ghostPillars.includes(targetPillar);

        assert.ok(!result.year.includes('无形鬼'));
        for (let index = 0; index < pillarKeys.length; index += 1) {
          const expected = Boolean(mask & (1 << index)) && isGhostPillar && repeatedCount >= 2;
          assert.equal(
            result[pillarKeys[index]].includes('无形鬼'),
            expected,
            `${targetPillar}在月日时掩码${mask}的${pillarKeys[index]}柱错误`,
          );
        }
      }
    }

    for (const ghostPillar of ghostPillars) {
      for (let targetIndex = 1; targetIndex < 4; targetIndex += 1) {
        const bazi: [string, string][] = [
          [ghostPillar[0], ghostPillar[1]],
          ['乙', '丑'],
          ['乙', '丑'],
          ['乙', '丑'],
        ];
        bazi[targetIndex] = [ghostPillar[0], ghostPillar[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');
        assert.ok(
          !Object.values(result).flat().includes('无形鬼'),
          `${ghostPillar}只在年柱与后柱各见一次时不得构成无形鬼`,
        );
      }
    }
  }
});

test('五行精纪四项固定日时神煞应穷举六十甲子和四柱位置', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const expectedRules = {
    玄武受戮: { pillar: '壬辰', indexes: [2, 3] },
    青龙伏藏: { pillar: '癸巳', indexes: [2, 3] },
    玄武折足: { pillar: '丁未', indexes: [2, 3] },
    白虎丧目: { pillar: '辛卯', indexes: [3] },
  } as const;

  for (const calculator of createCalculators()) {
    for (const targetPillar of SIXTY_CYCLE) {
      for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
        const bazi: [string, string][] = [
          ['甲', '子'],
          ['丙', '寅'],
          ['戊', '辰'],
          ['庚', '午'],
        ];
        bazi[targetIndex] = [targetPillar[0], targetPillar[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');

        for (const [name, expected] of Object.entries(expectedRules)) {
          for (let resultIndex = 0; resultIndex < pillarKeys.length; resultIndex += 1) {
            assert.equal(
              result[pillarKeys[resultIndex]].includes(name),
              resultIndex === targetIndex &&
                expected.indexes.some((index) => index === targetIndex) &&
                targetPillar === expected.pillar,
              `${name}完整干支或柱位错误：${pillarKeys[targetIndex]}柱${targetPillar}`,
            );
          }
        }
      }
    }
  }
});

test('十恶大败应按十个完整日柱穷举六十甲子和四柱位置', () => {
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const badDayPillars = [
    '甲辰',
    '乙巳',
    '丙申',
    '丁亥',
    '戊戌',
    '己丑',
    '庚辰',
    '辛巳',
    '壬申',
    '癸亥',
  ];

  for (const calculator of createCalculators()) {
    for (const targetPillar of SIXTY_CYCLE) {
      for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
        const bazi: [string, string][] = [
          ['甲', '子'],
          ['丙', '寅'],
          ['戊', '辰'],
          ['庚', '午'],
        ];
        bazi[targetIndex] = [targetPillar[0], targetPillar[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');

        for (let resultIndex = 0; resultIndex < pillarKeys.length; resultIndex += 1) {
          assert.equal(
            result[pillarKeys[resultIndex]].includes('十恶大败'),
            resultIndex === 2 && targetIndex === 2 && badDayPillars.includes(targetPillar),
            `十恶大败完整干支或柱位错误：${pillarKeys[targetIndex]}柱${targetPillar}`,
          );
        }
      }
    }
  }
});

test('五行精纪离乡杀、天屠别名与颠倒杀应按原文字表取用', () => {
  for (const calculator of createCalculators()) {
    const liXiangResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '丑'],
        ['丙', '午'],
        ['丁', '卯'],
      ],
      'male',
    );
    const liXiangMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '寅'],
        ['乙', '丑'],
        ['丙', '巳'],
        ['丁', '卯'],
      ],
      'male',
    );
    const aliasResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['壬', '辰'],
        ['辛', '卯'],
      ],
      'male',
    );
    const aliasMoreResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['癸', '巳'],
        ['丁', '未'],
      ],
      'male',
    );
    const dianDaoResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['丙', '寅'],
        ['丁', '丑'],
      ],
      'male',
    );
    const dianDaoMissResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['乙', '丑'],
        ['丙', '寅'],
        ['丁', '寅'],
      ],
      'male',
    );

    assert.ok(liXiangResult.day.includes('离乡杀'));
    assert.ok(!liXiangMissResult.day.includes('离乡杀'));
    assert.ok(aliasResult.day.includes('玄武受戮'));
    assert.ok(aliasResult.hour.includes('白虎丧目'));
    assert.ok(aliasMoreResult.day.includes('青龙伏藏'));
    assert.ok(aliasMoreResult.hour.includes('玄武折足'));
    assert.ok(dianDaoResult.hour.includes('颠倒杀'));
    assert.ok(!dianDaoMissResult.hour.includes('颠倒杀'));
  }
});

test('五行精纪天瞽杀应按月令起申逆行十二支取用', () => {
  for (const calculator of createCalculators()) {
    const hitResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '申'],
        ['庚', '午'],
      ],
      'male',
    );
    const missResult = calculator.calculateAllShenSha(
      [
        ['甲', '子'],
        ['丙', '寅'],
        ['戊', '未'],
        ['庚', '午'],
      ],
      'male',
    );

    assert.ok(hitResult.day.includes('天瞽杀'));
    assert.ok(hitResult.day.includes('飞廉杀'));
    assert.ok(!Object.values(missResult).flat().includes('天瞽杀'));
    assert.ok(!Object.values(missResult).flat().includes('飞廉杀'));
  }
});

test('五行精纪五鬼空亡、又五鬼空亡与破祖空亡应穷举年干、六十目标柱和月日时', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const pillarKeys = ['month', 'day', 'hour'] as const;
  const originalTargets: Record<string, string[]> = {
    甲: ['午'],
    己: ['午'],
    乙: ['辰', '巳'],
    庚: ['辰', '巳'],
    丙: ['寅', '卯'],
    辛: ['寅', '卯'],
    丁: ['子', '丑'],
    壬: ['子', '丑'],
    戊: ['申', '酉'],
    癸: ['申', '酉'],
  };
  const alternativeTargets: Record<string, string[]> = {
    甲: ['巳', '午'],
    己: ['巳', '午'],
    乙: ['寅', '卯'],
    庚: ['寅', '卯'],
    丙: ['子', '丑'],
    辛: ['子', '丑'],
    丁: ['戌', '亥'],
    壬: ['戌', '亥'],
    戊: ['申', '酉'],
    癸: ['申', '酉'],
  };
  const poZuTargets: Record<string, string> = {
    甲: '午',
    乙: '午',
    丙: '申',
    丁: '申',
    戊: '戌',
    己: '戌',
    庚: '子',
    辛: '子',
    壬: '寅',
    癸: '寅',
  };

  for (const calculator of createCalculators()) {
    for (const yearStem of stems) {
      const yearPillar = SIXTY_CYCLE.find((item) => item.startsWith(yearStem));
      assert.ok(yearPillar);

      for (const targetPillar of SIXTY_CYCLE) {
        for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
          const bazi: [string, string][] = [
            [yearPillar[0], yearPillar[1]],
            ['丙', '寅'],
            ['戊', '辰'],
            ['庚', '午'],
          ];
          const pillarIndex = targetIndex + 1;
          bazi[pillarIndex] = [targetPillar[0], targetPillar[1]];
          const result = calculator.calculateAllShenSha(bazi, 'male');
          const pillarKey = pillarKeys[targetIndex];
          const targetBranch = targetPillar[1];

          assert.equal(
            result[pillarKey].includes('五鬼空亡'),
            originalTargets[yearStem].includes(targetBranch),
            `五鬼空亡年干、目标支或柱位错误：${yearStem}年、${pillarKey}支${targetBranch}`,
          );
          assert.equal(
            result[pillarKey].includes('又五鬼空亡'),
            alternativeTargets[yearStem].includes(targetBranch),
            `又五鬼空亡年干、目标支或柱位错误：${yearStem}年、${pillarKey}支${targetBranch}`,
          );
          assert.equal(
            result[pillarKey].includes('破祖空亡'),
            poZuTargets[yearStem] === targetBranch,
            `破祖空亡年干、目标支或柱位错误：${yearStem}年、${pillarKey}柱${targetPillar}`,
          );
          assert.ok(!result.year.includes('五鬼空亡'));
          assert.ok(!result.year.includes('又五鬼空亡'));
          assert.ok(!result.year.includes('破祖空亡'));
        }
      }
    }
  }
});

test('五行精纪鸱枭杀应按月支与日时支递进取用', () => {
  for (const calculator of createCalculators()) {
    for (const yearBranch of EARTHLY_BRANCHES) {
      const yearIndex = EARTHLY_BRANCHES.indexOf(yearBranch);
      const expectedMonthBranch = EARTHLY_BRANCHES[(yearIndex + 2) % 12];
      for (const monthBranch of EARTHLY_BRANCHES) {
        const monthIndex = EARTHLY_BRANCHES.indexOf(monthBranch);
        const expectedTargetBranch = EARTHLY_BRANCHES[(monthIndex + 3) % 12];
        for (const targetBranch of EARTHLY_BRANCHES) {
          const result = calculator.calculateAllShenSha(
            [
              ['壬', yearBranch],
              ['甲', monthBranch],
              ['丙', targetBranch],
              ['戊', targetBranch],
            ],
            'male',
          );
          const expected =
            monthBranch === expectedMonthBranch && targetBranch === expectedTargetBranch;
          const label = `${yearBranch}年、${monthBranch}月见${targetBranch}`;

          assert.equal(result.day.includes('鸱枭杀'), expected, `${label}的日柱错误`);
          assert.equal(result.hour.includes('鸱枭杀'), expected, `${label}的时柱错误`);
          assert.ok(!result.year.includes('鸱枭杀'), `${label}不得标记年柱`);
          assert.ok(!result.month.includes('鸱枭杀'), `${label}不得标记月柱`);
        }
      }
    }
  }
});

test('五行精纪自刃应穷举六十甲子与四柱位置，不混入三命通会异表', () => {
  const selfBladePillars = ['丙午', '丁未', '戊午', '己未', '壬子', '癸丑'];
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;

  for (const calculator of createCalculators()) {
    for (const targetPillar of SIXTY_CYCLE) {
      for (let targetIndex = 0; targetIndex < pillarKeys.length; targetIndex += 1) {
        const bazi: [string, string][] = [
          ['甲', '子'],
          ['乙', '卯'],
          ['庚', '辰'],
          ['辛', '巳'],
        ];
        bazi[targetIndex] = [targetPillar[0], targetPillar[1]];
        const result = calculator.calculateAllShenSha(bazi, 'male');

        for (let resultIndex = 0; resultIndex < pillarKeys.length; resultIndex += 1) {
          assert.equal(
            result[pillarKeys[resultIndex]].includes('自刃'),
            resultIndex === targetIndex &&
              targetIndex >= 2 &&
              selfBladePillars.includes(targetPillar),
            `自刃完整干支或柱位错误：${pillarKeys[targetIndex]}柱${targetPillar}`,
          );
        }
      }
    }
  }
});

test('五行真日时应穷举六十日柱与六十时柱，并只标记完整时柱配对', () => {
  const hourByDayPillar: Record<string, string> = {
    乙酉: '庚辰',
    丁巳: '丙午',
    癸亥: '壬子',
    己丑: '戊辰',
    甲寅: '丁卯',
  };

  for (const calculator of createCalculators()) {
    for (const dayPillar of SIXTY_CYCLE) {
      for (const hourPillar of SIXTY_CYCLE) {
        const result = calculator.calculateAllShenSha(
          [
            ['甲', '子'],
            ['乙', '卯'],
            [dayPillar[0], dayPillar[1]],
            [hourPillar[0], hourPillar[1]],
          ],
          'male',
        );
        const expected = hourByDayPillar[dayPillar] === hourPillar;

        assert.equal(
          result.hour.includes('五行真日时'),
          expected,
          `${dayPillar}日${hourPillar}时配对错误`,
        );
        assert.ok(!result.year.includes('五行真日时'));
        assert.ok(!result.month.includes('五行真日时'));
        assert.ok(!result.day.includes('五行真日时'));
      }
    }
  }
});

test('离祖杀应穷举十年干与十二目标支，并只取本命禄后一辰时支', () => {
  const luBranchByYearStem: Record<string, string> = {
    甲: '寅',
    乙: '卯',
    丙: '巳',
    丁: '午',
    戊: '巳',
    己: '午',
    庚: '申',
    辛: '酉',
    壬: '亥',
    癸: '子',
  };

  for (const calculator of createCalculators()) {
    for (const [yearStem, luBranch] of Object.entries(luBranchByYearStem)) {
      const luIndex = EARTHLY_BRANCHES.indexOf(luBranch as (typeof EARTHLY_BRANCHES)[number]);
      const expectedHourBranch = EARTHLY_BRANCHES[(luIndex + 11) % 12];
      for (const targetBranch of EARTHLY_BRANCHES) {
        const result = calculator.calculateAllShenSha(
          [
            [yearStem, '子'],
            ['乙', targetBranch],
            ['丙', targetBranch],
            ['丁', targetBranch],
          ],
          'male',
        );
        const expected = targetBranch === expectedHourBranch;

        assert.equal(
          result.hour.includes('离祖杀'),
          expected,
          `${yearStem}年禄在${luBranch}、${targetBranch}时命中错误`,
        );
        assert.ok(!result.year.includes('离祖杀'));
        assert.ok(!result.month.includes('离祖杀'));
        assert.ok(!result.day.includes('离祖杀'));
      }
    }
  }
});

test('五行精纪狡害杀应按申亥巳寅日时互见取用', () => {
  const pairs = new Set(['申亥', '亥申', '巳寅', '寅巳']);

  for (const calculator of createCalculators()) {
    for (const dayBranch of EARTHLY_BRANCHES) {
      for (const hourBranch of EARTHLY_BRANCHES) {
        const result = calculator.calculateAllShenSha(
          [
            ['甲', '子'],
            ['乙', '卯'],
            ['丙', dayBranch],
            ['丁', hourBranch],
          ],
          'male',
        );
        const expected = pairs.has(`${dayBranch}${hourBranch}`);
        const label = `${dayBranch}日${hourBranch}时`;

        assert.equal(result.day.includes('狡害杀'), expected, `${label}的日柱错误`);
        assert.equal(result.hour.includes('狡害杀'), expected, `${label}的时柱错误`);
        assert.ok(!result.year.includes('狡害杀'), `${label}不得标记年柱`);
        assert.ok(!result.month.includes('狡害杀'), `${label}不得标记月柱`);
      }
    }
  }
});
