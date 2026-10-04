import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMeihuaEvidence,
  conditionMeihuaTraditionalText,
} from '../packages/core/src/divination/meihua-evidence.ts';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { hexagramsData } from '../packages/core/src/divination/hexagram-data.ts';

const fixedDate = new Date('2025-01-01T08:00:00+08:00');
const fixedNumberChart = generateMeihua(fixedDate, { method: 'number', number: 123 });
const cloneFixedNumberChart = () => structuredClone(fixedNumberChart);
const fixedCharacterChart = generateMeihua(fixedDate, {
  method: 'character',
  characterText: '西林',
  characterStrokeCounts: [7, 8],
});

test('梅花排盘应内置主互变三阶段结构化证据', () => {
  const data = cloneFixedNumberChart();
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'meihua:evidence');
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
  assert.deepEqual(
    evidence.stages.map((item) => item.label),
    ['主卦', '互卦', '变卦'],
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
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【梅花体用阶段推进结构化证据】/);
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assert.match(evidence.promptText, /解释限制：/);
  assert.match(evidence.promptText, /主卦.*→.*互卦.*；.*互卦.*→.*变卦/);
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
});

test('梅花起卦证据应核对取数与盘面，并准确表达整除时的余数', () => {
  const data = cloneFixedNumberChart();
  const evidence = data.evidenceAnalysis;
  const lowerStep = evidence?.calculationFact.steps.find((item) => item.target === '下卦');

  assert.equal(lowerStep?.remainder, 5);
  assert.equal(lowerStep?.result, 5);
  assert.match(lowerStep?.promptText ?? '', /下卦=\(5\)除以8，余数为5，索引为5/u);

  const inconsistent = structuredClone(data);
  inconsistent.calculation!.number = 124;
  inconsistent.evidenceAnalysis = undefined;
  const rebuilt = analyzeMeihuaEvidence(inconsistent);

  assert.equal(rebuilt.calculationFact.status, '计算不一致');
  assert.deepEqual(rebuilt.calculationFact.steps, []);
  assert.match(rebuilt.calculationFact.promptText, /起卦取数核验不一致/u);
  assert.match(rebuilt.calculationFact.promptText, /数字与时支合数记录128，按输入应为129/u);
  assert.doesNotMatch(rebuilt.calculationFact.promptText, /除8余/u);
  assert.equal(rebuilt.summaryFact.status, '部分资料缺失');
  assert.match(rebuilt.summaryFact.promptText, /起卦计算记录不一致/u);
  const generationStep = rebuilt.calculationSteps.find((item) => item.stage === '起卦取数核验');
  const summaryStep = rebuilt.calculationSteps.find((item) => item.stage === '证据汇总');
  assert.equal(generationStep?.status, '资料不足');
  assert.equal(generationStep?.result.calculationStatus, '计算不一致');
  assert.match(generationStep?.promptText ?? '', /起卦取数核验不一致/u);
  assert.equal(summaryStep?.status, '资料不足');
  assert.match(summaryStep?.promptText ?? '', /起卦计算记录不一致/u);
});

test('梅花以时支取数时应核对起卦记录与盘面时柱', () => {
  const settings = [
    { method: 'time' as const },
    { method: 'timeTrigram' as const },
    { method: 'number' as const, number: 123 },
    { method: 'sound' as const, soundCount: 3 },
    { method: 'direction' as const, direction: 'south' as const, objectType: 'fire' as const },
  ];

  for (const setting of settings) {
    const data =
      setting.method === 'number'
        ? cloneFixedNumberChart()
        : structuredClone(generateMeihua(fixedDate, setting));
    assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
    data.ganzhi.hour = `甲${data.calculation?.timeZhi === '巳' ? '午' : '巳'}`;
    data.evidenceAnalysis = undefined;

    assert.throws(
      () => analyzeMeihuaEvidence(data),
      /盘面时柱与时间戳重算结果不一致/u,
      setting.method,
    );
  }
});

