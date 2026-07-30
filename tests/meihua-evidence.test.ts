import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMeihuaEvidence,
  conditionMeihuaTraditionalText,
  generateMeihua,
} from 'mingyu-core/divination/meihua';
import { hexagramsData, trigramsByIndex } from '../packages/core/src/divination/hexagram-data.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-01-01T08:00:00+08:00');
const trigrams = Object.values(trigramsByIndex);
const trigramByName = new Map(trigrams.map((item) => [item.name, item]));
const trigramByLines = new Map(trigrams.map((item) => [item.lines.join(''), item]));
const elementGenerates: Record<string, string> = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};
const elementControls: Record<string, string> = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};
const hexagramByTrigrams = new Map(
  hexagramsData.map((item) => [`${item.upper}:${item.lower}`, item]),
);
const hexagramByBinary = new Map(hexagramsData.map((item) => [item.binarySymbol, item]));

function expectedInterRelation(role: '体互' | '用互', response: string, originalTi: string) {
  if (response === originalTi) return `${role}与原体比和`;
  if (elementGenerates[response] === originalTi) return `${role}生原体`;
  if (elementGenerates[originalTi] === response) return `原体生${role}`;
  if (elementControls[response] === originalTi) return `${role}克原体`;
  if (elementControls[originalTi] === response) return `原体克${role}`;
  throw new Error(`无法核对${role}${response}与原体${originalTi}的五行关系`);
}

function expectedResponseRelation(response: string, originalTi: string) {
  if (response === originalTi) return '与体比和';
  if (elementGenerates[response] === originalTi) return '生体';
  if (elementGenerates[originalTi] === response) return '体生应卦';
  if (elementControls[response] === originalTi) return '克体';
  return '体克应卦';
}

function buildMeihuaCase(
  base: ReturnType<typeof generateMeihua>,
  main: (typeof hexagramsData)[number],
  movingYao: number,
) {
  const upper = trigramByName.get(main.upper);
  const lower = trigramByName.get(main.lower);
  assert.ok(upper && lower);
  const mainLines = [...lower.lines, ...upper.lines];
  const interLower = trigramByLines.get(mainLines.slice(1, 4).join(''));
  const interUpper = trigramByLines.get(mainLines.slice(2, 5).join(''));
  const changedLines = [...mainLines];
  changedLines[movingYao - 1] = changedLines[movingYao - 1] === 1 ? 0 : 1;
  const changedLower = trigramByLines.get(changedLines.slice(0, 3).join(''));
  const changedUpper = trigramByLines.get(changedLines.slice(3, 6).join(''));
  assert.ok(interLower && interUpper && changedLower && changedUpper);
  const inter = hexagramByTrigrams.get(`${interUpper.name}:${interLower.name}`);
  const changed = hexagramByTrigrams.get(`${changedUpper.name}:${changedLower.name}`);
  assert.ok(inter && changed);
  const movingInLower = movingYao <= 3;
  const ti = movingInLower ? upper : lower;
  const yong = movingInLower ? lower : upper;
  const changedTi = movingInLower ? changedUpper : changedLower;
  const changedYong = movingInLower ? changedLower : changedUpper;
  const interTi = movingInLower ? interUpper : interLower;
  const interYong = movingInLower ? interLower : interUpper;
  const toHexagram = (item: (typeof hexagramsData)[number]) => ({
    name: item.name,
    symbol: item.symbol,
    upper: item.upper,
    lower: item.lower,
    description: item.description,
    yaoCi: item.yaoCi,
    yongCi: item.yongCi,
  });

  return {
    ...base,
    originalName: main.name,
    interName: inter.name,
    changedName: changed.name,
    tiGua: ti,
    yongGua: yong,
    interTiGua: interTi,
    interYongGua: interYong,
    changedTiGua: changedTi,
    changedYongGua: changedYong,
    mainHexagram: toHexagram(main),
    interHexagram: toHexagram(inter),
    changedHexagram: toHexagram(changed),
    movingYao: {
      position: movingYao,
      description: `第${movingYao}爻动`,
      yaoName: ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][movingYao - 1],
    },
    yaosDetail: mainLines.map((line, index) => ({
      position: index + 1,
      yaoType: (line === 1 ? '阳' : '阴') as '阳' | '阴',
      isChanging: index === movingYao - 1,
      tiYong: movingInLower
        ? index < 3
          ? ('用' as const)
          : ('体' as const)
        : index < 3
          ? ('体' as const)
          : ('用' as const),
    })),
    evidenceAnalysis: undefined,
  };
}

