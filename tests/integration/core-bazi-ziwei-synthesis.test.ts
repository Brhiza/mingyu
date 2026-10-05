import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBaziZiweiSynthesis,
  calculateBaziZiweiCombinedReading,
  formatBaziZiweiSynthesisForPrompt,
} from 'mingyu-core/synthesis';
import { createMingyuClient } from 'mingyu-core/client';
import { configure } from 'mingyu-core/calendar';
import type { BirthProfile } from 'mingyu-core/profile';
import { baziCalculator } from '../../packages/core/src/bazi/baziCalculator';
import { calculateZiweiChart } from '../../packages/core/src/ziwei/runtime';

const profile: BirthProfile = {
  name: '时月',
  gender: 'female',
  calendarType: 'solar',
  year: 2024,
  month: 11,
  day: 2,
  hour: 16,
  minute: 44,
  location: { regionId: '110101' },
  useTrueSolarTime: false,
};

const ziwei = {
  horoscopeContext: {
    dateStr: '2026-08-07',
    hourIndex: 8,
  },
};

let combinedReadingPromise: ReturnType<typeof calculateBaziZiweiCombinedReading> | undefined;
const client = createMingyuClient({ defaults: { synthesis: { ziwei } } });

function getCombinedReading() {
  combinedReadingPromise ??= client.baziZiwei(profile);
  return combinedReadingPromise;
}

test('八字紫微合参缺少明确运限基准时间时应拒绝计算', async () => {
  await assert.rejects(
    () => calculateBaziZiweiCombinedReading(profile),
    /必须显式提供 ziwei\.horoscopeContext 或 ziwei\.now/,
  );

  const client = createMingyuClient();
  const safe = await client.safe.baziZiwei(profile);
  assert.equal(safe.ok, false);
  if (safe.ok) return;
  assert.match(safe.error.message, /必须显式提供 ziwei\.horoscopeContext 或 ziwei\.now/);
});

test('八字紫微合参应按主题保留两套结构化资料', async () => {
  const reading = await getCombinedReading();

  assert.equal(reading.synthesis.key, 'bazi-ziwei:synthesis');
  assert.equal(client.capability('bazi-ziwei-synthesis').name, '八字紫微合参');
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  assert.equal(reading.synthesis.themes.length, 10);
  assert.ok(reading.synthesis.themes.every((theme) => theme.baziEvidence.length > 0));
  assert.ok(reading.synthesis.themes.every((theme) => theme.ziweiEvidence.length > 0));
  assert.equal(reading.synthesis.status, '资料完整');
  assert.deepEqual(reading.synthesis.timingReference, {
    dateStr: '2026-08-07',
    year: 2026,
    hourIndex: 8,
    shichen: '申时',
  });
  const timing = reading.synthesis.themes.find((theme) => theme.id === 'timing');
  assert.equal(timing?.baziEvidence.filter((fact) => fact.title === '流年序列').length, 1);
  assert.match(
    timing?.baziEvidence.find((fact) => fact.title === '流年序列')?.detail ?? '',
    /2026年/,
  );
  assert.doesNotMatch(timing?.baziEvidence.map((fact) => fact.detail).join('\n') ?? '', /2027年/);
  assert.match(reading.promptText, /八字与紫微斗数合参/);
  assert.match(reading.promptText, /【运限基准】\n2026-08-07 申时/);
  assert.doesNotMatch(reading.promptText, /时辰索引/);
  assert.match(reading.promptText, /命局总纲/);
  assert.match(reading.promptText, /大运与流年/);
  assert.doesNotMatch(reading.promptText, /匹配率|吉凶概率|项目|API|内部字段/);
});