test('梅花时间起卦应核对时间戳元数据和盘面完整四柱', () => {
  const source = cloneFixedNumberChart();
  assert.equal(Date.parse(source.meta!.calculatedAt), source.timestamp);

  const staleTimestamp = structuredClone(source);
  staleTimestamp.timestamp += 24 * 60 * 60 * 1000;
  staleTimestamp.evidenceAnalysis = undefined;
  assert.throws(() => analyzeMeihuaEvidence(staleTimestamp), /起卦时间戳与结果元数据不一致/u);

  for (const pillar of ['year', 'day'] as const) {
    const inconsistent = structuredClone(source);
    inconsistent.ganzhi[pillar] = '甲子';
    inconsistent.evidenceAnalysis = undefined;
    assert.throws(
      () => analyzeMeihuaEvidence(inconsistent),
      new RegExp(`盘面${pillar === 'year' ? '年' : '日'}柱与时间戳重算结果不一致`, 'u'),
      `${pillar}柱不应脱离已记录起卦时间戳`,
    );
  }
});

test('梅花旧盘证据应从六爻复核互变、体用与月令记录', () => {
  const data = cloneFixedNumberChart();
  const originalEvidence = analyzeMeihuaEvidence(data);
  for (const fields of [
    ['monthBranch'],
    ['monthElement'],
    ['monthBranch', 'monthElement'],
  ] as const) {
    const legacy = structuredClone(data);
    for (const field of fields) delete legacy.analysis[field];
    const snapshot = structuredClone(legacy);
    const recovered = analyzeMeihuaEvidence(legacy);
    assert.equal(recovered.monthBranch, '子');
    assert.deepEqual(recovered, originalEvidence);
    assert.deepEqual(legacy, snapshot);
  }
  const mutations = [
    {
      label: '互卦',
      change: (item: typeof data) => {
        item.interHexagram!.upper = '乾';
      },
      diagnostic: /互卦记录与主卦六爻推得的泽天夬不一致/u,
    },
    {
      label: '变卦',
      change: (item: typeof data) => {
        item.changedHexagram!.lower = '坤';
      },
      diagnostic: /变卦记录与主卦六爻推得的火山旅不一致/u,
    },
    {
      label: '体互',
      change: (item: typeof data) => {
        item.interTiGua!.element = '火';
      },
      diagnostic: /体互记录与动爻及卦象不一致/u,
    },
    {
      label: '月支',
      change: (item: typeof data) => {
        item.analysis.monthBranch = '午';
      },
      diagnostic: /体用月令旺衰记录与月建及主卦不一致/u,
    },
    {
      label: '月令五行',
      change: (item: typeof data) => {
        item.analysis.monthElement = '火';
      },
      diagnostic: /体用月令旺衰记录与月建及主卦不一致/u,
    },
    {
      label: '旺衰',
      change: (item: typeof data) => {
        item.analysis.tiSeasonState = '旺';
      },
      diagnostic: /体用月令旺衰记录与月建及主卦不一致/u,
    },
  ];
  for (const { label, change, diagnostic } of mutations) {
    const changed = structuredClone(data);
    change(changed);
    changed.evidenceAnalysis = undefined;
    const fact = analyzeMeihuaEvidence(changed);
    assert.equal(fact.calculationFact.status, '计算不一致', label);
    assert.equal(fact.summaryFact.status, '部分资料缺失', label);
    assert.equal(fact.calculationFact.steps.length, 0, label);
    assert.match(fact.calculationFact.promptText, diagnostic, label);
  }
});

