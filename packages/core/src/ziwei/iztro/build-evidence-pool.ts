import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace';
import type {
  EvidenceFact,
  MutagenName,
  PalaceFact,
  ScopeType,
  ZiweiEvidenceAnalysis,
  ZiweiEvidenceCalculationStep,
  ZiweiEvidenceCounterEvidenceFact,
  ZiweiEvidenceLimitationFact,
  ZiweiEvidenceSummaryFact,
} from '../../types/analysis';

type EvidenceDraft = Omit<
  EvidenceFact,
  | 'id'
  | 'key'
  | 'level'
  | 'source'
  | 'sources'
  | 'calculation'
  | 'calculationStepKey'
  | 'dependsOnStepKeys'
  | 'promptText'
  | 'limitation'
  | 'limitations'
> & { priority: number };

const CALCULATION_STEP_LIMITATION =
  '紫微证据步骤只证明十二宫、星曜、四化与所选运限如何形成当前证据池；不得把证据数量解释为吉凶分数、匹配率、事件概率或固定应期' as const;
const COUNTER_FACT_LIMITATION =
  '紫微反证事实只记录宫位、运限与四化资料是否足以形成当前线索；未命中或未定位不等于现实有利、不利或没有其他传统关系' as const;
const SUMMARY_FACT_LIMITATION =
  '紫微证据汇总只统计本命宫星、四化、三方四正、运限落宫、运限四化、资料缺口、反证与限制覆盖；不得按数量生成命盘总分、吉凶概率、事件概率或唯一应期' as const;
const LIMITATION_FACT_LIMITATION =
  '紫微限制事实用于约束宫位、星曜、四化与运限证据可以支持的解释范围，不得被反向当作现实因果、人物意图、吉凶概率或保证有效建议的证据' as const;

const MUTAGEN_LIST: MutagenName[] = ['禄', '权', '科', '忌'];

const KEY_PALACE_NAMES = new Set([
  '命宫',
  '财帛',
  '官禄',
  '夫妻',
  '福德',
  '迁移',
  '子女',
  '田宅',
  '疾厄',
  '兄弟',
  '父母',
  '仆役',
]);

function buildStableKey(parts: Array<string | number | undefined>) {
  return parts.filter(Boolean).join(':');
}

function mapScopeLabel(scope: ScopeType): string {
  switch (scope) {
    case 'origin':
      return '本命';
    case 'decadal':
      return '大限';
    case 'yearly':
      return '流年';
    case 'monthly':
      return '流月';
    case 'daily':
      return '流日';
    case 'hourly':
      return '流时';
    case 'age':
      return '小限';
  }
}

function resolveCurrentScopeLabel(horoscope: IFunctionalHoroscope, currentScope: ScopeType) {
  switch (currentScope) {
    case 'decadal':
      return horoscope.decadal.name || '大限';
    case 'yearly':
      return horoscope.yearly.name || '流年';
    case 'monthly':
      return horoscope.monthly.name || '流月';
    case 'daily':
      return horoscope.daily.name || '流日';
    case 'hourly':
      return horoscope.hourly.name || '流时';
    case 'age':
      return horoscope.age?.name || '小限';
    case 'origin':
    default:
      return mapScopeLabel(currentScope);
  }
}

function getPalaceNamesByIndexes(palaces: PalaceFact[], indexes: number[]) {
  return indexes
    .map((index) => palaces.find((item) => item.index === index)?.name)
    .filter(Boolean) as string[];
}

function formatPalaceName(name: string) {
  return name.endsWith('宫') ? name : `${name}宫`;
}

function buildScopeTitle(scope: ScopeType, scopeName?: string) {
  const base = mapScopeLabel(scope);
  return scopeName && scopeName !== base ? `${base}（${scopeName}）` : base;
}

