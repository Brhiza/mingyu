import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '@core/bazi/baziCalculator';
import type { Person } from '@core/bazi/baziTypes';

const birth: Person = { year: 2024, month: 6, day: 1, gender: 'male' };

test('八字计算器直接接收分钟钟表时优先采用钟表且生成完整时柱', () => {
  for (const timeIndex of [undefined, -1, 6]) {
    const result = baziCalculator.calculateBazi({
      ...birth,
      timeIndex,
      birthHour: 0,
      birthMinute: 5,
    });
    assert.equal(result.isThreePillars, false);
    assert.equal(result.timeInfo.index, 0);
    assert.equal(result.pillars.hour.ganZhi, '戊子');
  }
});

test('分钟钟表跨立春时同步切换年柱和月柱', () => {
  const common: Person = {
    year: 2024,
    month: 2,
    day: 4,
    gender: 'male',
    timeIndex: 6,
    birthHour: 16,
  };
  const before = baziCalculator.calculateBazi({ ...common, birthMinute: 26 });
  const after = baziCalculator.calculateBazi({ ...common, birthMinute: 28 });

  assert.deepEqual([before.pillars.year.ganZhi, before.pillars.month.ganZhi], ['癸卯', '乙丑']);
  assert.deepEqual([after.pillars.year.ganZhi, after.pillars.month.ganZhi], ['甲辰', '丙寅']);
  assert.equal(before.pillars.hour.ganZhi, '庚申');
  assert.equal(after.pillars.hour.ganZhi, '庚申');
});

test('分钟钟表保留历史夏令时跨日校正并拒绝不存在的当地时刻', () => {
  const input: Person = {
    year: 1988,
    month: 7,
    day: 15,
    gender: 'male',
    timeIndex: 6,
    birthHour: 0,
    birthMinute: 20,
    applyChinaDst: true,
  };
  const result = baziCalculator.calculateBazi(input);
  assert.equal(result.solarDate.day, 14);
  assert.equal(result.timeInfo.index, 12);
  assert.match(result.warnings.join('；'), /回拨 60 分钟/u);
  assert.deepEqual(
    result.pillars,
    baziCalculator.calculateBazi({ ...input, birthSecond: 0 }).pillars,
  );

  assert.throws(
    () =>
      baziCalculator.calculateBazi({
        ...birth,
        year: 2024,
        month: 3,
        day: 10,
        timeIndex: 6,
        birthHour: 2,
        birthMinute: 30,
        timeZoneId: 'America/New_York',
      }),
    /当地钟表时间.*不存在/u,
  );
});

test('直接钟表入口拒绝残缺和越界时间，分钟记录不能续取未知时辰候选', () => {
  for (const partial of [{ birthHour: 0 }, { birthMinute: 5 }, { birthSecond: 1 }]) {
    assert.throws(
      () => baziCalculator.calculateBazi({ ...birth, timeIndex: 6, ...partial }),
      /标准北京时间缺少精准小时或分钟/u,
    );
  }
  for (const clock of [
    { birthHour: 24, birthMinute: 5 },
    { birthHour: 0, birthMinute: 60 },
    { birthHour: 0.5, birthMinute: 5 },
  ]) {
    assert.throws(() => baziCalculator.calculateBazi({ ...birth, timeIndex: 6, ...clock }));
  }
  assert.throws(
    () =>
      baziCalculator.calculateBaziUnknownTimeBatch(
        { ...birth, isThreePillars: true, birthHour: 0, birthMinute: 5 },
        { startIndex: 0 },
      ),
    /已提供精确出生时刻/u,
  );
});
