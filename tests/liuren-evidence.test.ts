import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeLiurenEvidence,
  conditionLiurenTraditionalText,
  generateLiuren,
} from 'mingyu-core/divination/liuren';
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
        item.relationFacts.length > 0 &&
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
  assert.equal(evidence.focusSummaryFact.status, '已提供焦点');
  assert.ok(
    evidence.focusFacts.every(
      (item) =>
        item.key.startsWith('liuren:focus:') &&
        item.sourceStatus === '原结果提供' &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把日支、天将或神煞固定当作用神'),
    ),
  );
  assert.match(evidence.promptText, /【大六壬四课取传与三传推进结构化证据】/);
  assert.match(evidence.promptText, /取传规则事实：/);
  assert.match(evidence.promptText, /类神焦点状态：/);
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

test('大六壬证据应以旬空地支复核三传空亡，避免冗余字段冲突', () => {
  const data = generateLiuren(fixedDate);
  const initialBranch = data.threeTransmissions[0].branch;
  data.xunKong = Array.from(new Set([...(data.xunKong ?? []), initialBranch]));
  data.threeTransmissions[0].isVoid = false;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissions[0].isVoid, true);
  assert.equal(
    evidence.transmissions[0].relationFacts.find((item) => item.basis === '旬空')?.status,
    '中性',
  );
  assert.ok(
    !evidence.counterEvidenceFacts.some(
      (item) => item.ownerKey === evidence.transmissions[0].key && item.basis === '旬空',
    ),
  );
  assert.match(evidence.timingFacts[0].promptText, new RegExp(`初传${initialBranch}落旬空`));
  assert.match(evidence.promptText, new RegExp(`初传${initialBranch}落旬空`));
  assert.doesNotMatch(evidence.promptText, new RegExp(`初传${initialBranch}不空`));
  assert.match(evidence.promptText, /空亡有宜有忌/);
});

test('大六壬旧结果应逐传重算日干六亲与有方向关系，不沿用旧版中末传关系', () => {
  const data = generateLiuren(fixedDate);
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

test('大六壬旧结果缺少取传名、应期与焦点时应明确标记来源缺口', () => {
  const data = generateLiuren(fixedDate);
  data.transmissionRule = undefined;
  data.transmissionPattern = undefined;
  data.transmissionDetail = undefined;
  data.classicalRules = undefined;
  data.timingEvidence = undefined;
  data.focusEvidence = undefined;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissionRuleFact.status, '缺少规则名');
  assert.equal(evidence.transmissionRuleFact.rule, null);
  assert.equal(evidence.transmissionRuleFact.pattern, null);
  assert.equal(evidence.transmissionRuleFact.classicalRuleKeys.length, 0);
  assert.match(evidence.transmissionRuleFact.promptText, /不得按三传结果反推九宗门名称/);
  assert.deepEqual(evidence.timingEvidence, []);
  assert.equal(evidence.timingFacts.length, 4);
  assert.ok(
    evidence.timingFacts.every(
      (item) => item.sourceStatus === '由盘面补齐' && item.rawText === undefined,
    ),
  );
  assert.equal(evidence.focusFacts.length, 0);
  assert.equal(evidence.focusSummaryFact.status, '缺少焦点');
  assert.match(evidence.focusSummaryFact.promptText, /不得自行把日支、天将或神煞固定当作用神/);
  assert.match(evidence.promptText, /由盘面补齐/);
  assert.match(evidence.promptText, /类神焦点资料缺失/);
});

test('大六壬证据应保留类神未选定限制，不把日支或神煞固定当作用神', () => {
  const evidence = analyzeLiurenEvidence(generateLiuren(fixedDate));

  assert.match(evidence.promptText, /未按具体问题选定类神/);
  assert.match(evidence.promptText, /不得把日支、天将或神煞固定当作用神/);
  assert.match(evidence.promptText, /未给期限时不换算唯一日期/);
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

test('大六壬旧结果缺少天地盘时应明确标为证据缺口，不反推逐位事实', () => {
  const data = generateLiuren(fixedDate);
  data.heavenlyPlate = data.heavenlyPlate.slice(0, 11);

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.plateFact.status, '缺少');
  assert.equal(evidence.plateFact.expectedCount, 12);
  assert.equal(evidence.plateFact.actualCount, 11);
  assert.match(evidence.plateFact.promptText, /仅保留11\/12位/);
  assert.match(evidence.plateFact.limitation, /不得反推或补造/);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '天地盘定位资料缺失',
    ),
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
    shenShaFacts.every((item) => /^(年干|年支|日干|日支|月建).+按“.+”定位/.test(item.promptText)),
  );
  assert.ok(
    shenShaFacts.some((item) => item.sources.some((source) => source.includes('逐月神煞'))),
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

test('十二天将传统属性进入提示词时不得直接证明疾病、死亡、犯罪或婚姻结果', () => {
  const originalTexts = Object.values(TIANJIANG_ATTRIBUTES).map((item) => item.description);
  const promptTexts = originalTexts.map(conditionLiurenTraditionalText);

  assert.ok(originalTexts.some((item) => /婚姻/.test(item)));
  assert.ok(originalTexts.some((item) => /疾病/.test(item)));
  assert.ok(originalTexts.some((item) => /盗贼/.test(item)));
  promptTexts.forEach((text) => {
    assert.doesNotMatch(text, /主婚姻|主官非|主疾病|主死丧|主失窃|主欺骗|必然|必定/);
  });

  const dangerousText = conditionLiurenTraditionalText(
    '白虎为凶丧之神，主疾病、死丧、血光、刀兵、破财；六合主婚姻；勾陈主官非。',
  );
  assert.match(dangerousText, /传统类象涉及健康、损伤、安全与财物风险等议题/);
  assert.match(dangerousText, /六合传统类象涉及婚姻/);
  assert.match(dangerousText, /勾陈传统类象涉及官非/);
});

test('十二天将不得混入十二月将的五味、主数、地形和身体属性', () => {
  Object.values(TIANJIANG_ATTRIBUTES).forEach((item) => {
    assert.deepEqual(Object.keys(item).sort(), ['category', 'description', 'wuxing', 'yinYang']);
  });

  const data = generateLiuren(fixedDate);
  Object.values(data.tianJiangProps ?? {}).forEach((item) => {
    assert.deepEqual(Object.keys(item).sort(), ['category', 'description', 'wuxing', 'yinYang']);
  });
});

test('大六壬旧结果缺少逐项神煞起法时应明确不可复算', () => {
  const data = generateLiuren(fixedDate);
  data.shenShaFacts = undefined;

  const evidence = analyzeLiurenEvidence(data);
  const shenShaFacts = evidence.traditionalFacts.filter((item) => item.kind === '神煞');
  assert.ok(shenShaFacts.length > 0);
  assert.ok(shenShaFacts.every((item) => item.promptText.includes('未保存起法输入，不能据此复算')));
  assert.ok(shenShaFacts.every((item) => item.sources.includes('旧结果未保存逐项起法与来源')));
});

test('十二天将阴阳应与所配天干一致', () => {
  assert.equal(TIANJIANG_ATTRIBUTES.贵人.yinYang, '阴');
  assert.equal(TIANJIANG_ATTRIBUTES.六合.yinYang, '阴');
  assert.equal(TIANJIANG_ATTRIBUTES.天后.yinYang, '阳');
});
