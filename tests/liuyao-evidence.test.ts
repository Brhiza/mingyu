import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateLiuyao,
  analyzeLiuyaoEvidence,
} from '../packages/core/src/divination/algorithms/liuyao.ts';
import { isKe, isSheng } from 'mingyu-core/ganzhi';
import { TimeManager } from '../packages/core/src/calendar/timeManager.ts';
import { getDivinationSummaryBlocks } from '../packages/core/src/prompt/divination.ts';
import {
  buildTimeInfoText,
  buildSolarTimeInfoText,
} from '../packages/core/src/prompt/formatters.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail.ts';
import { formatLiuyaoSanxing } from '../packages/core/src/prompt/liuyao-facts.ts';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');
const fixedYaos = [7, 8, 9, 6, 7, 8] as const;
const fixedManualChart = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
const cloneFixedManualChart = () => structuredClone(fixedManualChart);

let fixedHiddenSpiritChart: ReturnType<typeof generateLiuyao> | undefined;
const cloneFixedHiddenSpiritChart = () =>
  structuredClone(
    (fixedHiddenSpiritChart ??= generateLiuyao(fixedDate, {
      method: 'manual',
      yaos: [7, 8, 8, 8, 7, 8],
    })),
  );

let fixedChangedVoidChart: ReturnType<typeof generateLiuyao> | undefined;
const cloneFixedChangedVoidChart = () =>
  structuredClone(
    (fixedChangedVoidChart ??= generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
      method: 'manual',
      yaos: [6, 6, 6, 6, 6, 6],
    })),
  );

let fixedFanyinChart: ReturnType<typeof generateLiuyao> | undefined;
const cloneFixedFanyinChart = () =>
  structuredClone(
    (fixedFanyinChart ??= generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
      method: 'manual',
      yaos: [9, 7, 7, 9, 7, 7],
    })),
  );

let fixedStaticQianChart: ReturnType<typeof generateLiuyao> | undefined;
const cloneFixedStaticQianChart = () =>
  structuredClone(
    (fixedStaticQianChart ??= generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
      method: 'manual',
      yaos: [7, 7, 7, 7, 7, 7],
    })),
  );

let fixedSanheChart: ReturnType<typeof generateLiuyao> | undefined;
const cloneFixedSanheChart = () =>
  structuredClone(
    (fixedSanheChart ??= generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
      method: 'manual',
      yaos: [7, 6, 7, 7, 7, 6],
    })),
  );

test('六爻证据与提示词拒绝和结果元数据不一致的起卦时间戳', () => {
  const source = cloneFixedManualChart();
  assert.equal(Date.parse(source.meta!.calculatedAt), source.timestamp);

  const stale = structuredClone(source);
  stale.timestamp += 24 * 60 * 60 * 1000;

  assert.throws(() => analyzeLiuyaoEvidence(stale), /起卦时间戳与结果元数据不一致/u);
  assert.throws(
    () => formatEnhancedDivinationInfo('liuyao', stale),
    /起卦时间戳与结果元数据不一致/u,
  );
});

test('六爻提示词先按原始爻值核对主卦、互卦与变卦', () => {
  const source = cloneFixedManualChart();
  const oldResult = structuredClone(source);
  delete oldResult.changedName;
  delete oldResult.interName;

  const snapshot = structuredClone(oldResult);
  assert.deepEqual(analyzeLiuyaoEvidence(oldResult), analyzeLiuyaoEvidence(source));
  assert.equal(
    formatEnhancedDivinationInfo('liuyao', oldResult),
    formatEnhancedDivinationInfo('liuyao', source),
  );
  assert.deepEqual(
    getDivinationSummaryBlocks('liuyao', oldResult),
    getDivinationSummaryBlocks('liuyao', source),
  );
  assert.deepEqual(oldResult, snapshot);

  for (const field of ['originalName', 'interName', 'changedName'] as const) {
    const changed = structuredClone(source);
    changed[field] = changed[field] === '乾为天' ? '坤为地' : '乾为天';
    assert.throws(
      () => analyzeLiuyaoEvidence(changed),
      /主卦、互卦或变卦与原始爻值不一致/u,
      `${field} 与原始爻值不一致时应拒绝生成证据`,
    );
    assert.throws(
      () => formatEnhancedDivinationInfo('liuyao', changed),
      /主卦、互卦或变卦与原始爻值不一致/u,
    );
    assert.throws(
      () => getDivinationSummaryBlocks('liuyao', changed),
      /主卦、互卦或变卦与原始爻值不一致/u,
    );
  }
});