test('只有时辰精度且立春落在时辰内时不选定唯一八字流年', async () => {
  const reading = await calculateBaziZiweiCombinedReading(
    { ...profile, year: 2000, month: 5, day: 12 },
    { ziwei: { horoscopeContext: { dateStr: '2024-02-04', hourIndex: 8 } } },
  );
  assert.ok(!reading.range);
  if (reading.range) return;
  assert.equal(reading.synthesis.status, '资料有缺口');
  assert.ok(reading.synthesis.missingFacts.some((fact) => fact.includes('跨八字节令年')));
  assert.match(reading.synthesis.timingBoundaryFacts.join('\n'), /2023年、2024年八字节令年/);
  const timing = reading.synthesis.themes.find((theme) => theme.id === 'timing');
  assert.equal(
    timing?.baziEvidence.some((fact) => fact.title === '流年序列'),
    false,
  );
  assert.match(reading.promptText, /【时辰边界】/);
  assert.doesNotMatch(reading.promptText, /流年序列：2023年|流年序列：2024年/);

  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  const exact = buildBaziZiweiSynthesis({
    bazi: reading.bundle.bazi,
    ziwei: reading.bundle.ziwei,
    referenceInstant: new Date('2024-02-04T16:28:00+08:00'),
  });
  assert.deepEqual(exact.timingBoundaryFacts, []);
  assert.equal(exact.timingReference.beijingDateTime, '2024-02-04 16:28:00');
  const exactTiming = exact.themes.find((theme) => theme.id === 'timing');
  assert.match(
    exactTiming?.baziEvidence.find((fact) => fact.title === '流年序列')?.detail ?? '',
    /2024年甲辰/,
  );
  assert.match(formatBaziZiweiSynthesisForPrompt(exact), /2024-02-04 16:28:00（北京时间/);

  const clock = (hour: number) => ({ year: 2024, month: 2, day: 4, hour, minute: 0, second: 0 });
  const [firstCycle, secondCycle] = reading.bundle.bazi.luckInfo.cycles;
  assert.ok(firstCycle);
  assert.ok(secondCycle);
  const handover = buildBaziZiweiSynthesis({
    bazi: {
      ...reading.bundle.bazi,
      luckInfo: {
        ...reading.bundle.bazi.luckInfo,
        cycles: [
          { ...firstCycle, ganZhi: '甲子', startSolarTime: clock(15), endSolarTime: clock(16) },
          { ...secondCycle, ganZhi: '乙丑', startSolarTime: clock(16), endSolarTime: clock(17) },
        ],
      },
    },
    ziwei: reading.bundle.ziwei,
  });
  assert.match(handover.timingBoundaryFacts.join('\n'), /童限（2000年起）、乙丑大运/);
  assert.ok(handover.missingFacts.some((fact) => fact.includes('跨八字交运')));
  assert.equal(
    handover.themes
      .find((theme) => theme.id === 'timing')
      ?.baziEvidence.some((fact) => fact.scope === 'decadal'),
    false,
  );

  try {
    for (const timezoneOffset of [-720, 0, 840]) {
      configure({ timezoneOffset });
      const replay = buildBaziZiweiSynthesis({
        bazi: reading.bundle.bazi,
        ziwei: reading.bundle.ziwei,
        referenceInstant: new Date('2024-02-04T08:28:00Z'),
      });
      assert.deepEqual(replay, exact);
    }
    configure({ timezoneOffset: -720 });
    const requestedNow = new Date('2024-02-04T08:28:00Z');
    const pending = calculateBaziZiweiCombinedReading(
      { ...profile, year: 2000, month: 5, day: 12 },
      { ziwei: { now: requestedNow } },
    );
    requestedNow.setUTCFullYear(2025);
    const preciseReading = await pending;
    assert.ok(!preciseReading.range);
    if (preciseReading.range) return;
    assert.deepEqual(preciseReading.bundle.ziwei?.horoscopeContext, {
      dateStr: '2024-02-04',
      hourIndex: 8,
    });
    assert.equal(preciseReading.synthesis.timingReference.beijingDateTime, '2024-02-04 16:28:00');
    assert.deepEqual(preciseReading.synthesis.timingBoundaryFacts, []);
    assert.match(
      preciseReading.promptText,
      /【运限基准】\n2024-02-04 16:28:00（北京时间；紫微按2024-02-04 申时排运限）/,
    );
  } finally {
    configure({ timezoneOffset: 480 });
  }
});