test('梅花排盘应内置主互变三阶段结构化证据', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'meihua:evidence');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.calculationSteps.length, 7);
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.ok(
    evidence.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        evidence.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.deepEqual(
    evidence.stages.map((item) => item.stage),
    ['origin', 'process', 'result'],
  );
  assert.equal(evidence.stageCoverageFact.status, '完整');
  assert.deepEqual(evidence.stageCoverageFact.actualStages, ['origin', 'process', 'result']);
  assert.equal(evidence.hexagramStructureFacts.length, 3);
  assert.equal(evidence.yaoCoverageFact.status, '完整');
  assert.equal(evidence.yaoStructureFacts.length, 6);
  assert.deepEqual(evidence.yaoCoverageFact.changingPositions, [data.movingYao.position]);
  assert.ok(
    evidence.stages.every(
      (item) =>
        item.key.startsWith('meihua:stage:') &&
        item.status === '已计算' &&
        item.hexagramFactKey?.startsWith('meihua:hexagram:') &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得直接解释为现实起因'),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.hexagramFactCount, evidence.hexagramStructureFacts.length);
  assert.equal(evidence.summaryFact.yaoFactCount, evidence.yaoStructureFacts.length);
  assert.equal(evidence.summaryFact.stageFactCount, evidence.stages.length);
  assert.equal(evidence.summaryFact.interResponseFactCount, evidence.interResponseFacts.length);
  assert.equal(evidence.summaryFact.partyFactCount, 1);
  assert.equal(
    evidence.summaryFact.responseInteractionFactCount,
    evidence.responseInteractionFacts.length,
  );
  assert.equal(evidence.summaryFact.motionFactCount, 2);
  assert.equal(evidence.summaryFact.spatialOmenFactCount, 1);
  assert.equal(evidence.summaryFact.sensoryOmenFactCount, 1);
  assert.equal(evidence.summaryFact.foodContextFactCount, 1);
  assert.equal(evidence.summaryFact.objectContextFactCount, 1);
  assert.equal(evidence.summaryFact.topicResponseContextFactCount, 1);
  assert.equal(evidence.summaryFact.tenResponseContextFactCount, 1);
  assert.equal(evidence.summaryFact.matterTenResponseContextFactCount, 1);
  assert.equal(evidence.summaryFact.trigramResponseCatalogFactCount, 1);
  assert.equal(
    evidence.summaryFact.hexagramDispositionFactCount,
    evidence.hexagramDispositionFacts.length,
  );
  assert.equal(evidence.summaryFact.hexagramDispositionVersionFactCount, 1);
  assert.equal(evidence.internalMotionFact.status, '已计算');
  assert.deepEqual(
    evidence.internalMotionFact.references.map((item) => [item.role, item.motion]),
    [
      ['原体', '静'],
      ['主卦用卦', '动'],
      ['体互', '静'],
      ['用互', '静'],
      ['变卦用卦', '动'],
    ],
  );
  assert.equal(evidence.externalMotionFact.status, '资料不足');
  assert.deepEqual(
    evidence.externalMotionFact.missingObservationFields,
    evidence.externalMotionFact.requiredObservationFields,
  );
  assert.equal(evidence.spatialOmenFact.status, '资料不足');
  assert.deepEqual(evidence.spatialOmenFact.availableObservationFields, []);
  assert.deepEqual(
    evidence.spatialOmenFact.missingObservationFields,
    evidence.spatialOmenFact.requiredObservationFields,
  );
  assert.equal(evidence.sensoryOmenFact.status, '资料不足');
  assert.deepEqual(evidence.sensoryOmenFact.availableObservationFields, []);
  assert.deepEqual(
    evidence.sensoryOmenFact.missingObservationFields,
    evidence.sensoryOmenFact.requiredObservationFields,
  );
  assert.deepEqual(evidence.sensoryOmenFact.requiredObservationFields, [
    '耳闻目见的现场原始记录',
    '观察发生在成卦前或成卦后',
    '观察发生的准确时间或先后次序',
    '声音、言语、人物、器物、鸟兽、饮食或环境等对象类别',
    '对象实际内容、形态、完整缺损及来往动静',
    '求测者当时明确指向或关注的对象',
    '所占事项与该观察的现实关联',
  ]);
  assert.match(evidence.sensoryOmenFact.promptText, /观物克应法.*圆物、负土、刚健或柔腐/);
  assert.ok(evidence.sensoryOmenFact.sources.some((item) => /观物克应法.*第944至945行/.test(item)));
  for (const key of ['eventPhase', 'omen', 'date', 'score', 'weight', 'probability']) {
    assert.equal(key in evidence.sensoryOmenFact, false);
  }
  assert.equal(evidence.foodContextFact.status, '资料不足');
  assert.deepEqual(evidence.foodContextFact.availableContextFields, []);
  assert.deepEqual(
    evidence.foodContextFact.missingContextFields,
    evidence.foodContextFact.requiredContextFields,
  );
  assert.equal(evidence.foodContextFact.requiredContextFields.length, 5);
  assert.deepEqual(evidence.foodContextFact.availableChartFields, [
    '起卦时点与干支',
    '主卦、互卦、变卦上下经卦',
    '动爻位置与卦内体用动静',
    '起卦月份与四时旺衰',
  ]);
  for (const key of [
    'food',
    'dish',
    'taste',
    'cookingMethod',
    'guest',
    'host',
    'canEat',
    'illness',
    'score',
    'weight',
    'probability',
  ]) {
    assert.equal(key in evidence.foodContextFact, false);
  }
  assert.equal(evidence.objectContextFact.status, '资料不足');
  assert.deepEqual(evidence.objectContextFact.availableContextFields, []);
  assert.deepEqual(
    evidence.objectContextFact.missingContextFields,
    evidence.objectContextFact.requiredContextFields,
  );
  assert.equal(evidence.objectContextFact.requiredContextFields.length, 3);
  assert.equal(evidence.objectContextFact.availableChartFields.length, 4);
  assert.equal(evidence.objectContextFact.selectionOrderFields.length, 4);
  assert.equal(evidence.objectContextFact.relationRuleFields.length, 5);
  assert.equal(evidence.objectContextFact.quantityRuleFields.length, 6);
  assert.equal(evidence.objectContextFact.bodySelectionRuleFields.length, 5);
  assert.equal(evidence.objectContextFact.lineStructureRuleFields.length, 3);
  assert.equal(evidence.objectContextFact.changeObservationRuleFields.length, 5);
  assert.equal(evidence.objectContextFact.responseOmenRuleFields.length, 6);
  assert.equal(evidence.objectContextFact.seasonalObservationRuleFields.length, 7);
  assert.match(
    evidence.objectContextFact.changeObservationRuleFields[0] ?? '',
    /凡观物.*不是所有梅花问题/,
  );
  assert.match(
    evidence.objectContextFact.changeObservationRuleFields[1] ?? '',
    /不直接覆盖普通体用主线/,
  );
  assert.match(evidence.objectContextFact.changeObservationRuleFields[2] ?? '', /乾变巽.*天风姤/);
  assert.match(evidence.objectContextFact.changeObservationRuleFields[3] ?? '', /乾变离.*天火同人/);
  assert.match(evidence.objectContextFact.changeObservationRuleFields[4] ?? '', /乾变兑.*天泽履/);
  assert.match(evidence.objectContextFact.responseOmenRuleFields[0] ?? '', /只适用于明确观物/);
  assert.match(evidence.objectContextFact.responseOmenRuleFields[1] ?? '', /体卦克应.*没有给出/);
  assert.match(
    evidence.objectContextFact.responseOmenRuleFields[2] ?? '',
    /成卦未决之际.*现场原始观察/,
  );
  assert.match(evidence.objectContextFact.responseOmenRuleFields[3] ?? '', /圆物.*圆形候选/);
  assert.match(evidence.objectContextFact.responseOmenRuleFields[4] ?? '', /负土者.*土中之物候选/);
  assert.match(evidence.objectContextFact.responseOmenRuleFields[5] ?? '', /刚健或柔腐.*属性候选/);
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[0] ?? '',
    /趣时察理.*四时与卦象/,
  );
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[1] ?? '',
    /春时得震、离.*花类候选/,
  );
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[2] ?? '',
    /夏时得震.*有声之物候选/,
  );
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[3] ?? '',
    /秋时得兑.*毁折成器/,
  );
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[4] ?? '',
    /冬时得坤.*无用土物候选/,
  );
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[5] ?? '',
    /“得”.*不用通用盘面自动匹配/,
  );
  assert.match(
    evidence.objectContextFact.seasonalObservationRuleFields[6] ?? '',
    /未列卦象.*不得类推/,
  );
  assert.equal(evidence.objectContextFact.usageExampleFields.length, 7);
  assert.match(
    evidence.objectContextFact.usageExampleFields[0] ?? '',
    /历史命中案例.*不构成.*通用规则表/,
  );
  assert.match(evidence.objectContextFact.usageExampleFields[1] ?? '', /地天泰.*草木.*新采/);
  assert.match(evidence.objectContextFact.usageExampleFields[2] ?? '', /泰初爻.*地风升.*雷泽归妹/);
  assert.match(evidence.objectContextFact.usageExampleFields[3] ?? '', /干根.*清色.*兑.*黄根/);
  assert.match(evidence.objectContextFact.usageExampleFields[4] ?? '', /火风鼎.*雷风恒.*玉绦环/);
  assert.match(evidence.objectContextFact.usageExampleFields[5] ?? '', /鼎上爻.*雷风恒.*泽天夬/);
  assert.match(
    evidence.objectContextFact.usageExampleFields[6] ?? '',
    /声价气势.*锺覆物.*历史实例/,
  );
  assert.equal(evidence.objectContextFact.handGuessRuleFields.length, 10);
  assert.match(evidence.objectContextFact.handGuessRuleFields[0] ?? '', /凡猜手中物.*不是普通观物/);
  assert.match(evidence.objectContextFact.handGuessRuleFields[3] ?? '', /艮.*逢兑克.*不自动合并/);
  assert.match(evidence.objectContextFact.handGuessRuleFields[4] ?? '', /遇兑之属可食.*句读/);
  assert.match(evidence.objectContextFact.handGuessRuleFields[6] ?? '', /离色亦.*不补字/);
  assert.match(evidence.objectContextFact.handGuessRuleFields[8] ?? '', /春震巽.*秋乾兑.*否则/);
  assert.match(evidence.objectContextFact.handGuessRuleFields[9] ?? '', /六虚冲破.*不自动判定空手/);
  assert.equal(evidence.objectContextFact.sourceLineFields.length, 11);
  assert.match(evidence.objectContextFact.sourceLineFields[10] ?? '', /凡猜手中物.*六虚冲破/);
  assert.equal(evidence.objectContextFact.unresolvedRuleFields.length, 48);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[0] ?? '', /艮象.*题作“离”/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[1] ?? '', /困于株林.*困于株木/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[2] ?? '', /体生方圆曲直/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[3] ?? '', /用变互卦/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[4] ?? '', /互卦数例/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[5] ?? '', /凡卦之多者/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[6] ?? '', /非金非石/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[7] ?? '', /不入五行物/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[8] ?? '', /阳爻多/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[9] ?? '', /三种取主口径/);
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[10] ?? '',
    /标题作“观物看变爻为主”.*正文却作“以变卦为主”/,
  );
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[11] ?? '',
    /巽、离、兑.*姤、同人、履/,
  );
  assert.match(evidence.objectContextFact.unresolvedRuleFields[12] ?? '', /只列纯乾卦初至三爻/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[13] ?? '', /物之成败/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[14] ?? '', /体卦克应.*四例/);
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[15] ?? '',
    /第一所见.*2025年现代编辑本/,
  );
  assert.match(evidence.objectContextFact.unresolvedRuleFields[16] ?? '', /趣时察理.*旺衰修正/);
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[17] ?? '',
    /四次“得”.*主卦.*任意出现/,
  );
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[18] ?? '',
    /春得震、离.*任一即成.*组合同见/,
  );
  assert.match(evidence.objectContextFact.unresolvedRuleFields[19] ?? '', /夏震.*震雷声类象/);
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[20] ?? '',
    /毁折成器.*两类并列.*复合状态/,
  );
  assert.match(evidence.objectContextFact.unresolvedRuleFields[21] ?? '', /冬坤.*旺衰.*体用生克/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[22] ?? '', /节气.*农历月.*月建地支/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[23] ?? '', /其他卦象.*完整规则表/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[24] ?? '', /起卦时间.*不能复现/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[25] ?? '', /初变升.*初爻/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[26] ?? '', /干根.*新采于土中/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[27] ?? '', /清色.*青色.*现代改写/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[28] ?? '', /兑为黄根.*白色类象/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[29] ?? '', /没有明写上爻动.*反推/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[30] ?? '', /声价气势.*身价气势/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[31] ?? '', /锺覆物.*外部容器/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[32] ?? '', /虽圆面毁.*而毁/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[33] ?? '', /玉绦环.*分别来自/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[34] ?? '', /成功案例.*不能推广/);
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[35] ?? '',
    /合并及优先顺序.*自动匹配/,
  );
  assert.match(evidence.objectContextFact.unresolvedRuleFields[36] ?? '', /猜手中物.*如何起卦/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[37] ?? '', /有气.*现有四时旺衰/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[38] ?? '', /无价.*价值判断/);
  assert.match(
    evidence.objectContextFact.unresolvedRuleFields[39] ?? '',
    /逢兑克.*不能自动判定破损/,
  );
  assert.match(evidence.objectContextFact.unresolvedRuleFields[40] ?? '', /遇兑之属可食.*承接/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[41] ?? '', /有气柔.*承接/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[42] ?? '', /震、巽遇坎.*主互变组合/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[43] ?? '', /离色亦.*同源/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[44] ?? '', /有水有木.*同时出现/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[45] ?? '', /春震巽.*否则/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[46] ?? '', /六虚冲破.*六爻空破/);
  assert.match(evidence.objectContextFact.unresolvedRuleFields[47] ?? '', /优先顺序.*自动猜物/);
  for (const key of [
    'handObject',
    'matchedHistoricalExample',
    'predictedObject',
    'revealedObject',
    'observedObject',
    'externalObject',
    'object',
    'material',
    'shape',
    'color',
    'root',
    'sound',
    'smell',
    'hardness',
    'wetness',
    'decay',
    'burned',
    'motion',
    'position',
    'damage',
    'damaged',
    'opening',
    'value',
    'use',
    'utility',
    'edible',
    'count',
    'bodyCandidate',
    'dominantTrigram',
    'dominantElement',
    'changedObservation',
    'seasonalCandidate',
    'hasQi',
    'emptyHand',
    'yangCount',
    'yinCount',
    'flying',
    'success',
    'failure',
    'result',
    'score',
    'weight',
    'probability',
  ]) {
    assert.equal(key in evidence.objectContextFact, false);
  }
  assert.equal(evidence.topicResponseContextFact.status, '资料不足');
  assert.deepEqual(evidence.topicResponseContextFact.availableContextFields, []);
  assert.deepEqual(
    evidence.topicResponseContextFact.missingContextFields,
    evidence.topicResponseContextFact.requiredContextFields,
  );
  assert.equal(evidence.topicResponseContextFact.requiredContextFields.length, 4);
  assert.equal(evidence.topicResponseContextFact.availableChartFields.length, 4);
  assert.equal(evidence.topicResponseContextFact.topicScopes.length, 17);
  assert.equal(evidence.topicResponseContextFact.crossTopicConflictFields.length, 4);
  assert.equal(evidence.topicResponseContextFact.highRiskRuleFields.length, 5);
  assert.equal(evidence.topicResponseContextFact.unresolvedRuleFields.length, 1);
  assert.match(evidence.topicResponseContextFact.crossTopicConflictFields[0] ?? '', /人事.*行人/);
  assert.match(evidence.topicResponseContextFact.unresolvedRuleFields[0] ?? '', /比和凶则有救星/);
  for (const key of [
    'topic',
    'target',
    'weather',
    'fetalSex',
    'diagnosis',
    'prescription',
    'supernaturalCause',
    'selfHarmCause',
    'lawsuitResult',
    'marriageResult',
    'financialResult',
    'score',
    'weight',
    'probability',
  ]) {
    assert.equal(key in evidence.topicResponseContextFact, false);
  }
  assert.equal(evidence.tenResponseContextFact.status, '资料不足');
  assert.deepEqual(evidence.tenResponseContextFact.responseCatalogFields, [
    '正应',
    '互应',
    '变应',
    '方应',
    '日应',
    '刻应',
    '外应',
    '天时应',
    '地理应',
    '人事应',
  ]);
  assert.equal(evidence.tenResponseContextFact.reusedInternalResponseFields.length, 3);
  assert.match(
    evidence.tenResponseContextFact.reusedInternalResponseFields[0] ?? '',
    /stage:origin/,
  );
  assert.match(
    evidence.tenResponseContextFact.reusedInternalResponseFields[1] ?? '',
    /inter-response:ti.*inter-response:yong/,
  );
  assert.match(
    evidence.tenResponseContextFact.reusedInternalResponseFields[2] ?? '',
    /stage:result/,
  );
  assert.deepEqual(evidence.tenResponseContextFact.availableContextFields, []);
  assert.deepEqual(
    evidence.tenResponseContextFact.missingContextFields,
    evidence.tenResponseContextFact.requiredContextFields,
  );
  assert.equal(evidence.tenResponseContextFact.requiredContextFields.length, 8);
  assert.equal(evidence.tenResponseContextFact.availableChartFields.length, 5);
  assert.equal(evidence.tenResponseContextFact.sourceLineFields.length, 25);
  assert.equal(evidence.tenResponseContextFact.unresolvedRuleFields.length, 8);
  assert.equal(evidence.tenResponseContextFact.highRiskRuleFields.length, 4);
  assert.match(evidence.tenResponseContextFact.sourceLineFields[2] ?? '', /十应之说.*此二卦之诀/);
  assert.match(evidence.tenResponseContextFact.sourceLineFields[19] ?? '', /火见雷为比和/);
  assert.match(evidence.tenResponseContextFact.sourceLineFields[21] ?? '', /并为体卦/);
  assert.match(evidence.tenResponseContextFact.sourceLineFields[24] ?? '', /无复生理.*类推之/);
  assert.match(evidence.tenResponseContextFact.promptText, /正应、互应、变应三项只回指/);
  assert.match(evidence.tenResponseContextFact.promptText, /日支虽已记录，但不能自动生成日应吉凶/);
  for (const key of [
    'direction',
    'visitorDirection',
    'dayResponse',
    'timeOmen',
    'externalOmen',
    'weatherOmen',
    'geographyOmen',
    'humanOmen',
    'illnessOutcome',
    'recovery',
    'death',
    'auspicious',
    'score',
    'weight',
    'probability',
  ]) {
    assert.equal(key in evidence.tenResponseContextFact, false);
  }
  assert.equal(evidence.matterTenResponseContextFact.status, '资料不足');
  assert.deepEqual(evidence.matterTenResponseContextFact.responseCatalogFields, [
    '行',
    '立',
    '坐',
    '卧',
    '担',
    '券',
    '裹头',
    '跣足',
    '喜',
    '怒',
  ]);
  assert.deepEqual(evidence.matterTenResponseContextFact.availableContextFields, []);
  assert.deepEqual(
    evidence.matterTenResponseContextFact.missingContextFields,
    evidence.matterTenResponseContextFact.requiredContextFields,
  );
  assert.equal(evidence.matterTenResponseContextFact.requiredContextFields.length, 8);
  assert.equal(evidence.matterTenResponseContextFact.availableChartFields.length, 3);
  assert.equal(evidence.matterTenResponseContextFact.sourceLineFields.length, 11);
  assert.equal(evidence.matterTenResponseContextFact.unresolvedRuleFields.length, 10);
  assert.equal(evidence.matterTenResponseContextFact.highRiskRuleFields.length, 6);
  assert.match(evidence.matterTenResponseContextFact.sourceLineFields[0] ?? '', /论日辰秘文/);
  assert.match(evidence.matterTenResponseContextFact.sourceLineFields[5] ?? '', /五担/);
  assert.match(evidence.matterTenResponseContextFact.sourceLineFields[6] ?? '', /六券/);
  assert.match(evidence.matterTenResponseContextFact.sourceLineFields[8] ?? '', /病有孝至/);
  assert.match(evidence.matterTenResponseContextFact.promptText, /现有日干支、月令旺衰/);
  for (const key of [
    'matterResponse',
    'observedResponse',
    'dayElement',
    'dayStrength',
    'legalOutcome',
    'financialOutcome',
    'visitorArrival',
    'documentArrival',
    'illness',
    'fever',
    'treatment',
    'prognosis',
    'spiritCause',
    'mourning',
    'auspicious',
    'score',
    'weight',
    'probability',
  ]) {
    assert.equal(key in evidence.matterTenResponseContextFact, false);
  }
  assert.equal(evidence.trigramResponseCatalogFact.key, 'meihua:trigram-response-catalog');
  assert.equal(evidence.trigramResponseCatalogFact.status, '资料不足');
  assert.deepEqual(evidence.trigramResponseCatalogFact.trigramCatalogFields, [
    '乾',
    '坤',
    '震',
    '巽',
    '坎',
    '离',
    '艮',
    '兑',
  ]);
  assert.deepEqual(evidence.trigramResponseCatalogFact.qianDetailCategoryFields, [
    '天文',
    '天气',
    '凶盗',
    '官贵',
    '身体',
    '性情',
    '声音',
    '信音',
    '事意',
    '疾病',
    '附药',
  ]);
  assert.deepEqual(evidence.trigramResponseCatalogFact.availableContextFields, []);
  assert.deepEqual(
    evidence.trigramResponseCatalogFact.missingContextFields,
    evidence.trigramResponseCatalogFact.requiredContextFields,
  );
  assert.equal(evidence.trigramResponseCatalogFact.requiredContextFields.length, 7);
  assert.equal(evidence.trigramResponseCatalogFact.availableChartFields.length, 3);
  assert.equal(evidence.trigramResponseCatalogFact.sourceLineFields.length, 21);
  assert.equal(evidence.trigramResponseCatalogFact.canonicalCrosscheckFields.length, 8);
  assert.equal(evidence.trigramResponseCatalogFact.unresolvedRuleFields.length, 12);
  assert.equal(evidence.trigramResponseCatalogFact.highRiskRuleFields.length, 7);
  assert.match(evidence.trigramResponseCatalogFact.sourceLineFields[14] ?? '', /＄足/);
  assert.match(evidence.trigramResponseCatalogFact.sourceLineFields[15] ?? '', /三位/);
  assert.match(evidence.trigramResponseCatalogFact.sourceLineFields[17] ?? '', /干卦/);
  assert.match(evidence.trigramResponseCatalogFact.sourceLineFields[19] ?? '', /坚多节/);
  assert.match(evidence.trigramResponseCatalogFact.promptText, /21个非空底本文本行/);
  assert.match(evidence.trigramResponseCatalogFact.promptText, /不自动匹配或补齐类象/);
  for (const key of [
    'matchedTrigram',
    'matchedCatalog',
    'weather',
    'weatherForecast',
    'thief',
    'official',
    'personIdentity',
    'occupation',
    'personality',
    'motive',
    'messageEvent',
    'bodyPart',
    'illness',
    'diagnosis',
    'medicine',
    'prescription',
    'objectAttribute',
    'auspicious',
    'result',
    'score',
    'weight',
    'probability',
    'timing',
    'responseDate',
  ]) {
    assert.equal(key in evidence.trigramResponseCatalogFact, false);
  }
  assert.equal(evidence.hexagramDispositionFacts.length, 3);
  assert.deepEqual(
    evidence.hexagramDispositionFacts.map((item) => item.label),
    ['主卦', '互卦', '变卦'],
  );
  assert.ok(
    evidence.hexagramDispositionFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.binarySymbol.length === 6 &&
        item.reversedHexagram &&
        item.oppositeHexagram &&
        item.dispositionGloss &&
        item.limitation.includes('不等同于现实人物性格'),
    ),
  );
  assert.equal(evidence.hexagramDispositionVersionFact.status, '底本异文待校');
  assert.equal(evidence.hexagramDispositionVersionFact.canonicalGlossCount, 64);
  assert.equal(evidence.hexagramDispositionVersionFact.reversedGroupCount, 36);
  assert.equal(evidence.hexagramDispositionVersionFact.sourceLineFields.length, 18);
  assert.equal(evidence.hexagramDispositionVersionFact.unresolvedRuleFields.length, 8);
  for (const fact of [
    ...evidence.hexagramDispositionFacts,
    evidence.hexagramDispositionVersionFact,
  ]) {
    for (const key of [
      'personality',
      'motive',
      'psychology',
      'event',
      'result',
      'score',
      'weight',
      'probability',
    ]) {
      assert.equal(key in fact, false);
    }
  }
  assert.equal(evidence.summaryFact.transitionFactCount, evidence.transitionFacts.length);
  assert.equal(evidence.summaryFact.traditionalFactCount, evidence.traditionalFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  const processCounterTypes = evidence.counterEvidenceFacts
    .filter((item) => item.stage === 'process')
    .map((item) => item.type);
  assert.ok(processCounterTypes.includes('互卦响应关系限制'));
  assert.ok(processCounterTypes.includes('互卦响应月令限制'));
  assert.equal(evidence.limitationFacts.length, 16);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【梅花主互变关系推进结构化证据】/);
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assert.match(evidence.promptText, /体用动静：/);
  assert.match(evidence.promptText, /坐端应兆：/);
  assert.match(evidence.promptText, /万物外应：/);
  assert.match(evidence.promptText, /饮食专项：/);
  assert.match(evidence.promptText, /观物专项：/);
  assert.match(evidence.promptText, /诸事响应专项：/);
  assert.match(evidence.promptText, /占卜十应：/);
  assert.match(evidence.promptText, /论事十大应：/);
  assert.match(evidence.promptText, /卦应八卦目录：/);
  assert.match(evidence.promptText, /反对性情资料：/);
  assert.match(evidence.promptText, /解释限制：/);
  assert.match(evidence.promptText, /起因.*→.*过程.*；.*过程.*→.*结果/);
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('观物用易两则历史实例的主互变卦与所引爻辞应可复算', () => {
  const base = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const cases = [
    {
      mainName: '地天泰',
      movingYao: 1,
      interName: '雷泽归妹',
      changedName: '地风升',
      yaoCi: /拔茅茹以其汇，征吉/,
      usage: /泰初爻.*地风升.*雷泽归妹/,
    },
    {
      mainName: '火风鼎',
      movingYao: 6,
      interName: '泽天夬',
      changedName: '雷风恒',
      yaoCi: /鼎玉铉，大吉无不利/,
      usage: /鼎上爻.*雷风恒.*泽天夬/,
    },
  ] as const;

  for (const item of cases) {
    const main = hexagramsData.find((hexagram) => hexagram.name === item.mainName);
    assert.ok(main);
    const chart = buildMeihuaCase(base, main, item.movingYao);
    const evidence = analyzeMeihuaEvidence(chart);

    assert.equal(chart.interHexagram.name, item.interName);
    assert.equal(chart.changedHexagram.name, item.changedName);
    assert.match(chart.mainHexagram.yaoCi?.[item.movingYao - 1] ?? '', item.yaoCi);
    assert.ok(evidence.objectContextFact.usageExampleFields.some((line) => item.usage.test(line)));
  }
});

