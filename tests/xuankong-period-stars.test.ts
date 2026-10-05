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
  assert.match(monthStar.calendarNote, /15日中国标准时间12:00代表该流月/);
  assert.doesNotMatch(monthStar.calendarNote, /未指定日期|未提供具体时刻/);
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

test('九星旺衰按九运五气表完整轮转，合十不决定死气', () => {
  // 《玄空风水学》第三章列出一运与九运的九星气序。
  // https://www.guoxuemi.com/a/22540l/284961m.html
  const one = ['当运', '生气', '生气', '死气', '死气', '煞气', '煞气', '煞气', '退气'];
  const nine = ['生气', '生气', '死气', '死气', '煞气', '煞气', '煞气', '退气', '当运'];
  assert.deepEqual(
    one.map((_, i) => resolveFlyingStarYunState(i + 1, 1)),
    one,
  );
  assert.deepEqual(
    nine.map((_, i) => resolveFlyingStarYunState(i + 1, 9)),
    nine,
  );
  for (let yun = 1; yun <= 9; yun++) {
    const states = one.map((_, i) => resolveFlyingStarYunState(i + 1, yun));
    for (const [state, count] of Object.entries({ 当运: 1, 生气: 2, 死气: 2, 煞气: 3, 退气: 1 })) {
      assert.equal(states.filter((item) => item === state).length, count, `${yun}运${state}`);
    }
  }
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

test('交节当日按中国标准时间正午取月盘，标明交节前后所属月份不同', () => {
  const beforeXiaohan = resolveMonthFlyingStar(2026, 1, 5);
  assert.equal(beforeXiaohan.solarTermYear, 2025);
  assert.equal(beforeXiaohan.centerStar, 1);
  assert.match(beforeXiaohan.calendarNote, /12:00所属节气月（子月）/);
  assert.match(beforeXiaohan.calendarNote, /小寒于2026年1月5日 16:23:10交节/);
  assert.match(beforeXiaohan.calendarNote, /交节前后分属不同节气月/);
  assert.doesNotMatch(beforeXiaohan.calendarNote, /未指定日期|未提供具体时刻/);
  const beforeXiaohanPlate = generateXuanKong({
    year: 2024,
    sitMountain: '子',
    flowYear: 2026,
    flowMonth: 1,
    flowDay: 5,
  });
  assert.equal(beforeXiaohanPlate.flowStars?.yearPlate.year, 2025);
  assert.equal(beforeXiaohanPlate.flowStars?.yearPlate.centerStar, 2);
  assert.equal(beforeXiaohanPlate.flowStars?.monthPlate?.solarTermYear, 2025);

  const afterLichun = resolveMonthFlyingStar(2026, 2, 4);
  assert.equal(afterLichun.solarTermYear, 2026);
  assert.equal(afterLichun.centerStar, 8);
  assert.match(afterLichun.calendarNote, /立春于2026年2月4日 04:02:08交节/);

  const beforeJingzhe = generateXuanKong({
    year: 2024,
    sitMountain: '子',
    flowYear: 2026,
    flowMonth: 3,
    flowDay: 5,
  });
  assert.equal(beforeJingzhe.flowStars?.monthPlate?.centerStar, 8);
  assert.equal(beforeJingzhe.flowStars?.yearPlate.year, 2026);
  assert.equal(beforeJingzhe.plates.month?.[4], 8);
  assert.ok(
    beforeJingzhe.palaces.every(
      (palace) => palace.monthStar === beforeJingzhe.plates.month?.[palace.gong - 1],
    ),
  );
  assert.match(beforeJingzhe.prompt, /惊蛰于2026年3月5日 21:59:00交节/);
  assert.equal(resolveMonthFlyingStar(2026, 3, 6).centerStar, 7);
});

test('替卦未成四正局时证据范围仍列出实际叠加的流年流月盘', () => {
  const result = generateXuanKong({
    year: 2024,
    sitMountain: '子',
    guaType: '替卦',
    flowYear: 2026,
    flowMonth: 3,
    flowDay: 5,
  });
  assert.equal(result.formation, '替卦未成四正局');
  assert.match(result.evidenceAnalysis.limitationFacts[0].promptText, /三盘、流年流月飞星/);
  assert.deepEqual(result.plates.year, result.flowStars?.yearPlate.plate);
  assert.deepEqual(result.plates.month, result.flowStars?.monthPlate?.plate);
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
    if (year === 1) {
      assert.match(result.prompt, /流年飞星：公元前1年二黑入中/);
      assert.ok(
        result.evidenceAnalysis.facts.some(
          (fact) => fact.key === 'xuankong:fact:year-star' && fact.promptText.includes('公元前1年'),
        ),
        '证据流年飞星应与主提示词统一使用公元前纪年',
      );
    }
  }
});

test('流月年份两端跨节令时仍可排盘，不依赖越界的相邻干支月', () => {
  const beforeXiaohan = resolveMonthFlyingStar(1, 1, 1);
  assert.equal(beforeXiaohan.solarTermYear, 0);
  assert.equal(beforeXiaohan.centerStar, 1);
  assert.match(beforeXiaohan.calendarNote, /子月/);

  const lateYear = generateXuanKong({
    year: 2024,
    sitMountain: '子',
    flowYear: 9999,
    flowMonth: 12,
    flowDay: 31,
  });
  assert.equal(lateYear.flowStars?.monthPlate?.solarTermYear, 9999);
  assert.equal(lateYear.flowStars?.monthPlate?.centerStar, 1);
  assert.equal(lateYear.plates.month?.[4], 1);

  // 中段年份仍沿用历法库的节气月，不让两端修复改变历史年份排盘。
  const historical = resolveMonthFlyingStar(680, 2, 1);
  assert.equal(historical.solarTermYear, 679);
  assert.equal(historical.centerStar, 6);
});
