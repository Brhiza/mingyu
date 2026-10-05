import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateJinkoujue } from 'mingyu-core/divination/jinkoujue';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { calculateWuyunLiuqi } from 'mingyu-core/wuyun-liuqi';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import type { DivinationSession } from '../src/lib/divination/engine';
import type { DivinationData, QimenData } from '../src/types/divination';

const FIXED_DATE = new Date('2026-08-31T10:30:00+08:00');
const fixedQimenData = generateQimen(FIXED_DATE);
const fixedWuyun2026Data = calculateWuyunLiuqi({ year: 2026 });

function renderBoard(method: DivinationSession['method'], data: DivinationData) {
  const session: DivinationSession = {
    method,
    requestedMethod: method,
    question: '测试占问',
    prompt: '测试提示词',
    data,
  };
  return renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
}

test('主要占卜传统盘应能使用当前核心数据直接渲染', () => {
  const cases: Array<[DivinationSession['method'], DivinationData, RegExp]> = [
    ['liuyao', generateLiuyao(FIXED_DATE), /纳甲六爻/],
    ['meihua', generateMeihua(FIXED_DATE), /梅花易数/],
    ['xiaoliuren', generateXiaoliuren({ customDate: FIXED_DATE }), /小六壬/],
    ['jinkoujue', generateJinkoujue({ method: 'time', customDate: FIXED_DATE }), /金口诀/],
    ['qimen', structuredClone(fixedQimenData), /奇门九宫盘/],
    ['liuren', generateLiuren(FIXED_DATE), /大六壬/],
    ['tarot', drawTarotSpread('single'), /塔罗/],
    ['ssgw', drawRandomSign(FIXED_DATE), /签/],
    ['lenormand', drawLenormandSpread('single'), /雷诺曼/],
    ['wuyun', structuredClone(fixedWuyun2026Data), /五运六气年度盘/],
  ];

  for (const [method, data, expected] of cases) {
    assert.match(renderBoard(method, data), expected, `${method}传统盘渲染失败`);
  }
});

test('金口诀传统盘展示人元与将神之间的生克关系', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 5,
    customDate: new Date('2025-01-01T04:00:00+08:00'),
  });

  assert.equal(data.relations.renToJiang, '克');
  const html = renderBoard('jinkoujue', data);
  assert.match(html, /人→将 克/u);
  assert.match(html, /贵→地 克/u);

  const legacyData = structuredClone(data);
  delete legacyData.relations.renToJiang;
  assert.match(renderBoard('jinkoujue', legacyData), /人→将 克/u);
});

test('五运六气年度盘展示全年主客运气事实', () => {
  const html = renderBoard('wuyun', structuredClone(fixedWuyun2026Data));
  assert.match(html, /丙午/u);
  assert.match(html, /五步主客运/u);
  assert.match(html, /六步主客气/u);
  assert.match(html, /司天/u);
});

test('五运六气六步在交节当日展示准确时界', () => {
  const result = structuredClone(fixedWuyun2026Data);
  const first = result.qiSteps[0];
  const second = result.qiSteps[1];
  assert.equal(first.gregorianEnd, '2026-03-20');
  assert.equal(second.gregorianStart, '2026-03-20');
  assert.ok(first.boundaryTime && second.boundaryTime);
  assert.equal(first.boundaryTime.endTimestampExclusive, second.boundaryTime.startTimestamp);
  assert.ok(second.boundaryTime.startTimestamp > Date.parse('2026-03-20T00:00:00+08:00'));

  const html = renderBoard('wuyun', result);
  assert.ok(
    html.includes(
      `初之气 · 现代节气交节参考（北京时间）：${first.boundaryTime.startBeijing}起，至${second.boundaryTime.startBeijing}前`,
    ),
  );
  assert.ok(
    html.includes(
      `二之气 · 现代节气交节参考（北京时间）：${second.boundaryTime.startBeijing}起，至${second.boundaryTime.endBeijingExclusive}前`,
    ),
  );
  assert.doesNotMatch(html, /初之气 · 公历2026-01-20至2026-03-19/u);
  assert.match(html, /初运 · 公历2026-01-20至2026-04-01/u);

  const withoutCalendar = renderBoard('wuyun', calculateWuyunLiuqi({ yearGanZhi: '丙午' }));
  assert.match(withoutCalendar, /初之气 · 按传统节气分步/u);
});

test('缺少可选格局标签的旧奇门记录不显示空格局区', () => {
  const legacyData = structuredClone(fixedQimenData);
  delete (legacyData as Partial<QimenData>).patternTags;

  const html = renderBoard('qimen', legacyData);
  assert.match(html, /奇门九宫盘/);
  assert.doesNotMatch(html, /盘局特征/);
});
