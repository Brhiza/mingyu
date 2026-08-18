import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AstrolabeChart } from '../src/components/AstrolabeChart';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';

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
