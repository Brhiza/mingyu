import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabePeriodEventLayers,
  buildAstrolabePeriodBatchResult,
  buildAstrolabePeriodContext,
  buildAstrolabePeriodEvents,
  buildAstrolabePeriodEventsFromContext,
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

test('流月相邻半开批次合并后与完整月份事件一致', () => {
  const complete = buildAstrolabePeriodEvents(astrolabeData, 'monthly', {
    year: 2028,
    month: 6,
    day: 15,
  });
  const first = buildAstrolabePeriodEvents(
    astrolabeData,
    'monthly',
    { year: 2028, month: 6, day: 15 },
    {
      batch: {
        start: { year: 2028, month: 6, day: 1 },
        endExclusive: { year: 2028, month: 6, day: 16 },
      },
    },
  );
  const second = buildAstrolabePeriodEvents(
    astrolabeData,
    'monthly',
    { year: 2028, month: 6, day: 15 },
    {
      batch: {
        start: { year: 2028, month: 6, day: 16 },
        endExclusive: { year: 2028, month: 7, day: 1 },
      },
    },
  );

  assert.deepEqual(first.batch?.range, {
    startDate: '2028-06-01',
    endDate: '2028-06-16',
    endExclusive: true,
  });
  assert.deepEqual(first.batch?.nextRange, {
    startDate: '2028-06-16',
    endDate: '2028-07-01',
    endExclusive: true,
  });
  assert.equal(second.batch?.nextRange, null);
  assert.deepEqual(mergeAstrolabePeriodEvents([first.events, second.events]), complete.events);
  assert.ok(
    first.events.every(
      (event) => event.dateTime >= '2028-06-01 00:00' && event.dateTime < '2028-06-16 00:00',
    ),
  );
  assert.ok(
    second.events.every(
      (event) => event.dateTime >= '2028-06-16 00:00' && event.dateTime < '2028-07-01 00:00',
    ),
  );
});

test('跨夏令时的流年七日批次按全局采样网格逐事件等价', () => {
  const newYorkData = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const target = { year: 2024, month: 7, day: 1 };
  const complete = buildAstrolabePeriodEvents(newYorkData, 'yearly', target).events;
  const context = buildAstrolabePeriodContext(newYorkData);
  const batches = [];
  const scopeStart = Date.UTC(2024, 0, 1);
  const scopeEnd = Date.UTC(2025, 0, 1);
  const day = 24 * 60 * 60 * 1000;

  for (let cursor = scopeStart; cursor < scopeEnd; cursor += 7 * day) {
    const end = Math.min(cursor + 7 * day, scopeEnd);
    const startDate = new Date(cursor);
    const endDate = new Date(end);
    batches.push(
      buildAstrolabePeriodEventsFromContext(context, 'yearly', target, {
        batch: {
          start: {
            year: startDate.getUTCFullYear(),
            month: startDate.getUTCMonth() + 1,
            day: startDate.getUTCDate(),
          },
          endExclusive: {
            year: endDate.getUTCFullYear(),
            month: endDate.getUTCMonth() + 1,
            day: endDate.getUTCDate(),
          },
        },
      }).events,
    );
  }

  assert.deepEqual(mergeAstrolabePeriodEvents(batches), complete);
});

test('流年周期批次拒绝越界窗口', () => {
  assert.throws(
    () =>
      buildAstrolabePeriodEvents(
        astrolabeData,
        'yearly',
        { year: 2028, month: 7, day: 1 },
        {
          batch: {
            start: { year: 2027, month: 12, day: 15 },
            endExclusive: { year: 2028, month: 1, day: 15 },
          },
        },
      ),
    /完整落在所选分析范围内/,
  );
});

test('紧凑本命周期上下文与完整星盘周期事件保持一致', () => {
  const context = buildAstrolabePeriodContext(astrolabeData);
  assert.ok(context.points.length >= 3);
  assert.equal(context.houseCusps.length, 12);
  const target = { year: 2028, month: 6, day: 15 };
  const batch = {
    start: { year: 2028, month: 6, day: 1 },
    endExclusive: { year: 2028, month: 6, day: 8 },
  };
  const fromData = buildAstrolabePeriodEvents(astrolabeData, 'monthly', target, { batch });
  const fromContext = buildAstrolabePeriodEventsFromContext(context, 'monthly', target, { batch });
  assert.deepEqual(fromContext.events, fromData.events);
  const result = buildAstrolabePeriodBatchResult(context, 'monthly', target, '2028-06', batch);
  assert.equal(result.kind, 'astrolabe-period-batch');
  assert.equal(result.target, '2028-06');
  assert.deepEqual(result.range, fromData.batch?.range);
  assert.deepEqual(result.events, fromData.events);
});

test('完整星盘入口保留缺失宫头兼容，紧凑上下文明确要求十二宫头', () => {
  const incompleteData = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((house) => ({ ...house, longitude: Number.NaN })),
  };

  assert.doesNotThrow(() =>
    buildAstrolabePeriodEvents(incompleteData, 'daily', {
      year: 2028,
      month: 6,
      day: 12,
    }),
  );
  assert.throws(() => buildAstrolabePeriodContext(incompleteData), /完整十二宫宫头/);
});

test('纽约夏令时流年批次的结果时区取父范围起点', () => {
  const newYorkData = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const result = buildAstrolabePeriodBatchResult(
    buildAstrolabePeriodContext(newYorkData),
    'yearly',
    { year: 2024, month: 7, day: 1 },
    '2024',
    {
      start: { year: 2024, month: 7, day: 1 },
      endExclusive: { year: 2024, month: 7, day: 8 },
    },
  );

  assert.equal(result.timeZoneId, 'America/New_York');
  assert.equal(result.timezone, -5);
  assert.deepEqual(result.parentRange, {
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    endExclusive: true,
  });
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
    const points = [...astrolabeData.planets, ...astrolabeData.angles];
    const first = points.find((point) => point.label === aspect.body1)!;
    const second = points.find((point) => point.label === aspect.body2)!;
    assert.ok(first);
    assert.ok(second);
    const line = `${aspect.body1}（${first.formatted}，第${first.house}宫）${aspect.symbol}${aspect.body2}（${second.formatted}，第${second.house}宫）`;
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
