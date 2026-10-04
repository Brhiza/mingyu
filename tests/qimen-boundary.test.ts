import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import {
  getDoorElement as getDoorElementFromPalaceUtils,
  getDunJiaStem,
  hasTianPanStem,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils.ts';
import {
  analyzePalaceRelations,
  getDoorElement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-relations.ts';
import {
  evaluateSingleStar,
  getZhiFuStarPalaceFact,
} from '../packages/core/src/divination/algorithms/qimen/helpers/star-palace.ts';
import {
  getDayOfficerInfo,
  getDaySeasonRelation,
  getLunarPhase,
  getLunarPhaseByIndex,
  getSeasonalElement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality.ts';
import { getQimenJuShu } from '../packages/core/src/divination/algorithms/qimen/helpers/jushu.ts';
import {
  getMonthQimenJuShu,
  getYearQimenJuShu,
} from '../packages/core/src/divination/algorithms/qimen/helpers/jushu-extended.ts';
import { getQimenPatternTags } from '../packages/core/src/divination/algorithms/qimen/helpers/patterns.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import {
  getNamedStemPairPattern,
  getStemPairPattern,
} from '../packages/core/src/divination/algorithms/qimen/helpers/stem-pair-patterns.ts';
import { estimateYingQi } from '../packages/core/src/divination/algorithms/qimen/helpers/ying-qi.ts';

test('奇门拆补法在交节当天应按具体时刻换节气，不应按整日提前换局', () => {
  const beforeXiaoman = generateQimen(new Date('2024-05-20T10:00:00+08:00'));
  assert.equal(beforeXiaoman.timeInfo.solarTerm, '立夏');
  assert.equal(beforeXiaoman.seasonality?.currentJieQi, '立夏');
  assert.equal(beforeXiaoman.timeInfo.epoch, '中元');
  assert.equal(beforeXiaoman.juShu, 1);

  const afterXiaoman = generateQimen(new Date('2024-05-20T21:30:00+08:00'));
  assert.equal(afterXiaoman.timeInfo.solarTerm, '小满');
  assert.equal(afterXiaoman.seasonality?.currentJieQi, '小满');
  assert.equal(afterXiaoman.timeInfo.epoch, '中元');
  assert.equal(afterXiaoman.juShu, 2);
});

test('奇门日家月家主动干标签不得误写成时干', () => {
  const dayChart = generateQimen(new Date('2025-01-21T04:00:00.000Z'), 'zhuanpan', 'day');
  const monthChart = generateQimen(new Date('2025-01-08T04:00:00.000Z'), 'zhuanpan', 'month');

  assert.ok(dayChart.patternTags.includes('击刑（日干庚落艮八宫）'));
  assert.ok(monthChart.patternTags.includes('入墓（月干丁落艮八宫）'));
  assert.equal(monthChart.jiuGongGe.find((palace) => hasTianPanStem(palace, '丁'))?.name, '艮八宫');
  assert.doesNotMatch(dayChart.patternTags.join('、'), /击刑（时干庚/);
  assert.doesNotMatch(monthChart.patternTags.join('、'), /入墓（时干丁/);
  assert.match(
    dayChart.patternDetails.find((item) => item.tag.startsWith('击刑'))?.summary ?? '',
    /日干落击刑位/,
  );
  assert.match(formatEnhancedDivinationInfo('qimen', monthChart), /星奇入墓（凶格）：丁奇入艮八宫/);
});

test('奇门刑墓须按主动天盘干实际落宫判定，日柱墓支不替代落宫', () => {
  const falseTomb = generateQimen(new Date('2025-01-08T04:00:00Z'), 'zhuanpan', 'day');
  assert.equal(falseTomb.ganzhi.day, '丁丑');
  assert.equal(falseTomb.jiuGongGe.find((palace) => hasTianPanStem(palace, '丁'))?.name, '巽四宫');
  assert.equal(falseTomb.specialConditions?.isRiGanRuMu, undefined);
  assert.equal(falseTomb.specialConditions?.isShiGanRuMu, false);
  assert.doesNotMatch(falseTomb.specialConditions?.description ?? '', /日干丁.*入墓/);
  assert.doesNotMatch(falseTomb.patternTags.join('、'), /入墓（日干丁/);

  const falsePunishment = generateQimen(new Date('2026-09-03T04:00:00Z'), 'zhuanpan', 'day');
  assert.equal(falsePunishment.ganzhi.day, '庚辰');
  assert.equal(
    falsePunishment.jiuGongGe.find((palace) => hasTianPanStem(palace, '庚'))?.name,
    '兑七宫',
  );
  assert.doesNotMatch(falsePunishment.patternTags.join('、'), /击刑（日干庚/);
  assert.doesNotMatch(
    formatEnhancedDivinationInfo('qimen', falsePunishment),
    /击刑（日干庚落艮八宫）/,
  );

  const trueTomb = generateQimen(new Date('2025-01-28T04:00:00Z'), 'zhuanpan', 'day');
  assert.equal(trueTomb.ganzhi.day, '丁酉');
  assert.equal(trueTomb.jiuGongGe.find((palace) => hasTianPanStem(palace, '丁'))?.name, '艮八宫');
  assert.equal(trueTomb.specialConditions?.isRiGanRuMu, true);
  assert.match(trueTomb.specialConditions?.description ?? '', /日干丁落艮八宫入墓/);
  assert.ok(trueTomb.patternTags.includes('入墓（日干丁落艮八宫）'));
  const trueTombPrompt = formatEnhancedDivinationInfo('qimen', trueTomb);
  assert.match(trueTombPrompt, /星奇入墓（凶格）：丁奇入艮八宫/);
  assert.equal(trueTombPrompt.match(/丁奇入艮八宫/g)?.length, 1);
  assert.doesNotMatch(trueTombPrompt, /日家特殊条件：日干丁落艮八宫入墓/);
});

test('奇门拆补法定三元应按晚子时日柱推进符头日', () => {
  const beforeLateZi = generateQimen(new Date('2024-02-19T22:30:00+08:00'));
  assert.equal(beforeLateZi.ganzhi.day, '癸丑');
  assert.equal(beforeLateZi.timeInfo.solarTerm, '雨水');
  assert.equal(beforeLateZi.timeInfo.epoch, '上元');
  assert.equal(beforeLateZi.juShu, 9);

  const lateZi = generateQimen(new Date('2024-02-19T23:30:00+08:00'));
  assert.equal(lateZi.ganzhi.day, '甲寅');
  assert.equal(lateZi.timeInfo.solarTerm, '雨水');
  assert.equal(lateZi.timeInfo.epoch, '中元');
  assert.equal(lateZi.juShu, 6);

  const jingzheLateZi = generateQimen(new Date('2024-03-10T23:30:00+08:00'));
  assert.equal(jingzheLateZi.ganzhi.day, '甲戌');
  assert.equal(jingzheLateZi.timeInfo.solarTerm, '惊蛰');
  assert.equal(jingzheLateZi.timeInfo.epoch, '下元');
  assert.equal(jingzheLateZi.juShu, 4);
});

test('奇门拆补法应识别甲己符头并按符头五日段定三元', () => {
  const chart = generateQimen(new Date('2024-06-15T14:30:00+08:00'));

  assert.equal(chart.ganzhi.day, '庚戌');
  assert.equal(chart.timeInfo.solarTerm, '芒种');
  assert.equal(chart.timeInfo.epoch, '上元');
  assert.equal(chart.juShu, 6);
  assert.equal(chart.timeInfo.fuTou, '己酉');
  assert.equal(chart.timeInfo.fuTouDate, '2024-06-14');
});

test('奇门排盘：未知排盘级别应明确报错，不应静默当作时家盘', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'zhuanpan',
        'quarter' as Parameters<typeof generateQimen>[2],
      ),
    /未知的奇门排盘级别/,
  );
});

