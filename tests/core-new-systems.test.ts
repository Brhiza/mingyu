import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as core from '../packages/core/src/index.ts';
import { getCardEvidence } from '../packages/core/src/divination/tarot.ts';

test('ganzhi: 纳音/十二长生/六十甲子序号', () => {
  assert.equal(core.ganzhi.getNayin('甲子'), '海中金');
  assert.equal(core.ganzhi.getChangShengState('木', '亥'), '长生');
  assert.equal(core.ganzhi.getChangShengState('火', '寅'), '长生');
  assert.equal(core.ganzhi.getSixtyCycleIndex('甲子'), 0);
  assert.equal(core.ganzhi.getSixtyCycleIndex('甲戌'), 10);
  assert.equal(core.ganzhi.getSixtyCycleIndex('癸亥'), 59);
  assert.equal(core.ganzhi.diffGanZhi('甲子', '乙丑'), 1);
  assert.equal(core.ganzhi.diffGanZhi('癸亥', '甲子'), 1);
});

test('ganzhi: 干支关系复用', () => {
  assert.equal(core.ganzhi.isLiuhe('子', '丑'), true);
  assert.equal(core.ganzhi.isLiuchong('子', '午'), true);
  assert.equal(core.ganzhi.getWuxingChangSheng('水'), '申');
});

test('wuxing: 五行统计', () => {
  // 甲(木) 子(水+藏癸水) 丙(火) 午(火+藏丁火+藏己土)
  const counts = core.wuxing.tallyWuxing(['甲', '子', '丙', '午'], { weightHidden: true });
  assert.equal(counts['木'], 1);
  assert.equal(counts['水'], 2);
  assert.equal(counts['火'], 3);
});

test('ganzhi: 十二长生（土长生在寅，与八字/奇门一致）', () => {
  // 木长生在亥、火长生在寅、金长生在巳、水长生在申（不变）
  assert.equal(core.ganzhi.getChangShengState('木', '亥'), '长生');
  assert.equal(core.ganzhi.getChangShengState('火', '寅'), '长生');
  assert.equal(core.ganzhi.getChangShengState('金', '巳'), '长生');
  assert.equal(core.ganzhi.getChangShengState('水', '申'), '长生');
  // 土：统一为「土长生在寅」流派（火土同宫），与八字/奇门所用 tyme4ts 一致
  assert.equal(core.ganzhi.getChangShengState('土', '寅'), '长生');
  assert.equal(core.ganzhi.getChangShengState('土', '申'), '病'); // 寅派：土在申为病
  assert.equal(core.ganzhi.getWuxingChangSheng('土'), '寅');
});

test('direction: 八宅大游年', () => {
  const r = core.direction.getEightMansion('坎');
  assert.equal(r.group, '东四命');
  assert.equal(r.lucky.length, 4);
  assert.equal(r.unlucky.length, 4);
  assert.equal(core.direction.getHouseTrigram('子'), '坎');
  assert.equal(r.unlucky.find((item) => item.gua === '艮')?.label, '五鬼');
  assert.equal(r.unlucky.find((item) => item.gua === '兑')?.label, '祸害');
  assert.equal(r.unlucky.find((item) => item.gua === '乾')?.label, '六煞');
  assert.equal(core.direction.NINE_STARS[0].name, '一白水');
  assert.deepEqual(core.direction.FOUR_ZONES, ['东', '北', '西', '南']);
});

test('shensha: 可扩展 registry（不破坏既有系统）', () => {
  const list = core.shensha.listShensha();
  assert.ok(list.some((d) => d.id === 'kongwang'));
  const r = core.shensha.computeShensha(['kongwang'], {
    yearGanZhi: '甲子',
    monthGanZhi: '丙寅',
    dayGanZhi: '戊辰',
    hourGanZhi: '丁巳',
  });
  assert.deepEqual(r[0].value, ['戌', '亥']);
  const jiaXu = core.shensha.computeShensha(['kongwang'], {
    yearGanZhi: '甲子',
    monthGanZhi: '乙丑',
    dayGanZhi: '甲戌',
    hourGanZhi: '丁卯',
  });
  const jiaShen = core.shensha.computeShensha(['kongwang'], {
    yearGanZhi: '甲子',
    monthGanZhi: '乙丑',
    dayGanZhi: '甲申',
    hourGanZhi: '丁卯',
  });
  assert.deepEqual(jiaXu[0].value, ['申', '酉']);
  assert.deepEqual(jiaShen[0].value, ['午', '未']);
  // 自定义神煞可自由注册（地基可继续拓展）
  core.shensha.registerShensha({
    id: 'demo',
    name: '示例',
    scope: 'bazhai',
    compute: () => ({ id: 'demo', name: '示例', value: 'ok' }),
  });
  assert.ok(core.shensha.listShensha('bazhai').some((d) => d.id === 'demo'));
});

