import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateLiuyao,
  analyzeLiuyaoEvidence,
  rebuildAuditedLiuyaoData,
} from 'mingyu-core/divination/liuyao';
import { isKe, isSheng } from 'mingyu-core/ganzhi';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');
const fixedYaos = [7, 8, 9, 6, 7, 8] as const;

const fixedCoinThrows = [
  { coins: [2, 2, 2], total: 6 },
  { coins: [2, 2, 3], total: 7 },
  { coins: [2, 3, 3], total: 8 },
  { coins: [3, 3, 3], total: 9 },
  { coins: [2, 2, 3], total: 7 },
  { coins: [2, 3, 3], total: 8 },
] as const;

test('六爻四类起卦来源都应只凭可信原始输入重建完整卦盘', () => {
  const cases = [
    generateLiuyao(fixedDate, { method: 'time' }),
    generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos }),
    generateLiuyao(fixedDate, { method: 'coins', coinThrows: fixedCoinThrows }),
    generateLiuyao(fixedDate, { method: 'coins', seed: '六爻审核重建' }),
  ];

  for (const data of cases) {
    assert.deepEqual(rebuildAuditedLiuyaoData(data), data);
    assert.deepEqual(analyzeLiuyaoEvidence(data), data.evidenceAnalysis);
  }
});

test('六爻审核重建不得吸收旧卦盘、纳甲旺衰、组合或完整证据污染', () => {
  const clean = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const polluted = structuredClone(clean);
  polluted.originalName = '伪造主卦';
  polluted.changedName = '伪造变卦';
  polluted.interName = '伪造互卦';
  polluted.ganzhi = { year: '伪造', month: '伪造', day: '伪造', hour: '伪造' };
  polluted.changingYaos = [{ position: 1, isChanging: true, type: '伪造动爻' }];
  polluted.sixGods = ['伪造六神'];
  polluted.sixRelatives = ['伪造六亲'];
  polluted.najiaDizhi = ['伪造纳甲'];
  polluted.voidBranches = ['伪'];
  polluted.palace = { name: '伪造宫', wuxing: '伪造五行' };
  polluted.yaosDetail[0] = {
    ...polluted.yaosDetail[0],
    sixGod: '伪造六神',
    sixRelative: '伪造六亲',
    najiaDizhi: '伪造纳甲',
    isWorld: false,
    isResponse: true,
    isVoid: true,
    seasonState: '伪造旺衰',
  };
  polluted.hiddenSpirits = [];
  polluted.sanheFormations = [];
  polluted.sanxingInYaos = [];
  polluted.specialAdvice = '伪造现实结论';
  polluted.evidenceAnalysis!.promptText = '伪造完整旧证据';

  assert.deepEqual(rebuildAuditedLiuyaoData(polluted), clean);
  assert.deepEqual(analyzeLiuyaoEvidence(polluted), clean.evidenceAnalysis);
});

