import test from 'node:test';
import assert from 'node:assert/strict';
import { STEM_WUXING } from '../packages/core/src/ganzhi/data';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import {
  formatQimenRelationFacts,
  formatQimenStemLocations,
} from '../packages/core/src/prompt/qimen-facts';
import {
  buildDivinationPrompt as buildCoreDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { getDunJiaStem } from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils';
import {
  analyzeQimenEvidence,
  getQimenActiveSpecialConditionText,
} from '../packages/core/src/divination/qimen-evidence';

const fixedQimen = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
const cloneFixedQimen = () => structuredClone(fixedQimen);
const jiaZiMethodBoards = {
  zhuanpan: generateQimen(new Date('2026-05-20T00:30:00+08:00'), 'zhuanpan'),
  feipan: generateQimen(new Date('2026-05-20T00:30:00+08:00'), 'feipan'),
};
const fixedAppTaskPrompt = buildDivinationPrompt(
  'qimen',
  '请做整体解读。',
  structuredClone(fixedQimen),
);

test('奇门提示词按当前盘面重算格局与宫位证据', () => {
  const data = cloneFixedQimen();
  assert.ok(data.evidenceAnalysis?.patternFacts.length);
  data.evidenceAnalysis.patternFacts[0].name = '伪造的旧格局';
  data.evidenceAnalysis.palaceFacts[0].promptText = '伪造的旧宫位';

  const prompt = formatEnhancedDivinationInfo('qimen', data);
  assert.doesNotMatch(prompt, /伪造的旧格局|伪造的旧宫位/u);
  assert.match(prompt, /盘面命中格局：/u);
  const mutations: Array<{
    field: string;
    change: (chart: typeof fixedQimen) => void;
    error: RegExp;
  }> = [
    {
      field: 'stemRelations',
      change: (chart) => {
        chart.stemRelations![0].heavenStem = '甲';
        chart.stemRelations![0].relation = '改写干关系';
      },
      error: /天地盘干关系与当前盘面条件不一致/u,
    },
    {
      field: 'palaceInsights',
      change: (chart) => {
        chart.palaceInsights[0].summary = '改写洞察';
        chart.palaceInsights[0].level = '有利';
      },
      error: /宫位洞察与当前盘面条件不一致/u,
    },
    {
      field: 'classicPatterns',
      change: (chart) => {
        chart.classicPatterns![0].summary = '改写经典格局';
      },
      error: /经典格局条件与当前盘面条件不一致/u,
    },
    {
      field: 'patternDetails',
      change: (chart) => {
        chart.patternDetails[0].summary = '改写基础格局';
      },
      error: /基础格局条件与当前盘面条件不一致/u,
    },
    {
      field: 'patternTags',
      change: (chart) => {
        chart.patternTags.push('虚构星伏吟');
      },
      error: /基础格局标签与当前盘面条件不一致/u,
    },
    {
      field: 'patternCombos',
      change: (chart) => {
        chart.patternCombos![0].summary = '改写复合格局';
        chart.patternCombos![0].sources = ['虚构条件'];
      },
      error: /复合格局条件与当前盘面条件不一致/u,
    },
    {
      field: 'juShu',
      change: (chart) => {
        chart.juShu = 0;
      },
      error: /局数必须为一至九的整数/u,
    },
    {
      field: 'isYangDun',
      change: (chart) => {
        chart.isYangDun = !chart.isYangDun;
      },
      error: /定局与当前节气三元条件不一致/u,
    },
    {
      field: 'zhiFu',
      change: (chart) => {
        chart.zhiFu = chart.zhiFu === '天心' ? '天蓬' : '天心';
        chart.classicPatterns = [];
        chart.patternTags = [];
        chart.patternDetails = [];
        chart.palaceInsights = [];
        chart.patternCombos = [];
      },
      error: /值符值使与当前主动干支旬首条件不一致/u,
    },
  ];
  for (const { field, change, error } of mutations) {
    const invalid = cloneFixedQimen();
    change(invalid);
    const before = structuredClone(invalid);
    assert.throws(() => analyzeQimenEvidence(invalid), error, field);
    assert.throws(() => formatEnhancedDivinationInfo('qimen', invalid), error, field);
    assert.throws(
      () => buildCoreDivinationPrompt({ method: 'qimen', data: invalid }),
      error,
      field,
    );
    assert.throws(() => buildDivinationPrompt('qimen', '请做整体解读。', invalid), error, field);
    assert.deepEqual(invalid, before, `${field} 拒绝不改盘`);
  }
  const restored = JSON.parse(JSON.stringify(fixedQimen)) as typeof fixedQimen;
  assert.deepEqual(analyzeQimenEvidence(restored), analyzeQimenEvidence(fixedQimen));
  assert.equal(formatEnhancedDivinationInfo('qimen', restored), prompt);
  delete restored.scope;
  delete restored.juMethod;
  delete restored.timeInfo.juMethod;
  delete restored.classicPatterns;
  delete restored.patternCombos;
  delete restored.stemRelations;
  restored.patternTags = [];
  restored.patternDetails = [];
  restored.palaceInsights = [];
  const optionalBefore = structuredClone(restored);
  const optionalEvidence = analyzeQimenEvidence(restored);
  assert.equal(optionalEvidence.palaceFacts.length, 9);
  assert.equal(optionalEvidence.patternFacts.length, 0);
  assert.match(optionalEvidence.promptText, /【九宫盘面】[\s\S]*天盘[\s\S]*地盘/u);
  assert.doesNotMatch(optionalEvidence.promptText, /【传统格局】/u);
  assert.match(buildCoreDivinationPrompt({ method: 'qimen', data: restored }), /九宫简表/u);
  assert.match(buildDivinationPrompt('qimen', '请做整体解读。', restored), /九宫简表/u);
  assert.deepEqual(restored, optionalBefore);
});

test('奇门原生提示词绑定符使宫生克、天地盘时干和取用宫干冲', () => {
  const prompt = fixedAppTaskPrompt;
  assert.match(prompt, /值符值使与时干：[^\n]*时干丁/);
  assert.match(prompt, /离九宫（正南，火）：[^\n]*天盘丁，地盘庚/);
  assert.match(prompt, /巽四宫（东南，木）：[^\n]*天盘癸，地盘丁/);
  assert.doesNotMatch(prompt, /同干定位：/);
  assert.match(prompt, /值符宫与值使宫五行：值使宫乾六宫金克值符宫巽四宫木/);
  assert.match(prompt, /巽四宫天地盘干：天盘癸水克地盘丁火；天干相冲：癸与丁相冲/);
  assert.doesNotMatch(prompt, /天干五合：癸与丁相合/);
  const capturePrompt = () => buildDivinationPrompt('qimen', '请做整体解读。', cloneFixedQimen());
  const baseline = capturePrompt();
  assert.equal(baseline, prompt);
  const original = { gui: STEM_WUXING.癸, ding: STEM_WUXING.丁 };
  try {
    STEM_WUXING.癸 = '土';
    STEM_WUXING.丁 = '水';
    assert.deepEqual([STEM_WUXING.癸, STEM_WUXING.丁], ['土', '水']);
    assert.equal(capturePrompt(), baseline);
  } finally {
    STEM_WUXING.癸 = original.gui;
    STEM_WUXING.丁 = original.ding;
  }
  assert.deepEqual([STEM_WUXING.癸, STEM_WUXING.丁], Object.values(original));
  assert.equal(capturePrompt(), baseline);
});

test('奇门时家任务保留取象换象造象流程且不追加重复通用框架', () => {
  const prompt = fixedAppTaskPrompt;
  const task = prompt.split('【任务】\n')[1]?.split('\n\n【问题】')[0] ?? '';

  assert.match(task, /取象：先按问题确定主体、事项用神、主客与原宫/);
  assert.match(task, /换象：只采用有流派依据的判法/);
  assert.match(task, /造象：问题涉及调整时/);
  assert.match(task, /分层说明原盘现状与条件变化后的方案/);
  assert.doesNotMatch(task, /不视为原盘改动/);
  assert.match(task, /先综述全盘态势，再围绕所问事项整理主判断及可观察的应期线索/);
  assert.doesNotMatch(task, /按事项定用神与主客，以用神宫门星神干核对格局和空迫墓的作用/);
});

test('奇门完整提示词按问题写入复合格局与值符宫应期触发', () => {
  const data = cloneFixedQimen();
  const prompt = fixedAppTaskPrompt;
  assert.ok(data.yingQi);
  assert.ok(prompt.includes(`值符宫应期参考：盘内相对节奏${data.yingQi.rhythm}`));
  for (const source of data.yingQi.sources) {
    if (source.startsWith('未选定事项用神')) {
      assert.match(prompt, /当前以值符宫作通用参考，事项用神按问题确定/);
    } else {
      assert.ok(prompt.includes(source));
    }
  }
  for (const trigger of data.yingQi.triggerConditions) {
    assert.ok(prompt.includes(trigger));
    assert.equal(prompt.split(trigger).length - 1, 1, `应期触发条件不应重复：${trigger}`);
  }
  assert.doesNotMatch(prompt, /三吉聚气|吉凶混杂|遁格返首叠加|吉门三奇/);
  assert.doesNotMatch(prompt, /八门余气|星宫主客|射覆物象克应/);
  assert.match(buildDivinationPrompt('qimen', '军事演习的行军攻守如何安排？', data), /星宫主客/);
  assert.match(buildDivinationPrompt('qimen', '寻找丢失的手表', data), /射覆物象克应/);
  assert.doesNotMatch(prompt, /不作通用吉凶评分|不替代通用凶格评分/);
  assert.doesNotMatch(prompt, /minDays|maxDays|super-good|super-bad/);
});

test('奇门经典格局保留各宫命中且省略重复条件与通用叠加', () => {
  const data = cloneFixedQimen();
  const prompt = fixedAppTaskPrompt;
  const patternBlock = prompt.split('盘面命中格局：\n')[1]?.split('\n值符宫应期参考：')[0] ?? '';
  const compactStemPatterns = [
    ['青龙逃走', '凶格', '坎一宫', '乙', '辛'],
    ['小格', '凶格', '坤二宫', '庚', '壬'],
    ['地刑玄武', '凶格', '震三宫', '己', '癸'],
    ['螣蛇夭矫', '凶格', '巽四宫', '癸', '丁'],
    ['飞鸟跌穴', '吉格', '兑七宫', '丙', '戊'],
    ['刑狱之格', '凶格', '艮八宫', '辛', '己'],
    ['织女寻牛', '凶格', '离九宫', '丁', '庚'],
  ];
  const compactLines = [
    ...compactStemPatterns.map(([name, tone, palace]) => `${name}（${tone}，${palace}）`),
    '天遁（吉格，兑七宫）',
    '休诈（吉格，兑七宫）',
    '相佐（吉格，巽四宫）',
  ];
  for (const [index, [, , palace, sky, earth]] of compactStemPatterns.entries()) {
    assert.ok(patternBlock.split('\n').includes(compactLines[index]));
    assert.match(prompt, new RegExp(`${palace}（[^\\n]*天盘[^\\n]*${sky}[^\\n]*地盘${earth}`));
  }
  for (const pattern of data.classicPatterns ?? []) {
    const strongerPattern = (data.classicPatterns ?? []).find(
      (candidate) =>
        candidate.name === `${pattern.name}临吉门` &&
        pattern.palaces.every((gong) => candidate.palaces.includes(gong)),
    );
    if (/^[日月星]奇得使$/u.test(pattern.name) && strongerPattern) {
      assert.doesNotMatch(patternBlock, new RegExp(`^${pattern.name}（吉格`, 'mu'));
      continue;
    }
    const tone = pattern.type === 'good' ? '吉格' : pattern.type === 'bad' ? '凶格' : '中性格局';
    const palaces = pattern.palaces.map(
      (gong) => data.jiuGongGe.find((palace) => palace.gong === gong)?.name ?? `${gong}宫`,
    );
    const line = patternBlock
      .split('\n')
      .find(
        (item) =>
          item.startsWith(`${pattern.name}（${tone}`) &&
          palaces.every((name) => item.includes(name)),
      );
    assert.ok(line, `${pattern.name}应保留命中依据和落宫`);
    assert.ok(line.split('）：')[1]?.length || compactLines.includes(line));
  }
  assert.match(patternBlock, /门生宫（吉格）：生门（土）生兑七宫（金）/);
  assert.match(patternBlock, /门生宫（吉格）：景门（火）生艮八宫（土）/);
  assert.match(patternBlock, /日奇得使（吉格）：乙奇加地盘辛（甲戌\/甲午所遁）于坎一宫/);
  assert.match(patternBlock, /三奇游六仪（吉格）：[^\n]*星奇游于甲辰壬/);
  assert.match(patternBlock, /蛇化为龙（吉格）：[^\n]*排盘时以甲子戊代甲/);
  assert.match(prompt, /^天遁（吉格，兑七宫）$/mu);
  assert.match(prompt, /兑七宫[^\n]*门生门[^\n]*神六合[^\n]*天盘壬、丙（丙为寄干），地盘戊/u);
  assert.doesNotMatch(prompt, /生门、丙奇、地盘戊同宫|同宫临生门/u);
  assert.doesNotMatch(prompt, /乃天遁之格/);
  assert.doesNotMatch(prompt, /^月奇得使（吉格/mu);
  assert.match(prompt, /^月奇得使临吉门（吉格）：丙奇加地盘戊（甲子\/甲申所遁）于兑七宫$/mu);
  assert.doesNotMatch(prompt, /月奇得使临吉门（吉格，兑七宫）：月奇得使又临吉门/);
  assert.doesNotMatch(prompt, /聚集7个吉格|同时见吉格与凶格|主能量收敛、事情停滞/);
  assert.doesNotMatch(prompt, /复合格局：/);
});

test('奇门无命中格局时省略格局标题，重复命中只列一次', () => {
  const data = cloneFixedQimen();
  const duplicate = data.classicPatterns?.find((item) => item.name === '天遁');
  assert.ok(duplicate);
  data.classicPatterns?.push({ ...duplicate });
  data.evidenceAnalysis = undefined;
  const duplicatedPrompt = formatEnhancedDivinationInfo('qimen', data);
  assert.equal(duplicatedPrompt.match(/^天遁（吉格，兑七宫）$/gmu)?.length, 1);

  data.classicPatterns = [];
  data.patternTags = [];
  data.patternCombos = [];
  data.evidenceAnalysis = undefined;
  assert.doesNotMatch(formatEnhancedDivinationInfo('qimen', data), /盘面命中格局：|复合格局：/);
  assert.doesNotMatch(getDivinationSummaryBlocks('qimen', data).lines.join('\n'), /格局：/);
});

test('奇门甲子时以旬首所遁戊分别定位天盘和地盘', () => {
  for (const method of ['zhuanpan', 'feipan'] as const) {
    const data = structuredClone(jiaZiMethodBoards[method]);
    assert.equal(data.ganzhi.hour, '甲子');
    const prompt = buildDivinationPrompt('qimen', '请做整体解读。', data);
    assert.match(prompt, /时干甲（甲子遁于戊）/);
    assert.match(prompt, /九宫简表：[\s\S]*天盘戊/);
    assert.match(prompt, /九宫简表：[\s\S]*地盘戊/);
    assert.doesNotMatch(prompt, /同干定位：/);
    assert.doesNotMatch(prompt, /时干甲未见落宫/);
  }
});

test('奇门摘要按六甲遁干定位甲时，不把原始甲误报为未定位', () => {
  const data = generateQimen(new Date('2026-09-01T15:00:00Z'));
  assert.equal(data.ganzhi.hour, '甲子');
  const summary = getDivinationSummaryBlocks('qimen', data);
  assert.match(summary.lines.join('\n'), /时干甲（遁戊）见于/);
  assert.doesNotMatch(summary.lines.join('\n'), /时干甲落宫未定位/);
});

test('奇门年日月时摘要使用对应排盘范围的主动干支和驿马来源', () => {
  const cases = [
    { scope: 'year', label: '年干', branchLabel: '年支', scopeLabel: '年家' },
    { scope: 'month', label: '月干', branchLabel: '月支', scopeLabel: '月家' },
    { scope: 'day', label: '日干', branchLabel: '日支', scopeLabel: '日家' },
    { scope: 'hour', label: '时干', branchLabel: '时支', scopeLabel: '时家' },
  ] as const;

  for (const item of cases) {
    const data = generateQimen(new Date('2026-09-01T15:00:00Z'), 'zhuanpan', item.scope);
    const activeGanZhi = data.ganzhi[item.scope];
    const activeStem = activeGanZhi.charAt(0);
    const visibleStem = getDunJiaStem(activeGanZhi);
    const summary = getDivinationSummaryBlocks('qimen', data).lines.join('\n');
    const fullPrompt = formatEnhancedDivinationInfo('qimen', data, '请做整体解读。');
    const stemText = `${item.label}${activeStem}${activeStem === visibleStem ? '' : `（遁${visibleStem}）`}见于`;
    assert.match(summary, new RegExp(stemText));
    assert.match(
      fullPrompt,
      new RegExp(
        `${item.scope === 'hour' ? '值符值使与时干' : `值符值使与${item.scopeLabel}主动干`}`,
      ),
    );
    assert.equal(data.horseStar?.sourceBranch, activeGanZhi.charAt(1));
    if (item.scope === 'hour') {
      assert.match(summary, /时驿马/);
      assert.match(fullPrompt, /时驿马/);
      const restored = structuredClone(data);
      delete restored.scope;
      assert.deepEqual(getDivinationSummaryBlocks('qimen', restored).lines.join('\n'), summary);
      assert.equal(formatEnhancedDivinationInfo('qimen', restored, '请做整体解读。'), fullPrompt);
      for (const scope of ['toString', 'constructor', '__proto__', 'unknown', null, ['hour']]) {
        const invalid = structuredClone(data);
        invalid.scope = scope as unknown as typeof invalid.scope;
        const original = structuredClone(invalid);
        assert.throws(() => formatEnhancedDivinationInfo('qimen', invalid), /未知的奇门排盘级别/);
        assert.throws(() => getDivinationSummaryBlocks('qimen', invalid), /未知的奇门排盘级别/);
        assert.throws(
          () => buildDivinationPrompt('qimen', '请做整体解读。', invalid),
          /未知的奇门排盘级别/,
        );
        assert.deepEqual(invalid, original);
      }
    } else {
      assert.doesNotMatch(summary, /时驿马/);
      assert.doesNotMatch(fullPrompt, /时驿马/);
      if (data.horseStar)
        assert.match(
          summary,
          new RegExp(`${item.branchLabel}${data.horseStar.sourceBranch}起驿马`),
        );
      if (data.horseStar)
        assert.match(
          fullPrompt,
          new RegExp(`${item.branchLabel}${data.horseStar.sourceBranch}起驿马`),
        );
    }

    const withSpecialCondition = structuredClone(data);
    withSpecialCondition.specialConditions = {
      isLiuJiaHour: true,
      isLiuGuiHour: false,
      isShiGanRuMu: false,
      isWuBuYuShi: false,
      description: '测试特殊条件',
    };
    const specialSummary = getDivinationSummaryBlocks('qimen', withSpecialCondition).lines.join(
      '\n',
    );
    assert.match(
      specialSummary,
      new RegExp(`${item.scope === 'hour' ? '时辰' : `${item.scopeLabel}特殊条件`}：测试特殊条件`),
    );
    if (item.scope !== 'hour') assert.doesNotMatch(specialSummary, /时辰：测试特殊条件/);
  }
});

test('奇门特殊条件未命中时不把残留说明写入在线提示词或摘要', () => {
  const data = cloneFixedQimen();
  const staleCondition = '五不遇时残留说明';
  data.specialConditions = {
    isLiuJiaHour: false,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: staleCondition,
  };

  assert.doesNotMatch(buildDivinationPrompt('qimen', '请做整体解读。', data), /五不遇时残留说明/u);
  assert.doesNotMatch(
    getDivinationSummaryBlocks('qimen', data).lines.join('\n'),
    /五不遇时残留说明/u,
  );
});

test('日干实际入墓与同宫格局只在提示词出现一次，独立特殊条件仍保留', () => {
  const data = generateQimen(new Date('2025-01-28T04:00:00Z'), 'zhuanpan', 'day');
  const palaces = structuredClone(data.jiuGongGe);
  assert.equal(data.specialConditions?.isRiGanRuMu, true);
  assert.ok(data.patternTags.includes('入墓（日干丁落艮八宫）'));

  const enhanced = formatEnhancedDivinationInfo('qimen', data);
  const evidence = analyzeQimenEvidence(data).promptText;
  const summary = getDivinationSummaryBlocks('qimen', data).lines.join('\n');
  assert.match(enhanced, /星奇入墓（凶格）：丁奇入艮八宫/u);
  assert.match(evidence, /星奇入墓/u);
  assert.match(summary, /格局：[^\n]*入墓（日干丁落艮八宫）/u);
  for (const prompt of [enhanced, evidence, summary]) {
    assert.doesNotMatch(prompt, /特殊条件：日干丁落艮八宫入墓/u);
    assert.doesNotMatch(prompt, /日家特殊条件：日干丁落艮八宫入墓/u);
  }
  assert.deepEqual(data.jiuGongGe, palaces);

  const withOtherCondition = structuredClone(data);
  withOtherCondition.specialConditions!.isWuBuYuShi = true;
  withOtherCondition.specialConditions!.description += '另一独立特殊条件；';
  assert.equal(getQimenActiveSpecialConditionText(withOtherCondition), '另一独立特殊条件；');

  const withoutMatchingPattern = structuredClone(data);
  withoutMatchingPattern.patternTags = [];
  assert.match(getQimenActiveSpecialConditionText(withoutMatchingPattern), /日干丁落艮八宫入墓/u);
});

test('奇门同宫比和与寄干五合各自保持身份，五合不直接写成合化', () => {
  const data = cloneFixedQimen();
  const palace = structuredClone(data.jiuGongGe.find((item) => item.gong === 4)!);
  palace.tianPan.stem = '丁';
  palace.tianPan.companionStem = '戊';
  palace.diPan.stem = '壬';
  const lines = formatQimenRelationFacts(palace, palace, palace).join('\n');
  assert.match(lines, /值符宫巽四宫木与值使宫巽四宫木同五行，比和/);
  assert.match(lines, /地盘壬水克天盘丁火；天干五合：丁与壬相合/);
  assert.match(lines, /天盘戊土克地盘壬水/);
  assert.doesNotMatch(lines, /合化|戊与壬相合/);
});

test('同干定位保留寄干、多落点和缺盘层，定位过程不改盘', () => {
  const data = cloneFixedQimen();
  const before = structuredClone(data);
  const locations = formatQimenStemLocations(data);
  for (const palace of data.jiuGongGe) {
    if (palace.tianPan.companionStem) {
      const line = locations.find((item) => item.startsWith(`${palace.tianPan.companionStem}：`));
      assert.ok(line?.includes(`${palace.name}（寄干）`));
    }
    if (palace.diPan.stem) {
      const line = locations.find((item) => item.startsWith(`${palace.diPan.stem}：`));
      assert.ok(line?.split('；地盘')[1].includes(palace.name));
    }
  }
  assert.deepEqual(data, before);
  const partial = structuredClone(data);
  partial.jiuGongGe = partial.jiuGongGe.slice(0, 1);
  partial.jiuGongGe[0].tianPan.stem = '乙';
  partial.jiuGongGe[0].tianPan.companionStem = '乙';
  partial.jiuGongGe[0].diPan.stem = '丙';
  const lines = formatQimenStemLocations(partial);
  assert.equal(lines.length, 2);
  assert.match(
    lines.find((item) => item.startsWith('乙：'))!,
    /；地盘未列$/,
  );
  assert.match(
    lines.find((item) => item.startsWith('丙：'))!,
    /丙：天盘未列/,
  );
});

test('转盘与飞盘的换象造象任务保留原盘、转换条件与现实反馈', () => {
  for (const method of ['zhuanpan', 'feipan'] as const) {
    const data = structuredClone(jiaZiMethodBoards[method]);
    const before = structuredClone(data);
    const prompt = buildDivinationPrompt('qimen', '项目谈判怎样换象与造象？', data);
    assert.match(prompt, /九宫简表：[\s\S]*天盘[甲乙丙丁戊己庚辛壬癸]/);
    assert.doesNotMatch(prompt, /同干定位：/);
    assert.match(prompt, /换象：.*盘层、所追干（含寄干）、起宫与落宫/);
    assert.match(prompt, /替代象及成立条件；多种解释用可核实的现实信息区分/);
    assert.match(prompt, /造象：.*盘象依据、作用路径、投入或时机、原盘制约和可观察反馈/);
    assert.doesNotMatch(prompt, /换象核对：|造象比较：|收束：/);
    assert.deepEqual(data, before);
  }
});

test('奇门候选排序不替代问事取用，也不自动决定主客进退', () => {
  const data = cloneFixedQimen();
  for (const question of ['问求财回款', '问面试岗位', '请做整体解读']) {
    const prompt = buildDivinationPrompt('qimen', question, data);
    assert.match(prompt, /先按问题确定主体、事项用神与主客身份/);
    assert.doesNotMatch(prompt, /取用主线：优先看|兵法利客|兵法利主|宜主动出击|取用宫/);
    for (const palace of data.jiuGongGe) {
      if (palace.tianPan.stem || palace.tianPan.companionStem) {
        assert.ok(
          prompt.includes(`${palace.name}天地盘干：`),
          `${palace.name}应保留干关系供取用核验`,
        );
      }
    }
  }
});
