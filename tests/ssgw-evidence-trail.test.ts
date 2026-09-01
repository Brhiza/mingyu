import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRandomSign, resolveSignByNumber } from '../packages/core/src/divination/algorithms/ssgw.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

// --- 1. drawRandomSign 结果附带 evidenceTrail ---
test('ssgw evidenceTrail：drawRandomSign 结果包含完整证据链', () => {
  const data = drawRandomSign({ seed: 'test-seed' });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个抽签环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('灵签抽签证据链'), 'summary 应标记灵签抽签');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('ssgw evidenceTrail：每条证据满足四字段契约', () => {
  const data = drawRandomSign({ seed: 'test-seed' });
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
test('ssgw evidenceTrail：覆盖抽签基础、时间、签文环节', () => {
  const data = drawRandomSign({ seed: 'test-seed' });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('基础')), `应含抽签基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('时间')), '应含求签时间');
  assert.ok(titles.some((t) => t.includes('签文')), '应含签文呈现');
});

// --- 4. 签号输出与结果一致 ---
test('ssgw evidenceTrail：签号输出与结果一致', () => {
  const data = drawRandomSign({ seed: 'test-seed' });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('基础'))!;
  const step = item.computationChain.find((s) => s.name.includes('抽得签号'))!;
  assert.equal(step.output, data.number, '抽得签号应一致');
});

// --- 5. 证据深度排序 ---
test('ssgw evidenceTrail：证据按 depth 升序排列', () => {
  const data = drawRandomSign({ seed: 'test-seed' });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. manual 方式同样附带证据链 ---
test('ssgw evidenceTrail：resolveSignByNumber 附带证据链', () => {
  const data = resolveSignByNumber(1);
  assert.ok(data.evidenceTrail, 'manual 结果应包含 evidenceTrail');
  const methodItem = data.evidenceTrail!.items.find((i) => i.title.includes('抽取'))!;
  const step = methodItem.computationChain.find((s) => s.name.includes('抽取方法'))!;
  assert.equal(step.output, 'manual', 'manual 方式应标记');
});
