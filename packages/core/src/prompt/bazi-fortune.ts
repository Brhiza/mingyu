import {
  analyzeFortuneTriggers,
  formatFortuneActionFactLine,
  type BaziChartResult,
  type BaziFortuneBatchMetadata,
  type FortuneActionFact,
} from '../bazi/index';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import { getLuckCycleTimeRange, formatSolarDateTime } from '../bazi/luckTiming';

export interface BaziFortuneSelectionSections {
  /** 可直接放入【分析对象】分段的范围说明。 */
  analysisObject: string;
  /** 可直接放入【岁运重点】分段的上下层岁运、干支、触发与明细。 */
  focus: string;
}

const EVIDENCE_WEIGHT_LABELS: Record<string, string> = {
  主证: '主要依据',
  辅证: '补充依据',
  反证: '相反迹象',
  应期: '时间依据',
  限制: '适用范围',
};

/**
 * 岁运选择器的 evidenceLines 同时携带了面向提示词的证据条目和
 * triggerEvidence.promptText。后者是给 API 追溯用的完整计算记录，不能直接
 * 进入任务书；这里按证据条目的稳定标题取需要解读的事实，避免靠关键词清洗。
 */
const READABLE_FORTUNE_EVIDENCE_TITLES = new Set([
  '指定年限运限',
  '上层岁运背景',
  '大运干支与十神',
  '流年干支与十神',
  '流月干支与十神',
  '流日干支与十神',
  '刑冲合害触发',
  '岁运作用事实',
  '应期边界',
]);

/** 所选大运覆盖整段年份；更细的年、月、日选择只呈现所选层与上层。 */
const DAYUN_FORTUNE_DETAIL_TITLES = new Set(['该大运包含的流年']);

/**
 * 岁运选择层已经计算过分级证据；任务书保留权重和事实，但把内部证据
 * 包装转换成可直接阅读的自然语言，避免暴露来源标签和内部字段。
 */
function formatFortuneEvidenceLine(line: string): string | undefined {
  const segments = line
    .split('｜')
    .map((item) => item.trim())
    .filter(Boolean);
  const head = segments.shift() ?? '';
  const match = /^【(主证|辅证|反证|应期|限制)】(.+)$/.exec(head);
  if (!match || !READABLE_FORTUNE_EVIDENCE_TITLES.has(match[2].trim())) return undefined;

  const title = match[2].trim();
  const details = segments.filter(
    (item) => !item.startsWith('来源：') && !item.startsWith('标签：'),
  );
  return `${EVIDENCE_WEIGHT_LABELS[match[1]] ?? match[1]}（${title}）${
    details.length ? `：${details.join('；')}` : ''
  }`;
}

function formatFortuneEvidenceLines(lines: string[] | undefined) {
  const formatted = (lines ?? [])
    .map((line) => formatFortuneEvidenceLine(line))
    .filter((line): line is string => Boolean(line));
  return [...new Set(formatted)];
}