function getScopeItems(horoscope: IFunctionalHoroscope): Array<{
  scope: ScopeType;
  item: IFunctionalHoroscope['decadal'];
  landingPalace: IFunctionalPalace | undefined;
}> {
  return [
    {
      scope: 'decadal',
      item: horoscope.decadal,
      landingPalace: horoscope.palace('命宫', 'decadal'),
    },
    {
      scope: 'yearly',
      item: horoscope.yearly,
      landingPalace: horoscope.palace('命宫', 'yearly'),
    },
    {
      scope: 'monthly',
      item: horoscope.monthly,
      landingPalace: horoscope.palace('命宫', 'monthly'),
    },
    {
      scope: 'daily',
      item: horoscope.daily,
      landingPalace: horoscope.palace('命宫', 'daily'),
    },
    {
      scope: 'hourly',
      item: horoscope.hourly,
      landingPalace: horoscope.palace('命宫', 'hourly'),
    },
    { scope: 'age', item: horoscope.age, landingPalace: horoscope.agePalace() },
  ];
}

function collectScopeStructureEvidence(params: {
  astrolabe: IFunctionalAstrolabe;
  horoscope: IFunctionalHoroscope;
  currentScope: ScopeType;
  palaces: PalaceFact[];
}): EvidenceDraft[] {
  const { astrolabe, horoscope, currentScope, palaces } = params;
  const drafts: EvidenceDraft[] = [];
  const landingPriority: Record<ScopeType, number> = {
    origin: 0,
    decadal: 94,
    yearly: 93,
    monthly: 89,
    daily: 88,
    hourly: 76,
    age: 78,
  };

  if (currentScope === 'origin') {
    return drafts;
  }

  getScopeItems(horoscope).forEach(({ scope, item, landingPalace }) => {
    const palace = palaces.find((candidate) => candidate.index === landingPalace?.index);
    if (!palace) return;

    const scopeLabel = buildScopeTitle(scope, item.name);
    const stemBranch = [item.heavenlyStem, item.earthlyBranch].filter(Boolean).join('');

    drafts.push({
      stable_key: buildStableKey(['scope-landing', scope, palace.index, item.name]),
      type: 'scope_landing',
      title: `${scopeLabel}落入本命${formatPalaceName(palace.name)}`,
      scope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `${scopeLabel}${stemBranch ? `干支为${stemBranch}，` : ''}命宫由运限对象定位到本命${formatPalaceName(palace.name)}。`,
      priority: landingPriority[scope],
    });

    item.mutagen?.slice(0, MUTAGEN_LIST.length).forEach((starName, index) => {
      const mutagen = MUTAGEN_LIST[index];
      let nativeTargetPalace: IFunctionalPalace | undefined;
      try {
        nativeTargetPalace = astrolabe.star(starName as never).palace();
      } catch {
        nativeTargetPalace = undefined;
      }
      const targetPalace = palaces.find(
        (candidate) => candidate.index === nativeTargetPalace?.index,
      );
      const dynamicPalaceName = targetPalace ? item.palaceNames[targetPalace.index] : undefined;
      const palaceIndexes = targetPalace
        ? Array.from(new Set([palace.index, targetPalace.index]))
        : [palace.index];
      const palaceNames = targetPalace
        ? Array.from(new Set([palace.name, targetPalace.name]))
        : [palace.name];

      drafts.push({
        stable_key: buildStableKey(['scope-mutagen-destination', scope, starName, mutagen]),
        type: 'scope_mutagen_destination',
        title: targetPalace
          ? `${scopeLabel}${starName}化${mutagen}入本命${formatPalaceName(targetPalace.name)}${dynamicPalaceName ? `（当前${scopeLabel}${formatPalaceName(dynamicPalaceName)}）` : ''}`
          : `${scopeLabel}${starName}化${mutagen}`,
        scope,
        palace_indexes: palaceIndexes,
        palace_names: palaceNames,
        star_names: [starName],
        mutagens: [mutagen],
        description: targetPalace
          ? `${scopeLabel}四化序列中的${starName}对应化${mutagen}；该星的本命物理落宫为${formatPalaceName(targetPalace.name)}${dynamicPalaceName ? `，当前对应${scopeLabel}${formatPalaceName(dynamicPalaceName)}` : ''}，运限命宫落于本命${formatPalaceName(palace.name)}。`
          : `${scopeLabel}四化序列中的${starName}对应化${mutagen}，但该星未能通过本命星曜对象定位宫位。`,
        status: targetPalace ? '已记录' : '资料缺口',
        priority: mutagen === '忌' ? 96 : mutagen === '禄' ? 94 : 91,
      });
    });
  });

  return drafts;
}

