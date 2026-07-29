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
  assert.equal(evidence.selectedCandidate, null);
  assert.equal(evidence.selectionFact.status, '取用范围待定');
  assert.equal(evidence.selectionFact.targetRelative, null);
  assert.equal(evidence.selectionFact.selectedCandidateKey, null);
  assert.equal(evidence.selectionFact.selectedReferenceKey, null);
  assert.ok(evidence.candidates.every((item) => item.candidateRole === '辅助观察'));
  assert.equal(evidence.godChain.length, 0);
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
        item.strengthAnalysis &&
        item.support.length === item.strengthAnalysis.support.length &&
        item.constraints.length === item.strengthAnalysis.constraints.length &&
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
        item.role &&
        item.effect &&
        Array.isArray(item.referenceKeys) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把爻位'),
    ),
  );
  assert.equal(evidence.summaryFact.status, '用神取用待定');
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
  assert.match(evidence.promptText, /世爻、应爻和动爻只作辅助观察/);
  assert.match(evidence.promptText, /综合旺衰条件(?:仅见支持条件|仅见限制条件|支持与限制并见)/);
  assert.doesNotMatch(evidence.promptText, /十二宫/);
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

test('六爻通用与感情主题在关系语义不足时不得硬取用神', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const general = analyzeLiuyaoEvidence(data);
  const relationship = analyzeLiuyaoEvidence(data, { topic: 'ganqing' });

  assert.equal(general.selectionFact.status, '取用范围待定');
  assert.equal(general.selectedCandidate, null);
  assert.equal(general.godChain.length, 0);
  assert.ok(general.candidates.every((item) => item.candidateRole === '辅助观察'));
  assert.deepEqual(
    new Set(general.candidates.map((item) => item.label)),
    new Set(['通用主轴', '应爻辅轴', '动爻触发第3爻', '动爻触发第4爻']),
  );

  assert.equal(relationship.selectionFact.status, '取用范围待定');
  assert.equal(relationship.selectionFact.targetRelative, null);
  assert.equal(relationship.selectedCandidate, null);
  assert.equal(relationship.godChain.length, 0);
  assert.deepEqual(
    relationship.candidates
      .filter((item) => item.candidateRole === '用神候选')
      .map((item) => item.relative),
    ['妻财', '官鬼'],
  );
  assert.deepEqual(
    relationship.candidates
      .filter((item) => item.candidateRole === '辅助观察')
      .map((item) => item.label),
    ['关系我方', '关系对方'],
  );
  assert.match(relationship.selectionFact.promptText, /尚缺求测者身份与所问对象关系/);

  assert.throws(
    () => analyzeLiuyaoEvidence(data, { usefulGodRelative: '世爻' }),
    /只能是父母、兄弟、官鬼、妻财或子孙/,
  );
});

