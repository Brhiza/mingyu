import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeXuanKongEvidence,
  generateXuanKong,
  rebuildAuditedXuanKongData,
  type XuanKongResult,
} from '../packages/core/src/xuan_kong/index.ts';
import { TWENTY_FOUR_MOUNTAINS } from '../packages/core/src/direction/index.ts';

test('玄空应只保存建造年、单一山向来源与显式卦型口径', () => {
  const mountain = generateXuanKong({ year: 2024, sitMountain: '子' });
  assert.deepEqual(mountain.generation, {
    year: 2024,
    orientation: {
      source: 'mountain',
      sitMountain: '子',
      facingMountain: null,
    },
    guaType: null,
  });
  assert.deepEqual(rebuildAuditedXuanKongData(mountain), mountain);

  const degree = generateXuanKong({
    year: 2024,
    facingDegree: 360,
    measurementUncertaintyDegrees: 1,
    guaType: '下卦',
  });
  assert.deepEqual(degree.generation, {
    year: 2024,
    orientation: {
      source: 'degree',
      sitDegree: null,
      facingDegree: 0,
      measurementUncertaintyDegrees: 1,
    },
    guaType: '下卦',
  });
  assert.deepEqual(rebuildAuditedXuanKongData(degree), degree);

  const pair = generateXuanKong({ year: 2004, sitDegree: 0, facingDegree: 180 });
  assert.deepEqual(pair.generation.orientation, {
    source: 'degree',
    sitDegree: 0,
    facingDegree: 180,
    measurementUncertaintyDegrees: 0,
  });
  assert.deepEqual(rebuildAuditedXuanKongData(pair), pair);
});

test('玄空派生盘面、证据和提示词被污染时应只凭可信来源重建', () => {
  const expected = generateXuanKong({
    year: 2008,
    facingDegree: 180,
    measurementUncertaintyDegrees: 0.5,
    guaType: '替卦',
  });
  const polluted = structuredClone(expected);
  polluted.period.yun = 1;
  polluted.sitMountain = '卯';
  polluted.facingMountain = '酉';
  polluted.plates.yun.fill(9);
  polluted.plates.shan.fill(9);
  polluted.plates.xiang.fill(9);
  polluted.palaces[0].shanStar = 9;
  polluted.formation = '旺山旺向';
  polluted.daoShanXiang.summary = '伪造结论';
  polluted.evidenceAnalysis.promptText = '伪造证据';
  polluted.prompt = '伪造提示词';

  assert.deepEqual(rebuildAuditedXuanKongData(polluted), expected);
  assert.deepEqual(analyzeXuanKongEvidence(polluted), expected.evidenceAnalysis);
});

test('玄空直接输入不得混用来源、夹带未知字段或接受伪装值', () => {
  const invalidInputs: Array<[unknown, RegExp]> = [
    [{ year: 2024, sitMountain: '子', sitDegree: 0 }, /山名与度数测量.*不能混用/],
    [
      { year: 2024, sitMountain: '子', measurementUncertaintyDegrees: 1 },
      /只能与度数测量来源一起提供/,
    ],
    [{ year: 2024, sitDegree: 0, facingDegree: 181 }, /坐向度数必须严格相差 180°/],
    [{ year: 2024, sitMountain: '子', plates: [9] }, /不受支持的字段：plates/],
    [{ year: 2024, sitMountain: null }, /不接受显式 null/],
    [{ year: 2024, sitMountain: '子', guaType: { valueOf: () => '下卦' } }, /guaType/],
    [{ year: Number.NaN, sitMountain: '子' }, /year 必须是/],
    [{ year: 2024, sitDegree: Number.POSITIVE_INFINITY }, /有限数字/],
  ];

  for (const [input, message] of invalidInputs) {
    assert.throws(() => generateXuanKong(input as never), message);
  }
});

test('玄空旧结果及非法可信来源应失败关闭', () => {
  const expected = generateXuanKong({ year: 2024, sitMountain: '子' });
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
          year: 2024,
          orientation: expected.generation.orientation,
        },
      },
      /缺少 guaType/,
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
    [
      {
        generation: {
          ...expected.generation,
          orientation: {
            source: { toString: () => 'mountain' },
            sitMountain: '子',
            facingMountain: null,
          },
        },
      },
      /source 必须是/,
    ],
    [
      {
        generation: {
          year: 2024,
          orientation: {
            source: 'degree',
            sitDegree: null,
            facingDegree: null,
            measurementUncertaintyDegrees: 0,
          },
          guaType: null,
        },
      },
      /至少需要 sitDegree 或 facingDegree/,
    ],
    [
      {
        generation: {
          year: 2024,
          orientation: {
            source: 'degree',
            sitDegree: 0,
            facingDegree: 181,
            measurementUncertaintyDegrees: 0,
          },
          guaType: null,
        },
      },
      /严格相差 180°/,
    ],
    [
      {
        generation: {
          year: 2024,
          orientation: {
            source: 'mountain',
            sitMountain: '子',
            facingMountain: '卯',
          },
          guaType: null,
        },
      },
      /坐向必须严格相对/,
    ],
    [
      {
        generation: {
          year: 2024,
          orientation: {
            source: 'degree',
            sitDegree: 0,
            facingDegree: null,
            measurementUncertaintyDegrees: Number.NaN,
          },
          guaType: null,
        },
      },
      /有限数字/,
    ],
  ];

  for (const [source, message] of invalidSources) {
    assert.throws(
      () => rebuildAuditedXuanKongData(source as Pick<XuanKongResult, 'generation'>),
      message,
    );
  }
});

test('玄空九运乘二十四山的下卦、替卦与默认口径应全部审核重建等价', () => {
  for (let yun = 1; yun <= 9; yun += 1) {
    const year = 1864 + (yun - 1) * 20;
    for (const sitMountain of TWENTY_FOUR_MOUNTAINS) {
      for (const guaType of [undefined, '下卦', '替卦'] as const) {
        const result = generateXuanKong({
          year,
          sitMountain,
          ...(guaType ? { guaType } : {}),
        });
        assert.deepEqual(
          rebuildAuditedXuanKongData(result),
          result,
          `${yun}运坐${sitMountain}${guaType ?? '默认下卦'}审核重建不等价`,
        );
      }
    }
  }
});

test('玄空 0 至 360 度坐山来源应逐度审核重建等价', () => {
  for (let degree = 0; degree <= 360; degree += 1) {
    const normalized = degree === 360 ? 0 : degree;
    const nearestCenter = Math.round(normalized / 15) * 15;
    const difference = Math.abs(normalized - (nearestCenter % 360));
    const centerOffset = Math.min(difference, 360 - difference);
    const result = generateXuanKong({
      year: 2024,
      sitDegree: degree,
      ...(centerOffset > 3 && centerOffset < 4.5 ? { guaType: '下卦' as const } : {}),
    });
    assert.deepEqual(rebuildAuditedXuanKongData(result), result, `${degree}°坐山审核重建不等价`);
  }
});
