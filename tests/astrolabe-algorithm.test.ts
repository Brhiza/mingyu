import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput } from 'mingyu-core/types';

const validInput: AstrolabeBirthInput = {
  name: '本人',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

test('星盘底层算法应拒绝无效出生日期和时间', () => {
  assert.throws(
    () => generateAstrolabe({ ...validInput, year: ' ' }),
    /星盘需要填写有效的出生年份/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, hour: ' ' }),
    /星盘需要填写有效的出生小时/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, year: '1899' }),
    /出生年份需在 1900-2100 之间/,
  );
  assert.throws(() => generateAstrolabe({ ...validInput, month: '13' }), /出生月份需在 1-12 之间/);
  assert.throws(
    () => generateAstrolabe({ ...validInput, day: '31', month: '2' }),
    /日期需在 1-28 之间/,
  );
  assert.throws(() => generateAstrolabe({ ...validInput, hour: '24' }), /出生小时需在 0-23 之间/);
  assert.throws(() => generateAstrolabe({ ...validInput, minute: '60' }), /出生分钟需在 0-59 之间/);
});

test('星盘底层算法应拒绝越界经纬度和时区', () => {
  assert.throws(
    () => generateAstrolabe({ ...validInput, latitude: '100' }),
    /出生地纬度需在 -90 到 90 之间/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, longitude: '181' }),
    /出生地经度需在 -180 到 180 之间/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, timezone: '15' }),
    /时区需在 -12 到 14 之间/,
  );
});
