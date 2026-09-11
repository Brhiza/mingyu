import { analyzeFortuneTriggers, type BaziChartResult } from '../bazi/index';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import { getLuckCycleTimeRange, formatSolarDateTime } from '../bazi/luckTiming';

export interface BaziFortuneSelectionSections {
  /** 可直接放入【分析对象】分段的范围说明。 */
  analysisObject: string;
  /** 可直接放入【岁运重点】分段的上下层岁运、干支、触发与明细。 */
  focus: string;
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
  lines.push(
    `所选岁运背景：${context.cycleGanZhi}${context.isXiaoyun ? '童运' : context.cycleType}`,
  );
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

  const upperDayun = summary.find((line) => line.startsWith('所属大运：'));
  if (upperDayun) lines.push(upperDayun.replace('所属大运：', '上层岁运：'));

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
  ];
  if (selectedFacts.length) lines.push(`所选层关键事实：\n${selectedFacts.join('\n')}`);

  lines.push(...formatTriggerRelations(promptPayload.triggerEvidence));
  const groups = new Map<string, Set<string>>();
  for (const group of promptPayload.detailGroups ?? []) {
    const entries = groups.get(group.title) ?? new Set<string>();
    for (const line of group.lines) entries.add(line);
    if (entries.size) groups.set(group.title, entries);
  }
  for (const [title, entries] of groups) lines.push(`${title}\n${[...entries].join('\n')}`);

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
    lines.push(
      `三合三会：${[...new Set(triggerEvidence.formations.map((item) => item.label))].join('；')}`,
    );
  }
  return lines;
}

export function formatBaziFullFortune(result: BaziChartResult): string {
  const cycles = result.luckInfo?.cycles ?? [];
  if (!cycles.length) return '';
  const lines = ['完整大运流年：', '十神记法：干/支主气；流年以立春交接，交运年结合大运交接时刻。'];
  for (const cycle of cycles) {
    const range = getLuckCycleTimeRange(cycle);
    lines.push(
      `${cycle.isXiaoyun ? '童运' : `${cycle.ganZhi}大运`}｜${cycle.age}岁起｜${formatSolarDateTime(range.start, true)}～${formatSolarDateTime(range.end, true)}`,
    );
    const layers = cycle.isXiaoyun
      ? []
      : [{ id: 'dayun', type: 'dayun' as const, label: '大运', ganZhi: cycle.ganZhi }];
    lines.push(...formatTriggerRelations(analyzeFortuneTriggers(result, layers)));
    for (const year of cycle.years) {
      lines.push(
        `${year.year}年(${year.age}岁) ${year.ganZhi}｜${year.tenGod}/${year.tenGodZhi}${year.xiaoyun ? `｜小运${year.xiaoyun.ganZhi} ${year.xiaoyun.tenGod}/${year.xiaoyun.tenGodZhi}` : ''}`,
      );
      const evidence = analyzeFortuneTriggers(result, [
        ...layers,
        { id: 'year', type: 'year', label: `${year.year}流年`, ganZhi: year.ganZhi },
      ]);
      lines.push(
        ...formatTriggerRelations({
          ...evidence,
          relations: evidence.relations.filter((item) => item.source.type === 'year'),
        }).map((line) => line.replace('岁运干支关系：\n', '')),
      );
    }
  }
  return lines.join('\n');
}