test('奇门排盘：未知排盘方法应明确报错，不应静默当作飞盘', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'unknown-method' as Parameters<typeof generateQimen>[1],
      ),
    /未知的奇门排盘方法/,
  );
});

test('奇门遁干：非法干支应明确报错，不应把未知六甲默认遁戊', () => {
  assert.equal(getDunJiaStem('甲子'), '戊');
  assert.equal(getDunJiaStem('乙丑'), '乙');
  assert.throws(() => getDunJiaStem('甲丑'), /无法识别干支/);
});

test('奇门门星神关系：未知门星神应明确报错，不应当成比和', () => {
  assert.equal(getDoorElement('休门'), '水');
  assert.throws(() => getDoorElement('假门'), /八门 "假门" 无法识别/);
  assert.throws(() => getDoorElementFromPalaceUtils('假门'), /八门 "假门" 无法识别/);
  assert.throws(
    () =>
      analyzePalaceRelations({
        renPan: { door: '假门' },
        tianPan: { star: '天蓬', stem: '戊' },
        shenPan: { god: '值符' },
      }),
    /八门 "假门" 无法识别/,
  );
});

test('奇门门星神关系应返回逐项关系与计数，不展示综合评分', () => {
  const palace = {
    renPan: { door: '休门' },
    tianPan: { star: '天蓬', stem: '戊' },
    shenPan: { god: '值符' },
  };
  const result = analyzePalaceRelations(palace);

  assert.deepEqual(
    [result.doorStar.relation, result.doorGod.relation, result.starGod.relation],
    ['比和', '相克', '相克'],
  );
  assert.deepEqual(result.relationCounts, { supporting: 1, controlling: 2 });
  assert.equal(result.harmony, '有拉扯');
  assert.doesNotMatch(result.description, /综合评分|\d+\s*\/\s*3/);
  assert.match(result.description, /不能压缩成单一吉凶结论/);
  assert.equal(result.doorGod.description, '值符（土）克 休门（水），有反制牵制。');
  assert.equal(result.starGod.description, '值符（土）克 天蓬（水），有反制牵制。');

  const supported = analyzePalaceRelations({ ...palace, renPan: { door: '开门' } });
  assert.equal(supported.doorStar.description, '开门（金）生 天蓬（水），能量流动顺畅。');
  assert.equal(supported.doorGod.description, '值符（土）生 开门（金），有幕后支撑。');
  for (const relation of [result.doorGod, result.starGod, supported.doorStar, supported.doorGod]) {
    assert.doesNotMatch(
      relation.description,
      /前者生助后者|后者生助前者|前者克制后者|后者克制前者/,
    );
  }
});

