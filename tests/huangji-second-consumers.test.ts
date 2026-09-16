import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

test('皇极公开计算在公共历法整秒交接切换节气和日序', async () => {
  for (const fixture of [
    { date: '2025-12-21T23:03:05+08:00', term: '冬至', year: 2026, day: 1 },
    { date: '2026-06-21T16:24:30+08:00', term: '夏至', year: 2026, day: 181 },
    { date: '2024-02-19T12:13:12+08:00', term: '雨水', year: 2024, day: 61 },
  ]) {
    const response = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/metaphysics/huangji-jingshi/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customDate: fixture.date }),
      }),
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      ok: boolean;
      data: { dateTimeForecast: { calendar: Record<string, unknown> } };
    };
    assert.equal(body.ok, true);
    const calendar = body.data.dateTimeForecast.calendar;
    assert.equal(calendar.activeSolarTerm, fixture.term, fixture.date);
    assert.equal(calendar.forecastYear, fixture.year);
    assert.equal(calendar.dayOfYear, fixture.day);
    assert.equal(calendar.actualDayInSolarTerm, 1);
  }
});

test('皇极提示词入口在节气后满二十四小时按整数毫秒换日序', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/metaphysics/huangji-jingshi/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customDate: '2026-06-22T16:24:30+08:00',
        question: '核对目标时刻的日序。',
        responseMode: 'full',
      }),
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    data: { prompt: string; result: { dateTimeForecast: { calendar: Record<string, unknown> } } };
  };
  assert.equal(body.ok, true);
  assert.equal(body.data.result.dateTimeForecast.calendar.actualDayInSolarTerm, 2);
  assert.equal(body.data.result.dateTimeForecast.calendar.dayOfYear, 182);
  assert.match(body.data.prompt, /夏至后第2日/u);
});
