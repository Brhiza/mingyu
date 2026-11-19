import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { numberEnergy, numberEnergyPair } from '../src/systems/number-energy';
import worker from '../src/worker';

const question = '这个号码如何？';

test('保存的号码可用于新问题，修改计算事实会被拒绝', async () => {
  const result = await calculate('number-energy', { value: '粤B102503', purpose: 'plate', question, prompt: { topicId: 'general', subtopicId: 'number-energy', scope: 'custom' } });
  const saved = JSON.parse(JSON.stringify(result));
  const same = await reprompt({ method: 'number-energy', result: saved, question });
  assert.equal(same.prompt.text, result.prompt.text);
  const reply = await reprompt({ method: 'number-energy', result: saved, question: '如何选择？' });
  assert.match(reply.prompt.text, /如何选择/);
  for (const pair of saved.data.energyPairs) assert.ok(reply.prompt.text.includes(pair.trigramEvidence.explanation));
  for (const mutate of [
    (data: any) => { data.energyPairs[0].name = '伪造'; },
    (data: any) => { data.primaryNumerology.poem = '伪造'; },
    (data: any) => { data.input.value = '999'; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'number-energy', result: bad, question }), /不一致/);
  }
  saved.data.primaryNumerology.poem = '伪造';
  const fresh = await calculate('number-energy', { value: '粤B102503', purpose: 'plate', question });
  assert.notEqual(fresh.data.primaryNumerology.poem, '伪造');
});

test('HTTP 与 MCP 可发现、调用并追问数字能量', async () => {
  const input = { value: '102503', question, currentTime: '2025-01-01T00:00:00Z' };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'number-energy' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'number-energy', input });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.prompt.text, /八星配对/);
  const reply = await send('/api/prompt', { method: 'number-energy', result, question: '新问题' });
  assert.equal(reply.status, 200);
  assert.match((await reply.json()).prompt.text, /新问题/);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(['number-energy']);
  const client = new Client({ name: 'number-test', version: '1' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), ['number-energy', 'reprompt', 'prompt_catalog']);
    const computed = await client.callTool({ name: 'number-energy', arguments: input });
    assert.deepEqual(computed.structuredContent?.data, result.data);
    const followup = await client.callTool({ name: 'reprompt', arguments: { method: 'number-energy', result: computed.structuredContent, question: '新问题' } });
    assert.equal(followup.isError, undefined);
    assert.match(String((followup.structuredContent?.prompt as { text: string }).text), /新问题/);
  } finally { await client.close(); await server.close(); }
});
test('八卦数字两两组合的变爻与来源可核对，非法号码拒绝', () => {
  for (const a of '12346789') for (const b of '12346789') {
    const pair = numberEnergyPair(a, b);
    const changed = pair.from.lines.flatMap((line, index) => line === pair.to.lines[index] ? [] : [index + 1]);
    assert.deepEqual(pair.changedLines, changed, `${a}${b}`);
    assert.equal(pair.from.digit, Number(a)); assert.equal(pair.to.digit, Number(b));
    assert.ok(pair.name && pair.starName && pair.explanation);
  }
  for (const value of ['', '中文', ' '.repeat(65), '1'.repeat(65)]) assert.throws(() => numberEnergy({ value, question }));
});
