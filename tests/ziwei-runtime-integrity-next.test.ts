import assert from 'node:assert/strict';
import test from 'node:test';

import { buildZiweiFortuneTimeline } from '../packages/core/src/ziwei/fortune-timeline';
import {
  calculateZiweiChart,
  calculateZiweiDisplayPayload,
  type ZiweiRuntimeOptions,
} from '../packages/core/src/ziwei/runtime';
import { buildCombinedZiweiPrompt } from '../packages/core/src/ziwei/prompt/combined';
import type { ChartInput } from '../packages/core/src/types/chart';
import type { ZiweiFortuneRangeOptions } from '../packages/core/src/ziwei/fortune-timeline';

test('紫微异步排盘固定本次出生与范围，独立运限沿用同一流时', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-06T04:30:00Z') });
  const input: ChartInput = {
    name: '流时一致性',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 4,
  };
  const dateStr = '2026-08-06';
  const expectedContext = { dateStr, hourIndex: 6 };
  const standaloneOptions: ZiweiFortuneRangeOptions = { scope: 'hour', dateStr };
  const standalonePending = buildZiweiFortuneTimeline(input, standaloneOptions);
  standaloneOptions.scope = 'year';
  standaloneOptions.dateStr = '2027-08-06';
  standaloneOptions.hourIndex = 0;
  const standalone = await standalonePending;
  const runtimeNow = new Date('2026-08-06T04:30:00Z');
  const runtimePending = calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    now: runtimeNow,
    fortuneRange: { scope: 'hour', dateStr },
  });
  runtimeNow.setUTCFullYear(2027);
  const runtime = await runtimePending;
  const standaloneHour = standalone.periods
    .flatMap((period) => period.years)
    .find((year) => Boolean(year.targetHour))?.targetHour;
  const runtimeHour = runtime.fortuneTimeline?.periods
    .flatMap((period) => period.years)
    .find((year) => Boolean(year.targetHour))?.targetHour;

  assert.equal(standalone.targetDateStr, dateStr);
  assert.equal(standalone.targetHourIndex, 6);
  assert.equal(runtime.fortuneTimeline?.targetHourIndex, 6);
  assert.deepEqual(runtime.horoscopeContext, expectedContext);
  assert.ok(standaloneHour);
  assert.deepEqual(standaloneHour, runtimeHour);
  assert.equal(standaloneHour.heavenlyStem, runtime.horoscope.hourly.heavenlyStem);
  assert.equal(standaloneHour.earthlyBranch, runtime.horoscope.hourly.earthlyBranch);
  assert.equal(`${standaloneHour.heavenlyStem}${standaloneHour.earthlyBranch}`, '丙午');

  const preciseInput: ChartInput = {
    ...input,
    birthTime: { hour: 8, minute: 0, second: 0 },
  };
  const mutableOptions: ZiweiRuntimeOptions = {
    scopes: ['yearly'],
    independentBatch: 'scope',
    skipAnalysis: true,
    horoscopeContext: { dateStr, hourIndex: 0 },
  };
  const pending = calculateZiweiChart(preciseInput, mutableOptions);
  preciseInput.birthTime!.hour = 10;
  preciseInput.gender = '男';
  mutableOptions.scopes![0] = 'monthly';
  mutableOptions.horoscopeContext!.dateStr = '2027-08-06';
  mutableOptions.horoscopeContext!.hourIndex = 6;
  const locked = await pending;
  assert.deepEqual(Object.keys(locked.payloadByScope), ['yearly']);
  assert.deepEqual(locked.horoscopeContext, { dateStr, hourIndex: 0 });
  assert.equal(locked.payloadByScope.yearly.basic_info.gender, '女');
  assert.deepEqual(
    locked.payloadByScope.yearly.basic_info.four_pillars,
    runtime.payloadByScope.origin.basic_info.four_pillars,
  );
  assert.equal(locked.payloadByScope.yearly.basic_info.birth_time_label, '辰时');
  assert.match(locked.payloadByScope.yearly.basic_info.four_pillars!.hour_pillar, /辰$/);
  assert.equal(locked.payloadByScope.yearly.active_scope.solar_date, dateStr);
  assert.equal(locked.payloadByScope.yearly.active_scope.heavenly_stem, '丙');
  assert.equal(locked.payloadByScope.yearly.active_scope.earthly_branch, '午');
  const taskBook = buildCombinedZiweiPrompt(locked.payloadByScope.yearly, 'chat', '流年盘面', {
    currentTime: new Date('2026-08-06T04:30:00Z'),
  });
  assert.ok(
    taskBook.includes(
      `四柱八字：${Object.values(runtime.payloadByScope.origin.basic_info.four_pillars!).join(' ')}`,
    ),
  );
  assert.equal(preciseInput.birthTime!.hour, 10, '计算不能回写调用方后续输入');

  const displayParams = {
    input: { ...input, birthTime: { hour: 8, minute: 0 } },
    dateStr,
    hourIndex: 0,
    scope: 'yearly' as const,
  };
  const pendingDisplay = calculateZiweiDisplayPayload(displayParams);
  displayParams.dateStr = '2027-08-06';
  displayParams.hourIndex = 6;
  displayParams.input.birthTime.hour = 10;
  const display = await pendingDisplay;
  assert.equal(display.active_scope.solar_date, dateStr);
  assert.equal(display.active_scope.heavenly_stem, '丙');
  assert.deepEqual(
    display.basic_info.four_pillars,
    locked.payloadByScope.yearly.basic_info.four_pillars,
  );
});
