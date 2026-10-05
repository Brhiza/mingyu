import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBaziZiweiSynthesis,
  calculateBaziZiweiCombinedReading,
  type BaziZiweiCombinedReading,
  type BaziZiweiRangeReading,
} from '../packages/core/src/synthesis';
import type { BirthProfile } from '../packages/core/src/profile';
import type { BirthProfileTimeRange } from '../packages/core/src/profile/time-range';

const SECOND = 1_000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * SECOND;

function beijingTimestamp(value: string): number {
  const [dateText, timeText] = value.split(' ');
  const [year, month, day] = dateText!.split('-').map(Number);
  const [hour, minute, second] = timeText!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day, hour, minute, second) - CHINA_OFFSET_MS;
}

function asRangeReading(reading: BaziZiweiCombinedReading): BaziZiweiRangeReading {
  if (!reading.range) throw new Error('测试预期得到八字紫微合参范围结果。');
  return reading as BaziZiweiRangeReading;
}

function rangeFor(start: string, end: string): BirthProfileTimeRange {
  return {
    startTimestamp: beijingTimestamp(start),
    endTimestamp: beijingTimestamp(end),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const PROFILE: BirthProfile = {
  id: 'synthetic-1990-synthesis-range',
  name: '公开合成1990合参区间',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 6,
  day: 14,
  hour: 10,
  minute: 59,
  second: 59,
  timeIndex: 5,
  birthTimeRange: rangeFor('1990-06-14 10:59:59', '1990-06-14 11:00:01'),
  location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
};

const ZIWEI_OPTIONS = {
  scopes: ['origin', 'decadal', 'yearly'] as const,
  horoscopeContext: { dateStr: '2025-01-01', hourIndex: 6 },
};

test('合参范围固定上下文并逐秒对应单点事实，缺少岁限时保留资料缺口', async () => {
  await assert.rejects(
    () => calculateBaziZiweiCombinedReading(PROFILE, { rangeBatch: { limit: 1 } }),
    /必须显式提供/u,
  );

  const rangeReading = asRangeReading(
    await calculateBaziZiweiCombinedReading(PROFILE, {
      ziwei: ZIWEI_OPTIONS,
      rangeBatch: { limit: 2 },
    }),
  );

  assert.equal(rangeReading.synthesis, undefined);
  assert.equal(rangeReading.promptText, undefined);
  assert.deepEqual(
    rangeReading.bundle.range.samples.map((sample) => sample.bundle.profile.second),
    [59, 0],
  );
  assert.deepEqual(
    rangeReading.bundle.range.samples.map((sample) => sample.bundle.ziwei?.horoscopeContext),
    [ZIWEI_OPTIONS.horoscopeContext, ZIWEI_OPTIONS.horoscopeContext],
  );
  assert.deepEqual(
    rangeReading.range.samples.map((sample) => sample.index),
    [0, 1],
  );

  for (const sample of rangeReading.range.samples) {
    const point = await calculateBaziZiweiCombinedReading(
      rangeReading.bundle.range.samples.find((item) => item.index === sample.index)!.bundle.profile,
      { ziwei: ZIWEI_OPTIONS },
    );
    if (point.range) throw new Error('单点合参档案不应返回范围结果。');

    assert.deepEqual(sample.synthesis, point.synthesis);
    const candidateClock = sample.index === 0 ? '1990-06-14 10:59:59' : '1990-06-14 11:00:00';
    assert.equal(
      sample.promptText,
      [
        '【出生范围】',
        '公历标准北京时间：[1990-06-14 10:59:59, 1990-06-14 11:00:01)',
        '性别：男',
        `本份盘面对应候选出生时刻：${candidateClock}`,
        '',
        point.promptText,
      ].join('\n'),
    );
    assert.match(sample.promptText, sample.index === 0 ? /时柱辛巳/u : /时柱壬午/u);
    assert.doesNotMatch(point.promptText, /【出生范围】|本份盘面对应候选出生时刻/u);

    if (sample.index === 0) {
      assert.equal(point.synthesis.status, '资料完整');
      const { bazi, ziwei: runtime } = point.bundle;
      assert.ok(bazi);
      assert.ok(runtime);

      for (const missingScope of ['decadal', 'yearly'] as const) {
        const payloadByScope = { ...runtime.payloadByScope };
        delete (payloadByScope as Partial<typeof payloadByScope>)[missingScope];
        const synthesis = buildBaziZiweiSynthesis({
          bazi,
          ziwei: { ...runtime, payloadByScope },
        });

        assert.equal(synthesis.status, '资料有缺口');
        assert.ok(
          synthesis.missingFacts.includes(
            missingScope === 'decadal'
              ? '运限基准日期缺少对应紫微大限'
              : '运限基准年份缺少对应紫微流年',
          ),
        );
      }

      const originOnly = buildBaziZiweiSynthesis({
        bazi,
        ziwei: {
          ...runtime,
          payloadByScope: {
            origin: runtime.payloadByScope.origin,
          } as typeof runtime.payloadByScope,
        },
      });
      assert.ok(originOnly.missingFacts.includes('运限基准日期缺少对应紫微大限'));
      assert.ok(originOnly.missingFacts.includes('运限基准年份缺少对应紫微流年'));
      assert.ok(!originOnly.missingFacts.includes('大运与流年缺少紫微资料'));
    }
  }
});

test('同一公历年立春前后，合参流年事实与提示词按节令年切换', async () => {
  const { birthTimeRange: _birthTimeRange, ...pointProfile } = PROFILE;
  for (const [dateStr, expectedYear, excludedYear] of [
    ['2026-02-01', 2025, 2026],
    ['2026-02-10', 2026, 2025],
  ] as const) {
    const reading = await calculateBaziZiweiCombinedReading(pointProfile, {
      ziwei: {
        scopes: ['origin', 'decadal', 'yearly'],
        horoscopeContext: { dateStr, hourIndex: 6 },
      },
    });
    if (reading.range) throw new Error('测试预期得到单点合参结果。');
    const annual = reading.synthesis.themes
      .find((theme) => theme.id === 'timing')
      ?.baziEvidence.find((fact) => fact.title === '流年序列');

    assert.ok(annual);
    assert.match(annual.detail, new RegExp(`${expectedYear}年`));
    assert.doesNotMatch(annual.detail, new RegExp(`${excludedYear}年`));
    assert.match(reading.promptText, new RegExp(`流年序列：${expectedYear}年`));
    assert.doesNotMatch(reading.promptText, new RegExp(`流年序列：${excludedYear}年`));
    assert.ok(reading.bundle.bazi);
    assert.ok(reading.promptText.includes(reading.bundle.bazi.luckInfo.handoverInfo));
    assert.equal(reading.synthesis.status, '资料完整');
  }
});