test('六爻明确六亲后应按本卦、变爻、月日、伏神逐层取用', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const visible = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [7, 7, 9, 7, 7, 7] }),
    { usefulGodRelative: '父母' },
  );
  const changed = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [6, 8, 7, 7, 7, 7] }),
    { usefulGodRelative: '妻财' },
  );
  const hiddenData = generateLiuyao(date, {
    method: 'manual',
    yaos: [8, 7, 7, 7, 7, 7],
  });
  const calendar = analyzeLiuyaoEvidence(
    {
      ...hiddenData,
      ganzhi: { ...hiddenData.ganzhi, month: '甲寅' },
      evidenceAnalysis: undefined,
    },
    { usefulGodRelative: '妻财' },
  );
  const calendarPair = analyzeLiuyaoEvidence(
    {
      ...hiddenData,
      ganzhi: { ...hiddenData.ganzhi, month: '甲寅', day: '乙卯' },
      evidenceAnalysis: undefined,
    },
    { usefulGodRelative: '妻财' },
  );
  const hidden = analyzeLiuyaoEvidence(hiddenData, { usefulGodRelative: '妻财' });
  const missing = analyzeLiuyaoEvidence(
    { ...hiddenData, hiddenSpirits: [], evidenceAnalysis: undefined },
    { usefulGodRelative: '妻财' },
  );

  assert.equal(visible.selectionFact.matchingTier, '本卦明现');
  assert.equal(visible.selectionFact.selectedReferenceKey, 'liuyao:reference:line:3');
  assert.ok(visible.candidates[0].references.every((item) => item.source === '本卦'));

  assert.equal(changed.selectionFact.matchingTier, '变爻显出');
  assert.equal(changed.selectionFact.selectedReferenceKey, 'liuyao:reference:changed:1');
  assert.deepEqual(
    changed.candidates[0].references.map((item) => item.source),
    ['变爻'],
  );
  assert.equal(changed.candidates[0].references[0].branch, '卯');
  assert.ok(!changed.candidates[0].references.some((item) => item.source === '伏神'));

  assert.equal(calendar.selectionFact.matchingTier, '月日入用');
  assert.equal(calendar.selectionFact.selectedReferenceKey, 'liuyao:reference:calendar:月建');
  assert.deepEqual(
    calendar.candidates[0].references.map((item) => item.source),
    ['月建'],
  );
  assert.ok(!calendar.candidates[0].references.some((item) => item.source === '伏神'));

  assert.equal(calendarPair.selectionFact.status, '已选定候选');
  assert.equal(calendarPair.selectionFact.matchingTier, '月日入用');
  assert.equal(calendarPair.selectionFact.selectedReferenceKey, null);
  assert.deepEqual(
    calendarPair.candidates[0].references.map((item) => item.source),
    ['月建', '日辰'],
  );

  assert.equal(hidden.selectionFact.matchingTier, '伏神检索');
  assert.equal(hidden.selectionFact.selectedReferenceKey, 'liuyao:reference:hidden:2:妻财');
  assert.deepEqual(
    hidden.candidates[0].references.map((item) => item.source),
    ['伏神'],
  );

  assert.equal(missing.selectionFact.status, '缺少可用候选');
  assert.equal(missing.selectionFact.matchingTier, null);
  assert.equal(missing.selectedCandidate, null);
  assert.equal(missing.godChain.length, 0);
});

test('六爻同一六亲多现时仅唯一明动爻可直接选定', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const analyzeParents = (yaos: [number, number, number, number, number, number]) =>
    analyzeLiuyaoEvidence(generateLiuyao(date, { method: 'manual', yaos }), {
      usefulGodRelative: '父母',
    });
  const staticLines = analyzeParents([7, 7, 7, 7, 7, 7]);
  const soleMoving = analyzeParents([7, 7, 9, 7, 7, 7]);
  const bothMoving = analyzeParents([7, 7, 9, 7, 7, 9]);

  assert.equal(staticLines.selectionFact.status, '用神爻位待择');
  assert.equal(staticLines.selectionFact.selectedCandidateKey, null);
  assert.equal(staticLines.selectionFact.selectedReferenceKey, null);
  assert.equal(staticLines.godChain.length, 4);

  assert.equal(soleMoving.selectionFact.status, '已选定候选');
  assert.equal(soleMoving.selectionFact.selectedReferenceKey, 'liuyao:reference:line:3');
  assert.deepEqual(soleMoving.godChain.find((item) => item.role === '用神')?.referenceKeys, [
    'liuyao:reference:line:3',
  ]);

  assert.equal(bothMoving.selectionFact.status, '用神爻位待择');
  assert.equal(bothMoving.selectionFact.selectedReferenceKey, null);
  assert.match(bothMoving.selectionFact.promptText, /不按数组顺序强选/);
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
    yaosDetail: gou.yaosDetail.map((item) => ({ ...item, isHiddenMove: true })),
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
  assert.ok(!legacyFact?.support.some((item) => item.includes('暗动生伏')));
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
  assert.ok(changedFact?.constraints.includes('化空'));
  assert.match(changedFact?.promptText || '', /回头生、化空/);
  assert.doesNotMatch(changedFact?.promptText || '', /化空.*变爻空亡|变爻空亡.*化空/);
});