function collectPalaceEvidence(params: {
  astrolabe: IFunctionalAstrolabe;
  currentScope: ScopeType;
  currentScopeLabel: string;
  palace: PalaceFact;
  palaces: PalaceFact[];
}): EvidenceDraft[] {
  const { astrolabe, currentScope, currentScopeLabel, palace, palaces } = params;
  const drafts: EvidenceDraft[] = [];
  const palaceObj = astrolabe.palace(palace.name as never) as IFunctionalPalace | undefined;

  if (!palaceObj) return drafts;

  if (palace.major_stars.length > 0) {
    drafts.push({
      stable_key: buildStableKey([
        'major',
        palace.index,
        palace.major_stars.map((s) => s.name).join('|'),
      ]),
      type: 'palace_major_stars',
      title: `${palace.name}主星为${palace.major_stars.map((s) => s.name).join('、')}`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: palace.major_stars.map((s) => s.name),
      mutagens: [],
      description: `${palace.name}登记主星${palace.major_stars.map((star) => star.name).join('、')}。`,
      priority: palace.name === '命宫' ? 100 : 60,
    });
  }

  if (palace.empty_state) {
    drafts.push({
      stable_key: buildStableKey(['empty', palace.index]),
      type: 'palace_empty',
      title: `${palace.name}为空宫`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `${palace.name}的主星列表为空；对宫及三方四正索引另行保留，供传统空宫合参。`,
      priority: 50,
    });
  }

  const birthMutagenStars = [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
  ].filter((star) => !!star.birth_mutagen);

  birthMutagenStars.forEach((star) => {
    drafts.push({
      stable_key: buildStableKey(['birth-mutagen', palace.index, star.name, star.birth_mutagen]),
      type: 'palace_birth_mutagen',
      title: `${palace.name}见生年化${star.birth_mutagen}`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [star.name],
      mutagens: [star.birth_mutagen!],
      description: `${star.name}在${palace.name}带有生年化${star.birth_mutagen}。`,
      priority: 80,
    });
  });

  const activeScopeMutagenStars = [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
  ].filter((star) => !!star.active_scope_mutagen);

  activeScopeMutagenStars.forEach((star) => {
    drafts.push({
      stable_key: buildStableKey([
        'scope-mutagen',
        currentScope,
        palace.index,
        star.name,
        star.active_scope_mutagen,
      ]),
      type: 'palace_scope_mutagen',
      title: `${palace.name}见${currentScopeLabel}化${star.active_scope_mutagen}`,
      scope: currentScope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [star.name],
      mutagens: [star.active_scope_mutagen!],
      description: `${star.name}在当前运限下带有化${star.active_scope_mutagen}。`,
      priority: 85,
    });
  });

  if (currentScope !== 'origin' && palace.scope_hits.length > 0) {
    drafts.push({
      stable_key: buildStableKey(['scope-hit', palace.index, palace.scope_hits.join('|')]),
      type: 'palace_scope_hit',
      title: `${palace.scope_hits.join('、')}位于${palace.name}`,
      scope: currentScope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `${palace.name}在当前参考时间下被一个或多个运限命中。`,
      priority: 70,
    });
  }

  const surrounded = astrolabe.surroundedPalaces(palace.name as never);

  MUTAGEN_LIST.forEach((mutagen) => {
    if (!surrounded.haveMutagen(mutagen as never)) return;
    const priority = mutagen === '忌' ? 90 : mutagen === '禄' ? 88 : 82;
    drafts.push({
      stable_key: buildStableKey(['surrounded-mutagen', mutagen, palace.index]),
      type: 'surrounded_mutagen',
      title: `${palace.name}三方四正见化${mutagen}`,
      scope: 'origin',
      palace_indexes: palace.surrounded_palace_indexes,
      palace_names: getPalaceNamesByIndexes(palaces, palace.surrounded_palace_indexes),
      star_names: [],
      mutagens: [mutagen],
      description: `${palace.name}及其三方四正宫位中可见化${mutagen}信息。`,
      priority,
    });
  });

  const selfMutagens = palace.self_mutagens ?? [];
  selfMutagens.forEach((mutagen) => {
    drafts.push({
      stable_key: buildStableKey(['self-mutaged', palace.index, mutagen]),
      type: 'palace_self_mutaged',
      title: `${palace.name}出现自化${mutagen}`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [mutagen],
      description: `${palace.name}的自化列表包含化${mutagen}。`,
      priority: mutagen === '忌' ? 82 : 75,
    });
  });

  if (KEY_PALACE_NAMES.has(palace.name) && palace.mutaged_palaces) {
    palace.mutaged_palaces.forEach((target) => {
      if (target.palace_index === undefined || !target.palace_name) return;
      const isToSelf = target.palace_index === palace.index;
      drafts.push({
        stable_key: buildStableKey([
          'mutaged-place',
          palace.index,
          target.mutagen,
          target.palace_index,
        ]),
        type: 'palace_mutaged_place',
        title: `${palace.name}化${target.mutagen}入${target.palace_name}`,
        scope: 'origin',
        palace_indexes: [palace.index, target.palace_index],
        palace_names: [palace.name, target.palace_name],
        star_names: [],
        mutagens: [target.mutagen],
        description: isToSelf
          ? `${palace.name}化${target.mutagen}回入本宫。`
          : `${palace.name}化${target.mutagen}落${target.palace_name}宫。`,
        priority: target.mutagen === '忌' ? 86 : target.mutagen === '禄' ? 84 : 78,
      });
    });
  }

  if (currentScope !== 'origin' && palace.dynamic_scope_name) {
    drafts.push({
      stable_key: buildStableKey([
        'dynamic-name',
        currentScope,
        palace.index,
        palace.dynamic_scope_name,
      ]),
      type: 'scope_dynamic_name',
      title: `${currentScopeLabel}视角下${palace.name}转为${palace.dynamic_scope_name}`,
      scope: currentScope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `在${currentScopeLabel}视角下，${palace.name}对应的动态宫名为${palace.dynamic_scope_name}。`,
      priority: 45,
    });
  }

  return drafts;
}

