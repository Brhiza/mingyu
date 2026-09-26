import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  calculateNamingBirthContext,
  generateChineseNames,
  type NamingBirthInput,
} from '../packages/core/src/name-number/index.ts';
import {
  clearNamingBirthReverseSource,
  createNamingBirthDraft,
  createNamingBirthInput,
} from '../src/lib/naming-birth-input.ts';
import { defaultInputState } from '../src/lib/query-state.ts';

const RAIN_WATER_SOURCE = {
  pillars: { year: '甲辰', month: '丙寅', day: '癸丑', hour: '戊午' },
  intervalStart: '2024-02-19 11:00:00',
  intervalEnd: '2024-02-19 13:00:00',
  startTimestamp: Date.parse('2024-02-19T11:00:00+08:00'),
  endTimestamp: Date.parse('2024-02-19T13:00:00+08:00'),
  endExclusive: true as const,
  timezone: 'Asia/Shanghai' as const,
  offsetHours: 8 as const,
};

function draftFromSource(source = RAIN_WATER_SOURCE) {
  return createNamingBirthDraft({
    ...defaultInputState,
    gender: 'male',
    year: source.intervalStart.slice(0, 4),
    month: String(Number(source.intervalStart.slice(5, 7))),
    day: String(Number(source.intervalStart.slice(8, 10))),
    timeIndex: 6,
    birthHour: String(Number(source.intervalStart.slice(11, 13))),
    birthMinute: String(Number(source.intervalStart.slice(14, 16))),
    birthSecond: String(Number(source.intervalStart.slice(17, 19))),
    birthReverseSource: JSON.stringify(source),
  });
}

test('起名出生适配保留半开秒区间并在雨水处形成真实条件分支', () => {
  const input = createNamingBirthInput(draftFromSource());
  assert.deepEqual(input.birthTimeRange, {
    startTimestamp: RAIN_WATER_SOURCE.startTimestamp,
    endTimestamp: RAIN_WATER_SOURCE.endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
    pillars: RAIN_WATER_SOURCE.pillars,
  });

  const context = calculateNamingBirthContext(input);
  assert.equal(context.birthRange?.totalSamples, 7200);
  assert.deepEqual(
    context.birthRange?.branches.map((branch) => [
      branch.startTime,
      branch.endTime,
      branch.context.monthContext.term,
    ]),
    [
      ['2024-02-19 11:00:00', '2024-02-19 12:13:12', '立春'],
      ['2024-02-19 12:13:12', '2024-02-19 13:00:00', '雨水'],
    ],
  );
  assert.equal(context.birthRange?.branches.at(-1)?.endTimestamp, RAIN_WATER_SOURCE.endTimestamp);
  assert.equal(context.monthContext.term, '按时段分列');
});

test('司令变化保留每段取用顺序，稳定区间不虚增分支', () => {
  const commanderInput: NamingBirthInput = {
    gender: 'female',
    year: 2024,
    month: 2,
    day: 11,
    timeIndex: 9,
    dateType: 'solar',
    birthHour: 15,
    birthMinute: 0,
    birthSecond: 0,
    birthTimeRange: {
      startTimestamp: Date.parse('2024-02-11T15:00:00+08:00'),
      endTimestamp: Date.parse('2024-02-11T17:00:00+08:00'),
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
      pillars: { year: '甲辰', month: '丙寅', day: '乙巳', hour: '甲申' },
    },
  };
  const commander = calculateNamingBirthContext(commanderInput);
  assert.deepEqual(
    commander.birthRange?.branches.map((branch) => [
      branch.context.monthContext.commander,
      branch.context.favorableElements,
    ]),
    [
      ['戊', []],
      ['丙', []],
    ],
  );
  assert.ok(
    commander.birthRange?.branches.every((branch) => branch.context.incrementStatus === '待判'),
  );

  const stable = calculateNamingBirthContext({
    ...createNamingBirthInput(draftFromSource()),
    birthTimeRange: {
      ...createNamingBirthInput(draftFromSource()).birthTimeRange!,
      endTimestamp: RAIN_WATER_SOURCE.startTimestamp + 10_000,
    },
  });
  assert.equal(stable.birthRange?.totalSamples, 10);
  assert.equal(stable.birthRange?.branches.length, 1);
  assert.equal(
    stable.birthRange?.branches[0]?.endTimestamp,
    RAIN_WATER_SOURCE.startTimestamp + 10_000,
  );
});