test('奇门九星与落宫五行关系独立于月令旺衰', () => {
  assert.deepEqual(
    [
      evaluateSingleStar('天蓬', 1, '水'),
      evaluateSingleStar('天芮', 5, '土'),
      evaluateSingleStar('天蓬', 6, '金'),
      evaluateSingleStar('天蓬', 3, '木'),
      evaluateSingleStar('天蓬', 9, '火'),
      evaluateSingleStar('天蓬', 2, '土'),
    ].map(({ relation, atOriginalPalace }) => [relation, atOriginalPalace]),
    [
      ['星宫比和', true],
      ['星宫比和', false],
      ['宫生星', false],
      ['星生宫', false],
      ['星克宫', false],
      ['宫克星', false],
    ],
  );
  const value = getZhiFuStarPalaceFact({
    zhiFu: '天蓬',
    jiuGongGe: [{ gong: 1, element: '水', tianPan: { star: '天蓬' } }],
  });
  assert.equal(value.detail, '天蓬落1宫，星宫比和，归本宫');
  assert.equal('state' in value, false);
  assert.equal('score' in value, false);
  assert.equal('specialJudgement' in value, false);
});

test('奇门九星关系：未知星或非法宫位应明确报错', () => {
  assert.throws(() => evaluateSingleStar('假星', 1, '水'), /九星 "假星" 无法识别/);
  assert.throws(() => evaluateSingleStar('天蓬', 10, '水'), /宫位 "10" 无效/);
  assert.throws(() => evaluateSingleStar('天蓬', 1, '风'), /宫位五行 "风" 无法识别/);
  assert.throws(
    () =>
      getZhiFuStarPalaceFact({
        zhiFu: '天英',
        jiuGongGe: [{ gong: 1, element: '水', tianPan: { star: '天蓬' } }],
      }),
    /找不到值符星 "天英" 的落宫/,
  );
});

test('月家与年家奇门应校验完整干支，不应只读取单个天干或地支', () => {
  assert.deepEqual(getMonthQimenJuShu('丙寅', '甲辰'), {
    isYangDun: false,
    juShu: 7,
    yuan: '下元',
  });
  assert.throws(() => getMonthQimenJuShu('甲丑', '甲辰'), /月干支不是有效六十甲子/);
  assert.throws(() => getMonthQimenJuShu('丙寅', '甲丑'), /年干支不是有效六十甲子/);
  assert.throws(() => getYearQimenJuShu('甲丑'), /年干支不是有效六十甲子/);
});