test('bazhai: 命宅配合', () => {
  const r = core.bazhai.analyzeBaZhai({ birthYear: 1990, gender: 'male', sitMountain: '子' });
  assert.equal(r.mingGua, '坎');
  assert.equal(r.houseGua, '坎');
  assert.equal(r.match, '相合');
  assert.ok(r.prompt.includes('八宅风水'));
  assert.ok(r.prompt.includes('命卦八宫明细'));
  assert.ok(r.prompt.includes('宅卦八宫明细'));
  assert.ok(r.prompt.includes('证据边界'));
  assert.equal(r.evidenceAnalysis.evidence.title, '八宅命宅方位与测量结构化证据');
  assert.equal(r.evidenceAnalysis.directionComparisons.length, 8);
  assert.match(r.prompt, /【八宅命宅方位与测量结构化证据】/);
});

test('bazhai: 从大门面向屋内的度数可直接生成传统坐向与完整八宅结果', () => {
  const r = core.bazhai.analyzeBaZhaiByDoorDegree({
    birthYear: 1990,
    birthMonth: 6,
    birthDay: 15,
    gender: 'male',
    doorToInteriorDegree: 0,
  });
  assert.equal(r.directionMeasurement.measuredDegree, 0);
  assert.equal(r.directionMeasurement.sitDegree, 0);
  assert.equal(r.directionMeasurement.sitMountain, '子');
  assert.equal(r.directionMeasurement.facingDegree, 180);
  assert.equal(r.directionMeasurement.facingMountain, '午');
  assert.equal(r.directionMeasurement.label, '子山午向');
  assert.equal(r.houseGua, '坎');
  assert.equal(r.match, '相合');
  assert.match(r.directionMeasurement.promptText, /站在大门处面向屋内/);
  assert.match(r.evidenceAnalysis.promptText, /测量事实：从大门面向屋内实测0°/);
  assert.equal(r.evidenceAnalysis.measurementFacts.length, 4);
});

test('bazhai: 入户度数便捷入口应拒绝越界、非有限值与二十四山分界线', () => {
  for (const degree of [-1, 361, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => core.bazhai.getBaZhaiSitFacingFromDoorDegree(degree),
      /0-360 之间的有限数字/,
    );
  }
  assert.throws(
    () =>
      core.bazhai.analyzeBaZhaiByDoorDegree({
        birthYear: 1990,
        gender: 'male',
        doorToInteriorDegree: 7.5,
      }),
    /分界线/,
  );
});

test('bazhai: 完整出生日期应按立春边界调整命卦年份', () => {
  const before = core.bazhai.analyzeBaZhai({
    birthYear: 1990,
    birthMonth: 2,
    birthDay: 3,
    gender: 'male',
  });
  const after = core.bazhai.analyzeBaZhai({
    birthYear: 1990,
    birthMonth: 2,
    birthDay: 10,
    gender: 'male',
  });

  assert.equal(before.effectiveBirthYear, 1989);
  assert.equal(after.effectiveBirthYear, 1990);
  assert.match(before.birthYearBoundaryNote, /立春前/);
  assert.match(after.birthYearBoundaryNote, /立春/);
  assert.notEqual(before.mingGua, after.mingGua);
});

