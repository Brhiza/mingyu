import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarDay, SolarTerm } from 'tyme4ts';
import { calculateLifetime } from '../src/systems/qimen/lifetime/chart';
import { scanLifetimeDynamic } from '../src/systems/qimen/lifetime/dynamic';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8 };
const range = { startDate: '2026-01-01', endDate: '2028-12-31' };

test('立春瞬时和精确交运重合时，前后年片段分别归入正确阶段', async () => {
  const data = await calculateLifetime({ birth, gender: 'male', stagePolicy: { model: 'decadalGanzhi' } });
  const term = SolarTerm.fromIndex(2026, 3).getJulianDay().getSolarTime();
  const instant = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
  const boundary = new Date(instant).toISOString();
  const stages = [
    { ...data.stages[1], stageIndex: 0, calendarStart: '2026-01-01', calendarEnd: '2026-02-04', startDateTime: '2026-01-01T00:00:00+08:00', endDateTimeExclusive: boundary },
    { ...data.stages[2], stageIndex: 1, calendarStart: '2026-02-03', calendarEnd: '2026-12-31', startDateTime: boundary, endDateTimeExclusive: '2027-01-01T00:00:00+08:00' },
  ];
  const facts = scanLifetimeDynamic(data.baseChart, stages, { startDate: '2026-02-03', endDate: '2026-02-04' }, { timezone: 8 });
  const before = facts.find((f) => f.kind === 'annual' && f.label.includes('立春前'))!;
  const after = facts.find((f) => f.kind === 'annual' && f.label.includes('立春后'))!;
  assert.equal(before.interval!.endTimestamp, instant);
  assert.equal(after.interval!.startTimestamp, instant);
  assert.deepEqual(before.stageIndices, [0]); assert.deepEqual(after.stageIndices, [1]);
  for (const d of facts.flatMap((f) => f.dates ?? []).filter((d) => d.date === '2026-02-04')) assert.deepEqual(d.stageIndices, [0, 1]);
});

test('当地立春日期、范围限制及 IANA 跳过的整日明确处理', async () => {
  const data = await calculateLifetime({ birth, gender: 'male' });
  const china = scanLifetimeDynamic(data.baseChart, data.stages, { startDate: '2026-02-03', endDate: '2026-02-04' }, { timezone: 8 });
  const chicago = scanLifetimeDynamic(data.baseChart, data.stages, { startDate: '2026-02-03', endDate: '2026-02-04' }, { timezone: -6, timeZoneId: 'America/Chicago' });
  assert.equal(china.find((f) => f.kind === 'annual' && f.label.includes('立春后'))!.interval!.startTimestamp, chicago.find((f) => f.kind === 'annual' && f.label.includes('立春后'))!.interval!.startTimestamp);
  assert.throws(() => scanLifetimeDynamic(data.baseChart, data.stages, { startDate: '2026-02-30', endDate: '2026-03-01' }, { timezone: 8 }));
  assert.throws(() => scanLifetimeDynamic(data.baseChart, data.stages, { startDate: '2026-01-01', endDate: '2057-01-01' }, { timezone: 8 }));
  assert.throws(() => scanLifetimeDynamic(data.baseChart, data.stages, { startDate: '2011-12-29', endDate: '2011-12-31' }, { timezone: 14, timeZoneId: 'Pacific/Apia' }), /不存在|歧义/);
});

test('跨 31 年的相邻立春前后片段对同一流年使用一致盘面事实', async () => {
  const data = await calculateLifetime({ birth, gender: 'male' });
  for (const context of [{ timezone: 8 }, { timezone: -5, timeZoneId: 'America/New_York' }]) {
    const facts = scanLifetimeDynamic(data.baseChart, data.stages, { startDate: '2026-01-01', endDate: '2056-12-31' }, context);
    for (let year = 2026; year < 2056; year++) {
      const after = facts.find((fact) => fact.kind === 'annual' && fact.label.startsWith(`${year}年立春后`));
      const nextBefore = facts.find((fact) => fact.kind === 'annual' && fact.label.startsWith(`${year + 1}年立春前`));
      assert.ok(after && nextBefore, `${context.timeZoneId ?? 'UTC+8'}/${year}`);
      for (const field of ['flowYear', 'branch', 'palace', 'details', 'supports', 'constraints', 'topics'] as const) {
        assert.deepEqual(after[field], nextBefore[field], `${context.timeZoneId ?? 'UTC+8'}/${year}/${field}`);
      }
    }
  }
});

test('动态事实进入提示词，支持完整日期、单阶段与保存后追问', async () => {
  const input = { question: '事业如何？', currentTime: '2025-01-01T00:00:00Z', birth, gender: 'male', stagePolicy: { model: 'decadalGanzhi' }, periodRange: range };
  const result = await calculate('qimen-lifetime', input);
  assert.ok(result.data.dynamicFacts!.some((fact) => fact.kind === 'annual'));
  assert.ok(result.data.dynamicFacts!.some((fact) => fact.kind === 'month-clash'));
  assert.match(result.prompt.text, /【动态时间事实】/);
  assert.match(result.prompt.text, /完整日期见结构化结果/);
  assert.match(result.prompt.text, /不得虚构其他流月流日盘/);
  const complete = await reprompt({ method: 'qimen-lifetime', result: JSON.parse(JSON.stringify(result)), question: '逐日查看', prompt: { detailMode: 'full' } });
  const day = result.data.dynamicFacts!.find((fact) => fact.kind === 'daily')!.dates![0];
  assert.ok(complete.prompt.text.includes(`${day.date} ${day.ganzhi}`));
  const focused = await reprompt({ method: 'qimen-lifetime', result, question: '只看此阶段', prompt: { scope: 'stage', stageIndex: 3, detailMode: 'full' } });
  assert.match(focused.prompt.text, /仅列与所选阶段相交/);
  const altered = structuredClone(result); altered.data.dynamicFacts![0].label = '伪造';
  await assert.rejects(() => reprompt({ method: 'qimen-lifetime', result: altered, question: '继续' }), /不一致/);
});

test('动态扫描在 Worker HTTP 与 MCP 结果和追问保持一致', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen-lifetime' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', birth, gender: 'male', currentTime: '2025-01-01T00:00:00Z', periodRange: { startDate: '2026-01-01', endDate: '2026-12-31' } };
  const http = await send('/api/calculate', { method: 'qimen-lifetime', input });
  assert.equal(http.status, 200); const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen-lifetime', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'qimen-lifetime', result: saved, question: '继续问' })).status, 200);
});
