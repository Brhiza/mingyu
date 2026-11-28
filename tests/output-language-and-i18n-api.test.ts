import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { generateApiDocsHtml, generateApiDocsMarkdown } from '../scripts/generate-api-docs';
import { generateOpenApiDocument } from '../scripts/generate-openapi';
import { methodExamples } from '../scripts/method-examples.mjs';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { OUTPUT_LANGUAGE_HEADER, normalizeOutputLanguage } from '../src/output-language';
import { methodEnglishLabels, methodIds } from '../src/schema';
import { normalizeAgentToolInput } from '../src/tool-input-normalizer';
import worker from '../src/worker';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const assets = { fetch: async () => new Response('public assets') };

test('normalizeOutputLanguage 保持默认简体中文零开销，并识别 6 大市场与任意语种', () => {
  assert.equal(normalizeOutputLanguage(undefined), undefined);
  assert.equal(normalizeOutputLanguage(''), undefined);
  assert.equal(normalizeOutputLanguage('zh-CN'), undefined);
  assert.equal(normalizeOutputLanguage('zh-Hans'), undefined);
  assert.equal(normalizeOutputLanguage('简体中文'), undefined);
  assert.equal(normalizeOutputLanguage('zh-TW'), 'zh-TW');
  assert.equal(normalizeOutputLanguage('繁體中文'), 'zh-TW');
  assert.equal(normalizeOutputLanguage('English'), 'en');
  assert.equal(normalizeOutputLanguage('en-US'), 'en-US');
  assert.equal(normalizeOutputLanguage('日本語'), 'ja');
  assert.equal(normalizeOutputLanguage('한국어'), 'ko');
  assert.equal(normalizeOutputLanguage('Tiếng Việt'), 'vi');
  assert.equal(normalizeOutputLanguage('Thai'), 'Thai');
});

test('默认与显式 zh-CN 不改变原提示词与结果结构，outputLanguage 不污染 data 盘面', async () => {
  const input = { ...methodExamples.bazi, currentTime: '2025-01-01T00:00:00Z' };
  const baseline = (await calculate('bazi', input)) as {
    data: unknown;
    prompt: { text: string };
    outputLanguage?: string;
  };
  const explicitZh = (await calculate('bazi', { ...input, outputLanguage: 'zh-CN' })) as {
    data: unknown;
    prompt: { text: string };
    outputLanguage?: string;
  };
  assert.equal('outputLanguage' in baseline, false);
  assert.equal('outputLanguage' in explicitZh, false);
  assert.equal(explicitZh.prompt.text, baseline.prompt.text);
  assert.equal(baseline.prompt.text.includes(OUTPUT_LANGUAGE_HEADER), false);

  const enRes = (await calculate('bazi', { ...input, outputLanguage: 'en' })) as {
    data: unknown;
    prompt: { text: string };
    outputLanguage?: string;
  };
  assert.equal(enRes.outputLanguage, 'en');
  assert.deepEqual(enRes.data, baseline.data, '加入 outputLanguage 不得改动确定性计算盘面 data');
  assert.ok(enRes.prompt.text.includes(OUTPUT_LANGUAGE_HEADER));
  assert.ok(enRes.prompt.text.includes('Day Master'));
  assert.ok(enRes.prompt.text.includes('Ten Gods'));
});

test('5 大重点语言与任意语种按术数家族注入主流术语且不串味', async () => {
  const tarotEn = (await calculate('tarot', {
    ...methodExamples.tarot,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'en',
  })) as { prompt: { text: string } };
  assert.ok(tarotEn.prompt.text.includes('Tarot/Lenormand'));
  assert.equal(tarotEn.prompt.text.includes('Day Master'), false, '塔罗英文提示词不得串入八字 Day Master');
  assert.equal(tarotEn.prompt.text.includes('Ten Gods'), false);

  const ziweiTw = (await calculate('ziwei', {
    ...methodExamples.ziwei,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'zh-TW',
  })) as { prompt: { text: string } };
  assert.ok(ziweiTw.prompt.text.includes('繁體中文'));
  assert.ok(ziweiTw.prompt.text.includes('紫微斗數'));

  const baziJa = (await calculate('bazi', {
    ...methodExamples.bazi,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'ja',
  })) as { prompt: { text: string } };
  assert.ok(baziJa.prompt.text.includes('四柱推命'));

  const baziKo = (await calculate('bazi', {
    ...methodExamples.bazi,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'ko',
  })) as { prompt: { text: string } };
  assert.ok(baziKo.prompt.text.includes('사주팔자'));

  const ziweiVi = (await calculate('ziwei', {
    ...methodExamples.ziwei,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'vi',
  })) as { prompt: { text: string } };
  assert.ok(ziweiVi.prompt.text.includes('Tử Vi Đẩu Số'));

  const liuyaoEs = (await calculate('liuyao', {
    ...methodExamples.liuyao,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'es',
  })) as { prompt: { text: string }; outputLanguage?: string };
  assert.equal(liuyaoEs.outputLanguage, 'es');
  assert.ok(liuyaoEs.prompt.text.includes('strictly in "es"'));
});

