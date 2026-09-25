import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';
import { QizhengBoard } from '../src/pages/ResultPage/components/QizhengBoard';

test('七政盘面显示大限未核定状态而保留小限与太岁', () => {
  for (const flowYear of [2030, 2200]) {
    const data = generateQizheng({
      year: 2000,
      month: 6,
      day: 15,
      hour: 12,
      timezone: 8,
      gender: 'male',
      flowYear,
    });
    const html = renderToStaticMarkup(<QizhengBoard title="本命" name="七政测试" data={data} />);
    assert.match(html, /七政四余十二宫圆盘/);
    assert.match(html, /大限.*当前大限宫位未定/);
    assert.match(html, /小限/);
    assert.match(html, /太岁/);
    assert.doesNotMatch(html, /超出单周行限范围/);
  }
});
