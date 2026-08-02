import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeLiurenEvidence, generateLiuren } from 'mingyu-core/divination/liuren';
import { conditionLiurenTraditionalText } from '../packages/core/src/divination/liuren-evidence.ts';
import { TIANJIANG_ATTRIBUTES } from '../packages/core/src/divination/algorithms/liuren/helpers/plate';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

test('大六壬排盘应内置四课取传与三传推进结构化证据', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.lessons.length, 4);
  assert.equal(evidence.transmissions.length, 3);
  assert.equal(evidence.transmissionRuleFact.status, '已确定');
  assert.equal(evidence.transmissionRuleFact.rule, data.transmissionRule);
  assert.equal(evidence.transmissionRuleFact.initialBranch, data.threeTransmissions[0].branch);
  assert.ok(evidence.transmissionRuleFact.initialSourceLessonKeys.length > 0);
  assert.ok(evidence.transmissionRuleFact.sources.length >= 2);
  assert.match(evidence.transmissionRuleFact.limitation, /不得按结果反推九宗门名称/);
  assert.ok(
    evidence.lessons.every(
      (item) =>
        item.key.startsWith('liuren:lesson:') &&
        item.kinship &&
        item.relationFacts.some(
          (fact) => fact.basis === '日干六亲' && fact.value === item.kinship,
        ) &&
        item.dayStemRelation &&
        item.relationFacts.some(
          (fact) => fact.basis === '日干五行关系' && fact.value === item.dayStemRelation,
        ) &&
        item.relationFacts.every(
          (fact) =>
            fact.ownerKey === item.key &&
            fact.scope === '四课' &&
            fact.promptText &&
            fact.sources.length > 0 &&
            fact.limitation.includes('不得直接解释为现实吉凶'),
        ) &&
        item.promptText &&
        item.sources.length >= 2 &&
        item.limitation.includes('不单独证明现实事件'),
    ),
  );
  assert.ok(
    evidence.transmissions.every(
      (item) =>
        item.key.startsWith('liuren:transmission:') &&
        item.relationFacts.length >= 6 &&
        item.relationFacts.every(
          (fact) =>
            fact.ownerKey === item.key &&
            fact.scope === '三传' &&
            fact.promptText &&
            fact.sources.length > 0,
        ) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('阶段顺序不证明现实事件必然'),
    ),
  );
  assert.deepEqual(
    evidence.transmissions.map((item) => item.label),
    ['起点', '过程', '落点'],
  );
  assert.equal(evidence.initialBranch, data.threeTransmissions[0].branch);
  assert.equal(evidence.transitionFacts.length, 2);
  assert.ok(
    evidence.transitionFacts.every(
      (item) =>
        item.key.startsWith('liuren:transition:') &&
        evidence.transmissions.some(
          (transmission) => transmission.key === item.fromTransmissionKey,
        ) &&
        evidence.transmissions.some(
          (transmission) => transmission.key === item.toTransmissionKey,
        ) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件必然推进'),
    ),
  );
  assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
  assert.ok(
    evidence.counterEvidenceFacts.every(
      (item) =>
        item.key.startsWith('liuren:counter:') &&
        item.status === '已触发' &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把单项反证直接写成现实失败'),
    ),
  );
  assert.equal(evidence.timingFacts.length, 4);
  assert.deepEqual(
    evidence.timingFacts.map((item) => item.type),
    ['初传状态', '三传顺序', '月日触发', '期限边界'],
  );
  assert.ok(
    evidence.timingFacts.every(
      (item, index) =>
        item.key.startsWith(`liuren:timing:${index + 1}:`) &&
        item.sourceStatus === '原结果提供' &&
        item.rawText &&
        item.promptText &&
        item.sources.length >= 2 &&
        item.limitation.includes('不得判断确定快慢'),
    ),
  );
  assert.equal(evidence.focusFacts.length, data.focusEvidence?.length);
  assert.equal(evidence.focusSummaryFact.status, '已提供位置焦点');
  assert.ok(
    evidence.focusFacts.every(
      (item) =>
        item.key.startsWith('liuren:focus:') &&
        item.sourceStatus === '原结果提供' &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不等于已按具体事项选定类神'),
    ),
  );
  assert.match(evidence.promptText, /【大六壬四课取传与三传推进结构化证据】/);
  assert.match(evidence.promptText, /取传规则事实：/);
  assert.match(evidence.promptText, /盘面位置焦点状态：/);
  assert.match(evidence.promptText, /四课取传与初传发用/);
  assert.deepEqual(evidence.focusEvidence, data.focusEvidence);
  assert.deepEqual(evidence.timingEvidence, data.timingEvidence);
  assert.match(evidence.promptText, /应期触发证据/);
  assert.ok(
    (data.focusEvidence ?? []).every((focus) =>
      evidence.evidence.items.some((item) => item.title === `${focus.target}${focus.role}`),
    ),
  );
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
});