test('六爻证据应从原始盘面重算综合旺衰并兼容旧结果', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 8, 7, 6, 7, 8],
  });
  const current = analyzeLiuyaoEvidence(data);
  const legacy = analyzeLiuyaoEvidence({
    ...data,
    yaosDetail: data.yaosDetail.map((item) => {
      const oldItem = { ...item };
      delete oldItem.strengthAnalysis;
      return oldItem;
    }),
    evidenceAnalysis: undefined,
  });
  const tampered = analyzeLiuyaoEvidence({
    ...data,
    yaosDetail: data.yaosDetail.map((item) => ({
      ...item,
      seasonState: '旺',
      isHiddenMove: false,
      isDayBreak: true,
      changeRelation: item.changedYao ? '比和' : item.changeRelation,
      changeRelations: item.changedYao ? ['比和'] : item.changeRelations,
      changeDirection: item.changedYao ? null : item.changeDirection,
      strengthAnalysis: item.strengthAnalysis
        ? {
            ...item.strengthAnalysis,
            support: ['伪造支持条件'],
            constraints: ['伪造限制条件'],
          }
        : undefined,
    })),
    evidenceAnalysis: undefined,
  });

  assert.deepEqual(
    legacy.lineFacts.map((item) => item.strengthAnalysis),
    current.lineFacts.map((item) => item.strengthAnalysis),
  );
  assert.deepEqual(
    legacy.lineFacts.map((item) => [item.support, item.constraints]),
    current.lineFacts.map((item) => [item.support, item.constraints]),
  );
  assert.ok(
    tampered.lineFacts.every(
      (item) =>
        !item.support.includes('伪造支持条件') && !item.constraints.includes('伪造限制条件'),
    ),
  );
  assert.deepEqual(
    tampered.lineFacts.map((item) => item.changedYao),
    current.lineFacts.map((item) => item.changedYao),
  );
  assert.doesNotMatch(
    JSON.stringify(current.lineFacts.map((item) => item.strengthAnalysis)),
    /score|rating|probability|总分|概率|最终强弱|吉凶结论/,
  );
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
  assert.ok(evidence.godChain.every((item) => item.status === '当前资料有对应'));
});

test('六爻原神忌神效力应逐爻并列有力无力条件与真实活动状态', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 6],
  });
  const evidence = analyzeLiuyaoEvidence(data, { usefulGodRelative: '父母' });
  const useful = evidence.godChain.find((item) => item.role === '用神');
  const source = evidence.godChain.find((item) => item.role === '原神');
  const taboo = evidence.godChain.find((item) => item.role === '忌神');
  const enemy = evidence.godChain.find((item) => item.role === '仇神');
  const usefulLine = useful?.effectFacts.find(
    (item) => item.referenceKey === 'liuyao:reference:line:2',
  );
  const sourceLine = source?.effectFacts.find(
    (item) => item.referenceKey === 'liuyao:reference:line:3',
  );
  const tabooLine = taboo?.effectFacts.find(
    (item) => item.referenceKey === 'liuyao:reference:line:5',
  );

  assert.equal(usefulLine?.activity, '明动');
  assert.equal(usefulLine?.status, '有力无力条件并见');
  assert.ok(usefulLine?.supportingConditions.includes('回头生'));
  assert.ok(usefulLine?.blockingConditions.includes('月令死'));
  assert.ok(sourceLine?.supportingConditions.includes('原神与忌神同动，忌神贪生原神'));
  assert.ok(sourceLine?.blockingConditions.includes('仇神发动克原神'));
  assert.ok(tabooLine?.supportingConditions.includes('忌神与仇神同动，得仇神生扶'));
  assert.ok(tabooLine?.blockingConditions.includes('忌神与原神同动，须辨贪生忘克'));
  assert.equal(source?.effectStatus, '有力无力条件并见');
  assert.equal(taboo?.effectStatus, '有力无力条件并见');
  assert.equal(enemy?.effectStatus, '资料不足');
  assert.deepEqual(enemy?.effectFacts, []);
  assert.doesNotMatch(
    JSON.stringify(evidence.godChain.map((item) => [item.effectStatus, item.effectFacts])),
    /score|rating|probability|总分|概率|最终吉凶/,
  );
});

test('六爻旺相静爻只记录得力条件，不冒充已经作用', () => {
  const evidence = analyzeLiuyaoEvidence(
    generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
      method: 'manual',
      yaos: [7, 7, 7, 7, 7, 7],
    }),
    { usefulGodRelative: '父母' },
  );
  const tabooLine = evidence.godChain
    .find((item) => item.role === '忌神')
    ?.effectFacts.find((item) => item.referenceKey === 'liuyao:reference:line:2');

  assert.equal(tabooLine?.activity, '静爻');
  assert.ok(tabooLine?.supportingConditions.includes('月令相'));
  assert.match(tabooLine?.promptText ?? '', /活动状态静爻/);
  assert.match(tabooLine?.promptText ?? '', /不按数量裁定能否实际作用/);
});

