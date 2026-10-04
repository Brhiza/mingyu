import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  type BaZhaiInput,
} from '../packages/core/src/ba_zhai/index.ts';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';

test('八宅立春取年资料保留原民用钟表和实际已知精度', () => {
  const cases: { input: BaZhaiInput; birthFact: string; gua: string; status: string }[] = [
    {
      // UTC-12 的 2 月 3 日 23 时对应中国标准时间 2 月 4 日 19 时，已过 16:27:07 立春。
      input: {
        birthYear: 2024,
        birthMonth: 2,
        birthDay: 3,
        birthHour: 23,
        birthMinute: 0,
        birthSecond: 0,
        birthTimezone: -12,
        gender: 'male',
      },
      birthFact: '命卦取年资料：男，公历2024年2月3日；民用时刻23时0分0秒，取时按UTC-12:00。',
      gua: '震',
      status: '已核定',
    },
    {
      input: {
        birthYear: 2024,
        birthMonth: 2,
        birthDay: 4,
        birthHour: 3,
        birthMinute: 30,
        birthSecond: 8,
        birthTimeZoneId: 'America/New_York',
        birthTimezone: -5,
        gender: 'female',
      },
      birthFact:
        '命卦取年资料：女，公历2024年2月4日；民用时刻3时30分8秒，取时按America/New_York（UTC-05:00）。',
      gua: '震',
      status: '已核定',
    },
    {
      // 16:27:00..16:27:59 跨立春；女命前一年为坤，本年为震。
      input: {
        birthYear: 2024,
        birthMonth: 2,
        birthDay: 4,
        birthHour: 16,
        birthMinute: 27,
        gender: 'female',
      },
      birthFact:
        '命卦取年资料：女，公历2024年2月4日；民用时刻16时27分（秒数未提供），取时按UTC+08:00。',
      gua: '坤',
      status: '待复核',
    },
    {
      input: { birthYear: 2024, birthMonth: 2, birthDay: 4, birthHour: 16, gender: 'male' },
      birthFact:
        '命卦取年资料：男，公历2024年2月4日；民用时刻16时（分钟、秒数未提供），取时按UTC+08:00。',
      gua: '巽',
      status: '待复核',
    },
    {
      input: { birthYear: 2024, birthMonth: 2, birthDay: 4, gender: 'male' },
      birthFact: '命卦取年资料：男，公历2024年2月4日；出生时刻未提供，年界比较按中国标准时间正午。',
      gua: '巽',
      status: '待复核',
    },
    {
      input: { birthYear: 1990, gender: 'male' },
      birthFact: '命卦取年资料：男，公历1990年（月日未提供）。',
      gua: '坎',
      status: '待复核',
    },
  ];
  for (const { input, birthFact, gua, status } of cases) {
    const result = analyzeBaZhai(input);
    assert.ok(result.prompt.split('\n').includes(birthFact));
    assert.equal(result.mingGua, gua);
    assert.equal(result.birthYearBoundaryStatus, status);
    assert.equal(result.calculationInput.birthYear, input.birthYear);
    assert.equal(result.calculationInput.birthDay, input.birthDay);
    assert.equal(result.calculationInput.birthSecond, input.birthSecond);
    if (input.gender === 'female' && input.birthMinute === 27) {
      assert.match(result.prompt, /候选命卦：2023年坤命、2024年震命/);
      assert.doesNotMatch(result.prompt, /民用时刻16时27分0秒/);
    }
  }
});

test('八宅宅卦跨界时提示词并列候选并标明中心读数盘', () => {
  const result = analyzeBaZhaiByDoorDegree({
    birthYear: 1990,
    gender: 'male',
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.equal(result.directionMeasurement.trueNorthDegree, 65);
  assert.equal(result.directionMeasurement.stability, '宅卦不稳定');
  assert.deepEqual(
    result.directionMeasurement.candidateDirections.map((item) => [
      item.label,
      item.houseGua,
      item.match,
    ]),
    [
      ['寅山申向', '艮', '相冲'],
      ['甲山庚向', '震', '相合'],
    ],
  );
  assert.match(result.prompt, /候选坐向：寅山申向（艮宅、命宅相冲）、甲山庚向（震宅、命宅相合）/);
  assert.match(result.prompt, /宅卦：艮（西四宅，中心读数）/);
  assert.match(result.prompt, /命宅配合：相冲（暂按命卦）（中心读数）/);
  assert.match(result.prompt, /宅卦八方（中心读数）：/);
  assert.match(result.prompt, /【任务】[\s\S]*【盘面资料】/);
  assert.match(result.prompt, /候选震宅八方：[\s\S]*东伏位/);
  assert.match(result.prompt, /【传统依据】[\s\S]*大游年八方/);

  const stable = analyzeBaZhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 0,
    northReference: 'true',
  });
  assert.equal(stable.directionMeasurement.stability, '稳定');
  assert.doesNotMatch(stable.prompt, /^坐山：|^命宅关系：/mu);
  assert.match(stable.prompt, /^命宅五行：命卦与宅卦比和。$/mu);
  assert.doesNotMatch(stable.prompt, /命卦取年资料|公历|民用时刻/);
  assert.doesNotMatch(stable.prompt, /候选坐向|中心读数/);
  assert.match(stable.prompt, /测向资料：站在大门处面向屋内测量，读数0°，北向基准真北/);
  assert.match(stable.prompt, /换算为子山午向，距最近二十四山分界7\.5°，测量状态稳定/);
  for (const [chart, orientation] of [
    [result, '寅山申向'],
    [stable, '子山午向'],
  ] as const) {
    const expectations = extractDivinationPromptFacts('bazhai', chart);
    assert.deepEqual(auditPromptFacts(chart.prompt, expectations).missing, []);
    const measurementLine = chart.prompt.split('\n').find((line) => line.startsWith('测向资料：'))!;
    assert.ok(measurementLine.includes(orientation));
    for (const changedLine of ['', measurementLine.replace(orientation, '午山子向')]) {
      assert.deepEqual(
        auditPromptFacts(chart.prompt.replace(measurementLine, changedLine), expectations).missing,
        ['bazhai.orientation'],
      );
    }
  }
});

test('八宅同宅卦跨山界时提示词保留候选山向和测向事实', () => {
  const result = analyzeBaZhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 7,
    northReference: 'true',
    measurementUncertaintyDegrees: 1,
  });
  assert.equal(result.directionMeasurement.stability, '山向边界敏感');
  assert.match(result.prompt, /读数7°，北向基准真北/);
  assert.match(result.prompt, /候选坐向：子山午向、癸山丁向；宅卦仍属坎/);
});

test('八宅未声明北向时只把原始角度标为暂算依据', () => {
  const result = analyzeBaZhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 0,
  });

  assert.match(
    result.directionMeasurement.promptText,
    /北向基准未声明；按原始读数 0°暂算入户方向（非已确认真北）/,
  );
  assert.match(result.prompt, /北向基准未声明；以下坐向按原始读数暂算/);
  assert.match(result.evidenceAnalysis.measurementFact.promptText, /北向基准未声明/);
  assert.match(result.evidenceAnalysis.measurementCandidateFacts[0].promptText, /按原始读数暂算/);
  assert.match(
    result.evidenceAnalysis.measurementCandidateFacts[0].limitation,
    /不代表真北坐向范围/,
  );
  assert.doesNotMatch(result.evidenceAnalysis.promptText, /真北口径0°|换算真北口径为0°/);
});
