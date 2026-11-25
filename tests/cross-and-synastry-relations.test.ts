import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildMethodSituationDigest } from '../src/systems/situation-digest';
import { buildZiweiSynastryFlyingBalance } from '../src/systems/ziwei-synastry';
import { evaluateBaziZiweiCorroboration, formatCrossSystemBalanceSection } from '../src/systems/bazi-ziwei-corroboration';

const personA = {
  name: '甲造',
  gender: 'male' as const,
  year: 1990,
  month: 5,
  day: 15,
  clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 },
  timezone: 8,
};

const personB = {
  name: '乙造',
  gender: 'female' as const,
  year: 1992,
  month: 8,
  day: 12,
  clock: { kind: 'exact' as const, hour: 9, minute: 0, second: 0 },
  timezone: 8,
};

test('bazi-synastry 输出【双盘喜忌互补与干支制衡关系】及结构化 synastryBalance', async () => {
  const result = (await calculate('bazi-synastry', {
    question: '双方婚恋契合度与磨合点是什么？',
    relationship: 'marriage',
    person1: personA,
    person2: personB,
  })) as any;

  const bal = result.data.compatibility.synastryBalance;
  assert.ok(bal);
  assert.ok(
    ['双向互补', '单向补益（第一人补第二人）', '单向补益（第二人补第一人）', '未见有效互补', '用神未完整裁定'].includes(
      bal.usefulDirection,
    ),
  );
  assert.ok(
    ['天地德合', '天克地冲', '合中有冲（外合内冲）', '克中有合（外克内合）', '日柱合和', '日柱冲刑害', '日柱平和'].includes(
      bal.dayPillarPattern,
    ),
  );
  assert.ok(['合多于冲', '冲刑多于合', '合冲并见', '干支平和'].includes(bal.overallBalanceTag));
  assert.equal(typeof bal.harmonyCount, 'number');
  assert.equal(typeof bal.clashHarmCount, 'number');

  assert.match(result.prompt.text, /【双盘喜忌互补与干支制衡关系】/);
  assert.match(result.prompt.text, /喜用互补方向：/);
  assert.match(result.prompt.text, /日柱与月柱互动：/);
  assert.match(result.prompt.text, /干支合冲制衡：/);
  assert.match(result.prompt.text, /【局势要点】/);
  assert.match(result.prompt.text, /干支制衡：/);

  // 验证 reprompt 校验与一致性
  const saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'bazi-synastry', result: saved, question: '追问月柱磨合？' });
  assert.match(next.prompt.text, /【双盘喜忌互补与干支制衡关系】/);
});

test('ziwei-synastry 默认输出【双向飞化与宫位制衡关系】且局势要点修复非命宫叠合筛选', async () => {
  const result = (await calculate('ziwei-synastry', {
    question: '双方婚恋互动与付出是否对等？',
    relationship: 'marriage',
    person1: {
      name: '甲造',
      gender: 'female',
      birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    },
    person2: {
      name: '乙造',
      gender: 'male',
      birth: { year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8 },
    },
  })) as any;

  const fb = result.data.selected.evidence.flyingBalance;
  assert.ok(fb);
  assert.ok(
    ['双向互禄', '单向付出（第一人→第二人）', '单向付出（第二人→第一人）', '未见核心宫位互禄'].includes(fb.luPattern),
  );
  assert.ok(Array.isArray(fb.jiModulations));
  assert.ok(fb.coreOverlays.length >= 2);

  // 未开启 feixing 流派时也应默认输出【双向飞化与宫位制衡关系】
  assert.match(result.prompt.text, /【双向飞化与宫位制衡关系】/);
  assert.match(result.prompt.text, /互禄与付出方向：/);
  assert.match(result.prompt.text, /飞忌冲击与缓解制衡：/);
  assert.match(result.prompt.text, /双向飞化制衡：/);

  // 验证 situation-digest 已修复非「命宫」宫名（如夫妻、福德）叠合筛选
  const digest = buildMethodSituationDigest('ziwei-synastry', result.data, '婚恋合盘');
  const overlayLine = digest.find((line) => line.startsWith('重点宫位叠合：'));
  assert.ok(overlayLine, '应输出重点宫位叠合');
  assert.match(overlayLine, /命宫|夫妻|福德/);

  // 独立验证飞忌有缓解与无明解分支
  const directBalance = buildZiweiSynastryFlyingBalance(
    result.data.selected.natal.person1,
    result.data.selected.natal.person2,
    'career',
  );
  assert.equal(directBalance.relationship, 'career');
  for (const item of directBalance.jiModulations) {
    assert.ok(item.status === '有缓解' || item.status === '无明解');
    if (item.status === '有缓解') assert.ok(item.reliefFactors.length > 0);
    else assert.equal(item.reliefFactors.length, 0);
  }
});

