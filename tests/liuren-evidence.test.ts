import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSolarTermEvidence } from 'mingyu-core/calendar';
import {
  analyzeLiurenEvidence,
  generateLiuren,
} from '../packages/core/src/divination/algorithms/liuren';
import {
  describeRelation,
  TIANJIANG_ATTRIBUTES,
} from '../packages/core/src/divination/algorithms/liuren/helpers/plate';
import { resolveLiurenClassicalRules } from '../packages/core/src/divination/algorithms/liuren/helpers/classical-rules';
import {
  buildLiurenTimingEvidence,
  buildTransmissionDetail,
  buildTransmissionNote,
} from '../packages/core/src/divination/algorithms/liuren/helpers/transmission';
import { TimeManager } from '../packages/core/src/calendar/timeManager';
import { buildTimeInfoText, buildSolarTimeInfoText } from '../packages/core/src/prompt/formatters';
import {
  buildDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');
const fixedChart = generateLiuren(fixedDate);

function makeFixedChart() {
  return structuredClone(fixedChart);
}

test('大六壬保存实际占时时区，跨区重开仍按原钟表与四柱核课', () => {
  // 同一 UTC 瞬时点按偏移换算钟表；戊日子时起壬，丁日子时起庚。
  const cases = [
    {
      offset: 480,
      zone: 'UTC+08:00',
      solar: '公历：2025年6月18日 10时30分',
      day: '戊午',
      hour: '丁巳',
    },
    {
      offset: -720,
      zone: 'UTC-12:00',
      solar: '公历：2025年6月17日 14时30分',
      day: '丁巳',
      hour: '丁未',
    },
    {
      offset: 840,
      zone: 'UTC+14:00',
      solar: '公历：2025年6月18日 16时30分',
      day: '戊午',
      hour: '庚申',
    },
  ];
  try {
    for (const { offset, zone, solar, day, hour } of cases) {
      TimeManager.setTimezoneOffsetMinutesOverride(offset);
      const data = generateLiuren(new Date('2025-06-18T02:30:00Z'));
      assert.equal(data.timezoneOffsetMinutes, offset);
      assert.deepEqual(data.ganzhi, { year: '乙巳', month: '壬午', day, hour });
      TimeManager.setTimezoneOffsetMinutesOverride(offset === 480 ? 0 : 480);
      assert.equal(buildSolarTimeInfoText(data), solar);
      assert.match(buildTimeInfoText(data), new RegExp(`${day}日 ${hour}时`));
      const prompt = buildDivinationPrompt({
        method: 'liuren',
        data,
        question: '核对同一占时课盘',
        currentTime: new Date('2025-06-19T00:00:00Z'),
      });
      const origin = prompt.match(/【起课时间】\n([\s\S]*?)(?:\n\n【|$)/)?.[1].trim();
      assert.equal(origin, `${solar}（${zone}）`);
      assert.match(prompt, /【当前时间】\n公历：2025年6月19日 8时0分（UTC\+08:00）/);
      assert.equal(analyzeLiurenEvidence(data).summaryFact.status, '证据链完整');

      const stale = structuredClone(data);
      stale.timestamp += 24 * 60 * 60 * 1000;
      const evidence = analyzeLiurenEvidence(stale);
      assert.equal(evidence.plateFact.status, '缺少');
      assert.equal(evidence.summaryFact.status, '证据链有缺口');
      assert.match(evidence.plateFact.promptText, /占时四柱与保存的起课时刻不一致/);
      const legacy = structuredClone(data);
      delete legacy.timezoneOffsetMinutes;
      assert.equal(analyzeLiurenEvidence(legacy).summaryFact.status, '证据链完整');
    }

    TimeManager.setTimezoneOffsetMinutesOverride(480);
    const corrected = generateLiuren(new Date('2024-02-19T13:00:00+08:00'), {
      termReferenceDate: new Date('2024-02-19T11:30:00+08:00'),
    });
    TimeManager.setTimezoneOffsetMinutesOverride(0);
    assert.equal(corrected.monthLeader, '子');
    assert.equal(analyzeLiurenEvidence(corrected).summaryFact.status, '证据链完整');
    assert.match(buildTimeInfoText(corrected), /公历：2024年2月19日 13时0分[\s\S]*节气：立春/);
    const correctedPrompt = buildDivinationPrompt({
      method: 'liuren',
      data: corrected,
      question: '核对实际中气与校正钟表',
      currentTime: new Date('2025-06-19T00:00:00Z'),
    });
    assert.equal(
      correctedPrompt.match(/【起课时间】\n([\s\S]*?)(?:\n\n【|$)/)?.[1].trim(),
      '公历：2024年2月19日 11时30分（UTC+08:00）\n真太阳时校正时刻：2024年2月19日 13时0分（UTC+08:00）（用于排盘）',
    );
    const invalid = structuredClone(corrected);
    invalid.timezoneOffsetMinutes = Number.NaN;
    assert.throws(() => analyzeLiurenEvidence(invalid), /四柱时区偏移无效/);
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('甲子日酉将酉时伏吟只标干上一课为发用来源', () => {
  const data = generateLiuren(new Date('2026-04-20T18:00:00+08:00'));
  assert.equal(data.ganzhi.day, '甲子');
  assert.equal(data.monthLeader, '酉');
  assert.equal(data.divinationBranch, '酉');
  assert.equal(data.transmissionRule, '伏吟法');
  assert.deepEqual(
    data.fourLessons.map((lesson) => lesson.upper),
    ['寅', '寅', '子', '子'],
  );
  assert.deepEqual(
    data.evidenceAnalysis?.lessons
      .filter((lesson) => lesson.isInitialSource)
      .map((lesson) => lesson.name),
    ['一课'],
  );
  assert.deepEqual(data.evidenceAnalysis?.initialSourceLessons, ['一课']);
});

test('大六壬遥克规则不应因“克法”字样追加贼克法', () => {
  const rules = resolveLiurenClassicalRules('遥克法');
  assert.deepEqual(
    rules.map((item) => item.rule),
    ['遥克'],
  );
  assert.equal(
    rules.some((item) => item.rule === '贼克'),
    false,
  );
});

test('大六壬排盘应内置四课取传与三传推进结构化证据', () => {
  const data = makeFixedChart();
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
  assert.notEqual(evidence.ordinaryTransmissionAdjudicationFact.status, '缺少轨迹');
  assert.ok(evidence.ordinaryTransmissionAdjudicationFact.stageFacts.length > 0);
  assert.ok(
    evidence.ordinaryTransmissionAdjudicationFact.candidateFacts.every((item) =>
      item.sourceLessonKeys.every((key) => key.startsWith('liuren:lesson:')),
    ),
  );
  for (const candidate of evidence.ordinaryTransmissionAdjudicationFact.candidateFacts) {
    assert.deepEqual(
      candidate.sourceLessonKeys,
      candidate.sourceLessons.map((source) => evidence.lessons[source.position - 1]?.key),
    );
  }
  const adjudicationPromptText = [
    data.ordinaryTransmissionAdjudication?.summary ?? '',
    evidence.ordinaryTransmissionAdjudicationFact.promptText,
    ...evidence.ordinaryTransmissionAdjudicationFact.candidateFacts.map((item) => item.promptText),
    ...evidence.ordinaryTransmissionAdjudicationFact.stageFacts.map((item) => item.promptText),
  ].join('\n');
  assert.doesNotMatch(
    adjudicationPromptText,
    /directKe|directBiYong|directSheHai|remoteKe|remoteBiYong|remoteSheHai|suppressedByPrior|notApplicable|notMatched|deferredToSpecial/,
  );
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
  const data = makeFixedChart();
  const initialBranch = data.threeTransmissions[0].branch;
  const expectedVoid = data.xunKong?.includes(initialBranch) ?? false;
  data.threeTransmissions[0].isVoid = !expectedVoid;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissions[0].isVoid, expectedVoid);
  assert.equal(
    evidence.transmissions[0].relationFacts.find((item) => item.basis === '旬空')?.status,
    expectedVoid ? '限制' : '支持',
  );
  assert.match(
    evidence.timingFacts[0].promptText,
    new RegExp(`初传${initialBranch}${expectedVoid ? '空亡' : '不空'}`),
  );
});

test('大六壬旧盘旬空与日柱冲突时不得据错误空亡生成证据', () => {
  const data = makeFixedChart();
  data.xunKong = [data.threeTransmissions[0].branch];

  assert.throws(() => analyzeLiurenEvidence(data), /旬空与日柱不一致/);
});

test('大六壬旧盘跨中气错配实际占时时不得沿用旧月将证据', () => {
  const boundary = calculateSolarTermEvidence(2024, 4).utcTimestamp;
  const data = generateLiuren(new Date(boundary - 1000));
  assert.equal(data.monthLeader, '子');
  data.timestamp = boundary;

  assert.throws(() => analyzeLiurenEvidence(data), /月将与实际占时中气不一致/);
});

test('大六壬旧盘三传五行与月令冲突时不得生成错误旺衰证据', () => {
  const data = makeFixedChart();
  data.threeTransmissions[0].seasonState =
    data.threeTransmissions[0].seasonState === '旺' ? '死' : '旺';

  assert.throws(() => analyzeLiurenEvidence(data), /三传五行或月令旺衰/);
});

test('大六壬旧结果缺少取传名、应期与焦点时应明确标记来源缺口', () => {
  const data = makeFixedChart();
  data.transmissionRule = undefined;
  data.transmissionPattern = undefined;
  data.evidenceAnalysis = undefined;

  const missingRule = analyzeLiurenEvidence(data);
  assert.equal(missingRule.transmissionRuleFact.status, '缺少规则名');
  assert.equal(missingRule.transmissionRuleFact.rule, null);
  assert.equal(missingRule.summaryFact.status, '证据链有缺口');
  assert.equal(missingRule.calculationSteps[3]?.status, '资料不足');
  assert.equal(missingRule.calculationSteps[6]?.status, '资料不足');
  assert.match(missingRule.transmissionRuleFact.promptText, /不得按三传结果反推九宗门名称/);

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
  assert.match(evidence.promptText, /事项类神按所问事项核对/);
  assert.doesNotMatch(evidence.promptText, /由盘面补齐|原结果提供/);

  data.threeTransmissions.forEach((item) => {
    item.note = '';
  });
  assert.doesNotThrow(() => analyzeLiurenEvidence(data));
  assert.doesNotThrow(() =>
    buildDivinationPrompt({
      method: 'liuren',
      data,
      question: '核对本次三传',
      currentTime: new Date('2026-05-20T10:30:00+08:00'),
    }),
  );
  assert.doesNotThrow(() => getDivinationSummaryBlocks('liuren', data));
});

test('大六壬旧盘篡改取传派生资料不得进入证据提示词', () => {
  const alterations: Array<[string, (data: ReturnType<typeof generateLiuren>) => void]> = [
    [
      '三传模式',
      (data) => {
        data.transmissionPattern = data.transmissionPattern === '伏吟' ? '递传' : '伏吟';
      },
    ],
    [
      '取传说明',
      (data) => {
        data.transmissionDetail = '明日必成';
      },
    ],
    [
      '经典依据',
      (data) => {
        data.classicalRules = [
          { source: '伪书', rule: '伪则', category: '伪类', summary: '明日必成' },
        ];
      },
    ],
    [
      '盘面焦点',
      (data) => {
        data.focusEvidence![0].evidence.push('明日必成');
      },
    ],
    [
      '应期条件',
      (data) => {
        data.timingEvidence!.push('明日必成');
      },
    ],
    [
      '传统标签',
      (data) => {
        data.patternTags!.push('必成格');
      },
    ],
    [
      '课体名称',
      (data) => {
        data.guaTiFacts = undefined;
        data.guaTi!.push('必成格');
      },
    ],
    [
      '神煞起法',
      (data) => {
        data.shenShaFacts![0].target = '错误地支';
      },
    ],
    [
      '神煞摘要',
      (data) => {
        data.shenShaFacts = undefined;
        data.shenShaSummary!.push('必成星在寅');
      },
    ],
    [
      '天将属性',
      (data) => {
        data.tianJiangProps![data.threeTransmissions[0].god].description = '明日必成';
      },
    ],
  ];
  for (const [field, alter] of alterations) {
    const data = makeFixedChart();
    alter(data);
    assert.throws(() => analyzeLiurenEvidence(data), /不一致，无法生成证据/, field);
  }

  const promptOptions = {
    method: 'liuren' as const,
    question: '核对本次三传',
    currentTime: new Date('2026-05-20T10:30:00+08:00'),
  };
  const stages = ['初传', '中传', '末传'] as const;
  for (const [index, stage] of stages.entries()) {
    const data = makeFixedChart();
    assert.equal(data.threeTransmissions[index].stage, stage);
    data.threeTransmissions[index].stage = stages[(index + 1) % stages.length];
    data.threeTransmissions[index].note = buildTransmissionNote(
      data.threeTransmissions[index].stage,
      data.threeTransmissions[index].relation,
    );
    data.transmissionDetail = buildTransmissionDetail(
      data.transmissionRule!,
      data.transmissionPattern,
      data.threeTransmissions,
      data.classicalRules,
    );
    data.timingEvidence = buildLiurenTimingEvidence({
      transmissions: data.threeTransmissions,
      dayBranch: data.ganzhi.day.charAt(1),
      monthBranch: data.ganzhi.month.charAt(1),
    });
    assert.notEqual(data.threeTransmissions[index].stage, stage);
    assert.throws(() => analyzeLiurenEvidence(data), /三传阶段与先后次序不一致/, stage);
    assert.throws(
      () => buildDivinationPrompt({ ...promptOptions, data }),
      /三传阶段与先后次序不一致/,
      stage,
    );
    assert.throws(
      () => getDivinationSummaryBlocks('liuren', data),
      /三传阶段与先后次序不一致/,
      stage,
    );
  }
  const wrongNote = makeFixedChart();
  wrongNote.threeTransmissions[0].note = '初传与一课下位五行比和，已成必然成功之局。';
  assert.equal(wrongNote.threeTransmissions[0].note, '初传与一课下位五行比和，已成必然成功之局。');
  assert.throws(() => analyzeLiurenEvidence(wrongNote), /三传与天地盘不一致/);
  assert.throws(
    () => buildDivinationPrompt({ ...promptOptions, data: wrongNote }),
    /三传与天地盘不一致/,
  );
  assert.throws(() => getDivinationSummaryBlocks('liuren', wrongNote), /三传与天地盘不一致/);

  const writable = generateLiuren(fixedDate);
  assert.deepEqual(writable, fixedChart);
  const expectedEvidence = analyzeLiurenEvidence(writable);
  const expectedPrompt = buildDivinationPrompt({ ...promptOptions, data: writable });
  const expectedSummary = getDivinationSummaryBlocks('liuren', writable);
  writable.threeTransmissions[1].stage = '末传';
  writable.timingEvidence = buildLiurenTimingEvidence({
    transmissions: writable.threeTransmissions,
    dayBranch: writable.ganzhi.day.charAt(1),
    monthBranch: writable.ganzhi.month.charAt(1),
  });
  assert.equal(writable.threeTransmissions[1].stage, '末传');
  assert.throws(() => analyzeLiurenEvidence(writable), /三传阶段与先后次序不一致/);
  const fresh = generateLiuren(fixedDate);
  assert.deepEqual(fresh, fixedChart);
  assert.deepEqual(analyzeLiurenEvidence(fresh), expectedEvidence);
  assert.equal(buildDivinationPrompt({ ...promptOptions, data: fresh }), expectedPrompt);
  assert.deepEqual(getDivinationSummaryBlocks('liuren', fresh), expectedSummary);
});

test('大六壬旧版应期文案与空数组可补齐为当前盘面条件', () => {
  const data = generateLiuren(new Date('2026-05-19T10:30:00+08:00'));
  assert.equal(data.threeTransmissions[0].isVoid, false);
  const oldInitial = `一级发用：先看初传${data.threeTransmissions[0].branch}不空，可直接作为起始信号`;
  const oldDeadline = '未给出目标期限时，只判断先后、快慢和触发条件，不硬换成唯一日期';
  data.timingEvidence = [oldInitial, data.timingEvidence![1], data.timingEvidence![2], oldDeadline];

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.timingFacts[0].rawText, oldInitial);
  assert.equal(evidence.timingFacts[3].rawText, oldDeadline);
  assert.match(evidence.timingFacts[0].promptText, /按月令旺衰、日支关系和事项类神核对发端条件/);
  assert.equal(evidence.timingFacts[3].promptText, '以问题期限、三传先后和现实触发条件核对应期');
  assert.doesNotMatch(evidence.promptText, /可直接作为起始信号|未给出目标期限时/);

  data.timingEvidence = [];
  assert.ok(analyzeLiurenEvidence(data).timingFacts.every((fact) => fact.rawText === undefined));
  data.timingEvidence = [oldInitial.replace('可直接作为起始信号', '必定成功')];
  assert.throws(() => analyzeLiurenEvidence(data), /取传派生资料与四课、三传不一致/);
});

test('大六壬旧结果只有最终取传名时不得冒充普通宗门竞争可重建', () => {
  const data = makeFixedChart();
  data.ordinaryTransmissionAdjudication = undefined;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.ordinaryTransmissionAdjudicationFact.status, '缺少轨迹');
  assert.equal(evidence.ordinaryTransmissionAdjudicationFact.candidateFacts.length, 0);
  assert.match(evidence.ordinaryTransmissionAdjudicationFact.promptText, /不得声称取传竞争可重建/);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.equal(evidence.calculationSteps[3]?.status, '资料不足');
});

test('大六壬结构化边界保留在字段中，提示词按事项核对类神与应期', () => {
  const evidence = analyzeLiurenEvidence(makeFixedChart());

  assert.match(evidence.focusSummaryFact.limitation, /缺少焦点时不得/);
  assert.match(evidence.promptText, /类神焦点状态：/);
  assert.match(evidence.promptText, /应期触发证据：/);
  assert.doesNotMatch(evidence.promptText, /边界：|不得|不换算|原结果提供|由盘面补齐/);
  assert.deepEqual(
    evidence.timingConditions,
    evidence.timingFacts.map((item) => item.promptText),
  );
  const timingItem = evidence.evidence.items.find((item) => item.title === '应期触发证据');
  assert.ok(timingItem);
  assert.doesNotMatch(timingItem.detail, /原结果提供|由盘面补齐|边界：/);
});

test('大六壬资料有缺口且未列反证时提示词不宣称盘内未见限制', () => {
  const data = generateLiuren(new Date('2026-08-14T10:30:00+08:00'));
  data.heavenlyPlate = data.heavenlyPlate.slice(0, 11);
  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.equal(evidence.counterSummaryFact.status, '未见明确反证');
  assert.equal(evidence.counterEvidenceFacts.length, 0);
  assert.doesNotMatch(evidence.promptText, /盘内限制：|当前课传未见明确/);
});

test('大六壬起盘链、天地盘、课体神煞与天将属性应进入统一证据条目', () => {
  const data = makeFixedChart();
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
  const data = makeFixedChart();
  data.heavenlyPlate = data.heavenlyPlate.slice(0, 11);

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.plateFact.status, '缺少');
  assert.equal(evidence.plateFact.expectedCount, 12);
  assert.equal(evidence.plateFact.actualCount, 11);
  assert.match(evidence.plateFact.promptText, /仅保留11\/12位/);
  assert.match(evidence.plateFact.limitation, /不得反推或补造/);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '天地盘定位待复核',
    ),
  );
});

