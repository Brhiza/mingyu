import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('梅花：变卦应按初爻到上爻的传统爻位计算', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.originalName, '火山旅');
  assert.equal(data.movingYao.position, 3);
  assert.equal(data.changedName, '火地晋');
  assert.equal(data.changedHexagram?.upper, '离');
  assert.equal(data.changedHexagram?.lower, '坤');
});

test('梅花：互卦应取二三四爻为下互、三四五爻为上互', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.interName, '风泽中孚');
  assert.equal(data.interHexagram?.upper, '巽');
  assert.equal(data.interHexagram?.lower, '兑');
});

test('梅花：爻位详情应从初爻往上排列并准确标出动爻', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.deepEqual(
    data.yaosDetail.map((yao) => ({
      position: yao.position,
      yaoType: yao.yaoType,
      isChanging: yao.isChanging,
      tiYong: yao.tiYong,
    })),
    [
      { position: 1, yaoType: '阴', isChanging: false, tiYong: '用' },
      { position: 2, yaoType: '阴', isChanging: false, tiYong: '用' },
      { position: 3, yaoType: '阳', isChanging: true, tiYong: '用' },
      { position: 4, yaoType: '阳', isChanging: false, tiYong: '体' },
      { position: 5, yaoType: '阴', isChanging: false, tiYong: '体' },
      { position: 6, yaoType: '阳', isChanging: false, tiYong: '体' },
    ],
  );
});

test('梅花：用生体应期描述不应带多余标点', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 99 });

  assert.equal(data.analysis.tiYongRaw, '用生体');
  assert.ok(data.analysis.yingQi?.includes('用生体，事有助力，应期顺势'));
  assert.ok(data.analysis.yingQi?.every((item) => !item.includes('顺势）')));
});
