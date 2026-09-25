/**
 * 命理时序四族提示词的事实预期。
 *
 * 这些预期只从排盘、运限和关系分析的结构化结果读取，供本地正文审计使用；
 * 不读取最终提示词来反推 values，避免把生成器自己的遗漏当成通过条件。
 */
import type { BaziChartResult } from '../../packages/core/src/bazi/baziTypes';
import type { FortuneSelectionContext } from '../../packages/core/src/bazi/fortuneSelection';
import type { BaziCompatibilityEvidenceResult } from '../../packages/core/src/bazi';
import type {
  AstrolabeData,
  AstrolabeSynastryData,
} from '../../packages/core/src/types/divination';
import type { AnalysisPayloadV1 } from '../../packages/core/src/types/analysis';
import type { ZiweiRuntime } from '../../packages/core/src/ziwei/runtime';
import type { AstrolabeScopeContext } from '../../packages/core/src/divination/astrolabe-scope';
import type { QizhengFlowingStarsResult, QizhengResult } from '../../packages/core/src/qi_zheng';
import type { PromptFactExpectation } from './facts';

export type NatalPromptFact = PromptFactExpectation;

type FactScope = NonNullable<NatalPromptFact['scope']>;

export interface NatalFactScopeOptions {
  /** 盘面资料在目标任务书中的实际标题范围。 */
  scope?: FactScope;
  /** 同一结构化资料在不同主体/入口中的稳定前缀。 */
  idPrefix?: string;
}

export interface BaziFactExtractionOptions extends NatalFactScopeOptions {
  includeUsefulGod?: boolean;
  format?: 'standard' | 'instant';
}

export interface ZiweiFactExtractionOptions extends NatalFactScopeOptions {
  payloadScopes?: readonly string[];
  includeActiveFacts?: boolean;
  includeMutagenFacts?: boolean;
  activeFactStyle?: 'core' | 'public';
  mutagenOwner?: string;
  mutagenValueStyle?: 'core' | 'public';
  palaceValueStyle?: 'core' | 'public';
  /** 即时盘格式把主辅星直接写入宫位行，不带“主星/辅曜”前缀。 */
  starValuePrefix?: boolean;
}

export interface AstrolabeFactExtractionOptions extends NatalFactScopeOptions {
  includeHouses?: boolean;
  periodScope?: FactScope;
}

export interface QizhengFactExtractionOptions extends NatalFactScopeOptions {
  flowScope?: FactScope;
  periodScope?: FactScope;
}

function cleanValues(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function fact(
  id: string,
  owner: string,
  values: Array<string | undefined | null>,
  options: { scope?: FactScope; unit?: 'line' | 'block' } = {},
): NatalPromptFact | null {
  const cleaned = cleanValues(values);
  if (!id || !owner.trim() || !cleaned.length) return null;
  return {
    id,
    owner: owner.trim(),
    values: cleaned,
    ...(options.scope ? { scope: options.scope } : {}),
    ...(options.unit ? { unit: options.unit } : {}),
  };
}

function collect(items: Array<NatalPromptFact | null>) {
  return items.filter((item): item is NatalPromptFact => Boolean(item));
}

function dateFromParts(value: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}) {
  const date = `${value.year}年${value.month}月${value.day}日`;
  if (value.hour === undefined) return date;
  return `${date} ${String(value.hour).padStart(2, '0')}:${String(value.minute ?? 0).padStart(2, '0')}:${String(value.second ?? 0).padStart(2, '0')}`;
}

function rangeScope(start: string, end?: string): FactScope | undefined {
  const normalizedStart = start.trim();
  if (!normalizedStart) return undefined;
  return { start: normalizedStart, ...(end?.trim() ? { end: end.trim() } : {}) };
}

function baziSelectionScope(): FactScope {
  return { start: '【岁运重点】', end: '【问题】' };
}