test('六爻提示词核对日干起六神与逐爻六神', () => {
  const source = cloneFixedManualChart();
  const oldResult = structuredClone(source);
  Reflect.deleteProperty(oldResult, 'sixGods');

  const snapshot = structuredClone(oldResult);
  assert.deepEqual(analyzeLiuyaoEvidence(oldResult), analyzeLiuyaoEvidence(source));
  assert.equal(
    formatEnhancedDivinationInfo('liuyao', oldResult),
    formatEnhancedDivinationInfo('liuyao', source),
  );
  assert.deepEqual(
    getDivinationSummaryBlocks('liuyao', oldResult),
    getDivinationSummaryBlocks('liuyao', source),
  );
  assert.deepEqual(oldResult, snapshot);

  const changedList = structuredClone(source);
  changedList.sixGods[0] = source.sixGods[0] === '玄武' ? '青龙' : '玄武';
  assert.throws(() => analyzeLiuyaoEvidence(changedList), /六神顺序与日干不一致/u);
  assert.throws(() => formatEnhancedDivinationInfo('liuyao', changedList), /六神顺序与日干不一致/u);
  assert.throws(() => getDivinationSummaryBlocks('liuyao', changedList), /六神顺序与日干不一致/u);

  const changedLine = structuredClone(source);
  changedLine.yaosDetail[0].sixGod = source.yaosDetail[0].sixGod === '玄武' ? '青龙' : '玄武';
  assert.throws(
    () => formatDetailedDivinationInfo('liuyao', changedLine),
    /纳甲、世应、动变或月日空破与盘面不一致/u,
  );
});

test('六爻证据拒绝被改写的本爻六亲、动变关系和进退神', () => {
  const source = cloneFixedManualChart();
  const mutations: Array<(data: typeof source) => void> = [
    (data) => {
      data.yaosDetail[2].sixRelative = '妻财';
    },
    (data) => {
      data.yaosDetail[2].changeRelations = ['回头生'];
    },
    (data) => {
      data.yaosDetail[2].changeDirection = '化进神';
    },
  ];

  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(
      () => analyzeLiuyaoEvidence(changed),
      /纳甲、世应、动变或月日空破与盘面不一致/u,
      `第 ${index + 1} 个六亲或动变事实错位样本应被拒绝`,
    );
    assert.throws(
      () => formatEnhancedDivinationInfo('liuyao', changed),
      /纳甲、世应、动变或月日空破与盘面不一致/u,
    );
  }
});

test('六爻旧盘伏神须与本宫首卦纳甲、六亲差集、旬空及飞伏作用一致', () => {
  const source = cloneFixedHiddenSpiritChart();
  assert.equal(source.hiddenSpirits?.length, 1);
  const oldResult = structuredClone(source);
  delete oldResult.hiddenSpirits![0].interactionEffect;

  const snapshot = structuredClone(oldResult);
  assert.deepEqual(analyzeLiuyaoEvidence(oldResult), analyzeLiuyaoEvidence(source));
  assert.equal(
    formatEnhancedDivinationInfo('liuyao', oldResult),
    formatEnhancedDivinationInfo('liuyao', source),
  );
  assert.deepEqual(
    getDivinationSummaryBlocks('liuyao', oldResult),
    getDivinationSummaryBlocks('liuyao', source),
  );
  assert.deepEqual(oldResult, snapshot);

  const mutations: Array<(data: typeof source) => void> = [
    (data) => {
      data.hiddenSpirits![0].najiaDizhi = '子';
    },
    (data) => {
      data.hiddenSpirits![0].isVoid = !data.hiddenSpirits![0].isVoid;
    },
    (data) => {
      data.hiddenSpirits![0].underYao.position = 2;
    },
    (data) => {
      data.hiddenSpirits![0].interactionEffect = '飞神月破，覆盖力减弱';
    },
    (data) => {
      data.hiddenSpirits = [];
    },
  ];

  for (const mutate of mutations) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(() => analyzeLiuyaoEvidence(changed), /伏神与本宫首卦纳甲不一致/u);
    assert.throws(() => getDivinationSummaryBlocks('liuyao', changed), /伏神与本宫首卦纳甲不一致/u);
    assert.throws(
      () => formatEnhancedDivinationInfo('liuyao', changed),
      /伏神与本宫首卦纳甲不一致/u,
    );
  }
});

