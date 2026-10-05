import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAstrolabeFromInput,
  buildHoroscope,
  buildHoroscopeFromInput,
} from '../packages/core/src/ziwei/iztro/runtime-helpers';
import { calculateZiweiChart } from '../packages/core/src/ziwei/runtime';
import type { ChartInput } from '../packages/core/src/types/chart';

const baseInput: ChartInput = {
  name: '运限循环',
  dateType: 'solar',
  birthDate: '1904-01-20',
  birthTimeIndex: 0,
  gender: '男',
  ageDivide: 'normal',
};

test('紫微小限跨120岁继续十二宫循环，大限以起限年龄保持十年宫序', async () => {
  const astrolabe = await buildAstrolabeFromInput(baseInput);
  const palaceFacts = () =>
    astrolabe.palaces.map((palace) => ({
      index: palace.index,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      ages: [...palace.ages],
      decadal: { ...palace.decadal, range: [...palace.decadal.range] },
      stars: [...palace.majorStars, ...palace.minorStars].map((star) => star.name),
    }));
  const originalPalaces = palaceFacts();

  // 癸卯阴男逆行大限，金四局从丑宫4岁起：寅宫114–123岁，丑宫124–133岁。
  // 卯年小限1岁起丑，男顺行：119亥、120子、121丑、124辰。
  const cases = [
    ['2021-09-16', 119, 9, '亥', 0, '寅', '2021-9-16'],
    ['2022-09-16', 120, 10, '子', 0, '寅', '2022-9-16'],
    ['2023-09-16', 121, 11, '丑', 0, '寅', '2023-9-16'],
    ['2026-09-16', 124, 2, '辰', 11, '丑', '2026-9-16'],
  ] as const;
  for (const [date, age, smallIndex, smallBranch, bigIndex, bigBranch, displayDate] of cases) {
    const horoscope = buildHoroscope(astrolabe, date, 6);
    assert.equal(horoscope.solarDate, displayDate);
    assert.equal(horoscope.age.nominalAge, age);
    assert.equal(horoscope.age.index, smallIndex);
    assert.equal(horoscope.age.earthlyBranch, smallBranch);
    assert.equal(horoscope.agePalace()?.index, smallIndex);
    assert.equal(horoscope.decadal.index, bigIndex);
    assert.equal(horoscope.decadal.earthlyBranch, bigBranch);
    assert.equal(horoscope.palace('命宫', 'decadal')?.index, bigIndex);
  }
  assert.deepEqual(palaceFacts(), originalPalaces);

  const runtime = await calculateZiweiChart(baseInput, {
    horoscopeContext: { dateStr: '2026-09-16', hourIndex: 6 },
    scopes: ['origin', 'decadal', 'yearly', 'age'],
  });
  const small = runtime.payloadByScope.age.active_scope;
  const big = runtime.payloadByScope.decadal.active_scope;
  assert.equal(small.nominal_age, 124);
  assert.equal(small.solar_date, '2026-09-16');
  assert.equal(small.palace_index, 2);
  assert.equal(small.heavenly_stem, '丙');
  assert.equal(small.earthly_branch, '辰');
  assert.deepEqual(
    small.mutagen_map.map((item) => item.star),
    ['天同', '天机', '文昌', '廉贞'],
  );
  assert.equal(big.nominal_age, 124);
  assert.equal(big.solar_date, '2026-09-16');
  assert.equal(runtime.horoscope.solarDate, '2026-9-16');
  assert.equal(big.palace_index, 11);
  assert.equal(big.heavenly_stem, '乙');
  assert.equal(big.earthly_branch, '丑');
  assert.deepEqual(
    big.mutagen_map.map((item) => item.star),
    ['天机', '天梁', '紫微', '太阴'],
  );
  assert.equal(runtime.horoscope.yearly.heavenlyStem, '丙');
  assert.equal(runtime.horoscope.yearly.earthlyBranch, '午');
  assert.equal(runtime.horoscope.hourly.earthlyBranch, '午');
});

test('紫微高龄小限与大限仍按实际生日分界切换，普通年份模式保持真实虚岁', async () => {
  // 1904-01-20属癸卯农历年；2026八月尚未到十二月生日。
  // 普通虚岁124，生日口径123：分别为辰宫/卯宫小限、丑宫/寅宫大限。
  for (const [ageDivide, age, smallIndex, bigIndex] of [
    ['normal', 124, 2, 11],
    ['birthday', 123, 1, 0],
  ] as const) {
    const input = { ...baseInput, ageDivide };
    const astrolabe = await buildAstrolabeFromInput(input);
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-09-16', 6);
    assert.equal(horoscope.solarDate, '2026-9-16');
    assert.equal(horoscope.age.nominalAge, age);
    assert.equal(horoscope.age.index, smallIndex);
    assert.equal(horoscope.decadal.index, bigIndex);
    assert.equal(horoscope.yearly.heavenlyStem, '丙');
    assert.equal(horoscope.yearly.earthlyBranch, '午');
    assert.equal(horoscope.hourly.earthlyBranch, '午');
    assert.equal(buildHoroscope(astrolabe, '2026-09-16', 6).age.nominalAge, age);
  }
});

test('紫微1900年顺行大限与1930年常规年龄控制盘保持各自宫序和年龄口径', async () => {
  // 庚子阳男顺行，木三局午宫3–12岁起限，午宫123–132岁续限。
  // 子年小限1岁起戌，127岁为辰宫；己巳1930盘普通虚岁98、生日口径97。
  const cases = [
    ['1900-06-15', 'normal', 127, 2, '辰', 4, '午'],
    ['1930-01-20', 'normal', 98, 6, '申', 2, '辰'],
    ['1930-01-20', 'birthday', 97, 5, '未', 2, '辰'],
  ] as const;
  for (const [birthDate, ageDivide, age, smallIndex, smallBranch, bigIndex, bigBranch] of cases) {
    const input = { ...baseInput, birthDate, ageDivide };
    const astrolabe = await buildAstrolabeFromInput(input);
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-09-16', 6);
    assert.equal(horoscope.age.nominalAge, age);
    assert.equal(horoscope.age.index, smallIndex);
    assert.equal(horoscope.age.earthlyBranch, smallBranch);
    assert.equal(horoscope.decadal.index, bigIndex);
    assert.equal(horoscope.decadal.earthlyBranch, bigBranch);
    assert.equal(horoscope.solarDate, '2026-9-16');
  }
});