/** 从八字原局和实际选中的岁运上下文提取带层级归属的事实。 */
export function extractBaziFacts(
  result: BaziChartResult,
  selection?: FortuneSelectionContext | null,
  options: BaziFactExtractionOptions = {},
): NatalPromptFact[] {
  const natalScope = options.scope ?? { start: '【排盘信息】', end: '【分析对象】' };
  const idPrefix = options.idPrefix ?? 'bazi';
  const pillarLabels = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
  } as const;
  const facts = collect(
    (Object.keys(pillarLabels) as Array<keyof typeof pillarLabels>).map((key) =>
      fact(`${idPrefix}.natal.${key}.pillar`, pillarLabels[key], [result.pillars[key]?.ganZhi], {
        scope: natalScope,
      }),
    ),
  );

  for (const key of Object.keys(pillarLabels) as Array<keyof typeof pillarLabels>) {
    const hidden = result.hiddenStems[key] ?? [];
    if (!hidden.length) continue;
    const instant = options.format === 'instant';
    facts.push({
      id: `${idPrefix}.natal.${key}.hidden-stems`,
      owner: `${pillarLabels[key]}${instant ? '：' : ':'} ${result.pillars[key].ganZhi}`,
      values: hidden.map((stem, index) => {
        const god = result.hiddenTenGods[key]?.[index];
        return `${stem}${god ? (instant ? `（${god}）` : `[${god}]`) : ''}`;
      }),
      scope: natalScope,
      ...(instant ? {} : { includeNextLine: true }),
    });
  }

  const usefulGod = result.analysis?.usefulGod;
  if (usefulGod && options.includeUsefulGod !== false) {
    facts.push(
      ...collect([
        fact(
          `${idPrefix}.natal.useful-god`,
          '取用',
          [
            usefulGod.primaryFavorableWuxing
              ? `主用${usefulGod.primaryFavorableWuxing}`
              : usefulGod.favorableWuxing?.[0]
                ? `主用${usefulGod.favorableWuxing[0]}`
                : undefined,
            usefulGod.primaryUnfavorableWuxing
              ? `忌${usefulGod.primaryUnfavorableWuxing}`
              : usefulGod.unfavorableWuxing?.[0]
                ? `忌${usefulGod.unfavorableWuxing[0]}`
                : undefined,
          ],
          { scope: natalScope },
        ),
      ]),
    );
  }

  if (!selection) return facts;

  const scope = baziSelectionScope();
  const selectedDate =
    selection.scope === 'day'
      ? selection.dayBreakdown?.[0]?.date
      : selection.scope === 'month'
        ? selection.promptPayload.summaryLines
            .find((line) => line.startsWith('日期范围：'))
            ?.replace('日期范围：', '')
        : selection.year
          ? `${selection.year}年`
          : `${selection.cycleStartYear}年起`;
  const selectedGanZhi =
    selection.scope === 'day'
      ? selection.dayBreakdown?.[0]?.ganZhi
      : selection.scope === 'month'
        ? selection.monthGanZhi
        : selection.scope === 'year'
          ? selection.yearGanZhi
          : selection.cycleGanZhi;

  facts.push(
    ...collect([
      fact(`${idPrefix}.${selection.scope}.date`, '选择日期', [selectedDate], { scope }),
      fact(`${idPrefix}.${selection.scope}.selected-ganzhi`, '所选干支', [selectedGanZhi], {
        scope,
      }),
      fact(`${idPrefix}.${selection.scope}.dayun`, '上层岁运', [selection.cycleGanZhi], { scope }),
      fact(
        `${idPrefix}.${selection.scope}.handover`,
        '该运交接范围',
        [
          `${dateFromParts(selection.cycleTimeRange.start)}起`,
          `${dateFromParts(selection.cycleTimeRange.end)}交接`,
        ],
        { scope },
      ),
    ]),
  );

  if (selection.yearGanZhi && selection.scope !== 'year' && selection.scope !== 'dayun') {
    facts.push(
      ...collect([
        fact(`${idPrefix}.${selection.scope}.year`, '上层流年', [selection.yearGanZhi], { scope }),
      ]),
    );
  }

  const selectedMonth = selection.monthBreakdown?.find((item) => item.month === selection.month);
  if (selection.scope === 'month' || selection.scope === 'day') {
    facts.push(
      ...collect([
        fact(
          `${idPrefix}.${selection.scope}.month`,
          '节气月',
          [selection.monthGanZhi, selectedMonth?.label],
          {
            scope,
          },
        ),
      ]),
    );
  }

  const selectedDay = selection.dayBreakdown?.[0];
  if (selection.scope === 'day') {
    facts.push(
      ...collect([
        fact(
          `${idPrefix}.${selection.scope}.day`,
          '所选干支',
          [selectedDay?.ganZhi, selectedDay?.date],
          {
            scope,
          },
        ),
      ]),
    );
  }

  const relationNames = {
    'stem-same': '干同',
    'stem-combine': '干合',
    'stem-clash': '干冲',
    'branch-same': '支同',
    'branch-combine': '六合',
    'branch-clash': '六冲',
    'branch-punishment': '刑',
    'branch-harm': '害',
    'branch-break': '破',
    'pillar-fuyin': '同柱伏吟',
    'tianke-dichong': '天克地冲',
    'suiyun-binglin': '岁运并临',
  } as const;
  const layerName = (layer: { label: string; ganZhi: string }) =>
    layer.label.includes(layer.ganZhi) ? layer.label : `${layer.label}${layer.ganZhi}`;
  const relationPairs = new Map<string, { owner: string; names: Set<string> }>();
  for (const relation of selection.promptPayload.triggerEvidence?.relations ?? []) {
    const key = `${relation.sourceLayerKey}:${relation.targetLayerKey}`;
    const pair = relationPairs.get(key) ?? {
      owner: `${layerName(relation.source)}↔${layerName(relation.target)}`,
      names: new Set<string>(),
    };
    pair.names.add(relationNames[relation.type]);
    relationPairs.set(key, pair);
  }
  for (const [key, pair] of relationPairs) {
    facts.push({
      id: `${idPrefix}.${selection.scope}.relation.${key}`,
      owner: pair.owner,
      values: [`${pair.owner}：${[...pair.names].join('、')}`],
      scope,
    });
  }
  const trigger = selection.promptPayload.triggerEvidence;
  for (const formation of trigger?.formations ?? []) {
    const participants = formation.participantLayerKeys
      .map((key) => trigger!.layers.find((layer) => layer.key === key))
      .filter((layer) => Boolean(layer));
    facts.push({
      id: `${idPrefix}.${selection.scope}.formation.${formation.key}`,
      owner: formation.label,
      values: [
        `${formation.label}（地支：${formation.branches.join('、')}；参与层级：${[...new Set(participants.map((layer) => layerName(layer!)))].join('、')}；${formation.interpretationLimit}）`,
      ],
      scope,
    });
  }

  return facts;
}

