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
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import type { DivinationSession } from '../src/lib/divination/engine';
import type { DivinationData, QimenData } from '../src/types/divination';

const FIXED_DATE = new Date('2026-08-31T10:30:00+08:00');

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
    ['qimen', generateQimen(FIXED_DATE), /奇门九宫盘/],
    ['liuren', generateLiuren(FIXED_DATE), /大六壬/],
    ['tarot', drawTarotSpread('single'), /塔罗/],
    ['ssgw', drawRandomSign(FIXED_DATE), /签/],
    ['lenormand', drawLenormandSpread('single'), /雷诺曼/],
  ];

  for (const [method, data, expected] of cases) {
    assert.match(renderBoard(method, data), expected, `${method}传统盘渲染失败`);
  }
});

test('缺少可选格局标签的旧奇门记录仍应正常渲染', () => {
  const legacyData = { ...generateQimen(FIXED_DATE) };
  delete (legacyData as Partial<QimenData>).patternTags;

  const html = renderBoard('qimen', legacyData);
  assert.match(html, /奇门九宫盘/);
  assert.match(html, /盘局特征/);
});