function finalizeEvidence(drafts: EvidenceDraft[]): EvidenceFact[] {
  const map = new Map<string, EvidenceDraft>();

  drafts.forEach((item) => {
    if (!map.has(item.stable_key)) {
      map.set(item.stable_key, item);
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority, ...item }, index) => {
      const isScope = item.type.startsWith('scope_') || item.type === 'palace_scope_mutagen';
      const isMutagen = item.type.includes('mutagen') || item.type.includes('mutaged');
      const calculationStepKey = isScope
        ? 'ziwei:evidence:calculation:scope-facts'
        : 'ziwei:evidence:calculation:natal-facts';
      const source = isScope
        ? '紫微运限排盘结果、当前运限落宫与四化序列'
        : '紫微本命盘宫位、星曜、四化与三方四正结构化资料';
      const calculation = isScope
        ? '按运限对象读取命宫落点和四化星名，再由本命星曜对象定位物理宫位与动态宫名'
        : isMutagen
          ? '按宫位星曜四化标记、自化列表、飞化目标索引及三方四正宫位逐项匹配'
          : '按十二宫索引读取主星、空宫状态及关联宫位，不使用吉凶总分';
      const limitations = [
        '仅证明当前排盘数据中存在相应宫位、星曜或四化关系，不直接证明现实事件与吉凶结果',
        isScope
          ? '运限关系只对应所选时间层级，不得外推为终身结论或伪精确日期'
          : '紫微宫星与四化属于传统术数结构，缺少现代统计因果验证',
      ];

      return {
        id: `E${index + 1}`,
        ...item,
        key: `ziwei:evidence:${item.stable_key}`,
        status: item.status ?? '已记录',
        level: priority >= 80 ? '主证' : '辅证',
        source,
        sources: [source],
        calculation,
        calculationStepKey,
        dependsOnStepKeys: [calculationStepKey],
        promptText: `${item.title}：${item.description}`,
        limitation: limitations.join('；'),
        limitations,
      };
    });
}

