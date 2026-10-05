import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyao } from '@core/divination/algorithms/liuyao';
import { buildDivinationPrompt, getDivinationSummaryBlocks } from '@core/prompt/divination';
import { formatEnhancedDivinationInfo } from '@core/prompt/divination-enhanced';

const date = new Date('2025-06-18T10:30:00+08:00');
const coinThrows = Array.from({ length: 6 }, () => ({
  coins: [2, 2, 3] as const,
  total: 7 as const,
}));

test('手工三钱记录不被写成模拟投掷，随机轨迹标为不适用', () => {
  const data = generateLiuyao(date, { method: 'coins', coinThrows });
  const evidence = data.evidenceAnalysis;
  assert.ok(evidence);
  assert.equal(evidence.generationFact.methodLabel, '三钱记录起卦');
  assert.match(evidence.generationFact.promptText, /第1爻投掷记录2\+2\+3=7/u);
  assert.equal(evidence.randomFact.status, '不适用');
  assert.doesNotMatch(evidence.promptText, /模拟三钱起卦|随机轨迹缺失/u);
});

test('程序模拟三钱保留计算样本和随机轨迹', () => {
  const data = generateLiuyao(date, { method: 'coins', seed: '六爻来源测试' });
  const evidence = data.evidenceAnalysis;
  assert.ok(evidence);
  assert.equal(evidence.generationFact.methodLabel, '模拟三钱起卦');
  assert.match(evidence.generationFact.promptText, /第1爻计算样本/u);
  assert.equal(evidence.randomFact.status, '可重放');

  const corrected = new Date('2024-05-05T07:30:00+08:00');
  const actual = new Date('2024-05-05T08:40:00+08:00');
  const baseline = generateLiuyao(corrected, {
    method: 'coins',
    random: () => 0.5,
    termReferenceDate: actual,
  });
  const capture = (chart: typeof baseline) => ({
    native: formatEnhancedDivinationInfo('liuyao', chart),
    fullTask: buildDivinationPrompt({
      method: 'liuyao',
      data: chart,
      question: '本次动变关系如何？',
      currentTime: actual,
    }),
    summary: getDivinationSummaryBlocks('liuyao', chart),
  });
  const baselineConsumers = capture(baseline);
  assert.equal(baseline.ganzhi.month.slice(-1), '巳');
  for (const replaceDate of [false, true]) {
    const options = {
      method: 'coins' as const,
      termReferenceDate: new Date(actual.getTime()),
      random: (): number => {
        if (replaceDate) options.termReferenceDate = new Date(corrected.getTime());
        else options.termReferenceDate.setTime(corrected.getTime());
        return 0.5;
      },
    };
    const changed = generateLiuyao(corrected, options);
    assert.equal(options.termReferenceDate.getTime(), corrected.getTime());
    assert.equal(changed.termReferenceTimestamp, actual.getTime());
    assert.equal(changed.meta!.inputHash, baseline.meta!.inputHash);
    assert.equal(changed.meta!.resultId, baseline.meta!.resultId);
    assert.deepEqual(changed, baseline);
    assert.deepEqual(capture(changed), baselineConsumers);
    assert.deepEqual(capture(JSON.parse(JSON.stringify(changed))), baselineConsumers);
    assert.deepEqual(changed, baseline);
  }
});

test('六爻三钱重放必须恰好用尽输入样本', () => {
  const original = generateLiuyao(date, { method: 'coins', seed: '六爻重放边界' });
  const samples = original.meta!.random!.samples;
  const replayed = generateLiuyao(date, { method: 'coins', replay: samples });
  assert.deepEqual(replayed.yaoArray, original.yaoArray);
  assert.throws(
    () => generateLiuyao(date, { method: 'coins', replay: [...samples, 0] }),
    /重放样本有剩余/,
  );
});

test('六爻手工爻值和铜钱记录拒绝空数组项并返回可读的输入错误', () => {
  assert.throws(
    () => generateLiuyao(date, { method: 'manual', yaos: null as unknown as number[] }),
    /六爻手工爻值必须恰好包含 6 爻/,
  );
  assert.throws(
    () =>
      generateLiuyao(date, {
        method: 'coins',
        coinThrows: [null, ...coinThrows.slice(1)] as unknown as typeof coinThrows,
      }),
    /第1爻必须包含三枚有效铜钱/,
  );
  assert.throws(
    () =>
      generateLiuyao(date, {
        method: 'coins',
        coinThrows: [
          { coins: null, total: 7 },
          ...coinThrows.slice(1),
        ] as unknown as typeof coinThrows,
      }),
    /第1爻必须包含三枚有效铜钱/,
  );
});
