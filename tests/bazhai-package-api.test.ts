import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBaZhai,
  analyzeBaZhaiEvidence,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
} from 'mingyu-core/bazhai';
import { TWENTY_FOUR_MOUNTAINS } from '../packages/core/src/direction/index.ts';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';
import { assertPromptIsPortableTaskText } from './prompt-assertions.ts';

const TRIGRAMS = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
const EAST_TRIGRAMS = new Set(['坎', '震', '巽', '离']);

test('八宅显式空命卦与空坐山不能被出生资料或个人盘掩盖', () => {
  assert.throws(() => analyzeBaZhai({ birthYear: 1990, gender: 'male', mingGua: '' }), /八卦无效/);
  assert.throws(() => analyzeBaZhai({ mingGua: '坎', sitMountain: '' }), /坐山无效/);
});

test('八宅低年份立春换年保留原始公历年份', () => {
  for (const item of [
    { year: 20, beforeGua: '坎', afterGua: '离' },
    { year: 50, beforeGua: '兑', afterGua: '乾' },
  ]) {
    const before = analyzeBaZhai({
      birthYear: item.year,
      birthMonth: 2,
      birthDay: 5,
      gender: 'male',
    });
    const after = analyzeBaZhai({
      birthYear: item.year,
      birthMonth: 2,
      birthDay: 7,
      gender: 'male',
    });
    assert.equal(before.effectiveBirthYear, item.year - 1);
    assert.equal(before.mingGua, item.beforeGua);
    assert.equal(after.effectiveBirthYear, item.year);
    assert.equal(after.mingGua, item.afterGua);
  }
});

test('八宅公元 1 年立春前应保留原始公历年并传递天文年 0', () => {
  const result = analyzeBaZhai({
    birthYear: 1,
    birthMonth: 1,
    birthDay: 1,
    gender: 'male',
  });
  assert.equal(result.calculationInput.birthYear, 1);
  assert.equal(result.effectiveBirthYear, 0);
  assert.equal(result.mingGua, '坤');
  assert.match(result.birthYearBoundaryNote, /1 年立春前/);
  assert.match(result.birthYearBoundaryNote, /公元前1年（天文年0）/);
  const female = analyzeBaZhai({ birthYear: 1, birthMonth: 1, birthDay: 1, gender: 'female' });
  assert.equal(female.effectiveBirthYear, 0);
  assert.equal(female.mingGua, '巽');
  assert.equal(
    analyzeBaZhai({ birthYear: 1, birthMonth: 7, birthDay: 1, gender: 'male' }).effectiveBirthYear,
    1,
  );
});

test('八宅立春日期换年与缺少时刻的复核状态保持一致', () => {
  const before = analyzeBaZhai({
    birthYear: 2024,
    birthMonth: 2,
    birthDay: 4,
    gender: 'male',
  });
  const after = analyzeBaZhai({
    birthYear: 2024,
    birthMonth: 2,
    birthDay: 5,
    gender: 'male',
  });

  assert.equal(before.effectiveBirthYear, 2023);
  assert.equal(before.mingGua, '巽');
  assert.equal(after.effectiveBirthYear, 2024);
  assert.equal(after.mingGua, '震');
  assert.match(before.birthYearBoundaryNote, /立春同日，未提供出生时刻/);
  assert.match(before.birthYearBoundaryNote, /按当日正午与立春时刻比较/);
  assert.match(before.prompt, /立春同日，未提供出生时刻/);
  assert.equal(before.evidenceAnalysis.calculationFact.yearBoundaryStatus, '待复核');
  assert.match(before.evidenceAnalysis.calculationFact.promptText, /年界待复核/);
  assertPromptIsPortableTaskText(before.prompt);
  assert.match(
    before.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '命卦年界')
      ?.promptText ?? '',
    /未提供出生时刻/,
  );
  assert.equal(before.evidenceAnalysis.summaryFact.status, '证据链有缺口');
});

