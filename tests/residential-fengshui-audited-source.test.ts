import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateResidentialFengshui,
  rebuildAuditedResidentialFengshuiData,
  type ResidentialFengshuiResult,
} from '../packages/core/src/residential_fengshui/index.ts';
import { BAGUA, TWENTY_FOUR_MOUNTAINS } from '../packages/core/src/direction/index.ts';

test('住宅风水应只保存居住人、单一山向、宅运年份与卦型可信来源', () => {
  const personOnly = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
  });
  assert.deepEqual(personOnly.generation, {
    person: {
      source: 'birth',
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      gender: 'male',
    },
    orientation: null,
    year: null,
    guaType: null,
  });
  assert.deepEqual(rebuildAuditedResidentialFengshuiData(personOnly), personOnly);

  const combined = generateResidentialFengshui({
    mingGua: '坎',
    year: 2024,
    facingDegree: 360,
    measurementUncertaintyDegrees: 1,
    guaType: '下卦',
  });
  assert.deepEqual(combined.generation, {
    person: { source: 'ming-gua', mingGua: '坎' },
    orientation: {
      source: 'degree',
      sitDegree: null,
      facingDegree: 0,
      measurementUncertaintyDegrees: 1,
    },
    year: 2024,
    guaType: '下卦',
  });
  assert.deepEqual(rebuildAuditedResidentialFengshuiData(combined), combined);
});

test('住宅风水派生两层盘面、证据和提示词污染应由统一可信来源覆盖', () => {
  const expected = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    year: 2024,
    doorToInteriorDegree: 0,
    northReference: 'true',
    measurementUncertaintyDegrees: 1,
    guaType: '下卦',
  });
  const polluted = structuredClone(expected);
  polluted.inputSummary.orientationText = '伪造山向';
  polluted.reviewNotes[0].detail = '伪造合参结论';
  polluted.evidencePromptText = '伪造证据';
  polluted.prompt = '伪造提示词';
  polluted.bazhai!.mingGua = '离';
  polluted.bazhai!.prompt = '伪造八宅提示词';
  polluted.xuankong!.plates.yun.fill(9);
  polluted.xuankong!.formation = '旺山旺向';
  polluted.xuankong!.prompt = '伪造玄空提示词';

  assert.deepEqual(rebuildAuditedResidentialFengshuiData(polluted), expected);
});

test('住宅风水无居住人时也必须按磁偏角校正门向后再排玄空', () => {
  const orientationOnly = generateResidentialFengshui({
    year: 2024,
    doorToInteriorDegree: 0,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 10,
    measurementUncertaintyDegrees: 0,
    guaType: '下卦',
  });
  assert.equal(orientationOnly.bazhai, null);
  assert.deepEqual(orientationOnly.generation.orientation, {
    source: 'door-measurement',
    doorToInteriorDegree: 0,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 10,
    measurementUncertaintyDegrees: 0,
  });
  assert.equal(orientationOnly.xuankong?.generation.orientation.source, 'degree');
  if (orientationOnly.xuankong?.generation.orientation.source !== 'degree') {
    assert.fail('玄空应接收校正后的度数来源');
  }
  assert.equal(orientationOnly.xuankong.generation.orientation.sitDegree, 10);
  assert.equal(orientationOnly.xuankong.generation.orientation.facingDegree, 190);

  const withPerson = generateResidentialFengshui({
    mingGua: '坎',
    year: 2024,
    doorToInteriorDegree: 0,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 10,
    measurementUncertaintyDegrees: 0,
    guaType: '下卦',
  });
  const measurement = (withPerson.bazhai as { directionMeasurement?: { trueNorthDegree: number } })
    .directionMeasurement;
  assert.equal(measurement?.trueNorthDegree, 10);
  assert.deepEqual(withPerson.xuankong?.generation, orientationOnly.xuankong.generation);
});

