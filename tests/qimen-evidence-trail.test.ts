import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

// --- 1. generateQimen 结果附带 evidenceTrail ---
test('qimen evidenceTrail：generateQimen 结果包含完整证据链', () => {
  const data = generateQimen(fixedDate);
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 4,
    `应覆盖至少 4 个排盘环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('奇门遁甲排盘证据链'), 'summary 应标记奇门排盘');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('qimen evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateQimen(fixedDate);
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

// --- 3. 覆盖环节断言：定局 + 值符值使 + 九宫 + 格局 ---
test('qimen evidenceTrail：覆盖定局、值符值使、九宫、格局环节', () => {
  const data = generateQimen(fixedDate);
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('定局')), `应含奇门定局（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('值符')), '应含值符值使');
  assert.ok(titles.some((t) => t.includes('九宫')), '应含九宫布局');
  assert.ok(titles.some((t) => t.includes('格局')), '应含奇门格局');
});

// --- 4. 不同时刻产生独立证据链 ---
test('qimen evidenceTrail：不同时刻证据链独立生成', () => {
  const a = generateQimen(new Date('2025-06-18T10:30:00+08:00'));
  const b = generateQimen(new Date('2000-01-05T08:15:00+08:00'));
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同时刻 summary 应不同');
  const juShuItem = a.evidenceTrail!.items.find((i) => i.title.includes('定局'))!;
  const juShuStep = juShuItem.computationChain.find((s) => s.name.includes('局数'));
  assert.ok(juShuStep, '定局环节应含局数步骤');
  assert.equal(juShuStep!.output, a.juShu, '局数输出应与结果一致');
});

// --- 5. 证据深度排序 ---
test('qimen evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateQimen(fixedDate);
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 排盘级别标注 ---
test('qimen evidenceTrail：summary 含阴阳遁局数', () => {
  const data = generateQimen(fixedDate);
  const s = data.evidenceTrail!.summary;
  assert.ok(s.includes('遁'), 'summary 应含遁字');
  assert.ok(/\d+局/.test(s), `summary 应含局数（实际: ${s}）`);
});
