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
  }>;
  dayBreakdown?: Array<{
    date: string;
    label: string;
    ganZhi: string;
    startDateTime?: string;
    endDateTime?: string;
    boundaryNote?: string;
  }>;
  hourBreakdown?: Array<{
    label: string;
    ganZhi: string;
    timeRange?: string;
  }>;
  displayLabel: string;
  displayText: string;
  promptPayload: FortunePromptPayload;
}

export interface BaziFortuneSelectionValue {
  scope: 'natal' | 'dayun' | 'year' | 'month' | 'day';
  cycleIndex?: number;
  year?: number;
  month?: number;
  day?: number;
}