test('六爻证据与提示词拒绝可复算的纳甲世应、动变和月日空破错位', () => {
  const source = cloneFixedManualChart();
  const mutations: Array<(data: typeof source) => void> = [
    (data) => {
      data.voidBranches = ['子'];
    },
    (data) => {
      data.yaosDetail[0].najiaDizhi = data.yaosDetail[0].najiaDizhi === '子' ? '丑' : '子';
    },
    (data) => {
      data.yaosDetail[0].wuxing = data.yaosDetail[0].wuxing === '木' ? '火' : '木';
    },
    (data) => {
      data.yaosDetail[0].isWorld = !data.yaosDetail[0].isWorld;
    },
    (data) => {
      data.yaosDetail[0].seasonState = data.yaosDetail[0].seasonState === '旺' ? '死' : '旺';
    },
    (data) => {
      data.yaosDetail[0].isMonthBreak = !data.yaosDetail[0].isMonthBreak;
    },
    (data) => {
      data.yaosDetail[2].changedYao!.dizhi =
        data.yaosDetail[2].changedYao!.dizhi === '子' ? '丑' : '子';
    },
    (data) => {
      data.yaosDetail[2].rawValue = 7;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(
      () => analyzeLiuyaoEvidence(changed),
      /日柱旬空与盘面不一致|纳甲、世应、动变或月日空破与盘面不一致/,
      `第 ${index + 1} 个错盘样本应被拒绝`,
    );
  }
  const wrongMonth = structuredClone(source);
  wrongMonth.yaosDetail[0].seasonState = source.yaosDetail[0].seasonState === '旺' ? '死' : '旺';
  assert.throws(
    () => formatEnhancedDivinationInfo('liuyao', wrongMonth),
    /纳甲、世应、动变或月日空破与盘面不一致/,
  );
});

test('六爻旧盘缺少变卦别名时仍核验变爻六亲', () => {
  const data = cloneFixedManualChart();
  data.changedName = undefined;
  const changingYao = data.yaosDetail.find((yao) => yao.isChanging)!;
  changingYao.changedYao!.liuqin = changingYao.changedYao!.liuqin === '父母' ? '兄弟' : '父母';

  assert.throws(() => analyzeLiuyaoEvidence(data), /纳甲、世应、动变或月日空破与盘面不一致/u);
  assert.throws(
    () => formatEnhancedDivinationInfo('liuyao', data),
    /纳甲、世应、动变或月日空破与盘面不一致/u,
  );
});

test('六爻动爻清单须与原始爻值的动静及阴阳一致', () => {
  const source = cloneFixedManualChart();
  const wrongMotion = structuredClone(source);
  wrongMotion.changingYaos[0].isChanging = false;
  wrongMotion.evidenceAnalysis = undefined;
  assert.throws(() => analyzeLiuyaoEvidence(wrongMotion), /动爻位置、阴阳或动静记录不一致/u);
  assert.throws(
    () => formatEnhancedDivinationInfo('liuyao', wrongMotion),
    /动爻位置、阴阳或动静记录不一致/u,
  );

  const wrongType = structuredClone(source);
  wrongType.changingYaos[0].type = wrongType.changingYaos[0].type === '老阴' ? '老阳' : '老阴';
  wrongType.evidenceAnalysis = undefined;
  assert.throws(() => analyzeLiuyaoEvidence(wrongType), /动爻位置、阴阳或动静记录不一致/u);
});

test('六爻三钱来源须同时吻合铜钱合计与原始爻值', () => {
  const coinThrows = Array.from({ length: 6 }, () => ({
    coins: [2, 2, 3] as const,
    total: 7 as const,
  }));
  const data = generateLiuyao(fixedDate, { method: 'coins', coinThrows });
  assert.equal(data.evidenceAnalysis?.generationFact.status, '可核验');
  assert.equal(data.evidenceAnalysis?.summaryFact.status, '待按问题取用');

  const wrongTotal = {
    ...data,
    generation: {
      ...data.generation!,
      coinThrows: [{ coins: [2, 2, 3] as const, total: 8 as const }, ...coinThrows.slice(1)],
    },
  };
  assert.throws(() => analyzeLiuyaoEvidence(wrongTotal), /第1爻三钱记录与原始爻值不一致/u);

  const wrongCoins = {
    ...data,
    generation: {
      ...data.generation!,
      coinThrows: [{ coins: [2, 3, 3] as const, total: 7 as const }, ...coinThrows.slice(1)],
    },
  };
  assert.throws(() => analyzeLiuyaoEvidence(wrongCoins), /第1爻三钱记录与原始爻值不一致/u);
  const skippedRecord = structuredClone(data);
  delete skippedRecord.generation!.coinThrows![1];
  const before = structuredClone(skippedRecord);
  for (const consume of [
    () => analyzeLiuyaoEvidence(skippedRecord),
    () => formatEnhancedDivinationInfo('liuyao', skippedRecord),
    () => getDivinationSummaryBlocks('liuyao', skippedRecord),
  ]) {
    assert.throws(consume, /第2爻三钱记录必须包含三枚有效铜钱/u);
    assert.deepEqual(skippedRecord, before);
  }
  const unrecorded = structuredClone(data);
  delete unrecorded.generation!.coinThrows;
  const unrecordedFact = analyzeLiuyaoEvidence(unrecorded).generationFact;
  assert.equal(unrecordedFact.status, '来源链缺失');
  assert.equal(unrecordedFact.recordedLineCount, 0);
});

test('六爻动墓和化墓不归入日辰关系', () => {
  const date = new Date('2025-01-01T00:00:00+08:00');
  const cases = [
    { yaos: [7, 6, 7, 7, 7, 6], relation: '入动墓' },
    { yaos: [7, 7, 6, 6, 6, 6], relation: '动而化墓' },
  ];
  for (const { yaos, relation } of cases) {
    const data = generateLiuyao(date, { method: 'manual', yaos });
    const line = analyzeLiuyaoEvidence(data).lineFacts.find((item) =>
      item.promptText.includes(relation),
    );
    assert.ok(line);
    assert.doesNotMatch(line.dayState.relations.join('、'), /入动墓|动而化墓/u);
    assert.match(line.promptText, new RegExp(relation, 'u'));
  }
});

test('六爻旧盘缺少伏神资料时保留用神缺口与已命中辅证', () => {
  const data = generateLiuyao(fixedDate, { method: 'manual', yaos: [7, 8, 8, 8, 8, 7] });
  data.hiddenSpirits = undefined;
  const evidence = analyzeLiuyaoEvidence(data, { topic: 'shiye' });
  assert.equal(evidence.selectedCandidate, null);
  assert.equal(evidence.selectionFact.selectedCandidateKey, null);
  assert.equal(evidence.hiddenSpiritCoverageFact.status, '字段缺失');
  assert.equal(evidence.candidates[0].status, '未匹配');
  assert.equal(evidence.candidates[1].status, '已匹配');
  assert.match(evidence.selectionFact.promptText, /事业用神未匹配；已有辅证：文书辅证见/);
  assert.match(evidence.selectionFact.promptText, /主用神取用仍待核实/);
  assert.doesNotMatch(evidence.selectionFact.promptText, /改以世应.*裁定/);
});

test('六爻通用排盘保留取用候选，不将世爻自动选为用神', () => {
  const data = cloneFixedManualChart();
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'liuyao:evidence');
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
  assert.equal(evidence.selectionFact.status, '待按问题取用');
  assert.equal(evidence.selectionFact.selectedCandidateKey, null);
  assert.deepEqual(evidence.godChain, []);
  assert.match(evidence.selectionFact.promptText, /事项用神待按具体问题取用；盘面线索：通用主轴见/);
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
        item.status === '已计算' && item.sources.length > 0 && item.limitation.includes('伏藏关系'),
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
  assert.equal(evidence.summaryFact.status, '待按问题取用');
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

test('六爻证据应同时保留基础动变关系与化空条件', () => {
  const data = cloneFixedChangedVoidChart();
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

test('六爻无空爻时仅列旬空背景，不生成出空应期', () => {
  const data = Array.from({ length: 64 }, (_, mask) =>
    generateLiuyao(fixedDate, {
      method: 'manual',
      yaos: Array.from({ length: 6 }, (_, position) => (mask & (1 << position) ? 7 : 8)),
    }),
  ).find(
    (item) =>
      item.yaosDetail.every((line) => !line.isVoid) &&
      item.hiddenSpirits?.every((spirit) => !spirit.isVoid),
  );
  assert.ok(data, '固定日期应有本卦与伏神均未落空的静卦');
  assert.equal(data.voidBranches.length, 2);
  assert.equal(
    data.evidenceAnalysis?.timingFacts.some((item) => item.type === '空亡填实'),
    false,
  );
  assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', /出空、冲实可作为应期核对条件/);
});

test('六爻变爻落空时应期事实归属到对应动爻', () => {
  const data = cloneFixedChangedVoidChart();
  const voidFact = data.evidenceAnalysis?.timingFacts.find((item) => item.type === '空亡填实');
  assert.ok(voidFact);
  assert.match(voidFact.promptText, /第6爻变爻/);
  assert.ok(voidFact.ownerFactKeys.includes(data.evidenceAnalysis!.lineFacts[5].key));
});

test('六爻原神忌神仇神应按生克作用链推导', () => {
  const data = cloneFixedManualChart();
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

test('感情和怪异主题只列盘面线索，明确指定六亲时才可取用', () => {
  const data = cloneFixedManualChart();
  for (const topic of ['ganqing', 'guaishen'] as const) {
    const evidence = analyzeLiuyaoEvidence(data, { topic });
    assert.equal(evidence.selectionFact.status, '待按问题取用');
    assert.equal(evidence.selectedCandidate, null);
    assert.deepEqual(evidence.godChain, []);
    assert.match(evidence.selectionFact.promptText, /事项用神待按具体问题取用/);
  }

  const specified = analyzeLiuyaoEvidence(data, {
    topic: 'ganqing',
    usefulGodRelative: '官鬼',
  });
  assert.equal(specified.selectionFact.status, '已选定候选');
  assert.equal(specified.selectedCandidate?.relative, '官鬼');
  assert.equal(specified.godChain.length, 4);
});

test('六爻整卦关系、反吟伏吟与三合应形成独立结构事实', () => {
  const sanhe = cloneFixedSanheChart();
  const fanyin = cloneFixedFanyinChart();
  const staticChart = cloneFixedStaticQianChart();
  assert.equal(sanhe.sanheWithDay?.group, '火局');
  assert.equal(fanyin.fanfuRelations?.labels[0], '内外反吟');
  assert.equal(staticChart.specialPattern, '静卦');
  const evidence = [sanhe, fanyin, staticChart].map((data) => analyzeLiuyaoEvidence(data));

  assert.deepEqual(
    new Set(evidence.flatMap((item) => item.structureFacts.map((fact) => fact.kind))),
    new Set(['整卦六合六冲', '反吟伏吟', '特殊卦象', '日辰三合']),
  );
  assert.ok(
    evidence
      .flatMap((item) => item.structureFacts)
      .every(
        (item) =>
          item.key.startsWith('liuyao:structure:') &&
          item.status === '已计算' &&
          item.originalText &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得直接写成现实和合'),
      ),
  );
  assert.ok(evidence[1].timingFacts.some((item) => item.type === '反吟伏吟节奏'));
});

test('六爻全动只形成一条特殊卦象结构事实', () => {
  const data = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    method: 'manual',
    yaos: [6, 9, 6, 9, 6, 9],
  });
  assert.equal(data.specialPattern, '全动卦');
  assert.equal(data.isChaotic, true);

  const evidence = analyzeLiuyaoEvidence(data);
  const specialFacts = evidence.structureFacts.filter((fact) => fact.kind === '特殊卦象');
  assert.equal(specialFacts.length, 1);
  assert.match(specialFacts[0].promptText, /全动卦/);
  assert.equal(evidence.summaryFact.structureFactCount, evidence.structureFacts.length);
});

test('六爻证据拒绝被改写的三刑合害和生旺墓绝字段', () => {
  const source = cloneFixedManualChart();
  const oldResult = structuredClone(source);
  for (const yao of oldResult.yaosDetail) {
    for (const field of [
      'dayLifeStage',
      'movingLifeStages',
      'changedLifeStage',
      'isDongMu',
      'isHuaMu',
      'isRiMu',
      'isRuMu',
      'shiErGong',
      'isYueMu',
      'isSanxing',
      'sanxingType',
      'isLiuhe',
      'liuhePartner',
      'isLiuhai',
      'changeRelation',
      'changeRelations',
      'changeDirection',
    ] as const)
      delete yao[field];
  }
  const snapshot = structuredClone(oldResult);
  const completeEvidence = analyzeLiuyaoEvidence(source);
  assert.deepEqual(analyzeLiuyaoEvidence(oldResult), completeEvidence);
  assert.equal(
    formatEnhancedDivinationInfo('liuyao', oldResult),
    formatEnhancedDivinationInfo('liuyao', source),
  );
  assert.deepEqual(
    getDivinationSummaryBlocks('liuyao', oldResult),
    getDivinationSummaryBlocks('liuyao', source),
  );
  assert.deepEqual(oldResult, snapshot);

  // 明动爻位置来自完整原始爻值；缺少另一明动爻的明细仍保留其入墓作用。
  const omittedMovingLine = source.yaosDetail.find((yao) => yao.isChanging)!;
  const partial = structuredClone(oldResult);
  partial.yaosDetail = partial.yaosDetail.filter(
    (yao) => yao.position !== omittedMovingLine.position,
  );
  const partialEvidence = analyzeLiuyaoEvidence(partial);
  for (const fact of partialEvidence.lineFacts) {
    assert.deepEqual(
      fact.traditionalRelations.movingLifeStages,
      completeEvidence.lineFacts.find((original) => original.position === fact.position)!
        .traditionalRelations.movingLifeStages,
    );
  }
  const mutations: Array<(data: typeof source) => void> = [
    (data) => {
      data.yaosDetail[0].isSanxing = !data.yaosDetail[0].isSanxing;
    },
    (data) => {
      data.yaosDetail[0].liuhePartner = '子';
    },
    (data) => {
      data.yaosDetail[0].dayLifeStage = '墓';
    },
    (data) => {
      data.yaosDetail[0].movingLifeStages = [];
    },
    (data) => {
      data.yaosDetail[2].isHuaMu = !data.yaosDetail[2].isHuaMu;
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(() => analyzeLiuyaoEvidence(changed), /纳甲、世应、动变或月日空破与盘面不一致/u);
    assert.throws(
      () => formatEnhancedDivinationInfo('liuyao', changed),
      /纳甲、世应、动变或月日空破与盘面不一致/u,
    );
    assert.throws(
      () => getDivinationSummaryBlocks('liuyao', changed),
      /纳甲、世应、动变或月日空破与盘面不一致/u,
    );
  }
});

test('六爻整卦、反伏与特殊卦式须复算后才进入摘要和详细任务书', () => {
  const fanyin = cloneFixedFanyinChart();
  const staticChart = cloneFixedStaticQianChart();
  assert.match(formatDetailedDivinationInfo('liuyao', fanyin), /内外反吟/u);
  assert.match(formatDetailedDivinationInfo('liuyao', staticChart), /静卦/u);
  const mutations: Array<{
    source: typeof fanyin;
    change: (data: typeof fanyin) => void;
    error: RegExp;
  }> = [
    {
      source: fanyin,
      change: (data) => {
        data.hexagramRelations!.original = '六合卦';
      },
      error: /整卦六合六冲关系与原始爻值、纳甲不一致/u,
    },
    {
      source: fanyin,
      change: (data) => {
        data.fanfuRelations!.labels = ['内卦伏吟'];
      },
      error: /反吟伏吟关系与原始爻值、纳甲不一致/u,
    },
    {
      source: fanyin,
      change: (data) => {
        data.fanfuRelations!.fanyin[0].description = '虚构反吟';
      },
      error: /反吟伏吟关系与原始爻值、纳甲不一致/u,
    },
    {
      source: staticChart,
      change: (data) => {
        data.specialPattern = '全动卦';
      },
      error: /特殊卦式与原始爻值、动爻数量不一致/u,
    },
    {
      source: staticChart,
      change: (data) => {
        data.specialAdvice = '虚构六爻俱动';
      },
      error: /特殊卦式与原始爻值、动爻数量不一致/u,
    },
  ];
  for (const { source, change, error } of mutations) {
    const changed = structuredClone(source);
    change(changed);
    assert.throws(() => analyzeLiuyaoEvidence(changed), error);
    assert.throws(() => formatEnhancedDivinationInfo('liuyao', changed), error);
    assert.throws(() => formatDetailedDivinationInfo('liuyao', changed), error);
  }

  for (const source of [fanyin, staticChart]) {
    const oldResult = structuredClone(source);
    for (const field of [
      'changedName',
      'interName',
      'palaceStage',
      'sixGods',
      'hexagramRelations',
      'fanfuRelations',
      'specialPattern',
      'specialAdvice',
      'isChaotic',
      'chaoticReason',
      'sanheWithDay',
      'sanheWithMonth',
      'sanxingInYaos',
    ] as const)
      Reflect.deleteProperty(oldResult, field);

    const snapshot = structuredClone(oldResult);
    assert.deepEqual(analyzeLiuyaoEvidence(oldResult), analyzeLiuyaoEvidence(source));
    assert.equal(
      formatEnhancedDivinationInfo('liuyao', oldResult),
      formatEnhancedDivinationInfo('liuyao', source),
    );
    assert.deepEqual(
      getDivinationSummaryBlocks('liuyao', oldResult),
      getDivinationSummaryBlocks('liuyao', source),
    );
    assert.deepEqual(oldResult, snapshot);
  }
});

test('六爻三合结构须由动变爻和月日支复算，旧结果缺少该字段仍可分析', () => {
  const source = cloneFixedSanheChart();
  assert.equal(source.sanheWithDay?.group, '火局');
  const sourceEvidence = analyzeLiuyaoEvidence(source);
  assert.ok(sourceEvidence.structureFacts.some((fact) => fact.kind === '日辰三合'));
  const sourceEnhanced = formatEnhancedDivinationInfo('liuyao', source);
  assert.match(sourceEnhanced, /三合三支：日辰午与动变爻同见火局三支（寅、午、戌）/u);

  const mutations: Array<(data: typeof source) => void> = [
    (data) => {
      data.sanheWithDay = {
        group: '水局',
        members: ['申', '子', '辰'],
        description: '日辰午引动三合水局',
      };
    },
    (data) => {
      data.sanheWithDay!.description = '日辰午引动三合金局';
    },
    (data) => {
      data.sanheWithMonth = source.sanheWithDay;
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(() => analyzeLiuyaoEvidence(changed), /三合与原始爻值、纳甲及月日支不一致/u);
    assert.throws(
      () => formatEnhancedDivinationInfo('liuyao', changed),
      /三合与原始爻值、纳甲及月日支不一致/u,
    );
    assert.throws(
      () => formatDetailedDivinationInfo('liuyao', changed),
      /三合与原始爻值、纳甲及月日支不一致/u,
    );
  }

  const staticChart = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    method: 'manual',
    yaos: [7, 8, 7, 8, 7, 8],
  });
  assert.equal(staticChart.sanheWithDay, null);
  staticChart.sanheWithDay = source.sanheWithDay;
  assert.throws(() => analyzeLiuyaoEvidence(staticChart), /三合与原始爻值、纳甲及月日支不一致/u);
  assert.throws(
    () => formatEnhancedDivinationInfo('liuyao', staticChart),
    /三合与原始爻值、纳甲及月日支不一致/u,
  );
  assert.throws(
    () => formatDetailedDivinationInfo('liuyao', staticChart),
    /三合与原始爻值、纳甲及月日支不一致/u,
  );

  const oldResult = structuredClone(source);
  delete oldResult.sanheWithDay;
  delete oldResult.sanheWithMonth;

  const snapshot = structuredClone(oldResult);
  assert.deepEqual(analyzeLiuyaoEvidence(oldResult), sourceEvidence);
  assert.equal(formatEnhancedDivinationInfo('liuyao', oldResult), sourceEnhanced);
  assert.deepEqual(
    getDivinationSummaryBlocks('liuyao', oldResult),
    getDivinationSummaryBlocks('liuyao', source),
  );
  assert.deepEqual(oldResult, snapshot);
  assert.match(
    formatEnhancedDivinationInfo('liuyao', oldResult),
    /日辰午与动变爻同见火局三支（寅、午、戌）/u,
  );

  // 戊申属甲辰旬，寅卯空；午月静寅日冲起用，与第六明动戌补齐寅午戌。
  const voidClash = generateLiuyao(new Date('2025-06-08T08:00:00+08:00'), {
    method: 'manual',
    yaos: [7, 7, 7, 7, 7, 9],
  });
  assert.equal(voidClash.ganzhi.month.slice(1), '午');
  assert.equal(voidClash.ganzhi.day, '戊申');
  assert.equal(voidClash.yaosDetail[1].najiaDizhi, '寅');
  assert.equal(voidClash.yaosDetail[1].isVoid, true);
  assert.equal(voidClash.yaosDetail[1].seasonState, '休');
  assert.equal(voidClash.yaosDetail[1].isHiddenMove, true);
  assert.equal(voidClash.yaosDetail[5].najiaDizhi, '戌');
  assert.equal(voidClash.yaosDetail[5].isChanging, true);
  assert.deepEqual(voidClash.sanheWithMonth, {
    group: '火局',
    members: ['寅', '午', '戌'],
    description: '月建午与动变爻同见三合火局三支',
  });
  assert.ok(
    analyzeLiuyaoEvidence(voidClash).structureFacts.some((fact) => fact.kind === '月建三合'),
  );
  assert.match(
    formatEnhancedDivinationInfo('liuyao', voidClash),
    /三合三支：月建午与动变爻同见火局三支（寅、午、戌）/u,
  );
  const missingParticipation = structuredClone(voidClash);
  missingParticipation.sanheWithMonth = null;
  assert.throws(
    () => analyzeLiuyaoEvidence(missingParticipation),
    /三合与原始爻值、纳甲及月日支不一致/u,
  );

  const completeSnapshot = structuredClone(source);
  const prompt = formatEnhancedDivinationInfo('liuyao', source);
  source.sanheWithDay!.members[0] = '子';
  assert.deepEqual(source.sanheWithDay!.members, ['子', '午', '戌']);
  assert.deepEqual(voidClash.sanheWithMonth!.members, ['寅', '午', '戌']);
  assert.throws(() => analyzeLiuyaoEvidence(source), /三合与原始爻值、纳甲及月日支不一致/u);
  voidClash.sanheWithMonth!.members[2] = '辰';
  assert.deepEqual(voidClash.sanheWithMonth!.members, ['寅', '午', '辰']);
  assert.throws(() => analyzeLiuyaoEvidence(voidClash), /三合与原始爻值、纳甲及月日支不一致/u);
  const fresh = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    method: 'manual',
    yaos: [7, 6, 7, 7, 7, 6],
  });
  assert.deepEqual(fresh.sanheWithDay?.members, ['寅', '午', '戌']);
  assert.equal(fresh.originalName, '泽火革');
  assert.equal(fresh.changedName, '乾为天');
  assert.deepEqual(fresh, completeSnapshot);
  assert.equal(formatEnhancedDivinationInfo('liuyao', fresh), prompt);
});

test('六爻三刑须由本卦纳甲支复算后才进入提示词', () => {
  const source = cloneFixedSanheChart();
  assert.deepEqual(source.sanxingInYaos?.[0], {
    branches: ['丑', '未'],
    type: '恃势之刑',
  });
  assert.match(formatEnhancedDivinationInfo('liuyao', source), /刑支关系：丑、未相刑（恃势之刑）/u);
  assert.match(formatDetailedDivinationInfo('liuyao', source), /刑支关系：丑、未相刑（恃势之刑）/u);

  const changed = structuredClone(source);
  changed.sanxingInYaos = [{ branches: ['寅', '巳', '申'], type: '无恩之刑' }];
  assert.throws(() => analyzeLiuyaoEvidence(changed), /三刑关系与原始爻值、纳甲不一致/u);
  assert.throws(
    () => formatEnhancedDivinationInfo('liuyao', changed),
    /三刑关系与原始爻值、纳甲不一致/u,
  );
  assert.throws(
    () => formatDetailedDivinationInfo('liuyao', changed),
    /三刑关系与原始爻值、纳甲不一致/u,
  );

  const oldResult = structuredClone(source);
  delete oldResult.sanxingInYaos;
  assert.ok(analyzeLiuyaoEvidence(oldResult));
});

test('六爻刑支提示区分两支相刑、三支齐备与自刑', () => {
  assert.equal(
    formatLiuyaoSanxing([
      { branches: ['寅', '巳'], type: '无恩之刑' },
      { branches: ['寅', '巳', '申'], type: '无恩之刑' },
      { branches: ['辰', '辰'], type: '自刑' },
    ]),
    '寅、巳相刑（无恩之刑）；寅、巳、申三刑齐备（无恩之刑）；辰自刑',
  );
});

test('鬼神怪异主题必须保留现实解释限制', () => {
  const data = cloneFixedManualChart();
  const evidence = analyzeLiuyaoEvidence(data, { topic: 'guaishen' });

  assert.equal(evidence.candidates[0].relative, '官鬼');
  assert.match(evidence.promptText, /不能据此证明超自然原因/);
  assert.match(evidence.promptText, /不得仅凭官鬼、白虎、螣蛇/);
});

test('六爻伏神应推导飞伏生克实效断诀', () => {
  // 水雷屯（坎宫二世卦），六亲缺妻财
  const data = cloneFixedHiddenSpiritChart();
  assert.ok(data.hiddenSpirits && data.hiddenSpirits.length > 0);
  for (const spirit of data.hiddenSpirits) {
    assert.ok(spirit.sixRelative);
    assert.ok(spirit.najiaDizhi);
    assert.ok(spirit.wuxing);
    assert.equal(typeof spirit.position, 'number');
    assert.ok(spirit.underYao);
    assert.ok(spirit.interactionEffect);
    assert.match(spirit.interactionEffect, /飞|伏/);
  }
});

test('六爻恢复按起卦实际时区核对四柱并保留无时区旧盘的结构核验', () => {
  assert.equal(fixedManualChart.timezoneOffsetMinutes, 480);
  assert.deepEqual(fixedManualChart.ganzhi, {
    year: '乙巳',
    month: '壬午',
    day: '戊午',
    hour: '丁巳',
  });
  for (const change of [
    (data: typeof fixedManualChart) => {
      data.timestamp += 2 * 3_600_000;
    },
    ...(['year', 'month', 'day', 'hour'] as const).map(
      (pillar) => (data: typeof fixedManualChart) => {
        data.ganzhi[pillar] = '甲子';
      },
    ),
    (data: typeof fixedManualChart) => {
      data.timezoneOffsetMinutes = 0;
    },
  ]) {
    const wrong = cloneFixedManualChart();
    delete wrong.meta;
    change(wrong);
    for (const consume of [
      () => analyzeLiuyaoEvidence(wrong),
      () => formatEnhancedDivinationInfo('liuyao', wrong),
      () => formatDetailedDivinationInfo('liuyao', wrong),
      () => getDivinationSummaryBlocks('liuyao', wrong),
    ])
      assert.throws(consume, /四柱与起卦时刻、时区及节气参考不一致/u);
  }
  const legacy = cloneFixedManualChart();
  delete legacy.meta;
  delete legacy.timezoneOffsetMinutes;
  legacy.timestamp += 2 * 3_600_000;
  assert.doesNotThrow(() => analyzeLiuyaoEvidence(legacy));

  try {
    TimeManager.setTimezoneOffsetMinutesOverride(0);
    const utc = generateLiuyao(fixedDate, { method: 'manual', yaos: fixedYaos });
    assert.equal(utc.timezoneOffsetMinutes, 0);
    assert.deepEqual(utc.ganzhi, { year: '乙巳', month: '壬午', day: '戊午', hour: '癸丑' });
    const originalTime = buildTimeInfoText(utc);
    const originalSolar = buildSolarTimeInfoText(utc);
    TimeManager.setTimezoneOffsetMinutesOverride(480);
    assert.doesNotThrow(() => analyzeLiuyaoEvidence(utc));
    assert.equal(buildTimeInfoText(utc), originalTime);
    assert.equal(buildSolarTimeInfoText(utc), originalSolar);
    assert.match(buildTimeInfoText(utc), /癸丑/u);
    const corrected = generateLiuyao(new Date('2025-06-29T21:15:00+08:00'), {
      method: 'manual',
      yaos: fixedYaos,
      termReferenceDate: new Date('2025-06-30T00:20:00+08:00'),
    });
    assert.equal(corrected.termReferenceTimestamp, Date.parse('2025-06-30T00:20:00+08:00'));
    assert.equal(corrected.ganzhi.hour.slice(-1), '亥');
    assert.doesNotThrow(() => analyzeLiuyaoEvidence(corrected));
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});
