import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { calculateBazhaiChart } from '../src/lib/bazhai-chart';
import { MetaphysicsPanel } from '../src/components/MetaphysicsPanel';

test('八宅统一按从大门面向屋内的读数换算传统坐向', () => {
  const { result, measurement } = calculateBazhaiChart(
    { year: 1990, month: 6, day: 15, gender: 'male' },
    0,
  );

  assert.equal(measurement.measuredDegree, 0);
  assert.equal(measurement.sitDegree, 0);
  assert.equal(measurement.sitMountain, '子');
  assert.equal(measurement.facingDegree, 180);
  assert.equal(measurement.facingMountain, '午');
  assert.equal(result.houseGua, '坎');
  assert.match(measurement.promptText, /站在大门处面向屋内/);
});

test('八宅页面无需开始排盘即可显示个人盘并在盘面说明下补充角度', () => {
  const html = renderToStaticMarkup(
    createElement(MetaphysicsPanel, {
      method: 'bazhai',
      birthData: {
        year: 1990,
        month: 6,
        day: 15,
        hour: 10,
        minute: 30,
        gender: 'male',
      },
    }),
  );

  assert.match(html, /个人八宅方位/);
  assert.match(html, /盘面说明/);
  assert.match(html, /补充住宅角度/);
  assert.match(html, /从大门面向屋内的度数/);
  assert.doesNotMatch(html, /开始排盘/);
  assert.doesNotMatch(html, /<pre/);
});