test('合参提示词应支持不同解读层级并保持完整任务结构', async () => {
  const reading = await getCombinedReading();
  const prompt = formatBaziZiweiSynthesisForPrompt(reading.synthesis, {
    detailLevel: 'professional',
    question: '重点分析未来十年的事业与迁移。',
  });

  assert.match(prompt, /专业术语完整展开/);
  assert.match(prompt, /重点分析未来十年的事业与迁移/);
  assert.match(prompt, /八字资料/);
  assert.match(prompt, /紫微资料/);
  const repeatedPattern = reading.synthesis.themes
    .flatMap((theme) => theme.baziEvidence)
    .find((fact) => fact.title === '格局');
  assert.ok(repeatedPattern);
  assert.match(prompt, /【共同盘面资料】/);
  assert.equal(prompt.split(`${repeatedPattern.title}：${repeatedPattern.detail}`).length - 1, 1);
  assert.doesNotMatch(prompt, /同时参照【共同盘面资料】/);

  const runtime = reading.bundle.ziwei;
  assert.ok(runtime);
  const yearly = runtime.payloadByScope.yearly;
  assert.ok(yearly);
  const destination = yearly.evidence_pool.find(
    (fact) =>
      fact.type === 'scope_mutagen_destination' &&
      fact.scope === 'yearly' &&
      fact.status === '已记录',
  );
  assert.ok(destination);
  const yearlyEvidence = yearly.evidence_pool.filter((fact) => fact.scope === 'yearly');
  assert.ok(yearlyEvidence.length > 12);
  assert.ok(yearlyEvidence.indexOf(destination) < 12);
  const mapping = yearly.active_scope.mutagen_map.find(
    (item) => item.star === destination.star_names[0] && item.mutagen === destination.mutagens[0],
  );
  assert.ok(mapping?.palace_name);
  const summary = `${mapping.star}化${mapping.mutagen}入${mapping.palace_name}`;
  const timing = reading.synthesis.themes.find((theme) => theme.id === 'timing');
  const yearlyFact = timing?.ziweiEvidence.find((fact) => fact.scope === 'yearly');
  assert.ok(yearlyFact);
  assert.equal(yearlyFact.detail.split('；').includes(summary), false);
  assert.ok(prompt.includes(destination.promptText ?? destination.description));
  assert.ok(prompt.includes(`当前${yearly.active_scope.label}`));
  assert.ok(yearlyFact.sourceKeys.includes(destination.key ?? destination.stable_key));

  const baselineRuntime = JSON.stringify(runtime.payloadByScope);
  for (const control of ['缺项', '截断', '附加条件', '错星', '错宫', '独立正文'] as const) {
    const pool = structuredClone(yearly.evidence_pool);
    const index = pool.findIndex((fact) => fact.key === destination.key);
    if (control === '缺项') pool.splice(index, 1);
    if (control === '截断') pool.push(...pool.splice(index, 1));
    if (control === '附加条件') {
      pool[index].description += '；另有本次独立条件';
      pool[index].promptText = `${pool[index].title}：${pool[index].description}`;
    }
    if (control === '错星') pool[index].star_names = ['其他星曜'];
    if (control === '错宫') pool[index].palace_indexes = [-1];
    if (control === '独立正文') pool[index].promptText = '本次另列的四化条件';
    const synthesis = buildBaziZiweiSynthesis({
      bazi: reading.bundle.bazi,
      ziwei: {
        ...runtime,
        payloadByScope: { ...runtime.payloadByScope, yearly: { ...yearly, evidence_pool: pool } },
      },
    });
    const fact = synthesis.themes
      .find((theme) => theme.id === 'timing')
      ?.ziweiEvidence.find((item) => item.scope === 'yearly');
    assert.ok(fact?.detail.split('；').includes(summary), control);
    const text = formatBaziZiweiSynthesisForPrompt(synthesis);
    assert.ok(text.includes(summary), control);
    if (control === '附加条件') assert.ok(text.includes('另有本次独立条件'));
    if (control === '独立正文') assert.ok(text.includes('本次另列的四化条件'));
    assert.equal(JSON.stringify(runtime.payloadByScope), baselineRuntime);
  }
});

