import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

// --- 1. generateMeihua 结果附带 evidenceTrail ---
test('meihua evidenceTrail：generateMeihua 结果包含完整证据链', () => {
  const data = generateMeihua(fixedDate);
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 4,
    `应覆盖至少 4 个起卦环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('梅花易数起卦证据链'), 'summary 应标记梅花起卦');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('meihua evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateMeihua(fixedDate);
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

// --- 3. 覆盖环节断言：数理 + 卦象 + 体用 + 生克 ---
test('meihua evidenceTrail：覆盖数理、卦象、体用、生克环节', () => {
  const data = generateMeihua(fixedDate);
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('数理')), `应含起卦数理（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('卦象')), '应含卦象构建');
  assert.ok(titles.some((t) => t.includes('体用')), '应含体用定位');
  assert.ok(titles.some((t) => t.includes('生克')), '应含体用生克');
});

// --- 4. 数字起卦附加数理环节 ---
test('meihua evidenceTrail：数字起卦附加起卦数理', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 42 });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('数理')), '数字起卦应含起卦数理');
  const calcItem = data.evidenceTrail!.items.find((i) => i.title.includes('数理'))!;
  assert.ok(
    calcItem.computationChain.some((s) => s.name.includes('上卦')),
    '数理环节应含上卦/下卦/动爻步骤',
  );
});

// --- 5. 证据深度排序 ---
test('meihua evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateMeihua(fixedDate);
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同起卦方式产生独立证据链 ---
test('meihua evidenceTrail：不同起卦方式证据链独立生成', () => {
  const a = generateMeihua(fixedDate, { method: 'time' });
  const b = generateMeihua(fixedDate, { method: 'number', number: 7 });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同方式 summary 应不同');
  assert.ok(a.evidenceTrail!.summary.includes(a.originalName), 'A summary 应含本卦名');
});
