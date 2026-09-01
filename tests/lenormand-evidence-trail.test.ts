import test from 'node:test';
import assert from 'node:assert/strict';
import { drawLenormandSpread } from '../packages/core/src/divination/algorithms/lenormand.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

// --- 1. drawLenormandSpread 结果附带 evidenceTrail ---
test('lenormand evidenceTrail：drawLenormandSpread 结果包含完整证据链', () => {
  const data = drawLenormandSpread('three', { seed: 'test-seed' });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个抽牌环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('雷诺曼抽牌证据链'), 'summary 应标记雷诺曼抽牌');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('lenormand evidenceTrail：每条证据满足四字段契约', () => {
  const data = drawLenormandSpread('three', { seed: 'test-seed' });
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

// --- 3. 覆盖环节断言：基础 + 洗牌 + 牌面 ---
test('lenormand evidenceTrail：覆盖抽牌基础、洗牌、牌面环节', () => {
  const data = drawLenormandSpread('three', { seed: 'test-seed' });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('基础')), `应含抽牌基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('洗牌')), '应含洗牌抽牌');
  assert.ok(titles.some((t) => t.includes('牌面')), '应含牌面抽定');
});

// --- 4. 抽定牌数与结果一致 ---
test('lenormand evidenceTrail：牌面输出与结果一致', () => {
  const data = drawLenormandSpread('three', { seed: 'test-seed' });
  const cardItem = data.evidenceTrail!.items.find((i) => i.title.includes('牌面'))!;
  const step = cardItem.computationChain.find((s) => s.name.includes('抽定'))!;
  const output = step.output as string[];
  assert.equal(output.length, data.cards.length, '牌面数量应一致');
});

// --- 5. 证据深度排序 ---
test('lenormand evidenceTrail：证据按 depth 升序排列', () => {
  const data = drawLenormandSpread('three', { seed: 'test-seed' });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同牌阵产生独立证据链 ---
test('lenormand evidenceTrail：不同牌阵证据链独立生成', () => {
  const single = drawLenormandSpread('single', { seed: 'a' });
  const three = drawLenormandSpread('three', { seed: 'a' });
  assert.notEqual(single.evidenceTrail!.summary, three.evidenceTrail!.summary, '不同牌阵 summary 应不同');
});