test('运限证据超过展示范围时合参任务书明确标出未列条数', async () => {
  const reading = await getCombinedReading();
  const { bazi, ziwei: runtime } = reading.bundle;
  assert.ok(bazi);
  assert.ok(runtime);
  const yearly = runtime.payloadByScope.yearly;
  assert.ok(yearly);
  const template = yearly.evidence_pool[0];
  assert.ok(template);
  const evidence_pool = Array.from({ length: 13 }, (_, index) => ({
    ...template,
    id: `T${index + 1}`,
    key: `ziwei:timing:test:${index + 1}`,
    stable_key: `timing:test:${index + 1}`,
    type: 'scope_landing',
    scope: yearly.active_scope.scope,
    title: `运限证据${index + 1}`,
    description: index === 12 ? '第13项反证' : `第${index + 1}项资料`,
    promptText: index === 12 ? '第13项反证' : `第${index + 1}项资料`,
  }));
  const synthesis = buildBaziZiweiSynthesis({
    bazi,
    ziwei: {
      ...runtime,
      payloadByScope: {
        ...runtime.payloadByScope,
        yearly: { ...yearly, evidence_pool },
      },
    },
  });
  const yearlyFact = synthesis.themes
    .find((theme) => theme.id === 'timing')
    ?.ziweiEvidence.find((fact) => fact.scope === 'yearly');
  assert.ok(yearlyFact);
  assert.equal(yearlyFact.truncatedEvidenceCount, 1);
  assert.equal(yearlyFact.sourceKeys.length, 12);

  const prompt = formatBaziZiweiSynthesisForPrompt(synthesis);
  assert.match(prompt, /同一运限另有1项资料未列/);
  assert.doesNotMatch(prompt, /第13项反证/);
});

test('合参保留结构化互证，在线任务书只列命中的双盘位置事实', async () => {
  const reading = await getCombinedReading();
  const corroboration = reading.synthesis.corroboration;
  assert.ok(corroboration);
  assert.ok(corroboration.shaYao);
  assert.ok(corroboration.guiRen);
  assert.match(corroboration.summary, /八字紫微互证：/);

  const prompt = formatBaziZiweiSynthesisForPrompt({
    ...reading.synthesis,
    corroboration: {
      ...corroboration,
      shaYao: {
        ...corroboration.shaYao,
        baziYangRenPositions: [{ rule: '羊刃', pillar: 'day', pillarName: '日柱', branch: '卯' }],
        ziweiShaEvidence: [
          {
            name: '擎羊',
            palaceIndex: 0,
            palaceName: '命宫',
            palaceRole: '命宫',
            kind: '煞星',
            state: { brightness: '陷' },
          },
        ],
        ziweiCheckStatus: 'checked',
      },
      guiRen: {
        ...corroboration.guiRen,
        baziTianYiPositions: [
          { rule: '天乙贵人', pillar: 'year', pillarName: '年柱', branch: '丑' },
        ],
        ziweiGuiEvidence: [
          {
            name: '天魁',
            palaceIndex: 4,
            palaceName: '财帛宫',
            palaceRole: '关键宫',
            kind: '辅星',
            state: {},
          },
        ],
        ziweiCheckStatus: 'checked',
      },
    },
  });
  assert.match(prompt, /八字羊刃：日柱卯/);
  assert.match(prompt, /紫微煞曜：擎羊在命宫（陷）/);
  assert.match(prompt, /八字天乙贵人：年柱丑/);
  assert.match(prompt, /紫微辅弼魁钺：天魁在财帛宫/);
  assert.doesNotMatch(prompt, /八字紫微互证：|同向结论为主干断点|【合参导引】/);
});

test('紫微原盘十二宫不完整时合参不能报告资料完整', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  const origin = reading.bundle.ziwei.payloadByScope.origin;
  assert.ok(origin);
  const synthesis = buildBaziZiweiSynthesis({
    bazi: reading.bundle.bazi,
    ziwei: {
      ...reading.bundle.ziwei,
      payloadByScope: {
        ...reading.bundle.ziwei.payloadByScope,
        origin: { ...origin, palaces: origin.palaces.slice(0, 11) },
      },
    },
  });
  assert.equal(synthesis.status, '资料有缺口');
  assert.ok(synthesis.missingFacts.includes('紫微本命十二宫资料缺失或不完整'));
  assert.equal(synthesis.corroboration?.shaYao.ziweiCheckStatus, 'origin-missing');
});

