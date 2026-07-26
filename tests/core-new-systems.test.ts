import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as core from '../packages/core/src/index.ts';
import {
  analyzeTarotEvidence,
  conditionTarotTraditionalText,
  drawTarotSpread,
  getCardEvidence,
} from '../packages/core/src/divination/tarot.ts';
import { tarotCards } from '../packages/core/src/divination/tarot-data.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

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
  assertPromptIsPortableTaskText(r.evidenceAnalysis.promptText);
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

test('zodiac: 犯太岁与流年运程', () => {
  const conflicts = core.zodiac.getTaiSuiConflicts('午', '子');
  assert.ok(conflicts.some((c) => c.type === '冲太岁'));
  const r = core.zodiac.getZodiacYearFortune('午', '甲辰');
  assert.equal(r.zodiac, '马');
  assert.ok(!('level' in r));
  assert.equal(r.evidenceGrade, '轻量');
  assert.equal(r.interpretationBoundary, '仅限生肖与流年关系');
  assert.deepEqual(r.elementRelation, {
    kind: '年干生生肖',
    label: '年干五行生生肖地支本气',
    classification: '有利关系',
    yearStemWuxing: '木',
    zodiacWuxing: '火',
  });
  assert.ok(!('confidence' in r));
  assert.ok(r.prompt.includes('生肖与流年关系简析'));
  assert.ok(r.prompt.includes('五行来源'));
  assert.ok(r.prompt.includes('干支关系'));
  assert.equal(r.evidenceAnalysis.key, 'zodiac:evidence');
  assert.equal(r.evidenceAnalysis.status, '已计算');
  assert.equal(r.evidenceAnalysis.evidence.title, '生肖流年关系矩阵结构化证据');
  assert.equal(r.evidenceAnalysis.calculationSteps.length, 4);
  assert.deepEqual(
    r.evidenceAnalysis.calculationSteps.map((item) => item.stage),
    ['生肖年支', '流年拆分', '地支关系核验', '年干五行辅助'],
  );
  assert.ok(
    r.evidenceAnalysis.calculationSteps.every(
      (item) =>
        item.key.startsWith('zodiac:calculation:') &&
        item.status === '已计算' &&
        Array.isArray(item.dependsOnStepKeys) &&
        item.promptText &&
        item.sources.length >= 2 &&
        item.limitation.includes('不证明个人现实事件'),
    ),
  );
  assert.ok(r.evidenceAnalysis.calculationChain.length >= 4);
  assert.ok(r.evidenceAnalysis.supportingEvidence.length > 0);
  assert.ok(
    r.evidenceAnalysis.relations.every(
      (item) =>
        item.key.startsWith('关系:') &&
        item.status === '已命中' &&
        item.operands.length >= 2 &&
        item.rule.length > 0 &&
        item.sources.length >= 2 &&
        item.promptText.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.deepEqual(
    r.evidenceAnalysis.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['太岁关系覆盖', '未命中'],
      ['三合六合三会覆盖', '未命中'],
      ['生肖信息量', '固有限制'],
    ],
  );
  assert.equal(r.evidenceAnalysis.counterSummaryFact.status, '有未命中关系');
  assert.equal(r.evidenceAnalysis.counterSummaryFact.factKeys.length, 2);
  assert.equal(r.evidenceAnalysis.counterEvidence.length, 3);
  assert.equal(r.evidenceAnalysis.limitationFacts.length, 5);
  assert.equal(r.evidenceAnalysis.summaryFact.key, 'zodiac:evidence-summary');
  assert.equal(r.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    r.evidenceAnalysis.summaryFact.relationFactCount,
    r.evidenceAnalysis.relations.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.primaryEvidenceCount,
    r.evidenceAnalysis.primaryEvidence.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.supportingEvidenceCount,
    r.evidenceAnalysis.supportingEvidence.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.counterEvidenceCount,
    r.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.limitationFactCount,
    r.evidenceAnalysis.limitationFacts.length,
  );
  const zodiacFactKeys = new Set([
    r.evidenceAnalysis.summaryFact.key,
    ...r.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    r.evidenceAnalysis.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => zodiacFactKeys.has(key)),
    ),
  );
  assert.equal(r.evidenceAnalysis.limitations.length, r.evidenceAnalysis.limitationFacts.length);
  assert.ok(
    r.evidenceAnalysis.limitationFacts.every(
      (item) =>
        item.key.startsWith('zodiac:limitation:') &&
        item.status === '适用' &&
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => zodiacFactKeys.has(key)) &&
        item.sources.length > 0,
    ),
  );
  assert.match(r.evidenceAnalysis.promptText, /现实复核提示：.*边界：/);
  assert.match(r.evidenceAnalysis.promptText, /流年年干甲[\s\S]*生肖年支本气午/);
  assert.match(r.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制：/);
  assert.match(r.prompt, /马（午）遇甲辰年/);
  assert.match(r.prompt, /有利关系：年干五行生生肖地支本气/);
  assert.doesNotMatch(r.prompt, /结构化证据|证据汇总|计算链|解释限制/);
  assert.doesNotMatch(r.prompt, /综合定级：/);
  assert.doesNotMatch(r.prompt, /印星|财星|官杀|接口兼容/);
  assert.doesNotMatch(r.prompt, /完整的事业、财运、感情或健康断语/);
  assert.doesNotMatch(r.evidenceAnalysis.promptText, /命语|本项目|项目统一|工程|接口|API|MCP/);
  assertPromptIsPortableTaskText(r.evidenceAnalysis.promptText);
});

