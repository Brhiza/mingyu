import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBirthChartBundle } from 'mingyu-core/birth';
import { calculateCompatibilityBundle } from 'mingyu-core/compatibility';

const primary = {
  name: '第一人',
  gender: 'male' as const,
  calendarType: 'solar' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 5,
};

const partner = {
  name: '第二人',
  gender: 'female' as const,
  calendarType: 'solar' as const,
  year: 1992,
  month: 8,
  day: 20,
  timeIndex: 7,
};

test('双人 BirthProfile 生成八字合盘证据并保留给定姓名', async () => {
  const namedPrimary = { ...primary, name: '未命名' };
  const bundle = await calculateCompatibilityBundle(namedPrimary, partner, {
    systems: ['bazi'],
  });

  assert.deepEqual(bundle.systems, ['bazi']);
  assert.equal(bundle.primary.bazi?.pillars.hour.ganZhi.length, 2);
  assert.equal(bundle.partner.bazi?.pillars.hour.ganZhi.length, 2);
  assert.equal(bundle.primary.profile.name, '未命名');
  assert.equal(bundle.bazi?.people.person1, '未命名');
  assert.equal(bundle.bazi?.people.person2, '第二人');
  assert.equal(bundle.astrolabe, undefined);
  assert.equal(bundle.ziwei, undefined);
});

test('合盘 Bundle 应拒绝未知系统而不是静默忽略', async () => {
  await assert.rejects(
    () =>
      calculateCompatibilityBundle(primary, partner, {
        systems: ['bazi', 'unknown' as never],
      }),
    /不支持的合盘系统/,
  );
});

test('双人档案姓名与方向覆盖下层分析选项中的旧姓名', async () => {
  const bundle = await calculateCompatibilityBundle(primary, partner, {
    systems: ['bazi', 'ziwei'],
    bazi: { person1Name: '旧对方', person2Name: '旧主方' },
    ziwei: { person1Name: '旧对方', person2Name: '旧主方' },
    chart: {
      ziwei: {
        scopes: ['origin'],
        skipAnalysis: true,
        horoscopeContext: { dateStr: '2025-01-01', hourIndex: 6 },
      },
    },
  });
  assert.deepEqual(bundle.bazi?.people, { person1: primary.name, person2: partner.name });
  assert.deepEqual(bundle.ziwei?.people, { person1: primary.name, person2: partner.name });
});

test('紫微合盘补齐本命资料并拒绝不含本命盘的独立批次', async () => {
  const horoscopeContext = { dateStr: '2025-01-01', hourIndex: 6 };
  const standalone = await calculateBirthChartBundle(primary, {
    systems: ['ziwei'],
    ziwei: { scopes: ['yearly'], skipAnalysis: true, horoscopeContext },
  });
  assert.ok(!('range' in standalone));
  assert.equal(standalone.ziwei?.payloadByScope.origin, undefined);
  assert.ok(standalone.ziwei?.payloadByScope.yearly);

  const bundle = await calculateCompatibilityBundle(primary, partner, {
    systems: ['ziwei'],
    chart: { ziwei: { scopes: ['yearly'], skipAnalysis: true, horoscopeContext } },
  });
  assert.ok(!('range' in bundle));
  assert.ok(bundle.primary.ziwei?.payloadByScope.origin);
  assert.ok(bundle.partner.ziwei?.payloadByScope.origin);
  assert.ok(bundle.primary.ziwei?.payloadByScope.yearly);
  assert.ok(bundle.partner.ziwei?.payloadByScope.yearly);
  assert.deepEqual(bundle.primary.ziwei?.horoscopeContext, horoscopeContext);
  assert.deepEqual(bundle.partner.ziwei?.horoscopeContext, horoscopeContext);
  assert.deepEqual(bundle.ziwei?.people, { person1: '第一人', person2: '第二人' });

  const independentOrigin = await calculateCompatibilityBundle(primary, partner, {
    systems: ['ziwei'],
    chart: {
      ziwei: {
        independentBatch: 'scope',
        scopes: ['origin'],
        skipAnalysis: true,
        horoscopeContext,
      },
    },
  });
  assert.ok(!('range' in independentOrigin));
  assert.ok(independentOrigin.primary.ziwei?.payloadByScope.origin);
  assert.ok(independentOrigin.partner.ziwei?.payloadByScope.origin);
  assert.ok(independentOrigin.ziwei?.palaceOverlays.length);

  await assert.rejects(
    () =>
      calculateCompatibilityBundle(primary, partner, {
        systems: ['ziwei'],
        chart: { ziwei: { independentBatch: 'fortune' } },
      }),
    /紫微合盘需要双方本命 origin 资料/,
  );
  await assert.rejects(
    () =>
      calculateCompatibilityBundle(primary, partner, {
        systems: ['ziwei'],
        chart: { ziwei: { independentBatch: 'scope', scopes: ['yearly'] } },
      }),
    /紫微合盘需要双方本命 origin 资料/,
  );
});