test('紫微原盘缺失时合参提示词保留煞曜与贵人星资料缺口', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  const synthesis = buildBaziZiweiSynthesis({
    bazi: reading.bundle.bazi,
    ziwei: {
      ...reading.bundle.ziwei,
      payloadByScope: {
        ...reading.bundle.ziwei.payloadByScope,
        origin: undefined,
      },
    },
  });

  assert.equal(synthesis.corroboration?.shaYao.ziweiCheckStatus, 'origin-missing');
  assert.equal(synthesis.corroboration?.guiRen.ziweiCheckStatus, 'origin-missing');
  const prompt = formatBaziZiweiSynthesisForPrompt(synthesis);
  assert.match(prompt, /紫微本命十二宫资料缺失或不完整，关键宫煞曜与贵人星位置未核验/);
  assert.doesNotMatch(prompt, /双盘煞曜不显|紫微关键宫未记录目标煞曜|关键宫也未记录目标贵人星/);
});

test('紫微宫位缺少星曜列表时合参记录资料缺口而不输出残缺宫位', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  const origin = reading.bundle.ziwei.payloadByScope.origin;
  assert.ok(origin);
  const damagedPalaces = origin.palaces.map((palace, index) =>
    index === 0 ? { ...palace, minor_stars: undefined } : palace,
  );
  const synthesis = buildBaziZiweiSynthesis({
    bazi: reading.bundle.bazi,
    ziwei: {
      ...reading.bundle.ziwei,
      payloadByScope: {
        ...reading.bundle.ziwei.payloadByScope,
        origin: { ...origin, palaces: damagedPalaces as typeof origin.palaces },
      },
    },
  });
  assert.equal(synthesis.status, '资料有缺口');
  assert.ok(synthesis.missingFacts.includes('紫微本命十二宫资料缺失或不完整'));
  assert.ok(
    synthesis.themes.every((theme) => theme.id === 'timing' || !theme.ziweiEvidence.length),
  );
});

test('紫微运限日期或落宫缺失时合参不报告资料完整', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  const yearly = reading.bundle.ziwei.payloadByScope.yearly;
  assert.ok(yearly);

  const missingDate = buildBaziZiweiSynthesis({
    bazi: reading.bundle.bazi,
    ziwei: {
      ...reading.bundle.ziwei,
      payloadByScope: {
        ...reading.bundle.ziwei.payloadByScope,
        yearly: { ...yearly, active_scope: { ...yearly.active_scope, solar_date: '' } },
      },
    },
  });
  assert.equal(missingDate.status, '资料有缺口');
  assert.ok(missingDate.missingFacts.includes('运限基准年份缺少对应紫微流年'));
  assert.equal(
    missingDate.themes
      .find((theme) => theme.id === 'timing')
      ?.ziweiEvidence.some((fact) => fact.scope === 'yearly'),
    false,
  );

  const missingPalace = buildBaziZiweiSynthesis({
    bazi: reading.bundle.bazi,
    ziwei: {
      ...reading.bundle.ziwei,
      payloadByScope: {
        ...reading.bundle.ziwei.payloadByScope,
        yearly: { ...yearly, active_scope: { ...yearly.active_scope, palace_index: undefined } },
      },
    },
  });
  assert.equal(missingPalace.status, '资料有缺口');
  assert.ok(missingPalace.missingFacts.includes('紫微流年落宫未定位'));
  const yearlyFact = missingPalace.themes
    .find((theme) => theme.id === 'timing')
    ?.ziweiEvidence.find((fact) => fact.scope === 'yearly');
  assert.ok(yearlyFact);
  assert.doesNotMatch(yearlyFact.detail, /运限命宫落/);
});

test('八字旺衰或格局未知时合参应登记资料缺口', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);

  const synthesis = buildBaziZiweiSynthesis({
    bazi: {
      ...reading.bundle.bazi,
      analysis: {
        ...reading.bundle.bazi.analysis,
        dayMasterStrength: {
          ...reading.bundle.bazi.analysis.dayMasterStrength,
          status: '未知',
        },
        mingGe: {
          ...reading.bundle.bazi.analysis.mingGe,
          pattern: '未知',
        },
      },
    },
    ziwei: reading.bundle.ziwei,
  });

  assert.equal(synthesis.status, '资料有缺口');
  assert.ok(
    synthesis.missingFacts.some((fact) => fact.includes('待核验项：') && fact.includes('strength')),
  );
  assert.ok(
    synthesis.missingFacts.some((fact) => fact.includes('待核验项：') && fact.includes('pattern')),
  );
});

