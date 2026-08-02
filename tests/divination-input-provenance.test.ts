import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { generateJinkoujue } from 'mingyu-core/divination/jinkoujue';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { drawRandomSign, resolveSignByNumber } from 'mingyu-core/divination/ssgw';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';

const DATE = new Date('2025-01-01T08:00:00+08:00');
const callQimen = generateQimen as unknown as (...args: unknown[]) => unknown;
const YAOS = [6, 7, 8, 9, 7, 8] as const;
const COIN_THROWS = [
  { coins: [2, 2, 2], total: 6 },
  { coins: [2, 2, 3], total: 7 },
  { coins: [2, 3, 3], total: 8 },
  { coins: [3, 3, 3], total: 9 },
  { coins: [2, 2, 3], total: 7 },
  { coins: [2, 3, 3], total: 8 },
] as const;

test('时间型占卜核心入口缺少明确时间时全部失败关闭', () => {
  const cases = [
    () => generateLiuyao(undefined, { method: 'time' }),
    () => generateMeihua(undefined, { method: 'time' }),
    () => callQimen(),
    () => generateLiuren(),
    () => generateJinkoujue({ method: 'time' }),
    () => generateXiaoliuren({ method: 'time' }),
    () => drawRandomSign(undefined as never),
    () => resolveSignByNumber(1, undefined as never),
  ];

  for (const run of cases) {
    assert.throws(run, /必须明确提供，核心层不会自动读取系统当前时间/);
  }
});

test('奇门核心入口缺少排盘法、层级或定局法时全部失败关闭', () => {
  assert.throws(() => callQimen(DATE), /排盘方法必须明确提供/);
  assert.throws(() => callQimen(DATE, 'zhuanpan'), /排盘级别必须明确提供/);
  assert.throws(() => callQimen(DATE, 'zhuanpan', 'hour'), /定局方法必须明确提供/);

  assert.throws(
    () => callQimen(DATE, 'zhuanpan', 'month', 'chaibu'),
    /月家奇门不接受定局方法.*yuejia/,
  );
  assert.throws(
    () => callQimen(DATE, 'zhuanpan', 'year', 'chaibu'),
    /年家奇门不接受定局方法.*nianjia/,
  );
});

test('存在多种起法的核心入口缺少明确方式时全部失败关闭', () => {
  assert.throws(() => generateLiuyao(DATE), /起卦方式必须明确提供/);
  assert.throws(() => generateLiuyao(DATE, { yaos: YAOS }), /起卦方式必须明确提供/);
  assert.throws(() => generateLiuyao(DATE, { coinThrows: COIN_THROWS }), /起卦方式必须明确提供/);
  assert.throws(() => generateMeihua(DATE), /起卦方式必须明确提供/);
  assert.throws(() => generateJinkoujue({ customDate: DATE }), /起课方式必须明确提供/);
  assert.throws(() => generateXiaoliuren({ customDate: DATE }), /起课方式必须明确提供/);
});

test('六爻三种起法与爻值、三钱记录的十二种组合均按声明方式校验', () => {
  const methods = ['time', 'manual', 'coins'] as const;
  for (const method of methods) {
    for (let fieldMask = 0; fieldMask < 4; fieldMask += 1) {
      const hasYaos = (fieldMask & 1) !== 0;
      const hasCoinThrows = (fieldMask & 2) !== 0;
      const shouldPass =
        (method === 'time' && !hasYaos && !hasCoinThrows) ||
        (method === 'manual' && hasYaos && !hasCoinThrows) ||
        (method === 'coins' && !hasYaos);
      const options = {
        method,
        ...(hasYaos ? { yaos: YAOS } : {}),
        ...(hasCoinThrows ? { coinThrows: COIN_THROWS } : {}),
        ...(method === 'coins' && !hasCoinThrows ? { seed: '六爻组合穷举' } : {}),
      };

      if (shouldPass) {
        assert.doesNotThrow(() => generateLiuyao(DATE, options));
      } else {
        assert.throws(() => generateLiuyao(DATE, options));
      }
    }
  }
});
