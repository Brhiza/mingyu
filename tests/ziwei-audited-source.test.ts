import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildZiweiChartInput,
  calculateZiweiChartForScopes,
  rebuildAuditedZiweiRuntime,
  type ZiweiRuntime,
} from '../src/lib/full-chart-engine/ziwei';
import {
  buildSerializableZiweiResult,
  buildZiweiPromptForRuntime,
} from '../src/lib/public-api/prompt-builders';
import {
  buildZiweiChartInputFromSources,
  createZiweiGenerationSource,
  normalizeZiweiGenerationSource,
  type ZiweiBirthSource,
  type ZiweiCalculationSource,
  type ZiweiGenerationSource,
} from '@core/ziwei/iztro';
import type { ChartInput } from '../packages/core/src/types/chart';

const FIXED_TIMESTAMP = Date.parse('2026-07-18T06:30:00+08:00');
const CALCULATION_SOURCE: ZiweiCalculationSource = {
  fixLeap: true,
  algorithm: 'default',
  yearDivide: 'normal',
  horoscopeDivide: 'normal',
  ageDivide: 'normal',
  dayDivide: 'forward',
};

function runtimeSignature(runtime: ZiweiRuntime) {
  return JSON.stringify({
    generation: runtime.generation,
    astrolabe: {
      solarDate: runtime.astrolabe.solarDate,
      lunarDate: runtime.astrolabe.lunarDate,
      fiveElementsClass: runtime.astrolabe.fiveElementsClass,
      palaces: runtime.astrolabe.palaces.map((palace) => ({
        index: palace.index,
        name: palace.name,
        heavenlyStem: palace.heavenlyStem,
        earthlyBranch: palace.earthlyBranch,
        isBodyPalace: palace.isBodyPalace,
        majorStars: palace.majorStars.map((star) => [star.name, star.brightness, star.mutagen]),
        minorStars: palace.minorStars.map((star) => [star.name, star.brightness, star.mutagen]),
      })),
    },
    horoscope: Object.fromEntries(
      (['decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'] as const).map((scope) => {
        const item = runtime.horoscope[scope];
        return [
          scope,
          {
            index: item.index,
            palaceNames: item.palaceNames,
            mutagen: item.mutagen,
            heavenlyStem: item.heavenlyStem,
            earthlyBranch: item.earthlyBranch,
          },
        ];
      }),
    ),
    payloadByScope: runtime.payloadByScope,
    decadalTimeline: runtime.decadalTimeline,
    trueSolarEvidence: runtime.trueSolarEvidence,
  });
}

function createTraditionalInput(): ChartInput {
  return buildZiweiChartInputFromSources(
    {
      method: 'time-index',
      name: '来源审查',
      gender: '女',
      dateType: 'solar',
      year: 1992,
      month: 8,
      day: 21,
      isLeapMonth: false,
      birthTimeIndex: 4,
    },
    CALCULATION_SOURCE,
  );
}

test('紫微传统时辰结果应只凭最小来源稳定重建全部派生盘面', async () => {
  const generation = createZiweiGenerationSource({
    input: createTraditionalInput(),
    timestamp: FIXED_TIMESTAMP,
    scopes: ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'],
  });
  const runtime = await rebuildAuditedZiweiRuntime({ generation });
  const rebuilt = await rebuildAuditedZiweiRuntime(runtime);

  assert.deepEqual(generation, {
    birth: {
      method: 'time-index',
      name: '来源审查',
      gender: '女',
      dateType: 'solar',
      year: 1992,
      month: 8,
      day: 21,
      isLeapMonth: false,
      birthTimeIndex: 4,
    },
    calculation: CALCULATION_SOURCE,
    timestamp: FIXED_TIMESTAMP,
    scopes: ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'],
    skipAnalysis: false,
  });
  assert.equal(runtimeSignature(rebuilt), runtimeSignature(runtime));
});

test('紫微真太阳时结果应保存精准原始资料并重新生成校正证据', async () => {
  const birth: ZiweiBirthSource = {
    method: 'true-solar-time',
    name: '真太阳时审查',
    gender: '男',
    dateType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    isLeapMonth: false,
    birthHour: 23,
    birthMinute: 40,
    birthLongitude: 116.4074,
    timezone: 8,
    applyChinaDst: true,
  };
  const generation: ZiweiGenerationSource = {
    birth,
    calculation: CALCULATION_SOURCE,
    timestamp: FIXED_TIMESTAMP,
    scopes: ['origin'],
    skipAnalysis: false,
  };
  const expectedInput = buildZiweiChartInputFromSources(birth, CALCULATION_SOURCE);
  const runtime = await rebuildAuditedZiweiRuntime({ generation });

  assert.deepEqual(runtime.generation.birth, birth);
  assert.deepEqual(runtime.trueSolarEvidence, expectedInput.trueSolarEvidence);
});

