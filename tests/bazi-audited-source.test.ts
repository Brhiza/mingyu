import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBaziCompatibility,
  analyzeBaziNatalEvidence,
  buildFortuneSelectionContext,
  formatBaziForPrompt,
  normalizeBaziFortuneSelectionInput,
} from '../packages/core/src/bazi/audited';
import { baziCalculator, rebuildAuditedBaziData } from '../packages/core/src/bazi/baziCalculator';
import type { BaziChartResult, Person } from '../packages/core/src/bazi/baziTypes';

const PERSON: Person = {
  year: 1995,
  month: 8,
  day: 15,
  timeIndex: 8,
  gender: 'female',
  isLunar: false,
  isLeapMonth: false,
  useTrueSolarTime: false,
};

function createChart(person: Person = PERSON) {
  return baziCalculator.calculateBazi(person);
}

test('八字结果应保存完整规范化出生来源并可等价重建', () => {
  const variants: NonNullable<Person['shenShaVariants']> = {
    kongWangBasis: 'day-and-year',
  };
  const result = createChart({ ...PERSON, shenShaVariants: variants });

  assert.deepEqual(result.generation.input, {
    ...PERSON,
    applyChinaDst: true,
    shenShaVariants: {
      kongWangBasis: 'day-and-year',
      yangRenMode: 'yang-stems-only',
    },
  });
  assert.ok(Number.isSafeInteger(result.generation.timestamp));
  assert.ok(result.generation.timestamp >= 0);
  assert.deepEqual(rebuildAuditedBaziData(result), result);

  variants.kongWangBasis = 'day';
  assert.equal(result.generation.input.shenShaVariants?.kongWangBasis, 'day-and-year');
});

test('八字审核重建与公开提示词应忽略全部旧派生字段污染', () => {
  const result = createChart();
  const polluted = structuredClone(result);
  polluted.pillars.day = { gan: '甲', zhi: '子', ganZhi: '甲子' };
  polluted.dayMaster = { gan: '甲', element: '木', yinYang: '阳' };
  polluted.analysis.mingGe.pattern = '旧缓存伪造格局';
  polluted.shensha.day = ['旧缓存伪造神煞'];
  polluted.luckInfo.cycles[0]!.ganZhi = '甲子';
  polluted.evidenceAnalysis!.promptText = '旧缓存伪造证据';

  assert.deepEqual(rebuildAuditedBaziData(polluted), result);
  assert.deepEqual(analyzeBaziNatalEvidence(polluted), result.evidenceAnalysis);
  assert.equal(formatBaziForPrompt(polluted), formatBaziForPrompt(result));
  assert.doesNotMatch(formatBaziForPrompt(polluted), /旧缓存伪造/);
});

test('八字合盘与岁运上下文应只消费双方可信出生来源', () => {
  const chart1 = createChart();
  const chart2 = createChart({
    ...PERSON,
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
  });
  const polluted1 = structuredClone(chart1);
  const polluted2 = structuredClone(chart2);
  polluted1.pillars.year = { gan: '甲', zhi: '子', ganZhi: '甲子' };
  polluted2.pillars.day = { gan: '己', zhi: '丑', ganZhi: '己丑' };
  polluted1.luckInfo.cycles[1]!.ganZhi = '甲子';

  assert.deepEqual(
    analyzeBaziCompatibility(polluted1, polluted2),
    analyzeBaziCompatibility(chart1, chart2),
  );
  assert.deepEqual(
    buildFortuneSelectionContext(polluted1, { scope: 'dayun', cycleIndex: 1 }),
    buildFortuneSelectionContext(chart1, { scope: 'dayun', cycleIndex: 1 }),
  );
});

test('八字旧结果缺少可信来源或来源非法时应失败关闭', () => {
  const result = createChart();
  const legacy = structuredClone(result) as Partial<BaziChartResult>;
  delete legacy.generation;
  assert.throws(() => rebuildAuditedBaziData(legacy as BaziChartResult), /缺少可信原始出生输入/);

  const invalidTimestamp = structuredClone(result);
  invalidTimestamp.generation.timestamp = -1;
  assert.throws(() => rebuildAuditedBaziData(invalidTimestamp), /有效的非负毫秒时间戳/);

  const invalidBoolean = structuredClone(result);
  invalidBoolean.generation.input.useTrueSolarTime = 'false' as unknown as boolean;
  assert.throws(() => rebuildAuditedBaziData(invalidBoolean), /必须是布尔值/);

  const missingVariantBasis = structuredClone(result);
  delete missingVariantBasis.generation.input.shenShaVariants;
  assert.throws(() => rebuildAuditedBaziData(missingVariantBasis), /缺少完整神煞口径/);

  const objectEnum = structuredClone(result);
  objectEnum.generation.input.shenShaVariants!.kongWangBasis = {
    toString: () => 'day',
  } as unknown as NonNullable<Person['shenShaVariants']>['kongWangBasis'];
  assert.throws(() => rebuildAuditedBaziData(objectEnum), /kongWangBasis 必须是/);

  const objectYangRen = structuredClone(result);
  objectYangRen.generation.input.shenShaVariants!.yangRenMode = {
    toString: () => 'yang-stems-only',
  } as unknown as NonNullable<Person['shenShaVariants']>['yangRenMode'];
  assert.throws(() => rebuildAuditedBaziData(objectYangRen), /yangRenMode 必须是/);

  const pollutedSource = structuredClone(result) as BaziChartResult & {
    generation: { input: Person & { pillars: unknown } };
  };
  pollutedSource.generation.input.pillars = result.pillars;
  assert.throws(() => rebuildAuditedBaziData(pollutedSource), /包含不受支持的字段：pillars/);
});

test('八字岁运审核入口只接受原始选择并拒绝派生上下文', () => {
  const result = createChart();
  const selectedYear = result.luckInfo.cycles[0]!.years[0]!.year;
  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
    year: selectedYear,
  });
  assert.ok(context);

  assert.deepEqual(
    normalizeBaziFortuneSelectionInput({ scope: 'year', cycleIndex: 0, year: selectedYear }),
    { scope: 'year', cycleIndex: 0, year: selectedYear },
  );
  assert.throws(
    () =>
      buildFortuneSelectionContext(
        result,
        context as unknown as Parameters<typeof buildFortuneSelectionContext>[1],
      ),
    /包含不受支持的字段/,
  );
  assert.throws(
    () => normalizeBaziFortuneSelectionInput({ scope: 'year', cycleIndex: -1 }),
    /cycleIndex 必须是/,
  );
});

test('八字真太阳时可信来源应固定精准时间、经度和时辰映射', () => {
  const result = createChart({
    ...PERSON,
    timeIndex: 0,
    useTrueSolarTime: true,
    birthHour: 10,
    birthMinute: 20,
    birthLongitude: 116.4074,
    birthPlace: '  北京  ',
    applyChinaDst: false,
  });

  assert.equal(result.generation.input.birthPlace, '北京');
  assert.deepEqual(rebuildAuditedBaziData(result), result);

  const mismatchedTimeIndex = structuredClone(result);
  mismatchedTimeIndex.generation.input.timeIndex =
    (mismatchedTimeIndex.generation.input.timeIndex + 1) % 13;
  assert.throws(() => rebuildAuditedBaziData(mismatchedTimeIndex), /时辰索引与精准出生时间不一致/);
});