test('梅花旧盘派生应期或互卦关系被改写时不得作为已核验事实进入解读资料', () => {
  const data = cloneFixedNumberChart();
  data.analysis.yingQi = ['明日必然成功'];
  data.analysis.inter1Relation = '体互生原体';
  data.evidenceAnalysis = undefined;

  const rebuilt = analyzeMeihuaEvidence(data);
  assert.equal(rebuilt.calculationFact.status, '计算不一致');
  assert.equal(rebuilt.summaryFact.status, '部分资料缺失');
  assert.match(rebuilt.calculationFact.promptText, /原应期条件与动爻、体用和月令重算结果不一致/);
  assert.match(rebuilt.calculationFact.promptText, /体互对原体关系记录与互卦不一致/);
  assert.equal(
    rebuilt.timingFacts.some((item) => item.type === '原应期条件'),
    false,
  );
  assert.equal(
    rebuilt.evidence.items.some((item) => item.title === '体互对原体关系'),
    false,
  );
  assert.doesNotMatch(rebuilt.promptText, /明日必然成功|体互生原体/);

  const oldData = cloneFixedNumberChart();
  delete oldData.analysis.yingQi;
  oldData.evidenceAnalysis = undefined;
  const oldEvidence = analyzeMeihuaEvidence(oldData);
  assert.equal(oldEvidence.calculationFact.status, '完整');
  assert.equal(oldEvidence.summaryFact.status, '证据链完整');
  assert.equal(
    oldEvidence.timingFacts.some((item) => item.type === '原应期条件'),
    false,
  );

  const emptyTiming = cloneFixedNumberChart();
  emptyTiming.analysis.yingQi = [];
  emptyTiming.evidenceAnalysis = undefined;
  const emptyEvidence = analyzeMeihuaEvidence(emptyTiming);
  assert.equal(emptyEvidence.calculationFact.status, '计算不一致');
  assert.equal(
    emptyEvidence.timingFacts.some((item) => item.type === '原应期条件'),
    false,
  );
  assert.match(
    emptyEvidence.calculationFact.promptText,
    /原应期条件与动爻、体用和月令重算结果不一致/u,
  );
});