test('月家奇门按干支年五年三元定阴遁一四七局', () => {
  const years = [
    ['甲子', '上元', 1],
    ['戊辰', '上元', 1],
    ['己巳', '中元', 4],
    ['癸酉', '中元', 4],
    ['甲戌', '下元', 7],
    ['戊寅', '下元', 7],
    ['己卯', '上元', 1],
    ['甲午', '上元', 1],
    ['甲辰', '下元', 7],
    ['己酉', '上元', 1],
  ] as const;

  for (const [yearGanZhi, yuan, juShu] of years) {
    assert.deepEqual(getMonthQimenJuShu('丙寅', yearGanZhi), {
      isYangDun: false,
      juShu,
      yuan,
    });
  }
  assert.deepEqual(getMonthQimenJuShu('壬申', '甲辰'), getMonthQimenJuShu('丙寅', '甲辰'));
});

test('月家奇门在立春交节瞬时随干支年切换五年三元', () => {
  const before = generateQimen(
    new Date('2024-02-04T08:27:06Z'),
    'zhuanpan',
    'month',
    'chaibu',
    480,
  );
  const after = generateQimen(new Date('2024-02-04T08:27:07Z'), 'zhuanpan', 'month', 'chaibu', 480);

  assert.equal(before.ganzhi.year, '癸卯');
  assert.equal(before.timeInfo.epoch, '中元');
  assert.equal(before.juShu, 4);
  assert.equal(after.ganzhi.year, '甲辰');
  assert.equal(after.timeInfo.epoch, '下元');
  assert.equal(after.juShu, 7);
});

test('年家奇门按一百八十年三元定阴遁一四七局', () => {
  assert.deepEqual(getYearQimenJuShu('甲子', 1864), {
    isYangDun: false,
    juShu: 1,
    yuan: '上元',
  });
  assert.deepEqual(getYearQimenJuShu('甲子', 1924), {
    isYangDun: false,
    juShu: 4,
    yuan: '中元',
  });
  assert.deepEqual(getYearQimenJuShu('甲子', 1984), {
    isYangDun: false,
    juShu: 7,
    yuan: '下元',
  });
  assert.deepEqual(getYearQimenJuShu('甲子', 2044), {
    isYangDun: false,
    juShu: 1,
    yuan: '上元',
  });
});

test('非时家格局只使用本级别及更长周期的干支', () => {
  const cases = [
    ['year', '2025-03-10T02:00:00Z', '2025-09-10T19:00:00Z'],
    ['month', '2025-06-18T02:00:00Z', '2025-06-26T19:00:00Z'],
    ['day', '2025-06-18T02:00:00Z', '2025-06-18T10:00:00Z'],
  ] as const;

  for (const [scope, firstTime, secondTime] of cases) {
    const first = generateQimen(new Date(firstTime), 'zhuanpan', scope, 'chaibu', 480);
    const second = generateQimen(new Date(secondTime), 'zhuanpan', scope, 'chaibu', 480);
    assert.equal(first.ganzhi.year, second.ganzhi.year);
    if (scope === 'month') assert.equal(first.ganzhi.month, second.ganzhi.month);
    assert.deepEqual(first.classicPatterns, second.classicPatterns);
    assert.deepEqual(first.patternCombos, second.patternCombos);
    assert.doesNotMatch(
      (first.classicPatterns ?? []).map((item) => item.name).join('、'),
      /时格|时勃|日勃|伏干格|飞干格|天辅时|五合时/,
    );
  }
});

test('奇门格局应拒绝未知值符和值使，不应按零宫位继续判断', () => {
  const baseParams = {
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 1,
    zhiShiLandingPalace: 1,
    jiuGongGe: [],
    hourGanForFind: '戊',
  };

  assert.throws(
    () => getQimenPatternTags({ ...baseParams, zhiFu: '假星' }),
    /值符星 "假星" 无法识别/,
  );
  assert.throws(
    () => getQimenPatternTags({ ...baseParams, zhiShi: '假门' }),
    /值使门 "假门" 无法识别/,
  );
});

test('奇门节令：未知节气或日干应明确报错，不应降级成无法判定', () => {
  assert.equal(getSeasonalElement('立春'), '木');
  assert.equal(getDaySeasonRelation('甲', '木').relation, '得时');
  assert.equal(getDaySeasonRelation('癸', '火').relation, '持平');
  assert.throws(() => getSeasonalElement('假节气'), /无法识别节气 "假节气" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('假', '木'), /无法识别日干 "假" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('甲', ''), /节令五行不能为空/);
});

