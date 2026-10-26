import test from 'node:test';
import { getToolCatalog } from '../../mcp/src/catalog/tool-catalog';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PUBLIC_API_ENDPOINTS,
  DEFAULT_PUBLIC_API_RUNTIME,
} from '../../src/lib/public-api/metadata';
import {
  getPublicApiOpenApiDocument,
  handlePublicApiRequest,
} from '../../src/lib/public-api/handler';
import { generatePagesDiscoveryAssets } from '../../scripts/generate-pages-discovery';
import type { MeihuaData } from 'mingyu-core/types';

const templatePromptMethods = [
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'qimen',
  'liuren',
  'tarot',
  'almanac',
  'lenormand',
  'astrolabe',
];

test('公开 API 端点与 OpenAPI 规范定义必须 100% 双向对齐', () => {
  const doc = getPublicApiOpenApiDocument(DEFAULT_PUBLIC_API_RUNTIME);
  const template = '/divination/{method}/prompt';
  const declaredMethods = doc.paths[template].post.parameters[0].schema.enum;
  assert.deepEqual(declaredMethods, templatePromptMethods);
  const openApiEndpoints = new Set<string>();

  for (const [path, operations] of Object.entries(doc.paths)) {
    const concretePaths =
      path === template ? declaredMethods.map((method) => `/divination/${method}/prompt`) : [path];
    assert.ok(path === template || !path.includes('{'), `未核对的路径模板：${path}`);
    for (const method of Object.keys(operations)) {
      for (const concretePath of concretePaths) {
        openApiEndpoints.add(`${method.toUpperCase()} /api/v1${concretePath}`);
      }
    }
  }

  assert.deepEqual(
    [...openApiEndpoints].sort(),
    PUBLIC_API_ENDPOINTS.filter((endpoint) => endpoint.split(' ')[1].startsWith('/api/v1/')).sort(),
  );
});

function assertMeihuaDiscovery(document: ReturnType<typeof getPublicApiOpenApiDocument>) {
  const methods = ['time', 'number', 'sound', 'character', 'direction', 'random', 'timeTrigram'];
  for (const [path, schemaName] of [
    ['/divination/meihua', 'MeihuaRequest'],
    ['/divination/meihua/prompt', 'MeihuaPromptRequest'],
  ] as const) {
    const operation = document.paths[path].post;
    assert.equal(
      operation.requestBody.content['application/json'].schema.$ref,
      `#/components/schemas/${schemaName}`,
    );
    const properties = document.components.schemas[schemaName].properties;
    assert.deepEqual(properties.method.enum, methods, path);
    for (const field of [
      'soundCount',
      'characterText',
      'characterCount',
      'characterTones',
      'characterStrokeCounts',
      'characterLeftStrokes',
      'characterRightStrokes',
      'direction',
      'objectType',
    ]) {
      assert.ok(Object.hasOwn(properties, field), `${path} 顶层缺少 ${field}`);
    }
    assert.equal(properties.soundCount.type, 'integer');
    assert.equal(properties.soundCount.minimum, 1);
    assert.equal(properties.characterText.type, 'string');
    assert.equal(properties.characterCount.maximum, 100);
    assert.deepEqual(
      [properties.characterTones.minItems, properties.characterTones.maxItems],
      [4, 10],
    );
    assert.deepEqual(properties.characterTones.items, { type: 'integer', minimum: 1, maximum: 4 });
    assert.deepEqual(
      [properties.characterStrokeCounts.minItems, properties.characterStrokeCounts.maxItems],
      [2, 3],
    );
    assert.deepEqual(properties.characterStrokeCounts.items, { type: 'integer', minimum: 1 });
    for (const field of ['characterLeftStrokes', 'characterRightStrokes'] as const) {
      assert.equal(properties[field].type, 'integer');
      assert.equal(properties[field].minimum, 1);
    }
    assert.deepEqual(properties.direction.enum, [
      'northwest',
      'west',
      'south',
      'east',
      'southeast',
      'north',
      'northeast',
      'southwest',
    ]);
    assert.deepEqual(properties.objectType.enum, [
      'heaven',
      'lake',
      'fire',
      'thunder',
      'wind',
      'water',
      'mountain',
      'earth',
    ]);
    for (const unrelated of [
      'liuyaoMethod',
      'qimenMethod',
      'participants',
      'spreadType',
      'latitude',
    ]) {
      assert.equal(Object.hasOwn(properties, unrelated), false, `${path}: ${unrelated}`);
    }
  }
  assert.equal(document.paths['/divination/meihua'].post.requestBody.required, false);
  assert.equal(document.paths['/divination/meihua/prompt'].post.requestBody.required, true);
  assert.deepEqual(document.components.schemas.MeihuaPromptRequest.required, ['question']);
  assert.deepEqual(document.components.schemas.DivinationRequest.properties.method.enum, methods);
  assert.deepEqual(
    document.components.schemas.MeihuaPromptRequest.properties.supplementaryInfo.properties
      .meihuaSettings.properties.method.enum,
    methods,
  );
}

