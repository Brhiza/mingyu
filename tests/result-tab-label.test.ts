import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResultPage.tsx', import.meta.url), 'utf8');

test('结果页顶部把 AI 页签文案改为提示词', () => {
  assert.match(
    source,
    /<button type="button" className=\{`tab-chip \$\{promptState\.tab === 'prompt' \? 'is-active' : ''\}`\} onClick=\{\(\) => switchTab\('prompt'\)\}>\s*提示词\s*<\/button>/,
  );
  assert.doesNotMatch(source, />\s*AI\s*<\/button>/);
});
