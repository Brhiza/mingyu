import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const baseInput = {
  year: 2025,
  birthYear: 1990,
  gender: 'male' as const,
  sitMountain: '子' as const,
  facingMountain: '午' as const,
};

// --- 1. generateResidentialFengshui 结果附带 evidenceTrail ---
test('residential-fengshui evidenceTrail：结果包含完整证据链', () => {
  const data = generateResidentialFengshui({ ...baseInput });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个综合环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('住宅风水综合证据链'), 'summary 应标记住宅风水');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('residential-fengshui evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateResidentialFengshui({ ...baseInput });
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
test('residential-fengshui evidenceTrail：覆盖基础、八宅、玄空环节', () => {
  const data = generateResidentialFengshui({ ...baseInput });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('基础')), `应含评估基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('八宅')), '应含八宅分析');
  assert.ok(titles.some((t) => t.includes('玄空')), '应含玄空分析');
});

// --- 4. 子结果含 evidenceTrail ---
test('residential-fengshui evidenceTrail：八宅/玄空子结果附带各自证据链', () => {
  const data = generateResidentialFengshui({ ...baseInput });
  assert.ok(data.bazhai?.evidenceTrail, '八宅子结果应含证据链');
  assert.ok(data.xuankong?.evidenceTrail, '玄空子结果应含证据链');
});

// --- 5. 证据深度排序 ---
test('residential-fengshui evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateResidentialFengshui({ ...baseInput });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同输入独立证据链 ---
test('residential-fengshui evidenceTrail：不同输入证据链独立生成', () => {
  const a = generateResidentialFengshui({ ...baseInput });
  const b = generateResidentialFengshui({ year: 2010, birthYear: 1985, gender: 'female', sitMountain: '午', facingMountain: '子' });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同输入 summary 应不同');
});
