import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AstrolabeScopeModal } from '../src/pages/ResultPage/components/AstrolabeScopeModal';

test('星盘年限弹窗应显示从地址恢复的远期年份选项', () => {
  const html = renderToStaticMarkup(
    createElement(AstrolabeScopeModal, {
      birthYear: '1995',
      selectedScope: 'yearly',
      selectedDateStr: '2101',
      onApply: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /fortune-modal-item[^>]*><strong>2101年<\/strong>/);
  assert.match(html, /流年/);
});
