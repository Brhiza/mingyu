import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

// --- 1. generateAlmanacSelection 结果附带 evidenceTrail ---
test('almanac evidenceTrail：generateAlmanacSelection 结果包含完整证据链', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个择日环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('黄历择日证据链'), 'summary 应标记黄历择日');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('almanac evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
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

// --- 3. 覆盖环节断言 ---
test('almanac evidenceTrail：覆盖择日基础与宜忌筛选', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('基础')), `应含择日基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('宜忌')), '应含宜忌筛选');
});

// --- 4. 候选日期数量一致 ---
test('almanac evidenceTrail：候选日期输出与结果一致', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('宜忌'))!;
  const step = item.computationChain.find((s) => s.name.includes('候选数量'))!;
  assert.equal(step.output, data.days.length, '候选数量应一致');
});

// --- 5. 证据深度排序 ---
test('almanac evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同事项产生独立证据链 ---
test('almanac evidenceTrail：不同事项证据链独立生成', () => {
  const move = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
  const wedding = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  });
  assert.notEqual(move.evidenceTrail!.summary, wedding.evidenceTrail!.summary, '不同事项 summary 应不同');
});
