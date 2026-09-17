import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabePeriodEventLayers,
  buildAstrolabePeriodEvents,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { getApparentPosition, unixToJulianDate } from '../packages/core/src/astrology/engine.ts';

const syntheticAstrolabe = generateAstrolabe({
  name: '合成样本',
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

test('朔望本命触碰保留结构化角距并由同一事实生成原文本', () => {
  const target = { year: 2028, month: 6, day: 15 };
  const baseline = buildAstrolabePeriodEvents(syntheticAstrolabe, 'monthly', target);
  const lunation = baseline.events.find((event) => event.kind === '朔望');
  assert.ok(lunation, '合成月份应至少有一个朔望事件');

  const moonLongitude = getApparentPosition('moon', lunation.julianDate).longitude;
  const aligned = {
    ...syntheticAstrolabe,
    planets: syntheticAstrolabe.planets.map((point) =>
      point.name === 'Sun' ? { ...point, longitude: moonLongitude } : point,
    ),
  };
  const collection = buildAstrolabePeriodEvents(aligned, 'monthly', target);
  const event = collection.events.find((item) => item.key === lunation.key);
  assert.ok(event, '对齐本命太阳后应保留同一朔望事件');
  assert.ok(event.lunationTouches);
  assert.ok(event.lunationTouches.length > 0);
  const sunTouch = event.lunationTouches.find(
    (touch) => touch.pointName === 'Sun' && touch.aspectName === '合相',
  );
  assert.ok(sunTouch, '对齐本命太阳后应记录合相触碰');
  assert.ok(sunTouch.deviation < 1e-6);

  const suffix = event.lunationTouches.map(
    (touch) => `${touch.aspectSymbol}本命${touch.pointLabel}`,
  );
  assert.equal(event.promptText, `${event.lunationName}${suffix.join('，')}`);
  for (const touch of event.lunationTouches) {
    const natalPoint = [...aligned.planets, ...aligned.angles].find(
      (point) => point.name === touch.pointName,
    );
    assert.ok(natalPoint, `应能找到触碰对应的本命点：${touch.pointName}`);
    const actualAngle = Math.abs(((moonLongitude - natalPoint.longitude + 540) % 360) - 180);
    const deviation = Math.abs(
      ((moonLongitude - natalPoint.longitude - touch.exactAngle + 540) % 360) - 180,
    );
    assert.equal(touch.pointLabel, natalPoint.label);
    assert.ok(Math.abs(touch.actualAngle - actualAngle) < 1e-10);
    assert.ok(Math.abs(touch.deviation - deviation) < 1e-10);
    assert.ok(Number.isFinite(touch.actualAngle));
    assert.ok(touch.actualAngle >= 0 && touch.actualAngle <= 180);
    assert.ok(Number.isFinite(touch.deviation));
    assert.ok(touch.deviation <= touch.allowedOrb);
    assert.ok([0, 90, 180].includes(touch.exactAngle));
    assert.ok(event.promptText.includes(`${touch.aspectSymbol}本命${touch.pointLabel}`));
  }
});

test('周期主轴暴露归组展开成员与单事件成员', () => {
  const groupedEvents = ['2028-03-12 08:10', '2028-07-12 08:11', '2028-11-12 08:12'].map(
    (dateTime, index) => ({
      key: `行运相位:Saturn:Sun:${index}`,
      kind: '行运相位' as const,
      julianDate: unixToJulianDate(Date.parse(`${dateTime.replace(' ', 'T')}+08:00`)),
      dateTime,
      promptText: '土星刑本命太阳',
      movingPoint: '土星',
      targetPoint: '本命太阳',
      aspectName: '刑相',
    }),
  );
  const singleEvent = {
    key: '交食:Sun:1',
    kind: '交食' as const,
    julianDate: unixToJulianDate(Date.parse('2028-12-12T14:00:00+08:00')),
    dateTime: '2028-12-12 14:00',
    promptText: '日全食',
    movingPoint: '太阳',
    targetPoint: '月亮',
    eclipseName: '日全食',
  };

  const events = [...groupedEvents, singleEvent].sort(
    (first, second) => first.julianDate - second.julianDate,
  );
  const layers = buildAstrolabePeriodEventLayers(
    events,
    '2028-01-01 00:00',
    '2029-01-01 00:00',
    'yearly',
  );
  assert.equal(layers.groups.length, 1);
  const group = layers.groups[0];
  const groupAxis = layers.axis.find((item) => item.key === group.key);
  assert.ok(groupAxis);
  assert.deepEqual(
    groupAxis.eventKeys,
    group.events.map((event) => event.key),
  );

  const singleAxis = layers.axis.find((item) => item.key === singleEvent.key);
  assert.ok(singleAxis);
  assert.deepEqual(singleAxis.eventKeys, [singleEvent.key]);
  assert.match(layers.promptText, /周期主轴：/);
  assert.match(layers.promptText, /完整明细：/);
});
