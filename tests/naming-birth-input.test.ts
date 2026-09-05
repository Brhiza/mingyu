import test from 'node:test';
import assert from 'node:assert/strict';
import { createNamingBirthDraft, createNamingBirthInput } from '../src/lib/naming-birth-input.ts';
import { defaultInputState } from '../src/lib/query-state.ts';
import {
  calculateNamingBirthContext,
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
} from 'mingyu-core/name-number';
import { calculateBaziChartFromInput } from '../packages/core/src/bazi/input.ts';

test('姓名案例保留精确时空资料并与八字跨日四柱一致', () => {
  for (const dateType of ['solar', 'lunar'] as const) {
    const saved = {
      ...defaultInputState,
      year: '2000',
      month: '1',
      day: '1',
      dateType,
      timeIndex: '' as const,
      useTrueSolarTime: true,
      birthHour: '00',
      birthMinute: '30',
      birthPlace: '新疆',
      birthLongitude: '75',
      birthLatitude: '39',
    };
    const draft = createNamingBirthDraft(saved);
    assert.deepEqual(draft, saved);
    assert.notEqual(draft, saved);
    const input = createNamingBirthInput(draft);
    assert.equal(input.useTrueSolarTime, true);
    assert.equal(input.birthHour, '00');
    assert.equal(input.birthMinute, '30');
    assert.equal(input.birthPlace, '新疆');
    assert.equal(input.birthLongitude, '75');
    assert.equal(input.timeIndex, '');
    const naming = calculateNamingBirthContext(input);
    const expected = calculateBaziChartFromInput(saved);
    assert.equal(
      naming.timeBasis.calculatedTime,
      `${String(expected.timing!.correctedTime.hour).padStart(2, '0')}:${String(expected.timing!.correctedTime.minute).padStart(2, '0')}`,
    );
    const uncorrected = calculateNamingBirthContext({
      ...input,
      useTrueSolarTime: false,
      timeIndex: 0,
    });
    assert.deepEqual(
      naming.pillars,
      Object.values(expected.pillars).map((pillar) => pillar.ganZhi),
    );
    assert.notDeepEqual(naming.pillars, uncorrected.pillars);
    assert.notEqual(naming.solarDate, uncorrected.solarDate);
    assert.equal(naming.timeBasis.mode, '真太阳时');
    assert.equal(naming.timeBasis.inputTime, '00:30');
    assert.equal(naming.timeBasis.longitude, 75);
    const prompt = buildChineseNameAnalysisPrompt({
      analysis: analyzeChineseName({ fullName: '李清和', birth: input }),
    });
    assert.ok(prompt.includes(`出生记录：${naming.timeBasis.inputDate} 00:30`));
    assert.ok(prompt.includes(`排盘公历：${naming.solarDate} ${naming.timeBasis.calculatedTime}`));
    assert.ok(prompt.includes('时间口径：真太阳时；出生地新疆；经度75°'));
    draft.birthHour = '12';
    assert.equal(saved.birthHour, '00');
  }
});

test('切换到临时档案清空精确资料，普通时辰与农历闰月口径保持独立', () => {
  const empty = createNamingBirthDraft();
  assert.deepEqual(empty, defaultInputState);
  assert.equal(empty.birthLongitude, '');
  assert.equal(empty.useTrueSolarTime, false);
  assert.throws(() => calculateNamingBirthContext(createNamingBirthInput(empty)), /出生年份/);
  const draft = { ...empty, year: '2000', month: '1', day: '1', timeIndex: 3, isLeapMonth: true };
  assert.equal(createNamingBirthInput(draft).isLeapMonth, false);
  assert.equal(createNamingBirthInput({ ...draft, dateType: 'lunar' }).isLeapMonth, true);
  assert.equal(createNamingBirthInput(draft).timeIndex, 3);
  assert.throws(
    () => calculateNamingBirthContext(createNamingBirthInput({ ...draft, useTrueSolarTime: true })),
    /出生小时/,
  );
});
