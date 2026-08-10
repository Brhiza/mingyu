import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as core from '../packages/core/src/index.ts';
import {
  analyzeTarotEvidence,
  drawTarotSpread,
  getCardEvidence,
} from '../packages/core/src/divination/tarot.ts';
import { tarotCards } from '../packages/core/src/divination/tarot-data.ts';

test('ganzhi: 六十甲子序号与循环差值', () => {
  assert.equal(core.ganzhi.getSixtyCycleIndex('甲子'), 0);
  assert.equal(core.ganzhi.getSixtyCycleIndex('甲戌'), 10);
  assert.equal(core.ganzhi.getSixtyCycleIndex('癸亥'), 59);
  assert.equal(core.ganzhi.diffGanZhi('甲子', '乙丑'), 1);
  assert.equal(core.ganzhi.diffGanZhi('癸亥', '甲子'), 1);
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
  assert.ok(r.prompt.includes('四吉方'));
  assert.ok(r.prompt.includes('四凶方'));
  assert.doesNotMatch(r.prompt, /命卦八宫明细/);
  assert.doesNotMatch(r.prompt, /宅卦八宫明细/);
  assert.doesNotMatch(r.prompt, /结构化证据|证据边界|计算链|解释限制/);
  assert.equal(r.evidenceAnalysis.evidence.title, '八宅命宅方位与测量结构化证据');
  assert.equal(r.evidenceAnalysis.calculationFact.status, '命宅完整');
  assert.equal(r.evidenceAnalysis.calculationFact.yearBoundaryStatus, '待复核');
  assert.equal(r.evidenceAnalysis.calculationFact.steps[0].status, '待复核');
  assert.equal(r.calculationInput.mingGuaSource, '出生年与性别计算');
  assert.equal(r.calculationInput.gender, 'male');
  assert.equal(r.calculationInput.sitMountain, '子');
  assert.equal(r.evidenceAnalysis.calculationFact.steps[2].inputs.sitMountain, '子');
  assert.equal(r.evidenceAnalysis.calculationFact.steps.length, 5);
  assert.strictEqual(r.evidenceAnalysis.calculationSteps, r.evidenceAnalysis.calculationFact.steps);
  assert.ok(
    r.evidenceAnalysis.calculationFact.steps.every(
      (item) =>
        item.key &&
        Array.isArray(item.dependsOnStepKeys) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把步骤完整度解释为住宅适用度'),
    ),
  );
  assert.equal(r.evidenceAnalysis.measurementFact.status, '未提供');
  assert.equal(r.evidenceAnalysis.measurementFact.candidates.length, 0);
  assert.equal(r.evidenceAnalysis.directionFacts.length, 8);
  assert.equal(r.evidenceAnalysis.directionComparisons.length, 8);
  assert.ok(
    r.evidenceAnalysis.directionFacts.every(
      (item) =>
        item.key === `方位:${item.gua}` &&
        item.status === '已计算' &&
        item.calculationStepKeys.length > 0 &&
        item.sources.length >= 2 &&
        item.calculation.includes('查大游年表') &&
        item.promptText.includes('传统') &&
        item.limitation.includes('不证明房间适用性'),
    ),
  );
  assert.deepEqual(
    r.evidenceAnalysis.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['命卦年界', '待复核'],
      ['宅卦资料覆盖', '已覆盖'],
      ['命宅逐方一致性', '已覆盖'],
      ['山向边界稳定性', '不适用'],
      ['宅卦边界稳定性', '不适用'],
      ['北向基准', '不适用'],
    ],
  );
  assert.equal(r.evidenceAnalysis.counterSummaryFact.status, '存在需保留反证');
  assert.equal(r.evidenceAnalysis.counterSummaryFact.factKeys.length, 1);
  assert.equal(r.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(r.evidenceAnalysis.limitations.length, r.evidenceAnalysis.limitationFacts.length);
  assert.ok(
    r.evidenceAnalysis.limitationFacts.every(
      (item) =>
        item.key.startsWith('bazhai:limitation:') &&
        item.status === '适用' &&
        item.ownerFactKeys.length > 0 &&
        item.sources.length > 0,
    ),
  );
  assert.match(r.evidenceAnalysis.promptText, /北（坎宫，中心0°）.*逐方关系为同为吉方/);
  assert.doesNotMatch(
    r.evidenceAnalysis.promptText,
    /命语|本项目|项目统一|调用方|当前调用|工程|接口|API|MCP/,
  );
  assert.match(r.prompt, /命宅配合：相合/);
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
  assert.equal(r.evidenceAnalysis.measurementFact.status, '稳定');
  assert.equal(r.evidenceAnalysis.measurementFact.referenceStatus, '未声明');
  assert.equal(r.evidenceAnalysis.measurementFact.input?.measuredDegree, 0);
  assert.equal(r.evidenceAnalysis.measurementFact.result?.label, '子山午向');
  assert.equal(r.evidenceAnalysis.measurementCandidateFacts.length, 1);
  assert.ok(
    r.evidenceAnalysis.measurementCandidateFacts.every(
      (item) =>
        item.key.startsWith('measurement:bazhai:candidate:') &&
        item.status === '候选' &&
        item.measurementFactKey === 'measurement:bazhai:door' &&
        item.calculationStepKeys.includes('bazhai:calculation:house-gua') &&
        item.promptText &&
        item.sources.length >= 2 &&
        item.limitation.includes('不代表现场真实坐向'),
    ),
  );
  assert.equal(r.evidenceAnalysis.measurementFact.candidateFactKeys.length, 1);
  assert.equal(
    r.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '命卦年界')?.status,
    '已核定',
  );
  assert.equal(
    r.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '北向基准')?.status,
    '未声明',
  );
  assert.equal(r.evidenceAnalysis.counterSummaryFact.status, '存在需保留反证');
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

  const direct = core.bazhai.analyzeBaZhai({ mingGua: '坎' });
  assert.equal(direct.calculationInput.mingGuaSource, '直接给定');
  assert.equal(direct.calculationInput.directMingGua, '坎');
  assert.equal(direct.evidenceAnalysis.calculationFact.yearBoundaryStatus, '直接命卦');
  assert.equal(direct.evidenceAnalysis.calculationFact.status, '命卦完整');
  assert.equal(
    direct.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '命卦年界')?.status,
    '直接给定',
  );
  assert.equal(
    direct.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '宅卦资料覆盖')
      ?.status,
    '未提供',
  );
});