test('大六壬天地盘缺口时不直出无法核验的取传派生资料', () => {
  const data = makeFixedChart();
  data.heavenlyPlate = data.heavenlyPlate.slice(0, 11);
  data.transmissionDetail = '明日必成';
  data.patternTags!.push('明日必成');
  data.timingEvidence!.push('明日必成');
  data.focusEvidence![0].evidence.push('明日必成');

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.plateFact.status, '缺少');
  assert.equal(evidence.transmissionRuleFact.status, '缺少规则名');
  assert.deepEqual(evidence.patternEvidence, []);
  assert.equal(evidence.focusSummaryFact.status, '缺少焦点');
  assert.deepEqual(evidence.timingEvidence, []);
  assert.doesNotMatch(evidence.promptText, /明日必成/);
});

test('大六壬天地盘十二条记录含重复位置时不得标为完整', () => {
  const data = makeFixedChart();
  data.heavenlyPlate[1] = { ...data.heavenlyPlate[0] };

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.platePositionFacts.length, 12);
  assert.equal(evidence.plateFact.status, '缺少');
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.match(evidence.plateFact.promptText, /有缺漏或重复/);
});

test('大六壬天地盘十二条记录含未知支或天将时不得标为完整', () => {
  for (const field of ['under', 'branch', 'god'] as const) {
    const data = makeFixedChart();
    data.heavenlyPlate[0] = { ...data.heavenlyPlate[0], [field]: '未知' };

    const evidence = analyzeLiurenEvidence(data);
    assert.equal(evidence.plateFact.status, '缺少', field);
    assert.equal(evidence.summaryFact.status, '证据链有缺口', field);
  }
});

