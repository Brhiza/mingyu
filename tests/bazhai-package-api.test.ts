import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
} from 'mingyu-core/bazhai';
import { TWENTY_FOUR_MOUNTAINS } from '../packages/core/src/direction/index.ts';

const TRIGRAMS = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
const EAST_TRIGRAMS = new Set(['坎', '震', '巽', '离']);

test('八宅命卦应符合 2000 年前后传统九宫真值与五黄寄宫口径', () => {
  const cases = [
    { birthYear: 1990, gender: 'male' as const, gua: '坎' },
    { birthYear: 1990, gender: 'female' as const, gua: '艮' },
    { birthYear: 2000, gender: 'male' as const, gua: '离' },
    { birthYear: 2000, gender: 'female' as const, gua: '乾' },
    { birthYear: 2001, gender: 'male' as const, gua: '艮' },
    { birthYear: 2001, gender: 'female' as const, gua: '兑' },
    { birthYear: 2024, gender: 'male' as const, gua: '震' },
    { birthYear: 2024, gender: 'female' as const, gua: '震' },
  ];

  for (const item of cases) {
    const result = analyzeBaZhai({ birthYear: item.birthYear, gender: item.gender });
    assert.equal(result.mingGua, item.gua, `${item.birthYear}${item.gender}命卦错误`);
    assert.equal(result.effectiveBirthYear, item.birthYear);
  }

  assert.equal(analyzeBaZhai({ birthYear: 1986, gender: 'male' }).mingGua, '坤');
});

test('八宅立春日期边界应按干支年切换命卦', () => {
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
  assert.match(result.directionMeasurement.promptText, /不能只采用单一八宅盘|并列候选盘/);
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
      assert.equal(result.evidenceAnalysis.directionFacts.length, 8);
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