test('局部细节未知不应把已知的旺衰结构整体标为缺口', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);

  const synthesis = buildBaziZiweiSynthesis({
    bazi: {
      ...reading.bundle.bazi,
      analysis: {
        ...reading.bundle.bazi.analysis,
        dayMasterStrength: {
          ...reading.bundle.bazi.analysis.dayMasterStrength,
          details: {
            ...reading.bundle.bazi.analysis.dayMasterStrength.details,
            ruleBasis: [
              ...reading.bundle.bazi.analysis.dayMasterStrength.details.ruleBasis,
              '局部细节未知',
            ],
          },
        },
      },
    },
    ziwei: reading.bundle.ziwei,
  });

  assert.equal(synthesis.status, '资料完整');
});

test('真实同名格局的破格与未判定分别传入合参，不以格名替代裁决', async () => {
  const examples = [
    {
      year: 2000,
      month: 8,
      day: 19,
      timeIndex: 0,
      pillars: ['庚辰', '甲申', '己酉', '甲子'],
      pattern: '伤官格',
      status: '破格',
    },
    {
      year: 1990,
      month: 7,
      day: 13,
      timeIndex: 12,
      pillars: ['庚午', '癸未', '庚辰', '丙子'],
      pattern: '正官格',
      status: '未判定',
    },
    {
      year: 2013,
      month: 9,
      day: 25,
      timeIndex: 3,
      pillars: ['癸巳', '辛酉', '甲午', '丁卯'],
      pattern: '正官格',
      status: '破格',
    },
  ];
  for (const example of examples) {
    const bazi = baziCalculator.calculateBazi({ ...example, gender: 'male' });
    assert.deepEqual(
      Object.values(bazi.pillars).map((pillar) => pillar.ganZhi),
      example.pillars,
    );
    assert.equal(bazi.analysis.mingGe.pattern, example.pattern);
    assert.equal(bazi.analysis.mingGe.fulfillment?.status, example.status);
    const originalPattern = structuredClone(bazi.analysis.mingGe);
    const originalStrengthBasis = [...bazi.analysis.dayMasterStrength.details.ruleBasis];
    const runtime = await calculateZiweiChart(
      {
        name: '格局核验',
        gender: '男',
        dateType: 'solar',
        birthDate: `${example.year}-${String(example.month).padStart(2, '0')}-${String(example.day).padStart(2, '0')}`,
        birthTimeIndex: example.timeIndex,
      },
      {
        horoscopeContext: { dateStr: '2026-09-16', hourIndex: 6 },
        scopes: ['origin', 'decadal', 'yearly'],
      },
    );
    const synthesis = buildBaziZiweiSynthesis({ bazi, ziwei: runtime });
    const patternFacts = synthesis.themes
      .flatMap((theme) => theme.baziEvidence)
      .filter((fact) => fact.title === '格局');
    assert.ok(patternFacts.length);
    assert.ok(
      patternFacts.every((fact) => fact.detail.includes(`当前成败判定：${example.status}`)),
    );
    const prompt = formatBaziZiweiSynthesisForPrompt(synthesis);
    assert.ok(prompt.includes(`当前成败判定：${example.status}`));
    assert.equal(prompt.split(`当前成败判定：${example.status}`).length - 1, 1);
    assert.doesNotMatch(prompt, /当前成败判定：成格/);
    if (example.year === 1990) {
      assert.match(prompt, /正官仅见于年柱藏干丁（正官）、月柱藏干\/中气丁（正官），未透干/);
      assert.doesNotMatch(prompt, /当前成败判定：破格/);
    } else if (example.year === 2000) {
      assert.match(prompt, /格局破格所忌：甲正官（时柱）；伤官见官的救应明确不成立/);
      assert.match(prompt, /条件核验：资料不足；伤官见官可用项：时柱透干甲（正官）/);
      assert.doesNotMatch(prompt, /格局破格所忌：甲正官（月柱）/);
    } else if (example.year === 2013) {
      assert.match(
        prompt,
        /旺衰结构：身弱；月令削弱；司令克身；成局中性；有根；未见强根；有帮扶；有克泄耗/,
      );
      assert.match(
        prompt,
        /月令与司令合看为制身；通根条件为相持；成局、明根明透及中余气合看为制身（明干本气优先，藏气次级）/,
      );
      assert.match(
        prompt,
        /判定理由：原局见伤官见官；印星制伤官护官要求双方有可用根气；来源无稳定根或其他可用根。年柱透干癸（正印）无同类藏根/,
      );
      assert.match(prompt, /正官见月柱透干辛（正官）、月柱藏干辛（正官），有可用根气/);
      assert.match(prompt, /伤官见官可用项：时柱透干丁（伤官），有稳定根气且未见合绊/);
      assert.equal(prompt.split('月支酉本气为辛（正官）').length - 1, 1);
      assert.doesNotMatch(prompt, /先看得令，再看地支明根|不把旺相休囚死|不据此晋为极强/);
    }
    assert.deepEqual(bazi.analysis.mingGe, originalPattern);
    assert.deepEqual(bazi.analysis.dayMasterStrength.details.ruleBasis, originalStrengthBasis);
  }
});