/** 同一层同干的明透与本气若只重复相同裁决，则并列位置并注明根气归属。 */
function consolidateFortuneActionLines(lines: string[], facts: FortuneActionFact[]): string[] {
  const skipped = new Set<number>();
  const merged = new Map<number, string>();
  for (const exposed of facts) {
    if (exposed.placement !== '岁运透干') continue;
    const hidden = facts.find(
      (fact) =>
        fact.placement === '岁运藏干' &&
        fact.hiddenCategory === '本气' &&
        fact.layerKey === exposed.layerKey &&
        fact.stem === exposed.stem &&
        fact.element === exposed.element &&
        fact.tenGod === exposed.tenGod &&
        fact.conditionStatus === exposed.conditionStatus &&
        fact.currentActionStatus === exposed.currentActionStatus &&
        fact.applicableTimeRange === exposed.applicableTimeRange &&
        fact.parentLayerKey === exposed.parentLayerKey &&
        !fact.rootEvidence &&
        JSON.stringify(fact.hitSources) === JSON.stringify(exposed.hitSources) &&
        JSON.stringify(fact.targetObjects) === JSON.stringify(exposed.targetObjects) &&
        JSON.stringify(fact.supportingFactKeys) === JSON.stringify(exposed.supportingFactKeys) &&
        JSON.stringify(fact.opposingFactKeys) ===
          JSON.stringify([
            ...exposed.opposingFactKeys,
            `bazi:fortune-action:counter:hidden-not-transparent:${fact.layerKey}:${fact.stem}:${fact.hiddenCategory}`,
          ]),
    );
    if (!hidden) continue;
    const exposedText = formatFortuneActionFactLine(exposed).replaceAll('｜', '；');
    const hiddenText = formatFortuneActionFactLine(hidden).replaceAll('｜', '；');
    const exposedIndex = lines.findIndex((line) => line.endsWith(exposedText));
    const hiddenIndex = lines.findIndex((line) => line.endsWith(hiddenText));
    if (exposedIndex < 0 || hiddenIndex < 0 || exposedIndex === hiddenIndex) continue;
    const exposedTitle = lines[exposedIndex].split('：', 1)[0];
    const hiddenTitle = lines[hiddenIndex].split('：', 1)[0];
    if (exposedTitle !== hiddenTitle) continue;
    merged.set(
      exposedIndex,
      lines[exposedIndex]
        .replace('，岁运透干）', '，岁运透干、岁运藏干·本气）')
        .replace('；根气：', '；透干根气：'),
    );
    skipped.add(hiddenIndex);
  }
  return lines.flatMap((line, index) => (skipped.has(index) ? [] : [merged.get(index) ?? line]));
}

/**
 * 把八字岁运选择结果整理为面向提示词的稳定文本。
 *
 * 页面、服务端和 MCP 共用该入口，避免把底层的“流年触发”等内部层级标签
 * 直接暴露成不一致的任务书字段。
 */
