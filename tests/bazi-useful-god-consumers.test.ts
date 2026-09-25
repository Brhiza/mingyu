import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeBaziCompatibility } from '../packages/core/src/bazi/compatibilityEvidence.ts';
import {
  formatBaziForPrompt,
  formatUsefulGodFunctions,
} from '../packages/core/src/bazi/baziAnalysisFormatter.ts';
import type { UsefulGodAnalysis } from '../packages/core/src/bazi/baziTypes.ts';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { analyzeBaziNatalEvidence } from '../packages/core/src/bazi/natalEvidence.ts';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  calculateNamingBirthContext,
  generateChineseNames,
} from '../packages/core/src/name-number/index.ts';

const WINTER_INPUT = {
  year: 1904,
  month: 1,
  day: 20,
  timeIndex: 0,
  gender: 'male' as const,
  isLunar: false,
};

const CONDITIONAL_FUNCTION = '条件取用：丙火用于解冻（作用对象：癸）';
const CONDITIONAL_AVOID = '干级所忌：丁';

function makeConditionalUsefulGod(): UsefulGodAnalysis {
  return {
    favorable: ['比肩'],
    unfavorable: ['食神'],
    useful: '比劫',
    avoid: '食伤',
    favorableWuxing: ['水'],
    unfavorableWuxing: ['土'],
    conditionalFavorableStems: ['丙'],
    conditionalUnfavorableStems: ['丁'],
    conditionalFavorableWuxing: ['火'],
    decisionEvidence: {
      base: { favorable: ['水'], unfavorable: ['火', '土'], ruleId: 'internal-base-rule' },
      climateCandidates: [
        {
          ruleId: 'internal-climate-rule',
          mode: 'conditional',
          status: '满足',
          requestedOrder: ['火'],
          effects: [
            { stem: '丙', wuxing: '火', role: '解冻', targetStems: ['癸'], rank: 'primary' },
          ],
          adopted: true,
        },
      ],
      appliedLayers: ['扶抑', '调候'],
      conflicts: [],
    },
  };
}

test('条件干级取用保留作用对象，且不把内部规则字段带入公开文字', () => {
  const usefulGod = makeConditionalUsefulGod();
  const functions = formatUsefulGodFunctions(usefulGod);
  const text = functions.join('\n');

  assert.deepEqual(functions, [CONDITIONAL_FUNCTION, CONDITIONAL_AVOID]);
  assert.equal(usefulGod.favorableWuxing?.includes('火'), false);
  assert.deepEqual(usefulGod.conditionalFavorableStems, ['丙']);
  assert.deepEqual(usefulGod.conditionalUnfavorableStems, ['丁']);
  assert.match(text, /丙火用于解冻/);
  assert.match(text, /作用对象：癸/);
  assert.doesNotMatch(text, /ruleId|mode|internal-climate-rule|conditional/);
});

test('原局制化作用保留对象与基线忌性，不能转写成增补喜神', () => {
  const usefulGod = makeConditionalUsefulGod();
  usefulGod.decisionEvidence!.controlFunctions = [
    {
      key: 'internal-control-path',
      label: '食神制杀',
      status: '满足',
      sourceStems: ['丙'],
      targetStems: ['庚'],
      position: '紧贴',
      positionPairs: [],
      sourceRootEvidence: [],
      targetRootEvidence: [],
      remedies: [],
      interactionEvidence: [],
      baseFavorableStems: [],
      baseUnfavorableStems: ['丙', '庚'],
      evidenceGaps: [],
      detail: '原局已见作用',
    },
  ];
  const text = formatUsefulGodFunctions(usefulGod).join('\n');
  assert.match(text, /原局制化：食神制杀；丙作用于庚/);
  assert.match(text, /丙、庚在扶抑基线属忌/);
  assert.match(text, /原局作用与增补取用分别判断/);
  assert.doesNotMatch(text, /internal-control-path/);
  assert.deepEqual(usefulGod.favorableWuxing, ['水']);
});

test('实际冬盘的丙条件喜与丁条件忌贯穿本命提示词和结构化证据', () => {
  const chart = baziCalculator.calculateBazi(WINTER_INPUT);
  const usefulGod = chart.analysis.usefulGod;

  assert.equal(chart.pillars.month.zhi, '丑');
  assert.deepEqual(usefulGod.favorableWuxing, ['金', '水']);
  assert.equal(usefulGod.favorableWuxing?.includes('火'), false);
  assert.deepEqual(usefulGod.conditionalFavorableStems, ['丙']);
  assert.deepEqual(usefulGod.conditionalUnfavorableStems, ['丁']);

  const prompt = formatBaziForPrompt(chart);
  assert.match(prompt, new RegExp(CONDITIONAL_FUNCTION));
  assert.match(prompt, new RegExp(CONDITIONAL_AVOID));
  assert.doesNotMatch(prompt, /ruleId|mode/);

  const natalEvidence = analyzeBaziNatalEvidence(chart);
  const usefulFact = natalEvidence.analysisFacts.find((item) => item.type === '用神取忌');
  assert.ok(usefulFact);
  assert.match(usefulFact.promptText, new RegExp(CONDITIONAL_FUNCTION));
  assert.match(usefulFact.promptText, new RegExp(CONDITIONAL_AVOID));
  assert.doesNotMatch(usefulFact.promptText, /ruleId|mode/);
});