test('紫微审核重建、公开序列化与提示词不得采信旧派生结果污染', async () => {
  const clean = await calculateZiweiChartForScopes(createTraditionalInput(), ['origin', 'yearly']);
  const cleanSerializable = await buildSerializableZiweiResult(clean);
  const cleanPrompt = await buildZiweiPromptForRuntime({
    result: clean,
    question: '请核对可信盘面。',
    topic: 'life',
    scope: 'yearly',
  });
  const polluted = {
    ...clean,
    astrolabe: { palaces: [{ name: '伪造宫位' }] },
    horoscope: { yearly: { mutagen: ['伪造四化'] } },
    payloadByScope: {
      origin: { basic_info: { name: '伪造姓名' } },
      yearly: { prompt: '伪造提示词', evidence: '伪造证据' },
    },
    decadalTimeline: [{ label: '伪造大限' }],
    trueSolarEvidence: { method: '伪造真太阳时证据' },
  } as unknown as ZiweiRuntime;

  const rebuilt = await rebuildAuditedZiweiRuntime(polluted);
  const pollutedSerializable = await buildSerializableZiweiResult(polluted);
  const pollutedPrompt = await buildZiweiPromptForRuntime({
    result: polluted,
    question: '请核对可信盘面。',
    topic: 'life',
    scope: 'yearly',
  });

  assert.equal(
    runtimeSignature(rebuilt),
    runtimeSignature(await rebuildAuditedZiweiRuntime(clean)),
  );
  assert.deepEqual(pollutedSerializable, cleanSerializable);
  assert.equal(pollutedPrompt, cleanPrompt);
  const injectedText = /伪造宫位|伪造四化|伪造姓名|伪造提示词|伪造证据|伪造大限|伪造真太阳时证据/;
  assert.doesNotMatch(JSON.stringify(pollutedSerializable), injectedText);
  assert.doesNotMatch(pollutedPrompt, injectedText);
});

test('紫微可信来源缺失、夹带、矛盾或非法时应失败关闭', async () => {
  const valid = createZiweiGenerationSource({
    input: createTraditionalInput(),
    timestamp: FIXED_TIMESTAMP,
    scopes: ['origin'],
  });
  const invalidSources: unknown[] = [
    { ...valid, palaces: [] },
    { ...valid, timestamp: Number.NaN },
    { ...valid, timestamp: Number.POSITIVE_INFINITY },
    { ...valid, timestamp: Number.MAX_SAFE_INTEGER },
    { ...valid, scopes: ['origin', 'origin'] },
    { ...valid, scopes: ['origin', { value: 'yearly' }] },
    { ...valid, skipAnalysis: null },
    { ...valid, calculation: { ...valid.calculation, algorithm: { value: 'default' } } },
    { ...valid, birth: null },
    {
      ...valid,
      birth: { ...valid.birth, method: 'time-index', birthHour: 12 },
    },
  ];

  invalidSources.forEach((source) => {
    assert.throws(() => normalizeZiweiGenerationSource(source));
  });
  await assert.rejects(
    rebuildAuditedZiweiRuntime({} as Pick<ZiweiRuntime, 'generation'>),
    /缺少可信原始输入/,
  );
  assert.throws(
    () =>
      createZiweiGenerationSource({
        input: {
          ...createTraditionalInput(),
          palaces: [],
        } as ChartInput,
        timestamp: FIXED_TIMESTAMP,
        scopes: ['origin'],
      }),
    /不受支持的字段：palaces/,
  );
  assert.throws(
    () =>
      createZiweiGenerationSource({
        input: {
          ...createTraditionalInput(),
          birthSource: undefined,
          trueSolarEvidence: {} as ChartInput['trueSolarEvidence'],
        },
        timestamp: FIXED_TIMESTAMP,
        scopes: ['origin'],
      }),
    /缺少精准出生时间与经度来源/,
  );
});

test('紫微可信来源应穷举性别、历法、十三时辰与完整排盘口径组合', () => {
  let checked = 0;
  for (const gender of ['男', '女'] as const) {
    for (const dateType of ['solar', 'lunar'] as const) {
      for (let birthTimeIndex = 0; birthTimeIndex <= 12; birthTimeIndex += 1) {
        for (const algorithm of ['default', 'zhongzhou'] as const) {
          for (const yearDivide of ['normal', 'exact'] as const) {
            for (const horoscopeDivide of ['normal', 'exact'] as const) {
              for (const ageDivide of ['normal', 'birthday'] as const) {
                for (const dayDivide of ['current', 'forward'] as const) {
                  const calculation: ZiweiCalculationSource = {
                    fixLeap: true,
                    algorithm,
                    yearDivide,
                    horoscopeDivide,
                    ageDivide,
                    dayDivide,
                  };
                  const input = buildZiweiChartInputFromSources(
                    {
                      method: 'time-index',
                      name: '组合穷举',
                      gender,
                      dateType,
                      year: 1990,
                      month: 5,
                      day: 15,
                      isLeapMonth: false,
                      birthTimeIndex,
                    },
                    calculation,
                  );
                  const generation = createZiweiGenerationSource({
                    input,
                    timestamp: FIXED_TIMESTAMP,
                    scopes: ['origin'],
                  });
                  assert.equal(generation.birth.gender, gender);
                  assert.equal(generation.birth.dateType, dateType);
                  assert.equal(generation.birth.method, 'time-index');
                  assert.equal(generation.birth.birthTimeIndex, birthTimeIndex);
                  assert.deepEqual(generation.calculation, calculation);
                  checked += 1;
                }
              }
            }
          }
        }
      }
    }
  }

  assert.equal(checked, 1664);
});

test('紫微界面传统与真太阳时输入不得混用派生字段作为可信来源', () => {
  const input = buildZiweiChartInput({
    name: '界面输入',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  assert.equal(input.birthSource?.method, 'time-index');
  assert.equal(input.trueSolarEvidence, undefined);
});