test('大六壬天地盘十二支与天将齐全但对应错位时不标为完整', () => {
  for (const field of ['branch', 'god'] as const) {
    const data = makeFixedChart();
    const first = data.heavenlyPlate[0][field];
    data.heavenlyPlate[0][field] = data.heavenlyPlate[1][field];
    data.heavenlyPlate[1][field] = first;

    const evidence = analyzeLiurenEvidence(data);
    assert.equal(evidence.plateFact.status, '缺少', field);
    assert.equal(evidence.summaryFact.status, '证据链有缺口', field);
    assert.match(evidence.plateFact.promptText, /与逐位记录不一致/);
  }
});

test('大六壬四课与完整天地盘错位时不生成互相矛盾的提示词证据', () => {
  const data = makeFixedChart();
  data.fourLessons[0].upper = data.fourLessons[0].upper === '子' ? '丑' : '子';

  assert.throws(() => analyzeLiurenEvidence(data), /四课与天地盘不一致/);
});

test('大六壬三传天将与完整天地盘错位时不生成互相矛盾的提示词证据', () => {
  const data = makeFixedChart();
  data.threeTransmissions[0].god = data.threeTransmissions[0].god === '贵人' ? '螣蛇' : '贵人';

  assert.throws(() => analyzeLiurenEvidence(data), /三传与天地盘不一致/);
});