test('八宅立春当天已知出生时分按真实瞬时核定命卦', () => {
  const base = { birthYear: 2024, birthMonth: 2, birthDay: 4, gender: 'male' as const };
  const before = analyzeBaZhai({ ...base, birthHour: 16, birthMinute: 20 });
  const after = analyzeBaZhai({ ...base, birthHour: 16, birthMinute: 30 });
  const overseas = analyzeBaZhai({
    ...base,
    birthHour: 3,
    birthMinute: 30,
    birthTimezone: -5,
  });

  assert.equal(before.mingGua, '巽');
  assert.equal(after.mingGua, '震');
  assert.equal(overseas.mingGua, after.mingGua);
  const crossDate = analyzeBaZhai({
    birthYear: 2024,
    birthMonth: 2,
    birthDay: 3,
    birthHour: 23,
    birthMinute: 0,
    birthTimezone: -12,
    gender: 'male',
  });
  assert.equal(crossDate.mingGua, '震');
  assert.match(crossDate.birthYearBoundaryNote, /出生时刻已过/);
  assert.equal(after.evidenceAnalysis.calculationFact.yearBoundaryStatus, '已核定');
  assert.match(after.prompt, /已按出生时分（UTC\+08:00）与立春瞬时核定/);
  assert.doesNotMatch(after.prompt, /未提供出生时刻/);
});

test('八宅立春同小时或同分钟的缺失精度保留候选命卦', () => {
  const base = { birthYear: 2024, birthMonth: 2, birthDay: 4, gender: 'male' as const };
  for (const input of [{ birthHour: 16 }, { birthHour: 16, birthMinute: 27 }]) {
    const result = analyzeBaZhai({ ...base, ...input });
    assert.equal(result.effectiveBirthYear, 2023);
    assert.equal(result.birthYearBoundaryStatus, '待复核');
    assert.equal(result.evidenceAnalysis.calculationFact.yearBoundaryStatus, '待复核');
    assert.equal(
      result.evidenceAnalysis.calculationFact.steps.find((step) => step.stage === '命卦计算')
        ?.status,
      '待复核',
    );
    assert.equal(result.evidenceAnalysis.summaryFact.status, '证据链有缺口');
    assert.match(result.birthYearBoundaryNote, /候选命卦：2023年巽命、2024年震命/);
    assert.match(result.prompt, /命卦：巽（东四命，暂按）/);
    assertPromptIsPortableTaskText(result.prompt);
    assert.match(
      result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '命卦年界')
        ?.promptText ?? '',
      /时刻精度不足/,
    );
  }

  const before = analyzeBaZhai({ ...base, birthHour: 16, birthMinute: 26 });
  const after = analyzeBaZhai({ ...base, birthHour: 16, birthMinute: 28 });
  assert.equal(before.birthYearBoundaryStatus, '已核定');
  assert.equal(after.birthYearBoundaryStatus, '已核定');
  assert.equal(after.mingGua, '震');

  const overseas = analyzeBaZhai({
    ...base,
    birthHour: 3,
    birthMinute: 27,
    birthTimezone: -5,
  });
  assert.equal(overseas.birthYearBoundaryStatus, '待复核');
});

test('八宅立春同分钟以出生秒数核定年界并校验秒数输入', () => {
  const birth = {
    birthYear: 2024,
    birthMonth: 2,
    birthDay: 4,
    birthHour: 16,
    birthMinute: 27,
    gender: 'male' as const,
  };
  const before = analyzeBaZhai({ ...birth, birthSecond: 6 });
  const atBoundary = analyzeBaZhai({ ...birth, birthSecond: 7 });
  const after = analyzeBaZhai({ ...birth, birthSecond: 8 });
  assert.equal(before.effectiveBirthYear, 2023);
  assert.equal(atBoundary.effectiveBirthYear, 2024);
  assert.equal(after.effectiveBirthYear, 2024);
  assert.equal(before.birthYearBoundaryStatus, '已核定');
  assert.equal(atBoundary.birthYearBoundaryStatus, '已核定');
  assert.equal(after.birthYearBoundaryStatus, '已核定');
  assert.equal(after.calculationInput.birthSecond, 8);
  assert.equal(
    after.evidenceAnalysis.calculationFact.steps.find((step) => step.stage === '命卦年界')?.inputs
      .birthSecond,
    8,
  );
  assert.match(after.birthYearBoundaryNote, /出生时分秒/);
  assertPromptIsPortableTaskText(after.prompt);
  assert.throws(() => analyzeBaZhai({ ...birth, birthSecond: 60 }), /出生秒数需在 0-59/);
  assert.throws(
    () => analyzeBaZhai({ ...birth, birthMinute: undefined, birthSecond: 8 }),
    /需同时提供出生小时和分钟/,
  );
});