test('大六壬证据应公开起盘口径主版本、异说与底本文字边界', () => {
  const evidence = generateLiuren(fixedDate).evidenceAnalysis;

  assert.ok(evidence);
  const fact = evidence.foundationConventionFact;
  assert.equal(fact.key, 'liuren:foundation-convention');
  assert.equal(fact.status, '已登记版本边界');
  assert.match(fact.adoptedVersion, /《六壬粹言》.*《大六壬大全》正文/);
  assert.equal(fact.monthLeaderSwitchRule, '按十二中气的实际交节时刻换将');
  assert.deepEqual(
    fact.monthLeaderRules.map((item) => `${item.zhongqi}${item.monthLeader}`),
    [
      '雨水亥',
      '春分戌',
      '谷雨酉',
      '小满申',
      '夏至未',
      '大暑午',
      '处暑巳',
      '秋分辰',
      '霜降卯',
      '小雪寅',
      '冬至丑',
      '大寒子',
    ],
  );
  assert.deepEqual(fact.dayBranches, ['卯', '辰', '巳', '午', '未', '申']);
  assert.deepEqual(fact.nightBranches, ['酉', '戌', '亥', '子', '丑', '寅']);
  assert.deepEqual(
    new Set(fact.noblemanRules.flatMap((item) => item.dayStems)),
    new Set(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']),
  );
  assert.equal(fact.generalOrder.length, 12);
  assert.equal(new Set(fact.generalOrder).size, 12);
  assert.deepEqual(fact.forwardGroundBranches, ['亥', '子', '丑', '寅', '卯', '辰']);
  assert.deepEqual(fact.reverseGroundBranches, ['巳', '午', '未', '申', '酉', '戌']);
  assert.deepEqual(
    new Set(fact.stemResidenceRules.flatMap((item) => item.dayStems)),
    new Set(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']),
  );
  assert.ok(fact.alternativeVersionFields.some((item) => /《六壬寻源》.*先天.*后天/.test(item)));
  assert.ok(
    fact.textualVariantFields.some((item) =>
      /《六壬粹言》《六壬指南》及《六壬指南注解》.*小雪/.test(item),
    ),
  );
  assert.ok(fact.textualVariantFields.some((item) => /《大六壬大全》.*大雪/.test(item)));
  assert.match(fact.limitation, /异说不得与主版本拼接使用/);
  assert.match(fact.limitation, /整体重排/);
  assert.equal(evidence.summaryFact.foundationConventionFactCount, 1);
  assert.ok(evidence.summaryFact.factKeys.includes(fact.key));
  assert.ok(evidence.evidence.items.some((item) => item.title === '大六壬起盘口径与版本边界'));
  assert.match(evidence.promptText, /起盘口径与版本边界：/);
  assert.match(evidence.promptText, /《六壬寻源》先后天贵人/);
  assert.match(evidence.promptText, /异说不得混用，换用其他版本须整盘重排/);
  assert.ok(evidence.limitationFacts.some((item) => item.ownerFactKeys.includes(fact.key)));
});

test('大六壬证据应公开四课与九宗门取传主版本、异说和整体重排边界', () => {
  const evidence = generateLiuren(fixedDate).evidenceAnalysis;

  assert.ok(evidence);
  const fact = evidence.transmissionConventionFact;
  assert.equal(fact.key, 'liuren:transmission-convention');
  assert.equal(fact.status, '已登记版本边界');
  assert.match(fact.adoptedVersion, /《六壬粹言》《大六壬大全》正文及《六壬指南》/);
  assert.deepEqual(
    fact.lessonRules.map((item) => `${item.lesson}:${item.lowerRule}->${item.upperRule}`),
    [
      '一课:日干->日干寄宫上神',
      '二课:一课上神->一课上神再取上神',
      '三课:日支->日支上神',
      '四课:三课上神->三课上神再取上神',
    ],
  );
  assert.deepEqual(fact.methodOrder, [
    '贼克',
    '比用',
    '涉害',
    '遥克',
    '昴星',
    '别责',
    '八专',
    '伏吟',
    '返吟',
  ]);
  assert.match(fact.directKeRule, /先取下贼上，后取上克下/);
  assert.match(fact.repeatedUpperRule, /同一上神.*只按一处/);
  assert.match(fact.biYongRule, /与日干阴阳相同/);
  assert.match(fact.sheHaiRule.depthRule, /所临地盘之后起数/);
  assert.match(fact.sheHaiRule.tieBreakRule, /同深先孟、无孟取仲/);
  assert.equal(fact.sheHaiRule.useZeBi, false);
  assert.match(fact.remoteKeRule, /只检查二、三、四课/);
  assert.ok(
    fact.specialMethodRules.some((item) => item.method === '昴星' && /地盘酉上神/.test(item.rule)),
  );
  assert.ok(
    fact.specialMethodRules.some(
      (item) => item.method === '别责' && /合干寄宫上神/.test(item.rule),
    ),
  );
  assert.ok(
    fact.specialMethodRules.some(
      (item) => item.method === '八专' && /癸丑.*无克不取遥克/.test(item.rule),
    ),
  );
  assert.ok(
    fact.specialMethodRules.some(
      (item) => item.method === '伏吟' && /六乙、六癸.*杜传/.test(item.rule),
    ),
  );
  assert.ok(
    fact.specialMethodRules.some((item) => item.method === '返吟' && /无亲.*无依/.test(item.rule)),
  );
  assert.ok(fact.alternativeVersionFields.some((item) => /《六壬指南》.*直接依孟仲/.test(item)));
  assert.ok(fact.alternativeVersionFields.some((item) => /《大六壬大全》.*择比/.test(item)));
  assert.match(fact.limitation, /异说不得与主版本拼接使用/);
  assert.match(fact.limitation, /初传发用到中末传整体重排/);
  assert.equal(evidence.summaryFact.transmissionConventionFactCount, 1);
  assert.ok(evidence.summaryFact.factKeys.includes(fact.key));
  assert.ok(evidence.evidence.items.some((item) => item.title === '大六壬四课与取传口径版本边界'));
  assert.match(evidence.promptText, /四课与取传口径版本边界：/);
  assert.match(evidence.promptText, /换用其他版本须从初传到中末传整体重排/);
  assert.ok(evidence.limitationFacts.some((item) => item.ownerFactKeys.includes(fact.key)));
});

test('大六壬证据应从日柱重算旬空并忽略旧冗余字段冲突', () => {
  const data = generateLiuren(fixedDate);
  const expectedXunKong = [...(data.xunKong ?? [])];
  const initialBranch = data.threeTransmissions[0].branch;
  const expectedInitialVoid = expectedXunKong.includes(initialBranch);
  data.xunKong = ['伪', '造'];
  data.threeTransmissions[0].isVoid = !expectedInitialVoid;

  const evidence = analyzeLiurenEvidence(data);

  assert.deepEqual(evidence.calculationFact.xunKong, expectedXunKong);
  assert.equal(evidence.transmissions[0].isVoid, expectedInitialVoid);
  assert.equal(
    evidence.transmissions[0].relationFacts.find((item) => item.basis === '旬空')?.status,
    '中性',
  );
  assert.ok(
    !evidence.counterEvidenceFacts.some(
      (item) => item.ownerKey === evidence.transmissions[0].key && item.basis === '旬空',
    ),
  );
  assert.match(
    evidence.timingFacts[0].promptText,
    new RegExp(`初传${initialBranch}${expectedInitialVoid ? '落旬空' : '不空'}`),
  );
  assert.doesNotMatch(evidence.promptText, /伪、造|旬空伪/);
  assert.match(evidence.promptText, /空亡有宜有忌/);
});

test('大六壬证据重建应拒绝非法四柱', () => {
  const clean = generateLiuren(fixedDate);
  const pillarLabels = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
  } as const;

  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    const corrupted = structuredClone(clean);
    corrupted.ganzhi[key] = '甲丑';
    assert.throws(
      () => analyzeLiurenEvidence(corrupted),
      new RegExp(`${pillarLabels[key]}必须是有效六十甲子`),
    );
  }
});

