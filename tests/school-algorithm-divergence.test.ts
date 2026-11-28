import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildNatalFacts } from '../src/systems/bazi/natal-facts';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildOrdinaryPattern, summarizePattern } from '../src/systems/bazi/pattern';
import { buildTransformation } from '../src/systems/bazi/transformation';
import { buildQuzhi } from '../src/systems/bazi/quzhi';
import { buildCongEr } from '../src/systems/bazi/conger';
import { buildExtremePattern } from '../src/systems/bazi/extreme';
import { buildUsefulBaseline } from '../src/systems/bazi/useful-baseline';
import { buildClimateCandidates, ensureClimateRulesLoaded } from '../src/systems/bazi/climate';

await ensureClimateRulesLoaded();
import { resolveClimate } from '../src/systems/bazi/climate-decision';
import { buildPatternEvidence } from '../src/systems/bazi/pattern-evidence';
import { determineUsefulGod } from '../src/systems/bazi/useful-god';
import {
  buildSchoolConsensusSummary,
  evaluateBaziSchoolAlgorithms,
} from '../src/systems/bazi/school-algorithms';
import {
  evaluateLiurenSchoolAlgorithms,
  evaluateLiuyaoSchoolAlgorithms,
  evaluateMeihuaSchoolAlgorithms,
  evaluateQimenSchoolAlgorithms,
  evaluateZiweiSchoolAlgorithms,
  formatSchoolAlgorithmSection,
} from '../src/systems/school-algorithms';

function buildBaziChart(
  names: { year: string; month: string; day: string; hour: string },
  commanderStem: string,
  overrides?: {
    strengthStatus?: string;
    currentJieqi?: string;
  },
) {
  const pillars = buildPillarFacts(names);
  const natalFacts = buildNatalFacts(pillars, commanderStem);
  const strength = {
    ...buildDayMasterStrength(pillars, commanderStem),
    ...(overrides?.strengthStatus ? { status: overrides.strengthStatus } : {}),
  };
  const ordinaryPattern = buildOrdinaryPattern(pillars, commanderStem);
  const transformation = buildTransformation(pillars, strength);
  const quzhi = buildQuzhi(pillars);
  const conger = buildCongEr(pillars, strength, commanderStem);
  const extreme = buildExtremePattern(pillars, strength, commanderStem, quzhi, conger);
  const patternOverview = summarizePattern(ordinaryPattern, transformation, quzhi, conger, extreme);
  const patternEvidence = buildPatternEvidence(pillars, patternOverview, commanderStem, strength.status);
  const usefulBaseline = buildUsefulBaseline(pillars, strength, patternOverview, transformation);
  const climate = buildClimateCandidates(pillars, strength, patternOverview, overrides?.currentJieqi);
  const climateDecision = resolveClimate(climate.candidates, usefulBaseline);
  const usefulGod = determineUsefulGod({
    pillars,
    strength,
    patternOverview,
    patternEvidence,
    transformation,
    climate,
    climateDecision,
    monthCommander: { stem: commanderStem },
  });
  return {
    pillars,
    monthCommander: { branch: pillars.month.zhi, stem: commanderStem },
    natalFacts,
    strength,
    ordinaryPattern,
    patternOverview,
    patternEvidence,
    climate,
    usefulGod,
  };
}

