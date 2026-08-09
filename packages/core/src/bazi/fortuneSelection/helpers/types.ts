import type { FortuneTriggerEvidenceResult } from '../../fortuneTriggerEvidence';
import type { LocalTimeRange } from '../../baziTypes';

export type FortuneHourMode = 'twelve' | 'splitZi';

export interface FortuneSelectionOptions {
  /** 默认十二时辰；splitZi 保留旧版早子时、晚子时拆分。 */
  hourMode?: FortuneHourMode;
}

export interface FortunePromptPayload {
  scopeLabel: string;
  summaryLines: string[];
  evidenceLines?: string[];
  breakdownTitle?: string;
  breakdownLines?: string[];
  detailGroups?: Array<{
    title: string;
    lines: string[];
  }>;
  /** 可供 API、页面和提示词复用的逐层岁运触发事实。 */
  triggerEvidence?: FortuneTriggerEvidenceResult;
}

export interface FortuneSelectionContext {
  scope: 'dayun' | 'year' | 'month' | 'day';
  cycleIndex: number;
  cycleLabel: string;
  cycleGanZhi: string;
  cycleStartYear: number;
  cycleAge: number;
  cycleType: string;
  isXiaoyun: boolean;
  cycleTimeRange: LocalTimeRange;
  year?: number;
  yearGanZhi?: string;
  yearAge?: number;
  month?: number;
  monthGanZhi?: string;
  monthLabel?: string;
  monthStartDate?: string;
  monthEndDate?: string;
  monthJieqiName?: string;
  monthJieqiDate?: string;
  yearBreakdown?: Array<{
    year: number;
    ganZhi: string;
    age: number;
    timeRange: LocalTimeRange;
  }>;
  monthBreakdown?: Array<{
    month: number;
    label: string;
    ganZhi: string;
    startDate: string;
    endDate: string;
    startDateTime?: string;
    endDateTime?: string;
    startTermName?: string;
    endTermName?: string;
    timeRange: LocalTimeRange;
  }>;
  dayBreakdown?: Array<{
    date: string;
    label: string;
    ganZhi: string;
    startDateTime?: string;
    endDateTime?: string;
    boundaryNote?: string;
    timeRange: LocalTimeRange;
  }>;
  hourBreakdown?: Array<{
    label: string;
    ganZhi: string;
    timeRange?: string;
    interval: LocalTimeRange;
  }>;
  displayLabel: string;
  displayText: string;
  promptPayload: FortunePromptPayload;
}

export interface BaziFortuneSelectionValue {
  scope: 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';
  cycleIndex?: number;
  year?: number;
  month?: number;
  day?: number;
}