test('真实冬月条件取用保留部分判定、作用对象与干级所忌，不扩大为整五行', async () => {
  const bazi = baziCalculator.calculateBazi({
    year: 1904,
    month: 1,
    day: 20,
    timeIndex: 0,
    gender: 'male',
  });
  assert.deepEqual(
    Object.values(bazi.pillars).map((pillar) => pillar.ganZhi),
    ['癸卯', '乙丑', '癸丑', '壬子'],
  );
  assert.equal(bazi.analysis.usefulGod.incrementStatus, '部分判定');
  assert.deepEqual(bazi.analysis.usefulGod.favorableWuxing, ['金', '水']);
  assert.deepEqual(bazi.analysis.usefulGod.conditionalFavorableStems, ['丙']);
  assert.deepEqual(bazi.analysis.usefulGod.conditionalUnfavorableStems, ['丁']);
  const originalUsefulGod = structuredClone(bazi.analysis.usefulGod);
  const runtime = await calculateZiweiChart(
    {
      name: '取用核验',
      gender: '男',
      dateType: 'solar',
      birthDate: '1904-01-20',
      birthTimeIndex: 0,
    },
    {
      horoscopeContext: { dateStr: '1930-09-16', hourIndex: 6 },
      scopes: ['origin', 'decadal', 'yearly'],
    },
  );
  const synthesis = buildBaziZiweiSynthesis({ bazi, ziwei: runtime });
  assert.equal(synthesis.status, '资料完整');
  assert.deepEqual(synthesis.missingFacts, []);
  const prompt = formatBaziZiweiSynthesisForPrompt(synthesis);
  assert.match(prompt, /增补五行喜忌部分判定/);
  assert.match(prompt, /条件取用：丙火用于解冻（作用对象：癸）/);
  assert.match(prompt, /干级所忌：丁/);
  assert.doesNotMatch(prompt, /主用火|首取火|喜用五行火/);
  assert.deepEqual(bazi.analysis.usefulGod, originalUsefulGod);

  bazi.analysis.usefulGod = { ...bazi.analysis.usefulGod, incrementStatus: '待判' };
  const pendingSynthesis = buildBaziZiweiSynthesis({ bazi, ziwei: runtime });
  assert.equal(pendingSynthesis.status, '资料完整');
  assert.deepEqual(pendingSynthesis.missingFacts, []);
  const pending = formatBaziZiweiSynthesisForPrompt(pendingSynthesis);
  assert.match(pending, /增补五行喜忌待判/);
  assert.match(pending, /条件取用：丙火用于解冻（作用对象：癸）/);
  assert.doesNotMatch(pending, /首取印星|首忌食伤|最终取用:/);

  const missingYearly = buildBaziZiweiSynthesis({
    bazi,
    ziwei: {
      ...runtime,
      payloadByScope: { ...runtime.payloadByScope, yearly: undefined },
    },
  });
  assert.equal(missingYearly.status, '资料有缺口');
  assert.ok(missingYearly.missingFacts.includes('运限基准年份缺少对应紫微流年'));
  const missingPrompt = formatBaziZiweiSynthesisForPrompt(missingYearly);
  assert.match(missingPrompt, /增补五行喜忌待判/);
  assert.match(missingPrompt, /条件取用：丙火用于解冻（作用对象：癸）/);
});
