import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const baseInput = {
  year: 1990, month: 5, day: 20, hour: 12,
  latitude: 36.65, longitude: 117.0, timeZoneId: 'Asia/Shanghai',
};

test('qi-zheng evidenceTrail：结果包含完整证据链', () => {
  const data = generateQizheng({ ...baseInput });
  assert.ok(data.evidenceTrail);
  assert.ok(Array.isArray(data.evidenceTrail!.items));
  assert.ok(data.evidenceTrail!.items.length >= 3, `应覆盖至少 3 环节（实际 ${data.evidenceTrail!.items.length}）`);
  assert.ok(data.evidenceTrail!.summary.includes('七政四余证据链'));
  assert.ok(data.evidenceTrail!.overallConfidence);
});

test('qi-zheng evidenceTrail：每条证据满足四字段契约', () => {
  const data = generateQizheng({ ...baseInput });
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

test('qi-zheng evidenceTrail：覆盖星曜、相位、宫位环节', () => {
  const data = generateQizheng({ ...baseInput });
  const titles = data.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('星曜')), `应含星曜（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('相位')));
  assert.ok(titles.some((t) => t.includes('宫位')));
});

test('qi-zheng evidenceTrail：星曜输出与结果一致', () => {
  const data = generateQizheng({ ...baseInput });
  const item = data.evidenceTrail!.items.find((i) => i.title.includes('星曜'))!;
  const step = item.computationChain.find((s) => s.name.includes('星曜'))!;
  const output = step.output as string[];
  assert.equal(output.length, data.stars.length);
});

test('qi-zheng evidenceTrail：证据按 depth 升序', () => {
  const data = generateQizheng({ ...baseInput });
  const depths = data.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) assert.ok(depths[i] >= depths[i - 1]);
  assert.ok(data.evidenceTrail!.items.filter((i) => i.depth === 0).length >= 1);
});

test('qi-zheng evidenceTrail：不同命例独立', () => {
  const a = generateQizheng({ ...baseInput });
  const b = generateQizheng({ ...baseInput, year: 2000, month: 8, day: 8, hour: 8 });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary);
});
