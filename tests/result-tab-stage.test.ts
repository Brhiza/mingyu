import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResultPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('结果页使用统一舞台承载八字、紫薇和 AI 三个面板，避免切换时高度抖动', () => {
  assert.match(source, /<div className="result-tab-stage">/);
  assert.match(source, /className=\{`result-tab-pane \$\{promptState\.tab === 'bazi' \? 'is-active' : 'is-inactive'\}`\}/);
  assert.match(source, /className=\{`result-tab-pane \$\{promptState\.tab === 'ziwei' \? 'is-active' : 'is-inactive'\}`\}/);
  assert.match(source, /className=\{`result-tab-pane \$\{promptState\.tab === 'prompt' \? 'is-active' : 'is-inactive'\}`\}/);
});

test('结果页舞台样式会把三个面板叠放到同一区域，仅切换可见性', () => {
  assert.match(css, /\.result-tab-stage\s*\{[\s\S]*display:\s*grid;[\s\S]*\}/);
  assert.match(css, /\.result-tab-pane\s*\{[\s\S]*grid-area:\s*1\s*\/\s*1;[\s\S]*\}/);
  assert.match(css, /\.result-tab-pane\.is-inactive\s*\{[\s\S]*visibility:\s*hidden;[\s\S]*pointer-events:\s*none;[\s\S]*\}/);
});
