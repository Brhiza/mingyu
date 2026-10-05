import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  evaluateMeihuaTimelineTrend,
  generateMeihua,
} from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { analyzeMeihuaEvidence } from '../packages/core/src/divination/meihua-evidence.ts';
import {
  findHexagramByTrigrams,
  resolveTiYongByMovingYao,
} from '../packages/core/src/divination/algorithms/meihua/helpers/hexagram.ts';
import {
  hasCompleteCharacterCalculation,
  resolveNumberMethod,
  resolveTimeMethod,
} from '../packages/core/src/divination/algorithms/meihua/helpers/methods.ts';
import { MeihuaHelpers } from '../packages/core/src/divination/divination-helpers.ts';
import { getDivinationTime } from '../packages/core/src/calendar/timeManager.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import {
  buildDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination.ts';
import {
  getMeihuaSelectionOptions,
  MEIHUA_DIRECTION_OPTIONS,
  MEIHUA_OBJECT_OPTIONS,
} from '../packages/core/src/divination/config.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('梅花真太阳时跨立夏仍以实际占时定月建，日时取校正钟表', () => {
  const corrected = new Date('2024-05-05T07:30:00+08:00');
  const actual = new Date('2024-05-05T08:40:00+08:00');
  const chart = generateMeihua(corrected, { method: 'time' }, { termReferenceDate: actual });
  const clockOnly = generateMeihua(corrected, { method: 'time' });

  assert.equal(clockOnly.analysis.monthBranch, '辰');
  assert.equal(chart.analysis.monthBranch, '巳');
  assert.equal(chart.ganzhi.month.slice(-1), '巳');
  assert.equal(chart.ganzhi.day, clockOnly.ganzhi.day);
  assert.equal(chart.ganzhi.hour, clockOnly.ganzhi.hour);
  assert.equal(chart.termReferenceTimestamp, actual.getTime());
  assert.equal(chart.evidenceAnalysis?.stages[0]?.ti.seasonState, chart.analysis.tiSeasonState);
});

test('梅花随机轨迹重放应识别缺失、多余、篡改及拒绝采样', () => {
  const samples = [0, 0.25, 0xffffffff / 0x100000000, 0.5];
  const data = generateMeihua(SAMPLE_DATE, { method: 'random', replay: samples });
  assert.equal(data.calculation?.upperTrigramIndex, 1);
  assert.equal(data.calculation?.lowerTrigramIndex, 3);
  assert.equal(data.movingYao.position, 4);
  assert.equal(data.evidenceAnalysis?.randomFact.sampleCount, 4);
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'random', replay: [...samples, 0] }),
    /重放样本有剩余/,
  );
  const wrongHexagram = structuredClone(data);
  wrongHexagram.mainHexagram.upper = '坤';
  assert.throws(() => analyzeMeihuaEvidence(wrongHexagram), /随机轨迹与起卦计算记录不一致/);
  for (const invalid of [samples.slice(0, -1), [...samples, 0], [0.75, ...samples.slice(1)]]) {
    const changed = structuredClone(data);
    changed.meta!.random!.samples = invalid;
    assert.throws(
      () => analyzeMeihuaEvidence(changed),
      /随机重放样本已用尽|随机重放样本有剩余|随机轨迹与起卦计算记录不一致/,
    );
  }

  const corrected = new Date('2024-05-05T07:30:00+08:00');
  const actual = new Date('2024-05-05T08:40:00+08:00');
  let baselineRandomCalls = 0;
  const baseline = generateMeihua(
    corrected,
    {
      method: 'random',
      random: () => {
        baselineRandomCalls += 1;
        return 0.5;
      },
    },
    { termReferenceDate: actual },
  );
  assert.equal(baselineRandomCalls, 3);
  const capture = (chart: typeof baseline) => ({
    native: formatEnhancedDivinationInfo('meihua', chart),
    fullTask: buildDivinationPrompt({
      method: 'meihua',
      data: chart,
      question: '本次体用关系如何？',
      currentTime: actual,
    }),
    summary: getDivinationSummaryBlocks('meihua', chart),
  });
  const baselineConsumers = capture(baseline);
  assert.equal(baseline.analysis.monthBranch, '巳');
  for (const replaceDate of [false, true]) {
    const options = { termReferenceDate: new Date(actual.getTime()) };
    let randomCalls = 0;
    const changedValues = {
      number: 123,
      soundCount: 4,
      characterText: '改写参数',
      characterCount: 4,
      characterTones: [1, 2, 3, 4],
      characterStrokeCounts: [7, 8],
      characterLeftStrokes: 5,
      characterRightStrokes: 6,
      direction: 'north' as const,
      objectType: 'earth' as const,
    };
    let changedSettings: NonNullable<Parameters<typeof generateMeihua>[1]>;
    changedSettings = {
      method: 'random',
      random: () => {
        randomCalls += 1;
        if (replaceDate) options.termReferenceDate = new Date(corrected.getTime());
        else options.termReferenceDate.setTime(corrected.getTime());
        Object.assign(changedSettings, changedValues);
        return 0.5;
      },
    };
    const changed = generateMeihua(corrected, changedSettings, options);
    assert.equal(options.termReferenceDate.getTime(), corrected.getTime());
    assert.deepEqual(
      {
        number: changedSettings.number,
        soundCount: changedSettings.soundCount,
        characterText: changedSettings.characterText,
        characterCount: changedSettings.characterCount,
        characterTones: changedSettings.characterTones,
        characterStrokeCounts: changedSettings.characterStrokeCounts,
        characterLeftStrokes: changedSettings.characterLeftStrokes,
        characterRightStrokes: changedSettings.characterRightStrokes,
        direction: changedSettings.direction,
        objectType: changedSettings.objectType,
      },
      changedValues,
    );
    assert.equal(randomCalls, baselineRandomCalls);
    assert.equal(changed.termReferenceTimestamp, actual.getTime());
    assert.equal(changed.meta!.inputHash, baseline.meta!.inputHash);
    assert.equal(changed.meta!.resultId, baseline.meta!.resultId);
    assert.deepEqual(changed, baseline);
    assert.deepEqual(capture(changed), baselineConsumers);
    assert.deepEqual(capture(JSON.parse(JSON.stringify(changed))), baselineConsumers);
    assert.deepEqual(changed, baseline);
  }
});

