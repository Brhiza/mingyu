import test from 'node:test';
import assert from 'node:assert/strict';
import { marked } from '../src/lib/marked-init';

test('AI Markdown 渲染会转义原始 HTML', () => {
  const html = marked.parse('<img src=x onerror=alert(1)>') as string;
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
});

test('AI Markdown 渲染会拦截危险链接协议', () => {
  const html = marked.parse('[点我](javascript:alert(1))') as string;
  assert.match(html, /点我/);
  assert.doesNotMatch(html, /href=/);
});