test('reprompt 支持继承、切换与重置 outputLanguage，random-divination 仅附加一次语言块', async () => {
  const first = (await calculate('liuyao', {
    ...methodExamples.liuyao,
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'en',
  })) as { method: 'liuyao'; currentTime: string; data: Record<string, unknown>; outputLanguage?: string; prompt: { text: string } };
  assert.equal(first.outputLanguage, 'en');

  const inherited = (await reprompt({
    method: 'liuyao',
    result: first,
    question: 'When will it resolve?',
  })) as { outputLanguage?: string; prompt: { text: string } };
  assert.equal(inherited.outputLanguage, 'en');
  assert.ok(inherited.prompt.text.includes('Write the entire response in clear, natural English'));

  const switched = (await reprompt({
    method: 'liuyao',
    result: first,
    question: '時期はいつ頃ですか？',
    outputLanguage: 'ja',
  })) as { outputLanguage?: string; prompt: { text: string } };
  assert.equal(switched.outputLanguage, 'ja');
  assert.ok(switched.prompt.text.includes('自然な日本語'));

  const resetCn = (await reprompt({
    method: 'liuyao',
    result: first,
    question: '回到简体中文追问',
    outputLanguage: 'zh-CN',
  })) as { outputLanguage?: string; prompt: { text: string } };
  assert.equal('outputLanguage' in resetCn, false);
  assert.equal(resetCn.prompt.text.includes(OUTPUT_LANGUAGE_HEADER), false);

  const randomEn = (await calculate('random-divination', {
    ...methodExamples['random-divination'],
    currentTime: '2025-01-01T00:00:00Z',
    outputLanguage: 'en',
  })) as { prompt: { text: string } };
  assert.equal(randomEn.prompt.text.split(OUTPUT_LANGUAGE_HEADER).length - 1, 1);
});

test('HTTP API、MCP Router 与 normalizer 支持 outputLanguage 及双语入口', async () => {
  const normalized = normalizeAgentToolInput('tarot', {
    question: 'Work trend?',
    tarot: { spread: 'single' },
    lang: 'ko',
  });
  assert.equal(normalized.outputLanguage, 'ko');
  assert.equal('lang' in normalized, false);

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

  const calcRes = await post('/api/calculate', {
    method: 'tarot',
    input: methodExamples.tarot,
    responseMode: 'compact',
    outputLanguage: 'vi',
  });
  assert.equal(calcRes.status, 200);
  const calcJson = (await calcRes.json()) as {
    repromptToken: string;
    outputLanguage?: string;
    prompt: { text: string };
  };
  assert.equal(calcJson.outputLanguage, 'vi');
  assert.ok(calcJson.prompt.text.includes('tiếng Việt'));

  const followRes = await post('/api/prompt', {
    repromptToken: calcJson.repromptToken,
    question: 'Còn tài chính thì sao?',
  });
  assert.equal(followRes.status, 200);
  const followJson = (await followRes.json()) as { outputLanguage?: string; prompt: { text: string } };
  assert.equal(followJson.outputLanguage, 'vi');
  assert.ok(followJson.prompt.text.includes('tiếng Việt'));

  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer(methodIds, undefined, { mode: 'router' });
  const client = new Client({ name: 'i18n-router-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    const listed = await client.callTool({ name: 'list_methods', arguments: { category: 'mingli' } });
    const listBytes = Buffer.byteLength(JSON.stringify(await client.listTools()));
    assert.ok(listBytes < 10_000, `router tools/list 必须小于 10KB，当前 ${listBytes}`);
    const mingli = (listed.structuredContent as { categories: Array<{ labelEn: string; methods: Array<{ id: string; labelEn: string }> }> }).categories[0];
    assert.equal(mingli.labelEn, 'BaZi & Natal Destiny');
    assert.ok(mingli.methods.some((m) => m.id === 'bazi' && m.labelEn.includes('BaZi')));

    const mcpCalc = await client.callTool({
      name: 'calculate',
      arguments: {
        method: 'tarot',
        input: methodExamples.tarot,
        outputLanguage: 'en',
      },
    });
    assert.equal(mcpCalc.isError, undefined);
    const mcpStructured = mcpCalc.structuredContent as { outputLanguage?: string; repromptToken: string; prompt: { text: string } };
    assert.equal(mcpStructured.outputLanguage, 'en');
    assert.ok(mcpStructured.prompt.text.includes('Tarot/Lenormand'));

    const mcpFollow = await client.callTool({
      name: 'reprompt',
      arguments: {
        repromptToken: mcpStructured.repromptToken,
        question: 'What about next month?',
      },
    });
    assert.equal(mcpFollow.isError, undefined);
    assert.equal((mcpFollow.structuredContent as { outputLanguage?: string }).outputLanguage, 'en');
  } finally {
    await client.close();
    await server.close();
  }
});

test('OpenAPI、API 文档与 5 份多语言 README 完整一致', () => {
  assert.deepEqual(Object.keys(methodEnglishLabels).sort(), [...methodIds].sort());

  const openapi = generateOpenApiDocument('https://aov.cc');
  assert.ok(openapi.components.schemas.CalculateRequest.properties.outputLanguage);
  assert.deepEqual(openapi['x-mingyu-method-english-labels'], methodEnglishLabels);

  const md = generateApiDocsMarkdown('https://aov.cc');
  assert.ok(md.includes('outputLanguage'));
  assert.ok(md.includes('BaZi (Four Pillars of Destiny)'));
  const html = generateApiDocsHtml();
  assert.ok(html.includes('Mingyu V2 API Guide'));
  assert.ok(html.includes('Zi Wei Dou Shu'));

  const readme = readFileSync(join(rootDir, 'README.md'), 'utf8');
  for (const code of ['zh-TW', 'en', 'ja', 'ko', 'vi']) {
    const file = join(rootDir, 'docs', `README.${code}.md`);
    assert.ok(existsSync(file), `缺少 docs/README.${code}.md`);
    assert.ok(readme.includes(`docs/README.${code}.md`), `主 README 缺少 ${code} 链接`);
    const content = readFileSync(file, 'utf8');
    assert.ok(content.includes('../README.md'), `README.${code}.md 缺少返回简体主 README 链接`);
    assert.ok(content.includes('outputLanguage'), `README.${code}.md 缺少 outputLanguage 说明`);
  }
});
