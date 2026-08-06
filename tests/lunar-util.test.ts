import test from 'node:test';
import assert from 'node:assert/strict';
import { SixtyCycle, SolarTime } from 'tyme4ts';

import { LunarUtil, TimeManager } from '@core/calendar';

function expectedEightChar(year: number, month: number, day: number, hour: number, minute: number) {
  const eightChar = SolarTime.fromYmdHms(year, month, day, hour, minute, 0)
    .getLunarHour()
    .getEightChar();

  return {
    year: eightChar.getYear().getName(),
    month: eightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
    hour: eightChar.getHour().getName(),
  };
}

test('农历工具应拒绝无效时间对象', () => {
  const invalidDate = new Date(Number.NaN);

  assert.throws(() => LunarUtil.getTimeInfo(invalidDate), /时间不是有效日期/);
  assert.throws(() => LunarUtil.getGanZhi(invalidDate), /时间不是有效日期/);
  assert.throws(() => LunarUtil.getLunar(invalidDate), /时间不是有效日期/);
  assert.throws(() => LunarUtil.getGanZhi(null as unknown as Date), /时间不是有效日期/);
  assert.throws(() => LunarUtil.getLunar(null as unknown as Date), /时间不是有效日期/);
  assert.throws(
    () => TimeManager.getDivinationTime(null as unknown as Date),
    /自定义时间不是有效日期/,
  );
});

test('农历工具应拒绝越界年月参数', () => {
  assert.throws(() => LunarUtil.getGanZhiForMonth(1899, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => LunarUtil.getGanZhiForMonth(2101, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => LunarUtil.getGanZhiForMonth(2026, 0), /月份需在 1-12 之间/);
  assert.throws(() => LunarUtil.getGanZhiForMonth(2026, 13), /月份需在 1-12 之间/);
  assert.throws(() => LunarUtil.getGanZhiForYear(1899), /年份需在 1900-2100 之间/);
  assert.throws(() => LunarUtil.getGanZhiForYear(2101), /年份需在 1900-2100 之间/);
});

test('农历工具干支应与 tyme4ts EightChar 精确时刻一致', () => {
  const samples = [
    [2024, 2, 4, 16, 20], // 立春交节前，年柱月柱不应提前翻转
    [2024, 2, 4, 16, 30], // 立春交节后，年柱月柱应翻转
    [1998, 8, 13, 23, 30], // 晚子时，日柱按子初换日
  ] as const;

  samples.forEach(([year, month, day, hour, minute]) => {
    const date = new Date(year, month - 1, day, hour, minute, 0);
    const expected = expectedEightChar(year, month, day, hour, minute);

    assert.deepEqual(LunarUtil.getGanZhi(date), expected);
    assert.deepEqual(LunarUtil.getTimeInfo(date).ganzhi, expected);
    assert.deepEqual(LunarUtil.getTimeInfo(date).eightChar, expected);
    assert.deepEqual(
      {
        year: LunarUtil.getLunar(date).year,
        month: LunarUtil.getLunar(date).month,
        day: LunarUtil.getLunar(date).day,
        hour: LunarUtil.getLunar(date).hour,
      },
      expected,
    );
  });
});

test('农历工具显示文本不应保留 tyme4ts toString 的农历前缀，并应保留闰月', () => {
  const springFestival = LunarUtil.getLunar(new Date(2024, 1, 10, 12, 0, 0));
  assert.equal(springFestival.yearInChinese, '甲辰年');
  assert.equal(springFestival.monthInChinese, '正月');
  assert.equal(springFestival.dayInChinese, '初一');

  const leapMonth = LunarUtil.getLunar(new Date(2023, 2, 22, 12, 0, 0));
  assert.equal(leapMonth.yearInChinese, '癸卯年');
  assert.equal(leapMonth.monthInChinese, '闰二月');
  assert.equal(leapMonth.dayInChinese, '初一');
  assert.equal(leapMonth.monthNumber, 2);
});

test('农历工具公历年每月代表干支应统一取 EightChar 月柱', () => {
  const yearGanZhi = LunarUtil.getGanZhiForYear(2024);

  yearGanZhi.forEach(({ month, ganZhi }) => {
    const eightChar = SolarTime.fromYmdHms(2024, month, 15, 12, 0, 0).getLunarHour().getEightChar();

    assert.equal(ganZhi, eightChar.getMonth().getName());
  });
});

test('农历工具空亡地支应直接与 tyme4ts 六十甲子结果一致', () => {
  const samples = ['甲子', '丁丑', '癸巳', '庚辰', '癸亥'];

  samples.forEach((ganZhi) => {
    const expected = SixtyCycle.fromName(ganZhi)
      .getExtraEarthBranches()
      .map((branch) => branch.getName());

    assert.deepEqual(LunarUtil.getVoidBranches(ganZhi), expected);
  });

  assert.throws(() => LunarUtil.getVoidBranches('未知'), /无法识别日柱干支/);
});

test('农历工具六神起法应拒绝未知日干，不应默认青龙', () => {
  assert.deepEqual(LunarUtil.getSixAnimals('甲'), ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']);
  assert.throws(() => LunarUtil.getSixAnimals('A'), /无法识别日干/);
});

test('占卜时间管理干支应与 tyme4ts EightChar 精确时刻一致', () => {
  TimeManager.setTimezoneOffsetMinutesOverride(480);
  const samples = [
    [2024, 2, 4, 16, 20],
    [1998, 8, 13, 23, 30],
  ] as const;

  samples.forEach(([year, month, day, hour, minute]) => {
    const date = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0));
    const expected = expectedEightChar(year, month, day, hour, minute);
    const result = TimeManager.getDivinationTime(date);

    assert.deepEqual(result.ganzhi, expected);
    assert.deepEqual(result.timeInfo.ganzhi, expected);
    assert.deepEqual(result.timeInfo.eightChar, expected);
  });
});

test('占卜时间管理应拒绝非法时区偏移，不应静默退回运行环境时区', () => {
  assert.throws(
    () => TimeManager.setTimezoneOffsetMinutesOverride(Number.POSITIVE_INFINITY),
    /时区偏移分钟数需为 -720 到 840 之间的整数/,
  );
  assert.throws(
    () => TimeManager.setTimezoneOffsetMinutesOverride(841),
    /时区偏移分钟数需为 -720 到 840 之间的整数/,
  );
  assert.throws(
    () => TimeManager.setTimezoneOffsetMinutesOverride(480.5),
    /时区偏移分钟数需为 -720 到 840 之间的整数/,
  );
  TimeManager.setTimezoneOffsetMinutesOverride(480);
});