/** 提取八字双盘中两方命局和关系区的逐项事实。 */
export function extractBaziCompatibilityFacts(
  result1: BaziChartResult,
  result2: BaziChartResult,
  relation: BaziCompatibilityEvidenceResult,
  options: {
    person1Scope?: FactScope;
    person2Scope?: FactScope;
    relationScope?: FactScope;
  } = {},
) {
  const facts = [
    ...extractBaziFacts(result1, null, {
      scope: options.person1Scope ?? { start: '【第一人排盘信息】', end: '【第二人排盘信息】' },
      idPrefix: 'bazi.compatibility.person1',
    }),
    ...extractBaziFacts(result2, null, {
      scope: options.person2Scope ?? { start: '【第二人排盘信息】', end: '【双盘关系资料】' },
      idPrefix: 'bazi.compatibility.person2',
    }),
  ];
  const scope = options.relationScope ?? { start: '【双盘关系资料】', end: '【任务】' };
  const add = (id: string, owner: string, value: string | undefined) => {
    const item = fact(id, owner, [value], { scope });
    if (item) facts.push(item);
  };
  add('bazi.compatibility.day-master', '日主关系', relation.dayMasterRelation.promptText);
  add(
    'bazi.compatibility.cross-pillars',
    '四柱关系',
    relation.crossPillarRelations.length
      ? relation.crossPillarRelations.map((item) => item.promptText).join('；')
      : '未见已列关系',
  );
  add(
    'bazi.compatibility.branch-combinations',
    '跨盘组合',
    relation.crossBranchCombinations.length
      ? relation.crossBranchCombinations.map((item) => item.promptText).join('；')
      : '未见已列组合',
  );
  add(
    'bazi.compatibility.ten-gods',
    '双向十神',
    relation.tenGodMappings.length
      ? relation.tenGodMappings.map((item) => item.promptText).join('；')
      : '未记录',
  );
  add(
    'bazi.compatibility.useful-god',
    '喜忌覆盖',
    relation.usefulGodCoverage.length
      ? relation.usefulGodCoverage.map((item) => item.promptText).join('；')
      : '资料不足',
  );
  add('bazi.compatibility.summary', '已记录跨柱关系', relation.summaryFact.promptText);
  return facts;
}

