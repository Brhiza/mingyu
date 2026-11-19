import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculate, reprompt } from '../src/core';
import { calculateZhuge } from '../src/systems/zhuge';
import strokes from '../src/systems/zhuge-strokes.json';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const base = { question: '工作如何？', currentTime };

test('诸葛神数三字取数、追问校验及主题细项', async () => {
  assert.ok(Object.keys(strokes).length > 0);
  const saved = JSON.parse(JSON.stringify(await calculate('zhuge', { ...base, zhuge: { text: '定乾坤' } })));
  assert.equal(saved.data.mode, 'text');
  const next = await reprompt({ method: 'zhuge', result: saved, question: '财务如何', prompt: { topicId: 'wealth', subtopicId: 'income' } });
  assert.match(next.prompt.text, /财务如何/);
  assert.match(next.prompt.text.split('【任务】')[1], /收入与积累/);
  for (const mutate of [
    (data: any) => { data.strokes[0] = 99; },
    (data: any) => { data.number = 1; },
    (data: any) => { data.sign.poem = '伪造签诗'; },
    (data: any) => { data.interpretation.condition = '伪造释义'; },
  ]) {
    const altered = structuredClone(saved); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'zhuge', result: altered, question: '追问' }), /不一致/);
  }
  const baseline = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  const original = baseline.promptCapabilities.find((item: any) => item.methodId === 'zhuge');
  assert.deepEqual(catalog.zhuge.topicIds, original.topicIds);
  assert.deepEqual(catalog.zhuge.subtopics, original.subtopics);
  for (const [topicId, choices] of Object.entries(catalog.zhuge.subtopics)) {
    for (const choice of choices as { id: string; label: string }[]) {
      const result = await reprompt({ method: 'zhuge', result: saved, question: '追问', prompt: { topicId, subtopicId: choice.id } });
      assert.ok(result.prompt.text.split('【任务】')[1].includes(choice.label));
    }
  }
});

test('诸葛神数支持数字取签及追问篡改校验', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('zhuge', { ...base, zhuge: { method: 'numbers', numbers: [3, 6, 8] } })));
  assert.equal(saved.data.mode, 'numbers');
  assert.equal(saved.data.number, 368);
  assert.match(saved.prompt.text, /报数：3、6、8/);
  const next = await reprompt({ method: 'zhuge', result: saved, question: '感情走向', prompt: { topicId: 'relationship' } });
  assert.match(next.prompt.text, /感情走向/);
  const altered = structuredClone(saved); altered.data.number = 1;
  await assert.rejects(() => reprompt({ method: 'zhuge', result: altered, question: '追问' }), /不一致/);
});

test('诸葛神数五枚铜钱覆盖全部三十二课、支持随机/手工与追问校验', async () => {
  const numbers = new Set<number>();
  for (let number = 0; number < 32; number++) {
    const pattern = number.toString(2).padStart(5, '0');
    const result = await calculate('zhuge', { ...base, zhuge: { method: 'coins', pattern } });
    assert.equal(result.data.mode, 'coins');
    numbers.add(result.data.number);
    assert.equal(result.data.draws.length, 5);
    assert.equal(result.data.draws.map((item) => item.symbol === '●' ? '1' : '0').join(''), pattern);
    assert.ok(result.prompt.text.includes(result.data.poem));
    assert.ok(result.prompt.text.includes(result.data.interpretation.interpretation));
    if (result.data.interpretation.classicalImage) assert.ok(result.prompt.text.includes(result.data.interpretation.classicalImage.quote));
  }
  assert.equal(numbers.size, 32);

  let index = 0;
  const samples = [0.9, 0.1, 0.9, 0.1, 0.9];
  const rand = calculateZhuge({ ...base, zhuge: { method: 'coins' } }, currentTime, () => samples[index++]);
  assert.equal(rand.data.mode, 'coins');
  assert.equal(rand.data.symbol, '●○●○●');
  assert.equal(rand.data.draw.method, 'random');
  assert.equal(index, 5);
  assert.doesNotMatch(JSON.stringify(rand), /"(?:seed|samples|randomTrace)"|随机轨迹|随机种子|\breplay\b/i);

  for (const pattern of ['阳阴阳阴阳', '正反正反正', '公字公字公', '10101', '●○●○●']) {
    const manual = await calculate('zhuge', { ...base, zhuge: { method: 'coins', pattern } });
    assert.equal(manual.data.symbol, '●○●○●');
    assert.equal(manual.data.draw.method, 'manual');
  }
  await assert.rejects(() => calculate('zhuge', { ...base, zhuge: { method: 'coins', pattern: '0102' } }));
  await assert.rejects(() => calculate('zhuge', { ...base, zhuge: { method: 'text', pattern: '10101' } }));

  const savedCoins = JSON.parse(JSON.stringify(await calculate('zhuge', { ...base, zhuge: { method: 'coins', pattern: '10101' } })));
  const followed = await reprompt({ method: 'zhuge', result: savedCoins, question: '财务如何？', prompt: { topicId: 'wealth', subtopicId: 'income' } });
  assert.match(followed.prompt.text, /财务如何/);
  assert.match(followed.prompt.text.split('【任务】')[1], /收入与积累/);
  for (const mutate of [
    (data: any) => { data.poem = '伪造卦诗'; },
    (data: any) => { data.interpretation.condition = '伪造释义'; },
    (data: any) => { data.draws[0].polarity = '阴'; },
  ]) {
    const altered = structuredClone(savedCoins); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'zhuge', result: altered, question: '追问' }), /不一致/);
  }
});

test('Worker HTTP 与 MCP 使用统一诸葛神数（汉字/数字/铜钱）', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'zhuge' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);

  const inputText = { ...base, zhuge: { text: '定乾坤' } };
  const resText = await send('/api/calculate', { method: 'zhuge', input: inputText });
  assert.equal(resText.status, 200);
  const savedText = await resText.json();
  assert.equal((await send('/api/prompt', { method: 'zhuge', result: savedText, question: '追问' })).status, 200);
  const mcpText = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'zhuge', arguments: inputText } });
  assert.equal(mcpText.status, 200);
  assert.equal((await mcpText.json()).result.structuredContent.data.number, savedText.data.number);

  const inputCoins = { ...base, zhuge: { method: 'coins', pattern: '10101' } };
  const resCoins = await send('/api/calculate', { method: 'zhuge', input: inputCoins });
  assert.equal(resCoins.status, 200);
  const savedCoins = await resCoins.json();
  assert.equal((await send('/api/prompt', { method: 'zhuge', result: savedCoins, question: '追问' })).status, 200);
  const mcpCoins = await send('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'zhuge', arguments: inputCoins } });
  assert.equal(mcpCoins.status, 200);
  assert.equal((await mcpCoins.json()).result.structuredContent.data.symbol, '●○●○●');

  assert.equal((await send('/api/calculate', { method: 'kongming', input: {} })).status, 400);
  assert.equal((await send('/api/calculate', { method: 'zodiac', input: { question: '测试', zodiac: '马', year: 2025 } })).status, 400);
});
