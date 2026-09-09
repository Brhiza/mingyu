import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index';

test('流曜吊照逐条绑定采样时刻和本命宫位，角距两端来自不同时间盘', () => {
  const result = generateQizheng({
    year: 1993,
    month: 4,
    day: 8,
    hour: 23,
    minute: 34,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    flowYear: 2022,
    flowMonth: 6,
    flowDay: 15,
    flowHour: 12,
  });
  const flowing = result.flowingStars!;
  assert.ok(flowing.transits.length > 0);
  for (const aspect of flowing.transits) {
    const first = flowing.stars.find((star) => `流曜${star.name}` === aspect.star1)!;
    const second = result.stars.find((star) => `本命${star.name}` === aspect.star2)!;
    const raw = Math.abs(first.longitude - second.longitude);
    const angle = Math.min(raw, 360 - raw);
    assert.ok(Math.abs(angle - aspect.actualAngle) < 0.0001);
    assert.ok(Math.abs(Math.abs(angle - aspect.exactAngle) - aspect.orb) < 0.0001);
    assert.ok(
      result.prompt.includes(
        `采样时刻${flowing.localDateTime}：${aspect.star1}（本命${first.signBranch}宫${first.palace}）与${aspect.star2}（${second.signBranch}宫${second.palace}）`,
      ),
    );
  }
  assert.match(result.prompt, /采样时刻2022-06-15T12:00:00/);
  assert.equal(flowing.periodEvents?.mode, 'daily');
});

test('七政正文区分跨宫合相与同宫位置，并保留角距和偏差口径', () => {
  const result = generateQizheng({
    year: 2026,
    month: 5,
    day: 19,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  assert.match(
    result.prompt,
    /太阳（酉宫福德）与辰星\(水\)（申宫官禄）：合相；目标角0°，实际角距5\.48°，偏差5\.48°，容许偏差上限8°；落宫关系异宫/,
  );
  assert.match(
    result.prompt,
    /太阴（未宫迁移）与太白\(金\)（未宫迁移）：合相；目标角0°，实际角距0\.39°，偏差0\.39°，容许偏差上限8°；落宫关系同宫/,
  );
  const stars = new Map(result.stars.map((star) => [star.name, star]));
  for (const aspect of result.aspects) {
    const first = stars.get(aspect.star1)!;
    const second = stars.get(aspect.star2)!;
    const raw = Math.abs(first.longitude - second.longitude);
    const angle = Math.min(raw, 360 - raw);
    assert.ok(Math.abs(angle - aspect.actualAngle) < 0.0001);
    assert.ok(Math.abs(Math.abs(angle - aspect.exactAngle) - aspect.orb) < 0.0001);
    assert.ok(aspect.orb <= aspect.allowedOrb);
    assert.ok(
      result.prompt.includes(
        `${first.name}（${first.signBranch}宫${first.palace}）与${second.name}（${second.signBranch}宫${second.palace}）`,
      ),
    );
  }
  assert.equal(
    result.aspects.find((aspect) => aspect.star1 === '太阳' && aspect.star2 === '辰星(水)')?.type,
    '同宫',
  );
});