test('zodiac: 犯太岁与流年运程', () => {
  const conflicts = core.zodiac.getTaiSuiConflicts('午', '子');
  assert.ok(conflicts.some((c) => c.type === '冲太岁'));
  const r = core.zodiac.getZodiacYearFortune('午', '甲辰');
  assert.equal(r.zodiac, '马');
  assert.ok(['大吉', '吉', '平', '凶', '大凶'].includes(r.level));
  assert.equal(r.evidenceGrade, '轻量');
  assert.equal(r.confidence, '低');
  assert.ok(r.prompt.includes('生肖与流年关系简析'));
  assert.ok(r.prompt.includes('五行来源'));
  assert.ok(r.prompt.includes('犯太岁明细'));
  assert.equal(r.evidenceAnalysis.evidence.title, '生肖流年关系矩阵结构化证据');
  assert.ok(r.evidenceAnalysis.calculationChain.length >= 4);
  assert.ok(r.evidenceAnalysis.supportingEvidence.length > 0);
  assert.match(r.prompt, /【生肖流年关系矩阵结构化证据】/);
  assert.doesNotMatch(r.prompt, /综合定级：/);
  assert.doesNotMatch(r.prompt, /印星|财星|官杀|接口兼容/);
  assert.ok(r.prompt.includes('只作生肖与流年关系层的趋势参考'));
  assert.doesNotMatch(r.prompt, /完整的事业、财运、感情或健康断语/);
});

test('zodiac: 冲太岁只作轻量风险关系，不直接判为大凶', () => {
  const result = core.zodiac.getZodiacYearFortune('午', '庚子');
  assert.ok(result.conflicts.some((item) => item.type === '冲太岁'));
  assert.ok(result.evidenceAnalysis.primaryEvidence.some((item) => item.relation === '冲太岁'));
  assert.notEqual(result.level, '大凶');
  assert.equal(result.confidence, '低');
});

test('tarot: 逐牌证据应区分正逆位、元素与牌阶', () => {
  const major = getCardEvidence('魔术师');
  const minor = getCardEvidence('权杖骑士');

  assert.match(major.uprightMeaning, /正位强调/);
  assert.match(major.reversedMeaning, /逆位重点/);
  assert.match(minor.reversedMeaning, /受阻、过度、内化或方向偏离/);
  assert.match(minor.element, /火/);
  assert.match(minor.archetype, /行动节奏/);
});

test('taiyi: 年家七十二局立成（依古籍与 Kintaiyi 逐局表校订）', () => {
  // 公元2004（甲申）：积年 10153917+2004=10155921，入纪元 321，局33 阳遁
  // 第33局：太乙艮、文昌午、始击艮；主算24、客算3。
  const r = core.taiyi.generateTaiyi({ year: 2004, scope: 'year' });
  assert.equal(r.ganZhi, '甲申');
  assert.equal(r.accumulatedYears, 10155921);
  assert.equal(r.entryYears, 321);
  assert.equal(r.yuan, 5);
  assert.equal(r.ji, 6);
  assert.equal(r.bureau, 33);
  assert.equal(r.yinYang, '阳遁');
  assert.equal(r.taiyiPosition, '艮');
  assert.equal(r.taiyiPalace, 3);
  assert.equal(r.taiyiGua, '艮');
  assert.equal(r.wenChangPosition, '午');
  assert.equal(r.wenChangPalace, 2);
  assert.equal(r.shiJiPosition, '艮');
  assert.equal(r.shiJiPalace, 3);
  assert.equal(r.lordCount, 24);
  assert.equal(r.guestCount, 3);
  assert.equal(r.setCount, 15);
  assert.equal(r.lordGeneral, 4);
  assert.equal(r.lordAssistant, 2);
  assert.equal(r.guestGeneral, 3);
  assert.equal(r.guestAssistant, 9);
  assert.equal(r.setGeneral, 5);
  assert.equal(r.setAssistant, 5);
  assert.ok(r.judgments.some((item) => item.startsWith('掩：')));
  assert.equal(r.sixteenGods.length, 16);
  assert.equal(r.model.id, 'taiyi-tongzong-five-calculations-72-table');
  assert.ok(r.prompt.includes('太乙神数'));
  assert.ok(r.prompt.includes('十六神'));
  assert.ok(r.prompt.includes('主客定算'));
  assert.ok(r.prompt.includes('将参'));
  assert.ok(r.prompt.includes('核心宫位'));
  assert.ok(r.prompt.includes('观察层级'));
  assert.match(r.evidenceAnalysis.promptText, /【太乙五计七十二局结构化证据】/);
  assert.ok(r.evidenceAnalysis.primaryFacts.some((item) => item.startsWith('掩成立')));
  assert.ok(r.evidenceAnalysis.counterEvidence.some((item) => item.startsWith('未见囚')));
  assert.match(r.evidenceAnalysis.promptText, /传统规则模型/);
  assert.doesNotMatch(
    r.evidenceAnalysis.promptText,
    /\d+(?:\.\d+)?%|成功率(?:为|：)|匹配率(?:为|：)|吉凶总分(?:为|：)/,
  );
  assert.throws(() => core.taiyi.generateTaiyi({ year: 2004, scope: 'month' }), /完整日期和时间/);
});