function ziweiScopeLabel(payload: AnalysisPayloadV1) {
  return payload.active_scope.label || payload.active_scope.scope;
}

function getZiweiPayloads(input: AnalysisPayloadV1 | ZiweiRuntime, scopes?: readonly string[]) {
  if ('payload_version' in input) return [input];
  const selectedScopes = scopes?.length ? scopes : Object.keys(input.payloadByScope);
  return selectedScopes
    .map((scope) => input.payloadByScope[scope as keyof ZiweiRuntime['payloadByScope']])
    .filter((payload): payload is AnalysisPayloadV1 => Boolean(payload));
}

/** 从紫微单盘运行结果提取本命宫星、运限层和四化归属。 */
export function extractZiweiFacts(
  input: AnalysisPayloadV1 | ZiweiRuntime,
  options: ZiweiFactExtractionOptions = {},
): NatalPromptFact[] {
  const facts: NatalPromptFact[] = [];
  const idPrefix = options.idPrefix ?? 'ziwei';
  for (const payload of getZiweiPayloads(input, options.payloadScopes)) {
    const active = payload.active_scope;
    const scope = options.scope ?? rangeScope(`分析范围：${ziweiScopeLabel(payload)}`);
    const scopeId = active.scope;
    const publicStyle = options.palaceValueStyle === 'public';
    const starValue = (prefix: string, name: string) =>
      options.starValuePrefix === false || publicStyle ? name : `${prefix}${name}`;
    for (const palace of payload.palaces) {
      const owner = palace.name;
      const stars = [
        ...palace.major_stars.map((star) => starValue('主星：', star.name)),
        ...palace.minor_stars.map((star) => starValue('辅曜：', star.name)),
        ...palace.other_stars.map((star) => starValue('辅曜：', star.name)),
        ...(!active.scope || active.scope === 'origin'
          ? []
          : palace.scope_stars.map((star) => starValue('当前运限星曜：', star.name))),
      ];
      facts.push(
        ...collect([
          fact(
            `${idPrefix}.${scopeId}.${palace.index}.palace`,
            owner,
            [
              publicStyle
                ? `${palace.heavenly_stem}${palace.earthly_branch}`
                : `宫干支${palace.heavenly_stem}${palace.earthly_branch}`,
              ...stars,
            ],
            { scope, unit: 'line' },
          ),
          fact(
            `${idPrefix}.${scopeId}.${palace.index}.scope-hits`,
            owner,
            active.scope === 'origin'
              ? []
              : palace.scope_hits.map((hit) => hit.replace(/^运限命中：/u, '')),
            {
              scope,
              unit: 'line',
            },
          ),
        ]),
      );
    }

    if (options.includeActiveFacts !== false && active.scope !== 'origin') {
      const activePalace = payload.palaces.find((palace) => palace.index === active.palace_index);
      const activeFact =
        options.activeFactStyle === 'public'
          ? fact(`${idPrefix}.${scopeId}.active-palace`, '当前落宫', [activePalace?.name], {
              scope,
              unit: 'line',
            })
          : fact(
              `${idPrefix}.${scopeId}.active-palace`,
              '当前运限',
              [
                active.solar_date,
                active.palace_name ? `落${active.palace_name}` : undefined,
                active.heavenly_stem && active.earthly_branch
                  ? `${active.heavenly_stem}${active.earthly_branch}`
                  : undefined,
              ],
              { scope, unit: 'line' },
            );
      if (activeFact) facts.push(activeFact);
    }
    if (options.includeMutagenFacts !== false) {
      const mutagenValues = active.mutagen_map.map((item) => {
        const palace = item.palace_name
          ? options.mutagenValueStyle === 'public'
            ? `入本命${item.palace_name}`
            : `入${item.palace_name}${item.palace_name.endsWith('宫') ? '' : '宫'}`
          : '';
        const dynamic =
          active.scope !== 'origin' && item.dynamic_palace_name
            ? `（动态${item.dynamic_palace_name}）`
            : '';
        return `${item.star}化${item.mutagen}${palace}${dynamic}`;
      });
      const mutagenOwner =
        options.mutagenOwner ?? (active.scope === 'origin' ? '生年四化' : '当前四化');
      const mutagenFact = fact(`${idPrefix}.${scopeId}.mutagens`, mutagenOwner, mutagenValues, {
        scope,
        unit: 'line',
      });
      if (mutagenFact) facts.push(mutagenFact);
    }
  }
  return facts;
}