test('梅花：主互变卦与六爻体用应按传统爻位计算', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.originalName, '火风鼎');
  assert.equal(data.movingYao.position, 2);
  assert.equal(data.changedName, '火山旅');
  assert.equal(data.changedHexagram?.upper, '离');
  assert.equal(data.changedHexagram?.lower, '艮');
  assert.equal(data.calculation.timeZhi, '辰');
  assert.equal(data.calculation.timeZhiIndex, 5);
  assert.equal(data.calculation.totalWithTime, 128);
  assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
  const lowerCalculation = data.evidenceAnalysis?.calculationFact.steps.find(
    (item) => item.target === '下卦',
  );
  assert.equal(lowerCalculation?.remainder, 5);
  assert.match(lowerCalculation?.promptText ?? '', /下卦=\(5\)除以8，余数为5，索引为5/u);
  assert.equal(data.evidenceAnalysis?.calculationFact.methodKey, 'number');
  assert.equal(data.evidenceAnalysis?.calculationFact.inputs.number, 123);
  assert.deepEqual(
    data.evidenceAnalysis?.calculationFact.steps.map((item) => item.target),
    ['上卦', '下卦', '动爻'],
  );
  assert.ok(
    data.evidenceAnalysis?.calculationFact.steps.every(
      (item) => item.promptText && typeof item.result === 'number',
    ),
  );
  assert.match(data.evidenceAnalysis?.calculationFact.limitation || '', /不证明卦象预测有效性/);
  assert.equal(data.interName, '泽天夬');
  assert.equal(data.interHexagram?.upper, '兑');
  assert.equal(data.interHexagram?.lower, '乾');
  assert.equal(data.interTiGua?.name, '兑');
  assert.equal(data.interYongGua?.name, '乾');
  assert.equal(data.analysis.inter1Relation, '原体克体互');
  assert.equal(data.analysis.inter2Relation, '原体克用互');
  assert.deepEqual(
    data.yaosDetail.map((yao) => ({
      position: yao.position,
      yaoType: yao.yaoType,
      isChanging: yao.isChanging,
      tiYong: yao.tiYong,
    })),
    [
      { position: 1, yaoType: '阴', isChanging: false, tiYong: '用' },
      { position: 2, yaoType: '阳', isChanging: true, tiYong: '用' },
      { position: 3, yaoType: '阳', isChanging: false, tiYong: '用' },
      { position: 4, yaoType: '阳', isChanging: false, tiYong: '体' },
      { position: 5, yaoType: '阴', isChanging: false, tiYong: '体' },
      { position: 6, yaoType: '阳', isChanging: false, tiYong: '体' },
    ],
  );

  const snapshot = structuredClone(data);
  const prompt = formatEnhancedDivinationInfo('meihua', data);
  const main = findHexagramByTrigrams(3, 5);
  const mainSnapshot = structuredClone(main);
  main.name = '变造卦名';
  main.yaoCi![1] = '变造查询爻辞';
  data.mainHexagram.yaoCi![1] = '变造主卦爻辞';
  data.interHexagram!.yaoCi![0] = '变造互卦爻辞';
  data.changedHexagram!.yaoCi![0] = '变造变卦爻辞';
  assert.equal(main.name, '变造卦名');
  assert.equal(data.mainHexagram.yaoCi![1], '变造主卦爻辞');
  assert.deepEqual(findHexagramByTrigrams(3, 5), mainSnapshot);
  const fresh = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });
  assert.equal(fresh.originalName, '火风鼎');
  assert.equal(fresh.changedName, '火山旅');
  assert.equal(fresh.interName, '泽天夬');
  assert.deepEqual(fresh, snapshot);
  assert.equal(formatEnhancedDivinationInfo('meihua', fresh), prompt);
});

