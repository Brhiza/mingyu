import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildSkillZipBuffer } from '../scripts/build-skill-package.mjs';
import { generateOpenApiDocument } from '../scripts/generate-openapi';
import { methodExamples } from '../scripts/method-examples.mjs';
import { calculate } from '../src/core';
import { createServer } from '../src/mcp';
import { methodIds } from '../src/schema';
import worker from '../src/worker';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const assets = { fetch: async () => new Response('public assets') };

test('HTTP compact 模式通过 repromptToken 大幅减小体积并支持无损追问', async () => {
  const env = { ASSETS: assets };
  const post = (path: string, body: unknown) =>
    worker.fetch(
      new Request(`https://example.test${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
    );

  const fullRes = await post('/api/calculate', { method: 'qimen', input: methodExamples.qimen });
  assert.equal(fullRes.status, 200);
  const fullBytes = Buffer.byteLength(await fullRes.text());

  const compactRes = await post('/api/calculate', {
    method: 'qimen',
    input: methodExamples.qimen,
    responseMode: 'compact',
  });
  assert.equal(compactRes.status, 200);
  const compactText = await compactRes.text();
  const compactJson = JSON.parse(compactText) as {
    data?: unknown;
    repromptToken?: string;
    prompt: { text: string };
  };
  assert.equal('data' in compactJson, false, 'compact 模式不应返回完整 data 树');
  assert.ok(compactJson.repromptToken?.startsWith('mingyu:v2:d1:'));
  assert.ok(Buffer.byteLength(compactText) < fullBytes * 0.35, `compact 体积 (${Buffer.byteLength(compactText)}) 应显著小于 full (${fullBytes})`);

  const followRes = await post('/api/prompt', {
    repromptToken: compactJson.repromptToken,
    question: '此时出行方向有何注意事项？',
  });
  assert.equal(followRes.status, 200);
  const followJson = (await followRes.json()) as { method: string; prompt: { text: string } };
  assert.equal(followJson.method, 'qimen');
  assert.ok(followJson.prompt.text.includes('此时出行方向有何注意事项？'));

  const badTokenRes = await post('/api/prompt', {
    repromptToken: 'mingyu:v2:d1:invalid_base64',
    question: '测试坏令牌',
  });
  assert.equal(badTokenRes.status, 400);
});

test('MCP router 模式仅暴露 4 个工具，体积大幅精简且支持完整调用链', async () => {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer(methodIds, undefined, { mode: 'router' });
  const client = new Client({ name: 'router-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);

  try {
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map((t) => t.name),
      ['list_methods', 'get_method_schema', 'calculate', 'reprompt'],
    );
    const listBytes = Buffer.byteLength(JSON.stringify(listed));
    assert.ok(listBytes < 10_000, `router 模式 tools/list 应远小于 10KB，实际 ${listBytes}`);

    const methodsRes = await client.callTool({ name: 'list_methods', arguments: { category: 'divination' } });
    assert.equal(methodsRes.isError, undefined);
    assert.ok((methodsRes.structuredContent as { categories: Array<{ id: string }> }).categories.some((c) => c.id === 'divination'));

    const schemaRes = await client.callTool({ name: 'get_method_schema', arguments: { method: 'tarot' } });
    assert.equal(schemaRes.isError, undefined);
    assert.equal((schemaRes.structuredContent as { method: string }).method, 'tarot');

    const calcRes = await client.callTool({
      name: 'calculate',
      arguments: { method: 'tarot', input: methodExamples.tarot },
    });
    assert.equal(calcRes.isError, undefined);
    const calcStructured = calcRes.structuredContent as { data?: unknown; repromptToken?: string; prompt: { text: string } };
    assert.equal('data' in calcStructured, false);
    assert.ok(calcStructured.repromptToken);

    const followRes = await client.callTool({
      name: 'reprompt',
      arguments: { repromptToken: calcStructured.repromptToken, question: '请进一步分析牌面' },
    });
    assert.equal(followRes.isError, undefined);
    assert.ok((followRes.structuredContent as { prompt: { text: string } }).prompt.text.includes('请进一步分析牌面'));
  } finally {
    await client.close();
    await server.close();
  }
});

test('Worker 支持 CORS 跨域预检、/api/health 与 /mcp?mode=router', async () => {
  const env = { ASSETS: assets, ACCESS_TOKEN: 'secret-token', CORS_ORIGIN: 'https://client.example' };
  const preflight = await worker.fetch(new Request('https://example.test/api/calculate', { method: 'OPTIONS' }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://client.example');

  const health = await worker.fetch(
    new Request('https://example.test/api/health', { headers: { authorization: 'Bearer secret-token' } }),
    env,
  );
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), 'https://client.example');
  const healthJson = (await health.json()) as { status: string; methodsCount: number };
  assert.equal(healthJson.status, 'ok');
  assert.equal(healthJson.methodsCount, methodIds.length);

  const mcpList = await worker.fetch(
    new Request('https://example.test/mcp?mode=router', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }),
    env,
  );
  assert.equal(mcpList.status, 200);
  assert.equal(mcpList.headers.get('access-control-allow-origin'), 'https://client.example');
  const mcpJson = (await mcpList.json()) as { result: { tools: Array<{ name: string }> } };
  assert.deepEqual(
    mcpJson.result.tools.map((t) => t.name),
    ['list_methods', 'get_method_schema', 'calculate', 'reprompt'],
  );
});

test('OpenAPI 3.1 规范覆盖全量端点与全部术数方法', () => {
  const doc = generateOpenApiDocument('https://aov.cc');
  assert.equal(doc.openapi, '3.1.0');
  assert.deepEqual(doc.components.schemas.MethodId.enum, [...methodIds]);
  for (const p of ['/api/health', '/api/methods', '/api/schema', '/api/prompts', '/api/calculate', '/api/prompt']) {
    assert.ok(Object.hasOwn(doc.paths, p), `缺少路径 ${p}`);
  }
});

test('紫微飞星流派提示词包含离心自化与对宫集禄集忌脉络', async () => {
  const res = (await calculate('ziwei', {
    ...methodExamples.ziwei,
    prompt: { schools: ['feixing'] },
  })) as { prompt: { text: string } };
  assert.match(res.prompt.text, /【飞星关键脉络（离心自化\/对宫\/集禄集忌）】/);
  assert.match(res.prompt.text, /离心自化：/);
  assert.match(res.prompt.text, /多宫集忌焦点/);
});

test('本地 CLI 支持 --compact 与 --token 无损追问', () => {
  buildSkillZipBuffer(rootDir, { rebuildCli: true });
  const cliEntry = join(rootDir, 'dist-cli', 'mingyu.mjs');
  const scratch = mkdtempSync(join(tmpdir(), 'mingyu-cli-compact-'));
  try {
    const standalone = join(scratch, 'mingyu.mjs');
    writeFileSync(standalone, readFileSync(cliEntry));
    const fullPath = join(scratch, 'full.json');

    const compactOut = JSON.parse(
      execFileSync(
        process.execPath,
        [standalone, 'calculate', 'qimen', '--input', JSON.stringify(methodExamples.qimen), '--output', fullPath, '--compact'],
        { cwd: scratch, encoding: 'utf8' },
      ),
    ) as { data?: unknown; repromptToken: string; prompt: { text: string } };

    assert.equal('data' in compactOut, false);
    assert.ok(compactOut.repromptToken.startsWith('mingyu:v2:d1:'));
    const savedFull = JSON.parse(readFileSync(fullPath, 'utf8')) as { data: unknown };
    assert.ok(savedFull.data);

    const tokenFollow = JSON.parse(
      execFileSync(
        process.execPath,
        [standalone, 'reprompt', '--token', compactOut.repromptToken, '--question', '方位吉凶如何？'],
        { cwd: scratch, encoding: 'utf8' },
      ),
    ) as { prompt: { text: string } };
    assert.ok(tokenFollow.prompt.text.includes('方位吉凶如何？'));
    assert.equal(tokenFollow.prompt.text.split('【解读与交付契约】').length - 1, 1, '追问提示词应只附带一次解读与交付契约');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('预设提示词按术数类别与提问主题自动附带精炼无串味的解读与交付契约', async () => {
  const baziRes = (await calculate('bazi', {
    ...methodExamples.bazi,
    question: '我明年适合换工作或跳槽吗？',
  })) as { prompt: { text: string } };
  assert.ok(baziRes.prompt.text.includes('【解读与交付契约】'));
  assert.ok(baziRes.prompt.text.includes('直面推演，拒绝敷衍'));
  assert.ok(baziRes.prompt.text.includes('大白话转译'));
  assert.ok(baziRes.prompt.text.includes('事业焦点'));
  assert.equal(baziRes.prompt.text.includes('多候选考时'), false, '精确八字单盘不应误触发多候选考时');
  assert.equal(baziRes.prompt.text.includes('咨询相关专业人士'), false, '提示词契约不应堆砌诱发模型敷衍的免责声明');

  const astrolabeRes = (await calculate('astrolabe', methodExamples.astrolabe)) as { prompt: { text: string } };
  assert.equal(astrolabeRes.prompt.text.includes('多候选考时'), false, '精确西洋星盘单盘不应误触发多候选考时');

  const qimenLifeRes = (await calculate('qimen-lifetime', methodExamples['qimen-lifetime'])) as { prompt: { text: string } };
  assert.equal(qimenLifeRes.prompt.text.includes('多候选考时'), false, '奇门终身局单盘不应误触发多候选考时');

  const xiaoliurenRes = (await calculate('xiaoliuren', {
    ...methodExamples.xiaoliuren,
    question: '今天去面试这个岗位，结果怎么样？',
  })) as { prompt: { text: string } };
  assert.ok(xiaoliurenRes.prompt.text.includes('事业焦点'));
  assert.equal(xiaoliurenRes.prompt.text.includes('学业考试焦点'), false, '求职面试不应错配为学业考试焦点');

  const tarotRes = (await calculate('tarot', {
    ...methodExamples.tarot,
    question: '我和前任还有机会复合吗？',
  })) as { prompt: { text: string } };
  assert.ok(tarotRes.prompt.text.includes('实际牌序'));
  assert.equal(tarotRes.prompt.text.includes('夫妻宫'), false, '塔罗不应串入八字夫妻宫文案');
  assert.equal(tarotRes.prompt.text.includes('调候'), false, '塔罗提示词不应串入八字调候文案');

  const almanacRes = (await calculate('almanac', methodExamples.almanac)) as { prompt: { text: string } };
  assert.ok(almanacRes.prompt.text.includes('择日取舍'));
  assert.equal(almanacRes.prompt.text.includes('元运飞星'), false, '黄历择日不应串入风水元运飞星文案');

  const ziweiRes = (await calculate('ziwei', methodExamples.ziwei)) as { prompt: { text: string } };
  assert.equal(ziweiRes.prompt.text.includes('调候'), false, '纯紫微提示词不应串入八字调候文案');

  const calendarRes = (await calculate('calendar', methodExamples.calendar)) as { prompt: { text: string } };
  assert.equal(calendarRes.prompt.text.includes('不要以“AI 不能算命'), false, '纯历法查询不应出现算命防推脱措辞');

  const namingRes = (await calculate('chinese-naming', {
    ...methodExamples['chinese-naming'],
    surname: '陈',
    question: '宝宝起名，想要大气温和的双字名。',
  })) as { data: { selectedCharacters: string[] } };
  for (const badChar of ['肮', '肥', '肺', '肪', '股', '肩', '洞', '笆']) {
    assert.equal(namingRes.data.selectedCharacters.includes(badChar), false, `起名候选池不应包含不雅字「${badChar}」`);
  }

  const ssgwRes = (await calculate('ssgw', { ssgw: { method: 'manual', number: 1 }, question: '今年事业如何？' })) as { prompt: { text: string } };
  assert.equal(ssgwRes.prompt.text.includes('核心寓意：明月虽普照千山'), false, '三山国王灵签不应重复输出相同内容的核心寓意');

  const customRes = (await calculate(
    'bazi',
    { ...methodExamples.bazi, question: '明年事业走势如何？' },
    {
      promptGuidance: {
        enableContract: true,
        replyStyle: 'concise',
        topTaskAnchor: true,
        customFramework: '请全程使用大白话解释，每条结论附带一条可执行行动建议。',
      },
    },
  )) as { prompt: { text: string } };
  assert.ok(customRes.prompt.text.startsWith('【顶部任务锚点】'), '长提示词开启顶部锚点后应位于最开头');
  assert.ok(customRes.prompt.text.includes('精简直白'));
  assert.ok(customRes.prompt.text.includes('【用户自定义规则框架】'));
  assert.ok(customRes.prompt.text.includes('大白话解释'));

  const disabledRes = (await calculate(
    'tarot',
    methodExamples.tarot,
    { promptGuidance: { enableContract: false, customFramework: '仅输出三句话总结。' } },
  )) as { prompt: { text: string } };
  assert.equal(disabledRes.prompt.text.includes('【解读与交付契约】'), false, '关闭内置契约后不应再追加内置契约');
  assert.ok(disabledRes.prompt.text.includes('仅输出三句话总结。'));
});
