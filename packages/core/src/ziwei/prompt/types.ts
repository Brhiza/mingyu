import type { ScopeType } from '../../types/analysis';

/**
 * 紫微提示词快照所需的最小报告上下文。
 *
 * 这里不包含页面标题、路由、存储键或 React 状态；调用方可以把自己的
 * 报告系统映射成这个结构后复用快照编排。
 */
export interface ZiweiPromptContext {
  reportKey?: string;
  reportTitle?: string;
  reportType?: string;
  selectedTopic?: string;
  scope: ScopeType;
  scopeLabel?: string;
  palaceName?: string;
  focusNotes?: string[];
}

export type ZiweiPromptSnapshotMode = 'readable' | 'task-book';

export interface ZiweiFocusTaskBundle {
  focusSummary: string;
  focusPalaces: import('../../types/analysis').PalaceFact[];
  avoid: string[];
}
