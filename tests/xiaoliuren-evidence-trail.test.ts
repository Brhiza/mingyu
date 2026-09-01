import test from 'node:test';
import assert from 'node:assert/strict';
import { generateXiaoliuren } from '../packages/core/src/divination/algorithms/xiaoliuren.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

// --- 1. generateXiaoliuren 结果附带 evidenceTrail ---
test('xiaoliuren evidenceTrail：generateXiaoliuren 结果包含完整证据链', () => {
  const data = generateXiaoliuren({ date: fixedDate });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个占卜环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('小六壬占卜证据链'), 'summary 应标记小六壬占卜');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('xiaoliuren evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateXiaoliuren({ date: fixedDate });
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

// --- 3. 覆盖环节断言：推算 + 三宫 + 主卦 ---
test('xiaoliuren evidenceTrail：覆盖推算、三宫、主卦环节', () => {
  const data = generateXiaoliuren({ date: fixedDate });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('推算')), `应含推算过程（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('三宫')), '应含三宫定位');
  assert.ok(titles.some((t) => t.includes('主卦')), '应含主卦定局');
});

// --- 4. 主卦与结果一致性 ---
test('xiaoliuren evidenceTrail：主卦输出与结果一致', () => {
  const data = generateXiaoliuren({ date: fixedDate });
  const mainItem = data.evidenceTrail!.items.find((i) => i.title.includes('主卦'))!;
  const step = mainItem.computationChain.find((s) => s.name.includes('最终'))!;
  const output = step.output as { name: string };
  assert.equal(output.name, data.primary.name, '主卦应一致');
});

// --- 5. 证据深度排序 ---
test('xiaoliuren evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateXiaoliuren({ date: fixedDate });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同时刻产生独立证据链 ---
test('xiaoliuren evidenceTrail：不同时刻证据链独立生成', () => {
  const a = generateXiaoliuren({ date: new Date('2025-06-18T10:30:00+08:00') });
  const b = generateXiaoliuren({ date: new Date('2000-01-05T08:15:00+08:00') });
  assert.ok(a.evidenceTrail!.summary.includes(`${a.lunarMonth}月`), 'A summary 应含农历月');
  assert.ok(a.evidenceTrail!.summary.includes(a.primary.name), 'A summary 应含主卦名');
  assert.ok(b.evidenceTrail!.summary.includes(b.primary.name), 'B summary 应含主卦名');
  if (a.primary.name !== b.primary.name) {
    assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同主卦 summary 应不同');
  }
});
