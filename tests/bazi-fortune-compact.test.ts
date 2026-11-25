import assert from 'node:assert/strict';
import test from 'node:test';
import { inferFortuneScope } from '../src/router-model/index';
import { baziIndependent } from '../src/systems/bazi';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildTransformation, formatTransformation } from '../src/systems/bazi/transformation';
import { buildQuzhi } from '../src/systems/bazi/quzhi';
import { buildCongEr } from '../src/systems/bazi/conger';
import { buildExtremePattern, formatExtremePattern } from '../src/systems/bazi/extreme';
import { buildPatternRelations } from '../src/systems/bazi/pattern-relations';
import { buildCompactFortuneDynamics, formatCompactFortuneDynamics } from '../src/systems/bazi/fortune-compact';
import { calculateBaziFortune } from '../src/systems/bazi/fortune';
import { determineUsefulGod } from '../src/systems/bazi/useful-god';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';

test('inferFortuneScope: 精准识别显式年份、近期、中期多年、长期大运与默认提问', () => {
  const s1 = inferFortuneScope('2026年运势怎么样', 2026);
  assert.equal(s1.focus, 'explicit-years');
  assert.deepEqual(s1.explicitYears, [2026]);
  assert.deepEqual(s1.years, [2025, 2026, 2027]);

  const s2 = inferFortuneScope('2028和2029年适合买房签约吗', 2026);
  assert.equal(s2.focus, 'explicit-years');
  assert.deepEqual(s2.explicitYears, [2028, 2029]);
  assert.deepEqual(s2.years, [2027, 2028, 2029, 2030]);

  // 忽略出生年份，不误判为目标流年
  const s3 = inferFortuneScope('1992年5月1日出生，今年适合跳槽吗', 2026);
  assert.equal(s3.focus, 'short-term');
  assert.deepEqual(s3.explicitYears, []);
  assert.deepEqual(s3.years, [2026, 2027, 2028]);

  const s4 = inferFortuneScope('未来五年事业和财运走势如何', 2026);
  assert.equal(s4.focus, 'medium-term');
  assert.deepEqual(s4.years, [2026, 2027, 2028, 2029, 2030]);

  const s5 = inferFortuneScope('这辈子什么时候发财，哪步大运最好', 2026);
  assert.equal(s5.focus, 'lifetime');
  assert.deepEqual(s5.years, [2026, 2027, 2028]);

  const s6 = inferFortuneScope('帮我看看命局特点和事业方向', 2026);
  assert.equal(s6.focus, 'default');
  assert.deepEqual(s6.years, [2026, 2027, 2028]);
});

test('fortune-compact: 压平大运与流年引动准确标注当前大运、喜忌、补药救格/引动病灶与六冲，字数紧凑且无 ISO 时间戳', async () => {
  // 选用一个带显性破格救应链（枭神夺食）的精确出生盘：
  // 1990-05-15 14:30:00 UTC+8 男（庚午 辛巳 庚辰 癸未）或验证带枭神夺食/印重成病的盘
  const baseChart = await calculateBaziPillars(
    {
      year: 1990,
      month: 5,
      day: 15,
      clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
      timezone: 8,
    },
    'male',
  );
  const chart = { ...baseChart, usefulGod: determineUsefulGod(baseChart) };
  const fortune = calculateBaziFortune(chart, 'male');

  // 构造显性「枭神夺食」破格链来验证补药救格与引动病灶的精确触发
  // 日主庚金：正财甲/偏财乙（木）为补药制枭；偏印戊（土）为引动病灶
  const mockRelations = buildPatternRelations({
    pillars: chart.pillars,
    strength: chart.strength,
    patternOverview: chart.patternOverview,
    ordinaryPattern: chart.ordinaryPattern,
    usefulGod: chart.usefulGod,
  });
  const relationsWithXiao = {
    ...mockRelations,
    conflictChains: [
      {
        conflict: '枭神夺食',
        target: '月干偏印克制时干食神',
        remedyNeeded: '财星（尤喜明透偏财）制枭护食',
        rescueStatus: '原局无救（破格待运补药）' as const,
        evidence: '全盘无财星制枭',
      },
    ],
  };

  // 2024 甲辰（甲木偏财制枭）、2025 乙巳（乙木正财制枭）、2028 戊申（戊土偏印引动枭夺）
  const dynamics = buildCompactFortuneDynamics({
    chart,
    fortune,
    patternRelations: relationsWithXiao,
    question: '2024和2028年走势如何',
    referenceTime: '2026-06-15T04:00:00Z',
    referenceYear: 2026,
  });

  assert.equal(dynamics.dayun.length, 8);
  assert.equal(dynamics.dayun.filter((d) => d.isCurrent).length, 1);

  const y2024 = dynamics.years.find((y) => y.year === 2024);
  const y2028 = dynamics.years.find((y) => y.year === 2028);
  assert.ok(y2024, '应包含 2024 年');
  assert.ok(y2028, '应包含 2028 年');
  assert.equal(y2024.triggersRemedy, true, '2024 甲辰带财星应触发补药制枭');
  assert.equal(y2024.remedyTag, '补药制枭');
  assert.equal(y2028.triggersPathogen, true, '2028 戊申带偏印应触发引动枭夺');
  assert.equal(y2028.pathogenTag, '引动枭夺');

  // 检验日支六冲（日支为辰，戌年冲日支：2018戊戌）
  const clashDynamics = buildCompactFortuneDynamics({
    chart,
    fortune,
    patternRelations: relationsWithXiao,
    question: '2018年怎么样',
    referenceTime: '2026-06-15T04:00:00Z',
    referenceYear: 2026,
  });
  const y2018 = clashDynamics.years.find((y) => y.year === 2018);
  assert.ok(y2018?.clashTags.includes('冲日支'), '日支辰见戊戌年应标出冲日支');

  const formatted = formatCompactFortuneDynamics(dynamics);
  assert.ok(formatted.includes('·当前'), '压平文本应标出当前大运');
  assert.ok(formatted.includes('补药制枭'), '压平流年应标出补药制枭');
  assert.ok(formatted.includes('引动枭夺'), '压平流年应标出引动枭夺');
  assert.doesNotMatch(formatted, /T\d{2}:\d{2}:\d{2}/, '压平块不得包含冗余 ISO 时间戳');
  assert.ok(formatted.length >= 160 && formatted.length <= 440, `压平块字数应在紧凑区间，实际 ${formatted.length} 字`);

  // 检验 lifetime 模式会输出佳运摘要
  const lifeDynamics = buildCompactFortuneDynamics({
    chart,
    fortune,
    patternRelations: mockRelations,
    question: '这辈子哪步大运最好',
    referenceTime: '2026-06-15T04:00:00Z',
    referenceYear: 2026,
  });
  assert.equal(lifeDynamics.scope.focus, 'lifetime');
  const lifeText = formatCompactFortuneDynamics(lifeDynamics);
  assert.ok(lifeText.includes('长期大运'), '长期提问应标出长期大运窗');
});

