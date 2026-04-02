import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

function getFirstRuleBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matched = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(matched, `未找到选择器 ${selector}`);
  return matched[1];
}

test('结果总览外层改为轻容器，避免八字和紫薇页面出现卡套卡堆叠', () => {
  const showcaseRule = getFirstRuleBlock('.result-showcase-card');

  assert.match(showcaseRule, /border:\s*none;/);
  assert.match(showcaseRule, /background:\s*transparent;/);
  assert.match(showcaseRule, /box-shadow:\s*none;/);
});

test('紫薇当前宫位详情改为分区块，而不是再包一层独立卡片', () => {
  const detailRule = getFirstRuleBlock('.ziwei-detail-card');

  assert.match(detailRule, /border-top:\s*1px solid var\(--border-soft\);/);
  assert.match(detailRule, /background:\s*transparent;/);
  assert.match(detailRule, /border:\s*none;/);
});
