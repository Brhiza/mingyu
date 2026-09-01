import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBaZhai } from '../packages/core/src/ba_zhai/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const baseInput = { birthYear: 1990, gender: 'male' as const, sitMountain: '子' as const };

// --- 1. analyzeBaZhai 结果附带 evidenceTrail ---
test('ba-zhai evidenceTrail：analyzeBaZhai 结果包含完整证据链', () => {
  const data = analyzeBaZhai({ ...baseInput });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个八宅环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('八宅风水证据链'), 'summary 应标记八宅风水');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('ba-zhai evidenceTrail：每条证据满足四字段契约', () => {
  const data = analyzeBaZhai({ ...baseInput });
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
test('ba-zhai evidenceTrail：覆盖命卦、游年、方位环节', () => {
  const data = analyzeBaZhai({ ...baseInput });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('命卦')), `应含命卦推算（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('游年')), '应含命宫游年');
  assert.ok(titles.some((t) => t.includes('方位')), '应含吉凶方位');
});

// --- 4. 命卦输出一致 ---
test('ba-zhai evidenceTrail：命卦输出与结果一致', () => {
  const data = analyzeBaZhai({ ...baseInput });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('命卦'))!;
  const step = item.computationChain.find((s) => s.name === '命卦')!;
  assert.equal(step.output, data.mingGua, '命卦应一致');
});

// --- 5. 证据深度排序 ---
test('ba-zhai evidenceTrail：证据按 depth 升序排列', () => {
  const data = analyzeBaZhai({ ...baseInput });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同命例独立证据链 ---
test('ba-zhai evidenceTrail：不同命例证据链独立生成', () => {
  const a = analyzeBaZhai({ ...baseInput });
  const b = analyzeBaZhai({ birthYear: 1985, gender: 'female', sitMountain: '午' });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同命例 summary 应不同');
});