test('梅花：纯乾、纯坤主卦应按原文改取变卦互', () => {
  const qian = generateMeihua(SAMPLE_DATE, {
    method: 'random',
    replay: [0, 0, 0.25],
  });
  const kun = generateMeihua(SAMPLE_DATE, {
    method: 'random',
    replay: [0.999999999, 0.999999999, 0.25],
  });

  assert.equal(qian.originalName, '乾为天');
  assert.equal(qian.movingYao.position, 2);
  assert.equal(qian.changedName, '天火同人');
  assert.equal(qian.interName, '天风姤');
  assert.equal(qian.interHexagram?.upper, '乾');
  assert.equal(qian.interHexagram?.lower, '巽');
  assert.match(
    qian.evidenceAnalysis?.hexagramStructureFacts[1]?.sources.join('') ?? '',
    /乾坤无互/u,
  );
  assert.equal(qian.evidenceAnalysis?.hexagramStructureFacts[1]?.hexagram, qian.interName);
  assert.equal(qian.evidenceAnalysis?.hexagramStructureFacts[2]?.hexagram, qian.changedName);
  assert.equal(
    qian.evidenceAnalysis?.stages.find((stage) => stage.stage === 'process')?.hexagram,
    qian.interName,
  );
  assert.equal(
    qian.evidenceAnalysis?.stages.find((stage) => stage.stage === 'process')?.ti.name,
    '乾',
  );
  assert.equal(
    qian.evidenceAnalysis?.stages.find((stage) => stage.stage === 'process')?.yong.name,
    '巽',
  );

  assert.equal(kun.originalName, '坤为地');
  assert.equal(kun.movingYao.position, 2);
  assert.equal(kun.changedName, '地水师');
  assert.equal(kun.interName, '地雷复');
  assert.equal(kun.interHexagram?.upper, '坤');
  assert.equal(kun.interHexagram?.lower, '震');
  assert.match(
    kun.evidenceAnalysis?.hexagramStructureFacts[1]?.sources.join('') ?? '',
    /乾坤无互/u,
  );
  assert.equal(kun.evidenceAnalysis?.hexagramStructureFacts[1]?.hexagram, kun.interName);
  assert.equal(kun.evidenceAnalysis?.hexagramStructureFacts[2]?.hexagram, kun.changedName);
  assert.equal(
    kun.evidenceAnalysis?.stages.find((stage) => stage.stage === 'process')?.hexagram,
    kun.interName,
  );
  assert.equal(
    kun.evidenceAnalysis?.stages.find((stage) => stage.stage === 'process')?.ti.name,
    '坤',
  );
  assert.equal(
    kun.evidenceAnalysis?.stages.find((stage) => stage.stage === 'process')?.yong.name,
    '震',
  );
});

test('梅花：天泽履二爻动应变天雷无妄，不得错认成天山遁', () => {
  const data = generateMeihua(new Date('2026-07-25T23:30:00+08:00'), { method: 'time' });

  assert.equal(data.originalName, '天泽履');
  assert.equal(data.movingYao.position, 2);
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.yaoType),
    ['阳', '阳', '阴', '阳', '阳', '阳'],
  );
  assert.equal(data.interName, '风火家人');
  assert.equal(data.changedName, '天雷无妄');
  assert.equal(data.changedHexagram?.upper, '乾');
  assert.equal(data.changedHexagram?.lower, '震');
  assert.equal(data.analysis.monthBranch, '未');
  assert.equal(data.analysis.monthElement, '土');
  assert.equal(data.analysis.tiSeasonState, '相');
  assert.equal(data.analysis.yongSeasonState, '相');
});

test('梅花：数字起卦的完整取余周期应保留主互变三卦与动爻资料', () => {
  // 固定时辰下，上卦除8、动爻除6的完整取余周期为24。
  for (let number = 1; number <= 24; number += 1) {
    const data = generateMeihua(SAMPLE_DATE, { method: 'number', number });

    assert.ok(data.originalName);
    assert.ok(data.interName);
    assert.ok(data.changedName);
    assert.ok(data.interHexagram?.upper && data.interHexagram.lower);
    assert.ok(data.changedHexagram?.upper && data.changedHexagram.lower);
    assert.ok(data.changedTiGua && data.changedYongGua);
    assert.ok(data.mainHexagram.movingYaoCi);
    assert.doesNotMatch(data.movingYao.yaoName, /未知/);
    assert.doesNotMatch(JSON.stringify(data.analysis), /无变卦|关系未定/);
  }
});

test('梅花：用生体应期描述应保留验证条件且不带多余标点', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 3 });

  assert.equal(data.analysis.tiYongRaw, '用生体');
  assert.ok(
    data.analysis.yingQi?.includes('用生体，外部条件对体卦有生扶，可观察助力实际出现时的进展'),
  );
  assert.ok(data.analysis.yingQi?.every((item) => !item.includes('顺势）')));
});

