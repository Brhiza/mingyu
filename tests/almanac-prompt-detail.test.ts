import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { topic: 'move', question: '安排搬家', startDate: '2024-01-01', endDate: '2024-01-08', timePreferences: ['work-hours', 'morning'] } as const;

test('超过七天的简版保留全部日期和各时辰状态、时段偏好', async () => {
  const result = await calculate('almanac', input);
  assert.match(result.prompt.text, /【简版说明】/);
  assert.match(result.prompt.text, /未展开时辰宜忌、限制原因和传统历注/);
  assert.match(result.prompt.text, /须与当日初筛一并核对/);
  assert.match(result.prompt.text, /早子时00:00-01:00/); assert.match(result.prompt.text, /晚子时23:00-24:00/);
  const lines = result.prompt.text.split('\n');
  for (const day of result.data.days) {
    const index = lines.findIndex((line) => line.startsWith(`${day.date} `));
    assert.ok(index >= 0, day.date);
    const line = lines[index + 1]; assert.ok(line.startsWith('时辰初筛：'), day.date);
    const actual = new Map<string, string>();
    for (const group of line.slice('时辰初筛：'.length).split('；')) {
      const [status, entries] = group.split('：');
      for (const entry of entries.split('、')) actual.set(entry.replace(/〔[^〕]+〕/g, ''), status);
    }
    assert.equal(actual.size, 13, day.date);
    for (const hour of day.hours) {
      assert.equal(actual.get(hour.name), hour.screening.status, `${day.date}/${hour.name}`);
      const entry = line.split(/[：；、]/).find((part) => part.startsWith(hour.name))!;
      assert.equal(entry.includes('〔工作时间外〕'), !hour.preference.withinWorkHours, `${day.date}/${hour.name}`);
      assert.equal(entry.includes('〔非优先〕'), !hour.preference.preferredTime, `${day.date}/${hour.name}`);
    }
  }
});

test('短范围默认完整，长范围可追问展开或选择具体日期', async () => {
  const short = await calculate('almanac', { ...input, endDate: '2024-01-07' });
  assert.doesNotMatch(short.prompt.text, /【简版说明】/);
  assert.match(short.prompt.text, /早子时00:00-01:00/); assert.match(short.prompt.text, /值日神煞/);
  const result = await calculate('almanac', input);
  const full = await reprompt({ method: 'almanac', result, question: '完整依据', prompt: { detailMode: 'full' } });
  assert.doesNotMatch(full.prompt.text, /【简版说明】/); assert.match(full.prompt.text, /早子时00:00-01:00/);
  assert.match(full.prompt.text, /值日神煞/);
  const day = await reprompt({ method: 'almanac', result, question: '只看这天', prompt: { dates: ['2024-01-08'] } });
  assert.match(day.prompt.text, /2024-01-08 星期/); assert.doesNotMatch(day.prompt.text, /2024-01-07 星期/);
  assert.doesNotMatch(day.prompt.text, /【简版说明】/); assert.match(day.prompt.text, /值日神煞/);
  const compact = await calculate('almanac', { ...input, endDate: '2024-01-01', prompt: { detailMode: 'compact' } });
  assert.match(compact.prompt.text, /【简版说明】/);
  await assert.rejects(() => calculate('almanac', { ...input, prompt: { detailMode: 'unknown' } }));
});

test('长范围简版缩短提示词，完整结构化结果不变', async () => {
  const source = { ...input, endDate: '2024-01-30' };
  const compact = await calculate('almanac', source);
  const full = await calculate('almanac', { ...source, prompt: { detailMode: 'full' } });
  assert.deepEqual(compact.data.days, full.data.days);
  assert.deepEqual(compact.data.participants, full.data.participants);
  assert.ok(Buffer.byteLength(compact.prompt.text) < Buffer.byteLength(full.prompt.text) / 2);
  for (const day of compact.data.days) assert.ok(compact.prompt.text.includes(`${day.date} ${day.weekday}`), day.date);
});

test('HTTP、MCP 和发现目录支持简版与完整追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'almanac' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'almanac', input }); assert.equal(http.status, 200);
  const saved: any = await http.json(); assert.match(saved.prompt.text, /【简版说明】/);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'almanac', arguments: input } });
  const response: any = await mcp.json(); assert.equal(mcp.status, 200);
  assert.equal(response.result.structuredContent.prompt.text, saved.prompt.text);
  const follow = await send('/api/prompt', { method: 'almanac', result: saved, question: '完整依据', prompt: { detailMode: 'full' } });
  assert.equal(follow.status, 200); assert.doesNotMatch((await follow.json() as any).prompt.text, /【简版说明】/);
  const catalog: any = await (await worker.fetch(new Request('https://local/api/prompts?method=almanac'), env)).json();
  assert.deepEqual(catalog.methods.almanac.detailModes, ['compact', 'full']);
});