test('八宅立春年界按上海历史时区复核出生时分', () => {
  const birth = {
    birthYear: 1942,
    birthMonth: 2,
    birthDay: 4,
    gender: 'male' as const,
    birthTimeZoneId: 'Asia/Shanghai',
  };
  const historicalBefore = analyzeBaZhai({ ...birth, birthHour: 19, birthMinute: 0 });
  const historicalAfter = analyzeBaZhai({ ...birth, birthHour: 20, birthMinute: 0 });
  const fixedEight = analyzeBaZhai({
    ...birth,
    birthTimeZoneId: undefined,
    birthTimezone: 8,
    birthHour: 19,
    birthMinute: 0,
  });

  assert.equal(historicalBefore.effectiveBirthYear, 1941);
  assert.equal(historicalAfter.effectiveBirthYear, 1942);
  assert.equal(fixedEight.effectiveBirthYear, 1942);
  assert.match(historicalBefore.prompt, /Asia\/Shanghai，UTC\+09:00/);

  for (const birthTimeZoneId of ['', false, 0, null, ' \t']) {
    assert.throws(
      () =>
        analyzeBaZhai({
          ...birth,
          birthHour: 19,
          birthMinute: 0,
          birthTimeZoneId: birthTimeZoneId as unknown as string,
        }),
      /IANA 时区名不能为空|timeZoneId 必须是 IANA 时区名称/u,
    );
  }
  const zeroClock = analyzeBaZhai({
    ...birth,
    birthTimeZoneId: undefined,
    birthTimezone: 0,
    birthHour: 0,
    birthMinute: 0,
    birthSecond: 0,
  });
  assert.equal(zeroClock.effectiveBirthYear, 1941);
  assert.equal(zeroClock.calculationInput.birthTimezone, 0);
  assert.equal(zeroClock.calculationInput.birthHour, 0);
  assert.equal(zeroClock.calculationInput.birthMinute, 0);
  assert.equal(zeroClock.calculationInput.birthSecond, 0);
  assert.match(zeroClock.prompt, /民用时刻0时0分0秒，取时按UTC\+00:00/u);
});

test('八宅大游年应符合八宅逐宫传统真值', () => {
  const palaceOrder = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];
  const cases = [
    {
      mingGua: '乾',
      labels: ['六煞', '天医', '五鬼', '祸害', '绝命', '延年', '生气', '伏位'],
    },
    {
      mingGua: '坎',
      labels: ['伏位', '五鬼', '天医', '生气', '延年', '绝命', '祸害', '六煞'],
    },
    {
      mingGua: '艮',
      labels: ['五鬼', '伏位', '六煞', '绝命', '祸害', '生气', '延年', '天医'],
    },
    {
      mingGua: '震',
      labels: ['天医', '六煞', '伏位', '延年', '生气', '祸害', '绝命', '五鬼'],
    },
    {
      mingGua: '巽',
      labels: ['生气', '绝命', '延年', '伏位', '天医', '五鬼', '六煞', '祸害'],
    },
    {
      mingGua: '离',
      labels: ['延年', '祸害', '生气', '天医', '伏位', '六煞', '五鬼', '绝命'],
    },
    {
      mingGua: '坤',
      labels: ['绝命', '生气', '祸害', '五鬼', '六煞', '伏位', '天医', '延年'],
    },
    {
      mingGua: '兑',
      labels: ['祸害', '延年', '绝命', '六煞', '五鬼', '天医', '伏位', '生气'],
    },
  ];

  for (const item of cases) {
    const result = analyzeBaZhai({ mingGua: item.mingGua });
    assert.deepEqual(
      result.mingPalace.map((palace) => palace.gua),
      palaceOrder,
    );
    assert.deepEqual(
      result.mingPalace.map((palace) => palace.label),
      item.labels,
    );
  }
});