test('梅花：体生用时应期条件应记录体卦泄气', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 11 });

  assert.equal(data.analysis.tiYongRaw, '体生用');
  assert.ok(data.analysis.yingQi?.includes('体生用，体卦向事项泄气，可观察投入消耗与恢复条件'));
  assert.ok(
    data.evidenceAnalysis?.timingFacts.some((fact) =>
      fact.promptText.includes('体生用，体卦向事项泄气'),
    ),
  );
});

test('梅花：timeTrigram 兼容入口应回到年月日时起卦', () => {
  const timeData = generateMeihua(SAMPLE_DATE, { method: 'time' });
  const compatData = generateMeihua(SAMPLE_DATE, { method: 'timeTrigram' });

  assert.equal(compatData.calculation.methodKey, 'timeTrigram');
  assert.deepEqual(
    [
      compatData.calculation.upperTrigramIndex,
      compatData.calculation.lowerTrigramIndex,
      compatData.calculation.movingYaoIndex,
    ],
    [
      timeData.calculation.upperTrigramIndex,
      timeData.calculation.lowerTrigramIndex,
      timeData.calculation.movingYaoIndex,
    ],
  );
  assert.match(String(compatData.calculation.compatibilityNote), /年月日时起卦法/);
  assert.equal(compatData.evidenceAnalysis?.calculationFact.status, '完整');
  assert.equal(compatData.evidenceAnalysis?.calculationFact.methodKey, 'timeTrigram');
  assert.match(
    compatData.evidenceAnalysis?.calculationFact.compatibilityNote || '',
    /历史兼容入口/,
  );
});

test('梅花：年月日时起卦应以农历年支入数，不应在立春后春节前提前换年', () => {
  const data = generateMeihua(new Date('2024-02-05T12:00:00+08:00'), { method: 'time' });

  assert.equal(data.ganzhi.year, '甲辰');
  assert.equal(data.calculation.yearZhi, '卯');
  assert.equal(data.calculation.yearZhiIndex, 4);
  assert.equal(data.calculation.month, 12);
  assert.equal(data.calculation.day, 26);
  assert.equal(data.calculation.timeZhi, '午');
  assert.equal(data.calculation.timeZhiIndex, 7);
  assert.equal(data.calculation.upperTrigramIndex, 2);
  assert.equal(data.calculation.lowerTrigramIndex, 1);
  assert.equal(data.calculation.movingYaoIndex, 1);
  assert.equal(data.originalName, '泽天夬');
  assert.equal(data.changedName, '泽风大过');
});

test('梅花时间卦证据应以原占时复核农历取数，识别取余结果不变的伪记录', () => {
  const date = new Date('2024-02-05T12:00:00+08:00');
  for (const method of ['time', 'timeTrigram'] as const) {
    const data = generateMeihua(date, { method });
    assert.equal(data.calculation.timezoneOffsetMinutes, 480);
    assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');

    const changedDay = structuredClone(data);
    changedDay.calculation.day = 2; // 原日数26，减24后除8、除6的余数都不变。
    const changedDayFact = analyzeMeihuaEvidence(changedDay).calculationFact;
    assert.equal(changedDayFact.status, '计算不一致');
    assert.match(changedDayFact.promptText, /农历年支、月、日与时间戳重算结果不一致/);

    const legacy = structuredClone(data);
    delete legacy.calculation.timezoneOffsetMinutes;
    const legacyFact = analyzeMeihuaEvidence(legacy).calculationFact;
    assert.equal(legacyFact.status, '缺少中间参数');
    assert.equal(legacyFact.steps.length, 0);
    assert.match(legacyFact.promptText, /起卦民用时区偏移/);
  }
});

test('梅花公元1年时间卦应记录真实时区偏移并完成来源复核', () => {
  const data = generateMeihua(new Date('0001-03-01T08:00:00+08:00'), { method: 'time' });
  assert.equal(data.calculation.timezoneOffsetMinutes, 480);
  assert.equal(data.calculation.yearZhi, '酉');
  assert.equal(data.calculation.month, 1);
  assert.equal(data.calculation.day, 18);
  assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
});

test('梅花起卦时间须与结果元数据一致，字占和随机仍不以时间入数', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const clockMethods = [
    { method: 'number' as const, number: 123 },
    { method: 'sound' as const, soundCount: 3 },
    { method: 'direction' as const, direction: 'south' as const, objectType: 'fire' as const },
  ];
  for (const settings of clockMethods) {
    const data = generateMeihua(date, settings);
    assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
    const changedTime = structuredClone(data);
    changedTime.timestamp += 2 * 60 * 60 * 1000;
    assert.throws(() => analyzeMeihuaEvidence(changedTime), /起卦时间戳与结果元数据不一致/u);
  }

  const withoutTimeSettings = [
    { method: 'character' as const, characterText: '西林', characterStrokeCounts: [7, 8] },
    { method: 'random' as const, seed: '梅花时间非取数' },
  ];
  for (const settings of withoutTimeSettings) {
    const data = generateMeihua(date, settings);
    assert.equal(data.calculation.timezoneOffsetMinutes, 480);
    assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
    const changedTime = structuredClone(data);
    changedTime.timestamp += 2 * 60 * 60 * 1000;
    assert.throws(() => analyzeMeihuaEvidence(changedTime), /起卦时间戳与结果元数据不一致/u);

    const laterData = generateMeihua(new Date(date.getTime() + 2 * 60 * 60 * 1000), settings);
    assert.equal(laterData.evidenceAnalysis?.calculationFact.status, '完整');
    assert.equal(laterData.calculation.upperTrigramIndex, data.calculation.upperTrigramIndex);
    assert.equal(laterData.calculation.lowerTrigramIndex, data.calculation.lowerTrigramIndex);
    assert.equal(laterData.calculation.movingYaoIndex, data.calculation.movingYaoIndex);
  }
});

