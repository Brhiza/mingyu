import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromptShortcutPanel } from '../src/pages/ResultPage/components/PromptShortcutPanel';
import { singlePromptShortcutSections } from '../src/pages/ResultPage/ResultPage.constants';

const singleActions = [
  { label: '综合' },
  { label: '近期' },
  { label: '事业' },
  { label: '换工作' },
  { label: '创业合作' },
  { label: '投资合作' },
  { label: '财运' },
  { label: '婚恋' },
  { label: '关系推进' },
  { label: '关系去留' },
  { label: '复合判断' },
  { label: '子女' },
  { label: '六亲' },
  { label: '家庭' },
  { label: '搬家置业' },
  { label: '定居换城' },
  { label: '人际' },
  { label: '情绪' },
  { label: '健康' },
  { label: '学业' },
  { label: '考证进修' },
  { label: '考试上岸' },
  { label: '成长' },
  { label: '天赋' },
] as const;

test('自定义模式时应只展开自定义提问分组，其余分类保持收起', () => {
  const html = renderToStaticMarkup(
    <PromptShortcutPanel
      actions={singleActions}
      activeMode="自定义"
      onApplyMode={() => {}}
      showCustomAndInspiration
      customDraft="我想问一个自定义问题"
      onCustomDraftChange={() => {}}
      customPlaceholder="例如：我近期适合换工作还是稳住？"
      onOpenInspiration={() => {}}
      sections={singlePromptShortcutSections}
    />,
  );

  assert.match(html, /先看整体/);
  assert.match(html, /工作与财务/);
  assert.match(html, /关系与家庭/);
  assert.match(html, /生活与成长/);
  assert.match(html, /自定义提问/);
  assert.match(html, /自定义问题/);
  assert.match(html, /问题灵感/);
  assert.match(html, /直接输入问题/);
  assert.match(html, /textarea/);
});

test('普通快捷项模式时应只展开当前快捷项所属分组', () => {
  const html = renderToStaticMarkup(
    <PromptShortcutPanel
      actions={singleActions}
      activeMode="换工作"
      onApplyMode={() => {}}
      showCustomAndInspiration
      customDraft=""
      onCustomDraftChange={() => {}}
      customPlaceholder="例如：我近期适合换工作还是稳住？"
      onOpenInspiration={() => {}}
      sections={singlePromptShortcutSections}
    />,
  );

  assert.match(html, /工作与财务/);
  assert.match(html, /换工作/);
  assert.doesNotMatch(html, /直接输入问题/);
  assert.doesNotMatch(html, /关系推进/);
  assert.doesNotMatch(html, /搬家置业/);
});