test('同盘五流派各自产出独立 structuredVerdict 且焦点与立场真正分化', () => {
  const chart = buildBaziChart(
    { year: '丙寅', month: '戊辰', day: '甲戌', hour: '丁卯' },
    '戊',
  );
  const evals = evaluateBaziSchoolAlgorithms(chart, ['ziping', 'geju', 'tiaohou', 'mangpai', 'xinpai']);
  assert.equal(evals.length, 5);

  const focuses = new Set<string>();
  const stances = new Set<string>();
  for (const item of evals) {
    assert.ok(item.structuredVerdict, `${item.school} 应包含 structuredVerdict`);
    assert.equal(typeof item.structuredVerdict.score, 'number');
    assert.ok(item.structuredVerdict.score! >= 10 && item.structuredVerdict.score! <= 98);
    assert.ok(item.structuredVerdict.keyConclusion.length > 5);
    focuses.add(item.structuredVerdict.primaryFocus);
    stances.add(item.structuredVerdict.stance);
  }
  assert.equal(focuses.size, 5, '五大流派应有各自独立的算法焦点');
  assert.equal(stances.size, 5, '五大流派应算出各自独立的立场裁定');

  const consensus = buildSchoolConsensusSummary(evals);
  assert.ok(consensus.formattedText.includes('【跨流派共识与分歧研判】'));
  assert.ok(consensus.consensus.length > 0 || consensus.divergences.length > 0);

  const section = formatSchoolAlgorithmSection(evals, consensus.formattedText);
  assert.match(section, /结构化裁定：\[立场=/);
  assert.match(section, /【跨流派共识与分歧研判】/);
});

test('新派月令空亡反断重算：月支落日空改看年支引发旺衰反转，并与子平派产出分歧根因', () => {
  // 甲子日旬空戌、亥；月柱乙亥（月支亥水生木、传统可判身强），年柱庚申（年支申金克甲木），日支子虽生但设时柱辛酉强克
  // 在传统强行设身强对照下，新派因月支亥落日空改看年支申金（七杀克身）+ 时干辛（正官克身），重算转为新派身弱！
  const chart = buildBaziChart(
    { year: '庚申', month: '乙亥', day: '甲戌', hour: '辛未' },
    '壬',
    { strengthStatus: '身强' },
  );
  // 校验甲戌日旬空为申、酉；改为甲子日（旬空戌、亥）确保月支亥落日空，年支申金克身、日支子虽生但时干辛酉克身
  const chartVoidMonth = buildBaziChart(
    { year: '庚申', month: '己亥', day: '甲子', hour: '辛酉' },
    '壬',
    { strengthStatus: '身强' },
  );
  // 确认 chart 未报错且 chartVoidMonth 月支亥在甲子日旬空
  assert.ok(chart.pillars.month.zhi);
  assert.ok(chartVoidMonth.pillars.day.voidBranches.includes('亥'));

  const evals = evaluateBaziSchoolAlgorithms(chartVoidMonth, ['ziping', 'xinpai']);
  const ziping = evals.find((e) => e.school === 'ziping')!;
  const xinpai = evals.find((e) => e.school === 'xinpai')!;

  assert.match(ziping.structuredVerdict!.stance, /扶抑抑强/);
  assert.match(xinpai.structuredVerdict!.stance, /新派身弱.*月空改看年支/);
  assert.ok(
    xinpai.structuredVerdict!.riskSignals.some((r) => r.includes('反转')),
    '新派应明确标出旺衰反转风险信号',
  );

  const summary = buildSchoolConsensusSummary(evals);
  const strengthDiff = summary.divergences.find((d) => d.topic.includes('旺衰与喜用五行立场相反'));
  assert.ok(strengthDiff, '共识分歧汇总应检出子平与新派旺衰立场相反');
  assert.match(strengthDiff.rootCause, /月令空亡反断机制差异/);
});

test('格局派独立算法：区分上格清纯 vs 破格待救，且独立算出相神与破格忌神', () => {
  // 正官格配财印无伤官七杀：上格清纯（甲日主生于酉月正官，年干己正财、时干癸正印护官）
  const pureChart = buildBaziChart(
    { year: '己丑', month: '癸酉', day: '甲辰', hour: '丁卯' },
    '辛',
  );
  // 改为无伤官丁火的版本，彻底清纯：时柱壬申/癸亥
  const pureOfficer = buildBaziChart(
    { year: '己丑', month: '癸酉', day: '甲子', hour: '己巳' },
    '辛',
  );
  // 正官格见伤官丁火且无印星救应：破格待救
  const brokenOfficer = buildBaziChart(
    { year: '丙午', month: '丁酉', day: '甲午', hour: '丁卯' },
    '辛',
  );
  assert.ok(pureChart.pillars.day.gan);

  const [pureGeju] = evaluateBaziSchoolAlgorithms(pureOfficer, ['geju']);
  const [brokenGeju] = evaluateBaziSchoolAlgorithms(brokenOfficer, ['geju']);

  assert.match(pureGeju.structuredVerdict!.stance, /上格清纯|成格微瑕/);
  assert.match(brokenGeju.structuredVerdict!.stance, /破格待救/);
  assert.ok(
    (pureGeju.structuredVerdict!.score ?? 0) > (brokenGeju.structuredVerdict!.score ?? 0) + 20,
    '上格清纯格局分应显著高于破格待救',
  );
  assert.ok(brokenGeju.structuredVerdict!.riskSignals.some((r) => r.includes('伤官')));
});

test('调候派独立算法：冬令极寒(极急喜火) vs 夏令极燥(极急喜水) vs 仲春(从缓)，并检出调候与扶抑冲突', () => {
  // 冬令子月极寒
  const winterChart = buildBaziChart({ year: '壬子', month: '壬子', day: '甲子', hour: '癸酉' }, '癸');
  // 夏令午月极燥，庚金身弱（扶抑喜土金忌水，但调候极急喜水）
  const summerConflict = buildBaziChart(
    { year: '丙午', month: '甲午', day: '庚寅', hour: '丁亥' },
    '丁',
    { strengthStatus: '身弱', currentJieqi: '芒种' },
  );
  // 仲春卯月从缓
  const springChart = buildBaziChart({ year: '乙卯', month: '己卯', day: '甲午', hour: '丙寅' }, '乙');

  const [winterTiaohou] = evaluateBaziSchoolAlgorithms(winterChart, ['tiaohou']);
  const [springTiaohou] = evaluateBaziSchoolAlgorithms(springChart, ['tiaohou']);
  const summerEvals = evaluateBaziSchoolAlgorithms(summerConflict, ['ziping', 'tiaohou']);
  const summerTiaohou = summerEvals.find((e) => e.school === 'tiaohou')!;

  assert.match(winterTiaohou.structuredVerdict!.stance, /调候极急.*冬令极寒.*首选火/);
  assert.match(summerTiaohou.structuredVerdict!.stance, /调候极急.*夏令极燥.*首选水/);
  assert.match(springTiaohou.structuredVerdict!.stance, /调候从缓/);
  assert.ok(
    (winterTiaohou.structuredVerdict!.score ?? 100) < (springTiaohou.structuredVerdict!.score ?? 0),
    '冬令缺火极寒调候分应低于仲春平和盘',
  );

  const summary = buildSchoolConsensusSummary(summerEvals);
  assert.ok(
    summary.divergences.some((d) => d.topic.includes('调候主药与扶抑喜忌冲突')),
    '夏燥身弱庚金应检出调候喜水与扶抑忌水冲突',
  );
});

test('盲派做功量化评分引擎：主位开财库+化用高分 vs 宾位冲穿反制扣分', () => {
  // 辰戌冲开主宾财库 + 食伤生财化用
  const highWorkChart = buildBaziChart({ year: '丙寅', month: '戊辰', day: '甲戌', hour: '丁卯' }, '戊');
  // 宾位子水与主位未土相穿（子未害），且无开库制宾
  const lowWorkChart = buildBaziChart({ year: '壬子', month: '壬子', day: '甲寅', hour: '甲子' }, '癸');

  const [highMang] = evaluateBaziSchoolAlgorithms(highWorkChart, ['mangpai']);
  const [lowMang] = evaluateBaziSchoolAlgorithms(lowWorkChart, ['mangpai']);

  assert.match(highMang.structuredVerdict!.stance, /主位开财官库做功/);
  assert.ok((highMang.structuredVerdict!.score ?? 0) >= 75);
  assert.ok(
    (highMang.structuredVerdict!.score ?? 0) > (lowMang.structuredVerdict!.score ?? 0) + 25,
    '开财库+化用做功分应远高于无做功盘',
  );
});

test('端到端八字五流派提示词渲染包含结构化裁定与跨流派共识分歧研判', async () => {
  const result = (await calculate('bazi', {
    question: '多流派对比分析事业财运',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    prompt: { schools: ['ziping', 'geju', 'tiaohou', 'mangpai', 'xinpai'] },
  })) as { prompt: { text: string } };

  assert.match(result.prompt.text, /｜结构化裁定：\[立场=/);
  assert.match(result.prompt.text, /【跨流派共识与分歧研判】/);
});

test('非八字核心术数（紫微/奇门/六爻/大六壬/梅花）流派均产出差异化 structuredVerdict 与量化分', async () => {
  // 1. 紫微斗数四流派
  const zw = (await calculate('ziwei', {
    question: '综合看命局',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
  })) as { data: Parameters<typeof evaluateZiweiSchoolAlgorithms>[0] };
  const zwEvals = evaluateZiweiSchoolAlgorithms(zw.data, ['sanhe', 'feixing', 'sihua', 'zhongzhou']);
  assert.equal(zwEvals.length, 4);
  assert.equal(new Set(zwEvals.map((e) => e.structuredVerdict?.primaryFocus)).size, 4);
  for (const e of zwEvals) {
    assert.equal(typeof e.structuredVerdict?.score, 'number');
  }

  // 2. 奇门遁甲三流派（门迫/击刑/入墓/空亡扣分）
  const qm = (await calculate('qimen', {
    question: '项目推进成败',
    divinationTime: '2026-11-19T14:30:00+08:00',
  })) as { data: Parameters<typeof evaluateQimenSchoolAlgorithms>[0] };
  const qmEvals = evaluateQimenSchoolAlgorithms(qm.data, ['gongwei', 'geju', 'zhuke']);
  assert.equal(qmEvals.length, 3);
  assert.equal(new Set(qmEvals.map((e) => e.structuredVerdict?.primaryFocus)).size, 3);
  for (const e of qmEvals) {
    assert.equal(typeof e.structuredVerdict?.score, 'number');
  }

  // 3. 六爻三流派（《增删卜易》 vs 《卜筮正宗》 vs 《火珠林》）
  const lyEvals = evaluateLiuyaoSchoolAlgorithms(
    {
      monthBranch: '寅',
      dayBranch: '午',
      focusRelative: '妻财',
      yaosDetail: [
        { position: 1, sixRelative: '子孙', sixGod: '青龙', najiaDizhi: '寅', najiaWuxing: '木', isChanging: true, changeDirection: '化进神', seasonState: '旺' },
        { position: 2, sixRelative: '妻财', sixGod: '朱雀', najiaDizhi: '午', najiaWuxing: '火', isShi: true, seasonState: '相' },
        { position: 5, sixRelative: '兄弟', sixGod: '白虎', najiaDizhi: '子', najiaWuxing: '水', isYing: true, seasonState: '休', isMonthBreak: false },
      ],
    },
    ['zengshanbuyi', 'bushizhengzong', 'huozhulin'],
  );
  assert.equal(lyEvals.length, 3);
  assert.equal(new Set(lyEvals.map((e) => e.structuredVerdict?.primaryFocus)).size, 3);
  // 世爻午火受应爻子水相克：《火珠林》重世应应克世得分低于《增删卜易》重旺相动进
  const zengshan = lyEvals.find((e) => e.school === 'zengshanbuyi')!;
  const huozhulin = lyEvals.find((e) => e.school === 'huozhulin')!;
  assert.ok(
    (zengshan.structuredVerdict!.score ?? 0) > (huozhulin.structuredVerdict!.score ?? 0),
    '用神旺相动进而应克世时，《增删卜易》评分应高于重世应主客的《火珠林》',
  );

  // 4. 大六壬三流派（三传走势评分 vs 四课交涉分 vs 天将神煞分）
  const lr = (await calculate('liuren', {
    question: '合作前景',
    divinationTime: '2026-11-19T14:30:00+08:00',
  })) as { data: Parameters<typeof evaluateLiurenSchoolAlgorithms>[0] };
  const lrEvals = evaluateLiurenSchoolAlgorithms(lr.data, ['keti', 'bifafu', 'leishen']);
  assert.equal(lrEvals.length, 3);
  assert.equal(new Set(lrEvals.map((e) => e.structuredVerdict?.primaryFocus)).size, 3);
  for (const e of lrEvals) {
    assert.equal(typeof e.structuredVerdict?.score, 'number');
  }

  // 5. 梅花易数三流派（本互变三段体用走势评分）
  const mh = (await calculate('meihua', {
    question: '近期求财走势',
    divinationTime: '2026-11-19T14:30:00+08:00',
  })) as { data: Parameters<typeof evaluateMeihuaSchoolAlgorithms>[0] };
  const mhEvals = evaluateMeihuaSchoolAlgorithms(mh.data, ['tiyong', 'xiangshu', 'yaoci']);
  assert.equal(mhEvals.length, 3);
  assert.equal(new Set(mhEvals.map((e) => e.structuredVerdict?.primaryFocus)).size, 3);
  for (const e of mhEvals) {
    assert.equal(typeof e.structuredVerdict?.score, 'number');
  }
});
