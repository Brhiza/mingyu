import type { calculateFullZiweiChart } from '@/lib/full-chart-engine';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';

export type ZiweiRuntimeState = Awaited<ReturnType<typeof calculateFullZiweiChart>> | null;
export type ZiweiPayloadByScopeState = Record<ScopeType, AnalysisPayloadV1> | null;
export type PromptEngineModule = typeof import('@/lib/prompt-engine');
export type BaziFortuneSelectionModule = typeof import('mingyu-core/bazi');
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

export type { ZiweiDayOption, ZiweiMonthOption, ZiweiYearOption } from 'mingyu-core/ziwei';