test('六爻审核重建应拒绝缺失、夹带或互相矛盾的原始起卦资料', () => {
  const manual = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const provided = generateLiuyao(fixedDate, {
    method: 'coins',
    coinThrows: fixedCoinThrows,
  });
  const random = generateLiuyao(fixedDate, { method: 'coins', seed: '六爻轨迹核验' });
  const time = generateLiuyao(fixedDate, { method: 'time' });

  assert.throws(() => rebuildAuditedLiuyaoData(null as unknown as typeof manual), /结果必须是对象/);
  assert.throws(() => rebuildAuditedLiuyaoData({ ...manual, timestamp: Number.NaN }), /时间戳无效/);
  assert.throws(
    () => rebuildAuditedLiuyaoData({ ...manual, generation: undefined }),
    /未知的六爻起卦方式/,
  );
  assert.throws(
    () =>
      rebuildAuditedLiuyaoData({
        ...manual,
        generation: { ...manual.generation!, source: 'provided-coin-throws' },
      }),
    /起卦方式与原始来源矛盾/,
  );
  assert.throws(
    () =>
      rebuildAuditedLiuyaoData({
        ...manual,
        meta: { ...manual.meta!, random: random.meta!.random },
      }),
    /手工起卦不应携带随机轨迹/,
  );
  assert.throws(
    () =>
      rebuildAuditedLiuyaoData({
        ...provided,
        generation: { ...provided.generation!, coinThrows: undefined },
      }),
    /缺少六组原始铜钱记录/,
  );
  assert.throws(
    () =>
      rebuildAuditedLiuyaoData({
        ...provided,
        meta: { ...provided.meta!, random: random.meta!.random },
      }),
    /实投三钱记录不应携带随机轨迹/,
  );

  const missingSource = structuredClone(random);
  delete missingSource.generation!.source;
  assert.throws(() => rebuildAuditedLiuyaoData(missingSource), /缺少可核验的原始来源/);

  const missingTrace = structuredClone(random);
  delete missingTrace.meta!.random;
  assert.throws(() => rebuildAuditedLiuyaoData(missingTrace), /缺少原始随机轨迹/);

  const extraSamples = structuredClone(random);
  extraSamples.meta!.random!.samples.push(0.25);
  assert.throws(() => rebuildAuditedLiuyaoData(extraSamples), /应记录18个原始随机样本/);

  const missingSeed = structuredClone(random);
  delete missingSeed.meta!.random!.seed;
  assert.throws(() => rebuildAuditedLiuyaoData(missingSeed), /seeded 随机轨迹缺少种子/);

  const seedMismatch = structuredClone(random);
  seedMismatch.meta!.random!.samples[0] =
    seedMismatch.meta!.random!.samples[0] === 0.25 ? 0.5 : 0.25;
  assert.throws(() => rebuildAuditedLiuyaoData(seedMismatch), /与保存的种子不一致/);

  const timeTraceMismatch = structuredClone(time);
  timeTraceMismatch.meta!.random!.samples[0] =
    timeTraceMismatch.meta!.random!.samples[0] === 0.25 ? 0.5 : 0.25;
  assert.throws(() => rebuildAuditedLiuyaoData(timeTraceMismatch), /与起卦时间不一致/);
});

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
  assert.equal(evidence.godInteractionFacts.length, 0);
  assert.equal(evidence.godInteractionAssessmentFact.status, '资料不足');
  assert.equal(evidence.godInteractionAssessmentFact.balanceStatus, '用神未定');
  assert.deepEqual(evidence.godInteractionAssessmentFact.supportingFactKeys, []);
  assert.deepEqual(evidence.godInteractionAssessmentFact.restrainingFactKeys, []);
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
  assert.equal(incomplete.lineCoverageFact.status, '完整');
  assert.deepEqual(incomplete.lineCoverageFact.missingPositions, []);
  assert.deepEqual(incomplete.lineFacts, evidence.lineFacts);
  assert.deepEqual(incomplete.hiddenSpiritFacts, evidence.hiddenSpiritFacts);
  assert.equal(incomplete.summaryFact.status, evidence.summaryFact.status);
  assert.equal(
    incomplete.calculationSteps.find((item) => item.stage === '六爻逐爻计算')?.status,
    '已计算',
  );
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
    generateLiuyao(new Date('2024-02-05T12:00:00+08:00'), {
      method: 'manual',
      yaos: [8, 7, 7, 7, 7, 7],
    }),
    { usefulGodRelative: '妻财' },
  );
  const calendarPair = analyzeLiuyaoEvidence(
    generateLiuyao(new Date('2024-02-09T12:00:00+08:00'), {
      method: 'manual',
      yaos: [8, 7, 7, 7, 7, 7],
    }),
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
  assert.deepEqual(
    calendarPair.godInteractionFacts.map((item) => [item.kind, item.referenceKeys]),
    [
      ['月日直接入用', ['liuyao:reference:calendar:月建']],
      ['月日直接入用', ['liuyao:reference:calendar:日辰']],
    ],
  );
  assert.equal(calendarPair.godInteractionAssessmentFact.status, '待综合判断');
  assert.equal(calendarPair.godInteractionAssessmentFact.balanceStatus, '月日直接入用');

  assert.equal(hidden.selectionFact.matchingTier, '伏神检索');
  assert.equal(hidden.selectionFact.selectedReferenceKey, 'liuyao:reference:hidden:2:妻财');
  assert.deepEqual(
    hidden.candidates[0].references.map((item) => item.source),
    ['伏神'],
  );

  assert.deepEqual(missing.selectionFact, hidden.selectionFact);
  assert.deepEqual(missing.selectedCandidate, hidden.selectedCandidate);
  assert.deepEqual(missing.godChain, hidden.godChain);
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
  assert.equal(staticLines.godInteractionFacts.length, 0);

  assert.equal(soleMoving.selectionFact.status, '已选定候选');
  assert.equal(soleMoving.selectionFact.selectedReferenceKey, 'liuyao:reference:line:3');
  assert.deepEqual(soleMoving.godChain.find((item) => item.role === '用神')?.referenceKeys, [
    'liuyao:reference:line:3',
  ]);

  assert.equal(bothMoving.selectionFact.status, '用神爻位待择');
  assert.equal(bothMoving.selectionFact.selectedReferenceKey, null);
  assert.equal(bothMoving.godInteractionFacts.length, 0);
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

test('六爻生克制化应登记碎金赋四类闭合路径并允许并见', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 6],
  });
  const evidence = analyzeLiuyaoEvidence(data, { usefulGodRelative: '父母' });
  const findPath = (kind: string, referenceKeys: string[]) =>
    evidence.godInteractionFacts.find(
      (item) => item.kind === kind && item.referenceKeys.join('|') === referenceKeys.join('|'),
    );

  const sourceControlled = findPath('克制原神', [
    'liuyao:reference:line:6',
    'liuyao:reference:line:3',
    'liuyao:reference:line:2',
  ]);
  const tabooControlled = findPath('克制忌神', [
    'liuyao:reference:line:1',
    'liuyao:reference:line:5',
    'liuyao:reference:line:2',
  ]);
  const continuousGeneration = findPath('忌原接续相生', [
    'liuyao:reference:line:5',
    'liuyao:reference:line:3',
    'liuyao:reference:line:2',
  ]);
  const tabooSupported = findPath('生扶忌神', [
    'liuyao:reference:line:6',
    'liuyao:reference:line:5',
    'liuyao:reference:line:2',
  ]);

  assert.deepEqual(
    sourceControlled?.path.map((item) => [item.role, item.relationToNext]),
    [
      ['仇神', '克'],
      ['原神', '生'],
      ['用神', null],
    ],
  );
  assert.deepEqual(
    tabooControlled?.path.map((item) => [item.role, item.relationToNext]),
    [
      ['用神所生', '克'],
      ['忌神', '克'],
      ['用神', null],
    ],
  );
  assert.deepEqual(
    continuousGeneration?.path.map((item) => [item.role, item.relationToNext]),
    [
      ['忌神', '生'],
      ['原神', '生'],
      ['用神', null],
    ],
  );
  assert.deepEqual(
    tabooSupported?.path.map((item) => [item.role, item.relationToNext]),
    [
      ['仇神', '生'],
      ['忌神', '克'],
      ['用神', null],
    ],
  );
  assert.ok(
    ['直接生扶用神', '直接克制用神', '忌原接续相生', '生扶忌神', '克制忌神'].every((kind) =>
      evidence.godInteractionFacts.some((item) => item.kind === kind),
    ),
  );
  const assessment = evidence.godInteractionAssessmentFact;
  assert.equal(assessment.status, '待综合判断');
  assert.equal(assessment.balanceStatus, '生扶克制并见');
  assert.ok(
    assessment.supportingFactKeys.every((key) =>
      evidence.godInteractionFacts.some((item) => item.key === key),
    ),
  );
  assert.ok(
    assessment.restrainingFactKeys.every((key) =>
      evidence.godInteractionFacts.some((item) => item.key === key),
    ),
  );
  assert.ok(assessment.transformationFactKeys.includes(continuousGeneration?.key ?? ''));
  assert.ok(assessment.unresolvedFactKeys.length > 0);
  assert.match(assessment.promptText, /可用性待综合判断/);
  assert.match(assessment.promptText, /须先逐项消解/);
  assert.equal(evidence.summaryFact.godInteractionFactCount, evidence.godInteractionFacts.length);
  assert.match(evidence.promptText, /生克制化路径/);
  assert.match(evidence.promptText, /全局生克作用态/);
  assert.match(evidence.promptText, /忌原接续相生/);
  assert.ok(
    evidence.limitationFacts
      .find((item) => item.key === 'liuyao:limitation:candidates-god-chain')
      ?.ownerFactKeys.includes(continuousGeneration?.key ?? ''),
  );
  assert.doesNotMatch(
    JSON.stringify([evidence.godInteractionFacts, assessment]),
    /score|weight|rating|probability|总分|概率|最终吉凶|最终强弱[^、或]/i,
  );
});