test('大六壬证据重建应拒绝与时间戳不一致的有效四柱和非法时间戳', () => {
  const mismatched = generateLiuren(fixedDate);
  mismatched.ganzhi.day = mismatched.ganzhi.day === '甲子' ? '乙丑' : '甲子';
  assert.throws(() => analyzeLiurenEvidence(mismatched), /日柱.+与时间戳重算结果.+不一致/);

  const invalidTimestamp = generateLiuren(fixedDate);
  invalidTimestamp.timestamp = Number.NaN;
  assert.throws(() => analyzeLiurenEvidence(invalidTimestamp), /有效的毫秒时间戳/);
});

test('大六壬旧结果应重算四课与三传六亲，不沿用旧版中末传关系', () => {
  const data = generateLiuren(fixedDate);
  for (const item of data.fourLessons) {
    delete item.kinship;
    delete item.dayStemRelation;
  }
  for (const item of data.threeTransmissions) {
    delete item.kinship;
    delete item.dayStemRelation;
    delete item.previousRelation;
    delete item.previousBranchRelations;
    delete item.dayBranchRelations;
    item.relation = '旧版无方向关系';
    item.dayRelation = '旧版混合关系';
  }
  data.timingEvidence = [
    `一级发用：先看初传${data.threeTransmissions[0].branch}不空，可直接作为起始信号`,
    '未给出目标期限时，只判断先后、快慢和触发条件，不硬换成唯一日期',
  ];
  data.focusEvidence![0].evidence = ['旧版三传关系'];
  data.focusEvidence![0].limitations = ['初传空亡，主证需待填实'];

  const evidence = analyzeLiurenEvidence(data);

  assert.ok(
    evidence.lessons.every(
      (item) =>
        item.kinship &&
        item.dayStemRelation?.includes(`日干${data.ganzhi.day.charAt(0)}`) &&
        item.relationFacts.some(
          (fact) => fact.basis === '日干六亲' && fact.value === item.kinship,
        ) &&
        item.relationFacts.some(
          (fact) => fact.basis === '日干五行关系' && fact.value === item.dayStemRelation,
        ),
    ),
  );
  assert.ok(
    evidence.transmissions.every(
      (item) =>
        item.kinship &&
        item.dayStemRelation?.includes(`日干${data.ganzhi.day.charAt(0)}`) &&
        item.relation === item.dayStemRelation &&
        item.dayRelation !== '旧版混合关系',
    ),
  );
  assert.ok(evidence.transmissions.slice(1).every((item) => item.previousRelation));
  assert.equal(evidence.transmissions[0].previousRelation, undefined);
  assert.match(evidence.timingFacts[0].promptText, /空亡有宜有忌/);
  assert.match(evidence.timingFacts[3].promptText, /不判断确定快慢/);
  assert.doesNotMatch(evidence.timingEvidence.join('；'), /可直接作为起始信号|只判断先后、快慢/);
  assert.match(evidence.focusFacts[0].promptText, /六亲/);
  assert.doesNotMatch(evidence.focusFacts[0].promptText, /旧版三传关系|主证需待填实/);
});