test('梅花：观梅占原例应取兑上离下、初爻动', () => {
  // 《梅花易数》卷一《观梅占》：辰年十二月十七日申时，34取兑、43取离与初爻。
  const sample = getDivinationTime(SAMPLE_DATE);
  const result = resolveTimeMethod(
    { ...sample.ganzhi, hour: '甲申' },
    {
      ...sample.timeInfo.lunar,
      yearInChinese: '戊辰',
      monthNumber: 12,
      dayNumber: 17,
    },
  );
  assert.deepEqual(
    [result.upperTrigramIndex, result.lowerTrigramIndex, result.movingYaoIndex],
    [2, 3, 1],
  );
  assert.equal(findHexagramByTrigrams(2, 3).name, '泽火革');
});

test('梅花：未知起卦方式应明确报错，不应静默退回时间卦', () => {
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'unknown' as never }),
    /未知的梅花易数起卦方式/,
  );
});

test('梅花各起卦方式应拒绝与本次取数无关的输入', () => {
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'number', number: 123, soundCount: 3 }),
    /number起卦不接受 soundCount/,
  );
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'time', number: 123 }),
    /time起卦不接受 number/,
  );
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'random', seed: '一', direction: 'south' }),
    /random起卦不接受 direction/,
  );
});

test('梅花：仅随机起卦应把重放轨迹接入统一证据', () => {
  const randomData = generateMeihua(SAMPLE_DATE, { method: 'random', seed: '梅花证据样例' });
  const numberData = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });
  const randomItem = randomData.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '随机起卦重放记录',
  );

  assert.equal(randomItem?.level, '辅证');
  assert.doesNotMatch(randomItem?.detail || '', /梅花证据样例/);
  assert.match(randomItem?.detail || '', /随机种子保留在结构化结果中/);
  assert.match(randomItem?.detail || '', /不表示可信度或预测有效性/);
  assert.ok(
    randomData.evidenceAnalysis?.randomFacts.some((item) =>
      item.includes('随机种子：梅花证据样例'),
    ),
  );
  assert.equal(randomData.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(randomData.evidenceAnalysis?.randomFact.seed, '梅花证据样例');
  assert.equal(randomData.evidenceAnalysis?.randomFact.sampleCount, 3);
  assert.doesNotMatch(randomData.evidenceAnalysis?.randomFact.promptText || '', /梅花证据样例/);
  assert.equal(randomData.evidenceAnalysis?.calculationFact.status, '完整');
  assert.deepEqual(
    randomData.evidenceAnalysis?.calculationFact.steps.map((item) => [
      item.target,
      item.expression,
    ]),
    [
      ['上卦', '随机整数1-8'],
      ['下卦', '随机整数1-8'],
      ['动爻', '随机整数1-6'],
    ],
  );
  assert.equal(numberData.evidenceAnalysis?.randomFact.status, '不适用');
  assert.deepEqual(numberData.evidenceAnalysis?.randomFacts, []);
  assert.ok(
    !numberData.evidenceAnalysis?.evidence.items.some((item) => item.tags?.includes('随机起卦')),
  );
});

test('梅花：旧结果缺少取数中间参数时应保留已定卦象并标记证据缺口', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });
  data.calculation = undefined;
  data.evidenceAnalysis = undefined;

  const rebuilt = analyzeMeihuaEvidence(data);
  assert.equal(rebuilt.calculationFact.status, '缺少中间参数');
  assert.equal(rebuilt.calculationFact.steps.length, 0);
  assert.equal(rebuilt.calculationFact.resolvedResult.upperTrigram, data.mainHexagram.upper);
  assert.match(rebuilt.calculationFact.promptText, /计算过程未附/);
  assert.ok(
    rebuilt.evidence.items.some(
      (item) => item.level === '反证' && item.title === '起卦方式与取数算式',
    ),
  );
});

test('梅花：数字起卦应拒绝超出安全整数范围的数字', () => {
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'number', number: Number.MAX_SAFE_INTEGER + 1 }),
    /安全范围内的正整数/,
  );
});