/** 提取紫微合盘的双方宫位叠盘与跨盘四化事实。 */
export function extractZiweiCompatibilityFacts(
  payload1: AnalysisPayloadV1,
  payload2: AnalysisPayloadV1,
  relation?: {
    palaceOverlays?: Array<{
      sourcePerson: string;
      targetPerson: string;
      sourcePalace: string;
      targetPalace: string;
      earthlyBranch: string;
      sourceMajorStars: string[];
      targetMajorStars: string[];
    }>;
    crossMutagenPlacements?: Array<{
      sourcePerson: string;
      targetPerson: string;
      star: string;
      mutagen: string;
      sourcePalace: string;
      targetPalace: string;
    }>;
    summaryFact?: { promptText: string };
  },
  people: { person1?: string; person2?: string } = {},
) {
  const person1 = people.person1?.trim() || '第一人';
  const person2 = people.person2?.trim() || '第二人';
  const facts = [
    ...extractZiweiFactsForPerson(payload1, person1, '第一人盘面', '第二人盘面'),
    ...extractZiweiFactsForPerson(payload2, person2, '第二人盘面', '双盘关系资料'),
  ];
  const relationScope = { start: '【双盘关系资料】', end: '【任务】' };
  for (const [index, item] of (relation?.palaceOverlays ?? []).entries()) {
    facts.push(
      ...collect([
        fact(
          `ziwei.compatibility.overlay.${index}`,
          '双盘关系资料',
          [
            item.sourcePalace,
            item.targetPalace,
            `同处${item.earthlyBranch}支轴位`,
            ...item.sourceMajorStars.map((star) => `来源宫主星${star}`),
            ...item.targetMajorStars.map((star) => `目标宫主星${star}`),
          ],
          { scope: relationScope, unit: 'block' },
        ),
      ]),
    );
  }
  for (const [index, item] of (relation?.crossMutagenPlacements ?? []).entries()) {
    facts.push(
      ...collect([
        fact(
          `ziwei.compatibility.mutagen.${index}`,
          '双盘关系资料',
          [`${item.star}生年化${item.mutagen}`, item.sourcePalace, item.targetPalace],
          { scope: relationScope, unit: 'block' },
        ),
      ]),
    );
  }
  if (relation?.summaryFact?.promptText) {
    facts.push(
      ...collect([
        fact('ziwei.compatibility.summary', '双盘关系资料', [relation.summaryFact.promptText], {
          scope: relationScope,
          unit: 'block',
        }),
      ]),
    );
  }
  return facts;
}

