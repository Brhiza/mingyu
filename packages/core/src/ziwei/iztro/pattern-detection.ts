/**
 * @file 紫微斗数格局检测与证据边界
 * @description 只执行已登记古籍版本、卷次、原文和可复算条件的格局规则。
 */

import type {
  PalaceFact,
  PatternFact,
  StarFact,
  ZiweiPatternAnalysis,
  ZiweiPatternCalculationStep,
  ZiweiPatternCounterEvidenceFact,
  ZiweiPatternLimitationFact,
  ZiweiPatternSummaryFact,
} from '../../types/analysis';

const ZIWEI_PALACE_COUNT = 12;
const RETIRED_UNVERIFIED_PATTERN_COUNT = 84;
const PATTERN_RULE_STEP_KEY = 'ziwei:pattern:calculation:rule-evaluation';
const VOLUME_ONE_URL =
  'https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷一&oldid=2665454';
const VOLUME_THREE_URL =
  'https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷三&oldid=2268626';

const PATTERN_CALCULATION_LIMITATION =
  '紫微格局计算步骤只证明登记规则如何核对当前十二宫、星曜、亮度、四化与宫位关系；不得把命中数量解释为命盘分数、现实概率或必然事件' as const;
const PATTERN_COUNTER_LIMITATION =
  '紫微格局反证只记录十二宫资料、登记规则与未命中数量的覆盖状态；未命中不等于没有其他传统格局，也不证明现实有利或不利' as const;
const PATTERN_SUMMARY_LIMITATION =
  '紫微格局汇总只统计当前登记规则的评估覆盖和命中分类；不得按吉格、凶格、中性格或命中数量生成综合吉凶、权重、概率与固定应期' as const;
const PATTERN_FACT_LIMITATION =
  '紫微格局限制事实用于约束规则命中可以支持的解释范围，不得被反向当作现实因果、人物命运、吉凶概率或保证有效建议的证据' as const;

type PatternContext = {
  palaces: PalaceFact[];
  palaceByIndex: Map<number, PalaceFact>;
  soulPalace: PalaceFact;
};

type PatternMatch = {
  palaces: PalaceFact[];
  stars: string[];
  conditions: string[];
};

type VerifiedPatternRule = {
  id: string;
  name: string;
  kind: PatternFact['kind'];
  description: string;
  traditionalInterpretation: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceQuote: string;
  calculation: string;
  detect: (context: PatternContext) => PatternMatch | null;
};

function normalizePalaceName(name: string) {
  return name.endsWith('宫') ? name.slice(0, -1) : name;
}