test('住宅风水直接真北度数在缺少宅运年份时也应完整形成八宅候选', () => {
  const result = generateResidentialFengshui({
    mingGua: '坎',
    facingDegree: 245,
    measurementUncertaintyDegrees: 3,
  });

  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.equal(result.inputSummary.xuankongStatus, '缺少建造年或起运年');
  assert.equal(result.bazhai.generation.method, 'true-north-degree');
  const measurement = (
    result.bazhai as {
      directionMeasurement?: {
        method: string;
        stability: string;
        candidateDirections: Array<{ label: string }>;
      };
    }
  ).directionMeasurement;
  assert.equal(measurement?.method, '直接提供真北坐向度数');
  assert.equal(measurement?.stability, '宅卦不稳定');
  assert.deepEqual(
    measurement?.candidateDirections.map((item) => item.label),
    ['寅山申向', '甲山庚向'],
  );
  assert.deepEqual(rebuildAuditedResidentialFengshuiData(result), result);
});

test('住宅风水直接输入应拒绝来源混用、不完整资料、无效附属字段与伪装值', () => {
  const invalidInputs: Array<[unknown, RegExp]> = [
    [{ year: 2024, facingDegree: 180 }, /必须明确提供 measurementUncertaintyDegrees/],
    [{ year: 2024, sitMountain: '子', sitDegree: 0 }, /山名、直接度数与门向测量.*不能混用/],
    [
      { year: 2024, facingDegree: 180, doorToInteriorDegree: 0 },
      /山名、直接度数与门向测量.*不能混用/,
    ],
    [{ year: 2024, sitMountain: '子', birthYear: 1990 }, /出生年份和性别|gender/],
    [
      { year: 2024, sitMountain: '子', mingGua: '坎', birthYear: 1990, gender: 'male' },
      /命卦来源包含不受支持的字段/,
    ],
    [{ year: 2024, sitMountain: '子', northReference: 'true' }, /只能用于门向测量来源/],
    [
      { year: 2024, sitMountain: '子', measurementUncertaintyDegrees: 1 },
      /只能用于直接度数或门向测量来源/,
    ],
    [{ mingGua: '坎', guaType: '替卦' }, /guaType 只能在同时提供山向/],
    [{ mingGua: '坎', year: 2024 }, /year 只能在同时提供山向/],
    [{ year: 2024, sitMountain: '子', prompt: '夹带派生提示词' }, /不受支持的字段/],
    [{ year: 2024, sitMountain: null }, /不接受显式 null/],
    [{ year: Number.NaN, sitMountain: '子' }, /year 必须是/],
    [{ year: 2024, sitDegree: Number.POSITIVE_INFINITY }, /有限数字/],
  ];

  for (const [input, message] of invalidInputs) {
    assert.throws(() => generateResidentialFengshui(input as never), message);
  }
});

test('住宅风水旧结果及非法可信来源应失败关闭', () => {
  const expected = generateResidentialFengshui({
    mingGua: '坎',
    year: 2024,
    sitMountain: '子',
  });
  const invalidSources: Array<[unknown, RegExp]> = [
    [{}, /缺少可信原始输入/],
    [
      { generation: { ...expected.generation, prompt: '夹带派生提示词' } },
      /不受支持的字段：prompt/,
    ],
    [
      {
        generation: {
          ...expected.generation,
          orientation: { ...expected.generation.orientation, plates: [9] },
        },
      },
      /不受支持的字段：plates/,
    ],
    [
      {
        generation: {
          person: expected.generation.person,
          orientation: expected.generation.orientation,
          year: 2024,
        },
      },
      /缺少 guaType/,
    ],
    [
      {
        generation: {
          ...expected.generation,
          person: { source: 'ming-gua', mingGua: '坎', mingGuaResult: '离' },
        },
      },
      /不受支持的字段：mingGuaResult/,
    ],
    [
      {
        generation: {
          ...expected.generation,
          orientation: {
            source: 'door-measurement',
            doorToInteriorDegree: 0,
            northReference: 'magnetic',
            magneticDeclinationDegrees: null,
            measurementUncertaintyDegrees: 0,
          },
        },
      },
      /磁北时必须提供当地磁偏角/,
    ],
    [
      {
        generation: {
          ...expected.generation,
          guaType: { toString: () => '下卦' },
        },
      },
      /guaType/,
    ],
  ];

  for (const [source, message] of invalidSources) {
    assert.throws(
      () =>
        rebuildAuditedResidentialFengshuiData(
          source as Pick<ResidentialFengshuiResult, 'generation'>,
        ),
      message,
    );
  }
});

