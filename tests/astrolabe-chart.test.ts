import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AstrolabeChart } from '../src/components/AstrolabeChart';
import { AstrolabeBoard } from '../src/pages/ResultPage/components/AstrolabeBoard';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { buildAstrolabeScopeContext } from 'mingyu-core/divination/astrolabe-scope';

test('星盘图应显示福点标记与星座宫位摘要', () => {
  const data = generateAstrolabe({
    name: '星盘样本',
    gender: '女',
    year: '1990',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '31.2304',
    longitude: '121.4737',
    timezone: '8',
    locationName: '上海',
  });
  const fortunePoint = data.planets.find((planet) => planet.name === 'Part of Fortune');

  assert.ok(fortunePoint);

  const html = renderToStaticMarkup(createElement(AstrolabeChart, { data }));

  assert.match(html, /data-point-name="Part of Fortune"/);
  assert.match(html, /astrolabe-point-marker is-fortune/);
  assert.match(html, /role="group" aria-label="重要虚拟点"/);
  assert.match(html, new RegExp(`福点位于${fortunePoint.formatted}，第${fortunePoint.house}宫`));
  assert.match(html, new RegExp(`福点：${fortunePoint.formatted}，第${fortunePoint.house}宫`));
  assert.match(html, new RegExp(`${fortunePoint.formatted} · 第${fortunePoint.house}宫`));
});

test('缺少福点的历史数据仍应正常显示星盘图', () => {
  const data = generateAstrolabe({
    name: '历史星盘样本',
    gender: '女',
    year: '1990',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '31.2304',
    longitude: '121.4737',
    timezone: '8',
    locationName: '上海',
  });
  const dataWithoutFortune = {
    ...data,
    planets: data.planets.filter((planet) => planet.name !== 'Part of Fortune'),
  };

  const html = renderToStaticMarkup(createElement(AstrolabeChart, { data: dataWithoutFortune }));

  assert.match(html, /aria-label="星盘图"/);
  assert.doesNotMatch(html, /data-point-name="Part of Fortune"/);
  assert.doesNotMatch(html, /astrolabe-point-highlights/);
});

test('星盘总览应列出周期内动态点关键星象', () => {
  const data = generateAstrolabe({
    name: '星盘样本',
    gender: '女',
    year: '1990',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '31.2304',
    longitude: '121.4737',
    timezone: '8',
    locationName: '上海',
  });
  const context = buildAstrolabeScopeContext(data, 'monthly', '2028-06');
  const events = context.periodEvents?.events ?? [];
  assert.ok(events.length > 0);
  const html = renderToStaticMarkup(
    createElement(AstrolabeBoard, {
      title: '星盘总览',
      name: '星盘样本',
      data,
      periodRangeLabel: `${context.periodEvents?.startDateTime}至${context.periodEvents?.endDateTime}`,
      periodEvents: events,
    }),
  );

  assert.match(html, /周期关键星象/);
  assert.match(html, new RegExp(events[0].promptText));
  assert.match(html, new RegExp(events[0].dateTime));
  assert.match(html, /行运相位|天象相位|停逆|换座|换宫|朔望|交食/);
});
