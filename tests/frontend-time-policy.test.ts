import assert from 'node:assert/strict';
import test from 'node:test';

import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import {
  applyFrontendBirthTimeDefaults,
  FRONTEND_DEFAULT_TIME_ZONE_ID,
} from '../src/lib/time-policy';

test('网页端应固定关闭旧夏令时开关，只在真太阳时模式注入统一历史时区', () => {
  assert.deepEqual(
    applyFrontendBirthTimeDefaults({ useTrueSolarTime: false, applyChinaDst: true }),
    { useTrueSolarTime: false, applyChinaDst: false },
  );
  assert.deepEqual(
    applyFrontendBirthTimeDefaults({ useTrueSolarTime: true, applyChinaDst: true }),
    {
      useTrueSolarTime: true,
      timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
      applyChinaDst: false,
    },
  );
});

test('网页端八字与紫微应共用 Asia/Shanghai 历史时区和唯一真太阳时结果', () => {
  const common = {
    gender: 'male' as const,
    dateType: 'solar' as const,
    year: '1988',
    month: '7',
    day: '15',
    timeIndex: '' as const,
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: '12',
    birthMinute: '0',
    birthLongitude: '116.4074',
    applyChinaDst: true,
  };
  const person = buildPersonFromInput(common);
  const bazi = calculateFullBaziChart(person);
  const ziwei = buildZiweiChartInput({ ...common, name: '测试' });
  const baziTime = bazi.timing?.correctedTime;

  assert.equal(person.timeZoneId, 'Asia/Shanghai');
  assert.equal(person.applyChinaDst, false);
  assert.equal(bazi.timing?.evidence.timezoneEvidence?.resolvedOffsetHours, 9);
  assert.equal(ziwei.trueSolarEvidence?.timezoneEvidence?.resolvedOffsetHours, 9);
  assert.ok(baziTime);
  assert.equal(ziwei.birthTimeIndex, getTimeIndexFromClock(baziTime.hour, baziTime.minute));
  assert.equal(bazi.timing?.evidence.summaryFact.status, '证据链完整');
  assert.equal(ziwei.trueSolarEvidence?.summaryFact.status, '证据链完整');
});
