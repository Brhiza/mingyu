import { createRandomContext, hasRandomOptions, randomInt } from '../../shared/random';
import type { RandomOptions, RandomTrace } from '../../shared/random';
import { assertOptionalRecord } from '../../shared/validation';

export interface YarrowChange {
  initial: number;
  left: number;
  right: number;
  hanging: 1;
  leftRemainder: number;
  rightRemainder: number;
  removed: number;
  remaining: number;
}

export interface YarrowLine {
  changes: YarrowChange[];
  value: 6 | 7 | 8 | 9;
}

export interface YarrowOptions extends RandomOptions {
  /** 十八变分堆记录，每项为挂一前左堆策数，按初爻至上爻排列。 */
  splits?: readonly number[];
}

export interface YarrowResult {
  lines: YarrowLine[];
  yaos: (6 | 7 | 8 | 9)[];
  samplingModel: '余数等概率，类内分堆等概率' | '手工分堆';
  randomTrace?: RandomTrace;
}

/** 《周易衍义》四十九策，分二挂一揲四归奇，三变一爻，十八变成卦。 */
export function generateYarrow(options: YarrowOptions = {}): YarrowResult {
  assertOptionalRecord(options, '蓍草起卦设置');
  const splits = options.splits;
  if (splits !== undefined && (!Array.isArray(splits) || splits.length !== 18)) {
    throw new Error('蓍草分堆记录必须恰好包含十八变。');
  }
  if (splits !== undefined && hasRandomOptions(options)) {
    throw new Error('手工分堆记录不能同时提供随机选项。');
  }
  const context = splits === undefined ? createRandomContext(options) : undefined;
  const lines: YarrowLine[] = [];
  for (let line = 0; line < 6; line++) {
    let remaining = 49;
    const changes: YarrowChange[] = [];
    for (let change = 0; change < 3; change++) {
      let left: number;
      if (splits !== undefined) {
        left = splits[line * 3 + change];
      } else {
        // 先等概率取四种余数，再在该余数的有效分堆中等概率取样。
        const remainder = randomInt(4, context!.random) + 1;
        const count = Math.floor((remaining - 2 - remainder) / 4) + 1;
        left = remainder + 4 * randomInt(count, context!.random);
      }
      if (!Number.isInteger(left) || left < 1 || left > remaining - 2) {
        throw new Error(`第${line + 1}爻第${change + 1}变左堆须为1至${remaining - 2}的整数。`);
      }
      const right = remaining - left;
      const leftRemainder = ((left - 1) % 4) + 1;
      const rightRemainder = ((right - 2) % 4) + 1;
      const removed = 1 + leftRemainder + rightRemainder;
      changes.push({
        initial: remaining,
        left,
        right,
        hanging: 1,
        leftRemainder,
        rightRemainder,
        removed,
        remaining: remaining - removed,
      });
      remaining -= removed;
    }
    lines.push({ changes, value: (remaining / 4) as 6 | 7 | 8 | 9 });
  }
  return {
    lines,
    yaos: lines.map((line) => line.value),
    samplingModel: splits === undefined ? '余数等概率，类内分堆等概率' : '手工分堆',
    ...(context ? { randomTrace: context.getTrace() } : {}),
  };
}