test('taiyi: 年月日时分五计应使用各自积数和阴阳遁规则', () => {
  const date = new Date(2026, 6, 11, 14, 35, 0);
  const scopes = ['month', 'day', 'hour', 'minute'] as const;
  const results = scopes.map((scope) => core.taiyi.generateTaiyi({ scope, date }));

  assert.deepEqual(
    results.map((item) => item.scope),
    scopes,
  );
  assert.deepEqual(
    results.map((item) => item.accumulatedLabel),
    ['积月', '积日', '积时', '积分'],
  );
  assert.equal(new Set(results.map((item) => item.accumulatedValue)).size, 4);
  assert.equal(results[0].yinYang, '阳遁');
  assert.equal(results[1].yinYang, '阳遁');
  assert.equal(results[2].yinYang, '阴遁');
  results.forEach((result) => {
    assert.ok(result.bureau >= 1 && result.bureau <= 72);
    assert.ok(
      result.prompt.includes(
        `太乙神数 · ${{ month: '月计', day: '日计', hour: '时计', minute: '分计' }[result.scope]}`,
      ),
    );
    assert.equal(result.model.supportedScopes.length, 5);
    assert.match(
      result.evidenceAnalysis.calculationChain[0],
      new RegExp(
        `${
          {
            month: '月计',
            day: '日计',
            hour: '时计',
            minute: '分计',
          }[result.scope]
        }以`,
      ),
    );
    assert.ok(result.evidenceAnalysis.limitations.some((item) => item.includes('不可互相替代')));
  });
});

test('taiyi: 未见掩囚时应明确输出反证而非省略', () => {
  const result = Array.from({ length: 72 }, (_, offset) =>
    core.taiyi.generateTaiyi({ year: 1950 + offset }),
  ).find(
    (item) => item.shiJiPalace !== item.taiyiPalace && item.wenChangPalace !== item.taiyiPalace,
  );

  assert.ok(result);
  assert.ok(result.evidenceAnalysis.counterEvidence.some((item) => item.startsWith('未见掩')));
  assert.ok(result.evidenceAnalysis.counterEvidence.some((item) => item.startsWith('未见囚')));
  assert.match(result.evidenceAnalysis.promptText, /反证核验：未见掩/);
});

test('taiyi: 年家 72 局应完整覆盖且宫卦名不与字位混用', () => {
  const palaces = new Map<number, string>();
  const bureaus = new Set<number>();

  for (let year = 1950; year < 2022; year += 1) {
    const result = core.taiyi.generateTaiyi({ year });
    bureaus.add(result.bureau);
    palaces.set(result.taiyiPalace, result.taiyiGua);
  }

  assert.equal(bureaus.size, 72);
  assert.deepEqual(Object.fromEntries([...palaces].sort(([left], [right]) => left - right)), {
    1: '乾',
    2: '离',
    3: '艮',
    4: '震',
    6: '兑',
    7: '坤',
    8: '坎',
    9: '巽',
  });
});

test('taiyi: 核心年份边界不应把公元 1-99 年当成 1901-1999 年', () => {
  const earlyYear = core.taiyi.generateTaiyi({ year: 1 });
  const modernYear = core.taiyi.generateTaiyi({ year: 1901 });

  assert.notEqual(earlyYear.ganZhi, modernYear.ganZhi);
  assert.equal(earlyYear.accumulatedYears, 10153918);
});