test('单点合盘锁定双方档案和规则，异步计算后关系仍对应原始盘面', async () => {
  const mutablePrimary = {
    ...primary,
    name: '',
    hour: 9,
    minute: 0,
    location: { latitude: 39.9042, longitude: 116.4074, timezone: 8 },
  };
  const mutablePartner = {
    ...partner,
    name: '  ',
    hour: 13,
    minute: 0,
    location: { latitude: 31.2304, longitude: 121.4737, timezone: 8 },
  };
  const initialPrimary = structuredClone(mutablePrimary);
  const initialPartner = structuredClone(mutablePartner);
  const options = {
    systems: ['bazi', 'ziwei', 'astrolabe'] as Array<'bazi' | 'ziwei' | 'astrolabe'>,
    chart: {
      ziwei: {
        scopes: ['origin'] as Array<'origin' | 'yearly'>,
        skipAnalysis: true,
        horoscopeContext: { dateStr: '2025-01-01', hourIndex: 6 },
      },
    },
  };
  const pending = calculateCompatibilityBundle(mutablePrimary, mutablePartner, options);
  assert.deepEqual(mutablePrimary, initialPrimary);
  assert.deepEqual(mutablePartner, initialPartner);
  mutablePrimary.name = '事后改名一';
  mutablePrimary.year = 1991;
  mutablePartner.name = '事后改名二';
  mutablePartner.year = 1993;
  options.chart.ziwei.scopes[0] = 'yearly';

  const bundle = await pending;
  if ('range' in bundle) assert.fail('应返回单点合盘');
  assert.equal(bundle.primary.profile.name, '第一人');
  assert.equal(bundle.partner.profile.name, '第二人');
  assert.equal(bundle.primary.profile.year, 1990);
  assert.equal(bundle.partner.profile.year, 1992);
  assert.deepEqual(bundle.bazi?.people, { person1: '第一人', person2: '第二人' });
  assert.deepEqual(bundle.ziwei?.people, { person1: '第一人', person2: '第二人' });
  assert.deepEqual(bundle.astrolabe?.people, ['第一人', '第二人']);
  assert.equal(bundle.primary.astrolabe?.birth.name, '第一人');
  assert.equal(bundle.partner.astrolabe?.birth.name, '第二人');
  assert.match(bundle.primary.astrolabe?.birth.dateTime ?? '', /1990-05-15/);
  assert.match(bundle.partner.astrolabe?.birth.dateTime ?? '', /1992-08-20/);
  assert.ok(bundle.primary.ziwei?.payloadByScope.origin);
  assert.ok(bundle.partner.ziwei?.payloadByScope.origin);
});

test('单点紫微合盘在时辰边界只读取一次默认运限上下文', async () => {
  const nativeDate = Date;
  const beforeBoundary = nativeDate.parse('2026-09-29T14:59:59.000Z');
  const afterBoundary = nativeDate.parse('2026-09-29T15:00:00.000Z');
  let contextReads = 0;
  globalThis.Date = new Proxy(nativeDate, {
    construct(target, args, newTarget) {
      if (args.length === 0 && new Error().stack?.includes('getDefaultHoroscopeContext')) {
        return Reflect.construct(
          target,
          [contextReads++ === 0 ? beforeBoundary : afterBoundary],
          newTarget,
        );
      }
      return Reflect.construct(target, args, newTarget);
    },
  });

  try {
    const bundle = await calculateCompatibilityBundle(primary, partner, {
      systems: ['ziwei'],
      chart: { ziwei: { scopes: ['origin'], skipAnalysis: true } },
    });
    assert.equal(contextReads, 1);
    assert.deepEqual(bundle.primary.ziwei?.horoscopeContext, {
      dateStr: '2026-09-29',
      hourIndex: 11,
    });
    assert.deepEqual(
      bundle.partner.ziwei?.horoscopeContext,
      bundle.primary.ziwei?.horoscopeContext,
    );
  } finally {
    globalThis.Date = nativeDate;
  }
});

test('单点紫微合盘保留显式 now 与 horoscopeContext 的优先级', async () => {
  const now = new Date('2025-01-01T04:00:00.000Z');
  const fromNow = await calculateCompatibilityBundle(primary, partner, {
    systems: ['ziwei'],
    chart: { ziwei: { scopes: ['origin'], skipAnalysis: true, now } },
  });
  assert.deepEqual(fromNow.primary.ziwei?.horoscopeContext, {
    dateStr: '2025-01-01',
    hourIndex: 6,
  });
  assert.deepEqual(
    fromNow.partner.ziwei?.horoscopeContext,
    fromNow.primary.ziwei?.horoscopeContext,
  );

  const horoscopeContext = { dateStr: '2025-03-01', hourIndex: 3 };
  const explicit = await calculateCompatibilityBundle(primary, partner, {
    systems: ['ziwei'],
    chart: { ziwei: { scopes: ['origin'], skipAnalysis: true, now, horoscopeContext } },
  });
  assert.deepEqual(explicit.primary.ziwei?.horoscopeContext, horoscopeContext);
  assert.deepEqual(explicit.partner.ziwei?.horoscopeContext, horoscopeContext);
});
