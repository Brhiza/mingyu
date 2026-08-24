import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import type { DivinationSession } from '../src/lib/divination/engine';

test('皇极经世传统盘应完整展示卦序层级和值年互错综', () => {
  const data = calculateHuangjiJingshi({
    year: 2026,
    question: '这一年的整体时势主线是什么？',
  });
  const session: DivinationSession = {
    method: 'huangji',
    requestedMethod: 'huangji',
    question: '这一年的整体时势主线是什么？',
    prompt: data.prompt,
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /皇极经世盘/);
  assert.match(html, /会内统卦/);
  assert.match(html, /六十年统卦/);
  assert.match(html, /火风鼎/);
  assert.match(html, /天火同人/);
  assert.match(html, /互卦/);
  assert.match(html, /错卦/);
  assert.match(html, /综卦/);
});

test('皇极经世传统盘应展示年月日时四层卦象', () => {
  const data = calculateHuangjiJingshi({
    date: new Date('2025-12-25T12:30:00+08:00'),
    question: '此时应把握什么主线？',
  });
  const session: DivinationSession = {
    method: 'huangji',
    requestedMethod: 'huangji',
    question: '此时应把握什么主线？',
    prompt: data.prompt,
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /2025-12-25 12:30/);
  assert.match(html, /月经卦/);
  assert.match(html, /旬纬卦/);
  assert.match(html, /日卦/);
  assert.match(html, /时经卦/);
  assert.match(html, /雷山小过/);
  assert.match(html, /地山谦/);
});
