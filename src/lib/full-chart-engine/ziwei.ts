/**
 * 紫微运行时与提示词的前端兼容入口。
 *
 * 纯计算与任务书能力均由 @temposoul/core 提供；这里仅保留旧导入路径。
 */
import {
  buildZiweiChartInput as buildCoreZiweiChartInput,
  type ZiweiChartInputDraft,
} from '@temposoul/core/ziwei';
import { applyFrontendBirthTimeDefaults } from '@/lib/time-policy';

export type { ZiweiRuntime } from '@temposoul/core/ziwei';
export {
  buildZiweiPayloadByScope,
  calculateFullZiweiChart,
  calculatePublicZiweiChartForScopes,
  calculateZiweiChart,
  calculateZiweiChartForScopes,
  calculateZiweiDisplayPayload,
  calculateZiweiPayloadByScope,
} from '@temposoul/core/ziwei';

/** 网页端固定使用统一历史时区默认值，不向普通用户暴露高级时间选项。 */
export function buildZiweiChartInput(input: ZiweiChartInputDraft) {
  return buildCoreZiweiChartInput(applyFrontendBirthTimeDefaults(input));
}
export {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
  formatZiweiTrueSolarEvidence,
} from '@temposoul/core/ziwei/prompt';