test('大六壬旬空与生克只登记条件，不自动换算支持或反证', () => {
  const data = generateLiuren(fixedDate);
  data.xunKong = [...new Set([...(data.xunKong ?? []), data.threeTransmissions[0].branch])];
  const evidence = analyzeLiurenEvidence(data);

  assert.ok(
    evidence.transmissions.every((item) =>
      item.relationFacts
        .filter((fact) => fact.basis !== '月令旺衰')
        .every((fact) => fact.status === '中性'),
    ),
  );
  assert.ok(evidence.counterEvidenceFacts.every((item) => item.basis === '月令旺衰'));
  assert.match(evidence.promptText, /不判断确定快慢/);
});

test('大六壬旧结果缺少取传名、应期与焦点时应从时间戳统一重建', () => {
  const data = generateLiuren(fixedDate);
  const expected = analyzeLiurenEvidence(data);
  data.transmissionRule = undefined;
  data.transmissionPattern = undefined;
  data.transmissionDetail = undefined;
  data.classicalRules = undefined;
  data.timingEvidence = undefined;
  data.focusEvidence = undefined;

  const evidence = analyzeLiurenEvidence(data);

  assert.deepEqual(evidence.transmissionRuleFact, expected.transmissionRuleFact);
  assert.deepEqual(evidence.timingFacts, expected.timingFacts);
  assert.deepEqual(evidence.focusFacts, expected.focusFacts);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.focusSummaryFact.status, '已提供位置焦点');
});