test('zodiac: 六十甲子太岁资料应完整、非空、无重名且不可被运行时改写', () => {
  const entries = Object.entries(core.zodiac.TAI_SUI_STARS);
  assert.equal(entries.length, 60);
  assert.equal(new Set(entries.map(([ganZhi]) => ganZhi)).size, 60);
  assert.equal(new Set(entries.map(([, name]) => name)).size, 60);
  assert.ok(entries.every(([ganZhi, name]) => ganZhi.length === 2 && name.trim().length > 0));
  assert.equal(Object.isFrozen(core.zodiac.TAI_SUI_STARS), true);
  assert.deepEqual(core.zodiac.getYearTaiSui('甲辰'), { yearBranch: '辰', star: '李诚' });
});

test('zodiac: 五行利弊分类应由结构化关系驱动而非解析中文描述', () => {
  const cases = [
    {
      result: core.zodiac.getZodiacYearFortune('午', '甲辰'),
      kind: '年干生生肖',
      classification: '有利关系',
      bucket: 'favorableRelations',
    },
    {
      result: core.zodiac.getZodiacYearFortune('寅', '丁卯'),
      kind: '生肖生年干',
      classification: '风险关系',
      bucket: 'riskRelations',
    },
    {
      result: core.zodiac.getZodiacYearFortune('寅', '庚子'),
      kind: '年干克生肖',
      classification: '风险关系',
      bucket: 'riskRelations',
    },
    {
      result: core.zodiac.getZodiacYearFortune('寅', '戊寅'),
      kind: '生肖克年干',
      classification: '中性关系',
      bucket: null,
    },
    {
      result: core.zodiac.getZodiacYearFortune('寅', '甲子'),
      kind: '同类',
      classification: '中性关系',
      bucket: null,
    },
  ] as const;

  for (const item of cases) {
    assert.equal(item.result.elementRelation.kind, item.kind);
    assert.equal(item.result.elementRelation.classification, item.classification);
    assert.equal(item.result.elementRelation.label, item.result.relation);
    assert.equal(
      item.result.favorableRelations.includes(item.result.relation),
      item.bucket === 'favorableRelations',
    );
    assert.equal(
      item.result.riskRelations.includes(item.result.relation),
      item.bucket === 'riskRelations',
    );
  }
});