test('六爻全局作用态应分类生扶克制并明确保留可用性待综合', () => {
  const analyze = (date: string, yaos: number[], usefulGodRelative: string) =>
    analyzeLiuyaoEvidence(generateLiuyao(new Date(date), { method: 'manual', yaos }), {
      usefulGodRelative,
    });
  const sameMonthDay = '2024-01-01T12:00:00+08:00';
  const noPath = analyze(sameMonthDay, [7, 7, 7, 7, 7, 7], '兄弟');
  const mixed = analyze(sameMonthDay, [7, 7, 7, 7, 7, 7], '官鬼');
  const supportOnly = analyze(sameMonthDay, [7, 7, 7, 7, 7, 7], '妻财');
  const restraintOnly = analyze('2024-12-07T12:00:00+08:00', [7, 7, 7, 7, 7, 7], '兄弟');
  const calendarIngress = analyze('2024-01-03T12:00:00+08:00', [8, 7, 7, 7, 7, 7], '妻财');

  assert.deepEqual(
    [noPath, mixed, supportOnly, restraintOnly, calendarIngress].map(
      (item) => item.godInteractionAssessmentFact.balanceStatus,
    ),
    ['未见生克路径', '生扶克制并见', '仅见生扶路径', '仅见克制路径', '月日直接入用'],
  );
  assert.ok(
    [noPath, mixed, supportOnly, restraintOnly, calendarIngress].every(
      (item) => item.godInteractionAssessmentFact.status === '待综合判断',
    ),
  );
  assert.deepEqual(noPath.godInteractionAssessmentFact.supportingFactKeys, []);
  assert.deepEqual(noPath.godInteractionAssessmentFact.restrainingFactKeys, []);
  assert.ok(mixed.godInteractionAssessmentFact.supportingFactKeys.length > 0);
  assert.ok(mixed.godInteractionAssessmentFact.restrainingFactKeys.length > 0);
  assert.ok(supportOnly.godInteractionAssessmentFact.supportingFactKeys.length > 0);
  assert.deepEqual(supportOnly.godInteractionAssessmentFact.restrainingFactKeys, []);
  assert.deepEqual(restraintOnly.godInteractionAssessmentFact.supportingFactKeys, []);
  assert.ok(restraintOnly.godInteractionAssessmentFact.restrainingFactKeys.length > 0);
  assert.ok(calendarIngress.godInteractionFacts.every((item) => item.kind === '月日直接入用'));
});

