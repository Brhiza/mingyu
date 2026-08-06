import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  buildZiweiChartInput,
  calculateZiweiDisplayPayload,
} from '../src/lib/full-chart-engine/ziwei';
import { ChartStar } from '../src/pages/ResultPage/components/ChartStar';
import { ZiweiTraditionalBoard } from '../src/pages/ResultPage/components/ZiweiTraditionalBoard';

test('紫微排盘入口应拒绝空白数字文本和不存在的出生日期', () => {
  assert.throws(
    () =>
      buildZiweiChartInput({
        name: '本人',
        gender: 'female',
        dateType: 'solar',
        year: ' ',
        month: '5',
        day: '20',
        timeIndex: 6,
        isLeapMonth: false,
      }),
    /出生年份必须是整数/,
  );

  assert.throws(
    () =>
      buildZiweiChartInput({
        name: '本人',
        gender: 'female',
        dateType: 'solar',
        year: '1995',
        month: '2',
        day: '31',
        timeIndex: 6,
        isLeapMonth: false,
      }),
    /日期需在 1-28 之间/,
  );

  assert.throws(
    () =>
      buildZiweiChartInput({
        name: '本人',
        gender: 'female',
        dateType: 'solar',
        year: '1995',
        month: '5',
        day: '20',
        timeIndex: ' ' as unknown as number,
        isLeapMonth: false,
      }),
    /出生时辰必须是整数/,
  );
});

test('紫微指定行运 payload 应输出补零后的公历日期', async () => {
  const input = buildZiweiChartInput({
    name: '本人',
    gender: 'female',
    dateType: 'solar',
    year: '1995',
    month: '5',
    day: '20',
    timeIndex: 6,
    isLeapMonth: false,
  });

  const payload = await calculateZiweiDisplayPayload({
    input,
    dateStr: '2101-02-28',
    hourIndex: 6,
    scope: 'daily',
  });

  assert.equal(payload.active_scope.solar_date, '2101-02-28');

  const html = renderToStaticMarkup(
    createElement(ZiweiTraditionalBoard, {
      payload,
      boardTitle: '传统盘',
      name: '测试命盘',
      selectedPalaceIndex: payload.palaces[0].index,
      onSelectPalace: () => undefined,
    }),
  );
  const otherStarNames = payload.palaces.flatMap((palace) =>
    palace.other_stars.map((star) => star.name),
  );

  assert.match(html, /四柱/);
  assert.match(html, /chart-star-brightness/);
  assert.match(html, /chart-cell-stars-other/);
  assert.match(html, /流年/);
  assert.match(html, /长生/);
  assert.match(html, /博士/);
  assert.match(html, /将前/);
  assert.ok(otherStarNames.length > 0);
  otherStarNames.forEach((name) => assert.ok(html.includes(name), `盘面应展示杂曜：${name}`));
});

test('紫微星曜应同时显示亮度与各层四化', () => {
  const html = renderToStaticMarkup(
    createElement(ChartStar, {
      tone: 'major',
      star: {
        name: '紫微',
        kind: 'major',
        brightness: '庙',
        birth_mutagen: '禄',
        horoscope_mutagen: '权',
        active_scope_mutagen: '科',
      },
    }),
  );

  assert.match(html, /亮度庙/);
  assert.match(html, /生年四化禄/);
  assert.match(html, /运限星曜四化权/);
  assert.match(html, /当前时限四化科/);
});