test('奇门月相与建除映射缺失时应报错，不得默认新月或平', () => {
  assert.equal(getLunarPhaseByIndex(0), '新月');
  assert.equal(getLunarPhaseByIndex(7), '下弦');
  assert.equal(getDayOfficerInfo('成').fortune, '吉');
  assert.throws(() => getLunarPhaseByIndex(8), /无法识别历法月相索引/);
  assert.throws(() => getLunarPhase(new Date(Number.NaN)), /月相日期必须是有效日期/);
  assert.throws(() => getDayOfficerInfo('未知'), /无法识别建除十二神/);
});

test('奇门十干格局应正常返回合法组合并拒绝非法输入', () => {
  assert.ok(getStemPairPattern('壬', '癸'));
  assert.equal(getStemPairPattern('甲', '癸').name, '生');
  assert.equal(getNamedStemPairPattern('壬', '癸')?.name, '螣蛇飞空');
  assert.throws(() => getStemPairPattern('A', '癸'), /合法十天干/);
  assert.throws(() => getNamedStemPairPattern('A', '癸'), /合法十天干/);
});

test('奇门应期必须有明确基准宫并校验宫位', () => {
  assert.throws(() => estimateYingQi([]), /必须提供用神落宫/);
  assert.throws(() => estimateYingQi([], 0), /用神落宫必须是 1-9/);
  assert.throws(() => estimateYingQi([{ gong: 10 }], 1), /九宫格宫位必须是 1-9/);
});

test('奇门定局方法应支持拆补与置闰，并在结果中标明', () => {
  const date = new Date('2024-05-20T21:30:00+08:00');
  const chaibu = generateQimen(date, 'zhuanpan', 'hour', 'chaibu');
  const zhirun = generateQimen(date, 'zhuanpan', 'hour', 'zhirun');

  assert.equal(chaibu.juMethod, 'chaibu');
  assert.equal(zhirun.juMethod, 'zhirun');
  assert.equal(chaibu.timeInfo.juMethod, 'chaibu');
  assert.equal(zhirun.timeInfo.juMethod, 'zhirun');
  assert.match(String(chaibu.timeInfo.juMethodNote ?? ''), /拆补/);
  assert.match(String(zhirun.timeInfo.juMethodNote ?? ''), /置闰|符头|接气|超神|正授/);
  // 不得静默退回拆补标签
  assert.notEqual(zhirun.juMethod, 'chaibu');
});

test('奇门置闰法应复现《奇门遁甲统宗》康熙五十七年芒种闰奇古例', () => {
  const cases = [
    ['1718-05-30', '己酉', '小满', '芒种', '上元', 6, false, '超神'],
    ['1718-06-04', '甲寅', '小满', '芒种', '中元', 3, false, '超神'],
    ['1718-06-09', '己未', '芒种', '芒种', '下元', 9, false, '超神'],
    ['1718-06-14', '甲子', '芒种', '芒种', '上元', 6, true, '超神'],
    ['1718-06-19', '己巳', '芒种', '芒种', '中元', 3, true, '超神'],
    ['1718-06-24', '甲戌', '夏至', '芒种', '下元', 9, true, '超神'],
    ['1718-06-29', '己卯', '夏至', '夏至', '上元', 9, false, '接气'],
    ['1719-08-08', '甲子', '大暑', '立秋', '上元', 2, false, '正授'],
  ] as const;

  for (const [dateText, dayGanZhi, actualTerm, juTerm, yuan, juShu, isZhiRun, state] of cases) {
    const [year, month, day] = dateText.split('-').map(Number);
    const result = getQimenJuShu(
      {
        solar: { year, month, day, hour: 12 },
        jieQi: actualTerm,
        ganzhi: { day: dayGanZhi },
      },
      'zhirun',
    );

    assert.equal(result.actualJieQi, actualTerm, dateText);
    assert.equal(result.jieQi, juTerm, dateText);
    assert.equal(result.yuan, yuan, dateText);
    assert.equal(result.juShu, juShu, dateText);
    assert.equal(result.fuTou, dayGanZhi, dateText);
    assert.equal(result.isZhiRun, isZhiRun, dateText);
    assert.equal(result.chaoShenOrJieQi, state, dateText);
  }
});

test('奇门置闰法缺少精确公历日期时应拒绝近似推算', () => {
  assert.throws(
    () => getQimenJuShu({ jieQi: '芒种', ganzhi: { day: '甲子' } }, 'zhirun'),
    /必须提供精确公历日期/,
  );
});

test('奇门未知定局方法应明确报错', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'zhuanpan',
        'hour',
        'unknown' as 'chaibu',
      ),
    /未知的奇门定局方法/,
  );
});
