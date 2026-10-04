import test from 'node:test';
import assert from 'node:assert/strict';

import { validateBirthInput } from '../src/lib/input-validation';
import { ShenShaCalculator } from '../packages/core/src/bazi/baziShenSha';
import { getBaziMonthPillarOptions } from '../packages/core/src/ganzhi/validation';

test('输入页出生日期校验应拒绝不存在的农历闰月和小月三十', () => {
  assert.deepEqual(
    validateBirthInput(
      {
        year: '2023',
        month: '2',
        day: '1',
        dateType: 'lunar',
        isLeapMonth: true,
      },
      '本人',
    ),
    { ok: true },
  );

  assert.deepEqual(
    validateBirthInput(
      {
        year: '2024',
        month: '2',
        day: '1',
        dateType: 'lunar',
        isLeapMonth: true,
      },
      '本人',
    ),
    {
      ok: false,
      field: 'day',
      message: '本人农历日期不存在，请检查月份、日期和闰月设置',
    },
  );

  assert.deepEqual(
    validateBirthInput(
      {
        year: '2024',
        month: '1',
        day: '30',
        dateType: 'lunar',
      },
      '本人',
    ),
    {
      ok: false,
      field: 'day',
      message: '本人农历日期不存在，请检查月份、日期和闰月设置',
    },
  );
});

test('神煞直算逐柱拒绝非六十甲子，仍接受各柱有效的流年叠盘', () => {
  const calculator = new ShenShaCalculator();
  const pillars: [string, string][] = [
    ['甲', '子'],
    ['丙', '寅'],
    ['庚', '午'],
    ['壬', '午'],
  ];

  for (const index of [0, 1, 2, 3]) {
    const invalid = pillars.map((pillar): [string, string] => [...pillar]);
    invalid[index] = ['甲', '丑'];
    assert.throws(
      () => calculator.calculateAllShenSha(invalid, 'male'),
      new RegExp(`第 ${index + 1} 柱不是有效六十甲子：甲丑`),
    );
  }

  const fortuneOverlay: [string, string][] = [['乙', '丑'], ...pillars.slice(1)];
  assert.equal(getBaziMonthPillarOptions('乙丑').includes('丙寅'), false);
  assert.doesNotThrow(() => calculator.calculateAllShenSha(fortuneOverlay, 'male'));
});
