import type { BaziChartResult } from '../bazi/baziTypes';
import { getLuckCycleForDate } from '../bazi/luckTiming';
import { calculateBirthChartBundle, type BirthChartBundle } from '../birth';
import { getShichenByIndex } from '../calendar/dateUtils';
import type { BirthProfile } from '../profile';
import type { EvidenceFact, PalaceFact, ScopeType } from '../types/analysis';
import type { ZiweiRuntime, ZiweiRuntimeOptions } from '../ziwei/runtime';

export type BaziZiweiSynthesisThemeId =
  | 'overview'
  | 'character'
  | 'career'
  | 'wealth'
  | 'relationships'
  | 'family'
  | 'wellbeing'
  | 'mobility'
  | 'inner-world'
  | 'timing';

export type SynthesisEvidenceSystem = 'bazi' | 'ziwei';

export interface SynthesisEvidenceFact {
  key: string;
  system: SynthesisEvidenceSystem;
  scope: 'natal' | ScopeType;
  title: string;
  detail: string;
  sourceKeys: string[];
}

export interface BaziZiweiSynthesisTheme {
  id: BaziZiweiSynthesisThemeId;
  label: string;
  focus: string;
  baziEvidence: SynthesisEvidenceFact[];
  ziweiEvidence: SynthesisEvidenceFact[];
}

export interface BaziZiweiSynthesis {
  key: 'bazi-ziwei:synthesis';
  status: '资料完整' | '资料有缺口';
  subjectName?: string;
  themes: BaziZiweiSynthesisTheme[];
  evidenceCount: {
    bazi: number;
    ziwei: number;
  };
  timingReference: BaziZiweiTimingReference;
  missingFacts: string[];
  methodology: string[];
}

export interface BaziZiweiTimingReference {
  dateStr: string;
  year: number;
  hourIndex: number;
  shichen: string;
}

interface ThemeDefinition {
  id: BaziZiweiSynthesisThemeId;
  label: string;
  focus: string;
  palaceNames: string[];
  baziFactKeys: string[];
}

const THEMES: ThemeDefinition[] = [
  {
    id: 'overview',
    label: '命局总纲',
    focus: '先定八字旺衰、格局与取用，再对照紫微命身宫、三方四正和生年四化。',
    palaceNames: ['命', '福德', '迁移'],
    baziFactKeys: ['pillars', 'day-master', 'strength', 'pattern', 'useful-god', 'relations'],
  },
  {
    id: 'character',
    label: '性情与能力',
    focus: '比较日主禀赋、十神与格局结构，以及命宫、身宫、福德宫所见的内外表现。',
    palaceNames: ['命', '福德'],
    baziFactKeys: ['day-master', 'strength', 'pattern', 'relations'],
  },
  {
    id: 'career',
    label: '事业与发展',
    focus: '结合格局取用和大运承接，核对官禄、命、迁移、财帛宫的星曜与四化联系。',
    palaceNames: ['官禄', '命', '迁移', '财帛'],
    baziFactKeys: ['strength', 'pattern', 'useful-god', 'relations', 'luck'],
  },
  {
    id: 'wealth',
    label: '财帛与资源',
    focus: '从取用与生克流通观察资源承载，再对照财帛、田宅、官禄宫的结构。',
    palaceNames: ['财帛', '田宅', '官禄'],
    baziFactKeys: ['strength', 'useful-god', 'relations', 'luck'],
  },
  {
    id: 'relationships',
    label: '感情与关系',
    focus: '从日主、十神位置和合冲刑害观察关系模式，并对照夫妻、福德、子女、交友宫。',
    palaceNames: ['夫妻', '福德', '子女', '交友'],
    baziFactKeys: ['pillars', 'day-master', 'relations', 'useful-god'],
  },
  {
    id: 'family',
    label: '家庭与根基',
    focus: '综合年、月柱及柱间关系，对照父母、兄弟、田宅、子女宫的承接。',
    palaceNames: ['父母', '兄弟', '田宅', '子女'],
    baziFactKeys: ['pillars', 'relations', 'strength'],
  },
  {
    id: 'wellbeing',
    label: '身心状态',
    focus: '以五行旺衰、寒燥与取用为基础，对照疾厄、福德、命宫的结构性提示。',
    palaceNames: ['疾厄', '福德', '命'],
    baziFactKeys: ['day-master', 'strength', 'useful-god'],
  },
  {
    id: 'mobility',
    label: '迁移与环境',
    focus: '观察命局取用在外部环境中的承接，并对照迁移、官禄、田宅、命宫。',
    palaceNames: ['迁移', '官禄', '田宅', '命'],
    baziFactKeys: ['pattern', 'useful-god', 'relations', 'luck'],
  },
  {
    id: 'inner-world',
    label: '内在状态',
    focus: '比较日主旺衰与格局张力，以及福德、命身宫呈现的内在需求和调节方式。',
    palaceNames: ['福德', '命'],
    baziFactKeys: ['day-master', 'strength', 'pattern', 'useful-god'],
  },
  {
    id: 'timing',
    label: '大运与流年',
    focus: '把八字大运流年与紫微大限、流年落宫及四化放在同一时间轴逐段核对。',
    palaceNames: [],
    baziFactKeys: ['luck', 'annual'],
  },
];

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizePalaceName(value: string) {
  return value.trim().replace(/宫$/, '');
}