test('zodiac: 冲太岁只作轻量风险关系，不生成综合吉凶等级', () => {
  const result = core.zodiac.getZodiacYearFortune('午', '庚子');
  assert.ok(result.conflicts.some((item) => item.type === '冲太岁'));
  assert.ok(result.evidenceAnalysis.primaryEvidence.some((item) => item.relation === '冲太岁'));
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '太岁关系覆盖')
      ?.status,
    '有可用证据',
  );
  assert.ok(
    result.evidenceAnalysis.primaryEvidence.every(
      (item) => item.promptText.includes('逐项核验') && item.sources.length >= 2,
    ),
  );
  assert.ok(!('level' in result));
  assert.equal(result.interpretationBoundary, '仅限生肖与流年关系');
  assert.ok(!('confidence' in result));
});

test('zodiac: 三会只记录固定同组关系，不冒充贵人或吉凶结论', () => {
  const eastWood = core.zodiac.getZodiacYearFortune('寅', '丁卯');
  assert.equal(eastWood.meeting, '三会关系（东方木）');
  assert.equal(eastWood.noble, null);
  assert.ok(!eastWood.favorableRelations.includes(eastWood.meeting));
  assert.ok(!eastWood.riskRelations.includes(eastWood.meeting));
  assert.ok(
    eastWood.evidenceAnalysis.supportingEvidence.some(
      (item) => item.category === '地支会合' && item.relation === eastWood.meeting,
    ),
  );
  assert.equal(
    eastWood.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '三合六合三会覆盖')
      ?.status,
    '有可用证据',
  );
  assert.match(eastWood.prompt, /三会：三会关系（东方木）/);
  assert.match(eastWood.evidenceAnalysis.promptText, /十二地支三会固定关系表/);
  assert.doesNotMatch(eastWood.prompt, /三会贵人|构成完整三会成局|形成完整三会成局/);

  const southFire = core.zodiac.getZodiacYearFortune('午', '辛未');
  assert.equal(southFire.meeting, '三会关系（南方火）');
  assert.equal(southFire.noble, '六合贵人');
  assert.ok(!southFire.favorableRelations.includes(southFire.meeting));
  assert.ok(!southFire.riskRelations.includes(southFire.meeting));
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

test('tarot: 全部牌义应保留原文并生成条件化解释事实', () => {
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
  assert.ok(
    facts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.ok(facts.some((item) => /表示这些能量正在直接发挥作用/.test(item.originalText)));
  assert.ok(facts.some((item) => /成功比预期更晚到来/.test(item.originalText)));
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /表示这些能量正在直接发挥作用|成功比预期更晚到来|信息被隐藏|一定|必然/,
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

test('tarot: 条件化牌义不得把象征解释写成现实事实', () => {
  const promptText = [
    '正位强调成功、喜悦、活力，表示这些能量正在直接发挥作用。',
    '逆位重点：信息被隐藏，或成功比预期更晚到来。',
  ]
    .map(conditionTarotTraditionalText)
    .join('；');

  assert.match(promptText, /正位传统牌义侧重/);
  assert.match(promptText, /逆位传统牌义提示可留意/);
  assert.match(promptText, /须结合牌位.*现实资料核实/);
  assert.doesNotMatch(promptText, /表示这些能量正在直接发挥作用|信息被隐藏|成功比预期更晚到来/);
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
  assert.doesNotMatch(r.prompt, /结构化证据|观察层级|证据汇总|计算链|解释限制/);
  assert.equal(r.evidenceAnalysis.key, 'taiyi:evidence');
  assert.equal(r.evidenceAnalysis.status, '已计算');
  assert.match(r.evidenceAnalysis.promptText, /【太乙五计七十二局结构化证据】/);
  assert.deepEqual(
    r.evidenceAnalysis.calculationSteps.map((step) => step.name),
    ['入纪元数', '元数', '纪数', '局数'],
  );
  assert.ok(
    r.evidenceAnalysis.calculationSteps.every(
      (step) =>
        step.key.startsWith('taiyi:calculation:') &&
        step.status === '已核验' &&
        Array.isArray(step.dependsOnStepKeys) &&
        step.promptText &&
        step.sources.length >= 2 &&
        step.limitation.includes('不证明传统解释有效性'),
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
      ['囚', '未命中'],
      ['主将参中宫', '未命中'],
      ['客将参中宫', '未命中'],
    ],
  );
  assert.equal(r.evidenceAnalysis.counterSummaryFact.status, '存在未命中条件');
  assert.equal(r.evidenceAnalysis.counterSummaryFact.factKeys.length, 3);
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
  assert.ok(r.evidenceAnalysis.conditionFacts.some((item) => item.kind === '囚' && !item.matched));
  assert.match(r.evidenceAnalysis.promptText, /算式核验：.*入纪元数.*元数.*纪数.*局数/);
  assert.ok(r.evidenceAnalysis.primaryFacts.some((item) => item.startsWith('掩成立')));
  assert.ok(r.evidenceAnalysis.counterEvidence.some((item) => item.startsWith('未见囚')));
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
  assertPromptIsPortableTaskText(r.evidenceAnalysis.promptText);
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
        aspect.orb >= 0 &&
        aspect.allowedOrb > 0 &&
        aspect.orb <= aspect.allowedOrb &&
        aspect.orbRatio >= 0 &&
        aspect.orbRatio <= 1 &&
        aspect.strength === undefined,
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
  assert.match(r.prompt, /月相：/);
  assert.match(r.prompt, /出生时刻光照：/);
  assert.doesNotMatch(r.prompt, /结构化证据|坐标与精度边界|计算链|证据汇总|解释限制/);
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
  assert.match(r.prompt, /月相：.+日月黄经差约.+照明约/);
  assert.match(r.prompt, /出生时刻光照：太阳高度.+方位角.+视太阳正午/);
  assert.match(r.evidenceAnalysis.promptText, /【七政四余计算来源与证据分层】/);
  assert.equal(r.evidenceAnalysis.key, 'qizheng:evidence');
  assert.equal(r.evidenceAnalysis.status, '已计算');
  assert.equal(r.evidenceAnalysis.calculationFact.status, '含默认值');
  assert.equal(r.evidenceAnalysis.calculationFact.steps.length, 7);
  assert.strictEqual(r.evidenceAnalysis.calculationSteps, r.evidenceAnalysis.calculationFact.steps);
  assert.equal(r.evidenceAnalysis.calculationChain.length, 7);
  const qizhengStepKeys = new Set(r.evidenceAnalysis.calculationFact.steps.map((item) => item.key));
  assert.ok(r.evidenceAnalysis.calculationFact.defaults.some((item) => item.includes('默认北京')));
  assert.ok(
    r.evidenceAnalysis.calculationFact.steps.every(
      (item) =>
        item.key.startsWith('qizheng:calculation:') &&
        item.status === '已计算' &&
        item.dependsOnStepKeys.every((key) => qizhengStepKeys.has(key)) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把步骤完整度解释为观测级精度'),
    ),
  );
  assert.equal(r.evidenceAnalysis.positionSourceFacts.length, r.positionSources.length);
  assert.ok(
    r.evidenceAnalysis.positionSourceFacts.every(
      (item) =>
        item.key.startsWith('qizheng:position-source:') &&
        item.status === '已采用' &&
        item.objects.length > 0 &&
        item.adoptedSources.length > 0 &&
        item.promptLimitations.every((text) => !text.includes('本项目')) &&
        item.promptText &&
        item.limitation.includes('不等于结果达到观测级精度'),
    ),
  );
  assert.equal(r.evidenceAnalysis.starFacts.length, r.stars.length);
  assert.equal(r.evidenceAnalysis.aspectFacts.length, r.aspects.length);
  assert.deepEqual(
    r.evidenceAnalysis.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['输入完整性', '含默认值'],
      ['位置精度分层', '混合模型'],
      ['吊照覆盖', '有可用证据'],
    ],
  );
  assert.equal(r.evidenceAnalysis.counterSummaryFact.status, '存在需保留反证');
  assert.equal(r.evidenceAnalysis.counterSummaryFact.factKeys.length, 2);
  assert.equal(r.evidenceAnalysis.summaryFact.key, 'qizheng:evidence-summary');
  assert.equal(r.evidenceAnalysis.summaryFact.status, '证据链有缺口');
  assert.equal(
    r.evidenceAnalysis.summaryFact.positionSourceFactCount,
    r.evidenceAnalysis.positionSourceFacts.length,
  );
  assert.equal(r.evidenceAnalysis.summaryFact.starFactCount, r.evidenceAnalysis.starFacts.length);
  assert.equal(
    r.evidenceAnalysis.summaryFact.aspectFactCount,
    r.evidenceAnalysis.aspectFacts.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.counterEvidenceCount,
    r.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    r.evidenceAnalysis.summaryFact.limitationFactCount,
    r.evidenceAnalysis.limitationFacts.length,
  );
  assert.equal(r.evidenceAnalysis.limitationFacts.length, 7);
  const qizhengFactKeys = new Set([
    r.evidenceAnalysis.summaryFact.key,
    ...r.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    r.evidenceAnalysis.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => qizhengFactKeys.has(key)),
    ),
  );
  assert.ok(
    r.evidenceAnalysis.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => qizhengFactKeys.has(key)) &&
        item.sources.length > 0,
    ),
  );
  assert.ok(
    r.evidenceAnalysis.starFacts.every(
      (item) =>
        item.sourceId &&
        item.sources.length >= 3 &&
        item.promptText &&
        item.limitation.includes('现代天文计算和传统均速模型必须分层使用'),
    ),
  );
  assert.ok(
    r.evidenceAnalysis.aspectFacts.every(
      (item) =>
        item.allowedOrb > 0 &&
        item.orb <= item.allowedOrb &&
        item.sources.length >= 2 &&
        item.promptText.includes('允许容许度') &&
        item.limitation.includes('混合模型不得提升为现代天文同精度证据'),
    ),
  );
  assert.match(r.evidenceAnalysis.promptText, /现代天文计算/);
  assert.match(r.evidenceAnalysis.promptText, /传统均速模型/);
  assert.doesNotMatch(r.evidenceAnalysis.promptText, /本项目|项目统一|项目恒星黄经|命语/);
  assert.match(
    r.evidenceAnalysis.promptText,
    /实际夹角.*精确角.*允许容许度.*距精确角偏差.*归一化容许度位置/,
  );
  assert.match(r.evidenceAnalysis.promptText, /命宫、身宫与命主定位/);
  assert.match(r.evidenceAnalysis.promptText, /紫炁与神煞定位/);
  assert.match(r.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制：/);
  assert.ok(r.evidenceAnalysis.primaryFacts.some((item) => item.includes('命宫落黄道第')));
  assert.ok(r.evidenceAnalysis.supportingFacts.some((item) => item.startsWith('神煞定位：')));
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
  assert.equal(supplied.evidenceAnalysis.calculationFact.status, '输入明确');
  assert.equal(supplied.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.deepEqual(supplied.evidenceAnalysis.calculationFact.defaults, []);

  const partial = core.qizheng.generateQizheng({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    latitude: 31.23,
  });
  assert.equal(partial.calculationContext.locationSource, '部分坐标使用默认值');
  assert.equal(partial.evidenceAnalysis.calculationFact.status, '含默认值');
  assert.equal(partial.evidenceAnalysis.summaryFact.status, '证据链有缺口');
  assert.ok(
    partial.evidenceAnalysis.calculationFact.defaults.some((item) =>
      item.includes('部分坐标使用默认值'),
    ),
  );
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
