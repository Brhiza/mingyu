import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEquationOfTimeMinutes } from '../packages/core/src/calendar/true-solar-time.ts';

/**
 * Meeus 均时差黄金集
 *
 * 参考值来自 Jean Meeus《Astronomical Algorithms》第28章
 * 均时差（Equation of Time）= 真太阳时 - 平太阳时（分钟）
 *
 * 四个特征点：
 *   - 2月11日左右：最小值约 -14.2 分钟
 *   - 5月14日左右：局部极大值约 +3.7 分钟
 *   - 7月26日左右：局部极小值约 -6.5 分钟
 *   - 11月3日左右：最大值约 +16.4 分钟
 *
 * 容差：±2 分钟（不同年份略有差异，且算法实现可能有近似）
 */

const EOT_TOLERANCE_MINUTES = 2.0;

interface MeeusGoldenCase {
  date: string;
  year: number;
  month: number;
  day: number;
  expectedEot: number;
  description: string;
}

const GOLDEN_CASES: MeeusGoldenCase[] = [
  {
    date: '2000-02-11',
    year: 2000,
    month: 2,
    day: 11,
    expectedEot: -14.2,
    description: '2月最小值（Meeus Ch.28）',
  },
  {
    date: '2000-05-14',
    year: 2000,
    month: 5,
    day: 14,
    expectedEot: 3.7,
    description: '5月局部极大值',
  },
  {
    date: '2000-07-26',
    year: 2000,
    month: 7,
    day: 26,
    expectedEot: -6.5,
    description: '7月局部极小值',
  },
  {
    date: '2000-11-03',
    year: 2000,
    month: 11,
    day: 3,
    expectedEot: 16.4,
    description: '11月最大值（Meeus Ch.28）',
  },
  // 二分二至点
  {
    date: '2000-03-20',
    year: 2000,
    month: 3,
    day: 20,
    expectedEot: -7.5,
    description: '春分点附近',
  },
  {
    date: '2000-06-21',
    year: 2000,
    month: 6,
    day: 21,
    expectedEot: -1.6,
    description: '夏至点附近',
  },
  {
    date: '2000-09-22',
    year: 2000,
    month: 9,
    day: 22,
    expectedEot: 7.8,
    description: '秋分点附近',
  },
  {
    date: '2000-12-21',
    year: 2000,
    month: 12,
    day: 21,
    expectedEot: 1.6,
    description: '冬至点附近',
  },
];

test('Meeus 均时差黄金集：8个特征日期', () => {
  let passed = 0;
  const failures: string[] = [];

  for (const c of GOLDEN_CASES) {
    const actual = calculateEquationOfTimeMinutes(c.year, c.month, c.day);
    const diff = Math.abs(actual - c.expectedEot);
    if (diff <= EOT_TOLERANCE_MINUTES) {
      passed++;
    } else {
      failures.push(
        `${c.date} (${c.description}): expected=${c.expectedEot.toFixed(2)}, actual=${actual.toFixed(2)}, diff=${diff.toFixed(2)}min`,
      );
    }
  }

  assert.equal(
    failures.length,
    0,
    `Meeus 黄金集 ${passed}/${GOLDEN_CASES.length} 通过，失败:\n${failures.join('\n')}`,
  );
});

test('均时差范围：全年值应在 [-20, +20] 分钟内', () => {
  let min = Infinity;
  let max = -Infinity;
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 28; day++) {
      const eot = calculateEquationOfTimeMinutes(2000, month, day);
      min = Math.min(min, eot);
      max = Math.max(max, eot);
    }
  }
  assert.ok(min >= -20, `最小值 ${min.toFixed(2)} 超出下限 -20`);
  assert.ok(max <= 20, `最大值 ${max.toFixed(2)} 超出上限 +20`);
  assert.ok(min < -10, `最小值 ${min.toFixed(2)} 应小于 -10（2月谷值）`);
  assert.ok(max > 10, `最大值 ${max.toFixed(2)} 应大于 +10（11月峰值）`);
});

test('均时差连续性：相邻日差值不超过 1 分钟', () => {
  let prev = calculateEquationOfTimeMinutes(2000, 1, 1);
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = month === 2 ? 28 : [4, 6, 9, 11].includes(month) ? 30 : 31;
    for (let day = 2; day <= daysInMonth; day++) {
      const curr = calculateEquationOfTimeMinutes(2000, month, day);
      const diff = Math.abs(curr - prev);
      assert.ok(diff <= 1.0, `${month}/${day}: 相邻日差值 ${diff.toFixed(2)}min > 1min`);
      prev = curr;
    }
  }
});
