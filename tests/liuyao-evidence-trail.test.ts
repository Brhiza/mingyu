import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLiuyao } from '../packages/core/src/divination/algorithms/liuyao.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');
const fixedYaos = [7, 8, 9, 6, 7, 8] as const;

// --- 1. generateLiuyao 结果附带 evidenceTrail ---
test('liuyao evidenceTrail：generateLiuyao 结果包含完整证据链', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 4,
    `应覆盖至少 4 个起卦环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('六爻起卦证据链'), 'summary 应标记六爻起卦');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('liuyao evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  for (const item of data.evidenceTrail!.items) {
    const errors = validateEvidenceItem(item);
    assert.deepEqual(errors, [], `证据「${item.title}」契约违规: ${errors.join('; ')}`);
    assert.ok(item.computationChain.length > 0, `「${item.title}」应有计算链`);
    assert.ok(item.source.name, `「${item.title}」应有出处`);
    assert.ok(item.boundary, `「${item.title}」应有边界`);
    assert.ok(
      item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low',
    );
    assert.ok(item.depth >= 0 && item.depth <= 4, `「${item.title}」深度应在 0-4`);
  }
});

// --- 3. 覆盖环节断言：起卦 + 卦象 + 纳甲 + 世应 ---
test('liuyao evidenceTrail：覆盖起卦、卦象、纳甲、世应环节', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('起卦')), `应含起卦基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('卦象')), '应含卦象构建');
  assert.ok(titles.some((t) => t.includes('纳甲')), '应含纳甲装卦');
  assert.ok(titles.some((t) => t.includes('世应')), '应含世应定位');
});

// --- 4. 手摇方式附加摇卦过程 ---
test('liuyao evidenceTrail：手摇方式附加摇卦过程', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  // manual 方式无 coinThrows，不应含摇卦过程
  assert.ok(!titles.some((t) => t.includes('摇卦')), 'manual 方式不应含摇卦过程');

  const coins = generateLiuyao(fixedDate, {
    method: 'coins',
    coinThrows: [
      { coins: [3, 3, 3], total: 9 },
      { coins: [2, 3, 3], total: 8 },
      { coins: [2, 2, 3], total: 7 },
      { coins: [2, 2, 2], total: 6 },
      { coins: [3, 3, 3], total: 9 },
      { coins: [2, 3, 3], total: 8 },
    ],
  });
  const coinsTitles = coins.evidenceTrail!.items.map((i) => i.title);
  assert.ok(coinsTitles.some((t) => t.includes('摇卦')), 'coins 方式应含摇卦过程');
  const traceItem = coins.evidenceTrail!.items.find((i) => i.title.includes('摇卦'))!;
  assert.ok(
    traceItem.computationChain.some((s) => s.name.includes('三钱')),
    '摇卦过程应含三钱投掷步骤',
  );
});

// --- 5. 证据深度排序 ---
test('liuyao evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同卦象产生独立证据链 ---
test('liuyao evidenceTrail：不同爻值证据链独立生成', () => {
  const a = generateLiuyao(fixedDate, { method: 'manual', yaos: [7, 8, 9, 6, 7, 8] as const });
  const b = generateLiuyao(fixedDate, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] as const });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同卦象 summary 应不同');
  assert.ok(a.evidenceTrail!.summary.includes(a.originalName), 'A summary 应含本卦名');
  assert.ok(b.evidenceTrail!.summary.includes(b.originalName), 'B summary 应含本卦名');
});