test('命卦与宅卦分组分别写作东四命和东四宅，并贯通候选与证据', () => {
  const result = analyzeBaZhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 65,
    northReference: 'true',
    measurementUncertaintyDegrees: 3,
  });
  assert.equal(result.mingGroup, '东四命');
  assert.equal(result.houseGroup, '西四宅');
  assert.equal(result.match, '相冲');
  assert.deepEqual(
    result.directionMeasurement.candidateDirections.map((item) => [item.houseGroup, item.match]),
    [
      ['西四宅', '相冲'],
      ['东四宅', '相合'],
    ],
  );
  assert.deepEqual(
    result.evidenceAnalysis.measurementCandidates.map((item) => item.houseGroup),
    ['西四宅', '东四宅'],
  );
  assert.match(result.prompt, /命卦：坎（东四命）/);
  assert.match(result.prompt, /宅卦：艮（西四宅）/);
  assert.equal(
    result.prompt.split('以下宅卦、命宅配合、命宅五行及宅卦八方与星宫关系按中心读数列示。').length -
      1,
    1,
  );
  assert.match(
    result.prompt,
    /命宅五行：宅卦克命卦。[\s\S]*宅卦星宫生克（伏位取左辅木）：[\s\S]*候选震宅八方：/,
  );
  assert.match(result.gasRegulation!.doorMasterSummary, /坎命属东四命，艮宅属西四宅；命宅异组/);
  assert.match(result.evidenceAnalysis.promptText, /艮宅西四宅/);
  assert.doesNotMatch(result.prompt, /艮宅属西四命|宅卦：艮（西四命/);
  assert.equal(result.evidenceAnalysis.calculationFact.yearBoundaryStatus, '直接命卦');
  assert.equal(result.directionMeasurement.stability, '宅卦不稳定');
  assert.equal(result.evidenceAnalysis.summaryFact.status, '证据链有缺口');
});