test('大六壬取传规则与四课裁决不一致时不生成完整证据链', () => {
  const data = makeFixedChart();
  data.transmissionRule = data.transmissionRule === '元首法' ? '重审法' : '元首法';

  assert.throws(() => analyzeLiurenEvidence(data), /取传规则或三传与四课、天地盘不一致/);
});

test('大六壬普通宗门裁决轨迹与真实发用错位时拒绝生成证据', () => {
  const data = makeFixedChart();
  assert.equal(data.transmissionRule, '重审法');
  assert.equal(data.threeTransmissions[0].branch, '酉');
  assert.equal(data.ordinaryTransmissionAdjudication?.status, 'selected');
  data.ordinaryTransmissionAdjudication!.selectedInitial = '子';
  data.ordinaryTransmissionAdjudication!.selectedRule = '元首法';

  assert.throws(() => analyzeLiurenEvidence(data), /普通宗门裁决与四课、三传、天地盘不一致/);
});

test('大六壬普通宗门裁决字段顺序变化但事实相同时仍可生成证据', () => {
  const data = makeFixedChart();
  const adjudication = data.ordinaryTransmissionAdjudication;
  assert.ok(adjudication);
  data.ordinaryTransmissionAdjudication = Object.fromEntries(
    Object.entries(adjudication).reverse(),
  ) as typeof adjudication;

  assert.equal(analyzeLiurenEvidence(data).summaryFact.status, '证据链完整');
});

