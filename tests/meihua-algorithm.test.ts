import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('梅花：变卦应按初爻到上爻的传统爻位计算', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.originalName, '火地晋');
  assert.equal(data.movingYao.position, 2);
  assert.equal(data.changedName, '火水未济');
  assert.equal(data.changedHexagram?.upper, '离');
  assert.equal(data.changedHexagram?.lower, '坎');
  assert.equal(data.calculation.timeZhi, '辰');
  assert.equal(data.calculation.timeZhiIndex, 5);
  assert.equal(data.calculation.totalWithTime, 128);
});

test('梅花：互卦应取二三四爻为下互、三四五爻为上互', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.interName, '水山蹇');
  assert.equal(data.interHexagram?.upper, '坎');
  assert.equal(data.interHexagram?.lower, '艮');
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
      { position: 2, yaoType: '阴', isChanging: true, tiYong: '用' },
      { position: 3, yaoType: '阴', isChanging: false, tiYong: '用' },
      { position: 4, yaoType: '阳', isChanging: false, tiYong: '体' },
      { position: 5, yaoType: '阴', isChanging: false, tiYong: '体' },
      { position: 6, yaoType: '阳', isChanging: false, tiYong: '体' },
    ],
  );
});

test('梅花：用生体应期描述不应带多余标点', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 1 });

  assert.equal(data.analysis.tiYongRaw, '用生体');
  assert.ok(data.analysis.yingQi?.includes('用生体，事有助力，应期顺势'));
  assert.ok(data.analysis.yingQi?.every((item) => !item.includes('顺势）')));
});

test('梅花：timeTrigram 兼容入口应回到年月日时起卦', () => {
  const timeData = generateMeihua(SAMPLE_DATE, { method: 'time' });
  const compatData = generateMeihua(SAMPLE_DATE, { method: 'timeTrigram' });

  assert.equal(compatData.calculation.methodKey, 'timeTrigram');
  assert.deepEqual(
    [
      compatData.calculation.upperTrigramIndex,
      compatData.calculation.lowerTrigramIndex,
      compatData.calculation.movingYaoIndex,
    ],
    [
      timeData.calculation.upperTrigramIndex,
      timeData.calculation.lowerTrigramIndex,
      timeData.calculation.movingYaoIndex,
    ],
  );
  assert.match(String(compatData.calculation.compatibilityNote), /年月日时起卦法/);
});
