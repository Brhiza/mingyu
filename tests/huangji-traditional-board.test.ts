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
  assert.match(html, /皇极经世值年盘/);
  assert.match(html, /会内统卦/);
  assert.match(html, /六十年统卦/);
  assert.match(html, /火风鼎/);
  assert.match(html, /天火同人/);
  assert.match(html, /互卦/);
  assert.match(html, /错卦/);
  assert.match(html, /综卦/);
});