test('梅花：声音起卦应区分所闻声音数与时间起卦', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'sound', soundCount: 3 });

  assert.equal(data.calculation?.methodKey, 'sound');
  assert.equal(data.calculation?.soundCount, 3);
  assert.equal(data.calculation?.timeZhi, '辰');
  assert.equal(data.calculation?.timeZhiIndex, 5);
  assert.equal(data.calculation?.upperTrigramIndex, 3);
  assert.equal(data.calculation?.lowerTrigramIndex, 8);
  assert.equal(data.calculation?.movingYaoIndex, 2);
  assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
  assert.match(data.evidenceAnalysis?.calculationFact.promptText || '', /声音取数/);
});

test('梅花：字数起卦应按分段规则支持笔画、传统四声与纯字数回放', () => {
  const shortSettings = {
    method: 'character' as const,
    characterText: '西林',
    characterStrokeCounts: [7, 8],
  };
  const shortData = generateMeihua(SAMPLE_DATE, shortSettings);
  assert.deepEqual(shortData.calculation?.characterStrokeCounts, [7, 8]);
  assert.equal(shortData.calculation?.characterUpperNumber, 7);
  assert.equal(shortData.calculation?.characterLowerNumber, 8);
  assert.equal(shortData.calculation?.upperTrigramIndex, 7);
  assert.equal(shortData.calculation?.lowerTrigramIndex, 8);
  assert.equal(shortData.calculation?.movingYaoIndex, 3);
  assert.equal(shortData.mainHexagram.upper, '艮');
  assert.equal(shortData.mainHexagram.lower, '坤');
  const toneSettings = {
    method: 'character' as const,
    characterText: '今日动静如何',
    characterTones: [1, 4, 3, 3, 1, 1],
  };
  const toneData = generateMeihua(SAMPLE_DATE, toneSettings);
  assert.equal(toneData.calculation?.characterCount, 6);
  assert.deepEqual(toneData.calculation?.characterTones, [1, 4, 3, 3, 1, 1]);
  assert.equal(toneData.calculation?.characterUpperNumber, 8);
  assert.equal(toneData.calculation?.characterLowerNumber, 5);
  assert.equal(toneData.calculation?.upperTrigramIndex, 8);
  assert.equal(toneData.calculation?.lowerTrigramIndex, 5);
  assert.equal(toneData.calculation?.movingYaoIndex, 1);
  assert.equal(toneData.mainHexagram.upper, '坤');
  assert.equal(toneData.mainHexagram.lower, '巽');
  assert.deepEqual(
    [toneData.originalName, toneData.changedName, toneData.movingYao.position],
    ['地风升', '地天泰', 1],
  );
  assert.equal(toneData.evidenceAnalysis?.calculationFact.status, '完整');
  const missingStroke = [...shortSettings.characterStrokeCounts];
  delete missingStroke[0];
  const missingTone = [...toneSettings.characterTones];
  delete missingTone[1];
  for (const [settings, diagnostic] of [
    [{ ...shortSettings, characterStrokeCounts: missingStroke }, /第1字笔画数/u],
    [{ ...toneSettings, characterTones: missingTone }, /第2字传统平上去入声数/u],
  ] as const) {
    const before = structuredClone(settings);
    assert.throws(() => generateMeihua(SAMPLE_DATE, settings), diagnostic);
    assert.deepEqual(settings, before);
  }
  const incompleteCalculation = {
    method: '字数起卦法',
    methodKey: 'character' as const,
    characterCount: 4,
    characterTones: [1, 2, 3, 4],
    characterUpperNumber: 1,
    characterLowerNumber: 7,
    upperTrigramIndex: 1,
    lowerTrigramIndex: 7,
    movingYaoIndex: 2,
  };
  delete incompleteCalculation.characterTones[1];
  assert.equal(hasCompleteCharacterCalculation(incompleteCalculation), false);
  const longData = generateMeihua(SAMPLE_DATE, {
    method: 'character',
    characterCount: 12,
  });
  assert.equal(longData.calculation?.characterUpperNumber, 6);
  assert.equal(longData.calculation?.characterLowerNumber, 6);
  assert.equal(longData.calculation?.movingYaoIndex, 6);
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'character', characterCount: 6 }),
    /必须提供 characterTones 传统平上去入声数/,
  );
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'character', characterText: '西林' }),
    /2-3字起卦必须提供 characterStrokeCounts/,
  );
  assert.throws(
    () =>
      generateMeihua(SAMPLE_DATE, {
        method: 'character',
        characterText: '一',
        characterLeftStrokes: Number.MAX_SAFE_INTEGER,
        characterRightStrokes: 1,
      }),
    /总取数超出安全整数范围/,
  );
  assert.throws(
    () =>
      generateMeihua(SAMPLE_DATE, {
        method: 'character',
        characterText: '西林',
        characterStrokeCounts: [Number.MAX_SAFE_INTEGER, 1],
      }),
    /总取数超出安全整数范围/,
  );
  assert.throws(
    () =>
      generateMeihua(SAMPLE_DATE, {
        method: 'character',
        characterText: '西林',
        characterStrokeCounts: [7, 8],
        characterLeftStrokes: 3,
      }),
    /左右分笔数只适用于单字起卦/,
  );
});

