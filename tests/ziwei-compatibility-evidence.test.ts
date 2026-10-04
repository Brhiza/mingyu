import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeZiweiCompatibility } from '../packages/core/src/ziwei/iztro/compatibility-evidence';
import { buildZiweiCompatibilityPromptDocument } from '../packages/core/src/prompt/ziwei';
import { buildCombinedZiweiCompatibilityPrompt } from '../packages/core/src/ziwei/prompt/combined';
import {
  buildAstrolabeFromInput,
  buildAnalysisPayloadV1,
  buildHoroscope,
  DEFAULT_ZIWEI_CALCULATION_CONFIG,
} from '../packages/core/src/ziwei/iztro';
import { assertPromptIsPortableTaskText } from './prompt-assertions';
import type {
  AnalysisPayloadV1,
  MutagenName,
  PalaceFact,
} from '../packages/core/src/types/analysis';

const PALACES = [
  '命宫',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '交友',
  '官禄',
  '田宅',
  '福德',
  '父母',
];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function createPalace(
  index: number,
  offset: number,
  star?: { name: string; mutagen?: MutagenName },
): PalaceFact {
  return {
    index,
    name: PALACES[index],
    is_body_palace: index === 10,
    is_original_palace: false,
    heavenly_stem: '甲',
    earthly_branch: BRANCHES[(index + offset) % 12],
    major_stars: star ? [{ name: star.name, kind: 'major', birth_mutagen: star.mutagen }] : [],
    minor_stars: [],
    other_stars: [],
    scope_stars: [],
    changsheng12: '长生',
    boshi12: '博士',
    base_jiangqian12: '岁建',
    base_suiqian12: '将星',
    decadal_range: [1, 10],
    ages: [],
    scope_hits: [],
    empty_state: !star,
    opposite_palace_index: (index + 6) % 12,
    surrounded_palace_indexes: [index, (index + 4) % 12, (index + 6) % 12, (index + 8) % 12],
    summary_tags: [],
  };
}

function createPayload(offset: number, mutagen: MutagenName): AnalysisPayloadV1 {
  return {
    payload_version: 'analysis_payload_v1',
    language: 'zh-CN',
    calculation_config: DEFAULT_ZIWEI_CALCULATION_CONFIG,
    basic_info: {
      gender: '男',
      solar_date: '1990-05-15',
      lunar_date: '庚午年四月廿一',
      chinese_date: '庚午年四月廿一',
      birth_time_label: '丑时',
      birth_time_range: '01:00-03:00',
      zodiac: '马',
      sign: '金牛座',
      five_elements_class: '水二局',
      soul: '破军',
      body: '天相',
      soul_palace_branch: BRANCHES[offset],
      body_palace_branch: BRANCHES[(10 + offset) % 12],
    },
    active_scope: {
      scope: 'origin',
      label: '本命',
      solar_date: '2026-07-14',
      lunar_date: '丙午年六月',
      nominal_age: 37,
      mutagen_map: [],
    },
    palaces: PALACES.map((_, index) =>
      createPalace(
        index,
        offset,
        index === 0 ? { name: '紫微', mutagen } : index === 4 ? { name: '天府' } : undefined,
      ),
    ),
    evidence_pool: [],
    patterns: [],
  };
}

