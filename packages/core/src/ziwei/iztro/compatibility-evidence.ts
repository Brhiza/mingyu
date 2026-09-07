import { formatPromptEvidenceBundle } from '../../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../../prompt-evidence/types';
import type { AnalysisPayloadV1, MutagenName, PalaceFact, StarFact } from '../../types/analysis';
import type { IztroAstrolabe, IztroPalace, IztroStar } from '../../types/iztro';

const KEY_PALACES = new Set(['命宫', '身宫', '夫妻', '官禄', '财帛', '福德', '迁移']);

export interface ZiweiCompatibilityOptions {
  person1Name?: string;
  person2Name?: string;
  astrolabe1?: IztroAstrolabe;
  astrolabe2?: IztroAstrolabe;
}

export interface ZiweiPalaceOverlay {
  key: string;
  status: '已命中';
  sourcePerson: 'person1' | 'person2';
  targetPerson: 'person1' | 'person2';
  sourcePalace: string;
  earthlyBranch: string;
  targetPalace: string;
  sourceMajorStars: string[];
  targetMajorStars: string[];
  sourcePalaceKey: string;
  targetPalaceKey: string;
  calculationStepKey: 'ziwei:compatibility:calculation:palace-overlays';
  sources: string[];
  calculation: string;
  promptText: string;
  limitation: '宫位叠盘只证明双方宫位位于同一地支轴位；不单独证明关系吉凶、适配程度、他人意图、现实事件或长期结果';
}

export interface ZiweiCrossMutagenPlacement {
  key: string;
  status: '已命中';
  sourcePerson: 'person1' | 'person2';
  targetPerson: 'person1' | 'person2';
  star: string;
  mutagen: MutagenName;
  sourcePalace: string;
  targetPalace: string;
  targetEarthlyBranch: string;
  sourcePalaceKey: string;
  targetPalaceKey: string;
  calculationStepKey: 'ziwei:compatibility:calculation:cross-mutagens';
  sources: string[];
  calculation: string;
  promptText: string;
  limitation: '跨盘四化只证明一方生年四化星曜与对方同名星曜落宫之间的定位链路；化禄、权、科、忌均不直接等于关系吉凶、事件结果、匹配程度或应期';
}

export interface ZiweiCompatibilityCalculationStep {
  key: string;
  stage:
    | '双盘输入校验'
    | '十二宫地支索引'
    | '关键宫位叠盘'
    | '同名星曜索引'
    | '跨盘生年四化'
    | '证据汇总';
  status: '已计算';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明双方本命十二宫、地支轴位与生年四化星曜经过固定定位规则形成当前交叉事实，不证明现实关系、匹配程度、事件结果、发生概率或固定应期';
}

export interface ZiweiCompatibilityCounterEvidenceFact {
  key: string;
  type: '关键宫位叠盘覆盖' | '跨盘四化覆盖' | '静态应期边界';
  status: '有可用证据' | '未命中' | '固有限制';
  direction?: 'person1-to-person2' | 'person2-to-person1';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录关键宫位叠盘、跨盘四化是否形成以及静态本命双盘的应期限制；未命中不等于关系有利或不利，命中也不证明现实结果';
}

export interface ZiweiCompatibilitySummaryFact {
  key: 'ziwei:compatibility:evidence-summary';
  status: '宫位与四化均有交叉' | '仅见宫位叠盘' | '未见已列交叉事实';
  factKeys: string[];
  palaceOverlayCount: number;
  importantPalaceOverlayCount: number;
  crossMutagenPlacementCount: number;
  mutagenCounts: Partial<Record<MutagenName, number>>;
  uncoveredMutagenDirections: Array<'person1-to-person2' | 'person2-to-person1'>;
  promptText: string;
  sources: string[];
  limitation: '双盘证据汇总只统计宫位叠盘与跨盘生年四化定位事实，不得按数量生成匹配分、关系概率、事件概率、吉凶结论或唯一应期';
}

export interface ZiweiCompatibilityLimitationFact {
  key: string;
  type: '宫位因果边界' | '四化语义边界' | '静态应期边界' | '资料范围边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束宫位叠盘与跨盘生年四化能够支持的解释范围，不得被反向当作现实关系结果、他人意图、吉凶概率或保证有效建议的证据';
}

