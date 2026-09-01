import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZiweiChart } from '../packages/core/src/ziwei/runtime.ts';
import { validateEvidenceItem } from '../packages/core/src/shared/evidence.ts';
import type { ChartInput } from '../packages/core/src/types/chart.ts';

function sampleInput(overrides: Partial<ChartInput> = {}): ChartInput {
  return {
    name: '测试命例',
    dateType: 'solar',
    birthDate: '1990-05-20',
    birthTimeIndex: 6, // 午时
    gender: '男',
    ...overrides,
  } as ChartInput;
}

const fixedContext = { dateStr: '2026-01-01', hourIndex: 0 };

// --- 1. calculateZiweiChart 结果附带 evidenceTrail ---
test('ziwei evidenceTrail：calculateZiweiChart 结果包含完整证据链', async () => {
  const result = await calculateZiweiChart(sampleInput(), { horoscopeContext: fixedContext });
  assert.ok(result.evidenceTrail, '结果应包含 evidenceTrail');
  assert.ok(Array.isArray(result.evidenceTrail!.items), 'items 应为数组');
  assert.ok(
    result.evidenceTrail!.items.length >= 3,
    `应覆盖至少 3 个排盘环节（实际 ${result.evidenceTrail!.items.length}）`,
  );
  assert.ok(result.evidenceTrail!.summary.includes('紫微斗数排盘证据链'), 'summary 应标记紫微排盘');
  assert.ok(result.evidenceTrail!.overallConfidence, '应有整体置信度');
});

// --- 2. 四字段契约完整性 ---
test('ziwei evidenceTrail：每条证据满足四字段契约', async () => {
  const result = await calculateZiweiChart(sampleInput(), { horoscopeContext: fixedContext });
  for (const item of result.evidenceTrail!.items) {
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

// --- 3. 覆盖环节断言：命宫 + 星曜 + 四化 + 大限 ---
test('ziwei evidenceTrail：覆盖命宫、星曜、四化与大限环节', async () => {
  const result = await calculateZiweiChart(sampleInput(), { horoscopeContext: fixedContext });
  const titles = result.evidenceTrail!.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('命宫')), `应含命宫定位（实际: ${titles.join(', ')}）`);
  assert.ok(titles.some((t) => t.includes('星曜')), '应含星曜安布');
  assert.ok(titles.some((t) => t.includes('四化')), '应含生年四化');
  assert.ok(titles.some((t) => t.includes('大限')), '应含大限起运');
});

// --- 4. 真太阳时模式附加校正证据 ---
test('ziwei evidenceTrail：启用真太阳时附加校正证据', async () => {
  const plain = await calculateZiweiChart(sampleInput(), { horoscopeContext: fixedContext });
  const withTst = await calculateZiweiChart(
    sampleInput({
      trueSolarEvidence: {
        key: 'ziwei:true-solar:test',
        status: '已计算',
        calculationSteps: [],
        calculationChain: ['经度时差', '均时差'],
        correctionFacts: [],
        summaryFact: {
          key: 'true-solar:summary',
          status: '已计算',
          correctionMinutes: 1.5,
          adjustedLocalDateTime: '1990-05-20T12:30:00',
          promptText: '已按经度与均时差校正',
          sources: ['Meeus'],
          limitation: '±1 分钟',
        },
        limitations: ['±1 分钟'],
        limitationFacts: [],
        source: 'Meeus Astronomical Algorithms',
        promptText: '真太阳时校正',
      } as NonNullable<ChartInput['trueSolarEvidence']>,
    }),
    { horoscopeContext: fixedContext },
  );
  const plainTitles = plain.evidenceTrail!.items.map((i) => i.title);
  const tstTitles = withTst.evidenceTrail!.items.map((i) => i.title);
  assert.ok(!plainTitles.some((t) => t.includes('真太阳时')), '默认模式不应含真太阳时证据');
  assert.ok(tstTitles.some((t) => t.includes('真太阳时')), '真太阳时模式应含校正证据');
  const solarItem = withTst.evidenceTrail!.items.find((i) => i.title.includes('真太阳时'))!;
  assert.ok(solarItem.computationChain.some((s) => s.name.includes('均时差')), '应含均时差步骤');
  assert.ok(solarItem.source.name.includes('Meeus'), '应标注 Meeus 出处');
});

// --- 5. 证据深度排序 ---
test('ziwei evidenceTrail：证据按 depth 升序排列', async () => {
  const result = await calculateZiweiChart(sampleInput(), { horoscopeContext: fixedContext });
  const depths = result.evidenceTrail!.items.map((i) => i.depth);
  for (let i = 1; i < depths.length; i++) {
    assert.ok(depths[i] >= depths[i - 1], `深度应非降序（${depths.join(',')}）`);
  }
  const d0 = result.evidenceTrail!.items.filter((i) => i.depth === 0);
  assert.ok(d0.length >= 1, '应至少有一条主证（depth 0）');
});

// --- 6. 不同命例产生独立证据链 ---
test('ziwei evidenceTrail：不同命例证据链独立生成', async () => {
  const a = await calculateZiweiChart(sampleInput({ birthDate: '1990-05-20' }), {
    horoscopeContext: fixedContext,
  });
  const b = await calculateZiweiChart(sampleInput({ birthDate: '2000-08-08' }), {
    horoscopeContext: fixedContext,
  });
  assert.notEqual(a.evidenceTrail!.summary, b.evidenceTrail!.summary, '不同命例 summary 应不同');
  assert.ok(a.evidenceTrail!.summary.includes('1990'), 'A 应含出生年份');
  assert.ok(b.evidenceTrail!.summary.includes('2000'), 'B 应含出生年份');
});