test('住宅风水九运乘二十四山的三种玄空口径应全部审核重建等价', () => {
  for (let yun = 1; yun <= 9; yun += 1) {
    const year = 1864 + (yun - 1) * 20;
    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      for (const guaType of [undefined, '下卦', '替卦'] as const) {
        const result = generateResidentialFengshui({
          year,
          sitMountain,
          ...(guaType ? { guaType } : {}),
        });
        assert.deepEqual(
          rebuildAuditedResidentialFengshuiData(result),
          result,
          `${yun}运坐${sitMountain}${guaType ?? '默认下卦'}组合入口重建不等价`,
        );
      }
    }
  }
});

test('住宅风水八命卦乘二十四山应完整重建两层组合结果', () => {
  for (const mingGua of BAGUA) {
    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      const result = generateResidentialFengshui({ mingGua, year: 2024, sitMountain });
      assert.ok(result.bazhai);
      assert.ok(result.xuankong);
      assert.deepEqual(
        rebuildAuditedResidentialFengshuiData(result),
        result,
        `命卦${mingGua}坐${sitMountain}组合入口重建不等价`,
      );
    }
  }
});

test('住宅风水 0 至 360 度门向应逐度重建八宅测量与玄空盘', () => {
  for (let degree = 0; degree <= 360; degree += 1) {
    const normalized = degree === 360 ? 0 : degree;
    const nearestCenter = Math.round(normalized / 15) * 15;
    const difference = Math.abs(normalized - (nearestCenter % 360));
    const centerOffset = Math.min(difference, 360 - difference);
    const result = generateResidentialFengshui({
      mingGua: '坎',
      year: 2024,
      doorToInteriorDegree: degree,
      northReference: 'true',
      ...(centerOffset > 3 && centerOffset < 4.5 ? { guaType: '下卦' as const } : {}),
    });
    assert.ok(result.bazhai);
    assert.ok(result.xuankong);
    assert.deepEqual(
      rebuildAuditedResidentialFengshuiData(result),
      result,
      `${degree}°门向组合入口重建不等价`,
    );
  }
});

test('住宅风水 0 至 360 度真北朝向应逐度重建八宅与玄空盘', () => {
  for (let degree = 0; degree <= 360; degree += 1) {
    const normalized = degree === 360 ? 0 : degree;
    const nearestCenter = Math.round(normalized / 15) * 15;
    const difference = Math.abs(normalized - (nearestCenter % 360));
    const centerOffset = Math.min(difference, 360 - difference);
    const ambiguityRangeIntersects = centerOffset + 0.25 > 3 && centerOffset - 0.25 < 4.5;
    const result = generateResidentialFengshui({
      mingGua: '坎',
      year: 2024,
      facingDegree: degree,
      measurementUncertaintyDegrees: 0.25,
      ...(ambiguityRangeIntersects ? { guaType: '下卦' as const } : {}),
    });
    assert.ok(result.bazhai);
    assert.ok(result.xuankong);
    assert.equal(result.bazhai.generation.method, 'true-north-degree');
    assert.deepEqual(
      rebuildAuditedResidentialFengshuiData(result),
      result,
      `${degree}°真北朝向组合入口重建不等价`,
    );
  }
});
