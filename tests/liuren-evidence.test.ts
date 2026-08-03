import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeLiurenEvidence, generateLiuren } from 'mingyu-core/divination/liuren';
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
        item.relationFacts.length === 4 &&
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
        item.limitation.includes('不得换算唯一日期'),
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

test('大六壬证据应以旬空地支复核三传空亡，避免冗余字段冲突', () => {
  const data = generateLiuren(fixedDate);
  const initialBranch = data.threeTransmissions[0].branch;
  data.xunKong = Array.from(new Set([...(data.xunKong ?? []), initialBranch]));
  data.threeTransmissions[0].isVoid = false;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissions[0].isVoid, true);
  assert.equal(
    evidence.transmissions[0].relationFacts.find((item) => item.basis === '旬空')?.status,
    '限制',
  );
  assert.ok(
    evidence.counterEvidenceFacts.some(
      (item) => item.ownerKey === evidence.transmissions[0].key && item.basis === '旬空',
    ),
  );
  assert.match(evidence.timingFacts[0].promptText, new RegExp(`初传${initialBranch}空亡`));
  assert.match(evidence.promptText, new RegExp(`初传${initialBranch}空亡`));
  assert.doesNotMatch(evidence.promptText, new RegExp(`初传${initialBranch}不空`));
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
  assert.match(evidence.promptText, /不得把日支或任一神煞固定当作用神/);
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
  assert.ok(shenShaFacts.every((item) => /^(日干|日支|月建).+按“.+”定位/.test(item.promptText)));
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
