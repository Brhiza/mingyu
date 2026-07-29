import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyao, analyzeLiuyaoEvidence } from 'mingyu-core/divination/liuyao';
import { isKe, isSheng } from 'mingyu-core/ganzhi';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');
const fixedYaos = [7, 8, 9, 6, 7, 8] as const;

test('六爻排盘应内置无总分的用神作用链结构化证据', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'liuyao:evidence');
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
  assert.ok(evidence.candidates.length > 0);
  assert.ok(evidence.selectedCandidate);
  assert.equal(evidence.selectionFact.status, '已选定候选');
  assert.equal(evidence.selectionFact.selectedCandidateKey, evidence.selectedCandidate.key);
  assert.equal(evidence.lineCoverageFact.status, '完整');
  assert.deepEqual(evidence.lineCoverageFact.actualPositions, [1, 2, 3, 4, 5, 6]);
  assert.equal(evidence.lineFacts.length, 6);
  assert.notEqual(evidence.hiddenSpiritCoverageFact.status, '字段缺失');
  assert.equal(evidence.hiddenSpiritFacts.length, data.hiddenSpirits?.length ?? 0);
  assert.deepEqual(
    evidence.lineFacts.map((item) => item.position),
    [1, 2, 3, 4, 5, 6],
  );
  assert.ok(
    evidence.lineFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.rawValue >= 6 &&
        item.rawValue <= 9 &&
        item.sixGod &&
        item.sixRelative &&
        item.najia.branch &&
        item.najia.wuxing &&
        item.monthState.branch &&
        item.dayState.branch &&
        item.promptText &&
        item.sources.length >= 3 &&
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(
    evidence.hiddenSpiritFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.sources.length > 0 &&
        item.limitation.includes('不得按条件数量直接宣布出伏'),
    ),
  );
  assert.ok(
    evidence.candidates.every(
      (item) =>
        item.key.startsWith('liuyao:candidate:') &&
        item.referenceKeys.length === item.references.length &&
        item.references.every(
          (reference) =>
            reference.key.startsWith('liuyao:reference:') &&
            [...evidence.lineFacts, ...evidence.hiddenSpiritFacts].some(
              (fact) => fact.key === reference.factKey,
            ),
        ) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('候选不等于已证明现实事项'),
    ),
  );
  assert.ok(
    evidence.godChain.every(
      (item) =>
        item.key.startsWith('liuyao:god-chain:') &&
        item.referenceKeys.length === item.references.length &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不直接证明现实助力'),
    ),
  );
  assert.ok(
    evidence.traditionalSymbols.every(
      (item) =>
        item.key.startsWith('liuyao:traditional-symbol:') &&
        item.status === '已映射' &&
        item.sources.length > 0,
    ),
  );
  assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
  assert.ok(
    evidence.counterEvidenceFacts.every(
      (item) =>
        item.key.startsWith('liuyao:counter:') &&
        item.status === '已触发' &&
        evidence.candidates.some((candidate) => candidate.key === item.ownerCandidateKey) &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把单项反证直接写成现实失败'),
    ),
  );
  assert.equal(evidence.timingSummaryFact.factKeys.length, evidence.timingFacts.length);
  assert.ok(
    evidence.timingFacts.every(
      (item) =>
        item.key.startsWith('liuyao:timing:') &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把爻位'),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.lineFactCount, evidence.lineFacts.length);
  assert.equal(evidence.summaryFact.hiddenSpiritFactCount, evidence.hiddenSpiritFacts.length);
  assert.equal(evidence.summaryFact.candidateCount, evidence.candidates.length);
  assert.equal(
    evidence.summaryFact.matchedCandidateCount,
    evidence.candidates.filter((item) => item.status === '已匹配').length,
  );
  assert.equal(evidence.summaryFact.godChainFactCount, evidence.godChain.length);
  assert.equal(evidence.summaryFact.structureFactCount, evidence.structureFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【六爻用神作用链结构化证据】/);
  assert.match(evidence.promptText, /六爻逐爻计算事实/);
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assert.match(evidence.promptText, /解释限制：/);
  assert.match(evidence.promptText, /六爻取用与作用链解释边界/);
  const changingReference = evidence.candidates
    .flatMap((candidate) => candidate.references)
    .find((reference) => reference.isChanging);
  assert.ok(changingReference?.changedYao);
  const changingFact = evidence.lineFacts.find((item) => item.activity === '明动');
  assert.ok(changingFact?.changedYao);
  assert.match(evidence.promptText, /→.*（回头|化进|化退|变爻空亡）/);
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
  assertPromptIsPortableTaskText(evidence.promptText);

  const incomplete = analyzeLiuyaoEvidence({
    ...data,
    yaosDetail: data.yaosDetail.slice(0, 5),
    hiddenSpirits: undefined,
    evidenceAnalysis: undefined,
  });
  assert.equal(incomplete.lineCoverageFact.status, '缺少爻位');
  assert.deepEqual(incomplete.lineCoverageFact.missingPositions, [6]);
  assert.equal(incomplete.hiddenSpiritCoverageFact.status, '字段缺失');
  assert.equal(incomplete.summaryFact.status, '部分资料缺失');
  assert.equal(
    incomplete.calculationSteps.find((item) => item.stage === '六爻逐爻计算')?.status,
    '资料不足',
  );
  assert.match(incomplete.hiddenSpiritCoverageFact.promptText, /不得反推伏神位置/);
});