function natalStars(palace: PalaceFact): StarFact[] {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

function hasStar(palace: PalaceFact, name: string): boolean {
  return natalStars(palace).some((star) => star.name === name);
}

function hasAllStars(palace: PalaceFact, names: string[]): boolean {
  return names.every((name) => hasStar(palace, name));
}

function uniquePalaces(palaces: PalaceFact[]): PalaceFact[] {
  return [...new Map(palaces.map((palace) => [palace.index, palace])).values()];
}

function getNeighborPalaces(context: PatternContext, palace: PalaceFact): PalaceFact[] {
  return [
    context.palaceByIndex.get((palace.index + ZIWEI_PALACE_COUNT - 1) % ZIWEI_PALACE_COUNT),
    context.palaceByIndex.get((palace.index + 1) % ZIWEI_PALACE_COUNT),
  ].filter((item): item is PalaceFact => !!item);
}

function getSurroundedPalaces(context: PatternContext, palace: PalaceFact): PalaceFact[] {
  return palace.surrounded_palace_indexes
    .map((index) => context.palaceByIndex.get(index))
    .filter((item): item is PalaceFact => !!item);
}

function findStarPalace(palaces: PalaceFact[], starName: string): PalaceFact | undefined {
  return palaces.find((palace) => hasStar(palace, starName));
}

const VERIFIED_PATTERN_RULES: VerifiedPatternRule[] = [
  {
    id: 'ziwei-tianfu-tonggong',
    name: '紫府同宫',
    kind: 'auspicious',
    description: '紫微与天府同坐命宫。',
    traditionalInterpretation: '《紫微斗数全书》把此组合列为传统富贵格，但仍须合看吉煞与庙旺。',
    sourceTitle: '《紫微斗数全书》卷一·太微赋',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '紫府同宫终身福厚。',
    calculation: '检查本命命宫的原局星曜是否同时包含紫微与天府。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['紫微', '天府'])
        ? {
            palaces: [soulPalace],
            stars: ['紫微', '天府'],
            conditions: ['紫微与天府同坐命宫'],
          }
        : null;
    },
  },
  {
    id: 'fu-bi-gong-zhu',
    name: '辅弼拱主',
    kind: 'auspicious',
    description: '紫微守命，左辅、右弼从三方四正拱照或前后夹命。',
    traditionalInterpretation: '古籍以辅弼拱夹紫微为传统助力结构。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '辅弼拱主，紫微守命二星来拱是也，夹之亦然。',
    calculation: '先检查紫微守命，再在命宫三方四正与相邻两宫寻找左辅、右弼。',
    detect(context) {
      const { soulPalace } = context;
      if (!hasStar(soulPalace, '紫微')) return null;

      const neighbors = getNeighborPalaces(context, soulPalace);
      if (
        neighbors.length === 2 &&
        ((hasStar(neighbors[0], '左辅') && hasStar(neighbors[1], '右弼')) ||
          (hasStar(neighbors[0], '右弼') && hasStar(neighbors[1], '左辅')))
      ) {
        return {
          palaces: [soulPalace, ...neighbors],
          stars: ['紫微', '左辅', '右弼'],
          conditions: ['紫微守命', '左辅与右弼前后夹命'],
        };
      }

      const surrounded = getSurroundedPalaces(context, soulPalace).filter(
        (palace) => palace.index !== soulPalace.index,
      );
      const left = findStarPalace(surrounded, '左辅');
      const right = findStarPalace(surrounded, '右弼');
      return left && right
        ? {
            palaces: uniquePalaces([soulPalace, left, right]),
            stars: ['紫微', '左辅', '右弼'],
            conditions: ['紫微守命', '左辅与右弼从命宫三方四正拱照'],
          }
        : null;
    },
  },
  {
    id: 'jun-chen-qing-hui',
    name: '君臣庆会',
    kind: 'auspicious',
    description: '紫微、左辅、右弼同守命宫。',
    traditionalInterpretation: '古籍把紫微与左右同守命宫列为君臣庆会。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '君臣庆会，紫微左右同守命是也，更会相武阴妙上。',
    calculation: '检查本命命宫的原局星曜是否同时包含紫微、左辅与右弼。',
    detect({ soulPalace }) {
      return hasAllStars(soulPalace, ['紫微', '左辅', '右弼'])
        ? {
            palaces: [soulPalace],
            stars: ['紫微', '左辅', '右弼'],
            conditions: ['紫微、左辅、右弼同守命宫'],
          }
        : null;
    },
  },
  {
    id: 'zuo-you-jia-ming',
    name: '左右夹命',
    kind: 'auspicious',
    description: '左辅、右弼分居命宫相邻两宫。',
    traditionalInterpretation: '古籍把左辅、右弼前后夹命列为传统贵格。',
    sourceTitle: '《紫微斗数全书》卷三·左辅右弼',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '左右夹命为贵格，如安命在丑宫，左辅在子宫，右弼在寅宫。',
    calculation: '检查命宫前后相邻两宫是否分别出现左辅与右弼。',
    detect(context) {
      const neighbors = getNeighborPalaces(context, context.soulPalace);
      if (neighbors.length !== 2) return null;
      const matched =
        (hasStar(neighbors[0], '左辅') && hasStar(neighbors[1], '右弼')) ||
        (hasStar(neighbors[0], '右弼') && hasStar(neighbors[1], '左辅'));
      return matched
        ? {
            palaces: [context.soulPalace, ...neighbors],
            stars: ['左辅', '右弼'],
            conditions: ['左辅、右弼分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'zuo-gui-xiang-gui',
    name: '坐贵向贵',
    kind: 'auspicious',
    description: '天魁、天钺一曜坐命，另一曜在对宫。',
    traditionalInterpretation: '古籍把魁钺在命宫与对宫相互坐拱列为传统贵格。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '坐贵向贵，谓魁钺在命迭相坐拱是也。',
    calculation: '检查命宫与对宫是否分别出现天魁、天钺。',
    detect(context) {
      const opposite = context.palaceByIndex.get(context.soulPalace.opposite_palace_index);
      if (!opposite) return null;
      const matched =
        (hasStar(context.soulPalace, '天魁') && hasStar(opposite, '天钺')) ||
        (hasStar(context.soulPalace, '天钺') && hasStar(opposite, '天魁'));
      return matched
        ? {
            palaces: [context.soulPalace, opposite],
            stars: ['天魁', '天钺'],
            conditions: ['天魁、天钺一曜坐命，另一曜在对宫'],
          }
        : null;
    },
  },
  {
    id: 'jin-yu-fu-jia',
    name: '金舆扶驾',
    kind: 'auspicious',
    description: '紫微守命，太阳、太阴分居命宫相邻两宫。',
    traditionalInterpretation: '古籍把日月前后夹辅紫微守命列为金舆扶驾。',
    sourceTitle: '《紫微斗数全书》卷一·定富贵局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '金舆扶驾，紫微守命前后有日月来夹是也。',
    calculation: '先检查紫微守命，再检查命宫前后相邻两宫是否分别出现太阳与太阴。',
    detect(context) {
      if (!hasStar(context.soulPalace, '紫微')) return null;
      const neighbors = getNeighborPalaces(context, context.soulPalace);
      if (neighbors.length !== 2) return null;
      const matched =
        (hasStar(neighbors[0], '太阳') && hasStar(neighbors[1], '太阴')) ||
        (hasStar(neighbors[0], '太阴') && hasStar(neighbors[1], '太阳'));
      return matched
        ? {
            palaces: [context.soulPalace, ...neighbors],
            stars: ['紫微', '太阳', '太阴'],
            conditions: ['紫微守命', '太阳、太阴分居命宫相邻两宫'],
          }
        : null;
    },
  },
  {
    id: 'ke-quan-lu-gong-ming',
    name: '科权禄拱命',
    kind: 'auspicious',
    description: '紫微在子或午宫守命，命宫三方齐见生年化禄、化权、化科。',
    traditionalInterpretation: '古籍把紫微居子午并得科、权、禄三方照列为传统富贵结构。',
    sourceTitle: '《紫微斗数全书》卷三·紫微',
    sourceUrl: VOLUME_THREE_URL,
    sourceQuote: '紫微居子午科权禄照最为奇，科权禄三方照是也。',
    calculation:
      '先检查紫微是否在子或午宫守命，再检查命宫以外三个会照宫位原局星曜的生年四化，不混入大限、流年等运限四化。',
    detect(context) {
      if (
        !hasStar(context.soulPalace, '紫微') ||
        !['子', '午'].includes(context.soulPalace.earthly_branch)
      ) {
        return null;
      }
      const surrounded = getSurroundedPalaces(context, context.soulPalace).filter(
        (palace) => palace.index !== context.soulPalace.index,
      );
      const matchedStars = new Map<string, string>();
      surrounded.forEach((palace) => {
        natalStars(palace).forEach((star) => {
          if (star.birth_mutagen && ['禄', '权', '科'].includes(star.birth_mutagen)) {
            matchedStars.set(star.birth_mutagen, star.name);
          }
        });
      });
      const mutagens = ['禄', '权', '科'];
      return mutagens.every((mutagen) => matchedStars.has(mutagen))
        ? {
            palaces: surrounded.filter((palace) =>
              natalStars(palace).some((star) => mutagens.includes(star.birth_mutagen ?? '')),
            ),
            stars: [
              '紫微',
              ...mutagens.map((mutagen) => `${matchedStars.get(mutagen)}化${mutagen}`),
            ],
            conditions: [
              `紫微在${context.soulPalace.earthly_branch}宫守命`,
              '命宫以外三个会照宫位齐见生年化禄、化权、化科',
            ],
          }
        : null;
    },
  },
  {
    id: 'jian-wen-wu',
    name: '兼文武',
    kind: 'auspicious',
    description: '文曲、武曲同坐命宫或身宫。',
    traditionalInterpretation: '古籍把文曲、武曲同临命身列为兼文武。',
    sourceTitle: '《紫微斗数全书》卷一·论兼文武格',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '论兼文武格，文曲武曲在身命是也。',
    calculation: '在本命命宫及身宫检查文曲、武曲是否同宫。',
    detect(context) {
      const target = context.palaces.find(
        (palace) =>
          (palace.index === context.soulPalace.index || palace.is_body_palace) &&
          hasAllStars(palace, ['文曲', '武曲']),
      );
      return target
        ? {
            palaces: [target],
            stars: ['文曲', '武曲'],
            conditions: [
              `文曲、武曲同坐${target.index === context.soulPalace.index ? '命宫' : '身宫'}`,
            ],
          }
        : null;
    },
  },
  {
    id: 'liang-chong-hua-gai',
    name: '两重华盖',
    kind: 'inauspicious',
    description: '禄存与生年化禄同坐命宫，并见地空或地劫。',
    traditionalInterpretation: '古籍把双禄坐命又遇空劫列为传统受制结构。',
    sourceTitle: '《紫微斗数全书》卷一·定贫贱局',
    sourceUrl: VOLUME_ONE_URL,
    sourceQuote: '两重华盖，谓禄存化禄坐命遇空劫是也。',
    calculation: '检查命宫是否同时包含禄存、生年化禄星，并出现地空或地劫。',
    detect({ soulPalace }) {
      const huaLu = natalStars(soulPalace).find((star) => star.birth_mutagen === '禄');
      const voidStars = ['地空', '地劫'].filter((name) => hasStar(soulPalace, name));
      return hasStar(soulPalace, '禄存') && huaLu && voidStars.length > 0
        ? {
            palaces: [soulPalace],
            stars: ['禄存', `${huaLu.name}化禄`, ...voidStars],
            conditions: ['禄存与生年化禄同坐命宫', `命宫见${voidStars.join('、')}`],
          }
        : null;
    },
  },
];

export const VERIFIED_ZIWEI_PATTERN_RULE_COUNT = VERIFIED_PATTERN_RULES.length;
const VERIFIED_ZIWEI_PATTERN_STABLE_KEYS = new Set(
  VERIFIED_PATTERN_RULES.map((rule) => `ziwei:verified-pattern:${rule.id}`),
);

export function isVerifiedZiweiPatternKey(value: unknown): value is string {
  return typeof value === 'string' && VERIFIED_ZIWEI_PATTERN_STABLE_KEYS.has(value);
}

function assertValidPatternPalaces(
  palaces: PalaceFact[] | undefined,
): asserts palaces is PalaceFact[] {
  if (!Array.isArray(palaces) || palaces.length !== ZIWEI_PALACE_COUNT) {
    throw new Error('紫微格局检测需要完整 12 宫数据。');
  }

  const seenIndexes = new Set<number>();
  let soulPalaceCount = 0;

  palaces.forEach((palace, position) => {
    if (
      !Number.isInteger(palace?.index) ||
      palace.index < 0 ||
      palace.index >= ZIWEI_PALACE_COUNT
    ) {
      throw new Error(`紫微格局检测第 ${position + 1} 个宫位索引无效。`);
    }
    if (seenIndexes.has(palace.index)) {
      throw new Error(`紫微格局检测宫位索引 ${palace.index} 重复。`);
    }
    seenIndexes.add(palace.index);

    if (typeof palace.name !== 'string' || !palace.name.trim()) {
      throw new Error(`紫微格局检测第 ${position + 1} 个宫位名称缺失。`);
    }
    if (normalizePalaceName(palace.name) === '命') soulPalaceCount += 1;
    if (typeof palace.earthly_branch !== 'string' || !palace.earthly_branch.trim()) {
      throw new Error(`紫微格局检测${palace.name}地支缺失。`);
    }
    if (!Array.isArray(palace.major_stars)) {
      throw new Error(`紫微格局检测${palace.name}主星数据无效。`);
    }
    if (!Array.isArray(palace.minor_stars)) {
      throw new Error(`紫微格局检测${palace.name}辅星数据无效。`);
    }
    if (!Array.isArray(palace.other_stars)) {
      throw new Error(`紫微格局检测${palace.name}杂曜数据无效。`);
    }
    if (!Array.isArray(palace.scope_stars)) {
      throw new Error(`紫微格局检测${palace.name}运限星曜数据无效。`);
    }
  });

  if (soulPalaceCount !== 1) {
    throw new Error('紫微格局检测必须且只能包含一个命宫。');
  }

  palaces.forEach((palace) => {
    if (
      !Number.isInteger(palace.opposite_palace_index) ||
      !seenIndexes.has(palace.opposite_palace_index)
    ) {
      throw new Error(`紫微格局检测${palace.name}对宫索引无效。`);
    }
    if (
      !Array.isArray(palace.surrounded_palace_indexes) ||
      palace.surrounded_palace_indexes.length === 0
    ) {
      throw new Error(`紫微格局检测${palace.name}三方四正数据无效。`);
    }
    palace.surrounded_palace_indexes.forEach((index) => {
      if (!Number.isInteger(index) || !seenIndexes.has(index)) {
        throw new Error(`紫微格局检测${palace.name}三方四正宫位索引无效。`);
      }
    });
  });
}

function hasValidPatternPalaces(palaces: PalaceFact[] | undefined): boolean {
  try {
    assertValidPatternPalaces(palaces);
    return true;
  } catch {
    return false;
  }
}

export const ZIWEI_PATTERN_AUDIT_NOTICE =
  `原有${RETIRED_UNVERIFIED_PATTERN_COUNT}条项目格局规则已全部退役；现仅重新登记${VERIFIED_ZIWEI_PATTERN_RULE_COUNT}条具备固定版本、卷次、原文和可复算条件的规则，未登记格局不作命中或未命中结论` as const;

export function detectPatterns(params: {
  palaces: PalaceFact[];
  birthTimeLabel?: string;
  birthTimeRange?: string;
}): PatternFact[] {
  assertValidPatternPalaces(params.palaces);
  const soulPalace = params.palaces.find((palace) => normalizePalaceName(palace.name) === '命');
  if (!soulPalace) throw new Error('紫微格局检测缺少命宫。');
  const context: PatternContext = {
    palaces: params.palaces,
    palaceByIndex: new Map(params.palaces.map((palace) => [palace.index, palace])),
    soulPalace,
  };

  return VERIFIED_PATTERN_RULES.flatMap((rule): PatternFact[] => {
    const match = rule.detect(context);
    if (!match) return [];
    const stableKey = `ziwei:verified-pattern:${rule.id}`;
    const sources = [`${rule.sourceTitle}：“${rule.sourceQuote}”`, `${rule.sourceUrl}`];
    return [
      {
        id: rule.id,
        stable_key: stableKey,
        key: stableKey,
        status: '已命中',
        name: rule.name,
        kind: rule.kind,
        description: rule.description,
        palace_indexes: uniquePalaces(match.palaces).map((palace) => palace.index),
        palace_names: uniquePalaces(match.palaces).map((palace) => palace.name),
        star_names: [...new Set(match.stars)],
        matched_conditions: match.conditions,
        traditional_interpretation: rule.traditionalInterpretation,
        source: rule.sourceUrl,
        sources,
        calculation: rule.calculation,
        calculationStepKey: PATTERN_RULE_STEP_KEY,
        dependsOnStepKeys: ['ziwei:pattern:calculation:input'],
        promptText: `${rule.name}：${match.conditions.join('；')}。`,
        limitation: PATTERN_FACT_LIMITATION,
        limitations: [
          '命中只表示当前盘面满足这一条登记条件，不代表整盘吉凶或现实结果。',
          '只评估当前已登记规则；未输出的格局不得解释为不存在。',
        ],
      },
    ];
  });
}

export function selectVerifiedZiweiPatterns(params: {
  patterns: PatternFact[];
  palaces: PalaceFact[];
}): PatternFact[] {
  if (!hasValidPatternPalaces(params.palaces)) return [];

  const requestedStableKeys = new Set(
    params.patterns.flatMap((pattern) => {
      const stableKey = pattern.stable_key ?? pattern.key;
      const hasConflictingKeys =
        pattern.stable_key !== undefined &&
        pattern.key !== undefined &&
        pattern.stable_key !== pattern.key;
      return pattern.status === '已命中' &&
        !hasConflictingKeys &&
        isVerifiedZiweiPatternKey(stableKey)
        ? [stableKey]
        : [];
    }),
  );

  return detectPatterns({ palaces: params.palaces }).filter((pattern) =>
    requestedStableKeys.has(pattern.stable_key ?? pattern.key ?? ''),
  );
}

export function buildPatternAnalysis(params: {
  patterns: PatternFact[];
  palaces: PalaceFact[];
  skipped?: boolean;
  sourceUnverified?: boolean;
}): ZiweiPatternAnalysis {
  const { patterns, palaces, skipped = false, sourceUnverified = false } = params;
  const blockedBySourceAudit = sourceUnverified;
  const uniquePalaceIndexCount = new Set(palaces.map((item) => item.index)).size;
  const palaceDataComplete = hasValidPatternPalaces(palaces);
  const registeredRuleCount = blockedBySourceAudit ? 0 : VERIFIED_ZIWEI_PATTERN_RULE_COUNT;
  const evaluatedRuleCount =
    skipped || blockedBySourceAudit || !palaceDataComplete ? 0 : registeredRuleCount;
  const unevaluatedRuleCount = registeredRuleCount - evaluatedRuleCount;
  const acceptedPatterns =
    skipped || blockedBySourceAudit ? [] : selectVerifiedZiweiPatterns({ patterns, palaces });
  const matchedPatternCount = acceptedPatterns.length;
  const unmatchedRuleCount = Math.max(0, evaluatedRuleCount - matchedPatternCount);
  const patternFactKeys = acceptedPatterns.flatMap((item) => {
    const stableKey = item.stable_key ?? item.key;
    return isVerifiedZiweiPatternKey(stableKey) ? [stableKey] : [];
  });
  const summaryStatus: ZiweiPatternSummaryFact['status'] =
    skipped || blockedBySourceAudit
      ? '未生成'
      : !palaceDataComplete
        ? '资料不足'
        : matchedPatternCount === 0
          ? '未命中'
          : '已完成';
  const analysisStatus: ZiweiPatternAnalysis['status'] =
    skipped || blockedBySourceAudit
      ? '未生成'
      : !palaceDataComplete
        ? '资料不足'
        : matchedPatternCount === 0
          ? '未命中'
          : '已计算';

  const calculationSteps: ZiweiPatternCalculationStep[] = [
    {
      key: 'ziwei:pattern:calculation:input',
      stage: '十二宫输入校验',
      status: palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: [],
      inputs: { palaceCount: palaces.length },
      result: { palaceDataComplete, uniquePalaceIndexCount },
      promptText: palaceDataComplete
        ? '已校验完整十二宫及唯一宫位索引'
        : `当前仅有${palaces.length}项宫位资料或宫位索引不唯一，不执行格局规则评估`,
      sources: ['紫微十二宫结构化盘面资料'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: PATTERN_RULE_STEP_KEY,
      stage: '格局规则评估',
      status:
        skipped || blockedBySourceAudit ? '未生成' : palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: ['ziwei:pattern:calculation:input'],
      inputs: { registeredRuleCount, palaceDataComplete },
      result: { evaluatedRuleCount, unevaluatedRuleCount },
      promptText: skipped
        ? '本次明确跳过格局规则评估，未生成格局命中或未命中事实'
        : blockedBySourceAudit
          ? `${ZIWEI_PATTERN_AUDIT_NOTICE}，本次调用未接入已校勘登记表`
          : `已按固定古籍版本逐条评估${evaluatedRuleCount}条登记规则`,
      sources: [
        `《紫微斗数全书》卷一固定修订版 ${VOLUME_ONE_URL}`,
        `《紫微斗数全书》卷三固定修订版 ${VOLUME_THREE_URL}`,
      ],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: 'ziwei:pattern:calculation:matched-facts',
      stage: '命中事实登记',
      status:
        skipped || blockedBySourceAudit ? '未生成' : palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: [PATTERN_RULE_STEP_KEY],
      inputs: { evaluatedRuleCount },
      result: { matchedPatternCount, unmatchedRuleCount, matchedPatternKeys: patternFactKeys },
      promptText: skipped
        ? '本次明确跳过格局命中事实登记'
        : blockedBySourceAudit
          ? '本次调用未使用已校勘登记表，不生成格局命中事实'
          : `登记${matchedPatternCount}项已校勘格局事实`,
      sources: ['逐条规则评估结果与实际命中宫位、星曜'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: 'ziwei:pattern:calculation:summary',
      stage: '格局覆盖汇总',
      status:
        skipped || blockedBySourceAudit ? '未生成' : palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: ['ziwei:pattern:calculation:matched-facts'],
      inputs: { registeredRuleCount, evaluatedRuleCount, matchedPatternCount },
      result: { summaryStatus, unmatchedRuleCount, unevaluatedRuleCount },
      promptText: `格局规则覆盖状态为${summaryStatus}；登记${registeredRuleCount}条，评估${evaluatedRuleCount}条，命中${matchedPatternCount}项`,
      sources: ['格局规则来源审查与命中事实汇总'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
  ];

  const counterEvidenceFacts: ZiweiPatternCounterEvidenceFact[] = [
    {
      key: 'ziwei:pattern:counter:palace-coverage',
      type: '十二宫资料覆盖',
      status:
        skipped || blockedBySourceAudit ? '未生成' : palaceDataComplete ? '有可用证据' : '资料不足',
      ownerFactKeys: ['ziwei:pattern:calculation:input'],
      promptText: skipped
        ? '本次明确跳过格局分析，未使用十二宫资料形成格局结论'
        : palaceDataComplete
          ? '十二宫资料与宫位索引完整'
          : '十二宫资料不完整，格局分析必须降级且不得补造命中结果',
      sources: ['十二宫输入校验结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
    {
      key: 'ziwei:pattern:counter:rule-coverage',
      type: '登记规则覆盖',
      status: skipped || blockedBySourceAudit ? '未生成' : '有可用证据',
      ownerFactKeys: [PATTERN_RULE_STEP_KEY, ...patternFactKeys],
      promptText: skipped
        ? '本次明确跳过登记规则评估，不形成格局覆盖结论'
        : blockedBySourceAudit
          ? `${ZIWEI_PATTERN_AUDIT_NOTICE}；不得把空结果解释为没有传统格局`
          : `当前只覆盖${registeredRuleCount}条已校勘规则；未登记格局不作判断`,
      sources: ['登记规则固定古籍版本、卷次、原文与计算条件'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
    {
      key: 'ziwei:pattern:counter:unmatched-boundary',
      type: '未命中规则边界',
      status:
        skipped || blockedBySourceAudit ? '未生成' : palaceDataComplete ? '未命中' : '资料不足',
      ownerFactKeys: ['ziwei:pattern:calculation:matched-facts', ...patternFactKeys],
      promptText: skipped
        ? '本次明确跳过规则评估，不形成格局未命中结论'
        : `已评估规则中有${unmatchedRuleCount}条未命中；这不代表命盘没有其他传统格局`,
      sources: ['当前登记规则逐条评估结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
  ];

  const summaryFact: ZiweiPatternSummaryFact = {
    key: 'ziwei:pattern-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...patternFactKeys,
      ...counterEvidenceFacts.map((item) => item.key),
    ],
    registeredRuleCount,
    evaluatedRuleCount,
    unevaluatedRuleCount,
    matchedPatternCount,
    unmatchedRuleCount,
    auspiciousPatternCount: acceptedPatterns.filter((item) => item.kind === 'auspicious').length,
    inauspiciousPatternCount: acceptedPatterns.filter((item) => item.kind === 'inauspicious')
      .length,
    neutralPatternCount: acceptedPatterns.filter((item) => item.kind === 'neutral').length,
    counterEvidenceCount: counterEvidenceFacts.length,
    limitationFactCount: 4,
    promptText: `格局证据状态为${summaryStatus}；登记规则${registeredRuleCount}条，已评估${evaluatedRuleCount}条，命中${matchedPatternCount}项；未登记格局不作判断`,
    sources: ['格局规则固定版本、十二宫盘面与命中事实汇总'],
    limitation: PATTERN_SUMMARY_LIMITATION,
  };

  const limitationDefinitions: Array<
    Pick<ZiweiPatternLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'ziwei:pattern:limitation:traditional-classification',
      type: '传统分类边界',
      ownerFactKeys: [summaryFact.key, ...patternFactKeys],
      promptText: '吉格、凶格和中性格只属于传统分类标签，不是命盘总分，也不能相互加减抵消',
      sources: ['传统格局分类与量化评分分离原则'],
    },
    {
      key: 'ziwei:pattern:limitation:rule-coverage',
      type: '规则覆盖边界',
      ownerFactKeys: [summaryFact.key, PATTERN_RULE_STEP_KEY],
      promptText: `当前只登记${registeredRuleCount}条已完成版本、卷次、原文与条件校勘的规则；未登记格局不作命中或未命中结论`,
      sources: ['紫微格局逐条来源审查结果'],
    },
    {
      key: 'ziwei:pattern:limitation:reality-causality',
      type: '现实因果边界',
      ownerFactKeys: [summaryFact.key, ...patternFactKeys],
      promptText: '规则命中只证明盘面满足登记条件，传统释义不得直接写成现实结果',
      sources: ['盘面结构事实与现实因果分离原则'],
    },
    {
      key: 'ziwei:pattern:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [summaryFact.key, ...summaryFact.factKeys],
      promptText: '不得根据格局名称、传统分类或命中数量生成概率、保证、必然断语或固定应期',
      sources: ['传统规则事实与高风险现实结论分离原则'],
    },
  ];
  const limitationFacts: ZiweiPatternLimitationFact[] = limitationDefinitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: PATTERN_FACT_LIMITATION,
  }));
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);
  const limitations = limitationFacts.map((item) => item.promptText);

  return {
    key: 'ziwei:patterns',
    status: analysisStatus,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: [
      '【紫微格局结构化证据】',
      `计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `反证核验：${counterEvidence.join('；') || '当前登记规则已完成逐条评估'}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        `仅执行${VERIFIED_ZIWEI_PATTERN_RULE_COUNT}条具备固定版本、卷次、原文与可复算条件的登记规则。`,
        `原有${RETIRED_UNVERIFIED_PATTERN_COUNT}条规则已整体退役，未通过校勘的部分不会借用旧实现。`,
        '空格局列表只表示当前登记规则未命中，不代表命盘不存在其他传统格局。',
      ],
    },
  };
}
