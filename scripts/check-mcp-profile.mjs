import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { calendarExamples, methodExamples } from './method-examples.mjs';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'dist-mcp/.vite/manifest.json'), 'utf8'));
const sources = Object.keys(manifest);
assert.ok(!sources.some((path) => path.includes('legacy-') || path.includes('tests/legacy/') || path.includes('packages/core/')), '独立 MCP 不得引用旧核心');
const dictionaryModules = sources.filter((path) => path.startsWith('src/data/characters/'));
const expectedDictionaryModules = ['definitions', 'references'].flatMap((kind) => Array.from({ length: 32 }, (_, shard) => `src/data/characters/${kind}-${String(shard).padStart(2, '0')}.json`));
assert.deepEqual(dictionaryModules.sort(), expectedDictionaryModules.sort(), '独立 MCP 应只按需打包 64 个字库分片');

const scratch = await mkdtemp(join(tmpdir(), 'mingyu-mcp-standalone-'));
let client;
try {
  await cp(join(root, 'dist-mcp'), join(scratch, 'bundle'), { recursive: true });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(scratch, 'bundle/server.mjs')], cwd: scratch,
    env: { ...getDefaultEnvironment(), NODE_PATH: '', NODE_OPTIONS: '' }, stderr: 'pipe' });
  client = new Client({ name: 'mingyu-standalone-check', version: '1' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  assert.deepEqual(names, [...Object.keys(methodExamples), 'reprompt', 'prompt_catalog']);
  const catalog = await client.callTool({ name: 'prompt_catalog', arguments: { method: 'tarot' } });
  assert.ok(catalog.structuredContent?.methods?.tarot?.topicIds.includes('career'));
  for (const [method, example] of Object.entries(methodExamples)) {
    const result = await client.callTool({ name: method, arguments: { ...example, currentTime: '2025-01-01T00:00:00Z' } });
    assert.equal(result.isError, undefined, `${method}: ${JSON.stringify(result.content)}`);
    assert.equal(result.structuredContent?.method, method);
    assert.ok(result.structuredContent?.prompt?.text, `${method} 缺少提示词`);
    if (method === 'bazi-synastry') assert.match(result.structuredContent.prompt.text, /【双方本命神煞】[\s\S]*元辰因未提供性别未计算/);
    if (method === 'bazi-ziwei') assert.match(result.structuredContent.prompt.text, /【八字本命神煞】/);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method, result: result.structuredContent, question: '继续问' } });
    assert.equal(follow.isError, undefined, `${method} 追问: ${JSON.stringify(follow.content)}`);
    assert.ok(follow.structuredContent?.prompt?.text.includes('继续问'), `${method} 追问缺少问题`);
  }
  const characterIndex = JSON.parse(await readFile(join(root, 'src/data/characters/index.json'), 'utf8'));
  for (let start = 0; start < 32; start += 16) {
    const ids = Array.from({ length: 16 }, (_, offset) => start + offset);
    const text = ids.map((id) => characterIndex.records[id][0]).join('');
    const result = await client.callTool({ name: 'character-query', arguments: { question: '核对字库', query: { kind: 'text', text, includeReferences: true } } });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    for (const [offset, item] of result.structuredContent.data.result.characters.entries()) {
      const id = ids[offset], shard = String(id % 32).padStart(2, '0');
      const definitions = JSON.parse(await readFile(join(root, `src/data/characters/definitions-${shard}.json`), 'utf8'));
      const references = JSON.parse(await readFile(join(root, `src/data/characters/references-${shard}.json`), 'utf8'));
      assert.equal(item.detail.definition, definitions[id] ?? null, `字义分片 ${shard}`);
      assert.equal(item.detail.kangxiText, references[id] ?? null, `原文分片 ${shard}`);
    }
  }
  for (const calendar of calendarExamples) {
    const result = await client.callTool({ name: 'calendar', arguments: { calendar, question: '问题' } });
    assert.equal(result.isError, undefined, `${calendar.kind}: ${JSON.stringify(result.content)}`);
    assert.equal(result.structuredContent?.data?.result?.kind, calendar.kind);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method: 'calendar', result: result.structuredContent, question: '继续问' } });
    assert.equal(follow.isError, undefined, `${calendar.kind} 追问: ${JSON.stringify(follow.content)}`);
  }
  const zhouyiSearch = await client.callTool({ name: 'zhouyi', arguments: { query: { kind: 'search', text: '天行健' }, question: '问题' } });
  assert.equal(zhouyiSearch.isError, undefined, JSON.stringify(zhouyiSearch.content));
  assert.ok(zhouyiSearch.structuredContent.data.result.items.some((item) => item.id === 1));
  for (const method of ['liuyao', 'meihua']) {
    const result = await client.callTool({ name: method, arguments: { ...methodExamples[method], prompt: { includeClassics: true } } });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    assert.match(result.structuredContent.prompt.text, /经文来源.*CC BY-SA 4\.0/);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method, result: result.structuredContent, question: '继续问', prompt: { includeClassics: true } } });
    assert.equal(follow.isError, undefined, JSON.stringify(follow.content));
    assert.match(follow.structuredContent.prompt.text, /经文来源/);
  }
  const dualGender = await client.callTool({ name: 'bazi-synastry', arguments: { ...methodExamples['bazi-synastry'], person1: { ...methodExamples['bazi-synastry'].person1, gender: 'female' } } });
  assert.equal(dualGender.isError, undefined, JSON.stringify(dualGender.content));
  assert.equal(dualGender.structuredContent.data.charts.person1.shensha.included.length, 55);
  assert.equal(dualGender.structuredContent.data.charts.person2.shensha.included.length, 54);
  const baziShensha = await client.callTool({ name: 'bazi', arguments: methodExamples['bazi'] });
  const baziTimeline = await client.callTool({ name: 'bazi', arguments: { ...methodExamples.bazi, timelineYear: 2024 } });
  assert.equal(baziTimeline.isError, undefined, JSON.stringify(baziTimeline.content));
  assert.equal(baziTimeline.structuredContent.data.timeline.segments.length, 12);
  const timelineFollow = await client.callTool({ name: 'reprompt', arguments: { method: 'bazi', result: baziTimeline.structuredContent, question: '继续问' } });
  assert.equal(timelineFollow.isError, undefined, JSON.stringify(timelineFollow.content));
  assert.match(timelineFollow.structuredContent.prompt.text, /2024立春年流月时间线/);
  assert.equal(baziShensha.isError, undefined, JSON.stringify(baziShensha.content));
  assert.equal(baziShensha.structuredContent.data.chart.shensha.included.length, 55);
  assert.match(baziShensha.structuredContent.prompt.text, /本命神煞（55项）/);
  assert.equal(baziShensha.structuredContent.data.located.shensha.included.length, 39);
  assert.match(baziShensha.structuredContent.prompt.text, /【岁运神煞】[\s\S]*不替换本命年柱/);
  const returnLocation = { latitude: 40.7128, longitude: -74.006 };
  const relocated = await client.callTool({ name: 'astrolabe', arguments: { ...methodExamples['astrolabe'], flow: { reference: { kind: 'year', year: 2025 }, techniques: ['solar-return'], solarReturnLocation: returnLocation } } });
  assert.equal(relocated.isError, undefined, JSON.stringify(relocated.content));
  assert.deepEqual(relocated.structuredContent.data.flow.solarReturn.location, { ...returnLocation, meaning: '指定地点' });
  const relocatedFollow = await client.callTool({ name: 'reprompt', arguments: { method: 'astrolabe', result: relocated.structuredContent, question: '继续问' } });
  assert.equal(relocatedFollow.isError, undefined, JSON.stringify(relocatedFollow.content));
  assert.match(relocatedFollow.structuredContent.prompt.text, /指定地点/);
  const asteroids = await client.callTool({ name: 'astrolabe', arguments: { ...methodExamples['astrolabe'], options: { includeAsteroids: true } } });
  assert.equal(asteroids.isError, undefined, JSON.stringify(asteroids.content));
  assert.equal(asteroids.structuredContent?.data?.points.length, 17);
  const range = { start: '2024-02-19T03:00:00Z', end: '2024-02-19T05:00:00Z' };
  for (const [method, options] of [
    ['liuyao', { liuyao: { method: 'coins' } }],
    ['liuren', { liuren: { timeStandard: 'true-solar', longitude: 116.4 } }],
    ['jinkoujue', { jinkoujue: { method: 'random', timeStandard: 'true-solar', longitude: 116.4 } }],
    ['taiyi', { taiyi: { scope: 'hour', timeStandard: 'true-solar', longitude: 116.4 } }],
    ['qimen', { qimen: { scope: 'hour', timeStandard: 'true-solar', longitude: 116.4 } }],
    ['huangji-jingshi', { huangji: { mode: 'datetime', timeStandard: 'true-solar', longitude: 116.4 } }],
  ]) {
    const result = await client.callTool({ name: method, arguments: { question: '问题', currentTime: '2025-01-01T00:00:00Z', range, ...options } });
    assert.equal(result.isError, undefined, `${method} 时间范围：${JSON.stringify(result.content)}`);
    assert.equal(result.structuredContent?.data?.kind, 'range');
    if (method === 'liuyao') assert.equal(new Set(result.structuredContent.data.branches.map((branch) => JSON.stringify(branch.data.yaoArray))).size, 1);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method, result: result.structuredContent, question: '继续问' } });
    assert.equal(follow.isError, undefined, `${method} 范围追问：${JSON.stringify(follow.content)}`);
  }
  const civil = await client.callTool({ name: 'qimen', arguments: { question: '问题', range: { start: '2024-11-03T05:59:58Z', end: '2024-11-03T06:00:02Z' }, qimen: { timeStandard: 'civil', timeZoneId: 'America/New_York' } } });
  assert.equal(civil.isError, undefined, JSON.stringify(civil.content));
  assert.deepEqual(civil.structuredContent?.data?.branches.map((branch) => branch.data.timezoneOffsetMinutes), [-240, -300]);
  const civilFollow = await client.callTool({ name: 'reprompt', arguments: { method: 'qimen', result: civil.structuredContent, question: '继续问' } });
  assert.equal(civilFollow.isError, undefined, JSON.stringify(civilFollow.content));
  const namingRange = { start: '2024-11-03T05:59:58Z', end: '2024-11-03T06:00:02Z', timeZoneId: 'America/New_York' };
  for (const [method, input] of [['chinese-name', { fullName: '张知远' }], ['chinese-naming', { surname: '张', limit: 3 }]]) {
    const result = await client.callTool({ name: method, arguments: { ...input, birthRange: namingRange, question: '问题' } });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    assert.deepEqual(result.structuredContent?.data?.birthContext?.segments.map((item) => item.timezone), [-4, -5]);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method, result: result.structuredContent, question: '继续问' } });
    assert.equal(follow.isError, undefined, JSON.stringify(follow.content));
  }
  const reverse = await client.callTool({ name: 'bazi-reverse', arguments: { ...methodExamples['bazi-reverse'], startYear: 1900, endYear: 2100 } });
  assert.equal(reverse.isError, undefined, JSON.stringify(reverse.content));
  assert.equal(reverse.structuredContent?.data?.candidateCount, 3);
  const fromReverse = await client.callTool({ name: 'chinese-name', arguments: { fullName: '张知远', question: '问题', birthRange: reverse.structuredContent.data.candidates[2].birthRange } });
  assert.equal(fromReverse.isError, undefined, JSON.stringify(fromReverse.content));
  assert.match(fromReverse.structuredContent.prompt.text, /四柱来源/);
  await client.close(); client = undefined;
  const restrictedTransport = new StdioClientTransport({ command: process.execPath, args: [join(scratch, 'bundle/server.mjs')], cwd: scratch,
    env: { ...getDefaultEnvironment(), NODE_PATH: '', NODE_OPTIONS: '', ENABLED_METHODS: 'tarot,liuyao,tarot' }, stderr: 'pipe' });
  client = new Client({ name: 'mingyu-restricted-check', version: '1' });
  await client.connect(restrictedTransport);
  const restricted = await client.listTools();
  assert.deepEqual(restricted.tools.map((tool) => tool.name), ['tarot', 'liuyao', 'reprompt', 'prompt_catalog']);
  assert.deepEqual(restricted.tools.find((tool) => tool.name === 'reprompt')?.inputSchema.properties?.method.enum, ['tarot', 'liuyao']);
  await client.close(); client = undefined;
  const invalid = spawnSync(process.execPath, [join(scratch, 'bundle/server.mjs')], { cwd: scratch, env: { ...getDefaultEnvironment(), NODE_PATH: '', NODE_OPTIONS: '', ENABLED_METHODS: 'bazi-independent' }, encoding: 'utf8', timeout: 5000 });
  assert.notEqual(invalid.status, 0);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /ENABLED_METHODS 包含未知方法/);
  console.log(`独立 MCP 已脱离仓库和 node_modules 运行：${Object.keys(methodExamples).length} 项计算、追问、目录、真太阳时范围、按需数据和方法筛选通过。`);
} finally {
  await client?.close();
  await rm(scratch, { recursive: true, force: true });
}