test('六爻伏神证据应重算飞伏生克与得助受制条件并兼容旧结果', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const gou = generateLiuyao(date, {
    method: 'manual',
    yaos: [8, 7, 7, 7, 7, 7],
  });
  const dun = generateLiuyao(date, {
    method: 'manual',
    yaos: [8, 8, 7, 7, 7, 7],
  });
  const gouEvidence = analyzeLiuyaoEvidence(gou, { usefulGodRelative: '妻财' });
  const dunEvidence = analyzeLiuyaoEvidence(dun);
  const gouWealth = gouEvidence.hiddenSpiritFacts.find((item) => item.sixRelative === '妻财');
  const dunChild = dunEvidence.hiddenSpiritFacts.find((item) => item.sixRelative === '子孙');

  assert.equal(gouWealth?.conditionAnalysis.flyingRelation, '飞来生伏');
  assert.ok(gouWealth?.support.includes('飞来生伏'));
  assert.ok(gouWealth?.support.includes('月建生伏神'));
  assert.ok(!gouWealth?.constraints.some((item) => item.includes('受飞神')));
  assert.match(gouWealth?.promptText ?? '', /飞伏关系飞来生伏/);
  assert.match(gouWealth?.promptText ?? '', /支持.*飞来生伏/);
  assert.equal(dunChild?.conditionAnalysis.flyingRelation, '飞来克伏');
  assert.ok(dunChild?.constraints.includes('飞来克伏（月令囚）'));
  assert.ok(dunChild?.constraints.includes('日辰冲伏神'));
  assert.match(dunChild?.promptText ?? '', /限制.*飞来克伏/);

  const hiddenReference = gouEvidence.candidates
    .flatMap((candidate) => candidate.references)
    .find((reference) => reference.key === 'liuyao:reference:hidden:2:妻财');
  assert.ok(hiddenReference?.support.includes('飞来生伏'));
  assert.ok(!hiddenReference?.constraints.some((item) => item.includes('受飞神')));

  const legacyGou = {
    ...gou,
    hiddenSpirits: gou.hiddenSpirits?.map((item) => {
      const legacyItem = { ...item };
      delete legacyItem.conditionAnalysis;
      return legacyItem;
    }),
    evidenceAnalysis: undefined,
  };
  const legacyFact = analyzeLiuyaoEvidence(legacyGou).hiddenSpiritFacts.find(
    (item) => item.sixRelative === '妻财',
  );
  assert.deepEqual(legacyFact?.conditionAnalysis, gouWealth?.conditionAnalysis);
  assert.deepEqual(legacyFact?.support, gouWealth?.support);
  assert.deepEqual(legacyFact?.constraints, gouWealth?.constraints);
});

