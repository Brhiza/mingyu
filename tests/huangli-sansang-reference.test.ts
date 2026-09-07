import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods, getHuangliShensha } from '../packages/core/src/shensha';

test('三丧覆盖春辰夏未秋戌冬丑的完整月日组合', () => {
  // 《时俗丧祭便览》卷一三丧诀及交节分季；秋季成字据地支读为戌。
  // https://www.shidianguji.com/zh/book/CADAL02030953/chapter/1l6ueatru9v6x
  const expected = [...'辰辰辰未未未戌戌戌丑丑丑'];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++)
      assert.equal(
        getHuangliDayGods(pillar(month + 2), pillar(day)).some((god) => god.getName() === '三丧'),
        branches[day % 12] === expected[month],
        `${month + 1}月/${pillar(day)}`,
      );
});

test('三丧日期按四立分季而非农历初一', () => {
  // 香港天文台2026年四立日期；2026-11-11己丑作为日支锚点。
  // https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
  const anchor = Date.UTC(2026, 10, 11);
  for (let offset = 0; offset < 365; offset++) {
    const date = new Date(Date.UTC(2026, 0, 1) + offset * 86400000);
    const iso = date.toISOString().slice(0, 10);
    const target =
      iso < '2026-02-04' || iso >= '2026-11-07'
        ? 1
        : iso < '2026-05-05'
          ? 4
          : iso < '2026-08-07'
            ? 7
            : 10;
    const branch = (((Math.round((date.getTime() - anchor) / 86400000) + 1) % 12) + 12) % 12;
    const info = getHuangliShensha(2026, date.getUTCMonth() + 1, date.getUTCDate());
    assert.equal(
      info.shensha.some((god) => god.name === '三丧'),
      branch === target,
      iso,
    );
  }
});
