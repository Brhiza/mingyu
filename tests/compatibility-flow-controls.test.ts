import assert from 'node:assert/strict';
import test from 'node:test';
import { baziSynastryIndependent } from '../src/systems/bazi-synastry';
import type { PersonalCase } from '../src/v2-ui/cases-store';
import {
  buildCompatibilityChartPayload,
  inferCompatibilityFlowFromQuestion,
  resolveSyncYearsRange,
} from '../src/v2-ui/result-page';

function makeCase(overrides: Partial<PersonalCase> = {}): PersonalCase {
  return {
    id: 'case-1',
    name: '测试命主',
    gender: 'male',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 7,
    exactHour: 14,
    exactMinute: 30,
    exactSecond: 0,
    useTrueSolarTime: false,
    birthPlace: '北京市',
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    timeZoneId: 'Asia/Shanghai',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('resolveSyncYearsRange 正确计算各预设的起止年份并限制在合法范围内', () => {
  assert.equal(resolveSyncYearsRange('none', 2026), null);
  assert.deepEqual(resolveSyncYearsRange('next3', 2026), { startYear: 2026, endYear: 2028 });
  assert.deepEqual(resolveSyncYearsRange('next5', 2026), { startYear: 2026, endYear: 2030 });
  assert.deepEqual(resolveSyncYearsRange('around5', 2026), { startYear: 2024, endYear: 2028 });
  assert.deepEqual(resolveSyncYearsRange('next10', 2026), { startYear: 2026, endYear: 2035 });
  assert.deepEqual(resolveSyncYearsRange('next10', 2095), { startYear: 2095, endYear: 2100 });
  assert.deepEqual(resolveSyncYearsRange('around5', 1900), { startYear: 1900, endYear: 1902 });
});

test('buildCompatibilityChartPayload 在三种合盘中正确携带流年与多年同步参数', () => {
  const p1 = makeCase({ id: 'p1', name: '甲', gender: 'male' });
  const p2 = makeCase({ id: 'p2', name: '乙', gender: 'female', year: 1992, month: 8, day: 12 });
  const syncYears = { startYear: 2026, endYear: 2030 };

  const baziPayload = buildCompatibilityChartPayload(p1, p2, 'bazi-synastry', '合盘看流年', {
    relationship: 'marriage',
    flowYear: 2028,
    syncYears,
  });
  assert.equal(baziPayload.referenceTime, '2028-06-15T12:00:00+08:00');
  assert.deepEqual(baziPayload.syncYears, syncYears);

  const ziweiPayload = buildCompatibilityChartPayload(p1, p2, 'ziwei-synastry', '紫微流年', {
    relationship: 'career',
    flowYear: 2027,
    syncYears,
  });
  assert.equal(ziweiPayload.referenceTime, '2027-06-15T12:00:00+08:00');
  assert.deepEqual(ziweiPayload.syncYears, syncYears);

  const astroPayload = buildCompatibilityChartPayload(p1, p2, 'astrolabe-synastry', '星盘行运', {
    flowYear: 2029,
    syncYears,
  });
  assert.equal(astroPayload.referenceTime, '2029-06-15T12:00:00+08:00');
  assert.deepEqual(astroPayload.syncYears, syncYears);

  const unknownPartner = makeCase({ id: 'p3', name: '丙', timeIndex: 'unknown' });
  const baziUnknownPayload = buildCompatibilityChartPayload(
    p1,
    unknownPartner,
    'bazi-synastry',
    '未知时辰合盘',
    { flowYear: 2028, syncYears },
  );
  assert.equal(baziUnknownPayload.referenceTime, undefined);
  assert.equal(baziUnknownPayload.syncYears, undefined);
});

test('baziSynastryIndependent 在双方精确出生与性别时返回各自的大运与流年定位数据', async () => {
  const res = await baziSynastryIndependent({
    question: '查看双方 2028 年大运流年合参',
    person1: {
      name: '甲',
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
      timezone: 8,
    },
    person2: {
      name: '乙',
      gender: 'female',
      year: 1992,
      month: 8,
      day: 12,
      clock: { kind: 'exact', hour: 9, minute: 0, second: 0 },
      timezone: 8,
    },
    relationship: 'marriage',
    referenceTime: '2028-06-15T12:00:00+08:00',
    syncYears: { startYear: 2026, endYear: 2028 },
  });

  const charts = res.data.charts as {
    person1?: { fortune?: { cycles?: unknown[] }; located?: { flowYear?: number } };
    person2?: { fortune?: { cycles?: unknown[] }; located?: { flowYear?: number } };
  };
  assert.ok(charts.person1?.fortune?.cycles?.length);
  assert.ok(charts.person2?.fortune?.cycles?.length);
  assert.equal(charts.person1?.located?.flowYear, 2028);
  assert.equal(charts.person2?.located?.flowYear, 2028);
  assert.ok(res.data.compatibility?.fortuneComparison);
  assert.equal(res.data.compatibility?.annualSync?.years.length, 3);
});

test('inferCompatibilityFlowFromQuestion 能从提问自动推断流年与多年同步范围', () => {
  const singleYear = inferCompatibilityFlowFromQuestion('我们 2028 年适合结婚吗？', 2026);
  assert.equal(singleYear.flowYear, 2028);
  assert.equal(singleYear.syncYears, null);

  const multiYear = inferCompatibilityFlowFromQuestion('未来五年我们合伙运势如何？', 2026);
  assert.equal(multiYear.flowYear, null);
  assert.ok(multiYear.syncYears);
  assert.equal(multiYear.syncYears.startYear, 2026);
  assert.equal(multiYear.syncYears.endYear, 2030);

  const p1 = makeCase({ id: 'p1', name: '甲', gender: 'male' });
  const p2 = makeCase({ id: 'p2', name: '乙', gender: 'female', year: 1992, month: 8, day: 12 });
  const autoPayload = buildCompatibilityChartPayload(
    p1,
    p2,
    'bazi-synastry',
    '我们 2028 年适合结婚吗？',
  );
  assert.equal(autoPayload.referenceTime, '2028-06-15T12:00:00+08:00');
});
