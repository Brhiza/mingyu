import type { calculateFullZiweiChart } from '@/lib/full-chart-engine';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';

export type ZiweiRuntimeState = Awaited<ReturnType<typeof calculateFullZiweiChart>> | null;
export type ZiweiPayloadByScopeState = Record<ScopeType, AnalysisPayloadV1> | null;
export type PromptEngineModule = typeof import('@/lib/prompt-engine');
export type BaziFortuneSelectionModule = typeof import('@core/bazi/audited');
export type PromptShortcutMode = string;
export type InspirationCategory =
  | '全部'
  | '近期'
  | '事业'
  | '财运'
  | '婚恋'
  | '子女'
  | '六亲'
  | '家庭'
  | '人际'
  | '情绪'
  | '健康'
  | '学业'
  | '成长'
  | '天赋';

export type ZiweiYearOption = {
  year: number;
  age: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

export type ZiweiMonthOption = {
  month: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

export type ZiweiDayOption = {
  day: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};
