import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import type { DivinationSession } from '../src/lib/divination/engine';

test('大六壬传统盘应完整渲染起课信息、课体与三传', () => {
  const data = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
  const session: DivinationSession = {
    method: 'liuren',
    requestedMethod: 'liuren',
    question: '这件事后续如何发展？',
    prompt: '',
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));

  assert.match(html, /起课基本信息/);
  assert.match(html, /这件事后续如何发展/);
  assert.match(html, /大六壬正时起课/);
  assert.match(html, /年柱/);
  assert.match(html, /月柱/);
  assert.match(html, /日柱/);
  assert.match(html, /时柱/);
  assert.match(html, /旬空/);
  assert.match(html, /课体/);
  assert.match(html, /三传/);
  assert.match(html, /初传/);
  assert.match(html, /中传/);
  assert.match(html, /末传/);
});
