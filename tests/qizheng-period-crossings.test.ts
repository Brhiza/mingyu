import test from 'node:test';
import assert from 'node:assert/strict';
import { scanQizhengPeriodEvents } from '../packages/core/src/qi_zheng/period-events.ts';

const start = Date.UTC(2022, 5, 1);
const hour = 3_600_000;
const normalize = (angle: number) => ((angle % 360) + 360) % 360;

for (const direction of [1, -1]) {
  test(`七政精确吊照${direction === 1 ? '顺行' : '逆行'}跨越角度边界时不产生对侧假事件`, () => {
    for (const [target, expected] of [
      [0, '同宫'],
      [60, '六合'],
      [90, '四正'],
      [120, '三方'],
      [180, '对照'],
      [240, '三方'],
      [270, '四正'],
      [300, '六合'],
    ] as const) {
      const result = scanQizhengPeriodEvents({
        natalStars: [{ name: '本命星', longitude: 17 }],
        twelvePalaces: [],
        startUtcMs: start,
        endUtcMs: start + hour,
        timezone: 8,
        mode: 'daily',
        sampleLongitudes: (utcMs) => [
          {
            name: '太阳',
            longitude: normalize(17 + target + direction * ((utcMs - start) / hour - 0.37)),
          },
        ],
      });
      const aspects = result.events.filter((event) => event.kind === '精确吊照');
      assert.deepEqual(
        aspects.map((event) => event.aspectType),
        [expected],
        `实际夹角经过${target}度时应只有${expected}`,
      );
      assert.ok(Math.abs(aspects[0].utcMs - (start + 0.37 * hour)) < 1000);
      const angle = Math.min(target, 360 - target);
      assert.ok(
        aspects[0].promptText.includes(
          `精确吊照：流曜太阳与本命本命星成${expected === '同宫' ? '合相' : expected}，目标角${angle}°`,
        ),
      );
      assert.ok(result.promptText.split('\n').includes(aspects[0].promptText));
    }
  });
}
