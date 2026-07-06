import test from 'node:test';
import assert from 'node:assert/strict';

import { validateBirthInput } from '../src/lib/input-validation';

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