function resolveTimingReference(runtime: ZiweiRuntime): {
  fact: BaziZiweiTimingReference;
  date: Date;
} {
  const context = runtime.horoscopeContext;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(context.dateStr);
  const shichen = getShichenByIndex(context.hourIndex);
  if (!match || !shichen) {
    throw new Error('紫微运限上下文缺少有效日期或时辰。');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, shichen.hour, shichen.minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('紫微运限上下文日期无效。');
  }
  return {
    fact: {
      dateStr: context.dateStr,
      year,
      hourIndex: context.hourIndex,
      shichen: shichen.name,
    },
    date,
  };
}

function createBaziFacts(
  chart: BaziChartResult,
  timingReference: ReturnType<typeof resolveTimingReference>,
): Record<string, SynthesisEvidenceFact[]> {
  const evidence = chart.evidenceAnalysis;
  const analysisKey = (type: string) =>
    evidence?.analysisFacts.find((item) => item.type === type)?.key ?? `bazi:${type}`;
  const relationFacts = (evidence?.relationFacts ?? []).map((item) => ({
    key: item.key,
    system: 'bazi' as const,
    scope: 'natal' as const,
    title: item.type,
    detail: item.promptText,
    sourceKeys: [item.key],
  }));
  const pillars = ['year', 'month', 'day', 'hour'] as const;
  const pillarText = pillars
    .map((key) => {
      const fact = evidence?.pillarFacts.find((item) =>
        item.pillar.startsWith(
          key === 'year' ? '年' : key === 'month' ? '月' : key === 'day' ? '日' : '时',
        ),
      );
      return fact?.promptText ?? chart.pillars[key].ganZhi;
    })
    .join('；');
  const useful = chart.analysis.usefulGod;
  const currentCycle = getLuckCycleForDate(chart.luckInfo.cycles, timingReference.date);
  const annual =
    chart.liunian
      ?.filter((item) => item.year === timingReference.fact.year)
      .map((item) => `${item.year}年${item.ganZhi}，干支十神${item.tenGod}/${item.tenGodZhi}`) ??
    [];

  return {
    pillars: [
      {
        key: 'bazi:synthesis:pillars',
        system: 'bazi',
        scope: 'natal',
        title: '四柱与十神基础',
        detail: pillarText,
        sourceKeys: evidence?.pillarFacts.map((item) => item.key) ?? [],
      },
    ],
    'day-master': [
      {
        key: 'bazi:synthesis:day-master',
        system: 'bazi',
        scope: 'natal',
        title: '日主',
        detail: `${chart.dayMaster.gan}日主，五行${chart.dayMaster.element}，${chart.dayMaster.yinYang}；月令司权${chart.monthCommander || '未记录'}`,
        sourceKeys: [analysisKey('日主旺衰')],
      },
    ],
    strength: [
      {
        key: 'bazi:synthesis:strength',
        system: 'bazi',
        scope: 'natal',
        title: '旺衰结构',
        detail: `${chart.analysis.dayMasterStrength.status}；${chart.analysis.dayMasterStrength.details.ruleBasis.join('；')}`,
        sourceKeys: [analysisKey('日主旺衰')],
      },
    ],
    pattern: [
      {
        key: 'bazi:synthesis:pattern',
        system: 'bazi',
        scope: 'natal',
        title: '格局',
        detail: `${chart.analysis.mingGe.pattern || '未记录'}${chart.analysis.mingGe.basis ? `；${chart.analysis.mingGe.basis}` : ''}`,
        sourceKeys: [analysisKey('格局')],
      },
    ],
    'useful-god': [
      {
        key: 'bazi:synthesis:useful-god',
        system: 'bazi',
        scope: 'natal',
        title: '取用与喜忌',
        detail: unique([
          useful.primaryUseful ? `首取${useful.primaryUseful}` : useful.useful,
          useful.primaryAvoid ? `首忌${useful.primaryAvoid}` : useful.avoid,
          useful.primaryReason ?? '',
          ...(useful.strategyTrace ?? []),
        ]).join('；'),
        sourceKeys: [analysisKey('用神取忌')],
      },
    ],
    relations: relationFacts.length
      ? relationFacts
      : [
          {
            key: 'bazi:synthesis:relations-empty',
            system: 'bazi',
            scope: 'natal',
            title: '柱间关系',
            detail: '当前结构化盘面未登记主要伏吟、反吟或合冲刑害破关系。',
            sourceKeys: [],
          },
        ],
    luck: currentCycle
      ? [
          {
            key: `bazi:synthesis:luck:${currentCycle.year}`,
            system: 'bazi',
            scope: 'decadal',
            title: currentCycle.isXiaoyun ? '运限基准所在童限' : '运限基准所在大运',
            detail: `${timingReference.fact.dateStr}${timingReference.fact.shichen}${
              currentCycle.isXiaoyun
                ? `处于起运前童限（${currentCycle.year}年起）`
                : `在${currentCycle.ganZhi}大运，约${currentCycle.age}岁起运（${currentCycle.year}年交运）`
            }；${chart.luckInfo.handoverInfo || chart.luckInfo.startInfo}`,
            sourceKeys: [],
          },
        ]
      : [],
    annual: annual.length
      ? [
          {
            key: 'bazi:synthesis:annual',
            system: 'bazi',
            scope: 'yearly',
            title: '流年序列',
            detail: annual.join('；'),
            sourceKeys: [],
          },
        ]
      : [],
  };
}

