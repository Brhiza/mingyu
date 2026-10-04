import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  evaluateTaiyiConditions,
  evaluateTaiyiTacticGuidance,
  generateTaiyi,
  TAIYI_16_GODS,
  TAIYI_PALACES,
} from '../packages/core/src/taiyi/index.ts';
import {
  TAIYI_GATE_ORDER,
  TAIYI_GATE_PALACE_ORDER,
  TAIYI_POINT_WUXING,
} from '../packages/core/src/taiyi/conditions.ts';
import { formatTaiyiInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import {
  buildDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination.ts';
import { buildTaiyiEvidence } from '../packages/core/src/taiyi/evidence.ts';
import { getTaiyiPalaces, getTaiyiSixteenGods } from '../packages/core/src/taiyi/fixed-data.ts';

test('太乙阳遁十三、二十二、二十八局与金镜式经卷六局式一致', () => {
  // 《太乙金鏡式經》卷六的三则日计古例只用于独立比对同局静态盘式；
  // 此处以现代年计重现局号，不据此核验古日计积数或纪元。
  // https://zh.wikisource.org/wiki/太乙金鏡式經_(四庫全書本)/卷06
  const examples = [
    {
      year: 2056,
      bureau: 13,
      taiyiPalace: 6,
      wenChangGod: '大炅',
      shiJiGod: '太阳',
      jiShenPosition: '寅',
      lordCount: 18,
      lordGeneral: 8,
      lordAssistant: 4,
      guestCount: 19,
      guestGeneral: 9,
      guestAssistant: 7,
    },
    {
      year: 2065,
      bureau: 22,
      taiyiPalace: 9,
      wenChangGod: '阴德',
      shiJiGod: '天道',
      jiShenPosition: '巳',
      lordCount: 16,
      lordGeneral: 6,
      lordAssistant: 8,
      guestCount: 30,
      guestGeneral: 3,
      guestAssistant: 9,
    },
    {
      year: 2071,
      bureau: 28,
      taiyiPalace: 2,
      wenChangGod: '吕申',
      shiJiGod: '大炅',
      jiShenPosition: '亥',
      lordCount: 14,
      lordGeneral: 4,
      lordAssistant: 2,
      guestCount: 9,
      guestGeneral: 9,
      guestAssistant: 7,
    },
  ] as const;

  for (const { year, wenChangGod, shiJiGod, ...expected } of examples) {
    const result = generateTaiyi({ scope: 'year', year });
    const godAt = (position: string) =>
      result.sixteenGods.find((item) => item.branch === position)?.god;
    assert.deepEqual(
      {
        bureau: result.bureau,
        taiyiPalace: result.taiyiPalace,
        wenChangGod: godAt(result.wenChangPosition),
        shiJiGod: godAt(result.shiJiPosition),
        jiShenPosition: result.jiShenPosition,
        lordCount: result.lordCount,
        lordGeneral: result.lordGeneral,
        lordAssistant: result.lordAssistant,
        guestCount: result.guestCount,
        guestGeneral: result.guestGeneral,
        guestAssistant: result.guestAssistant,
      },
      { ...expected, wenChangGod, shiJiGod },
      `卷六阳遁第${expected.bureau}局`,
    );
  }
});

test('太乙在线任务书合并实际条件，并按盘面重算而忽略旧盘缓存', () => {
  const result = generateTaiyi({ year: 2004, scope: 'year' });
  const text = formatTaiyiInfo(result);
  assert.match(text, /三门：两门不具；直使生门；太乙生门、文昌（主目）景门/);
  assert.match(text, /五将：不发/);
  assert.match(text, /阴阳：不和（太乙-客算、始击-客算）/);
  assert.doesNotMatch(text, /门位事实：|将目关系：|阴阳配对：|二目五行：/);
  assert.equal((text.match(/始击与太乙同宫/g) ?? []).length, 1);
  assert.doesNotMatch(text, /2004-07-01/);
  assert.doesNotMatch(text, /taiyi:|usedFor|complete:|step\.key|三门三门/);
  const legacy = formatTaiyiInfo({ ...result, tacticGuidance: '' });
  assert.doesNotMatch(legacy, /利主不利客|利客不利主/);
  const expectedResult = structuredClone(result);
  Reflect.set(result.model, 'name', '本次模型备注');
  Reflect.set(result.model, 'precision', '本次精度备注');
  result.model.supportedScopes.pop();
  Reflect.set(result.model.sources[0], 'evidence', '本次依据备注');
  assert.notDeepEqual(result.model, expectedResult.model);
  const fresh = generateTaiyi({ year: 2004, scope: 'year' });
  assert.deepEqual(fresh, expectedResult);
  assert.equal(formatTaiyiInfo(fresh), text);

  const expectedLaunched = result.conditions.fiveGenerals.launched;
  result.conditions.fiveGenerals.launched = !expectedLaunched;
  result.judgments.push('旧盘缓存：此占必胜。');

  for (const prompt of [
    formatTaiyiInfo(result),
    buildDivinationPrompt({
      method: 'taiyi',
      data: result,
      question: '请分析当前问题。',
    }),
  ]) {
    assert.match(prompt, new RegExp(`五将：${expectedLaunched ? '发' : '不发'}`));
    assert.doesNotMatch(prompt, /此占必胜/u);
  }

  const catalogInput = { year: 2025, scope: 'year' } as const;
  const baseline = generateTaiyi(catalogInput);
  const currentTime = new Date('2025-06-01T04:00:00.000Z');
  const question = '本次太乙主客与三门条件如何？';
  const baselineTaskbook = buildDivinationPrompt({
    method: 'taiyi',
    data: baseline,
    question,
    currentTime,
  });
  assert.equal(baseline.ganZhi, '乙巳');
  assert.equal(baseline.taiyiPalace, 2);
  assert.equal(baseline.taiyiDir, '南');
  assert.deepEqual(baseline.sixteenGods[0], { branch: '子', god: '地主' });
  assert.equal(baseline.conditions.threeGates.directGate, '伤门');
  assert.equal(baseline.conditions.threeGates.status, '三门具');
  assert.deepEqual(
    [
      baseline.conditions.fiveGenerals.hostGuestElementRelation.hostPosition,
      baseline.conditions.fiveGenerals.hostGuestElementRelation.hostElement,
      baseline.conditions.fiveGenerals.hostGuestElementRelation.guestPosition,
      baseline.conditions.fiveGenerals.hostGuestElementRelation.guestElement,
    ],
    ['坤', '土', '子', '水'],
  );
  assert.equal(baseline.conditions.fiveGenerals.hostGuestElementRelation.complete, false);
  assert.equal(baseline.conditions.fiveGenerals.hostGuestElementRelation.relation, '未判定');
  assert.match(baselineTaskbook, /本次太乙主客与三门条件如何？/);
  assert.match(baselineTaskbook, /三门：三门具；直使伤门/);
  assert.match(baselineTaskbook, /子地主/);

  const consumers = (data: typeof baseline) => ({
    facts: buildTaiyiEvidence(data),
    native: data.prompt,
    formatted: formatTaiyiInfo(data),
    fullTask: buildDivinationPrompt({ method: 'taiyi', data, question, currentTime }),
    summary: getDivinationSummaryBlocks('taiyi', data),
  });
  const baselineConsumers = consumers(baseline);
  assert.deepEqual(consumers(JSON.parse(JSON.stringify(baseline))), baselineConsumers);
  assert.deepEqual(baseline.countNatures, { lord: '下和', guest: '杂重阴', set: '纯阳' });
  const mutations = [
    { mutate: (data: typeof baseline) => (data.sixteenGods[0].god = '变造神名'), error: /十六神/ },
    {
      mutate: (data: typeof baseline) => {
        data.taiyiGua = '坎';
        data.taiyiDir = '北';
      },
      error: /宫位与卦象、方位/,
    },
    { mutate: (data: typeof baseline) => (data.countNatures!.lord = '纯阳'), error: /算性/ },
  ];
  for (const { mutate, error } of mutations) {
    const bad = structuredClone(baseline);
    mutate(bad);
    assert.notDeepEqual(bad, baseline);
    assert.equal(bad.prompt, baselineConsumers.native);
    for (const consume of [
      () => buildTaiyiEvidence(bad),
      () => formatTaiyiInfo(bad),
      () => buildDivinationPrompt({ method: 'taiyi', data: bad, question, currentTime }),
      () => getDivinationSummaryBlocks('taiyi', bad),
    ]) {
      assert.throws(consume, error);
    }
  }
  for (const countNatures of [undefined, { guest: '杂重阴', set: '纯阳' }]) {
    const legacyData = { ...baseline, countNatures };
    const legacyConsumers = consumers(legacyData);
    assert.equal(legacyConsumers.facts.forceFacts[0].nature, undefined);
    assert.deepEqual(
      legacyConsumers.facts.forceFacts.map((fact) => fact.count),
      baselineConsumers.facts.forceFacts.map((fact) => fact.count),
    );
    assert.equal(legacyConsumers.native, baselineConsumers.native);
    assert.equal(legacyConsumers.formatted, baselineConsumers.formatted);
    assert.equal(legacyConsumers.fullTask, baselineConsumers.fullTask);
    assert.deepEqual(legacyConsumers.summary, baselineConsumers.summary);
  }
  const omittedPalaceMetadata = structuredClone(baseline);
  Reflect.deleteProperty(omittedPalaceMetadata, 'taiyiGua');
  Reflect.deleteProperty(omittedPalaceMetadata, 'taiyiDir');
  assert.doesNotThrow(() => consumers(omittedPalaceMetadata));

  const palaceCopy = getTaiyiPalaces();
  const godCopy = getTaiyiSixteenGods();
  const originalPalaces = getTaiyiPalaces();
  const originalGods = getTaiyiSixteenGods();
  assert.notStrictEqual(palaceCopy, originalPalaces);
  assert.notStrictEqual(palaceCopy[2], originalPalaces[2]);
  assert.notStrictEqual(godCopy, originalGods);
  assert.notStrictEqual(godCopy[0], originalGods[0]);
  assert.equal(Reflect.set(palaceCopy[2], 'dir', '北'), true);
  assert.equal(Reflect.set(godCopy[0], 'name', '变造神名'), true);
  godCopy.reverse();
  assert.equal(palaceCopy[2].dir, '北');
  assert.equal(godCopy.at(-1)!.name, '变造神名');
  assert.deepEqual(getTaiyiPalaces(), originalPalaces);
  assert.deepEqual(getTaiyiSixteenGods(), originalGods);

  // 公开资料仍可改写；新盘使用固定盘式，二目五行同时核结构资料。
  const catalogWrites = [
    [TAIYI_16_GODS[0], 'name', '本次神名'],
    [TAIYI_PALACES[2], 'dir', '本次方位'],
    [TAIYI_GATE_ORDER, 3, '杜门'],
    [TAIYI_GATE_PALACE_ORDER, 0, 2],
    [TAIYI_POINT_WUXING, '坤', '水'],
  ] as const;
  const originalValues = catalogWrites.map(([target, key]) => Reflect.get(target, key));
  try {
    for (const [target, key, value] of catalogWrites) {
      assert.equal(Reflect.set(target, key, value), true);
      assert.equal(Reflect.get(target, key), value);
    }
    const freshCatalog = generateTaiyi(catalogInput);
    assert.deepEqual(consumers(freshCatalog), baselineConsumers);
    assert.deepEqual(getTaiyiPalaces(), originalPalaces);
    assert.deepEqual(getTaiyiSixteenGods(), originalGods);
    assert.deepEqual(freshCatalog, baseline);
    assert.equal(freshCatalog.prompt, baseline.prompt);
    assert.equal(
      buildDivinationPrompt({ method: 'taiyi', data: freshCatalog, question, currentTime }),
      baselineTaskbook,
    );
    assert.equal(freshCatalog.conditions.fiveGenerals.hostGuestElementRelation.hostElement, '土');
    assert.equal(freshCatalog.conditions.fiveGenerals.hostGuestElementRelation.guestElement, '水');
  } finally {
    catalogWrites.forEach(([target, key], index) => {
      assert.equal(Reflect.set(target, key, originalValues[index]), true);
      assert.equal(Reflect.get(target, key), originalValues[index]);
    });
  }
});

test('太乙巽位十六神名称传入盘面证据与任务书', () => {
  const result = generateTaiyi({ year: 2026, scope: 'year' });
  assert.deepEqual(
    result.sixteenGods.find((item) => item.branch === '巽'),
    {
      branch: '巽',
      god: '大炅',
    },
  );
  assert.match(result.prompt, /巽大炅/);
  assert.match(result.evidenceAnalysis.promptText, /巽大炅/);
  assert.match(formatTaiyiInfo(result), /巽大炅/);
});

test('太乙二目五行关系未完成日计纳音复算时不进入在线任务书', () => {
  const result = generateTaiyi({ year: 1974, scope: 'year' });
  const relation = result.conditions.fiveGenerals.hostGuestElementRelation;
  assert.equal(relation.relation, '未判定');
  assert.equal(relation.complete, false);
  assert.match(relation.basis, /未接入独立日计纳音判层/);
  assert.equal(relation.hostElement, '土');
  assert.equal(relation.guestElement, '水');
  assert.match(
    result.evidenceAnalysis.conditionFacts.find((fact) => fact.kind === '五将')?.calculationText ??
      '',
    /日计纳音判层未复算/,
  );
  for (const text of [formatTaiyiInfo(result), result.prompt, result.evidenceAnalysis.promptText]) {
    assert.doesNotMatch(text, /二目五行：|主关客|客关主|未复算|纳音判层/);
  }
  assert.doesNotMatch(JSON.stringify(result), /主关客|客关主/);
});

test('太乙阳遁二三局按十六神原位区分掩击与囚迫', () => {
  // 《太乙秘书》阳遁第二局：太乙一宫，始击阴主（戌）击；
  // 第三局：太乙一宫，天目阴主（戌）辰迫。
  const second = generateTaiyi({ year: 1973, scope: 'year' });
  assert.equal(second.bureau, 2);
  assert.equal(second.taiyiPosition, '乾');
  assert.equal(second.shiJiPosition, '戌');
  assert.equal(second.conditions.fiveGenerals.shiJiRelationToTaiyi, '击');
  assert.equal(second.conditions.fiveGenerals.shiJiNoCoverOrHit, false);
  assert.equal(
    second.evidenceAnalysis.conditionFacts.find((fact) => fact.kind === '掩')?.matched,
    false,
  );
  assert.ok(!second.judgments.some((item) => item.startsWith('掩：')));
  assert.doesNotMatch(second.evidenceAnalysis.promptText, /掩成立/);

  const third = generateTaiyi({ year: 1974, scope: 'year' });
  assert.equal(third.bureau, 3);
  assert.equal(third.taiyiPosition, '乾');
  assert.equal(third.wenChangPosition, '戌');
  assert.equal(third.conditions.fiveGenerals.wenChangRelationToTaiyi, '迫');
  assert.equal(third.conditions.fiveGenerals.wenChangNoImprisonOrPressure, false);
  assert.ok(!third.judgments.some((item) => item.includes('文昌与太乙同宫')));
  assert.ok(!third.evidenceAnalysis.primaryFacts.some((item) => /囚成立：文昌/u.test(item)));

  const twentyFifth = generateTaiyi({ year: 1996, scope: 'year' });
  assert.equal(twentyFifth.bureau, 25);
  assert.equal(twentyFifth.taiyiPosition, '乾');
  assert.equal(twentyFifth.shiJiPosition, '亥');
  assert.equal(twentyFifth.conditions.fiveGenerals.shiJiRelationToTaiyi, '击');

  const thirtySecond = generateTaiyi({ year: 2003, scope: 'year' });
  assert.equal(thirtySecond.bureau, 32);
  assert.equal(thirtySecond.taiyiPosition, '艮');
  assert.equal(thirtySecond.shiJiPosition, '子');
  assert.equal(thirtySecond.conditions.fiveGenerals.shiJiRelationToTaiyi, '击');
});

test('太乙十六位环首尾相接且三位外不计击', () => {
  const base = {
    accumulatedValue: 1,
    taiyiPosition: '子',
    taiyiPalace: 8,
    wenChangPosition: '午',
    wenChangPalace: 2,
    lordCount: 7,
    guestCount: 13,
    lordGeneral: 7,
    lordAssistant: 1,
    guestGeneral: 3,
    guestAssistant: 9,
  } as const;
  const adjacent = evaluateTaiyiConditions({
    ...base,
    shiJiPosition: '亥',
    shiJiPalace: 8,
  });
  assert.equal(adjacent.fiveGenerals.shiJiRelationToTaiyi, '击');
  const distant = evaluateTaiyiConditions({
    ...base,
    shiJiPosition: '酉',
    shiJiPalace: 6,
  });
  assert.equal(distant.fiveGenerals.shiJiRelationToTaiyi, undefined);
  assert.equal(distant.fiveGenerals.shiJiNoCoverOrHit, true);
});

test('太乙年计在线任务书保留成立条件并将门将摘要只呈现一次', () => {
  const withCover = generateTaiyi({ year: 2004, scope: 'year' });
  const twentyTwentySix = generateTaiyi({ year: 2026, scope: 'year' });
  assert.match(withCover.evidenceAnalysis.promptText, /掩成立：始击与太乙同宫/);
  assert.doesNotMatch(
    withCover.evidenceAnalysis.promptText,
    /2004-07-01|结构化证据|反证核验|证据汇总|解释限制/,
  );
  for (const year of [2004, 2026]) {
    const result = year === 2004 ? withCover : twentyTwentySix;
    assert.match(result.evidenceAnalysis.promptText, /囚成立：客大将与太乙同宫/);
    assert.doesNotMatch(result.evidenceAnalysis.promptText, /文昌或主客大小将至少一项/);
  }

  // 1950 年阳遁五十一局：太乙乾一、文昌离二、始击坤七、客大将艮三。
  const withoutCoverOrImprison = generateTaiyi({ year: 1950, scope: 'year' });
  assert.deepEqual(
    [
      withoutCoverOrImprison.bureau,
      withoutCoverOrImprison.taiyiPalace,
      withoutCoverOrImprison.wenChangPalace,
      withoutCoverOrImprison.shiJiPalace,
      withoutCoverOrImprison.guestGeneral,
    ],
    [51, 1, 2, 7, 3],
  );
  assert.deepEqual(
    withoutCoverOrImprison.evidenceAnalysis.conditionFacts
      .filter((fact) => fact.kind === '掩' || fact.kind === '囚')
      .map((fact) => [fact.kind, fact.matched]),
    [
      ['掩', false],
      ['囚', false],
    ],
  );
  assert.doesNotMatch(
    withoutCoverOrImprison.evidenceAnalysis.promptText,
    /掩成立|囚成立|未见掩|未见囚|条件未成立/,
  );
  for (const label of ['三门', '五将', '阴阳']) {
    assert.equal(withoutCoverOrImprison.evidenceAnalysis.promptText.split(label).length - 1, 1);
  }
  for (const result of [withCover, twentyTwentySix]) {
    const conditions = result.conditions;
    const summary = `${conditions.threeGates.status}（直使${conditions.threeGates.directGate}）；五将${conditions.fiveGenerals.launched ? '发' : '不发'}；阴阳${conditions.yinYangHarmony.matched ? '和' : '不和'}。`;
    assert.equal(result.prompt.split(summary).length - 1, 1);
    assert.ok(result.prompt.includes('主门具按太乙与文昌（主目）是否临开、休、生门判定'));
    const enhanced = formatTaiyiInfo(result);
    assert.ok(!enhanced.includes(summary));
    assert.equal(enhanced.split(`直使${conditions.threeGates.directGate}`).length - 1, 1);
    for (const text of [result.prompt, enhanced]) {
      assert.match(text, /主客吉凶条件相等时，再以算之长短比较/);
      assert.doesNotMatch(text, /盘面条件：/);
      for (const judgment of result.judgments) {
        if (judgment !== summary && !/^(主算|客算|定算)\s*\d+\s*为/u.test(judgment)) {
          assert.ok(text.includes(judgment), judgment);
        }
      }
    }
    for (const role of conditions.threeGates.blockedRoles) {
      assert.ok(result.prompt.includes(role));
    }
    const withoutNatures = formatTaiyiInfo({ ...result, countNatures: undefined });
    const countNatureLine = `主客定算：主算${result.lordCount}${result.countNatures?.lord ? `（${result.countNatures.lord}）` : ''}；客算${result.guestCount}${result.countNatures?.guest ? `（${result.countNatures.guest}）` : ''}；定算${result.setCount}${result.countNatures?.set ? `（${result.countNatures.set}）` : ''}`;
    assert.ok(withoutNatures.includes(countNatureLine));
    for (const judgment of result.judgments.filter((item) =>
      /^(主算|客算|定算)\s*\d+\s*为/u.test(item),
    )) {
      assert.equal(enhanced.includes(judgment), false);
    }
    if (result.countNatures?.set) {
      assert.ok(enhanced.includes(`定算${result.setCount}（${result.countNatures.set}）`));
    }
    assert.match(result.tacticGuidance, /盘面条件：/);
  }
});

type TaiyiTruthRow = readonly [
  year: number,
  accumulatedYears: number,
  bureau: number,
  taiyi: string,
  wenChang: string,
  shiJi: string,
  jiShen: string,
  taiSui: string,
  lordCount: number,
  guestCount: number,
  setCount: number,
];

// 宫目、主客算参照 Kintaiyi 固定版本与《太乙金镜式经》逐宫推法；
// 定算按《武备志》卷一百六十九的六合定目和正间逐宫取算校准。
const TAIYI_TRUTH: TaiyiTruthRow[] = [
  [1950, 10155867, 51, '乾', '午', '坤', '子', '寅', 15, 13, 6],
  [1951, 10155868, 52, '午', '未', '酉', '亥', '卯', 39, 31, 24],
  [1952, 10155869, 53, '午', '坤', '亥', '戌', '辰', 38, 25, 14],
  [1953, 10155870, 54, '午', '坤', '子', '酉', '巳', 38, 24, 9],
  [1954, 10155871, 55, '艮', '申', '艮', '申', '午', 16, 3, 22],
  [1955, 10155872, 56, '艮', '酉', '辰', '未', '未', 15, 34, 10],
  [1956, 10155873, 57, '艮', '戌', '巳', '午', '申', 10, 25, 1],
  [1957, 10155874, 58, '卯', '乾', '未', '巳', '酉', 12, 26, 37],
  [1958, 10155875, 59, '卯', '乾', '申', '辰', '戌', 12, 19, 28],
  [1959, 10155876, 60, '卯', '亥', '戌', '卯', '亥', 12, 13, 19],
  [1960, 10155877, 61, '酉', '子', '亥', '寅', '子', 33, 34, 34],
  [1961, 10155878, 62, '酉', '丑', '艮', '丑', '丑', 26, 25, 25],
  [1962, 10155879, 63, '酉', '艮', '卯', '子', '寅', 25, 22, 18],
  [1963, 10155880, 64, '坤', '寅', '巽', '亥', '卯', 16, 11, 7],
  [1964, 10155881, 65, '坤', '卯', '未', '戌', '辰', 15, 1, 28],
  [1965, 10155882, 66, '坤', '辰', '申', '酉', '巳', 12, 34, 19],
  [1966, 10155883, 67, '子', '巽', '戌', '申', '午', 25, 2, 26],
  [1967, 10155884, 68, '子', '巳', '子', '未', '未', 17, 8, 16],
  [1968, 10155885, 69, '子', '午', '艮', '午', '申', 16, 32, 7],
  [1969, 10155886, 70, '巽', '未', '卯', '巳', '酉', 30, 4, 15],
  [1970, 10155887, 71, '巽', '坤', '巳', '辰', '戌', 29, 32, 5],
  [1971, 10155888, 72, '巽', '坤', '午', '卯', '亥', 29, 31, 9],
  [1972, 10155889, 1, '乾', '申', '坤', '寅', '子', 7, 13, 13],
  [1973, 10155890, 2, '乾', '酉', '戌', '丑', '丑', 6, 1, 1],
  [1974, 10155891, 3, '乾', '戌', '亥', '子', '寅', 1, 40, 32],
  [1975, 10155892, 4, '午', '乾', '丑', '亥', '卯', 25, 17, 10],
  [1976, 10155893, 5, '午', '乾', '寅', '戌', '辰', 25, 14, 1],
  [1977, 10155894, 6, '午', '亥', '辰', '酉', '巳', 25, 10, 32],
  [1978, 10155895, 7, '艮', '子', '巳', '申', '午', 8, 25, 9],
  [1979, 10155896, 8, '艮', '丑', '坤', '未', '未', 1, 22, 3],
  [1980, 10155897, 9, '艮', '艮', '酉', '午', '申', 3, 15, 33],
  [1981, 10155898, 10, '卯', '寅', '乾', '巳', '酉', 1, 12, 25],
  [1982, 10155899, 11, '卯', '卯', '丑', '辰', '戌', 4, 4, 13],
  [1983, 10155900, 12, '卯', '辰', '寅', '卯', '亥', 37, 1, 4],
  [1984, 10155901, 13, '酉', '巽', '辰', '寅', '子', 18, 19, 19],
  [1985, 10155902, 14, '酉', '巳', '午', '丑', '丑', 10, 9, 9],
  [1986, 10155903, 15, '酉', '午', '坤', '子', '寅', 9, 7, 6],
  [1987, 10155904, 16, '坤', '未', '酉', '亥', '卯', 1, 33, 26],
  [1988, 10155905, 17, '坤', '坤', '亥', '戌', '辰', 7, 27, 16],
  [1989, 10155906, 18, '坤', '坤', '子', '酉', '巳', 7, 26, 11],
  [1990, 10155907, 19, '子', '申', '艮', '申', '午', 8, 32, 14],
  [1991, 10155908, 20, '子', '酉', '辰', '未', '未', 7, 26, 2],
  [1992, 10155909, 21, '子', '戌', '巳', '午', '申', 2, 17, 33],
  [1993, 10155910, 22, '巽', '乾', '未', '巳', '酉', 16, 30, 1],
  [1994, 10155911, 23, '巽', '乾', '申', '辰', '戌', 16, 23, 32],
  [1995, 10155912, 24, '巽', '亥', '戌', '卯', '亥', 16, 17, 23],
  [1996, 10155913, 25, '乾', '子', '亥', '寅', '子', 39, 40, 40],
  [1997, 10155914, 26, '乾', '丑', '艮', '丑', '丑', 32, 31, 31],
  [1998, 10155915, 27, '乾', '艮', '卯', '子', '寅', 31, 28, 24],
  [1999, 10155916, 28, '午', '寅', '巽', '亥', '卯', 14, 9, 38],
  [2000, 10155917, 29, '午', '卯', '未', '戌', '辰', 13, 39, 26],
  [2001, 10155918, 30, '午', '辰', '申', '酉', '巳', 10, 32, 17],
  [2002, 10155919, 31, '艮', '巽', '戌', '申', '午', 33, 10, 34],
  [2003, 10155920, 32, '艮', '巳', '子', '未', '未', 25, 8, 24],
  [2004, 10155921, 33, '艮', '午', '艮', '午', '申', 24, 3, 15],
  [2005, 10155922, 34, '卯', '未', '卯', '巳', '酉', 26, 4, 11],
  [2006, 10155923, 35, '卯', '坤', '巳', '辰', '戌', 25, 28, 1],
  [2007, 10155924, 36, '卯', '坤', '午', '卯', '亥', 25, 27, 36],
  [2008, 10155925, 37, '酉', '申', '坤', '寅', '子', 1, 7, 7],
  [2009, 10155926, 38, '酉', '酉', '戌', '丑', '丑', 6, 35, 35],
  [2010, 10155927, 39, '酉', '戌', '亥', '子', '寅', 35, 34, 26],
  [2011, 10155928, 40, '坤', '乾', '丑', '亥', '卯', 27, 19, 12],
  [2012, 10155929, 41, '坤', '乾', '寅', '戌', '辰', 27, 16, 3],
  [2013, 10155930, 42, '坤', '亥', '辰', '酉', '巳', 27, 12, 34],
  [2014, 10155931, 43, '子', '子', '巳', '申', '午', 8, 17, 1],
  [2015, 10155932, 44, '子', '丑', '坤', '未', '未', 33, 14, 32],
  [2016, 10155933, 45, '子', '艮', '酉', '午', '申', 32, 7, 25],
  [2017, 10155934, 46, '巽', '寅', '乾', '巳', '酉', 5, 16, 29],
  [2018, 10155935, 47, '巽', '卯', '丑', '辰', '戌', 4, 8, 17],
  [2019, 10155936, 48, '巽', '辰', '寅', '卯', '亥', 1, 5, 8],
  [2020, 10155937, 49, '乾', '巽', '辰', '寅', '子', 24, 25, 25],
  [2021, 10155938, 50, '乾', '巳', '午', '丑', '丑', 16, 15, 15],
];

const TAIYI_PALACE_GUA = new Map<number, string>([
  [1, '乾'],
  [2, '离'],
  [3, '艮'],
  [4, '震'],
  [6, '兑'],
  [7, '坤'],
  [8, '坎'],
  [9, '巽'],
]);

test('太乙年计 1950-2021 七十二局与独立真值全对拍', () => {
  const bureaus = new Set(TAIYI_TRUTH.map((row) => row[2]));
  const palaceGua = new Map<number, string>();
  assert.equal(bureaus.size, 72);
  for (let bureau = 1; bureau <= 72; bureau += 1) {
    assert.ok(bureaus.has(bureau), `真值表缺少第 ${bureau} 局`);
  }

  for (const row of TAIYI_TRUTH) {
    const [
      year,
      accumulatedYears,
      bureau,
      taiyi,
      wenChang,
      shiJi,
      jiShen,
      taiSui,
      lordCount,
      guestCount,
      setCount,
    ] = row;
    const result = generateTaiyi({ year, scope: 'year' });

    assert.equal(result.accumulatedYears, accumulatedYears, `${year} 积年错误`);
    assert.equal(result.bureau, bureau, `${year} 局数错误`);
    assert.equal(result.yinYang, '阳遁', `${year} 阴阳遁错误`);
    assert.equal(result.taiyiPosition, taiyi, `${year} 太乙落宫错误`);
    palaceGua.set(result.taiyiPalace, result.taiyiGua);
    assert.equal(
      result.taiyiGua,
      TAIYI_PALACE_GUA.get(result.taiyiPalace),
      `${year} 太乙宫卦名错误`,
    );
    assert.equal(result.wenChangPosition, wenChang, `${year} 文昌落宫错误`);
    assert.equal(result.shiJiPosition, shiJi, `${year} 始击落宫错误`);
    assert.equal(result.jiShenPosition, jiShen, `${year} 计神落宫错误`);
    assert.equal(result.ganZhi.slice(-1), taiSui, `${year} 太岁错误`);
    assert.equal(result.lordCount, lordCount, `${year} 主算错误`);
    assert.equal(result.guestCount, guestCount, `${year} 客算错误`);
    assert.equal(result.setCount, setCount, `${year} 定算错误`);
  }
  assert.deepEqual(palaceGua, TAIYI_PALACE_GUA);
});

test('太乙主客定算逢整十时按九去余定大将宫', () => {
  const cases = [
    {
      year: 1969,
      count: 'lordCount',
      general: 'lordGeneral',
      assistant: 'lordAssistant',
      expected: 3,
    },
    {
      year: 1974,
      count: 'guestCount',
      general: 'guestGeneral',
      assistant: 'guestAssistant',
      expected: 4,
    },
    {
      year: 1975,
      count: 'setCount',
      general: 'setGeneral',
      assistant: 'setAssistant',
      expected: 1,
    },
    {
      year: 1993,
      count: 'guestCount',
      general: 'guestGeneral',
      assistant: 'guestAssistant',
      expected: 3,
    },
  ] as const;
  for (const { year, count, general, assistant, expected } of cases) {
    const result = generateTaiyi({ year, scope: 'year' });
    assert.equal(result[count] % 10, 0, `${year}年测试值应为整十`);
    assert.equal(result[general], expected, `${year}年${general}落宫错误`);
    assert.equal(result[assistant], (expected * 3) % 10, `${year}年${assistant}落宫错误`);
  }
});

test('太乙月计按节气、日时计按固定版本样例生成完整基础盘', () => {
  const fixtures = [
    {
      scope: 'month' as const,
      date: new Date('2026-01-15T00:00:00+08:00'),
      expected: [121871306, '阳遁', 2, '乾', '酉', '戌', '丑', 6, 1, 1],
    },
    {
      scope: 'day' as const,
      date: new Date('2026-01-15T00:00:00+08:00'),
      expected: [708056786, '阳遁', 2, '乾', '酉', '戌', '丑', 6, 1, 1],
    },
    {
      scope: 'hour' as const,
      date: new Date('2026-01-15T00:00:00+08:00'),
      expected: [8496681421, '阳遁', 13, '酉', '巽', '辰', '寅', 18, 19, 19],
    },
    {
      scope: 'month' as const,
      date: new Date('2026-07-11T14:35:00+08:00'),
      expected: [121871312, '阳遁', 8, '艮', '丑', '坤', '未', 1, 22, 3],
    },
    {
      scope: 'day' as const,
      date: new Date('2026-07-11T14:35:00+08:00'),
      expected: [708056963, '阳遁', 35, '卯', '坤', '巳', '辰', 25, 28, 1],
    },
    {
      scope: 'hour' as const,
      date: new Date('2026-07-11T14:35:00+08:00'),
      expected: [8496683552, '阴遁', 56, '坤', '卯', '辰', '丑', 15, 12, 12],
    },
  ];

  for (const fixture of fixtures) {
    const result = generateTaiyi({ scope: fixture.scope, date: fixture.date });
    assert.deepEqual(
      [
        result.accumulatedValue,
        result.yinYang,
        result.bureau,
        result.taiyiPosition,
        result.wenChangPosition,
        result.shiJiPosition,
        result.jiShenPosition,
        result.lordCount,
        result.guestCount,
        result.setCount,
      ],
      fixture.expected,
      `${fixture.scope}:${fixture.date.toISOString()}`,
    );
  }
});

test('太乙四计应严格区分年参数和日期参数', () => {
  assert.throws(
    () => generateTaiyi({ scope: 'year', year: 2026, date: new Date('2026-01-01T00:00:00+08:00') }),
    /只接受 year/,
  );
  assert.throws(() => generateTaiyi({ scope: 'month' }), /需要提供有效日期和时间/);
  assert.throws(
    () => generateTaiyi({ scope: 'day', year: 2025, date: new Date('2026-01-01T00:00:00+08:00') }),
    /year 与 date 的公历年份不一致/,
  );
});

test('太乙月计应按逐月节气换局，不能跟随农历朔日提前或延后', () => {
  const beforeLichun = generateTaiyi({
    scope: 'month',
    date: new Date('2024-02-04T16:26:00+08:00'),
  });
  const afterLichun = generateTaiyi({
    scope: 'month',
    date: new Date('2024-02-04T16:28:00+08:00'),
  });
  assert.equal(afterLichun.accumulatedValue, beforeLichun.accumulatedValue + 1);
  assert.equal(beforeLichun.ganZhi, '乙丑');
  assert.equal(afterLichun.ganZhi, '丙寅');

  const beforeJingzhe = generateTaiyi({
    scope: 'month',
    date: new Date('2024-03-05T10:22:00+08:00'),
  });
  const afterJingzhe = generateTaiyi({
    scope: 'month',
    date: new Date('2024-03-05T10:24:00+08:00'),
  });
  assert.equal(afterJingzhe.accumulatedValue, beforeJingzhe.accumulatedValue + 1);
  assert.equal(beforeJingzhe.ganZhi, '丙寅');
  assert.equal(afterJingzhe.ganZhi, '丁卯');

  const beforeLeapMonth = generateTaiyi({
    scope: 'month',
    date: new Date('2025-07-24T12:00:00+08:00'),
  });
  const leapMonthStart = generateTaiyi({
    scope: 'month',
    date: new Date('2025-07-25T12:00:00+08:00'),
  });
  const leapMonthBeforeLiqiu = generateTaiyi({
    scope: 'month',
    date: new Date('2025-08-07T00:00:00+08:00'),
  });
  const leapMonthAfterLiqiu = generateTaiyi({
    scope: 'month',
    date: new Date('2025-08-08T00:00:00+08:00'),
  });
  const nextLunarMonth = generateTaiyi({
    scope: 'month',
    date: new Date('2025-08-23T12:00:00+08:00'),
  });
  assert.equal(leapMonthStart.accumulatedValue, beforeLeapMonth.accumulatedValue);
  assert.equal(leapMonthAfterLiqiu.accumulatedValue, leapMonthBeforeLiqiu.accumulatedValue + 1);
  assert.equal(nextLunarMonth.accumulatedValue, leapMonthAfterLiqiu.accumulatedValue);
  assert.match(afterLichun.model.precision, /月计按逐月节气换局/);
  assert.equal(
    afterLichun.model.sources[0]?.url,
    'https://www.shidianguji.com/book/SK1615/chapter/1l9lir71oidda',
  );
  assert.match(afterLichun.evidenceAnalysis.promptText, /月计按逐月节气换局/);
});

test('太乙长短算按十一分界，和算结合门将审断', () => {
  const guidance = evaluateTaiyiTacticGuidance({
    lordCount: 10,
    guestCount: 11,
    guestNature: '阴中重阳',
  });
  assert.match(guidance, /主算10，为短算，传统取急而浅为/);
  assert.match(guidance, /客算11（阴中重阳），为长算，传统取缓而深入/);
  assert.match(guidance, /三门具否、五将发否、阴阳和否/);
  assert.match(guidance, /当前未传入三门、五将、阴阳和盘面事实，不能据长短单独断胜负/);
  assert.match(guidance, /吉凶条件相等时/);
  const harmony = evaluateTaiyiTacticGuidance({
    lordCount: 12,
    guestCount: 16,
    lordNature: '下和',
    guestNature: '下和',
  });
  assert.match(harmony, /主算12（下和）/);
  assert.match(harmony, /客算16（下和）/);
  assert.doesNotMatch(harmony, /调停|和解|不战屈人/);
  const result = generateTaiyi({ year: 2026 });
  assert.ok(result.prompt.includes(`大局攻守：主算${result.lordCount}`));
  assert.match(result.tacticGuidance, /盘面条件：(?:三门具|两门不具|三门不具)/);
  assert.match(result.prompt, /门将阴阳和：(?:三门具|两门不具|三门不具)/);
  assert.doesNotMatch(result.evidenceAnalysis.promptText, /taiyi:calculation:/);
  assert.equal(
    result.evidenceAnalysis.calculationSteps[4]?.result,
    result.conditions.threeGates.status,
  );
  assert.equal(
    result.evidenceAnalysis.calculationSteps[5]?.result,
    result.conditions.fiveGenerals.launched ? '发' : '不发',
  );
  assert.equal(
    result.evidenceAnalysis.calculationSteps[6]?.result,
    result.conditions.yinYangHarmony.matched ? '和' : '不和',
  );
});

test('太乙三门直使按二百四十周期每三十换门，并保留可复算条件', () => {
  const base = {
    taiyiPosition: '乾',
    taiyiPalace: 1,
    wenChangPosition: '子',
    wenChangPalace: 8,
    shiJiPosition: '艮',
    shiJiPalace: 3,
    lordCount: 2,
    guestCount: 3,
    lordGeneral: 2,
    lordAssistant: 6,
    guestGeneral: 3,
    guestAssistant: 9,
  } as const;
  const first = generateTaiyi({ year: 2026 });
  assert.equal(
    first.conditions.threeGates.gateByPalace[first.taiyiPalace],
    first.conditions.threeGates.directGate,
  );
  assert.equal(typeof first.conditions.fiveGenerals.launched, 'boolean');

  const directOpen = evaluateTaiyiConditions({
    ...base,
    accumulatedValue: 1,
  });
  const directOpenEnd = evaluateTaiyiConditions({
    ...base,
    accumulatedValue: 30,
  });
  const directRest = evaluateTaiyiConditions({
    ...base,
    accumulatedValue: 31,
  });
  assert.equal(directOpen.threeGates.directGate, '开门');
  assert.equal(directOpenEnd.threeGates.directGate, '开门');
  assert.equal(directRest.threeGates.directGate, '休门');
  assert.equal(directOpen.threeGates.directGateRemainder, 1);
  assert.equal(directOpenEnd.threeGates.directGateRemainder, 30);
  assert.equal(directRest.threeGates.directGateRemainder, 31);
  assert.equal(directOpen.threeGates.gateByPalace[1], '开门');
  assert.equal(directOpenEnd.threeGates.gateByPalace[1], '开门');
  assert.equal(directRest.threeGates.gateByPalace[1], '休门');
  assert.equal(directOpen.threeGates.gateByPalace[8], '休门');
  assert.equal(directRest.threeGates.gateByPalace[8], '生门');

  for (const [accumulatedValue, expectedGate] of [
    [1, '开门'],
    [30, '开门'],
    [31, '休门'],
    [60, '休门'],
    [61, '生门'],
    [90, '生门'],
    [91, '伤门'],
    [120, '伤门'],
    [121, '杜门'],
    [150, '杜门'],
    [151, '景门'],
    [180, '景门'],
    [181, '死门'],
    [210, '死门'],
    [211, '惊门'],
    [240, '惊门'],
    [241, '开门'],
  ] as const) {
    const result = evaluateTaiyiConditions({ ...base, accumulatedValue });
    assert.equal(result.threeGates.directGate, expectedGate, `积数${accumulatedValue}`);
    assert.equal(
      result.threeGates.directGateRemainder,
      accumulatedValue <= 240 ? accumulatedValue : 1,
      `积数${accumulatedValue}的二百四十周余数`,
    );
  }
});

test('太乙直使甲子开门，三十年后的甲午转为休门', () => {
  // 《太乙金镜式经》以开元十二年甲子起开门，甲午所在的第三十一年转为休门。
  const jiazi = generateTaiyi({ year: 724 });
  const jiawu = generateTaiyi({ year: 754 });
  assert.equal(jiazi.ganZhi, '甲子');
  // 《金镜》甲子岁积 1,937,281；现用《统宗》年积数相差整 22,826 周纪，仍是阳四十九局。
  assert.equal(jiazi.accumulatedValue - 1937281, 22826 * 360);
  assert.equal(jiazi.bureau, 49);
  assert.equal(jiazi.conditions.threeGates.directGateRemainder, 1);
  assert.equal(jiazi.conditions.threeGates.directGate, '开门');
  assert.equal(jiawu.ganZhi, '甲午');
  assert.equal(jiawu.conditions.threeGates.directGateRemainder, 31);
  assert.equal(jiawu.conditions.threeGates.directGate, '休门');
});

test('元大德七年癸卯算外入阳五十二局，完整盘式与太乙秘书局例相合', () => {
  // 《太乙统宗宝鉴》卷一记该年已积 10,155,219，入局按「算外」进一算。
  // 《太乙秘书》阳五十二局明列癸卯，太乙、两目、主客算及四将、计神皆可独立核对。
  // https://www.shidianguji.com/zh/book/CADAL02094393/chapter/1lcppwnrj2wj7
  // https://zh.wikisource.org/wiki/太乙秘書
  const result = generateTaiyi({ scope: 'year', year: 1303 });
  const godAt = (position: string) =>
    result.sixteenGods.find((item) => item.branch === position)?.god;

  assert.deepEqual(
    {
      ganZhi: result.ganZhi,
      accumulatedValue: result.accumulatedValue,
      bureau: result.bureau,
      taiyiPalace: result.taiyiPalace,
      wenChangGod: godAt(result.wenChangPosition),
      shiJiGod: godAt(result.shiJiPosition),
      jiShenPosition: result.jiShenPosition,
      lordCount: result.lordCount,
      lordGeneral: result.lordGeneral,
      lordAssistant: result.lordAssistant,
      guestCount: result.guestCount,
      guestGeneral: result.guestGeneral,
      guestAssistant: result.guestAssistant,
    },
    {
      ganZhi: '癸卯',
      accumulatedValue: 10155220,
      bureau: 52,
      taiyiPalace: 2,
      wenChangGod: '天道',
      shiJiGod: '太簇',
      jiShenPosition: '亥',
      lordCount: 39,
      lordGeneral: 9,
      lordAssistant: 7,
      guestCount: 31,
      guestGeneral: 1,
      guestAssistant: 3,
    },
  );
});

test('太乙三门具只按太乙与文昌主目判定，始击门位单列', () => {
  const conditions = evaluateTaiyiConditions({
    accumulatedValue: 121,
    taiyiPosition: '乾',
    taiyiPalace: 1,
    wenChangPosition: '子',
    wenChangPalace: 8,
    shiJiPosition: '辰',
    shiJiPalace: 9,
    lordCount: 2,
    guestCount: 3,
    lordGeneral: 2,
    lordAssistant: 6,
    guestGeneral: 3,
    guestAssistant: 9,
  });
  assert.equal(conditions.threeGates.directGate, '杜门');
  assert.equal(conditions.threeGates.status, '三门具');
  assert.deepEqual(conditions.threeGates.blockedRoles, []);
  assert.equal(conditions.threeGates.gateScope, '太乙、文昌（主目）');
  assert.equal(conditions.threeGates.roles[0]?.gate, '杜门');
  assert.equal(conditions.threeGates.roles[1]?.gate, '景门');
  assert.equal(conditions.threeGates.roles[2]?.gate, '开门');
  assert.equal(conditions.threeGates.roles[2]?.usedForThreeGate, false);
});

test('太乙二目五行关系单列，不冒充五将发不发条件', () => {
  const base = {
    accumulatedValue: 1,
    taiyiPosition: '乾',
    taiyiPalace: 1,
    lordCount: 2,
    guestCount: 3,
    lordGeneral: 2,
    lordAssistant: 6,
    guestGeneral: 3,
    guestAssistant: 9,
  } as const;
  const guestControlsHost = evaluateTaiyiConditions({
    ...base,
    wenChangPosition: '卯',
    wenChangPalace: 4,
    shiJiPosition: '酉',
    shiJiPalace: 6,
  });
  assert.equal(guestControlsHost.fiveGenerals.hostGuestElementRelation.relation, '未判定');
  assert.equal(guestControlsHost.fiveGenerals.hostGuestElementRelation.hostElement, '木');
  assert.equal(guestControlsHost.fiveGenerals.hostGuestElementRelation.guestElement, '金');
  assert.equal(guestControlsHost.fiveGenerals.hostGuestElementRelation.complete, false);
  assert.equal(
    guestControlsHost.fiveGenerals.hostGuestElementRelation.usedForFiveGeneralsLaunch,
    false,
  );

  const hostControlsGuest = evaluateTaiyiConditions({
    ...base,
    wenChangPosition: '戌',
    wenChangPalace: 1,
    shiJiPosition: '子',
    shiJiPalace: 8,
  });
  assert.equal(hostControlsGuest.fiveGenerals.hostGuestElementRelation.relation, '未判定');
  assert.equal(hostControlsGuest.fiveGenerals.hostGuestElementRelation.hostElement, '土');
  assert.equal(hostControlsGuest.fiveGenerals.hostGuestElementRelation.guestElement, '水');
  assert.equal(hostControlsGuest.fiveGenerals.hostGuestElementRelation.complete, false);
});

test('太乙五将不发只列卷四三项阻碍，格与对不冒充发将原因', () => {
  const result = generateTaiyi({ year: 1979, scope: 'year' });
  const { fiveGenerals } = result.conditions;
  assert.equal(result.bureau, 8);
  assert.equal(fiveGenerals.wenChangRelationToTaiyi, '迫');
  assert.ok(fiveGenerals.relations.some((item) => item.kind === '客目/客将格'));
  assert.equal(fiveGenerals.launched, false);
  const fact = result.evidenceAnalysis.conditionFacts.find((item) => item.kind === '五将');
  assert.equal(fact?.promptText, '五将不发：文昌迫太乙');
});

test('太乙五将同入中宫仍计主客同宫关，不因中宫不参与邻对关系而漏判', () => {
  const conditions = evaluateTaiyiConditions({
    accumulatedValue: 1,
    taiyiPosition: '乾',
    taiyiPalace: 1,
    wenChangPosition: '子',
    wenChangPalace: 8,
    shiJiPosition: '艮',
    shiJiPalace: 3,
    lordCount: 2,
    guestCount: 3,
    lordGeneral: 5,
    lordAssistant: 2,
    guestGeneral: 5,
    guestAssistant: 3,
  });
  assert.equal(conditions.fiveGenerals.hostGuestNoSamePalaceRelation, false);
  assert.equal(conditions.fiveGenerals.launched, false);
  assert.ok(
    conditions.fiveGenerals.relations.some(
      (item) => item.kind === '主客同宫关' && item.leftPalace === 5 && item.rightPalace === 5,
    ),
  );
});

test('太乙积时在公元九十九年与一百年交接连续', () => {
  const before = new Date('0099-12-31T22:00:00+08:00');
  const after = new Date('0100-01-01T00:00:00+08:00');
  const first = generateTaiyi({ scope: 'hour', date: before });
  const second = generateTaiyi({ scope: 'hour', date: after });
  assert.equal(second.accumulatedValue, first.accumulatedValue + 1);
  const firstDay = generateTaiyi({ scope: 'day', date: before });
  const secondDay = generateTaiyi({ scope: 'day', date: after });
  assert.equal(secondDay.accumulatedValue, firstDay.accumulatedValue + 1);
});

test('太乙日计在子初与日干支同步换日，午夜不重复换局', () => {
  const before = generateTaiyi({
    scope: 'day',
    date: new Date('2026-01-15T22:59:59+08:00'),
  });
  const atZi = generateTaiyi({
    scope: 'day',
    date: new Date('2026-01-15T23:00:00+08:00'),
  });
  const midnight = generateTaiyi({
    scope: 'day',
    date: new Date('2026-01-16T00:00:00+08:00'),
  });
  assert.equal(atZi.accumulatedValue, before.accumulatedValue + 1);
  assert.equal(atZi.ganZhi, midnight.ganZhi);
  assert.equal(midnight.accumulatedValue, atZi.accumulatedValue);
  assert.equal(midnight.bureau, atZi.bureau);
});

test('太乙时计在历法切换日沿用干支历的连续日序', () => {
  const before = generateTaiyi({
    scope: 'hour',
    date: new Date('1582-10-04T23:00:00+08:00'),
  });
  const after = generateTaiyi({
    scope: 'hour',
    date: new Date('1582-10-15T00:00:00+08:00'),
  });
  assert.equal(before.ganZhi, '甲子');
  assert.equal(after.ganZhi, '甲子');
  assert.equal(after.accumulatedValue, before.accumulatedValue);
  assert.equal(after.bureau, before.bureau);
  const beforeDay = generateTaiyi({ scope: 'day', date: new Date('1582-10-04T23:00:00+08:00') });
  const afterDay = generateTaiyi({ scope: 'day', date: new Date('1582-10-15T00:00:00+08:00') });
  assert.equal(afterDay.accumulatedValue, beforeDay.accumulatedValue);
  assert.equal(afterDay.bureau, beforeDay.bureau);
});

test('太乙拒绝原型属性计式和非日期对象', () => {
  for (const scope of ['toString', 'constructor', '__proto__']) {
    assert.throws(() => generateTaiyi({ scope, year: 2026 } as never), /太乙计式无效/);
  }
  for (const date of [null, {}, { getTime: () => 0 }, '2026-01-01']) {
    assert.throws(() => generateTaiyi({ scope: 'day', date } as never), /太乙日期无效/);
  }
});

test('太乙日历依赖无法转换的公元边界日期应返回输入范围错误', () => {
  assert.throws(
    () => generateTaiyi({ scope: 'hour', date: new Date('0001-01-01T00:00:00+08:00') }),
    /太乙日期无法在当前历法库支持的范围内换算为干支或节气/,
  );
  assert.throws(
    () => generateTaiyi({ scope: 'day', date: new Date('1582-10-10T12:00:00+08:00') }),
    /太乙日期无法在当前历法库支持的范围内换算为干支或节气/,
  );
});

test('太乙时计在夏至与冬至交接秒切换阴阳遁', () => {
  const fixtures = [
    { date: new Date('2026-06-21T16:24:30+08:00'), before: '阳遁', after: '阴遁' },
    { date: new Date('2025-12-21T23:03:05+08:00'), before: '阴遁', after: '阳遁' },
  ];
  for (const { date: after, before: beforeDun, after: afterDun } of fixtures) {
    const before = new Date(after.getTime() - 1000);
    assert.equal(generateTaiyi({ scope: 'hour', date: before }).yinYang, beforeDun);
    assert.equal(generateTaiyi({ scope: 'hour', date: after }).yinYang, afterDun);
  }
});

test('太乙真太阳时跨交节只校正日时，月计与时计阴阳遁仍按实际占时', () => {
  const corrected = new Date('2026-06-21T16:24:31+08:00');
  const actual = new Date('2026-06-21T16:24:29+08:00');
  const before = generateTaiyi({ scope: 'hour', date: actual });
  const correctedOnly = generateTaiyi({ scope: 'hour', date: corrected });
  const aligned = generateTaiyi({
    scope: 'hour',
    date: corrected,
    termReferenceDate: actual,
  });
  assert.equal(before.yinYang, '阳遁');
  assert.equal(correctedOnly.yinYang, '阴遁');
  assert.equal(aligned.yinYang, before.yinYang);
  assert.equal(aligned.ganZhi, correctedOnly.ganZhi);
  assert.equal(aligned.termReferenceDateTime, '2026-06-21 16:24:29');
  assert.match(aligned.prompt, /节气与年月干支参照实际占时：2026-06-21 16:24:29/);
  assert.match(aligned.evidenceAnalysis.promptText, /实际占时2026-06-21 16:24:29/);

  const actualBeforeLichun = new Date('2024-02-04T16:26:00+08:00');
  const correctedAfterLichun = new Date('2024-02-04T16:28:00+08:00');
  const month = generateTaiyi({
    scope: 'month',
    date: correctedAfterLichun,
    termReferenceDate: actualBeforeLichun,
  });
  const actualMonth = generateTaiyi({ scope: 'month', date: actualBeforeLichun });
  assert.equal(month.ganZhi, actualMonth.ganZhi);
  assert.equal(month.accumulatedValue, actualMonth.accumulatedValue);
  assert.notEqual(
    month.accumulatedValue,
    generateTaiyi({ scope: 'month', date: correctedAfterLichun }).accumulatedValue,
  );
});

test('太乙阴遁七十二局按金镜式经九八七六四三二一逆行', () => {
  // 《太乙金镜式经》卷三阴局立成：每三局居一宫，二十四局一周。
  const palaceOrder = [9, 8, 7, 6, 4, 3, 2, 1];
  const positions = ['巽', '子', '坤', '酉', '卯', '艮', '午', '乾'];
  const bureaus = new Set<number>();
  for (let step = 0; step < 72; step += 1) {
    const result = generateTaiyi({
      scope: 'hour',
      date: new Date(new Date('2026-07-01T00:00:00+08:00').getTime() + step * 2 * 3600000),
    });
    const index = Math.floor((result.bureau - 1) / 3) % 8;
    assert.equal(result.yinYang, '阴遁');
    assert.equal(result.taiyiPalace, palaceOrder[index], `阴遁第${result.bureau}局`);
    assert.equal(result.taiyiPosition, positions[index]);
    assert.ok(result.prompt.includes(`太乙在${positions[index]}（第${palaceOrder[index]}宫`));
    bureaus.add(result.bureau);
  }
  assert.equal(bureaus.size, 72);
});

test('太乙阴遁七十二局与金镜立成、正间推算及武经交叉校勘一致', () => {
  // 固定原文：《太乙金镜式经》卷三 oldid=773933，卷二 oldid=773930；
  // 《武经总要》后集卷二十 oldid=856173，《太乙秘书》oldid=1378612。
  // https://zh.wikisource.org/w/index.php?oldid=773933
  // https://zh.wikisource.org/w/index.php?oldid=773930
  // https://zh.wikisource.org/w/index.php?oldid=856173
  // 卷三宫目、计神逐局定位；算依卷二正宫按本数、间神起一、至太乙宫前止校核。
  // 卷三阴37/43/44客目取两叙述本共同原文：大武/大神/大武；
  // 卷三阴11/15/25/26/27/43/44/46/70算数异文依同局宫目及正间推法校核。
  // 将位依去十用零、十的整倍数用其商，参将三因取零；不导入生产局表。
  // 现代时计只定位同局静态盘式，不据这些日期证明古代积数、历元或气应。
  const expectedRows: ReadonlyArray<
    readonly [number, string, string, number, number, number, number, number, number, string]
  > = [
    [9, '吕申', '大武', 5, 5, 5, 29, 9, 7, '申'],
    [9, '高丛', '阴主', 4, 4, 2, 17, 7, 1, '未'],
    [9, '太阳', '大义', 1, 1, 3, 16, 6, 8, '午'],
    [8, '大炅', '阳德', 25, 5, 5, 33, 3, 9, '巳'],
    [8, '大炅', '吕申', 25, 5, 5, 30, 3, 9, '辰'],
    [8, '大神', '太阳', 17, 7, 1, 26, 6, 8, '卯'],
    [7, '大威', '大神', 2, 2, 6, 3, 3, 9, '寅'],
    [7, '天道', '大武', 1, 1, 3, 7, 7, 1, '丑'],
    [7, '大武', '太簇', 7, 7, 1, 33, 3, 9, '子'],
    [6, '武德', '阴德', 1, 1, 3, 34, 4, 2, '亥'],
    [6, '太簇', '阳德', 6, 6, 8, 26, 6, 8, '戌'],
    [6, '阴主', '吕申', 35, 5, 5, 23, 3, 9, '酉'],
    [4, '阴德', '太阳', 12, 2, 6, 37, 7, 1, '申'],
    [4, '大义', '大威', 12, 2, 6, 27, 7, 1, '未'],
    [4, '地主', '大武', 11, 1, 3, 25, 5, 5, '午'],
    [3, '阳德', '太簇', 1, 1, 3, 15, 5, 5, '巳'],
    [3, '和德', '大义', 3, 3, 9, 9, 9, 7, '辰'],
    [3, '和德', '地主', 3, 3, 9, 8, 8, 4, '卯'],
    [2, '吕申', '和德', 14, 4, 2, 16, 6, 8, '寅'],
    [2, '高丛', '太阳', 13, 3, 9, 10, 1, 3, '丑'],
    [2, '太阳', '大神', 10, 1, 3, 1, 1, 3, '子'],
    [1, '大炅', '天道', 24, 4, 2, 14, 4, 2, '亥'],
    [1, '大炅', '武德', 24, 4, 2, 7, 7, 1, '戌'],
    [1, '大神', '阴主', 16, 6, 8, 1, 1, 3, '酉'],
    [9, '大威', '大义', 31, 1, 3, 16, 6, 8, '申'],
    [9, '天道', '和德', 30, 3, 9, 7, 7, 1, '未'],
    [9, '大武', '高丛', 29, 9, 7, 4, 4, 2, '午'],
    [8, '武德', '大炅', 8, 8, 4, 25, 5, 5, '巳'],
    [8, '太簇', '天道', 7, 7, 1, 15, 5, 5, '辰'],
    [8, '阴主', '武德', 2, 2, 6, 8, 8, 4, '卯'],
    [7, '阴德', '阴主', 27, 7, 1, 28, 8, 4, '寅'],
    [7, '大义', '地主', 27, 7, 1, 26, 6, 8, '丑'],
    [7, '地主', '和德', 26, 6, 8, 18, 8, 4, '子'],
    [6, '阳德', '高丛', 26, 6, 8, 22, 2, 6, '亥'],
    [6, '和德', '大神', 25, 5, 5, 10, 1, 3, '戌'],
    [6, '和德', '大威', 25, 5, 5, 9, 9, 7, '酉'],
    [4, '吕申', '大武', 1, 1, 3, 25, 5, 5, '申'],
    [4, '高丛', '阴主', 4, 4, 2, 13, 3, 9, '未'],
    [4, '太阳', '大义', 37, 7, 1, 12, 2, 6, '午'],
    [3, '大炅', '阳德', 33, 3, 9, 1, 1, 3, '巳'],
    [3, '大炅', '吕申', 33, 3, 9, 38, 8, 4, '辰'],
    [3, '大神', '太阳', 25, 5, 5, 34, 4, 2, '卯'],
    [2, '大威', '大神', 2, 2, 6, 1, 1, 3, '寅'],
    [2, '天道', '大武', 39, 9, 7, 38, 8, 4, '丑'],
    [2, '大武', '太簇', 38, 8, 4, 31, 1, 3, '子'],
    [1, '武德', '阴德', 7, 7, 1, 1, 1, 3, '亥'],
    [1, '太簇', '阳德', 6, 6, 8, 32, 2, 6, '戌'],
    [1, '阴主', '吕申', 1, 1, 3, 29, 9, 7, '酉'],
    [9, '阴德', '太阳', 16, 6, 8, 1, 1, 3, '申'],
    [9, '大义', '大威', 16, 6, 8, 31, 1, 3, '未'],
    [9, '地主', '大武', 15, 5, 5, 29, 9, 7, '午'],
    [8, '阳德', '太簇', 33, 3, 9, 7, 7, 1, '巳'],
    [8, '和德', '大义', 32, 2, 6, 1, 1, 3, '辰'],
    [8, '和德', '地主', 32, 2, 6, 8, 8, 4, '卯'],
    [7, '吕申', '和德', 16, 6, 8, 18, 8, 4, '寅'],
    [7, '高丛', '太阳', 15, 5, 5, 12, 2, 6, '丑'],
    [7, '太阳', '大神', 12, 2, 6, 3, 3, 9, '子'],
    [6, '大炅', '天道', 18, 8, 4, 8, 8, 4, '亥'],
    [6, '大炅', '武德', 18, 8, 4, 1, 1, 3, '戌'],
    [6, '大神', '阴主', 10, 1, 3, 35, 5, 5, '酉'],
    [4, '大威', '大义', 27, 7, 1, 12, 2, 6, '申'],
    [4, '天道', '和德', 26, 6, 8, 3, 3, 9, '未'],
    [4, '大武', '高丛', 25, 5, 5, 4, 4, 2, '午'],
    [3, '武德', '大炅', 16, 6, 8, 33, 3, 9, '巳'],
    [3, '太簇', '天道', 15, 5, 5, 23, 3, 9, '辰'],
    [3, '阴主', '武德', 10, 1, 3, 16, 6, 8, '卯'],
    [2, '阴德', '阴主', 25, 5, 5, 26, 6, 8, '寅'],
    [2, '大义', '地主', 25, 5, 5, 24, 4, 2, '丑'],
    [2, '地主', '和德', 24, 4, 2, 16, 6, 8, '子'],
    [1, '阳德', '高丛', 32, 2, 6, 28, 8, 4, '亥'],
    [1, '和德', '大神', 31, 1, 3, 16, 6, 8, '戌'],
    [1, '和德', '大威', 31, 1, 3, 15, 5, 5, '酉'],
  ];
  assert.equal(expectedRows.length, 72);
  const start = Date.parse('2026-06-25T00:30:00+08:00');
  for (const [index, expected] of expectedRows.entries()) {
    const result = generateTaiyi({
      scope: 'hour',
      date: new Date(start + index * 2 * 60 * 60 * 1000),
    });
    const godAt = (position: string) =>
      result.sixteenGods.find((item) => item.branch === position)?.god;
    assert.equal(result.yinYang, '阴遁');
    assert.equal(result.bureau, index + 1);
    assert.deepEqual(
      [
        result.taiyiPalace,
        godAt(result.wenChangPosition),
        godAt(result.shiJiPosition),
        result.lordCount,
        result.lordGeneral,
        result.lordAssistant,
        result.guestCount,
        result.guestGeneral,
        result.guestAssistant,
        result.jiShenPosition,
      ],
      expected,
      `阴遁第${index + 1}局`,
    );
  }
});
