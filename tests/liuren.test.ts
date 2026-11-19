import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculate, reprompt } from '../src/core';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const base = { question: '事业如何', currentTime };

test('大六壬在月将、中气和昼夜样例中保留天地盘、四课、三传和证据', async () => {
  const instants = ['2024-02-04T08:20:00Z', '2024-02-04T08:30:00Z', '2024-02-19T04:00:00Z', '2024-02-19T06:00:00Z'];
  for (let month = 1; month <= 12; month++) for (const hour of ['00', '12']) instants.push(`2025-${String(month).padStart(2, '0')}-15T${hour}:00:00Z`);
  const rules = new Set<string>();
  for (const instant of instants) {
    const result = await calculate('liuren', { ...base, divinationTime: instant });
    assert.equal(result.data.heavenlyPlate.length, 12);
    assert.equal(result.data.fourLessons.length, 4);
    assert.equal(result.data.threeTransmissions.length, 3);
    assert.equal(result.data.evidenceAnalysis?.plateFact.status, '完整');
    assert.equal('evidence' in result.data.evidenceAnalysis!, false);
    assert.equal('promptText' in result.data.evidenceAnalysis!, false);
    assert.equal(result.data.evidenceAnalysis!.platePositionFacts.length, 12);
    assert.equal(result.data.evidenceAnalysis!.lessons.length, 4);
    assert.ok(result.data.evidenceAnalysis!.calculationSteps.length > 0);
    assert.ok(result.data.evidenceAnalysis!.ordinaryTransmissionAdjudicationFact);
    assert.ok(result.data.evidenceAnalysis!.traditionalFacts.length > 0);
    assert.ok(result.prompt.text.includes(result.data.evidenceAnalysis!.transmissionRuleFact.promptText));
    assert.ok(result.data.evidenceAnalysis!.transmissions.every((item) => result.prompt.text.includes(item.promptText)));
    rules.add(result.data.transmissionRule!);
  }
  assert.ok(rules.size >= 4, `样例仅覆盖 ${[...rules].join('、')}`);
});

test('四种断课模板及全部口径进入提示词并与课盘位置一致', async () => {
  for (const template of ['general', 'ganqing', 'shiye', 'caifu'] as const) {
    const result = await calculate('liuren', { ...base, prompt: { liurenTemplate: template, schools: ['keti', 'bifafu', 'leishen'], includeClassics: true } });
    const labels = { general: '通用', ganqing: '感情关系', shiye: '事业工作', caifu: '财富财运' };
    assert.ok(result.prompt.text.includes(`【断课模板】\n${labels[template]}`));
    for (const label of ['课体法', '《毕法赋》法', '类神神将法', '多口径', '经典依据']) assert.ok(result.prompt.text.includes(label));
  }
  await assert.rejects(() => calculate('liuren', { ...base, prompt: { liurenTemplate: 'bad' } }));
  await assert.rejects(() => calculate('liuren', { ...base, divinationTime: '2025-01-01' }));
});

test('原课追问重建证据并校验盘面，主题与细项进入任务', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('liuren', base)));
  saved.data.evidenceAnalysis = { injected: '伪造证据' };
  const result = await reprompt({ method: 'liuren', result: saved, question: '是否适合跳槽', prompt: { liurenTemplate: 'shiye', topicId: 'career', subtopicId: 'job-change' } });
  assert.match(result.prompt.text, /是否适合跳槽/);
  assert.match(result.prompt.text.split('【任务】')[1], /工作变动/);
  assert.doesNotMatch(result.prompt.text, /伪造证据/);
  for (const mutate of [
    (data: any) => { data.heavenlyPlate[0].god = '伪造'; },
    (data: any) => { data.fourLessons[0].upper = '伪造'; },
    (data: any) => { data.threeTransmissions[0].branch = '伪造'; },
    (data: any) => { data.timestamp += 3600_000; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'liuren', result: bad, question: '追问' }), /不一致/);
  }
  const baseline = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  const original = baseline.promptCapabilities.find((item: any) => item.methodId === 'liuren');
  assert.deepEqual(catalog.liuren.topicIds, original.topicIds);
  assert.deepEqual(catalog.liuren.subtopics, original.subtopics);
  for (const [topicId, choices] of Object.entries(catalog.liuren.subtopics)) for (const choice of choices as { id: string; label: string }[]) {
    const response = await reprompt({ method: 'liuren', result: saved, question: '追问', prompt: { topicId, subtopicId: choice.id } });
    assert.ok(response.prompt.text.split('【任务】')[1].includes(choice.label));
  }
});

test('Worker HTTP 与 MCP 使用同一大六壬盘面和提示词', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'liuren' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'liuren', input: base });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'liuren', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'liuren', arguments: base } });
  assert.equal(mcp.status, 200);
  assert.deepEqual((await mcp.json()).result.structuredContent.data.threeTransmissions, saved.data.threeTransmissions);
});