test('六爻生克制化路径应覆盖月日、明暗动、旺相静爻、本位变爻与伏神来源', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const allMoving = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] }),
    { usefulGodRelative: '父母' },
  );
  const hiddenMove = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [7, 6, 6, 6, 6, 6] }),
    { usefulGodRelative: '官鬼' },
  );
  const strongStatic = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [7, 7, 6, 6, 6, 6] }),
    { usefulGodRelative: '父母' },
  );
  const hiddenSpirit = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [8, 6, 7, 6, 6, 6] }),
    { usefulGodRelative: '妻财' },
  );
  const activities = new Set(
    [allMoving, hiddenMove, strongStatic, hiddenSpirit].flatMap((item) =>
      item.godInteractionFacts.flatMap((fact) => fact.path.map((step) => step.activity)),
    ),
  );

  assert.deepEqual(
    [...activities].sort(),
    ['伏藏待透', '明动', '暗动', '月日直接作用', '本位变爻待验', '静爻'].sort(),
  );
  assert.ok(
    strongStatic.godInteractionFacts.some((item) =>
      item.conditions.includes('第2爻旺相静爻生本爻'),
    ),
  );
  assert.ok(
    hiddenSpirit.godInteractionFacts.some(
      (item) =>
        item.targetReferenceKey === 'liuyao:reference:hidden:2:妻财' &&
        item.conditions.includes('月建生伏神'),
    ),
  );
  assert.ok(
    hiddenSpirit.godInteractionFacts.some(
      (item) =>
        item.kind === '直接克制用神' &&
        item.referenceKeys.join('|') === 'liuyao:reference:line:6|liuyao:reference:hidden:2:妻财' &&
        item.conditions.includes('第6爻明动克伏神'),
    ),
  );
});