function extractZiweiFactsForPerson(
  payload: AnalysisPayloadV1,
  personName: string,
  sectionStart: string,
  sectionEnd: string,
) {
  const scope = { start: `【${sectionStart}】`, end: `【${sectionEnd}】` };
  return collect(
    payload.palaces.map((palace) =>
      fact(
        `ziwei.compatibility.${personName}.${palace.index}`,
        palace.name,
        [
          `${palace.heavenly_stem}${palace.earthly_branch}`,
          ...palace.major_stars.map((star) => star.name),
          ...palace.minor_stars.map((star) => star.name),
          ...palace.other_stars.map((star) => star.name),
        ],
        { scope, unit: 'line' },
      ),
    ),
  );
}

function astrolabePointFact(id: string, owner: string, formatted: string, scope?: FactScope) {
  return fact(id, owner, [formatted], { scope });
}

function addAstrolabeAspects(facts: NatalPromptFact[], chart: AstrolabeData, scope?: FactScope) {
  for (const [index, aspect] of chart.aspects.entries()) {
    facts.push(
      ...collect([
        fact(
          `astrolabe.natal.aspect.${index}`,
          aspect.body1,
          [
            aspect.body2,
            aspect.type,
            typeof aspect.exactAngle === 'number' ? `目标角${aspect.exactAngle}°` : undefined,
            `偏差${aspect.orb.toFixed(2)}°`,
          ],
          { scope, unit: 'line' },
        ),
      ]),
    );
  }
}

/** 提取西占本命点位、完整相位两端及周期高级时限事实。 */
export function extractAstrolabeFacts(
  chart: AstrolabeData,
  context?: AstrolabeScopeContext | null,
  options: AstrolabeFactExtractionOptions = {},
): NatalPromptFact[] {
  const scope = options.scope ?? { start: '【星盘资料】', end: '【任务】' };
  const facts: NatalPromptFact[] = [];
  for (const point of [...chart.planets, ...chart.angles]) {
    facts.push(
      ...collect([
        astrolabePointFact(
          `astrolabe.natal.point.${point.name}`,
          point.label,
          point.formatted,
          scope,
        ),
      ]),
    );
  }
  if (options.includeHouses !== false) {
    for (const house of chart.houses) {
      facts.push(
        ...collect([
          astrolabePointFact(
            `astrolabe.natal.house.${house.name}`,
            house.label,
            house.formatted,
            scope,
          ),
        ]),
      );
    }
  }
  addAstrolabeAspects(facts, chart, scope);

  if (!context || context.scope === 'natal') return facts;
  const period = context.periodEvents;
  const periodScope =
    options.periodScope ??
    (period
      ? rangeScope(`周期关键星象（${period.startDateTime}至${period.endDateTime}`)
      : undefined);
  if (period) {
    for (const [index, event] of period.events.entries()) {
      facts.push(
        ...collect([
          fact(
            `astrolabe.${context.scope}.period.${index}`,
            event.movingPoint,
            [`${event.dateTime} ${event.promptText}`],
            { scope: periodScope, unit: 'line' },
          ),
        ]),
      );
    }
  }
  const advanced = [
    ['太阳返照', context.solarReturnEvidence],
    ['次限相位', context.secondaryProgressionEvidence],
    ['太阳弧相位', context.solarArcEvidence],
  ] as const;
  for (const [label, evidence] of advanced) {
    if (!evidence) continue;
    for (const [index, item] of evidence.aspectFacts.entries()) {
      facts.push(
        ...collect([
          fact(
            `astrolabe.${context.scope}.${label}.${index}`,
            label,
            [
              `${item.movingPoint}${item.aspectName}${item.natalPoint}`,
              `偏差${item.deviation.toFixed(2)}°`,
              item.closeness,
            ],
            { scope: periodScope, unit: 'line' },
          ),
        ]),
      );
    }
  }
  return facts;
}