export interface ZiweiCompatibilityEvidenceResult {
  key: 'ziwei:compatibility:evidence';
  status: '已计算';
  people: { person1: string; person2: string };
  calculationSteps: ZiweiCompatibilityCalculationStep[];
  calculationChain: string[];
  palaceOverlays: ZiweiPalaceOverlay[];
  crossMutagenPlacements: ZiweiCrossMutagenPlacement[];
  counterEvidence: string[];
  counterEvidenceFacts: ZiweiCompatibilityCounterEvidenceFact[];
  summaryFact: ZiweiCompatibilitySummaryFact;
  limitations: string[];
  limitationFacts: ZiweiCompatibilityLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

const PALACE_OVERLAY_LIMITATION =
  '宫位叠盘只证明双方宫位位于同一地支轴位；不单独证明关系吉凶、适配程度、他人意图、现实事件或长期结果' as const;

const CROSS_MUTAGEN_LIMITATION =
  '跨盘四化只证明一方生年四化星曜与对方同名星曜落宫之间的定位链路；化禄、权、科、忌均不直接等于关系吉凶、事件结果、匹配程度或应期' as const;

const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明双方本命十二宫、地支轴位与生年四化星曜经过固定定位规则形成当前交叉事实，不证明现实关系、匹配程度、事件结果、发生概率或固定应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录关键宫位叠盘、跨盘四化是否形成以及静态本命双盘的应期限制；未命中不等于关系有利或不利，命中也不证明现实结果' as const;
const SUMMARY_LIMITATION =
  '双盘证据汇总只统计宫位叠盘与跨盘生年四化定位事实，不得按数量生成匹配分、关系概率、事件概率、吉凶结论或唯一应期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束宫位叠盘与跨盘生年四化能够支持的解释范围，不得被反向当作现实关系结果、他人意图、吉凶概率或保证有效建议的证据' as const;

function palaceFactKey(person: 'person1' | 'person2', palace: PalaceFact) {
  return `ziwei:compatibility:palace:${person}:${palace.index}:${palace.earthly_branch}`;
}

function allStars(palace: PalaceFact): StarFact[] {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

function allIztroStars(palace: IztroPalace): IztroStar[] {
  return [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
}

function assertPayload(payload: AnalysisPayloadV1, label: string) {
  if (!payload || !Array.isArray(payload.palaces) || payload.palaces.length !== 12) {
    throw new Error(`${label}必须包含完整十二宫资料。`);
  }
  for (const palace of payload.palaces) {
    if (!palace.name || !palace.earthly_branch) throw new Error(`${label}宫位名称或地支缺失。`);
  }
}

function keyPalaces(payload: AnalysisPayloadV1) {
  return payload.palaces.filter(
    (palace) => KEY_PALACES.has(palace.name) || palace.name === '命宫' || palace.is_body_palace,
  );
}

function palaceDisplayName(palace: PalaceFact) {
  return palace.is_body_palace && palace.name !== '身宫'
    ? `${palace.name}（身宫同宫）`
    : palace.name;
}

function calculateOverlays(
  sourcePerson: 'person1' | 'person2',
  targetPerson: 'person1' | 'person2',
  source: AnalysisPayloadV1,
  target: AnalysisPayloadV1,
  people: ZiweiCompatibilityEvidenceResult['people'],
) {
  const targetByBranch = new Map(target.palaces.map((palace) => [palace.earthly_branch, palace]));
  return keyPalaces(source).flatMap((sourcePalace): ZiweiPalaceOverlay[] => {
    const targetPalace = targetByBranch.get(sourcePalace.earthly_branch);
    if (!targetPalace) return [];
    const sourcePalaceName = palaceDisplayName(sourcePalace);
    const targetPalaceName = palaceDisplayName(targetPalace);
    return [
      {
        key: `宫位叠盘:${sourcePerson}:${sourcePalace.index}:${sourcePalace.earthly_branch}:${targetPerson}:${targetPalace.index}`,
        status: '已命中',
        sourcePerson,
        targetPerson,
        sourcePalace: sourcePalaceName,
        earthlyBranch: sourcePalace.earthly_branch,
        targetPalace: targetPalaceName,
        sourceMajorStars: sourcePalace.major_stars.map((star) => star.name),
        targetMajorStars: targetPalace.major_stars.map((star) => star.name),
        sourcePalaceKey: palaceFactKey(sourcePerson, sourcePalace),
        targetPalaceKey: palaceFactKey(targetPerson, targetPalace),
        calculationStepKey: 'ziwei:compatibility:calculation:palace-overlays',
        sources: ['双方本命十二宫地支资料', '紫微双盘同支宫位映射规则'],
        calculation: `读取${people[sourcePerson]}${sourcePalaceName}的地支${sourcePalace.earthly_branch}，在${people[targetPerson]}十二宫中按相同地支定位到${targetPalaceName}`,
        promptText: `${people[sourcePerson]}${sourcePalaceName}与${people[targetPerson]}${targetPalaceName}同处${sourcePalace.earthly_branch}支轴位；来源宫主星${sourcePalace.major_stars.map((star) => star.name).join('、') || '无主星'}，目标宫主星${targetPalace.major_stars.map((star) => star.name).join('、') || '无主星'}`,
        limitation: PALACE_OVERLAY_LIMITATION,
      },
    ];
  });
}

function calculateCrossMutagens(
  sourcePerson: 'person1' | 'person2',
  targetPerson: 'person1' | 'person2',
  source: AnalysisPayloadV1,
  target: AnalysisPayloadV1,
  people: ZiweiCompatibilityEvidenceResult['people'],
  sourceAstrolabe?: IztroAstrolabe,
  targetAstrolabe?: IztroAstrolabe,
) {
  if (sourceAstrolabe && targetAstrolabe) {
    return calculateCrossMutagensWithIztro(
      sourcePerson,
      targetPerson,
      source,
      target,
      people,
      sourceAstrolabe,
      targetAstrolabe,
    );
  }

  const targetStars = new Map<string, PalaceFact>();
  target.palaces.forEach((palace) => {
    allStars(palace).forEach((star) => {
      if (!targetStars.has(star.name)) targetStars.set(star.name, palace);
    });
  });
  const placements: ZiweiCrossMutagenPlacement[] = [];
  source.palaces.forEach((sourcePalace) => {
    allStars(sourcePalace).forEach((star) => {
      if (!star.birth_mutagen) return;
      const targetPalace = targetStars.get(star.name);
      if (!targetPalace) return;
      const sourcePalaceName = palaceDisplayName(sourcePalace);
      const targetPalaceName = palaceDisplayName(targetPalace);
      placements.push({
        key: `跨盘四化:${sourcePerson}:${star.name}:化${star.birth_mutagen}:${targetPerson}:${targetPalace.index}`,
        status: '已命中',
        sourcePerson,
        targetPerson,
        star: star.name,
        mutagen: star.birth_mutagen,
        sourcePalace: sourcePalaceName,
        targetPalace: targetPalaceName,
        targetEarthlyBranch: targetPalace.earthly_branch,
        sourcePalaceKey: palaceFactKey(sourcePerson, sourcePalace),
        targetPalaceKey: palaceFactKey(targetPerson, targetPalace),
        calculationStepKey: 'ziwei:compatibility:calculation:cross-mutagens',
        sources: ['来源方本命生年四化星曜标记', '目标方十二宫同名星曜落宫资料'],
        calculation: `读取${people[sourcePerson]}${sourcePalaceName}的${star.name}生年化${star.birth_mutagen}标记，再于${people[targetPerson]}十二宫星曜索引中定位同名${star.name}到${targetPalaceName}（${targetPalace.earthly_branch}）`,
        promptText: `${people[sourcePerson]}${sourcePalaceName}的${star.name}生年化${star.birth_mutagen}，同名${star.name}在${people[targetPerson]}盘定位于${targetPalaceName}（${targetPalace.earthly_branch}）`,
        limitation: CROSS_MUTAGEN_LIMITATION,
      });
    });
  });
  return placements;
}

function calculateCrossMutagensWithIztro(
  sourcePerson: 'person1' | 'person2',
  targetPerson: 'person1' | 'person2',
  source: AnalysisPayloadV1,
  target: AnalysisPayloadV1,
  people: ZiweiCompatibilityEvidenceResult['people'],
  sourceAstrolabe: IztroAstrolabe,
  targetAstrolabe: IztroAstrolabe,
) {
  const placements: ZiweiCrossMutagenPlacement[] = [];

  sourceAstrolabe.palaces.forEach((sourceIztroPalace) => {
    const sourcePalace = source.palaces.find((palace) => palace.index === sourceIztroPalace.index);
    if (!sourcePalace) {
      throw new Error(`iztro 来源盘第 ${sourceIztroPalace.index} 宫无法映射到结构化十二宫。`);
    }

    allIztroStars(sourceIztroPalace).forEach((sourceStar) => {
      const mutagen = sourceStar.mutagen as MutagenName | undefined;
      if (!mutagen) return;
      if (!sourceStar.withMutagen(mutagen as never)) {
        throw new Error(`iztro 星曜 ${sourceStar.name} 的四化属性与原生判断不一致。`);
      }

      let targetIztroPalace: IztroPalace | undefined;
      try {
        targetIztroPalace = targetAstrolabe.star(sourceStar.name).palace();
      } catch {
        throw new Error(`iztro 目标盘无法定位四化星曜 ${sourceStar.name}。`);
      }
      if (!targetIztroPalace) {
        throw new Error(`iztro 目标盘星曜 ${sourceStar.name} 未返回所在宫位。`);
      }
      const targetPalace = target.palaces.find(
        (palace) => palace.index === targetIztroPalace.index,
      );
      if (!targetPalace) {
        throw new Error(`iztro 目标盘第 ${targetIztroPalace.index} 宫无法映射到结构化十二宫。`);
      }

      const sourcePalaceName = palaceDisplayName(sourcePalace);
      const targetPalaceName = palaceDisplayName(targetPalace);
      placements.push({
        key: `跨盘四化:${sourcePerson}:${sourceStar.name}:化${mutagen}:${targetPerson}:${targetPalace.index}`,
        status: '已命中',
        sourcePerson,
        targetPerson,
        star: sourceStar.name,
        mutagen,
        sourcePalace: sourcePalaceName,
        targetPalace: targetPalaceName,
        targetEarthlyBranch: targetPalace.earthly_branch,
        sourcePalaceKey: palaceFactKey(sourcePerson, sourcePalace),
        targetPalaceKey: palaceFactKey(targetPerson, targetPalace),
        calculationStepKey: 'ziwei:compatibility:calculation:cross-mutagens',
        sources: ['iztro 来源方本命星曜原生四化属性', 'iztro 目标方 star().palace() 原生定位'],
        calculation: `读取 iztro 原生星曜对象确认${people[sourcePerson]}${sourcePalaceName}的${sourceStar.name}生年化${mutagen}，再以目标盘 star().palace() 定位同名${sourceStar.name}到${people[targetPerson]}${targetPalaceName}（${targetPalace.earthly_branch}）`,
        promptText: `${people[sourcePerson]}${sourcePalaceName}的${sourceStar.name}生年化${mutagen}，同名${sourceStar.name}由 iztro 定位于${people[targetPerson]}盘${targetPalaceName}（${targetPalace.earthly_branch}）`,
        limitation: CROSS_MUTAGEN_LIMITATION,
      });
    });
  });

  return placements;
}

function personLabel(
  people: ZiweiCompatibilityEvidenceResult['people'],
  person: 'person1' | 'person2',
) {
  return people[person];
}

function isImportantOverlay(item: ZiweiPalaceOverlay) {
  return (
    item.sourcePalace.includes('命宫') ||
    item.sourcePalace.includes('身宫') ||
    item.sourcePalace.includes('夫妻')
  );
}

function buildBaseCalculationSteps(params: {
  people: ZiweiCompatibilityEvidenceResult['people'];
  payload1: AnalysisPayloadV1;
  payload2: AnalysisPayloadV1;
  overlays: ZiweiPalaceOverlay[];
  mutagens: ZiweiCrossMutagenPlacement[];
}): ZiweiCompatibilityCalculationStep[] {
  const sourceMutagenCount = [params.payload1, params.payload2].reduce(
    (count, payload) =>
      count +
      payload.palaces.reduce(
        (palaceCount, palace) =>
          palaceCount + allStars(palace).filter((star) => star.birth_mutagen).length,
        0,
      ),
    0,
  );
  return [
    {
      key: 'ziwei:compatibility:calculation:input',
      stage: '双盘输入校验',
      status: '已计算',
      inputs: { person1: params.people.person1, person2: params.people.person2 },
      result: { validChartCount: 2, validPalaceCount: 24 },
      dependsOnStepKeys: [],
      promptText: `已校验${params.people.person1}与${params.people.person2}两份本命盘共二十四宫资料`,
      sources: ['双方完整十二宫资料与宫位地支校验'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:compatibility:calculation:palace-index',
      stage: '十二宫地支索引',
      status: '已计算',
      inputs: { person1PalaceCount: 12, person2PalaceCount: 12 },
      result: { directionCount: 2, branchCountPerChart: 12 },
      dependsOnStepKeys: ['ziwei:compatibility:calculation:input'],
      promptText: '双方十二宫均按地支建立双向定位索引',
      sources: ['双方本命十二宫名称、序号与地支资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:compatibility:calculation:palace-overlays',
      stage: '关键宫位叠盘',
      status: '已计算',
      inputs: {
        person1KeyPalaceCount: keyPalaces(params.payload1).length,
        person2KeyPalaceCount: keyPalaces(params.payload2).length,
      },
      result: {
        overlayCount: params.overlays.length,
        importantOverlayCount: params.overlays.filter(isImportantOverlay).length,
      },
      dependsOnStepKeys: ['ziwei:compatibility:calculation:palace-index'],
      promptText: `双方命宫、身宫、夫妻、官禄、财帛、福德与迁移等关键宫位按同支轴位完成双向叠盘，记录${params.overlays.length}项定位事实`,
      sources: ['紫微双盘同支宫位映射规则', '双方本命关键宫位地支资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:compatibility:calculation:star-index',
      stage: '同名星曜索引',
      status: '已计算',
      inputs: {
        person1StarCount: params.payload1.palaces.reduce(
          (count, palace) => count + allStars(palace).length,
          0,
        ),
        person2StarCount: params.payload2.palaces.reduce(
          (count, palace) => count + allStars(palace).length,
          0,
        ),
      },
      result: { sourceMutagenStarCount: sourceMutagenCount },
      dependsOnStepKeys: ['ziwei:compatibility:calculation:input'],
      promptText: `双方十二宫星曜已按名称建立双向索引，并识别${sourceMutagenCount}个带生年四化标记的来源星曜`,
      sources: ['双方本命星曜名称与生年四化标记'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:compatibility:calculation:cross-mutagens',
      stage: '跨盘生年四化',
      status: '已计算',
      inputs: { sourceMutagenStarCount: sourceMutagenCount, directionCount: 2 },
      result: { placementCount: params.mutagens.length },
      dependsOnStepKeys: ['ziwei:compatibility:calculation:star-index'],
      promptText: `来源方生年四化星曜已在目标方盘中按同名星曜定位，记录${params.mutagens.length}项跨盘四化落宫事实`,
      sources: ['来源方本命生年四化标记', '目标方同名星曜落宫资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildCounterEvidenceFacts(params: {
  overlays: ZiweiPalaceOverlay[];
  mutagens: ZiweiCrossMutagenPlacement[];
}): ZiweiCompatibilityCounterEvidenceFact[] {
  const directions = [
    {
      key: 'person1-to-person2' as const,
      source: 'person1' as const,
      target: 'person2' as const,
      label: '第一人到第二人',
    },
    {
      key: 'person2-to-person1' as const,
      source: 'person2' as const,
      target: 'person1' as const,
      label: '第二人到第一人',
    },
  ];
  const facts = directions.flatMap((direction): ZiweiCompatibilityCounterEvidenceFact[] => {
    const overlays = params.overlays.filter(
      (item) => item.sourcePerson === direction.source && item.targetPerson === direction.target,
    );
    const mutagens = params.mutagens.filter(
      (item) => item.sourcePerson === direction.source && item.targetPerson === direction.target,
    );
    return [
      {
        key: `ziwei:compatibility:counter:palace-overlays:${direction.key}`,
        type: '关键宫位叠盘覆盖',
        status: overlays.length ? '有可用证据' : '未命中',
        direction: direction.key,
        ownerFactKeys: [
          'ziwei:compatibility:calculation:palace-overlays',
          ...overlays.map((item) => item.key),
        ],
        promptText: overlays.length
          ? `${direction.label}记录${overlays.length}项关键宫位同支叠盘事实`
          : `${direction.label}未生成关键宫位同支叠盘事实；未命中不代表现实关系有利或不利`,
        sources: ['双方关键宫位地支双向定位结果'],
        limitation: COUNTER_FACT_LIMITATION,
      },
      {
        key: `ziwei:compatibility:counter:cross-mutagens:${direction.key}`,
        type: '跨盘四化覆盖',
        status: mutagens.length ? '有可用证据' : '未命中',
        direction: direction.key,
        ownerFactKeys: [
          'ziwei:compatibility:calculation:cross-mutagens',
          ...mutagens.map((item) => item.key),
        ],
        promptText: mutagens.length
          ? `${direction.label}记录${mutagens.length}项生年四化同名星曜落宫事实`
          : `${direction.label}未形成可定位的跨盘生年四化事实；不得补造四化落宫或据此推断关系好坏`,
        sources: ['来源方生年四化星曜与目标方同名星曜逐项定位结果'],
        limitation: COUNTER_FACT_LIMITATION,
      },
    ];
  });
  facts.push({
    key: 'ziwei:compatibility:counter:static-timing',
    type: '静态应期边界',
    status: '固有限制',
    ownerFactKeys: [
      'ziwei:compatibility:calculation:palace-overlays',
      'ziwei:compatibility:calculation:cross-mutagens',
      ...params.overlays.map((item) => item.key),
      ...params.mutagens.map((item) => item.key),
    ],
    promptText:
      '当前只比较双方本命盘长期结构，未提供双方同层级大限、流年、流月或流日资料，不生成具体年份、月份或日期应期',
    sources: ['当前分析对象为双方静态本命盘'],
    limitation: COUNTER_FACT_LIMITATION,
  });
  return facts;
}

function buildSummaryFact(params: {
  overlays: ZiweiPalaceOverlay[];
  mutagens: ZiweiCrossMutagenPlacement[];
  counterEvidenceFacts: ZiweiCompatibilityCounterEvidenceFact[];
}): ZiweiCompatibilitySummaryFact {
  const mutagenCounts: Partial<Record<MutagenName, number>> = {};
  params.mutagens.forEach((item) => {
    mutagenCounts[item.mutagen] = (mutagenCounts[item.mutagen] ?? 0) + 1;
  });
  const uncoveredMutagenDirections = params.counterEvidenceFacts
    .filter((item) => item.type === '跨盘四化覆盖' && item.status === '未命中' && item.direction)
    .map((item) => item.direction!);
  const status = params.mutagens.length
    ? '宫位与四化均有交叉'
    : params.overlays.length
      ? '仅见宫位叠盘'
      : '未见已列交叉事实';
  return {
    key: 'ziwei:compatibility:evidence-summary',
    status,
    factKeys: [
      'ziwei:compatibility:calculation:input',
      'ziwei:compatibility:calculation:palace-index',
      'ziwei:compatibility:calculation:palace-overlays',
      'ziwei:compatibility:calculation:star-index',
      'ziwei:compatibility:calculation:cross-mutagens',
      ...params.overlays.map((item) => item.key),
      ...params.mutagens.map((item) => item.key),
    ],
    palaceOverlayCount: params.overlays.length,
    importantPalaceOverlayCount: params.overlays.filter(isImportantOverlay).length,
    crossMutagenPlacementCount: params.mutagens.length,
    mutagenCounts,
    uncoveredMutagenDirections,
    promptText: `已记录宫位叠盘${params.overlays.length}项（其中命宫、身宫或夫妻等重点叠盘${params.overlays.filter(isImportantOverlay).length}项）、跨盘生年四化${params.mutagens.length}项${uncoveredMutagenDirections.length ? `；${uncoveredMutagenDirections.length}个方向未形成可定位的跨盘四化` : ''}`,
    sources: ['全部宫位叠盘与跨盘生年四化定位事实汇总'],
    limitation: SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(params: {
  overlays: ZiweiPalaceOverlay[];
  mutagens: ZiweiCrossMutagenPlacement[];
  summaryFact: ZiweiCompatibilitySummaryFact;
}): ZiweiCompatibilityLimitationFact[] {
  const definitions: Array<
    Pick<
      ZiweiCompatibilityLimitationFact,
      'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'
    >
  > = [
    {
      key: 'ziwei:compatibility:limitation:palace-causality',
      type: '宫位因果边界',
      ownerFactKeys: [
        'ziwei:compatibility:calculation:palace-overlays',
        ...params.overlays.map((item) => item.key),
      ],
      promptText:
        '宫位同支叠盘只说明双方宫位处于同一地支轴位，不等于现实吸引、冲突、忠诚、婚恋结果、合作结果或他人意图',
      sources: ['宫位轴位事实与现实关系因果分离原则'],
    },
    {
      key: 'ziwei:compatibility:limitation:mutagen-semantics',
      type: '四化语义边界',
      ownerFactKeys: [
        'ziwei:compatibility:calculation:cross-mutagens',
        ...params.mutagens.map((item) => item.key),
      ],
      promptText:
        '化禄、化权、化科、化忌只保留来源星曜与目标落宫链路；化禄不等于必然有利，化忌不等于必然不利',
      sources: ['生年四化定位事实与吉凶解释分离原则'],
    },
    {
      key: 'ziwei:compatibility:limitation:static-timing',
      type: '静态应期边界',
      ownerFactKeys: [params.summaryFact.key, ...params.summaryFact.factKeys],
      promptText:
        '静态本命双盘只描述长期结构；没有双方同层级运限资料时，不生成具体年份、月份、日期或唯一应期',
      sources: ['本命盘与运限盘分析层级边界'],
    },
    {
      key: 'ziwei:compatibility:limitation:data-scope',
      type: '资料范围边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText:
        '当前只使用双方十二宫、宫位地支、星曜与生年四化标记，不把未提供的飞化、运限或现实关系资料补造成证据',
      sources: ['当前双盘输入资料范围'],
    },
    {
      key: 'ziwei:compatibility:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key, ...params.summaryFact.factKeys],
      promptText:
        '不输出匹配总分、成功率、分手或离婚概率、出轨判断、合作收益保证、必然断语，也不以盘面关系替代现实沟通与风险核验',
      sources: ['传统盘面事实与现实决策分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function createEvidence(
  people: ZiweiCompatibilityEvidenceResult['people'],
  calculationSteps: ZiweiCompatibilityCalculationStep[],
  overlays: ZiweiPalaceOverlay[],
  mutagens: ZiweiCrossMutagenPlacement[],
  counterEvidenceFacts: ZiweiCompatibilityCounterEvidenceFact[],
  summaryFact: ZiweiCompatibilitySummaryFact,
  limitationFacts: ZiweiCompatibilityLimitationFact[],
): PromptEvidenceBundle {
  const importantOverlays = overlays.filter(isImportantOverlay);
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '紫微双盘计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['紫微合盘', '计算链'],
    },
    ...importantOverlays.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: `${personLabel(people, item.sourcePerson)}${item.sourcePalace}落在${personLabel(people, item.targetPerson)}${item.targetPalace}轴位`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.calculation}`,
      tags: ['紫微合盘', '宫位叠盘', item.sourcePalace, item.targetPalace],
    })),
    ...mutagens.map((item): PromptEvidenceItem => ({
      level:
        item.sourcePalace.includes('命宫') || item.targetPalace.includes('命宫') ? '主证' : '辅证',
      title: `${personLabel(people, item.sourcePerson)}${item.star}生年化${item.mutagen}落入${personLabel(people, item.targetPerson)}${item.targetPalace}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.calculation}`,
      tags: ['紫微合盘', '生年四化', `化${item.mutagen}`, item.targetPalace],
    })),
    ...overlays
      .filter((item) => !importantOverlays.includes(item))
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `${personLabel(people, item.sourcePerson)}${item.sourcePalace}对应${personLabel(people, item.targetPerson)}${item.targetPalace}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: `${item.sources.join('；')}；计算：${item.calculation}`,
        tags: ['紫微合盘', '宫位叠盘'],
      })),
    ...counterEvidenceFacts
      .filter((item) => item.status !== '有可用证据')
      .map((item): PromptEvidenceItem => ({
        level: '反证',
        title: `${item.type}：${item.status}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: item.sources.join('、'),
        tags: ['紫微合盘', '反证', item.type, item.status],
      })),
    {
      level: '辅证',
      title: `紫微双盘证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['紫微合盘', '证据汇总', summaryFact.status],
    },
    {
      level: '应期',
      title: '静态双盘应期边界',
      detail: `${limitationFacts.find((item) => item.type === '静态应期边界')?.promptText ?? ''}；宫位叠盘或生年四化定位成立，也不证明某个具体时间必然发生关系事件。`,
      source: '本命盘与运限盘分析层级边界',
      tags: ['紫微合盘', '应期边界'],
    },
    {
      level: '限制',
      title: '紫微双盘证据边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['解释边界'],
    },
  ];
  return {
    title: '紫微双盘结构化证据',
    items,
    emptyText: '当前两盘未生成可定位的宫位或四化交叉证据。',
  };
}

export function analyzeZiweiCompatibility(
  payload1: AnalysisPayloadV1,
  payload2: AnalysisPayloadV1,
  options: ZiweiCompatibilityOptions = {},
): ZiweiCompatibilityEvidenceResult {
  assertPayload(payload1, '第一人紫微盘');
  assertPayload(payload2, '第二人紫微盘');
  if (Boolean(options.astrolabe1) !== Boolean(options.astrolabe2)) {
    throw new Error('紫微双盘原生计算必须同时提供双方 iztro 星盘。');
  }
  const people = {
    person1: options.person1Name?.trim() || '第一人',
    person2: options.person2Name?.trim() || '第二人',
  };
  const palaceOverlays = [
    ...calculateOverlays('person1', 'person2', payload1, payload2, people),
    ...calculateOverlays('person2', 'person1', payload2, payload1, people),
  ];
  const crossMutagenPlacements = [
    ...calculateCrossMutagens(
      'person1',
      'person2',
      payload1,
      payload2,
      people,
      options.astrolabe1,
      options.astrolabe2,
    ),
    ...calculateCrossMutagens(
      'person2',
      'person1',
      payload2,
      payload1,
      people,
      options.astrolabe2,
      options.astrolabe1,
    ),
  ];
  const calculationSteps = buildBaseCalculationSteps({
    people,
    payload1,
    payload2,
    overlays: palaceOverlays,
    mutagens: crossMutagenPlacements,
  });
  const counterEvidenceFacts = buildCounterEvidenceFacts({
    overlays: palaceOverlays,
    mutagens: crossMutagenPlacements,
  });
  const summaryFact = buildSummaryFact({
    overlays: palaceOverlays,
    mutagens: crossMutagenPlacements,
    counterEvidenceFacts,
  });
  calculationSteps.push({
    key: 'ziwei:compatibility:calculation:summary',
    stage: '证据汇总',
    status: '已计算',
    inputs: { factCount: summaryFact.factKeys.length },
    result: {
      status: summaryFact.status,
      palaceOverlayCount: summaryFact.palaceOverlayCount,
      importantPalaceOverlayCount: summaryFact.importantPalaceOverlayCount,
      crossMutagenPlacementCount: summaryFact.crossMutagenPlacementCount,
      uncoveredMutagenDirections: summaryFact.uncoveredMutagenDirections,
    },
    dependsOnStepKeys: [
      'ziwei:compatibility:calculation:palace-overlays',
      'ziwei:compatibility:calculation:cross-mutagens',
    ],
    promptText: summaryFact.promptText,
    sources: summaryFact.sources,
    limitation: CALCULATION_STEP_LIMITATION,
  });
  const limitationFacts = buildLimitationFacts({
    overlays: palaceOverlays,
    mutagens: crossMutagenPlacements,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);
  const evidence = createEvidence(
    people,
    calculationSteps,
    palaceOverlays,
    crossMutagenPlacements,
    counterEvidenceFacts,
    summaryFact,
    limitationFacts,
  );
  return {
    key: 'ziwei:compatibility:evidence',
    status: '已计算',
    people,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    palaceOverlays,
    crossMutagenPlacements,
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText: [
      '【紫微双盘结构化证据】',
      ...formatPromptEvidenceBundle(evidence),
      `计算链概览：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `反证与应期边界：${counterEvidence.join('；')}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        '宫位叠盘按十二宫地支位置一一映射，重点保留命宫、身宫、夫妻、官禄、财帛、福德与迁移轴。',
        options.astrolabe1 && options.astrolabe2
          ? '跨盘四化直接读取 iztro 原生星曜四化属性，并以目标盘 star().palace() 定位同名星曜所在宫位。'
          : '兼容模式下，跨盘四化由结构化本命盘已标注的生年四化星曜出发，定位同名星曜在另一方命盘的宫位。',
        '静态本命双盘只描述长期结构，不生成具体年份应期；应期需要双方大限、流年等同层级资料。',
        '化星与宫位关系不压缩为匹配总分，也不把单一化禄或化忌解释为必然结果。',
      ],
    },
  };
}
