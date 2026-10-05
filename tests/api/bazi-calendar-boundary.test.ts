import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

async function post(path: string, input: object) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { status: response.status, body: await response.json() };
}

test('八字公开排盘传递公历当年的冬至节气日期', async () => {
  const { status, body } = await post('bazi/calculate', {
    gender: 'male',
    year: 2026,
    month: 12,
    day: 25,
    timeIndex: 6,
    dateType: 'solar',
    detailMode: 'full',
  });
  assert.equal(status, 200);
  const terms = body.data.seasonInfo.jieqiList;
  assert.equal(terms.length, 24);
  assert.deepEqual(terms[0], { name: '小寒', date: '2026-01-05' });
  assert.deepEqual(terms.at(-1), { name: '冬至', date: '2026-12-22' });
});

test('真太阳时公开换算传递支持年份边界的跨年结果', async () => {
  const { status, body } = await post('calendar/true-solar-time', {
    localDateTime: '1900-01-01T00:00:00',
    longitude: -180,
    timezone: 8,
  });
  assert.equal(status, 200);
  assert.equal(body.data.correctedTime.year, 1899);
  assert.equal(body.data.crossesDate, true);
  assert.match(body.data.promptText, /1899-12-31/);
});

test('八字公开完整结果区分历史夏令时出生钟表与校正后的排盘日期', async () => {
  const birthClockTime = {
    year: 1988,
    month: 6,
    day: 1,
    hour: 0,
    minute: 30,
    second: 42,
  };
  const input = {
    gender: 'male',
    dateType: 'solar',
    year: 1988,
    month: 6,
    day: 1,
    birthHour: 0,
    birthMinute: 30,
    birthSecond: 42,
  };
  for (const mode of [{ applyChinaDst: true }, { timeZoneId: 'Asia/Shanghai' }]) {
    const full = await post('bazi/calculate', { ...input, ...mode, detailMode: 'full' });
    assert.equal(full.status, 200);
    assert.deepEqual(full.body.data.birthClockTime, birthClockTime);
    assert.deepEqual(full.body.data.solarDate, { year: 1988, month: 5, day: 31 });

    const prompted = await post('bazi/prompt', {
      ...input,
      ...mode,
      question: '请解读本命盘。',
      baziFortuneScope: 'natal',
      responseMode: 'full',
    });
    assert.equal(prompted.status, 200);
    assert.deepEqual(prompted.body.data.result.birthClockTime, birthClockTime);
    assert.deepEqual(prompted.body.data.result.solarDate, { year: 1988, month: 5, day: 31 });
  }

  const compact = await post('bazi/calculate', {
    ...input,
    applyChinaDst: true,
    detailMode: 'compact',
  });
  assert.equal(compact.status, 200);
  assert.equal(Object.hasOwn(compact.body.data, 'birthClockTime'), false);
  assert.deepEqual(compact.body.data.solarDate, { year: 1988, month: 5, day: 31 });

  const promptSummary = await post('bazi/prompt', {
    ...input,
    applyChinaDst: true,
    question: '请解读本命盘。',
    baziFortuneScope: 'natal',
    responseMode: 'summary',
  });
  assert.equal(promptSummary.status, 200);
  assert.equal(Object.hasOwn(promptSummary.body.data.resultSummary, 'birthClockTime'), false);
});

test('八字公开结果在农历精确真太阳时输入中保留换算后的原始公历钟表', async () => {
  const input = {
    gender: 'male',
    dateType: 'lunar',
    year: 2024,
    month: 4,
    day: 12,
    birthHour: 0,
    birthMinute: 30,
    birthSecond: 42,
    useTrueSolarTime: true,
    birthLongitude: 75,
    timezone: 8,
  };
  const full = await post('bazi/calculate', { ...input, detailMode: 'full' });
  assert.equal(full.status, 200);
  assert.deepEqual(full.body.data.birthClockTime, {
    year: 2024,
    month: 5,
    day: 19,
    hour: 0,
    minute: 30,
    second: 42,
  });
  assert.deepEqual(full.body.data.timing.standardTime, full.body.data.birthClockTime);
  assert.deepEqual(full.body.data.solarDate, { year: 2024, month: 5, day: 18 });
  assert.deepEqual(full.body.data.timing.correctedTime, {
    year: 2024,
    month: 5,
    day: 18,
    hour: 21,
    minute: 34,
    second: 13,
  });

  const compact = await post('bazi/calculate', { ...input, detailMode: 'compact' });
  assert.equal(compact.status, 200);
  assert.equal(Object.hasOwn(compact.body.data, 'birthClockTime'), false);
  assert.deepEqual(compact.body.data.solarDate, full.body.data.solarDate);
});

test('八字公开完整结果的传统时辰与未知时辰均不出现虚构精确出生钟表', async () => {
  const input = { gender: 'male', dateType: 'solar', year: 2024, month: 5, day: 19 };
  for (const timeIndex of [1, -1]) {
    const result = await post('bazi/calculate', { ...input, timeIndex, detailMode: 'full' });
    assert.equal(result.status, 200, String(timeIndex));
    assert.equal(Object.hasOwn(result.body.data, 'birthClockTime'), false, String(timeIndex));
    assert.equal(result.body.data.isThreePillars, timeIndex === -1);
  }
});
