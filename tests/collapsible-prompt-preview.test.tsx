import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapsiblePromptPreview } from '../src/components/CollapsiblePromptPreview';

test('完整提示词默认收起但仍保留可查看内容', () => {
  const html = renderToStaticMarkup(<CollapsiblePromptPreview promptText="这是一份完整提示词" />);

  assert.match(html, /<details class="prompt-preview-details">/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /查看提示词内容/);
  assert.match(html, /这是一份完整提示词/);
});

test('提示词尚未生成时显示整理状态和加载内容', () => {
  const html = renderToStaticMarkup(
    <CollapsiblePromptPreview promptText="" fallback={<span>加载中</span>} />,
  );

  assert.match(html, /正在整理提示词/);
  assert.match(html, /加载中/);
});
