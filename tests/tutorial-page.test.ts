import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const inputPageSource = readFileSync(new URL('../src/pages/InputPage.tsx', import.meta.url), 'utf8');
const tutorialPageSource = readFileSync(new URL('../src/pages/TutorialPage.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('输入页底部提供教程入口，并跳转到独立教程页面', () => {
  assert.match(inputPageSource, /className="top-switch-control"/);
  assert.match(inputPageSource, /className="input-page-bottom-tools"/);
  assert.match(inputPageSource, /className="tutorial-entry-card"/);
  assert.match(inputPageSource, /第一次使用？先看教程/);
  assert.match(inputPageSource, /查看教程/);
  assert.match(inputPageSource, /className="tutorial-entry-button"/);
  assert.match(inputPageSource, /navigate\('\/tutorial'\)/);
  assert.match(appSource, /const TutorialPage = lazy\(async \(\) =>/);
  assert.match(appSource, /<Route path="\/tutorial" element=\{<TutorialPage \/>\} \/>/);
});

test('教程页使用独立路由和顶部返回栏，并说明项目的三种使用模式', () => {
  assert.match(tutorialPageSource, /className="tutorial-topbar-shell"/);
  assert.match(tutorialPageSource, /<PageTopbar title="使用教程" wide onBack=\{\(\) => navigate\('\/'\)\} \/>/);
  assert.match(tutorialPageSource, /填写信息，进入结果页，复制提示词，发送到在线 AI 软件继续提问。/);
  assert.match(tutorialPageSource, /title: '个人模式'/);
  assert.match(tutorialPageSource, /title: '合盘模式'/);
  assert.match(tutorialPageSource, /title: '占卜模式'/);
  assert.match(tutorialPageSource, /结果页默认打开“提示词”页/);
  assert.match(tutorialPageSource, /DeepSeek、千问、豆包等在线 AI 软件/);
  assert.match(tutorialPageSource, /专家模式、深度思考、深度推理/);
  assert.match(tutorialPageSource, /结果页也能一键复制提示词/);
  assert.doesNotMatch(tutorialPageSource, /聊天模型/);
});

test('教程入口与教程页补齐了桌面端和移动端样式', () => {
  assert.match(stylesSource, /\.top-switch-control \{[\s\S]*width: min\(320px, 100%\);[\s\S]*margin: 0 auto;/);
  assert.match(stylesSource, /\.input-page-bottom-tools \{[\s\S]*justify-content: center;[\s\S]*margin-top: 12px;/);
  assert.match(stylesSource, /\.tutorial-entry-card \{[\s\S]*justify-content: space-between;[\s\S]*border-radius: 16px;/);
  assert.match(stylesSource, /\.tutorial-entry-button \{[\s\S]*background: transparent;[\s\S]*border-radius: 999px;/);
  assert.match(stylesSource, /\.tutorial-topbar-shell \{[\s\S]*max-width: 1200px;[\s\S]*margin: 0 auto 12px;/);
  assert.match(stylesSource, /\.tutorial-page-section \{[\s\S]*display: grid;/);
  assert.match(stylesSource, /\.tutorial-intro-card \{[\s\S]*padding: 10px 12px;/);
  assert.match(stylesSource, /\.tutorial-mode-grid \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(stylesSource, /\.tutorial-faq-list \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[\s\S]*\.tutorial-topbar-shell \{[\s\S]*margin-bottom: 10px;/);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[\s\S]*\.tutorial-entry-card \{[\s\S]*flex-direction: column;/);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[\s\S]*\.tutorial-entry-copy p \{[\s\S]*font-size: 11px;/);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[\s\S]*\.tutorial-mode-grid \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(stylesSource, /@media \(max-width: 900px\) \{[\s\S]*\.tutorial-faq-list \{[\s\S]*grid-template-columns: 1fr;/);
});
