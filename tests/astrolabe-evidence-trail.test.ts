import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const birthInput = {
  name: '测试命例',
  gender: '男',
  year: '1990',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '36.65',
  longitude: '117.0',
  timeZoneId: 'Asia/Shanghai',
  locationName: '济南',
} as const;

// --- 1. generateAstrolabe 结果附带 evidenceTrail ---
test('astrolabe evidenceTrail：generateAstrolabe 结果包含完整证据链', () => {
  const data = generateAstrolabe({ ...birthInput });
  assert.ok(data.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(data.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    data.evidenceTrail!.items.length >= 4,
    `应覆盖至少 4 个排盘环节（实际 ${data.evidenceTrail!.items.length}）`,
  );
  assert.ok(data.evidenceTrail!.summary.includes('西洋占星排盘证据链'), 'summary 应标记西洋占星');
  assert.ok(data.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('astrolabe evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateAstrolabe({ ...birthInput });
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

// --- 3. 覆盖环节断言：星体 + 宫位 + 摘要 ---
test('astrolabe evidenceTrail：覆盖星体、宫位、摘要环节', () => {
  const data = generateAstrolabe({ ...birthInput });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('星体')), `应含星体相位（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('宫位')), '应含宫位四轴');
  assert.ok(titles.some((t) => t.includes('摘要')), '应含星盘摘要');
});

// --- 4. 真太阳时模式附加校正证据 ---
test('astrolabe evidenceTrail：启用真太阳时附加校正证据', () => {
  const plain = generateAstrolabe({ ...birthInput });
  const tst = generateAstrolabe({ ...birthInput, useTrueSolarTime: true });
  const plainTitles = plain.evidenceTrail!.items.map((i) => i.title);
  const tstTitles = tst.evidenceTrail!.items.map((i) => i.title);
  assert.ok(!plainTitles.some((t) => t.includes('真太阳时')), '默认模式不应含真太阳时证据');
  assert.ok(tstTitles.some((t) => t.includes('真太阳时')), '真太阳时模式应含校正证据');
});

// --- 5. 证据深度排序 ---
test('astrolabe evidenceTrail：证据按 depth 升序排列', () => {
  const data = generateAstrolabe({ ...birthInput });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = data.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同命例产生独立证据链 ---
test('astrolabe evidenceTrail：不同命例证据链独立生成', () => {
  const a = generateAstrolabe({ ...birthInput, name: '甲' });
  const b = generateAstrolabe({ ...birthInput, name: '乙', year: '2000', month: '8', day: '8' });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同命例 summary 应不同');
});
