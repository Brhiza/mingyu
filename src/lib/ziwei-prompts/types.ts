import type { ScopeType } from '../../types/analysis';
import type { ZiweiPromptContext } from 'mingyu-core/ziwei/prompt';

export type PromptContext = {
  report_key: string;
  report_title: string;
  report_type: string;
  selected_topic: string;
  scope_type: ScopeType;
  scope_label: string;
  palace_name?: string;
  focus_notes: string[];
};

export function toZiweiPromptContext(context: PromptContext): ZiweiPromptContext {
  return {
    reportKey: context.report_key,
    reportTitle: context.report_title,
    reportType: context.report_type,
    selectedTopic: context.selected_topic,
    scope: context.scope_type,
    scopeLabel: context.scope_label,
    palaceName: context.palace_name,
    focusNotes: context.focus_notes,
  };
}
