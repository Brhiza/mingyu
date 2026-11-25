import assert from 'node:assert/strict';
import test from 'node:test';
import { baziSynastryIndependent } from '../src/systems/bazi-synastry';
import { extractBirthProfiles } from '../src/router-model/birth-extractor';
import {
  analyzeUserQuery,
  formatFrameworkPromptBlock,
  generateChartFollowUps,
  inspectQuestionQuality,
  runLocalAgentPlan,
} from '../src/router-model/local-agent';

test('extractBirthProfiles 能准确提取单人公历/农历与双人合盘生辰信息', () => {
  const single = extractBirthProfiles('女，1995年阴历八月十二下午两点半出生在成都，看看明年事业');
  assert.equal(single.profiles.length, 1);
  assert.equal(single.isTwoPerson, false);
  const p = single.profiles[0]!;
  assert.equal(p.gender, 'female');
  assert.equal(p.calendarType, 'lunar');
  assert.equal(p.year, 1995);
  assert.equal(p.month, 8);
  assert.equal(p.day, 12);
  assert.equal(p.hour, 14);
  assert.equal(p.minute, 30);
  assert.ok(p.birthPlace?.includes('成都'));

  const pair = extractBirthProfiles(
    '男1990年5月15日14:30北京，女1992年8月12日9点上海，合盘看2028年适合结婚吗',
  );
  assert.equal(pair.profiles.length, 2);
  assert.equal(pair.isTwoPerson, true);
  assert.equal(pair.relationship, 'marriage');
  assert.equal(pair.profiles[0]!.gender, 'male');
  assert.ok(pair.profiles[0]!.birthPlace?.includes('北京'));
  assert.equal(pair.profiles[1]!.gender, 'female');
  assert.ok(pair.profiles[1]!.birthPlace?.includes('上海'));
  assert.equal(pair.profiles[1]!.hour, 9);
});

test('inspectQuestionQuality 对简短或缺乏背景的问题给出精准补全胶囊', () => {
  const briefCompat = inspectQuestionQuality('看看合不合', { mode: 'compatibility' });
  assert.equal(briefCompat.level, 'brief');
  assert.ok(briefCompat.quickFixes.length >= 2);

  const briefLove = inspectQuestionQuality('今年感情怎么样', { mode: 'personal' });
  assert.ok(briefLove.quickFixes.some((f) => f.label.includes('单身') || f.label.includes('伴侣')));

  const rich = inspectQuestionQuality(
    '目前在职考虑跳槽，请重点分析2027年上半年换工作的利弊时机与风险',
    { mode: 'personal', hasLifeStage: true, hasTimeHorizon: true },
  );
  assert.equal(rich.level, 'rich');
  assert.equal(rich.quickFixes.length, 0);
});

test('generateChartFollowUps 能基于真实八字合盘结果生成定制追问胶囊', async () => {
  const res = await baziSynastryIndependent({
    question: '查看双方未来几年合盘流年走势',
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
    referenceTime: '2026-06-15T12:00:00+08:00',
    syncYears: { startYear: 2026, endYear: 2030 },
  });

  const followUps = generateChartFollowUps('bazi-synastry', res, {
    relationship: 'marriage',
    currentYear: 2026,
  });
  assert.ok(followUps.length >= 2);
  assert.ok(followUps.some((f) => f.question.includes('甲') || f.question.includes('夫妻宫') || f.targetYear));
});

test('runLocalAgentPlan 离线输出完整选盘、生辰提取与解读框架', async () => {
  const plan = await runLocalAgentPlan(
    '男1990年5月15日14:30北京，女1992年8月12日9点上海，合盘看2028年适合结婚吗',
    { referenceYear: 2026 },
  );
  assert.ok(plan.routing.recommendations.length >= 3);
  assert.equal(plan.analysis.extractedBirth.profiles.length, 2);
  assert.equal(plan.analysis.fortuneScope.explicitYears[0], 2028);
  assert.equal(plan.analysis.recommendedFramework.id, 'relationship-diagnosis');

  const block = formatFrameworkPromptBlock(plan.analysis.recommendedFramework.id);
  assert.ok(block.includes('【指定解读框架：'));

  const analysis = analyzeUserQuery('未来几年事业发展怎么样？', {
    method: 'bazi',
    referenceYear: 2026,
  });
  assert.equal(analysis.fortuneScope.focus, 'medium-term');
});

