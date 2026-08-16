/**
 * 公开 API 提示词的前端兼容入口。
 *
 * 提示词编排属于可复用的核心能力，实际实现统一放在 mingyu-core；这里仅
 * 保留历史导入路径，避免页面和服务端调用方一次性迁移。
 */
export {
  BAZI_FORTUNE_SCOPES,
  BAZI_MULTI_SCHOOLS,
  BAZI_PROMPT_TOPICS,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_PROMPT_TOPICS,
  ZIWEI_SCHOOLS,
  buildBaziPromptForResult,
  buildBaziSchoolPromptSection,
  buildBaziZiweiPromptForResults,
  buildCombinedPromptText,
  buildPublicZiweiPromptForRuntime,
  buildSerializableZiweiResult,
  buildZiweiPromptForRuntime,
  formatPublicZiweiFullScopeText,
  getBaziSchoolGuidance,
  getZiweiPromptCalculationScopes,
  getZiweiSchoolGuidance,
} from 'mingyu-core/prompt/public-api';

export type {
  BaziPromptTopic,
  BaziSchool,
  PromptMode,
  PublicBaziFortuneScope,
  ZiweiPromptScope,
  ZiweiPromptTopic,
  ZiweiSchool,
} from 'mingyu-core/prompt/public-api';