export function formatBaziFortuneSelection(
  context: FortuneSelectionContext | null | undefined,
): BaziFortuneSelectionSections | null {
  if (!context) return null;

  const { promptPayload, scope } = context;
  const summary = promptPayload.summaryLines ?? [];
  const lines: string[] = [];
  const cycleRange = context.cycleTimeRange;
  const rangeStart = `${formatSolarDateTime(cycleRange.start, true)}:${String(cycleRange.start.second).padStart(2, '0')}`;
  const rangeEnd = `${formatSolarDateTime(cycleRange.end, true)}:${String(cycleRange.end.second).padStart(2, '0')}`;
  const upperDayun = summary.find((line) => line.startsWith('所属大运：'));
  const consolidateYearDayun = scope === 'year' && Boolean(upperDayun);
  const selectedLayerName = { dayun: '大运', year: '流年', month: '流月', day: '流日' }[scope];
  if (!consolidateYearDayun) {
    lines.push(
      `所选岁运背景：${context.cycleGanZhi}${context.isXiaoyun ? '童运' : context.cycleType}`,
    );
  }
  lines.push(`该运交接范围：${rangeStart}起，至${rangeEnd}交接；起点归本运，终点归后续运段。`);
  lines.push(`该运交接年龄：${context.cycleAge}岁`);

  const selectedDate =
    scope === 'year'
      ? `${context.year}年`
      : scope === 'dayun'
        ? `${context.cycleStartYear}年起`
        : scope === 'month'
          ? summary.find((line) => line.startsWith('日期范围：'))?.replace('日期范围：', '')
          : context.dayBreakdown?.[0]?.date;
  if (selectedDate) lines.push(`选择日期：${selectedDate}`);

  if (scope === 'month') {
    const monthLine = summary.find((line) => line.startsWith('流月：'));
    const jieqiLine = summary.find((line) => line.startsWith('交节时刻：'));
    if (monthLine) lines.push(`节气月：${monthLine.replace('流月：', '')}`);
    if (jieqiLine) lines.push(jieqiLine.replace('交节时刻：', '交节：'));
  }

  if (upperDayun) {
    const label = upperDayun.replace('所属大运：', '上层岁运：');
    lines.push(consolidateYearDayun ? `${label}；年度判断必须承接该十年阶段。` : label);
  }

  const upperYear = summary.find((line) => line.startsWith('所属流年：'));
  if (upperYear) lines.push(upperYear.replace('所属流年：', '上层流年：'));

  const selectedGanZhi =
    summary.find((line) => line.startsWith('流年干支：')) ??
    summary.find((line) => line.startsWith('流月：')) ??
    summary.find((line) => line.startsWith('流日：')) ??
    summary.find((line) => line.startsWith('大运干支：'));
  if (selectedGanZhi) {
    const label = selectedGanZhi.includes('流年')
      ? '流年干支：'
      : selectedGanZhi.includes('流月')
        ? '流月：'
        : selectedGanZhi.includes('流日')
          ? '流日：'
          : '大运干支：';
    lines.push(`所选干支：${selectedGanZhi.replace(label, '')}`);
  }

  const selectedFacts = [
    ...new Set((promptPayload.selectedFacts ?? []).map((line) => line.trim()).filter(Boolean)),
  ].filter(
    (fact) =>
      !(
        promptPayload.triggerEvidence?.relations.length &&
        fact.startsWith(`${selectedLayerName}触发：`)
      ),
  );
  // 已展示所选层、上层岁运和干支关系时，证据区不再复述同一事实。
  const actionFacts = promptPayload.actionEvidence?.facts ?? [];
  const evidenceLines = formatFortuneEvidenceLines(promptPayload.evidenceLines).filter((line) => {
    if (
      selectedFacts.some((fact) => fact.startsWith(`${selectedLayerName}十神：`)) &&
      line.startsWith(`主要依据（${selectedLayerName}干支与十神）：`)
    )
      return false;
    if (scope === 'year' && line.startsWith('时间依据（应期边界）：')) return false;
    if (
      promptPayload.triggerEvidence?.relations.length &&
      line.startsWith('主要依据（刑冲合害触发）：')
    )
      return false;
    if (line.startsWith('主要依据（指定年限运限）：')) return false;
    if (upperDayun || upperYear) {
      if (line.startsWith('补充依据（上层岁运背景）：')) return false;
    }
    return true;
  });
  const renderedActionFacts = new Set(
    actionFacts.filter((fact) =>
      evidenceLines.some((line) =>
        line.includes(formatFortuneActionFactLine(fact).replaceAll('｜', '；')),
      ),
    ),
  );
  const consolidatedEvidenceLines = consolidateFortuneActionLines(evidenceLines, actionFacts);
  const selectedFactsToRender = selectedFacts.filter(
    (fact) => !consolidatedEvidenceLines.some((line) => line.includes(fact)),
  );
  if (selectedFactsToRender.length) {
    lines.push(`所选层关键事实：\n${selectedFactsToRender.join('\n')}`);
  }

  if (consolidatedEvidenceLines.length) {
    lines.push(`岁运取证：\n${consolidatedEvidenceLines.join('\n')}`);
  }

  lines.push(...formatTriggerRelations(promptPayload.triggerEvidence));
  const missingActionFacts = actionFacts.filter((fact) => !renderedActionFacts.has(fact));
  if (missingActionFacts.length) {
    lines.push(
      '岁运作用事实：\n' +
        missingActionFacts.map((fact) => formatFortuneActionFactLine(fact)).join('\n'),
    );
  }
  const groups = new Map<string, Set<string>>();
  for (const group of scope === 'dayun' ? (promptPayload.detailGroups ?? []) : []) {
    const title = group.title.trim();
    if (!DAYUN_FORTUNE_DETAIL_TITLES.has(title)) continue;
    const entries = groups.get(title) ?? new Set<string>();
    for (const line of group.lines) {
      const value = line.trim();
      if (value) entries.add(value);
    }
    if (entries.size) groups.set(title, entries);
  }
  for (const [title, entries] of groups) {
    lines.push(`${title}\n${[...entries].join('\n')}`);
  }

  return {
    analysisObject: promptPayload.scopeLabel,
    focus: lines.join('\n'),
  };
}

