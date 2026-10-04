import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQimenEvidence, generateQimen } from 'mingyu-core/divination/qimen';
import { generateQimen as generateQimenFromSource } from '../packages/core/src/divination/algorithms/qimen/index';
import { formatQimenPatternBasis } from '../packages/core/src/divination/qimen-evidence';
import {
  evaluateQimenPatternFulfillment,
  formatQimenPatternConditionSummary,
} from '../packages/core/src/divination/algorithms/qimen/helpers/guidance';
import type { QimenCandidateSource } from '../packages/core/src/divination/algorithms/qimen/index';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import {
  buildDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination';
import { qimen } from '../packages/core/src/divination/divination-data';
import * as qimenConstants from '../packages/core/src/divination/algorithms/qimen/helpers/_constants';
import {
  getAllQimenYanboClassics,
  getQimenDeityClassic,
  getQimenDoorClassic,
  getQimenStarClassic,
  getQimenStemPattern,
  QIMEN_DEITY_CLASSICS,
  QIMEN_DOOR_CLASSICS,
  QIMEN_STAR_CLASSICS,
  QIMEN_STEM_PATTERNS,
  QIMEN_YANBO_CLASSICS,
} from '../packages/core/src/classics/qimen-patterns';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');
const fixedBoard = generateQimen(fixedDate);
const cloneFixedBoard = () => structuredClone(fixedBoard);
const promptBoard = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
const clonePromptBoard = () => structuredClone(promptBoard);
const lateSummerBoard = generateQimen(new Date('2026-08-08T15:14:00+08:00'));
const cloneLateSummerBoard = () => structuredClone(lateSummerBoard);

function mutateQimenConstants(tables: ReturnType<typeof qimenConstants.getQimenConstants>) {
  tables.STEM_TOMB_MAP.乙.palace = 9;
  tables.auspiciousDoors[0] = '错误吉门';
  tables.branchElements.子 = '火';
  tables.branchIndex.子 = 11;
  tables.branches[0] = '错误地支';
  tables.diPanPalaces.寅 = 1;
  tables.difficultDoors[0] = '错误凶门';
  tables.difficultGods[0] = '错误凶神';
  tables.doorElements.开门 = '水';
  tables.palaceStars[0] = '错误九星';
  tables.sanQiLiuYi.reverse();
  tables.sanQiStems[0] = '错误三奇';
  tables.starElements.天蓬 = '火';
  tables.stemElements.乙 = '金';
  tables.supportiveGods[0] = '错误吉神';
}

test('年家与月家奇门提示词使用对应的三元阴遁依据', () => {
  for (const scope of ['year', 'month'] as const) {
    const data = generateQimenFromSource(fixedDate, 'zhuanpan', scope);
    const setup = data.evidenceAnalysis?.ruleSourceFacts.find(
      (item) => item.key === 'rule:qimen:setup',
    );
    assert.equal(data.timeInfo.epoch, '下元');
    assert.equal(data.isYangDun, false);
    assert.equal(data.juShu, 7);
    assert.equal(Object.hasOwn(data, 'juMethod'), false);
    assert.equal(Object.hasOwn(data.timeInfo, 'juMethod'), false);
    assert.equal(Object.hasOwn(data.timeInfo, 'juTerm'), false);
    assert.equal(Object.hasOwn(data.timeInfo, 'isZhiRun'), false);
    assert.ok(setup?.sources.some((source) => source.includes('《奇门遁甲统宗》')));
    assert.doesNotMatch(setup?.promptText || '', /拆补法|置闰法/);

    const prompt = formatEnhancedDivinationInfo('qimen', data);
    assert.match(prompt, /三元阴遁定局/);
    assert.match(prompt, /核心结构：阴遁7局；干支年乙巳 下元/);
    if (scope === 'month') assert.match(prompt, /月建壬午/);
    assert.doesNotMatch(prompt, /起局方法：[^\n]*拆补法|起局方法：[^\n]*置闰法/);
    assert.doesNotMatch(prompt, /^节令：/m);

    const summary = getDivinationSummaryBlocks('qimen', data);
    assert.ok(summary.lines.includes('定局：干支年乙巳下元'));
    assert.ok(summary.lines.includes(`实际节气：${data.timeInfo.solarTerm}`));
    assert.doesNotMatch(summary.lines.join('\n'), /定局：立春|定局：芒种|定局：夏至/);
    assert.doesNotMatch(summary.lines.join('\n'), /节令背景|月相|建除|日干/);
    assert.ok(
      summary.lines.some((line) =>
        line.includes(scope === 'year' ? '干支年：乙巳' : '乙巳年、壬午月'),
      ),
    );
  }
});

test('奇门排盘应内置用神宫与宫间作用结构化证据', () => {
  const data = cloneFixedBoard();
  const evidence = data.evidenceAnalysis;

  const restored = structuredClone(data);
  delete restored.scope;
  assert.deepEqual(analyzeQimenEvidence(restored), analyzeQimenEvidence(data));
  assert.equal(Object.hasOwn(restored, 'scope'), false);
  for (const scope of ['toString', 'constructor', '__proto__', 'unknown', null, ['hour']]) {
    const invalid = structuredClone(data);
    invalid.scope = scope as unknown as typeof invalid.scope;
    const original = structuredClone(invalid);
    assert.throws(() => analyzeQimenEvidence(invalid), /未知的奇门排盘级别/);
    assert.deepEqual(invalid, original);
  }

  assert.ok(evidence);
  assert.equal(evidence.key, 'qimen:evidence');
  assert.equal(evidence.status, '已计算');
  assert.deepEqual(evidence.calculationSteps, evidence.calculationEvidenceFacts);
  assert.equal(data.jiuGongGe.length, 9);
  assert.equal(evidence.palaceFacts.length, 9);
  assert.deepEqual(
    evidence.palaceFacts.map((item) => item.gong),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.ok(
    evidence.palaceFacts.every(
      (item) =>
        item.tianPan &&
        item.diPan &&
        item.renPan &&
        item.shenPan &&
        item.promptText &&
        item.sources.length >= 3 &&
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(evidence.candidates.length > 0);
  assert.ok(
    evidence.candidates.every((item) =>
      evidence.palaceFacts.some((fact) => fact.key === item.palaceFactKey),
    ),
  );
  assert.ok(evidence.candidates.some((item) => item.sources.includes('值符落宫')));
  assert.ok(evidence.candidates.some((item) => item.sources.includes('值使落宫')));
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(evidence.promptText, /【任务】/);
  assert.match(evidence.promptText, /【九宫盘面】/);
  assert.match(evidence.promptText, /【传统依据】/);
  assert.ok(
    evidence.promptText.split('\n').some((line) => /门.+，星.+，神.+，天盘.+，地盘/u.test(line)),
  );
  assert.doesNotMatch(
    evidence.promptText,
    /来源[：:]|标签[：:]|限制[：:]|边界[：:]|qimen:|主宫评分|辅宫评分|权重[：=]?\d|评分-?\d+|（-?\d+分|成功率[：=]?\d|应期范围\d/,
  );
  assert.doesNotMatch(evidence.promptText, /qimen:(?:evidence|limitation|calculation):/);
  assertPromptIsPortableTaskText(evidence.promptText);
  assert.match(evidence.promptText, /相关宫位与主客关系/);
  assert.ok(
    evidence.limitationFacts.some((item) =>
      item.promptText.includes('不等于已经按具体问题选定用神'),
    ),
  );
  assert.ok(
    evidence.limitationFacts.some((item) =>
      item.promptText.includes('未给目标期限时不得换算唯一日期'),
    ),
  );
  assert.ok(
    evidence.limitationFacts.some((item) => item.promptText.includes('现实安全、权限、天气')),
  );
  assert.ok(
    evidence.limitationFacts.some((item) => item.promptText.includes('不得输出吉凶总分、成功率')),
  );
  assert.doesNotMatch(evidence.promptText, /不得|不等于|来源[：:]|标签[：:]|限制[：:]/);

  const normal = generateQimenFromSource(fixedDate);
  const promptOptions = {
    method: 'qimen' as const,
    question: '九宫星门神干及本次格局如何对应？',
    currentTime: new Date('2026-10-04T08:00:00Z'),
  };
  const normalTask = buildDivinationPrompt({ ...promptOptions, data: normal });
  assert.match(normalTask, /九宫/u);
  assert.match(normalTask, /天盘/u);
  assert.match(normalTask, /地盘/u);
  assert.equal(normal.jiuGongGe[0].name, '坎一宫');
  assert.equal(normal.jiuGongGe[0].element, '水');
  assert.equal(normal.evidenceAnalysis?.palaceFacts[0].element, '水');
  assert.equal(qimen.ninePositions[0].name, '坎一宫');
  assert.equal(qimen.ninePositions[0].element, '水');
  const canonical = qimenConstants.getQimenConstants();
  const fixedKeys = [
    'STEM_TOMB_MAP',
    'auspiciousDoors',
    'branchElements',
    'branchIndex',
    'branches',
    'diPanPalaces',
    'difficultDoors',
    'difficultGods',
    'doorElements',
    'palaceStars',
    'sanQiLiuYi',
    'sanQiStems',
    'starElements',
    'stemElements',
    'supportiveGods',
  ] as const;
  assert.deepEqual(Object.keys(canonical).sort(), [...fixedKeys].sort());
  const detached = qimenConstants.getQimenConstants();
  mutateQimenConstants(detached);
  for (const key of fixedKeys) {
    assert.notDeepEqual(detached[key], canonical[key], `${key} 副本可写`);
    assert.deepEqual(
      qimenConstants.getQimenConstants()[key],
      canonical[key],
      `${key} 固定资料独立`,
    );
  }
  const publicTables = Object.fromEntries(
    fixedKeys.map((key) => [key, qimenConstants[key]]),
  ) as typeof canonical;
  const publicBefore = structuredClone(publicTables);
  const inputBefore = structuredClone(normal);
  const returned = normal.evidenceAnalysis!;
  returned.candidates[0].palace.tianPan.stem = '错误返回干';
  returned.palaceFacts[0].renPan.door = '错误返回门';
  returned.patternFacts.find((item) => item.kind === '经典格局')!.palaces.push(99);
  returned.patternFacts.find((item) => item.kind === '复合格局')!.sources.push('错误返回来源');
  const chartBefore = structuredClone(inputBefore);
  chartBefore.evidenceAnalysis = returned;
  assert.deepEqual(normal, chartBefore);
  assert.deepEqual(analyzeQimenEvidence(normal), inputBefore.evidenceAnalysis);
  assert.equal(buildDivinationPrompt({ ...promptOptions, data: normal }), normalTask);

  const originalClassicTables = structuredClone({
    QIMEN_STEM_PATTERNS,
    QIMEN_STAR_CLASSICS,
    QIMEN_DOOR_CLASSICS,
    QIMEN_DEITY_CLASSICS,
    QIMEN_YANBO_CLASSICS,
  });
  const readClassics = () => ({
    stem: getQimenStemPattern('戊', '乙')!,
    star: getQimenStarClassic('天蓬')!,
    door: getQimenDoorClassic('开门')!,
    deity: getQimenDeityClassic('值符')!,
    yanbo: getAllQimenYanboClassics(),
  });
  const classics = readClassics();
  const returnedClassics = readClassics();
  returnedClassics.stem.name = '错误克应';
  returnedClassics.star.wuxing = '火';
  returnedClassics.door.wuxing = '水';
  returnedClassics.deity.wuxing = '水';
  returnedClassics.yanbo[0].verse = '错误歌诀';
  assert.deepEqual(readClassics(), classics);
  const element = qimen.ninePositions[0].element;
  const star = qimen.palaceStars[0];
  try {
    assert.equal(Reflect.set(qimen.ninePositions[0], 'element', '土'), true);
    assert.equal(qimen.ninePositions[0].element, '土');
    assert.equal(Reflect.set(qimen.palaceStars, 0, '天英'), true);
    assert.equal(qimen.palaceStars[0], '天英');
    mutateQimenConstants(publicTables);
    for (const key of fixedKeys) assert.notDeepEqual(publicTables[key], publicBefore[key]);
    assert.deepEqual(qimenConstants.getQimenConstants(), canonical);
    QIMEN_STEM_PATTERNS['戊+乙'].name = '错误克应';
    QIMEN_STAR_CLASSICS.天蓬星.wuxing = '火';
    QIMEN_DOOR_CLASSICS.开门.wuxing = '水';
    QIMEN_DEITY_CLASSICS.值符.wuxing = '水';
    QIMEN_YANBO_CLASSICS[0].verse = '错误歌诀';
    assert.deepEqual(readClassics(), classics);
    const fresh = generateQimenFromSource(fixedDate);
    assert.deepEqual(fresh, inputBefore);
    assert.equal(buildDivinationPrompt({ ...promptOptions, data: fresh }), normalTask);
  } finally {
    qimen.ninePositions[0].element = element;
    qimen.palaceStars[0] = star;
    for (const key of fixedKeys) {
      const target = publicTables[key];
      const previous = publicBefore[key];
      if (Array.isArray(target)) target.splice(0, target.length, ...(previous as string[]));
      else Object.assign(target, previous);
    }
    Object.assign(QIMEN_STEM_PATTERNS, originalClassicTables.QIMEN_STEM_PATTERNS);
    Object.assign(QIMEN_STAR_CLASSICS, originalClassicTables.QIMEN_STAR_CLASSICS);
    Object.assign(QIMEN_DOOR_CLASSICS, originalClassicTables.QIMEN_DOOR_CLASSICS);
    Object.assign(QIMEN_DEITY_CLASSICS, originalClassicTables.QIMEN_DEITY_CLASSICS);
    QIMEN_YANBO_CLASSICS.splice(
      0,
      QIMEN_YANBO_CLASSICS.length,
      ...originalClassicTables.QIMEN_YANBO_CLASSICS,
    );
  }
  assert.deepEqual(publicTables, publicBefore);
  assert.deepEqual(readClassics(), classics);
});

test('奇门在线提示词只输出任务、盘面与传统依据并去掉重复格局条件', () => {
  const data = clonePromptBoard();
  const evidence = analyzeQimenEvidence(data);
  const prompt = evidence.promptText;
  const classicMenPo = evidence.patternFacts.find(
    (item) => item.kind === '经典格局' && item.name === '门迫',
  );
  const hostGuestPattern = evidence.patternFacts.find((item) => item.name === '星宫主客');
  const basicMenPoFacts = evidence.patternFacts.filter(
    (item) => item.kind === '基础格局' && item.name.startsWith('门迫'),
  );

  assert.ok(classicMenPo);
  assert.ok(hostGuestPattern);
  assert.ok(classicMenPo.originalText.includes('主此宫事务受阻'));
  assert.equal(classicMenPo.promptText, '惊门（金）克巽四宫（木）');
  assert.equal(formatQimenPatternBasis(classicMenPo), classicMenPo.promptText);
  assert.match(hostGuestPattern.promptText, /主客取向/);
  assert.ok(basicMenPoFacts.length > 0);
  for (const fact of basicMenPoFacts) {
    assert.deepEqual(
      fact.palaces,
      data.jiuGongGe
        .filter((palace) => fact.name.includes(palace.name))
        .map((palace) => palace.gong),
    );
  }
  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【九宫盘面】/);
  assert.match(prompt, /【传统格局】/);
  assert.match(prompt, /【传统依据】/);
  assert.match(prompt, /凶格：门迫；惊门（金）克巽四宫（木）/);
  assert.match(prompt, /乾六宫[^\n]*马星/u);
  assert.doesNotMatch(prompt, /中性格局：马星（/u);
  assert.doesNotMatch(prompt, /来源[：:]|标签[：:]|限制[：:]|边界[：:]|组成来源|规则命中|qimen:/);
  assert.equal(prompt.split('惊门（金）克巽四宫（木）').length - 1, 1);
  assert.doesNotMatch(prompt, /主此宫事务受阻|主破败损失|所谋之事有贵人暗助|百事可为/);
  assert.equal(
    evidence.evidence.items.filter((item) => item.title === '基础格局：门迫（巽四宫惊门）').length,
    0,
  );
  assert.equal(evidence.evidence.items.filter((item) => item.title === '经典格局：门迫').length, 1);
  const menPoCandidate = evidence.candidates.find((item) => item.gong === 4);
  assert.equal(menPoCandidate?.constraints.filter((item) => item.includes('门迫')).length, 1);
  const menPoPalace = evidence.palaceFacts.find((item) => item.gong === 4);
  assert.equal(
    menPoPalace?.patternFactKeys.filter((key) => key.startsWith('basic:') && key.includes('门迫'))
      .length,
    0,
  );
});

test('奇门格局无可用事实依据时不输出空冒号并保留主客结构词', () => {
  const data = clonePromptBoard();
  const detail = data.patternDetails.find((item) => item.tag.startsWith('三奇得（'))!;
  assert.ok(detail);
  const tag = detail.tag;
  const palace = data.jiuGongGe.find((item) => tag.includes(item.name))!;
  data.patternDetails = [structuredClone(detail)];

  const evidence = analyzeQimenEvidence(data);
  const fact = evidence.patternFacts.find((item) => item.name === tag);
  const candidate = evidence.candidates.find((item) => item.gong === palace.gong);
  const patternLine = evidence.promptText.split('\n').find((line) => line.includes(tag));
  const patternItem = evidence.evidence.items.find((item) => item.title === `基础格局：${tag}`);

  assert.ok(fact);
  assert.equal(fact.promptText, tag);
  assert.equal(formatQimenPatternBasis(fact), fact.promptText);
  assert.ok(candidate?.patterns.includes(tag));
  assert.equal(patternLine, `吉格：${tag}`);
  assert.equal(
    candidate?.patterns.find((item) => item.startsWith(tag)),
    tag,
  );
  assert.ok(patternItem?.detail.includes('传统分类：有利'));
  assert.doesNotMatch(patternItem?.detail ?? '', /^；/);
});

test('奇门全局特殊条件不重复记作每个候选宫反证', () => {
  const data = clonePromptBoard();
  const specialCondition = '当前时辰特殊条件仅供全局核验';
  data.specialConditions = {
    isLiuJiaHour: true,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: specialCondition,
  };

  const evidence = analyzeQimenEvidence(data);

  assert.ok(evidence.candidates.length > 1);
  assert.ok(evidence.promptText.includes(`特殊条件：${specialCondition}`));
  assert.ok(evidence.candidates.every((item) => !item.constraints.includes(specialCondition)));
  assert.equal(
    evidence.counterEvidenceFacts.filter((item) => item.detail === specialCondition).length,
    0,
  );
});

test('奇门全局特殊条件未命中时不把残留说明写入证据提示词', () => {
  const data = clonePromptBoard();
  data.specialConditions = {
    isLiuJiaHour: false,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: '五不遇时残留说明',
  };

  assert.doesNotMatch(analyzeQimenEvidence(data).promptText, /五不遇时残留说明/u);
});

test('Issue #204：结构化依据使用正式定局三元并按格局类型归类候选宫', () => {
  const data = cloneLateSummerBoard();
  const evidence = analyzeQimenEvidence(data);

  assert.equal(data.timeInfo.epoch, '中元');
  assert.match(evidence.promptText, /定局立秋中元/);
  assert.doesNotMatch(evidence.promptText, /立秋上元/);
  const palace = evidence.candidates.find((item) => item.gong === 1);

  assert.ok(palace);
  assert.ok(palace.support.some((item) => item.includes('值符开通闭塞')));
  assert.ok(palace.constraints.some((item) => item.includes('青龙网罗')));
  assert.ok(palace.constraints.some((item) => item.includes('蛇入狱刑')));
  assert.ok(palace.support.every((item) => !/青龙网罗|蛇入狱刑/.test(item)));
  assert.ok(palace.constraints.every((item) => !/逢开利以有为|天乙击冲/.test(item)));
});

test('奇门证据应保留空亡与宫间五行反证', () => {
  const data = cloneFixedBoard();
  const first = data.evidenceAnalysis?.candidates[0];
  assert.ok(first);
  data.voidPalaces = [
    ...(data.voidPalaces ?? []),
    { branch: '子', palace: first.gong, name: first.name },
  ];
  delete data.patternCombos;

  const evidence = analyzeQimenEvidence(data);

  assert.equal(evidence.candidates.find((item) => item.gong === first.gong)?.isVoid, true);
  assert.match(evidence.promptText, /逢空/);
  assert.ok(evidence.relations.every((item) => item.relation.length > 0));
});

test('奇门证据按排盘范围使用六甲遁干主动源并优先于日时背景', () => {
  const date = new Date('2026-09-07T04:00:00.000Z');
  const activeLabels: Record<'year' | 'month' | 'day' | 'hour', QimenCandidateSource> = {
    year: '年干落宫',
    month: '月干落宫',
    day: '日干落宫',
    hour: '时干落宫',
  };
  const dunJia: Record<string, string> = {
    甲子: '戊',
    甲戌: '己',
    甲申: '庚',
    甲午: '辛',
    甲辰: '壬',
    甲寅: '癸',
  };
  const scopes = ['year', 'month', 'day', 'hour'] as const;
  for (const scope of scopes) {
    const result = generateQimenFromSource(
      date,
      'zhuanpan',
      scope,
      scope === 'hour' || scope === 'day' ? 'zhirun' : 'chaibu',
    );
    const activeGanZhi = result.ganzhi[scope];
    const activeStem = dunJia[activeGanZhi] ?? activeGanZhi.charAt(0);
    const expected = result.jiuGongGe
      .filter(
        (palace) =>
          palace.tianPan.stem === activeStem ||
          palace.tianPan.companionStem === activeStem ||
          palace.diPan.stem === activeStem,
      )
      .map((palace) => palace.name)
      .sort();
    const label = activeLabels[scope];
    const candidates = result.evidenceAnalysis!.candidates;
    const actual = candidates
      .filter((item) => item.sources.includes(label))
      .map((item) => item.name)
      .sort();
    assert.deepEqual(actual, expected, `${scope} 主动干候选应使用六甲遁干`);
    const activeIndex = candidates.findIndex((item) => item.sources.includes(label));
    const backgroundBeforeActive = candidates
      .slice(0, activeIndex)
      .some((item) =>
        item.sources.some(
          (source) =>
            ['年干落宫', '月干落宫', '日干落宫', '时干落宫'].includes(source) && source !== label,
        ),
      );
    assert.equal(backgroundBeforeActive, false, `${scope} 主动源应优先于年/月/日/时背景源`);
    assert.ok(result.evidenceAnalysis!.methodology.some((item) => item.includes('当前排盘范围')));
  }
});

test('年、月、日家候选来源不随更短周期干支变化', () => {
  const cases = [
    ['year', '2025-03-10T02:00:00Z', '2025-09-10T19:00:00Z', ['日干落宫', '时干落宫']],
    ['month', '2025-06-18T02:00:00Z', '2025-06-26T19:00:00Z', ['日干落宫', '时干落宫']],
    ['day', '2025-06-18T02:00:00Z', '2025-06-18T10:00:00Z', ['时干落宫']],
  ] as const;

  for (const [scope, firstTime, secondTime, shorterSources] of cases) {
    const first = generateQimenFromSource(new Date(firstTime), 'zhuanpan', scope, 'chaibu', 480);
    const second = generateQimenFromSource(new Date(secondTime), 'zhuanpan', scope, 'chaibu', 480);
    assert.equal(first.ganzhi[scope], second.ganzhi[scope]);
    assert.deepEqual(
      first.evidenceAnalysis!.candidates,
      second.evidenceAnalysis!.candidates,
      `${scope} 候选宫与来源应稳定`,
    );
    for (const data of [first, second]) {
      assert.ok(
        data.evidenceAnalysis!.candidates.every(({ sources }) =>
          sources.every((source) => !(shorterSources as readonly string[]).includes(source)),
        ),
        `${scope} 不应采用较短周期干源`,
      );
    }
  }
});

test('奇门同宫空迫按宫汇总，门迫格局不重复列为自身条件', () => {
  const data = cloneFixedBoard();
  const [first, second] = data.jiuGongGe;
  data.classicPatterns = [
    { name: '中性组合', type: 'neutral', summary: '组合', palaces: [first.gong] },
    { name: '同宫旁格', type: 'bad', summary: '组合', palaces: [first.gong] },
    { name: '吉格组合', type: 'good', summary: '组合', palaces: [second.gong] },
  ];
  data.patternTags = [`门迫（${first.name}、${second.name}）`];
  data.voidPalaces = [{ branch: '子', palace: first.gong, name: first.name }];
  const fulfillments = evaluateQimenPatternFulfillment(data);
  assert.equal(fulfillments.length, 3);
  assert.match(fulfillments[0], /中性格局.*空亡、门迫/);
  assert.doesNotMatch(fulfillments[0], /吉力|凶势|减弱|虚浮/);
  assert.match(fulfillments[2], /吉格.*门迫/);
  assert.doesNotMatch(fulfillments[2], /同宫见空亡/);
  assert.deepEqual(formatQimenPatternConditionSummary(data), [
    `${first.name}同宫见空亡、门迫`,
    `${second.name}同宫见门迫`,
  ]);
  data.patternTags = [];
  data.classicPatterns.push({
    name: '门迫',
    type: 'bad',
    summary: '门克宫',
    palaces: [second.gong],
  });
  const structured = formatQimenPatternConditionSummary(data);
  assert.deepEqual(structured, [`${first.name}同宫见空亡`, `${second.name}同宫见门迫`]);
  const menPoFulfillment = evaluateQimenPatternFulfillment(data).find((item) =>
    item.startsWith('【门迫】'),
  );
  assert.ok(menPoFulfillment);
  assert.doesNotMatch(menPoFulfillment, /同宫见门迫/);
  data.classicPatterns = data.classicPatterns.filter((pattern) => pattern.name === '门迫');
  assert.deepEqual(formatQimenPatternConditionSummary(data), []);
  const actual = clonePromptBoard();
  actual.classicPatterns = actual.classicPatterns?.filter((pattern) => pattern.name === '门迫');
  assert.ok(actual.classicPatterns?.length);
  assert.deepEqual(formatQimenPatternConditionSummary(actual), []);
  assert.doesNotMatch(formatEnhancedDivinationInfo('qimen', actual), /格局条件：/);
});

test('奇门格局空亡事实由旬空位置映射承载，应期来源不重复触发条件', () => {
  const data = clonePromptBoard();
  const palace = data.jiuGongGe[0];
  const actualPattern = data.classicPatterns!.find((item) => item.palaces.includes(palace.gong))!;
  assert.ok(actualPattern);
  data.classicPatterns = [structuredClone(actualPattern)];
  data.voidPalaces = [{ branch: '子', palace: palace.gong, name: palace.name }];
  delete data.patternCombos;
  data.evidenceAnalysis = analyzeQimenEvidence(data);
  const trigger = '驿马发动，出现行动时触发进展';
  assert.ok(data.yingQi);
  data.yingQi.sources.push(trigger);
  data.yingQi.triggerConditions.push(trigger);
  const prompt = formatEnhancedDivinationInfo('qimen', data);
  assert.doesNotMatch(prompt, /格局条件：/);
  assert.match(prompt, /旬空与马星：旬空子空落坎一宫/u);
  const palaceLine = prompt
    .split('\n')
    .find((line) => line.trimStart().startsWith(`${palace.name}（`));
  assert.doesNotMatch(palaceLine ?? '', /逢空/u);
  assert.ok(prompt.includes(actualPattern.name));
  assert.ok(prompt.includes(palace.name));
  assert.match(
    prompt,
    new RegExp(
      `${palace.name}（[^\n]*天盘[^\n]*${palace.tianPan.stem}[^\n]*地盘${palace.diPan.stem}`,
    ),
  );
  assert.doesNotMatch(prompt, /结合本次用神与宫门星神，分别核对结果、程度和落实迟速/);
  assert.equal(prompt.split(trigger).length - 1, 1);
  assert.equal(prompt.split('触发条件：').length - 1, 1);
  assert.ok(prompt.split('触发条件：')[1]?.split('\n').includes(`  ${trigger}`));
});

test('奇门提示词按问题展示专项复合格局，结构化盘面仍保留完整命中', () => {
  const data = clonePromptBoard();
  assert.ok(data.patternCombos?.some((item) => item.name === '射覆物象克应'));
  assert.ok(data.patternCombos?.some((item) => item.name === '星宫主客'));

  const ordinary = formatEnhancedDivinationInfo('qimen', data, '工作进展如何？');
  assert.doesNotMatch(ordinary, /来源[：:]|标签[：:]|限制[：:]/);
  assert.match(ordinary, /盘面命中格局：/);
  assert.doesNotMatch(ordinary, /主此宫事务受阻|主破败损失|所谋之事有贵人暗助|百事可为/);
  assert.match(ordinary, /旬空与马星：旬空子空落坎一宫、丑空落艮八宫/u);
  const ordinaryPalaceTable = ordinary.split('九宫简表：\n')[1]?.split('\n同干定位：')[0] ?? '';
  assert.doesNotMatch(ordinaryPalaceTable, /逢空|马星/u);
  assert.match(ordinary, /门迫（凶格）：惊门（金）克巽四宫（木）/);
  assert.doesNotMatch(ordinary, /^候选宫.+(?:盘面洞察|经典格局)/m);
  assert.doesNotMatch(ordinary, /格局条件：/);
  assert.doesNotMatch(
    ordinary,
    /八门余气|十干迫制|值符开通闭塞|三胜地|射覆物象克应|星宫主客|飞鸟跌穴利客|迷路法/,
  );

  const military = formatEnhancedDivinationInfo('qimen', data, '军事演习的行军攻守如何安排？');
  assert.match(military, /星宫主客|飞鸟跌穴利客/);
  assert.match(military, /迷路法/);
  const militaryCombos = military.split('复合格局：\n')[1]?.split('\n值符宫应期参考：')[0] ?? '';
  assert.match(militaryCombos, /飞鸟跌穴利客（兑七宫）：合/);
  assert.doesNotMatch(militaryCombos, /：该格局[，；]/);
  assert.doesNotMatch(militaryCombos, /兑七宫飞鸟跌穴，合/);
  const flyingBirdShengMen = militaryCombos
    .split('\n')
    .find((line) => line.startsWith('飞鸟会生门（兑七宫）：'));
  assert.match(flyingBirdShengMen ?? '', /^飞鸟会生门（兑七宫）：合“会合生门相助/u);
  assert.doesNotMatch(flyingBirdShengMen ?? '', /同宫生门/u);
  assert.match(military, /兑七宫（正西，金）：门生门/u);
  assert.match(military, /兑七宫（正西，金）：[^\n]*天盘(?:壬、)?丙[^\n]*地盘戊/u);
  assert.match(military, /飞鸟跌穴（吉格，兑七宫）/u);
  assert.doesNotMatch(military, /射覆物象克应|不作通用吉凶评分|不替代通用吉格评分/);

  const object = formatEnhancedDivinationInfo('qimen', data, '寻找丢失的手表');
  assert.match(object, /射覆物象克应/);
  assert.doesNotMatch(object, /星宫主客/);

  const travel = formatEnhancedDivinationInfo('qimen', data, '出行路线怎么选？');
  assert.match(travel, /迷路法|天马方|孤虚/);
  assert.doesNotMatch(travel, /星宫主客|射覆物象克应|四神用方/);
  const timing = formatEnhancedDivinationInfo('qimen', data, '什么时候适合推进？');
  assert.match(timing, /值符开通闭塞/);
  assert.doesNotMatch(timing, /八门余气|星宫主客/);
  const door = formatEnhancedDivinationInfo('qimen', data, '八门旺衰如何？');
  assert.match(door, /八门余气/);
  const cooperation = formatEnhancedDivinationInfo('qimen', data, '职场合作的主客关系如何？');
  assert.doesNotMatch(cooperation, /星宫主客|飞鸟跌穴利客/);
  const escape = formatEnhancedDivinationInfo('qimen', data, '避难时怎样隐蔽？');
  assert.match(escape, /四神用方/);
  assert.ok(ordinary.length < military.length);
});
