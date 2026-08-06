/**
 * 紫微运行时与提示词的前端兼容入口。
 *
 * 纯计算与任务书能力均由 mingyu-core 提供；这里仅保留旧导入路径。
 */
export type { ZiweiRuntime } from 'mingyu-core/ziwei';
export {
  buildZiweiChartInput,
  buildZiweiPayloadByScope,
  calculateFullZiweiChart,
  calculatePublicZiweiChartForScopes,
  calculateZiweiChart,
  calculateZiweiChartForScopes,
  calculateZiweiDisplayPayload,
  calculateZiweiPayloadByScope,
} from 'mingyu-core/ziwei';
export {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
  formatZiweiTrueSolarEvidence,
} from 'mingyu-core/ziwei/prompt';
