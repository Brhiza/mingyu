import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabePeriodEventLayers,
  buildAstrolabePeriodEvents,
  buildAstrolabeScopeContext,
  mergeAstrolabePeriodEvents,
  rankAstrolabeAspects,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { formatAstrolabeForPrompt, formatAstrolabeInfo } from 'mingyu-core/prompt';
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
    /周期关键星象（2028-01-01 00:00至2029-01-01 00:00，共\d+项）。/,
  );
  assert.match(collection.promptText, /周期主轴：/);
  assert.match(collection.promptText, /完整明细：/);
  assert.doesNotMatch(collection.promptText, /不得|时间边界|证据|不代表/);
  assert.ok(collection.axis.length > 0);
  assert.ok(
    collection.promptText.indexOf('周期主轴：') < collection.promptText.indexOf('完整明细：'),
  );

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

test('同一慢行星对本命点的多次过境应归组，并先列主轴再列完整明细', () => {
  const events = [12, 180, 300].map((day, index) => ({
    key: `行运相位:Saturn:Sun:${index}`,
    kind: '行运相位' as const,
    julianDate: 2461900 + day,
    dateTime: `2028-0${index + 3}-12 08:1${index}`,
    promptText: '土星刑本命太阳',
    movingPoint: '土星',
    targetPoint: '本命太阳',
    aspectName: '刑相',
  }));
  const eclipse = {
    key: '交食:Sun:1',
    kind: '交食' as const,
    julianDate: 2461912,
    dateTime: '2028-03-12 14:00',
    promptText: '日全食',
    movingPoint: '太阳',
    targetPoint: '月亮',
    eclipseName: '日全食',
  };
  const layers = buildAstrolabePeriodEventLayers(
    [...events, eclipse],
    '2028-01-01 00:00',
    '2029-01-01 00:00',
    'yearly',
  );

  assert.equal(layers.groups.length, 1);
  assert.match(layers.groups[0].promptText, /土星刑本命太阳 3次过境/);
  assert.match(layers.promptText, /周期主轴：/);
  assert.match(layers.promptText, /过境归组：土星刑本命太阳 3次过境/);
  assert.match(layers.promptText, /完整明细：/);
  assert.ok(layers.promptText.indexOf('周期主轴：') < layers.promptText.indexOf('完整明细：'));
  assert.match(layers.axis.map((item) => item.promptText).join('；'), /土星刑本命太阳|日全食/);
});

test('核心提示词与占问提示词应使用同一套本命相位主线和完整明细', () => {
  const natal = formatAstrolabeForPrompt(astrolabeData);
  const divination = formatAstrolabeInfo(astrolabeData);

  assert.match(natal, /相位主线：/);
  assert.match(divination, /相位主线：/);
  assert.equal(
    (natal.match(/相位明细：/g) ?? []).length,
    (divination.match(/相位明细：/g) ?? []).length,
  );
  assert.ok(astrolabeData.aspects.length > 6);
  for (const aspect of astrolabeData.aspects) {
    const line = `${aspect.body1}${aspect.symbol}${aspect.body2}`;
    assert.match(natal, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(divination, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('本命相位应按紧密等级与日月轴点排序，不得只取数组前几项', () => {
  const ranked = rankAstrolabeAspects([
    {
      body1: '谷神星',
      body2: '婚神星',
      type: '半六合',
      symbol: '⚺',
      orb: 0.2,
      closeness: '紧密',
      applying: null,
    },
    {
      body1: '太阳',
      body2: '土星',
      type: '刑相',
      symbol: '□',
      orb: 1.2,
      closeness: '紧密',
      applying: true,
    },
    {
      body1: '水星',
      body2: '木星',
      type: '六合',
      symbol: '⚹',
      orb: 5.8,
      closeness: '宽松',
      applying: false,
    },
  ]);

  assert.equal(ranked[0].body1, '太阳');
  assert.equal(ranked[0].body2, '土星');
  assert.equal(ranked.length, 3);
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
