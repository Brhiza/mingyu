import test from 'node:test';
import assert from 'node:assert/strict';
import { BaziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';

const calculator = new BaziCalculator();

function samplePerson(overrides: Record<string, unknown> = {}) {
  return {
    year: 1990,
    month: 5,
    day: 20,
    timeIndex: 6, // 午时
    gender: 'male',
    isLunar: false,
    ...overrides,
  } as Parameters<typeof calculator.calculateBazi>[0];
}

// --- 1. calculateBazi 结果附带 evidenceTrail ---
test('bazi evidenceTrail：calculateBazi 结果包含完整证据链', () => {
  const result = calculator.calculateBazi(samplePerson());
  assert.ok(result.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(result.evidenceTrail.items), 'items 应为数组');
  assert.ok(result.evidenceTrail.items.length >= 3, `应覆盖至少 3 个排盘环节（实际 ${result.evidenceTrail.items.length}）`);
  assert.ok(result.evidenceTrail.summary.includes('八字排盘证据链'), 'summary 应标记八字排盘');
  assert.ok(result.evidenceTrail.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('bazi evidenceTrail：每条证据满足四字段契约', () => {
  const result = calculator.calculateBazi(samplePerson());
  for (const item of result.evidenceTrail!.items) {
    const errors = validateEvidenceItem(item);
    assert.deepEqual(errors, [], `证据「${item.title}」契约违规: ${errors.join('; ')}`);
    assert.ok(item.computationChain.length > 0, `「${item.title}」应有计算链`);
    assert.ok(item.source.name, `「${item.title}」应有出处`);
    assert.ok(item.boundary, `「${item.title}」应有边界`);
    assert.ok(item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low');
    assert.ok(item.depth >= 0 && item.depth <= 4, `「${item.title}」深度应在 0-4`);
  }
});

// --- 3. 覆盖环节断言：四柱推演 + 十神推导 ---
test('bazi evidenceTrail：覆盖四柱推演与十神推导环节', () => {
  const result = calculator.calculateBazi(samplePerson());
  const titles = result.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('四柱')), `应含四柱推演（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('十神')), '应含十神推导');
  assert.ok(titles.some((t) => t.includes('大运')), '应含大运起运');
});

// --- 4. 真太阳时模式附加校正证据 ---
test('bazi evidenceTrail：启用真太阳时附加校正证据', () => {
  const plain = calculator.calculateBazi(samplePerson());
  const tst = calculator.calculateBazi(
    samplePerson({ useTrueSolarTime: true, birthLongitude: 117.0, birthHour: 12, birthMinute: 30 }),
  );
  const plainTitles = plain.evidenceTrail!.items.map((i) => i.title);
  const tstTitles = tst.evidenceTrail!.items.map((i) => i.title);
  assert.ok(!plainTitles.some((t) => t.includes('真太阳时')), '默认模式不应含真太阳时证据');
  assert.ok(tstTitles.some((t) => t.includes('真太阳时')), '真太阳时模式应含校正证据');
  const solarItem = tst.evidenceTrail!.items.find((i) => i.title.includes('真太阳时'))!;
  assert.ok(solarItem.computationChain.some((s) => s.name.includes('均时差')), '应含均时差步骤');
  assert.ok(solarItem.source.name.includes('Meeus'), '应标注 Meeus 出处');
});

// --- 5. 证据深度排序 ---
test('bazi evidenceTrail：证据按 depth 升序排列', () => {
  const result = calculator.calculateBazi(samplePerson());
  const depths = result.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = result.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同出生信息产生独立证据链 ---
test('bazi evidenceTrail：不同命例证据链独立生成', () => {
  const a = calculator.calculateBazi(samplePerson({ year: 1990, day: 20 }));
  const b = calculator.calculateBazi(samplePerson({ year: 2000, day: 8 }));
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同命例 summary 应不同');
  assert.ok(a.evidenceTrail!.summary.includes('1990'), 'A 应含出生年份');
  assert.ok(b.evidenceTrail!.summary.includes('2000'), 'B 应含出生年份');
});