test('大六壬证据应在四项类神资料不全时失败关闭', () => {
  const evidence = analyzeLiurenEvidence(generateLiuren(fixedDate));

  assert.match(
    evidence.promptText,
    /具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象/,
  );
  assert.match(
    evidence.promptText,
    /不得把问题文字、范围标签、日干、日支、初传、天将或神煞固定当作类神/,
  );
  assert.match(evidence.promptText, /不生成现实演变、吉凶总分、成功率、时机、行动建议或绝对日期/);
  assert.match(evidence.promptText, /四项类神资料与目标期限未全部明确时不换算唯一日期/);
});

test('大六壬起盘链、天地盘、课体神煞与天将属性应进入统一证据条目', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;
  const items = evidence?.evidence.items ?? [];

  assert.ok(evidence);
  assert.ok(evidence.calculationFacts.some((item) => item.includes(`月将${data.monthLeader}`)));
  assert.ok(
    evidence.calculationFacts.some(
      (item) => item.includes(data.dayNight ?? '') && item.includes(data.noblemanBranch ?? ''),
    ),
  );
  assert.equal(evidence.calculationFact.monthLeader, data.monthLeader);
  assert.equal(evidence.calculationFact.divinationBranch, data.divinationBranch);
  assert.equal(evidence.calculationFact.noblemanBranch, data.noblemanBranch);
  assert.equal(evidence.calculationFact.noblemanGroundBranch, data.noblemanGroundBranch);
  assert.deepEqual(evidence.calculationFact.xunKong, data.xunKong);
  assert.ok(evidence.calculationFact.sources.length >= 3);
  assert.match(evidence.calculationFact.limitation, /不单独证明现实事件/);
  assert.equal(evidence.plateFacts.length, 12);
  assert.ok(evidence.plateFacts.every((item) => /地盘.上见天盘.乘/.test(item)));
  assert.equal(evidence.platePositionFacts.length, 12);
  assert.equal(new Set(evidence.platePositionFacts.map((item) => item.key)).size, 12);
  assert.ok(
    evidence.platePositionFacts.every(
      (item, index) =>
        item.index === index + 1 &&
        item.earthBranch === data.heavenlyPlate[index].under &&
        item.heavenBranch === data.heavenlyPlate[index].branch &&
        item.god === data.heavenlyPlate[index].god &&
        item.promptText.includes(`地盘${item.earthBranch}上见天盘${item.heavenBranch}`) &&
        item.sources.length >= 2 &&
        item.limitation.includes('只证明月将加时'),
    ),
  );
  assert.equal(evidence.platePositionFacts.filter((item) => item.isNobleman).length, 1);
  assert.equal(evidence.platePositionFacts.filter((item) => item.isNoblemanGround).length, 1);
  assert.equal(evidence.plateFact.status, '完整');
  assert.equal(evidence.plateFact.actualCount, 12);
  assert.equal(evidence.plateFact.positionKeys.length, 12);
  assert.deepEqual(new Set(evidence.patternEvidence), new Set(data.patternTags));
  assert.deepEqual(evidence.shenShaEvidence, data.shenShaSummary);

  assert.ok(items.some((item) => item.title === '月将加时与贵人起盘事实'));
  assert.ok(items.some((item) => item.title === '天地盘十二支与天将定位'));
  assert.equal(items.filter((item) => item.tags?.includes('四课')).length >= 5, true);
  assert.equal(items.filter((item) => item.tags?.includes('三传推进')).length, 2);
  assert.ok(items.some((item) => item.title === '课体与三传结构标签'));
  assert.ok(items.some((item) => item.title === '神煞定位事实'));
  assert.ok(items.some((item) => item.tags?.includes('天将属性')));
  assert.ok(items.some((item) => item.level === '应期' && item.title === '应期触发证据'));
  assert.ok(evidence.counterEvidence.length === 0 || items.some((item) => item.level === '反证'));
  assert.doesNotMatch(
    JSON.stringify(evidence.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('大六壬旧结果缺少天地盘时应从时间戳重建完整标准盘', () => {
  const data = generateLiuren(fixedDate);
  const expectedPlate = structuredClone(data.heavenlyPlate);
  data.heavenlyPlate = data.heavenlyPlate.slice(0, 11);

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.plateFact.status, '完整');
  assert.equal(evidence.plateFact.expectedCount, 12);
  assert.equal(evidence.plateFact.actualCount, 12);
  assert.deepEqual(
    evidence.platePositionFacts.map((item) => ({
      branch: item.heavenBranch,
      under: item.earthBranch,
      god: item.god,
    })),
    expectedPlate,
  );
});

test('大六壬传统事实应保留原文并为提示词生成条件化副本', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '经典取传规则'));
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '课体'));
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '天将属性'));
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '神煞'));
  const shenShaFacts = evidence.traditionalFacts.filter((item) => item.kind === '神煞');
  assert.equal(shenShaFacts.length, data.shenShaFacts?.length);
  assert.ok(
    shenShaFacts.every((item) =>
      /^(年干|年支|日柱|日干|日支|月建).+按“.+”定位/.test(item.promptText),
    ),
  );
  assert.ok(
    shenShaFacts.some((item) => item.sources.some((source) => source.includes('逐月神煞'))),
  );
  const yearGuanFuFact = shenShaFacts.find((item) => item.name === '岁官符');
  const yearSiFuFact = shenShaFacts.find((item) => item.name === '岁死符');
  const dayOfficerFact = shenShaFacts.find((item) => item.name === '日官');
  assert.ok(yearGuanFuFact);
  assert.ok(yearSiFuFact);
  assert.deepEqual(
    dayOfficerFact?.branches,
    data.shenShaFacts?.find((item) => item.name === '日官')?.target.split('、'),
  );
  assert.match(yearGuanFuFact.promptText, /年支.+按“岁官符取岁前四辰.+第五辰”定位岁官符/);
  assert.match(yearSiFuFact.promptText, /年支.+按“岁死符取岁前五辰.+病符对冲”定位岁死符/);
  assert.match(yearGuanFuFact.sources.join('；'), /六壬大全.+五行精纪.+奇门遁甲统宗/);
  assert.match(yearSiFuFact.sources.join('；'), /六壬大全.+奇门遁甲统宗.+病符对冲/);
  assert.match(yearGuanFuFact.limitation, /不证明现实事件/);
  assert.match(yearSiFuFact.limitation, /不证明现实事件/);
  assert.ok(
    data.shenShaFacts
      ?.find((item) => item.name === '岁官符')
      ?.limitations.some((item) => /逐月官符.+不生成普通“官符”/.test(item)),
  );
  assert.ok(
    data.shenShaFacts
      ?.find((item) => item.name === '岁死符')
      ?.limitations.some((item) => /逐月死符.+不生成普通“死符”/.test(item)),
  );
  assert.ok(
    evidence.traditionalFacts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.doesNotMatch(
    evidence.promptText,
    /traditionalFacts|本项目|当前项目|工程|算法结果|主婚姻|主官非|主疾病|主死丧/,
  );
});

