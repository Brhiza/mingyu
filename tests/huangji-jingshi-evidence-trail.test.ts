import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '../packages/core/src/huangji-jingshi/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const baseInput = { epochYear: 0, year: 2025 };

test('huangji evidenceTrail：结果包含完整证据链', () => {
  const data = calculateHuangjiJingshi({ ...baseInput });
  assert.ok(data.evidenceTrail);
  assert.ok(Array.isArray(data.evidenceTrail!.items));
  assert.ok(data.evidenceTrail!.items.length >= 3, `应覆盖至少 3 环节（实际 ${data.evidenceTrail!.items.length}）`);
  assert.ok(data.evidenceTrail!.summary.includes('皇极经世证据链'));
  assert.ok(data.evidenceTrail!.overallConfidence);
});

test('huangji evidenceTrail：每条证据满足四字段契约', () => {
  const data = calculateHuangjiJingshi({ ...baseInput });
  for (const item of data.evidenceTrail!.items) {
    const errors = validateEvidenceItem(item);
    assert.deepEqual(errors, [], `证据「${item.title}」违规: ${errors.join('; ')}`);
    assert.ok(item.computationChain.length > 0);
    assert.ok(item.source.name);
    assert.ok(item.boundary);
    assert.ok(['high', 'medium', 'low'].includes(item.confidence));
    assert.ok(item.depth >= 0 && item.depth <= 4);
  }
});

test('huangji evidenceTrail：覆盖基础、坐标、换算环节', () => {
  const data = calculateHuangjiJingshi({ ...baseInput });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('基础')), `应含基础（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('坐标')));
  assert.ok(titles.some((t) => t.includes('换算')));
});

test('huangji evidenceTrail：年份输出与结果一致', () => {
  const data = calculateHuangjiJingshi({ ...baseInput });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('基础'))!;
  const step = item.computationChain.find((s) => s.name.includes('公历年'))!;
  assert.equal(step.output, data.input.year);
});

test('huangji evidenceTrail：证据按 depth 升序', () => {
  const data = calculateHuangjiJingshi({ ...baseInput });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) assert.ok(depths[i] >= depths[i - 1]);
  assert.ok(data.evidenceTrail!.items.filter((i) => i.depth === 0).length >= 1);
});

test('huangji evidenceTrail：不同年份独立', () => {
  const a = calculateHuangjiJingshi({ ...baseInput });
  const b = calculateHuangjiJingshi({ epochYear: 0, year: 2030 });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary);
});