test('梅花：方位物类取数与同卦体用应按动爻位置记录', () => {
  const data = generateMeihua(SAMPLE_DATE, {
    method: 'direction',
    direction: 'south',
    objectType: 'fire',
  });

  assert.equal(data.calculation?.methodKey, 'direction');
  assert.equal(data.calculation?.objectType, 'fire');
  assert.equal(data.calculation?.direction, 'south');
  assert.equal(data.calculation?.objectTrigramIndex, 3);
  assert.equal(data.calculation?.directionTrigramIndex, 3);
  assert.equal(data.calculation?.timeZhiIndex, 5);
  assert.equal(data.calculation?.movingYaoIndex, 5);
  assert.equal(data.mainHexagram.upper, '离');
  assert.equal(data.mainHexagram.lower, '离');
  assert.equal(data.movingYao.position, 5);
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.tiYong),
    ['体', '体', '体', '用', '用', '用'],
  );
  assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
  assert.match(data.evidenceAnalysis?.calculationFact.promptText || '', /方位取象/);
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'direction', direction: 'south' }),
    /必须提供 direction 和 objectType/,
  );

  const expected = structuredClone(data);
  const promptOptions = {
    method: 'meihua' as const,
    question: '方位物类与本次动爻如何对应？',
    currentTime: SAMPLE_DATE,
  };
  const expectedPrompt = buildDivinationPrompt({ ...promptOptions, data });
  assert.match(expectedPrompt, /所见物类火（离）取上卦数3，方位正南（离）取下卦数3/u);
  const expectedOptions = getMeihuaSelectionOptions();
  const originalDirections = [...MEIHUA_DIRECTION_OPTIONS];
  const originalObjects = [...MEIHUA_OBJECT_OPTIONS];
  const directionValues = structuredClone(originalDirections);
  const objectValues = structuredClone(originalObjects);
  const assertFixedResult = () => {
    const fresh = generateMeihua(SAMPLE_DATE, {
      method: 'direction',
      direction: 'south',
      objectType: 'fire',
    });
    assert.deepEqual(fresh, expected);
    assert.deepEqual(analyzeMeihuaEvidence(structuredClone(data)), expected.evidenceAnalysis);
    assert.equal(buildDivinationPrompt({ ...promptOptions, data: fresh }), expectedPrompt);
  };
  try {
    MEIHUA_DIRECTION_OPTIONS[2].label = '改写的南方（坎）';
    MEIHUA_OBJECT_OPTIONS[2].label = '改写的火类（水）';
    assert.equal(MEIHUA_DIRECTION_OPTIONS[2].label, '改写的南方（坎）');
    assert.equal(MEIHUA_OBJECT_OPTIONS[2].label, '改写的火类（水）');
    assertFixedResult();

    [MEIHUA_DIRECTION_OPTIONS[0], MEIHUA_DIRECTION_OPTIONS[2]] = [
      MEIHUA_DIRECTION_OPTIONS[2],
      MEIHUA_DIRECTION_OPTIONS[0],
    ];
    [MEIHUA_OBJECT_OPTIONS[0], MEIHUA_OBJECT_OPTIONS[2]] = [
      MEIHUA_OBJECT_OPTIONS[2],
      MEIHUA_OBJECT_OPTIONS[0],
    ];
    assert.equal(MEIHUA_DIRECTION_OPTIONS[0].value, 'south');
    assert.equal(MEIHUA_OBJECT_OPTIONS[0].value, 'fire');
    assertFixedResult();

    const copy = getMeihuaSelectionOptions();
    assert.deepEqual(copy, expectedOptions);
    assert.notStrictEqual(copy.directions, MEIHUA_DIRECTION_OPTIONS);
    assert.notStrictEqual(copy.objects, MEIHUA_OBJECT_OPTIONS);
    assert.notStrictEqual(copy.directions[2], originalDirections[2]);
    assert.notStrictEqual(copy.objects[2], originalObjects[2]);
    copy.directions[2].label = '副本南方（坎）';
    copy.objects[2].label = '副本火类（水）';
    copy.directions.reverse();
    copy.objects.reverse();
    assert.equal(copy.directions.find((item) => item.value === 'south')?.label, '副本南方（坎）');
    assert.equal(copy.objects.find((item) => item.value === 'fire')?.label, '副本火类（水）');
    const nextCopy = getMeihuaSelectionOptions();
    assert.deepEqual(nextCopy, expectedOptions);
    assert.notStrictEqual(
      nextCopy.directions[2],
      copy.directions.find((item) => item.value === 'south'),
    );
    assert.notStrictEqual(
      nextCopy.objects[2],
      copy.objects.find((item) => item.value === 'fire'),
    );
    assertFixedResult();
  } finally {
    originalDirections.forEach((item, index) => Object.assign(item, directionValues[index]));
    originalObjects.forEach((item, index) => Object.assign(item, objectValues[index]));
    MEIHUA_DIRECTION_OPTIONS.splice(0, MEIHUA_DIRECTION_OPTIONS.length, ...originalDirections);
    MEIHUA_OBJECT_OPTIONS.splice(0, MEIHUA_OBJECT_OPTIONS.length, ...originalObjects);
  }
  assert.deepEqual(MEIHUA_DIRECTION_OPTIONS, directionValues);
  assert.deepEqual(MEIHUA_OBJECT_OPTIONS, objectValues);
  assert.ok(MEIHUA_DIRECTION_OPTIONS.every((item, index) => item === originalDirections[index]));
  assert.ok(MEIHUA_OBJECT_OPTIONS.every((item, index) => item === originalObjects[index]));
  assert.deepEqual(data, expected);
  assertFixedResult();
});

