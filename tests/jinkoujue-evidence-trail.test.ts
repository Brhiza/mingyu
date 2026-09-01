import test from 'node:test';
import assert from 'node:assert/strict';
import { generateJinkoujue } from '../packages/core/src/divination/algorithms/jinkoujue.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

// --- 1. generateJinkoujue 结果附带 evidenceTrail ---
test('jinkoujue evidenceTrail：generateJinkoujue 结果包含完整证据链', () => {
  const data = generateJinkoujue({ method: 'time' });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个起课环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('金口诀起课证据链'), 'summary 应标记金口诀起课');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('jinkoujue evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateJinkoujue({ method: 'time' });
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
test('jinkoujue evidenceTrail：覆盖起课基础、月将贵神、四课环节', () => {
  const data = generateJinkoujue({ method: 'time' });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('基础')), `应含起课基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('月将')), '应含月将贵神');
  assert.ok(titles.some((t) => t.includes('四课')), '应含四课定位');
});

// --- 4. 昼夜/方法输出一致 ---
test('jinkoujue evidenceTrail：起课方法输出与结果一致', () => {
  const data = generateJinkoujue({ method: 'time' });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('基础'))!;
  const step = item.computationChain.find((s) => s.name.includes('起课方法'))!;
  assert.ok(String(step.output).includes(data.method), '起课方法应一致');
});

// --- 5. 证据深度排序 ---
test('jinkoujue evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateJinkoujue({ method: 'time' });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同方法产生独立证据链 ---
test('jinkoujue evidenceTrail：不同起课方法证据链独立生成', () => {
  const time = generateJinkoujue({ method: 'time' });
  const number = generateJinkoujue({ method: 'number', number: 123 });
  assert.notEqual(time.evidenceTrail!.summary, number.evidenceTrail!.summary, '不同方法 summary 应不同');
});
