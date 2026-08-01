import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  analyzeBaZhaiByTrueNorthDegree,
  analyzeBaZhaiEvidence,
  rebuildAuditedBaZhaiData,
  type BaZhaiResult,
} from 'mingyu-core/bazhai';
import { TWENTY_FOUR_MOUNTAINS } from 'mingyu-core/direction';

const TRIGRAMS = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];

test('八宅应分别保存出生资料、直接命卦和固定坐山的最小可信来源', () => {
  const birth = analyzeBaZhai({
    birthYear: 1990,
    birthMonth: 6,
    birthDay: 15,
    gender: 'male',
    sitMountain: '子',
  });
  assert.deepEqual(birth.generation, {
    method: 'fixed-sit-mountain',
    person: {
      source: 'birth',
      birthYear: 1990,
      birthMonth: 6,
      birthDay: 15,
      gender: 'male',
    },
    sitMountain: '子',
  });
  assert.deepEqual(rebuildAuditedBaZhaiData(birth), birth);

  const direct = analyzeBaZhai({ mingGua: '坎' });
  assert.deepEqual(direct.generation, {
    method: 'fixed-sit-mountain',
    person: { source: 'ming-gua', mingGua: '坎' },
  });
  assert.deepEqual(rebuildAuditedBaZhaiData(direct), direct);
});

test('八宅门向应保存完整测量来源并可等价重建候选盘', () => {
  const result = analyzeBaZhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.deepEqual(result.generation, {
    method: 'door-measurement',
    person: { source: 'ming-gua', mingGua: '坎' },
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });
  assert.deepEqual(rebuildAuditedBaZhaiData(result), result);

  const defaults = analyzeBaZhaiByDoorDegree({
    mingGua: '坎',
    doorToInteriorDegree: 0,
  });
  assert.equal(defaults.generation.method, 'door-measurement');
  if (defaults.generation.method !== 'door-measurement') assert.fail('应保存门向测量来源');
  assert.equal(defaults.generation.northReference, 'unspecified');
  assert.equal(defaults.generation.magneticDeclinationDegrees, null);
  assert.equal(defaults.generation.measurementUncertaintyDegrees, 0);
});

test('八宅真北坐向度数应保存独立来源并完整保留误差候选', () => {
  const result = analyzeBaZhaiByTrueNorthDegree({
    mingGua: '坎',
    facingDegree: 245,
    measurementUncertaintyDegrees: 3,
  });

  assert.deepEqual(result.generation, {
    method: 'true-north-degree',
    person: { source: 'ming-gua', mingGua: '坎' },
    sitDegree: null,
    facingDegree: 245,
    measurementUncertaintyDegrees: 3,
  });
  assert.equal(result.directionMeasurement.method, '直接提供真北坐向度数');
  assert.equal(result.directionMeasurement.stability, '宅卦不稳定');
  assert.deepEqual(
    result.directionMeasurement.candidateDirections.map((item) => item.label),
    ['寅山申向', '甲山庚向'],
  );
  assert.deepEqual(rebuildAuditedBaZhaiData(result), result);
});

test('八宅审核重建与证据入口应隔离命卦宅卦、候选盘、证据和提示词污染', () => {
  const expected = analyzeBaZhaiByDoorDegree({
    birthYear: 1990,
    birthMonth: 6,
    birthDay: 15,
    gender: 'male',
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });
  const polluted = structuredClone(expected) as unknown as Record<string, unknown>;
  polluted.mingGua = '伪造命卦';
  polluted.houseGua = '伪造宅卦';
  polluted.mingGroup = '伪造分组';
  polluted.houseGroup = '伪造分组';
  polluted.mingPalace = [];
  polluted.housePalace = [];
  polluted.groupRelation = '伪造关系';
  polluted.calculationInput = { mingGuaSource: '伪造来源' };
  polluted.directionMeasurement = {
    measuredDegree: 999,
    candidateDirections: [],
    promptText: '伪造测量提示词',
  };
  polluted.evidenceAnalysis = { promptText: '伪造旧证据' };
  polluted.prompt = '伪造旧提示词';

  assert.deepEqual(
    rebuildAuditedBaZhaiData(polluted as unknown as Pick<BaZhaiResult, 'generation'>),
    expected,
  );
  assert.deepEqual(
    analyzeBaZhaiEvidence(polluted as unknown as Pick<BaZhaiResult, 'generation'>),
    expected.evidenceAnalysis,
  );
});