function assertEvidenceReferences(result: ReturnType<typeof analyzeZiweiCompatibility>) {
  const stepKeys = new Set(result.calculationSteps.map((item) => item.key));
  const factKeys = new Set([
    result.summaryFact.key,
    ...result.calculationSteps.map((item) => item.key),
    ...result.palaceOverlays.map((item) => item.key),
    ...result.crossMutagenPlacements.map((item) => item.key),
    ...result.crossMutagenGaps.map((item) => item.key),
    ...result.counterEvidenceFacts.map((item) => item.key),
  ]);
  assert.ok(
    result.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(
    [...result.palaceOverlays, ...result.crossMutagenPlacements].every((item) =>
      stepKeys.has(item.calculationStepKey),
    ),
  );
  assert.ok(result.summaryFact.factKeys.length > 0);
  assert.ok(result.summaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    result.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    result.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
}

test('紫微双盘应按地支映射关键宫位并定位生年四化', () => {
  const result = analyzeZiweiCompatibility(createPayload(0, '禄'), createPayload(2, '忌'));
  const overlay = result.palaceOverlays.find(
    (item) => item.sourcePerson === 'person1' && item.sourcePalace === '命宫',
  );

  assert.ok(overlay);
  assert.ok(overlay.sourcePalaceKey && overlay.targetPalaceKey);
  assert.equal(overlay.earthlyBranch, '子');
  assert.equal(overlay.targetPalace, '福德（身宫同宫）');
  assert.match(overlay.promptText, /同处子支轴位/);
  assertEvidenceReferences(result);
  const placement = result.crossMutagenPlacements.find(
    (item) => item.sourcePerson === 'person1' && item.star === '紫微',
  );

  assert.ok(placement);
  assert.ok(placement.sourcePalaceKey && placement.targetPalaceKey);
  assert.equal(placement.mutagen, '禄');
  assert.equal(placement.sourcePalace, '命宫');
  assert.equal(placement.targetPalace, '命宫');
  assert.match(placement.promptText, /生年化禄/);
});

test('紫微双盘地支或宫位索引重复时不生成叠盘事实', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  second.palaces[1].earthly_branch = second.palaces[0].earthly_branch;
  assert.throws(() => analyzeZiweiCompatibility(first, second), /宫位地支无效或重复/);

  second.palaces[1].earthly_branch = BRANCHES[3];
  second.palaces[1].index = second.palaces[0].index;
  assert.throws(() => analyzeZiweiCompatibility(first, second), /宫位索引无效或重复/);
});

test('双方输入流年盘时静态交叉证据不误称运限资料未提供', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  first.active_scope.scope = 'yearly';
  second.active_scope.scope = 'yearly';

  const result = analyzeZiweiCompatibility(first, second);
  const timing = result.counterEvidenceFacts.find((item) => item.type === '静态应期边界');
  assert.match(timing?.promptText ?? '', /运限未作同层级交叉核对/);
  assert.doesNotMatch(timing?.promptText ?? '', /未提供双方同层级/);
});

test('紫微双盘真实星盘应以 iztro 原生星曜对象定位跨盘四化', async () => {
  const chartInput1 = {
    name: '甲方',
    dateType: 'solar' as const,
    birthDate: '1990-05-15',
    birthTimeIndex: 1,
    gender: '男' as const,
  };
  const chartInput2 = {
    name: '乙方',
    dateType: 'solar' as const,
    birthDate: '1993-11-08',
    birthTimeIndex: 7,
    gender: '女' as const,
  };
  const astrolabe1 = await buildAstrolabeFromInput(chartInput1);
  const astrolabe2 = await buildAstrolabeFromInput(chartInput2);
  const payload1 = buildAnalysisPayloadV1({
    astrolabe: astrolabe1,
    horoscope: buildHoroscope(astrolabe1, '2026-07-27', 6),
    currentScope: 'origin',
    skipAnalysis: true,
  });
  const payload2 = buildAnalysisPayloadV1({
    astrolabe: astrolabe2,
    horoscope: buildHoroscope(astrolabe2, '2026-07-27', 6),
    currentScope: 'origin',
    skipAnalysis: true,
  });

  let targetStarLookupCount = 0;
  const originalTargetStar = astrolabe2.star;
  astrolabe2.star = ((starName) => {
    targetStarLookupCount += 1;
    return originalTargetStar(starName);
  }) as typeof astrolabe2.star;

  const result = analyzeZiweiCompatibility(payload1, payload2, {
    person1Name: '甲方',
    person2Name: '乙方',
    astrolabe1,
    astrolabe2,
  });
  const placement = result.crossMutagenPlacements.find((item) => item.sourcePerson === 'person1');

  assert.ok(targetStarLookupCount > 0);
  assert.ok(placement);
  assert.ok(placement.sources.some((source) => source.includes('目标方同名星曜落宫')));
  assert.match(placement.calculation, /按同名星曜定位/);
  assert.doesNotMatch(result.promptText, /iztro|star\(\)\.palace\(\)/i);
  assert.doesNotMatch(
    buildZiweiCompatibilityPromptDocument({
      payload1,
      payload2,
      compatibility: result,
    }).text,
    /iztro|star\(\)\.palace\(\)/i,
  );
  assert.deepEqual(
    { name: placement.targetPalace, branch: placement.targetEarthlyBranch },
    {
      name: (() => {
        const palace = astrolabe2.star(placement.star as never).palace();
        assert.ok(palace);
        const payloadPalace = payload2.palaces.find((item) => item.index === palace.index);
        assert.ok(payloadPalace);
        return payloadPalace.is_body_palace
          ? `${payloadPalace.name}（身宫同宫）`
          : payloadPalace.name;
      })(),
      branch: astrolabe2.star(placement.star as never).palace()?.earthlyBranch,
    },
  );

  const targetIndex = astrolabe2.star(placement.star as never).palace()?.index;
  assert.notEqual(targetIndex, undefined);
  const targetPalace = payload2.palaces.find((item) => item.index === targetIndex);
  const otherPalace = payload2.palaces.find((item) => item.index !== targetIndex);
  assert.ok(targetPalace && otherPalace);
  [targetPalace.earthly_branch, otherPalace.earthly_branch] = [
    otherPalace.earthly_branch,
    targetPalace.earthly_branch,
  ];
  assert.throws(
    () => analyzeZiweiCompatibility(payload1, payload2, { astrolabe1, astrolabe2 }),
    /目标盘第 \d+ 宫地支与结构化十二宫不一致/,
  );
  [targetPalace.earthly_branch, otherPalace.earthly_branch] = [
    otherPalace.earthly_branch,
    targetPalace.earthly_branch,
  ];
  [payload1.palaces[0].earthly_branch, payload1.palaces[1].earthly_branch] = [
    payload1.palaces[1].earthly_branch,
    payload1.palaces[0].earthly_branch,
  ];
  assert.throws(
    () => analyzeZiweiCompatibility(payload1, payload2, { astrolabe1, astrolabe2 }),
    /来源盘第 \d+ 宫地支与结构化十二宫不一致/,
  );
  [payload1.palaces[0].earthly_branch, payload1.palaces[1].earthly_branch] = [
    payload1.palaces[1].earthly_branch,
    payload1.palaces[0].earthly_branch,
  ];
  const sourceStar = payload1.palaces
    .flatMap((palace) => [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars])
    .find((star) => star.name === placement.star && star.birth_mutagen === placement.mutagen);
  assert.ok(sourceStar);
  sourceStar.birth_mutagen = undefined;
  assert.throws(
    () => analyzeZiweiCompatibility(payload1, payload2, { astrolabe1, astrolabe2 }),
    /来源盘 .* 生年四化与结构化十二宫不一致/,
  );
});