test('qizheng: 七政四余与《七政算内篇》紫炁模型', () => {
  // 2024-06-15 12:00 北京：太阳约在寅宫，午时生 → 命宫亥(11)、命主木（亥→木）；七政7、四余4
  const r = core.qizheng.generateQizheng({ year: 2024, month: 6, day: 15, hour: 12 });
  const qi = r.stars.filter((s) => s.kind === '七政');
  const yu = r.stars.filter((s) => s.kind === '四余');
  assert.equal(qi.length, 7);
  assert.equal(yu.length, 4);
  assert.equal(new Set(r.stars.map((star) => star.name)).size, 11);
  assert.equal(
    r.stars.some((star) => star.name.includes('紫炁')),
    true,
  );
  assert.equal(r.ziqiModel.id, 'qizhengsuan-naepyeon-mean-motion');
  assert.equal(r.ziqiModel.direction, '顺行');
  assert.equal(r.ziqiModel.periodDays, 10227.1792);
  assert.equal(r.ziqiModel.sources.filter((source) => source.usage === '采用').length, 4);
  assert.equal(r.ziqiModel.sources.filter((source) => source.usage === '未采用').length, 2);
  assert.ok(
    Math.abs(
      core.qizheng.calculateZiqiTropicalLongitude({
        year: 1995,
        month: 12,
        day: 31,
        hour: 8,
        timezone: 8,
      }) - 237.038993,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      r.ziqi.tropicalLongitude -
        r.stars.find((star) => star.name.includes('紫炁'))!.tropicalLongitude,
    ) < 1e-9,
  );
  assert.ok(r.ziqi.cycleProgress >= 0 && r.ziqi.cycleProgress < 1);
  assert.ok(
    r.ziqi.daysSinceZeroLongitude >= 0 && r.ziqi.daysSinceZeroLongitude < r.ziqiModel.periodDays,
  );
  assert.equal(r.mingGong, 11);
  assert.equal(r.mingZhu, '木');
  assert.ok(r.stars.every((star) => star.sevenStar.length === 1));
  assert.ok(r.aspects.length > 0);
  assert.ok(
    r.aspects.every(
      (aspect) =>
        aspect.orb >= 0 && aspect.orbRatio >= 0 && aspect.orbRatio <= 1 && aspect.strength >= 0,
    ),
  );
  assert.ok(
    r.aspects.every(
      (aspect, index) => index === 0 || r.aspects[index - 1].orbRatio <= aspect.orbRatio,
    ),
  );
  assert.ok(
    r.aspects
      .filter((aspect) => aspect.star1.includes('紫炁') || aspect.star2.includes('紫炁'))
      .every((aspect) => aspect.precisionClass === '混合模型'),
  );
  assert.ok(Math.abs(core.qizheng.getPrecessionOffset(2024) - 0.3353) < 0.001);
  assert.equal(r.shensha.find((item) => item.name === '孤辰')?.value, '巳');
  assert.equal(r.shensha.find((item) => item.name === '寡宿')?.value, '丑');
  assert.ok(r.prompt.includes('七政四余'));
  assert.ok(r.prompt.includes('《七政算内篇》紫炁古法均速'));
  assert.ok(r.prompt.includes('紫炁位置：顺行'));
  assert.ok(r.prompt.includes('出生时空'));
  assert.ok(r.prompt.includes('十二宫映射'));
  assert.ok(r.prompt.includes('七政四余吊照'));
  assert.ok(r.prompt.includes('坐标与精度边界'));
  assert.ok(r.prompt.includes('不得替换成月孛对冲'));
  assert.equal(r.positionSources.length, 4);
  assert.equal(r.stars.find((star) => star.name === '太阳')?.sourceId, 'celestine-planets');
  assert.equal(r.stars.find((star) => star.name.includes('罗睺'))?.sourceId, 'celestine-true-node');
  assert.equal(
    r.stars.find((star) => star.name.includes('月孛'))?.sourceId,
    'celestine-true-lilith',
  );
  assert.equal(r.stars.find((star) => star.name.includes('紫炁'))?.precisionClass, '传统均速模型');
  assert.equal(r.calculationContext.locationSource, '默认北京坐标');
  assert.equal(r.calculationContext.timezoneSource, '默认东八区');
  assert.match(r.calculationContext.astronomicalTime.utcDateTime, /Z$/);
  assert.ok(r.calculationContext.astronomicalTime.julianDayUtc > 2400000);
  assert.ok(r.calculationContext.moonPhase.phaseAngleDegrees >= 0);
  assert.ok(r.calculationContext.moonPhase.phaseAngleDegrees < 360);
  assert.match(r.prompt, /天文时间尺度：/);
  assert.match(r.prompt, /月相证据：/);
  assert.match(r.prompt, /JD\(TT\)/);
  assert.match(r.evidenceAnalysis.promptText, /【七政四余计算来源与证据分层】/);
  assert.match(r.evidenceAnalysis.promptText, /现代天文计算/);
  assert.match(r.evidenceAnalysis.promptText, /传统均速模型/);
  assert.doesNotMatch(r.prompt, /强度\d+%|成功率[：=]?\d|吉凶总分[：=]?\d/);
});