test('mingyu-core/bazhai 应公开入户度数便捷接口和完整类型结果', () => {
  const position = getBaZhaiSitFacingFromDoorDegree(90);
  assert.equal(position.sit.degree, 90);
  assert.equal(position.facing.degree, 270);

  const result = analyzeBaZhaiByDoorDegree({
    birthYear: 1990,
    birthMonth: 6,
    birthDay: 15,
    gender: 'male',
    doorToInteriorDegree: 90,
    northReference: 'true',
  });
  assert.equal(result.directionMeasurement.sitMountain, '卯');
  assert.equal(result.directionMeasurement.facingMountain, '酉');
  assert.equal(result.directionMeasurement.method, '站在大门处面向屋内测量');
  assert.equal(result.directionMeasurement.stability, '稳定');
  assert.equal(result.directionMeasurement.candidateDirections.length, 1);
  assert.equal(result.evidenceAnalysis.evidence.title, '八宅命宅方位与测量结构化证据');
  assert.equal(result.evidenceAnalysis.key, 'bazhai:evidence');
  assert.equal(result.evidenceAnalysis.status, '已计算');
  assert.equal(result.evidenceAnalysis.directionFacts.length, 8);
  assert.ok(
    result.evidenceAnalysis.directionFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.calculationStepKeys.length > 0 &&
        item.sources.length >= 2 &&
        item.calculation.includes('查大游年表') &&
        item.limitation.includes('不证明房间适用性'),
    ),
  );
  assert.match(result.evidenceAnalysis.promptText, /测量误差±0°/);
  assert.equal(result.evidenceAnalysis.counterSummaryFact.status, '未见额外反证');
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '命卦年界')?.status,
    '已核定',
  );
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '北向基准')?.status,
    '已覆盖',
  );
  assert.equal(result.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(result.evidenceAnalysis.summaryFact.key, 'bazhai:evidence-summary');
  assert.equal(result.evidenceAnalysis.summaryFact.status, '命宅链完整');
  assert.equal(
    result.evidenceAnalysis.summaryFact.directionFactCount,
    result.evidenceAnalysis.directionFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.alignedDirectionCount,
    result.evidenceAnalysis.alignedDirections.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.conflictingDirectionCount,
    result.evidenceAnalysis.conflictingDirections.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.measurementCandidateCount,
    result.evidenceAnalysis.measurementCandidateFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.counterEvidenceCount,
    result.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.limitationFactCount,
    result.evidenceAnalysis.limitationFacts.length,
  );
  const factKeys = new Set([
    result.evidenceAnalysis.summaryFact.key,
    ...result.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    result.evidenceAnalysis.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    result.evidenceAnalysis.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(result.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制：/);
  assert.ok(result.housePalace);
  assert.equal(result.housePalace?.length, 8);
  const northMing = result.mingPalace.find((palace) => palace.gua === '坎')!;
  const northHouse = result.housePalace!.find((palace) => palace.gua === '坎')!;
  assert.equal(result.mingGua, '坎');
  assert.equal(result.houseGua, '震');
  assert.deepEqual([northMing.direction, northMing.label, northMing.luck], ['北', '伏位', '吉']);
  assert.deepEqual([northHouse.direction, northHouse.label, northHouse.luck], ['北', '天医', '吉']);
  assert.deepEqual(
    analyzeBaZhaiEvidence(result, result.directionMeasurement),
    result.evidenceAnalysis,
  );
  const restored = JSON.parse(JSON.stringify(result)) as typeof result;
  assert.equal(JSON.stringify(restored), JSON.stringify(result));
  assert.deepEqual(
    analyzeBaZhaiEvidence(restored, restored.directionMeasurement),
    result.evidenceAnalysis,
  );
  assert.deepEqual(analyzeBaZhaiEvidence(restored), analyzeBaZhaiEvidence(result));
  const changed = structuredClone(result);
  for (const palace of [changed.mingPalace[0], changed.housePalace![0]]) {
    const original = structuredClone(palace);
    assert.equal(Reflect.set(palace, 'label', '生气'), true);
    assert.equal(palace.label, '生气');
    assert.throws(
      () => analyzeBaZhaiEvidence(changed, changed.directionMeasurement),
      /八宅方位记录与命卦或宅卦大游年表不一致/u,
    );
    Object.assign(palace, original);
    assert.deepEqual(
      analyzeBaZhaiEvidence(changed, changed.directionMeasurement),
      result.evidenceAnalysis,
    );
  }
});

test('八宅测量应换算磁北并识别跨宅卦边界的不稳定候选', () => {
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
    result.directionMeasurement.candidateDirections.map((item) => item.sitMountain),
    ['寅', '甲'],
  );
  assert.deepEqual(
    Array.from(
      new Set(result.directionMeasurement.candidateDirections.map((item) => item.houseGua)),
    ),
    ['艮', '震'],
  );
  assert.ok(
    result.directionMeasurement.candidateDirections.every((item) => item.housePalace.length === 8),
  );
  assert.deepEqual(
    result.directionMeasurement.candidateDirections.map((item) => item.match),
    ['相冲', '相合'],
  );
  assert.deepEqual(
    result.evidenceAnalysis.measurementCandidates.map((item) => item.sitMountain),
    ['寅', '甲'],
  );
  assert.ok(
    result.evidenceAnalysis.evidence.items.some(
      (item) => item.title === '入户坐向测量宅卦不稳定' && item.level === '反证',
    ),
  );
  assert.match(result.evidenceAnalysis.promptText, /候选明细.*寅山申向.*甲山庚向/s);
  assert.match(result.directionMeasurement.promptText, /磁偏角 1°/);
  assert.match(result.directionMeasurement.promptText, /测量稳定性为宅卦不稳定/);
  assert.match(result.directionMeasurement.promptText, /误差候选.*寅山申向.*甲山庚向/s);
  assert.match(result.directionMeasurement.promptText, /候选寅山申向：艮宅八宫为/);
  assert.match(result.directionMeasurement.promptText, /候选甲山庚向：震宅八宫为/);
  assert.doesNotMatch(result.directionMeasurement.promptText, /不能只采用单一八宅盘/);
  assert.ok(
    result.evidenceAnalysis.counterEvidence.some((item) =>
      item.includes('中心读数不能作为唯一宅卦主证'),
    ),
  );
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '山向边界稳定性')
      ?.status,
    '边界敏感',
  );
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '宅卦边界稳定性')
      ?.status,
    '不稳定',
  );
  assert.equal(result.evidenceAnalysis.counterSummaryFact.status, '存在需保留反证');
  assert.ok(result.evidenceAnalysis.counterSummaryFact.factKeys.length >= 2);
  assert.equal(result.evidenceAnalysis.summaryFact.status, '证据链有缺口');
});

test('八宅磁北读数缺少磁偏角时应拒绝生成伪精确坐向', () => {
  assert.throws(
    () =>
      analyzeBaZhaiByDoorDegree({
        birthYear: 1990,
        gender: 'male',
        doorToInteriorDegree: 90,
        northReference: 'magnetic',
      }),
    /必须提供当地磁偏角/,
  );
});

test('八宅入户度数入口应拒绝越界度数，不能静默归一化', () => {
  for (const degree of [-1, 361, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () =>
        analyzeBaZhaiByDoorDegree({
          birthYear: 1990,
          gender: 'male',
          doorToInteriorDegree: degree,
        }),
      /0-360 之间的有限数字/,
    );
  }
});

