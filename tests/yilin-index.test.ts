import test from 'node:test';
import assert from 'node:assert/strict';
import { getYilinIndexStats, queryYilinEntry } from '../packages/core/src/classics/yilin';
import { getPublicApiOpenApiDocument, handlePublicApiRequest } from '../src/lib/public-api/handler';
import { DEFAULT_PUBLIC_API_RUNTIME } from '../src/lib/public-api/metadata';

test('焦氏易林固定索引覆盖 64×64 卦对并保留版本缺口统计', () => {
  assert.deepEqual(getYilinIndexStats(), {
    expectedPairCount: 4096,
    parsedPairCount: 4096,
    hexagramCount: 64,
    unresolvedGapCount: 120,
    confirmedMappings: 24,
    alignedMarkerPairs: 46,
  });

  const qian = queryYilinEntry('乾', '乾');
  assert.equal(qian.key, '乾→乾');
  assert.equal(qian.dataStatus, '双底本对读一致');
  assert.ok(qian.text.length > 0);
  assert.equal(qian.gaps.length, 0);
  assert.equal(qian.edition.id, 'yilin-w20-03-fixed-4096');
});

test('易林卦名别名规范化且原始标签差异不会被静默改写', () => {
  const entry = queryYilinEntry('兑', '随');
  assert.equal(entry.key, '兌→隨');
  assert.equal(entry.dataStatus, '含校勘或字形差异');
  assert.ok(entry.gaps.length > 0);

  const labelOrder = queryYilinEntry('艮', '小畜');
  assert.ok(
    labelOrder.gaps.some((gap) => gap.kind === 'label-order' && gap.observedRaw === '小過'),
  );
  assert.equal(labelOrder.sources.kanripo.rawLabel, '小過');
  assert.equal(labelOrder.target, '小畜');

  const unresolved = queryYilinEntry('乾', '明夷');
  assert.ok(unresolved.sources.wikisource.markers.wikisourceSKchars.includes('3500'));
  assert.ok(
    unresolved.gaps.some(
      (gap) => gap.kind === 'wikisource-only-skchar' && gap.status === 'unresolved',
    ),
  );
});

test('易林卷尾尾注只做确定性边界清理并留下规范化标记', () => {
  const entry = queryYilinEntry('未濟', '既濟');
  for (const source of [entry.sources.wikisource, entry.sources.kanripo]) {
    assert.equal(source.textNormalization, 'fixed-volume-footer');
    assert.doesNotMatch(source.text, /焦氏易林卷四|SKQS footer/);
    assert.match(source.text, /大蛇巨魚相搏於郊/);
  }
});

test('公开 API 暴露固定易林查询并拒绝未知卦名', async () => {
  const openApi = getPublicApiOpenApiDocument(DEFAULT_PUBLIC_API_RUNTIME) as {
    paths: Record<string, { post?: unknown }>;
    components: {
      schemas: Record<string, { required?: string[]; additionalProperties?: boolean }>;
    };
  };
  assert.ok(openApi.paths['/classics/yilin']?.post);
  assert.deepEqual(openApi.components.schemas.YilinQueryRequest.required, [
    'baseHexagram',
    'targetHexagram',
  ]);
  assert.equal(openApi.components.schemas.YilinQueryRequest.additionalProperties, false);

  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/classics/yilin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHexagram: '兑', targetHexagram: '随', source: 'both' }),
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { key: string; edition: { parsedPairCount: number }; sources: unknown };
  };
  assert.equal(body.data.key, '兌→隨');
  assert.equal(body.data.edition.parsedPairCount, 4096);
  assert.ok(body.data.sources);

  const invalid = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/classics/yilin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHexagram: '不存在', targetHexagram: '乾' }),
    }),
  );
  assert.equal(invalid.status, 400);
});