test('梅花互卦过程应让体互、用互分别响应原体，不得在互卦内部重分体用', () => {
  const lowerMoving = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const lowerProcess = analyzeMeihuaEvidence(lowerMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(lowerMoving.movingYao.position <= 3, true);
  assert.equal(lowerMoving.interTiGua?.name, lowerMoving.interHexagram?.upper);
  assert.equal(lowerMoving.interYongGua?.name, lowerMoving.interHexagram?.lower);
  assert.equal(lowerProcess?.kind, '互卦响应关系');
  assert.equal(lowerProcess?.ti, undefined);
  assert.equal(lowerProcess?.yong, undefined);
  assert.equal(lowerProcess?.relation, undefined);
  assert.equal(lowerProcess?.originalTi?.name, lowerMoving.tiGua.name);
  assert.deepEqual(
    lowerProcess?.responses?.map((item) => [item.role, item.response.name, item.relation]),
    [
      ['体互', lowerMoving.interHexagram?.upper, '体互克原体'],
      ['用互', lowerMoving.interHexagram?.lower, '原体生用互'],
    ],
  );
  assert.equal(lowerMoving.analysis.inter1Relation, '体互克原体');
  assert.equal(lowerMoving.analysis.inter2Relation, '原体生用互');
  assert.match(lowerProcess?.basis ?? '', /原体在上.*上互为体互、下互为用互/);

  const upperMoving = generateMeihua(fixedDate, { method: 'number', number: 5 });
  const upperProcess = analyzeMeihuaEvidence(upperMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(upperMoving.movingYao.position >= 4, true);
  assert.equal(upperMoving.interTiGua?.name, upperMoving.interHexagram?.lower);
  assert.equal(upperMoving.interYongGua?.name, upperMoving.interHexagram?.upper);
  assert.equal(upperProcess?.originalTi?.name, upperMoving.tiGua.name);
  assert.deepEqual(
    upperProcess?.responses?.map((item) => [item.role, item.response.name]),
    [
      ['体互', upperMoving.interHexagram?.lower],
      ['用互', upperMoving.interHexagram?.upper],
    ],
  );
  assert.match(upperProcess?.basis ?? '', /原体在下.*下互为体互、上互为用互/);
  assert.doesNotMatch(lowerProcess?.promptText ?? '', /体卦坎水.*用卦艮土.*用克体/);
});

test('梅花六十四卦六动爻的原体、体互、用互与变卦体位应逐案一致', () => {
  const base = generateMeihua(fixedDate, { method: 'number', number: 123 });
  let checked = 0;

  for (const main of hexagramsData) {
    for (let movingYao = 1; movingYao <= 6; movingYao += 1) {
      const data = buildMeihuaCase(base, main, movingYao);
      const evidence = analyzeMeihuaEvidence(data);
      const origin = evidence.stages.find((item) => item.stage === 'origin');
      const process = evidence.stages.find((item) => item.stage === 'process');
      const result = evidence.stages.find((item) => item.stage === 'result');
      const movingInLower = movingYao <= 3;
      const expectedOriginalTi = movingInLower ? main.upper : main.lower;
      const expectedInterTi = movingInLower ? data.interHexagram?.upper : data.interHexagram?.lower;
      const expectedInterYong = movingInLower
        ? data.interHexagram?.lower
        : data.interHexagram?.upper;
      const originalTiElement = trigramByName.get(expectedOriginalTi)?.element;
      const interTiElement = trigramByName.get(expectedInterTi ?? '')?.element;
      const interYongElement = trigramByName.get(expectedInterYong ?? '')?.element;
      assert.ok(originalTiElement && interTiElement && interYongElement);

      assert.equal(origin?.ti?.name, expectedOriginalTi);
      assert.equal(process?.originalTi?.name, expectedOriginalTi);
      assert.equal(result?.ti?.name, expectedOriginalTi);
      assert.deepEqual(
        process?.responses?.map((item) => [item.role, item.response.name, item.relation]),
        [
          [
            '体互',
            expectedInterTi,
            expectedInterRelation('体互', interTiElement, originalTiElement),
          ],
          [
            '用互',
            expectedInterYong,
            expectedInterRelation('用互', interYongElement, originalTiElement),
          ],
        ],
      );
      assert.equal(process?.relation, undefined);
      assert.equal(evidence.interResponseFacts.length, 2);
      checked += 1;
    }
  }

  assert.equal(checked, 384);
});

test('梅花六十四卦反对性情资料应完整闭合综卦、错卦与版本边界', () => {
  const base = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const mainHexagrams = new Set<string>();
  const reversedGroups = new Set<string>();
  let selfReversedCount = 0;

  for (const main of hexagramsData) {
    const evidence = analyzeMeihuaEvidence(buildMeihuaCase(base, main, 1));
    const fact = evidence.hexagramDispositionFacts.find((item) => item.stage === 'origin');
    assert.ok(fact);
    const reversed = hexagramByBinary.get([...main.binarySymbol].reverse().join(''));
    const opposite = hexagramByBinary.get(
      [...main.binarySymbol].map((line) => (line === '1' ? '0' : '1')).join(''),
    );
    assert.ok(reversed && opposite);

    mainHexagrams.add(fact.hexagram);
    reversedGroups.add([main.id, reversed.id].sort((left, right) => left - right).join(':'));
    if (reversed.id === main.id) selfReversedCount += 1;
    assert.equal(fact.binarySymbol, main.binarySymbol);
    assert.equal(fact.reversedHexagram, reversed.name);
    assert.equal(fact.reversedRelation, reversed.id === main.id ? '自身综卦' : '另卦相综');
    assert.equal(fact.oppositeHexagram, opposite.name);
    assert.ok(fact.dispositionGloss);

    const reversedTwice = hexagramByBinary.get([...reversed.binarySymbol].reverse().join(''));
    const oppositeTwice = hexagramByBinary.get(
      [...opposite.binarySymbol].map((line) => (line === '1' ? '0' : '1')).join(''),
    );
    assert.equal(reversedTwice?.id, main.id);
    assert.equal(oppositeTwice?.id, main.id);
    assert.equal(evidence.hexagramDispositionVersionFact.canonicalGlossCount, 64);
    assert.equal(evidence.hexagramDispositionVersionFact.reversedGroupCount, 36);
    assert.equal(evidence.hexagramDispositionVersionFact.sourceLineFields.length, 18);
    assert.equal(evidence.hexagramDispositionVersionFact.unresolvedRuleFields.length, 8);
  }

  assert.equal(mainHexagrams.size, 64);
  assert.equal(reversedGroups.size, 36);
  assert.equal(selfReversedCount, 8);
});

test('梅花六十四卦六动爻应逐案区分卦内角色动静且不得补造现场外应', () => {
  const base = generateMeihua(fixedDate, { method: 'number', number: 123 });
  let checked = 0;

  for (const main of hexagramsData) {
    for (let movingYao = 1; movingYao <= 6; movingYao += 1) {
      const data = buildMeihuaCase(base, main, movingYao);
      const evidence = analyzeMeihuaEvidence(data);
      const motion = evidence.internalMotionFact;
      const origin = evidence.stages.find((item) => item.stage === 'origin');
      const result = evidence.stages.find((item) => item.stage === 'result');

      assert.equal(motion.status, '已计算');
      assert.equal(motion.movingYaoPosition, movingYao);
      assert.deepEqual(motion.missingRoles, []);
      assert.deepEqual(motion.actualRoles, motion.expectedRoles);
      assert.deepEqual(motion.movingRoles, ['主卦用卦', '变卦用卦']);
      assert.deepEqual(motion.stillRoles, ['原体', '体互', '用互']);
      assert.deepEqual(
        motion.references.map((item) => [item.role, item.motion, item.basis]),
        [
          ['原体', '静', '体卦为静'],
          ['主卦用卦', '动', '用卦为动'],
          ['体互', '静', '互卦为静'],
          ['用互', '静', '互卦为静'],
          ['变卦用卦', '动', '变卦为动'],
        ],
      );
      assert.equal(motion.references.find((item) => item.role === '原体')?.name, origin?.ti?.name);
      assert.equal(
        motion.references.find((item) => item.role === '主卦用卦')?.name,
        origin?.yong?.name,
      );
      assert.equal(
        motion.references.find((item) => item.role === '变卦用卦')?.name,
        result?.yong?.name,
      );
      assert.equal(evidence.yaoStructureFacts.find((item) => item.isChanging)?.tiYong, '用');
      assert.equal(evidence.externalMotionFact.status, '资料不足');
      assert.deepEqual(evidence.externalMotionFact.availableObservationFields, []);
      assert.deepEqual(
        evidence.externalMotionFact.missingObservationFields,
        evidence.externalMotionFact.requiredObservationFields,
      );
      assert.match(
        evidence.externalMotionFact.promptText,
        /不得把数字、时间、随机方式、问题文本或卦内动爻补写成外应/,
      );
      assert.equal(evidence.spatialOmenFact.status, '资料不足');
      assert.deepEqual(evidence.spatialOmenFact.availableObservationFields, []);
      assert.deepEqual(
        evidence.spatialOmenFact.missingObservationFields,
        evidence.spatialOmenFact.requiredObservationFields,
      );
      assert.deepEqual(evidence.spatialOmenFact.requiredObservationFields, [
        '以求测者所在处为中心的现场观察基准',
        '现场应兆实际出现的八方方位',
        '该方位真实出现的人事、器物或环境兆象',
      ]);
      assert.match(
        evidence.spatialOmenFact.promptText,
        /不得把主卦、互卦、变卦、体用、数字、时间、问题文本、设备方位或行政地名补写成坐端八方应兆/,
      );
      assert.equal('direction' in evidence.spatialOmenFact, false);
      assert.equal('familyMember' in evidence.spatialOmenFact, false);
      assert.equal('bodyPart' in evidence.spatialOmenFact, false);
      assert.equal(evidence.sensoryOmenFact.status, '资料不足');
      assert.deepEqual(evidence.sensoryOmenFact.availableObservationFields, []);
      assert.deepEqual(
        evidence.sensoryOmenFact.missingObservationFields,
        evidence.sensoryOmenFact.requiredObservationFields,
      );
      assert.equal(evidence.sensoryOmenFact.requiredObservationFields.length, 7);
      for (const key of ['eventPhase', 'omen', 'date', 'score', 'weight', 'probability']) {
        assert.equal(key in evidence.sensoryOmenFact, false);
      }
      assert.equal(evidence.foodContextFact.status, '资料不足');
      assert.deepEqual(evidence.foodContextFact.availableContextFields, []);
      assert.deepEqual(
        evidence.foodContextFact.missingContextFields,
        evidence.foodContextFact.requiredContextFields,
      );
      assert.equal(evidence.foodContextFact.requiredContextFields.length, 5);
      assert.equal(evidence.foodContextFact.availableChartFields.length, 4);
      for (const key of [
        'food',
        'dish',
        'taste',
        'cookingMethod',
        'guest',
        'host',
        'canEat',
        'illness',
        'score',
        'weight',
        'probability',
      ]) {
        assert.equal(key in evidence.foodContextFact, false);
      }
      assert.equal(evidence.objectContextFact.status, '资料不足');
      assert.deepEqual(evidence.objectContextFact.availableContextFields, []);
      assert.deepEqual(
        evidence.objectContextFact.missingContextFields,
        evidence.objectContextFact.requiredContextFields,
      );
      assert.equal(evidence.objectContextFact.requiredContextFields.length, 3);
      assert.equal(evidence.objectContextFact.availableChartFields.length, 4);
      assert.equal(evidence.objectContextFact.selectionOrderFields.length, 4);
      assert.equal(evidence.objectContextFact.relationRuleFields.length, 5);
      assert.equal(evidence.objectContextFact.quantityRuleFields.length, 6);
      assert.equal(evidence.objectContextFact.bodySelectionRuleFields.length, 5);
      assert.equal(evidence.objectContextFact.lineStructureRuleFields.length, 3);
      assert.equal(evidence.objectContextFact.changeObservationRuleFields.length, 5);
      assert.equal(evidence.objectContextFact.responseOmenRuleFields.length, 6);
      assert.equal(evidence.objectContextFact.seasonalObservationRuleFields.length, 7);
      assert.equal(evidence.objectContextFact.usageExampleFields.length, 7);
      assert.equal(evidence.objectContextFact.handGuessRuleFields.length, 10);
      assert.equal(evidence.objectContextFact.sourceLineFields.length, 11);
      assert.equal(evidence.objectContextFact.unresolvedRuleFields.length, 48);
      for (const key of [
        'handObject',
        'matchedHistoricalExample',
        'predictedObject',
        'revealedObject',
        'observedObject',
        'externalObject',
        'object',
        'material',
        'shape',
        'color',
        'root',
        'sound',
        'smell',
        'hardness',
        'wetness',
        'decay',
        'burned',
        'motion',
        'position',
        'damage',
        'damaged',
        'opening',
        'value',
        'use',
        'utility',
        'edible',
        'count',
        'bodyCandidate',
        'dominantTrigram',
        'dominantElement',
        'changedObservation',
        'seasonalCandidate',
        'hasQi',
        'emptyHand',
        'yangCount',
        'yinCount',
        'flying',
        'success',
        'failure',
        'result',
        'score',
        'weight',
        'probability',
      ]) {
        assert.equal(key in evidence.objectContextFact, false);
      }
      assert.equal(evidence.topicResponseContextFact.status, '资料不足');
      assert.deepEqual(evidence.topicResponseContextFact.availableContextFields, []);
      assert.deepEqual(
        evidence.topicResponseContextFact.missingContextFields,
        evidence.topicResponseContextFact.requiredContextFields,
      );
      assert.equal(evidence.topicResponseContextFact.requiredContextFields.length, 4);
      assert.equal(evidence.topicResponseContextFact.topicScopes.length, 17);
      assert.equal(evidence.topicResponseContextFact.crossTopicConflictFields.length, 4);
      assert.equal(evidence.topicResponseContextFact.highRiskRuleFields.length, 5);
      assert.equal(evidence.topicResponseContextFact.unresolvedRuleFields.length, 1);
      for (const key of [
        'topic',
        'target',
        'fetalSex',
        'diagnosis',
        'prescription',
        'lawsuitResult',
        'marriageResult',
        'financialResult',
        'score',
        'weight',
        'probability',
      ]) {
        assert.equal(key in evidence.topicResponseContextFact, false);
      }
      assert.equal(evidence.tenResponseContextFact.status, '资料不足');
      assert.deepEqual(evidence.tenResponseContextFact.availableContextFields, []);
      assert.deepEqual(
        evidence.tenResponseContextFact.missingContextFields,
        evidence.tenResponseContextFact.requiredContextFields,
      );
      assert.equal(evidence.tenResponseContextFact.responseCatalogFields.length, 10);
      assert.equal(evidence.tenResponseContextFact.reusedInternalResponseFields.length, 3);
      assert.equal(evidence.tenResponseContextFact.sourceLineFields.length, 25);
      assert.equal(evidence.tenResponseContextFact.unresolvedRuleFields.length, 8);
      assert.equal(evidence.tenResponseContextFact.highRiskRuleFields.length, 4);
      for (const key of [
        'direction',
        'visitorDirection',
        'dayResponse',
        'timeOmen',
        'externalOmen',
        'weatherOmen',
        'geographyOmen',
        'humanOmen',
        'illnessOutcome',
        'recovery',
        'death',
        'auspicious',
        'score',
        'weight',
        'probability',
      ]) {
        assert.equal(key in evidence.tenResponseContextFact, false);
      }
      assert.equal(evidence.matterTenResponseContextFact.status, '资料不足');
      assert.deepEqual(evidence.matterTenResponseContextFact.availableContextFields, []);
      assert.deepEqual(
        evidence.matterTenResponseContextFact.missingContextFields,
        evidence.matterTenResponseContextFact.requiredContextFields,
      );
      assert.equal(evidence.matterTenResponseContextFact.responseCatalogFields.length, 10);
      assert.equal(evidence.matterTenResponseContextFact.sourceLineFields.length, 11);
      assert.equal(evidence.matterTenResponseContextFact.unresolvedRuleFields.length, 10);
      assert.equal(evidence.matterTenResponseContextFact.highRiskRuleFields.length, 6);
      for (const key of [
        'matterResponse',
        'observedResponse',
        'dayElement',
        'dayStrength',
        'legalOutcome',
        'financialOutcome',
        'visitorArrival',
        'documentArrival',
        'illness',
        'fever',
        'treatment',
        'prognosis',
        'spiritCause',
        'mourning',
        'auspicious',
        'score',
        'weight',
        'probability',
      ]) {
        assert.equal(key in evidence.matterTenResponseContextFact, false);
      }
      assert.equal(evidence.trigramResponseCatalogFact.status, '资料不足');
      assert.deepEqual(evidence.trigramResponseCatalogFact.availableContextFields, []);
      assert.deepEqual(
        evidence.trigramResponseCatalogFact.missingContextFields,
        evidence.trigramResponseCatalogFact.requiredContextFields,
      );
      assert.equal(evidence.trigramResponseCatalogFact.trigramCatalogFields.length, 8);
      assert.equal(evidence.trigramResponseCatalogFact.qianDetailCategoryFields.length, 11);
      assert.equal(evidence.trigramResponseCatalogFact.sourceLineFields.length, 21);
      assert.equal(evidence.trigramResponseCatalogFact.canonicalCrosscheckFields.length, 8);
      assert.equal(evidence.trigramResponseCatalogFact.unresolvedRuleFields.length, 12);
      assert.equal(evidence.trigramResponseCatalogFact.highRiskRuleFields.length, 7);
      for (const key of [
        'matchedTrigram',
        'weatherForecast',
        'personIdentity',
        'personality',
        'bodyPart',
        'diagnosis',
        'medicine',
        'objectAttribute',
        'auspicious',
        'score',
        'weight',
        'probability',
        'timing',
      ]) {
        assert.equal(key in evidence.trigramResponseCatalogFact, false);
      }
      assert.doesNotMatch(
        JSON.stringify({
          motion,
          external: evidence.externalMotionFact,
          sensory: evidence.sensoryOmenFact,
          food: evidence.foodContextFact,
          object: evidence.objectContextFact,
          topicResponse: evidence.topicResponseContextFact,
          tenResponse: evidence.tenResponseContextFact,
          matterTenResponse: evidence.matterTenResponseContextFact,
          trigramResponseCatalog: evidence.trigramResponseCatalogFact,
        }),
        /"score"\s*:|"probability"\s*:|应吉之速|应凶之速|应期快于|应期迟缓/,
      );
      checked += 1;
    }
  }

  assert.equal(checked, 384);
});

test('梅花体用旺衰应按生克方向合看且同一原体月令只登记一次', () => {
  const strongStates = new Set(['旺', '相']);
  const weakStates = new Set(['休', '囚', '死']);
  const allStates = [...strongStates, ...weakStates];
  const mainRelations = ['体克用', '体生用', '比和', '用克体', '用生体'];
  const interRelations = ['原体克应卦', '原体生应卦', '应卦与原体比和', '应卦克原体', '应卦生原体'];
  const expectedMainCoverage = mainRelations.flatMap((relation) =>
    allStates.map((state) => `${relation}|${state}`),
  );
  const expectedInterCoverage = interRelations.flatMap((relation) =>
    allStates.map((state) => `${relation}|${state}`),
  );
  const mainCoverage = new Set<string>();
  const interCoverage = new Set<string>();
  let checked = 0;

  for (let month = 0; month < 12; month += 1) {
    const date = new Date(Date.UTC(2026, month, 15, 4));
    for (let number = 1; number <= 192; number += 1) {
      const evidence = generateMeihua(date, { method: 'number', number }).evidenceAnalysis;
      assert.ok(evidence);

      for (const stage of evidence.stages.filter((item) => item.kind === '体用关系')) {
        assert.ok(stage.ti && stage.yong && stage.relation);
        const tiState = stage.ti.seasonState;
        const yongState = stage.yong.seasonState;
        mainCoverage.add(`${stage.relation}|${yongState}`);

        if (stage.stage === 'origin') {
          if (strongStates.has(tiState)) {
            assert.ok(stage.support.includes(`体卦得月令${tiState}`));
          } else {
            assert.ok(weakStates.has(tiState));
            assert.ok(stage.constraints.includes(`体卦月令${tiState}`));
          }
        } else {
          assert.ok(!stage.support.includes(`体卦得月令${tiState}`));
          assert.ok(!stage.constraints.includes(`体卦月令${tiState}`));
        }
        assert.ok(!stage.support.includes(`用卦得月令${yongState}`));
        assert.ok(!stage.constraints.includes(`用卦月令${yongState}`));

        if (stage.relation !== '用生体' && stage.relation !== '用克体') {
          if (strongStates.has(yongState)) {
            assert.ok(stage.support.includes(`用卦月令${yongState}且不克体，响应之气有力`));
          } else {
            assert.ok(![...stage.support, ...stage.constraints].includes(`用卦月令${yongState}`));
          }
        }

        if (stage.relation === '用生体') {
          if (strongStates.has(yongState)) {
            assert.ok(stage.support.includes(`用卦生体且月令${yongState}，生体之气有力`));
          } else {
            assert.ok(stage.constraints.includes(`用卦生体但月令${yongState}，生体之力受月令限制`));
          }
        } else if (stage.relation === '用克体') {
          if (strongStates.has(yongState)) {
            assert.ok(stage.constraints.includes(`用卦克体且月令${yongState}，克体之气有力`));
          } else {
            assert.ok(stage.support.includes(`用卦克体但月令${yongState}，克体之气受月令限制`));
          }
        } else if (stage.relation === '体生用') {
          assert.ok(stage.constraints.includes('体卦生用卦，体卦存在泄耗'));
          assert.ok(!stage.support.some((item) => item.includes('体卦向事项一方投入')));
        } else if (stage.relation === '体克用') {
          assert.ok(stage.support.includes('体卦对用卦具有制约能力'));
          assert.ok(!stage.constraints.some((item) => item.includes('主动推进可能伴随消耗')));
        } else {
          assert.ok(stage.support.includes('体用同五行，关系同气'));
          assert.ok(!stage.constraints.some((item) => item.includes('仍须结合旺衰')));
        }
      }

      for (const fact of evidence.interResponseFacts) {
        const originalTiState = fact.originalTi.seasonState;
        const responseState = fact.response.seasonState;
        const normalizedRelation = fact.relation
          .replace(new RegExp(`^${fact.role}`), '应卦')
          .replace(new RegExp(`${fact.role}$`), '应卦');
        interCoverage.add(`${normalizedRelation}|${responseState}`);

        assert.ok(!fact.support.includes(`原体得月令${originalTiState}`));
        assert.ok(!fact.constraints.includes(`原体月令${originalTiState}`));
        assert.ok(!fact.support.includes(`${fact.role}得月令${responseState}`));
        assert.ok(!fact.constraints.includes(`${fact.role}月令${responseState}`));

        if (fact.relation !== `${fact.role}生原体` && fact.relation !== `${fact.role}克原体`) {
          if (strongStates.has(responseState)) {
            assert.ok(
              fact.support.includes(`${fact.role}月令${responseState}且不克原体，响应之气有力`),
            );
          } else {
            assert.ok(
              ![...fact.support, ...fact.constraints].includes(`${fact.role}月令${responseState}`),
            );
          }
        }

        if (fact.relation === `${fact.role}生原体`) {
          if (strongStates.has(responseState)) {
            assert.ok(
              fact.support.includes(`${fact.role}生原体且月令${responseState}，生体之气有力`),
            );
          } else {
            assert.ok(
              fact.constraints.includes(
                `${fact.role}生原体但月令${responseState}，生体之力受月令限制`,
              ),
            );
          }
        } else if (fact.relation === `${fact.role}克原体`) {
          if (strongStates.has(responseState)) {
            assert.ok(
              fact.constraints.includes(`${fact.role}克原体且月令${responseState}，克体之气有力`),
            );
          } else {
            assert.ok(
              fact.support.includes(`${fact.role}克原体但月令${responseState}，克体之气受月令限制`),
            );
          }
        } else if (fact.relation === `原体生${fact.role}`) {
          assert.ok(fact.constraints.includes(`原体生${fact.role}，原体存在泄耗`));
          assert.ok(!fact.support.includes(`原体生${fact.role}`));
        } else if (fact.relation === `原体克${fact.role}`) {
          assert.ok(fact.support.includes(`原体对${fact.role}具有制约能力`));
          assert.ok(!fact.constraints.some((item) => item.includes('主动制约可能伴随消耗')));
        } else {
          assert.ok(fact.support.includes(`${fact.role}与原体同五行`));
          assert.ok(!fact.constraints.some((item) => item.includes('仍须结合旺衰')));
        }
      }

      const origin = evidence.stages.find((item) => item.stage === 'origin');
      const bodyState = origin?.ti?.seasonState;
      assert.ok(bodyState && allStates.includes(bodyState));
      const expectedBodyEvidence = strongStates.has(bodyState)
        ? `体卦得月令${bodyState}`
        : `体卦月令${bodyState}`;
      const bodyEvidence = [
        ...evidence.stages.flatMap((item) => [...item.support, ...item.constraints]),
        ...evidence.interResponseFacts.flatMap((item) => [...item.support, ...item.constraints]),
      ].filter((item) => /^(体卦得月令|体卦月令|原体得月令|原体月令)/.test(item));
      assert.deepEqual(bodyEvidence, [expectedBodyEvidence]);
      assert.equal(
        evidence.counterEvidenceFacts.filter((item) => item.type === '体卦月令限制').length,
        weakStates.has(bodyState) ? 1 : 0,
      );
      checked += 1;
    }
  }

  assert.equal(checked, 2304);
  assert.deepEqual([...mainCoverage].sort(), expectedMainCoverage.sort());
  assert.deepEqual([...interCoverage].sort(), expectedInterCoverage.sort());
});

test('梅花体党用党与应卦制化应从互变五行逐项重算且不得按数量裁定最终强弱', () => {
  const base = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const partyCoverage = new Set<string>();
  const interactionCoverage = new Set<string>();
  let checked = 0;

  for (const main of hexagramsData) {
    for (let movingYao = 1; movingYao <= 6; movingYao += 1) {
      const data = buildMeihuaCase(base, main, movingYao);
      const evidence = analyzeMeihuaEvidence(data);
      const origin = evidence.stages.find((item) => item.stage === 'origin');
      assert.ok(origin?.ti && origin.yong);
      assert.equal(evidence.responseReferences.length, 4);
      assert.deepEqual(
        evidence.responseReferences.map((item) => item.role),
        ['主卦用卦', '体互', '用互', '变卦用卦'],
      );
      assert.ok(
        evidence.responseReferences.every(
          (item) =>
            item.relationToOriginalTi ===
            expectedResponseRelation(item.element, origin.ti?.element ?? ''),
        ),
      );

      const partyCandidates = evidence.responseReferences.filter(
        (item) => item.role !== '主卦用卦',
      );
      const expectedTiPartyKeys = partyCandidates
        .filter((item) => item.element === origin.ti?.element)
        .map((item) => item.key);
      const expectedYongPartyKeys = partyCandidates
        .filter((item) => item.element === origin.yong?.element)
        .map((item) => item.key);
      assert.equal(evidence.partyFact.status, '已计算');
      assert.deepEqual(evidence.partyFact.missingResponseRoles, []);
      assert.deepEqual(
        evidence.partyFact.tiPartyMembers.map((item) => item.key),
        expectedTiPartyKeys,
      );
      assert.deepEqual(
        evidence.partyFact.yongPartyMembers.map((item) => item.key),
        expectedYongPartyKeys,
      );
      assert.equal(evidence.partyFact.tiPartyCount, expectedTiPartyKeys.length);
      assert.equal(evidence.partyFact.yongPartyCount, expectedYongPartyKeys.length);
      const sameElement = origin.ti.element === origin.yong.element;
      const tiPartyIsMultiple = expectedTiPartyKeys.length >= 2;
      const yongPartyIsMultiple = expectedYongPartyKeys.length >= 2;
      const expectedPartyClassification = sameElement
        ? '体用同五行，党类重合'
        : tiPartyIsMultiple && yongPartyIsMultiple
          ? '体党与用党均较多'
          : tiPartyIsMultiple
            ? '仅见体党较多'
            : yongPartyIsMultiple
              ? '仅见用党较多'
              : '体用党均未达多项';
      assert.equal(evidence.partyFact.classification, expectedPartyClassification);
      assert.equal(evidence.partyFact.support.length, !sameElement && tiPartyIsMultiple ? 1 : 0);
      assert.equal(
        evidence.partyFact.constraints.length,
        !sameElement && yongPartyIsMultiple ? 1 : 0,
      );
      partyCoverage.add(evidence.partyFact.classification);

      const expectedInteractions = evidence.responseReferences.flatMap((target) => {
        if (target.relationToOriginalTi !== '生体' && target.relationToOriginalTi !== '克体') {
          return [];
        }
        return evidence.responseReferences
          .filter(
            (controller) =>
              controller.key !== target.key &&
              elementControls[controller.element] === target.element,
          )
          .map(
            (controller) =>
              `${controller.key}>${target.key}:${target.relationToOriginalTi === '克体' ? '克体之患受制' : '生体之助受制'}`,
          );
      });
      const actualInteractions = evidence.responseInteractionFacts.map(
        (item) => `${item.controller.key}>${item.target.key}:${item.effectDirection}`,
      );
      assert.deepEqual(actualInteractions, expectedInteractions);
      assert.equal(
        new Set(evidence.responseInteractionFacts.map((item) => item.key)).size,
        actualInteractions.length,
      );
      assert.ok(
        evidence.responseInteractionFacts.every(
          (item) =>
            item.status === '路径成立' &&
            item.controller.seasonState &&
            item.target.seasonState &&
            item.promptText.includes('实际效力仍须合看旺衰与其他应卦路径') &&
            item.limitation.includes('不得按路径数量、多数票或先后顺序'),
        ),
      );
      for (const item of evidence.responseInteractionFacts) {
        interactionCoverage.add(item.effectDirection);
        assert.equal(item.support.length, item.effectDirection === '克体之患受制' ? 1 : 0);
        assert.equal(item.constraints.length, item.effectDirection === '生体之助受制' ? 1 : 0);
      }
      assert.deepEqual(
        evidence.counterEvidenceFacts
          .filter((item) => item.type === '用党限制')
          .map((item) => item.detail),
        evidence.partyFact.constraints,
      );
      assert.deepEqual(
        evidence.counterEvidenceFacts
          .filter((item) => item.type === '应卦制化限制')
          .map((item) => item.detail),
        evidence.responseInteractionFacts.flatMap((item) => item.constraints),
      );
      assert.equal(evidence.summaryFact.partyFactCount, 1);
      assert.equal(
        evidence.summaryFact.responseInteractionFactCount,
        evidence.responseInteractionFacts.length,
      );
      assert.ok(evidence.summaryFact.factKeys.includes(evidence.partyFact.key));
      assert.ok(
        evidence.responseInteractionFacts.every((item) =>
          evidence.summaryFact.factKeys.includes(item.key),
        ),
      );
      checked += 1;
    }
  }

  assert.equal(checked, 384);
  assert.deepEqual([...partyCoverage].sort(), [
    '仅见体党较多',
    '仅见用党较多',
    '体用党均未达多项',
    '体用同五行，党类重合',
  ]);
  assert.deepEqual([...interactionCoverage].sort(), ['克体之患受制', '生体之助受制']);
});

test('梅花固定反例应保留六项不同限制并登记克体应卦受制路径', () => {
  const evidence = generateMeihua(new Date('2026-01-15T12:00:00+08:00'), {
    method: 'number',
    number: 15,
  }).evidenceAnalysis;
  assert.ok(evidence);
  assert.equal(evidence.counterEvidenceFacts.length, 6);
  assert.deepEqual(
    evidence.responseInteractionFacts.map((item) => [
      item.controller.role,
      item.target.role,
      item.effectDirection,
    ]),
    [
      ['体互', '主卦用卦', '克体之患受制'],
      ['体互', '用互', '克体之患受制'],
    ],
  );
  assert.equal(
    evidence.counterEvidenceFacts.filter((item) => item.type === '应卦制化限制').length,
    0,
  );
  assert.match(evidence.promptText, /体互震木克主卦用卦艮土/);
  assert.match(evidence.promptText, /体互震木克用互坤土/);
});

test('梅花证据应重算主互变关系，不采信伪造的体用与互卦派生字段', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const fake = { name: '乾', element: '金', nature: '天' };
  const rebuilt = analyzeMeihuaEvidence({
    ...data,
    tiGua: fake,
    yongGua: fake,
    interTiGua: fake,
    interYongGua: fake,
    changedTiGua: fake,
    changedYongGua: fake,
    yaosDetail: data.yaosDetail.map((item) => ({
      ...item,
      tiYong: item.tiYong === '体' ? ('用' as const) : ('体' as const),
    })),
    analysis: {
      ...data.analysis,
      tiYongRelation: '伪造主卦关系',
      inter1Relation: '伪造体互关系',
      inter2Relation: '伪造用互关系',
      changedRelation: '伪造变卦关系',
      changedTiYongRelation: '伪造变卦体用关系',
    },
    evidenceAnalysis: undefined,
  });
  const origin = rebuilt.stages.find((item) => item.stage === 'origin');
  const process = rebuilt.stages.find((item) => item.stage === 'process');
  const result = rebuilt.stages.find((item) => item.stage === 'result');

  assert.equal(origin?.ti?.name, '离');
  assert.equal(origin?.yong?.name, '坤');
  assert.equal(process?.originalTi?.name, '离');
  assert.deepEqual(
    rebuilt.interResponseFacts.map((item) => [item.role, item.response.name, item.relation]),
    [
      ['体互', '坎', '体互克原体'],
      ['用互', '艮', '原体生用互'],
    ],
  );
  assert.equal(result?.ti?.name, '离');
  assert.deepEqual(
    rebuilt.internalMotionFact.references.map((item) => [item.role, item.name, item.motion]),
    [
      ['原体', '离', '静'],
      ['主卦用卦', '坤', '动'],
      ['体互', '坎', '静'],
      ['用互', '艮', '静'],
      ['变卦用卦', result?.yong?.name, '动'],
    ],
  );
  assert.deepEqual(
    rebuilt.yaoStructureFacts.map((item) => item.tiYong),
    ['用', '用', '用', '体', '体', '体'],
  );
  assert.equal(rebuilt.yaoStructureFacts.find((item) => item.isChanging)?.tiYong, '用');
  assert.doesNotMatch(rebuilt.promptText, /伪造/);
});

test('梅花克应资料不足时只登记盘面事实，不把动爻和卦数换算成现实阶段或日期', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = analyzeMeihuaEvidence(data);

  assert.equal(evidence.timingSummaryFact.status, '资料不足');
  assert.ok(
    evidence.timingFacts.some(
      (item) => item.type === '克应资料覆盖' && item.sourceStatus === '资料不足',
    ),
  );
  const relationFact = evidence.timingFacts.find((item) => item.type === '全卦克应关系');
  const contextFact = evidence.timingFacts.find((item) => item.type === '克应资料覆盖');
  assert.ok(relationFact);
  assert.equal(relationFact.sourceStatus, '由盘面补齐');
  assert.deepEqual(relationFact.expectedResponseRoles, ['主卦用卦', '体互', '用互', '变卦用卦']);
  assert.deepEqual(relationFact.actualResponseRoles, relationFact.expectedResponseRoles);
  assert.deepEqual(relationFact.missingResponseRoles, []);
  assert.equal(relationFact.relationCandidates?.length, 4);
  for (const candidate of relationFact.relationCandidates ?? []) {
    const reference = evidence.responseReferences.find(
      (item) => item.key === candidate.responseKey,
    );
    assert.ok(reference);
    const expectedRelation = expectedResponseRelation(reference.element, data.tiGua.element);
    const expectedDirection =
      expectedRelation === '生体' || expectedRelation === '与体比和'
        ? '传统吉应方向候选'
        : expectedRelation === '克体'
          ? '传统凶应方向候选'
          : '非本条直接刻期候选';
    assert.equal(candidate.relationToOriginalTi, expectedRelation);
    assert.equal(candidate.direction, expectedDirection);
    assert.deepEqual(
      candidate.interactionFactKeys,
      evidence.responseInteractionFacts
        .filter((item) => item.target.key === candidate.responseKey)
        .map((item) => item.key),
    );
  }
  assert.ok(contextFact);
  assert.equal(contextFact.requiredContextFields?.length, 6);
  assert.deepEqual(contextFact.availableContextFields, []);
  assert.deepEqual(contextFact.missingContextFields, contextFact.requiredContextFields);
  assert.match(evidence.promptText, /所占事项与对象、是否确需刻期、自然期限与远近/);
  assert.match(evidence.promptText, /不能裁定年\/月\/日\/时单位、计算具体日期或统一快慢/);
  assert.match(evidence.promptText, /不得靠关键词猜测/);
  assert.doesNotMatch(
    JSON.stringify(evidence.timingFacts),
    /事情刚开始|内部配合|核心决策|应期快于常规|应期迟缓|\d+日内|\d+月左右|成功率[：=]?\d|"(?:date|deadline|duration|timeUnit|score|weight|probability)"\s*:/,
  );
});

