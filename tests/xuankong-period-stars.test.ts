import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flyStars,
  generateXuanKong,
  resolveFlyingStarYunState,
  resolveMonthFlyingStar,
  resolveShanXiangRelation,
  resolveYearFlyingStar,
} from '../packages/core/src/xuan_kong/index.ts';

const NINE_STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

test('流年紫白入中后顺飞九宫，中宫即入中星', () => {
  const yearStar = resolveYearFlyingStar(2024);
  assert.equal(yearStar.plate[4], yearStar.centerStar);
  assert.deepEqual([...yearStar.plate].sort(), NINE_STARS);
  assert.deepEqual(yearStar.plate, flyStars(yearStar.centerStar, '顺飞'));
  assert.match(yearStar.starName, /[一二三四五六七八九]/);
});

test('流月紫白按节气月入中后顺飞，十五日口径可复现', () => {
  const monthStar = resolveMonthFlyingStar(2024, 3);
  assert.equal(monthStar.plate[4], monthStar.centerStar);
  assert.deepEqual([...monthStar.plate].sort(), NINE_STARS);
  assert.equal(resolveMonthFlyingStar(2024, 3, 15).centerStar, monthStar.centerStar);
});

test('宅盘可叠加流年流月飞星，且不把建造年当成流年', () => {
  const natalOnly = generateXuanKong({ year: 2008, sitMountain: '子' });
  assert.equal(natalOnly.flowStars, undefined);
  assert.equal(natalOnly.palaces[0].yearStar, undefined);
  assert.match(natalOnly.prompt, /三盘九宫/);
  assert.doesNotMatch(natalOnly.prompt, /流年飞星/);

  const withFlow = generateXuanKong({
    year: 2008,
    sitMountain: '子',
    flowYear: 2024,
    flowMonth: 3,
  });
  assert.ok(withFlow.flowStars);
  assert.equal(withFlow.flowStars?.yearPlate.year, 2024);
  assert.equal(withFlow.period.year, 2008);
  assert.deepEqual(withFlow.plates.year, withFlow.flowStars?.yearPlate.plate);
  assert.deepEqual(withFlow.plates.month, withFlow.flowStars?.monthPlate?.plate);
  for (const palace of withFlow.palaces) {
    assert.equal(palace.yearStar, withFlow.plates.year?.[palace.gong - 1]);
    assert.equal(palace.monthStar, withFlow.plates.month?.[palace.gong - 1]);
    assert.ok(palace.shanXiangRelation);
    assert.ok(palace.yunStarState);
  }
  assert.match(withFlow.prompt, /流年飞星/);
  assert.match(withFlow.prompt, /流月飞星/);
});

test('九星当运与山向生克只记录结构，不打吉凶分', () => {
  assert.equal(resolveFlyingStarYunState(9, 9), '当运');
  assert.equal(resolveFlyingStarYunState(1, 9), '生气');
  assert.equal(resolveFlyingStarYunState(8, 9), '退气');
  assert.equal(resolveFlyingStarYunState(2, 8), '死气');
  assert.equal(resolveShanXiangRelation(1, 1), '比和');
  assert.equal(resolveShanXiangRelation(1, 2), '克入');
  assert.equal(resolveShanXiangRelation(3, 2), '克出');
});

test('三元年紫白按上元甲子一白逐年逆行一百八十年', () => {
  let expected = 1;
  for (let year = 1864; year < 2044; year++) {
    assert.equal(resolveYearFlyingStar(year).centerStar, expected, `${year}年`);
    expected = expected === 1 ? 9 : expected - 1;
  }
});

test('玄空年盘与月盘在立春前后使用同一节气年', () => {
  for (const item of [
    { month: 1, day: 15, year: 2025, star: 2 },
    { month: 2, day: 3, year: 2025, star: 2 },
    { month: 2, day: 5, year: 2026, star: 1 },
  ]) {
    const result = generateXuanKong({
      year: 2008,
      sitMountain: '子',
      flowYear: 2026,
      flowMonth: item.month,
      flowDay: item.day,
    });
    assert.equal(result.flowStars!.yearPlate.year, item.year);
    assert.equal(result.flowStars!.yearPlate.centerStar, item.star);
    assert.equal(result.flowStars!.monthPlate!.solarTermYear, item.year);
    assert.equal(result.flowStars!.monthPlate!.year, 2026);
    assert.equal(result.plates.year![4], item.star);
    assert.ok(result.prompt.includes(`流年飞星：${item.year}年`));
  }
});

test('月紫白按协纪辨方书十二年支三组表逐月逆行', () => {
  const firstMonthStars = [8, 5, 2, 8, 5, 2, 8, 5, 2, 8, 5, 2];
  for (let yearOffset = 0; yearOffset < 12; yearOffset++) {
    const year = 2020 + yearOffset;
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const civilMonth = ((monthIndex + 1) % 12) + 1;
      const civilYear = civilMonth === 1 ? year + 1 : year;
      const result = resolveMonthFlyingStar(civilYear, civilMonth, 15);
      const expected = ((firstMonthStars[yearOffset] - 1 - monthIndex + 18) % 9) + 1;
      assert.equal(result.centerStar, expected, `${year}年节气月序${monthIndex + 1}`);
      assert.equal(result.solarTermYear, year);
    }
  }
});

test('低年份与年份上界流月叠盘保留实际节气年', () => {
  for (const [year, expectedYear, star] of [
    [1, 0, 2],
    [99, 98, 3],
    [9999, 9998, 3],
  ]) {
    const result = generateXuanKong({
      year: 2008,
      sitMountain: '子',
      flowYear: year,
      flowMonth: 1,
      flowDay: 15,
    });
    assert.equal(result.flowStars!.yearPlate.year, expectedYear);
    assert.equal(result.flowStars!.yearPlate.centerStar, star);
    assert.equal(result.flowStars!.monthPlate!.solarTermYear, expectedYear);
    if (year === 1) assert.match(result.prompt, /流年飞星：公元前1年二黑入中/);
  }
});
