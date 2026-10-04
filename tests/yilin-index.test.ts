import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YILIN_HEXAGRAM_ORDER,
  normalizeYilinHexagramName,
  getYilinEntry,
  getYilinIndexStats,
  queryYilinEntry,
} from '../packages/core/src/classics/yilin';
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

test('易林每个卦对均可查询，文字一致状态依据两份正文判断', () => {
  const keys = new Set<string>();
  let wikisourceNotes = 0;
  let kanripoNotes = 0;
  let alignedNoteEntries = 0;
  let sectionAnchors = 0;
  for (const base of YILIN_HEXAGRAM_ORDER) {
    for (const target of YILIN_HEXAGRAM_ORDER) {
      const entry = queryYilinEntry(base, target);
      keys.add(entry.key);
      wikisourceNotes += entry.sources.wikisource.editorialNotes.length;
      kanripoNotes += entry.sources.kanripo.editorialNotes.length;
      if (entry.sources.kanripo.editorialNotes.length) {
        assert.ok(entry.sources.wikisource.editorialNotes.length, entry.key);
        alignedNoteEntries++;
      }
      if (entry.sources.wikisource.textNormalization === 'fixed-section-anchor') {
        sectionAnchors++;
      }
      for (const source of [entry.sources.wikisource, entry.sources.kanripo]) {
        assert.ok(source.text.length > 0, entry.key);
        assert.ok(source.source.length > 0, entry.key);
        assert.ok(Number.isInteger(source.volume), entry.key);
        assert.ok(Number.isInteger(source.line), entry.key);
        assert.ok(source.rawLabel.length > 0, entry.key);
        assert.ok(Array.isArray(source.editorialNotes), entry.key);
        assert.doesNotMatch(source.text, /\{\{SK notes\||\{\{SK anchor\|/u, entry.key);
        if (source.sourceKind === 'kanripo-wyg') {
          assert.doesNotMatch(source.text, /[()]/u, entry.key);
        }
        if (source.observedLabel !== null) assert.ok(source.observedLabel.length > 0, entry.key);
        assert.ok(source.page === null || source.page.length > 0, entry.key);
        assert.match(source.textDigest, /^[0-9a-f]{16}$/u);
        assert.ok(Array.isArray(source.markers.kanripoRefs), entry.key);
        assert.ok(Array.isArray(source.markers.wikisourceSKchars), entry.key);
      }
      if (entry.dataStatus === '双底本对读一致') {
        assert.equal(entry.sources.wikisource.text, entry.sources.kanripo.text, entry.key);
      }
    }
  }
  assert.equal(keys.size, 4096);
  assert.equal(alignedNoteEntries, 692);
  assert.equal(wikisourceNotes, 693);
  assert.equal(kanripoNotes, 872);
  assert.equal(sectionAnchors, 59);
  const entry = queryYilinEntry('乾', '需');
  assert.equal(entry.gaps.length, 0);
  assert.notEqual(entry.sources.wikisource.text, entry.sources.kanripo.text);
  assert.equal(entry.dataStatus, '含校勘或字形差异');
});

test('易林查询拒绝无效底本和不完整卦名', () => {
  assert.throws(() => queryYilinEntry('乾', '乾', 'unknown' as 'both'), /文字底本/);
  assert.throws(() => queryYilinEntry('壮', '乾'), /有效卦名/);
  assert.throws(
    () => queryYilinEntry(null as never, '乾'),
    /baseHexagram 不是固定卦序中的有效卦名/,
  );
  assert.equal(getYilinEntry(null as never, '乾'), undefined);
  for (const key of ['toString', 'constructor', '__proto__']) {
    assert.equal(normalizeYilinHexagramName(key), undefined);
    assert.equal(getYilinEntry(key, '乾'), undefined);
    assert.throws(() => queryYilinEntry(key, '乾'), /baseHexagram 不是固定卦序中的有效卦名/);
    assert.throws(() => queryYilinEntry('乾', key), /targetHexagram 不是固定卦序中的有效卦名/);
  }
});

test('易林六十四卦简体名称均可作为本卦和变卦查询', () => {
  const simplifiedNames = (
    '乾 坤 屯 蒙 需 讼 师 比 小畜 履 泰 否 同人 大有 谦 豫 随 蛊 临 观 噬嗑 贲 剥 复 ' +
    '无妄 大畜 颐 大过 坎 离 咸 恒 遁 大壮 晋 明夷 家人 睽 蹇 解 损 益 夬 姤 萃 升 ' +
    '困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济'
  ).split(' ');
  assert.equal(simplifiedNames.length, 64);
  for (const [index, name] of simplifiedNames.entries()) {
    const canonical = YILIN_HEXAGRAM_ORDER[index];
    assert.deepEqual(queryYilinEntry(name, '乾'), queryYilinEntry(canonical, '乾'));
    assert.deepEqual(queryYilinEntry('乾', name), queryYilinEntry('乾', canonical));
  }
  assert.deepEqual(queryYilinEntry('無妄', '恆'), queryYilinEntry('无妄', '恒'));
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

test('易林章节锚点与校注不混入正文，本卦之卦方向保持独立', () => {
  const forward = queryYilinEntry('乾', '需');
  const reverse = queryYilinEntry('需', '乾');
  assert.equal(forward.key, '乾→需');
  assert.equal(reverse.key, '需→乾');
  assert.notEqual(forward.text, reverse.text);
  assert.equal(forward.selectedSource, 'kanripo');
  assert.equal(forward.text, '目瞤足動喜如其願舉家蒙寵');
  assert.equal(queryYilinEntry('乾', '需', 'wikisource').selectedSource, 'wikisource');

  const inlineNote = queryYilinEntry('觀', '同人');
  assert.equal(inlineNote.text, '有頭無目赫赫粟粟消耗為疾三年不復');
  assert.deepEqual(inlineNote.sources.wikisource.editorialNotes, ['一作不見菽粟']);
  assert.deepEqual(inlineNote.sources.kanripo.editorialNotes, ['一作不/見菽粟']);
  assert.equal(inlineNote.sources.wikisource.text, inlineNote.sources.kanripo.text);
  const nestedNote = queryYilinEntry('賁', '蹇');
  assert.deepEqual(nestedNote.sources.wikisource.editorialNotes, [
    '一作{{SKchar|2025}}{{SKchar|2025}}墳墳',
  ]);

  const sectionEnd = queryYilinEntry('乾', '未濟');
  assert.equal(sectionEnd.sources.wikisource.textNormalization, 'fixed-section-anchor');
  assert.equal(sectionEnd.text, sectionEnd.sources.kanripo.text);
  assert.doesNotMatch(sectionEnd.text, /SK anchor|焦氏易林卷/u);
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

  const missingGlyph = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/classics/yilin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHexagram: '乾', targetHexagram: '需' }),
    }),
  );
  assert.equal(missingGlyph.status, 200);
  const resolved = (await missingGlyph.json()) as {
    data: {
      selectedSource: string;
      text: string;
      sources: { wikisource: { text: string; editorialNotes: string[] } };
    };
  };
  assert.equal(resolved.data.selectedSource, 'kanripo');
  assert.equal(resolved.data.text, '目瞤足動喜如其願舉家蒙寵');
  assert.match(resolved.data.sources.wikisource.text, /\{\{SKchar\|3681\}\}/u);

  const invalid = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/classics/yilin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHexagram: '不存在', targetHexagram: '乾' }),
    }),
  );
  assert.equal(invalid.status, 400);
});
