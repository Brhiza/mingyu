import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { buildAstrolabeScopeContext } from 'mingyu-core/divination/astrolabe-scope';
import { AstrolabeBoard } from '../src/pages/ResultPage/components/AstrolabeBoard';

test('星盘流年总览直接展示太阳返照、次限推进和太阳弧', () => {
  const data = generateAstrolabe({
    name: '流年样本',
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
  const scope = buildAstrolabeScopeContext(data, 'yearly', '2028', {
    includePeriodEvents: false,
  });
  const html = renderToStaticMarkup(
    createElement(AstrolabeBoard, {
      title: '星盘总览',
      name: data.birth.name,
      data,
      advancedScopeContext: scope,
    }),
  );

  assert.match(html, /年度高级推运/u);
  assert.match(html, /太阳返照/u);
  assert.match(html, /返照时刻 2028-/u);
  assert.match(html, /次限推进/u);
  assert.match(html, /一岁一日/u);
  assert.match(html, /太阳弧/u);
  assert.match(html, /推进弧 \d+\.\d{2}°/u);
  assert.match(html, /太阳返照、次限推进与太阳弧与行运共同交叉验证/u);
});