test('紫微双盘提示词应包含主证、限制且不输出匹配总分', () => {
  const result = analyzeZiweiCompatibility(createPayload(0, '禄'), createPayload(2, '忌'), {
    person1Name: '甲方',
    person2Name: '乙方',
  });

  assert.match(result.promptText, /【紫微双盘结构化证据】/);
  assert.match(result.promptText, /甲方.*乙方/);
  assert.match(result.promptText, /【主证】/);
  assert.match(result.promptText, /【限制】紫微双盘证据边界/);
  assert.match(result.promptText, /【应期】静态双盘应期边界/);
  assert.match(result.promptText, /同处.*支轴位.*边界：宫位叠盘只证明/);
  assert.match(result.promptText, /生年化[禄忌].*边界：跨盘四化只证明/);
  assert.match(result.promptText, /不输出匹配总分/);
  assert.match(result.promptText, /计算链概览/);
  assert.match(result.promptText, /证据汇总/);
  assert.equal(result.counterEvidenceFacts.length, 5);
  assert.ok(result.counterEvidenceFacts.some((item) => item.type === '静态应期边界'));
  assert.ok(result.limitationFacts.some((item) => item.type === '四化语义边界'));
  assert.ok(result.promptText.length < 10000);
  assert.doesNotMatch(
    result.promptText,
    /analysis_payload_v1|命语|本项目|项目统一|工程|接口|API|MCP|ziwei:compatibility:/,
  );
  assertPromptIsPortableTaskText(result.promptText);
  assert.doesNotMatch(result.promptText, /匹配(?:分数|率|百分比)/);
});

test('紫微双盘没有生年四化定位时应保留未命中反证', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  [...first.palaces, ...second.palaces].forEach((palace) => {
    [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars].forEach((star) => {
      star.birth_mutagen = undefined;
    });
  });

  const result = analyzeZiweiCompatibility(first, second);

  assert.equal(result.crossMutagenPlacements.length, 0);
  assert.equal(result.summaryFact.status, '仅见宫位叠盘');
  assert.deepEqual(result.summaryFact.uncoveredMutagenDirections, [
    'person1-to-person2',
    'person2-to-person1',
  ]);
  assert.equal(
    result.counterEvidenceFacts.filter(
      (item) => item.type === '跨盘四化覆盖' && item.status === '未命中',
    ).length,
    2,
  );
  assertEvidenceReferences(result);
  assert.match(result.promptText, /未形成可定位的跨盘生年四化事实/);
});

