import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromptPreview } from '../src/components/PromptPreview';

test('完整提示词默认收起但仍保留可查看内容', () => {
  const html = renderToStaticMarkup(<PromptPreview promptText="这是一份完整提示词" />);

  assert.match(html, /<details class="workspace-prompt-preview">/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /查看完整提问内容/);
  assert.match(html, /这是一份完整提示词/);
});

test('提示词尚未生成时显示整理状态和加载内容', () => {
  const html = renderToStaticMarkup(<PromptPreview promptText="" fallback={<span>加载中</span>} />);

  assert.match(html, /正在整理提问内容/);
  assert.match(html, /加载中/);
});