test('tarot: 逐牌证据应保留正逆位、关键词、元素与牌阶', () => {
  const major = getCardEvidence('魔术师');
  const minor = getCardEvidence('权杖骑士');

  assert.deepEqual(major.keywords, ['意志力', '创造', '技能']);
  assert.match(minor.element, /火/);
  assert.match(minor.archetype, /行动节奏/);
});

test('tarot: 全部牌面事实只保留牌位、牌名、正逆位与牌面资料', () => {
  const facts = tarotCards.flatMap((card, index) => {
    const cardEvidence = getCardEvidence(card.name);
    return [false, true].flatMap((reversed) => {
      const data = drawTarotSpread('single', { seed: `牌义证据-${index}-${reversed}` });
      data.cards = [
        {
          id: card.number,
          name: card.name,
          position: '当前指引',
          reversed,
          ...cardEvidence,
        },
      ];
      return analyzeTarotEvidence(data).traditionalFacts;
    });
  });

  assert.equal(facts.length, tarotCards.length * 2);
  assert.deepEqual(new Set(facts.map((item) => item.orientation)), new Set(['正位', '逆位']));
  assert.ok(facts.every((item) => item.kind === '牌面事实'));
  assert.ok(
    facts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.ok(facts.some((item) => /关键词/.test(item.promptText)));
  assert.ok(facts.some((item) => /牌阶主题/.test(item.promptText)));
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /牌义|表示这些能量正在直接发挥作用|成功比预期更晚到来|信息被隐藏/,
  );
});

test('tarot: 旧结果缺少抽牌来源时应明确标记来源链缺失', () => {
  const result = drawTarotSpread('single', { seed: '旧塔罗抽牌来源' });
  const evidence = analyzeTarotEvidence({
    ...result,
    draw: undefined,
    evidenceAnalysis: undefined,
  });

  assert.equal(evidence.drawFact.status, '来源链缺失');
  assert.equal(evidence.drawFact.recordedCardCount, 0);
  assert.match(evidence.drawFact.promptText, /不能反推完整抽牌来源链/);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '抽牌来源链缺失',
    ),
  );
});