test('qizheng: 用户地点与默认地点必须在计算上下文中明确区分', () => {
  const supplied = core.qizheng.generateQizheng({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    latitude: 31.23,
    longitude: 121.47,
    timezone: 8,
  });
  assert.equal(supplied.calculationContext.locationSource, '用户提供');
  assert.equal(supplied.calculationContext.timezoneSource, '用户提供');

  const partial = core.qizheng.generateQizheng({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    latitude: 31.23,
  });
  assert.equal(partial.calculationContext.locationSource, '部分坐标使用默认值');
  assert.match(partial.evidenceAnalysis.limitations.join('\n'), /部分坐标使用默认值/);
});

test('qizheng: 核心入口应拒绝不存在日期、越界时间坐标和非有限数字', () => {
  const valid = { year: 2024, month: 6, day: 15, hour: 12 };
  assert.throws(() => core.qizheng.generateQizheng({ ...valid, day: 31 }), /日期需在 1-30 之间/);
  assert.throws(() => core.qizheng.generateQizheng({ ...valid, hour: 24 }), /小时需在 0-23 之间/);
  assert.throws(
    () => core.qizheng.generateQizheng({ ...valid, latitude: Number.NaN }),
    /纬度需在 -90 到 90 之间/,
  );
  assert.throws(
    () => core.qizheng.generateQizheng({ ...valid, longitude: 181 }),
    /经度需在 -180 到 180 之间/,
  );
  assert.throws(
    () => core.qizheng.generateQizheng({ ...valid, timezone: 15 }),
    /时区需在 -12 到 14 之间/,
  );
  assert.throws(
    () => core.qizheng.calculateZiqiTropicalLongitude({ ...valid, minute: Number.NaN }),
    /分钟需在 0-59 之间/,
  );
  assert.throws(() => core.qizheng.getPrecessionOffset(Number.NaN), /岁差年份必须是有效数字/);
});

test('ganzhi: tyme4ts 权威后端（纳音/干支五行/合冲害/十神）', () => {
  // 纳音委托 tyme4ts（与《纳音歌》一致）
  assert.equal(core.ganzhi.getNayin('甲子'), '海中金');
  assert.equal(core.ganzhi.getNayin('庚午'), '路旁土');
  // 干支五行委托 tyme4ts
  assert.equal(core.ganzhi.getStemWuxing('甲'), '木');
  assert.equal(core.ganzhi.getBranchWuxing('子'), '水');
  // 地支六合/六冲委托 tyme4ts
  assert.equal(core.ganzhi.isLiuhe('子', '丑'), true);
  assert.equal(core.ganzhi.isLiuchong('子', '午'), true);
  assert.equal(core.ganzhi.isLiuhai('子', '未'), true);
  // 天干五合委托 tyme4ts
  assert.equal(core.ganzhi.isTianGanHe('甲', '己'), true);
  // 十神（新增，委托 tyme4ts）
  assert.equal(core.ganzhi.getTenStar('甲', '甲'), '比肩');
  assert.equal(core.ganzhi.getTenStar('甲', '乙'), '劫财');
});

test('shensha: 黄历神煞层（委托 tyme4ts 151 神煞）', () => {
  const names = core.shensha.listHuangliShenshaNames();
  assert.ok(names.length >= 100, `黄历神煞应≥100，实为 ${names.length}`);
  const info = core.shensha.getHuangliShensha(2026, 7, 10);
  assert.ok(info.shensha.length > 0, '应命中若干黄历神煞');
  assert.ok(['吉', '凶', '平'].includes(info.shensha[0].luck), '神煞应带吉凶分类');
  assert.ok(info.duty.length > 0, '应有十二建除');
  assert.ok(info.nineStar.length > 0, '应有九星');
  // 命理注册表仍可用（空亡/驿马/桃花）
  const ctx = {
    yearGanZhi: '甲子',
    monthGanZhi: '乙丑',
    dayGanZhi: '丙寅',
    hourGanZhi: '丁卯',
  };
  const kw = core.shensha.computeShensha(['kongwang'], ctx);
  assert.equal(kw[0].name, '空亡');
});