test('实际 OpenAPI 与 Pages 静态发现提供梅花窄输入和六个具体经典提示词路径', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/openapi.json'),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assertMeihuaDiscovery(body.data);

  const output = await mkdtemp(join(tmpdir(), 'mingyu-api-contract-'));
  try {
    await generatePagesDiscoveryAssets(output);
    const asset = JSON.parse(await readFile(join(output, 'api/v1/openapi.json'), 'utf8'));
    assertMeihuaDiscovery(asset.data);
    for (const document of [body.data, asset.data]) {
      for (const path of [
        '/divination/liuyao/prompt',
        '/divination/meihua/prompt',
        '/divination/xiaoliuren/prompt',
        '/divination/qimen/prompt',
        '/divination/liuren/prompt',
        '/divination/almanac/prompt',
      ]) {
        assert.equal(
          document.paths[path]?.post.requestBody.content['application/json'].schema.properties
            .includeClassics.type,
          'boolean',
          path,
        );
      }
    }
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('R09 OpenAPI 为三个文化提示词声明显式模式及省略和 full 的兼容字段', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/openapi.json'),
  );
  assert.equal(response.status, 200);
  const { data: document } = await response.json();
  for (const [path, promptSchemaName, requestSchemaName, field, factType] of [
    [
      '/name/generate/prompt',
      'NameGeneratePromptRequest',
      'NameGenerateRequest',
      'candidates',
      'array',
    ],
    [
      '/name/analyze/prompt',
      'NameAnalyzePromptRequest',
      'NameAnalyzeRequest',
      'analysis',
      'object',
    ],
    [
      '/number/analyze/prompt',
      'NumberAnalyzePromptRequest',
      'NumberAnalyzeRequest',
      'analysis',
      'object',
    ],
  ]) {
    const post = document.paths[path].post;
    assert.equal(
      post.requestBody.content['application/json'].schema.$ref,
      `#/components/schemas/${promptSchemaName}`,
    );
    const request = document.components.schemas[promptSchemaName];
    assert.equal(request.allOf[0].$ref, `#/components/schemas/${requestSchemaName}`);
    const mode = request.allOf[1].properties.responseMode;
    assert.equal(mode.type, 'string');
    assert.deepEqual(mode.enum, ['summary', 'full', 'prompt-only']);
    assert.equal(Object.hasOwn(mode, 'default'), false, '省略模式不可宣称默认 prompt-only');
    assert.equal(request.allOf[1].required, undefined);
    assert.match(mode.description, /省略.*旧/);
    assert.equal(
      document.components.schemas[requestSchemaName].properties.responseMode,
      undefined,
      '计算接口不声明提示词模式',
    );
    const data = post.responses['200'].content['application/json'].schema.properties.data;
    assert.deepEqual(data.required, ['prompt']);
    assert.equal(data.properties[field].type, factType);
    assert.match(data.properties[field].description, /省略.*full/);
    assert.deepEqual(data.properties.result.required, [field, 'prompt']);
    assert.equal(data.properties.result.properties[field].type, factType);
    assert.equal(data.properties.result.properties.prompt.type, 'string');
    assert.equal(data.properties.result.properties.selection.type, 'object');
    assert.deepEqual(data.properties.resultSummary.required, [field]);
    assert.equal(data.properties.resultSummary.properties[field].type, factType);
    assert.equal(data.properties.resultSummary.properties.selection.type, 'object');
    assert.match(post.responses['200'].description, /prompt-only.*summary.*full/);
    assert.match(post.responses['400'].description, /responseMode.*BAD_REQUEST/);
  }
});