test('八宅八命卦乘二十四山的 192 盘应保持八宫和命宅关系完整', () => {
  for (const mingGua of TRIGRAMS) {
    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      const result = analyzeBaZhai({ mingGua, sitMountain });
      const expectedMatch =
        EAST_TRIGRAMS.has(result.mingGua) === EAST_TRIGRAMS.has(result.houseGua || '')
          ? '相合'
          : '相冲';

      assert.equal(result.mingGua, mingGua);
      assert.ok(TRIGRAMS.includes(result.houseGua || ''));
      assert.equal(result.mingPalace.length, 8);
      assert.equal(result.housePalace?.length, 8);
      assert.equal(result.luckyDirections.length, 4);
      assert.equal(result.unluckyDirections.length, 4);
      assert.equal(new Set(result.mingPalace.map((palace) => palace.gua)).size, 8);
      assert.equal(new Set(result.mingPalace.map((palace) => palace.direction)).size, 8);
      assert.equal(new Set(result.housePalace?.map((palace) => palace.gua)).size, 8);
      assert.equal(result.match, expectedMatch);
    }
  }
});

test('八宅 0 至 360 度应首尾一致，二十四山分界前后连续且严格反向', () => {
  const atZero = getBaZhaiSitFacingFromDoorDegree(0);
  const atFullCircle = getBaZhaiSitFacingFromDoorDegree(360);
  assert.deepEqual(atFullCircle, atZero);

  for (let degree = 0; degree < 360; degree += 1) {
    const position = getBaZhaiSitFacingFromDoorDegree(degree);
    const sitIndex = TWENTY_FOUR_MOUNTAINS.indexOf(position.sit.mountain);
    const facingIndex = TWENTY_FOUR_MOUNTAINS.indexOf(position.facing.mountain);

    assert.notEqual(sitIndex, -1);
    assert.equal(facingIndex, (sitIndex + 12) % 24);
    assert.equal(position.sit.degree, degree);
    assert.equal(position.facing.degree, (degree + 180) % 360);
  }

  for (let boundaryIndex = 0; boundaryIndex < 24; boundaryIndex += 1) {
    const boundary = 7.5 + boundaryIndex * 15;
    const below = getBaZhaiSitFacingFromDoorDegree(boundary - 0.001);
    const exact = getBaZhaiSitFacingFromDoorDegree(boundary);
    const above = getBaZhaiSitFacingFromDoorDegree(boundary + 0.001);
    const belowIndex = TWENTY_FOUR_MOUNTAINS.indexOf(below.sit.mountain);
    const aboveIndex = TWENTY_FOUR_MOUNTAINS.indexOf(above.sit.mountain);

    assert.equal(exact.sit.isBoundary, true);
    assert.notEqual(below.sit.mountain, above.sit.mountain);
    assert.equal(aboveIndex, (belowIndex + 1) % 24);
    assert.deepEqual(exact.sit.boundaryMountains, [below.sit.mountain, above.sit.mountain]);
  }
});

