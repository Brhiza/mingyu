import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTaiyi } from '../packages/core/src/taiyi/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

test('taiyi evidenceTrail：结果包含完整证据链', () => {
  const data = generateTaiyi({ year: 2025 });
  assert.ok(data.evidenceTrail);
  assert.ok(Array.isArray(data.evidenceTrail!.items));
  assert.ok(data.evidenceTrail!.items.length >= 3, `应覆盖至少 3 环节（实际 ${data.evidenceTrail!.items.length}）`);
  assert.ok(data.evidenceTrail!.summary.includes('太乙证据链'));
  assert.ok(data.evidenceTrail!.overallConfidence);
});

test('taiyi evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateTaiyi({ year: 2025 });
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

test('taiyi evidenceTrail：覆盖起局、积算、太乙定位环节', () => {
  const data = generateTaiyi({ year: 2025 });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('起局')), `应含起局（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('积算')));
  assert.ok(titles.some((t) => t.includes('定位')));
});

test('taiyi evidenceTrail：积算输出与结果一致', () => {
  const data = generateTaiyi({ year: 2025 });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('积算'))!;
  const step = item.computationChain.find((s) => s.name.includes('积算值'))!;
  assert.equal(step.output, data.accumulatedValue);
});

test('taiyi evidenceTrail：证据按 depth 升序', () => {
  const data = generateTaiyi({ year: 2025 });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) assert.ok(depths[i] >= depths[i - 1]);
  assert.ok(data.evidenceTrail!.items.filter((i) => i.depth === 0).length >= 1);
});

test('taiyi evidenceTrail：不同年份独立', () => {
  const a = generateTaiyi({ year: 2025 });
  const b = generateTaiyi({ year: 2030 });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary);
});
