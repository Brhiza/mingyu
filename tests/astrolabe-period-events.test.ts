import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabePeriodEvents,
  buildAstrolabeScopeContext,
  mergeAstrolabePeriodEvents,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { getApparentPosition, unixToJulianDate } from '../packages/core/src/astrology/engine.ts';

const astrolabeData = generateAstrolabe({
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
});

test('流年应列出周期内动态点的精准相位、停逆、换座、朔望或交食', () => {
  const collection = buildAstrolabePeriodEvents(astrolabeData, 'yearly', {
    year: 2028,
    month: 7,
    day: 1,
  });

  assert.equal(collection.startDateTime, '2028-01-01 00:00');
  assert.equal(collection.endDateTime, '2029-01-01 00:00');
  assert.ok(collection.events.length >= 20);
  assert.deepEqual(
    collection.events.map((item) => item.julianDate),
    [...collection.events]
      .sort((first, second) => first.julianDate - second.julianDate)
      .map((item) => item.julianDate),
  );

  const kinds = new Set(collection.events.map((item) => item.kind));
  assert.ok(kinds.has('行运相位'));
  assert.ok(kinds.has('停逆') || kinds.has('换座') || kinds.has('换宫'));
  assert.ok(kinds.has('朔望') || kinds.has('交食'));
  assert.ok(
    collection.events.some(
      (item) => item.movingPoint === '北交点' || item.targetPoint?.includes('交点'),
    ),
  );
  assert.match(
    collection.promptText,
    /周期关键星象（2028-01-01 00:00至2029-01-01 00:00，共\d+项）：/,
  );
  assert.doesNotMatch(collection.promptText, /不得|时间边界|证据|不代表/);

  const firstTransit = collection.events.find((item) => item.kind === '行运相位');
  assert.ok(firstTransit);
  assert.match(firstTransit.dateTime, /^2028-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test('流月应补齐内行星天象，流日应补齐月亮动态点', () => {
  const monthly = buildAstrolabePeriodEvents(astrolabeData, 'monthly', {
    year: 2028,
    month: 6,
    day: 15,
  });
  const daily = buildAstrolabePeriodEvents(astrolabeData, 'daily', {
    year: 2028,
    month: 6,
    day: 12,
  });

  assert.ok(
    monthly.events.some((item) => ['太阳', '水星', '金星', '火星'].includes(item.movingPoint)),
  );
  assert.ok(
    daily.events.some(
      (item) =>
        item.movingPoint === '月亮' ||
        item.kind === '朔望' ||
        item.kind === '交食' ||
        item.kind === '行运相位',
    ),
  );
  assert.ok(
    daily.events.every(
      (item) => item.dateTime.startsWith('2028-06-12') || item.dateTime.startsWith('2028-06-13'),
    ),
  );
});

test('合并周期星象应按时刻去重排序', () => {
  const yearly = buildAstrolabePeriodEvents(astrolabeData, 'yearly', {
    year: 2028,
    month: 7,
    day: 1,
  });
  const monthly = buildAstrolabePeriodEvents(astrolabeData, 'monthly', {
    year: 2028,
    month: 6,
    day: 15,
  });
  const merged = mergeAstrolabePeriodEvents([yearly.events, monthly.events, yearly.events]);

  assert.ok(merged.length >= yearly.events.length);
  assert.equal(new Set(merged.map((item) => item.key)).size, merged.length);
  for (let index = 1; index < merged.length; index += 1) {
    assert.ok(merged[index].julianDate >= merged[index - 1].julianDate);
  }
});

test('星盘流年分析对象应写入周期关键星象资料', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');
  assert.ok((context.periodEvents?.events.length ?? 0) > 0);
  assert.match(context.promptText, /周期关键星象/);
  assert.doesNotMatch(context.promptText, /不得|时间边界|证据/);
});

test('行运精准相位时刻应落在目标黄经附近', () => {
  const collection = buildAstrolabePeriodEvents(astrolabeData, 'monthly', {
    year: 2028,
    month: 6,
    day: 15,
  });
  const transit = collection.events.find(
    (item) => item.kind === '行运相位' && item.movingPoint === '太阳' && item.aspectName === '合相',
  );
  if (!transit) {
    assert.ok(collection.events.some((item) => item.kind === '行运相位'));
    return;
  }

  const natalName = transit.targetPoint?.replace(/^本命/, '');
  const natal = [...astrolabeData.planets, ...astrolabeData.angles].find(
    (item) =>
      item.label === natalName ||
      (natalName === '太阳' && item.name === 'Sun') ||
      (natalName === '月亮' && item.name === 'Moon') ||
      (natalName === '上升' && item.name === 'Ascendant') ||
      (natalName === '天顶' && item.name === 'Midheaven'),
  );
  assert.ok(natal);
  const jd = unixToJulianDate(Date.parse(`${transit.dateTime.replace(' ', 'T')}+08:00`));
  const sun = getApparentPosition('sun', jd);
  const distance = Math.abs(((sun.longitude - natal.longitude + 540) % 360) - 180);
  assert.ok(distance < 0.2, `合相残差过大：${distance}`);
});
