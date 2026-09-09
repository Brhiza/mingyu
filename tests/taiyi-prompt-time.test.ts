import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTaiyi } from '../packages/core/src/taiyi';
import { buildMetaphysicsPrompt } from '../packages/core/src/prompt/metaphysics';

test('太乙月日时计正文保留实际东八区起局时刻，与外层当前时间分别呈现', () => {
  for (const [scope, label] of [
    ['month', '月计'],
    ['day', '日计'],
    ['hour', '时计'],
  ] as const) {
    const result = generateTaiyi({ scope, date: new Date('2026-07-11T06:35:00Z') });
    assert.equal(result.dateTime, '2026-07-11 14:35');
    const target = `分析目标：2026-07-11 14:35（东八区）起局的${label}盘。`;
    assert.ok(result.prompt.includes(target));
    const prompt = buildMetaphysicsPrompt(result.prompt, '请分析此盘。', {
      method: 'taiyi',
      currentTime: new Date('2026-05-19T10:30:00+08:00'),
    });
    assert.ok(prompt.includes(target));
    assert.match(prompt, /2026年5月19日/);
    assert.ok(prompt.includes(`本计干支：${result.ganZhi}`));
  }
});

test('太乙年计以目标年份表达，避免把内部年中取样时刻当作指定时刻', () => {
  const result = generateTaiyi({ year: 2026 });
  assert.match(result.prompt, /分析目标：2026年年计。/);
  assert.doesNotMatch(result.prompt, /分析目标：.*起局/);
});