test('梅花七种起法和九个顶层字段在旧计算及提示词 URL 中保持实际行为', async () => {
  const cases: Array<{ input: Record<string, unknown>; expected: Record<string, unknown> }> = [
    { input: { method: 'time' }, expected: { methodKey: 'time' } },
    { input: { method: 'number', number: 123 }, expected: { methodKey: 'number', number: 123 } },
    { input: { method: 'sound', soundCount: 3 }, expected: { methodKey: 'sound', soundCount: 3 } },
    {
      input: {
        method: 'character',
        characterText: '林',
        characterCount: 1,
        characterLeftStrokes: 4,
        characterRightStrokes: 4,
      },
      expected: {
        methodKey: 'character',
        characterText: '林',
        characterCount: 1,
        characterLeftStrokes: 4,
        characterRightStrokes: 4,
      },
    },
    {
      input: { method: 'character', characterText: '西林', characterStrokeCounts: [7, 8] },
      expected: {
        methodKey: 'character',
        characterText: '西林',
        characterCount: 2,
        characterStrokeCounts: [7, 8],
        upperTrigramIndex: 7,
        lowerTrigramIndex: 8,
      },
    },
    {
      input: {
        method: 'character',
        characterText: '今日动静如何',
        characterTones: [1, 4, 3, 3, 1, 1],
      },
      expected: {
        methodKey: 'character',
        characterCount: 6,
        characterTones: [1, 4, 3, 3, 1, 1],
        upperTrigramIndex: 8,
        lowerTrigramIndex: 5,
      },
    },
    {
      input: { method: 'character', characterCount: 12 },
      expected: {
        methodKey: 'character',
        characterCount: 12,
        upperTrigramIndex: 6,
        lowerTrigramIndex: 6,
      },
    },
    {
      input: { method: 'direction', direction: 'south', objectType: 'fire' },
      expected: {
        methodKey: 'direction',
        direction: 'south',
        objectType: 'fire',
        upperTrigramIndex: 3,
        lowerTrigramIndex: 3,
      },
    },
    { input: { method: 'random', seed: 'r2-08' }, expected: { methodKey: 'random' } },
    { input: { method: 'timeTrigram' }, expected: { methodKey: 'timeTrigram' } },
  ];
  const results: Record<string, MeihuaData> = {};
  for (const { input, expected } of cases) {
    const args = { ...input, customDate: '2025-01-01T08:00:00+08:00' };
    const data: MeihuaData[] = [];
    for (const path of ['/divination/meihua', '/divination/meihua/prompt']) {
      const response = await handlePublicApiRequest(
        new Request(`https://example.test/api/v1${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...args,
            detailMode: 'full',
            responseMode: 'full',
            question: '请解读本次卦盘。',
          }),
        }),
      );
      const body = await response.json();
      assert.equal(response.status, 200, `${path}: ${JSON.stringify(body)}`);
      const result: MeihuaData = path.endsWith('/prompt') ? body.data.result : body.data;
      for (const [field, value] of Object.entries(expected)) {
        assert.deepEqual(result.calculation[field], value, `${path}: ${field}`);
      }
      data.push(result);
    }
    assert.deepEqual(data[1], data[0], String(input.method));
    results[String(input.method)] = data[0];
  }
  for (const field of ['mainHexagram', 'interHexagram', 'changedHexagram', 'movingYao'] as const) {
    assert.ok(results.time[field], field);
    assert.deepEqual(results.timeTrigram[field], results.time[field], `兼容起法：${field}`);
  }
});

test('Skill 数据提供方适配文档中的端点必须全部在 PUBLIC_API_ENDPOINTS 中合法有效', () => {
  const providerRefPath = join(
    process.cwd(),
    'public/skills/mingyu/references/providers/aov-mingyu.md',
  );
  const providerRefContent = readFileSync(providerRefPath, 'utf8');

  const rows = [
    ...providerRefContent.matchAll(
      /\|\s*`(?<method>GET|POST) (?<path>\/[^`]+)`\s*\|\s*`(?<id>[^`]+)`\s*\|/g,
    ),
  ];
  const catalog = getToolCatalog();
  assert.deepEqual(rows.map((row) => row.groups!.id).sort(), catalog.map((tool) => tool.id).sort());
  for (const row of rows) {
    const { method, path, id } = row.groups!;
    assert.ok(
      (PUBLIC_API_ENDPOINTS as readonly string[]).includes(`${method} /api/v1${path}`),
      `${id} HTTP 方法或路径失效`,
    );
    assert.equal(catalog.find((tool) => tool.id === id)?.endpoint, path, `${id} 映射不一致`);
  }
});

test('MCP 使用说明中的工具清单必须与真实目录完整对应', () => {
  const readme = readFileSync('mcp/README.md', 'utf8');
  const ids = [...readme.matchAll(/^\| `([^`]+)`\s*\|/gm)].map((match) => match[1]);
  assert.deepEqual(
    ids.sort(),
    getToolCatalog()
      .map((tool) => tool.id)
      .sort(),
  );
});