test('八宅旧结果缺少可信来源、来源夹带或伪装枚举时应失败关闭', () => {
  const expected = analyzeBaZhai({ mingGua: '坎', sitMountain: '子' });
  assert.throws(
    () => rebuildAuditedBaZhaiData({} as Pick<BaZhaiResult, 'generation'>),
    /缺少可信原始输入/,
  );

  const invalidGenerations: Array<[unknown, RegExp]> = [
    [null, /必须提供可信生成来源/],
    [{ ...expected.generation, prompt: '夹带派生提示词' }, /不受支持的字段/],
    [
      {
        method: 'fixed-sit-mountain',
        person: { source: 'ming-gua', mingGua: '坎', birthYear: 1990 },
      },
      /不受支持的字段/,
    ],
    [
      {
        method: 'fixed-sit-mountain',
        person: { source: 'ming-gua', mingGua: { toString: () => '坎' } },
      },
      /原始字符串/,
    ],
    [
      {
        method: 'fixed-sit-mountain',
        person: { source: 'ming-gua', mingGua: '坎' },
        sitMountain: { toString: () => '子' },
      },
      /原始字符串/,
    ],
    [
      {
        method: 'door-measurement',
        person: { source: 'ming-gua', mingGua: '坎' },
        sitMountain: '子',
        doorToInteriorDegree: 0,
        northReference: 'true',
        magneticDeclinationDegrees: null,
        measurementUncertaintyDegrees: 0,
      },
      /不受支持的字段/,
    ],
  ];

  for (const [generation, message] of invalidGenerations) {
    assert.throws(
      () =>
        rebuildAuditedBaZhaiData({
          generation,
        } as unknown as Pick<BaZhaiResult, 'generation'>),
      message,
    );
  }
});

test('八宅出生与直接命卦、固定坐山与门向测量不得混用', () => {
  assert.throws(
    () => analyzeBaZhai({ birthYear: 1990, gender: 'male', mingGua: '坎' }),
    /只能选择一种来源/,
  );
  assert.throws(
    () => analyzeBaZhai({ birthYear: 1990, birthMonth: 6, gender: 'male' }),
    /同时提供出生月和出生日/,
  );
  assert.throws(
    () =>
      analyzeBaZhaiByDoorDegree({
        mingGua: '坎',
        sitMountain: '子',
        doorToInteriorDegree: 0,
      } as unknown as Parameters<typeof analyzeBaZhaiByDoorDegree>[0]),
    /不受支持的字段/,
  );
  assert.throws(
    () =>
      analyzeBaZhai({
        mingGua: '坎',
        doorToInteriorDegree: 0,
      } as unknown as Parameters<typeof analyzeBaZhai>[0]),
    /不受支持的字段/,
  );
});

test('八宅门向可信来源应严格约束北向、磁偏角、误差和有限数字', () => {
  const base = {
    method: 'door-measurement',
    person: { source: 'ming-gua', mingGua: '坎' },
    doorToInteriorDegree: 0,
    northReference: 'true',
    magneticDeclinationDegrees: null,
    measurementUncertaintyDegrees: 0,
  };
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ ...base, doorToInteriorDegree: Number.NaN }, /0-360/],
    [{ ...base, northReference: { valueOf: () => 'true' } }, /northReference/],
    [{ ...base, magneticDeclinationDegrees: 1 }, /只有 northReference 为 magnetic/],
    [
      { ...base, northReference: 'magnetic', magneticDeclinationDegrees: null },
      /必须提供当地磁偏角/,
    ],
    [{ ...base, northReference: 'magnetic', magneticDeclinationDegrees: Number.NaN }, /有限数字/],
    [{ ...base, measurementUncertaintyDegrees: Number.POSITIVE_INFINITY }, /测量误差/],
  ];

  for (const [generation, message] of cases) {
    assert.throws(
      () =>
        rebuildAuditedBaZhaiData({
          generation,
        } as unknown as Pick<BaZhaiResult, 'generation'>),
      message,
    );
  }

  for (const invalidInput of [
    { mingGua: '坎', doorToInteriorDegree: 0, northReference: null },
    { mingGua: '坎', doorToInteriorDegree: 0, magneticDeclinationDegrees: null },
    { mingGua: '坎', doorToInteriorDegree: 0, measurementUncertaintyDegrees: null },
  ]) {
    assert.throws(
      () =>
        analyzeBaZhaiByDoorDegree(
          invalidInput as unknown as Parameters<typeof analyzeBaZhaiByDoorDegree>[0],
        ),
      /northReference|磁偏角|测量误差/,
    );
  }
});

test('八宅八命卦乘二十四山的 192 盘均应审核重建等价', () => {
  for (const mingGua of TRIGRAMS) {
    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      const result = analyzeBaZhai({ mingGua, sitMountain });
      assert.deepEqual(
        rebuildAuditedBaZhaiData(result),
        result,
        `${mingGua}命/${sitMountain}山审核重建不等价`,
      );
    }
  }
});

test('八宅 0 至 360 度门向结果均应由原始测量来源等价重建', () => {
  for (let degree = 0; degree <= 360; degree += 1) {
    const result = analyzeBaZhaiByDoorDegree({
      mingGua: '坎',
      doorToInteriorDegree: degree,
      northReference: 'true',
      measurementUncertaintyDegrees: 0.25,
    });
    assert.deepEqual(rebuildAuditedBaZhaiData(result), result, `${degree}°门向审核重建不等价`);
  }
});

test('八宅 0 至 360 度真北朝向均应由原始度数来源等价重建', () => {
  for (let degree = 0; degree <= 360; degree += 1) {
    const result = analyzeBaZhaiByTrueNorthDegree({
      mingGua: '坎',
      facingDegree: degree,
      measurementUncertaintyDegrees: 0.25,
    });
    assert.deepEqual(rebuildAuditedBaZhaiData(result), result, `${degree}°真北朝向审核重建不等价`);
  }
});