test('大六壬已登记课体条件与当前盘面不一致时拒绝生成证据', () => {
  const staleCondition = makeFixedChart();
  assert.ok(staleCondition.guaTiFacts?.length);
  staleCondition.guaTiFacts[0].matchedConditions = ['错误课体条件'];
  assert.throws(() => analyzeLiurenEvidence(staleCondition), /课体与四课、三传、天地盘不一致/);

  const staleNames = makeFixedChart();
  assert.ok(staleNames.guaTi?.length);
  staleNames.guaTi[0] = '错误课体名称';
  assert.throws(() => analyzeLiurenEvidence(staleNames), /课体与四课、三传、天地盘不一致/);
});

test('大六壬三传地支虽与天将关系自洽，仍须符合四课取传与递传', () => {
  const data = makeFixedChart();
  const middle = data.threeTransmissions[1];
  const alternative = data.heavenlyPlate.find(
    (item) => item.branch !== middle.branch && item.branch !== data.threeTransmissions[0].branch,
  );
  assert.ok(alternative);
  middle.branch = alternative.branch;
  middle.god = alternative.god;
  middle.wuxing = undefined;
  middle.seasonState = undefined;
  middle.relation = describeRelation(middle.branch, data.threeTransmissions[0].branch);
  middle.note = buildTransmissionNote(middle.stage, middle.relation);
  middle.dayRelation = describeRelation(middle.branch, data.ganzhi.day.charAt(1));
  data.threeTransmissions[2].relation = describeRelation(
    data.threeTransmissions[2].branch,
    middle.branch,
  );
  data.threeTransmissions[2].note = buildTransmissionNote(
    data.threeTransmissions[2].stage,
    data.threeTransmissions[2].relation,
  );

  assert.throws(() => analyzeLiurenEvidence(data), /取传规则或三传与四课、天地盘不一致/);
});