test('八宅逐宫计算星宫生克，并区分命宅分组与五行关系', () => {
  const equal = analyzeBaZhai({ mingGua: '坎', sitMountain: '子' });
  const sameGroup = analyzeBaZhai({ mingGua: '坎', sitMountain: '午' });
  const otherGroup = analyzeBaZhai({ mingGua: '坎', sitMountain: '乾' });
  assert.match(equal.gasRegulation!.doorMasterSummary, /同组，五行关系为命卦与宅卦比和/);
  assert.match(sameGroup.gasRegulation!.doorMasterSummary, /同组，五行关系为命卦克宅卦/);
  assert.match(otherGroup.gasRegulation!.doorMasterSummary, /异组，五行关系为宅卦生命卦/);
  for (const [result, sitMountain, house, group, match, relation] of [
    [equal, '子', '坎', '东四宅', '相合', '命卦与宅卦比和'],
    [sameGroup, '午', '离', '东四宅', '相合', '命卦克宅卦'],
    [otherGroup, '乾', '乾', '西四宅', '相冲', '宅卦生命卦'],
  ] as const) {
    const lines = result.prompt.split('\n');
    assert.equal(lines.filter((line) => line === `坐山：${sitMountain}`).length, 1);
    assert.equal(lines.filter((line) => line === '命卦：坎（东四命）').length, 1);
    assert.equal(lines.filter((line) => line === `宅卦：${house}（${group}）`).length, 1);
    assert.equal(lines.filter((line) => line === `命宅配合：${match}`).length, 1);
    assert.equal(lines.filter((line) => line === `命宅五行：${relation}。`).length, 1);
    assert.doesNotMatch(result.prompt, /^命宅关系：/mu);
    const expectations = extractDivinationPromptFacts('bazhai', result);
    assert.ok(expectations.some((fact) => fact.id === 'bazhai.orientation'));
    assert.deepEqual(auditPromptFacts(result.prompt, expectations).missing, []);
    for (const changedPrompt of [
      result.prompt.replace(`坐山：${sitMountain}\n`, ''),
      result.prompt.replace(`坐山：${sitMountain}`, '坐山：卯'),
    ]) {
      assert.deepEqual(auditPromptFacts(changedPrompt, expectations).missing, [
        'bazhai.orientation',
      ]);
    }
  }
  const elements: Record<string, string> = {
    坎: '水',
    艮: '土',
    震: '木',
    巽: '木',
    离: '火',
    坤: '土',
    兑: '金',
    乾: '金',
  };
  const stars: Record<string, string> = {
    生气: '木',
    天医: '土',
    延年: '金',
    伏位: '木',
    绝命: '金',
    五鬼: '火',
    六煞: '水',
    祸害: '土',
  };
  const sheng = ['木火', '火土', '土金', '金水', '水木'];
  const ke = ['木土', '土水', '水火', '火金', '金木'];
  const observed = new Set<string>();
  for (const gua of TRIGRAMS) {
    const result = analyzeBaZhai({
      mingGua: gua,
      sitMountain:
        ({ 坎: '子', 震: '卯', 离: '午', 兑: '酉' } as Record<string, string>)[gua] ?? gua,
    });
    const facts = result.gasRegulation!.suppressionLaws;
    assert.equal(facts.length, 8);
    result.housePalace!.forEach((palace, index) => {
      const a = stars[palace.label],
        b = elements[palace.gua];
      const expected =
        a === b
          ? '星与宫比和'
          : sheng.includes(a + b)
            ? '星生宫'
            : sheng.includes(b + a)
              ? '宫生星'
              : ke.includes(a + b)
                ? '星克宫'
                : '宫克星';
      assert.equal(facts[index].suppressionRule, expected);
      assert.equal(facts[index].element, a);
      assert.match(
        result.prompt,
        new RegExp(`${facts[index].counterpart}：${facts[index].star}，${expected}`),
      );
      observed.add(expected);
    });
    assert.doesNotMatch(result.prompt, /贪狼制绝命|门主同元|福力深厚|化凶为吉/);
  }
  assert.equal(observed.size, 5);
  const personal = analyzeBaZhai({ mingGua: '坎' });
  assert.match(personal.prompt, /命卦星宫生克/);
  assert.match(personal.prompt, /^命卦：坎（东四命）$/mu);
  assert.doesNotMatch(personal.prompt, /命宅关系：|命宅五行：|坐山：|命卦取年资料/u);
});

test('命卦一百八十年保留男女顺逆、世纪真值与五黄寄宫', () => {
  const fixedCases: Record<number, readonly [string, string]> = {
    1990: ['坎', '艮'],
    2000: ['离', '乾'],
    2001: ['艮', '兑'],
    2024: ['震', '震'],
  };
  const guas: Record<number, string> = {
    1: '坎',
    2: '坤',
    3: '震',
    4: '巽',
    6: '乾',
    7: '兑',
    8: '艮',
    9: '离',
  };
  let male = 1;
  let female = 5;
  for (let year = 1864; year < 2044; year++) {
    const maleResult = analyzeBaZhai({ birthYear: year, gender: 'male' });
    const femaleResult = analyzeBaZhai({ birthYear: year, gender: 'female' });
    assert.equal(maleResult.mingGua, guas[male === 5 ? 2 : male], `${year}男`);
    assert.equal(femaleResult.mingGua, guas[female === 5 ? 8 : female], `${year}女`);
    const fixed = fixedCases[year];
    if (fixed) {
      assert.equal(maleResult.mingGua, fixed[0], `${year}男命卦真值`);
      assert.equal(femaleResult.mingGua, fixed[1], `${year}女命卦真值`);
      assert.equal(maleResult.effectiveBirthYear, year);
      assert.equal(femaleResult.effectiveBirthYear, year);
    }
    if (year === 1986) assert.equal(maleResult.mingGua, '坤');
    male = male === 1 ? 9 : male - 1;
    female = female === 9 ? 1 : female + 1;
  }
});