function palaceEvidenceKeys(payloadEvidence: EvidenceFact[], palace: PalaceFact) {
  const normalizedName = normalizePalaceName(palace.name);
  return payloadEvidence
    .filter(
      (item) =>
        item.palace_indexes.includes(palace.index) ||
        item.palace_names.some((name) => normalizePalaceName(name) === normalizedName),
    )
    .map((item) => item.key ?? item.stable_key);
}

function formatStars(palace: PalaceFact) {
  const stars = [...palace.major_stars, ...palace.minor_stars];
  return stars.map((star) => {
    const mutagens = unique([
      star.birth_mutagen ? `生年化${star.birth_mutagen}` : '',
      star.active_scope_mutagen ? `运限化${star.active_scope_mutagen}` : '',
      star.horoscope_mutagen ? `流耀化${star.horoscope_mutagen}` : '',
    ]);
    return `${star.name}${star.brightness ? `(${star.brightness})` : ''}${mutagens.length ? `[${mutagens.join('/')}]` : ''}`;
  });
}

function createZiweiPalaceFact(
  payloadScope: ScopeType,
  palace: PalaceFact,
  allPalaces: PalaceFact[],
  payloadEvidence: EvidenceFact[],
): SynthesisEvidenceFact {
  const opposite = allPalaces.find((item) => item.index === palace.opposite_palace_index);
  const surrounded = palace.surrounded_palace_indexes
    .map((index) => allPalaces.find((item) => item.index === index)?.name)
    .filter((name): name is string => Boolean(name));
  const details = [
    `${palace.name}${palace.is_body_palace ? '（身宫）' : ''}${palace.empty_state ? '为空宫' : ''}`,
    `宫干支${palace.heavenly_stem}${palace.earthly_branch}`,
    `星曜${formatStars(palace).join('、') || '未列主辅星'}`,
    palace.self_mutagens?.length ? `自化${palace.self_mutagens.join('、')}` : '',
    opposite ? `对宫${opposite.name}` : '',
    surrounded.length ? `三方四正${surrounded.join('、')}` : '',
    `大限${palace.decadal_range[0]}-${palace.decadal_range[1]}岁`,
  ];
  return {
    key: `ziwei:synthesis:${payloadScope}:palace:${palace.index}`,
    system: 'ziwei',
    scope: payloadScope,
    title: `${palace.name}盘面`,
    detail: details.filter(Boolean).join('；'),
    sourceKeys: palaceEvidenceKeys(payloadEvidence, palace),
  };
}