test('梅花体互用互应沿用原体所在方位，不得上下颠倒', () => {
  const lowerMoving = cloneFixedNumberChart();
  const lowerProcess = analyzeMeihuaEvidence(lowerMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(lowerMoving.movingYao.position <= 3, true);
  assert.equal(lowerMoving.interTiGua?.name, lowerMoving.interHexagram?.upper);
  assert.equal(lowerMoving.interYongGua?.name, lowerMoving.interHexagram?.lower);
  assert.equal(lowerProcess?.ti.name, lowerMoving.interHexagram?.upper);
  assert.equal(lowerProcess?.yong.name, lowerMoving.interHexagram?.lower);
  assert.equal(lowerProcess?.relation, '比和');
  assert.equal(lowerMoving.analysis.inter1Relation, '原体克体互');
  assert.equal(lowerMoving.analysis.inter2Relation, '原体克用互');
  assert.match(lowerProcess?.basis ?? '', /原体在上.*上互为体互、下互为用互/);

  const upperMoving = generateMeihua(fixedDate, { method: 'number', number: 5 });
  const upperProcess = analyzeMeihuaEvidence(upperMoving).stages.find(
    (item) => item.stage === 'process',
  );

  assert.equal(upperMoving.movingYao.position >= 4, true);
  assert.equal(upperMoving.interTiGua?.name, upperMoving.interHexagram?.lower);
  assert.equal(upperMoving.interYongGua?.name, upperMoving.interHexagram?.upper);
  assert.equal(upperProcess?.ti.name, upperMoving.interHexagram?.lower);
  assert.equal(upperProcess?.yong.name, upperMoving.interHexagram?.upper);
  assert.match(upperProcess?.basis ?? '', /原体在下.*下互为体互、上互为用互/);
});

test('梅花证据只给触发层位，不把动爻和卦数换算成绝对日期', () => {
  const data = cloneFixedNumberChart();
  const evidence = analyzeMeihuaEvidence(data);

  assert.match(evidence.promptText, /只用于先后、层次和触发条件/);
  assert.match(evidence.promptText, /不能据此换算绝对日期/);
  assert.doesNotMatch(evidence.promptText, /\d+日内|\d+月左右|成功率[：=]?\d/);
});

test('梅花起卦算式、六爻结构、卦象来源和已有应期条件应进入统一证据', () => {
  const data = cloneFixedNumberChart();
  const evidence = data.evidenceAnalysis;
  const items = evidence?.evidence.items ?? [];

  assert.ok(evidence);
  assert.ok(evidence.calculationFacts.some((item) => item.includes('数字取数：输入123')));
  assert.ok(evidence.calculationFacts.some((item) => /上卦=.*除以8/.test(item)));
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
  assert.ok(items.some((item) => item.level === '应期' && item.title.includes('触发')));
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
    (data.analysis.yingQi ?? []).every((condition) =>
      items.some((item) => item.level === '应期' && item.detail?.includes(condition)),
    ),
  );
  assert.ok(evidence.counterEvidence.length === 0 || items.some((item) => item.level === '反证'));
  assert.doesNotMatch(
    JSON.stringify(evidence.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('梅花旧结果缺少逐爻或互卦阶段时应明确标记缺口且不得反推', () => {
  const data = cloneFixedNumberChart();
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
  assert.equal(
    rebuilt.evidence.items.some((item) => item.title === '体互对原体关系'),
    false,
  );
  assert.equal(
    rebuilt.evidence.items.some((item) => item.title === '用互对原体关系'),
    false,
  );
  assert.equal(rebuilt.transitionFacts.length, 1);
  assert.equal(rebuilt.transitionFacts[0].status, '跨阶段缺口');
  assert.equal(rebuilt.summaryFact.status, '部分资料缺失');
  assert.equal(
    rebuilt.calculationSteps.find((item) => item.stage === '阶段推进核验')?.status,
    '资料不足',
  );
  assert.match(rebuilt.transitionFacts[0].promptText, /不补造过程/);
  assert.match(rebuilt.stageCoverageFact.promptText, /缺少互卦阶段/);
  assert.match(rebuilt.promptText, /不得反推缺失阶段体用关系/);

  const incompleteResult = analyzeMeihuaEvidence({
    ...data,
    changedHexagram: null,
    evidenceAnalysis: undefined,
  });
  const resultStage = incompleteResult.stages.find((item) => item.stage === 'result');
  assert.equal(incompleteResult.stageCoverageFact.status, '阶段资料不完整');
  assert.deepEqual(incompleteResult.stageCoverageFact.incompleteStages, ['result']);
  assert.equal(resultStage?.status, '卦象资料缺失');
  assert.equal(resultStage?.hexagramFactKey, null);
  assert.match(resultStage?.promptText ?? '', /卦象结构资料未记录/);
  assert.doesNotMatch(resultStage?.promptText ?? '', /不得补造/);

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

test('梅花字占证据仅在原始笔画或声类与卦数一致时认定计算完整', () => {
  const cases = [
    generateMeihua(fixedDate, {
      method: 'character',
      characterText: '西林',
      characterStrokeCounts: [6, 8],
    }),
    generateMeihua(fixedDate, {
      method: 'character',
      characterText: '今日动静如何',
      characterTones: [1, 4, 3, 3, 1, 1],
    }),
  ];
  delete cases[0].calculation!.characterStrokeCounts;
  delete cases[1].calculation!.characterTones;
  for (const data of cases) {
    const fact = analyzeMeihuaEvidence({ ...data, evidenceAnalysis: undefined }).calculationFact;
    assert.equal(fact.status, '缺少中间参数');
    assert.equal(fact.steps.length, 0);
    assert.doesNotMatch(fact.promptText, /上卦=.*除8|字数取数：/u);
  }

  const inconsistent = structuredClone(fixedCharacterChart);
  inconsistent.calculation!.characterUpperNumber = 6;
  const inconsistentFact = analyzeMeihuaEvidence({
    ...inconsistent,
    evidenceAnalysis: undefined,
  }).calculationFact;
  assert.equal(inconsistentFact.status, '计算不一致');
  assert.equal(inconsistentFact.steps.length, 0);
  assert.match(inconsistentFact.promptText, /字占上卦取数记录6，按输入应为7/u);
  assert.doesNotMatch(inconsistentFact.promptText, /上卦=.*除以8|字数取数：/u);

  const missingCache = structuredClone(fixedCharacterChart);
  delete missingCache.calculation!.characterUpperNumber;
  const missingEvidence = analyzeMeihuaEvidence({
    ...missingCache,
    evidenceAnalysis: undefined,
  });
  const missingFact = missingEvidence.calculationFact;
  assert.equal(missingFact.status, '缺少中间参数');
  assert.match(missingFact.promptText, /字占上卦取数/u);
  assert.doesNotMatch(missingFact.promptText, /计算不一致|上卦=.*除以8|字数取数：/u);
  assert.equal(missingEvidence.summaryFact.status, '部分资料缺失');
  assert.doesNotMatch(missingEvidence.summaryFact.promptText, /计算记录不一致/u);
  assert.match(
    missingEvidence.calculationSteps.find((item) => item.stage === '起卦取数核验')?.promptText ??
      '',
    /起卦取数资料不足/u,
  );
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
  const data = cloneFixedNumberChart();
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
    method: 'random',
    replay: [0, 0, 0.4],
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
