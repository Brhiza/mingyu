import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const call = (calendar: unknown) => calculate('calendar', { question: '请说明结果', currentTime: '2025-01-01T00:00:00Z', calendar });

test('单项和全年节气保留历表、独立核验及跨年冬至', async () => {
  for (const year of [1900, 1986, 2024, 2199]) {
    const annual: any = (await call({ kind: 'solar-term', year })).data.result;
    assert.equal(annual.terms.length, 24);
    assert.ok(annual.terms.every((term: any) => new Date(term.utcTimestamp + 8 * 3600_000).getUTCFullYear() === year));
    assert.equal(annual.terms.at(-1).name, '冬至');
  }
  const winter: any = (await call({ kind: 'solar-term', year: 2024, index: 0 })).data.result;
  assert.equal(winter.terms[0].utcDateTime.slice(0, 4), '2023');
  await call({ kind: 'solar-term', year: 2200, index: 3 });
  await assert.rejects(() => call({ kind: 'solar-term', year: 2200 }));
  await assert.rejects(() => call({ kind: 'solar-term', year: 2024, index: 24 }));
});

test('月相与四正事件支持独立样例与边界校验', async () => {
  const newMoon: any = (await call({ kind: 'moon-phase', at: '2024-04-08T18:21:00Z' })).data.result;
  assert.equal(newMoon.eightPhaseName, '新月');
  assert.ok(Math.abs(Date.parse(newMoon.previousPrincipalPhase.utcDateTime) - Date.parse('2024-04-08T18:21:00Z')) < 60_000);
  await assert.rejects(() => call({ kind: 'moon-phase', at: '2024-04-08T18:21:00.001Z' }));
});

test('时间尺度区分 UTC、近似 UT1 和近似 TT；夏令时歧义不猜测', async () => {
  const j2000: any = (await call({ kind: 'time-scales', time: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, timezone: 0 } })).data.result;
  assert.equal(j2000.julianDayUtc, 2451545); assert.equal(j2000.approximateJulianDayUt1, j2000.julianDayUtc);
  assert.ok(Math.abs(j2000.deltaTSeconds - 63.86) < 0.01);
  assert.ok(Math.abs((j2000.approximateJulianDayTt - j2000.julianDayUtc) * 86400 - j2000.deltaTSeconds) < 0.0001);
  const local = { year: 2024, month: 11, day: 3, hour: 1, minute: 30, timeZoneId: 'America/New_York' };
  await assert.rejects(() => call({ kind: 'time-scales', time: local }), /歧义/);
  const a: any = (await call({ kind: 'time-scales', time: { ...local, timezone: -4 } })).data.result;
  const b: any = (await call({ kind: 'time-scales', time: { ...local, timezone: -5 } })).data.result;
  assert.equal(b.utcTimestamp - a.utcTimestamp, 3600_000);
  await assert.rejects(() => call({ kind: 'time-scales', time: { year: 2024, month: 3, day: 10, hour: 2, minute: 30, timeZoneId: 'America/New_York' } }), /不存在/);
  await assert.rejects(() => call({ kind: 'time-scales', time: { year: 2024, month: 1, day: 1, hour: 0, minute: 0 } }));
});

test('真太阳时使用真实 UTC 与用户经度，跨日、农历和历史时区明确', async () => {
  const birth = { year: 2024, month: 2, day: 10, hour: 0, minute: 5, timezone: 8 };
  const result: any = (await call({ kind: 'true-solar', birth, longitude: 75 })).data.result;
  assert.equal(result.utcDateTime, '2024-02-09T16:05:00.000Z');
  assert.equal(result.dayChange, -1); assert.equal(result.correction.longitudeCorrectionMinutes, -180);
  assert.equal(result.shichenIndex, 10);
  const lunar: any = (await call({ kind: 'true-solar', birth: { ...birth, month: 1, day: 1, calendar: 'lunar' }, longitude: 75 })).data.result;
  assert.equal(lunar.utcDateTime, result.utcDateTime); assert.equal(lunar.trueSolarDateTime, result.trueSolarDateTime);
  await assert.rejects(() => call({ kind: 'true-solar', birth, longitude: 181 }));
  await assert.rejects(() => call({ kind: 'true-solar', birth: { ...birth, leapMonth: true }, longitude: 75 }));
});