test('六爻变爻只受月日或本位动爻路径，不跨位接受其他爻作用', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const selectedChanged = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [6, 8, 7, 7, 7, 7] }),
    { usefulGodRelative: '妻财' },
  );
  const allMoving = analyzeLiuyaoEvidence(
    generateLiuyao(date, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] }),
    { usefulGodRelative: '父母' },
  );

  assert.ok(
    selectedChanged.godInteractionFacts.every(
      (item) =>
        item.targetReferenceKey === 'liuyao:reference:changed:1' &&
        item.path.length === 2 &&
        item.path[0].activity === '月日直接作用',
    ),
  );
  for (const fact of allMoving.godInteractionFacts) {
    fact.path.forEach((step, index) => {
      if (step.activity !== '本位变爻待验') return;
      const changedPosition = step.referenceKey.match(/changed:(\d+)$/)?.[1];
      const nextPosition = fact.path[index + 1]?.referenceKey.match(/line:(\d+)$/)?.[1];
      assert.equal(nextPosition, changedPosition);
    });
  }
});

test('六爻生克制化路径应从原始盘面重算并忽略旧派生字段', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 8, 7, 6, 7, 8],
  });
  const current = analyzeLiuyaoEvidence(data, { usefulGodRelative: '子孙' });
  const tampered = analyzeLiuyaoEvidence(
    {
      ...data,
      yaosDetail: data.yaosDetail.map((item) => ({
        ...item,
        seasonState: '旺',
        isHiddenMove: !item.isHiddenMove,
        isDayBreak: !item.isDayBreak,
        strengthAnalysis: item.strengthAnalysis
          ? {
              ...item.strengthAnalysis,
              support: ['伪造支持条件'],
              constraints: ['伪造限制条件'],
              lineSupport: ['第6爻明动生本爻'],
              lineConstraints: ['第1爻明动克本爻'],
            }
          : undefined,
      })),
      evidenceAnalysis: undefined,
    },
    { usefulGodRelative: '子孙' },
  );

  assert.deepEqual(tampered.godInteractionFacts, current.godInteractionFacts);
  assert.deepEqual(tampered.godInteractionAssessmentFact, current.godInteractionAssessmentFact);
  assert.doesNotMatch(JSON.stringify(tampered.godInteractionFacts), /伪造支持|伪造限制/);
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
  const data = generateLiuyao(new Date('2024-11-08T12:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 6, 6, 6, 6],
  });
  const evidence = analyzeLiuyaoEvidence(data, { usefulGodRelative: '父母' });
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

test('六爻结构事实应重新计算动静与三合并忽略旧派生字段', () => {
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
    specialAdvice: '伪造的旧说明',
    isChaotic: true,
    chaoticReason: '伪造的乱动结论',
    activityPattern: {
      kind: '全动卦',
      movingCount: 6,
      movingPositions: [1, 2, 3, 4, 5, 6],
      stillPositions: [],
      guidance: '伪造的新派生说明',
    },
    sanheWithDay: {
      group: '申子辰水局',
      members: ['申', '子', '辰'],
      description: '动变支与日支组成申子辰三合',
    },
    evidenceAnalysis: undefined,
  });

  assert.deepEqual(
    new Set(evidence.structureFacts.map((item) => item.kind)),
    new Set(['整卦六合六冲', '动静结构', '月卦身', '卦内三合']),
  );
  const activityFact = evidence.structureFacts.find((item) => item.kind === '动静结构');
  assert.equal(activityFact?.activityPattern, '多爻发动');
  assert.equal(activityFact?.movingCount, 2);
  assert.deepEqual(activityFact?.movingPositions, [3, 4]);
  assert.doesNotMatch(evidence.promptText, /伪造的旧说明|伪造的乱动结论|伪造的新派生说明/);
  assert.doesNotMatch(evidence.promptText, /动变支与日支组成申子辰三合/);
  assert.doesNotMatch(evidence.promptText, /内卦反吟|内卦主变地支相冲/);
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
  assert.ok(evidence.timingFacts.every((item) => item.type !== '反吟伏吟节奏'));
});

test('六爻证据应从主变卦与原始爻值重算反吟伏吟', () => {
  const data = generateLiuyao(fixedDate, {
    method: 'manual',
    yaos: [9, 7, 7, 9, 7, 7],
  });
  assert.equal(data.originalName, '乾为天');
  assert.equal(data.changedName, '巽为风');
  const evidence = analyzeLiuyaoEvidence({
    ...data,
    changingYaos: [],
    fanfuRelations: {
      fanyin: [],
      fuyin: [
        {
          kind: '伏吟',
          scope: '内卦',
          label: '伪造伏吟',
          description: '伪造的反吟伏吟说明',
        },
      ],
      labels: ['伪造伏吟'],
    },
    evidenceAnalysis: undefined,
  });
  const fanfuFacts = evidence.structureFacts.filter((item) => item.kind === '反吟伏吟');

  assert.equal(fanfuFacts.length, 1);
  assert.match(fanfuFacts[0].originalText, /内外反吟/);
  assert.match(fanfuFacts[0].originalText, /内卦乾变巽，外卦乾变巽/);
  assert.doesNotMatch(evidence.promptText, /伪造伏吟|伪造的反吟伏吟说明/);
  assert.ok(evidence.timingFacts.some((item) => item.type === '反吟伏吟节奏'));
});