test('各段喜用集合不同时只登记条件取用，姓名匹配不冒充全段共同结论', () => {
  const input: NamingBirthInput = {
    gender: 'male',
    year: 2020,
    month: 5,
    day: 10,
    timeIndex: 5,
    dateType: 'solar',
    birthHour: 7,
    birthMinute: 0,
    birthSecond: 0,
    birthTimeRange: {
      startTimestamp: Date.parse('2020-05-10T07:00:00+08:00'),
      endTimestamp: Date.parse('2020-05-10T09:00:00+08:00'),
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
      pillars: { year: '庚子', month: '辛巳', day: '癸丑', hour: '丙辰' },
    },
  };
  const context = calculateNamingBirthContext(input);
  assert.deepEqual(context.birthRange?.stableFavorableElements, []);
  assert.deepEqual(context.birthRange?.conditionalFavorableElements, ['金', '水']);
  assert.deepEqual(
    context.birthRange?.branches.map((branch) => [
      branch.context.monthContext.commander,
      branch.context.favorableElements,
    ]),
    [
      ['戊', ['金', '水']],
      ['庚', []],
    ],
  );

  const analysis = analyzeChineseName({ fullName: '李清和', birth: input });
  assert.deepEqual(analysis.preferredElements, []);
  assert.deepEqual(analysis.conditionalPreferredElements, ['金', '水']);
  assert.deepEqual(analysis.elementMatches, []);
  assert.ok(analysis.conditionalElementMatches.length > 0);
});

test('起名与姓名分析共用完整出生分支，提示词不把起点资料冒充整段', () => {
  const input = createNamingBirthInput(draftFromSource());
  const analysis = analyzeChineseName({ fullName: '李清和', birth: input });
  const candidates = generateChineseNames({ surname: '李', birth: input, limit: 1 });
  assert.deepEqual(
    analysis.birthContext?.birthRange,
    candidates[0]?.analysis.birthContext?.birthRange,
  );
  for (const prompt of [
    buildChineseNameAnalysisPrompt({ analysis }),
    buildChineseNamingPrompt({ surname: '李', candidates }),
  ]) {
    assert.match(prompt, /出生范围：北京时间 2024-02-19 11:00:00 至 2024-02-19 13:00:00/);
    assert.match(prompt, /出生时段1[\s\S]*节气立春/);
    assert.match(prompt, /出生时段2[\s\S]*节气雨水/);
    assert.doesNotMatch(prompt, /当前盘面采用区间起点/);
  }
});

test('案例切换保留各自来源，手改普通日期后命名输入不再携带旧区间', () => {
  const rangedCase = draftFromSource();
  const ordinaryCase = createNamingBirthDraft({
    ...defaultInputState,
    year: '2000',
    month: '1',
    day: '1',
    timeIndex: 6,
  });
  assert.ok(createNamingBirthInput(createNamingBirthDraft(rangedCase)).birthTimeRange);
  assert.equal(
    createNamingBirthInput(createNamingBirthDraft(ordinaryCase)).birthTimeRange,
    undefined,
  );

  const edited = clearNamingBirthReverseSource({ ...rangedCase, day: '20' });
  assert.equal(edited.birthReverseSource, '');
  assert.equal(createNamingBirthInput(edited).birthTimeRange, undefined);
  assert.ok(createNamingBirthInput(rangedCase).birthTimeRange);
});

test('起名出生区间拒绝伪造四柱与非半开边界', () => {
  const input = createNamingBirthInput(draftFromSource());
  assert.throws(
    () =>
      calculateNamingBirthContext({
        ...input,
        birthTimeRange: {
          ...input.birthTimeRange!,
          pillars: { ...input.birthTimeRange!.pillars, hour: '己未' },
        },
      }),
    /四柱与反推来源不一致/,
  );
  assert.throws(
    () =>
      calculateNamingBirthContext({
        ...input,
        birthTimeRange: { ...input.birthTimeRange!, endExclusive: false as never },
      }),
    /半开区间/,
  );
  assert.throws(
    () =>
      createNamingBirthInput({
        ...draftFromSource(),
        birthReverseSource: '{"pillars":{}}',
      }),
    /出生区间资料无效/,
  );
});