test('tarot: 结构化牌面事实不包含自造牌义解释', () => {
  const data = drawTarotSpread('three', { seed: '塔罗无自造牌义' });
  const promptText = data.evidenceAnalysis!.cards.map((card) => card.promptText).join('\n');

  assert.match(promptText, /关键词/);
  assert.doesNotMatch(promptText, /牌义|受阻、过度、内化|直接发挥作用|成功比预期更晚到来/);
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
  assert.equal(r.model.id, 'taiyi-year-calculation-72-table');
  assert.ok(r.prompt.includes('太乙神数'));
  assert.doesNotMatch(r.prompt, /十六神/);
  assert.ok(r.prompt.includes('主客定算'));
  assert.ok(r.prompt.includes('将参'));
  assert.ok(r.prompt.includes('核心宫位'));
  assert.doesNotMatch(r.prompt, /结构化证据|观察层级|证据汇总|计算链|解释限制/);
  assert.equal(r.evidenceAnalysis.key, 'taiyi:evidence');
  assert.equal(r.evidenceAnalysis.status, '已计算');
  assert.match(r.evidenceAnalysis.promptText, /【太乙年计七十二局结构化证据】/);
  assert.deepEqual(
    r.evidenceAnalysis.calculationSteps.map((step) => step.name),
    ['360周期余数', '72数段', '60数段', '局数'],
  );
  assert.ok(
    r.evidenceAnalysis.calculationSteps.every(
      (step) =>
        step.key.startsWith('taiyi:calculation:') &&
        step.status === '已复算' &&
        Array.isArray(step.dependsOnStepKeys) &&
        step.promptText &&
        step.sources.length >= 2 &&
        step.limitation.includes('不等同于已经统一版本口径的元纪'),
    ),
  );
  assert.equal(r.evidenceAnalysis.positionFacts.length, 4);
  assert.equal(r.evidenceAnalysis.forceFacts.length, 3);
  assert.equal(r.evidenceAnalysis.sixteenGodFacts.length, 16);
  assert.equal(r.evidenceAnalysis.conditionFacts.length, 4);
  assert.deepEqual(
    r.evidenceAnalysis.forceFacts.map((item) => item.side),
    ['主', '客', '定'],
  );
  assert.ok(
    r.evidenceAnalysis.positionFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.calculationStepKeys.includes('taiyi:calculation:bureau') &&
        item.sources.length >= 2 &&
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(
    r.evidenceAnalysis.forceFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.calculationStepKeys.includes('taiyi:calculation:bureau') &&
        item.promptText &&
        item.sources.length >= 2 &&
        item.limitation.includes('不直接证明现实胜负'),
    ),
  );
  assert.ok(
    r.evidenceAnalysis.sixteenGodFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.calculationStepKeys.includes('taiyi:calculation:bureau') &&
        item.promptText &&
        item.limitation.includes('不得单独生成现实结论'),
    ),
  );
  assert.ok(
    r.evidenceAnalysis.conditionFacts.every(
      (item) =>
        (item.status === '已命中' || item.status === '未命中') &&
        item.calculationStepKeys.includes('taiyi:calculation:bureau'),
    ),
  );
  assert.deepEqual(
    r.evidenceAnalysis.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['掩', '已命中'],
      ['囚', '已命中'],
      ['主将参中宫', '未命中'],
      ['客将参中宫', '未命中'],
    ],
  );
  assert.equal(r.evidenceAnalysis.counterSummaryFact.status, '存在未命中条件');
  assert.equal(r.evidenceAnalysis.counterSummaryFact.factKeys.length, 2);
  assert.equal(r.evidenceAnalysis.limitationFacts.length, 5);
  assert.equal(r.evidenceAnalysis.summaryFact.key, 'taiyi:evidence-summary');
  assert.equal(r.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    r.evidenceAnalysis.summaryFact.positionFactCount,
    r.evidenceAnalysis.positionFacts.length,
  );
  assert.equal(r.evidenceAnalysis.summaryFact.forceFactCount, r.evidenceAnalysis.forceFacts.length);
  assert.equal(
    r.evidenceAnalysis.summaryFact.sixteenGodFactCount,
    r.evidenceAnalysis.sixteenGodFacts.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.conditionFactCount,
    r.evidenceAnalysis.conditionFacts.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.counterEvidenceCount,
    r.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.limitationFactCount,
    r.evidenceAnalysis.limitationFacts.length,
  );
  const taiyiFactKeys = new Set([
    r.evidenceAnalysis.summaryFact.key,
    ...r.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    r.evidenceAnalysis.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => taiyiFactKeys.has(key)),
    ),
  );
  assert.equal(r.evidenceAnalysis.limitations.length, r.evidenceAnalysis.limitationFacts.length);
  assert.ok(
    r.evidenceAnalysis.limitationFacts.every(
      (item) =>
        item.key.startsWith('taiyi:limitation:') &&
        item.status === '适用' &&
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => taiyiFactKeys.has(key)) &&
        item.sources.length > 0,
    ),
  );
  assert.ok(r.evidenceAnalysis.conditionFacts.some((item) => item.kind === '掩' && item.matched));
  assert.ok(
    r.evidenceAnalysis.conditionFacts.some(
      (item) => item.kind === '囚' && item.matched && item.promptText.includes('客大将与太乙同宫'),
    ),
  );
  assert.match(r.evidenceAnalysis.promptText, /算式核验：.*360周期余数.*72数段.*60数段.*局数/);
  assert.ok(r.evidenceAnalysis.primaryFacts.some((item) => item.startsWith('掩成立')));
  assert.ok(!r.evidenceAnalysis.counterEvidence.some((item) => item.startsWith('未见囚')));
  assert.match(r.evidenceAnalysis.promptText, /传统规则模型/);
  assert.match(r.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制（方法限制）：/);
  assert.doesNotMatch(r.evidenceAnalysis.promptText, /宜先守后动|不宜轻进/);
  assert.doesNotMatch(
    r.evidenceAnalysis.promptText,
    /\d+(?:\.\d+)?%|成功率(?:为|：)|匹配率(?:为|：)|吉凶总分(?:为|：)/,
  );
  assert.doesNotMatch(
    r.evidenceAnalysis.promptText,
    /命语|本项目|项目统一|当前结果|工程|接口|API|MCP/,
  );
  for (const scope of ['month', 'day', 'hour'] as const) {
    assert.throws(
      () => core.taiyi.generateTaiyi({ year: 2004, scope }),
      /古籍历法链校勘.*停止输出近似盘/,
    );
  }
  assert.throws(
    () => core.taiyi.generateTaiyi({} as Parameters<typeof core.taiyi.generateTaiyi>[0]),
    /年计必须提供公历年份/,
  );
  assert.throws(
    () =>
      core.taiyi.generateTaiyi({
        year: 2004,
        scope: 'year',
        date: new Date(2004, 0, 1, 12),
      }),
    /年计只接受 year/,
  );
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
  assert.equal(result.evidenceAnalysis.counterSummaryFact.status, '存在未命中条件');
  assert.equal(result.evidenceAnalysis.counterSummaryFact.factKeys.length, 3);
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

test('qizheng: 独立紫炁均速模型保留可复算历元', () => {
  const longitude = core.qizheng.calculateZiqiTropicalLongitude({
    year: 1995,
    month: 12,
    day: 31,
    hour: 8,
    timezone: 8,
  });

  assert.ok(Math.abs(longitude - 237.038993) < 1e-9);
  assert.equal(core.qizheng.ZIQI_MODEL_INFO.id, 'qizhengsuan-naepyeon-mean-motion');
  assert.equal(core.qizheng.ZIQI_MODEL_INFO.periodDays, 10227.1792);
});

test('qizheng: 完整传统盘应返回十一星、二十八宿界与结构化证据', () => {
  const result = core.qizheng.generateQizheng({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
  });
  assert.equal(result.stars.length, 11);
  assert.equal(result.mansionBoundaries.length, 28);
  assert.equal(result.evidenceAnalysis.status, '已计算');
  assert.equal(result.mansionModel.id, 'qizheng-mansion-stars-simbad-astronomy-engine');
  assert.doesNotMatch(result.prompt, /十二宫映射：/);
});

test('qizheng: 核心入口仍应优先拒绝无效输入', () => {
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