test('起名消费者沿用完整喜用五行，条件火只保留为干级功能资料', () => {
  const context = calculateNamingBirthContext(WINTER_INPUT);
  assert.equal(context.pattern.name, context.pattern.fulfillment?.patternName);
  assert.ok(context.pattern.basis);
  assert.ok(context.pattern.fulfillment);
  assert.match(context.pattern.fulfillment.summary, /./);
  assert.ok(context.pattern.fulfillment.conditionFacts.length > 0);
  assert.match(context.pattern.fulfillment.conditionFacts[0].detail, /./);
  assert.deepEqual(context.favorableElements, ['金', '水']);
  assert.equal(context.favorableElements.includes('火'), false);
  assert.match(context.functionalUse.join('\n'), new RegExp(CONDITIONAL_FUNCTION));
  assert.match(context.functionalUse.join('\n'), new RegExp(CONDITIONAL_AVOID));

  const analysis = analyzeChineseName({ fullName: '李明', birth: WINTER_INPUT });
  assert.deepEqual(analysis.birthContext?.favorableElements, ['金', '水']);
  assert.equal(analysis.preferredElements.includes('火'), false);

  const prompt = buildChineseNameAnalysisPrompt({ analysis });
  assert.match(prompt, /格局：/);
  assert.match(prompt, /格局成败：/);
  assert.match(prompt, /增补喜用五行：金、水/);
  assert.doesNotMatch(prompt, /^格局条件（/m);
  assert.match(prompt, new RegExp(CONDITIONAL_FUNCTION));
  assert.match(prompt, new RegExp(CONDITIONAL_AVOID));
  assert.doesNotMatch(prompt, /ruleId|mode/);

  const [candidate] = generateChineseNames({
    surname: '李',
    gender: '男',
    birth: WINTER_INPUT,
    limit: 1,
  });
  assert.ok(candidate);
  assert.deepEqual(candidate.analysis.birthContext?.favorableElements, ['金', '水']);
  assert.equal(candidate.analysis.birthContext?.favorableElements.includes('火'), false);
});

test('缺时辰起名资料保留候选场景，不把缺失喜用转成补字结论', () => {
  const context = calculateNamingBirthContext({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: '',
    gender: 'male',
    isThreePillars: true,
  });

  assert.equal(context.unknownTimeAnalysis?.status, '待补时');
  assert.equal(context.unknownTimeAnalysis?.scenarios.length, 15);
  assert.deepEqual(context.favorableElements, []);
  assert.equal(context.pattern.name, '待补时');
  assert.match(context.warnings.join('\n'), /出生时辰待补充/);

  const analysis = analyzeChineseName({
    fullName: '李明',
    birth: {
      year: 2000,
      month: 1,
      day: 7,
      timeIndex: '',
      gender: 'male',
      isThreePillars: true,
    },
  });
  const prompt = buildChineseNameAnalysisPrompt({ analysis });
  assert.match(prompt, /待补时说明：/);
  assert.match(prompt, /丑时候选/);
  assert.match(prompt, /喜用五行：待补时/);
});

test('起名缺时入口沿用八字输入校验，不静默转换非法标志或日期类型', () => {
  const input = {
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: '',
    gender: 'male' as const,
    isThreePillars: true,
  };

  assert.throws(
    () => calculateNamingBirthContext({ ...input, isThreePillars: 'false' as never }),
    /时辰未知标志必须是布尔值/,
  );
  assert.throws(
    () => calculateNamingBirthContext({ ...input, dateType: 'gregorian' as never }),
    /日期类型必须是 solar 或 lunar/,
  );
  assert.throws(
    () => calculateNamingBirthContext({ ...input, timeIndex: 'invalid' as never }),
    /出生时辰必须是整数/,
  );
});

test('合盘结构化喜用覆盖保留条件干作用和作用对象', () => {
  const chart = baziCalculator.calculateBazi(WINTER_INPUT);
  const compatibility = analyzeBaziCompatibility(chart, chart);
  const conditional = compatibility.usefulGodCoverage
    .map((item) => item.functionalEvidence)
    .find((item) => item?.favorableStems.includes('丙'));

  assert.ok(conditional);
  assert.deepEqual(conditional.favorableStems, ['丙']);
  assert.deepEqual(conditional.unfavorableStems, ['丁']);
  assert.deepEqual(conditional.descriptions, [CONDITIONAL_FUNCTION, CONDITIONAL_AVOID]);
  assert.doesNotMatch(JSON.stringify(conditional), /ruleId|mode/);
});