test('大六壬登记课体应以稳定键、固定古籍版本进入统一证据', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.ok(data.guaTiFacts?.length);
  assert.deepEqual(
    data.guaTi,
    data.guaTiFacts.map((fact) => fact.name),
  );

  for (const fact of data.guaTiFacts) {
    const traditionalFact = evidence.traditionalFacts.find(
      (candidate) => candidate.key === fact.stableKey,
    );
    assert.ok(traditionalFact, `${fact.name}应进入传统事实证据`);
    assert.match(traditionalFact.key, /^liuren:verified-guati:/);
    assert.equal(traditionalFact.kind, '课体');
    assert.equal(traditionalFact.originalText, fact.sourceQuote);
    assert.deepEqual(traditionalFact.branches, fact.branches);
    assert.ok(traditionalFact.sources.includes(fact.sourceUrl));
    assert.match(fact.sourceUrl, /oldid=\d+$/);
    assert.match(traditionalFact.promptText, new RegExp(fact.name));
  }
});

test('大六壬四课克贼课体进入提示词时应只保留可复算结构', () => {
  const cases = [
    {
      date: new Date('2025-01-02T16:00:00+08:00'),
      name: '长度厄',
      condition: '四课中恰有三课为下位克上神',
      sourceQuote: '三下克为长度厄。',
    },
    {
      date: new Date('2025-01-11T12:00:00+08:00'),
      name: '绝嗣卦',
      condition: '四课均为下位克上神',
      sourceQuote: '凡四下克上曰绝嗣卦。',
    },
    {
      date: new Date('2025-01-13T16:00:00+08:00'),
      name: '幼度厄',
      condition: '四课中恰有三课为上神克下位',
      sourceQuote: '三上克为幼度厄。',
    },
  ] as const;

  for (const item of cases) {
    const data = generateLiuren(item.date);
    const fact = data.guaTiFacts.find((candidate) => candidate.name === item.name);
    assert.ok(fact, `${item.name}应由真实起盘命中`);
    const traditionalFact = data.evidenceAnalysis?.traditionalFacts.find(
      (candidate) => candidate.key === fact.stableKey,
    );
    assert.ok(traditionalFact);
    assert.equal(traditionalFact.originalText, item.sourceQuote);
    assert.equal(
      traditionalFact.promptText,
      `盘面命中“${item.name}”：${item.condition}；只登记课体结构，不据此单断现实吉凶`,
    );
    assert.match(data.evidenceAnalysis?.promptText ?? '', new RegExp(item.condition));
    assert.doesNotMatch(traditionalFact.promptText, /贫苦|长幼有厄|疾病|死丧|婚姻|官非/);
  }
});