function formatTriggerRelations(
  triggerEvidence: FortuneSelectionContext['promptPayload']['triggerEvidence'],
) {
  const lines: string[] = [];
  if (triggerEvidence?.relations.length) {
    const names = {
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
    };
    const pairs = new Map<string, { label: string; relations: Set<string> }>();
    const label = (layer: { label: string; ganZhi: string }) =>
      layer.label.includes(layer.ganZhi) ? layer.label : `${layer.label}${layer.ganZhi}`;
    for (const relation of triggerEvidence.relations) {
      const key = `${relation.sourceLayerKey}:${relation.targetLayerKey}`;
      const pair = pairs.get(key) ?? {
        label: `${label(relation.source)}↔${label(relation.target)}`,
        relations: new Set<string>(),
      };
      pair.relations.add(names[relation.type]);
      pairs.set(key, pair);
    }
    lines.push(
      '岁运干支关系：\n' +
        [...pairs.values()]
          .map((pair) => `${pair.label}：${[...pair.relations].join('、')}`)
          .join('；'),
    );
  }
  if (triggerEvidence?.formations.length) {
    const layersByKey = new Map(triggerEvidence.layers.map((layer) => [layer.key, layer]));
    const formatLayer = (layer: { label: string; ganZhi: string }) =>
      layer.label.includes(layer.ganZhi) ? layer.label : `${layer.label}${layer.ganZhi}`;
    const formationLines = triggerEvidence.formations.map((formation) => {
      const participants = formation.participantLayerKeys.flatMap((key) => {
        const layer = layersByKey.get(key);
        return layer ? [formatLayer(layer)] : [];
      });
      const participantText = participants.length
        ? `参与层级：${[...new Set(participants)].join('、')}`
        : '参与层级资料未列出';
      return `${formation.label}（地支：${formation.branches.join('、')}；${participantText}；${formation.interpretationLimit}）`;
    });
    lines.push(`三合三会：${[...new Set(formationLines)].join('；')}`);
  }
  return lines;
}

type FortuneCycle = NonNullable<BaziChartResult['luckInfo']>['cycles'][number];

const FORTUNE_NOTATION = '十神记法：干/支主气；流年以立春交接，交运年结合大运交接时刻。';

function formatFortuneCycle(result: BaziChartResult, cycle: FortuneCycle) {
  const range = getLuckCycleTimeRange(cycle);
  const layers = cycle.isXiaoyun
    ? []
    : [{ id: 'dayun', type: 'dayun' as const, label: '大运', ganZhi: cycle.ganZhi }];
  return {
    layers,
    lines: [
      `${cycle.isXiaoyun ? '童运' : `${cycle.ganZhi}大运`}｜${cycle.age}岁起｜${formatSolarDateTime(range.start, true)}～${formatSolarDateTime(range.end, true)}`,
      ...formatTriggerRelations(analyzeFortuneTriggers(result, layers)),
    ],
  };
}

function formatFortuneYear(
  result: BaziChartResult,
  year: FortuneCycle['years'][number],
  layers: ReturnType<typeof formatFortuneCycle>['layers'],
) {
  const evidence = analyzeFortuneTriggers(result, [
    ...layers,
    { id: 'year', type: 'year', label: `${year.year}流年`, ganZhi: year.ganZhi },
  ]);
  return [
    `${year.year}年(${year.age}岁) ${year.ganZhi}｜${year.tenGod}/${year.tenGodZhi}${year.xiaoyun ? `｜小运${year.xiaoyun.ganZhi} ${year.xiaoyun.tenGod}/${year.xiaoyun.tenGodZhi}` : ''}`,
    ...formatTriggerRelations({
      ...evidence,
      relations: evidence.relations.filter((item) => item.source.type === 'year'),
    }).map((line) => line.replace('岁运干支关系：\n', '')),
  ];
}

export interface BaziFortuneTextBatch {
  text: string;
  batch: BaziFortuneBatchMetadata;
}

/** 合参分册的本命页不携带任何大运流年，避免把完整命限重复塞入首册。 */
export function selectBaziNatalResult(result: BaziChartResult): BaziChartResult {
  return {
    ...result,
    liunian: [],
    luckInfo: {
      ...result.luckInfo,
      cycles: [],
    },
  };
}

