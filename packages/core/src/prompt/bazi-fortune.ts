import type { FortuneSelectionContext } from '../bazi/fortuneSelection';

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

  const triggerLine = summary.find((line) => line.includes('触发：'));
  if (triggerLine) {
    lines.push(`主要触发：${triggerLine.split('：').slice(1).join('：')}`);
  }

  const detailGroups = (promptPayload.detailGroups ?? []).filter(
    (group) =>
      group.lines.length &&
      (scope === 'dayun' || (scope === 'day' && group.title === '该流日包含的流时')),
  );
  if (detailGroups.length) lines.push(detailGroups.map((group) => group.title).join('、'));
  for (const group of detailGroups) {
    lines.push(`${group.title}\n${group.lines.map((line) => `  - ${line}`).join('\n')}`);
  }

  return {
    analysisObject: promptPayload.scopeLabel,
    focus: lines.join('\n'),
  };
}