test('大六壬日干受克发用课体进入提示词时应只保留盘面条件', () => {
  const cases = [
    {
      date: new Date('2025-01-04T02:00:00+08:00'),
      name: '天网卦',
      condition: '占时丑与初传丑均克日干癸',
      sourceQuote: '凡时与用神并克天干者曰天网卦。',
    },
    {
      date: new Date('2025-01-07T12:00:00+08:00'),
      name: '上门乱首',
      condition: '日支子临日干丙并克干，且以日支发用',
      sourceQuote: '支临干克干，为上门乱首，更兼发用尤的。',
    },
  ] as const;

  for (const item of cases) {
    const data = generateLiuren(item.date);
    const fact = data.guaTiFacts.find((candidate) => candidate.name === item.name);
    assert.ok(fact, `${item.name}应由真实起盘命中`);
    const traditionalFact = data.evidenceAnalysis?.traditionalFacts.find(
      (candidate) => candidate.key === fact.stableKey,
    );
    assert.ok(traditionalFact);
    assert.equal(traditionalFact.originalText, item.sourceQuote);
    assert.equal(
      traditionalFact.promptText,
      `盘面命中“${item.name}”：${item.condition}；只登记课体结构，不据此单断现实吉凶`,
    );
    assert.match(data.evidenceAnalysis?.promptText ?? '', new RegExp(item.condition));
    assert.doesNotMatch(traditionalFact.promptText, /刑狱|疾病|死丧|犯上|君臣|父子|吉凶总分/);
  }
});

test('大六壬旬仪旬奇发用课体进入提示词时应只保留日柱与初传事实', () => {
  const cases = [
    {
      date: new Date('2025-01-01T10:00:00+08:00'),
      name: '六仪课',
      condition: '日柱庚午属甲子旬，旬首地支子发用',
      sourceQuote: '旬首发用为六仪。',
    },
    {
      date: new Date('2025-01-04T02:00:00+08:00'),
      name: '三奇课',
      condition: '日柱癸酉属甲子旬，旬奇丑发用',
      sourceQuote: '三奇发用。子戌旬奇在丑，申午旬奇在子，辰寅旬中奇在亥。',
    },
  ] as const;

  for (const item of cases) {
    const data = generateLiuren(item.date);
    const fact = data.guaTiFacts.find((candidate) => candidate.name === item.name);
    assert.ok(fact, `${item.name}应由真实起盘命中`);
    const traditionalFact = data.evidenceAnalysis?.traditionalFacts.find(
      (candidate) => candidate.key === fact.stableKey,
    );
    assert.ok(traditionalFact);
    assert.equal(traditionalFact.originalText, item.sourceQuote);
    assert.equal(
      traditionalFact.promptText,
      `盘面命中“${item.name}”：${item.condition}；只登记课体结构，不据此单断现实吉凶`,
    );
    assert.match(data.evidenceAnalysis?.promptText ?? '', new RegExp(item.condition));
    assert.doesNotMatch(traditionalFact.promptText, /病|狱|灾|喜庆|功名|婚姻|现实结果|吉凶总分/);
  }
});