test('大六壬贵人与日干或地盘位置不一致时不标为完整', () => {
  for (const field of ['noblemanBranch', 'noblemanGroundBranch'] as const) {
    const data = makeFixedChart();
    data[field] = data.heavenlyPlate.find((item) => item.under !== data[field])!.under;

    const evidence = analyzeLiurenEvidence(data);
    assert.equal(evidence.plateFact.status, '缺少', field);
    assert.equal(evidence.summaryFact.status, '证据链有缺口', field);
  }
});

test('大六壬时柱、占时支与昼夜占互相矛盾时不标为完整', () => {
  for (const field of ['hour', 'dayNight'] as const) {
    const data = makeFixedChart();
    if (field === 'hour') {
      data.ganzhi.hour = `${data.ganzhi.hour.charAt(0)}${data.divinationBranch === '子' ? '丑' : '子'}`;
    } else {
      data.dayNight = data.dayNight === '昼占' ? '夜占' : '昼占';
    }

    const evidence = analyzeLiurenEvidence(data);
    assert.equal(evidence.plateFact.status, '缺少', field);
    assert.equal(evidence.summaryFact.status, '证据链有缺口', field);
    assert.match(evidence.plateFact.promptText, /占时支、时柱或昼夜占记录不一致/);
  }
});

test('大六壬传统事实应保留原文并为提示词生成条件化副本', () => {
  const data = makeFixedChart();
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
  const data = makeFixedChart();
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

test('大六壬旧结果缺少逐项神煞起法时应明确不可复算', () => {
  const data = makeFixedChart();
  data.shenShaFacts = undefined;

  const evidence = analyzeLiurenEvidence(data);
  const shenShaFacts = evidence.traditionalFacts.filter((item) => item.kind === '神煞');
  assert.ok(shenShaFacts.length > 0);
  assert.ok(shenShaFacts.every((item) => item.promptText.includes('未保存起法输入，不能据此复算')));
  assert.ok(shenShaFacts.every((item) => item.sources.includes('旧结果未保存逐项起法与来源')));
});

test('大六壬旧结果未保存神煞时不虚构传统神煞命中', () => {
  const data = makeFixedChart();
  data.shenShaFacts = undefined;
  data.shenShaSummary = undefined;

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.traditionalFacts.filter((item) => item.kind === '神煞').length, 0);
  assert.doesNotMatch(evidence.promptText, /传统神煞在盘面/);
});

test('十二天将阴阳应与所配天干一致', () => {
  assert.equal(TIANJIANG_ATTRIBUTES.贵人.yinYang, '阴');
  assert.equal(TIANJIANG_ATTRIBUTES.六合.yinYang, '阴');
  assert.equal(TIANJIANG_ATTRIBUTES.天后.yinYang, '阳');
});