test('梅花旧结果中的机械应期文字不得重新进入结构化证据', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = analyzeMeihuaEvidence({
    ...data,
    evidenceAnalysis: undefined,
    analysis: {
      ...data.analysis,
      yingQi: ['初爻动，先观察事情刚开始或基层条件的变化', '体卦旺相，应期快于常规'],
    },
  });

  assert.equal(evidence.timingSummaryFact.status, '资料不足');
  assert.doesNotMatch(evidence.promptText, /事情刚开始|基层条件|应期快于常规/);
  assert.ok(evidence.timingFacts.every((item) => item.sourceStatus !== '原结果提供'));
});

test('梅花起卦算式、六爻结构、卦象来源和克应资料边界应进入统一证据', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const evidence = data.evidenceAnalysis;
  const items = evidence?.evidence.items ?? [];

  assert.ok(evidence);
  assert.ok(evidence.calculationFacts.some((item) => item.includes('数字取数：输入123')));
  assert.ok(evidence.calculationFacts.some((item) => /上卦=.*除8取余/.test(item)));
  assert.equal(evidence.hexagramFacts.length, 3);
  assert.ok(evidence.hexagramFacts.some((item) => item.includes(data.mainHexagram.name)));
  assert.equal(evidence.yaoFacts.length, 6);
  assert.equal(evidence.yaoFacts.filter((item) => item.includes('本爻发动')).length, 1);

  assert.ok(items.some((item) => item.title === '起卦方式与取数算式'));
  assert.ok(items.some((item) => item.title === '主互变卦象事实'));
  assert.ok(items.some((item) => item.title === '主互变阶段覆盖状态'));
  assert.ok(items.some((item) => item.title === '六爻资料覆盖状态'));
  assert.ok(items.some((item) => item.title === '六爻阴阳与体用归属'));
  assert.ok(items.some((item) => item.tags?.includes('动爻爻辞')));
  assert.equal(items.filter((item) => item.tags?.includes('阶段推进')).length, 2);
  assert.ok(items.some((item) => item.title === '体互对原体关系'));
  assert.ok(items.some((item) => item.title === '用互对原体关系'));
  assert.ok(items.some((item) => item.title === '体党与用党'));
  assert.ok(items.some((item) => item.title === '内卦体用动静分工'));
  assert.ok(items.some((item) => item.title === '外应动静资料覆盖'));
  assert.ok(items.some((item) => item.title === '坐端八方应兆资料覆盖'));
  assert.ok(items.some((item) => item.title === '万物耳目外应资料覆盖'));
  assert.ok(
    items.some(
      (item) =>
        item.title === '观物专项、占物类例、物数为体、变爻、现场克应、趣时与用易实例版本覆盖',
    ),
  );
  assert.ok(items.some((item) => item.title === '诸事响应专项情境与风险边界'));
  assert.equal(items.filter((item) => item.title.includes('反对性情卦画资料')).length, 3);
  assert.ok(items.some((item) => item.title === '诸卦反对性情底本异文边界'));
  assert.equal(
    items.filter((item) => item.tags?.includes('应卦制化')).length,
    evidence.responseInteractionFacts.length,
  );
  assert.ok(items.some((item) => item.level === '应期' && item.title.includes('资料覆盖')));
  assert.equal(evidence.transitionFacts.length, 2);
  assert.ok(
    evidence.transitionFacts.every(
      (item) =>
        item.key.startsWith('meihua:transition:') &&
        item.status === '连续' &&
        evidence.stages.some((stage) => stage.key === item.fromStageKey) &&
        evidence.stages.some((stage) => stage.key === item.toStageKey) &&
        item.sources.length > 0 &&
        item.limitation.includes('现实事件必然按同样顺序'),
    ),
  );
  assert.equal(evidence.timingSummaryFact.factKeys.length, evidence.timingFacts.length);
  assert.ok(
    evidence.timingFacts.every(
      (item) =>
        item.key.startsWith('meihua:timing:') &&
        item.order > 0 &&
        item.ownerFactKeys.length > 0 &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把爻位'),
    ),
  );
  assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
  assert.ok(
    evidence.counterEvidenceFacts.every(
      (item) =>
        item.key.startsWith('meihua:counter:') &&
        item.status === '已触发' &&
        evidence.stages.some((stage) => stage.key === item.ownerStageKey) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把单项反证直接写成现实失败'),
    ),
  );
  assert.ok(
    evidence.timingFacts.every((fact) =>
      items.some((item) => item.level === '应期' && item.detail?.includes(fact.promptText)),
    ),
  );
  assert.ok(evidence.counterEvidence.length === 0 || items.some((item) => item.level === '反证'));
  assert.doesNotMatch(
    JSON.stringify(evidence.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('梅花旧结果缺少逐爻或互卦阶段时应明确标记缺口且不得反推', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const rebuilt = analyzeMeihuaEvidence({
    ...data,
    yaosDetail: data.yaosDetail.slice(0, 5),
    interHexagram: null,
    evidenceAnalysis: undefined,
  });

  assert.equal(rebuilt.yaoCoverageFact.status, '缺少爻位');
  assert.deepEqual(rebuilt.yaoCoverageFact.missingPositions, [6]);
  assert.equal(rebuilt.stageCoverageFact.status, '阶段缺失');
  assert.deepEqual(rebuilt.stageCoverageFact.missingStages, ['process']);
  assert.equal(rebuilt.transitionFacts.length, 1);
  assert.equal(rebuilt.transitionFacts[0].status, '跨阶段缺口');
  assert.equal(rebuilt.summaryFact.status, '部分资料缺失');
  assert.equal(rebuilt.partyFact.status, '资料不足');
  assert.deepEqual(rebuilt.partyFact.missingResponseRoles, ['体互', '用互']);
  assert.deepEqual(rebuilt.partyFact.support, []);
  assert.deepEqual(rebuilt.partyFact.constraints, []);
  assert.equal(rebuilt.internalMotionFact.status, '资料不足');
  assert.deepEqual(rebuilt.internalMotionFact.missingRoles, ['体互', '用互']);
  assert.equal(rebuilt.externalMotionFact.status, '资料不足');
  assert.equal(rebuilt.spatialOmenFact.status, '资料不足');
  assert.equal(
    rebuilt.calculationSteps.find((item) => item.stage === '阶段推进核验')?.status,
    '资料不足',
  );
  assert.match(rebuilt.transitionFacts[0].promptText, /不补造过程/);
  assert.match(rebuilt.promptText, /不得反推缺失阶段关系/);

  const incompleteResult = analyzeMeihuaEvidence({
    ...data,
    changedHexagram: null,
    evidenceAnalysis: undefined,
  });
  const resultStage = incompleteResult.stages.find((item) => item.stage === 'result');
  assert.equal(incompleteResult.stageCoverageFact.status, '阶段缺失');
  assert.deepEqual(incompleteResult.stageCoverageFact.missingStages, ['result']);
  assert.equal(resultStage, undefined);
  assert.match(incompleteResult.stageCoverageFact.promptText, /不得反推缺失阶段关系/);

  const duplicateYao = analyzeMeihuaEvidence({
    ...data,
    yaosDetail: [...data.yaosDetail, { ...data.yaosDetail[0] }],
    evidenceAnalysis: undefined,
  });
  assert.equal(duplicateYao.yaoCoverageFact.status, '爻位异常');
  assert.deepEqual(duplicateYao.yaoCoverageFact.duplicatePositions, [1]);
  assert.equal(
    new Set(duplicateYao.yaoStructureFacts.map((item) => item.key)).size,
    duplicateYao.yaoStructureFacts.length,
  );
});

test('梅花四种起卦入口都应生成完整可移植的对象化证据', () => {
  const cases = [
    generateMeihua(fixedDate, { method: 'time' }),
    generateMeihua(fixedDate, { method: 'timeTrigram' }),
    generateMeihua(fixedDate, { method: 'number', number: 123 }),
    generateMeihua(fixedDate, { method: 'random', seed: '四种入口核验' }),
  ];

  for (const data of cases) {
    const evidence = data.evidenceAnalysis;
    assert.ok(evidence);
    assert.equal(evidence.calculationFact.status, '完整');
    assert.equal(evidence.stageCoverageFact.status, '完整');
    assert.equal(evidence.yaoCoverageFact.status, '完整');
    assert.equal(evidence.transitionFacts.length, 2);
    assert.equal(evidence.timingSummaryFact.status, '资料不足');
    assert.equal(evidence.internalMotionFact.status, '已计算');
    assert.equal(evidence.externalMotionFact.status, '资料不足');
    assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
    assert.equal(evidence.summaryFact.status, '证据链完整');
    assert.equal(evidence.calculationSteps.length, 7);
    assert.equal(evidence.hexagramDispositionFacts.length, 3);
    assert.equal(evidence.hexagramDispositionVersionFact.status, '底本异文待校');
    assert.equal(evidence.limitationFacts.length, 16);
    assert.equal(evidence.trigramResponseCatalogFact.trigramCatalogFields.length, 8);
    assertPromptIsPortableTaskText(evidence.promptText);
  }
});

test('梅花六十四卦卦辞爻辞与乾坤用辞应完整生成条件化事实', () => {
  const facts = hexagramsData.flatMap((hexagram) => {
    const gua = conditionMeihuaTraditionalText(hexagram.description, {
      stage: '主卦',
      hexagram: hexagram.name,
      kind: '卦辞',
    });
    const yaos = (hexagram.yaoCi ?? []).map((text, index) => ({
      originalText: text,
      ...conditionMeihuaTraditionalText(text, {
        stage: '主卦',
        hexagram: hexagram.name,
        kind: '爻辞',
        yaoPosition: index + 1,
        isMoving: index === 0,
      }),
    }));
    const yong = hexagram.yongCi
      ? [
          {
            originalText: hexagram.yongCi,
            ...conditionMeihuaTraditionalText(hexagram.yongCi, {
              stage: '主卦',
              hexagram: hexagram.name,
              kind: '用辞',
            }),
          },
        ]
      : [];
    return [{ originalText: hexagram.description, ...gua }, ...yaos, ...yong];
  });

  assert.equal(hexagramsData.length, 64);
  assert.equal(
    hexagramsData.reduce((total, item) => total + (item.yaoCi?.length ?? 0), 0),
    384,
  );
  assert.equal(hexagramsData.filter((item) => item.yongCi).length, 2);
  assert.equal(facts.length, 450);
  assert.ok(
    facts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.traditionalSignals.length + item.topicTags.length > 0,
    ),
  );
  assert.ok(facts.some((item) => /妇三岁不孕/.test(item.originalText)));
  assert.ok(facts.some((item) => /焚如，死如/.test(item.originalText)));
  assert.ok(facts.some((item) => /至于八月有凶/.test(item.originalText)));
  assert.doesNotMatch(
    facts.map((item) => item.promptText).join('\n'),
    /妇三岁不孕|焚如，死如|至于八月有凶/,
  );
});

test('梅花排盘传统事实应只让当前动爻参与提示词', () => {
  const data = generateMeihua(fixedDate, { method: 'number', number: 123 });
  const facts = data.evidenceAnalysis?.traditionalFacts ?? [];
  const mainYaoFacts = facts.filter((item) => item.stage === '主卦' && item.kind === '爻辞');
  const activeFacts = mainYaoFacts.filter((item) => item.applicability === '当前动爻辅助');
  const inactiveFacts = mainYaoFacts.filter((item) => item.applicability === '未发动背景');

  assert.equal(mainYaoFacts.length, 6);
  assert.equal(activeFacts.length, 1);
  assert.equal(inactiveFacts.length, 5);
  assert.equal(activeFacts[0].yaoPosition, data.movingYao.position);
  assert.ok(
    facts.every(
      (item) =>
        item.status === '已映射' &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实吉凶'),
    ),
  );
  assert.match(data.evidenceAnalysis?.promptText ?? '', /当前爻位已发动/);
  for (const fact of inactiveFacts) {
    assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', new RegExp(fact.originalText));
  }
});

test('乾卦用九应保留原文但不在单动爻排盘中启用', () => {
  const qian = generateMeihua(new Date('2025-01-01T14:00:00+08:00'), {
    method: 'number',
    number: 1,
  });
  const qianYong = qian.evidenceAnalysis?.traditionalFacts.find(
    (item) => item.stage === '主卦' && item.kind === '用辞',
  );

  assert.equal(qian.mainHexagram.name, '乾为天');
  assert.equal(qian.mainHexagram.yongCi, '见群龙无首，吉');
  assert.equal(qianYong?.originalText, '见群龙无首，吉');
  assert.equal(qianYong?.applicability, '特殊用辞背景');
  assert.match(qianYong?.promptText ?? '', /不满足六爻皆变.*不作为本次判断依据/);
  assert.doesNotMatch(qian.evidenceAnalysis?.promptText ?? '', /见群龙无首，吉/);
});
