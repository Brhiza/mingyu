import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
import { HuangjiReferenceTable } from '../src/components/DivinationPanel/HuangjiReferenceTable';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import type { DivinationSession } from '../src/lib/divination/engine';

test('皇极经世传统盘应完整展示卦序层级和值年互错综', () => {
  const data = calculateHuangjiJingshi({
    year: 2026,
    question: '这一年的整体时势主线是什么？',
  });
  const session: DivinationSession = {
    method: 'huangji',
    requestedMethod: 'huangji',
    question: '这一年的整体时势主线是什么？',
    prompt: data.prompt,
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /皇极经世盘/);
  assert.match(html, /会内统卦/);
  assert.match(html, /六十年统卦/);
  assert.match(html, /火风鼎/);
  assert.match(html, /天火同人/);
  assert.match(html, /互卦/);
  assert.match(html, /错卦/);
  assert.match(html, /综卦/);
});

test('皇极经世传统盘应展示年月日时四层卦象', () => {
  const data = calculateHuangjiJingshi({
    date: new Date('2025-12-25T12:30:00+08:00'),
    question: '此时应把握什么主线？',
  });
  const session: DivinationSession = {
    method: 'huangji',
    requestedMethod: 'huangji',
    question: '此时应把握什么主线？',
    prompt: data.prompt,
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /2025-12-25 12:30/);
  assert.match(html, /月经卦/);
  assert.match(html, /旬纬卦/);
  assert.match(html, /日卦/);
  assert.match(html, /时经卦/);
  assert.match(html, /雷山小过/);
  assert.match(html, /地山谦/);
});

test('皇极经世传统盘提供显式资料表入口而不自动绑定当前世序', () => {
  const data = calculateHuangjiJingshi({ year: -2367, question: '历史经辰对应的原表标记是什么？' });
  const session: DivinationSession = {
    method: 'huangji',
    requestedMethod: 'huangji',
    question: '历史经辰对应的原表标记是什么？',
    prompt: data.prompt,
    data,
  };

  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /皇极资料表/);
  assert.match(html, /声音律吕/);
  assert.doesNotMatch(html, /经辰历史纪年原表 · 第2156世/);
});

test('皇极资料表切换后通过核心查询完整展示对应底本字段', () => {
  const soundHtml = renderToStaticMarkup(createElement(HuangjiReferenceTable));
  assert.match(soundHtml, /声音律吕图/);
  assert.match(soundHtml, /天之体数.*160/u);
  assert.match(soundHtml, /动植物数/);
  assert.match(soundHtml, /shidianguji\.com/u);

  const historicalHtml = renderToStaticMarkup(
    createElement(HuangjiReferenceTable, {
      initialTable: 'historical-era',
      initialShiIndex: 2190,
    }),
  );
  assert.match(historicalHtml, /经辰历史纪年原表/);
  assert.match(historicalHtml, /2149—2208/);
  assert.match(historicalHtml, /商武丁/);
  assert.match(historicalHtml, /oldid=789512/u);
});

test('皇极资料表拒绝范围外经辰序号并保留输入范围提示', () => {
  const html = renderToStaticMarkup(
    createElement(HuangjiReferenceTable, {
      initialTable: 'historical-era',
      initialShiIndex: 2148,
    }),
  );
  assert.match(html, /2149—2208/);
  assert.doesNotMatch(html, /三十年甲子序列/);
});