test('六爻证据应区分日冲暗动、静爻日破与明动爻日冲', () => {
  const staticYaos = [8, 7, 8, 8, 7, 8] as const;
  const strongStatic = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: staticYaos,
  }).evidenceAnalysis?.lineFacts[5];
  const weakStatic = generateLiuyao(new Date('2025-05-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: staticYaos,
  }).evidenceAnalysis?.lineFacts[5];
  const weakMovingData = generateLiuyao(new Date('2025-05-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [8, 7, 8, 8, 7, 6],
  });
  const weakMoving = weakMovingData.evidenceAnalysis?.lineFacts[5];

  assert.equal(strongStatic?.activity, '暗动');
  assert.ok(strongStatic?.dayState.relations.includes('日冲暗动'));
  assert.ok(strongStatic?.support.includes('暗动'));
  assert.ok(!strongStatic?.constraints.includes('日破'));

  assert.equal(weakStatic?.activity, '静爻');
  assert.ok(weakStatic?.dayState.relations.includes('日冲成破'));
  assert.ok(weakStatic?.constraints.includes('日破'));

  assert.equal(weakMoving?.activity, '明动');
  assert.ok(weakMoving?.dayState.relations.includes('与日辰相冲'));
  assert.ok(!weakMoving?.dayState.relations.includes('日冲成破'));
  assert.ok(!weakMoving?.constraints.includes('日破'));
  assert.ok(!weakMovingData.evidenceAnalysis?.candidates[0]?.constraints.includes('日破'));

  const legacyMoving = analyzeLiuyaoEvidence({
    ...weakMovingData,
    yaosDetail: weakMovingData.yaosDetail.map((item, index) =>
      index === 5 ? { ...item, isDayClash: undefined, isDayBreak: true } : item,
    ),
    evidenceAnalysis: undefined,
  }).lineFacts[5];
  assert.ok(legacyMoving.dayState.relations.includes('与日辰相冲'));
  assert.ok(!legacyMoving.dayState.relations.includes('日冲成破'));
  assert.ok(!legacyMoving.constraints.includes('日破'));
});

test('六爻证据应同时保留基础动变关系与化空条件', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 6],
  });
  const changedLine = data.yaosDetail[5];
  const changedFact = data.evidenceAnalysis?.lineFacts[5];

  assert.deepEqual(changedLine.changeRelations, ['回头生', '化空']);
  assert.equal(changedLine.changeRelation, '化空');
  assert.deepEqual(changedFact?.changedYao?.relations, ['回头生', '化空']);
  assert.ok(changedFact?.support.includes('回头生'));
  assert.ok(changedFact?.constraints.includes('变爻空亡'));
  assert.match(changedFact?.promptText || '', /回头生、化空/);
  assert.doesNotMatch(changedFact?.promptText || '', /化空.*变爻空亡|变爻空亡.*化空/);
});

test('六爻原神忌神仇神应按生克作用链推导', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const evidence = analyzeLiuyaoEvidence(data, { topic: 'shiye' });
  const useful = evidence.godChain.find((item) => item.role === '用神');
  const source = evidence.godChain.find((item) => item.role === '原神');
  const taboo = evidence.godChain.find((item) => item.role === '忌神');
  const enemy = evidence.godChain.find((item) => item.role === '仇神');

  assert.equal(evidence.candidates[0].relative, '官鬼');
  assert.ok(useful && source && taboo && enemy);
  assert.equal(isSheng(source.wuxing, useful.wuxing), true);
  assert.equal(isKe(taboo.wuxing, useful.wuxing), true);
  assert.equal(isSheng(enemy.wuxing, taboo.wuxing), true);
  assert.equal(isKe(enemy.wuxing, source.wuxing), true);
  assert.ok(evidence.godChain.every((item) => item.status === '盘中有对应'));
});

test('六爻整卦关系、反吟伏吟与三合应形成独立结构事实', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const evidence = analyzeLiuyaoEvidence({
    ...data,
    hexagramRelations: {
      original: '六冲卦',
      changed: '六合卦',
      transition: '六冲变六合',
    },
    fanfuRelations: {
      fanyin: [
        {
          kind: '卦反吟',
          scope: '内卦',
          label: '内卦反吟',
          description: '内卦主变地支相冲',
        },
      ],
      fuyin: [],
      labels: ['内卦反吟'],
    },
    specialPattern: '全动卦',
    specialAdvice: '只作动爻密集结构参考',
    sanheWithDay: {
      group: '申子辰水局',
      members: ['申', '子', '辰'],
      description: '动变支与日支组成申子辰三合',
    },
    evidenceAnalysis: undefined,
  });

  assert.deepEqual(
    new Set(evidence.structureFacts.map((item) => item.kind)),
    new Set(['整卦六合六冲', '反吟伏吟', '特殊卦象', '日辰三合']),
  );
  assert.ok(
    evidence.structureFacts.every(
      (item) =>
        item.key.startsWith('liuyao:structure:') &&
        item.status === '已计算' &&
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得直接写成现实和合'),
    ),
  );
  assert.ok(evidence.timingFacts.some((item) => item.type === '反吟伏吟节奏'));
});

test('鬼神怪异主题必须保留现实解释限制', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const evidence = analyzeLiuyaoEvidence(data, { topic: 'guaishen' });

  assert.equal(evidence.candidates[0].relative, '官鬼');
  assert.match(evidence.promptText, /不能据此证明超自然原因/);
  assert.match(evidence.promptText, /不得仅凭官鬼、白虎、螣蛇/);
});