test('紫微双盘部分四化星曜缺失时应把该方向记为资料缺口并写入提示词', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  first.palaces[4].major_stars[0].birth_mutagen = '权';
  second.palaces[4].major_stars = [];

  const result = analyzeZiweiCompatibility(first, second);
  const directionFact = result.counterEvidenceFacts.find(
    (item) => item.type === '跨盘四化覆盖' && item.direction === 'person1-to-person2',
  );

  assert.equal(
    result.crossMutagenPlacements.filter((item) => item.sourcePerson === 'person1').length,
    1,
  );
  assert.equal(result.crossMutagenGaps.length, 1);
  assert.equal(result.crossMutagenGaps[0].star, '天府');
  assert.equal(directionFact?.status, '资料缺口');
  assert.ok(result.summaryFact.factKeys.includes(result.crossMutagenGaps[0].key));
  assert.equal(
    result.calculationSteps.find((item) => item.stage === '跨盘生年四化')?.result
      .missingTargetStarCount,
    1,
  );
  assert.match(result.summaryFact.promptText, /另有1项同名星曜定位资料缺口/);
  assert.match(result.counterEvidence.join('；'), /天府化权.*该方向四化资料不完备/);
  assert.match(result.promptText, /【反证】跨盘四化覆盖：资料缺口/);
  assertEvidenceReferences(result);
  assertPromptIsPortableTaskText(result.promptText);
});

test('目标盘同名四化星分处两宫时应记录定位歧义，不任取第一个宫位', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  second.palaces[4].major_stars.push({ name: '紫微', kind: 'major' });

  const result = analyzeZiweiCompatibility(first, second);
  const gap = result.crossMutagenGaps.find((item) => item.sourcePerson === 'person1');
  const directionFact = result.counterEvidenceFacts.find(
    (item) => item.type === '跨盘四化覆盖' && item.direction === 'person1-to-person2',
  );

  assert.equal(
    result.crossMutagenPlacements.some((item) => item.sourcePerson === 'person1'),
    false,
  );
  assert.equal(gap?.reason, '目标盘同名星曜落宫不唯一');
  assert.deepEqual(gap?.candidatePalaces, ['命宫', '财帛']);
  assert.equal(directionFact?.status, '资料缺口');
  assert.ok(gap && directionFact.ownerFactKeys.includes(gap.key));
  assert.equal(
    result.calculationSteps.find((item) => item.stage === '跨盘生年四化')?.result
      .ambiguousTargetStarCount,
    1,
  );
  assert.match(result.promptText, /紫微化禄：目标盘同名星曜落宫不唯一（命宫、财帛）/);
  assertEvidenceReferences(result);
  assertPromptIsPortableTaskText(result.promptText);
  const prompt = buildZiweiCompatibilityPromptDocument({
    payload1: first,
    payload2: second,
    compatibility: result,
  }).text;
  const relationFacts = prompt.split('【双盘关系资料】')[1]?.split('【任务】')[0] ?? '';
  assert.doesNotMatch(relationFacts, /资料缺口|落宫不唯一|未命中|证据汇总|计算链/);
  const combinedPrompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: first,
    partnerPayload: second,
    topic: 'career-wealth',
    question: '请分析双方合作。',
  });
  const combinedFacts = combinedPrompt.split('【双盘关系资料】')[1]?.split('【任务】')[0] ?? '';
  assert.doesNotMatch(combinedFacts, /资料缺口|落宫不唯一|未命中|证据汇总|计算链/);
});

test('同向一项四化已定位且另一项落宫不唯一时仍应判为部分资料缺口', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  first.palaces[4].major_stars[0].birth_mutagen = '权';
  second.palaces[4].major_stars.push({ name: '紫微', kind: 'major' });

  const result = analyzeZiweiCompatibility(first, second);
  const directionFact = result.counterEvidenceFacts.find(
    (item) => item.type === '跨盘四化覆盖' && item.direction === 'person1-to-person2',
  );

  assert.equal(
    result.crossMutagenPlacements.filter((item) => item.sourcePerson === 'person1').length,
    1,
  );
  assert.equal(result.crossMutagenGaps.filter((item) => item.sourcePerson === 'person1').length, 1);
  assert.equal(directionFact?.status, '资料缺口');
  assert.match(directionFact?.promptText ?? '', /记录1项.*另有1项未能唯一定位.*紫微化禄/);
  const prompt = buildZiweiCompatibilityPromptDocument({
    payload1: first,
    payload2: second,
    compatibility: result,
  }).text;
  const relationFacts = prompt.split('【双盘关系资料】')[1]?.split('【任务】')[0] ?? '';
  assert.match(relationFacts, /天府生年化权/);
  assert.doesNotMatch(relationFacts, /资料缺口|落宫不唯一|未命中|证据汇总|计算链/);
});

test('紫微双盘应拒绝缺少完整十二宫的资料', () => {
  const first = createPayload(0, '禄');
  const second = createPayload(2, '忌');
  second.palaces.pop();
  assert.throws(() => analyzeZiweiCompatibility(first, second), /完整十二宫资料/);
});
