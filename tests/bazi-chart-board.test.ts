import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { BaziChartBoard } from '../src/pages/ResultPage/components/BaziChartBoard';

test('八字结果盘应展示排盘预警和稳定基础参考', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 12,
    birthMinute: 0,
    birthLongitude: 116.4,
    birthPlace: '北京',
  });

  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '测试命盘',
      result,
    }),
  );

  assert.match(html, /排盘预警/);
  assert.match(html, /夏令时/);
  assert.match(html, /基础参考/);
  assert.match(html, /命卦/);
  assert.match(html, /命宫/);
  assert.match(html, /身宫/);
});