function createZiweiThemeFacts(
  runtime: ZiweiRuntime,
  definition: ThemeDefinition,
): SynthesisEvidenceFact[] {
  const payloads = Object.values(runtime.payloadByScope).filter(Boolean);
  if (definition.id === 'timing') {
    return payloads
      .filter((payload) => payload.active_scope.scope !== 'origin')
      .flatMap((payload) => {
        const active = payload.active_scope;
        const relevantEvidence = payload.evidence_pool.filter(
          (item) => item.scope === active.scope && item.type !== 'natal_palace',
        );
        return [
          {
            key: `ziwei:synthesis:${active.scope}:active`,
            system: 'ziwei' as const,
            scope: active.scope,
            title: active.label || active.scope,
            detail: unique([
              `${active.solar_date}，虚岁${active.nominal_age}`,
              active.palace_name ? `运限命宫落${active.palace_name}` : '',
              ...active.mutagen_map.map(
                (item) =>
                  `${item.star}化${item.mutagen}${item.palace_name ? `入${item.palace_name}` : ''}`,
              ),
              ...relevantEvidence.slice(0, 12).map((item) => item.promptText ?? item.description),
            ]).join('；'),
            sourceKeys: relevantEvidence.map((item) => item.key ?? item.stable_key),
          },
        ];
      });
  }

  const origin = runtime.payloadByScope.origin;
  if (!origin) return [];
  const names = new Set(definition.palaceNames.map(normalizePalaceName));
  const selected = origin.palaces.filter(
    (palace) => names.has(normalizePalaceName(palace.name)) || palace.is_body_palace,
  );
  return selected.map((palace) =>
    createZiweiPalaceFact('origin', palace, origin.palaces, origin.evidence_pool),
  );
}

/** 将同一命主的八字与紫微盘组织为逐主题、可追溯的合参资料。 */
export function buildBaziZiweiSynthesis(params: {
  bazi: BaziChartResult;
  ziwei: ZiweiRuntime;
  subjectName?: string;
}): BaziZiweiSynthesis {
  const timingReference = resolveTimingReference(params.ziwei);
  const baziFacts = createBaziFacts(params.bazi, timingReference);
  const themes = THEMES.map((definition) => ({
    id: definition.id,
    label: definition.label,
    focus: definition.focus,
    baziEvidence: definition.baziFactKeys.flatMap((key) => baziFacts[key] ?? []),
    ziweiEvidence: createZiweiThemeFacts(params.ziwei, definition),
  }));
  const missingFacts = themes.flatMap((theme) => [
    ...(theme.baziEvidence.length ? [] : [`${theme.label}缺少八字资料`]),
    ...(theme.ziweiEvidence.length ? [] : [`${theme.label}缺少紫微资料`]),
  ]);
  if (!baziFacts.luck.length) missingFacts.push('运限基准日期缺少对应八字大运或童限');
  if (!baziFacts.annual.length) missingFacts.push('运限基准年份缺少对应八字流年');

  return {
    key: 'bazi-ziwei:synthesis',
    status: missingFacts.length ? '资料有缺口' : '资料完整',
    subjectName: params.subjectName,
    themes,
    evidenceCount: {
      bazi: new Set(themes.flatMap((theme) => theme.baziEvidence.map((item) => item.key))).size,
      ziwei: new Set(themes.flatMap((theme) => theme.ziweiEvidence.map((item) => item.key))).size,
    },
    timingReference: timingReference.fact,
    missingFacts,
    methodology: [
      '八字与紫微各自保留原有排盘口径和事实链。',
      '按同一人生主题并列两套资料，供解读时比较相互印证、补充与口径差异。',
      '运势部分按大运、大限与流年层级对齐，不压缩为分数或概率。',
    ],
  };
}