export function buildEvidenceAnalysis(params: {
  evidencePool: EvidenceFact[];
  currentScope: ScopeType;
  palaces: PalaceFact[];
  skipped?: boolean;
}): ZiweiEvidenceAnalysis {
  const { evidencePool, currentScope, palaces, skipped = false } = params;
  const evidenceKeys = evidencePool.map((item) => item.key ?? `ziwei:evidence:${item.stable_key}`);
  const natalFacts = evidencePool.filter(
    (item) => !(item.type.startsWith('scope_') || item.type === 'palace_scope_mutagen'),
  );
  const scopeFacts = evidencePool.filter(
    (item) => item.type.startsWith('scope_') || item.type === 'palace_scope_mutagen',
  );
  const scopeLandingFacts = evidencePool.filter((item) => item.type === 'scope_landing');
  const scopeMutagenFacts = evidencePool.filter(
    (item) => item.type === 'scope_mutagen_destination',
  );
  const missingFacts = evidencePool.filter((item) => item.status === '资料缺口');
  const palaceDataComplete =
    palaces.length === 12 && new Set(palaces.map((item) => item.index)).size === 12;
  const scopeApplicable = currentScope !== 'origin';
  const scopeDataComplete = !scopeApplicable || scopeLandingFacts.length > 0;
  const hasGap =
    skipped ||
    !palaceDataComplete ||
    natalFacts.length === 0 ||
    !scopeDataComplete ||
    missingFacts.length > 0;
  const summaryStatus: ZiweiEvidenceSummaryFact['status'] = skipped
    ? '未生成'
    : hasGap
      ? '证据链有缺口'
      : '证据链完整';
  const analysisStatus: ZiweiEvidenceAnalysis['status'] = skipped
    ? '未生成'
    : hasGap
      ? '存在资料缺口'
      : '已计算';
  const calculationSteps: ZiweiEvidenceCalculationStep[] = [
    {
      key: 'ziwei:evidence:calculation:input',
      stage: '十二宫输入校验',
      status: palaceDataComplete ? '已计算' : '存在资料缺口',
      dependsOnStepKeys: [],
      inputs: { currentScope, palaceCount: palaces.length },
      result: {
        palaceDataComplete,
        uniquePalaceIndexCount: new Set(palaces.map((item) => item.index)).size,
      },
      promptText: palaceDataComplete
        ? '已校验完整十二宫及唯一宫位索引'
        : `当前仅有${palaces.length}项宫位资料或宫位索引不唯一，证据链降级`,
      sources: ['紫微十二宫结构化盘面资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:evidence:calculation:natal-facts',
      stage: '本命证据采集',
      status: skipped || natalFacts.length === 0 ? '存在资料缺口' : '已计算',
      dependsOnStepKeys: ['ziwei:evidence:calculation:input'],
      inputs: { palaceCount: palaces.length },
      result: {
        natalFactCount: natalFacts.length,
        missingNatalFactCount: natalFacts.filter((item) => item.status === '资料缺口').length,
      },
      promptText: skipped
        ? '当前明确跳过本命证据采集，不补造宫星或四化线索'
        : `按宫位主星、空宫、生年四化、自化、飞化与三方四正采集${natalFacts.length}项本命事实`,
      sources: ['本命十二宫、星曜、四化、自化、飞化与三方四正资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:evidence:calculation:scope-facts',
      stage: '运限证据采集',
      status: !scopeApplicable
        ? '不适用'
        : skipped || !scopeDataComplete
          ? '存在资料缺口'
          : '已计算',
      dependsOnStepKeys: ['ziwei:evidence:calculation:input'],
      inputs: { currentScope, scopeApplicable },
      result: {
        scopeFactCount: scopeFacts.length,
        scopeLandingFactCount: scopeLandingFacts.length,
        scopeMutagenFactCount: scopeMutagenFacts.length,
        missingScopeFactCount: scopeFacts.filter((item) => item.status === '资料缺口').length,
      },
      promptText: !scopeApplicable
        ? '当前为本命范围，运限证据采集明确标记为不适用'
        : skipped
          ? '当前明确跳过运限证据采集，不补造落宫或四化飞入'
          : `按所选运限层级采集${scopeFacts.length}项落宫、四化与动态宫位事实`,
      sources: ['当前运限落宫、四化序列与本命星曜定位资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'ziwei:evidence:calculation:summary',
      stage: '证据汇总',
      status: hasGap ? '存在资料缺口' : '已计算',
      dependsOnStepKeys: [
        'ziwei:evidence:calculation:natal-facts',
        'ziwei:evidence:calculation:scope-facts',
      ],
      inputs: { evidenceFactCount: evidencePool.length, currentScope },
      result: {
        summaryStatus,
        missingFactCount: missingFacts.length,
        primaryFactCount: evidencePool.filter((item) => item.level === '主证').length,
      },
      promptText: `证据池汇总为${summaryStatus}，记录${evidencePool.length}项事实，其中资料缺口${missingFacts.length}项`,
      sources: ['本命证据、运限证据与资料缺口逐项汇总'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  const counterEvidenceFacts: ZiweiEvidenceCounterEvidenceFact[] = [
    {
      key: 'ziwei:evidence:counter:palace-coverage',
      type: '十二宫资料覆盖',
      status: palaceDataComplete && natalFacts.length > 0 && !skipped ? '有可用证据' : '资料不足',
      ownerFactKeys: [
        'ziwei:evidence:calculation:input',
        'ziwei:evidence:calculation:natal-facts',
        ...natalFacts.map((item) => item.key ?? `ziwei:evidence:${item.stable_key}`),
      ],
      promptText:
        palaceDataComplete && natalFacts.length > 0 && !skipped
          ? `十二宫资料完整并形成${natalFacts.length}项本命证据`
          : '十二宫或本命证据资料不足，不生成完整本命证据结论',
      sources: ['十二宫输入校验与本命证据采集结果'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ziwei:evidence:counter:scope-coverage',
      type: '运限资料覆盖',
      status: !scopeApplicable
        ? '不适用'
        : scopeDataComplete && !skipped
          ? '有可用证据'
          : '资料不足',
      ownerFactKeys: [
        'ziwei:evidence:calculation:scope-facts',
        ...scopeFacts.map((item) => item.key ?? `ziwei:evidence:${item.stable_key}`),
      ],
      promptText: !scopeApplicable
        ? '当前为本命范围，不生成运限落宫、动态宫位或运限四化结论'
        : scopeDataComplete && !skipped
          ? `当前运限形成${scopeFacts.length}项结构化证据`
          : '当前运限缺少可定位落宫资料，不补造运限结论',
      sources: ['当前分析范围与运限证据采集结果'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'ziwei:evidence:counter:mutagen-location',
      type: '四化定位覆盖',
      status:
        !scopeApplicable || scopeMutagenFacts.length === 0
          ? '不适用'
          : scopeMutagenFacts.some((item) => item.status === '资料缺口')
            ? '存在未定位'
            : '有可用证据',
      ownerFactKeys: [
        'ziwei:evidence:calculation:scope-facts',
        ...scopeMutagenFacts.map((item) => item.key ?? `ziwei:evidence:${item.stable_key}`),
      ],
      promptText: !scopeApplicable
        ? '本命范围不使用运限四化定位'
        : scopeMutagenFacts.length === 0
          ? '当前运限未提供可定位的四化序列，不补造四化飞入'
          : scopeMutagenFacts.some((item) => item.status === '资料缺口')
            ? `${scopeMutagenFacts.filter((item) => item.status === '资料缺口').length}项运限四化星曜未能在本命宫位索引中定位，必须保留资料缺口`
            : `${scopeMutagenFacts.length}项运限四化均已定位到本命宫位`,
      sources: ['运限四化序列与本命同名星曜定位结果'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
  const limitationCount = 5;
  const summaryFact: ZiweiEvidenceSummaryFact = {
    key: 'ziwei:evidence-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...evidenceKeys,
      ...counterEvidenceFacts.map((item) => item.key),
    ],
    evidenceFactCount: evidencePool.length,
    natalFactCount: natalFacts.length,
    scopeFactCount: scopeFacts.length,
    primaryFactCount: evidencePool.filter((item) => item.level === '主证').length,
    supportingFactCount: evidencePool.filter((item) => item.level !== '主证').length,
    missingFactCount: missingFacts.length,
    counterEvidenceCount: counterEvidenceFacts.length,
    limitationFactCount: limitationCount,
    promptText: `紫微证据状态为${summaryStatus}；记录本命证据${natalFacts.length}项、运限证据${scopeFacts.length}项、主证${evidencePool.filter((item) => item.level === '主证').length}项、辅证${evidencePool.filter((item) => item.level !== '主证').length}项、资料缺口${missingFacts.length}项`,
    sources: ['紫微本命与运限证据池、计算链和反证逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
  const limitationDefinitions: Array<
    Pick<ZiweiEvidenceLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'ziwei:evidence:limitation:traditional-structure',
      type: '传统结构边界',
      ownerFactKeys: [summaryFact.key, ...evidenceKeys],
      promptText:
        '宫位、星曜、四化、空宫借对宫与三方四正只属于传统盘面结构，不直接证明现实性格、关系、财富、健康或事件结果',
      sources: ['紫微传统结构事实与现实因果分离原则'],
    },
    {
      key: 'ziwei:evidence:limitation:natal-timing',
      type: '本命应期边界',
      ownerFactKeys: [summaryFact.key, 'ziwei:evidence:calculation:natal-facts'],
      promptText: '本命证据只描述长期结构和触发条件，不生成具体年份、月份、日期或唯一应期',
      sources: ['本命盘与动态运限分析层级边界'],
    },
    {
      key: 'ziwei:evidence:limitation:scope-level',
      type: '运限层级边界',
      ownerFactKeys: [summaryFact.key, 'ziwei:evidence:calculation:scope-facts'],
      promptText:
        '运限事实只对应当前明确选择的大限、流年、流月、流日、流时或小限层级，不得外推到更细日期或终身结论',
      sources: ['当前运限范围与证据层级'],
    },
    {
      key: 'ziwei:evidence:limitation:missing-data',
      type: '资料缺口边界',
      ownerFactKeys: [
        summaryFact.key,
        'ziwei:evidence:calculation:summary',
        ...missingFacts.map((item) => item.key ?? `ziwei:evidence:${item.stable_key}`),
      ],
      promptText:
        '星曜或四化未定位、证据池未生成或宫位资料不足时必须明确降级，不得反推缺失落宫、星曜或应期',
      sources: ['资料缺口事实与计算状态'],
    },
    {
      key: 'ziwei:evidence:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [summaryFact.key, ...summaryFact.factKeys],
      promptText:
        '不得按证据数量生成命盘总分、吉凶概率、婚恋成败率、疾病判断、财富保证、人物意图或必然断语',
      sources: ['传统盘面事实与现实决策分离原则'],
    },
  ];
  const limitationFacts: ZiweiEvidenceLimitationFact[] = limitationDefinitions.map(
    (definition) => ({
      ...definition,
      status: '适用',
      limitation: LIMITATION_FACT_LIMITATION,
    }),
  );
  const limitations = limitationFacts.map((item) => item.promptText);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);

  return {
    key: 'ziwei:evidence',
    status: analysisStatus,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: [
      '【紫微本命与运限结构化证据】',
      `计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `反证核验：${counterEvidence.length ? counterEvidence.join('；') : '当前资料覆盖未见明确缺口；仍不得据证据数量生成现实保证'}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        '本命证据按十二宫主星、空宫、生年四化、自化、飞化与三方四正逐项采集。',
        '运限证据按所选层级读取原生落宫与四化序列，再由星曜对象定位本命目标宫位与动态宫名。',
        '未定位星曜与跳过分析状态保留为资料缺口，不补造宫位、四化或应期。',
        '证据数量只用于覆盖统计，不转换为吉凶总分、概率或必然结论。',
      ],
    },
  };
}

export function buildEvidencePool(params: {
  astrolabe: IFunctionalAstrolabe;
  horoscope: IFunctionalHoroscope;
  currentScope: ScopeType;
  palaces: PalaceFact[];
}): EvidenceFact[] {
  const { astrolabe, horoscope, currentScope, palaces } = params;
  const currentScopeLabel = resolveCurrentScopeLabel(horoscope, currentScope);

  const drafts = palaces.flatMap((palace) =>
    collectPalaceEvidence({
      astrolabe,
      currentScope,
      currentScopeLabel,
      palace,
      palaces,
    }),
  );

  return finalizeEvidence([
    ...collectScopeStructureEvidence({
      astrolabe,
      horoscope,
      currentScope,
      palaces,
    }),
    ...drafts,
  ]);
}