test('六爻用神月破又受日克时应保留无根同类条件', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 6],
  });
  const evidence = analyzeLiuyaoEvidence(
    {
      ...data,
      ganzhi: { ...data.ganzhi, month: '乙亥', day: '甲子' },
      evidenceAnalysis: undefined,
    },
    { usefulGodRelative: '父母' },
  );
  const usefulLine = evidence.godChain
    .find((item) => item.role === '用神')
    ?.effectFacts.find((item) => item.referenceKey === 'liuyao:reference:line:2');

  assert.ok(usefulLine?.blockingConditions.includes('月破'));
  assert.ok(usefulLine?.blockingConditions.includes('日辰克本爻'));
  assert.ok(usefulLine?.blockingConditions.includes('月破且受日辰克，见原典“用神无根”同类条件'));
  assert.match(usefulLine?.promptText ?? '', /条件只并列复核/);
});

test('六爻应期应按用神原神忌神辨明病药方向', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const data = generateLiuyao(date, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] });
  const parent = analyzeLiuyaoEvidence(data, { usefulGodRelative: '父母' });
  const wealth = analyzeLiuyaoEvidence(data, { usefulGodRelative: '妻财' });

  assert.equal(parent.selectionFact.status, '已选定候选');
  assert.ok(
    parent.godChain
      .filter((item) => item.role !== '用神')
      .every((item) => item.references.every((reference) => reference.source !== '变爻')),
  );
  const tabooFact = parent.timingFacts.find((item) => item.type === '忌神制化');
  assert.equal(tabooFact?.role, '忌神');
  assert.equal(tabooFact?.effect, '制忌待辨');
  assert.match(tabooFact?.promptText ?? '', /反可能恢复为忌/);
  assert.match(tabooFact?.promptText ?? '', /不得把解除忌神限制一律当有利应期/);

  const usefulFact = wealth.timingFacts.find((item) => item.type === '用神病药');
  assert.equal(usefulFact?.role, '用神');
  assert.equal(usefulFact?.effect, '受制待解');
  assert.match(usefulFact?.promptText ?? '', /空亡确为当前之病/);
  assert.match(usefulFact?.promptText ?? '', /若填实后反受克，不作有利应期/);
  assert.doesNotMatch(wealth.timingConditions.join('；'), /空亡.+须待出空、冲实或透出再验/);
});

test('六爻伏神与取用未定时不得泛化套用透出和空破应期', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const hidden = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [8, 6, 7, 6, 6, 6] }),
    { usefulGodRelative: '妻财' },
  );
  const pending = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] }),
    { usefulGodRelative: '兄弟' },
  );

  const hiddenTiming = hidden.timingFacts.find((item) => item.type === '伏神透出');
  assert.equal(hidden.selectionFact.status, '已选定候选');
  assert.equal(hiddenTiming?.role, '用神');
  assert.match(hiddenTiming?.promptText ?? '', /仅在伏神有用、飞神确实松动时/);
  assert.match(hiddenTiming?.promptText ?? '', /不能见伏神便固定取透出日/);

  assert.equal(pending.selectionFact.status, '用神爻位待择');
  assert.equal(pending.timingSummaryFact.status, '仅有边界');
  assert.ok(pending.timingFacts.some((item) => item.type === '取用边界'));
  assert.ok(
    pending.timingFacts.every(
      (item) => !['用神病药', '原神病药', '忌神制化', '伏神透出'].includes(item.type),
    ),
  );
  assert.match(pending.timingConditions.join('；'), /未闭合唯一用神前/);
});

test('六爻结构事实应重新计算三合并忽略旧派生字段', () => {
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
    new Set(['整卦六合六冲', '反吟伏吟', '特殊卦象', '卦内三合']),
  );
  assert.doesNotMatch(evidence.promptText, /动变支与日支组成申子辰三合/);
  const sanheFacts = evidence.structureFacts.filter((item) => item.kind === '卦内三合');
  assert.ok(sanheFacts.length > 0);
  assert.ok(
    sanheFacts.every(
      (item) =>
        item.sanheFormationKey?.startsWith('liuyao:sanhe:') &&
        item.sanhePattern &&
        item.sanheStatus &&
        item.sanheRole === '用神未定' &&
        item.referenceKeys?.length &&
        item.originalText.includes('仍须核验世爻是否在局及局对世用的生克'),
    ),
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
