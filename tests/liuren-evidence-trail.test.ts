import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

// --- 1. generateLiuren 结果附带 evidenceTrail ---
test('liuren evidenceTrail：generateLiuren 结果包含完整证据链', () => {
  const data = generateLiuren(fixedDate);
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 4,
    `应覆盖至少 4 个起课环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('大六壬起课证据链'), 'summary 应标记六壬起课');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('liuren evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateLiuren(fixedDate);
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

// --- 3. 覆盖环节断言：月将 + 四课三传 + 课体 ---
test('liuren evidenceTrail：覆盖月将、四课三传、课体环节', () => {
  const data = generateLiuren(fixedDate);
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('月将')), `应含月将加占时（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('四课')), '应含四课三传');
  assert.ok(titles.some((t) => t.includes('课体')), '应含课体格局');
});

// --- 4. 四课三传数量一致性 ---
test('liuren evidenceTrail：四课三传输出与结果一致', () => {
  const data = generateLiuren(fixedDate);
  const lessonItem = data.evidenceTrail!.items.find((i) => i.title.includes('四课'))!;
  const lessonStep = lessonItem.computationChain.find((s) => s.name.includes('四课'))!;
  const lessonOutput = lessonStep.output as { lessonCount: number };
  assert.equal(lessonOutput.lessonCount, data.fourLessons.length, '四课数量应一致');
  const transStep = lessonItem.computationChain.find((s) => s.name.includes('三传'))!;
  const transOutput = transStep.output as { transmissionCount: number };
  assert.equal(transOutput.transmissionCount, data.threeTransmissions.length, '三传数量应一致');
});

// --- 5. 证据深度排序 ---
test('liuren evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateLiuren(fixedDate);
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同时刻产生独立证据链 ---
test('liuren evidenceTrail：不同时刻证据链独立生成', () => {
  const a = generateLiuren(new Date('2025-06-18T10:30:00+08:00'));
  const b = generateLiuren(new Date('2000-01-05T08:15:00+08:00'));
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同时刻 summary 应不同');
  assert.ok(a.evidenceTrail!.summary.includes(a.divinationBranch), 'A summary 应含占时');
});