test('太阳光照保留正常日出日落、极昼极夜及民用日跨度', async () => {
  const time = { year: 2024, month: 6, day: 21, hour: 12, minute: 0, timezone: 0 };
  const normal: any = (await call({ kind: 'solar-illumination', time, latitude: 40, longitude: 0 })).data.result;
  assert.equal(normal.sunriseSunset.status, '正常交点');
  assert.deepEqual(normal.sunriseSunset.crossings.map((event: any) => event.direction), ['上行', '下行']);
  assert.equal(normal.window.endUtcMs - normal.window.startUtcMs, 86400_000);
  assert.equal(normal.daylight, true);
  assert.equal(normal.apparentSolarNoons.length, 1);
  assert.ok(normal.apparentSolarNoons[0].localDateTime.startsWith('2024-06-21T'));
  const polar: any = (await call({ kind: 'solar-illumination', time, latitude: 80, longitude: 0 })).data.result;
  assert.equal(polar.sunriseSunset.status, '全天高于阈值'); assert.equal(polar.daylight, true);
  const dark: any = (await call({ kind: 'solar-illumination', time: { ...time, month: 12 }, latitude: 80, longitude: 0 })).data.result;
  assert.equal(dark.sunriseSunset.status, '全天低于阈值'); assert.equal(dark.daylight, false);
  const dst: any = (await call({ kind: 'solar-illumination', time: { year: 2024, month: 11, day: 3, hour: 12, minute: 0, timeZoneId: 'America/New_York' }, latitude: 40.7, longitude: -74 })).data.result;
  assert.equal(dst.window.endUtcMs - dst.window.startUtcMs, 25 * 3600_000);
  const repeated: any = (await call({ kind: 'solar-illumination', time: { year: 1969, month: 9, day: 30, hour: 12, minute: 0, timezone: 11, timeZoneId: 'Pacific/Kwajalein' }, latitude: 8.7, longitude: 167.7 })).data.result;
  assert.equal(repeated.window.endUtcMs - repeated.window.startUtcMs, 47 * 3600_000);
  assert.deepEqual(repeated.apparentSolarNoons.map((event: any) => event.timezone), [11, -12]);
  assert.ok(repeated.apparentSolarNoons.every((event: any) => event.localDateTime.startsWith('1969-09-30T')));
});

test('五种结果均可追问并拒绝篡改，HTTP 与 MCP 共用入口', async () => {
  const cases = [{ kind: 'solar-term', year: 2024, index: 3 }, { kind: 'moon-phase', at: '2024-04-08T18:21:00Z' },
    { kind: 'time-scales', time: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, timezone: 0 } },
    { kind: 'true-solar', birth: { year: 2024, month: 2, day: 10, hour: 8, minute: 0, timezone: 8 }, longitude: 116.4 },
    { kind: 'solar-illumination', time: { year: 2024, month: 6, day: 21, hour: 12, minute: 0, timezone: 0 }, latitude: 40, longitude: 0 }];
  for (const calendar of cases) {
    const saved: any = JSON.parse(JSON.stringify(await call(calendar)));
    assert.match((await reprompt({ method: 'calendar', result: saved, question: '继续说明' })).prompt.text, /继续说明/);
    saved.data.result.kind = '伪造';
    await assert.rejects(() => reprompt({ method: 'calendar', result: saved, question: '继续说明' }), /不一致/);
  }
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'calendar' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  for (const calendar of cases) {
    const response = await send('/api/calculate', { method: 'calendar', input: { question: '问题', calendar } });
    assert.equal(response.status, 200); const saved = await response.json();
    assert.equal((await send('/api/prompt', { method: 'calendar', result: saved, question: '追问' })).status, 200);
    const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calendar', arguments: { question: '问题', calendar } } });
    assert.equal((await mcp.json()).result.structuredContent.data.result.kind, calendar.kind);
  }
});
