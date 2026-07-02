import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { generateXiaoliuren } from '../packages/core/src/divination/algorithms/xiaoliuren.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('小六壬：空亡宫五行应为土，类型与算法数据保持一致', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.process.name, '空亡');
  assert.equal(data.sequence.process.element, '土');
});

test('小六壬：留连宫应按四季土口径，不应误作木', () => {
  const data = generateXiaoliuren({ method: 'number', number: 2, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.start.name, '留连');
  assert.equal(data.sequence.start.element, '土');
  assert.equal(data.sequence.start.shenSha, '螣蛇');
  assert.equal(data.sequence.start.direction, '四角');
  assert.match(data.sequence.start.seasonProsper || '', /辰戌丑未月/);
});

test('小六壬：五行说明应按真实生克方向描述，不应反写得生与所生', () => {
  const data = generateXiaoliuren({ method: 'number', number: 4, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.start.name, '赤口');
  assert.equal(data.sequence.start.element, '金');
  assert.equal(data.sequence.process.name, '小吉');
  assert.equal(data.sequence.process.element, '水');
  assert.equal(data.wuxingRelations.startToProcess, '所生');
  assert.match(data.wuxingRelations.description, /起因生过程/);
  assert.doesNotMatch(data.wuxingRelations.description, /起因被过程泄气/);
});

test('小六壬：过程生结果时应输出越做越顺，不应写成过程被结果泄气', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });

  assert.equal(data.sequence.process.name, '空亡');
  assert.equal(data.sequence.process.element, '土');
  assert.equal(data.sequence.result.name, '赤口');
  assert.equal(data.sequence.result.element, '金');
  assert.equal(data.wuxingRelations.processToResult, '所生');
  assert.match(data.wuxingRelations.description, /过程生结果/);
  assert.doesNotMatch(data.wuxingRelations.description, /过程被结果泄气/);
});