test('大六壬九丑课进入提示词时应只保留指定日柱与大吉落地事实', () => {
  const data = generateLiuren(new Date('2024-01-16T06:00:00+08:00'));
  const fact = data.guaTiFacts.find((candidate) => candidate.name === '九丑课');
  assert.ok(fact, '九丑课应由真实起盘命中');
  assert.deepEqual(fact.matchedConditions, ['日柱己卯为九丑十日之一，天盘大吉丑临日支卯']);
  const traditionalFact = data.evidenceAnalysis?.traditionalFacts.find(
    (candidate) => candidate.key === fact.stableKey,
  );
  assert.ok(traditionalFact);
  assert.equal(
    traditionalFact.promptText,
    '盘面命中“九丑课”：日柱己卯为九丑十日之一，天盘大吉丑临日支卯；只登记课体结构，不据此单断现实吉凶',
  );
  assert.match(data.evidenceAnalysis?.promptText ?? '', /日柱己卯.+大吉丑临日支卯/);
  assert.doesNotMatch(traditionalFact.promptText, /灾|婚姻|疾病|刑狱|死亡|功名|现实结果|吉凶总分/);
});

test('十二天将旧类象字段不得保留或软化后继续进入提示词', () => {
  Object.values(TIANJIANG_ATTRIBUTES).forEach((item) => {
    assert.deepEqual(Object.keys(item).sort(), ['branch', 'stem', 'wuxing', 'yinYang']);
  });

  const dangerousText = conditionLiurenTraditionalText(
    '白虎为凶丧之神，主疾病、死丧、血光、刀兵、破财；六合主婚姻；勾陈主官非。',
  );
  assert.equal(dangerousText, '未采用传统解释；当前只保留可复算盘面事实');

  const data = generateLiuren(fixedDate);
  Object.values(data.tianJiangProps ?? {}).forEach((item) => {
    assert.deepEqual(Object.keys(item).sort(), ['branch', 'stem', 'wuxing', 'yinYang']);
  });
  const tianJiangFacts = data.evidenceAnalysis?.traditionalFacts.filter(
    (item) => item.kind === '天将属性',
  );
  assert.ok(tianJiangFacts?.length);
  tianJiangFacts.forEach((fact) => {
    assert.match(
      fact.originalText,
      /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][金木水火土][阴阳]$/,
    );
    assert.match(fact.promptText, /配干.+配支.+五行.+阴阳/);
    assert.match(fact.promptText, /类象字段未保存/);
    assert.doesNotMatch(
      `${fact.originalText}${fact.promptText}`,
      /婚姻|疾病|盗贼|官非|欺诈|升迁|财帛|死丧|传统类象/,
    );
  });
});

test('十二天将不得混入十二月将的五味、主数、地形和身体属性', () => {
  const expectedStemBranches = {
    贵人: '己丑',
    螣蛇: '丁巳',
    朱雀: '丙午',
    六合: '乙卯',
    勾陈: '戊辰',
    青龙: '甲寅',
    天空: '戊戌',
    白虎: '庚申',
    太常: '己未',
    玄武: '癸亥',
    太阴: '辛酉',
    天后: '壬子',
  };

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(TIANJIANG_ATTRIBUTES).map(([name, item]) => [
        name,
        `${item.stem}${item.branch}`,
      ]),
    ),
    expectedStemBranches,
  );
  Object.values(TIANJIANG_ATTRIBUTES).forEach((item) => {
    assert.deepEqual(Object.keys(item).sort(), ['branch', 'stem', 'wuxing', 'yinYang']);
  });

  const data = generateLiuren(fixedDate);
  Object.values(data.tianJiangProps ?? {}).forEach((item) => {
    assert.deepEqual(Object.keys(item).sort(), ['branch', 'stem', 'wuxing', 'yinYang']);
  });
});

test('大六壬旧结果缺少逐项神煞起法时应从四柱重建全部已审核规则', () => {
  const data = generateLiuren(fixedDate);
  const expectedFacts = structuredClone(data.shenShaFacts ?? []);
  data.shenShaFacts = undefined;
  data.shenShaSummary = ['伪造神煞在伪'];

  const evidence = analyzeLiurenEvidence(data);
  const shenShaFacts = evidence.traditionalFacts.filter((item) => item.kind === '神煞');
  assert.equal(shenShaFacts.length, expectedFacts.length);
  assert.deepEqual(
    shenShaFacts.map((item) => item.name),
    expectedFacts.map((item) => item.name),
  );
  assert.doesNotMatch(evidence.promptText, /伪造神煞|在伪/);
  assert.ok(shenShaFacts.every((item) => item.sources.length > 0));
});

test('十二天将阴阳应与所配天干一致', () => {
  assert.equal(TIANJIANG_ATTRIBUTES.贵人.yinYang, '阴');
  assert.equal(TIANJIANG_ATTRIBUTES.六合.yinYang, '阴');
  assert.equal(TIANJIANG_ATTRIBUTES.天后.yinYang, '阳');
});
