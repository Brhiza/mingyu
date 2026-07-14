import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { generateQizheng } from '@core/qi_zheng';
import { QizhengBoard } from '../src/pages/ResultPage/components/QizhengBoard';

test('七政四余盘应展示专业盘面且不输出原始数据和提示词', () => {
  const data = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  const html = renderToStaticMarkup(
    createElement(QizhengBoard, { title: '七政四余本命盘', name: '测试命盘', data }),
  );

  assert.match(html, /十二宫星盘/);
  assert.match(html, /主要吊照/);
  assert.match(html, /紫炁位置/);
  assert.match(html, /七政四余十二宫圆盘/);
  assert.match(html, /偏差\s*[\d.]+°/);
  assert.doesNotMatch(html, /强度|\d+%\s*·\s*容许/);
  assert.doesNotMatch(html, /<pre/);
  assert.doesNotMatch(html, /提示词正文/);
});
