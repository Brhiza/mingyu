import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateQizhengMansionBoundaries,
  generateQizheng,
  longitudeToQizhengMansion,
} from '@core/qi_zheng';

test('七政四余完整盘采用二十八宿真实距星边界并保持位置来源分层', () => {
  const result = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });

  assert.equal(result.stars.length, 11);
  assert.equal(result.stars.filter((star) => star.kind === '七政').length, 7);
  assert.equal(result.stars.filter((star) => star.kind === '四余').length, 4);
  assert.equal(result.mansionBoundaries.length, 28);
  assert.equal(new Set(result.mansionBoundaries.map((item) => item.mansion)).size, 28);
  assert.ok(
    Math.abs(
      result.mansionBoundaries.reduce((sum, boundary) => sum + boundary.widthDegrees, 0) - 360,
    ) < 1e-9,
  );
  for (const star of result.stars) {
    const boundary = result.mansionBoundaries.find((item) => item.mansion === star.xiu);
    assert.ok(boundary);
    assert.ok(star.xiuDegree >= 0 && star.xiuDegree < boundary.widthDegrees);
  }
  assert.equal(
    result.stars.find((star) => star.name.startsWith('紫炁'))?.precisionClass,
    '传统均速模型',
  );
  assert.ok(
    result.stars
      .filter((star) => !star.name.startsWith('紫炁'))
      .every((star) => star.precisionClass === '现代天文计算'),
  );
  assert.match(result.prompt, /二十八宿：按目标日期距星真实黄经划分宿度。/);
  assert.doesNotMatch(result.prompt, /366\.5|等比例换算/);
});

test('二十八宿距星黄经与 Astropy ERFA 独立金标一致', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2000-01-01T12:00:00Z'));
  const astropyGold = new Map([
    ['壁', 9.15204207],
    ['角', 203.836144802],
    ['觜', 83.708661041],
    ['参', 84.683617688],
    ['轸', 190.721729542],
  ]);

  for (const [mansion, expected] of astropyGold) {
    const actual = boundaries.find((item) => item.mansion === mansion)?.longitude;
    assert.notEqual(actual, undefined);
    assert.ok(Math.abs(actual! - expected) < 0.01, `${mansion}宿距星黄经超出0.01°容差`);
  }
});

test('宿界前后必须落入相邻两宿，边界本身归入新宿', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2024-06-15T04:00:00Z'));
  const angle = boundaries.find((item) => item.mansion === '角');
  assert.ok(angle);
  assert.equal(longitudeToQizhengMansion(angle.longitude, boundaries).xiu, '角');
  assert.equal(longitudeToQizhengMansion(angle.longitude - 1e-6, boundaries).xiu, '轸');
});

test('宿界查询应接受乱序资料，并拒绝重复宿名、无效宿宽与不连续边界', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2024-06-15T04:00:00Z'));
  const target = boundaries[8];
  assert.equal(
    longitudeToQizhengMansion(target.longitude, [...boundaries].reverse()).xiu,
    target.mansion,
  );

  const duplicated = boundaries.map((item, index) =>
    index === 1 ? { ...item, mansion: boundaries[0].mansion } : item,
  );
  assert.throws(() => longitudeToQizhengMansion(target.longitude, duplicated), /重复或缺失宿名/);
  assert.throws(
    () =>
      longitudeToQizhengMansion(
        target.longitude,
        boundaries.map((item, index) => (index === 0 ? { ...item, widthDegrees: 0 } : item)),
      ),
    /黄经或宿宽无效/,
  );
  assert.throws(
    () =>
      longitudeToQizhengMansion(
        target.longitude,
        boundaries.map((item, index) =>
          index === 0 ? { ...item, widthDegrees: item.widthDegrees + 0.01 } : item,
        ),
      ),
    /宿界不连续/,
  );
});