export interface FormatBaziZiweiSynthesisOptions {
  question?: string;
  detailLevel?: 'concise' | 'standard' | 'professional';
}

/** 生成可直接交给 AI 的八字紫微合参任务书。 */
export function formatBaziZiweiSynthesisForPrompt(
  synthesis: BaziZiweiSynthesis,
  options: FormatBaziZiweiSynthesisOptions = {},
): string {
  const detailLabel =
    options.detailLevel === 'concise'
      ? '使用易懂白话，集中给出主线与可执行启示'
      : options.detailLevel === 'professional'
        ? '使用专业术语完整展开取象、体用、宫位、四化与运限逻辑'
        : '兼顾传统术语与白话解释，完整交代判断依据';
  const themeText = synthesis.themes
    .map((theme) => {
      const bazi = theme.baziEvidence.map((item) => `- ${item.title}：${item.detail}`).join('\n');
      const ziwei = theme.ziweiEvidence.map((item) => `- ${item.title}：${item.detail}`).join('\n');
      return [
        `### ${theme.label}`,
        `分析主线：${theme.focus}`,
        '八字资料：',
        bazi || '- 本主题资料未提供',
        '紫微资料：',
        ziwei || '- 本主题资料未提供',
      ].join('\n');
    })
    .join('\n\n');

  return [
    '【任务】',
    `请为${synthesis.subjectName || '命主'}完成八字与紫微斗数合参。逐主题先分别说明两套体系的判断依据，再归纳相互印证、彼此补充与口径差异，形成有条件、有层次的整体解读。${detailLabel}。`,
    options.question ? `重点回应：${options.question}` : '',
    '',
    '【运限基准】',
    `${synthesis.timingReference.dateStr} ${synthesis.timingReference.shichen}（时辰索引${synthesis.timingReference.hourIndex}）`,
    '',
    '【合参资料】',
    themeText,
    '',
    '【输出结构】',
    '依次输出命局总纲、性情与能力、事业、财帛、感情、家庭、身心、迁移、内在状态、大运与流年；每一部分写明八字依据、紫微依据和合参结论，最后归纳当前阶段最值得关注的三条主线。',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export interface BaziZiweiCombinedReadingOptions {
  ziwei?: ZiweiRuntimeOptions;
  prompt?: FormatBaziZiweiSynthesisOptions;
}

export interface BaziZiweiCombinedReading {
  bundle: BirthChartBundle;
  synthesis: BaziZiweiSynthesis;
  promptText: string;
}

function assertExplicitZiweiTiming(options: BaziZiweiCombinedReadingOptions): void {
  if (options.ziwei?.horoscopeContext === undefined && options.ziwei?.now === undefined) {
    throw new Error(
      '八字紫微合参必须显式提供 ziwei.horoscopeContext 或 ziwei.now 作为运限基准时间。',
    );
  }
}

/** 从一份统一出生档案直接生成八字、紫微和合参任务书。 */
export async function calculateBaziZiweiCombinedReading(
  profile: BirthProfile,
  options: BaziZiweiCombinedReadingOptions = {},
): Promise<BaziZiweiCombinedReading> {
  assertExplicitZiweiTiming(options);
  const bundle = await calculateBirthChartBundle(profile, {
    systems: ['bazi', 'ziwei'],
    ziwei: options.ziwei,
  });
  if (!bundle.bazi || !bundle.ziwei) throw new Error('八字或紫微资料生成失败。');
  const synthesis = buildBaziZiweiSynthesis({
    bazi: bundle.bazi,
    ziwei: bundle.ziwei,
    subjectName: profile.name,
  });
  return {
    bundle,
    synthesis,
    promptText: formatBaziZiweiSynthesisForPrompt(synthesis, options.prompt),
  };
}