test('梅花：六十四卦查询应拒绝越界八卦索引，不应取模折回', () => {
  assert.throws(() => findHexagramByTrigrams(9, 1), /上卦索引必须在 1-8 之间/);
  assert.throws(() => findHexagramByTrigrams(1, 0), /下卦索引必须在 1-8 之间/);
});

test('梅花：体用判定应拒绝非法动爻位置', () => {
  const upper = { name: '乾', element: '金', nature: '天' };
  const lower = { name: '坤', element: '土', nature: '地' };

  assert.throws(() => resolveTiYongByMovingYao(upper, lower, 0), /动爻位置必须在 1-6 之间/);
  assert.throws(() => resolveTiYongByMovingYao(upper, lower, 7), /动爻位置必须在 1-6 之间/);
  assert.throws(() => resolveTiYongByMovingYao(upper, lower, 3.5), /动爻位置必须在 1-6 之间/);
});

test('梅花：按月份取季节应拒绝越界月份，不应默认归入冬季', () => {
  assert.equal(MeihuaHelpers.getSeasonByMonth(12), '冬');
  assert.throws(() => MeihuaHelpers.getSeasonByMonth(0), /月份必须是 1-12/);
  assert.throws(() => MeihuaHelpers.getSeasonByMonth(13), /月份必须是 1-12/);
});

test('梅花：低层时间起卦应拒绝坏农历月日和坏时支', () => {
  const validGanzhi = { year: '甲辰', month: '丁丑', day: '庚午', hour: '庚辰' };
  const validLunar = {
    yearInChinese: '农历甲辰',
    monthNumber: 12,
    dayNumber: 2,
  } as Parameters<typeof resolveTimeMethod>[1];

  assert.throws(
    () => resolveTimeMethod(validGanzhi, { ...validLunar, monthNumber: 13 }),
    /农历月份必须是 1-12/,
  );
  assert.throws(
    () => resolveTimeMethod(validGanzhi, { ...validLunar, dayNumber: 31 }),
    /农历日期必须是 1-30/,
  );
  assert.throws(
    () => resolveTimeMethod({ ...validGanzhi, hour: '庚A' }, validLunar),
    /无法识别时支/,
  );
  assert.throws(() => resolveNumberMethod(1, 'A'), /数字起卦无法识别起卦时辰/);
});

test('梅花：五行关系 helper 应拒绝非法五行，不应返回未知', () => {
  assert.equal(MeihuaHelpers.getElementRelation('火', '木'), '体生用');
  assert.throws(() => MeihuaHelpers.getElementRelation('', '木'), /用卦五行无效/);
  assert.throws(() => MeihuaHelpers.getElementSeasonState('风', '春'), /目标五行无效/);
});

test('梅花：应推导主互变事态演变趋势（三阶段趋势机）', () => {
  const result = generateMeihua(new Date('2025-06-18T10:30:00+08:00'));
  assert.ok(result.analysis.timelineTrend);
  assert.ok(result.analysis.timelineTrend.trend);
  assert.ok(result.analysis.timelineTrend.summary);
});

test('梅花：三阶段摘要必须列出互变真实关系，不把互卦未见克制概括为全盘顺畅', () => {
  const result = evaluateMeihuaTimelineTrend({
    tiElement: '木',
    originalYongElement: '木',
    interTiElement: '火',
    interYongElement: '木',
    changedYongElement: '木',
    changedTiElement: '木',
  });

  assert.equal(result.trend, '中途多阻');
  assert.equal(
    result.summary,
    '主卦用/体：比和；互卦：原体生体互、用互与原体比和；变卦用/体：比和',
  );
  assert.doesNotMatch(result.summary, /终成吉局|全盘通畅无大碍/);

  const changedTiResult = evaluateMeihuaTimelineTrend({
    tiElement: '木',
    originalYongElement: '木',
    interTiElement: '木',
    interYongElement: '木',
    changedYongElement: '木',
    changedTiElement: '火',
  });
  assert.match(changedTiResult.summary, /变卦用\/体：用生体/u);
});

test('梅花体克用且互卦比和时，不把未判定的三阶段关系写成平稳走势', () => {
  const result = evaluateMeihuaTimelineTrend({
    tiElement: '木',
    originalYongElement: '土',
    interTiElement: '木',
    interYongElement: '木',
    changedYongElement: '土',
  });

  assert.equal(result.trend, '未形成单向走势');
  assert.equal(
    result.summary,
    '主卦用/体：体克用；互卦：体互与原体比和、用互与原体比和；变卦用/体：体克用',
  );
});