test('六爻证据应从日干与本卦重算六神、月卦身并忽略伪造派生字段', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: [7, 7, 8, 8, 8, 8] });
  assert.equal(data.originalName, '地泽临');
  const current = analyzeLiuyaoEvidence({ ...data, evidenceAnalysis: undefined });
  const tampered = analyzeLiuyaoEvidence({
    ...data,
    sixGods: Array.from({ length: 6 }, () => '伪造六神'),
    guaShen: {
      branch: '伪',
      status: '入卦',
      matches: [{ position: 1, sixRelative: '伪造六亲' }],
      position: 1,
      sixRelative: '伪造六亲',
    },
    yaosDetail: data.yaosDetail.map((item) => ({ ...item, sixGod: '伪造六神' })),
    evidenceAnalysis: undefined,
  });

  assert.deepEqual(
    tampered.lineFacts.map((item) => item.sixGod),
    current.lineFacts.map((item) => item.sixGod),
  );
  const currentGuaShen = current.structureFacts.find((item) => item.kind === '月卦身');
  const tamperedGuaShen = tampered.structureFacts.find((item) => item.kind === '月卦身');
  assert.deepEqual(tamperedGuaShen, currentGuaShen);
  assert.equal(tamperedGuaShen?.guaShenBranch, '丑');
  assert.equal(tamperedGuaShen?.guaShenStatus, '入卦');
  assert.deepEqual(tamperedGuaShen?.guaShenPositions, [3, 4]);
  assert.doesNotMatch(tampered.promptText, /伪造六神|伪造六亲|月卦身为伪/);
});

test('六爻结构事实应重算三刑、回指参与爻并忽略旧派生字段', () => {
  const movingData = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 8, 7, 8, 8, 7],
  });
  const forgedSanxing: NonNullable<typeof movingData.sanxingInYaos>[number] = {
    key: 'liuyao:sanxing:伪造',
    type: '伪造恃势之刑',
    branches: ['丑', '戌'],
    pattern: '三支齐备',
    status: '作用待辨',
    participants: [],
    activePositions: [],
    description: '伪造纠缠、对立或反复',
  };
  const current = analyzeLiuyaoEvidence(
    { ...movingData, evidenceAnalysis: undefined },
    { usefulGodRelative: '官鬼' },
  );
  const tampered = analyzeLiuyaoEvidence(
    {
      ...movingData,
      sanxingInYaos: [forgedSanxing],
      evidenceAnalysis: undefined,
    },
    { usefulGodRelative: '官鬼' },
  );
  const sanxingFact = current.structureFacts.find((item) => item.kind === '卦内三刑');

  assert.deepEqual(tampered.structureFacts, current.structureFacts);
  assert.deepEqual(sanxingFact?.referenceKeys, [
    'liuyao:reference:line:5',
    'liuyao:reference:line:1',
  ]);
  assert.match(sanxingFact?.originalText ?? '', /关系涉及当前用神、世爻/);
  assert.match(sanxingFact?.originalText ?? '', /完整|三支不全|发动条件不足/);
  assert.doesNotMatch(tampered.promptText, /伪造|纠缠、对立或反复/);

  const staticData = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [8, 7, 8, 7, 8, 8],
  });
  const staticEvidence = analyzeLiuyaoEvidence({
    ...staticData,
    sanxingInYaos: [forgedSanxing],
    evidenceAnalysis: undefined,
  });
  assert.ok(!staticEvidence.structureFacts.some((item) => item.kind === '卦内三刑'));
});

test('鬼神怪异主题必须保留现实解释限制', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
  const evidence = analyzeLiuyaoEvidence(data, { topic: 'guaishen' });

  assert.equal(evidence.candidates[0].relative, '官鬼');
  assert.match(evidence.promptText, /不能据此证明超自然原因/);
  assert.match(evidence.promptText, /不得仅凭官鬼、白虎、螣蛇/);
});
