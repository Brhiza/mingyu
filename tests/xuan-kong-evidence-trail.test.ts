import test from 'node:test';
import assert from 'node:assert/strict';
import { generateXuanKong } from '../packages/core/src/xuan_kong/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const baseInput = { year: 2025, sitMountain: '子' as const, facingMountain: '午' as const };

// --- 1. generateXuanKong 结果附带 evidenceTrail ---
test('xuan-kong evidenceTrail：generateXuanKong 结果包含完整证据链', () => {
  const data = generateXuanKong({ ...baseInput });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 4,
    `应覆盖至少 4 个玄空环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('玄空飞星证据链'), 'summary 应标记玄空飞星');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('xuan-kong evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateXuanKong({ ...baseInput });
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
test('xuan-kong evidenceTrail：覆盖排盘基础、坐向、飞星、格局环节', () => {
  const data = generateXuanKong({ ...baseInput });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('排盘基础')), `应含排盘基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('坐向')), '应含坐向定盘');
  assert.ok(titles.some((t) => t.includes('飞星')), '应含飞星布局');
  assert.ok(titles.some((t) => t.includes('格局')), '应含格局组合');
});

// --- 4. 坐向输出一致 ---
test('xuan-kong evidenceTrail：坐向输出与结果一致', () => {
  const data = generateXuanKong({ ...baseInput });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('坐向'))!;
  const sit = item.computationChain.find((s) => s.name.includes('坐山'))!;
  assert.equal(sit.output, data.sitMountain, '坐山应一致');
});

// --- 5. 证据深度排序 ---
test('xuan-kong evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateXuanKong({ ...baseInput });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同年份独立证据链 ---
test('xuan-kong evidenceTrail：不同年份证据链独立生成', () => {
  const a = generateXuanKong({ ...baseInput });
  const b = generateXuanKong({ year: 2035, sitMountain: '午', facingMountain: '子' });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同年份 summary 应不同');
});
