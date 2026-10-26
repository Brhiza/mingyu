import { useEffect, useMemo, useState } from 'react';
import type { QueryPromptState } from '@/lib/query-state';
import type { ReadingResource } from '@/lib/ai/reading-workflow';
import { buildMetaphysicsPrompt } from '@/lib/metaphysics-prompt';
import {
  calculateResidentialChart,
  resolveResidentialChartDraft,
  type ResidentialBirthData,
  type ResidentialChartDraft,
  type ResidentialChartState,
} from '@/lib/residential-fengshui-chart';

/** 盘面、任务书和页面借出的阅读资源都引用 owner 的同一结果。 */
export function buildResidentialReadingResource(
  chart: ResidentialChartState,
  question: string,
): ReadingResource | undefined {
  if (!chart.result) return undefined;
  return {
    key: `residential:${JSON.stringify(chart.input)}`,
    title: '住宅风水完整资料',
    text: buildMetaphysicsPrompt(chart.result.prompt, question, { method: 'residential' }),
    usable: true,
    structured: chart.result as unknown as Record<string, unknown>,
  };
}

export type ResidentialPromptState = Pick<
  QueryPromptState,
  | 'bazhaiFacingDegree'
  | 'residentialHouseYear'
  | 'residentialGuaType'
  | 'residentialFlowYear'
  | 'residentialFlowMonth'
  | 'residentialFlowDay'
>;

/** 页面独占计算；URL 恢复立即生效，编辑仅在停顿 250ms 后提交同一份输入。 */
export function useResidentialChart(
  birthData: ResidentialBirthData | null,
  prompt: ResidentialPromptState,
  onCommit: (patch: ResidentialPromptState) => void,
  navigationKey: string,
) {
  const {
    bazhaiFacingDegree,
    residentialHouseYear,
    residentialGuaType,
    residentialFlowYear,
    residentialFlowMonth,
    residentialFlowDay,
  } = prompt;
  const restored = useMemo<ResidentialChartDraft>(
    () => ({
      facingDegree: bazhaiFacingDegree,
      houseYear: residentialHouseYear,
      guaType: residentialGuaType,
      flowYear: residentialFlowYear,
      flowMonth: residentialFlowMonth,
      flowDay: residentialFlowDay,
    }),
    [
      bazhaiFacingDegree,
      residentialHouseYear,
      residentialGuaType,
      residentialFlowYear,
      residentialFlowMonth,
      residentialFlowDay,
    ],
  );
  const [edit, setEdit] = useState({ navigationKey, source: restored, draft: restored });
  // Forget the old edit as well as masking it: back/forward can revisit the same location key.
  let draft = edit.draft;
  if (edit.navigationKey !== navigationKey || edit.source !== restored) {
    setEdit({ navigationKey, source: restored, draft: restored });
    draft = restored;
  }
  const resolved = useMemo(
    () => resolveResidentialChartDraft(draft, birthData),
    [birthData, draft],
  );
  const calculated = useMemo<ResidentialChartState>(() => {
    const committed = resolveResidentialChartDraft(restored, birthData);
    if (!committed.input) return { ...committed, result: null, measurement: null };
    try {
      const { result, measurement } = calculateResidentialChart(committed.input);
      return { ...committed, result, measurement };
    } catch (error) {
      return {
        ...committed,
        result: null,
        measurement: null,
        error: error instanceof Error ? error.message : '住宅风水排盘失败。',
      };
    }
  }, [birthData, restored]);

  useEffect(() => {
    if (draft === restored || resolved.error) return;
    const timer = setTimeout(() => {
      onCommit({
        bazhaiFacingDegree: draft.facingDegree,
        residentialHouseYear: draft.houseYear,
        residentialGuaType: draft.guaType,
        residentialFlowYear: draft.flowYear,
        residentialFlowMonth: draft.flowMonth,
        residentialFlowDay: draft.flowDay,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, onCommit, resolved.error, restored]);

  const chart: ResidentialChartState = resolved.error
    ? { ...resolved, result: null, measurement: null }
    : calculated;
  return {
    draft,
    chart,
    onDraftChange: (patch: Partial<ResidentialChartDraft>) => {
      setEdit({ navigationKey, source: restored, draft: { ...draft, ...patch } });
    },
  };
}