test('bazi-ziwei 输出【跨体系同向共振与分歧制衡】且修复顶部【局势要点】为空的 bug', async () => {
  const result = (await calculate('bazi-ziwei', {
    question: '综合评估事业格局与潜在风险点？',
    gender: 'male',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
  })) as any;

  assert.ok(result.data.corroboration.crossSystemBalance);
  assert.equal(result.data.corroboration.crossSystemBalance.dataStatus, '双盘格局资料完整');
  assert.match(result.prompt.text, /【跨体系同向共振与分歧制衡】/);
  assert.match(result.prompt.text, /【局势要点】/);
  assert.match(result.prompt.text, /命局骨架：/);

  const section = formatCrossSystemBalanceSection(result.data.corroboration);
  assert.match(section, /资料状态：双盘格局资料完整/);
  assert.match(section, /同向共振/);
  assert.match(section, /分歧制衡/);

  // 极简 mock 输入向后兼容：不报错且标注部分格局资料缺项
  const minimal = evaluateBaziZiweiCorroboration(
    {
      pillars: { year: { zhi: '子' }, month: { zhi: '卯' }, day: { zhi: '午' }, hour: { zhi: '酉' } },
      shensha: { entries: [{ name: '天乙贵人', position: 'year' }] },
      strength: { status: '身强' },
    },
    { natal: { palaces: [] } },
  );
  assert.equal(minimal.crossSystemBalance.dataStatus, '部分格局资料缺项');
});

test('fortune 修复紫微流年落宫取值与 situation-digest 综合分字段读取', async () => {
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const targetIso = '2026-11-19T12:00:00+08:00';
  const [fRes, zwRes] = (await Promise.all([
    calculate('fortune', {
      scope: 'daily',
      target: { year: 2026, month: 11, day: 19 },
      birth,
      gender: 'female',
      question: '今日运势如何？',
    }),
    calculate('ziwei', {
      birth,
      gender: 'female',
      referenceTime: targetIso,
      question: '核对流年落宫',
    }),
  ])) as any[];

  const expectedYearlyNatalPalace = zwRes.data.natal.palaces[zwRes.data.reference.layers.yearly.index].name;
  assert.equal(fRes.data.ziweiSummary.yearlyPalace, expectedYearlyNatalPalace);

  const digest = buildMethodSituationDigest('fortune', fRes.data, '今日运势如何？');
  assert.ok(digest.length >= 1);
  assert.match(digest[0], new RegExp(`综合分 ${fRes.data.overview.overallScore}`));
});

test('situation-digest 精炼提炼八字、紫微、奇门、六爻、大六壬与梅花最新核心制衡关系', async () => {
  // 1. 八字（核心制衡：格局协同/病药制衡）
  const bz = (await calculate('bazi', {
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    question: '事业格局如何？',
  })) as any;
  const bzDigest = buildMethodSituationDigest('bazi', bz.data, '事业格局如何？');
  assert.ok(bzDigest.some((l) => l.startsWith('命局骨架：')));
  assert.ok(bzDigest.some((l) => l.startsWith('核心制衡：')));

  // 2. 紫微单盘（吉格受破 / 凶格救应 / 格局协同）
  const zw = (await calculate('ziwei', {
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    question: '格局成败如何？',
  })) as any;
  const zwDigest = buildMethodSituationDigest('ziwei', zw.data, '格局成败如何？');
  assert.ok(zwDigest.some((l) => l.startsWith('命盘骨架：')));
  assert.ok(zwDigest.some((l) => l.startsWith('格局制衡：')));

  // 3. 奇门（含五不遇时 / 吉格折损 / 凶格救应）
  const qm = (await calculate('qimen', {
    currentTime: '2026-06-15T04:00:00Z',
    divinationTime: '2026-06-15T04:00:00Z',
    question: '这次合作能否顺利推进？',
  })) as any;
  const qmDigest = buildMethodSituationDigest('qimen', qm.data, '这次合作能否顺利推进？');
  assert.ok(qmDigest.some((l) => l.startsWith('局势总览：')));
  assert.ok(qmDigest.some((l) => l.startsWith('格局制衡：')));
  // 显式测试五不遇时进入局势要点
  const qmWubu = buildMethodSituationDigest(
    'qimen',
    { ...qm.data, specialConditions: { ...qm.data.specialConditions, isWuBuYuShi: true } },
    '能否推进？',
  );
  assert.ok(qmWubu.some((l) => l.includes('五不遇时')));

  // 4. 六爻（世应与动变制衡）
  const ly = (await calculate('liuyao', {
    currentTime: '2026-06-15T04:00:00Z',
    liuyao: { method: 'manual', yaos: [7, 8, 9, 7, 8, 6] },
    question: '近期求财能否落袋？',
  })) as any;
  const lyDigest = buildMethodSituationDigest('liuyao', ly.data, '近期求财能否落袋？');
  assert.ok(lyDigest.some((l) => l.startsWith('制衡要点：')));

  // 5. 大六壬（三传阶段制衡）
  const lr = (await calculate('liuren', {
    divinationTime: '2026-06-15T04:00:00Z',
    question: '这笔项目推进走势如何？',
  })) as any;
  const lrDigest = buildMethodSituationDigest('liuren', lr.data, '这笔项目推进走势如何？');
  assert.ok(lrDigest.some((l) => l.startsWith('三传制衡：')));

  // 6. 梅花易数（三阶段走势与月令制衡）
  const mh = (await calculate('meihua', {
    currentTime: '2026-06-15T04:00:00Z',
    meihua: { method: 'time' },
    question: '这次沟通结果如何？',
  })) as any;
  const mhDigest = buildMethodSituationDigest('meihua', mh.data, '这次沟通结果如何？');
  assert.ok(mhDigest.some((l) => l.startsWith('阶段制衡：')));
});
