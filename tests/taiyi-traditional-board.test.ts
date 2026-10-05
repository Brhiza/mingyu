import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateTaiyi } from 'mingyu-core/taiyi';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import type { DivinationSession } from '../src/lib/divination/engine';

test('太乙盘应按十六神位与太乙八宫展示完整三算将参', () => {
  const data = generateTaiyi({ year: 2026 });
  const session: DivinationSession = {
    method: 'taiyi',
    requestedMethod: 'taiyi',
    question: '所问事项后续如何？',
    prompt: data.prompt,
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /太乙神数年计/);
  assert.match(html, /太乙十六神与八宫局式/);
  assert.match(html, /巽9宫/);
  assert.match(html, /离2宫/);
  assert.match(html, /坤7宫/);
  assert.match(html, /震4宫/);
  assert.match(html, /中五宫/);
  assert.match(html, /兑6宫/);
  assert.match(html, /艮3宫/);
  assert.match(html, /坎8宫/);
  assert.match(html, /乾1宫/);
  assert.match(html, /地主/);
  assert.match(html, /大义/);
  assert.match(html, /主大/);
  assert.match(html, /客参/);
  assert.match(html, /定参/);
  assert.match(html, /太乙主客定算将参/);
  assert.match(html, /文昌（主目）/);
  assert.match(html, /始击（客目）/);
  assert.match(html, /【典籍取象】下目属主，取中宫土德、四季旺相之象/);
  assert.match(html, /【典籍取象】上目属客，取南方火德、夏季旺相之象/);
  assert.doesNotMatch(html, /得位利于战略规划|破局立新|防突发危机|【决策指引】/);
  assert.doesNotMatch(html, />—</);
});