/** 公开分批结果保留本命事实，命限仅携带本次所属大运及流年。 */
export function selectBaziFortuneBatchResult(
  result: BaziChartResult,
  batch: BaziFortuneTextBatch['batch'],
): BaziChartResult {
  const cycle = batch.cycleIndex === null ? undefined : result.luckInfo.cycles[batch.cycleIndex];
  const years = cycle?.years.filter((year) => year.year === batch.year) ?? [];
  return {
    ...result,
    liunian: years,
    luckInfo: {
      ...result.luckInfo,
      cycles: cycle
        ? [
            {
              ...cycle,
              years,
              // 本页只有一段大运，跨运去重不能删除当前实际覆盖的交运年。
              resolvedYears: years,
            },
          ]
        : [],
    },
  };
}

/** 每次仅组织一个大运内的流年，交运年在两步运内的资料分别保留。 */
export function formatBaziFortuneBatch(
  result: BaziChartResult,
  startIndex = 0,
): BaziFortuneTextBatch {
  const cycles = result.luckInfo?.cycles ?? [];
  const totalEntries = cycles.reduce((total, cycle) => total + Math.max(cycle.years.length, 1), 0);
  if (
    !Number.isSafeInteger(startIndex) ||
    startIndex < 0 ||
    startIndex >= Math.max(totalEntries, 1)
  ) {
    throw new RangeError('八字命限续取位置超出资料范围。');
  }
  const batch: BaziFortuneTextBatch['batch'] = {
    unit: 'cycle-year',
    startIndex,
    endIndexExclusive: Math.min(startIndex + 1, totalEntries),
    totalEntries,
    nextIndex: startIndex + 1 < totalEntries ? startIndex + 1 : null,
    cycleIndex: null,
    year: null,
  };
  let offset = startIndex;
  for (let cycleIndex = 0; cycleIndex < cycles.length; cycleIndex++) {
    const cycle = cycles[cycleIndex];
    const entries = Math.max(cycle.years.length, 1);
    if (offset >= entries) {
      offset -= entries;
      continue;
    }
    const { layers, lines } = formatFortuneCycle(result, cycle);
    const year = cycle.years[offset];
    batch.cycleIndex = cycleIndex;
    batch.year = year?.year ?? null;
    return formatBaziFortuneBatchEntry(result, cycle, year, batch, layers, lines);
  }
  return { text: '', batch };
}

/** 为核心已按游标构造的一页命限生成与旧全量裁剪完全相同的文本。 */
export function formatCalculatedBaziFortuneBatch(
  result: BaziChartResult,
  batch: BaziFortuneBatchMetadata,
): BaziFortuneTextBatch {
  const cycle = result.luckInfo.cycles[0];
  if (!cycle) return { text: '', batch };
  const year = cycle.years.find((item) => item.year === batch.year);
  const { layers, lines } = formatFortuneCycle(result, cycle);
  return formatBaziFortuneBatchEntry(result, cycle, year, batch, layers, lines);
}

function formatBaziFortuneBatchEntry(
  result: BaziChartResult,
  _cycle: FortuneCycle,
  year: FortuneCycle['years'][number] | undefined,
  batch: BaziFortuneBatchMetadata,
  layers: ReturnType<typeof formatFortuneCycle>['layers'],
  lines: string[],
): BaziFortuneTextBatch {
  return {
    text: [
      '本次大运流年：',
      FORTUNE_NOTATION,
      ...lines,
      ...(year ? formatFortuneYear(result, year, layers) : []),
    ].join('\n'),
    batch,
  };
}

export function formatBaziFullFortune(result: BaziChartResult): string {
  const cycles = result.luckInfo?.cycles ?? [];
  if (!cycles.length) return '';
  const lines = ['完整大运流年：', FORTUNE_NOTATION];
  for (const cycle of cycles) {
    const { layers, lines: cycleLines } = formatFortuneCycle(result, cycle);
    lines.push(...cycleLines);
    for (const year of cycle.years) {
      lines.push(...formatFortuneYear(result, year, layers));
    }
  }
  return lines.join('\n');
}