test('多行常用模板（姓名/性别/日期/点号时间/省市区/问题）完整解析并正确路由到八字排盘', async () => {
  const tpl = `姓名 王洋
性别 女
公历出生日期 2000 年 5 月 20 日
出生时间 12.00
出生地 广东省 广州市 天河区
问题 我适合这份工作吗、今年财运怎么样、我和他能不能在一起`;

  const extracted = extractBirthProfiles(tpl);
  assert.equal(extracted.profiles.length, 1);
  assert.equal(extracted.isTwoPerson, false);
  const p = extracted.profiles[0]!;
  assert.equal(p.name, '王洋');
  assert.equal(p.gender, 'female');
  assert.equal(p.calendarType, 'solar');
  assert.equal(p.year, 2000);
  assert.equal(p.month, 5);
  assert.equal(p.day, 20);
  assert.equal(p.hour, 12);
  assert.equal(p.minute, 0);
  assert.equal(p.birthPlace, '广东省 广州市 天河区');
  assert.equal(extracted.question, '我适合这份工作吗、今年财运怎么样、我和他能不能在一起');

  const plan = await runLocalAgentPlan(tpl);
  assert.equal(plan.routing.recommendations[0]?.method, 'bazi');
  assert.equal(plan.query, '我适合这份工作吗、今年财运怎么样、我和他能不能在一起');
});

test('复杂野生输入压力测试：全国区县/海外城市、双人分块防串台、紧凑日期、指定术数与专项号码', async () => {
  // 1. 全国区县 + 海外城市双人分块模板（一方未知时辰）
  const complexPair = `男方：陈明
1991-07-08 08:15 江苏省 南通市 如皋市
女方：林雪
1994年农历闰四月初八 不知道时辰 美国 纽约
问题：我们俩准备合伙开公司，未来三年顺不顺？`;
  const pairPlan = await runLocalAgentPlan(complexPair);
  assert.equal(pairPlan.analysis.extractedBirth.profiles.length, 2);
  assert.equal(pairPlan.analysis.extractedBirth.relationship, 'career');
  assert.equal(pairPlan.routing.recommendations[0]?.method, 'bazi-synastry');
  const [m1, m2] = pairPlan.analysis.extractedBirth.profiles;
  assert.equal(m1!.name, '陈明');
  assert.equal(m1!.gender, 'male');
  assert.equal(m1!.hour, 8);
  assert.equal(m1!.minute, 15);
  assert.ok(m1!.longitude && m1!.longitude > 119 && m1!.longitude < 122);
  assert.equal(m2!.name, '林雪');
  assert.equal(m2!.gender, 'female');
  assert.equal(m2!.calendarType, 'lunar');
  assert.equal(m2!.timeIndex, 'unknown');
  assert.equal(m2!.timeZoneId, 'America/New_York');

  // 2. 8 位紧凑日期 + 明确指定紫微斗数
  const compactZiwei = await runLocalAgentPlan('19960308 女 下午3点40 温州，用紫微斗数帮我看看今年事业');
  assert.equal(compactZiwei.routing.recommendations[0]?.method, 'ziwei');
  const zp = compactZiwei.analysis.extractedBirth.profiles[0]!;
  assert.equal(zp.year, 1996);
  assert.equal(zp.month, 3);
  assert.equal(zp.day, 8);
  assert.equal(zp.hour, 15);
  assert.equal(zp.minute, 40);
  assert.ok(zp.birthPlace?.includes('温州'));

  // 3. 手机号数字能量
  const phonePlan = await runLocalAgentPlan('帮我测一下手机号 13812345678 的磁场吉凶');
  assert.equal(phonePlan.routing.recommendations[0]?.method, 'number-energy');
  assert.equal(phonePlan.analysis.extractedBirth.structured.numberEnergy, '13812345678');

  // 4. 报数起卦 + 明确指定梅花易数
  const castPlan = await runLocalAgentPlan('报数 3、8、5，用梅花易数看看这个合作能不能谈成');
  assert.equal(castPlan.routing.recommendations[0]?.method, 'meihua');
  assert.deepEqual(castPlan.analysis.extractedBirth.structured.castNumbers, [3, 8, 5]);
});