/** 提取西占双盘的两端身份、跨盘相位和落宫关系。 */
export function extractAstrolabeSynastryFacts(
  chart1: AstrolabeData,
  chart2: AstrolabeData,
  relation: AstrolabeSynastryData,
) {
  const facts: NatalPromptFact[] = [];
  const addChart = (chart: AstrolabeData, person: string) => {
    const scope = { start: `【${person}本命盘】`, end: '【跨盘资料】' };
    for (const point of [...chart.planets, ...chart.angles]) {
      facts.push(
        ...collect([
          astrolabePointFact(
            `astrolabe.synastry.${person}.${point.name}`,
            point.label,
            point.formatted,
            scope,
          ),
        ]),
      );
    }
  };
  addChart(chart1, '第一人');
  addChart(chart2, '第二人');
  const relationScope = { start: '【跨盘资料】', end: '【任务】' };
  for (const [index, item] of relation.aspects.entries()) {
    facts.push(
      ...collect([
        fact(
          `astrolabe.synastry.aspect.${index}`,
          item.point1,
          [
            item.point1,
            item.point2,
            item.type,
            `目标角${item.exactAngle}°`,
            `实际夹角${item.actualAngle.toFixed(2)}°`,
            `偏差${item.orb.toFixed(2)}°`,
            `容许偏差上限${item.allowedOrb}°`,
            item.closeness,
          ],
          { scope: relationScope, unit: 'line' },
        ),
      ]),
    );
  }
  for (const [index, item] of relation.houseOverlays.entries()) {
    facts.push(
      ...collect([
        fact(
          `astrolabe.synastry.overlay.${index}`,
          item.point,
          [item.visitor, `第${item.house}宫`, item.owner],
          { scope: relationScope, unit: 'line' },
        ),
      ]),
    );
  }
  return facts;
}

function qizhengStarValues(star: {
  xiu: string;
  xiuDegree: number;
  signBranch: string;
  palace: string;
}) {
  return [`在${star.xiu}宿${star.xiuDegree.toFixed(2)}度`, `落${star.signBranch}宫${star.palace}`];
}

function qizhengFlowStarValues(star: {
  xiu: string;
  xiuDegree: number;
  signBranch: string;
  palace: string;
}) {
  return [
    `在${star.xiu}宿${star.xiuDegree.toFixed(2)}度`,
    `入本命${star.signBranch}宫${star.palace}`,
  ];
}

function extractQizhengFlowFacts(
  facts: NatalPromptFact[],
  flowing: QizhengFlowingStarsResult,
  options: { idPrefix: string; flowScope: FactScope; periodScope: FactScope },
) {
  facts.push(
    ...collect([
      fact(
        `${options.idPrefix}.flow.timestamp`,
        '落宫时刻',
        [flowing.localDateTime, flowing.timestampNote],
        { scope: options.flowScope, unit: 'line' },
      ),
    ]),
  );
  for (const [index, star] of flowing.stars.entries()) {
    facts.push(
      ...collect([
        fact(
          `${options.idPrefix}.flow.star.${index}`,
          `流曜${star.name}`,
          qizhengFlowStarValues(star),
          {
            scope: options.flowScope,
            unit: 'line',
          },
        ),
      ]),
    );
  }
  for (const [index, aspect] of flowing.transits.entries()) {
    facts.push(
      ...collect([
        fact(
          `${options.idPrefix}.flow.transit.${index}`,
          aspect.star1,
          [
            aspect.star2,
            `目标角${aspect.exactAngle}°`,
            `实际角距${aspect.actualAngle.toFixed(2)}°`,
            `偏差${aspect.orb.toFixed(2)}°`,
            `容许偏差上限${aspect.allowedOrb}°`,
            aspect.closeness,
          ],
          { scope: options.flowScope, unit: 'line' },
        ),
      ]),
    );
  }
  const period = flowing.periodEvents;
  if (period) {
    for (const [index, event] of period.events.entries()) {
      facts.push(
        ...collect([
          fact(
            `${options.idPrefix}.period.${index}`,
            `流曜${event.movingStar}`,
            [event.promptText],
            {
              scope: options.periodScope,
              unit: 'line',
            },
          ),
        ]),
      );
    }
  }
}