test('baziIndependent: full 模式下原生输出【岁运动态与格局引动（压平精要）】紧邻【大运】之后，natal 模式不输出', async () => {
  const fullRes = await baziIndependent({
    question: '未来五年事业和跳槽机会',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    referenceTime: '2026-06-15T04:00:00Z',
    prompt: { scope: 'full' },
  });
  const text = fullRes.prompt.text;
  const idxDayun = text.indexOf('【大运】');
  const idxCompact = text.indexOf('【岁运动态与格局引动（压平精要）】');
  assert.ok(idxDayun > 0, '应包含【大运】');
  assert.ok(idxCompact > idxDayun, '【岁运动态与格局引动（压平精要）】应紧邻【大运】之后');
  assert.match(text, /2026丙午.*2030庚戌/, '未来五年提问应自动展开 2026-2030 五年流年');

  const natalRes = await baziIndependent({
    question: '只看本命',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    prompt: { scope: 'natal' },
  });
  assert.doesNotMatch(natalRes.prompt.text, /【岁运动态与格局引动（压平精要）】/);
});

test('极端边界 dt-hua-05（丙午 癸巳 戊午 丁巳）：满局化神极旺从化，戊癸真化火格成化', () => {
  const pillars = buildPillarFacts({ year: '丙午', month: '癸巳', day: '戊午', hour: '丁巳' });
  const strength = buildDayMasterStrength(pillars, pillars.month.hiddenStems[0].stem);
  const tr = buildTransformation(pillars, strength);
  assert.ok(tr);
  assert.equal(tr.pattern, '戊癸化火格');
  assert.equal(tr.status, '成化');
  assert.equal(tr.extremeTransformDominance, true);
  assert.equal(tr.blockers.length, 0);
  assert.match(tr.verdictReason, /满局化神极旺从化/);
  assert.match(formatTransformation(tr), /成化/);
});

test('极端边界 dt-jiacong-01（癸巳 乙卯 己亥 癸酉）：唯一微弱印根遭日支直冲受破，准确标出假从杀格候选提示', () => {
  const pillars = buildPillarFacts({ year: '癸巳', month: '乙卯', day: '己亥', hour: '癸酉' });
  const commander = pillars.month.hiddenStems[0].stem;
  const strength = buildDayMasterStrength(pillars, commander);
  const quzhi = buildQuzhi(pillars);
  const conger = buildCongEr(pillars, strength, commander);
  const extreme = buildExtremePattern(pillars, strength, commander, quzhi, conger);

  assert.ok(extreme, '应返回假从候选对象而非 null');
  assert.equal(extreme.candidate, '假从杀格');
  assert.equal(extreme.status, '假从候选（印根受日支冲破）');
  assert.ok(extreme.fakeFollowHint && extreme.fakeFollowHint.includes('假从杀格'));
  assert.ok(extreme.fakeFollowHint.includes('六冲受破'));
  const formatted = formatExtremePattern(extreme);
  assert.match(formatted, /假从杀格：假从候选（印根受日支冲破）/);
  assert.match(formatted, /假从提示：/);
});

test('bazi-fortune-compact: 最近几个月自动附带压平流月，问哪一天或具体日期自动附带压平流日', async () => {
  const rMonth = await baziIndependent({
    birth: { year: 1992, month: 5, day: 14, clock: { kind: 'exact', hour: 10, minute: 0, second: 0 }, timezone: 8 },
    gender: 'male',
    question: '最近几个月事业和财运顺不顺？',
  });
  assert.match(rMonth.prompt.text, /流月\(按节气月建\)：/);

  const rDay = await baziIndependent({
    birth: { year: 1992, month: 5, day: 14, clock: { kind: 'exact', hour: 10, minute: 0, second: 0 }, timezone: 8 },
    gender: 'male',
    question: '2026年12月8日适合去签约谈大单吗？',
  });
  assert.match(rDay.prompt.text, /流日：/);
  assert.match(rDay.prompt.text, /12\/8丙辰/);

  const rPick = await baziIndependent({
    birth: { year: 1992, month: 5, day: 14, clock: { kind: 'exact', hour: 10, minute: 0, second: 0 }, timezone: 8 },
    gender: 'male',
    question: '这几天哪一天最适合去面试？',
  });
  assert.match(rPick.prompt.text, /流日：/);
  assert.match(rPick.prompt.text, /流月\(按节气月建\)：/);
});