test('超多野生简写与口语输入覆盖矩阵：6/7位紧凑日期、空格日期、全中文年份、4位时钟、测名与车牌', async () => {
  // 6 位紧凑日期 199638
  const d6 = extractBirthProfiles('男 199638 下午两点 杭州 看看今年事业');
  assert.equal(d6.profiles[0]?.year, 1996);
  assert.equal(d6.profiles[0]?.month, 3);
  assert.equal(d6.profiles[0]?.day, 8);
  assert.equal(d6.profiles[0]?.hour, 14);

  // 7 位紧凑日期 1996315
  const d7 = extractBirthProfiles('女 1996315 0930 成都 看看感情');
  assert.equal(d7.profiles[0]?.year, 1996);
  assert.equal(d7.profiles[0]?.month, 3);
  assert.equal(d7.profiles[0]?.day, 15);
  assert.equal(d7.profiles[0]?.hour, 9);
  assert.equal(d7.profiles[0]?.minute, 30);

  // 点号日期 + 4位紧凑时钟
  const dotTime = extractBirthProfiles('1996.3.8 1430 男 北京');
  assert.equal(dotTime.profiles[0]?.year, 1996);
  assert.equal(dotTime.profiles[0]?.month, 3);
  assert.equal(dotTime.profiles[0]?.day, 8);
  assert.equal(dotTime.profiles[0]?.hour, 14);
  assert.equal(dotTime.profiles[0]?.minute, 30);

  // 空格分隔日期 + 模糊时段
  const spaced = extractBirthProfiles('女 1996 3 8 中午 上海');
  assert.equal(spaced.profiles[0]?.year, 1996);
  assert.equal(spaced.profiles[0]?.month, 3);
  assert.equal(spaced.profiles[0]?.day, 8);
  assert.equal(spaced.profiles[0]?.timeIndex, 6);

  // 全中文年份 + 口语双数字区间「早上七八点」
  const cnYear = extractBirthProfiles('我叫王洋，女，二零零零年五月二十 早上七八点 广州');
  assert.equal(cnYear.profiles[0]?.name, '王洋');
  assert.equal(cnYear.profiles[0]?.year, 2000);
  assert.equal(cnYear.profiles[0]?.month, 5);
  assert.equal(cnYear.profiles[0]?.day, 20);
  assert.equal(cnYear.profiles[0]?.hour, 7);
  assert.equal(cnYear.profiles[0]?.minute, 30);

  // 测名口语表达
  const namePlan = await runLocalAgentPlan('王洋这个名字怎么样？');
  assert.equal(namePlan.routing.recommendations[0]?.method, 'chinese-name');
  assert.equal(namePlan.analysis.extractedBirth.structured.targetName, '王洋');

  // 车牌号数字能量
  const platePlan = await runLocalAgentPlan('帮我看下车牌 粤B8899A 吉利吗');
  assert.equal(platePlan.routing.recommendations[0]?.method, 'number-energy');
  assert.equal(platePlan.analysis.extractedBirth.structured.numberEnergy, '粤B8899A');

  // 口语心里想数字
  const freeCast = extractBirthProfiles('心里想了两个数 17 和 42，看看这次面试能不能过');
  assert.deepEqual(freeCast.structured.castNumbers, [17, 42]);
});
