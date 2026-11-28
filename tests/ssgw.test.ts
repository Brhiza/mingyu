import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { calculateSsgw } from '../src/systems/ssgw';
import { rollShengbeiResult } from '../src/app/components/divination/ManualCastStudio';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const input = { currentTime, question: '工作如何', ssgw: { method: 'manual', number: 1 } };

test('92 支签均有可引用的签文与分类解说', async () => {
  const ids = new Set<number>();
  for (let number = 1; number <= 92; number++) {
    const result = await calculate('ssgw', { ...input, ssgw: { method: 'manual', number } });
    ids.add(result.data.number);
    assert.equal(result.data.number, number);
    assert.ok(result.prompt.text.includes(result.data.poem), String(number));
    const coreMeaning = result.data.details['此签核心']?.trim();
    for (const [key, value] of Object.entries(result.data.details)) {
      if (!value.trim()) continue;
      if (key === '核心寓意' && coreMeaning && value.trim() === coreMeaning) continue;
      assert.ok(result.prompt.text.includes(`${key}：${value}`), `${number}/${key}`);
    }
    assert.match(result.prompt.text, /来源尚待独立核验/);
  }
  assert.equal(ids.size, 92);
  const crossReference = await calculate('ssgw', { ...input, ssgw: { method: 'manual', number: 36 } });
  assert.match(crossReference.data.story, /第5签/);
  assert.doesNotMatch(crossReference.prompt.text, /第5签/);
});

test('随机、指定签号与求签时间保持实际结果，不暴露随机轨迹', async () => {
  const first = await calculateSsgw({ question: '问题', ssgw: { method: 'random' } }, currentTime, () => 0);
  const last = await calculateSsgw({ question: '问题', ssgw: { method: 'random' } }, currentTime, () => 0.999);
  assert.equal(first.data.number, 1); assert.equal(last.data.number, 92);
  for (const instant of [currentTime, '2024-02-04T08:20:00Z', '2024-02-04T08:30:00Z', '2025-02-28T15:00:00Z', '2025-02-28T16:00:00Z']) {
    const result = await calculate('ssgw', { ...input, currentTime: instant });
    assert.equal(result.data.timestamp, Date.parse(instant));
    assert.match(result.prompt.text, /历法时区 UTC\+08:00/);
    assert.equal(Object.keys(result.data.ganzhi).length, 4);
  }
  const random = await calculate('ssgw', { question: '问题', currentTime });
  assert.ok(random.data.number >= 1 && random.data.number <= 92);
  assert.doesNotMatch(JSON.stringify(random), /"(?:seed|samples|randomTrace)"|随机轨迹|随机种子|\bseed\b|\breplay\b|重放/i);
  for (const settings of [{ method: 'manual' }, { method: 'manual', number: 93 }, { method: 'random', number: 1 }, { number: 1 }, { method: 'random', seed: 'x' }]) {
    await assert.rejects(() => calculate('ssgw', { question: '问题', ssgw: settings }));
  }
});

test('追问复用同一签号并重新核验签面，不能注入伪造资料', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('ssgw', input)));
  saved.data.evidenceAnalysis.principal.poem = '伪造证据';
  const next = await reprompt({ method: 'ssgw', result: saved, question: '财务怎么做', prompt: { topicId: 'wealth', subtopicId: 'income' } });
  assert.ok(next.prompt.text.includes(saved.data.poem));
  assert.match(next.prompt.text, /财务怎么做/);
  assert.match(next.prompt.text, /收入与积累/);
  assert.doesNotMatch(next.prompt.text, /伪造证据/);
  for (const mutate of [
    (d: any) => { d.poem = '伪造签诗'; },
    (d: any) => { d.details.事业 = '伪造解说'; },
    (d: any) => { d.ganzhi.day = '甲子'; },
    (d: any) => { d.draw.selectedNumber = 2; },
  ]) {
    const altered = structuredClone(saved);
    mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'ssgw', result: altered, question: '追问' }));
  }
  for (const topic of catalog.ssgw.topicIds) {
    const subtopics = (catalog.ssgw.subtopics as Record<string, { id: string; label: string }[]>)[topic] ?? [];
    for (const subtopic of subtopics) {
      const result = await reprompt({ method: 'ssgw', result: saved, question: '追问', prompt: { topicId: topic, subtopicId: subtopic.id } });
      assert.ok(result.prompt.text.split('【任务】')[1].includes(subtopic.label));
    }
  }
});

test('Worker HTTP 与 MCP 调用共享灵签实现', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'ssgw' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'ssgw', input });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.number, 1);
  assert.equal((await send('/api/prompt', { method: 'ssgw', result, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ssgw', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.number, 1);
});

test('掷圣杯按双杯独立正反概率分布（50% 圣杯、25% 笑杯、25% 阴杯）', () => {
  const fromSeq = (seq: number[]) => {
    let i = 0;
    return rollShengbeiResult(() => seq[i++]!);
  };

  const sacredA = fromSeq([0.1, 0.9]);
  assert.equal(sacredA.kind, 'sacred');
  assert.equal(sacredA.ok, true);
  assert.deepEqual(sacredA.pair, ['yang', 'yin']);

  const sacredB = fromSeq([0.9, 0.1]);
  assert.equal(sacredB.kind, 'sacred');
  assert.equal(sacredB.ok, true);
  assert.deepEqual(sacredB.pair, ['yin', 'yang']);

  const laugh = fromSeq([0.1, 0.1]);
  assert.equal(laugh.kind, 'laugh');
  assert.equal(laugh.ok, false);
  assert.deepEqual(laugh.pair, ['yang', 'yang']);

  const yin = fromSeq([0.9, 0.9]);
  assert.equal(yin.kind, 'yin');
  assert.equal(yin.ok, false);
  assert.deepEqual(yin.pair, ['yin', 'yin']);
});