/** 提取七政四余本命曜度、宫位、行限、流曜及周期事件。 */
export function extractQizhengFacts(
  result: QizhengResult,
  options: QizhengFactExtractionOptions = {},
): NatalPromptFact[] {
  const idPrefix = options.idPrefix ?? 'qizheng';
  const natalScope = options.scope ?? { start: '【七政四余 · 果老星宗】' };
  const flowScope = options.flowScope ?? { start: '【流曜】' };
  const periodScope = options.periodScope ?? { start: '【流曜周期】' };
  const facts: NatalPromptFact[] = [];
  for (const [index, star] of result.stars.entries()) {
    facts.push(
      ...collect([
        fact(`${idPrefix}.natal.star.${index}`, star.name, qizhengStarValues(star), {
          scope: natalScope,
          unit: 'line',
        }),
      ]),
    );
  }
  for (const [index, aspect] of result.aspects.entries()) {
    facts.push(
      ...collect([
        fact(
          `${idPrefix}.natal.aspect.${index}`,
          aspect.star1,
          [aspect.star2, `目标角${aspect.exactAngle}°`, `偏差${aspect.orb.toFixed(2)}°`],
          { scope: natalScope, unit: 'line' },
        ),
      ]),
    );
  }
  const limits = result.timeLords;
  if (limits) {
    const scope = { start: '【行限】' };
    facts.push(
      ...collect([
        fact(`${idPrefix}.limits.major-current`, '大限', ['当前大限宫位未定'], { scope }),
        fact(
          `${idPrefix}.limits.minor-current`,
          '当前小限',
          [`${limits.currentMinorLimit.signBranch}宫${limits.currentMinorLimit.palace}`],
          { scope },
        ),
        fact(
          `${idPrefix}.limits.annual`,
          '流年太岁',
          [limits.annualBranch, `${limits.annualPalace.signBranch}宫${limits.annualPalace.palace}`],
          { scope },
        ),
      ]),
    );
    for (const [index, item] of limits.majorPalaceYears.entries()) {
      facts.push(
        ...collect([
          fact(
            `${idPrefix}.limits.palace-years.${index}`,
            '洞微宫序与各宫年数',
            [
              `${item.signBranch}宫${item.palace}`,
              item.years === null ? '依命度定年数' : `${item.years}年`,
            ],
            { scope },
          ),
        ]),
      );
    }
  }
  if (result.flowingStars) {
    extractQizhengFlowFacts(facts, result.flowingStars, {
      idPrefix,
      flowScope,
      periodScope,
    });
  }
  return facts;
}

export function extractNatalFacts(input: {
  bazi?: { result: BaziChartResult; selection?: FortuneSelectionContext | null };
  ziwei?: AnalysisPayloadV1 | ZiweiRuntime;
  astrolabe?: { chart: AstrolabeData; context?: AstrolabeScopeContext | null };
  qizheng?: QizhengResult;
}) {
  return {
    bazi: input.bazi ? extractBaziFacts(input.bazi.result, input.bazi.selection) : [],
    ziwei: input.ziwei ? extractZiweiFacts(input.ziwei) : [],
    astrolabe: input.astrolabe
      ? extractAstrolabeFacts(input.astrolabe.chart, input.astrolabe.context)
      : [],
    qizheng: input.qizheng ? extractQizhengFacts(input.qizheng) : [],
  };
}
