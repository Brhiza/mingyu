import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResultPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

function getFirstRuleBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matched = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(matched, `未找到选择器 ${selector}`);
  return matched[1];
}

test('紫微页采用左侧传统盘、右侧摘要与年限选择的布局', () => {
  assert.match(
    source,
    /<div className="ziwei-layout">\s*<ZiweiTraditionalBoard[\s\S]*?<div className="ziwei-side-panel">[\s\S]*?<div className="ziwei-focus-card ziwei-summary-card">[\s\S]*?<h3>盘面摘要<\/h3>[\s\S]*?<ZiweiFortuneSelector/s,
  );
});

test('紫微传统盘桌面端不依赖内部横向滚动条', () => {
  const boardRule = getFirstRuleBlock('.ziwei-traditional-board');
  const gridRule = getFirstRuleBlock('.ziwei-traditional-grid');

  assert.match(boardRule, /overflow:\s*hidden;/);
  assert.doesNotMatch(boardRule, /overflow-x:\s*auto;/);
  assert.match(gridRule, /width:\s*100%;/);
  assert.match(gridRule, /min-width:\s*0;/);
  assert.match(gridRule, /aspect-ratio:\s*1\s*\/\s*1\.08;/);
});

test('紫微传统盘桌面端为备注和宫位内容预留安全空间，并使用更紧凑的宫格排版', () => {
  const boardRule = getFirstRuleBlock('.ziwei-traditional-board');
  const cellRule = getFirstRuleBlock('.ziwei-grid-cell');
  const cornerRule = getFirstRuleBlock('.ziwei-grid-cell-corner');
  const rightCornerRule = getFirstRuleBlock('.ziwei-grid-cell-corner-right');
  const bodyRule = getFirstRuleBlock('.chart-cell-body');
  const titleStackRule = getFirstRuleBlock('.chart-cell-title-stack');
  const titleRule = getFirstRuleBlock('.chart-cell-title');
  const flagRule = getFirstRuleBlock('.chart-cell-flag');
  const majorStarRule = getFirstRuleBlock('.chart-star-major .chart-star-name');

  assert.match(boardRule, /padding:\s*24px 10px 24px;/);
  assert.match(cellRule, /padding:\s*34px 6px 8px;/);
  assert.match(cornerRule, /white-space:\s*nowrap;/);
  assert.match(cornerRule, /border-radius:\s*999px;/);
  assert.match(cornerRule, /box-shadow:\s*0 1px 3px var\(--border-soft\);/);
  assert.match(cornerRule, /overflow:\s*hidden;/);
  assert.match(rightCornerRule, /justify-content:\s*flex-end;/);
  assert.match(bodyRule, /grid-template-columns:\s*12px minmax\(0, 1fr\) 22px;/);
  assert.match(titleStackRule, /width:\s*100%;/);
  assert.match(titleRule, /font-size:\s*0\.58rem;/);
  assert.match(titleRule, /letter-spacing:\s*0\.02em;/);
  assert.match(flagRule, /min-width:\s*9px;/);
  assert.match(flagRule, /height:\s*9px;/);
  assert.match(flagRule, /font-size:\s*0\.38rem;/);
  assert.match(majorStarRule, /font-size:\s*0\.64rem;/);
});
