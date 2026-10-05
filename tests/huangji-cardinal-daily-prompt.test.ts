import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateHuangjiJingshi } from '@core/huangji-jingshi';

test('四正月经卦的日卦提示词写明实际入序起点', () => {
  for (const [instant, monthJing, sequenceStart] of [
    ['2026-02-19T12:00:00Z', '乾', '姤'],
    ['2040-02-19T12:00:00Z', '离', '革'],
    ['2048-04-19T12:00:00Z', '坎', '蒙'],
  ]) {
    const result = calculateHuangjiJingshi({ date: new Date(instant) });
    const daily = result.dateTimeForecast?.hexagrams.daily;
    assert.ok(daily);
    assert.equal(result.dateTimeForecast?.hexagrams.monthJing.shortName, monthJing);
    assert.equal(daily?.sequenceOffset, 0);
    assert.equal(daily?.sequenceStart, sequenceStart);
    assert.equal(daily?.shortName, sequenceStart);
    assert.ok(
      result.prompt.includes(
        `日卦：${daily.name}（由月经卦${monthJing}接续${sequenceStart}入六十卦序，顺行0位）`,
      ),
    );
  }
});
